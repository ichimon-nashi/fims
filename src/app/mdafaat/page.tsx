// src/app/mdafaat/page.tsx
"use client";

import PermissionGuard from '@/components/common/PermissionGuard';
import Navbar from '@/components/common/Navbar';
import MDAfaatGame from '@/components/mdafaat/MDAfaatGame';

export default function MDAfaatPage() {
  return (
    <PermissionGuard app="mdafaat">
      <Navbar />
      <MDAfaatGame />
    </PermissionGuard>
  );
}