import liff from "@line/liff";

let initialized = false;

export type LiffProfile = {
  displayName: string;
  pictureUrl?: string;
  userId: string;
};

const SS_KEY = "drd_screen";

/**
 * Capture screen param BEFORE liff.init() rewrites the URL.
 * Priority: sessionStorage > ?screen= > #hash > default
 */
function captureScreenParam(): string {
  if (typeof window === "undefined") return "checkin";

  // 1. Already saved in sessionStorage (survives liff.init redirect)
  const saved = sessionStorage.getItem(SS_KEY);
  if (saved) return saved;

  // 2. Query parameter ?screen=xxx
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("screen");
  if (fromQuery) {
    sessionStorage.setItem(SS_KEY, fromQuery);
    return fromQuery;
  }

  // 3. Hash fallback #seat, #timer, etc.
  const hash = window.location.hash.replace("#", "");
  if (hash) {
    sessionStorage.setItem(SS_KEY, hash);
    return hash;
  }

  // 4. Path-based: /seat, /timer (when LIFF endpoint includes path)
  const path = window.location.pathname.split("/").filter(Boolean).pop();
  if (path && path !== "" && path !== "index") {
    sessionStorage.setItem(SS_KEY, path);
    return path;
  }

  return "checkin";
}

/**
 * Initialize LIFF. Safe to call multiple times — only runs once.
 * Returns the screen parameter value (defaults to "checkin").
 */
export async function initLiff(): Promise<string> {
  // Capture BEFORE init (critical — liff.init strips query params)
  const screen = captureScreenParam();

  if (initialized) return screen;

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) {
    console.warn("LIFF ID not set, running in browser-only mode");
    initialized = true;
    return screen;
  }

  try {
    await liff.init({ liffId });
    initialized = true;
  } catch (e) {
    console.error("LIFF init failed:", e);
    initialized = true;
  }

  return screen;
}

/**
 * Get the current screen param (no init needed).
 */
export function getScreen(): string {
  return captureScreenParam();
}

/**
 * Clear saved screen (call when navigating away or resetting).
 */
export function clearScreen(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SS_KEY);
  }
}

/**
 * Whether running inside LIFF (LINE in-app browser).
 */
export function isInLiff(): boolean {
  try {
    return liff.isInClient();
  } catch {
    return false;
  }
}

/**
 * Get LINE profile. Returns null outside LIFF or if not logged in.
 */
export async function getProfile(): Promise<LiffProfile | null> {
  try {
    if (!liff.isLoggedIn()) return null;
    const profile = await liff.getProfile();
    return {
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
      userId: profile.userId,
    };
  } catch {
    return null;
  }
}

/**
 * Close the LIFF window (only works inside LINE).
 */
export function closeLiff(): void {
  try {
    if (liff.isInClient()) {
      liff.closeWindow();
    }
  } catch {
    // ignore outside LIFF
  }
}
