import pathlib
for fname in ["start-dev.ps1", "scripts/dev.ps1", "start-dev.bat"]:
    p = pathlib.Path(f"D:/Projects/Multi-Agent-Interface/{fname}")
    if not p.exists():
        continue
    t = p.read_text(encoding="utf-8")
    orig = t
    # Replace em dash and checkmark and any non-ascii that could break PowerShell parser
    # Use simple replacements
    t = t.replace("—", "-")  # em dash
    t = t.replace("–", "-")  # en dash
    t = t.replace("✓", "[OK]")
    t = t.replace("→", "->")
    # Also replace any other common unicode that might be in comments
    # Ensure file is saved as UTF-8 with BOM for PowerShell compatibility? We'll save as utf-8 without BOM but now ascii only
    if t != orig:
        p.write_text(t, encoding="utf-8")
        print(f"Fixed {fname}")
    else:
        print(f"No changes {fname}")
    # also print any remaining non-ascii
    remaining = set(c for c in t if ord(c) > 127)
    if remaining:
        print(f"Remaining non-ascii in {fname}: {remaining}")
