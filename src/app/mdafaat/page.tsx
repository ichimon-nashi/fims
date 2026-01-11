// src/app/mdafaat/page.tsx
import Navbar from '@/components/common/Navbar';
import MDAfaatGame from '@/components/mdafaat/MDAfaatGame';

export const metadata = {
  title: 'FIMS - 情境演練',
  description: '情境演練APP',
};

export default function MDAfaatPage() {
  return (
    <>
      <Navbar />
      <MDAfaatGame />
    </>
  );
}