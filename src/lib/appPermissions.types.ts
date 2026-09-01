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
export type AuditTab = 'routine' | 'first_level' | 'iosa';

// ── NEW ──────────────────────────────────────────
// Granular actions within the routine audit tab specifically. Separate
// from AuditTab (which just gates whether the tab opens at all) — this
// gates what a user can DO once inside it.
//   submit   — fill out and submit self-inspection forms (crew)
//   approve  — review pending submissions, approve into routine summary
//              or reject (supervisors)
//   classify — assign SAM/EF codes and toggle the flagged_item review
//              flag on entries already in routine summary (clerical)
export type RoutineAction = 'submit' | 'approve' | 'classify';

export interface AuditPermissions {
  access: boolean;
  view_only: boolean; // future-proof: false = full edit, true = read-only
  tabs?: AuditTab[]; // which audit sub-pages this user may open. Undefined = legacy/full access.
  routine_actions?: RoutineAction[]; // ── NEW ── which routine-audit actions this user may perform. Undefined = legacy/full access, same convention as tabs.
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