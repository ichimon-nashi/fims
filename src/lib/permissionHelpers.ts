// src/lib/permissionHelpers.ts
// Helper functions for working with app permissions

import { AppPermissions, AppName, OralTestPage, PermissionCheckResult } from './appPermissions.types';
import { User } from './types';

/**
 * Get default permissions for a user based on their role
 * This is used when creating new users or migrating existing users
 */
export const getDefaultPermissions = (user: User): AppPermissions => {
  const isAdmin = user.employee_id === 'admin';
  const is51892 = user.employee_id === '51892';
  const isSpecialAdmin = isAdmin || is51892;
  
  // Admin and 51892 get full access to everything
  if (isSpecialAdmin) {
    return {
      roster: { 
        access: true, 
        own_data_only: false  // Can edit anyone's schedule
      },
      tasks: { 
        access: true, 
        can_create: true, 
        can_edit_assigned: true 
      },
      sms: { 
        access: true, 
        view_only: false  // Can create/edit/delete
      },
      oral_test: {
        access: true,
        pages: ['dashboard', 'results', 'test', 'questions', 'users']
      },
      bc_training: { access: true },
      mdafaat: { access: true },
      ads: { access: true },
      ccom_review: { access: true }
    };
  }
  
  // Regular users - minimal defaults
  return {
    roster: { 
      access: false,  // Must be manually enabled
      own_data_only: true  // Can only edit their own schedule
    },
    tasks: { 
      access: true,  // Everyone gets tasks
      can_create: false,  // Must be manually enabled
      can_edit_assigned: true  // Can edit tasks assigned to them
    },
    sms: { 
      access: false,  // Must be manually enabled
      view_only: true  // When enabled, starts as view-only
    },
    oral_test: {
      access: true,  // Most users need oral test
      pages: ['dashboard']  // Only dashboard by default
    },
    bc_training: { access: false },
    mdafaat: { access: false },
    ads: { access: false },
    ccom_review: { access: false }
  };
};

/**
 * Check if user has access to a specific app
 */
export const hasAppAccess = (user: User | null, appName: AppName): PermissionCheckResult => {
  if (!user) {
    return { granted: false, reason: 'User not authenticated' };
  }
  
  if (!user.app_permissions) {
    return { granted: false, reason: 'No permissions configured for user' };
  }
  
  const appPermission = user.app_permissions[appName];
  
  if (!appPermission) {
    return { granted: false, reason: `Permission object not found for app: ${appName}` };
  }
  
  // Check access property
  if ('access' in appPermission && appPermission.access === true) {
    return { granted: true };
  }
  
  return { granted: false, reason: `Access denied to app: ${appName}` };
};

/**
 * Check if user has access to a specific oral test page
 */
export const hasOralTestPageAccess = (
  user: User | null, 
  page: OralTestPage
): PermissionCheckResult => {
  if (!user) {
    return { granted: false, reason: 'User not authenticated' };
  }
  
  const oralTestAccess = hasAppAccess(user, 'oral_test');
  if (!oralTestAccess.granted) {
    return oralTestAccess;
  }
  
  const oralTestPermissions = user.app_permissions?.oral_test;
  if (!oralTestPermissions || !oralTestPermissions.pages) {
    return { granted: false, reason: 'Oral test pages not configured' };
  }
  
  if (oralTestPermissions.pages.includes(page)) {
    return { granted: true };
  }
  
  return { granted: false, reason: `Access denied to oral test page: ${page}` };
};

/**
 * Check if user can edit SMS entries (not just view)
 */
export const canEditSMS = (user: User | null): boolean => {
  if (!user?.app_permissions?.sms) return false;
  
  return user.app_permissions.sms.access === true && 
         user.app_permissions.sms.view_only === false;
};

/**
 * Check if user can create tasks
 */
export const canCreateTasks = (user: User | null): boolean => {
  if (!user?.app_permissions?.tasks) return false;
  
  return user.app_permissions.tasks.access === true && 
         user.app_permissions.tasks.can_create === true;
};

/**
 * Check if user can edit other users' schedules in roster
 */
export const canEditOthersSchedules = (user: User | null): boolean => {
  if (!user?.app_permissions?.roster) return false;
  
  return user.app_permissions.roster.access === true && 
         user.app_permissions.roster.own_data_only === false;
};

/**
 * Check if user can edit handicap levels (admin only)
 */
export const canEditHandicapLevels = (user: User | null): boolean => {
  return user?.employee_id === 'admin';
};

/**
 * Check if user can access the Access Control Panel (admin or 51892 only)
 */
export const canAccessControlPanel = (user: User | null): boolean => {
  if (!user) return false;
  return user.employee_id === 'admin' || user.employee_id === '51892';
};

/**
 * Get list of accessible oral test pages for a user
 */
export const getAccessibleOralTestPages = (user: User | null): OralTestPage[] => {
  if (!user?.app_permissions?.oral_test) return [];
  
  const pages = user.app_permissions.oral_test.pages || [];
  return pages as OralTestPage[];
};

/**
 * Validate app permissions structure
 */
export const isValidAppPermissions = (permissions: any): permissions is AppPermissions => {
  if (!permissions || typeof permissions !== 'object') return false;
  
  // Check required top-level keys
  const requiredKeys: AppName[] = [
    'roster', 'tasks', 'sms', 'oral_test', 
    'bc_training', 'mdafaat', 'ads', 'ccom_review'
  ];
  
  for (const key of requiredKeys) {
    if (!(key in permissions)) return false;
  }
  
  // Validate roster permissions
  if (typeof permissions.roster?.access !== 'boolean' ||
      typeof permissions.roster?.own_data_only !== 'boolean') {
    return false;
  }
  
  // Validate tasks permissions
  if (typeof permissions.tasks?.access !== 'boolean' ||
      typeof permissions.tasks?.can_create !== 'boolean' ||
      typeof permissions.tasks?.can_edit_assigned !== 'boolean') {
    return false;
  }
  
  // Validate SMS permissions
  if (typeof permissions.sms?.access !== 'boolean' ||
      typeof permissions.sms?.view_only !== 'boolean') {
    return false;
  }
  
  // Validate oral test permissions
  if (typeof permissions.oral_test?.access !== 'boolean' ||
      !Array.isArray(permissions.oral_test?.pages)) {
    return false;
  }
  
  return true;
};

/**
 * Merge partial permissions with existing permissions
 * Used for bulk updates where only some permissions are being changed
 */
export const mergePermissions = (
  existing: AppPermissions,
  updates: Partial<AppPermissions>
): AppPermissions => {
  return {
    roster: updates.roster ? { ...existing.roster, ...updates.roster } : existing.roster,
    tasks: updates.tasks ? { ...existing.tasks, ...updates.tasks } : existing.tasks,
    sms: updates.sms ? { ...existing.sms, ...updates.sms } : existing.sms,
    oral_test: updates.oral_test ? { ...existing.oral_test, ...updates.oral_test } : existing.oral_test,
    bc_training: updates.bc_training ? { ...existing.bc_training, ...updates.bc_training } : existing.bc_training,
    mdafaat: updates.mdafaat ? { ...existing.mdafaat, ...updates.mdafaat } : existing.mdafaat,
    ads: updates.ads ? { ...existing.ads, ...updates.ads } : existing.ads,
    ccom_review: updates.ccom_review ? { ...existing.ccom_review, ...updates.ccom_review } : existing.ccom_review,
  };
};