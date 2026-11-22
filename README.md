# Klype Draft Check

A Chrome extension (Manifest V3) that checks a LinkedIn post draft before you publish it. It flags claims with no source (numbers, superlatives, named results), vague hooks and missing context, then suggests a rewrite that either points to where a source is needed or softens the claim.

It uses hybrid AI: the check runs on your device with Chrome's built-in Gemini Nano when it is available, and falls back to Gemini in the cloud through Firebase AI Logic when it is not. The result always shows which one ran.

Built for the Firebase #BuildHybridAI hackathon.

## What it does

- **In the LinkedIn composer:** a "Check draft" button appears on the post editor. Clicking it opens the checker window with your draft loaded.
- **In the toolbar popup:** paste any draft and click "Check draft".
- **Instant rule checks (no model):** detects percentages, money, multipliers (3x), magnitudes (40k, $2M), counts like "47 founders", superlatives and absolutes ("best", "#1", "the only", "always"), results with no timeframe or baseline, stock openers ("I'm excited to announce", "In today's fast-paced world") and very long first lines. A sentence that shows a source ("according to", a link, "per HubSpot", "in our CRM data") is not flagged.
- **Model review:** Gemini reads the draft plus the rule findings and returns up to six issues (quote, problem, fix) and a full rewrite. The rewrite never invents a source; it inserts `[source: add link]` or softens the wording. Em and en dashes are stripped from all model output.
- **Mode badge:** "Ran on-device: Gemini Nano in Chrome" or "Ran in the cloud: Gemini via Firebase AI Logic".
- **Mode picker:** Auto (on-device first, cloud fallback), On-device only, or Cloud only, so you can see both paths.

## How hybrid inference works here

The extension uses the Firebase JS SDK (`firebase` 13.x, `firebase/ai`) and its documented hybrid inference for web:

```js
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, InferenceSource } from 'firebase/ai';

const ai = getAI(app, { backend: new GoogleAIBackend() });   // Gemini Developer API
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,                      // Auto mode
  onDeviceParams: { createOptions: {...}, promptOptions: { responseConstraint: SCHEMA } },
  inCloudParams: { generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA } }
});

await model.initializeDeviceModel(onProgress);               // on the click, starts the Nano download if needed
const result = await model.generateContent(prompt);
result.response.inferenceSource;                              // 'on_device' or 'in_cloud'
```

- `PREFER_ON_DEVICE`: the SDK asks Chrome's Prompt API (`LanguageModel.availability()`). If Gemini Nano is available, the prompt runs locally. If it is missing, still downloading or the request is not supported on-device, the SDK sends it to the cloud model instead.
- `ONLY_ON_DEVICE` and `ONLY_IN_CLOUD` back the two forced modes in the picker.
- Both paths get a JSON schema (Prompt API `responseConstraint` on-device, `responseSchema` in the cloud), so the UI parses one shape either way.
- `initializeDeviceModel()` is called inside the button click because the Prompt API needs a user gesture before it can download the model. While the download runs, Auto mode keeps working through the cloud.
- The cloud model is the SDK default fallback model (no override), per the Firebase docs.

Code: `src/model.js` (hybrid calls), `src/rules.js` (rule checks), `src/prompt.js` (prompt and parsing), `src/checker.js` (UI), `src/content.js` (LinkedIn button), `src/background.js` (opens the checker window).

Docs used: [Get started with hybrid on web](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started), [Configuration options](https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options), [Pricing](https://firebase.google.com/docs/ai-logic/pricing).

## Requirements

- Desktop Chrome 139 or later.
- For on-device: hardware and storage that Chrome's Gemini Nano supports. To test on-device in Chrome, Firebase's guide says to enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and restart.
- For the cloud fallback: a Firebase project with Firebase AI Logic and the Gemini Developer API. The no-cost Spark plan is enough (see Pricing above).

## Setup

1. **Create a Firebase project** at https://console.firebase.google.com. You do not need to add billing.
2. **Enable Firebase AI Logic:** in the console open the AI Logic page, click Get started and choose the **Gemini Developer API**. This keeps the project on the Spark plan.
3. **Register a web app:** Project settings > General > Your apps > Add app > Web. Copy the `firebaseConfig` object.
4. **Paste the config:**
   ```bash
   cp firebase-config.example.js firebase-config.js
   # paste your values into firebase-config.js (this file is git-ignored)
   ```
5. **Build:**
   ```bash
   npm install
   npm test
   npm run build
   ```
   Without `firebase-config.js` the build still works and on-device checks still run; only the cloud fallback is off.
6. **Load unpacked:** open `chrome://extensions`, turn on Developer mode, click Load unpacked and pick the `dist/` folder.
7. Open LinkedIn, start a post, click **Check draft**. Or click the toolbar icon and paste a draft.

Recommended before any public release: restrict the Firebase API key to the Firebase AI Logic API in Google Cloud console and set up Firebase App Check.

## Screenshots

- `docs/screenshots/composer-button.png`: the Check draft button in the LinkedIn composer (placeholder)
- `docs/screenshots/on-device-result.png`: a result with the on-device badge (placeholder)
- `docs/screenshots/cloud-result.png`: the same draft with the cloud badge (placeholder)

## Privacy

- No user data is stored. The extension uses no `chrome.storage`, no cookies, no analytics and no server of its own.
- The draft text is read from the composer only when you click Check draft. The service worker holds it in memory just long enough to hand it to the checker window, then deletes it.
- The draft is sent to one place only: the model. With on-device inference it never leaves your computer. With cloud inference it goes to the Gemini Developer API through Firebase AI Logic, under Google's terms for that API.
- The extension asks for no extra permissions. Its content script runs only on `https://www.linkedin.com/*`.

## Tests

`npm test` runs the unit tests for the rule-based pre-checks (number, superlative, source, hook and context detection) and for prompt parsing, using Node's built-in test runner.

## Licence

MIT. See [LICENSE](LICENSE).
