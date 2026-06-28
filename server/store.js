// store.js — Supabase-backed storage. Replaces the original JSON-file
// version: a file on Render's disk gets wiped every time the service
// redeploys (a new code push, a restart, etc.), which meant the curated
// list had to be rebuilt from scratch after every update. Supabase is a
// real, persistent database that survives deploys, so your curated list
// now sticks around across updates.
//
// Every exported function here has the exact same name and signature as
// the old file-based version, so nothing else in the app (server.js,
// the two HTML files) needed to change.

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "[store] Missing SUPABASE_URL or SUPABASE_KEY environment variables. " +
    "Set these in Render's Environment settings (or a local .env when running " +
    "on your own computer) — see README for setup steps."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Approved stories drop off the public page automatically after this many
// hours, unless marked "breaking" — keeps the page from slowly filling up
// with stale stories you forgot to remove. Breaking stories stay pinned
// until you remove them yourself, since marking something breaking means
// it should stick around longer.
const EXPIRY_HOURS = 48;

// Converts a database row (snake_case columns) back into the same shape
// the rest of the app already expects (camelCase, matching the old
// file-based version) — this is what keeps server.js and the HTML files
// unaware that anything changed underneath.
function rowToItem(row) {
  return {
    id: row.id,
    title: row.title,
    link: row.link,
    pubDate: row.pub_date,
    tag: row.tag,
    category: row.category,
    source: row.source,
    subreddit: row.subreddit || undefined,
    isComment: row.is_comment || undefined,
    status: row.status,
    fetchedAt: row.fetched_at,
    approvedAt: row.approved_at || undefined,
    breaking: row.breaking || undefined,
  };
}

async function mergeIncoming(newItems) {
  console.log(`[store] mergeIncoming called with ${newItems.length} items`);
  if (!newItems.length) return;

  // Only insert items that don't already exist — an upsert with
  // ignoreDuplicates achieves the same "don't overwrite existing items"
  // behavior the old mergeIncoming had, in one round trip instead of
  // checking each id individually.
  const rows = newItems.map((item) => ({
    id: item.id,
    title: item.title,
    link: item.link,
    pub_date: item.pubDate,
    tag: item.tag,
    category: item.category,
    source: item.source,
    subreddit: item.subreddit || null,
    is_comment: item.isComment || false,
    status: "pending",
    fetched_at: new Date().toISOString(),
  }));

  console.log(`[store] attempting upsert of ${rows.length} rows. SUPABASE_URL set: ${!!SUPABASE_URL}, SUPABASE_KEY set: ${!!SUPABASE_KEY}`);

  const { data, error, status, statusText } = await supabase
    .from("items")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true })
    .select();

  console.log(`[store] upsert result — status: ${status} ${statusText}, error: ${error ? JSON.stringify(error) : 'none'}, returned rows: ${data ? data.length : 'null'}`);

  if (error) {
    console.error("[store] mergeIncoming error:", error.message);
  }
}

async function approve(id) {
  // New approvals go to the front (order 0); everything else shifts down.
  // Mirrors the old behavior where a freshly-approved item became the
  // lead unless you used "Make Lead" / reordered afterward.
  const { data: existing } = await supabase
    .from("items")
    .select("approved_order")
    .eq("status", "approved");

  const maxOrder = existing && existing.length
    ? Math.max(...existing.map((r) => r.approved_order ?? 0))
    : -1;

  const { error } = await supabase
    .from("items")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_order: maxOrder + 1,
    })
    .eq("id", id);

  if (error) console.error("[store] approve error:", error.message);
}

async function reject(id) {
  const { error } = await supabase
    .from("items")
    .update({ status: "rejected", approved_order: null })
    .eq("id", id);

  if (error) console.error("[store] reject error:", error.message);
}

async function reorder(orderedIds) {
  // Apply the new order only to ids that are actually approved — mirrors
  // the old reorder's filter behavior, so a stray/stale id can't sneak
  // something back onto the public page.
  const { data: approvedRows, error: fetchError } = await supabase
    .from("items")
    .select("id")
    .eq("status", "approved");

  if (fetchError) {
    console.error("[store] reorder fetch error:", fetchError.message);
    return;
  }

  const approvedIdSet = new Set((approvedRows || []).map((r) => r.id));
  const validOrderedIds = orderedIds.filter((id) => approvedIdSet.has(id));

  // Supabase has no single "update many rows with different values" call,
  // so each position update is its own request. At the scale of one
  // person's curation queue (tens of items, not thousands) this is fast
  // enough; not worth the complexity of a batched RPC for this use case.
  await Promise.all(
    validOrderedIds.map((id, index) =>
      supabase.from("items").update({ approved_order: index }).eq("id", id)
    )
  );
}

async function toggleBreaking(id) {
  const { data, error: fetchError } = await supabase
    .from("items")
    .select("breaking")
    .eq("id", id)
    .single();

  if (fetchError) {
    console.error("[store] toggleBreaking fetch error:", fetchError.message);
    return;
  }

  const { error } = await supabase
    .from("items")
    .update({ breaking: !data.breaking })
    .eq("id", id);

  if (error) console.error("[store] toggleBreaking error:", error.message);
}

async function getAll() {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("pub_date", { ascending: false });

  if (error) {
    console.error("[store] getAll error:", error.message);
    return [];
  }
  return (data || []).map(rowToItem);
}

async function getApproved() {
  const now = Date.now();

  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("status", "approved")
    .order("approved_order", { ascending: true });

  if (error) {
    console.error("[store] getApproved error:", error.message);
    return [];
  }

  const stillLive = [];
  const expiredIds = [];

  for (const row of data || []) {
    const item = rowToItem(row);
    const ageHours = item.approvedAt
      ? (now - new Date(item.approvedAt).getTime()) / (1000 * 60 * 60)
      : 0;

    if (!item.breaking && ageHours > EXPIRY_HOURS) {
      expiredIds.push(item.id);
    } else {
      stillLive.push(item);
    }
  }

  // persist the cleanup so expired items don't linger in storage forever
  if (expiredIds.length) {
    await supabase
      .from("items")
      .update({ status: "expired", approved_order: null })
      .in("id", expiredIds);
  }

  return stillLive;
}

module.exports = { mergeIncoming, approve, reject, reorder, toggleBreaking, getAll, getApproved };
