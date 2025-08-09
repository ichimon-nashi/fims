// src/app/oral-test/dashboard/page.tsx
'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import OralTestNavigation from '@/components/oral-test/OralTestNavigation/OralTestNavigation';

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

export default function OralTestDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    // Check if user has minimum access level for oral test system
    if (user && user.authentication_level < 1) {
      router.push('/dashboard');
    }
  }, [user, router]);

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
          'Authorization': `Bearer ${localStorage.getItem('token')}` // FIXED: Use correct token key
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
            currentYearRemaining: 0
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
          currentYearRemaining: 0
        },
        examinerStats: [],
        questionsByCategory: [],
        totalQuestions: 0
      });
    } finally {
      setDataLoading(false);
    }
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
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="fade-in">
        {/* Page Header */}
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: 'bold', 
            color: '#2d3748',
            textAlign: 'center',
            marginBottom: '0.5rem'
          }}>
            口試系統儀表板
          </h1>
          <p style={{
            textAlign: 'center',
            color: '#718096',
            fontSize: '1.1rem',
            marginBottom: '2rem'
          }}>
            Oral Test Management Dashboard
          </p>
        </div>

        {/* Internal Navigation */}
        <OralTestNavigation currentPath="/oral-test/dashboard" />

        {/* Dashboard Content */}
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
            <p>Loading dashboard data...</p>
          </div>
        ) : dashboardData ? (
          <div style={{ marginTop: '2rem' }}>
            {/* Stats Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
              marginBottom: '3rem'
            }}>
              {/* Test Progress Card */}
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '16px',
                padding: '2rem',
                color: 'white',
                boxShadow: '0 10px 25px rgba(102, 126, 234, 0.3)'
              }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '600' }}>
                  📊 Test Progress ({dashboardData.currentYear || new Date().getFullYear()})
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                      {dashboardData.examineeTesting.tested}
                    </div>
                    <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Users Tested</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                      {dashboardData.examineeTesting.remaining}
                    </div>
                    <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Remaining</div>
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
                background: 'white',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                border: '1px solid #e2e8f0'
              }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#2d3748', fontSize: '1.25rem', fontWeight: '600' }}>
                  👥 Total Users
                </h3>
                <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#059669', marginBottom: '0.5rem' }}>
                  {dashboardData.examineeTesting.totalUsers || dashboardData.examineeTesting.total || 0}
                </div>
                <div style={{ color: '#718096', fontSize: '0.9rem' }}>
                  Registered Flight Attendants (excluding admin)
                </div>
              </div>

              {/* Questions Card */}
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                border: '1px solid #e2e8f0'
              }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#2d3748', fontSize: '1.25rem', fontWeight: '600' }}>
                  📚 Question Bank
                </h3>
                <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#3182ce', marginBottom: '0.5rem' }}>
                  {dashboardData.totalQuestions || 0}
                </div>
                <div style={{ color: '#718096', fontSize: '0.9rem' }}>
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
                background: 'white',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                border: '1px solid #e2e8f0'
              }}>
                <h3 style={{ margin: '0 0 1.5rem 0', color: '#2d3748', fontSize: '1.25rem', fontWeight: '600' }}>
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
                        background: '#f7fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500', color: '#2d3748', marginBottom: '0.25rem' }}>
                            #{item.question_number || 'N/A'}: {item.question.substring(0, 60)}
                            {item.question.length > 60 ? '...' : ''}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                            Category: {item.category}
                          </div>
                        </div>
                        <div style={{
                          background: '#fed7d7',
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
                    <div style={{ textAlign: 'center', color: '#718096', padding: '2rem' }}>
                      No incorrect question data available yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Examiner Statistics */}
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                border: '1px solid #e2e8f0'
              }}>
                <h3 style={{ margin: '0 0 1.5rem 0', color: '#2d3748', fontSize: '1.25rem', fontWeight: '600' }}>
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
                        background: '#f0fff4',
                        borderRadius: '8px',
                        border: '1px solid #c6f6d5'
                      }}>
                        <div style={{ fontWeight: '500', color: '#2d3748' }}>
                          {examiner.examiner}
                        </div>
                        <div style={{
                          background: '#c6f6d5',
                          color: '#22543d',
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
                    <div style={{ textAlign: 'center', color: '#718096', padding: '2rem' }}>
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
                background: 'white',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                border: '1px solid #e2e8f0'
              }}>
                <h3 style={{ margin: '0 0 1.5rem 0', color: '#2d3748', fontSize: '1.25rem', fontWeight: '600' }}>
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
                      <div style={{ fontWeight: '500', color: '#2d3748' }}>
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
  );
}