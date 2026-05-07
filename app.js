const STORAGE_KEY = "macros-flex-state-v5";
const LEGACY_STORAGE_KEYS = ["macros-flex-state-v4", "macros-flex-state-v3", "macros-flex-state-v2"];

const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

let _supabase = null;
let _saveTimer = null;
let aiAvailability = {
  enabled: true,
  provider: null,
  providerKey: null,
  model: null,
  mode: "local",
  reason: "Preparando alternativas automáticas...",
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

// ─── BASE DE ALIMENTOS ────────────────────────────────────────────────────────
// REGLA: todo lo que se cocina va en crudo. Lo que ya es producto final va tal cual.
// Carne, pescado, huevo, arroz, pasta, legumbres, patata → EN CRUDO
// Yogur, skyr, queso, leche, pan, aceite, whey, tortillas hechas, frutos secos → TAL CUAL

const foodLibrary = {
  // ── PROTEÍNAS (en crudo) ─────────────────────────────────────────────────
  "Pechuga de pollo":         { protein: 22.5, carbs: 0,    fat: 2.6,  kcal: 120 },
  "Contramuslo de pollo":     { protein: 19,   carbs: 0,    fat: 7,    kcal: 143 },
  "Pollo entero":             { protein: 18.5, carbs: 0,    fat: 9.5,  kcal: 163 },
  "Pechuga de pavo":          { protein: 22,   carbs: 0,    fat: 2,    kcal: 114 },
  "Pavo":                     { protein: 22,   carbs: 0,    fat: 2,    kcal: 114 },
  "Ternera magra":            { protein: 21,   carbs: 0,    fat: 5.7,  kcal: 137 },
  "Solomillo de ternera":     { protein: 21.5, carbs: 0,    fat: 3.7,  kcal: 120 },
  "Carne picada de ternera":  { protein: 17,   carbs: 0,    fat: 15,   kcal: 205 },
  "Cerdo magro (lomo)":       { protein: 21,   carbs: 0,    fat: 4,    kcal: 121 },
  "Solomillo de cerdo":       { protein: 21,   carbs: 0,    fat: 3.5,  kcal: 116 },
  "Salmón":                   { protein: 20,   carbs: 0,    fat: 13,   kcal: 208 },
  "Caballa":                  { protein: 19,   carbs: 0,    fat: 12,   kcal: 191 },
  "Merluza":                  { protein: 17.6, carbs: 0,    fat: 1.9,  kcal: 86  },
  "Bacalao":                  { protein: 17.7, carbs: 0,    fat: 0.7,  kcal: 74  },
  "Atún fresco":              { protein: 23.3, carbs: 0,    fat: 4.9,  kcal: 144 },
  "Atún al natural (lata)":   { protein: 26,   carbs: 0,    fat: 1.1,  kcal: 116 },
  "Sardinas en lata":         { protein: 20,   carbs: 0,    fat: 9,    kcal: 165 },
  "Gambas":                   { protein: 20.1, carbs: 0,    fat: 1.7,  kcal: 96  },
  "Mejillones":               { protein: 12,   carbs: 3.7,  fat: 2.2,  kcal: 86  },
  "Dorada":                   { protein: 19,   carbs: 0,    fat: 4,    kcal: 109 },
  "Lubina":                   { protein: 18,   carbs: 0,    fat: 3,    kcal: 99  },
  "Pulpo":                    { protein: 15,   carbs: 1,    fat: 1,    kcal: 73  },
  "Calamar":                  { protein: 16,   carbs: 2,    fat: 1.7,  kcal: 88  },
  "Huevo entero":             { protein: 12.6, carbs: 0.7,  fat: 10.6, kcal: 143 },
  "Claras de huevo":          { protein: 11,   carbs: 0.7,  fat: 0.2,  kcal: 52  },
  // Fiambres y embutidos típicos España → TAL CUAL
  "Jamón serrano":            { protein: 30,   carbs: 0,    fat: 7,    kcal: 184 },
  "Jamón ibérico":            { protein: 28,   carbs: 0,    fat: 12,   kcal: 220 },
  "Lomo embuchado":           { protein: 31,   carbs: 0,    fat: 5,    kcal: 173 },
  "Pechuga de pavo (fiambre)":{ protein: 18,   carbs: 1.5,  fat: 1.5,  kcal: 91  },
  "Pechuga de pollo (fiambre)":{ protein: 18,  carbs: 2,    fat: 1,    kcal: 89  },
  // Proteínas en polvo → TAL CUAL
  "Proteína whey (concentrada)": { protein: 80, carbs: 7,   fat: 6,    kcal: 395 },
  "Proteína whey (aislada)":     { protein: 92, carbs: 2,   fat: 0.5,  kcal: 380 },
  "Proteína whey":               { protein: 80, carbs: 7,   fat: 6,    kcal: 395 },
  "Caseína":                     { protein: 80, carbs: 4,   fat: 2,    kcal: 355 },
  "Proteína vegetal (guisante)": { protein: 80, carbs: 5,   fat: 2,    kcal: 360 },
  // Lácteos altos en proteína → TAL CUAL
  "Yogur griego 0%":          { protein: 10,   carbs: 3.6,  fat: 0.4,  kcal: 59  },
  "Yogur griego entero":      { protein: 9,    carbs: 3.6,  fat: 8,    kcal: 120 },
  "Skyr (yogur islandés, alto proteína)": { protein: 11, carbs: 4, fat: 0.2, kcal: 63 },
  "Quark desnatado":          { protein: 10,   carbs: 4,    fat: 0.2,  kcal: 57  },
  "Queso fresco batido 0%":   { protein: 8,    carbs: 4,    fat: 0.2,  kcal: 46  },
  "Requesón":                 { protein: 11,   carbs: 3,    fat: 4.3,  kcal: 98  },
  "Queso cottage":            { protein: 12,   carbs: 3.5,  fat: 4.3,  kcal: 103 },
  "Mozzarella":               { protein: 22,   carbs: 2.7,  fat: 17,   kcal: 257 },
  "Queso manchego":           { protein: 30,   carbs: 0.5,  fat: 35,   kcal: 440 },
  "Queso burgos":             { protein: 12,   carbs: 2,    fat: 12,   kcal: 165 },
  // Proteínas vegetales
  "Tofu firme":               { protein: 13,   carbs: 1.9,  fat: 8,    kcal: 144 },
  "Tempeh":                   { protein: 20,   carbs: 9,    fat: 11,   kcal: 192 },
  "Seitán":                   { protein: 24,   carbs: 6,    fat: 2,    kcal: 140 },
  "Edamame":                  { protein: 11.9, carbs: 8.9,  fat: 5.2,  kcal: 122 },

  // ── HIDRATOS (en crudo / seco) ──────────────────────────────────────────
  "Arroz":                    { protein: 6.7,  carbs: 78,   fat: 0.6,  kcal: 356 },
  "Arroz basmati":            { protein: 7.5,  carbs: 78,   fat: 0.6,  kcal: 354 },
  "Arroz jazmín":             { protein: 7.1,  carbs: 79,   fat: 0.6,  kcal: 356 },
  "Pasta seca":               { protein: 12.5, carbs: 73,   fat: 1.5,  kcal: 359 },
  "Pasta integral seca":      { protein: 13,   carbs: 65,   fat: 2,    kcal: 341 },
  "Avena":                    { protein: 16.9, carbs: 66.3, fat: 6.9,  kcal: 389 },
  "Crema de arroz":           { protein: 7,    carbs: 82,   fat: 1,    kcal: 367 },
  "Quinoa":                   { protein: 14,   carbs: 64,   fat: 6,    kcal: 368 },
  "Cuscús":                   { protein: 12.8, carbs: 72,   fat: 0.6,  kcal: 358 },
  "Patata":                   { protein: 2,    carbs: 17,   fat: 0.1,  kcal: 77  },
  "Boniato":                  { protein: 1.6,  carbs: 20.1, fat: 0.1,  kcal: 86  },
  "Garbanzos secos":          { protein: 19,   carbs: 61,   fat: 6,    kcal: 364 },
  "Lentejas secas":           { protein: 25.8, carbs: 60.1, fat: 1.1,  kcal: 353 },
  "Alubias secas":            { protein: 21,   carbs: 61,   fat: 1.6,  kcal: 333 },
  // Hidratos ya listos → TAL CUAL
  "Pan blanco":               { protein: 8.5,  carbs: 49,   fat: 2,    kcal: 255 },
  "Pan integral":             { protein: 9,    carbs: 49,   fat: 3.2,  kcal: 252 },
  "Tortitas de arroz":        { protein: 8,    carbs: 81,   fat: 2.8,  kcal: 387 },
  "Tortilla de trigo":        { protein: 8,    carbs: 50,   fat: 7,    kcal: 310 },
  "Tortilla de maíz":         { protein: 6,    carbs: 44,   fat: 2.8,  kcal: 218 },
  "Copos de maíz":            { protein: 7.5,  carbs: 84,   fat: 0.9,  kcal: 357 },

  // ── GRASAS (tal cual) ────────────────────────────────────────────────────
  "Aceite de oliva":          { protein: 0,    carbs: 0,    fat: 100,  kcal: 900 },
  "Aguacate":                 { protein: 2,    carbs: 9,    fat: 15,   kcal: 160 },
  "Almendras":                { protein: 21,   carbs: 22,   fat: 49,   kcal: 579 },
  "Nueces":                   { protein: 15,   carbs: 14,   fat: 65,   kcal: 654 },
  "Anacardos":                { protein: 18,   carbs: 30,   fat: 44,   kcal: 553 },
  "Cacahuetes":               { protein: 26,   carbs: 16,   fat: 49,   kcal: 567 },
  "Crema de cacahuete":       { protein: 26,   carbs: 17,   fat: 49,   kcal: 588 },
  "Mantequilla de almendra":  { protein: 21,   carbs: 20,   fat: 50,   kcal: 614 },
  "Semillas de chía":         { protein: 17,   carbs: 42,   fat: 31,   kcal: 486 },
  "Semillas de lino":         { protein: 18,   carbs: 29,   fat: 42,   kcal: 534 },
  "Semillas de girasol":      { protein: 21,   carbs: 20,   fat: 51,   kcal: 584 },
  "Chocolate negro 85%":      { protein: 11,   carbs: 19,   fat: 46,   kcal: 598 },
  "Aceitunas":                { protein: 0.8,  carbs: 1.2,  fat: 15,   kcal: 145 },
  "Atún en aceite (lata)":    { protein: 25,   carbs: 0,    fat: 8,    kcal: 198 },

  // ── FRUTAS (tal cual) ────────────────────────────────────────────────────
  "Plátano":                  { protein: 1.1,  carbs: 23,   fat: 0.3,  kcal: 89  },
  "Manzana":                  { protein: 0.3,  carbs: 14,   fat: 0.2,  kcal: 52  },
  "Pera":                     { protein: 0.4,  carbs: 15.5, fat: 0.1,  kcal: 58  },
  "Naranja":                  { protein: 0.9,  carbs: 12,   fat: 0.1,  kcal: 47  },
  "Mandarina":                { protein: 0.8,  carbs: 13,   fat: 0.2,  kcal: 53  },
  "Kiwi":                     { protein: 1.1,  carbs: 15,   fat: 0.5,  kcal: 61  },
  "Fresas":                   { protein: 0.8,  carbs: 7.7,  fat: 0.3,  kcal: 32  },
  "Frutos rojos":             { protein: 0.8,  carbs: 12,   fat: 0.3,  kcal: 57  },
  "Piña":                     { protein: 0.5,  carbs: 13,   fat: 0.1,  kcal: 50  },
  "Mango":                    { protein: 0.8,  carbs: 15,   fat: 0.4,  kcal: 60  },
  "Melocotón":                { protein: 0.9,  carbs: 10,   fat: 0.3,  kcal: 39  },
  "Uvas":                     { protein: 0.7,  carbs: 18,   fat: 0.2,  kcal: 67  },
  "Sandía":                   { protein: 0.6,  carbs: 8,    fat: 0.2,  kcal: 30  },
  "Melón":                    { protein: 0.8,  carbs: 9,    fat: 0.3,  kcal: 34  },

  // ── LÁCTEOS (tal cual) ───────────────────────────────────────────────────
  "Leche entera":             { protein: 3.4,  carbs: 4.8,  fat: 3.6,  kcal: 61  },
  "Leche semidesnatada":      { protein: 3.2,  carbs: 4.8,  fat: 1.6,  kcal: 47  },
  "Leche desnatada":          { protein: 3.6,  carbs: 5.1,  fat: 0.1,  kcal: 35  },

  // ── VERDURAS (en crudo) ──────────────────────────────────────────────────
  "Brócoli":                  { protein: 3.6,  carbs: 4.5,  fat: 0.4,  kcal: 34  },
  "Espinacas":                { protein: 2.5,  carbs: 3.4,  fat: 0.4,  kcal: 22  },
  "Pepino":                   { protein: 0.6,  carbs: 3.6,  fat: 0.1,  kcal: 16  },
  "Tomate":                   { protein: 0.9,  carbs: 3.9,  fat: 0.2,  kcal: 18  },
  "Lechuga":                  { protein: 1.3,  carbs: 2.9,  fat: 0.2,  kcal: 18  },
  "Zanahoria":                { protein: 0.9,  carbs: 10,   fat: 0.2,  kcal: 41  },
  "Pimiento rojo":            { protein: 1,    carbs: 6.3,  fat: 0.2,  kcal: 31  },
  "Pimiento verde":           { protein: 0.9,  carbs: 4.6,  fat: 0.2,  kcal: 23  },
  "Cebolla":                  { protein: 1.1,  carbs: 10,   fat: 0.1,  kcal: 40  },
  "Coliflor":                 { protein: 2,    carbs: 5,    fat: 0.3,  kcal: 25  },
  "Berenjena":                { protein: 1,    carbs: 5.7,  fat: 0.2,  kcal: 25  },
  "Calabacín":                { protein: 1.2,  carbs: 3.4,  fat: 0.2,  kcal: 19  },
  "Acelgas":                  { protein: 1.8,  carbs: 3.7,  fat: 0.2,  kcal: 22  },
  "Col":                      { protein: 1.6,  carbs: 6.2,  fat: 0.2,  kcal: 25  },

  // ── VERDURAS ADICIONALES ─────────────────────────────────────────────────
  "Espárragos":               { protein: 2.2,  carbs: 3.9,  fat: 0.1,  kcal: 20  },
  "Champiñones":              { protein: 3.1,  carbs: 3.3,  fat: 0.3,  kcal: 22  },
  "Judías verdes":            { protein: 1.8,  carbs: 4.3,  fat: 0.2,  kcal: 25  },
  "Guisantes":                { protein: 5.4,  carbs: 14.5, fat: 0.4,  kcal: 81  },
  "Rúcula":                   { protein: 2.6,  carbs: 3.7,  fat: 0.7,  kcal: 25  },
  "Alcachofas":               { protein: 3.3,  carbs: 5,    fat: 0.2,  kcal: 53  },
  "Remolacha":                { protein: 1.6,  carbs: 9.6,  fat: 0.1,  kcal: 43  },
  "Puerro":                   { protein: 1.5,  carbs: 14,   fat: 0.3,  kcal: 61  },

  // ── FRUTAS ADICIONALES ───────────────────────────────────────────────────
  "Arándanos":                { protein: 0.7,  carbs: 14,   fat: 0.3,  kcal: 57  },
  "Cerezas":                  { protein: 1,    carbs: 13,   fat: 0.2,  kcal: 50  },
  "Ciruelas":                 { protein: 0.7,  carbs: 11,   fat: 0.3,  kcal: 46  },
  "Pomelo":                   { protein: 0.8,  carbs: 9,    fat: 0.1,  kcal: 42  },

  // ── PESCADOS ADICIONALES ─────────────────────────────────────────────────
  "Trucha":                   { protein: 19,   carbs: 0,    fat: 5,    kcal: 121 },
  "Boquerón":                 { protein: 17,   carbs: 0,    fat: 3,    kcal: 96  },
  "Sepia":                    { protein: 15,   carbs: 0.5,  fat: 0.7,  kcal: 69  },
  "Rape":                     { protein: 18,   carbs: 0,    fat: 1.5,  kcal: 82  },

  // ── EMBUTIDOS ADICIONALES ────────────────────────────────────────────────
  "Chorizo":                  { protein: 22,   carbs: 1,    fat: 38,   kcal: 440 },
  "Salchichón":               { protein: 22,   carbs: 1,    fat: 36,   kcal: 425 },
  "Mortadela":                { protein: 13,   carbs: 3,    fat: 28,   kcal: 320 },

  // ── CEREALES ADICIONALES ─────────────────────────────────────────────────
  "Arroz integral":           { protein: 7.5,  carbs: 76,   fat: 2.2,  kcal: 361 },
  "Pan de centeno":           { protein: 8.8,  carbs: 48,   fat: 1.7,  kcal: 241 },
  "Maíz (grano seco)":        { protein: 8.5,  carbs: 74,   fat: 3.9,  kcal: 365 },

  // ── SUPLEMENTOS DEPORTIVOS ───────────────────────────────────────────────
  // Valores por 100g. Para creatina, se usa en dosis de 5g (≈0 kcal relevantes)
  "Barrita proteína":         { protein: 20,   carbs: 22,   fat: 7,    kcal: 235 },
  "Bebida proteica (RTD)":    { protein: 20,   carbs: 5,    fat: 3,    kcal: 130 },
  "Creatina monohidrato":     { protein: 0,    carbs: 0,    fat: 0,    kcal: 0   },

  // ── OTROS ───────────────────────────────────────────────────────────────
  "Hummus":                   { protein: 8,    carbs: 14,   fat: 9,    kcal: 166 },
  "Miel":                     { protein: 0.3,  carbs: 82,   fat: 0,    kcal: 304 },
  "Aceite de coco":           { protein: 0,    carbs: 0,    fat: 100,  kcal: 900 },
  "Mantequilla":              { protein: 0.6,  carbs: 0.6,  fat: 82,   kcal: 740 },
  "Kéfir":                    { protein: 4,    carbs: 4.5,  fat: 3.5,  kcal: 61  },
  "Leche de soja":            { protein: 3.3,  carbs: 3,    fat: 1.8,  kcal: 44  },
  "Leche de avena":           { protein: 1.2,  carbs: 6,    fat: 1.5,  kcal: 45  },
  "Soja (grano seco)":        { protein: 36,   carbs: 30,   fat: 20,   kcal: 446 },

  // ── CARNES ADICIONALES ───────────────────────────────────────────────────
  "Conejo":                   { protein: 21,   carbs: 0,    fat: 4,    kcal: 114 },
  "Cordero (pierna)":         { protein: 18,   carbs: 0,    fat: 13,   kcal: 192 },
  "Pato":                     { protein: 18,   carbs: 0,    fat: 15,   kcal: 201 },
  "Ternera (carne picada magra)": { protein: 21, carbs: 0,  fat: 7,    kcal: 151 },
  "Buey (solomillo)":         { protein: 22,   carbs: 0,    fat: 4,    kcal: 125 },
  "Pollo (muslo sin piel)":   { protein: 21,   carbs: 0,    fat: 5,    kcal: 133 },

  // ── PESCADOS ADICIONALES ─────────────────────────────────────────────────
  "Lenguado":                 { protein: 17,   carbs: 0,    fat: 2,    kcal: 85  },
  "Fletán":                   { protein: 18,   carbs: 0,    fat: 5,    kcal: 116 },
  "Tilapia":                  { protein: 20,   carbs: 0,    fat: 3,    kcal: 111 },
  "Langostinos":              { protein: 18,   carbs: 0.5,  fat: 1,    kcal: 82  },
  "Almejas":                  { protein: 14,   carbs: 3.5,  fat: 2,    kcal: 90  },
  "Berberechos":              { protein: 14,   carbs: 3,    fat: 1.5,  kcal: 82  },

  // ── LEGUMBRES ADICIONALES ────────────────────────────────────────────────
  "Judías blancas (secas)":   { protein: 22,   carbs: 61,   fat: 1,    kcal: 340 },
  "Habas (secas)":            { protein: 26,   carbs: 58,   fat: 1.5,  kcal: 341 },
  "Azukis (secas)":           { protein: 20,   carbs: 63,   fat: 0.5,  kcal: 329 },

  // ── CEREALES Y PAN ADICIONALES ───────────────────────────────────────────
  "Trigo sarraceno":          { protein: 13,   carbs: 72,   fat: 3,    kcal: 355 },
  "Espelta (grano)":          { protein: 15,   carbs: 68,   fat: 2,    kcal: 338 },
  "Bulgur":                   { protein: 12,   carbs: 76,   fat: 1.3,  kcal: 360 },
  "Mijo":                     { protein: 11,   carbs: 73,   fat: 4,    kcal: 378 },
  "Polenta (maíz harina)":    { protein: 8,    carbs: 74,   fat: 3.4,  kcal: 362 },
  "Pan de molde integral":    { protein: 9,    carbs: 41,   fat: 4,    kcal: 234 },
  "Pan de pita":              { protein: 9,    carbs: 54,   fat: 1.5,  kcal: 265 },
  "Wraps de trigo":           { protein: 8,    carbs: 52,   fat: 7,    kcal: 310 },
  "Biscotes":                 { protein: 9,    carbs: 77,   fat: 2.5,  kcal: 390 },
  "Nachos / chips de maíz":   { protein: 8,    carbs: 77,   fat: 7,    kcal: 415 },

  // ── LÁCTEOS ADICIONALES ──────────────────────────────────────────────────
  "Yogur natural":            { protein: 3.5,  carbs: 4.5,  fat: 3,    kcal: 58  },
  "Yogur natural desnatado":  { protein: 3.8,  carbs: 5,    fat: 0.2,  kcal: 36  },
  "Kéfir desnatado":          { protein: 4.2,  carbs: 4.6,  fat: 0.5,  kcal: 40  },
  "Leche de coco (lata)":     { protein: 2,    carbs: 6,    fat: 24,   kcal: 230 },

  // ── FRUTOS SECOS Y GRASAS ADICIONALES ───────────────────────────────────
  "Pistachos":                { protein: 20,   carbs: 28,   fat: 45,   kcal: 562 },
  "Avellanas":                { protein: 15,   carbs: 17,   fat: 61,   kcal: 628 },
  "Macadamia":                { protein: 8,    carbs: 14,   fat: 76,   kcal: 718 },
  "Nueces de Brasil":         { protein: 14,   carbs: 12,   fat: 66,   kcal: 659 },
  "Tahini (pasta de sésamo)": { protein: 17,   carbs: 26,   fat: 54,   kcal: 595 },
  "Coco rallado (seco)":      { protein: 6,    carbs: 15,   fat: 64,   kcal: 660 },
  "Aceite de girasol":        { protein: 0,    carbs: 0,    fat: 100,  kcal: 900 },
  "Mantequilla de cacahuete (sin azúcar)": { protein: 24, carbs: 20, fat: 50, kcal: 600 },

  // ── SUPLEMENTOS ADICIONALES ──────────────────────────────────────────────
  "Proteína de arroz":        { protein: 80,   carbs: 12,   fat: 3,    kcal: 395 },
  "Proteína de soja aislada": { protein: 90,   carbs: 3,    fat: 1,    kcal: 375 },
  "Maltodextrina":            { protein: 0,    carbs: 100,  fat: 0,    kcal: 390 },
  "Dextrina de maíz":         { protein: 0,    carbs: 100,  fat: 0,    kcal: 390 },
  "Proteína en polvo (vegana)": { protein: 75, carbs: 8,    fat: 4,    kcal: 370 },
  "Snack proteico (tipo Grenade)": { protein: 21, carbs: 15, fat: 8,   kcal: 213 },

  // ── FRUTAS ADICIONALES ───────────────────────────────────────────────────
  "Higos":                    { protein: 0.8,  carbs: 19,   fat: 0.3,  kcal: 74  },
  "Dátiles":                  { protein: 2.2,  carbs: 75,   fat: 0.4,  kcal: 277 },
  "Papaya":                   { protein: 0.5,  carbs: 10,   fat: 0.1,  kcal: 43  },
  "Maracuyá":                 { protein: 2.2,  carbs: 23,   fat: 0.7,  kcal: 97  },

  // ── CONDIMENTOS Y EXTRAS ─────────────────────────────────────────────────
  "Salsa de soja (baja sal)": { protein: 10,   carbs: 7,    fat: 0.1,  kcal: 60  },
  "Mostaza":                  { protein: 4,    carbs: 3,    fat: 4,    kcal: 66  },
  "Vinagre de manzana":       { protein: 0,    carbs: 1,    fat: 0,    kcal: 22  },
  "Caldo de pollo (casero)":  { protein: 3,    carbs: 0.5,  fat: 0.5,  kcal: 20  },
};

const RAW_GUIDANCE = "Regla cerrada: carne, pollo, pescado, huevo, arroz, pasta, legumbres, patata y boniato se apuntan en crudo. Van tal cual los productos listos para consumir: yogur, skyr, queso, pan, aceite, whey, frutos secos, tortillas hechas.";

// ─── CLASIFICACIÓN SALUDABLE ──────────────────────────────────────────────────
// Criterio: alimentos que no aportan valor en una dieta de calidad o que solo
// se usan ocasionalmente. Reciben penalización al sugerir alternativas, pero
// siguen estando en la biblioteca porque alguien puede querer registrarlos.

const INDULGENT_FOODS = new Set([
  // Embutidos grasos
  "Chorizo", "Salchichón", "Mortadela",
  // Grasas saturadas / refinadas
  "Mantequilla", "Aceite de coco", "Aceite de girasol", "Chocolate negro 85%",
  // Hidratos refinados / azucarados
  "Pan blanco", "Tortilla de trigo", "Tortilla de maíz", "Wraps de trigo",
  "Biscotes", "Nachos / chips de maíz", "Copos de maíz", "Galletas de avena",
  "Miel", "Maltodextrina", "Dextrina de maíz",
  // Procesados con azúcar
  "Barrita proteína", "Bebida proteica (RTD)", "Snack proteico (tipo Grenade)",
]);

// Grasas saludables prioritarias (AOVE, frutos secos sin sal/azúcar, semillas, aguacate)
const HEALTHY_FATS = new Set([
  "Aceite de oliva", "Aguacate",
  "Almendras", "Nueces", "Anacardos", "Cacahuetes", "Pistachos",
  "Avellanas", "Macadamia", "Nueces de Brasil",
  "Crema de cacahuete", "Mantequilla de almendra",
  "Mantequilla de cacahuete (sin azúcar)", "Tahini (pasta de sésamo)",
  "Semillas de chía", "Semillas de lino", "Semillas de girasol",
  "Aceitunas",
]);

function isIndulgent(name)   { return INDULGENT_FOODS.has(name); }
function isHealthyFat(name)  { return HEALTHY_FATS.has(name); }

// ─── FAMILIAS DE ALIMENTOS ────────────────────────────────────────────────────
// Sistema de categorización fina por uso dietético. Determina qué se puede
// intercambiar con qué desde el punto de vista nutricional, NO solo macros.
// Reemplaza la lógica anterior basada solo en isDairy/isEgg/isLegume.

const FOOD_FAMILY = {
  // Carnes magras (poca grasa, alta proteína)
  "Pechuga de pollo": "carne_magra",       "Pechuga de pavo": "carne_magra",
  "Pavo": "carne_magra",                    "Ternera magra": "carne_magra",
  "Solomillo de ternera": "carne_magra",   "Cerdo magro (lomo)": "carne_magra",
  "Solomillo de cerdo": "carne_magra",     "Conejo": "carne_magra",
  "Ternera (carne picada magra)": "carne_magra",
  "Buey (solomillo)": "carne_magra",       "Pollo (muslo sin piel)": "carne_magra",
  // Carnes con más grasa
  "Contramuslo de pollo": "carne_grasa",   "Pollo entero": "carne_grasa",
  "Carne picada de ternera": "carne_grasa","Cordero (pierna)": "carne_grasa",
  "Pato": "carne_grasa",
  // Pescado blanco (magro)
  "Merluza": "pescado_blanco",   "Bacalao": "pescado_blanco",
  "Dorada": "pescado_blanco",     "Lubina": "pescado_blanco",
  "Lenguado": "pescado_blanco",   "Fletán": "pescado_blanco",
  "Tilapia": "pescado_blanco",    "Rape": "pescado_blanco",
  // Pescado azul (omega 3, más grasa saludable)
  "Salmón": "pescado_azul",        "Atún fresco": "pescado_azul",
  "Caballa": "pescado_azul",       "Sardinas en lata": "pescado_azul",
  "Atún al natural (lata)": "pescado_azul", "Trucha": "pescado_azul",
  "Boquerón": "pescado_azul",
  "Atún en aceite (lata)": "pescado_azul",
  // Marisco
  "Gambas": "marisco",       "Mejillones": "marisco",
  "Pulpo": "marisco",         "Calamar": "marisco",
  "Sepia": "marisco",         "Langostinos": "marisco",
  "Almejas": "marisco",       "Berberechos": "marisco",
  // Huevos
  "Huevo entero": "huevo_entero",
  "Claras de huevo": "huevo_clara",
  // Fiambres magros
  "Jamón serrano": "fiambre_magro",         "Jamón ibérico": "fiambre_magro",
  "Lomo embuchado": "fiambre_magro",
  "Pechuga de pavo (fiambre)": "fiambre_magro",
  "Pechuga de pollo (fiambre)": "fiambre_magro",
  // Embutidos grasos (indulgentes)
  "Chorizo": "embutido_graso",  "Salchichón": "embutido_graso",
  "Mortadela": "embutido_graso",
  // Proteína en polvo (no se mezcla con comidas reales)
  "Proteína whey (concentrada)": "proteina_polvo",
  "Proteína whey (aislada)": "proteina_polvo",
  "Proteína whey": "proteina_polvo",
  "Caseína": "proteina_polvo",
  "Proteína vegetal (guisante)": "proteina_polvo",
  "Proteína de arroz": "proteina_polvo",
  "Proteína de soja aislada": "proteina_polvo",
  "Proteína en polvo (vegana)": "proteina_polvo",
  // Lácteos altos en proteína
  "Yogur griego 0%": "lacteo_proteico",        "Yogur griego entero": "lacteo_proteico",
  "Skyr (yogur islandés, alto proteína)": "lacteo_proteico",
  "Quark desnatado": "lacteo_proteico",
  "Queso fresco batido 0%": "lacteo_proteico",
  "Requesón": "lacteo_proteico",  "Queso cottage": "lacteo_proteico",
  "Yogur natural": "lacteo_proteico",
  "Yogur natural desnatado": "lacteo_proteico",
  "Kéfir": "lacteo_proteico",  "Kéfir desnatado": "lacteo_proteico",
  // Quesos curados (mucha grasa, raramente intercambian con magros)
  "Mozzarella": "queso", "Queso manchego": "queso", "Queso burgos": "queso",
  // Proteína vegetal entera
  "Tofu firme": "proteina_vegetal",  "Tempeh": "proteina_vegetal",
  "Seitán": "proteina_vegetal",       "Edamame": "proteina_vegetal",
  // Cereales en grano (neutros)
  "Arroz": "grano_neutro",          "Arroz basmati": "grano_neutro",
  "Arroz jazmín": "grano_neutro",   "Pasta seca": "grano_neutro",
  "Crema de arroz": "grano_neutro", "Cuscús": "grano_neutro",
  "Polenta (maíz harina)": "grano_neutro",
  "Maíz (grano seco)": "grano_neutro",
  // Cereales integrales
  "Arroz integral": "grano_integral",  "Pasta integral seca": "grano_integral",
  "Avena": "grano_integral",            "Bulgur": "grano_integral",
  // Pseudocereales
  "Quinoa": "pseudocereal", "Trigo sarraceno": "pseudocereal",
  "Espelta (grano)": "pseudocereal", "Mijo": "pseudocereal",
  // Tubérculos
  "Patata": "tuberculo", "Boniato": "tuberculo",
  // Legumbres
  "Garbanzos secos": "legumbre",  "Lentejas secas": "legumbre",
  "Alubias secas": "legumbre",     "Judías blancas (secas)": "legumbre",
  "Habas (secas)": "legumbre",      "Azukis (secas)": "legumbre",
  "Soja (grano seco)": "legumbre",  "Hummus": "legumbre",
  // Pan
  "Pan integral": "pan_integral",   "Pan de centeno": "pan_integral",
  "Pan de molde integral": "pan_integral",
  "Pan blanco": "pan_blanco",       "Pan de pita": "pan_blanco",
  "Wraps de trigo": "pan_blanco",   "Tortilla de trigo": "pan_blanco",
  "Tortilla de maíz": "pan_blanco", "Biscotes": "pan_blanco",
  "Tortitas de arroz": "tortita",   "Copos de maíz": "pan_blanco",
  "Nachos / chips de maíz": "snack_salado",
  // Frutas
  "Plátano": "fruta", "Manzana": "fruta", "Pera": "fruta", "Naranja": "fruta",
  "Mandarina": "fruta", "Kiwi": "fruta", "Fresas": "fruta", "Frutos rojos": "fruta",
  "Piña": "fruta", "Mango": "fruta", "Melocotón": "fruta", "Uvas": "fruta",
  "Sandía": "fruta", "Melón": "fruta", "Arándanos": "fruta", "Cerezas": "fruta",
  "Ciruelas": "fruta", "Pomelo": "fruta", "Higos": "fruta", "Dátiles": "fruta",
  "Papaya": "fruta", "Maracuyá": "fruta",
  // Verduras
  "Brócoli": "verdura", "Espinacas": "verdura", "Pepino": "verdura",
  "Tomate": "verdura", "Lechuga": "verdura", "Zanahoria": "verdura",
  "Pimiento rojo": "verdura", "Pimiento verde": "verdura", "Cebolla": "verdura",
  "Coliflor": "verdura", "Berenjena": "verdura", "Calabacín": "verdura",
  "Acelgas": "verdura", "Col": "verdura", "Espárragos": "verdura",
  "Champiñones": "verdura", "Judías verdes": "verdura", "Guisantes": "verdura",
  "Rúcula": "verdura", "Alcachofas": "verdura", "Remolacha": "verdura",
  "Puerro": "verdura",
  // Aceites
  "Aceite de oliva": "aceite_saludable",
  "Aceite de coco": "aceite_saturado",
  "Aceite de girasol": "aceite_refinado",
  // Frutos secos
  "Almendras": "fruto_seco", "Nueces": "fruto_seco", "Anacardos": "fruto_seco",
  "Cacahuetes": "fruto_seco", "Pistachos": "fruto_seco", "Avellanas": "fruto_seco",
  "Macadamia": "fruto_seco", "Nueces de Brasil": "fruto_seco",
  "Coco rallado (seco)": "fruto_seco",
  // Cremas oleaginosas
  "Crema de cacahuete": "crema_oleaginosa",
  "Mantequilla de almendra": "crema_oleaginosa",
  "Mantequilla de cacahuete (sin azúcar)": "crema_oleaginosa",
  "Tahini (pasta de sésamo)": "crema_oleaginosa",
  // Aguacate y aceitunas
  "Aguacate": "aguacate", "Aceitunas": "aguacate",
  // Semillas
  "Semillas de chía": "semilla", "Semillas de lino": "semilla",
  "Semillas de girasol": "semilla",
  // Grasas animales / saturadas
  "Mantequilla": "grasa_saturada",
  "Chocolate negro 85%": "chocolate",
  // Endulzantes / azúcar
  "Miel": "endulzante", "Azúcar": "endulzante",
  // Lácteos líquidos
  "Leche entera": "lacteo_liquido",      "Leche semidesnatada": "lacteo_liquido",
  "Leche desnatada": "lacteo_liquido",
  "Leche de coco (lata)": "bebida_vegetal",
  "Leche de soja": "bebida_vegetal",      "Leche de avena": "bebida_vegetal",
  // Suplementos
  "Creatina monohidrato": "suplemento_neutro",
  "Maltodextrina": "suplemento_carbo", "Dextrina de maíz": "suplemento_carbo",
  "Barrita proteína": "snack_proteico",
  "Bebida proteica (RTD)": "snack_proteico",
  "Snack proteico (tipo Grenade)": "snack_proteico",
  // Procesados dulces
  "Galletas de avena": "procesado_dulce",
  // Condimentos
  "Salsa de soja (baja sal)": "condimento", "Mostaza": "condimento",
  "Vinagre de manzana": "condimento", "Caldo de pollo (casero)": "condimento",
};

// Reglas de intercambio: qué familia puede sustituir a qué.
// Primer elemento = misma familia (preferida). El resto, swaps coherentes.
const FAMILY_SWAPS = {
  carne_magra:    ["carne_magra", "pescado_blanco", "pescado_azul", "marisco", "huevo_clara", "huevo_entero", "fiambre_magro"],
  carne_grasa:    ["carne_grasa", "carne_magra", "pescado_azul"],
  pescado_blanco: ["pescado_blanco", "pescado_azul", "marisco", "carne_magra", "huevo_clara"],
  pescado_azul:   ["pescado_azul", "pescado_blanco", "marisco", "carne_magra"],
  marisco:        ["marisco", "pescado_blanco", "pescado_azul", "carne_magra"],
  huevo_entero:   ["huevo_entero", "huevo_clara", "carne_magra", "pescado_blanco"],
  huevo_clara:    ["huevo_clara", "huevo_entero", "carne_magra", "pescado_blanco"],
  fiambre_magro:  ["fiambre_magro", "carne_magra"],
  embutido_graso: ["embutido_graso", "fiambre_magro"],
  proteina_polvo: ["proteina_polvo"],
  lacteo_proteico:["lacteo_proteico"],
  queso:          ["queso"],
  proteina_vegetal:["proteina_vegetal", "lacteo_proteico", "legumbre"],

  grano_neutro:   ["grano_neutro", "grano_integral", "tuberculo", "pseudocereal"],
  grano_integral: ["grano_integral", "grano_neutro", "tuberculo", "pseudocereal"],
  pseudocereal:   ["pseudocereal", "grano_integral", "grano_neutro", "tuberculo"],
  tuberculo:      ["tuberculo", "grano_integral", "grano_neutro", "pseudocereal"],
  legumbre:       ["legumbre", "tuberculo", "pseudocereal", "grano_integral"],
  pan_integral:   ["pan_integral", "pan_blanco", "tortita"],
  pan_blanco:     ["pan_blanco", "pan_integral", "tortita"],
  tortita:        ["tortita", "pan_integral", "pan_blanco"],
  snack_salado:   ["snack_salado"],

  fruta:          ["fruta"],
  verdura:        ["verdura"],

  aceite_saludable:["aceite_saludable", "fruto_seco", "aguacate", "crema_oleaginosa", "semilla"],
  aceite_saturado: ["aceite_saturado", "aceite_saludable"],
  aceite_refinado: ["aceite_refinado", "aceite_saludable"],
  fruto_seco:     ["fruto_seco", "crema_oleaginosa", "aguacate", "semilla", "aceite_saludable"],
  crema_oleaginosa:["crema_oleaginosa", "fruto_seco", "aguacate", "aceite_saludable"],
  aguacate:       ["aguacate", "fruto_seco", "crema_oleaginosa", "aceite_saludable"],
  semilla:        ["semilla", "fruto_seco", "aceite_saludable"],
  grasa_saturada: ["grasa_saturada"],
  chocolate:      ["chocolate"],

  endulzante:     ["endulzante"],
  procesado_dulce:["procesado_dulce"],
  lacteo_liquido: ["lacteo_liquido", "bebida_vegetal"],
  bebida_vegetal: ["bebida_vegetal", "lacteo_liquido"],

  suplemento_neutro: ["suplemento_neutro"],
  suplemento_carbo:  ["suplemento_carbo", "grano_neutro"],
  snack_proteico:    ["snack_proteico", "lacteo_proteico"],
  condimento:        ["condimento"],
};

function getFoodFamily(name)        { return FOOD_FAMILY[name] || null; }
function getSwappableFamilies(fam)  { return FAMILY_SWAPS[fam] || (fam ? [fam] : []); }

// Devuelve true/false si las dos pertenecen a familias intercambiables.
// Devuelve null si alguna de las dos no está clasificada (entonces se cae al filtro antiguo).
function isFamilySwap(baseName, candName) {
  const baseFam = getFoodFamily(baseName);
  const candFam = getFoodFamily(candName);
  if (!baseFam || !candFam) return null;
  return getSwappableFamilies(baseFam).includes(candFam);
}

// ─── MOTOR LOCAL DE SUGERENCIAS (cliente) ─────────────────────────────────────
// Funciona sin servidor. Se usa cuando la llamada a /api falla o no hay servidor.

function localGetFoodProfile(food) {
  const protein = Number(food.protein || 0);
  const carbs   = Number(food.carbs   || 0);
  const fat      = Number(food.fat    || 0);
  const name     = String(food.name   || "").toLowerCase();

  const pKcal = protein * 4;
  const cKcal = carbs   * 4;
  const fKcal = fat     * 9;
  const total = Math.max(pKcal + cKcal + fKcal, 1);
  const pR = pKcal / total;
  const cR = cKcal / total;
  const fR = fKcal / total;

  const isProteinPowder = /whey|caseín/i.test(name);
  const isDairy   = /yogur|skyr|queso|requesón|cottage|leche/i.test(name);
  const isEgg     = /huevo/i.test(name);
  const isFruit   = /plátano|manzana|pera|naranja|mandarina|kiwi|fresas|frutos rojos|piña|mango|melocotón|uvas|sandía|melón/i.test(name);
  const isLegume  = /garbanzo|lenteja|alubia|edamame/i.test(name);
  const isVegetable = /brócoli|espinaca|pepino|tomate|lechuga|zanahoria|pimiento|cebolla|coliflor|berenjena|calabacín|acelga|col/i.test(name);

  // Clasificación por ratio calórico. Orden de prioridad:
  // 1) Huevo/lácteo → siempre proteina (el ratio calórico puede ser engañoso)
  // 2) Carne/pescado con >=15g proteína y <=5g HC → siempre proteina (salmón, atún, etc.)
  // 3) Alimento principalmente graso por ratio calórico
  // 4) Proteína significativa por calorías
  // 5) Hidrato dominante
  let group = "mixto";
  if (isDairy || isEgg) {
    group = "proteina";
  } else if (protein >= 15 && carbs <= 5) {
    group = "proteina";
  } else if (fR >= 0.50 || (fat >= 15 && fat > protein && fat > carbs)) {
    group = "grasa";
  } else if (pR >= 0.30 && fat <= 25) {
    group = "proteina";
  } else if (cR >= 0.55 && fR <= 0.25) {
    group = "carbohidrato";
  }

  return { protein, carbs, fat, group, isProteinPowder, isDairy, isEgg, isFruit, isLegume, isVegetable };
}

function localScoreReplacement(baseFood, baseProfile, candidate, candidateProfile) {
  let score = 0;
  if (baseProfile.group === candidateProfile.group) score += 5;
  score -= Math.abs(baseFood.protein - candidate.protein) * 0.15;
  score -= Math.abs(baseFood.carbs   - candidate.carbs)   * 0.10;
  score -= Math.abs(baseFood.fat     - candidate.fat)     * 0.18;
  score -= Math.abs(baseFood.kcal    - candidate.kcal)    * 0.025;
  if (baseProfile.isDairy         === candidateProfile.isDairy)         score += 2;
  if (baseProfile.isEgg           === candidateProfile.isEgg)           score += 2;
  if (baseProfile.isLegume        === candidateProfile.isLegume)        score += 2;
  if (baseProfile.isFruit         === candidateProfile.isFruit)         score += 2;
  if (baseProfile.isProteinPowder === candidateProfile.isProteinPowder) score += 2;
  if (baseProfile.isVegetable     === candidateProfile.isVegetable)     score += 1.5;

  // Criterio nutricional: penaliza indulgentes (mantequilla, chorizo, miel, etc.)
  // Excepción: si el alimento BASE ya es indulgente, suavizamos la penalización
  // para que las alternativas saludables suban al top sin cancelar las del mismo tipo.
  if (isIndulgent(candidate.name) && !isIndulgent(baseFood.name)) score -= 9;
  if (isIndulgent(candidate.name) &&  isIndulgent(baseFood.name)) score -= 2;

  // Bonus extra para grasas saludables cuando la base también es saludable
  if (baseProfile.group === "grasa" && isHealthyFat(candidate.name))   score += 2.5;

  // Bonus de familia: misma familia es preferible a swap inter-familia
  const baseFam = getFoodFamily(baseFood.name);
  const candFam = getFoodFamily(candidate.name);
  if (baseFam && candFam) {
    if (baseFam === candFam) {
      score += 4; // misma familia: pollo↔pavo, merluza↔bacalao, almendras↔nueces
    } else if (FAMILY_SWAPS[baseFam]?.includes(candFam)) {
      // Posición en la lista de swappable: cuanto más cerca, mejor encaje
      const idx = FAMILY_SWAPS[baseFam].indexOf(candFam);
      score += Math.max(2.5 - idx * 0.4, 0.4);
    }
  }

  return score;
}

function localChooseReplacement(baseFood, libraryEntries, usedNames, offset) {
  const baseProfile = localGetFoodProfile(baseFood);

  const candidates = libraryEntries
    .map(([name, macros]) => {
      const food    = { name, ...macros };
      const profile = localGetFoodProfile(food);
      return { food, profile, score: localScoreReplacement(baseFood, baseProfile, food, profile) };
    })
    .filter(({ food, profile }) => {
      // Filtro duro: base saludable no acepta alternativas indulgentes
      if (!isIndulgent(baseFood.name) && isIndulgent(food.name)) return false;

      // PRIMER FILTRO: familias de alimentos (criterio dietético)
      const familyMatch = isFamilySwap(baseFood.name, food.name);
      if (familyMatch === true)  return true;   // intercambio aceptado
      if (familyMatch === false) return false;  // explícitamente rechazado

      // FALLBACK (alguno no clasificado): lógica antigua por subtipo y grupo
      if (baseProfile.isProteinPowder) return profile.isProteinPowder || (profile.isDairy && food.protein >= 8);
      if (baseProfile.isDairy)  return profile.isDairy;
      if (baseProfile.isEgg)    return profile.isEgg || (profile.isDairy && food.protein >= 8);
      if (baseProfile.isLegume) return profile.isLegume;
      if (baseProfile.isFruit)  return profile.isFruit;
      if (baseProfile.isVegetable) return profile.isVegetable;
      if (baseProfile.group === "grasa")          return profile.group === "grasa";
      if (baseProfile.group === "proteina")       return profile.group === "proteina" && !profile.isDairy && !profile.isEgg;
      if (baseProfile.group === "carbohidrato")   return profile.group === "carbohidrato";
      return profile.group === baseProfile.group;
    })
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    return { name: baseFood.name, protein: baseFood.protein, carbs: baseFood.carbs, fat: baseFood.fat, kcal: baseFood.kcal };
  }
  const unique = candidates.filter(({ food }) => !usedNames.has(food.name) || food.name === baseFood.name);
  const pool   = unique.length ? unique : candidates;
  return pool[Math.min(offset, pool.length - 1)].food;
}

function localScaleGrams(baseFood, replacement) {
  const bGrams   = Number(baseFood.grams || 100);
  const bKcal    = (baseFood.kcal    || 0) * bGrams / 100;
  const bProtein = (baseFood.protein || 0) * bGrams / 100;
  const bCarbs   = (baseFood.carbs   || 0) * bGrams / 100;
  const bFat     = (baseFood.fat     || 0) * bGrams / 100;

  const rKcal    = Math.max(Number(replacement.kcal    || 0), 1);
  const rProtein = Number(replacement.protein || 0);
  const rCarbs   = Number(replacement.carbs   || 0);
  const rFat     = Number(replacement.fat     || 0);

  const byKcal    = (bKcal    / rKcal)    * 100;
  const byProtein = rProtein  > 0 ? (bProtein / rProtein) * 100 : byKcal;
  const byCarbs   = rCarbs    > 0 ? (bCarbs   / rCarbs)   * 100 : byKcal;
  const byFat     = rFat      > 0 ? (bFat     / rFat)     * 100 : byKcal;

  const profile        = localGetFoodProfile(baseFood);
  const replName       = String(replacement.name || "");
  const isOilBase      = /aceite/i.test(String(baseFood.name || ""));
  const isOilReplace   = /aceite/i.test(replName);

  let grams = byKcal;
  if (profile.group === "proteina")           grams = byProtein * 0.65 + byKcal * 0.35;
  else if (profile.group === "carbohidrato")  grams = byCarbs   * 0.70 + byKcal * 0.30;
  else if (profile.group === "grasa") {
    // Para grasas: prioriza kcal sobre fat puro porque evita propuestas absurdas
    // (ej: 10g AOVE = 90 kcal → 15g almendras (87 kcal) en vez de 20g por solo igualar fat)
    if (isOilBase && !isOilReplace) {
      // Cambio aceite → fruto seco/aguacate: kcal manda, fat secundario
      grams = byKcal * 0.80 + byFat * 0.20;
    } else if (!isOilBase && isOilReplace) {
      // Cambio fruto seco → aceite: kcal manda fuerte (el aceite es muy denso)
      grams = byKcal * 0.85 + byFat * 0.15;
    } else {
      // Mismo tipo de grasa: equilibrado
      grams = byKcal * 0.55 + byFat * 0.45;
    }
  }

  // Mínimos/máximos sensatos por tipo de alimento
  let minGrams = 20;
  let maxGrams = 500;
  if (isOilReplace)                                              { minGrams = 3;  maxGrams = 40;  }
  else if (/almendra|nuez|nueces|anacardo|cacahuete|pistacho|avellana|macadamia|brasil|crema de|mantequilla de|tahini|semilla/i.test(replName)) {
    minGrams = 5;   maxGrams = 80;
  }
  else if (/aguacate|aceitunas/i.test(replName))                  { minGrams = 15; maxGrams = 250; }
  else if (/whey|caseín|prote[íi]na/i.test(replName))             { minGrams = 10; maxGrams = 80;  }
  else if (/creatina|maltodextrina|dextrina/i.test(replName))     { minGrams = 3;  maxGrams = 40;  }

  return Math.max(minGrams, Math.min(maxGrams, round(grams)));
}

function localBuildVariant(meal, foods, libraryEntries, variant) {
  const usedNames = new Set();
  let swaps = 0;

  const nextFoods = foods.map((food, i) => {
    const profile    = localGetFoodProfile(food);
    const shouldSwap = (
      variant.groups.includes(profile.group) ||
      (variant.includeDairy    && profile.isDairy)   ||
      (variant.includeLegume   && profile.isLegume)  ||
      (variant.isFruit         && profile.isFruit)
    );

    let replacement;
    if (shouldSwap && swaps < (variant.maxSwaps || 1)) {
      replacement = localChooseReplacement(food, libraryEntries, usedNames, (variant.offset + i) % 5 + 1);
    } else {
      replacement = { name: food.name, protein: food.protein, carbs: food.carbs, fat: food.fat, kcal: food.kcal };
    }

    if (replacement.name !== food.name) swaps++;
    usedNames.add(replacement.name);

    const grams = replacement.name === food.name
      ? Math.max(20, Math.min(500, round(Number(food.grams || 100) * (variant.gramFactor || 1))))
      : localScaleGrams({ ...food }, replacement);

    return {
      name:     replacement.name,
      grams,
      protein:  replacement.protein,
      carbs:    replacement.carbs,
      fat:      replacement.fat,
      kcal:     replacement.kcal,
      _orig:    food.name,
    };
  });

  const macros = nextFoods.reduce((acc, f) => {
    const factor = f.grams / 100;
    acc.protein += (f.protein || 0) * factor;
    acc.carbs   += (f.carbs   || 0) * factor;
    acc.fat     += (f.fat     || 0) * factor;
    acc.kcal    += (f.kcal    || 0) * factor;
    return acc;
  }, { protein: 0, carbs: 0, fat: 0, kcal: 0 });

  const origTotals = foods.reduce((acc, f) => {
    const factor = (f.grams || 100) / 100;
    acc.protein += (f.protein || 0) * factor;
    acc.carbs   += (f.carbs   || 0) * factor;
    acc.fat     += (f.fat     || 0) * factor;
    return acc;
  }, { protein: 0, carbs: 0, fat: 0 });

  const swapped  = nextFoods.filter(f => f.name !== f._orig);
  const mainSwap = swapped[0];
  const delta    = Math.abs(macros.protein - origTotals.protein)
                 + Math.abs(macros.carbs   - origTotals.carbs)
                 + Math.abs(macros.fat     - origTotals.fat);

  return {
    name:   `${meal.name || "Comida"} · ${variant.label}`,
    reason: swapped.length
      ? `Cambio de ${swapped.length} alimento${swapped.length > 1 ? "s" : ""}${mainSwap ? `: ${mainSwap._orig} → ${mainSwap.name}` : ""}. Todo en crudo.`
      : "Ajuste de cantidades manteniendo la misma idea de comida. Todo en crudo.",
    foods:  nextFoods.map(f => ({ name: f.name, grams: round(f.grams) })),
    macros: { protein: round(macros.protein), carbs: round(macros.carbs), fat: round(macros.fat), kcal: round(macros.kcal) },
    delta,
  };
}

function buildClientFallbackSuggestions(meal) {
  const foods = (meal.foods || [])
    .map(f => ({ ...f, name: normalizeFoodName(f.name) }))
    .filter(f => f.name && Number(f.grams || 0) > 0);

  if (!foods.length) return [];

  const libraryEntries = Object.entries(foodLibrary);

  const variants = [
    { label: "cambio de proteína",      groups: ["proteina"],      maxSwaps: 1, offset: 0, gramFactor: 1 },
    { label: "cambio de hidrato",       groups: ["carbohidrato"],  maxSwaps: 1, offset: 1, gramFactor: 1 },
    { label: "cambio de grasa",         groups: ["grasa"],         maxSwaps: 1, offset: 3, gramFactor: 1 },
    { label: "más proteico",            groups: ["proteina"],      maxSwaps: 1, offset: 2, gramFactor: 1 },
    { label: "versión láctea",          groups: ["proteina"],      maxSwaps: 1, offset: 4, includeDairy: true, gramFactor: 1 },
    { label: "alternativa legumbre",    groups: ["carbohidrato"],  maxSwaps: 1, offset: 5, includeLegume: true, gramFactor: 1 },
  ];

  const seen    = new Set();
  const results = [];

  for (const variant of variants) {
    if (results.length >= 3) break;
    const suggestion = localBuildVariant(meal, foods, libraryEntries, variant);
    const sig = suggestion.foods.map(f => `${f.name}:${f.grams}`).join("|");
    if (seen.has(sig)) continue;
    seen.add(sig);
    const { delta, ...clean } = suggestion;
    results.push(clean);
  }

  // Ordenar por delta antes de cortar (las más cercanas en macros primero)
  return results;
}

// ─── MOTOR DE SUGERENCIAS EN COLUMNAS ─────────────────────────────────────────
// Genera 5 alternativas por grupo macro (proteína / hidrato / grasa) de forma
// independiente. El usuario puede aplicar cada alternativa individual al instante.

function buildColumnSuggestions(meal) {
  const foods = (meal.foods || [])
    .map(f => ({ ...f, name: normalizeFoodName(f.name) }))
    .filter(f => f.name && Number(f.grams || 0) > 0);

  if (!foods.length) return { type: "columns", columns: [] };

  const libraryEntries = Object.entries(foodLibrary);

  // Classify each food
  const classified = foods.map(food => ({ food, profile: localGetFoodProfile(food) }));

  // Group by macro category
  const groupMap = { proteina: [], carbohidrato: [], grasa: [] };
  classified.forEach(({ food, profile }) => {
    if (groupMap[profile.group]) groupMap[profile.group].push({ food, profile });
  });

  const groupOrder  = ["proteina", "carbohidrato", "grasa"];
  const groupLabels = { proteina: "Proteína", carbohidrato: "Hidratos", grasa: "Grasas" };
  const groupColors = { proteina: "protein", carbohidrato: "carbs", grasa: "fat" };

  const columns = [];

  for (const group of groupOrder) {
    const items = groupMap[group];
    if (!items || !items.length) continue;

    // Pick main food (highest kcal contribution)
    const mainItem = [...items].sort((a, b) => {
      const aKcal = (a.food.kcal || 0) * (a.food.grams || 100) / 100;
      const bKcal = (b.food.kcal || 0) * (b.food.grams || 100) / 100;
      return bKcal - aKcal;
    })[0];

    const baseFood    = mainItem.food;
    const baseProfile = mainItem.profile;

    // Find top 5 alternatives
    const alternatives = libraryEntries
      .map(([name, macros]) => {
        const food    = { name, ...macros };
        const profile = localGetFoodProfile(food);
        return { food, profile, score: localScoreReplacement(baseFood, baseProfile, food, profile) };
      })
      .filter(({ food, profile }) => {
        if (food.name === baseFood.name) return false;
        if (!isIndulgent(baseFood.name) && isIndulgent(food.name)) return false;

        // PRIMER FILTRO: familias coherentes
        const familyMatch = isFamilySwap(baseFood.name, food.name);
        if (familyMatch === true)  return true;
        if (familyMatch === false) return false;

        // FALLBACK por subtipo y grupo
        if (baseProfile.isProteinPowder) return profile.isProteinPowder || (profile.isDairy && food.protein >= 8);
        if (baseProfile.isDairy)         return profile.isDairy;
        if (baseProfile.isEgg)           return profile.isEgg || (profile.isDairy && food.protein >= 8);
        if (baseProfile.isLegume)        return profile.isLegume;
        if (baseProfile.isFruit)         return profile.isFruit;
        if (baseProfile.isVegetable)     return profile.isVegetable;
        if (group === "grasa")           return profile.group === "grasa";
        if (group === "proteina")        return profile.group === "proteina" && !profile.isDairy && !profile.isEgg;
        if (group === "carbohidrato")    return profile.group === "carbohidrato";
        return profile.group === group;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ food }) => {
        const grams  = localScaleGrams(baseFood, food);
        const factor = grams / 100;
        return {
          name:    food.name,
          grams,
          protein: round((food.protein || 0) * factor),
          carbs:   round((food.carbs   || 0) * factor),
          fat:     round((food.fat     || 0) * factor),
          kcal:    round((food.kcal    || 0) * factor),
          per100:  { protein: food.protein, carbs: food.carbs, fat: food.fat, kcal: food.kcal },
        };
      });

    if (!alternatives.length) continue;

    const factor = baseFood.grams / 100;
    columns.push({
      group,
      label:          groupLabels[group],
      color:          groupColors[group],
      originalFoodId: baseFood.id,
      originalFood: {
        ...baseFood,
        totalKcal:    round((baseFood.kcal    || 0) * factor),
        totalProtein: round((baseFood.protein || 0) * factor),
        totalCarbs:   round((baseFood.carbs   || 0) * factor),
        totalFat:     round((baseFood.fat     || 0) * factor),
      },
      alternatives,
    });
  }

  return { type: "columns", columns };
}

// ─── ESTADO Y FUNCIONES CORE ───────────────────────────────────────────────────

const defaultState = {
  meals: [
    createMeal("Comida 1", [createFood("Avena", 80), createFood("Claras de huevo", 200), createFood("Plátano", 120)]),
    createMeal("Comida 2", [createFood("Pechuga de pollo", 180), createFood("Arroz", 90), createFood("Aceite de oliva", 10)]),
    createMeal("Comida 3", [createFood("Salmón", 180), createFood("Patata", 300)]),
  ],
  templates:      [],
  aiSuggestions:  {},
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function createFood(name = "", grams = 100, overrides = {}) {
  const preset = foodLibrary[name] || { protein: 0, carbs: 0, fat: 0, kcal: 0 };
  return {
    id:      uid(),
    name,
    grams,
    protein: overrides.protein ?? preset.protein,
    carbs:   overrides.carbs   ?? preset.carbs,
    fat:     overrides.fat     ?? preset.fat,
    kcal:    overrides.kcal    ?? preset.kcal,
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
    name: allLegacy && legacyDefaults.includes((meal?.name || "").trim())
      ? getDefaultMealName(index)
      : (meal?.name || "").trim() || getDefaultMealName(index),
  }));
}

function normalizeFoodName(name) {
  const value = String(name || "").trim();
  const legacyMap = {
    // Nombres cocinados → crudo correcto
    "Arroz cocido":            "Arroz",
    "Patata cocida":           "Patata",
    "Pasta cocida":            "Pasta seca",
    "Garbanzos cocidos":       "Garbanzos secos",
    "Lentejas cocidas":        "Lentejas secas",
    "Alubias cocidas":         "Alubias secas",
    // Nombres alternativos frecuentes
    "Atún al natural":         "Atún al natural (lata)",
    "Atún en lata":            "Atún al natural (lata)",
    "Bacalao fresco":          "Bacalao",
    "Pechuga de pavo cruda":   "Pechuga de pavo",
    "Pechuga de pavo":         "Pechuga de pavo",
    "Muslo de pollo":          "Contramuslo de pollo",
    "Lomo de cerdo":           "Cerdo magro (lomo)",
    "Cerdo magro":             "Cerdo magro (lomo)",
    "Solomillo":               "Solomillo de ternera",
    "Yogur griego":            "Yogur griego 0%",
    "Skyr natural":            "Skyr (yogur islandés, alto proteína)",
    "Skyr":                    "Skyr (yogur islandés, alto proteína)",
    "Proteína whey":           "Proteína whey (concentrada)",
    "Whey aislada":            "Proteína whey (aislada)",
    "Whey isolada":            "Proteína whey (aislada)",
    "Queso fresco batido":     "Queso fresco batido 0%",
    "Whey":                    "Proteína whey",
    "Proteína":                "Proteína whey",
    "Aceite":                  "Aceite de oliva",
    "Chía":                    "Semillas de chía",
    "Lino":                    "Semillas de lino",
    "Crema cacahuete":         "Crema de cacahuete",
  };
  return legacyMap[value] || value;
}

function cloneMeal(meal) {
  return {
    id:    uid(),
    name:  `${meal.name} copia`,
    foods: meal.foods.map((food) => ({ ...food, id: uid() })),
  };
}

function sanitizeState(parsed) {
  const baseMeals = Array.isArray(parsed?.meals) ? parsed.meals : structuredClone(defaultState.meals);
  const meals = normalizeMealNames(
    baseMeals.map((meal, index) => ({
      id:   meal?.id   || uid(),
      name: meal?.name || getDefaultMealName(index),
      foods: Array.isArray(meal?.foods) && meal.foods.length
        ? meal.foods.map((food) => {
            const normalizedName = normalizeFoodName(food?.name || "");
            const preset         = foodLibrary[normalizedName];
            const hadLegacyName  = normalizedName !== (food?.name || "");
            return {
              id:      food?.id      || uid(),
              name:    normalizedName,
              grams:   Number(food?.grams   || 0),
              protein: hadLegacyName && preset ? preset.protein : Number(food?.protein || preset?.protein || 0),
              carbs:   hadLegacyName && preset ? preset.carbs   : Number(food?.carbs   || preset?.carbs   || 0),
              fat:     hadLegacyName && preset ? preset.fat     : Number(food?.fat     || preset?.fat     || 0),
              kcal:    hadLegacyName && preset ? preset.kcal    : Number(food?.kcal    || preset?.kcal    || 0),
            };
          })
        : [createFood()],
    }))
  );
  const templates     = Array.isArray(parsed?.templates)    ? parsed.templates    : [];
  const aiSuggestions = parsed?.aiSuggestions && typeof parsed.aiSuggestions === "object"
    ? parsed.aiSuggestions : {};
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

// ─── REFERENCIAS DOM ───────────────────────────────────────────────────────────

const mealsContainer  = document.getElementById("mealsContainer");
const dailySummary    = document.getElementById("dailySummary");
const mealTemplate    = document.getElementById("mealTemplate");
const foodRowTemplate = document.getElementById("foodRowTemplate");
const foodOptions     = document.getElementById("foodOptions");
const templateSelect  = document.getElementById("templateSelect");
const aiStatusText    = document.getElementById("aiStatusText");
const aiStatusBadge   = document.getElementById("aiStatusBadge");
const aiProviderMeta  = document.getElementById("aiProviderMeta");
const aiSetupHint     = document.getElementById("aiSetupHint");
const heroHighlights  = document.getElementById("heroHighlights");
const aiPanelState    = document.getElementById("aiPanelState");
const rawRuleNotice   = document.getElementById("rawRuleNotice");

// ─── PERSISTENCIA ──────────────────────────────────────────────────────────────

function persistStateOnly() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  scheduleSave();
}

function persistAndRender() {
  persistStateOnly();
  render();
}

// ─── CÁLCULOS ──────────────────────────────────────────────────────────────────

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
}

function calculateFoodTotals(food) {
  const factor = Number(food.grams || 0) / 100;
  return {
    protein: round((food.protein || 0) * factor),
    carbs:   round((food.carbs   || 0) * factor),
    fat:     round((food.fat     || 0) * factor),
    kcal:    round((food.kcal    || 0) * factor),
  };
}

function calculateMealTotals(meal) {
  return meal.foods.reduce(
    (acc, food) => {
      const totals  = calculateFoodTotals(food);
      acc.protein  += totals.protein;
      acc.carbs    += totals.carbs;
      acc.fat      += totals.fat;
      acc.kcal     += totals.kcal;
      acc.items    += 1;
      return acc;
    },
    { protein: 0, carbs: 0, fat: 0, kcal: 0, items: 0 }
  );
}

function calculateDayTotals() {
  return state.meals.reduce(
    (acc, meal) => {
      const totals  = calculateMealTotals(meal);
      acc.protein  += totals.protein;
      acc.carbs    += totals.carbs;
      acc.fat      += totals.fat;
      acc.kcal     += totals.kcal;
      acc.meals    += 1;
      acc.foods    += totals.items;
      return acc;
    },
    { protein: 0, carbs: 0, fat: 0, kcal: 0, meals: 0, foods: 0 }
  );
}

// ─── ESTADO DE IA ──────────────────────────────────────────────────────────────

function setAiAvailability(next) {
  aiAvailability = { ...aiAvailability, ...next };
  aiStatusText.textContent   = aiAvailability.reason;
  aiStatusBadge.textContent  = aiAvailability.mode === "remote" ? "IA + local" : "Motor local";
  aiProviderMeta.textContent = aiAvailability.provider
    ? `Proveedor: ${aiAvailability.provider}`
    : "Proveedor remoto: no configurado";
  aiSetupHint.textContent    = aiAvailability.enabled
    ? "Si la parte remota falla o se invalida por rara, la app cae al motor local más conservador."
    : aiAvailability.setupHint || "Motor local activo. Sugerencias coherentes y estables sin servidor.";
  aiPanelState.innerHTML = `
    <div class="ai-state-strip ${aiAvailability.enabled ? "online" : "offline"}">
      <span class="status-chip ${aiAvailability.enabled ? "" : "offline"}">${aiAvailability.mode === "remote" ? "IA vigilada" : "Motor local estable"}</span>
      <p>${escapeHtml(
        aiAvailability.mode === "remote"
          ? "Primero intentamos sugerencia remota, pero solo se acepta si pasa filtros estrictos. Si no, motor local."
          : "Las alternativas salen del motor local del cliente. Coherentes, en crudo, sin depender de servidor."
      )}</p>
    </div>
  `;
}

async function loadAiAvailability() {
  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 4000);
    const response   = await fetch("/api/ai-status", { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) throw new Error("status unavailable");
    const data = await response.json();
    setAiAvailability({
      enabled:    Boolean(data.enabled),
      provider:   data.provider   || null,
      providerKey: data.providerKey || null,
      model:      data.model      || null,
      mode:       data.mode       || (data.provider ? "remote" : "local"),
      setupHint:  data.setupHint  || "",
      reason:     data.reason     || "Sugerencias disponibles con validación estricta.",
    });
  } catch {
    setAiAvailability({
      enabled:    true,
      provider:   null,
      providerKey: null,
      model:      null,
      mode:       "local",
      setupHint:  "Motor local del cliente activo. Sugerencias coherentes sin servidor.",
      reason:     "Motor local activo. Las sugerencias se generan directamente en el navegador.",
    });
  }
  render();
}

// ─── AUTOCOMPLETE DE ALIMENTOS ────────────────────────────────────────────────
// Dropdown flotante con búsqueda en tiempo real, highlight del texto coincidente,
// navegación por teclado y clic para seleccionar. Se cierra al scrollar o redimensionar.

function setupFoodAutocomplete(input, food, meal, refs) {
  input.removeAttribute("list");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("spellcheck", "false");

  let dropdown = null;
  let activeIdx = -1;

  function getMatches(q) {
    const query = q.trim().toLowerCase();
    if (query.length < 1) return [];
    return Object.entries(foodLibrary)
      .filter(([name]) => name.toLowerCase().includes(query))
      .sort((a, b) => {
        const an = a[0].toLowerCase(), bn = b[0].toLowerCase();
        // Exact match first, then starts-with, then alphabetical
        if (an === query)  return -1;
        if (bn === query)  return  1;
        const as = an.startsWith(query) ? 0 : 1;
        const bs = bn.startsWith(query) ? 0 : 1;
        return as !== bs ? as - bs : an.localeCompare(bn, "es");
      })
      .slice(0, 10);
  }

  function markMatch(text, query) {
    const q = query.trim().toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx < 0 || !q) return escapeHtml(text);
    return (
      escapeHtml(text.slice(0, idx)) +
      `<strong class="dd-match">${escapeHtml(text.slice(idx, idx + q.length))}</strong>` +
      escapeHtml(text.slice(idx + q.length))
    );
  }

  function position() {
    if (!dropdown) return;
    const r = input.getBoundingClientRect();
    dropdown.style.top   = `${r.bottom + window.scrollY + 4}px`;
    dropdown.style.left  = `${r.left   + window.scrollX}px`;
    dropdown.style.width = `${Math.max(r.width, 260)}px`;
  }

  function closeDropdown() {
    window.removeEventListener("scroll", closeDropdown, true);
    window.removeEventListener("resize", closeDropdown);
    if (dropdown) { dropdown.remove(); dropdown = null; }
    activeIdx = -1;
  }

  function openDropdown(matches) {
    closeDropdown();
    if (!matches.length) return;

    dropdown = document.createElement("div");
    dropdown.className = "food-dropdown";
    dropdown.setAttribute("role", "listbox");
    dropdown.innerHTML = matches.map(([name, m], i) => {
      const tag = isHealthyFat(name) ? '<span class="health-tag good">saludable</span>'
                : isIndulgent(name)  ? '<span class="health-tag soft">ocasional</span>'
                : "";
      return `
      <div class="food-dd-item" role="option" data-name="${escapeHtml(name)}" data-idx="${i}">
        <span class="fdi-name">${markMatch(name, input.value)}${tag}</span>
        <span class="fdi-chips">
          <span class="sug-m p">P${m.protein}</span>
          <span class="sug-m c">HC${m.carbs}</span>
          <span class="sug-m f">G${m.fat}</span>
          <span class="sug-m k">${m.kcal}kcal</span>
        </span>
      </div>`;
    }).join("");

    dropdown.addEventListener("mousedown", (e) => {
      const item = e.target.closest(".food-dd-item");
      if (item) { e.preventDefault(); applyFood(item.dataset.name); }
    });

    document.body.appendChild(dropdown);
    position();

    window.addEventListener("scroll", closeDropdown, { capture: true, once: true });
    window.addEventListener("resize", closeDropdown, { once: true });
  }

  function setActive(idx) {
    if (!dropdown) return;
    const items = dropdown.querySelectorAll(".food-dd-item");
    items.forEach((el, i) => el.classList.toggle("active", i === idx));
    if (idx >= 0 && items[idx]) items[idx].scrollIntoView({ block: "nearest" });
    activeIdx = idx;
  }

  function applyFood(name) {
    const normalized = normalizeFoodName(name);
    food.name    = normalized;
    input.value  = normalized;
    const preset = foodLibrary[normalized];
    if (preset) {
      food.protein = preset.protein; food.carbs = preset.carbs;
      food.fat     = preset.fat;     food.kcal  = preset.kcal;
      if (refs) {
        refs.protein.value = preset.protein; refs.carbs.value = preset.carbs;
        refs.fat.value     = preset.fat;     refs.kcal.value  = preset.kcal;
        updateFoodTotal(refs.total, food);
        if (refs.meta) updateMealUi(meal, refs.meta, refs.summary, refs.spotlight, refs.kcalValue, refs.macroBars);
        renderSummary();
      }
    }
    closeDropdown();
    clearSuggestionsForMeal(meal.id);
    persistStateOnly();
  }

  input.addEventListener("input",  () => openDropdown(getMatches(input.value)));
  input.addEventListener("focus",  () => { if (input.value) openDropdown(getMatches(input.value)); });
  input.addEventListener("blur",   () => {
    setTimeout(() => {
      const q        = input.value.trim();
      const resolved = normalizeFoodName(q);
      const preset   = foodLibrary[resolved];
      if (preset && food.name !== resolved) applyFood(resolved);
      else { food.name = q || food.name; persistStateOnly(); }
      closeDropdown();
    }, 200);
  });

  input.addEventListener("keydown", (e) => {
    if (!dropdown) return;
    const items = dropdown.querySelectorAll(".food-dd-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIdx + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIdx - 1, 0));
    } else if ((e.key === "Enter") && activeIdx >= 0 && items[activeIdx]) {
      e.preventDefault();
      applyFood(items[activeIdx].dataset.name);
    } else if (e.key === "Escape") {
      closeDropdown();
    }
  });
}

// ─── RENDER ────────────────────────────────────────────────────────────────────

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
  const cards  = [
    ["💪", "Proteína", `${round(totals.protein)} g`, `${totals.meals} comidas activas`, "protein"],
    ["🍚", "Hidratos", `${round(totals.carbs)} g`,   `${totals.foods} alimentos en total`, "carbs"],
    ["🥑", "Grasas",   `${round(totals.fat)} g`,     "Balance del día", "fat"],
    ["🔥", "Kcal",     `${round(totals.kcal)}`,      "Suma actual", "kcal"],
  ];
  dailySummary.innerHTML = cards
    .map(([icon, label, value, subtext, tone]) => `
      <article class="summary-card ${tone}">
        <span class="summary-label">${icon} ${label}</span>
        <strong>${value}</strong>
        <div class="summary-subtext">${subtext}</div>
      </article>
    `)
    .join("");

  heroHighlights.innerHTML = [
    [`${totals.meals}`,  "bloques editables"],
    [`${totals.foods}`,  "alimentos en crudo hoy"],
    [aiAvailability.mode === "remote" ? "IA vigilada" : "Motor local", aiAvailability.mode === "remote" ? "con filtros duros" : "alternativas estables"],
  ]
    .map(([value, label]) => `
      <div class="hero-highlight-card">
        <strong>${escapeHtml(value)}</strong>
        <span>${escapeHtml(label)}</span>
      </div>
    `)
    .join("");

  if (rawRuleNotice) rawRuleNotice.textContent = RAW_GUIDANCE;
}

function renderMeals() {
  mealsContainer.innerHTML = "";
  state.meals.forEach((meal, index) => {
    const fragment       = mealTemplate.content.cloneNode(true);
    const titleInput     = fragment.querySelector(".meal-title");
    const mealIndexBadge = fragment.querySelector(".meal-index-badge");
    const meta           = fragment.querySelector(".meal-meta");
    const tbody          = fragment.querySelector(".foods-body");
    const summary        = fragment.querySelector(".meal-summary");
    const spotlight      = fragment.querySelector(".meal-spotlight");
    const kcalValue      = fragment.querySelector(".meal-kcal-value");
    const macroBars      = fragment.querySelector(".meal-macro-bars");
    const aiBox          = fragment.querySelector(".meal-ai-box");
    const aiStatus       = fragment.querySelector(".meal-ai-status");
    const aiStage        = fragment.querySelector(".meal-ai-stage");
    const aiResults      = fragment.querySelector(".meal-ai-results");
    const suggestButton  = fragment.querySelector(".suggest-meal-btn");

    // Tag the card with the meal ID so event delegation can find it
    fragment.querySelector(".meal-card").dataset.mealId = meal.id;

    mealIndexBadge.textContent  = getDefaultMealName(index);
    titleInput.value             = meal.name;
    titleInput.placeholder       = `Comida ${index + 1}`;
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

    // El botón siempre está activo — el motor local garantiza sugerencias
    suggestButton.disabled = false;
    suggestButton.title    = aiAvailability.mode === "remote"
      ? "Pide alternativas filtradas; si no pasan validación, usa motor local"
      : "Genera alternativas con el motor local del navegador";
    suggestButton.addEventListener("click", async () => {
      await requestMealSuggestions(meal.id, suggestButton, aiStatus, aiResults, aiBox);
    });

    meal.foods.forEach((food) => {
      const rowFragment = foodRowTemplate.content.cloneNode(true);
      const row         = rowFragment.querySelector("tr");
      const bindings    = {
        name:    row.querySelector(".food-name"),
        grams:   row.querySelector(".grams"),
        protein: row.querySelector(".protein100"),
        carbs:   row.querySelector(".carbs100"),
        fat:     row.querySelector(".fat100"),
        kcal:    row.querySelector(".kcal100"),
        total:   row.querySelector(".food-total"),
      };

      bindings.name.value    = food.name;
      bindings.grams.value   = food.grams;
      bindings.protein.value = food.protein;
      bindings.carbs.value   = food.carbs;
      bindings.fat.value     = food.fat;
      bindings.kcal.value    = food.kcal;

      // Custom autocomplete replaces native datalist change handler
      setupFoodAutocomplete(bindings.name, food, meal, {
        ...bindings,
        meta: meta, summary: summary, spotlight: spotlight,
        kcalValue: kcalValue, macroBars: macroBars,
      });

      [
        [bindings.grams,   "grams"],
        [bindings.protein, "protein"],
        [bindings.carbs,   "carbs"],
        [bindings.fat,     "fat"],
        [bindings.kcal,    "kcal"],
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
  const totals      = calculateMealTotals(meal);
  const totalMacros = Math.max(totals.protein + totals.carbs + totals.fat, 1);
  meta.textContent  = `${totals.items} alimentos · ${round(totals.kcal)} kcal · pesos en crudo`;
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
      ["Hidratos", totals.carbs,   "carbs"],
      ["Grasas",   totals.fat,     "fat"],
    ]
      .map(([label, value, tone]) => `
        <div class="macro-bar ${tone}">
          <div class="macro-bar-top">
            <span>${label}</span>
            <strong>${round(value)} g</strong>
          </div>
          <div class="macro-bar-track"><span style="width:${Math.max(10, Math.min(100, (value / totalMacros) * 100))}%"></span></div>
        </div>
      `)
      .join("");
  }
}

function renderMealSuggestions(mealId, aiBox, aiStatus, aiStage, aiResults) {
  const entry = state.aiSuggestions[mealId];
  if (!entry) {
    aiBox.classList.add("hidden");
    aiStatus.textContent = "";
    aiStage.innerHTML    = "";
    aiResults.innerHTML  = "";
    return;
  }

  aiBox.classList.remove("hidden");
  aiStatus.textContent = entry.note || "";
  aiStage.innerHTML    = buildAiStage(entry);

  if (entry.type === "columns") {
    renderMealSuggestionsColumns(entry, aiResults);
    return;
  }

  // Legacy format: full meal alternatives (from server)
  const banner = entry.banner
    ? `
      <div class="ai-info-banner ${escapeHtml(entry.banner.tone || "info")}">
        <strong>${escapeHtml(entry.banner.title || "")}</strong>
        ${entry.banner.body ? `<p>${escapeHtml(entry.banner.body)}</p>` : ""}
      </div>
    `
    : "";

  const cards = (entry.suggestions || [])
    .map((suggestion) => `
      <article class="ai-suggestion-card">
        <div class="ai-suggestion-topline">
          <span class="ai-suggestion-badge">${escapeHtml(suggestion.fitLabel || "IA")}</span>
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
    `)
    .join("");

  aiResults.innerHTML = banner + (cards || `
    <article class="ai-suggestion-card">
      <h3>Sin propuestas para esta comida</h3>
      <p>Añade al menos una proteína o hidrato principal en crudo para obtener sugerencias útiles.</p>
    </article>
  `);
}

function renderMealSuggestionsColumns(entry, aiResults) {
  const { columns } = entry;

  if (!columns || !columns.length) {
    aiResults.innerHTML = `
      <div class="sug-empty">
        <p>Añade al menos una proteína, un hidrato o una grasa en crudo para ver alternativas.</p>
      </div>`;
    return;
  }

  aiResults.innerHTML = `
    <div class="sug-columns">
      ${columns.map(col => `
        <div class="sug-col" data-group="${escapeHtml(col.group)}">
          <div class="sug-col-header">
            <span class="sug-col-label ${escapeHtml(col.color)}">${escapeHtml(col.label)}</span>
            <span class="sug-col-base">
              Cambia <strong>${escapeHtml(col.originalFood.name)}</strong>
              ${round(col.originalFood.grams)}g · ${round(col.originalFood.totalKcal)} kcal
            </span>
          </div>
          <div class="sug-items">
            ${col.alternatives.map(alt => {
              const tag = isHealthyFat(alt.name) ? '<span class="health-tag good">saludable</span>' : "";
              return `
              <button class="sug-item"
                data-food-id="${escapeHtml(col.originalFoodId)}"
                data-alt-name="${escapeHtml(alt.name)}"
                data-alt-grams="${alt.grams}"
                data-alt-protein="${alt.per100.protein}"
                data-alt-carbs="${alt.per100.carbs}"
                data-alt-fat="${alt.per100.fat}"
                data-alt-kcal="${alt.per100.kcal}"
                title="Aplicar: sustituye ${escapeHtml(col.originalFood.name)} por ${escapeHtml(alt.name)}">
                <div class="sug-item-top">
                  <span class="sug-item-name">${escapeHtml(alt.name)}${tag}</span>
                  <span class="sug-item-grams">${alt.grams}g</span>
                </div>
                <div class="sug-item-macros">
                  <span class="sug-m p">P${alt.protein}</span>
                  <span class="sug-m c">HC${alt.carbs}</span>
                  <span class="sug-m f">G${alt.fat}</span>
                  <span class="sug-m k">${alt.kcal}kcal</span>
                </div>
              </button>`;
            }).join("")}
          </div>
        </div>
      `).join("")}
    </div>`;
}

function buildAiStage(entry) {
  const tone  = entry.banner?.tone || "info";
  const stamp = entry.generatedAt
    ? new Date(entry.generatedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    : "ahora";
  return `
    <div class="ai-stage-card ${escapeHtml(tone)}">
      <span class="ai-stage-dot"></span>
      <div>
        <strong>${escapeHtml(entry.banner?.title || "Alternativas listas")}</strong>
        <p>${escapeHtml(entry.banner?.body || "Generadas para esta comida.")}</p>
      </div>
      <span class="ai-stage-time">${escapeHtml(stamp)}</span>
    </div>
  `;
}

// ─── SUGERENCIAS ───────────────────────────────────────────────────────────────

async function requestMealSuggestions(mealId, button, statusNode, resultsNode, boxNode) {
  const meal = state.meals.find((item) => item.id === mealId);
  if (!meal) return;

  // Estado de carga
  state.aiSuggestions[mealId] = {
    generatedAt: new Date().toISOString(),
    note:   "Buscando alternativas en crudo para esta comida...",
    banner: { tone: "info", title: "Preparando alternativas", body: "Buscando versiones similares con macros parecidas." },
    suggestions: [],
  };
  render();
  button.disabled        = true;
  statusNode.textContent = "Generando alternativas...";
  resultsNode.innerHTML  = `
    <article class="ai-suggestion-card skeleton-card">
      <div class="skeleton-line short"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </article>`;
  boxNode.classList.remove("hidden");

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 12000);

    const response = await fetch("/api/suggest-meal-alternatives", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ meal, library: foodLibrary }),
      signal:  controller.signal,
    });
    clearTimeout(timeout);

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw payload;

    state.aiSuggestions[mealId] = {
      generatedAt: new Date().toISOString(),
      note:        payload.note || "Sugerencias con validación estricta aplicada.",
      banner:      payload.banner || { tone: payload.fallbackUsed ? "warning" : "success", title: "Alternativas listas" },
      suggestions: Array.isArray(payload.suggestions)
        ? payload.suggestions.map((s) => ({ ...s, fitLabel: payload.fallbackUsed ? "Plan B" : "IA" }))
        : [],
    };

    // Si el servidor devolvió sugerencias vacías, completar con motor local (columnas)
    if (!state.aiSuggestions[mealId].suggestions.length) {
      const colData = buildColumnSuggestions(meal);
      state.aiSuggestions[mealId] = {
        ...state.aiSuggestions[mealId],
        ...colData,
        banner: {
          tone:  "warning",
          title: "Motor local activado",
          body:  "La respuesta del servidor estaba vacía. Alternativas por columna generadas en local.",
        },
      };
    }

    persistAndRender();
  } catch (error) {
    // Determinar si el servidor devolvió sugerencias de respaldo estructuradas
    const serverFallback = Array.isArray(error?.fallbackSuggestions) && error.fallbackSuggestions.length > 0;
    const isNetworkError = error instanceof TypeError || error?.name === "AbortError";
    const isRateLimit    = error?.status === 429;

    let bannerTitle = "Motor local activo";
    let bannerBody  = "Alternativas por columna generadas en el navegador. En crudo.";
    let bannerTone  = "warning";

    if (isNetworkError) {
      bannerTitle = "Sin conexión con el servidor";
      bannerBody  = "No se ha podido contactar con el servidor de IA. Alternativas locales por columna.";
    } else if (isRateLimit) {
      bannerTitle = "IA saturada — motor local";
      bannerBody  = "Los modelos gratuitos están al límite. Alternativas locales en crudo.";
    } else if (serverFallback) {
      bannerTitle = error?.banner?.title || "Plan B del servidor";
      bannerBody  = error?.banner?.body  || "Alternativas de respaldo en crudo.";
    }

    const colData = buildColumnSuggestions(meal);
    state.aiSuggestions[mealId] = {
      generatedAt: new Date().toISOString(),
      note:        serverFallback ? (error?.humanMessage || "") : "Alternativas en columna generadas en el navegador.",
      banner:      { tone: bannerTone, title: bannerTitle, body: bannerBody },
      ...colData,
    };
    persistAndRender();
  } finally {
    button.disabled = false;
  }
}

// ─── PDF: ANÁLISIS DE DIETA ───────────────────────────────────────────────────
// Flujo: extraer texto con pdf.js → enviar al servidor (IA) → parsear JSON
// Si el servidor falla → intentar parseo local básico con regex

async function extractPdfText(file) {
  const pdfjsLib = window["pdfjs-dist/build/pdf"];
  if (!pdfjsLib) throw new Error("pdf.js no cargado. Asegúrate de tener conexión.");

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.3.136/build/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => item.str).join(" "));
  }
  return pageTexts.join("\n");
}

async function parseDietViaServer(text) {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch("/api/analyze-diet", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text }),
      signal:  controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Server ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function parseDietLocally(text) {
  // Basic regex parser — handles common Spanish diet PDF formats
  const mealKeywords = /(?:desayuno|almuerzo|comida|merienda|cena|snack|toma\s*\d*|comida\s*\d+)/gi;
  const gramPattern  = /([^\n,·•\-–]{3,60}?)\s+(\d{1,4})\s*(?:g|gr|gramos?)\b/gi;

  const segments = text.split(mealKeywords);
  const mealNames = [...text.matchAll(mealKeywords)].map((m) => m[0].trim());

  const meals = [];
  segments.forEach((segment, i) => {
    const foods = [];
    let m;
    gramPattern.lastIndex = 0;
    while ((m = gramPattern.exec(segment)) !== null) {
      const name  = m[1].trim().replace(/^[-·•\s]+/, "");
      const grams = parseInt(m[2], 10);
      if (name.length >= 2 && grams > 0 && grams <= 2000) {
        const normalized = normalizeFoodName(name);
        const preset     = foodLibrary[normalized] || {};
        foods.push({
          id:      uid(),
          name:    normalized || name,
          grams,
          protein: preset.protein || 0,
          carbs:   preset.carbs   || 0,
          fat:     preset.fat     || 0,
          kcal:    preset.kcal    || 0,
        });
      }
    }
    if (foods.length) {
      meals.push({
        id:    uid(),
        name:  mealNames[i - 1] || `Comida ${meals.length + 1}`,
        foods,
      });
    }
  });

  // If no meal structure detected, collect all food+gram pairs into one meal
  if (!meals.length) {
    const foods = [];
    let m2;
    gramPattern.lastIndex = 0;
    while ((m2 = gramPattern.exec(text)) !== null) {
      const name  = m2[1].trim().replace(/^[-·•\s]+/, "");
      const grams = parseInt(m2[2], 10);
      if (name.length >= 2 && grams > 0 && grams <= 2000) {
        const normalized = normalizeFoodName(name);
        const preset     = foodLibrary[normalized] || {};
        foods.push({
          id: uid(), name: normalized || name, grams,
          protein: preset.protein || 0, carbs: preset.carbs || 0,
          fat: preset.fat || 0,         kcal:  preset.kcal  || 0,
        });
      }
    }
    if (foods.length) meals.push({ id: uid(), name: "Comida 1 (importada)", foods });
  }

  return meals;
}

function buildAnalysisColumnsForMeal(meal) {
  return buildColumnSuggestions(meal);
}

function renderPdfAnalysis(meals) {
  const panel    = document.getElementById("pdfAnalysisPanel");
  const totalsEl = document.getElementById("paTotals");
  const mealsEl  = document.getElementById("paMeals");
  const subtitle = document.getElementById("paSubtitle");
  if (!panel || !totalsEl || !mealsEl) return;

  // Totales del día
  const dayTotals = meals.reduce((acc, m) => {
    m.foods.forEach((f) => {
      const factor = (f.grams || 0) / 100;
      acc.kcal    += (f.kcal    || 0) * factor;
      acc.protein += (f.protein || 0) * factor;
      acc.carbs   += (f.carbs   || 0) * factor;
      acc.fat     += (f.fat     || 0) * factor;
    });
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  totalsEl.innerHTML = [
    ["🔥", "Total día", `${round(dayTotals.kcal)} kcal`, "kcal"],
    ["💪", "Proteína",  `${round(dayTotals.protein)} g`, "protein"],
    ["🍚", "Hidratos",  `${round(dayTotals.carbs)} g`,   "carbs"],
    ["🥑", "Grasas",    `${round(dayTotals.fat)} g`,     "fat"],
  ].map(([icon, label, value, tone]) => `
    <div class="pa-total-card ${tone}">
      <span class="pa-total-label">${icon} ${escapeHtml(label)}</span>
      <strong class="pa-total-value">${escapeHtml(value)}</strong>
    </div>
  `).join("");

  if (subtitle) {
    subtitle.textContent = `Detectadas ${meals.length} comida(s) y ${meals.reduce((a, m) => a + m.foods.length, 0)} alimentos. Las alternativas saludables se generan en local respetando la regla del crudo.`;
  }

  mealsEl.innerHTML = meals.map((meal, i) => {
    const totals = meal.foods.reduce((acc, f) => {
      const factor = (f.grams || 0) / 100;
      acc.kcal    += (f.kcal    || 0) * factor;
      acc.protein += (f.protein || 0) * factor;
      acc.carbs   += (f.carbs   || 0) * factor;
      acc.fat     += (f.fat     || 0) * factor;
      return acc;
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

    const colData = buildAnalysisColumnsForMeal(meal);
    const cols    = colData.columns || [];

    const colsHtml = cols.length ? `
      <div class="sug-columns pa-meal-cols">
        ${cols.map(col => `
          <div class="sug-col" data-group="${escapeHtml(col.group)}">
            <div class="sug-col-header">
              <span class="sug-col-label ${escapeHtml(col.color)}">${escapeHtml(col.label)}</span>
              <span class="sug-col-base">Cambia <strong>${escapeHtml(col.originalFood.name)}</strong> ${round(col.originalFood.grams)}g</span>
            </div>
            <div class="sug-items">
              ${col.alternatives.map(alt => {
                const tag = isHealthyFat(alt.name) ? '<span class="health-tag good">saludable</span>' : "";
                return `
                <div class="sug-item pa-readonly" title="Alternativa similar">
                  <div class="sug-item-top">
                    <span class="sug-item-name">${escapeHtml(alt.name)}${tag}</span>
                    <span class="sug-item-grams">${alt.grams}g</span>
                  </div>
                  <div class="sug-item-macros">
                    <span class="sug-m p">P${alt.protein}</span>
                    <span class="sug-m c">HC${alt.carbs}</span>
                    <span class="sug-m f">G${alt.fat}</span>
                    <span class="sug-m k">${alt.kcal}kcal</span>
                  </div>
                </div>`;
              }).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    ` : `<p class="pa-no-cols">No se detectaron grupos claros para sugerir alternativas en esta comida.</p>`;

    return `
      <article class="pa-meal-card">
        <header class="pa-meal-header">
          <div class="pa-meal-name">
            <span class="meal-index-badge">${escapeHtml(`Comida ${i + 1}`)}</span>
            <strong>${escapeHtml(meal.name || `Comida ${i + 1}`)}</strong>
          </div>
          <div class="pa-meal-stats">
            <span class="pa-stat kcal">${round(totals.kcal)} kcal</span>
            <span class="pa-stat protein">P ${round(totals.protein)}g</span>
            <span class="pa-stat carbs">HC ${round(totals.carbs)}g</span>
            <span class="pa-stat fat">G ${round(totals.fat)}g</span>
          </div>
        </header>
        <div class="pa-meal-foods">
          ${meal.foods.map((f) => `
            <span class="pa-food-pill">
              <strong>${escapeHtml(f.name)}</strong>
              <span>${round(f.grams)}g</span>
            </span>
          `).join("")}
        </div>
        <p class="pa-meal-cols-intro">Alternativas similares para esta comida:</p>
        ${colsHtml}
      </article>`;
  }).join("");

  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closePdfAnalysis() {
  const panel = document.getElementById("pdfAnalysisPanel");
  if (panel) panel.hidden = true;
  window._pdfParsedMeals = null;
}

async function handlePdfUpload(file) {
  const statusEl = document.getElementById("pdfStatus");
  const importEl = document.getElementById("pdfImportBtn");
  let parsedMeals = null;

  function setStatus(msg, tone = "info") {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className   = `pdf-status ${tone}`;
    statusEl.style.display = "block";
  }

  try {
    setStatus("Extrayendo texto del PDF…");
    const text = await extractPdfText(file);
    if (!text || text.trim().length < 20) {
      setStatus("El PDF no contiene texto legible (puede ser imagen escaneada).", "error");
      return;
    }

    setStatus("Analizando estructura de la dieta…");
    let meals;
    try {
      const serverResult = await parseDietViaServer(text);
      meals = Array.isArray(serverResult.meals) ? serverResult.meals : null;
    } catch {
      // Server unavailable — use local parser
      meals = null;
    }

    if (!meals || !meals.length) {
      setStatus("Servidor no disponible. Usando parser local (resultados aproximados)…", "warning");
      meals = parseDietLocally(text);
    }

    if (!meals || !meals.length) {
      setStatus("No se detectaron comidas en el PDF. Prueba con un formato más claro.", "error");
      return;
    }

    // Sanitize each meal to match app structure
    const sanitized = meals.map((meal, i) => ({
      id:    meal.id    || uid(),
      name:  meal.name  || `Comida ${i + 1}`,
      foods: (Array.isArray(meal.foods) ? meal.foods : []).map((f) => {
        const normalized = normalizeFoodName(f.name || "");
        const preset     = foodLibrary[normalized] || {};
        return {
          id:      f.id      || uid(),
          name:    normalized || f.name || "Alimento",
          grams:   Number(f.grams   || 0),
          protein: Number(f.protein ?? preset.protein ?? 0),
          carbs:   Number(f.carbs   ?? preset.carbs   ?? 0),
          fat:     Number(f.fat     ?? preset.fat     ?? 0),
          kcal:    Number(f.kcal    ?? preset.kcal    ?? 0),
        };
      }).filter((f) => f.name && f.grams > 0),
    })).filter((m) => m.foods.length > 0);

    if (!sanitized.length) {
      setStatus("Se analizó el PDF pero no se encontraron alimentos con gramos reconocibles.", "error");
      return;
    }

    // Compute totals for analysis preview
    const totals = sanitized.reduce((acc, m) => {
      m.foods.forEach((f) => {
        const factor = (f.grams || 0) / 100;
        acc.kcal    += (f.kcal    || 0) * factor;
        acc.protein += (f.protein || 0) * factor;
        acc.carbs   += (f.carbs   || 0) * factor;
        acc.fat     += (f.fat     || 0) * factor;
      });
      return acc;
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

    // Guardar para importación opcional posterior
    window._pdfParsedMeals = sanitized;
    const totalFoods = sanitized.reduce((a, m) => a + m.foods.length, 0);
    setStatus(
      `Análisis completado. ${sanitized.length} comida(s), ${totalFoods} alimento(s). Mira el panel de análisis abajo.`,
      "success"
    );
    // Mostrar panel de análisis (NO se importa todavía)
    renderPdfAnalysis(sanitized);
    // Ocultar botón inline antiguo: ahora la importación está en el panel
    if (importEl) importEl.style.display = "none";
  } catch (err) {
    setStatus(`Error: ${err.message || "No se pudo procesar el PDF."}`, "error");
  }
}

// ─── EXPORTAR / IMPORTAR ───────────────────────────────────────────────────────

function buildDaySummaryText() {
  const totals = calculateDayTotals();
  const lines  = [
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
  const blob   = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url    = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href  = url;
  anchor.download = `macros-flex-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importState(file) {
  const text   = await file.text();
  const parsed = sanitizeState(JSON.parse(text));
  state        = parsed;
  persistAndRender();
}

// ─── UTILIDADES ────────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&",  "&amp;")
    .replaceAll("<",  "&lt;")
    .replaceAll(">",  "&gt;")
    .replaceAll('"',  "&quot;")
    .replaceAll("'",  "&#39;");
}

function render() {
  renderFoodOptions();
  renderTemplateOptions();
  renderSummary();
  renderMeals();
}

// ─── EVENTOS GLOBALES ──────────────────────────────────────────────────────────

// Delegation: apply a suggestion column alternative to the meal
mealsContainer.addEventListener("click", (e) => {
  const btn = e.target.closest(".sug-item");
  if (!btn) return;

  const mealCard = btn.closest("[data-meal-id]");
  if (!mealCard) return;

  const mealId = mealCard.dataset.mealId;
  const foodId = btn.dataset.foodId;
  const meal   = state.meals.find((m) => m.id === mealId);
  if (!meal) return;

  const food = meal.foods.find((f) => f.id === foodId);
  if (!food) return;

  food.name    = btn.dataset.altName;
  food.grams   = Number(btn.dataset.altGrams)   || food.grams;
  food.protein = Number(btn.dataset.altProtein) || 0;
  food.carbs   = Number(btn.dataset.altCarbs)   || 0;
  food.fat     = Number(btn.dataset.altFat)     || 0;
  food.kcal    = Number(btn.dataset.altKcal)    || 0;

  clearSuggestionsForMeal(mealId);
  persistAndRender();
});

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
  const choice    = prompt(`¿Qué comida quieres guardar como plantilla?\n${mealNames}\n\nEscribe el número.`);
  const index     = Number(choice) - 1;
  if (!Number.isInteger(index) || !state.meals[index]) return;
  const name = prompt("Nombre para la plantilla", state.meals[index].name);
  if (!name) return;
  state.templates.push({
    id:   uid(),
    name,
    meal: {
      ...state.meals[index],
      id:    uid(),
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

// PDF upload
const pdfInput = document.getElementById("pdfInput");
if (pdfInput) {
  pdfInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file || file.type !== "application/pdf") return;
    await handlePdfUpload(file);
    event.target.value = "";
  });
}

const pdfDropZone = document.getElementById("pdfDropZone");
if (pdfDropZone) {
  pdfDropZone.addEventListener("dragover", (e) => { e.preventDefault(); pdfDropZone.classList.add("drag-over"); });
  pdfDropZone.addEventListener("dragleave", () => pdfDropZone.classList.remove("drag-over"));
  pdfDropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    pdfDropZone.classList.remove("drag-over");
    const file = [...(e.dataTransfer.files || [])].find((f) => f.type === "application/pdf");
    if (file) await handlePdfUpload(file);
  });
}

// Botón de importar dentro del panel de análisis
const paImportBtn = document.getElementById("paImportBtn");
if (paImportBtn) {
  paImportBtn.addEventListener("click", () => {
    const meals = window._pdfParsedMeals;
    if (!meals || !meals.length) return;
    state.meals.push(...meals);

    // Auto-generar alternativas para cada comida importada (mismo flujo)
    meals.forEach((m) => {
      const colData = buildColumnSuggestions(m);
      if (colData.columns && colData.columns.length) {
        state.aiSuggestions[m.id] = {
          generatedAt: new Date().toISOString(),
          note:        "Alternativas saludables generadas al importar desde PDF.",
          banner:      { tone: "info", title: "Alternativas listas",
                         body: "Sugerencias coherentes por familias de alimentos. Filtradas para evitar opciones poco saludables." },
          ...colData,
        };
      }
    });

    closePdfAnalysis();
    const statusEl = document.getElementById("pdfStatus");
    if (statusEl) statusEl.style.display = "none";
    persistAndRender();
    alert(`${meals.length} comida(s) importada(s) con alternativas. Revisa los gramos en crudo.`);
  });
}

const paCloseBtn = document.getElementById("paCloseBtn");
if (paCloseBtn) {
  paCloseBtn.addEventListener("click", () => {
    closePdfAnalysis();
    const statusEl = document.getElementById("pdfStatus");
    if (statusEl) statusEl.style.display = "none";
  });
}

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

// ─── ARRANQUE ──────────────────────────────────────────────────────────────────

(async () => {
  state = await loadState();
  persistStateOnly();
  await loadAiAvailability();
  render();
})();
