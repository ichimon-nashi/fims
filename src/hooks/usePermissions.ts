// src/hooks/usePermissions.ts
// Custom hook for checking user permissions throughout the app

import { useAuth } from '@/context/AuthContext';
import { 
  hasAppAccess, 
  hasOralTestPageAccess,
  canEditSMS,
  canCreateTasks,
  canEditOthersSchedules,
  canEditHandicapLevels,
  canAccessControlPanel,
  getAccessibleOralTestPages
} from '@/lib/permissionHelpers';
import { AppName, OralTestPage } from '@/lib/appPermissions.types';

/**
 * Custom hook for checking user permissions
 * 
 * Usage:
 * const permissions = usePermissions();
 * 
 * if (!permissions.hasAppAccess('roster')) {
 *   router.push('/dashboard');
 * }
 */
export const usePermissions = () => {
  const { user } = useAuth();

  return {
    // General app access
    hasAppAccess: (appName: AppName) => {
      return hasAppAccess(user, appName).granted;
    },

    // Oral test page access
    hasOralTestPageAccess: (page: OralTestPage) => {
      return hasOralTestPageAccess(user, page).granted;
    },

    // Get list of accessible oral test pages
    getAccessibleOralTestPages: () => {
      return getAccessibleOralTestPages(user);
    },

    // SMS permissions
    canEditSMS: () => {
      return canEditSMS(user);
    },

    canViewSMS: () => {
      return hasAppAccess(user, 'sms').granted;
    },

    // Tasks permissions
    canCreateTasks: () => {
      return canCreateTasks(user);
    },

    canEditTasks: () => {
      // Can edit tasks if they have access to the app
      return hasAppAccess(user, 'tasks').granted;
    },

    // Roster permissions
    canEditOthersSchedules: () => {
      return canEditOthersSchedules(user);
    },

    canViewRoster: () => {
      return hasAppAccess(user, 'roster').granted;
    },

    canEditOwnSchedule: () => {
      // If they have roster access, they can edit their own schedule
      return hasAppAccess(user, 'roster').granted;
    },

    // Admin-only permissions
    canEditHandicapLevels: () => {
      return canEditHandicapLevels(user);
    },

    canAccessControlPanel: () => {
      return canAccessControlPanel(user);
    },

    // Check if user is admin or 51892
    isAdmin: () => {
      return user?.employee_id === 'admin';
    },

    isSpecialAdmin: () => {
      return user?.employee_id === 'admin' || user?.employee_id === '51892';
    },

    // Get current user
    user
  };
};