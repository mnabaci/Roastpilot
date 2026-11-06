/** One line for the screen; the full error goes to the log. */
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
