# Demo video script: Klype Draft Check (2:45)

Record at 1920x1080 in desktop Chrome 139+. Two Chrome profiles help: one where Gemini Nano is available (on-device) and one where it is not, or use the mode picker to force each path. Use a test LinkedIn account or a draft you never post.

Demo draft to paste (keep it on screen as the running example):

> I'm excited to announce we are the #1 LinkedIn agency for founders.
> We helped 120 founders grow 10x. Revenue doubled to $2M.
> Everyone who works with us gets inbound leads.

| Time | On screen | Voiceover |
|---|---|---|
| 0:00 to 0:12 | Title card: "Klype Draft Check", subtitle "Hybrid AI with Firebase AI Logic". Cut to a LinkedIn draft full of big claims. | "This post has four claims in three lines. None of them has a source. Klype Draft Check catches that before you hit Post." |
| 0:12 to 0:30 | LinkedIn feed. Click "Start a post", paste the demo draft. The "Check draft" button appears in the composer. | "It is a Chrome extension. Open the LinkedIn composer and a Check draft button shows up. Your draft is read only when you click it." |
| 0:30 to 0:50 | Click "Check draft". The checker window opens with the draft loaded. Zoom on the "Instant rule checks" list: vague hook, #1, 120 founders, 10x, $2M, no timeframe, no baseline. | "First, instant rule checks with no model at all. They catch every number, superlative and result that has no source, plus stock openers like 'I'm excited to announce'." |
| 0:50 to 1:20 | Mode set to "Auto". Click "Check draft". Badge appears: "Ran on-device: Gemini Nano in Chrome". Scroll through the model issues. | "Then Gemini reviews it. In Auto mode, Firebase AI Logic checks whether Chrome's built-in Gemini Nano is available. Here it is, so the whole check ran on this laptop. The draft never left the device." |
| 1:20 to 1:45 | Scroll to "Suggested rewrite". Highlight "[source: add link]" and a softened line like "one of the". Click "Copy rewrite". | "The rewrite keeps the voice but never invents a source. It marks where one is needed, or softens the claim so it is true as written." |
| 1:45 to 2:10 | Switch to the second profile without Nano (or pick "Cloud only"). Popup from the toolbar, paste the same draft, click "Check draft". Badge: "Ran in the cloud: Gemini via Firebase AI Logic". | "On a machine without Gemini Nano, nothing changes for the user. The same call falls back to Gemini in the cloud through Firebase AI Logic, and the badge says so." |
| 2:10 to 2:35 | Editor showing src/model.js: getGenerativeModel with InferenceMode.PREFER_ON_DEVICE, onDeviceParams, inCloudParams, then the line reading response.inferenceSource. | "Under the hood it is one call: getGenerativeModel with prefer on-device. The same JSON schema goes to both models, and inferenceSource tells the UI which one answered. It runs on the free Spark plan." |
| 2:35 to 2:45 | README privacy section, then end card with the GitHub repo URL and "MIT licensed". | "No storage, no analytics, no server of our own. Open source under MIT. Klype Draft Check: post claims you can back up." |

Total: 2 minutes 45 seconds, under the 3-minute limit.

Recording notes:
- Pre-download Gemini Nano before recording (Firebase hybrid guide, Chrome setup step) so the on-device shot does not wait on a download.
- Do not show the Firebase config or API key on screen.
- No real client names or results in the demo draft.
