import re

file_path = r"d:\Vigilant IT Solutions\Miracle_HMS\web\app\page.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update STYLES block for Bottle Green Theme
styles_replacement = """  // ── STYLES ────────────────────────────────
  const s: Record<string, React.CSSProperties> = {
    main:  { 
      display:'flex', 
      alignItems:'center', 
      justifyContent:'center', 
      minHeight:'100vh', 
      padding:'20px', 
      backgroundColor: '#093228', 
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
      filter: 'brightness(0.9) contrast(1.1)',
    },
    glow:  { 
      position:'absolute', 
      width:'100vw', 
      height:'100vh', 
      background: 'radial-gradient(circle at 50% 50%, rgba(0, 106, 78, 0.3) 0%, rgba(9, 50, 40, 0.8) 100%)', 
      top:'0', 
      left:'0', 
      pointerEvents:'none', 
      zIndex:1 
    },
    panel: { 
      background: 'rgba(235, 245, 240, 0.85)', 
      backdropFilter:'blur(24px)', 
      border: '1px solid rgba(255, 255, 255, 0.5)', 
      borderRadius:'1.5rem', 
      padding:'2.5rem 2rem', 
      width:'100%', 
      maxWidth:'26rem', 
      zIndex:10, 
      boxShadow: '0 30px 60px rgba(0, 50, 30, 0.4)',
      transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
    },
    inp:   { 
      width:'100%', 
      padding:'0.85rem 1rem', 
      borderRadius:'0.6rem', 
      background: 'rgba(255, 255, 255, 0.7)', 
      color:'#093228', 
      border: '1px solid rgba(0, 106, 78, 0.2)', 
      outline:'none', 
      boxSizing:'border-box' as const, 
      fontSize:'0.9rem', 
      fontFamily: 'inherit',
      transition: 'all 0.3s ease'
    },
    lbl:   { 
      fontSize:'11px', 
      fontWeight:800, 
      color: '#006A4E', 
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
      fontWeight:800, 
      letterSpacing:'1px', 
      border: 'none', 
      cursor:'pointer', 
      fontSize:'0.9rem', 
      marginTop:'8px',
      fontFamily: 'inherit',
      boxShadow: '0 8px 20px rgba(0, 106, 78, 0.3)',
      transition: 'all 0.3s ease'
    } as React.CSSProperties,
    flag:  { 
      display:'flex', 
      alignItems:'center', 
      gap:'8px', 
      padding:'0.85rem 1rem', 
      borderRadius:'0.6rem', 
      background:'rgba(255, 255, 255, 0.7)', 
      border: '1px solid rgba(0, 106, 78, 0.2)', 
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
      border: '1px solid #006A4E', 
      borderRadius:'10px', 
      maxHeight:'200px', 
      overflowY:'auto' as const, 
      width:'200px', 
      boxShadow:'0 15px 35px rgba(0, 50, 30, 0.3)' 
    },
  };

  const tabStyle = (a: boolean): React.CSSProperties => {
    return {
      flex:1, 
      padding:'12px', 
      borderRadius:'8px', 
      border: a ? '1px solid #006A4E' : '1px solid transparent', 
      background: a ? 'rgba(0, 106, 78, 0.1)' : 'transparent', 
      color: a ? '#006A4E' : '#4A7C6B', 
      fontWeight:800, 
      fontSize:'11px', 
      cursor:'pointer', 
      letterSpacing:'1px',
      transition: 'all 0.3s ease-in-out'
    };
  };

  const btnStyle = (bg: string): React.CSSProperties => ({ 
    ...s.btn_a, 
    background: 'linear-gradient(135deg, #008B6B, #00503B)'
  });"""

content = re.sub(
    r"// ── STYLES ────────────────────────────────.*?const btnStyle = [^\n]*?\n[^\n]*?\n[^\n]*?\n  \}\);",
    styles_replacement,
    content,
    flags=re.DOTALL
)

# 2. Add droneBg div in JSX
# find: <main style={s.main}>
#       <div style={s.glow} />
replacement_jsx = """<main style={s.main}>
      <div style={s.droneBg} />
      <div style={s.glow} />"""
content = content.replace("<main style={s.main}>\n      <div style={s.glow} />", replacement_jsx)


# 3. Replace Logo styling colors
content = content.replace("background:'#F0F4F8'", "background:'rgba(0, 106, 78, 0.1)'")
content = content.replace("color:'#243B53'", "color:'#006A4E'")
content = content.replace("color:'#102A43'", "color:'#093228'")
content = content.replace("color:'#486581'", "color:'#1C4D3E'")

# 4. Color replacements for progress bar, other minor texts
content = content.replace("background: 'linear-gradient(90deg, #3B82F6, #10B981)'", "background: 'linear-gradient(90deg, #006A4E, #39FF14)'")
content = content.replace("color: '#102A43'", "color: '#093228'")

content = content.replace("color:'#829AB1'", "color:'#4A7C6B'") # minor texts
content = content.replace("background:'#ECFDF5'", "background:'rgba(0,106,78,0.05)'")
content = content.replace("border:'1px solid #A7F3D0'", "border:'1px solid rgba(0,106,78,0.2)'")
content = content.replace("color:'#065F46'", "color:'#006A4E'")
content = content.replace("background:'#EFF6FF'", "background:'rgba(0,106,78,0.05)'")
content = content.replace("border:'1px solid #BFDBFE'", "border:'1px solid rgba(0,106,78,0.2)'")

content = content.replace("color:'#627D98'", "color:'#4A7C6B'")
content = content.replace("color:'#10B981'", "color:'#006A4E'")

# Fix "borderBottom:'1px solid #F0F4F8'" in country dropdown
content = content.replace("borderBottom:'1px solid #F0F4F8'", "borderBottom:'1px solid rgba(0,106,78,0.1)'")

# 5. Add drone-fly keyframe
keyframes = """
        @keyframes drone-fly {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(-3%, -2%, 0) scale(1.05) rotate(0.5deg); }
          100% { transform: translate3d(2%, 3%, 0) scale(1.1) rotate(-0.5deg); }
        }
"""
content = content.replace("@keyframes scanner-sweep-inside {", keyframes + "        @keyframes scanner-sweep-inside {")


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Bottle green theme with drone field applied.")
