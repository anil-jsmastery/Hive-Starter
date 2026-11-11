// One function for every model provider. Model spec: "provider:model", for example
// "openai:<model id>", "openrouter:<vendor/model>" or "compat:<model id>" for any
// OpenAI-compatible API (set SWARM_BASE_URL). Keys are read from swarm/.env with a
// SWARM_ prefix, so they never sit in the shell where your coding agent runs.
import fs from 'node:fs';

export const ACTIONS = ['click', 'type', 'select', 'keyboard', 'press_enter', 'scroll', 'back', 'wait', 'done', 'give_up'];

// The reply every model must give. OpenAI and Gemini enforce it as structured output,
// and Claude through a forced tool call, so replies always parse.
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['thought', 'action', 'target', 'text'],
  properties: {
    thought: { type: 'string', description: 'Up to 15 words: what you think right now.' },
    action: { type: 'string', enum: ACTIONS },
    target: { type: 'string', description: 'Element id without brackets, such as "0:12", or "" if not needed.' },
    text: { type: 'string', description: 'Text to type or option to select, or "".' },
  },
};

const KEYS = {
  openai: 'SWARM_OPENAI_API_KEY',
  anthropic: 'SWARM_ANTHROPIC_API_KEY',
  gemini: 'SWARM_GEMINI_API_KEY',
  deepseek: 'SWARM_DEEPSEEK_API_KEY',
  moonshot: 'SWARM_MOONSHOT_API_KEY',
  openrouter: 'SWARM_OPENROUTER_API_KEY',
  compat: 'SWARM_API_KEY',
};

// Providers that speak the OpenAI chat completions format.
const OPENAI_LIKE = {
  openai: () => 'https://api.openai.com/v1',
  openrouter: () => 'https://openrouter.ai/api/v1',
  deepseek: () => 'https://api.deepseek.com',
  moonshot: () => 'https://api.moonshot.ai/v1',
  compat: () => (process.env.SWARM_BASE_URL || '').replace(/\/$/, ''),
};

export function splitSpec(spec) {
  const i = spec.indexOf(':');
  return { provider: spec.slice(0, i), model: spec.slice(i + 1) };
}

export function checkSpec(spec) {
  const { provider, model } = splitSpec(spec || '');
  if (!provider || !model) return 'Set the model as provider:model, for example SWARM_MODEL=openai:<model id>.';
  if (provider === 'mock') return null;
  if (!KEYS[provider]) return `Unknown provider "${provider}". Use openai, anthropic, gemini, deepseek, moonshot, openrouter, compat or mock.`;
  if (provider === 'compat' && !process.env.SWARM_BASE_URL) return 'Missing SWARM_BASE_URL in swarm/.env (the provider\'s OpenAI-compatible base URL).';
  if (!process.env[KEYS[provider]]) return `Missing ${KEYS[provider]} in swarm/.env.`;
  return null;
}

const PRICES = JSON.parse(fs.readFileSync(new URL('./prices.json', import.meta.url), 'utf8'));

// USD for one call, or null when the model has no price in prices.json (never guessed).
export function priceOf(spec, inTok, outTok) {
  const { provider, model } = splitSpec(spec);
  if (provider === 'mock') return 0;
  const p = PRICES[model];
  if (!p || typeof p.in !== 'number' || typeof p.out !== 'number') return null;
  return (inTok * p.in + outTok * p.out) / 1e6;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(url, headers, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// Remembers request options a model rejected, so each fallback happens once per run.
const dropped = new Set();

// Output format, strictest first: a JSON schema, then plain JSON mode, then none
// (the reply is then parsed from text). Each model starts at the top and steps down
// only if its API rejects the stricter option.
function formatFor(provider, model) {
  if (!dropped.has(`${provider}:${model}:schema`)) {
    return { type: 'json_schema', json_schema: { name: 'agent_action', strict: true, schema: SCHEMA } };
  }
  if (!dropped.has(`${provider}:${model}:object`)) return { type: 'json_object' };
  return null;
}

function openaiLikeBody(provider, model, system, user) {
  const body = {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  };
  if (provider === 'openai') body.max_completion_tokens = 2000;
  else body.max_tokens = 600;
  const format = formatFor(provider, model);
  if (format) body.response_format = format;
  const effort = process.env.SWARM_REASONING_EFFORT ?? 'low';
  if (provider === 'openai' && effort && !dropped.has(`${provider}:${model}:effort`)) body.reasoning_effort = effort;
  return body;
}

async function request(provider, model, system, user) {
  if (OPENAI_LIKE[provider]) {
    return post(`${OPENAI_LIKE[provider]()}/chat/completions`,
      { authorization: `Bearer ${process.env[KEYS[provider]]}` }, openaiLikeBody(provider, model, system, user));
  }
  if (provider === 'anthropic') {
    const body = { model, max_tokens: 400, system, messages: [{ role: 'user', content: user }] };
    // Claude replies by calling one forced tool whose input schema is the action format,
    // so every reply arrives as a parsed object. Falls back to plain text if rejected.
    if (!dropped.has(`anthropic:${model}:tool`)) {
      body.tools = [{ name: 'act', description: 'Your next action on the page.', input_schema: SCHEMA }];
      body.tool_choice = { type: 'tool', name: 'act' };
    }
    return post('https://api.anthropic.com/v1/messages',
      { 'x-api-key': process.env[KEYS.anthropic], 'anthropic-version': '2023-06-01' }, body);
  }
  if (provider === 'gemini') {
    return post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { 'x-goog-api-key': process.env[KEYS.gemini] }, {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            required: ['thought', 'action', 'target', 'text'],
            properties: {
              thought: { type: 'STRING' },
              action: { type: 'STRING', enum: ACTIONS },
              target: { type: 'STRING' },
              text: { type: 'STRING' },
            },
          },
        },
      });
  }
  throw new Error(`unknown provider ${provider}`);
}

function parse(provider, j) {
  if (provider === 'anthropic') {
    const tool = (j.content || []).find((b) => b.type === 'tool_use');
    return {
      text: tool
        ? JSON.stringify(tool.input)
        : (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(''),
      inTok: j.usage?.input_tokens || 0,
      outTok: j.usage?.output_tokens || 0,
    };
  }
  if (provider === 'gemini') {
    const u = j.usageMetadata || {};
    return {
      text: (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join(''),
      inTok: u.promptTokenCount || 0,
      outTok: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0),
    };
  }
  return {
    text: j.choices?.[0]?.message?.content || '',
    inTok: j.usage?.prompt_tokens || 0,
    outTok: j.usage?.completion_tokens || 0,
  };
}

// Free dry run: random but valid actions, so the harness can be tested without a key.
function mock(user) {
  const ids = [...user.matchAll(/^\[(\d+:\d+)\] (\S+)/gm)].map((m) => ({ id: m[1], kind: m[2] }));
  const pick = ids[Math.floor(Math.random() * ids.length)];
  let a;
  if (!pick || Math.random() < 0.06) a = { thought: 'Seen enough.', action: 'give_up', target: '', text: '' };
  else if (pick.kind.startsWith('input') || pick.kind === 'textarea') a = { thought: 'Typing.', action: 'type', target: pick.id, text: 'code review' };
  else a = { thought: 'Trying this.', action: 'click', target: pick.id, text: '' };
  const text = JSON.stringify(a);
  return { text, inTok: Math.round(user.length / 4), outTok: Math.round(text.length / 4), estimated: true, retries: 0 };
}

export async function callModel(spec, system, user) {
  const { provider, model } = splitSpec(spec);
  if (provider === 'mock') return mock(user);
  let retries = 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    let res;
    try {
      res = await request(provider, model, system, user);
    } catch {
      retries++;
      await sleep(1000 * 2 ** attempt + Math.random() * 500);
      continue; // network error or timeout
    }
    if (res.status === 429 || res.status >= 500) {
      retries++;
      const after = Number(res.headers.get('retry-after'));
      await sleep(after > 0 ? after * 1000 : 1500 * 2 ** attempt + Math.random() * 500);
      continue;
    }
    if (res.status === 400 && provider === 'anthropic' && !dropped.has(`anthropic:${model}:tool`)) {
      const msg = (await res.text()).toLowerCase();
      if (msg.includes('tool')) { dropped.add(`anthropic:${model}:tool`); continue; }
      throw new Error(`anthropic HTTP 400: ${msg.slice(0, 200)}`);
    }
    if ((res.status === 400 || res.status === 422) && OPENAI_LIKE[provider]) {
      const msg = (await res.text()).toLowerCase();
      const key = `${provider}:${model}`;
      // Some models reject reasoning_effort or a structured format: drop it and retry.
      if (msg.includes('reasoning') && !dropped.has(`${key}:effort`)) { dropped.add(`${key}:effort`); continue; }
      if (/response_format|json_schema|json_object|structured|schema/.test(msg)) {
        if (!dropped.has(`${key}:schema`)) { dropped.add(`${key}:schema`); continue; }
        if (!dropped.has(`${key}:object`)) { dropped.add(`${key}:object`); continue; }
      }
      throw new Error(`${provider} HTTP ${res.status}: ${msg.slice(0, 200)}`);
    }
    if (!res.ok) throw new Error(`${provider} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return { ...parse(provider, await res.json()), retries };
  }
  throw new Error(`${provider}: still failing after 8 tries (lower --concurrency)`);
}
