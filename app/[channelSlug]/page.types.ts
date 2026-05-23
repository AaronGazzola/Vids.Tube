import type { Database } from "@/supabase/types";

export type Channel = Database["public"]["Tables"]["channels"]["Row"];
