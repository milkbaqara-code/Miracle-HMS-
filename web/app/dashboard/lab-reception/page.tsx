// web/app/dashboard/lab-reception/page.tsx
'use client';

import UniversalCashierPOS from '../../components/UniversalPOS';

export default function LabReceptionPage() {
  return (
    <UniversalCashierPOS 
      fixedTerminal="Z-17-LABS" 
      fixedTitle="DIAGNOSTIC LAB RECEPTION" 
      fixedSubtitle="PATHOLOGY & IMAGING | AUTONOMOUS CLINICAL ZONE" 
    />
  );
}
