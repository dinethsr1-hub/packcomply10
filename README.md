# PackComply V11

Vercel-safe static-first build.

- `/` = main compliance checker
- `/ai-inspector/` = AI packaging inspector
- `/ai-inspector.html` = same AI inspector, for compatibility with old links
- Run Free Check is fully client-side and does not depend on a Vercel function.
- `/api/inspect` is the only serverless function and is used by the AI inspector.
- Set `OPENAI_API_KEY` in Vercel Environment Variables for live AI inspection. Without it, the inspector returns a safe demo result.

IMPORTANT: In Vercel, use Framework Preset **Other** and Root Directory `./`. Do not use the Express preset.
