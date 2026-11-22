// Hybrid inference through the Firebase AI Logic JS SDK.
// Docs: https://firebase.google.com/docs/ai-logic/hybrid/web/get-started
//       https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options
import { initializeApp } from 'firebase/app';
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  InferenceSource
} from 'firebase/ai';
import { firebaseConfig } from 'firebase-config';
import { buildPrompt, parseModelOutput, RESPONSE_SCHEMA } from './prompt.js';

export const MODES = {
  auto: InferenceMode.PREFER_ON_DEVICE,
  device: InferenceMode.ONLY_ON_DEVICE,
  cloud: InferenceMode.ONLY_IN_CLOUD
};

export function configIsFilled() {
  return Boolean(
    firebaseConfig &&
      firebaseConfig.apiKey &&
      !String(firebaseConfig.apiKey).startsWith('PASTE') &&
      firebaseConfig.appId &&
      !String(firebaseConfig.appId).startsWith('PASTE')
  );
}

let ai = null;
function getAiInstance() {
  if (!ai) {
    const app = initializeApp(firebaseConfig);
    ai = getAI(app, { backend: new GoogleAIBackend() });
  }
  return ai;
}

const models = {};
function getModel(modeKey) {
  if (!models[modeKey]) {
    models[modeKey] = getGenerativeModel(getAiInstance(), {
      mode: MODES[modeKey],
      onDeviceParams: {
        createOptions: {
          expectedInputs: [{ type: 'text', languages: ['en'] }],
          expectedOutputs: [{ type: 'text', languages: ['en'] }]
        },
        promptOptions: { responseConstraint: RESPONSE_SCHEMA }
      },
      inCloudParams: {
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA
        }
      }
    });
  }
  return models[modeKey];
}

/** What Chrome reports for the built-in model: available, downloadable, downloading, unavailable or missing. */
export async function onDeviceStatus() {
  const LM = globalThis.LanguageModel;
  if (!LM || typeof LM.availability !== 'function') return 'missing';
  try {
    return await LM.availability({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }]
    });
  } catch {
    return 'unavailable';
  }
}

/**
 * Start the Gemini Nano download if Chrome says it is downloadable.
 * Must be called from a click handler (the Prompt API needs a user gesture).
 */
export async function prepareOnDevice(modeKey, onProgress) {
  if (modeKey === 'cloud' || !globalThis.LanguageModel) return;
  try {
    await getModel(modeKey).initializeDeviceModel(onProgress);
  } catch {
    // In auto mode a failed download simply means the cloud model is used.
  }
}

/**
 * Run the AI check.
 * @returns {Promise<{issues:Array, rewrite:string, parsed:boolean, source:'on-device'|'cloud'}>}
 */
export async function runModelCheck(draft, precheckIssues, modeKey = 'auto') {
  if (modeKey === 'cloud' && !configIsFilled()) {
    throw new Error('Cloud mode needs your Firebase config. Fill firebase-config.js and rebuild.');
  }
  if (modeKey === 'auto' && !configIsFilled() && !globalThis.LanguageModel) {
    throw new Error('No on-device model in this browser and no Firebase config yet. Fill firebase-config.js and rebuild to enable the cloud fallback.');
  }
  const model = getModel(modeKey);
  const result = await model.generateContent(buildPrompt(draft, precheckIssues));
  const response = result.response;
  const source = response.inferenceSource === InferenceSource.ON_DEVICE ? 'on-device' : 'cloud';
  return { ...parseModelOutput(response.text()), source };
}
