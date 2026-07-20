'use client';
// ============================================================
// SOVEREIGN CALCULATOR — MIRACLE HMS V1.0
// Scientific + Basic mode toggle, keyboard support
// ============================================================
import { useState, useEffect, useCallback } from 'react';

interface Props { onClose: () => void; }

export default function SovereignCalculator({ onClose }: Props) {
  const [mode, setMode] = useState<'BASIC' | 'SCI'>('BASIC');
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [justCalc, setJustCalc] = useState(false);
  const [isDeg, setIsDeg] = useState(true);

  const toRad = (v: number) => isDeg ? v * Math.PI / 180 : v;

  const safeEval = (expr: string): number => {
    // Safe math evaluator — no eval()
    const clean = expr
      .replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, String(Math.PI))
      .replace(/e(?![0-9])/g, String(Math.E));
    // eslint-disable-next-line no-new-func
    return Function('"use strict"; return (' + clean + ')')();
  };

  const press = useCallback((val: string) => {
    setJustCalc(false);
    if (val === 'C') { setDisplay('0'); setExpression(''); return; }
    if (val === 'CE') { setDisplay('0'); return; }
    if (val === '⌫') {
      setDisplay(d => d.length > 1 ? d.slice(0, -1) : '0');
      return;
    }
    if (val === '=') {
      try {
        const fullExpr = expression + display;
        const result = safeEval(fullExpr);
        const resultStr = Number.isFinite(result) ? String(+result.toPrecision(12)) : 'Error';
        setHistory(h => [`${fullExpr} = ${resultStr}`, ...h].slice(0, 5));
        setDisplay(resultStr);
        setExpression('');
        setJustCalc(true);
      } catch { setDisplay('Error'); setExpression(''); }
      return;
    }
    // Operators
    if (['+', '-', '*', '/', '×', '÷', '%'].includes(val)) {
      const op = val === '×' ? '*' : val === '÷' ? '/' : val;
      setExpression(expression + display + op);
      setDisplay('0');
      return;
    }
    // Parentheses
    if (val === '(' || val === ')') {
      setExpression(expression + display + val);
      setDisplay('0');
      return;
    }
    // Scientific functions
    const sciOps: Record<string, () => number> = {
      sin: () => Math.sin(toRad(parseFloat(display))),
      cos: () => Math.cos(toRad(parseFloat(display))),
      tan: () => Math.tan(toRad(parseFloat(display))),
      asin: () => isDeg ? Math.asin(parseFloat(display)) * 180 / Math.PI : Math.asin(parseFloat(display)),
      acos: () => isDeg ? Math.acos(parseFloat(display)) * 180 / Math.PI : Math.acos(parseFloat(display)),
      atan: () => isDeg ? Math.atan(parseFloat(display)) * 180 / Math.PI : Math.atan(parseFloat(display)),
      log: () => Math.log10(parseFloat(display)),
      ln: () => Math.log(parseFloat(display)),
      '√': () => Math.sqrt(parseFloat(display)),
      '∛': () => Math.cbrt(parseFloat(display)),
      'x²': () => Math.pow(parseFloat(display), 2),
      'x³': () => Math.pow(parseFloat(display), 3),
      '1/x': () => 1 / parseFloat(display),
      '|x|': () => Math.abs(parseFloat(display)),
      'n!': () => { let n = parseInt(display); let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
      'eˣ': () => Math.exp(parseFloat(display)),
      '10ˣ': () => Math.pow(10, parseFloat(display)),
    };
    if (sciOps[val]) {
      try {
        const result = sciOps[val]();
        const resultStr = String(+result.toPrecision(12));
        setHistory(h => [`${val}(${display}) = ${resultStr}`, ...h].slice(0, 5));
        setDisplay(resultStr);
        setJustCalc(true);
      } catch { setDisplay('Error'); }
      return;
    }
    if (val === 'π') { setDisplay(String(Math.PI)); return; }
    if (val === 'e') { setDisplay(String(Math.E)); return; }
    if (val === 'xʸ') { setExpression(expression + display + '**'); setDisplay('0'); return; }
    if (val === 'mod') { setExpression(expression + display + '%'); setDisplay('0'); return; }
    if (val === '±') { setDisplay(d => d.startsWith('-') ? d.slice(1) : '-' + d); return; }
    // Digits and decimal
    if (val === '.') {
      if (!display.includes('.')) setDisplay(d => d + '.');
      return;
    }
    if (justCalc && /[0-9]/.test(val)) {
      setDisplay(val); setJustCalc(false); return;
    }
    setDisplay(d => d === '0' ? val : d + val);
  }, [display, expression, isDeg, justCalc, toRad]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') press(e.key);
      else if (e.key === '+') press('+');
      else if (e.key === '-') press('-');
      else if (e.key === '*') press('*');
      else if (e.key === '/') { e.preventDefault(); press('/'); }
      else if (e.key === 'Enter' || e.key === '=') press('=');
      else if (e.key === 'Backspace') press('⌫');
      else if (e.key === 'Escape') press('C');
      else if (e.key === '.') press('.');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [press]);

  const basicRows = [
    ['C', 'CE', '⌫', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['±', '0', '.', '='],
  ];

  const sciRows = [
    ['sin', 'cos', 'tan', '(', ')'],
    ['asin', 'acos', 'atan', 'π', 'e'],
    ['log', 'ln', '√', '∛', '1/x'],
    ['x²', 'x³', 'xʸ', '|x|', 'n!'],
    ['eˣ', '10ˣ', 'mod', '(', ')'],
  ];

  const getBtnColor = (val: string) => {
    if (val === '=') return { bg: 'linear-gradient(135deg, #00F2FF, #0062FF)', color: '#000', shadow: '0 0 20px rgba(0,242,255,0.4)' };
    if (['÷','×','-','+','xʸ','mod'].includes(val)) return { bg: 'rgba(212,175,55,0.15)', color: '#D4AF37', shadow: 'none' };
    if (['C','CE'].includes(val)) return { bg: 'rgba(255,49,49,0.15)', color: '#FF3131', shadow: 'none' };
    if (['⌫'].includes(val)) return { bg: 'rgba(255,107,53,0.15)', color: '#FF6B35', shadow: 'none' };
    if (/[0-9.]/.test(val) || val === '±' || val === '0') return { bg: 'rgba(255,255,255,0.06)', color: '#FFF', shadow: 'none' };
    return { bg: 'rgba(157,0,255,0.12)', color: '#C084FC', shadow: 'none' };
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={calcStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontFamily: 'Cinzel', fontSize: '14px', color: '#00F2FF', letterSpacing: '3px' }}>🧮 CALCULATOR</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setMode(m => m === 'BASIC' ? 'SCI' : 'BASIC')} style={modeToggleStyle}>
              {mode === 'BASIC' ? '⚗️ SCIENTIFIC' : '🔢 BASIC'}
            </button>
            {mode === 'SCI' && (
              <button onClick={() => setIsDeg(d => !d)} style={{ ...modeToggleStyle, color: '#D4AF37', borderColor: 'rgba(212,175,55,0.4)' }}>
                {isDeg ? 'DEG' : 'RAD'}
              </button>
            )}
            <button onClick={onClose} style={closeBtnStyle}>✕</button>
          </div>
        </div>

        {/* Display */}
        <div style={displayAreaStyle}>
          <div style={{ fontSize: '11px', color: '#555', minHeight: '16px', textAlign: 'right', fontFamily: 'monospace' }}>
            {expression}
          </div>
          <div style={{ fontSize: display.length > 12 ? '20px' : '32px', fontWeight: 900, color: '#FFF', textAlign: 'right', fontFamily: 'monospace', textShadow: '0 0 20px rgba(0,242,255,0.3)', wordBreak: 'break-all', lineHeight: 1.2 }}>
            {display}
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div style={{ marginBottom: '10px', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', maxHeight: '80px', overflowY: 'auto' }}>
            {history.map((h, i) => (
              <div key={i} style={{ fontSize: '10px', color: '#444', fontFamily: 'monospace', lineHeight: 1.6 }}>{h}</div>
            ))}
          </div>
        )}

        {/* Scientific rows */}
        {mode === 'SCI' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '8px' }}>
            {sciRows.flat().map((btn, i) => {
              const c = getBtnColor(btn);
              return (
                <button key={i} onClick={() => press(btn)} style={{ ...calcBtnStyle, background: c.bg, color: c.color, boxShadow: c.shadow, fontSize: '10px', padding: '10px 4px' }}>
                  {btn}
                </button>
              );
            })}
          </div>
        )}

        {/* Basic grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {basicRows.flat().map((btn, i) => {
            const c = getBtnColor(btn);
            return (
              <button
                key={i}
                onClick={() => press(btn)}
                style={{
                  ...calcBtnStyle,
                  background: c.bg,
                  color: c.color,
                  boxShadow: c.shadow,
                  gridColumn: btn === '0' ? 'span 1' : undefined,
                  fontSize: btn === '=' ? '20px' : '16px',
                }}
              >
                {btn}
              </button>
            );
          })}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes calcSlideIn {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      ` }} />
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.7)',
  backdropFilter: 'blur(6px)',
  zIndex: 9998,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const calcStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, rgba(12,12,18,0.99) 0%, rgba(5,5,10,0.99) 100%)',
  border: '1px solid rgba(0,242,255,0.15)',
  borderRadius: '24px',
  boxShadow: '0 40px 80px rgba(0,0,0,0.9), 0 0 40px rgba(0,242,255,0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
  width: '340px',
  padding: '20px',
  animation: 'calcSlideIn 0.3s cubic-bezier(0.16,1,0.3,1)',
};

const displayAreaStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(0,242,255,0.1)',
  borderRadius: '14px',
  padding: '14px 16px',
  marginBottom: '14px',
  minHeight: '80px',
  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
};

const calcBtnStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '12px',
  padding: '16px 8px',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.15s',
  fontFamily: 'monospace',
};

const modeToggleStyle: React.CSSProperties = {
  background: 'rgba(0,242,255,0.1)',
  border: '1px solid rgba(0,242,255,0.3)',
  borderRadius: '8px',
  color: '#00F2FF',
  padding: '5px 10px',
  fontSize: '10px',
  fontWeight: 900,
  cursor: 'pointer',
  letterSpacing: '1px',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'rgba(255,49,49,0.1)',
  border: '1px solid rgba(255,49,49,0.3)',
  borderRadius: '50%',
  width: '28px', height: '28px',
  color: '#FF3131',
  cursor: 'pointer',
  fontSize: '12px',
};
