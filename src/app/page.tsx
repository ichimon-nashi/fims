// src/app/page.tsx - Fixed to redirect to dashboard instead of roster
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Image from 'next/image';

function HomePageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // User is logged in, redirect to dashboard instead of roster
        router.replace('/dashboard');
      } else {
        // User is not logged in, redirect to login
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1f35 0%, #2d3651 100%)'
      }}>
        <div style={{
          marginBottom: '2rem',
          position: 'relative',
          width: '350px',
          height: '350px'
        }}>
          <Image
            src="/K-dogmatic.png"
            alt="Loading"
            fill
            style={{ objectFit: 'contain' }}
            priority
            unoptimized
          />
        </div>
        <div style={{ 
          color: '#e8e9ed', 
          textAlign: 'center',
          fontSize: '1.5rem',
          fontWeight: 'bold'
        }}>
          豪神FIMS載入中...
        </div>
      </div>
    );
  }

  return null; // Will redirect
}

export default function HomePage() {
  return (
    <AuthProvider>
      <HomePageContent />
    </AuthProvider>
  );
}