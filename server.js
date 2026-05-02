const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 4321;
const host = process.env.HOST || '0.0.0.0';
const root = __dirname;

const AI_PROVIDER = (process.env.AI_PROVIDER || process.env.LLM_PROVIDER || 'openrouter').toLowerCase();
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const AI_CONFIG = resolveAiConfig();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function resolveAiConfig() {
  const base = {
    provider: AI_PROVIDER,
    enabled: false,
    apiKey: '',
    model: '',
    endpoint: '',
    label: '',
    setupHint: '',
    headers: {},
  };

  if (AI_PROVIDER === 'openai') {
    const model = process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-4.1-mini';
    return {
      ...base,
      enabled: Boolean(OPENAI_API_KEY),
      apiKey: OPENAI_API_KEY,
      model,
      endpoint: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
      label: `OpenAI · ${model}`,
      setupHint: 'Configura OPENAI_API_KEY para activar sugerencias con OpenAI.',
      headers: {},
    };
  }

  const model = process.env.OPENROUTER_MODEL || process.env.AI_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
  return {
    ...base,
    provider: 'openrouter',
    enabled: Boolean(OPENROUTER_API_KEY),
    apiKey: OPENROUTER_API_KEY,
    model,
    endpoint: process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions',
    label: `OpenRouter · ${model}`,
    setupHint: 'Configura OPENROUTER_API_KEY para activar la IA gratuita por defecto.',
    headers: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://macro-tracker.local',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'Macros Flex',
    },
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sanitizeFoods(foods) {
  if (!Array.isArray(foods)) return [];
  return foods.slice(0, 12).map((food) => ({
    name: String(food?.name || '').slice(0, 80),
    grams: Number(food?.grams || 0),
    protein: Number(food?.protein || 0),
    carbs: Number(food?.carbs || 0),
    fat: Number(food?.fat || 0),
    kcal: Number(food?.kcal || 0),
  }));
}

function calculateTotals(foods) {
  return foods.reduce(
    (acc, food) => {
      const factor = Number(food.grams || 0) / 100;
      acc.protein += Number(food.protein || 0) * factor;
      acc.carbs += Number(food.carbs || 0) * factor;
      acc.fat += Number(food.fat || 0) * factor;
      acc.kcal += Number(food.kcal || 0) * factor;
      return acc;
    },
    { protein: 0, carbs: 0, fat: 0, kcal: 0 }
  );
}

function buildPrompt(meal, library) {
  const foods = sanitizeFoods(meal?.foods);
  if (!foods.length) {
    throw new Error('La comida no tiene alimentos válidos');
  }

  const totals = calculateTotals(foods);
  const libraryItems = Object.entries(library || {})
    .slice(0, 40)
    .map(([name, macros]) => ({ name, ...macros }));

  return `Eres un nutricionista práctico. Devuelve exactamente JSON válido, sin markdown.
Genera 3 alternativas de comida con macros y kcal parecidas a la comida original.
Prioriza alimentos comunes, fáciles de encontrar en España y combinaciones realistas.
Mantén una desviación razonable, idealmente dentro de ±15% en kcal y macros totales.
Si cambias un alimento, explica brevemente por qué encaja.
No repitas la comida exacta.

Respuesta requerida:
{
  "note": "texto breve",
  "suggestions": [
    {
      "name": "string",
      "reason": "string",
      "foods": [{"name":"string","grams":123}],
      "macros": {"protein":0,"carbs":0,"fat":0,"kcal":0}
    }
  ]
}

Comida original:
${JSON.stringify({ name: meal?.name || 'Comida', foods, totals }, null, 2)}

Biblioteca disponible de referencia:
${JSON.stringify(libraryItems, null, 2)}`;
}

async function requestAiJson(prompt) {
  const response = await fetch(AI_CONFIG.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_CONFIG.apiKey}`,
      ...AI_CONFIG.headers,
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      messages: [
        {
          role: 'system',
          content: 'Responde solo con JSON válido. No uses markdown ni texto fuera del JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.6,
      max_tokens: 900,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${AI_CONFIG.provider} error: ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('La IA no devolvió contenido');

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('La IA devolvió un formato no válido');
  }
}

async function suggestMealAlternatives(meal, library) {
  const parsed = await requestAiJson(buildPrompt(meal, library));
  return {
    note: parsed.note || 'Sugerencias orientativas, revisa cantidades antes de usarlas.',
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
  };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/health')) {
    return sendJson(res, 200, {
      ok: true,
      service: 'macros-flex',
      aiEnabled: AI_CONFIG.enabled,
      provider: AI_CONFIG.provider,
      model: AI_CONFIG.model,
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/ai-status') {
    return sendJson(res, 200, {
      enabled: AI_CONFIG.enabled,
      provider: AI_CONFIG.enabled ? AI_CONFIG.label : null,
      providerKey: AI_CONFIG.provider,
      model: AI_CONFIG.model,
      reason: AI_CONFIG.enabled
        ? 'IA lista para sugerir alternativas parecidas sin exponer la clave al navegador.'
        : AI_CONFIG.setupHint,
      setupHint: AI_CONFIG.setupHint,
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/suggest-meal-alternatives') {
    if (!AI_CONFIG.enabled) {
      return sendJson(res, 503, { error: 'La IA no está configurada en este despliegue.' });
    }

    try {
      const body = await readJsonBody(req);
      const result = await suggestMealAlternatives(body.meal, body.library);
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, 500, { error: error.message || 'No se pudo generar la sugerencia.' });
    }
  }

  const cleanUrl = url.pathname === '/' ? '/index.html' : url.pathname;
  const requestedPath = cleanUrl.replace(/\?.*$/, '');
  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(content);
  });
}).listen(port, host, () => {
  console.log(`Macros Flex en http://${host}:${port}`);
  console.log(`IA: ${AI_CONFIG.enabled ? AI_CONFIG.label : `desactivada (${AI_CONFIG.setupHint})`}`);
});
