/** Stable client identity so players can rejoin after refresh/disconnect. */

const TOKEN_KEY = "cc_token";
const NAME_KEY = "cc_name";
const ROOM_KEY = "cc_room";

export function getPlayerToken(): string {
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `t_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

export function getSavedName(): string {
  return localStorage.getItem(NAME_KEY) || "";
}

export function saveName(name: string) {
  localStorage.setItem(NAME_KEY, name.trim().slice(0, 16));
}

export function rememberRoom(code: string | null) {
  if (code) localStorage.setItem(ROOM_KEY, code.toUpperCase());
  else localStorage.removeItem(ROOM_KEY);
}

export function getRememberedRoom(): string | null {
  return localStorage.getItem(ROOM_KEY);
}
