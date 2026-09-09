# Requirements Document

## Introduction

Meal-Spiral is a Next.js web application that helps users recognize meal-skipping momentum patterns before they escalate into a health-impacting crash. The app is not a calorie tracker — it is a pattern-awareness tool. Users log skipped meals with free-text reasons, and the system uses a Groq LLM to cluster recurring causes and score daily risk so the user can see their own patterns before they spiral.

The app stores all skip logs in a Supabase Postgres table (`skip_logs`) and exposes LLM reasoning through Next.js API routes backed by the Groq API.

A safety guardrail is built in: if the system detects patterns consistent with deliberate restriction rather than circumstantial skipping, it surfaces a gentle wellbeing message and stops displaying pattern scores.

---

## Glossary

- **Skip_Log**: A single record of a skipped meal, containing a free-text reason, meal type, day of week, and timestamp. Stored in Supabase `skip_logs` table.
- **Log_Form**: The UI component through which a user records a skipped meal.
- **Meal_Type**: One of three enumerated values — `breakfast`, `lunch`, or `dinner`.
- **Cluster**: A named group of skip reasons that share a recurring real-world cause, derived from the user's own language by the LLM.
- **Clusterer**: The Next.js API route and Groq LLM call responsible for reading recent skip reasons and grouping them into clusters.
- **Risk_Score**: A three-level assessment (`low`, `medium`, or `high`) of how likely the current skipping pattern is to escalate, produced by the LLM.
- **Risk_Scorer**: The Next.js API route and Groq LLM call responsible for computing the Risk_Score and its explanation.
- **Dashboard**: The main page that aggregates recent Skip_Logs, current Clusters, and today's Risk_Score.
- **Restriction_Signal**: A pattern in the Skip_Logs that suggests deliberate caloric restriction rather than circumstantial meal skipping (e.g., every Meal_Type skipped daily, reasons such as "not hungry" or "don't want to").
- **Safety_Guard**: The system component that evaluates Skip_Logs for a Restriction_Signal and, when detected, replaces pattern-awareness content with a wellbeing message.
- **Wellbeing_Message**: A gentle, non-alarmist message shown when a Restriction_Signal is detected, pointing the user to general wellbeing resources.
- **Groq_Client**: The Groq SDK instance used within Next.js API routes to call the Groq LLM.
- **Supabase_Client**: The Supabase JS client used to read from and write to the `skip_logs` table.

---

## Requirements

### Requirement 1: Log a Skipped Meal

**User Story:** As a user, I want to record a skipped meal with a reason and meal type, so that the app can track my skipping patterns over time.

#### Acceptance Criteria

1. THE Log_Form SHALL present a free-text input field for the skip reason and a meal type selector with exactly three options: `breakfast`, `lunch`, and `dinner`.
2. WHEN the user submits the Log_Form with a non-empty reason and a selected Meal_Type, THE Log_Form SHALL send the data to a Next.js API route that inserts a new Skip_Log into the Supabase `skip_logs` table with the fields: `reason_text`, `meal_type`, and `day_of_week` derived from the current UTC date.
3. WHEN the Supabase insert succeeds, THE Log_Form SHALL display a confirmation message and reset all fields to their default empty state.
4. IF the user submits the Log_Form with an empty reason field, THEN THE Log_Form SHALL display an inline validation error and SHALL NOT submit the form.
5. IF the user submits the Log_Form with no Meal_Type selected, THEN THE Log_Form SHALL display an inline validation error and SHALL NOT submit the form.
6. IF the Supabase insert fails, THEN THE Log_Form SHALL display an error message describing that the log could not be saved, and SHALL preserve the user's entered values so they are not lost.

---

### Requirement 2: AI Root-Cause Clustering

**User Story:** As a user, I want the app to group my skip reasons into real recurring causes using my own words, so that I can see what is actually driving my skipping without being handed generic labels.

#### Acceptance Criteria

1. THE Clusterer SHALL expose a Next.js API route (`POST /api/cluster`) that accepts no request body and reads the most recent 30 Skip_Logs from the Supabase `skip_logs` table ordered by `created_at` descending.
2. WHEN the API route is called, THE Clusterer SHALL send the collected `reason_text` values to the Groq_Client with a prompt instructing the LLM to group reasons into clusters using language drawn directly from the user's own entries, not generic category labels.
3. WHEN the Groq_Client returns a response, THE Clusterer SHALL parse it into an array of cluster objects, each containing a `label` (a short phrase in the user's own language) and a `reasons` array (the original reason strings that belong to that cluster).
4. THE Clusterer SHALL return the parsed cluster array as a JSON response with HTTP 200.
5. IF fewer than 3 Skip_Logs exist in the table, THEN THE Clusterer SHALL return an empty cluster array with HTTP 200 and SHALL NOT call the Groq_Client.
6. IF the Groq_Client call fails or returns a malformed response, THEN THE Clusterer SHALL return HTTP 500 with a plain-language error message and SHALL NOT expose raw LLM output or API keys in the response.
7. FOR ALL valid sets of skip reasons, parsing the Groq_Client response then re-serializing the cluster array to JSON then parsing it again SHALL produce an equivalent cluster array (round-trip property).

---

### Requirement 3: AI Risk Scoring

**User Story:** As a user, I want to receive a plain-language risk level and explanation based on my current patterns, so that I understand whether my skipping momentum is building toward a crash.

#### Acceptance Criteria

1. THE Risk_Scorer SHALL expose a Next.js API route (`POST /api/risk`) that accepts no request body and reads the most recent 14 Skip_Logs from the Supabase `skip_logs` table ordered by `created_at` descending.
2. WHEN the API route is called, THE Risk_Scorer SHALL supply the Groq_Client with the skip streak length (consecutive days with at least one Skip_Log), the distribution of `day_of_week` values, and the active cluster labels as context for reasoning.
3. WHEN the Groq_Client returns a response, THE Risk_Scorer SHALL parse it into an object containing a `risk_level` field with exactly one of the values `low`, `medium`, or `high`, and an `explanation` field containing a plain-language sentence of no more than 60 words.
4. THE Risk_Scorer SHALL return the parsed risk object as a JSON response with HTTP 200.
5. IF fewer than 3 Skip_Logs exist in the table, THEN THE Risk_Scorer SHALL return `{ "risk_level": "low", "explanation": "Not enough data yet to assess a pattern." }` with HTTP 200 and SHALL NOT call the Groq_Client.
6. IF the Groq_Client returns a `risk_level` value that is not one of `low`, `medium`, or `high`, THEN THE Risk_Scorer SHALL default to `low` and log the unexpected value server-side.
7. IF the Groq_Client call fails, THEN THE Risk_Scorer SHALL return HTTP 500 with a plain-language error message and SHALL NOT expose raw LLM output or API keys in the response.

---

### Requirement 4: Dashboard

**User Story:** As a user, I want a single page that shows my recent skip logs, current clusters, and today's risk score together, so that I can see the full picture of my pattern at a glance.

#### Acceptance Criteria

1. THE Dashboard SHALL display the 10 most recent Skip_Logs in reverse-chronological order, each showing the `meal_type`, `day_of_week`, and `reason_text`.
2. THE Dashboard SHALL display all current Clusters returned by the Clusterer, each showing the cluster `label` and the list of contributing reasons.
3. THE Dashboard SHALL display today's Risk_Score `risk_level` as a visual indicator (color-coded or labeled) and the accompanying `explanation` text.
4. WHEN the Dashboard page loads, THE Dashboard SHALL fetch Skip_Logs, Clusters, and Risk_Score in parallel and render each section as its data becomes available, showing a loading state for any section still pending.
5. IF the Clusterer or Risk_Scorer API route returns an error, THEN THE Dashboard SHALL display a section-level error message for the affected section and SHALL continue to render the other sections with their data.
6. WHILE a Restriction_Signal is active, THE Dashboard SHALL replace the Clusters section and Risk_Score section with the Wellbeing_Message and SHALL NOT render pattern-awareness content in those sections.

---

### Requirement 5: Safety Guardrail

**User Story:** As a user, I want the app to recognize when my patterns look like deliberate restriction rather than circumstantial skipping, so that it stops surfacing patterns and instead offers a supportive message.

#### Acceptance Criteria

1. THE Safety_Guard SHALL evaluate Skip_Logs from the most recent 7 calendar days each time the Dashboard loads.
2. WHEN the Safety_Guard detects that all three Meal_Types (`breakfast`, `lunch`, and `dinner`) have each been skipped on at least 5 of the 7 most recent calendar days, THE Safety_Guard SHALL activate the Restriction_Signal.
3. WHEN the Safety_Guard detects that at least 60% of `reason_text` values in the most recent 14 Skip_Logs contain any of the phrases `not hungry`, `don't want to`, `don't feel like`, or `not interested`, THE Safety_Guard SHALL activate the Restriction_Signal.
4. WHEN the Restriction_Signal is active, THE Dashboard SHALL render the Wellbeing_Message in place of the Clusters section and Risk_Score section.
5. THE Wellbeing_Message SHALL contain a non-alarmist, supportive sentence acknowledging the pattern and a reference to the National Alliance for Eating Disorders helpline (www.allianceforeatingdisorders.com) as a general wellbeing resource.
6. THE Wellbeing_Message SHALL NOT use clinical diagnostic language, SHALL NOT describe the user as having a disorder, and SHALL NOT display a Risk_Score or Cluster data while active.
7. IF the Restriction_Signal is not active, THEN THE Safety_Guard SHALL allow the Dashboard to render Clusters and Risk_Score normally.
