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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      checkins: {
        Row: {
          created_at: string
          due_at: string
          id: number
          latitude: number | null
          longitude: number | null
          responded_at: string | null
          response_message: string | null
          sent_at: string
          status: Database["public"]["Enums"]["checkin_status"]
          trip_id: number
          updated_at: string
          user_id: string
          vibration_sent: boolean | null
        }
        Insert: {
          created_at?: string
          due_at: string
          id?: never
          latitude?: number | null
          longitude?: number | null
          responded_at?: string | null
          response_message?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["checkin_status"]
          trip_id: number
          updated_at?: string
          user_id: string
          vibration_sent?: boolean | null
        }
        Update: {
          created_at?: string
          due_at?: string
          id?: never
          latitude?: number | null
          longitude?: number | null
          responded_at?: string | null
          response_message?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["checkin_status"]
          trip_id?: number
          updated_at?: string
          user_id?: string
          vibration_sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: number
          is_active: boolean | null
          name: string
          notify_on_escalation: boolean | null
          notify_on_safetogether: boolean | null
          notify_on_trip_end: boolean | null
          notify_on_trip_start: boolean | null
          phone_number: string
          priority: number | null
          relationship: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: never
          is_active?: boolean | null
          name: string
          notify_on_escalation?: boolean | null
          notify_on_safetogether?: boolean | null
          notify_on_trip_end?: boolean | null
          notify_on_trip_start?: boolean | null
          phone_number: string
          priority?: number | null
          relationship?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: never
          is_active?: boolean | null
          name?: string
          notify_on_escalation?: boolean | null
          notify_on_safetogether?: boolean | null
          notify_on_trip_end?: boolean | null
          notify_on_trip_start?: boolean | null
          phone_number?: string
          priority?: number | null
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          id: number
          ip_address: string | null
          metadata: Json | null
          trip_id: number | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["event_type"]
          id?: never
          ip_address?: string | null
          metadata?: Json | null
          trip_id?: number | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: never
          ip_address?: string | null
          metadata?: Json | null
          trip_id?: number | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nearby_presences: {
        Row: {
          created_at: string
          destination_latitude: number | null
          destination_longitude: number | null
          expires_at: string
          id: number
          is_visible: boolean | null
          last_seen_at: string
          latitude: number
          location: unknown
          longitude: number
          trip_id: number
          updated_at: string
          user_id: string
          visible_radius_meters: number | null
        }
        Insert: {
          created_at?: string
          destination_latitude?: number | null
          destination_longitude?: number | null
          expires_at: string
          id?: never
          is_visible?: boolean | null
          last_seen_at?: string
          latitude: number
          location: unknown
          longitude: number
          trip_id: number
          updated_at?: string
          user_id: string
          visible_radius_meters?: number | null
        }
        Update: {
          created_at?: string
          destination_latitude?: number | null
          destination_longitude?: number | null
          expires_at?: string
          id?: never
          is_visible?: boolean | null
          last_seen_at?: string
          latitude?: number
          location?: unknown
          longitude?: number
          trip_id?: number
          updated_at?: string
          user_id?: string
          visible_radius_meters?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nearby_presences_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nearby_presences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          data_retention_days: number | null
          default_checkin_interval_minutes: number | null
          default_trip_mode: Database["public"]["Enums"]["trip_mode"] | null
          full_name: string | null
          id: string
          panic_button_enabled: boolean | null
          phone_number: string | null
          safetogether_enabled: boolean | null
          share_approximate_location: boolean | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          data_retention_days?: number | null
          default_checkin_interval_minutes?: number | null
          default_trip_mode?: Database["public"]["Enums"]["trip_mode"] | null
          full_name?: string | null
          id: string
          panic_button_enabled?: boolean | null
          phone_number?: string | null
          safetogether_enabled?: boolean | null
          share_approximate_location?: boolean | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          data_retention_days?: number | null
          default_checkin_interval_minutes?: number | null
          default_trip_mode?: Database["public"]["Enums"]["trip_mode"] | null
          full_name?: string | null
          id?: string
          panic_button_enabled?: boolean | null
          phone_number?: string | null
          safetogether_enabled?: boolean | null
          share_approximate_location?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          checkin_interval_minutes: number
          completed_at: string | null
          created_at: string
          destination_address: string | null
          destination_latitude: number | null
          destination_longitude: number | null
          escalated_at: string | null
          escalation_notified: boolean | null
          id: number
          last_known_latitude: number | null
          last_known_longitude: number | null
          last_location_update_at: string | null
          missed_checkins_count: number | null
          mode: Database["public"]["Enums"]["trip_mode"]
          origin_address: string | null
          origin_latitude: number | null
          origin_longitude: number | null
          paired_at: string | null
          paired_with_user_id: string | null
          safetogether_enabled: boolean | null
          started_at: string
          status: Database["public"]["Enums"]["trip_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          checkin_interval_minutes?: number
          completed_at?: string | null
          created_at?: string
          destination_address?: string | null
          destination_latitude?: number | null
          destination_longitude?: number | null
          escalated_at?: string | null
          escalation_notified?: boolean | null
          id?: never
          last_known_latitude?: number | null
          last_known_longitude?: number | null
          last_location_update_at?: string | null
          missed_checkins_count?: number | null
          mode?: Database["public"]["Enums"]["trip_mode"]
          origin_address?: string | null
          origin_latitude?: number | null
          origin_longitude?: number | null
          paired_at?: string | null
          paired_with_user_id?: string | null
          safetogether_enabled?: boolean | null
          started_at?: string
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          checkin_interval_minutes?: number
          completed_at?: string | null
          created_at?: string
          destination_address?: string | null
          destination_latitude?: number | null
          destination_longitude?: number | null
          escalated_at?: string | null
          escalation_notified?: boolean | null
          id?: never
          last_known_latitude?: number | null
          last_known_longitude?: number | null
          last_location_update_at?: string | null
          missed_checkins_count?: number | null
          mode?: Database["public"]["Enums"]["trip_mode"]
          origin_address?: string | null
          origin_latitude?: number | null
          origin_longitude?: number | null
          paired_at?: string | null
          paired_with_user_id?: string | null
          safetogether_enabled?: boolean | null
          started_at?: string
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_paired_with_user_id_fkey"
            columns: ["paired_with_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_user_id_fkey"
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
      find_nearby_users: {
        Args: {
          current_user_lat: number
          current_user_lng: number
          radius_meters?: number
        }
        Returns: {
          destination_latitude: number
          destination_longitude: number
          distance_meters: number
          latitude: number
          longitude: number
          trip_id: number
          user_id: string
        }[]
      }
      cleanup_old_data: {
        Args: never
        Returns: undefined
      }
    }
    Enums: {
      checkin_status: "pending" | "responded_ok" | "responded_help" | "missed"
      event_type:
        | "trip_started"
        | "trip_completed"
        | "trip_cancelled"
        | "trip_escalated"
        | "checkin_sent"
        | "checkin_responded"
        | "checkin_missed"
        | "emergency_contact_notified"
        | "safetogether_paired"
        | "safetogether_unpaired"
        | "location_shared"
        | "panic_button_pressed"
      trip_mode: "silent" | "interval" | "continuous"
      trip_status: "active" | "completed" | "escalated" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

