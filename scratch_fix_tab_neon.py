import re

file_path = r"d:\Vigilant IT Solutions\Miracle_HMS\web\app\page.tsx"
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """        {/* LOGO */}
        <div style={{textAlign:'center', marginBottom:'1.5rem'}}>
          <div className="acrylic-logo" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'52px',height:'52px',marginBottom:'1rem', background:'#000000', border:'2px solid #00FF88', borderRadius:'8px', color:'#00FF88', boxShadow:'0 0 15px rgba(0, 255, 136, 0.4)'}}>
            <span className="acrylic-text" style={{fontWeight:900,fontSize:'1.8rem'}}>+</span>
          </div>
          <h1 style={{fontFamily: "'Inter', sans-serif", fontSize:'1.4rem',fontWeight:900,letterSpacing:'2px',margin:'0 0 0.4rem', color:'#00FF88', textShadow:'0 0 10px rgba(0, 255, 136, 0.5)'}}>
            MIRACLE HMS
          </h1>
          <p style={{fontSize:'0.65rem',color:'#00A86B',fontWeight:800,letterSpacing:'2px',margin:0}}>
            SECURE HEALTHCARE PORTAL
          </p>
        </div>

        {/* TAB SWITCHER */}
        <div style={{display:'flex',gap:'8px',marginBottom:'1.5rem'}}>
          <button style={tabStyle(loginView==='VISITOR_OTP')} onClick={()=>setLoginView('VISITOR_OTP')}>👥 PATIENT / VISITOR</button>
          <button style={tabStyle(loginView==='STAFF_LOGIN')} onClick={()=>setLoginView('STAFF_LOGIN')}>⚕️ MEDICAL STAFF</button>
        </div>

        {/* ══ VISITOR OTP FLOW ══════════════════ */}
        {loginView === 'VISITOR_OTP' && (

          <>
            {otpStep === 'FORM' && (
              <>
                {isScanning ? (
                  /* BIOMETRIC SCANNING HUD BLOCK */
                  <div style={{
                    padding: '24px',
                    background: '#000000',
                    border: '2px solid #006A4E',
                    borderRadius: '4px',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    margin: '10px 0'
                  }}>
                    {/* Sweeping laser inside the scanner */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      width: '100%',
                      height: '2px',
                      background: '#00FF88',
                      boxShadow: 'none',
                      animation: 'scanner-sweep-inside 2s linear infinite'
                    }} />

                    {/* Rotating structural elements */}
                    <div style={{
                      width: '100px',
                      height: '100px',
                      margin: '0 auto 18px',
                      borderRadius: '50%',
                      border: '2px dashed #006A4E',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      animation: 'spin-dashed 12s linear infinite',
                      position: 'relative'
                    }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        border: '2px dashed #00FF88',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'spin-dashed-reverse 8s linear infinite'
                      }}>
                        <div style={{ fontSize: '36px', filter: 'none', animation: 'pulse-scanner 1.2s ease-in-out infinite' }}>
                          🏥
                        </div>
                      </div>
                    </div>

                    <div style={{ fontFamily: "inherit", fontSize: '11px', color: '#00FF88', letterSpacing: '2px', fontWeight: 900, marginBottom: '8px' }}>
                      {scanStatusText}
                    </div>"""

# Replace the broken block
content = re.sub(r"\{\/\* LOGO \*\/\}.*?\{scanStatusText\}\s*<\/div>", replacement, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed tab switcher neon")
