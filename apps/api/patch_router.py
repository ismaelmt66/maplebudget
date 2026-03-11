"""Patch main.py to insert the subscriptions router mount - handles encoding."""

with open('main.py', 'r', encoding='utf-8', errors='replace') as f:
    lines = f.readlines()

# Find line 35 (after the closing paren of add_middleware)
# and insert include_router call after it
# We look for the line after the closing ')' of add_middleware

already_patched = any("include_router(subscriptions_router" in l for l in lines)
if already_patched:
    print("Already patched!")
else:
    # Find the right insertion point: after the CORS middleware block (line 35 is ')')
    # We'll insert after line index 35 (0-based = line 36)
    insert_line = "app.include_router(subscriptions_router.router, prefix=\"/analytics\")\n"
    
    # Find line with just ")" that comes after "allow_headers"
    for i, line in enumerate(lines):
        if i > 30 and line.strip() == ")" and "allow_headers" in lines[i-1]:
            # Insert 2 lines after this
            insert_pos = i + 2
            lines.insert(insert_pos, insert_line)
            print(f"Inserted at line {insert_pos + 1}")
            break
    else:
        print("Could not find insertion point automatically, inserting at line 37")
        lines.insert(36, insert_line)
    
    with open('main.py', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Done!")
