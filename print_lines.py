import json

log_path = r"C:\Users\USER\.gemini\antigravity\brain\7048623f-d378-4e58-bcb6-8b17bdd4bd31\.system_generated\logs\transcript.jsonl"
print(f"Reading log file: {log_path}")

target_line = 9686

with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_num, line in enumerate(f, 1):
        if line_num == target_line:
            print(f"--- LINE {line_num} ---")
            print(line[:2000]) # Print first 2000 chars
            print("...")
            print(line[-2000:]) # Print last 2000 chars
            break
