target = r'd:\Miracle_Os_Master\web\app\dashboard\accounts\page.tsx'
with open(target, 'rb') as f:
    raw = f.read()

marker = b'font-size: 10px;\r\r\n'
idx = raw.rfind(marker)
if idx == -1:
    print('marker not found'); exit(1)

cut_pos = idx + len(marker)
base = raw[:cut_pos]

TAIL = (
    b"          font-weight: 900;\r\n"
    b"          margin-top: 10px;\r\n"
    b"          letter-spacing: 1px;\r\n"
    b"          background: rgba(0,255,136,0.1);\r\n"
    b"          display: inline-block;\r\n"
    b"          padding: 4px 8px;\r\n"
    b"          border-radius: 4px;\r\n"
    b"        }\r\n"
    b"        .hover-scale:hover { transform: scale(1.05); }\r\n"
    b"      `}} />\r\n"
    b"\r\n"
    b"      {renderHUD()}\r\n"
    b"\r\n"
    b"      {/* ===== UNIFIED 11-TAB SOVEREIGN NAVIGATION BAR ===== */}\r\n"
    b"      <div className=\"no-print\" style={{\r\n"
    b"        display: 'flex', gap: '5px', borderBottom: '1px solid rgba(255,255,255,0.05)',\r\n"
    b"        paddingBottom: '14px', marginBottom: '20px', overflowX: 'auto',\r\n"
    b"        WebkitOverflowScrolling: 'touch' as any\r\n"
    b"      }}>\r\n"
    b"        {[\r\n"
    b"          { idx: 0,  label: '\xf0\x9f\x93\x8a ROI MIX' },\r\n"
    b"          { idx: 1,  label: '\xf0\x9f\x93\x8b ITEM TRACE' },\r\n"
    b"          { idx: 2,  label: '\xf0\x9f\x93\x89 BURDEN MATRIX' },\r\n"
    b"          { idx: 3,  label: '\xf0\x9f\xa4\x96 COGNITIVE ACTIONS' },\r\n"
    b"          { idx: 4,  label: '\xf0\x9f\x95\x92 PAYROLL REGISTER' },\r\n"
    b"          { idx: 5,  label: '\xf0\x9f\x8c\x99 NIGHT AUDIT' },\r\n"
    b"          { idx: 6,  label: '\xf0\x9f\x93\x96 GL ENTRY' },\r\n"
    b"          { idx: 7,  label: '\xe2\x8f\xb3 AR AGING' },\r\n"
    b"          { idx: 8,  label: '\xf0\x9f\x8f\xa6 BANK RECON' },\r\n"
    b"          { idx: 9,  label: '\xf0\x9f\x93\xa6 AP MODULE' },\r\n"
    b"          { idx: 10, label: '\xe2\x96\x96\xef\xb8\x8f TRIAL BALANCE' },\r\n"
    b"        ].map(({ idx, label }) => (\r\n"
    b"          <button\r\n"
    b"            key={idx}\r\n"
    b"            onClick={() => { setActiveTab(idx); setAuditStage(0); }}\r\n"
    b"            className={`tab-btn ${activeTab === idx ? 'active' : ''}`}\r\n"
    b"            style={{ whiteSpace: 'nowrap', fontSize: '10px', padding: '7px 11px' }}\r\n"
    b"          >\r\n"
    b"            {label}\r\n"
    b"          </button>\r\n"
    b"        ))}\r\n"
    b"      </div>\r\n"
    b"\r\n"
    b"      {/* ===== TAB CONTENT AREA ===== */}\r\n"
    b"      {auditStage === 4\r\n"
    b"        ? renderNightAuditExecution()\r\n"
    b"        : activeTab <= 4\r\n"
    b"          ? renderDashboardTabs()\r\n"
    b"          : activeTab === 5\r\n"
    b"            ? renderNightAuditExecution()\r\n"
    b"            : renderEnterpriseModules()\r\n"
    b"      }\r\n"
    b"    </div>\r\n"
    b"  );\r\n"
    b"}\r\n"
    b"\r\n"
    b"// --- Inline Style Constants for Print Table ---\r\n"
    b"const printTable = { width: '100%', borderCollapse: 'collapse' as const, marginTop: '20px', color: '#000', fontFamily: 'Arial, sans-serif' };\r\n"
    b"const thStyle = { background: '#f1f1f1', border: '1px solid black', padding: '12px', textAlign: 'left' as const, fontSize: '12px', textTransform: 'uppercase' as const };\r\n"
    b"const tdStyle = { border: '1px solid black', padding: '12px', fontSize: '14px' };\r\n"
    b"\r\n"
    b"// --- Legacy Metric Styles for HUD Fallbacks ---\r\n"
    b"const metricCardStyle = { display: 'flex', flexDirection: 'column' as const };\r\n"
    b"const metricLabelStyle = { color: '#888', fontWeight: 900, fontSize: '11px', letterSpacing: '1px' };\r\n"
    b"const metricValueStyle = (color: string) => ({ color: color, fontSize: '28px', fontWeight: 900, marginTop: '10px', fontFamily: 'monospace', textShadow: `0 0 15px ${color}44` });\r\n"
)

with open(target, 'wb') as f:
    f.write(base + TAIL)

with open(target, 'rb') as f:
    lines = f.readlines()
print(f'File restored: {len(lines)} lines, {len(base + TAIL)} bytes')
print('Last 3 lines:')
print(b''.join(lines[-3:]).decode('utf-8'))
