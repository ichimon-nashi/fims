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
      minLevel: 1,
    },
    {
      path: '/oral-test/users',
      label: 'Users',
      icon: '👥',
      minLevel: 5,
    },
    {
      path: '/oral-test/questions',
      label: 'Questions',
      icon: '📚',
      minLevel: 4,
    },
    {
      path: '/oral-test/test',
      label: 'Conduct Test',
      icon: '📝',
      minLevel: 3,
    },
    {
      path: '/oral-test/results',
      label: 'Results',
      icon: '📊',
      minLevel: 2,
    },
  ];

  const hasAccess = (minLevel: number) => {
    return user && user.authentication_level >= minLevel;
  };

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <nav className={styles.navigation}>
      <div className={styles.navContainer}>
        {navigationItems.map((item) => {
          const isActive = currentPath === item.path;
          const hasPermission = hasAccess(item.minLevel);
          
          return (
            <button
              key={item.path}
              className={`${styles.navItem} ${isActive ? styles.active : ''} ${!hasPermission ? styles.disabled : ''}`}
              onClick={() => hasPermission && handleNavigation(item.path)}
              disabled={!hasPermission}
              title={!hasPermission ? `Requires level ${item.minLevel}+ access` : item.label}
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