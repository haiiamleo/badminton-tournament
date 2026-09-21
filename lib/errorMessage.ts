/*
 * Supabase rejects with a plain object, not an Error, so `instanceof Error`
 * checks silently swallow the real cause. Pull the useful fields out.
 */
export function describeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const details = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [details.message, details.details, details.hint].filter(
      (part): part is string => Boolean(part)
    );

    if (parts.length > 0) {
      return details.code
        ? `${parts.join(" · ")} (${details.code})`
        : parts.join(" · ");
    }
  }

  return fallback;
}
