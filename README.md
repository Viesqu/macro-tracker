# Macros Flex

App web para registrar comidas dinámicas, ver macros diarios y, opcionalmente, pedir alternativas parecidas con IA.

## Regla principal

**Todos los alimentos se tratan siempre en crudo**, salvo productos que no requieren cocción y se consumen tal cual, por ejemplo:

- yogur
- pan
- tortillas ya hechas
- aceite
- proteína whey

La app ya deja esta regla clara en la UI, en el resumen copiable, en la base de alimentos y en las sugerencias IA / Plan B.

## Qué hace ahora

- Añadir tantas comidas como quieras.
- Añadir alimentos por comida.
- Editar gramos y macros por 100 g.
- Ver proteínas, hidratos, grasas y kcal por alimento, por comida y total diario.
- Duplicar comidas.
- Guardar una comida como plantilla y reutilizarla luego.
- Copiar un resumen del día indicando que todo va en crudo.
- Exportar e importar el estado en JSON.
- Guardado automático en `localStorage` del navegador.
- Sincronización opcional con Supabase si rellenas `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `app.js`.
- Sugerencias opcionales con IA y fallback local coherente con pesos en crudo.

## Base de alimentos

Se ha limpiado la ambigüedad de varios alimentos que antes estaban en cocido.

Ejemplos ajustados:

- `Arroz cocido` → `Arroz`
- `Patata cocida` → `Patata`
- `Pasta cocida` → `Pasta seca`
- `Garbanzos cocidos` → `Garbanzos secos`
- `Lentejas cocidas` → `Lentejas secas`
- `Atún al natural` → `Atún fresco`

Además, la biblioteca ahora incluye más opciones útiles reales, por ejemplo:

- arroz basmati, arroz jazmín, pasta seca
- tortitas de arroz, tortilla de trigo
- merluza, bacalao, gambas
- tempeh, seitán, edamame
- skyr, requesón, leche semidesnatada
- alubias secas, nueces, crema de cacahuete, chía
- proteína whey, chocolate negro 85%

## IA, cómo funciona

La función de IA está pensada para ser limpia y segura:

- Si **no** hay clave configurada, la app **no se rompe**.
- Verás la UI de IA marcada como opcional y el botón de sugerencias quedará desactivado.
- Si hay clave, cada comida tiene un botón para pedir alternativas parecidas.
- El prompt obliga a mantener la regla de pesos en crudo.
- Si falla la IA externa, el servidor genera un **Plan B local** con alternativas razonables y también en crudo.

### Activar IA en local o en servidor

Ruta por defecto, OpenRouter:

```bash
OPENROUTER_API_KEY=tu_clave npm run dev
```

Opcionalmente puedes fijar un solo modelo:

```bash
OPENROUTER_API_KEY=tu_clave OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free npm run dev
```

O definir una cadena de fallback explícita:

```bash
OPENROUTER_API_KEY=tu_clave OPENROUTER_MODELS=meta-llama/llama-3.3-70b-instruct:free,deepseek/deepseek-chat-v3-0324:free,qwen/qwen-2.5-72b-instruct:free,google/gemma-3-27b-it:free npm run dev
```

Si prefieres OpenAI:

```bash
AI_PROVIDER=openai OPENAI_API_KEY=tu_clave OPENAI_MODEL=gpt-4.1-mini npm run dev
```

La clave se usa solo en el servidor (`server.js`). No se expone en el navegador.

## Cómo arrancarla en local

```bash
npm install
npm run dev
```

Luego abre:

```text
http://localhost:4321
```

## Cómo probar la IA

1. Arranca con `OPENROUTER_API_KEY` configurada, o con `AI_PROVIDER=openai` si prefieres OpenAI.
2. Abre una comida con alimentos reales y cantidades.
3. Pulsa `✨ Ver alternativas en crudo`.
4. Deberían aparecer propuestas con:
   - nombre de la propuesta
   - breve motivo
   - lista de alimentos y gramos en crudo
   - macros y kcal aproximadas

## Despliegue

Basta con un **redeploy simple** del servicio actual. No hay migraciones ni cambios de infraestructura obligatorios.

### Comprobación rápida tras publicar

- `GET /health` debe devolver `ok: true`
- al abrir la app, debe verse clara la regla de `todo en crudo`
- al pulsar `✨ Ver alternativas en crudo` en una comida real, deben salir propuestas
- si un modelo gratis devuelve 429 o falla, el servidor debe probar otro automáticamente y, si todos fallan, mostrar un plan B local
