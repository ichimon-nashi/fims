// src/app/sms/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import PermissionGuard from '@/components/common/PermissionGuard';
import Navbar from '@/components/common/Navbar';
import styles from './SMS.module.css';
import RRSMSTab from '@/components/sms/RRSMSTab';
import SRMTableTab from '@/components/sms/SRMTableTab';
import StatisticsTab from '@/components/sms/StatisticsTab';
import CrewReportTab from '@/components/sms/CrewReportTab';
import TrendAnalysisTab from '@/components/sms/TrendAnalysisTab';

type SMSTab = 'rr-sms' | 'srm-table' | 'statistics' | 'crew-report' | 'trend-analysis';

function SMSContent() {
  const { user, token } = useAuth();
  const permissions = usePermissions();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SMSTab>('rr-sms');
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [yearsWithData, setYearsWithData] = useState<Set<number>>(new Set());

  const VALID_TABS: SMSTab[] = ['rr-sms', 'srm-table', 'statistics', 'crew-report', 'trend-analysis'];

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && (VALID_TABS as string[]).includes(tabParam)) {
      setActiveTab(tabParam as SMSTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
            className={`${styles.tab} ${activeTab === 'statistics' ? `${styles.activeTab} ${styles.statisticsActiveTab}` : ''}`}
            onClick={() => setActiveTab('statistics')}
          >
            SMS統計
            <span className={styles.tabSubtitle}>SMS Statistics</span>
          </button>
          <div className={styles.tabDivider} aria-hidden="true" />
          <button
            className={`${styles.tab} ${activeTab === 'crew-report' ? `${styles.activeTab} ${styles.crewReportActiveTab}` : ''}`}
            onClick={() => setActiveTab('crew-report')}
          >
            組員報告
            <span className={styles.tabSubtitle}>Crew Report</span>
          </button>
          <div className={styles.tabDivider} aria-hidden="true" />
          <button
            className={`${styles.tab} ${activeTab === 'trend-analysis' ? `${styles.activeTab} ${styles.trendActiveTab}` : ''}`}
            onClick={() => setActiveTab('trend-analysis')}
          >
            趨勢分析
            <span className={styles.tabSubtitle}>Risk Analysis</span>
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
          {activeTab === 'crew-report' && (
            <CrewReportTab
              currentYear={currentYear}
              userId={user.id}
              isAdmin={canEdit}
            />
          )}
          {activeTab === 'trend-analysis' && <TrendAnalysisTab />}
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