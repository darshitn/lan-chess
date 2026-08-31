import pathlib
p = pathlib.Path('D:/Projects/Multi-Agent-Interface/start-dev.ps1')
text = p.read_text(encoding='utf-8')
lines = text.splitlines()
for i, l in enumerate(lines, 1):
    c = l.count('"')
    if c % 2 == 1:
        print(f'Line {i} odd quotes ({c}): {repr(l)}')
for i, l in enumerate(lines, 1):
    if '—' in l:
        print(f'Line {i} em dash')
open_b = text.count('{')
close_b = text.count('}')
print(f'Braces open {open_b} close {close_b} diff {open_b-close_b}')
open_p = text.count('(')
close_p = text.count(')')
print(f'Parens open {open_p} close {close_p} diff {open_p-close_p}')
print('done')
