// Generated database types for STOZER
// Mirrors supabase/migrations/00001_foundation.sql

export type AppRole =
  | "club_president"
  | "youth_director"
  | "coach"
  | "admin_finance"
  | "super_admin";

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
  | "notifications.manage";

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
          created_at?: string;
          updated_at?: string;
        };
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
      };
    };
    Enums: {
      app_role: AppRole;
      app_permission: AppPermission;
    };
  };
}
