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
      account_status: {
        Row: {
          force_logout_at: string | null
          reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          force_logout_at?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          force_logout_at?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_staff: boolean
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_staff?: boolean
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_email?: string
          customer_name?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_events: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device: string | null
          id: string
          ip: string | null
          os: string | null
          region: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          ip?: string | null
          os?: string | null
          region?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          ip?: string | null
          os?: string | null
          region?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      shipment_events: {
        Row: {
          id: string
          location: string | null
          note: string | null
          occurred_at: string
          shipment_id: string
          status: Database["public"]["Enums"]["shipment_status"]
        }
        Insert: {
          id?: string
          location?: string | null
          note?: string | null
          occurred_at?: string
          shipment_id: string
          status: Database["public"]["Enums"]["shipment_status"]
        }
        Update: {
          id?: string
          location?: string | null
          note?: string | null
          occurred_at?: string
          shipment_id?: string
          status?: Database["public"]["Enums"]["shipment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "shipment_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          confirmed_at: string | null
          contents: string | null
          created_at: string
          currency: string
          customs_instructions: string | null
          declared_value: number | null
          dest_city: string
          dest_code: string | null
          dest_country: string
          eta: string | null
          height_cm: number | null
          id: string
          kind: Database["public"]["Enums"]["service_kind"]
          length_cm: number | null
          level: Database["public"]["Enums"]["service_level"]
          origin_city: string
          origin_code: string | null
          origin_country: string
          paid_at: string | null
          payment_method: string | null
          pickup_at: string | null
          pieces: number
          price_cents: number
          progress: number
          recipient_address: string
          recipient_email: string | null
          recipient_name: string
          recipient_phone: string | null
          sender_address: string | null
          sender_email: string | null
          sender_name: string
          sender_phone: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          stripe_session_id: string | null
          tracking_number: string
          transfer_method: string | null
          transfer_reference: string | null
          transfer_submitted_at: string | null
          updated_at: string
          user_id: string | null
          weight_kg: number
          width_cm: number | null
        }
        Insert: {
          confirmed_at?: string | null
          contents?: string | null
          created_at?: string
          currency?: string
          customs_instructions?: string | null
          declared_value?: number | null
          dest_city: string
          dest_code?: string | null
          dest_country: string
          eta?: string | null
          height_cm?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["service_kind"]
          length_cm?: number | null
          level?: Database["public"]["Enums"]["service_level"]
          origin_city: string
          origin_code?: string | null
          origin_country: string
          paid_at?: string | null
          payment_method?: string | null
          pickup_at?: string | null
          pieces?: number
          price_cents?: number
          progress?: number
          recipient_address: string
          recipient_email?: string | null
          recipient_name: string
          recipient_phone?: string | null
          sender_address?: string | null
          sender_email?: string | null
          sender_name: string
          sender_phone?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          stripe_session_id?: string | null
          tracking_number: string
          transfer_method?: string | null
          transfer_reference?: string | null
          transfer_submitted_at?: string | null
          updated_at?: string
          user_id?: string | null
          weight_kg?: number
          width_cm?: number | null
        }
        Update: {
          confirmed_at?: string | null
          contents?: string | null
          created_at?: string
          currency?: string
          customs_instructions?: string | null
          declared_value?: number | null
          dest_city?: string
          dest_code?: string | null
          dest_country?: string
          eta?: string | null
          height_cm?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["service_kind"]
          length_cm?: number | null
          level?: Database["public"]["Enums"]["service_level"]
          origin_city?: string
          origin_code?: string | null
          origin_country?: string
          paid_at?: string | null
          payment_method?: string | null
          pickup_at?: string | null
          pieces?: number
          price_cents?: number
          progress?: number
          recipient_address?: string
          recipient_email?: string | null
          recipient_name?: string
          recipient_phone?: string | null
          sender_address?: string | null
          sender_email?: string | null
          sender_name?: string
          sender_phone?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          stripe_session_id?: string | null
          tracking_number?: string
          transfer_method?: string | null
          transfer_reference?: string | null
          transfer_submitted_at?: string | null
          updated_at?: string
          user_id?: string | null
          weight_kg?: number
          width_cm?: number | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          currency: string
          id: number
          rates: Json
          transfer_details: Json
          updated_at: string
        }
        Insert: {
          currency?: string
          id?: number
          rates?: Json
          transfer_details?: Json
          updated_at?: string
        }
        Update: {
          currency?: string
          id?: number
          rates?: Json
          transfer_details?: Json
          updated_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          attachments: string[]
          created_at: string
          id: string
          message: string
          request_id: string
          sender_type: string
        }
        Insert: {
          attachments?: string[]
          created_at?: string
          id?: string
          message: string
          request_id: string
          sender_type: string
        }
        Update: {
          attachments?: string[]
          created_at?: string
          id?: string
          message?: string
          request_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          channel: string
          created_at: string
          email: string
          id: string
          message: string
          name: string
          public_reference: string
          status: string
          topic: string
          tracking_number: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          public_reference: string
          status?: string
          topic: string
          tracking_number?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          public_reference?: string
          status?: string
          topic?: string
          tracking_number?: string | null
        }
        Relationships: []
      }
      advert_requests: {
        Row: {
          brand_name: string
          brand_url: string | null
          budget: string
          campaign_end: string
          campaign_start: string
          contact_name: string
          created_at: string
          creative_url: string | null
          description: string
          email: string
          headline: string
          id: string
          landing_url: string
          status: string
          updated_at: string
        }
        Insert: {
          brand_name: string
          brand_url?: string | null
          budget: string
          campaign_end: string
          campaign_start: string
          contact_name: string
          created_at?: string
          creative_url?: string | null
          description: string
          email: string
          headline: string
          id?: string
          landing_url: string
          status?: string
          updated_at?: string
        }
        Update: {
          brand_name?: string
          brand_url?: string | null
          budget?: string
          campaign_end?: string
          campaign_start?: string
          contact_name?: string
          created_at?: string
          creative_url?: string | null
          description?: string
          email?: string
          headline?: string
          id?: string
          landing_url?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      tracking_lookups: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device: string | null
          id: string
          ip: string | null
          os: string | null
          region: string | null
          shipment_id: string
          user_agent: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          ip?: string | null
          os?: string | null
          region?: string | null
          shipment_id: string
          user_agent?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          ip?: string | null
          os?: string | null
          region?: string | null
          shipment_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_lookups_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_role: {
        Args: { _make_admin: boolean; _user_id: string }
        Returns: undefined
      }
      get_pricing_settings: {
        Args: never
        Returns: {
          currency: string
          rates: Json
        }[]
      }
      get_transfer_details: { Args: never; Returns: Json }
      get_active_advertisements: {
        Args: never
        Returns: {
          brand_name: string
          creative_url: string | null
          description: string
          headline: string
          id: string
          landing_url: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_blocked: { Args: { _user_id: string }; Returns: boolean }
      send_live_message: {
        Args: { _body: string; _staff?: boolean; _thread: string }
        Returns: string
      }
      start_live_chat: { Args: never; Returns: string }
      get_support_conversation: {
        Args: { _reference: string }
        Returns: {
          message: string | null
          message_created_at: string | null
          attachments: string[]
          name: string
          reference: string
          request_created_at: string
          sender_type: string | null
          status: string
          topic: string
          tracking_number: string | null
        }[]
      }
      reply_support_conversation: {
        Args: { _attachments?: string[]; _message: string; _reference: string }
        Returns: string
      }
      admin_reply_support_conversation: {
        Args: { _attachments?: string[]; _message: string; _request: string }
        Returns: string
      }
      admin_delete_support_message: {
        Args: { _message: string }
        Returns: string[]
      }
      admin_delete_support_conversation: {
        Args: { _request: string }
        Returns: string[]
      }
      admin_delete_live_chat_message: {
        Args: { _message: string }
        Returns: undefined
      }
      submit_support_request: {
        Args: {
          _channel: string
          _email: string
          _message: string
          _name: string
          _topic: string
          _tracking: string
        }
        Returns: string
      }
      submit_advert_request: {
        Args: {
          _brand_name: string
          _brand_url: string
          _budget: string
          _campaign_end: string
          _campaign_start: string
          _contact_name: string
          _creative_url: string
          _description: string
          _email: string
          _headline: string
          _landing_url: string
        }
        Returns: string
      }
      submit_transfer: {
        Args: { _method: string; _reference: string; _shipment: string }
        Returns: undefined
      }
      track_shipment: {
        Args: { _tracking: string }
        Returns: {
          created_at: string
          dest_city: string
          dest_code: string
          dest_country: string
          eta: string
          kind: Database["public"]["Enums"]["service_kind"]
          level: Database["public"]["Enums"]["service_level"]
          origin_city: string
          origin_code: string
          origin_country: string
          pieces: number
          progress: number
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_number: string
          weight_kg: number
        }[]
      }
      track_shipment_events: {
        Args: { _tracking: string }
        Returns: {
          location: string
          note: string
          occurred_at: string
          status: Database["public"]["Enums"]["shipment_status"]
        }[]
      }
      track_shipment_notice: { Args: { _tracking: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "staff" | "user"
      service_kind: "courier" | "luggage" | "freight"
      service_level: "express" | "standard" | "economy"
      shipment_status:
        | "booked"
        | "picked_up"
        | "in_transit"
        | "customs"
        | "out_for_delivery"
        | "delivered"
        | "exception"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "user"],
      service_kind: ["courier", "luggage", "freight"],
      service_level: ["express", "standard", "economy"],
      shipment_status: [
        "booked",
        "picked_up",
        "in_transit",
        "customs",
        "out_for_delivery",
        "delivered",
        "exception",
      ],
    },
  },
} as const
