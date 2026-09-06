import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * The one place the app talks to the backend.
 *
 * Everything above this file works with plain typed objects; everything below
 * is HTTP. Errors are normalised here too, so screens never have to unpick a
 * fetch rejection from a 422 from a serialiser failure — they get an ApiError
 * with a message worth showing a person.
 */

const DEFAULT_PORT = 4000;

/**
 * Where the API lives.
 *
 * `EXPO_PUBLIC_API_URL` wins when set — that is the only thing that works for a
 * real deployment, and for a physical device on the same wifi. Failing that we
 * guess from how the app itself was served, because "localhost" means a
 * different machine depending on where this code is running:
 *
 *   · web / iOS simulator — localhost is the dev machine. Correct as-is.
 *   · Android emulator    — localhost is the emulator; the host is 10.0.2.2.
 *   · physical device     — localhost is the phone. Only the LAN address of
 *                           the dev machine works, which Expo already knows as
 *                           the host it served the bundle from.
 */
function resolveBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  // e.g. "192.168.1.14:8081" — the machine running `expo start`.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;
  const host = hostUri?.split(':')[0];

  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${DEFAULT_PORT}`;
  }

  if (Platform.OS === 'android') return `http://10.0.2.2:${DEFAULT_PORT}`;
  return `http://localhost:${DEFAULT_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();

/** A failure the user can be shown, with the backend's own words where it gave any. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when nothing answered — almost always the API not running, or a bad host. */
  get isOffline(): boolean {
    return this.status === 0;
  }
}

interface BackendErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

/**
 * One request.
 *
 * A timeout is enforced because a phone pointed at a host that is not listening
 * will otherwise hang for the platform default — long enough that the screen
 * looks broken rather than disconnected.
 */
async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch (cause) {
    const aborted = cause instanceof Error && cause.name === 'AbortError';
    throw new ApiError(
      aborted
        ? `The API at ${API_BASE_URL} did not respond in time.`
        : `Could not reach the API at ${API_BASE_URL}. Is the backend running?`,
      0,
      aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const body: unknown = text ? safeParse(text) : null;

  if (!response.ok) {
    const shaped = (body ?? {}) as BackendErrorBody;
    throw new ApiError(
      shaped.error?.message ?? `Request failed (${response.status})`,
      response.status,
      shaped.error?.code ?? 'HTTP_ERROR',
      shaped.error?.details,
    );
  }

  return body as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
