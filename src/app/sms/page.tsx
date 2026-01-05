// src/app/sms/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/common/Navbar';
import styles from './SMS.module.css';
import RRSMSTab from '@/components/sms/RRSMSTab';
import SRMTableTab from '@/components/sms/SRMTableTab';
import StatisticsTab from '@/components/sms/StatisticsTab';

type SMSTab = 'rr-sms' | 'srm-table' | 'statistics';

// Admin accounts that can access and modify SMS
const ADMIN_ACCOUNTS = ["admin", "21986", "51892"];

export default function SMSPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SMSTab>('rr-sms');
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [yearsWithData, setYearsWithData] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Check authentication and admin status
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        // Fetch user data
        const response = await fetch('/api/auth/verify', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          router.push('/login');
          return;
        }

        const data = await response.json();
        const userData = data.user;
        setUser(userData);

        // Check if user is admin
        const adminStatus = ADMIN_ACCOUNTS.includes(userData.employee_id) || 
                           ADMIN_ACCOUNTS.includes(userData.email);
        setIsAdmin(adminStatus);

        if (!adminStatus) {
          // Non-admin users can't access SMS
          alert('You do not have permission to access the SMS system.');
          router.push('/dashboard');
          return;
        }

        setLoading(false);
        
        // Fetch available years
        fetchAvailableYears(token);
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  const fetchAvailableYears = async (token: string) => {
    try {
      const response = await fetch('/api/sms/available-years', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const currentYearValue = new Date().getFullYear();
      const nextYearValue = currentYearValue + 1;

      if (response.ok) {
        const data = await response.json();
        const yearsFromData = data.years || [];
        
        // Show ALL years that have data, plus current and next year
        const allYears = new Set([...yearsFromData, currentYearValue, nextYearValue]);
        const sortedYears = Array.from(allYears).sort((a, b) => b - a);
        
        // Track which years actually have data
        const yearsWithData = new Set<number>(yearsFromData);
        
        console.log('📅 Years with data:', yearsFromData);
        console.log('📅 All available years:', sortedYears);
        
        setAvailableYears(sortedYears);
        setYearsWithData(yearsWithData);
      } else {
        // Fallback to current and next year
        setAvailableYears([nextYearValue, currentYearValue]);
        setYearsWithData(new Set<number>());
      }
    } catch (error) {
      console.error('Error fetching available years:', error);
      const currentYearValue = new Date().getFullYear();
      setAvailableYears([currentYearValue + 1, currentYearValue]);
      setYearsWithData(new Set<number>());
    }
  };

  const handleYearChange = (year: number) => {
    setCurrentYear(year);
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    // Show years from 2020 to current year + 1
    for (let year = 2020; year <= currentYear + 1; year++) {
      years.push(year);
    }
    return years.reverse(); // Most recent first
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading SMS...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.accessDenied}>
        <h2>Access Denied</h2>
        <p>權限不夠! 請聯絡豪神</p>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className={styles.smsContainer}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1>SMS - Safety Management System</h1>
            <p className={styles.subtitle}>安全管理系統</p>
          </div>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'rr-sms' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('rr-sms')}
          >
            風險檢視
            <span className={styles.tabSubtitle}>AQD RR SMS</span>
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'srm-table' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('srm-table')}
          >
            管控表
            <span className={styles.tabSubtitle}>SRM Control Sheet</span>
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'statistics' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('statistics')}
          >
            風險統計
            <span className={styles.tabSubtitle}>Statistics</span>
          </button>
        </div>

        <div className={styles.tabContent}>
          {activeTab === 'rr-sms' && (
            <RRSMSTab 
              currentYear={currentYear} 
              userId={user.id}
              isAdmin={isAdmin}
            />
          )}
          {activeTab === 'srm-table' && (
            <SRMTableTab 
              currentYear={currentYear}
              userId={user.id}
              isAdmin={isAdmin}
            />
          )}
          {activeTab === 'statistics' && (
            <StatisticsTab 
            />
          )}
        </div>
      </div>
    </>
  );
}