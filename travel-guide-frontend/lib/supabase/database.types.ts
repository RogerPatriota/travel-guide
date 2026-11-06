// Gerado pelo MCP do Supabase (generate_typescript_types) a partir do schema
// em supabase/migrations. Não editar à mão: regenerar quando o schema mudar.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      events: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          detail: string | null
          id: number
          kind: Database["public"]["Enums"]["event_kind"]
          place_id: number | null
          status: Database["public"]["Enums"]["event_status"]
          time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          detail?: string | null
          id?: never
          kind?: Database["public"]["Enums"]["event_kind"]
          place_id?: number | null
          status?: Database["public"]["Enums"]["event_status"]
          time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          detail?: string | null
          id?: never
          kind?: Database["public"]["Enums"]["event_kind"]
          place_id?: number | null
          status?: Database["public"]["Enums"]["event_status"]
          time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["currency"]
          description: string | null
          id: number
          is_planned: boolean
          is_split: boolean
          paid_by: string | null
          spent_on: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency"]
          description?: string | null
          id?: never
          is_planned?: boolean
          is_split?: boolean
          paid_by?: string | null
          spent_on: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency"]
          description?: string | null
          id?: never
          is_planned?: boolean
          is_split?: boolean
          paid_by?: string | null
          spent_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          id: number
          lat: number | null
          lng: number | null
          name: string
          neighborhood: string | null
          notes: string | null
          status: Database["public"]["Enums"]["place_status"]
          updated_at: string
          url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: never
          lat?: number | null
          lng?: number | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["place_status"]
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: never
          lat?: number | null
          lng?: number | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["place_status"]
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string
          place_id: number
          updated_at: string
          user_id: string
          value: Database["public"]["Enums"]["vote_value"]
        }
        Insert: {
          created_at?: string
          place_id: number
          updated_at?: string
          user_id?: string
          value: Database["public"]["Enums"]["vote_value"]
        }
        Update: {
          created_at?: string
          place_id?: number
          updated_at?: string
          user_id?: string
          value?: Database["public"]["Enums"]["vote_value"]
        }
        Relationships: [
          {
            foreignKeyName: "votes_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hook_before_user_created: { Args: { event: Json }; Returns: Json }
    }
    Enums: {
      currency: "BRL" | "ARS" | "USD"
      event_kind: "voo" | "hotel" | "passeio" | "outro"
      event_status: "pago" | "pendente" | "ideia"
      place_status: "ideia" | "decidido" | "descartado"
      vote_value: "curtiu" | "nao_curtiu" | "tanto_faz"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
      currency: ["BRL", "ARS", "USD"],
      event_kind: ["voo", "hotel", "passeio", "outro"],
      event_status: ["pago", "pendente", "ideia"],
      place_status: ["ideia", "decidido", "descartado"],
      vote_value: ["curtiu", "nao_curtiu", "tanto_faz"],
    },
  },
} as const
