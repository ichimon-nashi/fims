// File: src/app/oral-test/test/page.tsx - OVERFLOW HIDDEN DESKTOP ONLY
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
        <p style={{ color: '#a0aec0' }}>Checking permissions...</p>
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

        .test-interface-wrapper {
          flex: 1;
        }

        /* DESKTOP ONLY - Overflow Hidden & Fixed Height */
        @media (min-width: 1025px) {
          .test-page-content {
            height: 100%;
          }

          .test-interface-wrapper {
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

          .test-interface-wrapper {
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
      `}</style>

      <div className="test-page-container">
        <div className="test-page-content fade-in">
          {/* Header */}
          <div className="test-page-header">
            <h1 className="test-page-title">
              考試介面
            </h1>
            <p className="test-page-subtitle">
              Oral Test Interface
            </p>
          </div>

          {/* Navigation */}
          <div className="test-page-nav">
            <OralTestNavigation currentPath="/oral-test/test" />
          </div>

          {/* Test Interface */}
          <div className="test-interface-wrapper">
            <TestInterface />
          </div>
        </div>
      </div>
    </>
  );
}