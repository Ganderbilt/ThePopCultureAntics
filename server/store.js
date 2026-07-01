// store.js — Neon (Postgres)-backed storage. Replaces the Supabase
// version. Same exported functions, same signatures, so server.js and
// the HTML files don't need to change.

const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    "[store] Missing DATABASE_URL environment variable. " +
    "Set this in Render's Environment settings (or a local .env when " +
    "running on your own computer) to your Neon connection string."
  );
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const EXPIRY_HOURS = 48;

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

  const client = await pool.connect();
  try {
    for (const item of newItems) {
      await client.query(
        `INSERT INTO items (id, title, link, pub_date, tag, category, source, subreddit, is_comment, status, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          item.id,
          item.title,
          item.link,
          item.pubDate,
          item.tag,
          item.category,
          item.source,
          item.subreddit || null,
          item.isComment || false,
          new Date().toISOString(),
        ]
      );
    }
    console.log(`[store] mergeIncoming finished processing ${newItems.length} items`);
  } catch (err) {
    console.error("[store] mergeIncoming error:", err.message);
  } finally {
    client.release();
  }
}

async function approve(id) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT approved_order FROM items WHERE status = 'approved'`
    );
    const maxOrder = rows.length
      ? Math.max(...rows.map((r) => r.approved_order ?? 0))
      : -1;

    await client.query(
      `UPDATE items SET status = 'approved', approved_at = $1, approved_order = $2 WHERE id = $3`,
      [new Date().toISOString(), maxOrder + 1, id]
    );
  } catch (err) {
    console.error("[store] approve error:", err.message);
  } finally {
    client.release();
  }
}

async function reject(id) {
  try {
    await pool.query(
      `UPDATE items SET status = 'rejected', approved_order = NULL WHERE id = $1`,
      [id]
    );
  } catch (err) {
    console.error("[store] reject error:", err.message);
  }
}

async function reorder(orderedIds) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id FROM items WHERE status = 'approved'`
    );
    const approvedIdSet = new Set(rows.map((r) => r.id));
    const validOrderedIds = orderedIds.filter((id) => approvedIdSet.has(id));

    for (let index = 0; index < validOrderedIds.length; index++) {
      await client.query(
        `UPDATE items SET approved_order = $1 WHERE id = $2`,
        [index, validOrderedIds[index]]
      );
    }
  } catch (err) {
    console.error("[store] reorder error:", err.message);
  } finally {
    client.release();
  }
}

async function toggleBreaking(id) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT breaking FROM items WHERE id = $1`,
      [id]
    );
    if (!rows.length) return;

    await client.query(
      `UPDATE items SET breaking = $1 WHERE id = $2`,
      [!rows[0].breaking, id]
    );
  } catch (err) {
    console.error("[store] toggleBreaking error:", err.message);
  } finally {
    client.release();
  }
}

async function getAll() {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM items ORDER BY pub_date DESC`
    );
    return rows.map(rowToItem);
  } catch (err) {
    console.error("[store] getAll error:", err.message);
    return [];
  }
}

async function getApproved() {
  const now = Date.now();

  try {
    const { rows } = await pool.query(
      `SELECT * FROM items WHERE status = 'approved' ORDER BY approved_order ASC`
    );

    const stillLive = [];
    const expiredIds = [];

    for (const row of rows) {
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

    if (expiredIds.length) {
      await pool.query(
        `UPDATE items SET status = 'expired', approved_order = NULL WHERE id = ANY($1)`,
        [expiredIds]
      );
    }

    return stillLive;
  } catch (err) {
    console.error("[store] getApproved error:", err.message);
    return [];
  }
}

module.exports = { mergeIncoming, approve, reject, reorder, toggleBreaking, getAll, getApproved };