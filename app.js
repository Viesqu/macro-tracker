const STORAGE_KEY = "macros-flex-state-v4";
const LEGACY_STORAGE_KEYS = ["macros-flex-state-v3", "macros-flex-state-v2"];

const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

let _supabase = null;
let _saveTimer = null;
let aiAvailability = {
  enabled: false,
  provider: null,
  providerKey: null,
  model: null,
  reason: "Comprobando disponibilidad...",
  setupHint: "",
};

function getSupabase() {
  if (_supabase) return _supabase;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _supabase;
}

function getCodigo() {
  let code = localStorage.getItem("macros-flex-codigo");
  if (!code) {
    code = prompt(
      "Elige un código de acceso personal.\nÚsalo en todos tus dispositivos para sincronizar tus datos.\n\n(Si cancelas, se genera uno aleatorio para este dispositivo.)"
    );
    if (!code || !code.trim()) code = Math.random().toString(36).slice(2, 12);
    localStorage.setItem("macros-flex-codigo", code.trim());
  }
  return code;
}

function scheduleSave() {
  const sb = getSupabase();
  if (!sb) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    const code = getCodigo();
    await sb.from("sessions").upsert({ id: code, state, updated_at: new Date().toISOString() });
  }, 800);
}

const foodLibrary = {
  "Arroz": { protein: 7, carbs: 78, fat: 0.6, kcal: 360 },
  "Arroz basmati": { protein: 8.9, carbs: 77, fat: 0.6, kcal: 356 },
  "Arroz jazmín": { protein: 7.1, carbs: 80, fat: 0.5, kcal: 360 },
  "Pasta seca": { protein: 13, carbs: 75, fat: 1.5, kcal: 371 },
  "Avena": { protein: 16.9, carbs: 66.3, fat: 6.9, kcal: 389 },
  "Copos de maíz": { protein: 7.5, carbs: 84, fat: 0.9, kcal: 357 },
  "Pan integral": { protein: 12, carbs: 43, fat: 4.2, kcal: 252 },
  "Tortitas de arroz": { protein: 8, carbs: 81, fat: 2.8, kcal: 387 },
  "Tortilla de trigo": { protein: 8, carbs: 50, fat: 7, kcal: 310 },
  "Tortilla de maíz": { protein: 6, carbs: 44, fat: 2.8, kcal: 218 },
  "Patata": { protein: 2, carbs: 17, fat: 0.1, kcal: 77 },
  "Boniato": { protein: 1.6, carbs: 20.1, fat: 0.1, kcal: 86 },
  "Plátano": { protein: 1.1, carbs: 23, fat: 0.3, kcal: 89 },
  "Manzana": { protein: 0.3, carbs: 14, fat: 0.2, kcal: 52 },
  "Frutos rojos": { protein: 0.8, carbs: 12, fat: 0.3, kcal: 57 },
  "Piña": { protein: 0.5, carbs: 13, fat: 0.1, kcal: 50 },
  "Aguacate": { protein: 2, carbs: 9, fat: 15, kcal: 160 },
  "Pechuga de pollo": { protein: 23, carbs: 0, fat: 2, kcal: 110 },
  "Pavo": { protein: 24, carbs: 0, fat: 1.5, kcal: 111 },
  "Ternera magra": { protein: 21, carbs: 0, fat: 6, kcal: 140 },
  "Salmón": { protein: 20, carbs: 0, fat: 13, kcal: 208 },
  "Merluza": { protein: 18, carbs: 0, fat: 1.8, kcal: 82 },
  "Bacalao": { protein: 17.7, carbs: 0, fat: 0.7, kcal: 74 },
  "Atún fresco": { protein: 23.3, carbs: 0, fat: 4.9, kcal: 144 },
  "Gambas": { protein: 20, carbs: 0.9, fat: 1.7, kcal: 99 },
  "Claras de huevo": { protein: 11, carbs: 0.7, fat: 0.2, kcal: 52 },
  "Huevo entero": { protein: 12.6, carbs: 0.7, fat: 10.6, kcal: 143 },
  "Tofu firme": { protein: 13, carbs: 1.9, fat: 8, kcal: 144 },
  "Tempeh": { protein: 20, carbs: 9, fat: 11, kcal: 192 },
  "Seitán": { protein: 24, carbs: 6, fat: 2, kcal: 140 },
  "Yogur griego 0%": { protein: 10, carbs: 3.6, fat: 0.4, kcal: 59 },
  "Skyr natural": { protein: 11, carbs: 4, fat: 0.2, kcal: 63 },
  "Queso fresco batido 0%": { protein: 8, carbs: 4, fat: 0.2, kcal: 46 },
  "Requesón": { protein: 11, carbs: 3, fat: 4.3, kcal: 98 },
  "Leche semidesnatada": { protein: 3.2, carbs: 4.8, fat: 1.6, kcal: 47 },
  "Garbanzos secos": { protein: 19, carbs: 61, fat: 6, kcal: 364 },
  "Lentejas secas": { protein: 25.8, carbs: 60.1, fat: 1.1, kcal: 353 },
  "Alubias secas": { protein: 21, carbs: 61, fat: 1.6, kcal: 333 },
  "Edamame": { protein: 11.9, carbs: 8.9, fat: 5.2, kcal: 122 },
  "Aceite de oliva": { protein: 0, carbs: 0, fat: 100, kcal: 900 },
  "Almendras": { protein: 21, carbs: 22, fat: 49, kcal: 579 },
  "Nueces": { protein: 15, carbs: 14, fat: 65, kcal: 654 },
  "Crema de cacahuete": { protein: 26, carbs: 17, fat: 49, kcal: 588 },
  "Semillas de chía": { protein: 17, carbs: 42, fat: 31, kcal: 486 },
  "Chocolate negro 85%": { protein: 11, carbs: 19, fat: 46, kcal: 598 },
  "Proteína whey": { protein: 80, carbs: 7, fat: 6, kcal: 395 },
};

const RAW_GUIDANCE = "Todos los alimentos se registran siempre en crudo o en su formato comercial tal cual si no aplica cocinarlo.";

const defaultState = {
  meals: [
    createMeal("Comida 1", [createFood("Avena", 80), createFood("Claras de huevo", 200), createFood("Plátano", 120)]),
    createMeal("Comida 2", [createFood("Pechuga de pollo", 180), createFood("Arroz", 90), createFood("Aceite de oliva", 10)]),
    createMeal("Comida 3", [createFood("Salmón", 180), createFood("Patata", 300)]),
  ],
  templates: [],
  aiSuggestions: {},
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function createFood(name = "", grams = 100, overrides = {}) {
  const preset = foodLibrary[name] || { protein: 0, carbs: 0, fat: 0, kcal: 0 };
  return {
    id: uid(),
    name,
    grams,
    protein: overrides.protein ?? preset.protein,
    carbs: overrides.carbs ?? preset.carbs,
    fat: overrides.fat ?? preset.fat,
    kcal: overrides.kcal ?? preset.kcal,
  };
}

function createMeal(name = "Nueva comida", foods = [createFood()]) {
  return { id: uid(), name, foods };
}

function getDefaultMealName(index) {
  return `Comida ${index + 1}`;
}

function normalizeMealNames(meals) {
  const legacyDefaults = ["Desayuno", "Comida", "Cena"];
  const allLegacy = meals.length === legacyDefaults.length && meals.every((meal, index) => (meal?.name || "").trim() === legacyDefaults[index]);
  return meals.map((meal, index) => ({
    ...meal,
    name: allLegacy && legacyDefaults.includes((meal?.name || "").trim()) ? getDefaultMealName(index) : (meal?.name || "").trim() || getDefaultMealName(index),
  }));
}

function normalizeFoodName(name) {
  const value = String(name || "").trim();
  const legacyMap = {
    "Arroz cocido": "Arroz",
    "Patata cocida": "Patata",
    "Pasta cocida": "Pasta seca",
    "Garbanzos cocidos": "Garbanzos secos",
    "Lentejas cocidas": "Lentejas secas",
    "Atún al natural": "Atún fresco",
  };
  return legacyMap[value] || value;
}

function cloneMeal(meal) {
  return {
    id: uid(),
    name: `${meal.name} copia`,
    foods: meal.foods.map((food) => ({ ...food, id: uid() })),
  };
}

function sanitizeState(parsed) {
  const baseMeals = Array.isArray(parsed?.meals) ? parsed.meals : structuredClone(defaultState.meals);
  const meals = normalizeMealNames(
    baseMeals.map((meal, index) => ({
      id: meal?.id || uid(),
      name: meal?.name || getDefaultMealName(index),
      foods: Array.isArray(meal?.foods) && meal.foods.length
        ? meal.foods.map((food) => {
            const normalizedName = normalizeFoodName(food?.name || "");
            const preset = foodLibrary[normalizedName];
            const hadLegacyName = normalizedName !== (food?.name || "");
            return {
              id: food?.id || uid(),
              name: normalizedName,
              grams: Number(food?.grams || 0),
              protein: hadLegacyName && preset ? preset.protein : Number(food?.protein || preset?.protein || 0),
              carbs: hadLegacyName && preset ? preset.carbs : Number(food?.carbs || preset?.carbs || 0),
              fat: hadLegacyName && preset ? preset.fat : Number(food?.fat || preset?.fat || 0),
              kcal: hadLegacyName && preset ? preset.kcal : Number(food?.kcal || preset?.kcal || 0),
            };
          })
        : [createFood()],
    }))
  );
  const templates = Array.isArray(parsed?.templates) ? parsed.templates : [];
  const aiSuggestions = parsed?.aiSuggestions && typeof parsed.aiSuggestions === "object" ? parsed.aiSuggestions : {};
  return { meals, templates, aiSuggestions };
}

async function loadState() {
  const sb = getSupabase();
  if (sb) {
    try {
      const code = getCodigo();
      const { data } = await sb.from("sessions").select("state").eq("id", code).single();
      if (data?.state) return sanitizeState(data.state);
    } catch {}
  }

  try {
    const raw = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS].map((key) => localStorage.getItem(key)).find(Boolean);
    if (!raw) return structuredClone(defaultState);
    return sanitizeState(JSON.parse(raw));
  } catch {
    return structuredClone(defaultState);
  }
}

let state = structuredClone(defaultState);

const mealsContainer = document.getElementById("mealsContainer");
const dailySummary = document.getElementById("dailySummary");
const mealTemplate = document.getElementById("mealTemplate");
const foodRowTemplate = document.getElementById("foodRowTemplate");
const foodOptions = document.getElementById("foodOptions");
const templateSelect = document.getElementById("templateSelect");
const aiStatusText = document.getElementById("aiStatusText");
const aiStatusBadge = document.getElementById("aiStatusBadge");
const aiProviderMeta = document.getElementById("aiProviderMeta");
const aiSetupHint = document.getElementById("aiSetupHint");
const heroHighlights = document.getElementById("heroHighlights");
const aiPanelState = document.getElementById("aiPanelState");
const rawRuleNotice = document.getElementById("rawRuleNotice");

function persistStateOnly() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  scheduleSave();
}

function persistAndRender() {
  persistStateOnly();
  render();
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
}

function calculateFoodTotals(food) {
  const factor = Number(food.grams || 0) / 100;
  return {
    protein: round((food.protein || 0) * factor),
    carbs: round((food.carbs || 0) * factor),
    fat: round((food.fat || 0) * factor),
    kcal: round((food.kcal || 0) * factor),
  };
}

function calculateMealTotals(meal) {
  return meal.foods.reduce(
    (acc, food) => {
      const totals = calculateFoodTotals(food);
      acc.protein += totals.protein;
      acc.carbs += totals.carbs;
      acc.fat += totals.fat;
      acc.kcal += totals.kcal;
      acc.items += 1;
      return acc;
    },
    { protein: 0, carbs: 0, fat: 0, kcal: 0, items: 0 }
  );
}

function calculateDayTotals() {
  return state.meals.reduce(
    (acc, meal) => {
      const totals = calculateMealTotals(meal);
      acc.protein += totals.protein;
      acc.carbs += totals.carbs;
      acc.fat += totals.fat;
      acc.kcal += totals.kcal;
      acc.meals += 1;
      acc.foods += totals.items;
      return acc;
    },
    { protein: 0, carbs: 0, fat: 0, kcal: 0, meals: 0, foods: 0 }
  );
}

function setAiAvailability(next) {
  aiAvailability = { ...aiAvailability, ...next };
  aiStatusText.textContent = aiAvailability.reason;
  aiStatusBadge.textContent = aiAvailability.enabled ? "IA activa" : "IA opcional";
  aiStatusBadge.classList.toggle("offline", !aiAvailability.enabled);
  aiProviderMeta.textContent = aiAvailability.provider ? `Proveedor: ${aiAvailability.provider}` : "Proveedor: no configurado en este despliegue";
  aiSetupHint.textContent = aiAvailability.enabled
    ? "La clave vive solo en backend. Si el proveedor se satura, la app mostrará propuestas coherentes en crudo con plan B local."
    : aiAvailability.setupHint || "Puedes usar la app sin IA hasta que añadas una clave al servidor.";
  aiPanelState.innerHTML = `
    <div class="ai-state-strip ${aiAvailability.enabled ? "online" : "offline"}">
      <span class="status-chip ${aiAvailability.enabled ? "" : "offline"}">${aiAvailability.enabled ? "Lista para sugerir" : "Modo manual"}</span>
      <p>${escapeHtml(
        aiAvailability.enabled
          ? "Pide alternativas por comida y, si falla el proveedor, verás un plan B útil respetando siempre pesos en crudo."
          : "La parte inteligente está desactivada aquí, pero el tracking, los pesos en crudo y las plantillas siguen funcionando igual."
      )}</p>
    </div>
  `;
}

async function loadAiAvailability() {
  try {
    const response = await fetch("/api/ai-status");
    if (!response.ok) throw new Error("status unavailable");
    const data = await response.json();
    setAiAvailability({
      enabled: Boolean(data.enabled),
      provider: data.provider || null,
      providerKey: data.providerKey || null,
      model: data.model || null,
      setupHint: data.setupHint || "",
      reason: data.enabled
        ? "Puedes pedir alternativas por comida. Si la IA falla, intentaremos darte una respuesta útil y coherente en crudo."
        : data.reason || "La IA no está configurada en este despliegue. El resto de la app funciona igual.",
    });
  } catch {
    setAiAvailability({
      enabled: false,
      provider: null,
      providerKey: null,
      model: null,
      setupHint: "Si publicas solo los archivos estáticos sin server.js, la IA quedará desactivada automáticamente.",
      reason: "No hay endpoint de IA disponible. La app sigue funcionando sin esta función.",
    });
  }
  render();
}

function renderFoodOptions() {
  foodOptions.innerHTML = Object.keys(foodLibrary)
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((name) => `<option value="${escapeHtml(name)}"></option>`)
    .join("");
}

function renderTemplateOptions() {
  templateSelect.innerHTML = `<option value="">Selecciona una plantilla</option>${state.templates
    .map((template) => `<option value="${template.id}">${escapeHtml(template.name)}</option>`)
    .join("")}`;
}

function renderSummary() {
  const totals = calculateDayTotals();
  const cards = [
    ["💪", "Proteína", `${round(totals.protein)} g`, `${totals.meals} comidas activas`, "protein"],
    ["🍚", "Hidratos", `${round(totals.carbs)} g`, `${totals.foods} alimentos en total`, "carbs"],
    ["🥑", "Grasas", `${round(totals.fat)} g`, "Balance del día", "fat"],
    ["🔥", "Kcal", `${round(totals.kcal)}`, "Suma actual", "kcal"],
  ];
  dailySummary.innerHTML = cards
    .map(
      ([icon, label, value, subtext, tone]) => `
        <article class="summary-card ${tone}">
          <span class="summary-label">${icon} ${label}</span>
          <strong>${value}</strong>
          <div class="summary-subtext">${subtext}</div>
        </article>
      `
    )
    .join("");

  heroHighlights.innerHTML = [
    [`${totals.meals}`, "bloques editables"],
    [`${totals.foods}`, "alimentos en crudo hoy"],
    [aiAvailability.enabled ? "IA lista" : "IA opcional", aiAvailability.enabled ? "alternativas activas" : "sin bloquear la app"],
  ]
    .map(
      ([value, label]) => `
        <div class="hero-highlight-card">
          <strong>${escapeHtml(value)}</strong>
          <span>${escapeHtml(label)}</span>
        </div>
      `
    )
    .join("");

  if (rawRuleNotice) rawRuleNotice.textContent = RAW_GUIDANCE;
}

function renderMeals() {
  mealsContainer.innerHTML = "";
  state.meals.forEach((meal, index) => {
    const fragment = mealTemplate.content.cloneNode(true);
    const titleInput = fragment.querySelector(".meal-title");
    const mealIndexBadge = fragment.querySelector(".meal-index-badge");
    const meta = fragment.querySelector(".meal-meta");
    const tbody = fragment.querySelector(".foods-body");
    const summary = fragment.querySelector(".meal-summary");
    const spotlight = fragment.querySelector(".meal-spotlight");
    const kcalValue = fragment.querySelector(".meal-kcal-value");
    const macroBars = fragment.querySelector(".meal-macro-bars");
    const aiBox = fragment.querySelector(".meal-ai-box");
    const aiStatus = fragment.querySelector(".meal-ai-status");
    const aiStage = fragment.querySelector(".meal-ai-stage");
    const aiResults = fragment.querySelector(".meal-ai-results");
    const suggestButton = fragment.querySelector(".suggest-meal-btn");

    mealIndexBadge.textContent = getDefaultMealName(index);
    titleInput.value = meal.name;
    titleInput.placeholder = `Comida ${index + 1}`;
    titleInput.addEventListener("input", (event) => {
      meal.name = event.target.value || getDefaultMealName(index);
      persistAndRender();
    });

    fragment.querySelector(".add-food-btn").addEventListener("click", () => {
      meal.foods.push(createFood());
      persistAndRender();
    });

    fragment.querySelector(".duplicate-meal-btn").addEventListener("click", () => {
      state.meals.push(cloneMeal(meal));
      persistAndRender();
    });

    fragment.querySelector(".remove-meal-btn").addEventListener("click", () => {
      state.meals = state.meals.filter((item) => item.id !== meal.id);
      delete state.aiSuggestions[meal.id];
      if (state.meals.length === 0) state.meals.push(createMeal("Comida 1"));
      persistAndRender();
    });

    suggestButton.disabled = !aiAvailability.enabled;
    suggestButton.title = aiAvailability.enabled ? "Pide alternativas realistas manteniendo pesos y referencias en crudo" : "La IA no está configurada ahora mismo";
    suggestButton.addEventListener("click", async () => {
      await requestMealSuggestions(meal.id, suggestButton, aiStatus, aiResults, aiBox);
    });

    meal.foods.forEach((food) => {
      const rowFragment = foodRowTemplate.content.cloneNode(true);
      const row = rowFragment.querySelector("tr");
      const bindings = {
        name: row.querySelector(".food-name"),
        grams: row.querySelector(".grams"),
        protein: row.querySelector(".protein100"),
        carbs: row.querySelector(".carbs100"),
        fat: row.querySelector(".fat100"),
        kcal: row.querySelector(".kcal100"),
        total: row.querySelector(".food-total"),
      };

      bindings.name.value = food.name;
      bindings.name.placeholder = "Ej. arroz o pollo, siempre en crudo";
      bindings.grams.value = food.grams;
      bindings.protein.value = food.protein;
      bindings.carbs.value = food.carbs;
      bindings.fat.value = food.fat;
      bindings.kcal.value = food.kcal;

      bindings.name.addEventListener("change", (event) => {
        food.name = normalizeFoodName(event.target.value);
        const preset = foodLibrary[food.name];
        if (preset) {
          food.protein = preset.protein;
          food.carbs = preset.carbs;
          food.fat = preset.fat;
          food.kcal = preset.kcal;
        }
        clearSuggestionsForMeal(meal.id);
        persistAndRender();
      });

      [
        [bindings.grams, "grams"],
        [bindings.protein, "protein"],
        [bindings.carbs, "carbs"],
        [bindings.fat, "fat"],
        [bindings.kcal, "kcal"],
      ].forEach(([input, key]) => {
        input.addEventListener("input", (event) => {
          food[key] = Number(event.target.value) || 0;
          clearSuggestionsForMeal(meal.id);
          updateFoodTotal(bindings.total, food);
          updateMealUi(meal, meta, summary, spotlight, kcalValue, macroBars);
          renderSummary();
          persistStateOnly();
        });
      });

      row.querySelector(".remove-food-btn").addEventListener("click", () => {
        meal.foods = meal.foods.filter((item) => item.id !== food.id);
        clearSuggestionsForMeal(meal.id);
        if (meal.foods.length === 0) meal.foods.push(createFood());
        persistAndRender();
      });

      updateFoodTotal(bindings.total, food);
      tbody.appendChild(rowFragment);
    });

    updateMealUi(meal, meta, summary, spotlight, kcalValue, macroBars);
    renderMealSuggestions(meal.id, aiBox, aiStatus, aiStage, aiResults);
    mealsContainer.appendChild(fragment);
  });
}

function clearSuggestionsForMeal(mealId) {
  if (!state.aiSuggestions[mealId]) return;
  delete state.aiSuggestions[mealId];
}

function updateFoodTotal(target, food) {
  const totals = calculateFoodTotals(food);
  target.textContent = `P ${totals.protein}g\nHC ${totals.carbs}g\nG ${totals.fat}g\n${totals.kcal} kcal`;
}

function updateMealUi(meal, meta, summary, spotlight, kcalValue, macroBars) {
  const totals = calculateMealTotals(meal);
  const totalMacros = Math.max(totals.protein + totals.carbs + totals.fat, 1);
  meta.textContent = `${totals.items} alimentos · ${round(totals.kcal)} kcal · pesos en crudo`;
  summary.innerHTML = [
    `Proteína ${round(totals.protein)} g`,
    `Hidratos ${round(totals.carbs)} g`,
    `Grasas ${round(totals.fat)} g`,
    `Kcal ${round(totals.kcal)}`,
  ]
    .map((item) => `<span class="meal-pill">${item}</span>`)
    .join("");

  if (spotlight && kcalValue && macroBars) {
    kcalValue.textContent = round(totals.kcal);
    spotlight.classList.toggle("compact", totals.items < 2);
    macroBars.innerHTML = [
      ["Proteína", totals.protein, "protein"],
      ["Hidratos", totals.carbs, "carbs"],
      ["Grasas", totals.fat, "fat"],
    ]
      .map(
        ([label, value, tone]) => `
          <div class="macro-bar ${tone}">
            <div class="macro-bar-top">
              <span>${label}</span>
              <strong>${round(value)} g</strong>
            </div>
            <div class="macro-bar-track"><span style="width:${Math.max(10, Math.min(100, (value / totalMacros) * 100))}%"></span></div>
          </div>
        `
      )
      .join("");
  }
}

function renderMealSuggestions(mealId, aiBox, aiStatus, aiStage, aiResults) {
  const entry = state.aiSuggestions[mealId];
  if (!entry) {
    aiBox.classList.add("hidden");
    aiStatus.textContent = "";
    aiStage.innerHTML = "";
    aiResults.innerHTML = "";
    return;
  }

  aiBox.classList.remove("hidden");
  aiStatus.textContent = entry.note || "";
  aiStage.innerHTML = buildAiStage(entry);

  const banner = entry.banner
    ? `
      <div class="ai-info-banner ${escapeHtml(entry.banner.tone || "info")}">
        <strong>${escapeHtml(entry.banner.title || "")}</strong>
        ${entry.banner.body ? `<p>${escapeHtml(entry.banner.body)}</p>` : ""}
      </div>
    `
    : "";

  const cards = (entry.suggestions || [])
    .map(
      (suggestion) => `
        <article class="ai-suggestion-card">
          <div class="ai-suggestion-topline">
            <span class="ai-suggestion-badge">${escapeHtml(suggestion.fitLabel || "Ajuste aproximado")}</span>
            <h3>${escapeHtml(suggestion.name || "Alternativa")}</h3>
          </div>
          <p>${escapeHtml(suggestion.reason || "")}</p>
          <ul class="ai-suggestion-list">
            ${(suggestion.foods || [])
              .map((food) => `<li>${escapeHtml(food.name || "Alimento")}${food.grams ? `, ${round(food.grams)} g en crudo` : ""}</li>`)
              .join("")}
          </ul>
          <div class="ai-meta-row">
            <span class="meal-pill">P ${round(suggestion.macros?.protein || 0)} g</span>
            <span class="meal-pill">HC ${round(suggestion.macros?.carbs || 0)} g</span>
            <span class="meal-pill">G ${round(suggestion.macros?.fat || 0)} g</span>
            <span class="meal-pill">${round(suggestion.macros?.kcal || 0)} kcal</span>
          </div>
        </article>
      `
    )
    .join("");

  aiResults.innerHTML = `${banner}${cards || '<article class="ai-suggestion-card"><h3>Sin propuestas todavía</h3><p>No salió ninguna alternativa redonda en este intento. Suele ayudar que la comida tenga al menos una proteína y una fuente clara de hidratos o grasa, siempre medidas en crudo.</p></article>'}`;
}

function buildAiStage(entry) {
  const tone = entry.banner?.tone || "info";
  const stamp = entry.generatedAt ? new Date(entry.generatedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "ahora";
  return `
    <div class="ai-stage-card ${escapeHtml(tone)}">
      <span class="ai-stage-dot"></span>
      <div>
        <strong>${escapeHtml(entry.banner?.title || "IA lista")}</strong>
        <p>${escapeHtml(entry.banner?.body || "Generado para esta comida.")}</p>
      </div>
      <span class="ai-stage-time">${escapeHtml(stamp)}</span>
    </div>
  `;
}

async function requestMealSuggestions(mealId, button, statusNode, resultsNode, boxNode) {
  const meal = state.meals.find((item) => item.id === mealId);
  if (!meal || !aiAvailability.enabled) return;

  state.aiSuggestions[mealId] = {
    generatedAt: new Date().toISOString(),
    note: "Estamos preparando opciones similares para esta comida en crudo.",
    banner: {
      tone: "info",
      title: "Pensando alternativas",
      body: "Buscando una versión realista con macros parecidas y referencias en crudo.",
    },
    suggestions: [],
  };
  render();
  statusNode.textContent = "Buscando opciones parecidas en crudo...";
  resultsNode.innerHTML = '<article class="ai-suggestion-card skeleton-card"><div class="skeleton-line short"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></article>';
  boxNode.classList.remove("hidden");
  button.disabled = true;

  try {
    const response = await fetch("/api/suggest-meal-alternatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meal, library: foodLibrary }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw payload;

    state.aiSuggestions[mealId] = {
      generatedAt: new Date().toISOString(),
      note: payload.note || "Sugerencias orientativas. Si ves Plan B, son cambios automáticos razonables para no dejar la comida sin alternativas.",
      banner: payload.banner || { tone: payload.fallbackUsed ? "warning" : "success", title: "Sugerencias listas" },
      suggestions: Array.isArray(payload.suggestions)
        ? payload.suggestions.map((suggestion) => ({ ...suggestion, fitLabel: payload.fallbackUsed ? "Plan B" : "IA" }))
        : [],
    };
    persistAndRender();
  } catch (error) {
    state.aiSuggestions[mealId] = {
      generatedAt: new Date().toISOString(),
      note: error?.humanMessage || "No he podido pedir la sugerencia al proveedor ahora mismo.",
      banner: {
        tone: error?.fallbackUsed ? "warning" : "info",
        title: error?.fallbackUsed ? "Mostrando plan B" : "Ahora mismo no está disponible",
        body: error?.providerMessage || error?.error || "Prueba otra vez en un momento.",
      },
      suggestions: Array.isArray(error?.fallbackSuggestions)
        ? error.fallbackSuggestions.map((suggestion) => ({ ...suggestion, fitLabel: error?.fallbackUsed ? "Plan B" : "Manual" }))
        : [],
    };
    persistAndRender();
  } finally {
    button.disabled = !aiAvailability.enabled;
  }
}

function buildDaySummaryText() {
  const totals = calculateDayTotals();
  const lines = [
    `Macros Flex · ${new Date().toLocaleDateString("es-ES")}`,
    `Regla del día: todo va en crudo.`,
    `Total: ${round(totals.kcal)} kcal | P ${round(totals.protein)} g | HC ${round(totals.carbs)} g | G ${round(totals.fat)} g`,
    "",
  ];

  state.meals.forEach((meal) => {
    const mealTotals = calculateMealTotals(meal);
    lines.push(`${meal.name}: ${round(mealTotals.kcal)} kcal | P ${round(mealTotals.protein)} g | HC ${round(mealTotals.carbs)} g | G ${round(mealTotals.fat)} g`);
    meal.foods.forEach((food) => {
      lines.push(`- ${food.name || "Alimento"}, ${round(food.grams)} g en crudo`);
    });
    lines.push("");
  });

  return lines.join("\n");
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `macros-flex-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importState(file) {
  const text = await file.text();
  const parsed = sanitizeState(JSON.parse(text));
  state = parsed;
  persistAndRender();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function render() {
  renderFoodOptions();
  renderTemplateOptions();
  renderSummary();
  renderMeals();
}

document.getElementById("addMealBtn").addEventListener("click", () => {
  state.meals.push(createMeal(getDefaultMealName(state.meals.length)));
  persistAndRender();
});

document.getElementById("resetDayBtn").addEventListener("click", () => {
  if (!confirm("¿Reiniciar todas las comidas del día?")) return;
  state = structuredClone(defaultState);
  persistAndRender();
});

document.getElementById("addTemplateBtn").addEventListener("click", () => {
  const mealNames = state.meals.map((meal, index) => `${index + 1}. ${meal.name}`).join("\n");
  const choice = prompt(`¿Qué comida quieres guardar como plantilla?\n${mealNames}\n\nEscribe el número.`);
  const index = Number(choice) - 1;
  if (!Number.isInteger(index) || !state.meals[index]) return;
  const name = prompt("Nombre para la plantilla", state.meals[index].name);
  if (!name) return;
  state.templates.push({
    id: uid(),
    name,
    meal: {
      ...state.meals[index],
      id: uid(),
      name,
      foods: state.meals[index].foods.map((food) => ({ ...food, id: uid() })),
    },
  });
  persistAndRender();
});

document.getElementById("applyTemplateBtn").addEventListener("click", () => {
  const selected = state.templates.find((template) => template.id === templateSelect.value);
  if (!selected) return;
  state.meals.push(cloneMeal(selected.meal));
  persistAndRender();
});

document.getElementById("copyDaySummaryBtn").addEventListener("click", async () => {
  const summary = buildDaySummaryText();
  try {
    await navigator.clipboard.writeText(summary);
    alert("Resumen copiado al portapapeles.");
  } catch {
    prompt("Copia este resumen:", summary);
  }
});

document.getElementById("exportDataBtn").addEventListener("click", () => {
  exportState();
});

document.getElementById("importDataInput").addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  try {
    await importState(file);
    alert("Datos importados correctamente.");
  } catch {
    alert("No se pudo importar el JSON. Revisa el archivo.");
  } finally {
    event.target.value = "";
  }
});

(async () => {
  state = await loadState();
  persistStateOnly();
  await loadAiAvailability();
  render();
})();
