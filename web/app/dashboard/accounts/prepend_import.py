import sys

target = r'd:\Miracle_Os_Master\web\app\dashboard\accounts\page.tsx'
with open(target, 'rb') as f:
    content = f.read()

header = b"'use client';\r\nimport React, { useState, useEffect, useMemo } from 'react';\r\n\r\n"

if b'import React' not in content:
    content = header + content
    with open(target, 'wb') as f:
        f.write(content)
    print('React import prepended.')
else:
    print('React already imported.')

print('File size:', len(content), 'bytes')
with open(target, 'rb') as f:
    first_lines = f.read(200)
print('First 200 bytes:', repr(first_lines))
