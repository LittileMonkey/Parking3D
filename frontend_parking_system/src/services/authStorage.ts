const key = "parking.remembered";
const keys = ["parking.accessToken", "parking.refreshToken", "parking.user"];
const marker = "parking.rememberedId";
type Remembered = { id: string; expiresAt: number; values: Record<string, string> };
function remembered(): Remembered | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null") as Remembered | null;
    if (value && value.expiresAt > Date.now() && value.values) return value;
  } catch { /* Unavailable or invalid storage falls back to this tab. */ }
  try { localStorage.removeItem(key); } catch { /* private browsing */ }
  return null;
}
export function clearSession() {
  keys.forEach(k => sessionStorage.removeItem(k));
  sessionStorage.removeItem(marker);
  try { localStorage.removeItem(key); } catch { /* private browsing */ }
}
export function beginSession(remember: boolean) {
  clearSession();
  if (remember) {
    try {
      const id = `${Date.now()}-${Math.random()}`;
      sessionStorage.setItem(marker, id);
      localStorage.setItem(key, JSON.stringify({ id, expiresAt: Date.now() + 7 * 86400000, values: {} }));
    }
    catch { /* The session remains available in this tab. */ }
  }
}
export function restoreSession() {
  if (sessionStorage.getItem("parking.accessToken")) return;
  const value = remembered();
  if (value) {
    sessionStorage.setItem(marker, value.id);
    keys.forEach(k => { if (typeof value.values[k] === "string") sessionStorage.setItem(k, value.values[k]); });
  }
}
export const authStorage = {
  getItem: (name: string) => sessionStorage.getItem(name),
  setItem(name: string, value: string) {
    sessionStorage.setItem(name, value);
    const saved = remembered();
    if (saved && saved.id === sessionStorage.getItem(marker) && keys.includes(name)) {
      saved.values[name] = value;
      try { localStorage.setItem(key, JSON.stringify(saved)); } catch { /* private browsing */ }
    }
  },
  removeItem(name: string) {
    sessionStorage.removeItem(name);
    const saved = remembered();
    if (saved && saved.id === sessionStorage.getItem(marker)) { delete saved.values[name]; try { localStorage.setItem(key, JSON.stringify(saved)); } catch { /* private browsing */ } }
  }
};
