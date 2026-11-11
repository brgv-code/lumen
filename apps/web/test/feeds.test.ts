import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { discover } from "../src/worker/lib/feeds.ts";

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>A Blog</title><entry><title>Post</title><link href="https://blog.test/p/1"/></entry></feed>`;
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** Serves only the given pages; everything else is a 404, like a site with no feed at the usual paths. */
function serve(pages: Record<string, string>) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    const page = pages[url];
    const type = page?.startsWith("<?xml") ? "application/atom+xml" : "text/html";
    return new Response(page ?? "", { status: page === undefined ? 404 : 200, headers: { "content-type": type } });
  }) as typeof fetch;
}

test("an article page without a feed link finds the feed its home page links to", async () => {
  serve({
    "https://blog.test/2024/03/a-post": "<html><head><title>A post</title></head></html>",
    "https://blog.test/": `<html><head><link rel="alternate" type="application/atom+xml" href="/writing.atom"></head></html>`,
    "https://blog.test/writing.atom": ATOM,
  });
  const feed = await discover("https://blog.test/2024/03/a-post");
  assert.equal(feed.feedUrl, "https://blog.test/writing.atom");
});

test("an article deep in a section finds the feed of a parent section", async () => {
  serve({
    "https://blog.test/blog/2024/03/a-post": "<html></html>",
    "https://blog.test/blog/feed.xml": ATOM,
  });
  const feed = await discover("https://blog.test/blog/2024/03/a-post");
  assert.equal(feed.feedUrl, "https://blog.test/blog/feed.xml");
});

test("an author on a shared host gets their own feed, not the host's", async () => {
  serve({
    "https://blog.test/dhh/a-post": "<html></html>",
    "https://blog.test/": `<html><head><link rel="alternate" type="application/atom+xml" href="/everyone.atom"></head></html>`,
    "https://blog.test/everyone.atom": ATOM,
    "https://blog.test/dhh/feed.atom": ATOM,
  });
  const feed = await discover("https://blog.test/dhh/a-post");
  assert.equal(feed.feedUrl, "https://blog.test/dhh/feed.atom");
});

test("a feed served as feed.atom at the root is found", async () => {
  serve({ "https://blog.test/articles/a-post.html": "<html></html>", "https://blog.test/feed.atom": ATOM });
  const feed = await discover("https://blog.test/articles/a-post.html");
  assert.equal(feed.feedUrl, "https://blog.test/feed.atom");
});

test("a site with no feed anywhere still says so", async () => {
  serve({ "https://blog.test/a-post": "<html></html>", "https://blog.test/": "<html></html>" });
  await assert.rejects(discover("https://blog.test/a-post"), /No RSS or Atom feed/);
});
