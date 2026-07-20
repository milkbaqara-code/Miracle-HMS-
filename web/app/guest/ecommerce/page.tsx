"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /guest/ecommerce → Redirects to /guest/order
 * Both share the same POS-linked catalog via API_BASE/guest/catalog
 */
export default function EcommerceRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/guest/order');
  }, [router]);

  return (
    <div style={{ 
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', 
      background: '#030303', flexDirection: 'column', gap: '20px' 
    }}>
      <div style={{ 
        width: '50px', height: '50px', border: '3px solid rgba(215, 15, 100, 0.2)', 
        borderTopColor: '#D70F64', borderRadius: '50%', animation: 'spin 1s linear infinite' 
      }} />
      <p style={{ color: '#D70F64', fontSize: '10px', fontWeight: 900, letterSpacing: '4px' }}>
        LOADING STORE...
      </p>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
