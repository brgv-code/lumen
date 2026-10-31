// Comparison pages. Facts about other products are dated and kept conservative;
// check their sites for current pricing. Updated 2026-10-31.

export interface Compare {
  slug: string;
  name: string;
  kind: "versus" | "alternative";
  title: string;
  description: string;
  lead: string;
  pay: string;
  answer: string;
  rows: [string, string, string][]; // feature, Lumen, them
  chooseThem: string[];
  chooseLumen: string[];
  switchSteps: string[];
  faq: [string, string][];
}

export const UPDATED = "2026-10-31";

export const COMPARES: Compare[] = [
  {
    slug: "lumen-vs-readwise-reader",
    name: "Readwise Reader",
    kind: "versus",
    title: "Lumen vs Readwise Reader (2026): highlights, notes and where they go",
    description: "Lumen vs Readwise Reader compared: pricing, highlighting, Obsidian and Notion export, AI models, and which one fits research reading.",
    lead: "Lumen vs Readwise Reader:",
    pay: "pick by where your notes live.",
    answer: "Readwise Reader is a polished, paid reading app with spaced repetition of highlights and many sources (RSS, newsletters, EPUB). Lumen has a free plan, sends each highlight once to a note you choose (Obsidian, Notion, markdown, webhook), lets you pick the AI model, and plugs into agents through MCP.",
    rows: [
      ["Price", "Free plan; every Pro feature free for 7 days", "Included in Full Readwise, about $9.99 a month billed yearly (check their site)"],
      ["Highlight web pages", "Yes, toolbar on selection; copy keeps working", "Yes"],
      ["Choose the target note per project", "Yes, every collection points at one note", "Exports one document per source"],
      ["Duplicate safe re-clipping", "Yes, a delivery ledger per destination", "Sync based"],
      ["Obsidian", "Writes into your vault through Local REST API, in your own syntax", "Official export plugin"],
      ["Notion, webhooks, plain markdown", "Yes", "Notion yes; others via integrations"],
      ["AI model", "Lumen hosted, Ollama, any OpenAI compatible API, or Claude via your CLI", "Built in Ghostreader"],
      ["Agent access (MCP)", "Yes, built in", "Check their docs"],
      ["RSS, newsletters, EPUB", "Not yet", "Yes"],
      ["PDF highlighting", "In progress", "Yes"],
      ["Open source", "Yes", "No"],
    ],
    chooseThem: ["You want one app for RSS, newsletters, EPUBs and PDFs today.", "You value daily spaced repetition of old highlights as a core habit.", "You are happy to pay for a mature, all in one product."],
    chooseLumen: ["You write from your reading and want highlights in the exact note you are drafting.", "You use Obsidian and care about clean markdown in your own syntax.", "You want to choose the model, run it locally, or let Claude work with your library."],
    switchSteps: ["Export your highlights from Readwise as markdown.", "Create a collection in Lumen for each project and point it at a note.", "Install the Lumen extension and keep reading; new highlights flow to the right note."],
    faq: [
      ["Is Lumen a free Readwise alternative?", "For web reading and highlighting, yes: the free plan covers saving, highlighting, notes and Obsidian sync, and every Pro feature is free for your first 7 days. Readwise still covers more formats such as EPUB and RSS."],
      ["Can Lumen send highlights to Obsidian like Readwise does?", "Yes. Lumen appends new highlights to a note you choose through the Obsidian Local REST API plugin, and never writes the same highlight twice."],
      ["Does Lumen have spaced repetition?", "A light version: daily reads resurface older highlights next to what you are reading now."],
    ],
  },
  {
    slug: "lumen-vs-glasp",
    name: "Glasp",
    kind: "versus",
    title: "Lumen vs Glasp (2026): private research highlights or social highlighting?",
    description: "Lumen vs Glasp compared: web and PDF highlighting, export to Obsidian and Notion, privacy, AI, and agent access.",
    lead: "Lumen vs Glasp:",
    pay: "private research or social learning.",
    answer: "Glasp is a free social web highlighter: highlights are shared on a public profile by default and exported as files or copied into notes apps. Lumen is private by default, sends highlights to a chosen note automatically and only once, and adds a reader view, reading plans, analytics and MCP access for agents.",
    rows: [
      ["Price", "Free plan; Pro free for 7 days", "Free tier and paid plans (check their site)"],
      ["Default visibility", "Private", "Social profile, public by default"],
      ["Send to a chosen note automatically", "Yes, per collection", "Export or copy"],
      ["Duplicate safe", "Yes, delivery ledger", "Manual"],
      ["Reader view and reading progress", "Yes", "No"],
      ["PDF highlighting", "In progress", "Yes, in its own viewer"],
      ["AI", "Pick your model, including local", "Built in summaries"],
      ["Agent access (MCP)", "Yes", "Check their docs"],
    ],
    chooseThem: ["You enjoy discovering what other people highlight publicly.", "You need PDF highlighting today."],
    chooseLumen: ["Your reading is research for something you are writing.", "You want highlights to land in Obsidian or Notion without copy and paste.", "You want privacy by default."],
    switchSteps: ["Export your Glasp highlights as markdown.", "Save the source pages in Lumen and point a collection at your notes.", "Highlight with the Lumen extension from now on."],
    faq: [
      ["Is Lumen social like Glasp?", "No profiles or public highlights. Lumen only shows aggregate signals such as \"readers like you also saved this\", and only when at least two other readers saved it."],
      ["Can I use both?", "Yes. They are browser extensions with separate toolbars; most people keep one to avoid two popups on every selection."],
    ],
  },
  {
    slug: "lumen-vs-obsidian-web-clipper",
    name: "Obsidian Web Clipper",
    kind: "versus",
    title: "Lumen vs Obsidian Web Clipper: highlight, copy and append without duplicates",
    description: "Obsidian Web Clipper vs Lumen: copying while highlighting, appending to an existing note, duplicate highlights, PDFs, and more apps than Obsidian.",
    lead: "Lumen vs Obsidian Web Clipper:",
    pay: "keep the clipper, fix the gaps.",
    answer: "Obsidian Web Clipper is excellent for clipping whole pages into a vault with templates. Its highlighter is a mode that takes over selection, every clip follows the template's fixed destination, and clipping the same page again appends all highlights again. Lumen keeps copy working, lets you pick the target note while reading, appends only new highlights, and works with Notion and markdown too.",
    rows: [
      ["Price", "Free plan; Pro free for 7 days", "Free, open source"],
      ["Copy text while highlighting", "Yes, a toolbar instead of a mode", "Turn highlighter mode off first"],
      ["Choose the note while reading", "Yes, from the extension popup", "Fixed per template"],
      ["Append only new highlights", "Yes, ledger per destination", "Re-clipping duplicates (open request)"],
      ["Clip whole pages with templates", "Reader view in Lumen; markdown export", "Yes, its strength"],
      ["Apps other than Obsidian", "Notion, markdown, webhooks", "Obsidian"],
      ["PDFs", "In progress", "No (open request)"],
      ["Ask a model about a passage", "Yes, several providers", "Interpreter for templates"],
    ],
    chooseThem: ["You mostly clip full pages into Obsidian with rich templates.", "You never need to copy while highlighting or clip the same page twice."],
    chooseLumen: ["You highlight while researching and keep copying passages into drafts and chats.", "You come back to the same sources and must not get duplicates.", "Some of your notes live outside Obsidian."],
    switchSteps: ["Install the Obsidian Local REST API plugin and copy its key.", "In Lumen, add an Obsidian destination with the note path and point a collection at it.", "Keep the Web Clipper for full page clips; use Lumen for highlights."],
    faq: [
      ["Why can't I copy text in Obsidian Web Clipper's highlighter?", "Highlighter mode turns every selection into a highlight. Toggle it off to copy, or use a tool that shows a toolbar next to the selection instead."],
      ["How do I stop duplicate highlights when appending?", "The clipper re-sends all highlights for the page. Lumen keeps a delivery ledger, so only highlights the note has not received are appended."],
      ["Does Lumen write Obsidian's highlight syntax?", "Yes: ==passage== with an inline footnote for your note, a callout, or a plain blockquote."],
    ],
  },
  {
    slug: "lumen-vs-hypothesis",
    name: "Hypothesis",
    kind: "versus",
    title: "Lumen vs Hypothesis: personal research notes or open web annotation?",
    description: "Hypothesis vs Lumen for annotating the web: groups and public annotation versus private highlights sent to Obsidian or Notion.",
    lead: "Lumen vs Hypothesis:",
    pay: "annotate together or write alone.",
    answer: "Hypothesis is an open, standards based annotation layer for the web and PDFs, strong for classrooms and group discussion. Lumen is a personal reading tool: private highlights and notes that flow into your own notes app, plus a library, reader view, reading plans and agent access.",
    rows: [
      ["Price", "Free plan; Pro free for 7 days", "Free, open source"],
      ["Group annotation", "Not yet", "Yes, its strength"],
      ["Send to Obsidian, Notion, markdown", "Yes, automatically, once each", "Through the API or community plugins"],
      ["Library and reader view", "Yes", "No"],
      ["PDF", "In progress", "Yes"],
      ["AI and MCP", "Yes", "No"],
    ],
    chooseThem: ["You annotate with a class or a team and want discussion threads on the page."],
    chooseLumen: ["You read alone for your own writing and want notes in your own app."],
    switchSteps: ["Export annotations through the Hypothesis API.", "Save the sources in Lumen; highlight new reading with the extension."],
    faq: [["Does Lumen use the same anchoring as Hypothesis?", "The same idea: a text quote with surrounding context, as in the W3C Web Annotation model, so highlights survive page changes."]],
  },
  {
    slug: "pocket-alternative",
    name: "Pocket",
    kind: "alternative",
    title: "The best Pocket alternative after the shutdown (2026)",
    description: "Pocket shut down in July 2025. Lumen is a free Pocket alternative for saving articles to read later, with highlights, notes and export to Obsidian or Notion.",
    lead: "Pocket is gone.",
    pay: "Your reading list does not have to be.",
    answer: "Mozilla shut Pocket down on July 8, 2025 and closed exports in November 2025. Lumen is a free alternative for saving articles to read later: a clean reader view, inbox to done, highlights and notes, daily reading plans, and export to Obsidian, Notion or plain markdown so you never get locked in again.",
    rows: [
      ["Status", "Active", "Shut down July 8, 2025"],
      ["Save to read later", "Yes, link, extension or API", "Was core"],
      ["Highlights and notes", "Yes, five colours and margin notes", "Basic highlights"],
      ["Own your data", "JSON and markdown export any time; open source", "Exports closed November 2025"],
      ["Recommendations", "Readers like you, trending in your topics", "Was editorial"],
    ],
    chooseThem: [],
    chooseLumen: ["You want a read later inbox that does not disappear with a company decision: export everything any time.", "You want highlights and notes, not just a list."],
    switchSteps: ["If you kept the Pocket export, open the CSV and save the links you still care about with Save a link.", "Install the extension to save new pages in one click.", "Turn on daily reads to work through the backlog a few articles at a time."],
    faq: [
      ["When did Pocket shut down?", "Mozilla shut Pocket down on July 8, 2025. Export stayed open for a few months and closed in November 2025."],
      ["Can I import my Pocket export into Lumen?", "Bulk import is on the roadmap; today you can save links one by one or through the API."],
      ["Is Lumen free?", "Yes. The free plan covers saving, reading, highlighting and syncing; Pro features are free for the first 7 days."],
    ],
  },
  {
    slug: "omnivore-alternative",
    name: "Omnivore",
    kind: "alternative",
    title: "Omnivore alternative: an open source read later app with highlights (2026)",
    description: "Omnivore shut down in November 2024. Lumen is an open source read later and highlighting app with Obsidian and Notion export and MCP for AI agents.",
    lead: "Missing Omnivore?",
    pay: "Lumen is open source too.",
    answer: "Omnivore, the open source read later app, shut down in November 2024 after its team joined ElevenLabs. Lumen covers the same ground for web reading: save, read in a clean view, highlight with notes, and sync to Obsidian. It is open source, free for personal use, and adds reading plans and agent access through MCP.",
    rows: [
      ["Status", "Active", "Shut down November 2024"],
      ["Open source", "Yes", "Yes"],
      ["Obsidian sync", "Yes, appends only new highlights to a chosen note", "Was via plugin"],
      ["Highlights and notes", "Yes", "Yes"],
      ["Newsletters and PDFs", "Not yet; PDFs in progress", "Yes"],
      ["AI and MCP", "Yes", "Limited"],
    ],
    chooseThem: [],
    chooseLumen: ["You liked Omnivore's openness and Obsidian sync and want something maintained."],
    switchSteps: ["Save the links you still care about into Lumen.", "Add your Obsidian destination and point a collection at your reading note."],
    faq: [
      ["Why did Omnivore shut down?", "The Omnivore team joined ElevenLabs and the hosted service closed in November 2024."],
      ["Can I self host Lumen?", "Yes. It runs on Cloudflare Workers and D1; the deploy guide is in the docs."],
    ],
  },
];
