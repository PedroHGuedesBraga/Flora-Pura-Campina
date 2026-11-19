import type { Metadata } from 'next';
import Admin from '@/components/Admin';
import AdminCupons from '@/components/AdminCupons';

export const metadata: Metadata = { title: 'Painel do catálogo', robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <>
      <AdminCupons />
      <Admin />
    </>
  );
}
