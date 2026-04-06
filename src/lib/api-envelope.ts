import type { ApiEnvelope } from '../types/api';

export function unwrapPayload<T>(value: ApiEnvelope<T> | T | null | undefined, fallback: T): T {
  if (value === null || value === undefined) return fallback;

  if (typeof value === 'object' && 'payload' in (value as object)) {
    const envelope = value as ApiEnvelope<T>;
    return (envelope.payload ?? fallback) as T;
  }

  return value as T;
}
