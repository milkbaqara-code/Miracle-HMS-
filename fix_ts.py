with open('web/app/dashboard/hr/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "showConfirm('Close this vacancy?" in line:
        start_idx = line.find('if (showConfirm)')
        end_idx = line.find(')); }}') + 2
        
        replacement = "if (window.confirm('Close this vacancy?')) { fetch(`${API}/hr/talent/vacancies/${v.id}/close`, {method:'POST'}).then(() => fetchSTEData()); }"
        
        lines[i] = line[:start_idx] + replacement + line[end_idx:]

with open('web/app/dashboard/hr/page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
