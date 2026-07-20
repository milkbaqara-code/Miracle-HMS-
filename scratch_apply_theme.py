import re

file_path = r"d:\Vigilant IT Solutions\Miracle_HMS\web\app\page.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update STYLES block
styles_replacement = """  // ── STYLES ────────────────────────────────
  const s: Record<string, React.CSSProperties> = {
    main:  { 
      display:'flex', 
      alignItems:'center', 
      justifyContent:'center', 
      minHeight:'100vh', 
      padding:'20px', 
      background: 'linear-gradient(135deg, #F0F4F8 0%, #D9E2EC 100%)', 
      position:'relative', 
      overflow:'hidden', 
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      transition: 'background 0.5s ease'
    },
    glow:  { 
      position:'absolute', 
      width:'100vw', 
      height:'100vh', 
      background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.6) 0%, transparent 70%)', 
      top:'0', 
      left:'0', 
      pointerEvents:'none', 
      zIndex:1 
    },
    panel: { 
      background: 'rgba(255, 255, 255, 0.95)', 
      backdropFilter:'blur(20px)', 
      border: '1px solid rgba(255, 255, 255, 0.4)', 
      borderRadius:'1.5rem', 
      padding:'2.5rem 2rem', 
      width:'100%', 
      maxWidth:'26rem', 
      zIndex:10, 
      boxShadow: '0 20px 40px rgba(16, 42, 67, 0.08)',
      transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
    },
    inp:   { 
      width:'100%', 
      padding:'0.85rem 1rem', 
      borderRadius:'0.6rem', 
      background: '#F0F4F8', 
      color:'#102A43', 
      border: '1px solid #D9E2EC', 
      outline:'none', 
      boxSizing:'border-box' as const, 
      fontSize:'0.9rem', 
      fontFamily: 'inherit',
      transition: 'all 0.3s ease'
    },
    lbl:   { 
      fontSize:'11px', 
      fontWeight:700, 
      color: '#486581', 
      letterSpacing:'1px', 
      display:'block', 
      marginBottom:'7px',
      fontFamily: 'inherit'
    },
    btn_a: { 
      width:'100%', 
      padding:'0.85rem', 
      borderRadius:'0.75rem', 
      color:'#FFF', 
      fontWeight:700, 
      letterSpacing:'1px', 
      border: 'none', 
      cursor:'pointer', 
      fontSize:'0.9rem', 
      marginTop:'8px',
      fontFamily: 'inherit',
      boxShadow: '0 4px 6px rgba(35, 104, 162, 0.2)',
      transition: 'all 0.3s ease'
    } as React.CSSProperties,
    flag:  { 
      display:'flex', 
      alignItems:'center', 
      gap:'8px', 
      padding:'0.85rem 1rem', 
      borderRadius:'0.6rem', 
      background:'#F0F4F8', 
      border: '1px solid #D9E2EC', 
      cursor:'pointer', 
      fontSize:'14px', 
      minWidth:'110px', 
      flexShrink:0 
    },
    drop:  { 
      position:'absolute' as const, 
      top:'100%', 
      left:0, 
      zIndex:99, 
      background:'#FFFFFF', 
      border: '1px solid #D9E2EC', 
      borderRadius:'10px', 
      maxHeight:'200px', 
      overflowY:'auto' as const, 
      width:'200px', 
      boxShadow:'0 10px 25px rgba(16, 42, 67, 0.1)' 
    },
  };

  const tabStyle = (a: boolean): React.CSSProperties => {
    return {
      flex:1, 
      padding:'12px', 
      borderRadius:'8px', 
      border: a ? '1px solid #627D98' : '1px solid transparent', 
      background: a ? '#F0F4F8' : 'transparent', 
      color: a ? '#102A43' : '#829AB1', 
      fontWeight:700, 
      fontSize:'11px', 
      cursor:'pointer', 
      letterSpacing:'1px',
      transition: 'all 0.3s ease-in-out'
    };
  };

  const btnStyle = (bg: string): React.CSSProperties => ({ 
    ...s.btn_a, 
    background: 'linear-gradient(90deg, #243B53, #334E68)'
  });"""

content = re.sub(
    r"// ── STYLES ────────────────────────────────.*?const btnStyle = [^\n]*?\n[^\n]*?\n[^\n]*?\n  \}\);",
    styles_replacement,
    content,
    flags=re.DOTALL
)

# 2. Remove canvas block
content = re.sub(r"\{/\* Dynamic 3D Neural Canvas background for Visitor Access view only \*/\}.*?\{!isVisitor && <div style=\{s\.glow\} />\}", "<div style={s.glow} />", content, flags=re.DOTALL)
content = content.replace("{isVisitor && (", "")
content = content.replace("</main>\n  );\n}\n", "") # I'll clean up mismatched parenthesis via regex later if needed but let's just use string replace on exact blocks
# actually, just regex the canvas block out
content = re.sub(r"\{\s*/\*\s*Dynamic 3D Neural Canvas.*?</canvas>\s*\}", "", content, flags=re.DOTALL)


# 3. Replace Logo block
logo_replacement = """{/* LOGO */}
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
        </div>"""
content = re.sub(r"\{/\* LOGO \*/\}.*?</div>\s*</div>", logo_replacement, content, flags=re.DOTALL)

# 4. Text replacements
replacements = {
    "🌐 VISITOR ACCESS": "👥 PATIENT / VISITOR",
    "🛡️ STAFF LOGIN": "⚕️ MEDICAL STAFF",
    "FILL ALL FIELDS TO UNLOCK YOUR VISITOR KEY": "PLEASE ENTER YOUR DETAILS TO CONTINUE",
    "ACQUIRING NEURAL INTEGRATION...": "VERIFYING IDENTITY...",
    "SHIELD GRANTED. SENDING ACCESS KEY REQUEST...": "IDENTITY VERIFIED. SENDING SECURE OTP...",
    "ANALYZING BIOMETRIC FREQUENCY...": "SECURING CONNECTION...",
    "DECRYPTING SOVEREIGN SHIELD HASH...": "VALIDATING HEALTHCARE CREDENTIALS...",
    "GENERATING TEMPORARY KERNEL SEED...": "PREPARING SECURE SESSION...",
    "VALIDATING CLIENT LEDGER ROUTE...": "FINALIZING ACCESS...",
    "🧬 SCAN BIOMETRIC KEY & SEND": "REQUEST ACCESS CODE",
    "⏳ VERIFYING KEY...": "⏳ AUTHENTICATING...",
    "🔓 AUTHORIZE GLOBAL SESSION": "SECURE LOGIN",
    "SRE STATUS": "SYSTEM STATUS",
    "NOMINAL": "ONLINE",
    "background:'rgba(0,0,0,0.6)'": "background:'#F0F4F8'",
    "color:'#FFF'": "color:'#102A43'",
    "color:'#444'": "color:'#627D98'",
    "color:'#888'": "color:'#829AB1'",
    "border:'1px solid #1a1a1a'": "border:'1px solid #D9E2EC'",
    "background:'#0d0d0d'": "background:'#FFFFFF'",
    "background:'#111'": "background:'#FFFFFF'",
    "border:'1px solid #333'": "border:'1px solid #D9E2EC'",
    "borderBottom:'1px solid #141414'": "borderBottom:'1px solid #F0F4F8'",
    "color:'#00F2FF'": "color:'#243B53'",
    "color:'#39FF14'": "color:'#10B981'",
    "color:'#9D00FF'": "color:'#3B82F6'",
    "textShadow:'0 0 15px #00F2FF'": "textShadow:'none'",
    "textShadow:'0 0 15px #39FF14'": "textShadow:'none'",
    "fontFamily: \"'Orbitron', sans-serif\"": "fontFamily: \"'Inter', sans-serif\"",
    "fontFamily: \"'Share Tech Mono', monospace\"": "fontFamily: \"inherit\"",
    "background: 'rgba(0, 242, 255, 0.03)'": "background: '#F0F4F8'",
    "border: '1px solid rgba(0, 242, 255, 0.2)'": "border: '1px solid #D9E2EC'",
    "boxShadow: '0 0 10px #39FF14, 0 0 20px #39FF14'": "boxShadow: 'none'",
    "background: '#39FF14'": "background: '#3B82F6'",
    "border: '2px dashed rgba(0, 242, 255, 0.4)'": "border: '2px dashed #9FB3C8'",
    "border: '2px dashed rgba(157, 0, 255, 0.5)'": "border: '2px dashed #627D98'",
    "color: '#00F2FF'": "color: '#243B53'",
    "color: '#FFF'": "color: '#102A43'",
    "rgba(255,255,255,0.05)": "rgba(0,0,0,0.05)",
    "filter: 'drop-shadow(0 0 10px #00F2FF)'": "filter: 'none'",
    "linear-gradient(90deg, #9D00FF, #00F2FF)": "linear-gradient(90deg, #3B82F6, #10B981)",
    "SECURE DECRYPTION": "VERIFIED",
    "background:'rgba(0,255,136,0.05)'": "background:'#ECFDF5'",
    "border:'1px solid rgba(0,255,136,0.2)'": "border:'1px solid #A7F3D0'",
    "color:'#00FF88'": "color:'#065F46'",
    "color:'#D4AF37'": "color:'#B45309'",
    "background:'rgba(0,242,255,0.06)'": "background:'#EFF6FF'",
    "border:'1px solid rgba(0,242,255,0.3)'": "border:'1px solid #BFDBFE'",
    "textShadow:'0 0 20px rgba(0,242,255,0.8)'": "textShadow:'none'",
    "color:'#555'": "color:'#627D98'",
    "color:'#666'": "color:'#829AB1'",
    "color:'#FF3131'": "color:'#EF4444'",
    "background:'rgba(0,0,0,0.4)'": "background:'#F0F4F8'",
    "border:'1px solid rgba(0,242,255,0.2)'": "border:'1px solid #D9E2EC'",
    "border:'1px solid rgba(212,175,55,0.2)'": "border:'1px solid #FDE68A'",
    "Warping to Miracle HMS...": "Redirecting to Dashboard...",
    "NEURAL DIAGNOSTIC READOUT TERMINAL LOGS FOR VISITORS": "Hide Terminal Logs",
}

for k, v in replacements.items():
    content = content.replace(k, v)

# 5. Hide Terminal Logs explicitly
content = re.sub(r"\{/\* Hide Terminal Logs \*/\}.*?\{/\* SRE STATUS \*/\}", "{/* SRE STATUS */}", content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated successfully")
