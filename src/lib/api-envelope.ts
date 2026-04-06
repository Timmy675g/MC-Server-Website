import type { ApiEnvelope } from '../types/api';

export function unwrapPayload<T>(value: ApiEnvelope<T> | T): T {
  if (value && typeof value === 'object' && 'payload' in (value as object)) {
    return ((value as ApiEnvelope<T>).payload ?? value) as T;
  }

  return value as T;
}
