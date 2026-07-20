import re

with open('page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Scale down table padding / button padding for density
text = re.sub(r\"padding:\s*'10px 12px'\", \"padding: '6px 8px'\", text)
text = re.sub(r\"padding:\s*'10px 8px'\", \"padding: '4px 6px'\", text)
text = re.sub(r\"padding:\s*'12px'\", \"padding: '8px'\", text)
text = re.sub(r\"padding:\s*'10px'\", \"padding: '6px'\", text)
text = re.sub(r\"padding:\s*'14px'\", \"padding: '10px'\", text)
text = re.sub(r\"padding:\s*'12px 30px'\", \"padding: '8px 20px'\", text)
text = re.sub(r\"padding:\s*'8px 16px'\", \"padding: '6px 14px'\", text)
text = re.sub(r\"padding:\s*'5px 12px'\", \"padding: '4px 10px'\", text)

with open('page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Paddings scaled down.')
