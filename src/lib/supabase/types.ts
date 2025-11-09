// lib/supabase/types.ts
// Auto-generated types for your Supabase schema.
// You can replace this stub with the real generated types from Supabase.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          status: "incomplete_registration" | "under_review" | "agreement_pending" | "active" | "inactive" | "draft" | "suspended";
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          status?: Database["public"]["Tables"]["profiles"]["Row"]["status"];
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };

      onboarding: {
        Row: {
          user_id: string;
          step: number | null;
          data: Json | null;
          status: Database["public"]["Tables"]["profiles"]["Row"]["status"] | null;
          onboarding_completed: boolean | null;
        };
        Insert: {
          user_id: string;
          step?: number | null;
          data?: Json | null;
          status?: Database["public"]["Tables"]["profiles"]["Row"]["status"] | null;
          onboarding_completed?: boolean | null;
        };
        Update: Partial<Database["public"]["Tables"]["onboarding"]["Insert"]>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
