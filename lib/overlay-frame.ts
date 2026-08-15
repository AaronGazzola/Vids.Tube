import type { OverlaySettings } from "@/lib/overlay-settings";

export type OverlayInstallation = {
  installId: string;
  entryUrl: string;
  token: string;
  // Carried alongside the token because the two are only meaningful together,
  // and because this is the payload the overlay route already polls: settings
  // therefore reach a running overlay without a query of their own.
  channelId: string;
  settings: OverlaySettings;
};

export function framedOverlayUrl(
  entryUrl: string,
  token: string,
  permittedOrigin: string
): string | null {
  if (!entryUrl || !token || !permittedOrigin) {
    return null;
  }
  let entry: URL;
  let permitted: URL;
  try {
    entry = new URL(entryUrl);
    permitted = new URL(permittedOrigin);
  } catch {
    return null;
  }
  if (entry.origin !== permitted.origin) {
    return null;
  }
  entry.searchParams.set("t", token);
  return entry.toString();
}
