// src/app/oral-test/layout.tsx
import { Metadata } from 'next';
import ClientOralTestLayout from './ClientOralTestLayout';

export const metadata: Metadata = {
  title: 'FIMS - Oral Test',
  description: '口試題目管理與紀錄',
};

export default function OralTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientOralTestLayout>{children}</ClientOralTestLayout>;
}