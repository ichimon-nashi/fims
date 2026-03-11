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
      label: '儀表板',
      icon: '🏠',
      page: 'dashboard',
    },
    {
      path: '/oral-test/users',
      label: '人員管理',
      icon: '👥',
      page: 'users',
    },
    {
      path: '/oral-test/questions',
      label: '題庫管理',
      icon: '📚',
      page: 'questions',
    },
    {
      path: '/oral-test/test',
      label: '執行測驗',
      icon: '📝',
      page: 'test',
    },
    {
      path: '/oral-test/results',
      label: '成績',
      icon: '📊',
      page: 'results',
    },
  ];

  const hasAccess = (page: string) => {
    if (!user || !user.app_permissions?.oral_test) return false;

    const oralTestPerms = user.app_permissions.oral_test;

    // Must have basic access
    if (!oralTestPerms.access) return false;

    // Check pages array
    const pages: string[] = oralTestPerms.pages || [];
    return pages.includes(page);
  };

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <nav className={styles.navigation}>
      <div className={styles.navContainer}>
        {navigationItems.map((item) => {
          const isActive = currentPath === item.path;
          const hasPermission = hasAccess(item.page);
          
          return (
            <button
              key={item.path}
              className={`${styles.navItem} ${isActive ? styles.active : ''} ${!hasPermission ? styles.disabled : ''}`}
              onClick={() => hasPermission && handleNavigation(item.path)}
              disabled={!hasPermission}
              title={!hasPermission ? `Requires ${item.page} permission` : item.label}
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