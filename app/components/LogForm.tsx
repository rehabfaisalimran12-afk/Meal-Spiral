"use client";

/**
 * LogForm
 *
 * Controlled form for recording a skipped meal.
 * Manages its own state â€” no props needed.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import { useState } from "react";
import type { MealType } from "@/lib/types";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

interface LogFormProps {
  onLogSuccess?: () => void;
}

export default function LogForm({ onLogSuccess }: LogFormProps) {
  const [reason, setReason] = useState("");
  const [mealType, setMealType] = useState<MealType | "">("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [mealTypeError, setMealTypeError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");

  function validate(): boolean {
    let valid = true;

    if (reason.trim() === "") {
      setReasonError("Please describe why you skipped this meal.");
      valid = false;
    } else {
      setReasonError(null);
    }

    if (mealType === "") {
      setMealTypeError("Please select a meal type.");
      valid = false;
    } else {
      setMealTypeError(null);
    }

    return valid;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Client-side validation â€” no fetch if invalid
    if (!validate()) return;

    setSubmitStatus("submitting");

    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason_text: reason.trim(),
          meal_type: mealType,
        }),
      });

      if (res.ok) {
        onLogSuccess?.();
        setSubmitStatus("success");
        setReason("");
        setMealType("");
        setReasonError(null);
        setMealTypeError(null);
      } else {
        setSubmitStatus("error");
        // preserve field values per requirement 1.6
      }
    } catch {
      setSubmitStatus("error");
      // preserve field values per requirement 1.6
    }
  }

  const isSubmitting = submitStatus === "submitting";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {/* Reason textarea */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="reason_text"
          className="text-sm font-medium text-zinc-700"
        >
          What made you skip this meal?
        </label>
        <textarea
          id="reason_text"
          name="reason_text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          disabled={isSubmitting}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 resize-none"
          placeholder="e.g. too busy, not hungry, skipped by mistakeâ€¦"
        />
        {reasonError && (
          <p role="alert" className="text-xs text-red-600">
            {reasonError}
          </p>
        )}
      </div>

      {/* Meal type select */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="meal_type"
          className="text-sm font-medium text-zinc-700"
        >
          Meal type
        </label>
        <select
          id="meal_type"
          name="meal_type"
          value={mealType}
          onChange={(e) => setMealType(e.target.value as MealType | "")}
          disabled={isSubmitting}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50"
        >
          <option value="">Select meal type</option>
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
        </select>
        {mealTypeError && (
          <p role="alert" className="text-xs text-red-600">
            {mealTypeError}
          </p>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
      >
        {isSubmitting ? "Savingâ€¦" : "Log skip"}
      </button>

      {/* Success / error feedback */}
      {submitStatus === "success" && (
        <p className="text-sm text-green-700">Meal skip logged.</p>
      )}
      {submitStatus === "error" && (
        <p role="alert" className="text-sm text-red-600">
          Could not save. Please try again.
        </p>
      )}
    </form>
  );
}
