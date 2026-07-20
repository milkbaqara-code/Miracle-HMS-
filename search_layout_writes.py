import json
import re

log_path = r"C:\Users\USER\.gemini\antigravity\brain\7048623f-d378-4e58-bcb6-8b17bdd4bd31\.system_generated\logs\transcript.jsonl"
print(f"Reading log file: {log_path}")

# Search for patterns where write_to_file or replace_file_content targets layout.json or defaultLayout.ts
target_pattern = re.compile(r"layout\.json|defaultLayout\.ts", re.IGNORECASE)

found_writes = []

with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_num, line in enumerate(f, 1):
        if target_pattern.search(line):
            # Check if this is a tool call or file write
            if "write_to_file" in line or "replace_file_content" in line or "/api/deploy" in line:
                try:
                    data = json.loads(line)
                    step_idx = data.get("step_index")
                    source = data.get("source")
                    # Ignore current turns (e.g. above 10000)
                    if step_idx is not None and step_idx < 10000:
                        found_writes.append((line_num, step_idx, source, len(line)))
                except:
                    pass

print(f"Found {len(found_writes)} potential writes:")
for line_num, step_idx, source, length in found_writes:
    print(f"Line {line_num}: step_index={step_idx}, source={source}, line length={length}")
