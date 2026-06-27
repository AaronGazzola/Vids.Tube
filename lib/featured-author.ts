import type { AuthorIdentity, FeaturedAuthor } from "@/app/layout.types";

export function youtubeAuthor(
  name: string | null,
  avatarUrl: string | null
): FeaturedAuthor {
  return {
    name: name ?? "YouTube viewer",
    handle: null,
    avatarUrl,
    avatarPath: null,
  };
}

export function vidstubeAuthor(identity: AuthorIdentity): FeaturedAuthor | null {
  if (!identity) {
    return null;
  }
  return {
    name: identity.handle,
    handle: identity.handle,
    avatarUrl: null,
    avatarPath: identity.avatarPath,
  };
}

export function authorFromRow(
  origin: string,
  fields: {
    author_name: string | null;
    author_avatar_url: string | null;
  },
  identity: AuthorIdentity
): FeaturedAuthor | null {
  if (origin === "youtube") {
    return youtubeAuthor(fields.author_name, fields.author_avatar_url);
  }
  return vidstubeAuthor(identity);
}
