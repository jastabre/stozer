// Generated database types for STOZER
// Mirrors supabase/migrations/00001_foundation.sql

export type AppRole =
  | "club_president"
  | "youth_director"
  | "coach"
  | "admin_finance"
  | "super_admin";

export type SportType = "football" | "basketball";

export type DocumentType =
  | "registration"
  | "contract"
  | "medical"
  | "insurance"
  | "identity"
  | "federation"
  | "custom";

export type ContractStatus = "draft" | "active" | "terminated" | "expired";

export type EquipmentItemState =
  | "missing"
  | "issued"
  | "returned"
  | "lost"
  | "damaged";

export type EquipmentRequestStatus =
  | "requested"
  | "approved"
  | "purchased"
  | "rejected";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
  | "medical.view";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          sport: string | null;
          country: string | null;
          language: string;
          currency: string;
          timezone: string | null;
          club_athlete_counter: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sport?: string | null;
          country?: string | null;
          language?: string;
          currency?: string;
          timezone?: string | null;
          club_athlete_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sport?: string | null;
          country?: string | null;
          language?: string;
          currency?: string;
          timezone?: string | null;
          club_athlete_counter?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: AppRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role: AppRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: AppRole;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      roles: {
        Row: {
          id: string;
          name: AppRole;
          display_name: string;
        };
        Insert: {
          id?: string;
          name: AppRole;
          display_name: string;
        };
        Update: {
          id?: string;
          name?: AppRole;
          display_name?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          id: string;
          role: AppRole;
          permission: AppPermission;
        };
        Insert: {
          id?: string;
          role: AppRole;
          permission: AppPermission;
        };
        Update: {
          id?: string;
          role?: AppRole;
          permission?: AppPermission;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_fkey";
            columns: ["role"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          }
        ];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          display_name?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      plan_entitlements: {
        Row: {
          id: string;
          plan_id: string;
          key: string;
          value: number;
        };
        Insert: {
          id?: string;
          plan_id: string;
          key: string;
          value: number;
        };
        Update: {
          id?: string;
          plan_id?: string;
          key?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          }
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          organization_id: string;
          plan_id: string;
          status: string;
          trial_starts_at: string | null;
          trial_ends_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          plan_id: string;
          status?: string;
          trial_starts_at?: string | null;
          trial_ends_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          plan_id?: string;
          status?: string;
          trial_starts_at?: string | null;
          trial_ends_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          }
        ];
      };
      seasons: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          starts_on: string;
          ends_on: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          starts_on: string;
          ends_on?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          starts_on?: string;
          ends_on?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seasons_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      teams: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          category: string;
          sport: SportType;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          category: string;
          sport?: SportType;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          category?: string;
          sport?: SportType;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      athletes: {
        Row: {
          id: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          birth_date: string;
          gender: string | null;
          nationality: string | null;
          position: string | null;
          photo_url: string | null;
          federation_id: string | null;
          club_athlete_number: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          birth_date: string;
          gender?: string | null;
          nationality?: string | null;
          position?: string | null;
          photo_url?: string | null;
          federation_id?: string | null;
          club_athlete_number: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          first_name?: string;
          last_name?: string;
          birth_date?: string;
          gender?: string | null;
          nationality?: string | null;
          position?: string | null;
          photo_url?: string | null;
          federation_id?: string | null;
          club_athlete_number?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "athletes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      seasonal_memberships: {
        Row: {
          id: string;
          organization_id: string;
          athlete_id: string;
          season_id: string;
          team_id: string;
          jersey_number: number | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          athlete_id: string;
          season_id: string;
          team_id: string;
          jersey_number?: number | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          athlete_id?: string;
          season_id?: string;
          team_id?: string;
          jersey_number?: number | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seasonal_memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seasonal_memberships_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athletes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seasonal_memberships_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seasonal_memberships_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          }
        ];
      };
      organization_settings: {
        Row: {
          id: string;
          organization_id: string;
          warning_threshold_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          warning_threshold_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          warning_threshold_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      registrations: {
        Row: {
          id: string;
          organization_id: string;
          athlete_id: string;
          season_id: string | null;
          federation: string | null;
          identifier: string | null;
          status: string;
          valid_from: string;
          valid_until: string;
          document_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          athlete_id: string;
          season_id?: string | null;
          federation?: string | null;
          identifier?: string | null;
          status?: string;
          valid_from: string;
          valid_until: string;
          document_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          athlete_id?: string;
          season_id?: string | null;
          federation?: string | null;
          identifier?: string | null;
          status?: string;
          valid_from?: string;
          valid_until?: string;
          document_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "registrations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registrations_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athletes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registrations_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          }
        ];
      };
      medical_examinations: {
        Row: {
          id: string;
          organization_id: string;
          athlete_id: string;
          examined_on: string;
          valid_until: string;
          note: string | null;
          document_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          athlete_id: string;
          examined_on: string;
          valid_until: string;
          note?: string | null;
          document_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          athlete_id?: string;
          examined_on?: string;
          valid_until?: string;
          note?: string | null;
          document_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "medical_examinations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "medical_examinations_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athletes";
            referencedColumns: ["id"];
          }
        ];
      };
      staff: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          role: AppRole | null;
          first_name: string;
          last_name: string;
          photo_url: string | null;
          phone: string | null;
          email: string | null;
          title: string | null;
          start_date: string | null;
          end_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          role?: AppRole | null;
          first_name: string;
          last_name: string;
          photo_url?: string | null;
          phone?: string | null;
          email?: string | null;
          title?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string | null;
          role?: AppRole | null;
          first_name?: string;
          last_name?: string;
          photo_url?: string | null;
          phone?: string | null;
          email?: string | null;
          title?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      staff_teams: {
        Row: {
          id: string;
          organization_id: string;
          staff_id: string;
          team_id: string;
          season_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          staff_id: string;
          team_id: string;
          season_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          staff_id?: string;
          team_id?: string;
          season_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_teams_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_teams_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_teams_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_teams_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          }
        ];
      };
      staff_licenses: {
        Row: {
          id: string;
          organization_id: string;
          staff_id: string;
          license_type: string;
          license_number: string | null;
          valid_until: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          staff_id: string;
          license_type: string;
          license_number?: string | null;
          valid_until: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          staff_id?: string;
          license_type?: string;
          license_number?: string | null;
          valid_until?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_licenses_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_licenses_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          }
        ];
      };
      guardians: {
        Row: {
          id: string;
          organization_id: string;
          athlete_id: string;
          full_name: string;
          relationship: string;
          phone: string | null;
          email: string | null;
          preferred_contact: "phone" | "email" | "sms" | "other" | null;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          athlete_id: string;
          full_name: string;
          relationship: string;
          phone?: string | null;
          email?: string | null;
          preferred_contact?: "phone" | "email" | "sms" | "other" | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          athlete_id?: string;
          full_name?: string;
          relationship?: string;
          phone?: string | null;
          email?: string | null;
          preferred_contact?: "phone" | "email" | "sms" | "other" | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guardians_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guardians_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athletes";
            referencedColumns: ["id"];
          }
        ];
      };
      import_jobs: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          filename: string;
          status: string;
          total_rows: number;
          valid_rows: number;
          error_rows: number;
          duplicated_rows: number;
          error_message: string | null;
          parsed_rows: Json;
          column_mapping: Json;
          duplicate_decisions: Json;
          processed_rows: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by?: string | null;
          filename: string;
          status?: string;
          total_rows?: number;
          valid_rows?: number;
          error_rows?: number;
          duplicated_rows?: number;
          error_message?: string | null;
          parsed_rows?: Json;
          column_mapping?: Json;
          duplicate_decisions?: Json;
          processed_rows?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          created_by?: string | null;
          filename?: string;
          status?: string;
          total_rows?: number;
          valid_rows?: number;
          error_rows?: number;
          duplicated_rows?: number;
          error_message?: string | null;
          parsed_rows?: Json;
          column_mapping?: Json;
          duplicate_decisions?: Json;
          processed_rows?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "import_jobs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      documents: {
        Row: {
          id: string;
          organization_id: string;
          owner_type: "athlete" | "staff";
          owner_id: string;
          doc_type: DocumentType;
          custom_type: string | null;
          filename: string;
          storage_path: string;
          issued_at: string | null;
          expires_at: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          owner_type: "athlete" | "staff";
          owner_id: string;
          doc_type: DocumentType;
          custom_type?: string | null;
          filename: string;
          storage_path: string;
          issued_at?: string | null;
          expires_at?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          owner_type?: "athlete" | "staff";
          owner_id?: string;
          doc_type?: DocumentType;
          custom_type?: string | null;
          filename?: string;
          storage_path?: string;
          issued_at?: string | null;
          expires_at?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      contracts: {
        Row: {
          id: string;
          organization_id: string;
          athlete_id: string;
          contract_type: string;
          status: ContractStatus;
          valid_from: string | null;
          valid_until: string | null;
          document_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          athlete_id: string;
          contract_type: string;
          status?: ContractStatus;
          valid_from?: string | null;
          valid_until?: string | null;
          document_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          athlete_id?: string;
          contract_type?: string;
          status?: ContractStatus;
          valid_from?: string | null;
          valid_until?: string | null;
          document_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contracts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athletes";
            referencedColumns: ["id"];
          }
        ];
      };
      equipment_types: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          size_model: "single" | "upper_lower";
          enabled: boolean;
          is_club_property: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          size_model: "single" | "upper_lower";
          enabled?: boolean;
          is_club_property?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          size_model?: "single" | "upper_lower";
          enabled?: boolean;
          is_club_property?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "equipment_types_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      team_equipment_requirements: {
        Row: {
          id: string;
          organization_id: string;
          team_id: string;
          equipment_type_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          team_id: string;
          equipment_type_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          team_id?: string;
          equipment_type_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_equipment_requirements_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_equipment_requirements_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_equipment_requirements_equipment_type_id_fkey";
            columns: ["equipment_type_id"];
            isOneToOne: false;
            referencedRelation: "equipment_types";
            referencedColumns: ["id"];
          }
        ];
      };
      athlete_equipment: {
        Row: {
          id: string;
          organization_id: string;
          athlete_id: string;
          equipment_type_id: string;
          size_value: string | null;
          size_value_upper: string | null;
          state: EquipmentItemState;
          issued_at: string | null;
          returned_at: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          athlete_id: string;
          equipment_type_id: string;
          size_value?: string | null;
          size_value_upper?: string | null;
          state?: EquipmentItemState;
          issued_at?: string | null;
          returned_at?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          athlete_id?: string;
          equipment_type_id?: string;
          size_value?: string | null;
          size_value_upper?: string | null;
          state?: EquipmentItemState;
          issued_at?: string | null;
          returned_at?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "athlete_equipment_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "athlete_equipment_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athletes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "athlete_equipment_equipment_type_id_fkey";
            columns: ["equipment_type_id"];
            isOneToOne: false;
            referencedRelation: "equipment_types";
            referencedColumns: ["id"];
          }
        ];
      };
      team_equipment: {
        Row: {
          id: string;
          organization_id: string;
          team_id: string | null;
          responsible_staff_id: string | null;
          item_name: string;
          quantity: number;
          state: EquipmentItemState;
          season_id: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          team_id?: string | null;
          responsible_staff_id?: string | null;
          item_name: string;
          quantity?: number;
          state?: EquipmentItemState;
          season_id?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          team_id?: string | null;
          responsible_staff_id?: string | null;
          item_name?: string;
          quantity?: number;
          state?: EquipmentItemState;
          season_id?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_equipment_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_equipment_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_equipment_responsible_staff_id_fkey";
            columns: ["responsible_staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_equipment_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          }
        ];
      };
      equipment_requests: {
        Row: {
          id: string;
          organization_id: string;
          team_id: string | null;
          item_name: string;
          quantity: number;
          note: string | null;
          requester_staff_id: string | null;
          status: EquipmentRequestStatus;
          decided_by_staff_id: string | null;
          decided_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          team_id?: string | null;
          item_name: string;
          quantity?: number;
          note?: string | null;
          requester_staff_id?: string | null;
          status?: EquipmentRequestStatus;
          decided_by_staff_id?: string | null;
          decided_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          team_id?: string | null;
          item_name?: string;
          quantity?: number;
          note?: string | null;
          requester_staff_id?: string | null;
          status?: EquipmentRequestStatus;
          decided_by_staff_id?: string | null;
          decided_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "equipment_requests_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "equipment_requests_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "equipment_requests_requester_staff_id_fkey";
            columns: ["requester_staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "equipment_requests_decided_by_staff_id_fkey";
            columns: ["decided_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {};
    Functions: {
      claim_club_athlete_number: {
        Args: { p_org_id: string };
        Returns: number;
      };
    };
      Enums: {
      app_role: AppRole;
      app_permission: AppPermission;
      sport_type: SportType;
      document_type: DocumentType;
        contract_status: ContractStatus;
        equipment_item_state: EquipmentItemState;
        equipment_request_status: EquipmentRequestStatus;
      };
  };
}
