import liff from "@line/liff";

let initialized = false;

export type LiffProfile = {
  displayName: string;
  pictureUrl?: string;
  userId: string;
};

const SS_KEY = "den-screen";
const VALID_SCREENS = ["checkin", "seat", "drd", "timer", "report", "settings"];

/** Fully decoded URL for debug display */
export let debugDecoded = "";

/**
 * Extract screen name from current URL.
 * Handles double/triple-encoded liff.state values.
 */
function extractScreen(): string {
  if (typeof window === "undefined") return "checkin";

  const fullUrl = window.location.href;
  console.log("[LIFF Router] href:", fullUrl);

  // Fully decode URL (up to 3 levels for liff.state double-encoding)
  let decoded = fullUrl;
  for (let i = 0; i < 3; i++) {
    try { decoded = decodeURIComponent(decoded); } catch { break; }
  }
  debugDecoded = decoded;
  console.log("[LIFF Router] decoded:", decoded);

  // 1. Scan fully-decoded URL for screen names (handles any encoding depth)
  // Check longer names first to avoid substring false matches
  const sortedScreens = [...VALID_SCREENS].sort((a, b) => b.length - a.length);
  for (const s of sortedScreens) {
    // Match /seat, =seat, ?seat but not partial matches (e.g. "seated")
    const pattern = new RegExp(`[/=?&]${s}(?=[/&#?]|$)`);
    if (pattern.test(decoded)) {
      console.log("[LIFF Router] from decoded URL scan:", s);
      return s;
    }
  }

  // 2. ?screen= parameter (normal browser)
  const params = new URLSearchParams(window.location.search);
  const screen = params.get("screen");
  if (screen && VALID_SCREENS.includes(screen)) {
    console.log("[LIFF Router] from ?screen=", screen);
    return screen;
  }

  // 3. liff.state parameter with recursive decode
  let liffState = params.get("liff.state") || "";
  for (let i = 0; i < 3; i++) {
    try { liffState = decodeURIComponent(liffState); } catch { break; }
  }
  for (const s of sortedScreens) {
    if (liffState.includes(s)) {
      console.log("[LIFF Router] from liff.state decode:", s);
      return s;
    }
  }

  // 4. sessionStorage (saved before liff.init redirect)
  const saved = sessionStorage.getItem(SS_KEY);
  if (saved && VALID_SCREENS.includes(saved)) {
    console.log("[LIFF Router] from sessionStorage:", saved);
    sessionStorage.removeItem(SS_KEY);
    return saved;
  }

  // 5. Hash fragment (before & params)
  const hash = window.location.hash.split("&")[0].replace("#", "");
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
