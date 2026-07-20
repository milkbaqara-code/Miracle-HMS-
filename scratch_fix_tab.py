import re

file_path = r"d:\Vigilant IT Solutions\Miracle_HMS\web\app\page.tsx"
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# The messed up part starts at "        {/* LOGO */}" (already replaced)
# Wait, it looks like this currently in the file:
#         {/* LOGO */}
#         <div style={{textAlign:'center', marginBottom:'1.5rem'}}>
#           ...
#         </div>
#                     </div>
# 
#                     <div style={{ fontFamily: "inherit", fontSize: '11px', color: '#243B53', letterSpacing: '2px', fontWeight: 900, marginBottom: '8px' }}>
#                       {scanStatusText}
#                     </div>

replacement = """        {/* LOGO */}
        <div style={{textAlign:'center', marginBottom:'1.5rem'}}>
          <div className="acrylic-logo" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'52px',height:'52px',marginBottom:'1rem', background:'#F0F4F8', borderRadius:'14px', color:'#243B53'}}>
            <span className="acrylic-text" style={{fontWeight:800,fontSize:'1.8rem'}}>+</span>
          </div>
          <h1 style={{fontFamily: "'Inter', sans-serif", fontSize:'1.4rem',fontWeight:800,letterSpacing:'2px',margin:'0 0 0.4rem', color:'#102A43'}}>
            MIRACLE HMS
          </h1>
          <p style={{fontSize:'0.65rem',color:'#486581',fontWeight:700,letterSpacing:'1.5px',margin:0}}>
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
                    background: '#F0F4F8',
                    border: '1px solid #D9E2EC',
                    borderRadius: '16px',
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
                      background: '#3B82F6',
                      boxShadow: 'none',
                      animation: 'scanner-sweep-inside 2s linear infinite'
                    }} />

                    {/* Rotating structural elements */}
                    <div style={{
                      width: '100px',
                      height: '100px',
                      margin: '0 auto 18px',
                      borderRadius: '50%',
                      border: '2px dashed #9FB3C8',
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
                        border: '2px dashed #627D98',
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

                    <div style={{ fontFamily: "inherit", fontSize: '11px', color: '#243B53', letterSpacing: '2px', fontWeight: 900, marginBottom: '8px' }}>
                      {scanStatusText}
                    </div>"""

# replace from {/* LOGO */} down to {scanStatusText}</div>
content = re.sub(r"\{\/\* LOGO \*\/\}.*?\{scanStatusText\}\s*</div>", replacement, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed successfully")
