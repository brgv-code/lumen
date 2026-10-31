// The demo sandbox: a fresh, self contained account with sample reading, so the
// dashboard can be explored without SSO. Demo users are deleted after 3 days.
import { id, now } from "./util";
import { quoteFromText, wordCount, readingMinutes } from "@lumen/core";

interface Sample {
  slug: string;
  title: string;
  author: string;
  minutesAgo: number;
  status: "inbox" | "reading" | "done";
  progress: number;
  favorite?: boolean;
  collection: "essay" | "list" | "design";
  tags: string[];
  paragraphs: string[];
  highlights: { quote: string; color: string; note?: string }[];
}

const SAMPLES: Sample[] = [
  {
    slug: "reading-slowly-on-purpose",
    title: "Reading slowly on purpose",
    author: "Mara Ilves",
    minutesAgo: 60 * 3,
    status: "reading",
    progress: 0.42,
    favorite: true,
    collection: "essay",
    tags: ["reading", "attention"],
    paragraphs: [
      "Most of what we call reading online is really sorting. We open a page, scan for the shape of the argument, decide whether it deserves us, and leave. Sorting is useful. It is just not the same thing as reading.",
      "Reading slowly is not about speed. It is about letting a sentence finish its work before the next one starts. A good paragraph changes the reader a little, and change takes a moment longer than recognition.",
      "The trick that helped me most was embarrassingly simple: I stopped reading with a second tab open. One page, one question, one pen. When something mattered I marked it, and when I disagreed I wrote one line in the margin.",
      "A margin note is a conversation you can have with yourself a year later. The highlight tells you what the author said. The note tells you why it mattered to you, and that is the part you will actually want to find again.",
      "Slow reading compounds. The ten articles I read properly last month left more behind than the hundred I sorted, and the notes from them have already turned into two drafts.",
    ],
    highlights: [
      { quote: "Sorting is useful. It is just not the same thing as reading.", color: "sun", note: "Opening line for the essay?" },
      { quote: "A margin note is a conversation you can have with yourself a year later.", color: "iris", note: "This is the whole pitch for comments on highlights." },
      { quote: "Slow reading compounds.", color: "mint" },
    ],
  },
  {
    slug: "why-highlights-rot",
    title: "Why highlights rot, and how to stop it",
    author: "Theo Brandt",
    minutesAgo: 60 * 26,
    status: "done",
    progress: 1,
    collection: "essay",
    tags: ["notes", "workflow"],
    paragraphs: [
      "Every reading app makes highlighting easy. Almost none make the highlight useful a month later. The passage sits in a list, stripped of the page around it, and slowly stops meaning anything.",
      "Highlights rot for three reasons. They lose their context, because the surrounding paragraph is gone. They lose their destination, because they land in a separate app nobody opens. And they lose their owner's voice, because nothing records why they were chosen.",
      "The fix is boring and it works. Keep a link back to the exact passage. Send the highlight to the note you are already writing, not to a new inbox. And never save a passage without at least a word about why.",
      "Duplicates are the quiet killer. If clipping the same page twice writes every passage twice, people stop clipping. The tool has to remember what it already sent.",
    ],
    highlights: [
      { quote: "Send the highlight to the note you are already writing, not to a new inbox.", color: "sun", note: "Exactly the Web Clipper problem." },
      { quote: "The tool has to remember what it already sent.", color: "peach", note: "Delivery ledger." },
    ],
  },
  {
    slug: "small-models-sharp-tools",
    title: "Small models, sharp tools",
    author: "Ines Okafor",
    minutesAgo: 60 * 50,
    status: "done",
    progress: 1,
    collection: "essay",
    tags: ["ai", "llm"],
    paragraphs: [
      "The most useful language model in my day is not the largest one. It is the small model that explains a sentence in the margin while I read, fast enough that I never leave the page.",
      "Large models are wonderful for drafting and planning. But a reading assistant has a different job: answer a narrow question about a passage I am looking at, in two or three lines, right now.",
      "Choosing the model per task matters more than choosing the best model. Local for privacy and speed, a hosted model when the question needs depth. The interface should make that switch a dropdown, not a migration.",
    ],
    highlights: [
      { quote: "Choosing the model per task matters more than choosing the best model.", color: "iris" },
    ],
  },
  {
    slug: "designing-for-calm",
    title: "Designing for calm",
    author: "Juno Park",
    minutesAgo: 60 * 75,
    status: "inbox",
    progress: 0,
    collection: "design",
    tags: ["design"],
    paragraphs: [
      "Calm interfaces are not empty interfaces. They are interfaces where every colour means something and everything else steps back.",
      "Use lightness instead of lines. A surface a few percent lighter than the page reads as a card without a border, and the eye stops counting boxes.",
      "Then let the objects be friendly. A button that looks like a key you could press, an icon that looks like a small tile you could pick up. The page stays quiet and the objects carry the joy.",
    ],
    highlights: [
      { quote: "Use lightness instead of lines.", color: "sky", note: "Surface steps, no borders." },
    ],
  },
  {
    slug: "the-note-that-writes-itself",
    title: "The note that writes itself",
    author: "Sam Okoye",
    minutesAgo: 60 * 100,
    status: "inbox",
    progress: 0,
    collection: "list",
    tags: ["writing", "notes"],
    paragraphs: [
      "Every essay I have finished started as a pile of highlights that kept pointing in the same direction. The writing was mostly noticing the direction.",
      "When your reading lives in one place, a pattern shows up: three articles from different weeks underline the same idea in different words. That overlap is a draft asking to be written.",
      "Tools can help with the noticing. Not by writing for you, but by laying your own highlights next to each other and asking: what are you circling?",
    ],
    highlights: [
      { quote: "That overlap is a draft asking to be written.", color: "mint", note: "Spark feature." },
    ],
  },
  {
    slug: "attention-is-a-garden",
    title: "Attention is a garden",
    author: "Lea Varga",
    minutesAgo: 60 * 140,
    status: "done",
    progress: 1,
    collection: "list",
    tags: ["attention"],
    paragraphs: [
      "You do not manage attention, you tend it. Some days it grows wild; some days nothing comes up. The point is to keep showing up with water.",
      "A streak is a gentle way of showing up. Not a whip, a lamp left on in the window: proof that yesterday you read something properly, and an invitation to do it again today.",
    ],
    highlights: [
      { quote: "a lamp left on in the window", color: "sun", note: "Lumen's streak metaphor." },
    ],
  },
];

function html(s: Sample) {
  return s.paragraphs.map((p) => `<p>${p}</p>`).join("\n");
}

/** isDemo: 1 = sandbox (purged after 3 days), 3 = persistent test account. */
export async function seedDemo(db: D1Database, opts: { isDemo?: number; name?: string } = {}): Promise<string> {
  const t = now();
  const userId = id("usr_");
  const stmts: D1PreparedStatement[] = [];
  const names = ["Wren", "Juniper", "Ollie", "Sage", "Robin", "Indigo"];
  const name = names[Math.floor(Math.random() * names.length)];

  stmts.push(db.prepare("INSERT INTO users (id, email, name, avatar_url, is_demo, daily_goal, created_at) VALUES (?,?,?,?,?,20,?)")
    .bind(userId, null, opts.name ?? `${name} (demo)`, null, opts.isDemo ?? 1, t));

  const obsidian = id("dst_");
  const markdown = id("dst_");
  stmts.push(db.prepare("INSERT INTO destinations (id, user_id, kind, name, config, created_at) VALUES (?,?,?,?,?,?)")
    .bind(obsidian, userId, "obsidian", "Research vault", JSON.stringify({ baseUrl: "https://127.0.0.1:27124", notePath: "Research/joyful-reading.md", format: "house" }), t));
  stmts.push(db.prepare("INSERT INTO destinations (id, user_id, kind, name, config, created_at) VALUES (?,?,?,?,?,?)")
    .bind(markdown, userId, "markdown", "Markdown export", JSON.stringify({ fileName: "lumen-highlights.md", format: "plain" }), t));

  const cols = {
    essay: { id: id("col_"), name: "Essay: reading should feel joyful", emoji: "✍️", color: "iris", description: "Sources for the piece I am writing.", dest: obsidian },
    list: { id: id("col_"), name: "Reading list", emoji: "📚", color: "sun", description: "Everything worth a second look.", dest: null },
    design: { id: id("col_"), name: "Design references", emoji: "🎨", color: "peach", description: "Calm, joyful interfaces.", dest: markdown },
  };
  for (const c of Object.values(cols)) {
    stmts.push(db.prepare("INSERT INTO collections (id, user_id, name, emoji, color, description, destination_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(c.id, userId, c.name, c.emoji, c.color, c.description, c.dest, t, t));
  }

  const tagIds = new Map<string, string>();
  for (const s of SAMPLES) for (const tag of s.tags) if (!tagIds.has(tag)) tagIds.set(tag, id("tag_"));
  for (const [tag, tid] of tagIds) stmts.push(db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?,?,?)").bind(tid, userId, tag));

  const itemIds: string[] = [];
  for (const s of SAMPLES) {
    const itemId = id("itm_");
    itemIds.push(itemId);
    const created = t - s.minutesAgo * 60_000;
    const text = s.paragraphs.join("\n");
    const words = wordCount(text);
    stmts.push(db.prepare(`INSERT INTO items (id, user_id, url, title, site_name, author, excerpt, content_html, content_text, kind, status, progress, favorite, word_count, reading_minutes, collection_id, created_at, updated_at, finished_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(itemId, userId, `https://example.org/lumen-demo/${s.slug}`, s.title, "Lumen sample library", s.author, s.paragraphs[0].slice(0, 180),
        html(s), text, "article", s.status, s.progress, s.favorite ? 1 : 0, words, readingMinutes(words), cols[s.collection].id, created, created,
        s.status === "done" ? created + 3600_000 : null));
    if (s.status === "reading") stmts.push(db.prepare("UPDATE items SET last_opened_at = ? WHERE id = ?").bind(t - 60 * 3600_000, itemId));
    for (const tag of s.tags) stmts.push(db.prepare("INSERT INTO item_tags (item_id, tag_id) VALUES (?,?)").bind(itemId, tagIds.get(tag)!));
    s.highlights.forEach((h, k) => {
      const start = text.indexOf(h.quote);
      if (start < 0) return;
      const sel = quoteFromText(text, start, start + h.quote.length);
      const hid = id("hl_");
      const at = created + (k + 1) * 120_000;
      stmts.push(db.prepare("INSERT INTO highlights (id, user_id, item_id, quote, prefix, suffix, position, color, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(hid, userId, itemId, sel.quote, sel.prefix, sel.suffix, sel.position, h.color, h.note ?? null, at, at));
      // the first essay highlight was already sent to the vault: shows the ledger at work
      if (s.slug === "why-highlights-rot") {
        stmts.push(db.prepare("INSERT INTO deliveries (highlight_id, destination_id, delivered_at) VALUES (?,?,?)").bind(hid, obsidian, at + 1000));
      }
    });
  }

  // 12 days of activity with one gap, so the streak, the week chart and levels have life.
  const kinds: [string, number][] = [["save", 1], ["highlight", 2], ["note", 3], ["finish", 10]];
  for (let d = 12; d >= 0; d--) {
    if (d === 7) continue;
    const day = new Date(t - d * 864e5).toISOString().slice(0, 10);
    const n = d === 0 ? 3 : 2 + ((d * 7) % 5);
    for (let k = 0; k < n; k++) {
      const [kind, glow] = kinds[(d + k) % kinds.length];
      const hour = [7, 8, 12, 13, 21, 22, 9, 20][(d * 3 + k) % 8];
      const at = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), hour, (k * 17) % 60);
      stmts.push(db.prepare("INSERT INTO activity (id, user_id, day, kind, item_id, glow, created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(id("act_"), userId, day, kind, null, glow, Math.min(at, t)));
    }
  }

  const ideas = [
    {
      title: "Reading should feel like a lamp, not a treadmill",
      angle: "Streaks and highlights work when they reward attention, not volume.",
      outline: ["Sorting versus reading", "Why highlights rot", "A lamp in the window: streaks without guilt", "What a joyful reading tool looks like"],
      src: [itemIds[0], itemIds[1], itemIds[5]],
    },
    {
      title: "Pick the model per question",
      angle: "A reading assistant should switch between local and hosted models like switching pens.",
      outline: ["The margin question", "Local for speed, hosted for depth", "Make it a dropdown"],
      src: [itemIds[2]],
    },
  ];
  for (const i of ideas) {
    stmts.push(db.prepare("INSERT INTO ideas (id, user_id, title, angle, outline, source_item_ids, status, created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(id("idea_"), userId, i.title, i.angle, JSON.stringify(i.outline), JSON.stringify(i.src), "new", t - 3600_000));
  }

  // two real blogs to follow, fetched the first time Following is opened
  for (const [site, feed, title] of [["https://simonwillison.net", "https://simonwillison.net/atom/everything/", "Simon Willison's Weblog"], ["https://blog.cloudflare.com", "https://blog.cloudflare.com/rss/", "The Cloudflare Blog"]]) {
    stmts.push(db.prepare("INSERT INTO feeds (id, user_id, site_url, feed_url, title, created_at) VALUES (?,?,?,?,?,?)").bind(id("feed_"), userId, site, feed, title, t));
  }
  for (const topic of ["llm", "obsidian", "design systems"]) {
    stmts.push(db.prepare("INSERT INTO topics (id, user_id, name, source, created_at) VALUES (?,?,?,?,?)").bind(id("top_"), userId, topic, "manual", t));
  }

  await db.batch(stmts);
  await ensureCommunity(db);
  return userId;
}

/** Sample readers for the demo only (is_demo = 2). Never shown to real accounts. */
const PICKS: [string, string, string][] = [
  ["the-margin-is-the-message", "The margin is the message", "Why the notes beside a text outlast the text you underlined."],
  ["a-field-guide-to-slow-tools", "A field guide to slow tools", "Software that rewards attention instead of volume, and how to spot it."],
  ["evals-before-features", "Evals before features", "A small team's habit of writing the test for an AI feature before building it."],
  ["one-note-per-project", "One note per project", "The simplest knowledge system that survived three years of real use."],
  ["reading-with-a-question", "Reading with a question", "How a single question turns skimming into reading."],
  ["quiet-interfaces", "Quiet interfaces, loud content", "Lightness steps, glossy objects, and colour that means something."],
];

export async function ensureCommunity(db: D1Database) {
  const has = await db.prepare("SELECT count(*) AS n FROM users WHERE is_demo = 2").first<{ n: number }>();
  if ((has?.n ?? 0) > 0) return;
  const t = now();
  const stmts: D1PreparedStatement[] = [];
  const shelves = [
    ["reading-slowly-on-purpose", "why-highlights-rot", 0, 1, 3],
    ["reading-slowly-on-purpose", "attention-is-a-garden", 0, 1, 4],
    ["why-highlights-rot", "the-note-that-writes-itself", 1, 3, 5],
    ["small-models-sharp-tools", "designing-for-calm", 2, 5, 4],
    ["designing-for-calm", "reading-slowly-on-purpose", 5, 0, 3],
  ] as const;
  shelves.forEach((sh, k) => {
    const uid = id("usr_");
    stmts.push(db.prepare("INSERT INTO users (id, email, name, is_demo, created_at) VALUES (?,?,?,2,?)").bind(uid, null, `Sample reader ${k + 1}`, t));
    for (const slug of [sh[0], sh[1]]) {
      stmts.push(db.prepare("INSERT INTO items (id, user_id, url, title, kind, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)")
        .bind(id("itm_"), uid, `https://example.org/lumen-demo/${slug}`, slug.replace(/-/g, " "), "article", "done", t, t));
    }
    for (const p of [PICKS[sh[2]], PICKS[sh[3]], PICKS[sh[4]]]) {
      stmts.push(db.prepare("INSERT OR IGNORE INTO items (id, user_id, url, title, site_name, excerpt, kind, status, reading_minutes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(id("itm_"), uid, `https://example.org/lumen-demo/community/${p[0]}`, p[1], "Lumen sample library", p[2], "article", "inbox", 5, t, t));
    }
  });
  await db.batch(stmts);
}

export async function purgeDemos(db: D1Database) {
  const cutoff = now() - 3 * 864e5;
  await db.prepare("DELETE FROM users WHERE is_demo = 1 AND created_at < ?").bind(cutoff).run();
  await db.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now()).run();
  await db.prepare("DELETE FROM demo_creations WHERE created_at < ?").bind(now() - 864e5).run();
}
