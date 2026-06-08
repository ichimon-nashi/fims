// src/lib/appPermissions.types.ts
// Type definitions for the FIMS Access Control System

import React from 'react';

export interface RosterPermissions {
  access: boolean;
  own_data_only: boolean;
}

export interface TasksPermissions {
  access: boolean;
  can_create: boolean;
  can_edit_assigned: boolean;
}

export interface SMSPermissions {
  access: boolean;
  view_only: boolean;
}

export interface OralTestPermissions {
  access: boolean;
  view_only?: boolean;
  conduct_test?: boolean;
  manage_questions?: boolean;
  manage_users?: boolean;
}

export interface SimpleAppPermissions {
  access: boolean;
}

export interface MDAfaatPermissions {
  access: boolean;
  view_only: boolean;
}

// ── NEW ──────────────────────────────────────────
export interface AuditPermissions {
  access: boolean;
  view_only: boolean; // future-proof: false = full edit, true = read-only
}
// ─────────────────────────────────────────────────

export interface AppPermissions {
  roster: RosterPermissions;
  tasks: TasksPermissions;
  sms: SMSPermissions;
  oral_test: OralTestPermissions;
  bc_training: SimpleAppPermissions;
  mdafaat: MDAfaatPermissions;
  ads: SimpleAppPermissions;
  ccom_review: SimpleAppPermissions;
  audit: AuditPermissions; // ── NEW ──
  roulette: SimpleAppPermissions;
}

export type OralTestPage = 'dashboard' | 'results' | 'test' | 'questions' | 'users';

export type AppName =
  | 'roster'
  | 'tasks'
  | 'sms'
  | 'oral_test'
  | 'bc_training'
  | 'mdafaat'
  | 'ads'
  | 'ccom_review'
  | 'audit' // ── NEW ──
  | 'roulette';

export interface AppMetadata {
  id: AppName;
  title: string;
  titleEnglish: string;
  icon: React.ReactNode;
  color: string;
  hasSubPages?: boolean;
  subPages?: {
    id: string;
    title: string;
    titleEnglish: string;
  }[];
}

export interface BulkPermissionUpdate {
  userIds: string[];
  permissions: Partial<AppPermissions>;
}

export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
}