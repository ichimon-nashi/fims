// src/components/common/PermissionGuard.tsx
"use client";

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { AppName } from '@/lib/appPermissions.types';

interface PermissionGuardProps {
  app: AppName;
  children: ReactNode;
  redirectTo?: string;
  showMessage?: boolean;
}

/**
 * PermissionGuard - Protects page content from unauthorized access
 * 
 * Usage:
 * <PermissionGuard app="roster">
 *   <RosterPageContent />
 * </PermissionGuard>
 */
const PermissionGuard = ({ 
  app, 
  children, 
  redirectTo = '/dashboard',
  showMessage = true 
}: PermissionGuardProps) => {
  const router = useRouter();
  const permissions = usePermissions();

  // DEBUG: Log permission check
  console.log('=== PERMISSION GUARD DEBUG ===');
  console.log('Checking app:', app);
  console.log('User employee_id:', permissions.user?.employee_id);
  console.log('User app_permissions:', permissions.user?.app_permissions);
  console.log('Has access to', app, '?', permissions.hasAppAccess(app));

  useEffect(() => {
    // Wait for user to load
    if (!permissions.user) {
      console.log('User not loaded yet, waiting...');
      return;
    }

    // Check if user has access to this app
    const hasAccess = permissions.hasAppAccess(app);
    console.log(`PermissionGuard useEffect: hasAccess=${hasAccess} for app=${app}`);
    
    if (!hasAccess) {
      // Show toast notification if available
      if (showMessage && typeof window !== 'undefined') {
        // Simple fallback alert if toast library not available
        // You can replace this with your toast library
        console.warn(`Access denied to app: ${app}`);
        
        // Optional: Show browser alert (can be removed if you have a toast library)
        setTimeout(() => {
          alert('您沒有權限存取此功能');
        }, 100);
      }
      
      // Redirect to dashboard or specified page
      console.log(`Redirecting to ${redirectTo} due to no access`);
      router.replace(redirectTo);
    }
  }, [app, permissions, router, redirectTo, showMessage]);

  // If user not loaded yet, show loading
  if (!permissions.user) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1f35 0%, #2d3651 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.25rem',
        fontWeight: '600',
        color: '#e8e9ed'
      }}>
        載入中...
      </div>
    );
  }

  // If no access, don't render children (will redirect)
  if (!permissions.hasAppAccess(app)) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1f35 0%, #2d3651 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.25rem',
        fontWeight: '600',
        color: '#e8e9ed'
      }}>
        檢查權限中...
      </div>
    );
  }

  // User has access, render children
  return <>{children}</>;
};

export default PermissionGuard;