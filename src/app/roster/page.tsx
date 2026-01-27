// src/app/roster/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import PermissionGuard from '@/components/common/PermissionGuard';
import RosterComponent from '@/components/roster/RosterComponent';
import Image from 'next/image';

function RosterPageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
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

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <PermissionGuard app="roster">
      <RosterComponent />
    </PermissionGuard>
  );
}

export default function RosterPage() {
  return (
    <AuthProvider>
      <RosterPageContent />
    </AuthProvider>
  );
}