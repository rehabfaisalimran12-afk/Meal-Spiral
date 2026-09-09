# Implementation Plan: Meal-Spiral

## Overview

Implement the full Meal-Spiral feature in TypeScript using Next.js 16 App Router. The build order is: shared types → client singletons → pure business logic → API routes → React components → Dashboard wiring → tests. Each step compiles and integrates with everything before it so there is no orphaned code at any stage.

---

## Tasks

- [x] 1. Set up shared types and test infrastructure
  - [x] 1.1 Create `lib/types.ts` with all shared TypeScript interfaces and types
    - Export `MealType`, `RiskLevel`, `SkipLog`, `Cluster`, `RiskScore`, `RiskContext`, `GuardResult`
    - _Requirements: 1.1, 2.3, 3.3, 5.1_

  - [x] 1.2 Install test dependencies and configure Vitest
    - Run `npm install --save-dev vitest @vitejs/plugin-react fast-check @testing-library/react @testing-library/jest-dom jsdom`
    - Create `vitest.config.ts` with jsdom environment and React plugin
    - Add `"test": "vitest --run"` to `package.json` scripts
    - Create `vitest.setup.ts` that imports `@testing-library/jest-dom`
    - _Requirements: (test infrastructure — supports all requirements)_

- [ ] 2. Implement client singletons
  - [x] 2.1 Create `lib/supabase.ts`
    - Export a singleton Supabase client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - _Requirements: 1.2, 2.1, 3.1_

  - [x] 2.2 Create `lib/groq.ts`
    - Export a singleton Groq client using `GROQ_API_KEY` (server-only import — never imported from client components)
    - _Requirements: 2.2, 3.2_

- [x] 3. Implement the Safety Guard
  - [x] 3.1 Create `lib/safety-guard.ts` with `evaluateRestrictionSignal()`
    - Pure function, no I/O or side effects
    - Frequency signal: check all three `MealType` values each skipped on ≥ 5 distinct calendar days within the `last7DaysLogs` array
    - Language signal: count how many of `last14Logs` have `reason_text` (lowercased) containing any of `["not hungry", "don't want to", "don't feel like", "not interested"]`; activate if ratio ≥ 0.60
    - Return `{ restrictionActive: boolean, triggeredBy: "frequency" | "language" | null }`
    - `triggeredBy` is `null` when `restrictionActive` is `false`; first matching signal wins when both fire
    - _Requirements: 5.1, 5.2, 5.3, 5.7_

  - [ ]* 3.2 Write property tests for `evaluateRestrictionSignal` — Property 12
    - **Property 12: Restriction_Signal activates if and only if frequency or language threshold is met**
    - Use fast-check to generate log arrays that satisfy the frequency threshold and assert `restrictionActive === true`
    - Use fast-check to generate log arrays that satisfy the language threshold and assert `restrictionActive === true`
    - Use fast-check to generate log arrays satisfying neither threshold and assert `restrictionActive === false`
    - Tag: `// Feature: meal-spiral, Property 12: Restriction_Signal activates iff threshold met`
    - **Validates: Requirements 5.2, 5.3, 5.7**

- [x] 4. Implement `POST /api/log`
  - [x] 4.1 Create `app/api/log/route.ts`
    - Parse and validate request body: `reason_text` must be a non-empty, non-whitespace string; `meal_type` must be one of `breakfast | lunch | dinner`
    - Return 400 with inline field error when validation fails (reason empty or meal_type missing/invalid)
    - Derive `day_of_week` from `new Date()` UTC
    - Call `supabase.from("skip_logs").insert({ reason_text, meal_type, day_of_week })`
    - On insert error → return 500 `{ error: "Could not save log. Please try again." }`
    - On success → return 200 `{ success: true }`
    - Never expose stack traces, raw Supabase errors, or env variable values
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 5. Implement `POST /api/cluster`
  - [x] 5.1 Create `app/api/cluster/route.ts`
    - `SELECT reason_text FROM skip_logs ORDER BY created_at DESC LIMIT 30`
    - If count < 3 → return 200 `[]` without calling Groq
    - Build clusterer system prompt instructing LLM to use the user's own language; include all collected `reason_text` values in the user message (one per line)
    - Call `groq.chat.completions.create(...)` with the prompt
    - Parse response into `Cluster[]`; validate each element has `label: string` and `reasons: string[]`
    - If parse/validation fails → return 500 `{ error: "Could not process patterns. Please try again." }` without exposing raw LLM output or `GROQ_API_KEY`
    - Return 200 `Cluster[]` on success
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 5.2 Write property test for cluster JSON round-trip — Property 4
    - **Property 4: Cluster JSON round-trip is lossless**
    - Use fast-check to generate arbitrary `Cluster[]` values; assert `JSON.parse(JSON.stringify(clusters))` produces a structurally and value-equivalent array
    - Tag: `// Feature: meal-spiral, Property 4: Cluster JSON round-trip lossless`
    - **Validates: Requirements 2.7**

  - [ ]* 5.3 Write property test for clusterer prompt completeness — Property 5
    - **Property 5: Clusterer prompt includes all reason strings**
    - Mock the Supabase client to return a controlled set of reason strings (length ≥ 3); capture the prompt argument passed to the Groq client; assert every reason string appears in the prompt
    - Tag: `// Feature: meal-spiral, Property 5: Clusterer prompt includes all reason strings`
    - **Validates: Requirements 2.2**

  - [ ]* 5.4 Write property test for malformed Groq response safety — Property 6
    - **Property 6: Malformed Groq cluster response never exposes raw output or keys**
    - Use fast-check to generate arbitrary malformed Groq response bodies (null, non-JSON strings, wrong-typed fields); assert the route returns HTTP 500 with a plain-language message body that does not contain the raw LLM string and does not contain `process.env.GROQ_API_KEY`
    - Tag: `// Feature: meal-spiral, Property 6: Malformed Groq response never exposes raw output or keys`
    - **Validates: Requirements 2.6**

- [x] 6. Implement `POST /api/risk`
  - [x] 6.1 Create `app/api/risk/route.ts`
    - `SELECT id, created_at, meal_type, day_of_week FROM skip_logs ORDER BY created_at DESC LIMIT 14`
    - If count < 3 → return 200 `{ risk_level: "low", explanation: "Not enough data yet to assess a pattern." }` without calling Groq
    - Compute `streakDays`: count consecutive calendar days backward from today that each have ≥ 1 log
    - Compute `dayDistribution`: frequency map of `day_of_week` values across the fetched logs
    - Derive `clusterLabels` from the same log window (call the cluster logic or extract labels from a lightweight re-derivation — no second HTTP call)
    - Build risk scorer prompt with `{ streakDays, dayDistribution, clusterLabels }`
    - Call `groq.chat.completions.create(...)` with the prompt
    - Parse response into `{ risk_level, explanation }`; validate `risk_level ∈ { low, medium, high }` — if not, default to `"low"` and log the unexpected value server-side
    - Truncate `explanation` at word boundary if > 60 words
    - If parse fails → return 500 `{ error: "Could not assess risk. Please try again." }` without exposing raw output or keys
    - Return 200 `RiskScore` on success
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 6.2 Write property test for risk context derivation — Property 7
    - **Property 7: Risk context derivation is correct for any log set**
    - Use fast-check to generate arbitrary `SkipLog[]` arrays; assert `streakDays` equals the number of consecutive calendar days (backward from today) with ≥ 1 log, and `dayDistribution` is a correct frequency map
    - Tag: `// Feature: meal-spiral, Property 7: Risk context derivation correct for any log set`
    - **Validates: Requirements 3.2**

  - [ ]* 6.3 Write property test for invalid risk_level defaulting — Property 8
    - **Property 8: Invalid risk_level always defaults to "low"**
    - Use fast-check to generate arbitrary strings that are not `"low" | "medium" | "high"`; assert the validation function returns `"low"` and does not throw
    - Tag: `// Feature: meal-spiral, Property 8: Invalid risk_level always defaults to "low"`
    - **Validates: Requirements 3.6**

- [ ] 7. Implement React components
  - [ ] 7.1 Create `app/components/WellbeingMessage.tsx`
    - Render the non-clinical supportive message
    - Include the helpline link: `www.allianceforeatingdisorders.com`
    - Must NOT render any `risk_level`, cluster label, or pattern score content
    - No props needed
    - _Requirements: 5.5, 5.6_

  - [ ]* 7.2 Write unit tests for `WellbeingMessage`
    - Assert helpline URL is present in rendered output
    - Assert no risk-level or cluster-related text is rendered
    - _Requirements: 5.5, 5.6_

  - [ ] 7.3 Create `app/components/LogForm.tsx`
    - Controlled form with a `reason_text` textarea and a `meal_type` select (options: breakfast, lunch, dinner)
    - Client-side validation: empty/whitespace-only reason → inline error, no network call; no meal type selected → inline error, no network call
    - On valid submit: POST to `/api/log`; show success confirmation and reset both fields on 200; show error message and preserve both field values on 5xx
    - No props needed (self-contained state)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 7.4 Write property test for whitespace-only rejection — Property 2
    - **Property 2: Whitespace-only reasons are rejected without a network call**
    - Use fast-check to generate strings composed entirely of whitespace; mock `fetch`; submit the form; assert inline error shown and `fetch` was not called
    - Tag: `// Feature: meal-spiral, Property 2: Whitespace-only reasons rejected without network call`
    - **Validates: Requirements 1.4**

  - [ ]* 7.5 Write property test for API failure input preservation — Property 3
    - **Property 3: API failure preserves user input**
    - Use fast-check to generate arbitrary valid reason strings and meal types; mock `fetch` to return 500; assert error message displayed and both field values unchanged
    - Tag: `// Feature: meal-spiral, Property 3: API failure preserves user input`
    - **Validates: Requirements 1.6**

  - [ ]* 7.6 Write property test for form submission payload — Property 1
    - **Property 1: Form submission payload is well-formed**
    - Use fast-check to generate non-empty reason strings and meal types; mock `fetch`; submit form; assert the captured request body contains `reason_text`, `meal_type`, and a valid `day_of_week` day name
    - Tag: `// Feature: meal-spiral, Property 1: Form submission payload is well-formed`
    - **Validates: Requirements 1.2**

  - [ ]* 7.7 Write unit tests for `LogForm` — success and validation scenarios
    - Render with no meal type selected → assert inline error, no fetch
    - Mock API 200 → assert confirmation message shown and fields reset
    - _Requirements: 1.1, 1.3, 1.5_

  - [ ] 7.8 Create `app/components/RecentLogs.tsx`
    - Accept props: `logs: SkipLog[]`, `isLoading: boolean`, `error: string | null`
    - Render a loading indicator while `isLoading`
    - Render an error message when `error` is set
    - Render each log showing `meal_type`, `day_of_week`, and `reason_text` in descending `created_at` order
    - _Requirements: 4.1, 4.4, 4.5_

  - [ ]* 7.9 Write property test for reverse-chronological rendering — Property 9
    - **Property 9: Recent logs render in reverse-chronological order with all required fields**
    - Use fast-check to generate arbitrary `SkipLog[]`; render `RecentLogs`; assert logs appear in descending `created_at` order and each shows `meal_type`, `day_of_week`, `reason_text`
    - Tag: `// Feature: meal-spiral, Property 9: Recent logs render in reverse-chronological order`
    - **Validates: Requirements 4.1**

  - [ ] 7.10 Create `app/components/ClustersSection.tsx`
    - Accept props: `clusters: Cluster[]`, `isLoading: boolean`, `error: string | null`, `restrictionActive: boolean`
    - When `restrictionActive` is `true`: render `<WellbeingMessage />` only — no cluster labels or reasons
    - When not restricted: render loading state, error state, or the full cluster list (label + reason list for each cluster)
    - _Requirements: 4.2, 4.4, 4.5, 4.6, 5.4, 5.6_

  - [ ]* 7.11 Write property test for cluster data rendering completeness — Property 10 (clusters)
    - **Property 10: ClustersSection renders all provided cluster data**
    - Use fast-check to generate arbitrary `Cluster[]`; render `ClustersSection` with `restrictionActive: false`; assert every cluster's `label` and all `reasons` strings are present in the output
    - Tag: `// Feature: meal-spiral, Property 10: ClustersSection renders all provided data`
    - **Validates: Requirements 4.2**

  - [ ]* 7.12 Write property test for restriction signal suppression — Property 13 (clusters)
    - **Property 13: Active Restriction_Signal suppresses all pattern data in ClustersSection**
    - Use fast-check to generate arbitrary `Cluster[]`; render with `restrictionActive: true`; assert no cluster labels or reasons appear and `WellbeingMessage` content is present
    - Tag: `// Feature: meal-spiral, Property 13: Active signal suppresses all pattern data`
    - **Validates: Requirements 4.6, 5.4, 5.6**

  - [ ] 7.13 Create `app/components/RiskSection.tsx`
    - Accept props: `riskScore: RiskScore | null`, `isLoading: boolean`, `error: string | null`, `restrictionActive: boolean`
    - When `restrictionActive` is `true`: render `<WellbeingMessage />` only — no risk level indicator or explanation
    - When not restricted: render loading state, error state, or the risk level visual indicator (color-coded or labeled) plus explanation text
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 5.4, 5.6_

  - [ ]* 7.14 Write property test for risk data rendering completeness — Property 10 (risk)
    - **Property 10: RiskSection renders all provided RiskScore data**
    - Use fast-check to generate arbitrary `RiskScore` values; render `RiskSection` with `restrictionActive: false`; assert `risk_level` indicator and `explanation` text are present
    - Tag: `// Feature: meal-spiral, Property 10: RiskSection renders all provided data`
    - **Validates: Requirements 4.3**

  - [ ]* 7.15 Write property test for restriction signal suppression — Property 13 (risk)
    - **Property 13: Active Restriction_Signal suppresses all pattern data in RiskSection**
    - Use fast-check to generate arbitrary `RiskScore` values; render with `restrictionActive: true`; assert no risk level or explanation text appears and `WellbeingMessage` content is present
    - Tag: `// Feature: meal-spiral, Property 13: Active signal suppresses all pattern data`
    - **Validates: Requirements 4.6, 5.4, 5.6**

- [ ] 8. Checkpoint — core logic complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement Dashboard page and wire everything together
  - [ ] 9.1 Rewrite `app/page.tsx` as the Dashboard client component
    - Mark with `"use client"`
    - Fetch `skip_logs` (SELECT 10 most recent) directly from Supabase in parallel with `POST /api/cluster` and `POST /api/risk` using `Promise.allSettled`
    - Maintain separate `useState` per section: `{ data, isLoading, error }` for logs, clusters, and risk
    - Derive `last7DaysLogs` and `last14Logs` from the fetched logs; call `evaluateRestrictionSignal()` to get `GuardResult`
    - Render `<LogForm />`, `<RecentLogs />`, `<ClustersSection />`, `<RiskSection />` with their respective state and the `restrictionActive` flag
    - Each section shows its own loading and error states independently; no section failure suppresses another
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1_

  - [ ]* 9.2 Write property test for section error isolation — Property 11
    - **Property 11: Section error isolation — failing sections do not suppress passing sections**
    - Use fast-check to generate combinations of successful and failed fetch results for all three sections; render the Dashboard with mocked fetch; assert sections with data render their content and sections with errors render only their own error message
    - Tag: `// Feature: meal-spiral, Property 11: Section error isolation`
    - **Validates: Requirements 4.5**

- [ ] 10. Final checkpoint — full integration
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Every task references specific requirements for traceability
- Property-based tests use fast-check with a minimum of 100 iterations (200 recommended for threshold logic in Properties 12 and 13)
- Each property test must be tagged with `// Feature: meal-spiral, Property {N}: {title}`
- The Groq client (`lib/groq.ts`) must never be imported from any client component — only from `app/api/*/route.ts` files
- Environment variable `GROQ_API_KEY` must never appear in any HTTP response body
- Supabase and Groq clients should be mocked with `vi.mock` in all unit and property tests

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1", "4.1", "7.1"] },
    { "id": 3, "tasks": ["3.2", "5.1", "6.1", "7.2", "7.3", "7.8"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4", "6.2", "6.3", "7.4", "7.5", "7.6", "7.7", "7.9", "7.10", "7.13"] },
    { "id": 5, "tasks": ["7.11", "7.12", "7.14", "7.15"] },
    { "id": 6, "tasks": ["9.1"] },
    { "id": 7, "tasks": ["9.2"] }
  ]
}
```
