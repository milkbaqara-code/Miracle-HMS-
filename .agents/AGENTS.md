# Iron Law: Strict Regex Bounds in File Modifications

When writing Python scripts or any automated scripts to edit files (especially JSX/TSX/HTML code), you MUST adhere to the following Iron Law to prevent accidental code deletion:

1. **NO GREEDY REGEX ON HTML/JSX TAGS**: NEVER use `re.sub(r".*?</div>", ...)` or `re.sub(r".*?</main>", ...)` without strictly bounding the match. Due to the nested nature of JSX, a greedy regex matching `</div>` will invariably swallow huge chunks of unrelated UI code (like tab switchers, forms, and closing tags) causing syntax errors and broken builds.
2. **USE BUILT-IN EDIT TOOLS**: Prefer the native `replace_file_content` or `multi_replace_file_content` tools with exact string targets whenever possible, as they ensure exact bounding.
3. **USE EXACT STRING REPLACEMENT**: If a custom Python script must be used, use standard string `replace()` over `re.sub()` whenever possible.
4. **VERIFY CHANGES POST-SCRIPT**: If a regex replacement is absolutely unavoidable, immediately `view_file` on the lines adjacent to the edit to ensure no unrelated code blocks were deleted. Do not blindly assume the regex behaved as expected.
