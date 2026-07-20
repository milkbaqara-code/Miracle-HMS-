import re
import json
import os

ZONES = {
    "Z-07": "d:\\Vigilant IT Solutions\\Miracle_Os_Master\\web\\app\\dashboard\\page.tsx",
    "Z-05": "d:\\Vigilant IT Solutions\\Miracle_Os_Master\\web\\app\\dashboard\\reservations\\page.tsx",
    "Z-08": "d:\\Vigilant IT Solutions\\Miracle_Os_Master\\web\\app\\dashboard\\checkout\\page.tsx",
    "Z-12": "d:\\Vigilant IT Solutions\\Miracle_Os_Master\\web\\app\\dashboard\\inventory\\page.tsx",
    "Z-06": "d:\\Vigilant IT Solutions\\Miracle_Os_Master\\web\\app\\dashboard\\pos\\page.tsx",
    "Z-09": "d:\\Vigilant IT Solutions\\Miracle_Os_Master\\web\\app\\dashboard\\hr\\page.tsx",
    "Z-11": "d:\\Vigilant IT Solutions\\Miracle_Os_Master\\web\\app\\dashboard\\accounts\\page.tsx",
    "Z-10": "d:\\Vigilant IT Solutions\\Miracle_Os_Master\\web\\app\\dashboard\\crm\\page.tsx",
    "Z-17": "d:\\Vigilant IT Solutions\\Miracle_Os_Master\\web\\app\\dashboard\\solve\\page.tsx",
    "Z-19": "d:\\Vigilant IT Solutions\\Miracle_Os_Master\\web\\app\\dashboard\\policy\\page.tsx",
    "Z-23": "d:\\Vigilant IT Solutions\\Miracle_Os_Master\\web\\app\\dashboard\\infrastructure\\page.tsx"
}

results = {}

for zone_id, path in ZONES.items():
    if not os.path.exists(path):
        continue
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple regex to find <button...>Text</button>
    matches = re.findall(r'<button[^>]*>([^<]+)</button>', content)
    
    # Clean up the text: remove non-alphanumeric at start, trim, handle {text} templates basically
    buttons = set()
    for m in matches:
        text = m.strip()
        # ignore react templates like {something} completely, just get hardcoded text
        if "{" in text and "}" in text:
            continue
        # remove emojis / leading symbols
        text = re.sub(r'^[^\w]+', '', text).strip()
        if text:
            buttons.add(text)
    
    results[zone_id] = list(buttons)

print(json.dumps(results, indent=2))
