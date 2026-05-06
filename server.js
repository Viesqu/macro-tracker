const http = require('http');
const fs   = require('fs');
const path = require('path');

const port = process.env.PORT || 4321;
const host = process.env.HOST || '0.0.0.0';
const root = __dirname;

const AI_PROVIDER         = (process.env.AI_PROVIDER || process.env.LLM_PROVIDER || 'openrouter').toLowerCase();
const OPENROUTER_API_KEY  = process.env.OPENROUTER_API_KEY || '';
const OPENAI_API_KEY      = process.env.OPENAI_API_KEY     || '';
const DEFAULT_OPENROUTER_MODELS = [
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'qwen/qwen-2.5-72b-instruct:free',
];

// Tolerancias de validación: la IA debe quedar dentro de estos márgenes
const MAX_AI_KCAL_DEVIATION  = 0.20;  // 20% de desviación en kcal
const MAX_AI_MACRO_DEVIATION = 0.28;  // 28% de desviación por macro

const AI_CONFIG = resolveAiConfig();

const mimeTypes = {
  '.html':        'text/html; charset=utf-8',
  '.js':          'application/javascript; charset=utf-8',
  '.css':         'text/css; charset=utf-8',
  '.json':        'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function normalizeModelList(value, fallback = []) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  const clean  = [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
  return clean.length ? clean : fallback;
}

function resolveAiConfig() {
  const base = { provider: AI_PROVIDER, enabled: false, apiKey: '', model: '', models: [], endpoint: '', label: '', setupHint: '', headers: {} };

  if (AI_PROVIDER === 'openai') {
    const model = process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-4.1-mini';
    return {
      ...base,
      enabled:   Boolean(OPENAI_API_KEY),
      apiKey:    OPENAI_API_KEY,
      model,
      models:    [model],
      endpoint:  process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
      label:     `OpenAI · ${model}`,
      setupHint: 'Configura OPENAI_API_KEY para activar sugerencias con OpenAI.',
    };
  }

  const models = normalizeModelList(
    process.env.OPENROUTER_MODELS || process.env.OPENROUTER_MODEL || process.env.AI_MODEL,
    DEFAULT_OPENROUTER_MODELS
  );
  return {
    ...base,
    provider:  'openrouter',
    enabled:   Boolean(OPENROUTER_API_KEY),
    apiKey:    OPENROUTER_API_KEY,
    model:     models[0] || '',
    models,
    endpoint:  process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions',
    label:     `OpenRouter · ${models[0] || 'sin modelo'}`,
    setupHint: 'Configura OPENROUTER_API_KEY para activar la IA gratuita por defecto.',
    headers: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://macro-tracker.local',
      'X-Title':      process.env.OPENROUTER_APP_NAME || 'Macros Flex',
    },
  };
}

// ─── UTILIDADES HTTP ───────────────────────────────────────────────────────────

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) { reject(new Error('Payload too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// ─── UTILIDADES DE DATOS ───────────────────────────────────────────────────────

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
}

function normalizeFoodName(name) {
  const value = String(name || '').trim();
  const legacyMap = {
    'Arroz cocido':          'Arroz',
    'Patata cocida':         'Patata',
    'Pasta cocida':          'Pasta seca',
    'Garbanzos cocidos':     'Garbanzos secos',
    'Lentejas cocidas':      'Lentejas secas',
    'Alubias cocidas':       'Alubias secas',
    'Atún al natural':       'Atún al natural (lata)',
    'Atún en lata':          'Atún al natural (lata)',
    'Bacalao fresco':        'Bacalao',
    'Pechuga de pavo cruda': 'Pechuga de pavo',
    'Muslo de pollo':        'Contramuslo de pollo',
    'Lomo de cerdo':         'Cerdo magro (lomo)',
    'Cerdo magro':           'Cerdo magro (lomo)',
    'Solomillo':             'Solomillo de ternera',
    'Yogur griego':          'Yogur griego 0%',
    'Skyr natural':          'Skyr (yogur islandés, alto proteína)',
    'Skyr':                  'Skyr (yogur islandés, alto proteína)',
    'Proteína whey':         'Proteína whey (concentrada)',
    'Whey aislada':          'Proteína whey (aislada)',
    'Whey isolada':          'Proteína whey (aislada)',
    'Queso fresco batido':   'Queso fresco batido 0%',
    'Whey':                  'Proteína whey',
    'Proteína':              'Proteína whey',
    'Aceite':                'Aceite de oliva',
    'Chía':                  'Semillas de chía',
    'Lino':                  'Semillas de lino',
    'Crema cacahuete':       'Crema de cacahuete',
  };
  return legacyMap[value] || value;
}

function sanitizeFoods(foods) {
  if (!Array.isArray(foods)) return [];
  return foods.slice(0, 12).map((food) => ({
    name:    normalizeFoodName(String(food?.name || '').slice(0, 80)),
    grams:   Math.max(0, Number(food?.grams   || 0)),
    protein: Number(food?.protein || 0),
    carbs:   Number(food?.carbs   || 0),
    fat:     Number(food?.fat     || 0),
    kcal:    Number(food?.kcal    || 0),
  })).filter((food) => food.name && food.grams > 0);
}

function isReadyToEatFood(name) {
  return /(yogur|skyr|queso|requesón|cottage|leche|pan|tortilla de trigo|tortilla de maíz|aceite|whey|caseín|proteína whey|tortitas de arroz|chocolate|crema de cacahuete|frutos secos|almendra|nuez|anacardo|cacahuete|pistach)/i.test(name || '');
}

function explainRawRule(name) {
  return isReadyToEatFood(name) ? 'producto tal cual' : 'peso en crudo';
}

function calculateTotals(foods) {
  return foods.reduce(
    (acc, food) => {
      const factor  = Number(food.grams || 0) / 100;
      acc.protein  += Number(food.protein || 0) * factor;
      acc.carbs    += Number(food.carbs   || 0) * factor;
      acc.fat      += Number(food.fat     || 0) * factor;
      acc.kcal     += Number(food.kcal    || 0) * factor;
      return acc;
    },
    { protein: 0, carbs: 0, fat: 0, kcal: 0 }
  );
}

// ─── CLASIFICACIÓN DE ALIMENTOS ────────────────────────────────────────────────
// Usa ratios calóricos para clasificar correctamente alimentos mixtos (salmón, etc.)

function getFoodProfile(food) {
  const protein = Number(food?.protein || 0);
  const carbs   = Number(food?.carbs   || 0);
  const fat     = Number(food?.fat     || 0);
  const name    = String(food?.name    || '').toLowerCase();

  const pKcal = protein * 4;
  const cKcal = carbs   * 4;
  const fKcal = fat     * 9;
  const total = Math.max(pKcal + cKcal + fKcal, 1);
  const pR = pKcal / total;
  const cR = cKcal / total;
  const fR = fKcal / total;

  // Subtipos funcionales
  const isProteinPowder = /whey|caseín/i.test(name);
  const isDairy         = /yogur|skyr|queso|requesón|cottage|leche/i.test(name);
  const isEgg           = /huevo/i.test(name);
  const isFruit         = /plátano|manzana|pera|naranja|mandarina|kiwi|fresas|frutos rojos|piña|mango|melocotón|uvas|sandía|melón/i.test(name);
  const isLegume        = /garbanzo|lenteja|alubia|edamame/i.test(name);
  const isVegetable     = /brócoli|espinaca|pepino|tomate|lechuga|zanahoria|pimiento|cebolla|coliflor|berenjena|calabacín|acelga|col/i.test(name);

  // Clasificación por ratio calórico. Orden de prioridad:
  // 1) Huevo/lácteo → siempre proteina (el ratio calórico puede ser engañoso)
  // 2) Carne/pescado con >=15g proteína y <=5g HC → siempre proteina (salmón, atún, etc.)
  // 3) Alimento principalmente graso por ratio calórico
  // 4) Proteína significativa por calorías
  // 5) Hidrato dominante
  let group = 'mixto';
  if (isDairy || isEgg) {
    group = 'proteina';
  } else if (protein >= 15 && carbs <= 5) {
    group = 'proteina';
  } else if (fR >= 0.50 || (fat >= 15 && fat > protein && fat > carbs)) {
    group = 'grasa';
  } else if (pR >= 0.30 && fat <= 25) {
    group = 'proteina';
  } else if (cR >= 0.55 && fR <= 0.25) {
    group = 'carbohidrato';
  }

  return { protein, carbs, fat, group, isProteinPowder, isDairy, isEgg, isFruit, isLegume, isVegetable };
}

// ─── SCORING Y SELECCIÓN DE SUSTITUCIONES ─────────────────────────────────────

function scoreReplacement(baseFood, candidateFood) {
  const base      = getFoodProfile(baseFood);
  const candidate = getFoodProfile(candidateFood);
  let score = 0;

  if (base.group === candidate.group) score += 5;

  // Penalizar diferencias en macros por 100g
  score -= Math.abs(base.protein - candidate.protein) * 0.15;
  score -= Math.abs(base.carbs   - candidate.carbs)   * 0.10;
  score -= Math.abs(base.fat     - candidate.fat)     * 0.18;
  score -= Math.abs(base.kcal    - candidate.kcal)    * 0.025;

  // Bonificar subtipos coincidentes
  if (base.isDairy         === candidate.isDairy)         score += 2;
  if (base.isEgg           === candidate.isEgg)           score += 2;
  if (base.isLegume        === candidate.isLegume)        score += 2;
  if (base.isFruit         === candidate.isFruit)         score += 2;
  if (base.isProteinPowder === candidate.isProteinPowder) score += 2;
  if (base.isVegetable     === candidate.isVegetable)     score += 1.5;

  return score;
}

function chooseReplacement(baseFood, libraryEntries, usedNames = new Set(), offset = 0) {
  const baseProfile = getFoodProfile(baseFood);

  const scored = libraryEntries
    .map(([name, macros]) => ({ name, ...macros, score: scoreReplacement(baseFood, { name, ...macros }) }))
    .filter((candidate) => {
      const profile = getFoodProfile(candidate);

      // Proteínas en polvo: solo whey/caseína o lácteos ricos en proteína
      if (baseProfile.isProteinPowder) {
        return profile.isProteinPowder || (profile.isDairy && Number(candidate.protein || 0) >= 8);
      }
      // Lácteos: solo lácteos
      if (baseProfile.isDairy)      return profile.isDairy;
      // Huevo: huevo o lácteo alto en proteína
      if (baseProfile.isEgg)        return profile.isEgg || (profile.isDairy && Number(candidate.protein || 0) >= 8);
      // Legumbres: solo legumbres
      if (baseProfile.isLegume)     return profile.isLegume;
      // Fruta: solo fruta
      if (baseProfile.isFruit)      return profile.isFruit;
      // Verduras: solo verduras
      if (baseProfile.isVegetable)  return profile.isVegetable;
      // Grasas: TODOS los del grupo grasa (aceite, aguacate, frutos secos, semillas)
      if (baseProfile.group === 'grasa')          return profile.group === 'grasa';
      // Proteína: grupo proteína (sin mezclar con lácteos/huevos para evitar absurdos)
      if (baseProfile.group === 'proteina')       return profile.group === 'proteina' && !profile.isDairy && !profile.isEgg;
      // Hidratos: grupo carbohidrato
      if (baseProfile.group === 'carbohidrato')   return profile.group === 'carbohidrato';
      return profile.group === baseProfile.group;
    })
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return { name: baseFood.name, ...baseFood };
  const uniqueChoices = scored.filter((c) => !usedNames.has(c.name) || c.name === baseFood.name);
  const pool          = uniqueChoices.length ? uniqueChoices : scored;
  return pool[Math.min(offset, Math.max(pool.length - 1, 0))];
}

// ─── ESCALADO DE GRAMOS ────────────────────────────────────────────────────────

function scaleReplacementGrams(baseFood, replacement, variant = 'balanced') {
  const baseTotals  = calculateTotals([baseFood]);
  const repPer100   = {
    protein: Number(replacement.protein || 0),
    carbs:   Number(replacement.carbs   || 0),
    fat:     Number(replacement.fat     || 0),
    kcal:    Math.max(Number(replacement.kcal || 0), 1),
  };

  let targetKcal = baseTotals.kcal;
  if (variant === 'protein')  targetKcal *= 0.97;
  if (variant === 'comfort')  targetKcal *= 1.05;

  const ratioByKcal    = (targetKcal       / repPer100.kcal)    * 100;
  const ratioByProtein = repPer100.protein > 0 ? (baseTotals.protein / repPer100.protein) * 100 : ratioByKcal;
  const ratioByCarbs   = repPer100.carbs   > 0 ? (baseTotals.carbs   / repPer100.carbs)   * 100 : ratioByKcal;
  const ratioByFat     = repPer100.fat     > 0 ? (baseTotals.fat     / repPer100.fat)     * 100 : ratioByKcal;

  const profile = getFoodProfile(baseFood);
  let grams = ratioByKcal;
  if (profile.group === 'proteina')      grams = ratioByProtein * 0.65 + ratioByKcal * 0.35;
  if (profile.group === 'carbohidrato')  grams = ratioByCarbs   * 0.70 + ratioByKcal * 0.30;
  if (profile.group === 'grasa')         grams = ratioByFat     * 0.70 + ratioByKcal * 0.30;

  if (variant === 'protein' && profile.group === 'proteina')      grams *= 1.06;
  if (variant === 'comfort' && profile.group === 'carbohidrato')  grams *= 1.08;

  const minGrams = /aceite/i.test(String(replacement.name || '')) ? 5 : 20;
  return Math.max(minGrams, Math.min(500, round(grams)));
}

// ─── CONSTRUCCIÓN DE VARIANTES ─────────────────────────────────────────────────

function buildSuggestionFromVariant(meal, foods, libraryEntries, variant) {
  const originalTotals = calculateTotals(foods);
  const usedNames      = new Set();
  let swaps = 0;

  const nextFoods = foods.map((food, index) => {
    const profile    = getFoodProfile(food);
    const shouldSwap = variant.groups.includes(profile.group)
      || (variant.includeFruit  && profile.isFruit)
      || (variant.includeDairy  && profile.isDairy)
      || (variant.includeLegume && profile.isLegume);

    const replacement = shouldSwap && swaps < (variant.maxSwaps || 1)
      ? chooseReplacement(food, libraryEntries, usedNames, (variant.offset + index) % 5 + 1)
      : { name: food.name, protein: food.protein, carbs: food.carbs, fat: food.fat, kcal: food.kcal };

    if (replacement.name !== food.name) swaps++;
    usedNames.add(replacement.name);

    const grams = replacement.name === food.name
      ? Math.max(
          /aceite/i.test(food.name) ? 5 : 20,
          Math.min(500, round(Number(food.grams || 0) * (variant.gramFactor || 1)))
        )
      : scaleReplacementGrams(food, replacement, variant.mode);

    return {
      name:     normalizeFoodName(replacement.name),
      grams,
      protein:  replacement.protein ?? food.protein,
      carbs:    replacement.carbs   ?? food.carbs,
      fat:      replacement.fat     ?? food.fat,
      kcal:     replacement.kcal    ?? food.kcal,
      _orig:    food.name,
    };
  });

  const macros       = calculateTotals(nextFoods);
  const swappedCount = nextFoods.filter((f) => f.name !== f._orig).length;
  const mainSwap     = nextFoods.find((f) => f.name !== f._orig);

  const delta = Math.abs(macros.protein - originalTotals.protein)
              + Math.abs(macros.carbs   - originalTotals.carbs)
              + Math.abs(macros.fat     - originalTotals.fat);

  return {
    name:   `${meal?.name || 'Comida'} · ${variant.suffix}`,
    reason: swappedCount
      ? `He cambiado ${swappedCount} alimento${swappedCount > 1 ? 's' : ''}${mainSwap ? `: ${mainSwap._orig} → ${mainSwap.name}` : ''}. Macros ajustadas manteniendo pesos en crudo.`
      : 'Ajuste de cantidades dentro de la misma comida para mantener macros similares. Todo en crudo.',
    foods:  nextFoods.map((f) => ({ name: f.name, grams: round(f.grams) })),
    macros: {
      protein: round(macros.protein),
      carbs:   round(macros.carbs),
      fat:     round(macros.fat),
      kcal:    round(macros.kcal),
    },
    delta,
  };
}

// ─── MOTOR LOCAL DE SUGERENCIAS ────────────────────────────────────────────────

function buildFallbackSuggestions(meal, library) {
  const foods          = sanitizeFoods(meal?.foods);
  const libraryEntries = Object.entries(library || {}).map(([name, macros]) => [normalizeFoodName(name), macros]);
  if (!foods.length || !libraryEntries.length) return [];

  const variants = [
    { suffix: 'cambio de proteína',   mode: 'balanced', offset: 0, groups: ['proteina'],     maxSwaps: 1, gramFactor: 1    },
    { suffix: 'cambio de hidrato',    mode: 'balanced', offset: 1, groups: ['carbohidrato'],  maxSwaps: 1, gramFactor: 1    },
    { suffix: 'cambio de grasa',      mode: 'balanced', offset: 3, groups: ['grasa'],        maxSwaps: 1, gramFactor: 1    },
    { suffix: 'más proteico',         mode: 'protein',  offset: 2, groups: ['proteina'],     maxSwaps: 1, gramFactor: 1.02 },
    { suffix: 'versión láctea',       mode: 'balanced', offset: 4, groups: ['proteina'],     maxSwaps: 1, gramFactor: 1,   includeDairy: true  },
    { suffix: 'alternativa legumbre', mode: 'balanced', offset: 5, groups: ['carbohidrato'], maxSwaps: 1, gramFactor: 1,   includeLegume: true },
  ];

  const seen     = new Set();
  const results  = [];

  for (const variant of variants) {
    if (results.length >= 3) break;
    const suggestion = buildSuggestionFromVariant(meal, foods, libraryEntries, variant);
    const sig = suggestion.foods.map((f) => `${f.name}:${f.grams}`).join('|');
    if (!seen.has(sig)) {
      seen.add(sig);
      const { delta, ...clean } = suggestion;
      results.push({ ...clean, _delta: delta });
    }
  }

  // Ordenar por proximidad de macros
  return results
    .sort((a, b) => (a._delta || 0) - (b._delta || 0))
    .map(({ _delta, ...s }) => s);
}

// ─── PAYLOAD LOCAL PURO ────────────────────────────────────────────────────────

function buildLocalOnlyPayload(meal, library, reason, tone = 'warning', title = 'Motor local activo') {
  return {
    note:        'Alternativas del motor local. Coherentes, sin IA remota.',
    banner:      { tone, title, body: reason },
    provider:    { provider: 'local', model: null, fallbackCount: 0 },
    fallbackUsed: true,
    suggestions: buildFallbackSuggestions(meal, library),
  };
}

// ─── LLAMADA A IA ──────────────────────────────────────────────────────────────

function buildPrompt(meal, library) {
  const foods = sanitizeFoods(meal?.foods);
  if (!foods.length) throw new Error('La comida no tiene alimentos válidos');

  const totals       = calculateTotals(foods);
  const libraryItems = Object.entries(library || {})
    .slice(0, 70)
    .map(([name, macros]) => ({ name: normalizeFoodName(name), ...macros }));

  return `Eres un nutricionista especializado en comidas de gimnasio en España.
REGLA INNEGOCIABLE: todos los pesos en crudo. Si propones arroz, pasta, legumbres, carne, pollo, pescado, patata o boniato, los gramos van en crudo.
Solo van "tal cual" los productos listos para consumir: yogur, skyr, queso, leche, pan, tortillas hechas, aceite, whey, caseína, frutos secos, crema de cacahuete.
No uses nombres con "cocido" o "cocinado".
Usa solo alimentos de la biblioteca disponible.
Devuelve exactamente JSON válido sin markdown.

Genera 3 alternativas con macros y kcal parecidas (margen ideal ±15% en kcal, lo más cerca posible en macros).
Prioriza sustituciones dentro del mismo grupo: proteína → proteína, hidrato → hidrato, grasa → grasa.
Ajusta gramos automáticamente para mantener equivalencia.

Respuesta requerida:
{
  "note": "texto breve sobre las alternativas",
  "suggestions": [
    {
      "name": "string",
      "reason": "string explicando el cambio y por qué encaja",
      "foods": [{"name":"string","grams":123}],
      "macros": {"protein":0,"carbs":0,"fat":0,"kcal":0}
    }
  ]
}

Comida original:
${JSON.stringify({
  name:   meal?.name || 'Comida',
  foods:  foods.map((f) => ({ ...f, rule: explainRawRule(f.name) })),
  totals,
  rule:   'Pesos en crudo salvo productos listos para consumir.',
}, null, 2)}

Biblioteca disponible:
${JSON.stringify(libraryItems, null, 2)}`;
}

async function requestAiJson(prompt) {
  const models   = AI_CONFIG.models?.length ? AI_CONFIG.models : [AI_CONFIG.model].filter(Boolean);
  const attempts = [];

  for (const model of models) {
    try {
      const response = await fetch(AI_CONFIG.endpoint, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
          ...AI_CONFIG.headers,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'Responde solo con JSON válido. Pesos siempre en crudo salvo productos listos para consumir.' },
            { role: 'user',   content: prompt },
          ],
          temperature:     0.45,
          max_tokens:      1100,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const text  = await response.text();
        const error = new Error(`Proveedor ${AI_CONFIG.provider} no disponible`);
        error.status     = response.status;
        error.raw        = text.slice(0, 600);
        error.retryAfter = response.headers.get('retry-after');
        error.model      = model;
        throw error;
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content || '';
      if (!text) {
        const error = new Error('La IA no devolvió contenido');
        error.status = 502;
        error.model  = model;
        throw error;
      }

      try {
        return { parsed: JSON.parse(text), usedModel: model, attempts };
      } catch {
        const error = new Error('La IA devolvió formato no válido');
        error.status = 502;
        error.model  = model;
        throw error;
      }
    } catch (error) {
      attempts.push({
        model,
        status:     error?.status     || 500,
        retryAfter: error?.retryAfter || null,
        message:    error?.message    || 'Error desconocido',
      });
    }
  }

  const lastAttempt = attempts[attempts.length - 1] || {};
  const error       = new Error(lastAttempt.message || `Proveedor ${AI_CONFIG.provider} no disponible`);
  error.status     = lastAttempt.status || 502;
  error.retryAfter = lastAttempt.retryAfter || null;
  error.attempts   = attempts;
  throw error;
}

// ─── NORMALIZACIÓN Y VALIDACIÓN DE RESPUESTA IA ────────────────────────────────

function normalizeSuggestion(suggestion, library) {
  const normalizedFoods = sanitizeFoods(suggestion?.foods || []).map((food) => {
    const normalizedName  = normalizeFoodName(food.name);
    const libraryMacros   = library?.[normalizedName] || {};
    return {
      name:    normalizedName,
      grams:   round(food.grams),
      protein: Number(libraryMacros.protein || 0),
      carbs:   Number(libraryMacros.carbs   || 0),
      fat:     Number(libraryMacros.fat     || 0),
      kcal:    Number(libraryMacros.kcal    || 0),
    };
  });

  const calculatedMacros = calculateTotals(normalizedFoods);
  const rawMacros        = suggestion?.macros || {};
  const hasUsefulMacros  = ['protein', 'carbs', 'fat', 'kcal'].some((k) => Number(rawMacros[k] || 0) > 0);
  const macros           = hasUsefulMacros ? rawMacros : calculatedMacros;

  return {
    name:   String(suggestion?.name   || 'Alternativa').slice(0, 80),
    reason: String(suggestion?.reason || '').slice(0, 300) || 'Alternativa con macros similares en crudo.',
    foods:  normalizedFoods.map((f) => ({ name: f.name, grams: f.grams })),
    macros: {
      protein: round(macros.protein || calculatedMacros.protein || 0),
      carbs:   round(macros.carbs   || calculatedMacros.carbs   || 0),
      fat:     round(macros.fat     || calculatedMacros.fat     || 0),
      kcal:    round(macros.kcal    || calculatedMacros.kcal    || 0),
    },
  };
}

function ratioDelta(base, next) {
  const safeBase = Math.max(Number(base || 0), 1);
  return Math.abs(Number(next || 0) - Number(base || 0)) / safeBase;
}

function validateSuggestion(suggestion, mealTotals, normalizedLibrary) {
  if (!suggestion || !Array.isArray(suggestion.foods) || !suggestion.foods.length) return false;

  // Todos los alimentos deben estar en la biblioteca con gramos positivos
  const allInLibrary = suggestion.foods.every(
    (f) => normalizedLibrary[normalizeFoodName(f.name)] && Number(f.grams || 0) > 0
  );
  if (!allInLibrary) return false;

  const computed = calculateTotals(
    suggestion.foods.map((f) => ({
      name:    normalizeFoodName(f.name),
      grams:   Number(f.grams || 0),
      ...normalizedLibrary[normalizeFoodName(f.name)],
    }))
  );

  const kcalOk    = ratioDelta(mealTotals.kcal,    computed.kcal)    <= MAX_AI_KCAL_DEVIATION;
  const proteinOk = ratioDelta(mealTotals.protein,  computed.protein) <= MAX_AI_MACRO_DEVIATION;

  // Solo requerimos que kcal y proteína sean razonables — los otros macros tienen más variabilidad
  return kcalOk && proteinOk;
}

function shouldSkipRemoteAi(meal, normalizedLibrary) {
  const foods      = sanitizeFoods(meal?.foods);
  if (!foods.length) return true;
  const knownFoods = foods.filter((f) => normalizedLibrary[f.name]).length;
  return knownFoods < Math.max(1, Math.ceil(foods.length * 0.6));
}

// ─── MANEJO DE ERRORES DE IA ───────────────────────────────────────────────────

function humanizeAiError(error, meal, library) {
  const fallbackSuggestions = buildFallbackSuggestions(meal, library);
  const attempts            = Array.isArray(error?.attempts) ? error.attempts : [];
  const triedModelsText     = attempts.length
    ? ` Modelos probados: ${attempts.map((a) => a.model).join(', ')}.`
    : '';
  const retryAfter    = attempts.find((a) => a.retryAfter)?.retryAfter || error?.retryAfter;
  const retryText     = retryAfter ? ` Vuelve a probar en ${retryAfter} segundos.` : '';
  const allRateLimited = attempts.length > 1 && attempts.every((a) => a.status === 429);

  if (error?.status === 429 || allRateLimited) {
    return {
      status: 200,
      humanMessage: `La IA gratuita está saturada ahora mismo.${retryText}`,
      providerMessage: `Plan B local activado.${triedModelsText}`,
      fallbackUsed: true,
      fallbackSuggestions,
      attempts,
      banner: { tone: 'warning', title: 'Plan B activado — IA saturada', body: 'Modelos gratuitos al límite. Alternativas locales en crudo.' },
    };
  }

  if (error?.status === 401 || error?.status === 403) {
    return {
      status: 200,
      humanMessage: 'Clave del proveedor no aceptada. Motor local activado.',
      providerMessage: `Plan B local.${triedModelsText}`,
      fallbackUsed: true,
      fallbackSuggestions,
      attempts,
      banner: { tone: 'warning', title: 'Clave inválida — motor local', body: 'La API rechazó la clave. Alternativas locales disponibles.' },
    };
  }

  if (error?.status >= 500) {
    return {
      status: 200,
      humanMessage: 'La IA remota no respondió bien. Motor local activado.',
      providerMessage: `Respaldo local.${triedModelsText}`,
      fallbackUsed: true,
      fallbackSuggestions,
      attempts,
      banner: { tone: 'warning', title: 'Error remoto — motor local', body: 'El servidor de IA falló. Usando alternativas locales en crudo.' },
    };
  }

  return {
    status: 200,
    humanMessage: 'No se pudo generar con IA. Alternativas locales disponibles.',
    providerMessage: `Plan B.${triedModelsText}`,
    fallbackUsed: true,
    fallbackSuggestions,
    attempts,
    banner: { tone: 'warning', title: 'Motor local activo', body: 'IA no disponible en este momento. Alternativas locales en crudo.' },
  };
}

// ─── ENDPOINT PRINCIPAL DE SUGERENCIAS ────────────────────────────────────────

async function suggestMealAlternatives(meal, library) {
  const normalizedLibrary = Object.fromEntries(
    Object.entries(library || {}).map(([name, macros]) => [normalizeFoodName(name), macros])
  );
  const foods = sanitizeFoods(meal?.foods);
  if (!foods.length) throw new Error('La comida no tiene alimentos válidos');

  if (shouldSkipRemoteAi(meal, normalizedLibrary)) {
    return buildLocalOnlyPayload(
      meal, normalizedLibrary,
      'La comida tiene demasiados alimentos fuera de la biblioteca. Motor local activado.',
      'info', 'Alternativas locales'
    );
  }

  if (!AI_CONFIG.enabled) {
    return buildLocalOnlyPayload(
      meal, normalizedLibrary,
      'Sin proveedor remoto configurado. Motor local disponible.',
      'info', 'Motor local disponible'
    );
  }

  const mealTotals                  = calculateTotals(foods);
  const { parsed, usedModel, attempts } = await requestAiJson(buildPrompt(meal, normalizedLibrary));
  const fallbackCount               = Array.isArray(attempts) ? attempts.length : 0;

  const normalizedSuggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions.slice(0, 3).map((s) => normalizeSuggestion(s, normalizedLibrary))
    : [];

  const validSuggestions = normalizedSuggestions.filter(
    (s) => validateSuggestion(s, mealTotals, normalizedLibrary)
  );

  // Si menos de 2 sugerencias pasan validación, descartar respuesta remota
  if (validSuggestions.length < 2) {
    return buildLocalOnlyPayload(
      meal, normalizedLibrary,
      'La respuesta remota no pasó filtros de coherencia. Motor local activado.',
      'warning', 'Respuesta remota descartada'
    );
  }

  return {
    note:    parsed.note || 'Sugerencias validadas y expresadas en crudo.',
    banner:  {
      tone:  'success',
      title: fallbackCount ? 'Alternativas tras reintento' : 'Alternativas generadas con IA',
      body:  fallbackCount
        ? 'Cambié de modelo hasta encontrar uno disponible.'
        : 'Todas las cantidades en crudo. Han pasado filtros de coherencia.',
    },
    provider: { provider: AI_CONFIG.provider, model: usedModel, fallbackCount },
    suggestions: validSuggestions,
  };
}

// ─── SERVIDOR HTTP ─────────────────────────────────────────────────────────────

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/health')) {
    return sendJson(res, 200, {
      ok:        true,
      service:   'macros-flex',
      aiEnabled: AI_CONFIG.enabled,
      provider:  AI_CONFIG.provider,
      model:     AI_CONFIG.model,
      models:    AI_CONFIG.models,
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/ai-status') {
    return sendJson(res, 200, {
      enabled:     true,
      mode:        AI_CONFIG.enabled ? 'remote' : 'local',
      provider:    AI_CONFIG.enabled ? AI_CONFIG.label : null,
      providerKey: AI_CONFIG.provider,
      model:       AI_CONFIG.model,
      models:      AI_CONFIG.models,
      reason:      AI_CONFIG.enabled
        ? 'Proveedor remoto activo. Sugerencias con validación estricta y fallback local.'
        : 'Sin IA remota. Alternativas del motor local, coherentes y en crudo.',
      setupHint:   AI_CONFIG.setupHint,
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/analyze-diet') {
    let body = null;
    try {
      body = await readJsonBody(req);
      const text = String(body?.text || '').slice(0, 12000); // cap at 12k chars
      if (!text.trim()) return sendJson(res, 400, { error: 'No text provided' });

      if (!AI_CONFIG.enabled) {
        return sendJson(res, 503, { error: 'AI not configured', meals: [] });
      }

      const prompt =
        `Extrae las comidas del siguiente texto de dieta. Devuelve JSON con esta estructura exacta:\n` +
        `{"meals":[{"name":"Desayuno","foods":[{"name":"Avena","grams":80},{"name":"Claras de huevo","grams":200}]},...]}\n\n` +
        `REGLA DE PESOS: carnes, pescados, arroz, pasta, legumbres, patata → peso en crudo.\n` +
        `Productos listos como yogur, pan, whey, aceite, frutos secos → tal cual.\n\n` +
        `Texto de la dieta:\n${text}`;

      const { parsed } = await requestAiJson(prompt);
      const meals = Array.isArray(parsed?.meals) ? parsed.meals : [];
      return sendJson(res, 200, { meals });
    } catch (err) {
      return sendJson(res, 500, { error: 'AI parsing failed', meals: [] });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/suggest-meal-alternatives') {
    let body = null;
    try {
      body         = await readJsonBody(req);
      const result = await suggestMealAlternatives(body.meal, body.library);
      return sendJson(res, 200, result);
    } catch (error) {
      const payload = humanizeAiError(error, body?.meal, body?.library);
      return sendJson(res, payload.status || 500, payload);
    }
  }

  // Servir archivos estáticos
  const cleanUrl     = url.pathname === '/' ? '/index.html' : url.pathname;
  const requestedPath = cleanUrl.replace(/\?.*$/, '');
  const filePath      = path.normalize(path.join(root, requestedPath));

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
