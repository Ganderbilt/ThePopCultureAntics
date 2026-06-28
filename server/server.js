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
const crypto = require("crypto");
const { fetchAllFeeds, USE_SAMPLE_DATA } = require("./feeds");
const store = require("./store");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Admin authentication ---
// A single shared password protects the admin page and every route that
// can change data (approve/reject/reorder/breaking/refresh). The public
// page and its read-only /api/approved route stay open to everyone —
// that's meant to be public. Without this, anyone who knew or guessed
// the admin URL could edit the live site with no password at all.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error(
    "[server] WARNING: ADMIN_PASSWORD is not set. The admin page and all " +
    "editing routes are running with NO password protection. Set " +
    "ADMIN_PASSWORD in Render's Environment tab (or a local .env file) " +
    "— see README for details."
  );
}

// A random secret used to sign session tokens. Generated fresh each time
// the server starts if you don't set one yourself — fine for a
// single-person site, but it does mean everyone gets logged out whenever
// the server restarts/redeploys. Set SESSION_SECRET yourself (any long
// random string) if you'd rather stay logged in across restarts.
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

// Tracks the single currently-valid session token in memory. Logging in
// generates a brand-new random token and overwrites this; logging out
// clears it. This means logging in anywhere immediately invalidates any
// other existing session — correct behavior for a single-admin site
// (only one person should be "logged in" as the editor at a time), and
// it's what makes the logout button actually revoke access, rather than
// a fixed token that remains valid forever once issued.
let currentSessionToken = null;

function makeNewSessionToken() {
  const raw = crypto.randomBytes(24).toString("hex");
  const signed = crypto.createHmac("sha256", SESSION_SECRET).update(raw).digest("hex");
  return `${raw}.${signed}`;
}

function isValidSessionToken(token) {
  if (!token || !currentSessionToken) return false;
  return token === currentSessionToken;
}

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    // No password configured at all — fail safe by blocking access
    // rather than silently leaving the door open.
    return res.status(503).send("Admin access is not configured. Set ADMIN_PASSWORD.");
  }
  if (isValidSessionToken(req.cookies && req.cookies.admin_session)) {
    return next();
  }
  return res.redirect("/login.html");
}

function requireAdminApi(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ ok: false, error: "Admin access is not configured." });
  }
  if (isValidSessionToken(req.cookies && req.cookies.admin_session)) {
    return next();
  }
  return res.status(401).json({ ok: false, error: "Not logged in." });
}

// Minimal cookie parsing — avoids pulling in the cookie-parser package
// for the one cookie this app needs.
app.use((req, res, next) => {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    header.split(";").forEach((pair) => {
      const [key, value] = pair.trim().split("=");
      req.cookies[key] = decodeURIComponent(value || "");
    });
  }
  next();
});

app.use(express.json());

app.post("/api/login", (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ ok: false, error: "Admin access is not configured." });
  }
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    currentSessionToken = makeNewSessionToken();
    res.setHeader(
      "Set-Cookie",
      `admin_session=${currentSessionToken}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Strict`
    );
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: "Incorrect password." });
});

app.post("/api/logout", (req, res) => {
  currentSessionToken = null;
  res.setHeader("Set-Cookie", "admin_session=; HttpOnly; Path=/; Max-Age=0");
  res.json({ ok: true });
});

// Protect the admin page itself before the static file server can serve it.
app.get("/admin.html", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "admin.html"));
});

app.use(express.static(path.join(__dirname, "..", "public")));

// --- API ---

app.post("/api/refresh", requireAdminApi, async (req, res) => {
  try {
    const items = await fetchAllFeeds();
    await store.mergeIncoming(items);
    res.json({ ok: true, count: items.length, sample: USE_SAMPLE_DATA });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/items", requireAdminApi, async (req, res) => {
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

app.post("/api/approve/:id", requireAdminApi, async (req, res) => {
  try {
    await store.approve(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/reject/:id", requireAdminApi, async (req, res) => {
  try {
    await store.reject(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/reorder", requireAdminApi, async (req, res) => {
  try {
    await store.reorder(req.body.orderedIds || []);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/toggle-breaking/:id", requireAdminApi, async (req, res) => {
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
