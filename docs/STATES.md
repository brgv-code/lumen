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

## Extension selection toolbar
```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> toolbar: mouseup / shift keyup with a non empty selection outside inputs
  toolbar --> idle: click elsewhere, scroll, Escape, selection collapsed
  toolbar --> saving: colour swatch or Note
  saving --> idle: painted, toast "Highlighted"
  saving --> note_editor: Note was chosen
  note_editor --> idle: Save (Cmd+Enter) or close
  toolbar --> answering: Explain / Define / Ask
  answering --> answering: chunks stream into the card
  answering --> idle: close
  toolbar --> idle: Copy (citation on clipboard)
  idle --> mark_card: click on an existing mark
  mark_card --> idle: recolour, note, copy, delete, close
```
The toolbar never calls `preventDefault` on copy, and pressing a toolbar button prevents only its
own mousedown so the page selection stays alive.

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
