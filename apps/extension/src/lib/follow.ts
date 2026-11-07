export type Feed = { id: string; title: string };
export type FollowReply = { ok: boolean; feed?: Feed; error?: string };

/** What the popup shows after a follow or unfollow click; the follow only changes when the background says it worked. */
export function followOutcome(current: Feed | null, reply: FollowReply): { follow: Feed | null; message: string } {
  if (current) return reply.ok ? { follow: null, message: "Unfollowed" } : { follow: current, message: reply.error ?? "Could not unfollow" };
  if (reply.ok && reply.feed) return { follow: reply.feed, message: `Following ${reply.feed.title}. You'll hear when it publishes.` };
  return { follow: null, message: reply.error ?? "No feed found on this site" };
}
