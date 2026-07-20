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
      background: 'rgba(5, 20, 15, 0.65)', 
      backdropFilter:'blur(20px)', 
      border: '2px solid rgba(0, 255, 136, 0.4)', 
      borderRadius:'8px', 
      padding:'2.5rem 2rem', 
      width:'100%', 
      maxWidth:'26rem', 
      zIndex:10, 
      boxShadow: '0 0 40px rgba(0, 255, 136, 0.4), inset 0 0 20px rgba(0, 255, 136, 0.15)', 
      animation: 'neon-pulse 3s infinite alternate',
      transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
    },
    inp:   { 
      width:'100%', 
      padding:'0.85rem 1rem', 
      borderRadius:'4px', 
      background: '#000000', 
      color:'#00FF88', 
      border: '2px solid #006A4E', 
      outline:'none', 
      boxSizing:'border-box' as const, 
      fontSize:'0.9rem', 
      fontFamily: 'inherit',
      transition: 'all 0.3s ease'
    },
    lbl:   { 
      fontSize:'11px', 
      fontWeight:900, 
      color: '#00FF88', 
      letterSpacing:'1px', 
      display:'block', 
      marginBottom:'7px',
      textShadow: '0 0 5px rgba(0, 255, 136, 0.4)',
      fontFamily: 'inherit'
    },
    btn_a: { 
      width:'100%', 
      padding:'0.85rem', 
      borderRadius:'4px', 
      color:'#000000', 
      fontWeight:900, 
      letterSpacing:'1px', 
      border: '2px solid #00FF88', 
      cursor:'pointer', 
      fontSize:'0.9rem', 
      marginTop:'8px',
      fontFamily: 'inherit',
      boxShadow: '0 0 15px rgba(0, 255, 136, 0.3)',
      textTransform: 'uppercase',
      transition: 'all 0.3s ease'
    } as React.CSSProperties,
    flag:  { 
      display:'flex', 
      alignItems:'center', 
      gap:'8px', 
      padding:'0.85rem 1rem', 
      borderRadius:'4px', 
      background:'#000000', 
      border: '2px solid #006A4E', 
      cursor:'pointer', 
      fontSize:'14px', 
      minWidth:'110px', 
      flexShrink:0,
      color: '#00FF88'
    },
    drop:  { 
      position:'absolute' as const, 
      top:'100%', 
      left:0, 
      zIndex:99, 
      background:'#000000', 
      border: '2px solid #00FF88', 
      borderRadius:'4px', 
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
      borderRadius:'4px', 
      border: a ? '2px solid #00FF88' : '2px solid #006A4E', 
      background: a ? 'rgba(0, 255, 136, 0.15)' : '#000000', 
      color: a ? '#00FF88' : '#006A4E', 
      fontWeight:900, 
      fontSize:'11px', 
      cursor:'pointer', 
      letterSpacing:'1px',
      transition: 'all 0.3s ease-in-out',
      textShadow: a ? '0 0 8px rgba(0, 255, 136, 0.5)' : 'none'
    };
  };

  const btnStyle = (bg: string): React.CSSProperties => ({ 
    ...s.btn_a, 
    background: '#00FF88'
  });"""

content = re.sub(
    r"// ── STYLES ────────────────────────────────.*?const btnStyle = [^\n]*?\n[^\n]*?\n[^\n]*?\n  \}\);",
    styles_replacement,
    content,
    flags=re.DOTALL
)

# 2. Update Logo Section
logo_replacement = """        {/* LOGO */}
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
        </div>"""
content = re.sub(r"\{\/\* LOGO \*\/\}.*?<\/div>\s*<\/div>", logo_replacement, content, flags=re.DOTALL)

# 3. Text & Box color adjustments inside the component
content = content.replace("color:'#093228'", "color:'#00FF88'") # text colors
content = content.replace("color: '#093228'", "color: '#00FF88'") # text colors
content = content.replace("color:'#1C4D3E'", "color:'#00A86B'")
content = content.replace("color:'#4A7C6B'", "color:'#00A86B'")
content = content.replace("color: '#4A7C6B'", "color: '#00A86B'")
content = content.replace("color:'#006A4E'", "color:'#00FF88'")
content = content.replace("background:'#F0F4F8'", "background:'#000000'")
content = content.replace("border:'1px solid #D9E2EC'", "border:'2px solid #006A4E'")
content = content.replace("background:'rgba(0,106,78,0.05)'", "background:'rgba(0, 255, 136, 0.05)'")
content = content.replace("border:'1px solid rgba(0,106,78,0.2)'", "border:'1px solid rgba(0, 255, 136, 0.3)'")
content = content.replace("background: '#F0F4F8'", "background: '#000000'")
content = content.replace("border: '1px solid #D9E2EC'", "border: '2px solid #006A4E'")
content = content.replace("color: '#243B53'", "color: '#00FF88'")
content = content.replace("background: 'linear-gradient(90deg, #006A4E, #39FF14)'", "background: '#00FF88'")
content = content.replace("border:'1px solid rgba(0,106,78,0.1)'", "border:'1px solid rgba(0, 255, 136, 0.2)'")
content = content.replace("borderBottom:'1px solid rgba(0,106,78,0.1)'", "borderBottom:'1px solid rgba(0, 255, 136, 0.2)'")

# 4. Add pulse animations
keyframes = """
        @keyframes neon-pulse {
          0% { box-shadow: 0 0 30px rgba(0, 255, 136, 0.3), inset 0 0 10px rgba(0, 255, 136, 0.1); }
          100% { box-shadow: 0 0 60px rgba(0, 255, 136, 0.6), inset 0 0 25px rgba(0, 255, 136, 0.25); }
        }
        @keyframes pulse-glow {
          0% { opacity: 0.6; transform: scale(1); }
          100% { opacity: 1; transform: scale(1.1); }
        }
"""
content = content.replace("@keyframes drone-fly {", keyframes + "        @keyframes drone-fly {")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated to neon transparent acrylic signage board style.")
