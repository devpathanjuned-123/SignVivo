// Hand-authored to match supabase/migrations/0001_init_schema.sql.
// You can regenerate this with the Supabase CLI:
//   npx supabase gen types typescript --project-id <id> > types/database.ts

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type DocumentStatus = "DRAFT" | "SENT" | "COMPLETED" | "VOIDED";
export type RecipientStatus = "PENDING" | "VIEWED" | "SIGNED";
export type FieldType = "SIGNATURE" | "DATE" | "TEXT";
export type AuditEventType =
  | "CREATED"
  | "SENT"
  | "VIEWED"
  | "SIGNED"
  | "COMPLETED"
  | "DOWNLOADED"
  | "VOIDED";
export type WorkspaceRole = "owner" | "admin" | "member";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role?: WorkspaceRole;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_members"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          workspace_id: string;
          created_by: string;
          title: string;
          status: DocumentStatus;
          original_pdf_path: string;
          signed_pdf_path: string | null;
          audit_pdf_path: string | null;
          created_at: string;
          sent_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          created_by: string;
          title: string;
          status?: DocumentStatus;
          original_pdf_path: string;
          signed_pdf_path?: string | null;
          audit_pdf_path?: string | null;
          created_at?: string;
          sent_at?: string | null;
          completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "documents_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      recipients: {
        Row: {
          id: string;
          document_id: string;
          name: string;
          email: string;
          signing_token: string;
          token_expires_at: string;
          ord: number;
          status: RecipientStatus;
          viewed_at: string | null;
          signed_at: string | null;
        };
        Insert: {
          id?: string;
          document_id: string;
          name: string;
          email: string;
          signing_token?: string;
          token_expires_at?: string;
          ord?: number;
          status?: RecipientStatus;
          viewed_at?: string | null;
          signed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["recipients"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "recipients_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      fields: {
        Row: {
          id: string;
          document_id: string;
          recipient_id: string;
          type: FieldType;
          page: number;
          x_pct: number;
          y_pct: number;
          width_pct: number;
          height_pct: number;
          value: string | null;
        };
        Insert: {
          id?: string;
          document_id: string;
          recipient_id: string;
          type: FieldType;
          page: number;
          x_pct: number;
          y_pct: number;
          width_pct: number;
          height_pct: number;
          value?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["fields"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "fields_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fields_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "recipients";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          id: string;
          document_id: string;
          recipient_id: string | null;
          type: AuditEventType;
          ip: string | null;
          user_agent: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          recipient_id?: string | null;
          type: AuditEventType;
          ip?: string | null;
          user_agent?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_events"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "audit_events_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_events_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "recipients";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_workspace_member: { Args: { ws: string }; Returns: boolean };
      document_workspace: { Args: { doc: string }; Returns: string };
      my_default_workspace: { Args: Record<string, never>; Returns: string };
    };
    Enums: {
      document_status: DocumentStatus;
      recipient_status: RecipientStatus;
      field_type: FieldType;
      audit_event_type: AuditEventType;
      workspace_role: WorkspaceRole;
    };
    CompositeTypes: Record<string, never>;
  };
}

// Convenience row aliases used throughout the app.
export type Profile        = Database["public"]["Tables"]["profiles"]["Row"];
export type Workspace      = Database["public"]["Tables"]["workspaces"]["Row"];
export type WorkspaceMember = Database["public"]["Tables"]["workspace_members"]["Row"];
export type DocumentRow    = Database["public"]["Tables"]["documents"]["Row"];
export type RecipientRow   = Database["public"]["Tables"]["recipients"]["Row"];
export type FieldRow       = Database["public"]["Tables"]["fields"]["Row"];
export type AuditEventRow  = Database["public"]["Tables"]["audit_events"]["Row"];
