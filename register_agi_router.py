filepath = 'backend_api/app/main.py'
content = open(filepath, 'r', encoding='utf-8').read()

old = 'app.include_router(dept_acc_mod.router, prefix="/api/accounting", tags=["Z-11: Departmental Accounting Engine"])'

new = old + """

# Z-11F: ACCOUNTING AGI LAYER (Phase 6F — Anomaly Detection, Health Scores, Monthly P&L)
from app.routers import dept_accounting_agi as dept_acc_agi_mod
app.include_router(dept_acc_agi_mod.router, prefix="/api/accounting", tags=["Z-11F: Accounting AGI Intelligence Layer"])"""

if old in content:
    open(filepath, 'w', encoding='utf-8').write(content.replace(old, new))
    print("Phase 6F AGI router registered successfully.")
else:
    print("Pattern not found.")
    idx = content.find('dept_acc_mod.router')
    print(repr(content[max(0,idx-60):idx+120]))
