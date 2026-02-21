// src/lib/appPermissions.types.ts
// Type definitions for the FIMS Access Control System

import React from 'react';

/**
 * Roster App Permissions
 */
export interface RosterPermissions {
  access: boolean;           // Can they access the Roster app at all?
  own_data_only: boolean;    // Can they only edit their own schedule? (false = can edit anyone's)
}

/**
 * Tasks App Permissions
 */
export interface TasksPermissions {
  access: boolean;           // Can they access the Tasks app?
  can_create: boolean;       // Can they create new tasks?
  can_edit_assigned: boolean; // Can they edit tasks they're assigned to?
}

/**
 * SMS App Permissions
 */
export interface SMSPermissions {
  access: boolean;           // Can they access the SMS app?
  view_only: boolean;        // If true, they can only view (no create/edit/delete buttons)
}

/**
 * Oral Test App Permissions
 * Updated to include granular permissions for specific features
 */
export interface OralTestPermissions {
  access: boolean;           // Can they access the Oral Test app?
  view_only?: boolean;       // If true, they can only view (no create/edit/delete)
  conduct_test?: boolean;    // Can they conduct tests? (test page)
  manage_questions?: boolean; // Can they manage questions? (questions page)
  manage_users?: boolean;    // Can they manage users? (users page)
}

/**
 * Simple App Permissions (BC Training, AdS, CCOM Review)
 */
export interface SimpleAppPermissions {
  access: boolean;           // Can they access this app?
}

/**
 * MDAfaat App Permissions
 */
export interface MDAfaatPermissions {
  access: boolean;           // Can they access MDAfaat?
  view_only: boolean;        // If true, they can only view (no scenario editing)
}

/**
 * Complete App Permissions Structure
 * This matches the JSONB structure in the database
 */
export interface AppPermissions {
  roster: RosterPermissions;
  tasks: TasksPermissions;
  sms: SMSPermissions;
  oral_test: OralTestPermissions;
  bc_training: SimpleAppPermissions;
  mdafaat: MDAfaatPermissions;
  ads: SimpleAppPermissions;
  ccom_review: SimpleAppPermissions;
}

/**
 * Valid Oral Test page names
 */
export type OralTestPage = 'dashboard' | 'results' | 'test' | 'questions' | 'users';

/**
 * Valid app names
 */
export type AppName = 
  | 'roster' 
  | 'tasks' 
  | 'sms' 
  | 'oral_test' 
  | 'bc_training' 
  | 'mdafaat' 
  | 'ads' 
  | 'ccom_review';

/**
 * App metadata for UI display
 */
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

/**
 * Bulk edit operation
 */
export interface BulkPermissionUpdate {
  userIds: string[];        // Array of user IDs to update
  permissions: Partial<AppPermissions>; // Only the permissions being changed
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;          // Why permission was denied (for debugging)
}