// File: src/app/oral-test/results/page.tsx
'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ResultsTable from '@/components/oral-test/results/ResultsTable/ResultsTable';
import OralTestNavigation from '@/components/oral-test/OralTestNavigation/OralTestNavigation';

export default function ResultsPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.authentication_level < 2) {
      router.push('/oral-test/dashboard');
    }
  }, [user, router]);

  if (!user || user.authentication_level < 2) {
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
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: 'bold', 
            color: '#2d3748',
            textAlign: 'center',
            marginBottom: '0.5rem'
          }}>
            成績查詢
          </h1>
          <p style={{
            textAlign: 'center',
            color: '#718096',
            fontSize: '1.1rem'
          }}>
            Test Results & Analytics
          </p>
        </div>

        <OralTestNavigation currentPath="/oral-test/results" />

        {/* Results Table Component */}
        <div style={{ marginTop: '2rem' }}>
          <ResultsTable />
        </div>
      </div>
    </div>
  );
}