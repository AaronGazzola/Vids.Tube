export type OverlayInstallation = {
  installId: string;
  entryUrl: string;
  token: string;
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
