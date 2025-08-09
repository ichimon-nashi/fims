// src/app/oral-test/layout.tsx
"use client";

import { AuthProvider } from '@/context/AuthContext';
import { useEffect } from 'react';
import DeviceCheck from '@/components/layout/DeviceCheck/DeviceCheck';
import Navbar from '@/components/common/Navbar'; // Fixed import path

export default function OralTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Add any oral-test specific initialization here
    console.log('Oral Test module loaded');
  }, []);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <DeviceCheck />
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}