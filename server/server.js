// server.js — Express app. Two routes that matter:
//   GET  /                 -> public page (only your approved headlines)
//   GET  /admin            -> your private curation queue
//   POST /api/refresh      -> pull latest from RSS feeds
//   POST /api/approve/:id, /api/reject/:id, /api/reorder

const express = require("express");
const path = require("path");
const { fetchAllFeeds, USE_SAMPLE_DATA } = require("./feeds");
const store = require("./store");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// --- API ---

app.post("/api/refresh", async (req, res) => {
  try {
    const items = await fetchAllFeeds();
    store.mergeIncoming(items);
    res.json({ ok: true, count: items.length, sample: USE_SAMPLE_DATA });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/items", (req, res) => {
  res.json(store.getAll());
});

app.get("/api/approved", (req, res) => {
  res.json(store.getApproved());
});

app.post("/api/approve/:id", (req, res) => {
  store.approve(req.params.id);
  res.json({ ok: true });
});

app.post("/api/reject/:id", (req, res) => {
  store.reject(req.params.id);
  res.json({ ok: true });
});

app.post("/api/reorder", (req, res) => {
  store.reorder(req.body.orderedIds || []);
  res.json({ ok: true });
});

app.post("/api/toggle-breaking/:id", (req, res) => {
  store.toggleBreaking(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`The Pop Culture Antics running at http://localhost:${PORT}`);
  console.log(`Admin queue at http://localhost:${PORT}/admin.html`);
  if (USE_SAMPLE_DATA) {
    console.log(`(Using sample data — set USE_SAMPLE_DATA=false on a real host to pull live feeds)`);
  }
});
