export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      channels: {
        Row: {
          id: string;
          owner_user_id: string;
          slug: string;
          name: string;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          slug: string;
          name: string;
          description?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          slug?: string;
          name?: string;
          description?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
