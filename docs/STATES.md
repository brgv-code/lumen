# State diagrams

## Item lifecycle
```mermaid
stateDiagram-v2
  [*] --> inbox: saved (glow +1)
  inbox --> reading: opened and scrolled past 5%, or first highlight
  reading --> reading: progress saved while scrolling
  reading --> done: Mark as done (glow +10, finished_at)
  inbox --> done: Mark as done
  done --> reading: reopened manually
  inbox --> archived
  reading --> archived
  done --> archived
  archived --> inbox: restore
  archived --> [*]: delete
```

## Highlight delivery (per destination)
The ledger row is the only state. A highlight with no `delivered` row for a destination is pending.
```mermaid
stateDiagram-v2
  [*] --> pending: highlight created in a collection with a destination
  pending --> delivered: client wrote it and acked, or server push succeeded
  pending --> failed: write failed (error stored, attempts + 1)
  failed --> delivered: retry succeeds
  failed --> failed: retry fails (attempts + 1)
  delivered --> delivered: re-ack is a no-op (idempotent)
  delivered --> [*]: highlight deleted (cascade)
```
Moving an item to a collection with a different destination makes its highlights pending for
that destination only; they stay delivered for the old one.

## Session
```mermaid
stateDiagram-v2
  [*] --> anonymous
  anonymous --> oauth_pending: /auth/:provider/start (state + PKCE cookie, 10 min)
  oauth_pending --> anonymous: state mismatch or exchange failed
  oauth_pending --> signed_in: callback ok, session row + cookie (30 days)
  anonymous --> demo: POST /auth/demo (sandbox user + seed, 3 day session)
  signed_in --> anonymous: logout or expiry
  demo --> anonymous: logout, expiry, or nightly purge
  signed_in --> [*]: delete account (cascade)
```

## Selection bar (extension, web reader, landing demo)
One module, `packages/core/src/bar.ts`. It owns its shadow root and only reports what the reader
chose; the host page decides what highlighting, answering or copying means.
```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> settling: mouseup, shift keyup or selectionchange outside the bar
  settling --> idle: collapsed, under 2 characters, inside an input or editor, off on this site, or a newer selection arrived
  settling --> open: snapshot taken (quote, cloned range, line rects)
  state open {
    [*] --> rising
    rising --> shown: 140 ms rise, 18 ms stagger (fade only under reduced motion)
    shown --> more: More, or ArrowDown on More
    more --> shown: Escape (focus back on More)
  }
  open --> open: scroll or resize moves the bar with the snapshot rects
  open --> idle: Escape, mousedown outside, page selection collapsed (not while focus is in the bar)
  open --> idle: Highlight, a swatch, Note, Explain, Simplify, Copy, or a More item
  idle --> [*]: destroy() removes listeners, animations and the host
```
- The bar never calls `preventDefault` on copy. Buttons prevent their own mousedown so the page
  selection stays alive. Ask about this… hands the passage to the panel; the bar has no input.
- Copy puts the plain text on the clipboard; Copy with citation (in More) adds the source link.
- Once open, everything reads from the snapshot, never the live selection, so a later focus
  change or DOM repaint cannot change what an action acts on.
- Keys pressed inside the bar stop at its shadow root, so host shortcuts (YouTube `k`, GitHub `t`)
  do not fire.
- Arrow keys move between the bar's buttons (one Tab stop) and through the open More menu.

## Margin answer
What happens after Explain, Simplify or a More action that answers, on either surface.
```mermaid
stateDiagram-v2
  [*] --> streaming: request sent
  streaming --> answered: done
  streaming --> failed: quota, provider or network error
  streaming --> discarded: card closed (request aborted)
  answered --> streaming: follow up asked in the card
  answered --> kept: Keep
  answered --> discarded: card closed or page left
  failed --> discarded: card closed
  kept --> kept: later follow ups in this card are kept too
  discarded --> [*]
  kept --> [*]: stored in highlight_answers
```
- Keep attaches to the highlight that already covers the passage, otherwise it highlights the
  passage in the last used colour first. The note is never touched; it holds only the reader's words.
- Answers that are not kept live only in the open card.
- A kept answer reaches notes with its highlight when the highlight is still pending for a
  destination. Answers kept after the highlight was delivered wait for answer deliveries (LUM-2).

## AI request
```mermaid
stateDiagram-v2
  [*] --> quota_check
  quota_check --> rejected: over daily limit (429)
  quota_check --> streaming: Workers AI stream opened
  quota_check --> unavailable: model error (502)
  streaming --> done: [DONE]
  streaming --> aborted: user closed the card or asked a follow up
  rejected --> [*]
  unavailable --> [*]
  done --> [*]
  aborted --> [*]
```

## Glow and streak
```mermaid
stateDiagram-v2
  [*] --> unlit: no activity today
  unlit --> lit: any rewarded action today
  lit --> goal_met: glow today >= daily goal
  goal_met --> unlit: midnight in the reader's time zone
  lit --> unlit: midnight
  note right of unlit
    Streak counts back from today, or from yesterday
    if today has no activity yet, so the lamp
    stays on until the day is over.
  end note
```
