# New Features & Security Enhancements

This document summarizes the recently added functionality and the steps required to leverage it.

## Added API Routes

1. `GET /api/nutrition/summary?range=5d|7d|30d` (or `custom&start=YYYY-MM-DD&end=YYYY-MM-DD` planned)
   - Returns: `{ days: [...], totals: { calories, protein, carbs, fat, fiber }, averages: { ... } }`
2. `GET /api/nutrition/recommendations`
   - Consumes most recent summary (7d default) and returns AI diet advice with actionable suggestions.
   - Response cached per-user for 60 seconds to limit model calls.
3. `POST /api/nutrition` (existing) Insert a nutrition entry (server derives `user_id` from auth token).
4. `GET /api/nutrition` (existing) Recent nutrition history entries.
5. `POST /api/detect_food` Detects food from an uploaded image (base64) and now returns a `health_assessment` block.

## Health Assessment
Each detection now includes:
```json
{
  "health_assessment": {
    "score": 0-100,
    "label": "Excellent | Good | Moderate | Limit",
    "advice": "Short actionable suggestion"
  }
}
```
Heuristic considers calories density, protein ratio, added sugars, saturated fat proxy, sodium, fiber balance.

## Charts Component
`<NutritionCharts />` dynamically imported inside the calorie calculator page. Provides:
- Range selector (5 / 7 / 30 days)
- Calorie bar chart
- Macro trend line chart
- Button to fetch AI recommendations

## AI Recommendations
Endpoint synthesizes: calorie balance, macro distribution, fiber adequacy, and offers up to 5 bullet suggestions plus meal pattern notes.

## Security Enhancements
- Middleware adds security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- All nutrition mutations derive `user_id` from Supabase access token (client cannot spoof).
- Basic in-memory rate limiting for recommendations (60s cache window).

## SQL Additions (Supabase)
File: `supabase_nutrition_extensions.sql`
- Creates a daily aggregation view and a security definer function for ranged retrieval.
- Recommended to run after base tables & RLS policies exist.

## Environment Variables
Ensure the following are set in `.env.local` and Vercel project settings:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...(only if server-side secure functions need it; NOT exposed client-side)
OPENAI_API_KEY=...
```

## Future / Planned
- Custom date range parameters for summary endpoint.
- Stronger persistent rate limiting (Redis / Upstash) if required.
- Materialized view refresh scheduling for large datasets.
- Enhanced CSP once image hosting and model endpoints finalized.

## Usage Flow
1. User logs in (Supabase auth).
2. Upload food image -> `/api/detect_food` -> nutrition + health assessment.
3. Entry optionally stored via `/api/nutrition`.
4. Charts auto-refresh summary; user can request AI recommendations.

## Troubleshooting
- If charts show empty data: verify there are entries in `nutrition_history` and that timestamps are UTC consistent.
- 401 errors: confirm access token included (AuthContext) and env vars loaded at build time.
- Rate limit message: wait 60s before fetching recommendations again.

---
Document last updated: (add date when editing)
