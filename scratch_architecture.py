import os
import re
import json

base_dir = r'd:\Vigilant IT Solutions\Miracle_Os_Master\backend_api\app'

# 1. Extract Role Permissions (Hardcoded common knowledge for the system)
roles = {
    'CDO': 'God Mode. Can access all 18 zones. Only role that can override missions, access Z-21 Kernel Settings, and Z-23 Infra.',
    'GM': 'General Manager. Can access all operational zones and policy engine. Cannot access Z-23 Infra or Z-21 Master Passwords.',
    'ADMIN': 'System Admin. Can manage HR, inventory, and accounts. Can view all logs.',
    'FD': 'Front Desk. Access limited to Z-05 Reservations, Z-07 Command Grid, Z-08 Checkout, Z-10 CRM.',
    'POS': 'Point of Sale / Retail. Access limited to Z-06 POS, Z-12 Inventory (view).',
    'HR': 'Human Resources. Access limited to Z-09 HR Engine, Z-18 Biometric Portal.',
    'ACC': 'Accounts. Access limited to Z-11 Accounts & Audit, Z-08 Checkout.',
    'HK/MN/IT': 'Field Operatives. Access limited to Z-17 Solve Portal, Z-16 Issue Tickets.'
}

# 2. Extract Models (DB Schema)
models_dir = os.path.join(base_dir, 'models')
db_schema = {}
class_pattern = re.compile(r'class\s+([A-Za-z0-9_]+)\(Base\):')
table_pattern = re.compile(r'__tablename__\s*=\s*[\"\']([^\"\']+)[\"\']')
col_pattern = re.compile(r'([A-Za-z0-9_]+)\s*=\s*Column\(')

for root, _, files in os.walk(models_dir):
    for f in files:
        if f.endswith('.py'):
            with open(os.path.join(root, f), 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
                current_class = None
                current_table = None
                cols = []
                for line in content.split('\n'):
                    class_match = class_pattern.search(line)
                    if class_match:
                        if current_class and current_table:
                            db_schema[current_table] = cols
                        current_class = class_match.group(1)
                        cols = []
                        current_table = None
                        continue
                    
                    if current_class:
                        tab_match = table_pattern.search(line)
                        if tab_match:
                            current_table = tab_match.group(1)
                        col_match = col_pattern.search(line)
                        if col_match:
                            cols.append(col_match.group(1))
                
                if current_class and current_table:
                    db_schema[current_table] = cols

# 3. Extract Endpoints
routers_dir = os.path.join(base_dir, 'routers')
endpoints = []
route_pattern = re.compile(r'@router\.(get|post|put|delete)\([\"\']([^\"\']+)[\"\']')

for root, _, files in os.walk(routers_dir):
    for f in files:
        if f.endswith('.py'):
            router_prefix = f.replace('_router.py', '').replace('router.py', '').replace('.py', '')
            if not router_prefix:
                router_prefix = 'core'
            with open(os.path.join(root, f), 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
                for match in route_pattern.findall(content):
                    method, path = match
                    full_path = f'/api/{router_prefix}{path}'.replace('//', '/')
                    endpoints.append(f'{method.upper()} {full_path}')

# 4. Inject into Kernel
kernel_path = r'd:\Vigilant IT Solutions\Miracle_Os_Master\miracle_kernel.json'
with open(kernel_path, 'r', encoding='utf-8') as file:
    kernel = json.load(file)

kernel['system_architecture'] = {
    'role_permissions': roles,
    'database_schema': db_schema,
    'api_endpoints': list(set(endpoints))
}

with open(kernel_path, 'w', encoding='utf-8') as file:
    json.dump(kernel, file, indent=2)

print('Phase 1 Architectures Extracted and Injected successfully.')
