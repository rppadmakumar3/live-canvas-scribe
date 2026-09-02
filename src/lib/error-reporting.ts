/**
 * Error reporting utility — forwards boundary-caught errors to the console
 * and any registered window error hooks.
 */
export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);

  console.error("[Storyboard Live] Error boundary caught:", message, context);
}
