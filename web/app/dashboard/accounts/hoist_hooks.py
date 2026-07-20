"""
Hoist all React.useState/useEffect from the render functions to the component top level.
This fixes the React Rules of Hooks violation which causes the accounts page to crash.
"""
import re

target = r'd:\Miracle_Os_Master\web\app\dashboard\accounts\page.tsx'
with open(target, 'r', encoding='utf-8') as f:
    content = f.read()

# STEP 1: Remove all React.useState/useEffect INSIDE renderEnterpriseModules
# They will be replaced with just references (the state vars will be hoisted)
# The lines to strip (these are inside the render functions, not hooks):
lines_to_remove = [
    r"      const \[glLines, setGlLines\] = React\.useState.*?\n",
    r"      const \[glRef, setGlRef\] = React\.useState.*?\n",
    r"      const \[glDesc, setGlDesc\] = React\.useState.*?\n",
    r"      const \[glStatus, setGlStatus\] = React\.useState.*?\n",
    r"      const \[coaList, setCoaList\] = React\.useState.*?\n",
    r"      const \[botMsg, setBotMsg\] = React\.useState.*?\n",
    r"      React\.useEffect\(\(\) => \{ fetch\(`\$\{BASE\}/coa/list`\).*?\}, \[\]\);\n",
    r"      const \[arData, setArData\] = React\.useState.*?\n",
    r"      React\.useEffect\(\(\) => \{ fetch\(`\$\{BASE\}/ar/aging`\).*?\}, \[\]\);\n",
    r"      const \[bankLines, setBankLines\] = React\.useState.*?\n",
    r"      const \[matched, setMatched\] = React\.useState.*?\n",
    r"      const \[apData, setApData\] = React\.useState.*?\n",
    r"      const \[vendors, setVendors\] = React\.useState.*?\n",
    r"      const \[apTab, setApTab\] = React\.useState.*?\n",
    r"      const \[newVendor, setNewVendor\] = React\.useState.*?\n",
    r"      const \[tbData, setTbData\] = React\.useState.*?\n",
    r"      const \[loading, setLoading\] = React\.useState.*?\n",
]

for pattern in lines_to_remove:
    content = re.sub(pattern, '', content)

# Also remove the useEffect blocks inside the render functions (multi-line)
# AP Module useEffect
ap_ue_pattern = r"      React\.useEffect\(\(\) => \{[\s\S]*?fetchInvoices\(\)[\s\S]*?\}, \[\]\);\n"
content = re.sub(ap_ue_pattern, '', content)

# TB useEffect
tb_ue_pattern = r"      React\.useEffect\(\(\) => \{ fetchTB\(\); \}, \[\]\);\n"
content = re.sub(tb_ue_pattern, '', content)

# STEP 2: Insert hoisted state declarations right before the closing brace of AccountsAuditPage state block
# Find the line:  const { liveData, serverMetrics, isPythonLive } = useLedgerSync();
HOOK_MARKER = "  const { liveData, serverMetrics, isPythonLive } = useLedgerSync();"

ENTERPRISE_STATE = """
  // ==========================================
  // ENTERPRISE MODULE STATE (HOISTED - Rules of Hooks)
  // ==========================================
  const BASE_ACC = 'http://127.0.0.1:8000/api/accounting';

  // GL Journal Entry
  const [glLines, setGlLines] = useState<{code: string, debit: string, credit: string}[]>([{code:'',debit:'',credit:''},{code:'',debit:'',credit:''}]);
  const [glRef, setGlRef] = useState('');
  const [glDesc, setGlDesc] = useState('');
  const [glStatus, setGlStatus] = useState<string|null>(null);
  const [coaList, setCoaList] = useState<any[]>([]);
  const [botMsg, setBotMsg] = useState('Select an account to see Miracle Bot guidance.');

  // AR Aging
  const [arData, setArData] = useState<any>(null);

  // Bank Recon
  const [bankLines, setBankLines] = useState<{date:string,desc:string,amount:string}[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());

  // AP Module
  const [apData, setApData] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [apTab, setApTab] = useState(0);
  const [newVendor, setNewVendor] = useState({name:'',contact:'',tax_id:'',payment_terms_days:30});

  // Trial Balance
  const [tbData, setTbData] = useState<any>(null);
  const [tbLoading, setTbLoading] = useState(false);

  // Enterprise data fetching
  useEffect(() => { fetch(`${BASE_ACC}/coa/list`).then(r=>r.json()).then(d=>setCoaList(d.data||[])).catch(()=>{}); }, []);
  useEffect(() => { fetch(`${BASE_ACC}/ar/aging`).then(r=>r.json()).then(setArData).catch(()=>{}); }, []);
  useEffect(() => {
    const f = async () => {
      try {
        const [inv, vend] = await Promise.all([fetch(`${BASE_ACC}/ap/invoices`), fetch(`${BASE_ACC}/ap/vendors`)]);
        setApData(await inv.json());
        setVendors((await vend.json()).data || []);
      } catch {}
    };
    f();
  }, []);
"""

if HOOK_MARKER in content:
    content = content.replace(HOOK_MARKER, HOOK_MARKER + "\n" + ENTERPRISE_STATE, 1)
    print("Enterprise hooks hoisted to component level.")
else:
    print("WARNING: Hook marker not found. State not hoisted.")

# STEP 3: Replace BASE inside renderEnterpriseModules to use BASE_ACC
content = content.replace("    const BASE = 'http://127.0.0.1:8000/api/accounting';", "    const BASE = BASE_ACC;", 1)

# STEP 4: Replace loading inside renderEnterpriseModules with tbLoading
content = content.replace("const [loading, setLoading] = useState", "// loading state hoisted as tbLoading")
content = content.replace("!tbData && !loading &&", "!tbData && !tbLoading &&")
content = content.replace("setLoading(true)", "setTbLoading(true)")
content = content.replace("setLoading(false)", "setTbLoading(false)")

with open(target, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done. Verifying line count...")
with open(target, 'r', encoding='utf-8') as f:
    lines = f.readlines()
print(f"File: {len(lines)} lines")
