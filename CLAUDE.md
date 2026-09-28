# You are riffing on someone else's prototype

This repo is a copy of [`comp4020-crit7-yunlin`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-yunlin) at
`97922b86` --- yunlin's crit agent's shipped prototype for `07-anu-system`.
The copy is yours; their repo is untouched and off limits.

**The brief is to take this somewhere it hasn't been.** Not to restart it, not
to polish it, and not to finish the agent's to-do list. Read how they directed
the agent, find the thing the prototype implies but doesn't do, and build
that. You have the session's half-hour, so pick something you can get live.

**Nothing here is marked.** No cutoff, no reflection, no `PROCESS.md` entry,
no crit sweep, no repo of your own on the line. That is the point --- the
interesting move is the one you wouldn't risk in your own graded repo.

**What you show at the share-back** is the live site plus
`git diff riff-start`. Push early and keep `main` green.

**The agent's own spec tests are `spec/booking.test.ts`, `spec/clock.test.ts`, `spec/live-updates.test.ts` and `spec/readme.test.ts`.** They encode the crit brief,
not yours, and they gate the deploy --- a red check means no live site to show
at the share-back. If your riff moves past that brief, change them or delete
them; keep `spec/invariants.test.ts` green, since that one is true of any good
site.

Everything below this line was written for that crit submission. The marks,
the cutoff, the private-repo phase, the weekly `start` skill and the
reflection are all done, and none of it governs what you do here. Read it for
how they worked, not for what you owe.

---

# Your harness

This file is yours, and it arrives empty on purpose. The rules you hold the
agent to are part of what gets marked, so they should be rules you decided on.

Nothing about the starter is recorded here. What the repo ships is explained
where it lives --- `fly.toml`, the `Dockerfile`, the CI workflow and
`spec/README.md` each say what they fix --- and the
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec. Read them before you plan or build;
what the agent needs to carry from any of it is your call.

## Rules for this deliverable

- **The system this app models has to be real, and grounded by looking, not
  by memory.** Before naming which ANU system this is a slice of, search for
  its actual public-facing behaviour (who it gates access to, its real
  limits, its real friction) and cite what you found. A prototype arguing
  "this is better than the real thing" only means something if the real
  thing was actually checked, not invented to be an easy target.
- **One held-back accent colour, one recurring meaning.** This deliverable's
  UI uses exactly one colour beyond ink-on-paper, and it marks exactly one
  thing wherever it appears: a slot that is happening right now, computed
  from the wall clock, not a static property of a row. Don't add a second
  meaning to it or a second accent colour.
- **No login, no scope beyond the one flow.** A prototype with no real ANU
  identities to check gets no fake login. Keep the app to the one core
  flow (book / see what's free / cancel) the brief asks to persist across a
  reload --- don't pad it with adjacent features (room search across all of
  ANU, recurring bookings, notifications) just because they'd be easy to
  add once the schema exists.
- **A claim this file, `README.md`, or `PROCESS.md` makes about the app's own
  behaviour gets checked in a real browser before it ships**, the same
  discipline as any other checkable claim: if a paragraph says a slot goes
  red right now, or that cancelling frees it for someone else, drive that
  exact flow with `agent-browser` and read the result before trusting the
  sentence.
