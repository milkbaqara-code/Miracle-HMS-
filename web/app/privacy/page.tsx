import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#050505', 
      color: '#FFF', 
      padding: '40px 20px', 
      fontFamily: 'Inter, system-ui, sans-serif',
      lineHeight: '1.6'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: 900, 
          background: 'linear-gradient(to right, #00F2FF, #006AFF)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent',
          marginBottom: '30px'
        }}>
          Privacy Policy — Miracle HMS
        </h1>
        
        <p style={{ color: '#888', marginBottom: '40px' }}>Last Updated: April 18, 2026</p>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#00F2FF', fontSize: '1.5rem', marginBottom: '15px' }}>1. Overview</h2>
          <p>
            Miracle HMS and the Miracle Guest App are designed to provide a premium, seamless hospitality experience. 
            We value your privacy and are committed to protecting your personal data through our Sovereign Cloud infrastructure.
          </p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#00F2FF', fontSize: '1.5rem', marginBottom: '15px' }}>2. Data Collection</h2>
          <p>We collect only essential information required for your stay and loyalty benefits:</p>
          <ul style={{ listStyleType: 'square', paddingLeft: '20px', color: '#CCC' }}>
            <li>Identity Information (Name, NID/Passport for registration)</li>
            <li>Contact Information (Phone number, Email)</li>
            <li>Stay Details (Reservations, Room service orders)</li>
            <li>Loyalty Data (Coins earned, usage history)</li>
          </ul>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#00F2FF', fontSize: '1.5rem', marginBottom: '15px' }}>3. How We Use Data</h2>
          <p>Your data is used exclusively to:</p>
          <ul style={{ listStyleType: 'square', paddingLeft: '20px', color: '#CCC' }}>
            <li>Manage your reservations and room services.</li>
            <li>Synchronize your Loyalty Coins across the Miracle ecosystem.</li>
            <li>Provide personalized offers and guest support.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#00F2FF', fontSize: '1.5rem', marginBottom: '15px' }}>4. Data Security</h2>
          <p>
            All data is transmitted via industry-standard SSL/TLS encryption. Personal information is stored 
            on our secure, sovereign servers with strict access controls. We do not sell or share your data 
            with third-party advertisers.
          </p>
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#00F2FF', fontSize: '1.5rem', marginBottom: '15px' }}>5. Contact Us</h2>
          <p>
            For any privacy-related inquiries, please contact us at:<br />
            <strong>support@vigilantitsolution.com</strong>
          </p>
        </section>

        <div style={{ 
          marginTop: '60px', 
          padding: '20px', 
          border: '1px solid #00F2FF33', 
          borderRadius: '12px', 
          background: 'rgba(0, 242, 255, 0.05)',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#00F2FF' }}>
            Powered by Antigravity Sovereign Cloud Infrastructure
          </p>
        </div>
      </div>
    </div>
  );
}
