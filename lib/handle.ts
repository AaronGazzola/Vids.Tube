export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 30;
export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

export const HANDLE_REQUIREMENT =
  "Handles use 3–30 lowercase letters, numbers, or underscores.";

export const RESERVED_HANDLES = new Set([
  "admin",
  "studio",
  "account",
  "live",
  "watch",
  "api",
  "auth",
  "login",
  "signup",
  "verify",
  "onboarding",
  "settings",
]);

export function normalizeHandle(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidHandle(value: string): boolean {
  return HANDLE_PATTERN.test(value);
}

export function isReservedHandle(value: string): boolean {
  return RESERVED_HANDLES.has(value);
}

export function validateHandle(value: string): string | null {
  const handle = normalizeHandle(value);
  if (!isValidHandle(handle)) {
    return HANDLE_REQUIREMENT;
  }
  if (isReservedHandle(handle)) {
    return "That handle is unavailable.";
  }
  return null;
}
