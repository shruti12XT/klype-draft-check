# Devpost submission: Klype Draft Check

**Project name:** Klype Draft Check

**Tagline:** Check a LinkedIn draft for unsourced claims before you post, on-device with Gemini Nano or in the cloud through Firebase AI Logic.

**Repository:** https://github.com/shruti12XT/klype-draft-check

**Demo video:** (paste YouTube or Vimeo link)

---

## Inspiration

I work with B2B founders on LinkedIn. The same problem shows up in almost every draft I review: a big number with nowhere to check it ("we grew 300%"), a superlative nobody can back up ("the best agency in India"), or a result with no timeframe or baseline. Readers notice, and it costs the author trust. Most writing tools make a draft sound more confident. I wanted one that makes it more checkable.

Drafts are also private until they are posted. That made on-device inference a natural fit: if the browser can run the model, the unpublished post never has to leave the laptop.

## What it does

Klype Draft Check is a Chrome extension. It adds a "Check draft" button to the LinkedIn post composer, and it has a toolbar popup where any draft can be pasted.

1. Instant rule checks run first, with no model: they find percentages, money, multipliers, magnitudes, counted claims ("47 founders"), superlatives and absolutes, results with no timeframe or baseline, stock openers and overlong first lines. Sentences that show a source are left alone.
2. Gemini then reviews the draft together with those findings and returns up to six issues (the exact quote, the problem, the fix) and a full rewrite.
3. The rewrite never invents a source. It either inserts `[source: add link]` where one is needed or softens the claim ("one of the", "in our data").
4. A badge shows where the model ran: on-device (Gemini Nano in Chrome) or in the cloud (Gemini via Firebase AI Logic). A mode picker lets you force either path.

Nothing is stored. The draft goes only to the model.

## How we built it

- Chrome extension, Manifest V3, plain JavaScript bundled with esbuild.
- Firebase JS SDK 13.x with Firebase AI Logic and the Gemini Developer API backend (`getAI` with `GoogleAIBackend`).
- Hybrid inference with `getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE, onDeviceParams, inCloudParams })`. In Auto mode the SDK checks Chrome's Prompt API and runs Gemini Nano locally when it is available, otherwise it falls back to the cloud model. `ONLY_ON_DEVICE` and `ONLY_IN_CLOUD` back the forced modes.
- `response.inferenceSource` drives the on-device or cloud badge.
- The same JSON schema is passed as the Prompt API `responseConstraint` on-device and as `responseSchema` in the cloud, so one parser handles both.
- `initializeDeviceModel()` runs inside the click handler, because the Prompt API needs a user gesture to download Gemini Nano. While it downloads, Auto mode keeps working through the cloud.
- The LinkedIn button is a content script. It hands the draft to the service worker, which keeps it in memory only until the checker window takes it.
- The rule engine is pure functions with Node unit tests.
- Runs on the Firebase Spark (no-cost) plan.

## Challenges we ran into

- Where to run the model. LinkedIn is a third-party page, so instead of calling the model from inside it, the content script passes the draft to an extension page, where both the Firebase SDK and Chrome's Prompt API run under the extension's own origin and policy.
- Getting the same structured output from two very different models. A small on-device model and a cloud model behave differently, so the prompt carries the rule findings as hints, both sides get a JSON schema, and the parser tolerates code fences and stray text.
- Number detection without false alarms. "5 lessons", "2024", "10:30 am" and numbered lists are not claims; "47 founders", "3x" and "$2M" are. The test suite pins these cases down.
- Keeping the rewrite honest. The model is told never to invent a source and to use a visible placeholder instead, and all output is cleaned of em and en dashes.

## Accomplishments that we're proud of

- One code path for both models, with the inference source shown on every result.
- The check works offline on capable machines: rule checks always, and Gemini Nano once Chrome has downloaded it.
- No storage, no analytics, no server of our own, and no extra extension permissions.
- A rule engine with unit tests that runs before any model call and still gives useful output when no model is available.

## What we learned

- Firebase AI Logic's hybrid mode removes most of the plumbing: availability checks, fallback and the on-device session are handled by the SDK, and `inferenceSource` tells you which side answered.
- The Prompt API download needs a user gesture, so model preparation belongs in the click handler, not on page load.
- For credibility checks, a fast deterministic pass plus a model pass works better than either alone: the rules catch every number, the model explains why it matters and rewrites.

## What's next for Klype Draft Check

- Insert the rewrite back into the LinkedIn composer with one click.
- Let the author attach a source link per flagged claim and keep it inline.
- Streaming results with `generateContentStream`.
- Support for other composers (X, Substack, Reddit).
- Publish to the Chrome Web Store after adding App Check.

## Built with

Firebase AI Logic, Firebase JS SDK, Gemini Developer API, Gemini Nano, Chrome Prompt API, Chrome Extensions (Manifest V3), JavaScript, esbuild, Node.js test runner
