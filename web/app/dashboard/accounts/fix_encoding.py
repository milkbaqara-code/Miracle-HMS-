import os
import re

dir_path = os.path.dirname(os.path.abspath(__file__))
page_path = os.path.join(dir_path, 'page.tsx')

with open(page_path, 'r', encoding='utf-8', errors='replace') as f:
    text = f.read()

emojis = [
    '📊', '📋', '📉', '🤖', '🕑', '🌙', '📥', '🏦', '🛡️', '⚠️', '🚫', '💡', '🖨️', '🔐', '🔄', 
    '🚨', '✅', '❌', '➡️', '✔', '↗', '📤', '🏨', '💰', '🔝', '🛂',
    '→', '←', '↑', '↓', '৳', '✅', '❌', '⚠️', '🛡', '⚙', '★', '✓'
]

replace_count = 0
for emoji in emojis:
    utf8_bytes = emoji.encode('utf-8')
    try:
        corrupted_cp1252 = utf8_bytes.decode('cp1252')
        if corrupted_cp1252 in text:
            text = text.replace(corrupted_cp1252, emoji)
            replace_count += 1
    except UnicodeDecodeError:
        pass

    try:
        corrupted_latin1 = utf8_bytes.decode('latin1')
        if corrupted_latin1 in text:
            text = text.replace(corrupted_latin1, emoji)
            replace_count += 1
    except UnicodeDecodeError:
        pass

# Some manual stragglers identified manually
text = text.replace('à§³', '৳')
text = text.replace('â†’', '→')
text = text.replace('âž¡ï¸', '➡️')
text = text.replace('â¬…ï¸', '⬅️')
text = text.replace('ðŸš¨', '🚨')
text = text.replace('ðŸ›¡ï¸', '🛡️')
text = text.replace('âŒ', '✅')

def fix_match(m):
    s = m.group(0)
    try:
        b = s.encode('cp1252')
        decoded = b.decode('utf-8')
        if len(decoded) < len(s):
            return decoded
    except Exception:
        pass
    try:
        b = s.encode('latin1')
        decoded = b.decode('utf-8')
        if len(decoded) < len(s):
            return decoded
    except Exception:
        pass
    return s

original_text = text
text = re.sub(r'[^\x00-\x7F]{2,}', fix_match, text)

with open(page_path, 'w', encoding='utf-8') as f:
    f.write(text)

print(f"Direct string replacements: {replace_count}")
print(f"Generic regex replacements (length delta): {len(original_text) - len(text)}")
print("ENCODING RESTORED COMPLETELY")
