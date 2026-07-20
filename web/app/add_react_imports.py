import os
import re

WEB_ROOT = r'd:\Miracle_Os_Master\web\app'

FILES_NEEDING_FIX = [
    'dashboard/admin/page.tsx',
    'dashboard/audit-ledger/page.tsx',
    'dashboard/checkout/layout.tsx',
    'dashboard/checkout/page.tsx',
    'dashboard/crm/page.tsx',
    'dashboard/hr/layout.tsx',
    'dashboard/hr/page.tsx',
    'dashboard/inventory/layout.tsx',
    'dashboard/inventory/page.tsx',
    'dashboard/issue-tickets/layout.tsx',
    'dashboard/issue-tickets/page.tsx',
    'dashboard/media-lab/page.tsx',
    'dashboard/page.tsx',
    'dashboard/policy/layout.tsx',
    'dashboard/policy/page.tsx',
    'dashboard/pos/layout.tsx',
    'dashboard/pos/page.tsx',
    'dashboard/pos-admin/page.tsx',
    'dashboard/reservations/layout.tsx',
    'dashboard/reservations/page.tsx',
    'dashboard/settings/page.tsx',
    'dashboard/solve/layout.tsx',
    'dashboard/solve/page.tsx',
    'layout.tsx',
    'page.tsx',
]

fixed = 0
skipped = 0

for rel_path in FILES_NEEDING_FIX:
    full_path = os.path.join(WEB_ROOT, rel_path)
    if not os.path.exists(full_path):
        print(f'SKIP (not found): {rel_path}')
        skipped += 1
        continue

    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # already has React import?
    if 'import React' in content:
        print(f'SKIP (already has React): {rel_path}')
        skipped += 1
        continue

    # Find 'use client' or first import line to insert after
    if "import { useState" in content:
        # Replace the existing destructured hook import with React-inclusive version
        content = content.replace(
            "import { useState, useEffect, useMemo } from 'react';",
            "import React, { useState, useEffect, useMemo } from 'react';"
        )
        content = content.replace(
            "import { useState, useEffect } from 'react';",
            "import React, { useState, useEffect } from 'react';"
        )
        content = content.replace(
            "import { useState } from 'react';",
            "import React, { useState } from 'react';"
        )
    elif "'use client';" in content:
        # Prepend after 'use client'
        content = content.replace(
            "'use client';",
            "'use client';\nimport React from 'react';",
            1
        )
    else:
        # Prepend at the very top
        content = "import React from 'react';\n" + content

    with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f'FIXED: {rel_path}')
    fixed += 1

print(f'\n=== DONE: {fixed} files fixed, {skipped} skipped ===')
