// src/app/oral-test/dashboard/page.tsx
'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PermissionGuard from '@/components/common/PermissionGuard';
import OralTestNavigation from '@/components/oral-test/OralTestNavigation/OralTestNavigation';

interface RemainingUser {
  employee_id: string;
  full_name: string;
  rank: string;
  base: string;
  lastFaatTestDate: string | null;
}

interface DashboardData {
  topIncorrectQuestions: Array<{
    question: string;
    question_number?: number;
    question_title?: string;
    category: string;
    count: number;
  }>;
  examineeTesting: {
    tested: number;
    remaining: number;
    total: number;
    totalUsers?: number;
    currentYearTested?: number;
    currentYearRemaining?: number;
    remainingUsersList?: RemainingUser[];
  };
  examinerStats: Array<{
    examiner: string;
    count: number;
  }>;
  questionsByCategory?: Array<{
    category: string;
    count: number;
  }>;
  totalQuestions?: number;
  currentYear?: number;
}

function OralTestDashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [showRemainingModal, setShowRemainingModal] = useState(false);

  // Permission check now handled by PermissionGuard wrapper

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setDataLoading(true);
      console.log('Fetching oral test dashboard data...');
      
      const response = await fetch('/api/oral-test/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Oral Test Dashboard API response:', data);
        setDashboardData(data);
      } else {
        console.error('Failed to fetch oral test dashboard data, status:', response.status);
        const errorData = await response.json();
        console.error('Error details:', errorData);
        
        // Set fallback data if API fails
        setDashboardData({
          topIncorrectQuestions: [],
          examineeTesting: {
            tested: 0,
            remaining: 0,
            total: 0,
            totalUsers: 0,
            currentYearTested: 0,
            currentYearRemaining: 0,
            remainingUsersList: []
          },
          examinerStats: [],
          questionsByCategory: [],
          totalQuestions: 0
        });
      }
    } catch (error) {
      console.error('Error fetching oral test dashboard data:', error);
      
      // Set fallback data on network error
      setDashboardData({
        topIncorrectQuestions: [],
        examineeTesting: {
          tested: 0,
          remaining: 0,
          total: 0,
          totalUsers: 0,
          currentYearTested: 0,
          currentYearRemaining: 0,
          remainingUsersList: []
        },
        examinerStats: [],
        questionsByCategory: [],
        totalQuestions: 0
      });
    } finally {
      setDataLoading(false);
    }
  };

  const formatLastTested = (dateStr: string | null): string => {
    if (!dateStr) return 'Never tested';
    return new Date(dateStr).toLocaleDateString();
  };

  // Show loading if no user
  if (!user) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        height: '50vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div className="loading-spinner"></div>
        <p style={{ color: '#e8e9ed' }}>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <style jsx>{`
        .test-page-container {
          padding: 0;
          width: 100%;
          display: flex;
          flex-direction: column;
        }

        .test-page-content {
          display: flex;
          flex-direction: column;
        }

        .test-page-header {
          padding: 1rem 1.5rem 0.75rem 1.5rem;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          flex-shrink: 0;
        }

        .test-page-title {
          font-size: 3rem;
          font-weight: bold;
          color: #4a9eff;
          text-align: center;
          margin-bottom: 0.35rem;
          text-shadow: 0 2px 4px rgba(74, 158, 255, 0.3);
        }

        .test-page-subtitle {
          text-align: center;
          color: #a0aec0;
          font-size: 1.2rem;
        }

        .test-page-nav {
          padding: 0.5rem 1rem;
          flex-shrink: 0;
        }

        .dashboard-content-wrapper {
          flex: 1;
          padding: 1.5rem;
        }

        /* DESKTOP ONLY - Overflow Hidden & Fixed Height */
        @media (min-width: 1025px) {
          .test-page-content {
            height: 100%;
          }

          .dashboard-content-wrapper {
            min-height: 0;
          }
        }

        /* MOBILE & TABLET - Natural Scroll */
        @media (max-width: 1024px) {
          .test-page-container {
            min-height: auto;
            overflow: visible;
          }

          .test-page-content {
            min-height: auto;
            overflow: visible;
          }

          .dashboard-content-wrapper {
            min-height: auto;
            overflow: visible;
          }

          .test-page-header {
            padding: 1.5rem 1.5rem 1rem 1.5rem;
          }

          .test-page-title {
            font-size: 2.25rem;
            margin-bottom: 0.5rem;
          }

          .test-page-subtitle {
            font-size: 1rem;
          }

          .test-page-nav {
            padding: 0.75rem 1rem;
          }
        }

        /* Tablet portrait: force 3 columns for stats cards */
        @media (min-width: 768px) and (max-width: 1024px) {
          .stats-cards-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }

        /* Mobile: stack stats cards */
        @media (max-width: 767px) {
          .stats-cards-grid {
            grid-template-columns: 1fr !important;
          }
        }

        /* Remaining-users drill-down modal */
        .remaining-icon-button {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          border-radius: 8px;
          width: 32px;
          height: 32px;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 1rem;
          color: white;
          transition: all 0.2s ease;
        }

        .remaining-icon-button:hover {
          background: rgba(255, 255, 255, 0.35);
          transform: scale(1.05);
        }

        .remaining-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(26, 31, 53, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 1.5rem;
        }

        .remaining-modal-content {
          background: rgba(45, 54, 81, 0.98);
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          max-width: 600px;
          width: 100%;
          max-height: 80vh;
          overflow-y: auto;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .remaining-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid rgba(255, 255, 255, 0.1);
        }

        .remaining-modal-title {
          color: #4a9eff;
          font-size: 1.4rem;
          font-weight: 700;
          margin: 0;
        }

        .remaining-modal-close {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          width: 2.25rem;
          height: 2.25rem;
          font-size: 1.1rem;
          color: #e8e9ed;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .remaining-modal-close:hover {
          background: rgba(239, 68, 68, 0.8);
          border-color: #ef4444;
        }

        .remaining-user-row {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 1rem;
          padding: 0.85rem 1rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          margin-bottom: 0.6rem;
        }

        .remaining-user-name {
          font-weight: 600;
          color: #e8e9ed;
        }

        .remaining-user-meta {
          font-size: 0.8rem;
          color: #a0aec0;
        }

        .remaining-user-last-tested {
          font-size: 0.85rem;
          color: #f87171;
          text-align: right;
          white-space: nowrap;
        }

        .remaining-empty-state {
          text-align: center;
          color: #a0aec0;
          padding: 2rem;
        }

        @media (max-width: 600px) {
          .remaining-user-row {
            grid-template-columns: 1fr;
            gap: 0.4rem;
          }

          .remaining-user-last-tested {
            text-align: left;
          }
        }
      `}</style>

      <div className="test-page-container">
        <div className="test-page-content fade-in">
          {/* Page Header */}
          <div className="test-page-header">
            <h1 className="test-page-title">口試儀表板</h1>
            <p className="test-page-subtitle">
              Oral Test Management Dashboard
            </p>
          </div>

          {/* Internal Navigation */}
          <div className="test-page-nav">
            <OralTestNavigation currentPath="/oral-test/dashboard" />
          </div>

          {/* Dashboard Content */}
          <div className="dashboard-content-wrapper">
            {dataLoading ? (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                padding: '4rem',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <div className="loading-spinner" style={{ 
                  width: '40px', 
                  height: '40px',
                  borderWidth: '4px'
                }}></div>
                <p style={{ color: '#e8e9ed' }}>Loading dashboard data...</p>
              </div>
            ) : dashboardData ? (
              <div style={{ marginTop: '2rem' }}>
                {/* Stats Cards */}
                <div className="stats-cards-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1.5rem',
                  marginBottom: '3rem'
                }}>
                  {/* Test Progress Card */}
                  <div style={{
                    background: 'linear-gradient(135deg, #4a9eff 0%, #357abd 100%)',
                    borderRadius: '16px',
                    padding: '2rem',
                    color: 'white',
                    boxShadow: '0 10px 25px rgba(74, 158, 255, 0.3)'
                  }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '600' }}>
                      📊 FAAT Progress ({dashboardData.currentYear || new Date().getFullYear()})
                    </h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                          {dashboardData.examineeTesting.tested}
                        </div>
                        <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Users Tested</div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                        <div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                            {dashboardData.examineeTesting.remaining}
                          </div>
                          <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Remaining</div>
                        </div>
                        {dashboardData.examineeTesting.remaining > 0 && (
                          <button
                            className="remaining-icon-button"
                            onClick={() => setShowRemainingModal(true)}
                            title="See which crew still need FAAT this year"
                            aria-label="See which crew still need FAAT this year"
                          >
                            👁️
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      height: '8px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        background: 'white',
                        height: '100%',
                        width: dashboardData.examineeTesting.total > 0 
                          ? `${(dashboardData.examineeTesting.tested / dashboardData.examineeTesting.total) * 100}%`
                          : '0%',
                        borderRadius: '8px',
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', opacity: 0.9 }}>
                      {dashboardData.examineeTesting.total > 0 
                        ? Math.round((dashboardData.examineeTesting.tested / dashboardData.examineeTesting.total) * 100)
                        : 0}% Complete
                    </div>
                  </div>

                  {/* Total Users Card */}
                  <div style={{
                    background: 'rgba(45, 54, 81, 0.98)',
                    borderRadius: '16px',
                    padding: '2rem',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#4a9eff', fontSize: '1.25rem', fontWeight: '600' }}>
                      👥 Total Users
                    </h3>
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#059669', marginBottom: '0.5rem' }}>
                      {dashboardData.examineeTesting.totalUsers || dashboardData.examineeTesting.total || 0}
                    </div>
                    <div style={{ color: '#a0aec0', fontSize: '0.9rem' }}>
                      Cabin Crew (excluding admin)
                    </div>
                  </div>

                  {/* Questions Card */}
                  <div style={{
                    background: 'rgba(45, 54, 81, 0.98)',
                    borderRadius: '16px',
                    padding: '2rem',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#4a9eff', fontSize: '1.25rem', fontWeight: '600' }}>
                      📚 Question Bank
                    </h3>
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#4a9eff', marginBottom: '0.5rem' }}>
                      {dashboardData.totalQuestions || 0}
                    </div>
                    <div style={{ color: '#a0aec0', fontSize: '0.9rem' }}>
                      Total Questions Available
                    </div>
                  </div>
                </div>

                {/* Charts and Data */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                  gap: '2rem'
                }}>
                  {/* Top Incorrect Questions */}
                  <div style={{
                    background: 'rgba(45, 54, 81, 0.98)',
                    borderRadius: '16px',
                    padding: '2rem',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', color: '#4a9eff', fontSize: '1.25rem', fontWeight: '600' }}>
                      📈 Top Incorrect Questions
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {dashboardData.topIncorrectQuestions && dashboardData.topIncorrectQuestions.length > 0 ? (
                        dashboardData.topIncorrectQuestions.map((item, index) => (
                          <div key={index} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '1rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '500', color: '#4a9eff', marginBottom: '0.25rem' }}>
                                #{item.question_number || 'N/A'}: {item.question.substring(0, 60)}
                                {item.question.length > 60 ? '...' : ''}
                              </div>
                              <div style={{ fontSize: '0.875rem', color: '#a0aec0' }}>
                                Category: {item.category}
                              </div>
                            </div>
                            <div style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#c53030',
                              padding: '0.5rem 1rem',
                              borderRadius: '20px',
                              fontWeight: '600',
                              fontSize: '0.875rem'
                            }}>
                              {item.count} errors
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', color: '#a0aec0', padding: '2rem' }}>
                          No incorrect question data available yet.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Examiner Statistics */}
                  <div style={{
                    background: 'rgba(45, 54, 81, 0.98)',
                    borderRadius: '16px',
                    padding: '2rem',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', color: '#4a9eff', fontSize: '1.25rem', fontWeight: '600' }}>
                      👨‍🏫 Examiner Activity
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {dashboardData.examinerStats && dashboardData.examinerStats.length > 0 ? (
                        dashboardData.examinerStats.map((examiner, index) => (
                          <div key={index} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '1rem',
                            background: 'rgba(16, 185, 129, 0.15)',
                            borderRadius: '8px',
                            border: '1px solid #c6f6d5'
                          }}>
                            <div style={{ fontWeight: '500', color: '#4a9eff' }}>
                              {examiner.examiner}
                            </div>
                            <div style={{
                              background: '#c6f6d5',
                              color: '#10b981',
                              padding: '0.5rem 1rem',
                              borderRadius: '20px',
                              fontWeight: '600',
                              fontSize: '0.875rem'
                            }}>
                              {examiner.count} tests
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', color: '#a0aec0', padding: '2rem' }}>
                          No examiner activity data available yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Questions by Category */}
                {dashboardData.questionsByCategory && dashboardData.questionsByCategory.length > 0 && (
                  <div style={{
                    marginTop: '2rem',
                    background: 'rgba(45, 54, 81, 0.98)',
                    borderRadius: '16px',
                    padding: '2rem',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', color: '#4a9eff', fontSize: '1.25rem', fontWeight: '600' }}>
                      📊 Questions by Category
                    </h3>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: '1rem'
                    }}>
                      {dashboardData.questionsByCategory.map((category, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '1rem',
                          background: '#ebf8ff',
                          borderRadius: '8px',
                          border: '1px solid #bee3f8'
                        }}>
                          <div style={{ fontWeight: '500', color: '#4a9eff' }}>
                            {category.category}
                          </div>
                          <div style={{
                            background: '#3182ce',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '20px',
                            fontWeight: '600',
                            fontSize: '0.875rem'
                          }}>
                            {category.count}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="alert alert-error">
                Failed to load dashboard data. Please try refreshing the page.
              </div>
            )}
          </div>
        </div>
      </div>

      {showRemainingModal && (
        <div
          className="remaining-modal-overlay"
          onClick={() => setShowRemainingModal(false)}
        >
          <div
            className="remaining-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="remaining-modal-header">
              <h2 className="remaining-modal-title">
                尚未測驗(FAAT) ({dashboardData?.currentYear || new Date().getFullYear()})
              </h2>
              <button
                className="remaining-modal-close"
                onClick={() => setShowRemainingModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {dashboardData?.examineeTesting.remainingUsersList &&
            dashboardData.examineeTesting.remainingUsersList.length > 0 ? (
              dashboardData.examineeTesting.remainingUsersList.map((u) => (
                <div className="remaining-user-row" key={u.employee_id}>
                  <div>
                    <div className="remaining-user-name">{u.full_name}</div>
                    <div className="remaining-user-meta">
                      {u.employee_id} · {u.rank} · {u.base}
                    </div>
                  </div>
                  <div className="remaining-user-last-tested">
                    {formatLastTested(u.lastFaatTestDate)}
                  </div>
                </div>
              ))
            ) : (
              <div className="remaining-empty-state">
                No remaining-users data available.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
export default function OralTestDashboard() {
  return (
    <PermissionGuard app="oral_test">
      <OralTestDashboardContent />
    </PermissionGuard>
  );
}