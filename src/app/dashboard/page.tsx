// src/app/dashboard/page.tsx - Fixed to use global auth context
import { Metadata } from 'next';
import Dashboard from '@/components/dashboard/Dashboard';

export const metadata: Metadata = {
  title: 'FIMS - 儀表板',
  description: '系統總覽與快速功能',
};

export default function DashboardPage() {
  return <Dashboard />;
}