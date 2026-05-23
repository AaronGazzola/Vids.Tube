export const ENV = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
};

export function getBrowserAPI<T>(accessor: () => T): T | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return accessor();
}
