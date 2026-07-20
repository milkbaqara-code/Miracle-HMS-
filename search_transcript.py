import json

log_path = r"C:\Users\USER\.gemini\antigravity\brain\7048623f-d378-4e58-bcb6-8b17bdd4bd31\.system_generated\logs\transcript.jsonl"
print(f"Reading log file: {log_path}")

keywords = ["luxury-hospitality", "Luxury Eco-Resort"]

found_lines = []

with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_num, line in enumerate(f, 1):
        for kw in keywords:
            if kw in line:
                # Let's count how many times it appeared and print line_num and length
                found_lines.append((line_num, kw, len(line)))

print(f"Occurrences found: {len(found_lines)}")
for line_num, kw, length in found_lines[:20]:
    print(f"Line {line_num}: keyword '{kw}', line length {length}")
