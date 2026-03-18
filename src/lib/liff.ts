import liff from "@line/liff";

let initialized = false;

export type LiffProfile = {
  displayName: string;
  pictureUrl?: string;
  userId: string;
};

/**
 * Initialize LIFF. Safe to call multiple times — only runs once.
 * Returns the ?screen= parameter value (defaults to "checkin").
 */
export async function initLiff(): Promise<string> {
  if (initialized) {
    return getScreenParam();
  }

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) {
    console.warn("LIFF ID not set, running in browser-only mode");
    initialized = true;
    return getScreenParam();
  }

  try {
    await liff.init({ liffId });
    initialized = true;
  } catch (e) {
    console.error("LIFF init failed:", e);
    initialized = true; // still allow fallback
  }

  return getScreenParam();
}

/**
 * Read ?screen= from current URL.
 */
function getScreenParam(): string {
  if (typeof window === "undefined") return "checkin";
  const params = new URLSearchParams(window.location.search);
  return params.get("screen") || "checkin";
}

/**
 * Get the current screen param (no init needed).
 */
export function getScreen(): string {
  return getScreenParam();
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
