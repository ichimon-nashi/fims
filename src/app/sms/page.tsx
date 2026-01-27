// src/app/sms/page.tsx - DEBUG VERSION
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import PermissionGuard from '@/components/common/PermissionGuard';
import Navbar from '@/components/common/Navbar';
import styles from './SMS.module.css';
import RRSMSTab from '@/components/sms/RRSMSTab';
import SRMTableTab from '@/components/sms/SRMTableTab';
import StatisticsTab from '@/components/sms/StatisticsTab';

type SMSTab = 'rr-sms' | 'srm-table' | 'statistics';

function SMSContent() {
  const { user, token } = useAuth();
  const permissions = usePermissions();
  const [activeTab, setActiveTab] = useState<SMSTab>('rr-sms');
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [yearsWithData, setYearsWithData] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (token) {
      fetchAvailableYears(token);
    }
  }, [token]);

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
        
        const allYears = new Set([...yearsFromData, currentYearValue, nextYearValue]);
        const sortedYears = Array.from(allYears).sort((a, b) => b - a);
        
        const yearsWithData = new Set<number>(yearsFromData);
        
        console.log('📅 Years with data:', yearsFromData);
        console.log('📅 All available years:', sortedYears);
        
        setAvailableYears(sortedYears);
        setYearsWithData(yearsWithData);
      } else {
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

  // Check if user can edit SMS (not just view)
  const canEdit = permissions.canEditSMS();

  // DEBUG LOGGING
  console.log('=== SMS PAGE DEBUG ===');
  console.log('User employee_id:', user?.employee_id);
  console.log('User app_permissions:', user?.app_permissions);
  console.log('SMS permissions:', user?.app_permissions?.sms);
  console.log('canEditSMS():', canEdit);
  console.log('canViewSMS():', permissions.canViewSMS());

  if (!user) {
    return null;
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
              isAdmin={canEdit}
            />
          )}
          {activeTab === 'srm-table' && (
            <SRMTableTab 
              currentYear={currentYear}
              userId={user.id}
              isAdmin={canEdit}
            />
          )}
          {activeTab === 'statistics' && (
            <StatisticsTab isAdmin={canEdit} />
          )}
        </div>

        {/* DEBUG INFO */}
        <div style={{ 
          position: 'fixed', 
          bottom: '10px', 
          right: '10px', 
          background: 'rgba(0,0,0,0.8)', 
          color: '#fff', 
          padding: '10px', 
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 9999
        }}>
          <div>Employee: {user.employee_id}</div>
          <div>Can Edit: {canEdit ? 'YES' : 'NO'}</div>
          <div>View Only: {user.app_permissions?.sms?.view_only ? 'YES' : 'NO'}</div>
        </div>
      </div>
    </>
  );
}

export default function SMSPage() {
  return (
    <PermissionGuard app="sms">
      <SMSContent />
    </PermissionGuard>
  );
}