import type { Result } from "@allplay/shared";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const result = (await response.json()) as Result<T>;
  if (!result.ok) throw new ApiError(result.error.code, result.error.message);
  return result.data;
}
let pending: Promise<{ csrfToken: string; roomId: string | null }> | undefined;
export function guestSession() {
  // Deduplicate Strict Mode mounts without persisting credentials in browser storage.
  const bootstrap = () =>
    api<{ csrfToken: string; roomId: string | null }>("/session", { method: "POST" });
  pending ??= (
    navigator.locks
      ? navigator.locks.request("allplay-guest-bootstrap", bootstrap).then((session) => session)
      : bootstrap()
  ).finally(() => {
    pending = undefined;
  });
  return pending;
}
