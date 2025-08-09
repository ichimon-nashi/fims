// File: src/app/oral-test/test/page.tsx
'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import TestInterface from '@/components/oral-test/test/TestInterface/TestInterface';
import OralTestNavigation from '@/components/oral-test/OralTestNavigation/OralTestNavigation';

export default function TestPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.authentication_level < 3) {
      router.push('/oral-test/dashboard');
    }
  }, [user, router]);

  if (!user || user.authentication_level < 3) {
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
            考試介面
          </h1>
          <p style={{
            textAlign: 'center',
            color: '#718096',
            fontSize: '1.1rem'
          }}>
            Oral Test Interface
          </p>
        </div>

        <OralTestNavigation currentPath="/oral-test/test" />

        {/* Test Interface Component */}
        <div style={{ marginTop: '2rem' }}>
          <TestInterface />
        </div>
      </div>
    </div>
  );
}