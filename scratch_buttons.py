import os
import re

base_dir = r'd:\Vigilant IT Solutions\Miracle_Os_Master\web\app'
button_pattern = re.compile(r'<button[^>]*>(.*?)</button>', re.DOTALL | re.IGNORECASE)

results = {}
for root, dirs, files in os.walk(base_dir):
    for f in files:
        if f.endswith('.tsx'):
            filepath = os.path.join(root, f)
            rel_path = os.path.relpath(filepath, base_dir)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
                buttons = button_pattern.findall(content)
                cleaned = []
                for b in buttons:
                    clean_b = re.sub(r'<[^>]+>', '', b).strip()
                    if '{' in b and '}' in b:
                        m = re.search(r'[\'"]([^\'"]+)[\'"]', b)
                        if m: clean_b = m.group(1)
                    if clean_b and not clean_b.startswith('{'):
                        cleaned.append(clean_b.replace('\n', ' '))
                if cleaned:
                    results[rel_path] = list(set(cleaned))

with open('buttons.txt', 'w', encoding='utf-8') as f:
    for path, btns in results.items():
        f.write(f'\n--- {path} ---\n')
        f.write(', '.join(btns) + '\n')
