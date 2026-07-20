import re

file_path = r"d:\Vigilant IT Solutions\Miracle_HMS\web\app\page.tsx"
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

styles_replacement = """  // ── STYLES ────────────────────────────────
  const s: Record<string, React.CSSProperties> = {
    main:  { 
      display:'flex', 
      alignItems:'center', 
      justifyContent:'center', 
      minHeight:'100vh', 
      padding:'20px', 
      backgroundColor: '#000000', 
      position:'relative', 
      overflow:'hidden', 
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      transition: 'background 0.5s ease'
    },
    droneBg: {
      position: 'absolute',
      top: '-10%',
      left: '-10%',
      width: '120%',
      height: '120%',
      backgroundImage: 'url(/flower_field.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      animation: 'drone-fly 30s linear infinite alternate',
      zIndex: 0,
      filter: 'brightness(0.6) contrast(1.2) saturate(0.8)',
    },
    glow:  { 
      position:'absolute', 
      width:'100vw', 
      height:'100vh', 
      background: 'radial-gradient(circle at 50% 50%, rgba(0, 255, 136, 0.15) 0%, transparent 60%)', 
      top:'0', 
      left:'0', 
      pointerEvents:'none', 
      zIndex:1,
      animation: 'pulse-glow 4s ease-in-out infinite alternate'
    },
    panel: { 
      background: 'rgba(2, 10, 5, 0.8)', 
      backdropFilter:'blur(20px)', 
      border: '1px solid rgba(0, 255, 136, 0.3)', 
      borderTop: '3px solid #00FF88', // Sci-fi top heavy accent
      borderRadius:'0', 
      padding:'2.5rem 2rem', 
      width:'100%', 
      maxWidth:'26rem', 
      zIndex:10, 
      boxShadow: '0 0 50px rgba(0, 255, 136, 0.3), inset 0 0 20px rgba(0, 255, 136, 0.15)', 
      animation: 'neon-pulse 3s infinite alternate',
      transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      position: 'relative'
    },
    inp:   { 
      width:'100%', 
      padding:'0.85rem 1rem', 
      borderRadius:'0', 
      background: 'rgba(0, 25, 15, 0.9)', 
      color:'#00FF88', 
      border: '1px solid #006A4E', 
      borderLeft: '4px solid #00FF88', 
      outline:'none', 
      boxSizing:'border-box' as const, 
      fontSize:'0.9rem', 
      fontFamily: "'Share Tech Mono', monospace", 
      transition: 'all 0.3s ease',
      boxShadow: 'inset 0 0 10px rgba(0, 255, 136, 0.1)'
    },
    lbl:   { 
      fontSize:'11px', 
      fontWeight:900, 
      color: '#00FF88', 
      letterSpacing:'2px', 
      display:'block', 
      marginBottom:'7px',
      textShadow: '0 0 5px rgba(0, 255, 136, 0.4)',
      fontFamily: "'Orbitron', sans-serif"
    },
    btn_a: { 
      width:'100%', 
      padding:'1rem', 
      borderRadius:'0', 
      color:'#00FF88', 
      background: 'linear-gradient(90deg, rgba(0, 255, 136, 0.15), rgba(0, 255, 136, 0.05))',
      fontWeight:900, 
      letterSpacing:'3px', 
      border: '1px solid #00FF88', 
      borderRight: '4px solid #00FF88',
      cursor:'pointer', 
      fontSize:'0.9rem', 
      marginTop:'12px',
      fontFamily: "'Orbitron', sans-serif",
      boxShadow: '0 0 15px rgba(0, 255, 136, 0.2)',
      textTransform: 'uppercase',
      transition: 'all 0.3s ease'
    } as React.CSSProperties,
    flag:  { 
      display:'flex', 
      alignItems:'center', 
      gap:'8px', 
      padding:'0.85rem 1rem', 
      borderRadius:'0', 
      background:'rgba(0, 25, 15, 0.9)', 
      border: '1px solid #006A4E', 
      borderLeft: '4px solid #00FF88', 
      cursor:'pointer', 
      fontSize:'14px', 
      minWidth:'110px', 
      flexShrink:0,
      color: '#00FF88',
      fontFamily: "'Share Tech Mono', monospace"
    },
    drop:  { 
      position:'absolute' as const, 
      top:'100%', 
      left:0, 
      zIndex:99, 
      background:'rgba(0, 20, 10, 0.95)', 
      border: '1px solid #00FF88', 
      borderRadius:'0', 
      maxHeight:'200px', 
      overflowY:'auto' as const, 
      width:'200px', 
      boxShadow:'0 0 30px rgba(0, 255, 136, 0.4)' 
    },
  };

  const tabStyle = (a: boolean): React.CSSProperties => {
    return {
      flex:1, 
      padding:'12px', 
      borderRadius:'0', 
      border: '1px solid #006A4E',
      borderBottom: a ? '3px solid #00FF88' : '1px solid #006A4E', 
      background: a ? 'linear-gradient(180deg, rgba(0, 255, 136, 0.15) 0%, transparent 100%)' : 'rgba(0, 0, 0, 0.6)', 
      color: a ? '#00FF88' : '#006A4E', 
      fontWeight:900, 
      fontSize:'11px', 
      cursor:'pointer', 
      letterSpacing:'1px',
      transition: 'all 0.3s ease-in-out',
      fontFamily: "'Orbitron', sans-serif",
      textShadow: a ? '0 0 8px rgba(0, 255, 136, 0.5)' : 'none'
    };
  };

  const btnStyle = (bg: string): React.CSSProperties => ({ 
    ...s.btn_a
  });"""

content = re.sub(
    r"// ── STYLES ────────────────────────────────.*?const btnStyle = [^\n]*?\n[^\n]*?\n[^\n]*?\n  \}\);",
    styles_replacement,
    content,
    flags=re.DOTALL
)

# Update logo for sci-fi look
logo_replacement = """        {/* LOGO */}
        <div style={{textAlign:'center', marginBottom:'1.5rem'}}>
          <div className="acrylic-logo" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'52px',height:'52px',marginBottom:'1rem', background:'rgba(0, 255, 136, 0.1)', border:'1px solid #00FF88', borderTop: '4px solid #00FF88', borderRadius:'0', color:'#00FF88', boxShadow:'0 0 15px rgba(0, 255, 136, 0.4)'}}>
            <span className="acrylic-text" style={{fontWeight:900,fontSize:'1.8rem', fontFamily:"'Orbitron', sans-serif"}}>+</span>
          </div>
          <h1 style={{fontFamily: "'Orbitron', sans-serif", fontSize:'1.4rem',fontWeight:900,letterSpacing:'4px',margin:'0 0 0.4rem', color:'#00FF88', textShadow:'0 0 10px rgba(0, 255, 136, 0.5)'}}>
            MIRACLE HMS
          </h1>
          <p style={{fontFamily:"'Share Tech Mono', monospace", fontSize:'0.65rem',color:'#00A86B',fontWeight:800,letterSpacing:'3px',margin:0}}>
            SECURE HEALTHCARE PORTAL
          </p>
        </div>"""
content = re.sub(r"\{\/\* LOGO \*\/\}.*?<\/div>\s*<\/div>", logo_replacement, content, flags=re.DOTALL)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated to futuristic UI boxes")
