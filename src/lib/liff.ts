import liff from "@line/liff";

let initialized = false;

export type LiffProfile = {
  displayName: string;
  pictureUrl?: string;
  userId: string;
};

const SS_KEY = "den-screen";
const VALID_SCREENS = ["checkin", "seat", "drd", "timer", "report", "settings"];

/**
 * Extract screen name from current URL.
 * Priority:
 *   1. ?screen=xxx (normal browser)
 *   2. ?liff.state=xxx (LIFF redirect)
 *   3. ?seat (liff.state bare value — LIFF puts liff.state as raw query)
 *   4. sessionStorage (saved before liff.init redirect)
 *   5. #hash
 *   6. default: checkin
 */
function extractScreen(): string {
  if (typeof window === "undefined") return "checkin";

  const search = window.location.search;
  const params = new URLSearchParams(search);

  console.log("[LIFF Router] href:", window.location.href);

  // 1. ?screen=xxx
  const screen = params.get("screen");
  if (screen && VALID_SCREENS.includes(screen)) {
    console.log("[LIFF Router] from ?screen=", screen);
    return screen;
  }

  // 2. ?liff.state=xxx
  const liffState = params.get("liff.state");
  if (liffState && VALID_SCREENS.includes(liffState)) {
    console.log("[LIFF Router] from liff.state=", liffState);
    return liffState;
  }

  // 3. Bare query: ?seat → search = "?seat"
  const raw = search.replace("?", "").split("&")[0];
  if (raw && VALID_SCREENS.includes(raw)) {
    console.log("[LIFF Router] from bare query:", raw);
    return raw;
  }

  // 4. sessionStorage (saved before liff.init wiped the URL)
  const saved = sessionStorage.getItem(SS_KEY);
  if (saved && VALID_SCREENS.includes(saved)) {
    console.log("[LIFF Router] from sessionStorage:", saved);
    sessionStorage.removeItem(SS_KEY);
    return saved;
  }

  // 5. Hash: #seat
  const hash = window.location.hash.replace("#", "");
  if (hash && VALID_SCREENS.includes(hash)) {
    console.log("[LIFF Router] from hash:", hash);
    return hash;
  }

  console.log("[LIFF Router] default: checkin");
  return "checkin";
}

/**
 * Initialize LIFF. Safe to call multiple times — only runs once.
 * Returns the screen parameter value (defaults to "checkin").
 */
export async function initLiff(): Promise<string> {
  // Capture BEFORE init (liff.init may redirect and strip params)
  const preInitScreen = extractScreen();
  if (preInitScreen !== "checkin") {
    sessionStorage.setItem(SS_KEY, preInitScreen);
  }

  if (initialized) return preInitScreen;

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) {
    console.warn("LIFF ID not set, running in browser-only mode");
    initialized = true;
    return preInitScreen;
  }

  try {
    await liff.init({ liffId });
    initialized = true;
    console.log("[LIFF Router] liff.init() success, isInClient:", liff.isInClient());
  } catch (e) {
    console.error("LIFF init failed:", e);
    initialized = true;
  }

  // Re-extract after init (URL may have changed)
  const postInitScreen = extractScreen();
  const finalScreen = postInitScreen !== "checkin" ? postInitScreen : preInitScreen;
  console.log("[LIFF Router] final screen:", finalScreen);
  return finalScreen;
}

/**
 * Get the current screen param (no init needed).
 */
export function getScreen(): string {
  return extractScreen();
}

/**
 * Clear saved screen.
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
