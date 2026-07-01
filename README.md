# The Pop Culture Antics

A personal cultural-news aggregator — pulls headlines and Reddit comments
from across entertainment, sports, music, internet culture, gossip-y
politics, and Google's trending searches, and lets you (the only editor)
pick which ones go live on a public page.

## How it works

1. **Pull headlines** — the admin page has a button that fetches the
   latest items from every source below.
2. **You curate** — on the admin page, you approve or skip each one, and
   reorder the approved ones however you like.
3. **Public page** — one big "Top Story" headline up top, then a grid of
   everything else below it, styled like a tabloid front page.
   Auto-refreshes every 60 seconds so it stays current.

There's no algorithm balancing categories for you — whatever each source
returns shows up in the queue, tagged by source, and you decide what
matters, including how much weight to give things like politics on any
given day.

## Sources

- **BBC News** — general/world news. Added specifically to fill a real
  gap: previously, if something genuinely big happened in the world (an
  earthquake, an election, a corporate collapse), there was nothing in
  the queue to reflect it. BBC is a neutral, wire-style source, not
  tabloid-flavored like the rest of this list.
- **New York Post** — also real news, but a conservative tabloid, not a
  neutral wire service; worth knowing the lean going in, same as any
  single outlet. Its tone is closer to TMZ/BuzzFeed than BBC's.

- **TMZ, Deadline, E! Online** — entertainment/celebrity news (RSS)
- **ESPN** — sports (RSS), capped lower than other sources (4 items per
  refresh instead of the default 10) since ESPN publishes far more
  often and would otherwise dominate the queue with routine sports
  analysis rather than anything genuinely "trending"
- **Billboard** — music (RSS)
- **Washingtonian** — gossip-y, personality-driven political/DC culture
  coverage rather than policy reporting (RSS)
- **BuzzFeed** — internet/viral culture (RSS). This is the closest free,
  hosting-friendly substitute for genuine "internet zeitgeist" signal —
  BuzzFeed's own editorial team already aggregates viral/trending content
  from Twitter, TikTok, Instagram, and Reddit, so this captures a good
  chunk of what Reddit was meant to provide, without the hosting problem
  described below.
- **Hyperallergic (Memes)** — this is the real answer to the original
  "1985 editorial cartoonist" idea this whole project started from.
  Rather than us trying to scrape raw memes from Instagram/X ourselves
  (which would need paid APIs we don't have), Hyperallergic's writers
  already do that work by hand: they notice a real cultural moment, then
  hand-pick and publish a roundup of the best actual memes/reactions
  about it. You get to be the appreciator of an already-curated set of
  reactions, the same way someone in 1985 read Doonesbury instead of
  scanning every newspaper themselves.
- **Know Your Meme** — runs the same "weekly roundup of the best memes"
  editorial format as Hyperallergic, at higher volume/frequency. A
  second source in the same appreciator-not-curator spirit.
- **The Onion** — writes its own satire rather than rounding up other
  people's reactions, but it's the closest modern match to the Mad
  Magazine half of the original 1985 analogy: read the joke, and you
  basically know what's going on without following the news directly.
- **Cracked** — general comedy/listicles, a looser fit than the others
  here since it isn't always anchored to one specific real news event,
  but still real-world-grounded rather than invented.
- **Borowitz Report** (Andy Borowitz, now on Substack, formerly The New
  Yorker) — probably the single closest match in this whole project to
  the original 1985 analogy: each post is one sharp satirical sentence
  about that day's actual news.
- **The New Yorker (Humor)** — the magazine's own humor/satire section.

**Tried and removed:** The Chaser, The Beaverton, and The Betoota
Advocate (Australian/Canadian satire in the same real-event-satire
spirit as The Onion) were added, deployed, and checked against Render's
logs. The Chaser returned a confirmed 403 block, same category as
Reddit and Washingtonian. The Beaverton and Betoota Advocate's exact
feed URLs couldn't be confirmed through search, and the "/feed" guess
that worked for most other sites on this list turned out wrong for both
(malformed-XML and 404, respectively). They've been removed rather than
left broken; revisiting them would mean visiting each site directly and
finding their actual RSS link rather than guessing again.

### A note on satire vs. fabricated "fake news"

There's a real and important difference between satire that comments on
an actual event (The Onion, Borowitz, Hyperallergic's meme roundups) and
sites that publish entirely invented stories with no real event behind
them at all (Babylon Bee, ClickHole, Waterford Whispers, and many others
on lists like Wikipedia's "List of satirical news websites" or
Feedspot's satire roundups). The second category breaks the core premise
of this whole project — there's no real news to infer from a joke about
something that never happened — so none of those were added here, even
though they're popular and well-known. If you want to browse more
options yourself, both of those list pages are a reasonable starting
point, but worth sorting "comments on something real" from "fully
invented" before adding anything from them.

A note on how these read once linked: a headline like "Happy AlgaeBTQ+
Month From Trump's Reflecting Pool Memes" is often funny on its own,
before you even click through — similar to a Carson monologue line. The
click takes you to the source's actual article (with their embedded
memes/screenshots); this site only ever links out, it doesn't reproduce
anyone else's images.

### What didn't make it, and why

**Reddit** is fetched correctly when run on your own computer, but once
deployed to a real host (confirmed with Render), Reddit returns 403 and
blocks the request outright. This isn't a bug in this app or a User-Agent
problem — Reddit blocks traffic from data-center IP ranges, which is what
any mainstream hosting provider's servers look like to them, regardless
of headers. This is a deliberate anti-scraping measure on Reddit's side,
and there's no clean, legitimate way around it (the workarounds that
exist — VPNs, residential proxies, IP rotation — are explicitly about
disguising automated traffic as a real person, which isn't something
this app does). The Reddit-fetching code is still in `feeds.js` in case
Reddit's policy ever changes, but treat it as inactive once deployed.

**Google Trends** was tried as a free way to get general "what's
trending" signal, using an unofficial RSS feed (Google has no public API
for this). It returned a 404 once deployed, meaning that endpoint has
likely changed or been deprecated. It's been removed; revisiting this
would mean either finding a new unofficial endpoint (no guarantee of
stability) or a paid trends data provider.

**AP (Associated Press)** was considered as a general-news source
alongside BBC News, but search results were genuinely contradictory —
some sources list active AP RSS feeds, others say AP discontinued RSS
entirely. Rather than add a likely-broken source and find out from a
404 in the logs, BBC News and New York Post were added instead, both
confirmed via multiple independent sources to have real, working feeds.
Worth revisiting AP directly on their own site if you want a second
neutral wire-style source later.

Each source has a per-refresh cap on how many of its most recent items
get pulled in, so a high-volume source doesn't flood the queue and bury
everything else. The default is 10. Overrides: ESPN is capped at 4 (it
publishes far more often than anything else here); Hyperallergic, Know
Your Meme, and The Onion are raised to 20, and Cracked/Borowitz/New
Yorker Humor to 15 — these are exactly the low-volume, high-value
"appreciator" sources you want *more* of per refresh, not less.

A story that's no longer in the latest pull because something newer
bumped it out of the cap isn't deleted — it's still sitting in your
database as a pending item, just not freshly re-fetched. Use the
**source filter dropdown** above the Pending column on the admin page
to browse everything still pending from one specific source (e.g. "show
me only Hyperallergic"), rather than only seeing whatever happened to
be in the most recent refresh.

## Layout: lead story + grid

The public page leads with one large "Top Story" headline, then
everything else flows into a 3-column grid below it (2 columns on
tablet, 1 on phone). This is meant to show more stories without endless
scrolling, while still keeping a clear "this one matters most" signal —
closer to Drudge's lead-story logic than a flat list.

The lead is always whichever approved story is first in your order. Each
approved card in the admin queue has a **"Make Lead"** button that jumps
that story straight to the top — no need to click the up arrow
repeatedly. The card currently in the lead position shows a blue "LEAD"
badge so it's obvious at a glance which one it is, and that card's "Make
Lead" button is disabled since it's already there. The up/down arrows
are still there too for fine-grained reordering of everything below the
lead.

## Breaking news (red)

Headlines link in blue by default. Red is reserved for stories you
manually mark as genuinely big — click "Mark breaking" on an approved
item in the admin page. It's a manual flag, not automatic, so it stays
meaningful instead of becoming decoration. Breaking stories are also
exempt from auto-expiry (see below) — if you flagged it as a big deal,
it should stick around until you decide to remove it.

## Stories auto-expire after 48 hours

Once approved, a story stays live on the public page for 48 hours, then
quietly drops off on its own — no need to manually clean out yesterday's
news every day. Breaking-flagged stories are the exception; they stay
until you remove them yourself. You can change the 48-hour window by
editing `EXPIRY_HOURS` near the top of `server/store.js`.

## Legal / copyright footer

The public page footer includes a plain-language note that the site only
links to and excerpts headlines from third-party sources, doesn't host
or claim ownership of the linked articles, and isn't responsible for
their accuracy. It also includes a copyright line for the site's own
design and curation (not the linked content), currently set to
"Ganderbilt" with the current year filled in automatically. This isn't
legal advice — if you want a lawyer's review before this goes fully
public, that's a reasonable thing to get, but this follows the same
basic approach link-aggregator sites like Drudge have used for years.

## Admin password

The admin page (`/admin.html`) and every route that can change data —
pulling new headlines, approving, rejecting, reordering, marking
breaking — are protected by a single shared password. Without this set,
anyone who found the admin URL could edit your live site with no
password at all, which was true of every earlier version of this app
until now.

**This is required, not optional.** If `ADMIN_PASSWORD` isn't set, the
admin page and all editing routes return an error (503) instead of
silently being left open — the app fails safe rather than fails open.
The public page and its read-only feed are unaffected either way; they
were always meant to be open to everyone.

### Setup

- **On Render**: Environment tab → add `ADMIN_PASSWORD` with whatever
  password you want to use.
- **On your own computer**: add the same key to your local `.env` file
  (see `.env.example`).

Logging in at `/login.html` sets a session that lasts 30 days or until
you click "Log out" on the admin page (which immediately invalidates
that session — verified directly, not just clearing the cookie
client-side). Logging in again from anywhere immediately ends any other
existing session, since only one person should be acting as the editor
at a time.

One real limitation worth knowing: sessions are stored in the server's
memory, not in Supabase. That means every time Render redeploys (a new
code push, or the free tier waking up after sleeping), you'll be logged
out and need to log in again. For a personal site updated by one person,
this is a minor inconvenience rather than a real problem — but it's
honest to flag rather than let it surprise you.

## Storage: Supabase (replaces the old JSON file)

Earlier versions of this app stored your curated list in a plain file
(`server/data.json`) sitting next to the code. That worked fine, but it
had a real problem: Render wipes that file every time you push a code
update and the service redeploys — meaning your whole curated list had
to be rebuilt from scratch after every single change. This version fixes
that by storing everything in Supabase (a real, persistent database)
instead. Your curated list now survives deploys.

**This is now a required setup step, not optional** — even sample data
needs real Supabase credentials, because saving fetched items (sample or
live) always writes to the database. Setup takes about 10 minutes:

### One-time setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
   if you don't already have one (you mentioned already having an
   account for another project — you can either reuse that account and
   create a *new* project for this app, or reuse the same project with
   a different table name; a separate project is simpler and keeps
   things from getting tangled together).
2. **Run the schema**: open your project, go to the **SQL Editor** (left
   sidebar), paste in the entire contents of `supabase-schema.sql` (in
   this folder), and click **Run**. This creates the one table the app
   needs.
3. **Get your credentials**: in your Supabase project, go to **Settings
   → API**. You need two values:
   - **Project URL** (looks like `https://abcdefghijk.supabase.co`)
   - A key — Supabase has two naming generations for this; use whichever
     one your dashboard shows that's meant for full server-side access
     (historically called `service_role`, now sometimes called
     `secret`). **Never use the `anon`/`publishable` key for this app**
     — that one's meant for browser code and doesn't have permission to
     write data the way this app needs.
4. **Set environment variables**:
   - **On Render**: go to your service → **Environment** (left sidebar)
     → add `SUPABASE_URL` and `SUPABASE_KEY` with the values from step 3.
   - **On your own computer**: copy `.env.example` to a new file named
     `.env` (same folder), and fill in the same two values there.

That's it — once those two variables are set, both your live site and
your local testing will read/write the same persistent Supabase
database (or different ones, if you used separate Supabase projects —
your call).


You need [Node.js](https://nodejs.org) installed (the free, official
installer — just click through it like any other app).

Then, in a terminal, inside this folder:

```
npm install
node server/server.js
```

You'll see a message saying it's running. Open these in your browser:

- **Public page:** http://localhost:3000
- **Your curation queue:** http://localhost:3000/admin.html

To stop it, go back to the terminal and press `Ctrl+C`.

## Live feeds vs. sample data

By default the site uses **sample/fake headlines**, controlled by this
line near the top of `server/feeds.js`:

```js
const USE_SAMPLE_DATA = process.env.USE_SAMPLE_DATA !== "false";
```

To pull real, live headlines instead, run the server with:

```
$env:USE_SAMPLE_DATA="false"; node server/server.js
```

(That's the PowerShell syntax; on Mac/Linux it's
`USE_SAMPLE_DATA=false node server/server.js`.)

This has been confirmed working live on Render with: TMZ, Deadline, E!,
Billboard, BuzzFeed, Hyperallergic, Know Your Meme, The Onion, Cracked,
Borowitz Report, and The New Yorker (Humor) — 11 sources, verified by
checking the actual curation queue after a real deploy. Both ESPN and
Washingtonian have been inconsistent: ESPN failed once with an "Unable
to parse XML" error (a different failure than a block — possibly a
transient hiccup, worth a retry rather than assumed broken) after
working fine in every prior deploy; Washingtonian has returned a 403
twice now, even after a more browser-like User-Agent was added, and
looks like a genuine deliberate block in the same category as Reddit.
Reddit is confirmed *not* to work once deployed (see "What didn't make
it, and why" above) — this is expected and not worth re-testing.
which one failed and why — Reddit and Google Trends are known *not* to
work once deployed (see "What didn't make it, and why" above); you can
remove any other single source by deleting its entry
from the `RSS_SOURCES` list in `feeds.js` without affecting the others.

## Cost

This is built to run at $0:
- All the RSS/JSON feeds are free, public, and need no account or API key.
- Supabase's free tier (500 MB database storage, confirmed current as of
  mid-2026) is enormous overkill for what this app stores — headline
  text and links, nowhere near a database that small project sizes
  would ever fill.
- Render's free web service tier covers a personal project like this.

**One real thing to know about Supabase's free tier**: a free project
pauses itself automatically after 7 days with no database activity, and
has to be manually un-paused from the Supabase dashboard afterward —
your data isn't lost, but the site goes offline until you do that. Given
this app's "click Pull latest headlines whenever you feel like it"
workflow rather than a guaranteed daily visit, this is worth knowing
about up front rather than discovering during a week you didn't check
in. If that risk bothers you, options include: visiting the admin page
at least once a week (even just to look, since loading `/api/items` or
`/api/approved` counts as activity), setting up a free external "ping"
service (like UptimeRobot) to hit your site on a schedule, or upgrading
Supabase to its $25/month Pro tier if the site becomes something you
don't want to risk going offline.

There is no AI/Claude API cost in this version — headlines are shown
exactly as the sources wrote them.

## Adding more sources later

`server/feeds.js` has an `RSS_SOURCES` list near the top. Adding another
RSS feed is just adding another entry with its name, URL, tag, and
category — the rest of the app handles it automatically.

## Files

- `server/server.js` — the web server (routes for public page, admin
  page, and the approve/reject/reorder/breaking actions)
- `server/feeds.js` — fetches and parses all sources (RSS + Reddit)
- `server/store.js` — saves/loads your curation choices, backed by
  Supabase (a real persistent database — see "Storage: Supabase" above)
- `supabase-schema.sql` — run this once in Supabase's SQL Editor to
  create the table the app needs
- `.env.example` — template for local credentials; copy to `.env` and
  fill in your real Supabase URL/key (the real `.env` file is
  intentionally excluded from Git via `.gitignore` — never commit real
  credentials)
- `public/index.html` — the public-facing page (lead + grid layout)
- `public/admin.html` — your private curation queue
