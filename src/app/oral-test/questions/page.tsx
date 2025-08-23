// src/app/oral-test/questions/page.tsx
'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import QuestionManagement from '@/components/oral-test/management/QuestionManagement/QuestionManagement';
import OralTestNavigation from '@/components/oral-test/OralTestNavigation/OralTestNavigation';

export default function QuestionsPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.authentication_level < 4) {
      router.push('/oral-test/dashboard');
    }
  }, [user, router]);

  // Show loading or redirect if insufficient permissions
  if (!user || user.authentication_level < 4) {
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
        <p>Checking permissions...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="fade-in">
        {/* Page Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: 'bold', 
            color: '#2d3748',
            textAlign: 'center',
            marginBottom: '0.5rem'
          }}>
            題庫管理
          </h1>
          <p style={{
            textAlign: 'center',
            color: '#718096',
            fontSize: '1.1rem'
          }}>
            Question Bank Management System
          </p>
        </div>

        {/* Internal Navigation */}
        <OralTestNavigation currentPath="/oral-test/questions" />

        {/* Question Management Component */}
        <div style={{ marginTop: '2rem' }}>
          <QuestionManagement />
        </div>
      </div>
    </div>
  );
}