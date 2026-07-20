import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Zone 30 — Property Management System | Miracle HMS',
  description: 'Sovereign PMS: OWNED, RENTED and AFFILIATED property portfolio management with double-entry GL accounting, BOM capitalization, and PCI-DSS card vault.',
};

export default function PMSLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
