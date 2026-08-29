export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Named alias exports — the codebase imports these directly
// (AppRole, AppPermission, EquipmentItemState, EquipmentRequestStatus, Json)
// and the remaining aliases are used inside the Database interface below.
// Re-derived from the generated enums (the generator does not emit them).
export type AppRole =
  | "club_president"
  | "youth_director"
  | "coach"
  | "admin_finance"
  | "super_admin"

export type AppPermission =
  | "teams.view"
  | "teams.create"
  | "teams.edit"
  | "teams.delete"
  | "athletes.view"
  | "athletes.create"
  | "athletes.edit"
  | "athletes.delete"
  | "athletes.view_sensitive"
  | "athletes.edit_sensitive"
  | "attendance.manage"
  | "youth_finance.view"
  | "youth_finance.manage"
  | "first_team_finance.view"
  | "first_team_finance.manage"
  | "registrations.view"
  | "registrations.manage"
  | "contracts.view"
  | "contracts.manage"
  | "documents.view"
  | "documents.manage"
  | "sponsors.view"
  | "sponsors.manage"
  | "staff.view"
  | "staff.manage"
  | "reports.view"
  | "reports.export"
  | "club_settings.manage"
  | "notifications.manage"
  | "seasons.view"
  | "seasons.manage"
  | "equipment.view"
  | "equipment.report"
  | "equipment.manage"
  | "medical.view"

export type SportType = "football" | "basketball"

export type DocumentType =
  | "registration"
  | "contract"
  | "medical"
  | "insurance"
  | "identity"
  | "federation"
  | "custom"

export type ContractStatus = "draft" | "active" | "terminated" | "expired"

export type EquipmentItemState =
  | "missing"
  | "issued"
  | "returned"
  | "lost"
  | "damaged"

export type EquipmentRequestStatus =
  | "requested"
  | "approved"
  | "purchased"
  | "rejected"

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      athlete_equipment: {
        Row: {
          athlete_id: string
          created_at: string | null
          equipment_type_id: string
          id: string
          issued_at: string | null
          note: string | null
          organization_id: string
          returned_at: string | null
          size_value: string | null
          size_value_upper: string | null
          state: Database["public"]["Enums"]["equipment_item_state"]
          updated_at: string | null
        }
        Insert: {
          athlete_id: string
          created_at?: string | null
          equipment_type_id: string
          id?: string
          issued_at?: string | null
          note?: string | null
          organization_id: string
          returned_at?: string | null
          size_value?: string | null
          size_value_upper?: string | null
          state?: Database["public"]["Enums"]["equipment_item_state"]
          updated_at?: string | null
        }
        Update: {
          athlete_id?: string
          created_at?: string | null
          equipment_type_id?: string
          id?: string
          issued_at?: string | null
          note?: string | null
          organization_id?: string
          returned_at?: string | null
          size_value?: string | null
          size_value_upper?: string | null
          state?: Database["public"]["Enums"]["equipment_item_state"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_equipment_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_equipment_athlete_org_fkey"
            columns: ["organization_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "athlete_equipment_equipment_type_id_fkey"
            columns: ["equipment_type_id"]
            isOneToOne: false
            referencedRelation: "equipment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_equipment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_equipment_type_org_fkey"
            columns: ["organization_id", "equipment_type_id"]
            isOneToOne: false
            referencedRelation: "equipment_types"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      athletes: {
        Row: {
          birth_date: string
          club_athlete_number: number
          created_at: string | null
          federation_id: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string
          nationality: string | null
          organization_id: string
          photo_url: string | null
          position: string | null
          updated_at: string | null
        }
        Insert: {
          birth_date: string
          club_athlete_number: number
          created_at?: string | null
          federation_id?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          nationality?: string | null
          organization_id: string
          photo_url?: string | null
          position?: string | null
          updated_at?: string | null
        }
        Update: {
          birth_date?: string
          club_athlete_number?: number
          created_at?: string | null
          federation_id?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          nationality?: string | null
          organization_id?: string
          photo_url?: string | null
          position?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          athlete_id: string
          contract_type: string
          created_at: string
          document_id: string | null
          id: string
          notes: string | null
          organization_id: string
          status: Database["public"]["Enums"]["contract_status"]
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          athlete_id: string
          contract_type: string
          created_at?: string
          document_id?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          athlete_id?: string
          contract_type?: string
          created_at?: string
          document_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          custom_type: string | null
          doc_type: Database["public"]["Enums"]["document_type"]
          expires_at: string | null
          filename: string
          id: string
          issued_at: string | null
          notes: string | null
          organization_id: string
          owner_id: string
          owner_type: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom_type?: string | null
          doc_type: Database["public"]["Enums"]["document_type"]
          expires_at?: string | null
          filename: string
          id?: string
          issued_at?: string | null
          notes?: string | null
          organization_id: string
          owner_id: string
          owner_type: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom_type?: string | null
          doc_type?: Database["public"]["Enums"]["document_type"]
          expires_at?: string | null
          filename?: string
          id?: string
          issued_at?: string | null
          notes?: string | null
          organization_id?: string
          owner_id?: string
          owner_type?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_requests: {
        Row: {
          created_at: string | null
          decided_at: string | null
          decided_by_staff_id: string | null
          id: string
          item_name: string
          note: string | null
          organization_id: string
          quantity: number
          requester_staff_id: string | null
          status: Database["public"]["Enums"]["equipment_request_status"]
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          decided_at?: string | null
          decided_by_staff_id?: string | null
          id?: string
          item_name: string
          note?: string | null
          organization_id: string
          quantity?: number
          requester_staff_id?: string | null
          status?: Database["public"]["Enums"]["equipment_request_status"]
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          decided_at?: string | null
          decided_by_staff_id?: string | null
          id?: string
          item_name?: string
          note?: string | null
          organization_id?: string
          quantity?: number
          requester_staff_id?: string | null
          status?: Database["public"]["Enums"]["equipment_request_status"]
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_requests_decided_by_staff_id_fkey"
            columns: ["decided_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_requests_decider_org_fkey"
            columns: ["organization_id", "decided_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "equipment_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_requests_requester_org_fkey"
            columns: ["organization_id", "requester_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "equipment_requests_requester_staff_id_fkey"
            columns: ["requester_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_requests_team_org_fkey"
            columns: ["organization_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      equipment_types: {
        Row: {
          created_at: string | null
          enabled: boolean
          id: string
          is_club_property: boolean
          name: string
          organization_id: string
          size_model: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          id?: string
          is_club_property?: boolean
          name: string
          organization_id: string
          size_model: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          id?: string
          is_club_property?: boolean
          name?: string
          organization_id?: string
          size_model?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          athlete_id: string
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          is_primary: boolean
          organization_id: string
          phone: string | null
          preferred_contact: string | null
          relationship: string
          updated_at: string | null
        }
        Insert: {
          athlete_id: string
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          organization_id: string
          phone?: string | null
          preferred_contact?: string | null
          relationship: string
          updated_at?: string | null
        }
        Update: {
          athlete_id?: string
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          organization_id?: string
          phone?: string | null
          preferred_contact?: string | null
          relationship?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardians_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardians_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          column_mapping: Json
          created_at: string | null
          created_by: string | null
          duplicate_decisions: Json
          duplicated_rows: number
          error_message: string | null
          error_rows: number
          filename: string
          id: string
          organization_id: string
          parsed_rows: Json
          processed_rows: number
          status: string
          total_rows: number
          updated_at: string | null
          valid_rows: number
        }
        Insert: {
          column_mapping?: Json
          created_at?: string | null
          created_by?: string | null
          duplicate_decisions?: Json
          duplicated_rows?: number
          error_message?: string | null
          error_rows?: number
          filename: string
          id?: string
          organization_id: string
          parsed_rows?: Json
          processed_rows?: number
          status?: string
          total_rows?: number
          updated_at?: string | null
          valid_rows?: number
        }
        Update: {
          column_mapping?: Json
          created_at?: string | null
          created_by?: string | null
          duplicate_decisions?: Json
          duplicated_rows?: number
          error_message?: string | null
          error_rows?: number
          filename?: string
          id?: string
          organization_id?: string
          parsed_rows?: Json
          processed_rows?: number
          status?: string
          total_rows?: number
          updated_at?: string | null
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_examinations: {
        Row: {
          athlete_id: string
          created_at: string | null
          document_id: string | null
          examined_on: string
          id: string
          note: string | null
          organization_id: string
          updated_at: string | null
          valid_until: string
        }
        Insert: {
          athlete_id: string
          created_at?: string | null
          document_id?: string | null
          examined_on: string
          id?: string
          note?: string | null
          organization_id: string
          updated_at?: string | null
          valid_until: string
        }
        Update: {
          athlete_id?: string
          created_at?: string | null
          document_id?: string | null
          examined_on?: string
          id?: string
          note?: string | null
          organization_id?: string
          updated_at?: string | null
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_examinations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_examinations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          updated_at: string | null
          warning_threshold_days: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          updated_at?: string | null
          warning_threshold_days?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          updated_at?: string | null
          warning_threshold_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          club_athlete_counter: number
          country: string | null
          created_at: string | null
          currency: string | null
          id: string
          language: string | null
          name: string
          sport: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          club_athlete_counter?: number
          country?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          language?: string | null
          name: string
          sport?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          club_athlete_counter?: number
          country?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          language?: string | null
          name?: string
          sport?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      plan_entitlements: {
        Row: {
          id: string
          key: string
          plan_id: string
          value: number
        }
        Insert: {
          id?: string
          key: string
          plan_id: string
          value: number
        }
        Update: {
          id?: string
          key?: string
          plan_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          display_name: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          display_name: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          display_name?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          athlete_id: string
          created_at: string | null
          document_id: string | null
          federation: string | null
          id: string
          identifier: string | null
          organization_id: string
          season_id: string | null
          status: string
          updated_at: string | null
          valid_from: string
          valid_until: string
        }
        Insert: {
          athlete_id: string
          created_at?: string | null
          document_id?: string | null
          federation?: string | null
          id?: string
          identifier?: string | null
          organization_id: string
          season_id?: string | null
          status?: string
          updated_at?: string | null
          valid_from: string
          valid_until: string
        }
        Update: {
          athlete_id?: string
          created_at?: string | null
          document_id?: string | null
          federation?: string | null
          id?: string
          identifier?: string | null
          organization_id?: string
          season_id?: string | null
          status?: string
          updated_at?: string | null
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      roles: {
        Row: {
          display_name: string
          id: string
          name: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          display_name: string
          id?: string
          name: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          display_name?: string
          id?: string
          name?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      seasonal_memberships: {
        Row: {
          athlete_id: string
          created_at: string | null
          id: string
          jersey_number: number | null
          organization_id: string
          season_id: string
          status: string
          team_id: string
        }
        Insert: {
          athlete_id: string
          created_at?: string | null
          id?: string
          jersey_number?: number | null
          organization_id: string
          season_id: string
          status?: string
          team_id: string
        }
        Update: {
          athlete_id?: string
          created_at?: string | null
          id?: string
          jersey_number?: number | null
          organization_id?: string
          season_id?: string
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasonal_memberships_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasonal_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasonal_memberships_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasonal_memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string | null
          ends_on: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          starts_on: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          ends_on?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          starts_on: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          ends_on?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          starts_on?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string | null
          email: string | null
          end_date: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          organization_id: string
          phone: string | null
          photo_url: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          start_date: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          end_date?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          photo_url?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          start_date?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          end_date?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          photo_url?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          start_date?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_licenses: {
        Row: {
          created_at: string | null
          id: string
          license_number: string | null
          license_type: string
          organization_id: string
          staff_id: string
          updated_at: string | null
          valid_until: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          license_number?: string | null
          license_type: string
          organization_id: string
          staff_id: string
          updated_at?: string | null
          valid_until: string
        }
        Update: {
          created_at?: string | null
          id?: string
          license_number?: string | null
          license_type?: string
          organization_id?: string
          staff_id?: string
          updated_at?: string | null
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_licenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_licenses_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_teams: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          season_id: string
          staff_id: string
          team_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          season_id: string
          staff_id: string
          team_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          season_id?: string
          staff_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_teams_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          plan_id: string
          status: string | null
          trial_ends_at: string | null
          trial_starts_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          plan_id: string
          status?: string | null
          trial_ends_at?: string | null
          trial_starts_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          plan_id?: string
          status?: string | null
          trial_ends_at?: string | null
          trial_starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      team_equipment: {
        Row: {
          created_at: string | null
          id: string
          item_name: string
          note: string | null
          organization_id: string
          quantity: number
          responsible_staff_id: string | null
          season_id: string | null
          state: Database["public"]["Enums"]["equipment_item_state"]
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_name: string
          note?: string | null
          organization_id: string
          quantity?: number
          responsible_staff_id?: string | null
          season_id?: string | null
          state?: Database["public"]["Enums"]["equipment_item_state"]
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_name?: string
          note?: string | null
          organization_id?: string
          quantity?: number
          responsible_staff_id?: string | null
          season_id?: string | null
          state?: Database["public"]["Enums"]["equipment_item_state"]
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_equipment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_equipment_responsible_staff_id_fkey"
            columns: ["responsible_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_equipment_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_equipment_season_org_fkey"
            columns: ["organization_id", "season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "team_equipment_staff_org_fkey"
            columns: ["organization_id", "responsible_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "team_equipment_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_equipment_team_org_fkey"
            columns: ["organization_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      team_equipment_requirements: {
        Row: {
          created_at: string | null
          equipment_type_id: string
          id: string
          organization_id: string
          team_id: string
        }
        Insert: {
          created_at?: string | null
          equipment_type_id: string
          id?: string
          organization_id: string
          team_id: string
        }
        Update: {
          created_at?: string | null
          equipment_type_id?: string
          id?: string
          organization_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_equipment_requirements_equipment_type_id_fkey"
            columns: ["equipment_type_id"]
            isOneToOne: false
            referencedRelation: "equipment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_equipment_requirements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_equipment_requirements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_equipment_requirements_team_org_fkey"
            columns: ["organization_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "team_equipment_requirements_type_org_fkey"
            columns: ["organization_id", "equipment_type_id"]
            isOneToOne: false
            referencedRelation: "equipment_types"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      teams: {
        Row: {
          category: string
          created_at: string | null
          id: string
          name: string
          organization_id: string
          sport: Database["public"]["Enums"]["sport_type"]
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          name: string
          organization_id: string
          // 02-08 delta: optional — the teams_inherit_sport trigger (migration
          // 00003) fills sport from the org's sport when omitted.
          sport?: Database["public"]["Enums"]["sport_type"]
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          sport?: Database["public"]["Enums"]["sport_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authorize: {
        Args: { p: Database["public"]["Enums"]["app_permission"] }
        Returns: boolean
      }
      claim_club_athlete_number: { Args: { p_org_id: string }; Returns: number }
      create_organization_onboarding: {
        Args: {
          p_name: string
          p_sport: string
          p_country: string
          p_language: string
          p_currency: string
          p_timezone: string
        }
        Returns: string
      }
      current_organization_id: { Args: never; Returns: string }
    }
    Enums: {
      app_permission:
        | "teams.view"
        | "teams.create"
        | "teams.edit"
        | "teams.delete"
        | "athletes.view"
        | "athletes.create"
        | "athletes.edit"
        | "athletes.delete"
        | "athletes.view_sensitive"
        | "athletes.edit_sensitive"
        | "attendance.manage"
        | "youth_finance.view"
        | "youth_finance.manage"
        | "first_team_finance.view"
        | "first_team_finance.manage"
        | "registrations.view"
        | "registrations.manage"
        | "contracts.view"
        | "contracts.manage"
        | "documents.view"
        | "documents.manage"
        | "sponsors.view"
        | "sponsors.manage"
        | "staff.view"
        | "staff.manage"
        | "reports.view"
        | "reports.export"
        | "club_settings.manage"
        | "notifications.manage"
        | "seasons.view"
        | "seasons.manage"
        | "equipment.view"
        | "equipment.report"
        | "equipment.manage"
        | "medical.view"
      app_role:
        | "club_president"
        | "youth_director"
        | "coach"
        | "admin_finance"
        | "super_admin"
      contract_status: "draft" | "active" | "terminated" | "expired"
      document_type:
        | "registration"
        | "contract"
        | "medical"
        | "insurance"
        | "identity"
        | "federation"
        | "custom"
      equipment_item_state:
        | "missing"
        | "issued"
        | "returned"
        | "lost"
        | "damaged"
      equipment_request_status:
        | "requested"
        | "approved"
        | "purchased"
        | "rejected"
      sport_type: "football" | "basketball"
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
      app_permission: [
        "teams.view",
        "teams.create",
        "teams.edit",
        "teams.delete",
        "athletes.view",
        "athletes.create",
        "athletes.edit",
        "athletes.delete",
        "athletes.view_sensitive",
        "athletes.edit_sensitive",
        "attendance.manage",
        "youth_finance.view",
        "youth_finance.manage",
        "first_team_finance.view",
        "first_team_finance.manage",
        "registrations.view",
        "registrations.manage",
        "contracts.view",
        "contracts.manage",
        "documents.view",
        "documents.manage",
        "sponsors.view",
        "sponsors.manage",
        "staff.view",
        "staff.manage",
        "reports.view",
        "reports.export",
        "club_settings.manage",
        "notifications.manage",
        "seasons.view",
        "seasons.manage",
        "equipment.view",
        "equipment.report",
        "equipment.manage",
        "medical.view",
      ],
      app_role: [
        "club_president",
        "youth_director",
        "coach",
        "admin_finance",
        "super_admin",
      ],
      contract_status: ["draft", "active", "terminated", "expired"],
      document_type: [
        "registration",
        "contract",
        "medical",
        "insurance",
        "identity",
        "federation",
        "custom",
      ],
      equipment_item_state: [
        "missing",
        "issued",
        "returned",
        "lost",
        "damaged",
      ],
      equipment_request_status: [
        "requested",
        "approved",
        "purchased",
        "rejected",
      ],
      sport_type: ["football", "basketball"],
    },
  },
} as const
