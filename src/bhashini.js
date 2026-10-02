// Bhashini (MeitY) translation client: English -> Marathi / Hindi.
// Docs: https://bhashini.gitbook.io/bhashini-apis  (ULCA "pipeline" API)
//
// Needs two values in .env (from your Bhashini / ULCA account):
//   VITE_BHASHINI_USER_ID   your ULCA "userID"
//   VITE_BHASHINI_API_KEY   your ULCA "ulcaApiKey"
// Optional: VITE_BHASHINI_PIPELINE_ID (default is Bhashini's public MeitY pipeline).
//
// SECURITY: anything in a VITE_* variable is visible to people who open the site.
// That is fine for testing. Before a public launch, move these calls to a small
// server / Cloud Function that holds the key (see README).

const env = import.meta.env;
const USER_ID = String(env.VITE_BHASHINI_USER_ID || '').trim();
const API_KEY = String(env.VITE_BHASHINI_API_KEY || '').trim();
const PIPELINE_ID = String(env.VITE_BHASHINI_PIPELINE_ID || '64392f96daac500b55c543cd').trim();
const CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';

const placeholder = (v) => !v || /^(your|xxx|changeme)/i.test(v);
export const bhashiniConfigured = !placeholder(USER_ID) && !placeholder(API_KEY);

// During `npm run dev` the browser talks to Vite's proxy (see vite.config.js),
// which avoids CORS problems. In a production build it calls Bhashini directly.
function viaProxy(url) {
  if (!env.DEV) return url;
  const u = new URL(url);
  if (u.host === 'meity-auth.ulcacontrib.org') return '/bh-auth' + u.pathname + u.search;
  if (u.host === 'dhruva-api.bhashini.gov.in') return '/bh-infer' + u.pathname + u.search;
  return url;
}

async function post(url, headers, body, timeoutMs = 20000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(viaProxy(url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    if (!res.ok) {
      const err = new Error('Bhashini HTTP ' + res.status);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const configCache = new Map(); // target language -> { callbackUrl, headerName, headerValue, serviceId }

async function getConfig(target, force = false) {
  if (!force && configCache.has(target)) return configCache.get(target);
  const data = await post(
    CONFIG_URL,
    { userID: USER_ID, ulcaApiKey: API_KEY },
    {
      pipelineTasks: [{ taskType: 'translation', config: { language: { sourceLanguage: 'en', targetLanguage: target } } }],
      pipelineRequestConfig: { pipelineId: PIPELINE_ID },
    }
  );
  const ep = data?.pipelineInferenceAPIEndPoint;
  const serviceId = data?.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
  if (!ep?.callbackUrl || !ep?.inferenceApiKey?.value || !serviceId) throw new Error('Bhashini config response was not understood');
  const cfg = {
    callbackUrl: ep.callbackUrl,
    headerName: ep.inferenceApiKey.name || 'Authorization',
    headerValue: ep.inferenceApiKey.value,
    serviceId,
  };
  configCache.set(target, cfg);
  return cfg;
}

async function compute(cfg, target, texts) {
  const data = await post(
    cfg.callbackUrl,
    { [cfg.headerName]: cfg.headerValue },
    {
      pipelineTasks: [{ taskType: 'translation', config: { language: { sourceLanguage: 'en', targetLanguage: target }, serviceId: cfg.serviceId } }],
      inputData: { input: texts.map((source) => ({ source })) },
    }
  );
  const out = data?.pipelineResponse?.[0]?.output;
  if (!Array.isArray(out) || out.length !== texts.length) throw new Error('Bhashini returned an unexpected result');
  return out.map((o, i) => (o && typeof o.target === 'string' && o.target.trim() ? o.target : texts[i]));
}

/** Translate an array of English strings into `target` ('mr' | 'hi'). Returns an array of the same length. */
export async function translateTexts(texts, target) {
  if (!bhashiniConfigured) throw Object.assign(new Error('Bhashini keys missing in .env'), { code: 'NO_KEYS' });
  let cfg = await getConfig(target);
  try {
    return await compute(cfg, target, texts);
  } catch (e) {
    // The inference key can expire: fetch a fresh config once and retry.
    if (e.status === 401 || e.status === 403) {
      configCache.delete(target);
      cfg = await getConfig(target, true);
      return await compute(cfg, target, texts);
    }
    throw e;
  }
}
