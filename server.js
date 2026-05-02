const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 4321;
const host = process.env.HOST || '0.0.0.0';
const root = __dirname;

const AI_PROVIDER = (process.env.AI_PROVIDER || process.env.LLM_PROVIDER || 'openrouter').toLowerCase();
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const DEFAULT_OPENROUTER_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'google/gemma-3-27b-it:free',
];

const AI_CONFIG = resolveAiConfig();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function normalizeModelList(value, fallback = []) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))].length
    ? [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))]
    : fallback;
}

function resolveAiConfig() {
  const base = {
    provider: AI_PROVIDER,
    enabled: false,
    apiKey: '',
    model: '',
    models: [],
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
      models: [model],
      endpoint: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
      label: `OpenAI · ${model}`,
      setupHint: 'Configura OPENAI_API_KEY para activar sugerencias con OpenAI.',
      headers: {},
    };
  }

  const models = normalizeModelList(
    process.env.OPENROUTER_MODELS || process.env.OPENROUTER_MODEL || process.env.AI_MODEL,
    DEFAULT_OPENROUTER_MODELS
  );
  return {
    ...base,
    provider: 'openrouter',
    enabled: Boolean(OPENROUTER_API_KEY),
    apiKey: OPENROUTER_API_KEY,
    model: models[0] || '',
    models,
    endpoint: process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions',
    label: `OpenRouter · ${models[0] || 'sin modelo'}`,
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

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
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
  const models = AI_CONFIG.models?.length ? AI_CONFIG.models : [AI_CONFIG.model].filter(Boolean);
  const attempts = [];

  for (const model of models) {
    try {
      const response = await fetch(AI_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AI_CONFIG.apiKey}`,
          ...AI_CONFIG.headers,
        },
        body: JSON.stringify({
          model,
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
        const error = new Error(`Proveedor ${AI_CONFIG.provider} no disponible`);
        error.status = response.status;
        error.raw = text.slice(0, 600);
        error.retryAfter = response.headers.get('retry-after');
        error.model = model;
        throw error;
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content || '';
      if (!text) {
        const error = new Error('La IA no devolvió contenido');
        error.status = 502;
        error.model = model;
        throw error;
      }

      try {
        return {
          parsed: JSON.parse(text),
          usedModel: model,
          attempts,
        };
      } catch {
        const error = new Error('La IA devolvió un formato no válido');
        error.status = 502;
        error.model = model;
        throw error;
      }
    } catch (error) {
      attempts.push({
        model,
        status: error?.status || 500,
        retryAfter: error?.retryAfter || null,
        message: error?.message || 'Error desconocido',
      });
    }
  }

  const lastAttempt = attempts[attempts.length - 1] || {};
  const error = new Error(lastAttempt.message || `Proveedor ${AI_CONFIG.provider} no disponible`);
  error.status = lastAttempt.status || 502;
  error.retryAfter = lastAttempt.retryAfter || null;
  error.attempts = attempts;
  throw error;
}

function normalizeSuggestion(suggestion) {
  const foods = sanitizeFoods(suggestion?.foods || []).map((food) => ({ name: food.name, grams: round(food.grams) }));
  const macros = suggestion?.macros || calculateTotals(foods.map((food) => ({ ...food, protein: 0, carbs: 0, fat: 0, kcal: 0 })));
  return {
    name: String(suggestion?.name || 'Alternativa').slice(0, 80),
    reason: String(suggestion?.reason || '').slice(0, 280),
    foods,
    macros: {
      protein: round(macros.protein || 0),
      carbs: round(macros.carbs || 0),
      fat: round(macros.fat || 0),
      kcal: round(macros.kcal || 0),
    },
  };
}

function buildFallbackSuggestions(meal, library) {
  const foods = sanitizeFoods(meal?.foods);
  const libraryMap = library || {};
  const swapMap = {
    'Pechuga de pollo': ['Pavo', 'Atún al natural', 'Tofu firme'],
    'Arroz cocido': ['Pasta cocida', 'Patata cocida', 'Boniato'],
    'Salmón': ['Atún al natural', 'Pechuga de pollo', 'Tofu firme'],
    'Avena': ['Pan integral', 'Yogur griego 0%', 'Plátano'],
    'Patata cocida': ['Boniato', 'Arroz cocido', 'Pasta cocida'],
    'Claras de huevo': ['Huevo entero', 'Yogur griego 0%', 'Queso fresco batido 0%'],
    'Aceite de oliva': ['Aguacate', 'Almendras'],
  };

  const plans = [
    { suffix: 'versión práctica', ratio: 1, offset: 0 },
    { suffix: 'para variar', ratio: 0.92, offset: 1 },
    { suffix: 'más saciante', ratio: 1.08, offset: 2 },
  ];

  return plans.map((plan) => {
    const nextFoods = foods.map((food, index) => {
      const options = swapMap[food.name] || [food.name];
      const replacementName = options[(index + plan.offset) % options.length] || food.name;
      const replacement = libraryMap[replacementName] || libraryMap[food.name] || food;
      const grams = Math.max(20, round(food.grams * (index === 0 ? plan.ratio : 1)));
      return {
        name: replacementName,
        grams,
        protein: replacement.protein ?? food.protein,
        carbs: replacement.carbs ?? food.carbs,
        fat: replacement.fat ?? food.fat,
        kcal: replacement.kcal ?? food.kcal,
      };
    });

    const macros = calculateTotals(nextFoods);
    return {
      name: `${meal?.name || 'Comida'} · ${plan.suffix}`,
      reason: 'He preparado una alternativa de respaldo manteniendo el estilo de la comida y macros parecidas.',
      foods: nextFoods.map((food) => ({ name: food.name, grams: round(food.grams) })),
      macros: {
        protein: round(macros.protein),
        carbs: round(macros.carbs),
        fat: round(macros.fat),
        kcal: round(macros.kcal),
      },
    };
  });
}

function humanizeAiError(error, meal, library) {
  const fallbackSuggestions = buildFallbackSuggestions(meal, library);
  const attempts = Array.isArray(error?.attempts) ? error.attempts : [];
  const triedModelsText = attempts.length
    ? ` Modelos probados: ${attempts.map((attempt) => attempt.model).join(', ')}.`
    : '';
  const retryAfter = attempts.find((attempt) => attempt.retryAfter)?.retryAfter || error?.retryAfter;
  const retryAfterText = retryAfter ? ` Vuelve a probar en ${retryAfter} segundos.` : '';
  const allRateLimited = attempts.length > 1 && attempts.every((attempt) => attempt.status === 429);

  if (error?.status === 429 || allRateLimited) {
    return {
      status: 200,
      error: 'Los modelos gratuitos han alcanzado su límite temporal.',
      humanMessage: `La IA gratuita está saturada ahora mismo, pero no te dejo tirado.${retryAfterText}`,
      providerMessage: `He pasado al plan B local para que sigas usando la función.${triedModelsText}`,
      fallbackUsed: true,
      fallbackSuggestions,
      attempts,
      banner: {
        tone: 'warning',
        title: 'Plan B activado',
        body: 'Los modelos gratuitos no estaban disponibles y he generado alternativas locales.',
      },
    };
  }

  if (error?.status === 401 || error?.status === 403) {
    return {
      status: 200,
      error: 'La clave del proveedor no ha sido aceptada.',
      humanMessage: 'La IA del servidor necesita revisar su configuración, pero te dejo opciones útiles igualmente.',
      providerMessage: `He usado el plan B local mientras tanto.${triedModelsText}`,
      fallbackUsed: true,
      fallbackSuggestions,
      attempts,
      banner: {
        tone: 'warning',
        title: 'Usando alternativa local',
        body: 'La clave del proveedor ha fallado, así que he preparado sugerencias de respaldo.',
      },
    };
  }

  if (error?.status >= 500) {
    return {
      status: 200,
      error: 'El proveedor de IA no ha respondido bien.',
      humanMessage: 'Ahora mismo la IA remota no ha respondido como debía, pero ya tienes alternativas para seguir.',
      providerMessage: `He usado el plan B local para no cortar el flujo.${triedModelsText}`,
      fallbackUsed: true,
      fallbackSuggestions,
      attempts,
      banner: {
        tone: 'warning',
        title: 'Respaldo local activo',
        body: 'La respuesta remota falló y he generado opciones automáticas en local.',
      },
    };
  }

  return {
    status: 200,
    error: error?.message || 'No se pudo generar la sugerencia.',
    humanMessage: 'No he podido generar alternativas con IA en este intento, pero sí una versión de respaldo.',
    providerMessage: `He activado el plan B local.${triedModelsText}`,
    fallbackUsed: true,
    fallbackSuggestions,
    attempts,
    banner: {
      tone: 'warning',
      title: 'Mostrando plan B',
      body: 'La generación con IA falló y he dejado alternativas locales para que no te quedes sin nada.',
    },
  };
}

async function suggestMealAlternatives(meal, library) {
  const { parsed, usedModel, attempts } = await requestAiJson(buildPrompt(meal, library));
  const fallbackAttemptCount = Array.isArray(attempts) ? attempts.length : 0;
  return {
    note: parsed.note || 'Sugerencias orientativas, revisa cantidades antes de usarlas.',
    banner: {
      tone: 'success',
      title: fallbackAttemptCount ? 'Alternativas generadas tras reintento' : 'Alternativas generadas con IA',
      body: fallbackAttemptCount ? `He cambiado automáticamente de modelo hasta encontrar uno disponible.` : undefined,
    },
    provider: {
      provider: AI_CONFIG.provider,
      model: usedModel,
      fallbackCount: fallbackAttemptCount,
    },
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3).map(normalizeSuggestion) : [],
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
      models: AI_CONFIG.models,
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/ai-status') {
    return sendJson(res, 200, {
      enabled: AI_CONFIG.enabled,
      provider: AI_CONFIG.enabled ? AI_CONFIG.label : null,
      providerKey: AI_CONFIG.provider,
      model: AI_CONFIG.model,
      models: AI_CONFIG.models,
      reason: AI_CONFIG.enabled
        ? 'IA lista para sugerir alternativas parecidas sin exponer la clave al navegador.'
        : AI_CONFIG.setupHint,
      setupHint: AI_CONFIG.setupHint,
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/suggest-meal-alternatives') {
    if (!AI_CONFIG.enabled) {
      return sendJson(res, 503, {
        error: 'La IA no está configurada en este despliegue.',
        humanMessage: 'La función de alternativas está apagada en este entorno.',
        fallbackUsed: false,
        fallbackSuggestions: [],
      });
    }

    let body = null;
    try {
      body = await readJsonBody(req);
      const result = await suggestMealAlternatives(body.meal, body.library);
      return sendJson(res, 200, result);
    } catch (error) {
      const payload = humanizeAiError(error, body?.meal, body?.library);
      return sendJson(res, payload.status || 500, payload);
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

