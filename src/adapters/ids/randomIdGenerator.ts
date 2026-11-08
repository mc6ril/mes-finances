const fallbackId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const randomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return fallbackId();
};
