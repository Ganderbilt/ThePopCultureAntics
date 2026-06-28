// feeds.js — fetches and normalizes content from multiple sources across
// categories: entertainment, sports, music, and internet/general (Reddit).
//
// NOTE: These sources block requests from data-center / sandboxed networks
// (returns 403 Forbidden). They work fine from a normal home connection or
// a standard hosting provider (Vercel, Render, your own machine, etc).
// This is why sample data exists as a fallback below — see USE_SAMPLE_DATA.

const Parser = require("rss-parser");
const parser = new Parser({
  headers: {
    // A more realistic browser-style User-Agent (plus Accept header) is
    // more likely to get through sites that block bare/generic bot
    // strings — this is the first thing worth trying for a source
    // returning 403 before assuming it's a hard data-center IP block.
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
  },
  timeout: 10000,
});

// A descriptive, specific User-Agent matters most for Reddit — their rate
// limiting is keyed on User-Agent string, and generic/default ones (or
// no header at all) get blocked much more aggressively. This format
// (app-name/version) follows Reddit's own recommendation. NOTE: as of
// the last deploy, Reddit still returns 403 from Render's servers even
// with this header — Reddit appears to block data-center IP ranges
// outright (separate from User-Agent), which isn't something a header
// change can fix. Kept here in case that changes; see README for the
// fuller explanation of why Reddit may never work reliably once hosted.
const REDDIT_USER_AGENT = "PopCultureAntics/1.0 (personal cultural-news aggregator)";

// RSS sources, grouped by category. Most sources use the default cap
// (MAX_ITEMS_PER_SOURCE, defined below); a source can set its own
// `cap` to override that — useful for high-volume publishers like ESPN
// that would otherwise dominate the queue just by publishing more often.
const RSS_SOURCES = [
  { name: "TMZ", url: "https://www.tmz.com/rss.xml", tag: "tmz", category: "entertainment" },
  { name: "Deadline", url: "https://deadline.com/feed/", tag: "deadline", category: "entertainment" },
  {
    name: "E! Online",
    url: "https://www.eonline.com/syndication/feeds/rssfeeds/topstories.xml",
    tag: "eonline",
    category: "entertainment",
  },
  {
    name: "ESPN",
    url: "https://www.espn.com/espn/rss/news",
    tag: "espn",
    category: "sports",
    cap: 4, // ESPN publishes far more often than other sources; without
            // a lower cap it crowds out everything else in the queue
  },
  { name: "Billboard", url: "https://www.billboard.com/feed/", tag: "billboard", category: "music" },
  {
    name: "Washingtonian",
    url: "https://www.washingtonian.com/feed/",
    tag: "washingtonian",
    category: "politics",
  },
  // BuzzFeed's main feed is the closest free, hosting-friendly substitute
  // for the "internet zeitgeist" signal Reddit was meant to provide —
  // it already aggregates viral/trending content across Twitter, TikTok,
  // Instagram, and Reddit itself into one editorial feed.
  {
    name: "BuzzFeed",
    url: "https://www.buzzfeed.com/index.xml",
    tag: "buzzfeed",
    category: "internet",
  },
  // This is the closest thing to the original "1985 editorial cartoonist"
  // analogy: Hyperallergic's staff writers find a real cultural moment,
  // then go hand-pick the best memes/reactions about it from Instagram,
  // X, etc., and publish the roundup as one article. You get to be the
  // appreciator of an already-curated set of reactions, rather than
  // having to go find the memes yourself — exactly what raw Reddit/X
  // access couldn't give us once those sources were no longer fetchable.
  {
    name: "Hyperallergic (Memes)",
    url: "https://hyperallergic.com/tag/memes/feed",
    tag: "hyperallergic",
    category: "memes",
  },
  // Know Your Meme runs the same kind of editorial roundup format as
  // Hyperallergic ("A Roundup of This Week's Best Memes"), at higher
  // volume and frequency — a second source of the same appreciator-not-
  // curator format.
  {
    name: "Know Your Meme",
    url: "https://knowyourmeme.com/newsfeed.rss",
    tag: "knowyourmeme",
    category: "memes",
  },
  // The Onion writes the jokes itself rather than rounding up other
  // people's reactions, but it's the closest modern equivalent to the
  // original "1985 Mad Magazine" half of the analogy this project
  // started from — satire as a way of finding out what's going on.
  {
    name: "The Onion",
    url: "https://theonion.com/feed",
    tag: "theonion",
    category: "satire",
  },
  // Cracked leans more toward general comedy/listicles than satire tied
  // to one specific real news event — a slightly looser fit than the
  // others here, but still real-world-grounded humor rather than
  // invented scenarios.
  {
    name: "Cracked",
    url: "https://feeds.feedburner.com/CrackedRSS",
    tag: "cracked",
    category: "satire",
  },
  // Andy Borowitz's satire column — left The New Yorker for Substack.
  // Closest match in this whole list to the original 1985 analogy: each
  // post is one sharp, satirical sentence about that day's actual news.
  {
    name: "Borowitz Report",
    url: "https://www.borowitzreport.com/feed",
    tag: "borowitz",
    category: "satire",
  },
  {
    name: "The New Yorker (Humor)",
    url: "https://www.newyorker.com/feed/humor",
    tag: "newyorkerhumor",
    category: "satire",
  },
  // The Chaser (Australia), The Beaverton (Canada), and The Betoota
  // Advocate (Australia) were tried and removed after a live deploy:
  // Chaser returned a confirmed 403 block (same as Reddit/Washingtonian),
  // and Beaverton/Betoota's feed URLs couldn't be confirmed via search —
  // both guesses (following the standard "/feed" pattern other sites use)
  // turned out wrong (malformed-XML and 404 respectively). Worth
  // revisiting only by visiting their sites directly to find the real
  // feed URL, rather than guessing again.
];

// Reddit sources, fetched via their public JSON endpoint rather than RSS.
// r/popular surfaces whatever's broadly trending right now (this is what
// naturally lets sports/music/politics/internet-culture in without us
// having to enforce a quota — "let the day's volume decide").
const REDDIT_SOURCES = [
  { name: "Reddit", subreddit: "popular", tag: "reddit", category: "internet" },
];

// Sample data lets you build/preview the site even when live feeds are
// unreachable (e.g. in a sandboxed dev environment). Once deployed
// somewhere with normal internet access, set USE_SAMPLE_DATA=false
// (or just delete this fallback) and it'll pull real, live headlines.
const USE_SAMPLE_DATA = process.env.USE_SAMPLE_DATA !== "false";

const SAMPLE_ITEMS = [
  {
    source: "TMZ", tag: "tmz", category: "entertainment",
    title: "Pop Star Spotted Leaving Late-Night Diner With Mystery Date",
    link: "https://www.tmz.com/sample-1",
    pubDate: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    source: "Deadline", tag: "deadline", category: "entertainment",
    title: "Studio Greenlights Sequel Nobody Asked For, Stock Jumps Anyway",
    link: "https://deadline.com/sample-2",
    pubDate: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
  },
  {
    source: "E! Online", tag: "eonline", category: "entertainment",
    title: "Reality Star's Cryptic Post Sparks Breakup Rumors (Again)",
    link: "https://www.eonline.com/sample-3",
    pubDate: new Date(Date.now() - 1000 * 60 * 70).toISOString(),
  },
  {
    source: "TMZ", tag: "tmz", category: "entertainment",
    title: "Award Show Walkout Caught On Camera, Internet Has Thoughts",
    link: "https://www.tmz.com/sample-4",
    pubDate: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
  },
  {
    source: "Deadline", tag: "deadline", category: "entertainment",
    title: "Director Confirms Long-Rumored Project Is Finally Happening",
    link: "https://deadline.com/sample-5",
    pubDate: new Date(Date.now() - 1000 * 60 * 130).toISOString(),
  },
  {
    source: "E! Online", tag: "eonline", category: "entertainment",
    title: "Two A-Listers Seen Together, Fans Already Naming The Couple",
    link: "https://www.eonline.com/sample-6",
    pubDate: new Date(Date.now() - 1000 * 60 * 160).toISOString(),
  },
  {
    source: "ESPN", tag: "espn", category: "sports",
    title: "Underdog Team Pulls Off Stunning Upset In Final Seconds",
    link: "https://www.espn.com/sample-7",
    pubDate: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    source: "ESPN", tag: "espn", category: "sports",
    title: "Star Player's Postgame Comments Spark League-Wide Debate",
    link: "https://www.espn.com/sample-8",
    pubDate: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
  },
  {
    source: "Billboard", tag: "billboard", category: "music",
    title: "Surprise Album Drop Catches Everyone Off Guard At Midnight",
    link: "https://www.billboard.com/sample-9",
    pubDate: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
  },
  {
    source: "Billboard", tag: "billboard", category: "music",
    title: "Chart-Topping Single Breaks Decade-Old Streaming Record",
    link: "https://www.billboard.com/sample-10",
    pubDate: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
  },
  {
    source: "Washingtonian", tag: "washingtonian", category: "politics",
    title: "Senator's Reflecting Pool Mishap Becomes Instant Hill Folklore",
    link: "https://www.washingtonian.com/sample-14",
    pubDate: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
  },
  {
    source: "Reddit (comment)", tag: "reddit", category: "internet", isComment: true,
    title: "Honestly this is the most unhinged thing I've read all week and I'm here for it",
    link: "https://www.reddit.com/r/sample-comment-1",
    pubDate: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    source: "Reddit", tag: "reddit", category: "internet",
    title: "This random act of kindness from a stranger made my whole week",
    link: "https://www.reddit.com/r/sample-11",
    pubDate: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    source: "Reddit", tag: "reddit", category: "internet",
    title: "A new meme format is taking over every comment section today",
    link: "https://www.reddit.com/r/sample-12",
    pubDate: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
  },
  {
    source: "Reddit", tag: "reddit", category: "internet",
    title: "Megathread: today's big political announcement, reactions inside",
    link: "https://www.reddit.com/r/sample-13",
    pubDate: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
  },
  {
    source: "BuzzFeed", tag: "buzzfeed", category: "internet",
    title: "This Tweet About The Weird Thing Everyone's Doing Now Has 40K Retweets",
    link: "https://www.buzzfeed.com/sample-15",
    pubDate: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    source: "Hyperallergic (Memes)", tag: "hyperallergic", category: "memes",
    title: "The Best Memes About This Week's Big Cultural Moment, Ranked",
    link: "https://hyperallergic.com/sample-16",
    pubDate: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    source: "Know Your Meme", tag: "knowyourmeme", category: "memes",
    title: "A Roundup Of This Week's 24 Best Memes",
    link: "https://knowyourmeme.com/sample-17",
    pubDate: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  {
    source: "The Onion", tag: "theonion", category: "satire",
    title: "Area Man Cannot Believe This Is Still Happening",
    link: "https://theonion.com/sample-18",
    pubDate: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
  },
  {
    source: "Cracked", tag: "cracked", category: "satire",
    title: "5 Things About This Week's Big Story Nobody's Talking About",
    link: "https://cracked.com/sample-19",
    pubDate: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
  },
  {
    source: "Borowitz Report", tag: "borowitz", category: "satire",
    title: "Officials Confirm This Week's Disaster Was, In Fact, Avoidable",
    link: "https://www.borowitzreport.com/sample-20",
    pubDate: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    source: "The New Yorker (Humor)", tag: "newyorkerhumor", category: "satire",
    title: "A Brief History Of This Week's Cultural Moment, As Told By Someone Exhausted By It",
    link: "https://www.newyorker.com/sample-21",
    pubDate: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
  },
];

function makeId(item) {
  // Stable id so the same story isn't re-added every refresh.
  // Uses a simple hash of the link (or title as fallback) rather than a
  // truncated base64 string, since truncating base64 caused collisions
  // between different URLs that happened to share a prefix.
  const str = item.link || item.title;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

async function fetchRssSource(source) {
  const items = [];
  const feed = await parser.parseURL(source.url);
  for (const entry of feed.items) {
    // entry.pubDate from rss-parser is often the raw RFC 822-style string
    // straight from the feed (e.g. "Sat, 27 Jun 2026 17:43:00 +0000"), not
    // guaranteed ISO 8601 — Postgres's timestamptz column can reject a
    // malformed date string, and depending on how that surfaces through
    // a batch upsert, it can be easy to miss in logs. Normalize to a
    // real ISO string here, with a safe fallback if parsing fails.
    const rawDate = entry.pubDate || entry.isoDate;
    const parsedDate = rawDate ? new Date(rawDate) : null;
    const pubDate = parsedDate && !isNaN(parsedDate.getTime())
      ? parsedDate.toISOString()
      : new Date().toISOString();

    const item = {
      source: source.name,
      tag: source.tag,
      category: source.category,
      title: entry.title,
      link: entry.link,
      pubDate,
    };
    items.push({ ...item, id: makeId(item) });
  }
  return items;
}

// Cap how many items any single source contributes per refresh, so a
// high-volume source (ESPN publishes far more often than TMZ or
// Billboard) doesn't bury everything else in the curation queue. This
// only affects what comes through in a given pull — a story that's
// still relevant will simply reappear in objects on the next refresh.
const MAX_ITEMS_PER_SOURCE = 10;

function mostRecent(items, max) {
  return [...items]
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, max);
}

// Comments capture reaction/sentiment, not just the headline — fetching
// every post's comments would multiply requests fast, so this only pulls
// the top comment from a handful of the hottest posts each refresh.
const REDDIT_COMMENT_SOURCE_POSTS = 5; // how many top posts to pull a comment from

async function fetchRedditTopComments(source, posts) {
  const items = [];
  const topPosts = [...posts]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, REDDIT_COMMENT_SOURCE_POSTS);

  for (const post of topPosts) {
    try {
      const url = `https://www.reddit.com${post.permalink}.json?limit=1&sort=top`;
      const res = await fetch(url, { headers: { "User-Agent": REDDIT_USER_AGENT } });
      if (!res.ok) continue;
      const data = await res.json();
      // data[0] is the post itself, data[1] is the comment listing
      const topComment = data?.[1]?.data?.children?.[0]?.data;
      if (!topComment || !topComment.body) continue;

      const item = {
        source: "Reddit (comment)",
        tag: "reddit",
        category: source.category,
        subreddit: post.subreddit,
        isComment: true,
        // truncate long comments for a headline-style display
        title: topComment.body.length > 140
          ? topComment.body.slice(0, 140).trim() + "…"
          : topComment.body,
        link: `https://www.reddit.com${post.permalink}`,
        pubDate: new Date(topComment.created_utc * 1000).toISOString(),
      };
      items.push({ ...item, id: makeId(item) });
    } catch {
      // one comment fetch failing shouldn't break the others
      continue;
    }
  }
  return items;
}

async function fetchRedditPosts(source) {
  const url = `https://www.reddit.com/r/${source.subreddit}.json?limit=25`;
  const res = await fetch(url, {
    headers: { "User-Agent": REDDIT_USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Reddit returned ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.data.children.map((child) => child.data);
}

function postsToItems(source, posts) {
  return posts.map((post) => {
    const item = {
      source: source.name,
      tag: source.tag,
      category: source.category,
      // include the originating subreddit so it's visible in the curation
      // queue (e.g. "r/nba") even though everything is tagged "reddit"
      subreddit: post.subreddit,
      title: post.title,
      link: `https://www.reddit.com${post.permalink}`,
      pubDate: new Date(post.created_utc * 1000).toISOString(),
    };
    return { ...item, id: makeId(item) };
  });
}

async function fetchAllFeeds() {
  if (USE_SAMPLE_DATA) {
    return SAMPLE_ITEMS.map((item) => ({ ...item, id: makeId(item) }));
  }

  const results = [];

  for (const source of RSS_SOURCES) {
    try {
      const items = await fetchRssSource(source);
      results.push(...mostRecent(items, source.cap || MAX_ITEMS_PER_SOURCE));
    } catch (err) {
      console.error(`[feeds] Failed to fetch ${source.name}: ${err.message}`);
      // one feed failing shouldn't take down the others
    }
  }

  for (const source of REDDIT_SOURCES) {
    try {
      const posts = await fetchRedditPosts(source);
      const postItems = postsToItems(source, posts);
      results.push(...mostRecent(postItems, MAX_ITEMS_PER_SOURCE));

      const commentItems = await fetchRedditTopComments(source, posts);
      results.push(...commentItems);
    } catch (err) {
      console.error(`[feeds] Failed to fetch ${source.name}: ${err.message}`);
    }
  }

  return results;
}

module.exports = { fetchAllFeeds, RSS_SOURCES, REDDIT_SOURCES, USE_SAMPLE_DATA };
