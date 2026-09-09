/**
 * SERVER-ONLY MODULE
 *
 * This file initialises the Groq SDK client and exports a singleton instance.
 *
 * IMPORT RESTRICTIONS -- read before importing this module:
 *   OK     Import from:  app/api/[*]/route.ts  (Next.js server-only API routes)
 *   NEVER  Import from:  app/components/, app/page.tsx, or any file
 *                        that is (or could be) bundled for the browser.
 *
 * `GROQ_API_KEY` is a secret credential.  It must never appear in a client
 * bundle, an HTTP response body, or any log output visible to end-users.
 */

import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error(
    "Missing environment variable: GROQ_API_KEY. " +
      "Set it in .env.local (development) or in your deployment environment. " +
      "Never use the NEXT_PUBLIC_ prefix for this variable."
  );
}

/** Singleton Groq client.  Only import this from server-side API routes. */
export const groq = new Groq({ apiKey });
