// Generated database types for STOZER
// Mirrors supabase/migrations/00001_foundation.sql

export type AppRole =
  | "club_president"
  | "youth_director"
  | "coach"
  | "admin_finance"
  | "super_admin";

export type SportType = "football" | "basketball";

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
    };
  };
}
