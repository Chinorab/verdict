"use client";

import { eraseDatabase } from "./db";

/**
  Delete everything Verdict keeps on this device (FR-032): the trial database (photos,
  overlays, measurements, trials), the app's offline caches and its local storage keys.
  Photos already sent for analysis follow the provider's retention, explained on the privacy page.
*/
export async function eraseEverything(): Promise<void> {
  await eraseDatabase();
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("verdict")).map((k) => caches.delete(k)));
    }
  } catch {
    // Cache Storage blocked: nothing of ours can be in it either.
  }
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("verdict")) localStorage.removeItem(k);
    for (const k of Object.keys(sessionStorage)) if (k.startsWith("verdict")) sessionStorage.removeItem(k);
  } catch {
    // Storage blocked: nothing to remove.
  }
}
