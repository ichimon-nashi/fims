// src/components/oral-test/OralTestNavigation/OralTestNavigation.tsx
"use client";

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './OralTestNavigation.module.css';

interface OralTestNavigationProps {
  currentPath: string;
}

const OralTestNavigation = ({ currentPath }: OralTestNavigationProps) => {
  const router = useRouter();
  const { user } = useAuth();

  const navigationItems = [
    {
      path: '/oral-test/dashboard',
      label: 'Dashboard',
      icon: '🏠',
      permission: 'access', // Just needs access
    },
    {
      path: '/oral-test/users',
      label: 'Users',
      icon: '👥',
      permission: 'manage_users',
    },
    {
      path: '/oral-test/questions',
      label: 'Questions',
      icon: '📚',
      permission: 'manage_questions',
    },
    {
      path: '/oral-test/test',
      label: 'Conduct Test',
      icon: '📝',
      permission: 'conduct_test',
    },
    {
      path: '/oral-test/results',
      label: 'Results',
      icon: '📊',
      permission: 'access', // Anyone with access can view results
    },
  ];

  const hasAccess = (permission: string) => {
    if (!user || !user.app_permissions?.oral_test) return false;
    
    const oralTestPerms = user.app_permissions.oral_test;
    
    // Must have basic access
    if (!oralTestPerms.access) return false;
    
    // If just checking for access
    if (permission === 'access') return true;
    
    // Check specific permission
    return oralTestPerms[permission] === true;
  };

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <nav className={styles.navigation}>
      <div className={styles.navContainer}>
        {navigationItems.map((item) => {
          const isActive = currentPath === item.path;
          const hasPermission = hasAccess(item.permission);
          
          return (
            <button
              key={item.path}
              className={`${styles.navItem} ${isActive ? styles.active : ''} ${!hasPermission ? styles.disabled : ''}`}
              onClick={() => hasPermission && handleNavigation(item.path)}
              disabled={!hasPermission}
              title={!hasPermission ? `Requires ${item.permission} permission` : item.label}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.label}>{item.label}</span>
              {!hasPermission && (
                <span className={styles.lockIcon}>🔒</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default OralTestNavigation;