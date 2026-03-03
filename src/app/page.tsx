// src/app/page.tsx - Fixed to redirect to dashboard instead of roster
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import LoadingScreen from '@/components/common/LoadingScreen';

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
    return <LoadingScreen message="豪神FIMS載入中..." />;
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