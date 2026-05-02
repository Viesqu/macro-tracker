# Macros Flex

App web sencilla para registrar comidas dinámicas, ver macros diarios y, opcionalmente, pedir alternativas parecidas con IA.

## Qué hace ahora

- Añadir tantas comidas como quieras.
- Añadir alimentos por comida.
- Editar gramos y macros por 100 g.
- Ver proteínas, hidratos, grasas y kcal por alimento, por comida y total diario.
- Duplicar comidas.
- Guardar una comida como plantilla y reutilizarla luego.
- Copiar un resumen del día para compartirlo rápido.
- Exportar e importar el estado en JSON.
- Guardado automático en `localStorage` del navegador.
- Sincronización opcional con Supabase si rellenas `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `app.js`.
- Sugerencias opcionales con IA para proponer comidas alternativas de macros similares.

## IA, cómo funciona

La función de IA está pensada para ser limpia y segura:

- Si **no** hay clave configurada, la app **no se rompe**.
- Verás la UI de IA marcada como opcional y el botón de sugerencias quedará desactivado.
- Si hay clave, cada comida tiene un botón `✨ Sugerir alternativa` que pide 3 propuestas parecidas en macros y kcal.

### Activar IA en local o en servidor

Ahora la vía por defecto es **OpenRouter** con un modelo gratuito razonable.

Arranca la app así:

```bash
OPENROUTER_API_KEY=tu_clave npm run dev
```

Opcionalmente puedes elegir modelo:

```bash
OPENROUTER_API_KEY=tu_clave OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free npm run dev
```

Tienes un ejemplo listo en `.env.example`.

Variables soportadas:

- `AI_PROVIDER=openrouter` (por defecto)
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` u `AI_MODEL`
- `OPENROUTER_SITE_URL` y `OPENROUTER_APP_NAME` para identificar el proyecto en OpenRouter

Si prefieres seguir con OpenAI:

```bash
AI_PROVIDER=openai OPENAI_API_KEY=tu_clave OPENAI_MODEL=gpt-4.1-mini npm run dev
```

La clave se usa solo en el servidor (`server.js`). No se expone en el navegador.

### Limitaciones de la IA

- Las sugerencias son orientativas, no una prescripción nutricional.
- El modelo intenta mantenerse cerca de los macros, pero puede haber pequeñas desviaciones.
- Conviene revisar gramos y alimentos antes de usar una propuesta tal cual.
- Si despliegas la app como hosting estático puro sin `server.js`, la función de IA no estará disponible, pero el resto sí.

## Cómo arrancarla en local

### Opción recomendada

Desde esta carpeta:

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
3. Pulsa `✨ Sugerir alternativa`.
4. Deberían aparecer 3 opciones con:
   - nombre de la propuesta
   - breve motivo
   - lista de alimentos y gramos
   - macros y kcal aproximadas

## Despliegue sencillo

### Ruta más directa recomendada, Render con IA funcionando

He dejado `render.yaml` preparado para que Render detecte el servicio casi solo.

Pasos:

1. Sube `macro-tracker` a un repo de GitHub.
2. En Render, elige **New +** → **Blueprint**.
3. Selecciona ese repo.
4. Render leerá `render.yaml` y creará el servicio Node apuntando a `macro-tracker`.
5. Antes de desplegar, añade solo este secret:
   - `OPENROUTER_API_KEY=tu_clave`
6. Opcional pero recomendable, pon también:
   - `OPENROUTER_SITE_URL=https://tu-app.onrender.com`
7. Pulsa deploy.

Ya va preconfigurado con:

- `AI_PROVIDER=openrouter`
- `OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free`
- `npm start`
- health check en `/health`

Con eso la app queda publicada con IA activa por defecto usando OpenRouter + Llama 3.3 gratis.

### Alternativa muy simple, Railway

También he dejado `railway.json` preparado.

Pasos:

1. Sube `macro-tracker` a GitHub.
2. En Railway, crea un proyecto desde ese repo.
3. En el servicio, define estas variables:
   - `AI_PROVIDER=openrouter`
   - `OPENROUTER_API_KEY=tu_clave`
   - `OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free`
   - `OPENROUTER_SITE_URL=https://tu-dominio-railway.app`
   - `OPENROUTER_APP_NAME=Macros Flex`
4. Deploy.

Railway arrancará con `npm start` y podrá comprobar salud en `/health`.

### Opción estática, sin IA

Si quieres la versión sin backend:

1. Subir la carpeta `macro-tracker` a GitHub.
2. Publicarla como sitio estático.
3. Funcionarán macros, plantillas, exportación/importación y guardado local.
4. La IA quedará desactivada automáticamente.

### Variables de entorno útiles

Por defecto:

- `AI_PROVIDER=openrouter`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free`
- `OPENROUTER_SITE_URL`
- `OPENROUTER_APP_NAME=Macros Flex`

Alternativa OpenAI:

- `AI_PROVIDER=openai`
- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-4.1-mini`

### Comprobación rápida tras publicar

- `GET /health` debe devolver `ok: true`
- al abrir la app, el bloque de IA debe indicar `IA activa`
- al pulsar `✨ Sugerir alternativa` en una comida real, deben salir 3 propuestas

## Base preparada para crecer

La estructura ya separa:

- estado del día (`meals`)
- plantillas reutilizables (`templates`)
- caché simple de sugerencias IA (`aiSuggestions`)
- biblioteca rápida de alimentos (`foodLibrary`)

Eso deja buen camino para futuras mejoras, por ejemplo:

- objetivos diarios y comparación con objetivo
- historial por fecha
- base de datos de alimentos más grande
- aplicar una sugerencia IA directamente como nueva comida
- generación de alternativas según objetivo, por ejemplo volumen o definición
