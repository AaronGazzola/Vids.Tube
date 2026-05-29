import type { Database } from "@/supabase/types";

export type Video = Database["public"]["Tables"]["videos"]["Row"];
