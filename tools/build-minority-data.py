"""Build src/data/minority.js from the Merged Religious Minority Scheme List (.docx).
Usage: python3 tools/build-minority-data.py [input.docx] [output.js]      (needs: pip install python-docx)

Layout of the Word file: "1. MUSLIM" ... "6. PARSI / IRANI" are religions; lines in the same list style under them are
sub-headings (not bullets) and bullet items. Section 7 = common category lists, 8 = agriculture, 9 = business,
10 = eligibility rules.
"""
import re, json, sys
from docx import Document

SRC = sys.argv[1] if len(sys.argv) > 1 else 'data-source/Merged_Religious_Minority_Scheme_List.docx'
DST = sys.argv[2] if len(sys.argv) > 2 else 'src/data/minority.js'
doc = Document(SRC)

def is_bullet(p):
    pPr = p._p.pPr
    return pPr is not None and pPr.numPr is not None

blocks = []                     # (kind, text) kind = 'main' | 'sub' | 'item'
for i, p in enumerate(doc.paragraphs):
    t = re.sub(r'\s+', ' ', p.text).strip()
    if not t or i < 2: continue  # first two paragraphs: title and intro line
    if is_bullet(p): blocks.append(('item', t))
    elif re.match(r'^\d+\.\s+\S', t): blocks.append(('main', t))
    else: blocks.append(('sub', t))

mains = [(i, b[1]) for i, b in enumerate(blocks) if b[0] == 'main']
assert [int(m[1].split('.')[0]) for m in mains] == list(range(1, 11)), 'expected 10 numbered sections'

def section_blocks(n):
    start = mains[n - 1][0] + 1
    end = mains[n][0] if n < len(mains) else len(blocks)
    return blocks[start:end]

def classify(title_raw):
    """-> title, qualifier, kind, certs"""
    m = re.match(r'^(.*?)\s*(?:\((.*)\))?\s*(?:\s[–—-]\s(.*))?$', title_raw)   # a dash splits only when spaces surround it (keeps Neo-Buddhist, Self-Employment)
    title, qual = m.group(1).strip(), (m.group(2) or m.group(3) or '').strip()
    t = title.lower()
    kind, certs = 'scholarship', []
    if t.startswith('minority schemes'): kind = 'scholarship'
    elif t.startswith('central government'): kind = 'central'
    elif t.startswith('business'): kind = 'business'
    elif t.startswith('education loans'): kind = 'loan'
    elif t.startswith('agriculture') or t.endswith('agriculture'): kind = 'agri'
    if t.startswith('obc'): certs = ['obc']
    elif t.startswith('sbc'): certs = ['sbc']
    elif t.startswith('vjnt'): certs = ['vjnt']
    elif t.startswith('sc / vjnt'): certs = ['sc', 'vjnt']
    elif t.startswith('sc'): certs = ['sc']
    if kind == 'business' and re.search(r'\bSC\b', qual): certs = ['sc']
    return title, qual, kind, certs

def item(t):
    o = {'t': t}
    if re.search(r'verify', t, re.I): o['v'] = 1                        # availability must be checked
    if t.startswith('General Agriculture Schemes apply'): o['r'] = 'agri'  # points to the common agriculture list
    elif t.startswith('No scheme listed'): o['r'] = 'none'
    elif re.match(r'^SC schemes \(see Section', t): o['r'] = 'note'
    return o

def build_sections(blks, default_title=None):
    secs, cur = [], None
    for kind, t in blks:
        if kind == 'sub':
            title, qual, k, certs = classify(t)
            cur = {'title': title, 'qual': qual, 'kind': k, 'certs': certs, 'items': []}; secs.append(cur)
        else:
            assert cur is not None, f'item before any sub-heading: {t[:40]}'
            cur['items'].append(item(t))
    return secs

IDS = ['muslim', 'christian', 'buddhist', 'jain', 'sikh', 'parsi']
religions = []
for n in range(1, 7):
    name = re.sub(r'^\d+\.\s+', '', mains[n - 1][1]).title().replace(' / ', ' / ')
    religions.append({'id': IDS[n - 1], 'name': name, 'sections': build_sections(section_blocks(n))})

# Common lists (7 = category-wise, 8 = agriculture, 9 = business)
common = []
for s in build_sections(section_blocks(7)):
    s['title'] = s['title'].capitalize().replace('Obc', 'OBC').replace('Vjnt', 'VJNT').replace('Sbc', 'SBC').replace('Sc / neo-buddhist', 'SC / Neo-Buddhist')
    common.append(s)
agri = [item(t) for k, t in section_blocks(8)]
biz = [item(t) for k, t in section_blocks(9)]
common.append({'title': 'General agriculture schemes', 'qual': 'not religion-specific', 'kind': 'agri', 'certs': [], 'items': agri})
common.append({'title': 'General business / self-employment schemes', 'qual': 'not automatically minority-specific', 'kind': 'business', 'certs': [], 'items': biz})
rules = [t for k, t in section_blocks(10)]

everyone = {'id': 'everyone', 'name': 'For everyone', 'sections': common}
total = sum(len(s['items']) for r in religions + [everyone] for s in r['sections'])

def dump(o): return json.dumps(o, ensure_ascii=False, separators=(',', ':'))
js = '// Religious-minority schemes, built from "Merged Religious Minority Scheme List" (.docx) by tools/build-minority-data.py.\n'
js += '// Scheme NAMES only: the source has no amounts, dates or income limits. Edit by hand or re-run the tool.\n'
js += '// kind: scholarship | central | business | loan | agri.  certs: official certificate a section needs (obc, sbc, vjnt, sc).\n'
js += '// item flags: v = "verify current status", r = agri | none | note (a pointer or remark, not a scheme).\n\n'
js += 'export const RELIGIONS = [\n' + ',\n'.join(
    '  {"id":%s,"name":%s,"sections":[\n%s\n  ]}' % (dump(r['id']), dump(r['name']), ',\n'.join('    ' + dump(s) for s in r['sections'])) for r in religions) + '\n];\n\n'
js += 'export const EVERYONE = {"id":"everyone","name":"For everyone","sections":[\n' + ',\n'.join('  ' + dump(s) for s in common) + '\n]};\n\n'
js += 'export const RULES = ' + dump(rules) + ';\n'
open(DST, 'w', encoding='utf-8').write(js)

print('wrote', DST, len(js) // 1024, 'KB')
for r in religions: print(f"{r['name']:14} sections={len(r['sections'])} items={sum(len(s['items']) for s in r['sections'])}")
print('common sections', [(s['title'], len(s['items'])) for s in common]); print('rules', len(rules), '| total items', total)
for r in religions[:1] + religions[1:2]:
    for s in r['sections']: print('  ', r['name'], '|', s['title'], '|', s['qual'][:40], '|', s['kind'], s['certs'], len(s['items']))
