import json

log_path = r"C:\Users\USER\.gemini\antigravity\brain\7048623f-d378-4e58-bcb6-8b17bdd4bd31\.system_generated\logs\transcript.jsonl"
print(f"Reading log file: {log_path}")

target_lines = [757, 802, 5844]

with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_num, line in enumerate(f, 1):
        if line_num in target_lines:
            try:
                data = json.loads(line)
                print(f"--- LINE {line_num} (step_index={data.get('step_index')}, type={data.get('type')}) ---")
                content = data.get('content', '')
                print(f"Content snippet: {content[:300]}")
                tool_calls = data.get('tool_calls', [])
                if tool_calls:
                    print(f"Tool calls: {len(tool_calls)}")
                    for tc in tool_calls:
                        print(f"  Tool: {tc.get('name')}")
                        args = tc.get('args', {})
                        if isinstance(args, str):
                            print(f"    Args snippet: {args[:300]}")
                        elif isinstance(args, dict):
                            print(f"    Args keys: {list(args.keys())}")
                            if 'CodeContent' in args:
                                print(f"    CodeContent snippet: {args['CodeContent'][:1000]}")
            except Exception as e:
                print(f"--- LINE {line_num} (Raw) ---")
                print(line[:500])
            print("-" * 50)
