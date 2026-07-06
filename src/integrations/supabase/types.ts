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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          config_key: string
          config_value: Json
          description: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          description?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          description?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cotisations: {
        Row: {
          created_at: string
          id: string
          member_id: string | null
          methode: string | null
          montant: number
          paye_le: string | null
          periode: string
          reference: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id?: string | null
          methode?: string | null
          montant?: number
          paye_le?: string | null
          periode: string
          reference?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string | null
          methode?: string | null
          montant?: number
          paye_le?: string | null
          periode?: string
          reference?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotisations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          member_id: string | null
          mime_type: string | null
          offline_available: boolean
          title: string | null
          type: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          member_id?: string | null
          mime_type?: string | null
          offline_available?: boolean
          title?: string | null
          type: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          member_id?: string | null
          mime_type?: string | null
          offline_available?: boolean
          title?: string | null
          type?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          adresse: string | null
          ayants_droit: string | null
          cni: string | null
          collectivite: string | null
          created_at: string
          date_embauche: string | null
          date_inscription: string | null
          date_naissance: string | null
          direction: string | null
          droits_ouverts_le: string | null
          ecole: string | null
          email: string | null
          fonction: string | null
          frais_paye: boolean
          id: string
          last_cotisation_at: string | null
          lieu_naissance: string | null
          matricule: string | null
          matricule_pro: string | null
          nationalite: string | null
          nom: string
          paiement_methode: string | null
          payment_confirmed_at: string | null
          payment_reference: string | null
          photo_url: string | null
          prenoms: string
          qr_code: string | null
          region: string | null
          sexe: string | null
          source: string
          statut: string
          step_completed: number
          suspended_reason: string | null
          telephone: string | null
          type_membre: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          adresse?: string | null
          ayants_droit?: string | null
          cni?: string | null
          collectivite?: string | null
          created_at?: string
          date_embauche?: string | null
          date_inscription?: string | null
          date_naissance?: string | null
          direction?: string | null
          droits_ouverts_le?: string | null
          ecole?: string | null
          email?: string | null
          fonction?: string | null
          frais_paye?: boolean
          id?: string
          last_cotisation_at?: string | null
          lieu_naissance?: string | null
          matricule?: string | null
          matricule_pro?: string | null
          nationalite?: string | null
          nom?: string
          paiement_methode?: string | null
          payment_confirmed_at?: string | null
          payment_reference?: string | null
          photo_url?: string | null
          prenoms?: string
          qr_code?: string | null
          region?: string | null
          sexe?: string | null
          source?: string
          statut?: string
          step_completed?: number
          suspended_reason?: string | null
          telephone?: string | null
          type_membre?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          adresse?: string | null
          ayants_droit?: string | null
          cni?: string | null
          collectivite?: string | null
          created_at?: string
          date_embauche?: string | null
          date_inscription?: string | null
          date_naissance?: string | null
          direction?: string | null
          droits_ouverts_le?: string | null
          ecole?: string | null
          email?: string | null
          fonction?: string | null
          frais_paye?: boolean
          id?: string
          last_cotisation_at?: string | null
          lieu_naissance?: string | null
          matricule?: string | null
          matricule_pro?: string | null
          nationalite?: string | null
          nom?: string
          paiement_methode?: string | null
          payment_confirmed_at?: string | null
          payment_reference?: string | null
          photo_url?: string | null
          prenoms?: string
          qr_code?: string | null
          region?: string | null
          sexe?: string | null
          source?: string
          statut?: string
          step_completed?: number
          suspended_reason?: string | null
          telephone?: string | null
          type_membre?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      news: {
        Row: {
          author_id: string | null
          body: string
          category: string | null
          cover_url: string | null
          created_at: string
          id: string
          illustrations: string[]
          image_url: string | null
          meta_description: string | null
          meta_title: string | null
          published: boolean
          published_at: string | null
          slug: string | null
          status: string
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: string
          category?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          illustrations?: string[]
          image_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          published?: boolean
          published_at?: string | null
          slug?: string | null
          status?: string
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          category?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          illustrations?: string[]
          image_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          published?: boolean
          published_at?: string | null
          slug?: string | null
          status?: string
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      opportunites: {
        Row: {
          body: string | null
          category: string | null
          cover_url: string | null
          created_at: string
          date_limite: string | null
          description: string
          id: string
          illustrations: string[]
          lieu: string | null
          meta_description: string | null
          meta_title: string | null
          published: boolean
          slug: string | null
          summary: string | null
          tags: string[]
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          category?: string | null
          cover_url?: string | null
          created_at?: string
          date_limite?: string | null
          description?: string
          id?: string
          illustrations?: string[]
          lieu?: string | null
          meta_description?: string | null
          meta_title?: string | null
          published?: boolean
          slug?: string | null
          summary?: string | null
          tags?: string[]
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          category?: string | null
          cover_url?: string | null
          created_at?: string
          date_limite?: string | null
          description?: string
          id?: string
          illustrations?: string[]
          lieu?: string | null
          meta_description?: string | null
          meta_title?: string | null
          published?: boolean
          slug?: string | null
          summary?: string | null
          tags?: string[]
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          member_id: string | null
          montant_total: number
          operateur: string | null
          paid_at: string | null
          part_miprojet: number
          part_mutuelle: number
          periode: string | null
          reference_transaction: string | null
          source: string
          statut_paiement: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id?: string | null
          montant_total?: number
          operateur?: string | null
          paid_at?: string | null
          part_miprojet?: number
          part_mutuelle?: number
          periode?: string | null
          reference_transaction?: string | null
          source?: string
          statut_paiement?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string | null
          montant_total?: number
          operateur?: string | null
          paid_at?: string | null
          part_miprojet?: number
          part_mutuelle?: number
          periode?: string | null
          reference_transaction?: string | null
          source?: string
          statut_paiement?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          collectivite: string | null
          created_at: string
          id: string
          region: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          collectivite?: string | null
          created_at?: string
          id?: string
          region?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          collectivite?: string | null
          created_at?: string
          id?: string
          region?: string | null
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
      current_user_dashboard_path: { Args: never; Returns: string }
      dashboard_path_for: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      resolve_login_email: { Args: { p_identifier: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "membre"
        | "super_admin"
        | "admin_national"
        | "admin_regional"
        | "admin_local"
        | "agent_saisie"
        | "president"
        | "secretaire_general"
        | "tresorier_national"
        | "commissaire_comptes"
        | "directeur_executif"
        | "comite_controle"
        | "conseil_sages"
        | "secretaire_regional"
        | "tresorier_regional"
        | "delegue_section"
        | "miprojet_admin"
        | "miprojet_viewer"
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

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: [
        "membre",
        "super_admin",
        "admin_national",
        "admin_regional",
        "admin_local",
        "agent_saisie",
        "president",
        "secretaire_general",
        "tresorier_national",
        "commissaire_comptes",
        "directeur_executif",
        "comite_controle",
        "conseil_sages",
        "secretaire_regional",
        "tresorier_regional",
        "delegue_section",
        "miprojet_admin",
        "miprojet_viewer",
      ],
    },
  },
} as const
