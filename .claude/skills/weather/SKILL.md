---
name: weather
description: >
  Get current weather and forecast for any location using free, no-API-key public
  services (wttr.in and Open-Meteo). Use when the user asks about weather, temperature,
  forecast, rain/snow chance, or says "clima", "tiempo", "pronóstico", "hace frío/calor".
  Works by running curl/Invoke-RestMethod against public endpoints — no signup, no keys.
---

Fetch real weather data via public HTTP APIs. Never guess or invent weather data.

## Default location

If the user does not name a location, **default to Buenos Aires, Argentina** — do not ask, and do not fall back to IP-based geolocation. Only use a different location if the user explicitly names one.

## Quick answer (one-liner)

Fastest path for "what's the weather" / "¿cómo está el clima?":

```bash
curl -s "wttr.in/Buenos+Aires?format=3&lang=es"
```

If the user names a different location, substitute it: `curl -s "wttr.in/<location>?format=3"`.

Example: `curl -s "wttr.in/Buenos+Aires?format=3"` → `Buenos Aires: ☀️ +18°C`

On Windows PowerShell (if `curl` resolves to `Invoke-WebRequest` alias issues), use:

```powershell
Invoke-RestMethod "https://wttr.in/<location>?format=3"
```

## Full forecast (ASCII, human-readable)

```bash
curl -s "wttr.in/Buenos+Aires?lang=es"
```

Use `&format=v2` or `?T` variants only if the user wants a no-color/plain view (append `&T` to strip ANSI colors, useful when piping to a file).

Multi-word cities: replace spaces with `+` (e.g. `Buenos+Aires`, `New+York`).

## Structured data (when you need to parse/compare numbers, e.g. multi-day trend)

Use Open-Meteo — no key required, returns clean JSON. Buenos Aires coordinates (default, skip geocoding): `latitude=-34.6037&longitude=-58.3816`.

1. If the location is Buenos Aires (default), skip straight to step 2 with the coordinates above. Otherwise geocode the place name to lat/lon:
   ```bash
   curl -s "https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=1&language=es&format=json"
   ```
   Take `results[0].latitude` and `results[0].longitude`.

2. Fetch current conditions + forecast:
   ```bash
   curl -s "https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto"
   ```

Parse the JSON and present a short, human summary (temperature, condition, precipitation chance) rather than dumping raw JSON to the user.

## Notes

- Both services are free and require no API key or auth — safe to call directly.
- Prefer `wttr.in` for a quick conversational answer; use Open-Meteo when the user needs multi-day numbers, comparisons, or programmatic use in code.
- If a request fails (network/service down), say so plainly — don't fabricate weather data.
- Respect the user's language: reply in Spanish if they asked in Spanish, matching CLAUDE.md-style directness (no filler).
