import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Miracle General Hospital & Diagnosis Center — State-of-the-Art Clinical Excellence',
  description: 'Experience clinical excellence and futuristic medical diagnostics at Miracle General Hospital & Diagnosis Center. Advanced healthcare, digital health records, and world-class care.',
  keywords: 'hospital, clinic, diagnosis center, OPD booking, health checkup, clinical excellence, EMR, telemedicine',
  openGraph: {
    title: 'Miracle General Hospital & Diagnosis Center — Clinical Excellence',
    description: 'Advanced healthcare and futuristic diagnostic center.',
    type: 'website',
  },
};

export default function WebLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#000', color: '#fff', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' }}>
      {children}
    </div>
  );
}
