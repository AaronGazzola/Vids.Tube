export type OverlayInstallation = {
  installId: string;
  entryUrl: string;
};

export function framedOverlayUrl(
  entryUrl: string,
  installId: string,
  permittedOrigin: string
): string | null {
  if (!entryUrl || !installId || !permittedOrigin) {
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
  entry.searchParams.set("install", installId);
  return entry.toString();
}
