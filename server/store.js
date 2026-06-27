// store.js — simple JSON-file storage. No database needed for a personal
// project at this scale. Keeps two lists: all incoming items, and which
// ones you've approved for the public page (with your chosen order).

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "data.json");

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    return { items: {}, approvedIds: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return { items: {}, approvedIds: [] };
  }
}

function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function mergeIncoming(newItems) {
  const data = load();
  for (const item of newItems) {
    if (!data.items[item.id]) {
      data.items[item.id] = { ...item, status: "pending", fetchedAt: new Date().toISOString() };
    }
  }
  save(data);
  return data;
}

// Approved stories drop off the public page automatically after this many
// hours, unless marked "breaking" — keeps the page from slowly filling up
// with stale stories you forgot to remove. Breaking stories stay pinned
// until you remove them yourself, since marking something breaking means
// it should stick around longer.
const EXPIRY_HOURS = 48;

function approve(id) {
  const data = load();
  if (data.items[id]) {
    data.items[id].status = "approved";
    data.items[id].approvedAt = new Date().toISOString();
    if (!data.approvedIds.includes(id)) data.approvedIds.push(id);
  }
  save(data);
  return data;
}

function reject(id) {
  const data = load();
  if (data.items[id]) {
    data.items[id].status = "rejected";
    data.approvedIds = data.approvedIds.filter((x) => x !== id);
  }
  save(data);
  return data;
}

function reorder(orderedIds) {
  const data = load();
  data.approvedIds = orderedIds.filter((id) => data.items[id]?.status === "approved");
  save(data);
  return data;
}

function toggleBreaking(id) {
  const data = load();
  if (data.items[id]) {
    data.items[id].breaking = !data.items[id].breaking;
  }
  save(data);
  return data;
}

function getAll() {
  const data = load();
  return Object.values(data.items).sort(
    (a, b) => new Date(b.pubDate) - new Date(a.pubDate)
  );
}

function getApproved() {
  const data = load();
  const now = Date.now();

  const stillLive = [];
  const expiredIds = [];

  for (const id of data.approvedIds) {
    const item = data.items[id];
    if (!item) continue;

    const ageHours = item.approvedAt
      ? (now - new Date(item.approvedAt).getTime()) / (1000 * 60 * 60)
      : 0;

    if (!item.breaking && ageHours > EXPIRY_HOURS) {
      expiredIds.push(id);
    } else {
      stillLive.push(item);
    }
  }

  // persist the cleanup so expired items don't linger in storage forever
  if (expiredIds.length) {
    data.approvedIds = data.approvedIds.filter((id) => !expiredIds.includes(id));
    expiredIds.forEach((id) => {
      if (data.items[id]) data.items[id].status = "expired";
    });
    save(data);
  }

  return stillLive;
}

module.exports = { mergeIncoming, approve, reject, reorder, toggleBreaking, getAll, getApproved };
