// server.js — Express app. Two routes that matter:
//   GET  /                 -> public page (only your approved headlines)
//   GET  /admin            -> your private curation queue
//   POST /api/refresh      -> pull latest from RSS feeds
//   POST /api/approve/:id, /api/reject/:id, /api/reorder

require("dotenv").config(); // loads SUPABASE_URL / SUPABASE_KEY from a local .env file
                             // when running on your own computer. On Render, environment
                             // variables are set directly in their dashboard instead, and
                             // this line has no effect there (no .env file exists, which is fine).

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
    await store.mergeIncoming(items);
    res.json({ ok: true, count: items.length, sample: USE_SAMPLE_DATA });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/items", async (req, res) => {
  try {
    res.json(await store.getAll());
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/approved", async (req, res) => {
  try {
    res.json(await store.getApproved());
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/approve/:id", async (req, res) => {
  try {
    await store.approve(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/reject/:id", async (req, res) => {
  try {
    await store.reject(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/reorder", async (req, res) => {
  try {
    await store.reorder(req.body.orderedIds || []);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/toggle-breaking/:id", async (req, res) => {
  try {
    await store.toggleBreaking(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`The Pop Culture Antics running at http://localhost:${PORT}`);
  console.log(`Admin queue at http://localhost:${PORT}/admin.html`);
  if (USE_SAMPLE_DATA) {
    console.log(`(Using sample data — set USE_SAMPLE_DATA=false on a real host to pull live feeds)`);
  }
});
