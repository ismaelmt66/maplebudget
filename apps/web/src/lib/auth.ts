/**
 * Authentication utilities: token storage and retrieval.
 */
const KEY = "maplebudget_token";

/**
 * Retrieve the JWT token from local storage.
 * Returns null if not found or if running on the server.
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

/**
 * Store the JWT token in local storage.
 */
export function setToken(token: string) {
  localStorage.setItem(KEY, token);
}

/**
 * Remove the JWT token from local storage.
 */
export function clearToken() {
  localStorage.removeItem(KEY);
}