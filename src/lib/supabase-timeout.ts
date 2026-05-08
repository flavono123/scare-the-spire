export const SUPABASE_QUERY_TIMEOUT_MS = 8000;
export const SUPABASE_AUTH_TIMEOUT_MS = 8000;

export class SupabaseTimeoutError extends Error {
  constructor(operation: string) {
    super(`${operation} timed out`);
    this.name = "SupabaseTimeoutError";
  }
}

export function withSupabaseTimeout<T>(
  operation: string,
  promise: PromiseLike<T>,
  timeoutMs = SUPABASE_QUERY_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new SupabaseTimeoutError(operation));
    }, timeoutMs);
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}
