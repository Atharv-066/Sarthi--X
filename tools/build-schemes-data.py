"""Build src/data/schemes.js from the Categorized Student Schemes Directory (.docx).
Usage: python3 tools/build-schemes-data.py <input.docx> <output schemes.js>
Needs: pip install python-docx
"""
import re, json, sys
from collections import Counter
from docx import Document

SRC = sys.argv[1] if len(sys.argv) > 1 else 'data-source/Categorized_Student_Schemes_Directory.docx'
DST = sys.argv[2] if len(sys.argv) > 2 else 'src/data/schemes.js'
doc = Document(SRC)

groups, schemes = [], []
for p in doc.paragraphs:
    t = p.text.strip()
    if not t: continue
    m = re.match(r'^(\d+)\.\s+(.*)$', t, re.S)
    if not m: continue
    size = p.runs[0].font.size if p.runs else None
    body = re.sub(r'\s+', ' ', m.group(2)).strip().replace("\\'", "'")
    if size == 165100:   # 13 pt paragraphs are the section headings
        groups.append(body)
    else:
        schemes.append({'no': int(m.group(1)), 'title': body, 'g': len(groups)})
assert len(groups) == 13, f'expected 13 groups, got {len(groups)}'
assert [s['no'] for s in schemes] == list(range(1, len(schemes) + 1)), 'scheme numbering has a gap'

GROUP_CATS = {1:['sc'], 2:['st'], 3:['vjnt'], 4:['obc'], 5:['sbc'], 6:['maratha'], 7:['ews','open'],
              8:['minority'], 9:['all'], 10:['all'], 11:['all'], 12:['all'], 13:[]}
OVERRIDE_CATS = {
  110:['sc','st'], 230:['vjnt','sbc'], 231:['vjnt','sbc'], 232:['obc','vjnt','sbc','maratha'],
  233:['maratha','ews','open'], 234:['sc','obc'], 235:['obc','ews','vjnt'], 236:['obc','ews','vjnt'],
  237:['obc','ews','vjnt'], 238:['obc','ews','vjnt'], 239:['sc','st'],
  75:['open','ews'], 76:['open'], 77:['open','ews'], 81:['ews'],
}
# 234 is for SC / OBC children first; PM CARES in the name must not hide it from SC / OBC students.
SP_OVERRIDE = {234: []}
def has(t, *pats): return any(re.search(p, t, re.I) for p in pats)

def special(t, g):
    out = []
    if g == 10 or has(t, r'\bGirls?\b', r'\bWomen', r'\bFemale', r'\bKanya', r'Single Girl', r'Matoshri'): out.append('girls')
    if g == 9 or has(t, r'Disabilit', r'Specially-Abled', r'Divyang', r'\bPwD'): out.append('pwd')
    if has(t, r'Ex-Servicemen', r'Freedom Fighters', r'Police Personnel', r'Wards of[^(]*Police Forces', r'Armed Forces', r'Martyred'): out.append('wards')
    if has(t, r'Beedi', r'Cine Workers', r'Mine Workers', r'Landless Agricultural', r'Artisans'): out.append('workers')
    if has(t, r'Orphan', r'PM CARES'): out.append('orphan')
    return [x for x in ['girls','pwd','wards','workers','orphan'] if x in out]

def levels(t):
    L = set()
    if has(t, r'Pre-Matric', r'Pre-Upper Primary', r'Pre-Secondary', r'Class 8', r'Class 9', r'Class 10', r'Class 5', r'Matriculation', r'\bSchool\b', r'Schools', r'NMMSS', r'Class 9 to 12'): L.add('school')
    if has(t, r'Class 9 to 12'): L.add('junior')
    if has(t, r'Junior College', r'11th', r'12th', r'Intermediate', r'Junior Level', r'Vidyaniketan'): L.add('junior')
    if has(t, r'Post[- ]Matric'): L.update(['junior','diploma','ug','pg'])
    if has(t, r'Diploma', r'Polytechnic', r'\bITI', r'Craftsman'): L.add('diploma')
    if has(t, r'Undergraduate', r'\bUG\b', r'B\.Sc', r'B\.Tech', r'\bBE\b', r'B\.Stat', r'B\.Math', r'Degree', r'MBBS', r'Senior Level'): L.add('ug')
    if has(t, r'Postgraduate', r'\bPG\b', r'M\.Tech', r'M\.Sc', r'M\.Stat', r'M\.Arch', r'M\.Pharm', r'Master', r'\bME\b', r'Post Graduate', r'NSPGS', r'MSQE'): L.add('pg')
    if has(t, r'Ph\.?D', r'Doctoral', r'Research', r'Fellowship', r'\bJRF\b', r'\bSRF\b', r'Post-?Doctoral', r'Faculty', r'Associateship', r'Adhichatra'): L.add('phd')
    if has(t, r'Professional', r'Technical', r'Medical', r'Engineering', r'Agricultur', r'Veterinary', r'Dental', r'Pharm', r'\bDTE\b', r'\bDMER\b', r'MCAER', r'MAFSU', r'Directorate of Art'): L.add('prof')
    if has(t, r'Coaching', r'UPSC', r'MPSC', r'Banking', r'\bCET\b', r'\bJEE\b', r'NEET', r'\bNDA\b', r'\bCDS\b', r'CAPF', r'IFoS', r'JMFC', r'Civil Services', r'Competitive', r'Foundation Support', r'Examination Foundation'): L.add('exam')
    if has(t, r'Vocational', r'Certification', r'Upskilling', r'Skill', r'Commercial Pilot', r'\bCPL\b', r'Training', r'Craftsman', r'Personality Development', r'Internship', r'Earn and Learn', r'Kamva Va Shika', r'Fellowship Program'): L.add('skill')
    if has(t, r'Abroad', r'Overseas', r'Foreign', r'Pardesh'): L.add('abroad')
    # Names that say "higher / college / post-matric style" without naming a level.
    if not (L & {'school','junior','diploma','ug','pg','phd'}):
        if has(t, r'Freeship', r'Tuition Fee', r'Shishyavrutti', r'Maintenance'): L.update(['diploma','ug','pg'])
        if has(t, r'Swadhar', r'Swayam'): L.update(['junior','diploma','ug','pg'])
        if has(t, r'Nirvah Bhatta', r'Vasatigruh', r'Vastigruh', r'Matoshri', r'Hostel'): L.update(['diploma','ug','pg'])
        if has(t, r'Junior / Senior College'): L.update(['junior','ug'])
        if has(t, r'Higher Education', r'College', r'Top Class Education', r'Premier', r'Education Loans?', r'Interest Subsidy', r'Women Engineers', r'University'): L.update(['ug','pg'])
        if has(t, r'World Academy'): L.add('school')
    return [x for x in ['school','junior','diploma','ug','pg','phd','prof','exam','skill','abroad'] if x in L]

def kinds(t):
    K = set()
    if has(t, r'Tuition', r'Examination Fee', r'Freeship', r'Fee Reimbursement', r'Fees? and Examination', r'Educational Fee', r'Education Fee'): K.add('fee')
    if has(t, r'Scholarship', r'Shishyavrutti', r'Eklavya'): K.add('scholarship')
    if has(t, r'Fellowship', r'Studentship', r'Associateship'): K.add('fellowship')
    if has(t, r'Hostel', r'Vasatigruh', r'Vastigruh', r'Swadhar', r'Swayam', r'Maintenance', r'Nirvah Bhatta', r'Mess', r'Accommodation', r'Subsistence'): K.add('hostel')
    if has(t, r'Coaching', r'Training', r'Stipend', r'Mentorship', r'Internship', r'Soft Skills', r'Upskilling', r'Certification', r'Foundation'): K.add('coaching')
    if has(t, r'Loan', r'Interest Subsidy', r'Interest Subvention', r'Interest support', r'Vidyalaxmi'): K.add('loan')
    if has(t, r'Cash Award', r'Grant', r'Financial Assistance', r'Aid\b', r'Incentive', r'Concession', r'Award', r'Book Bank', r'Tablet', r'Laptop', r'Free Bus'): K.add('grant')
    if not K: K.add('scholarship')
    return [x for x in ['scholarship','fee','fellowship','hostel','coaching','loan','grant'] if x in K]

PRIVATE = [r'Tata Trusts', r'Reliance Foundation', r'Aditya Birla', r'HDFC', r'Vidyasaarathi', r'Siemens', r'Colgate', r'Federal Bank', r'Kind Circle',
           r'Jindal', r'Kotak', r'Infosys', r"L'Or", r'Santoor', r'Rolls-Royce', r'Lovely', r'Keep India Smiling']
STATE = [r'Maharashtra', r'\bDHE\b', r'\bDTE\b', r'\bDMER\b', r'MCAER', r'MAFSU', r'Mahajyoti', r'SARTHI', r'BARTI', r'TRTI', r'AMRUT', r'Rajarshi', r'Krantijyoti',
         r'Ahilyabai', r'MSRTC', r'CMYKPY', r'Chief Minister', r'Mukhyamantri', r'Karmaveer', r'Panjabrao', r'Punjabrao', r'Eklavya', r'Vidyaniketan', r'Dakshina',
         r'Social Justice', r'Tribal Development', r'Swadhar', r'Swayam', r'Matoshri', r'Freeship', r'Tuition Fees? and Examination', r'Post[- ]Matric Scholarship to',
         r'Open Merit', r'Merit Scholarships? for Economically', r'Assistance to Meritorious', r'Directorate of Art', r'\bVJNT\b', r'\bSBC\b']
def provider(t):
    if has(t, r'Municipal Corporation', r'\bPMC\b', r'\bBMC\b', r'\bPCMC\b'): return 'civic'
    if has(t, r'State Government', r'\bSEBC\b', r'Vocational (Training|Education) (Fee|Maintenance)', r'Maintenance Allowance for Students Studying in Professional'): return 'state'
    if has(t, r'University of Mumbai', r'Pune University', r'Nagpur University', r'Marathwada University', r'Shivaji University', r'Jawaharlal Nehru University', r'Maharashtra University'): return 'uni'
    if has(t, *PRIVATE): return 'private'
    if has(t, *STATE): return 'state'
    return 'central'

def need(t):
    # "need" = the name points to a means / income test. A guide only; the real income limit is on the official notice.
    if has(t, r'\bEWS\b', r'\bEBC\b', r'Economically', r'Means', r'Needy', r'Crisis', r'Non-Creamy', r'Interest Subsidy', r'Interest Subvention',
              r'Earn and Learn', r'Kamva Va Shika', r'Emergency', r'Swanath', r'Swadhar', r'Swayam', r'Nirvah Bhatta', r'Vasatigruh', r'Vastigruh',
              r'Maintenance', r'Freeship', r'Tuition Fee', r'Pre-Matric', r'Post[- ]Matric', r'Free Coaching', r'Subsistence', r'Shishyavrutti'): return 'need'
    if has(t, r'Merit', r'Rank Holder', r'Fellowship', r'\bJRF\b', r'\bSRF\b', r'Talent', r'Top Class', r'Award', r'Eklavya', r'Gunwant', r'Research',
              r'Studentship', r'Associateship', r'\bNET\b', r'Innovation', r'Exam'): return 'merit'
    return 'open'

out = []
for s in schemes:
    t, g = s['title'], s['g']
    cats = OVERRIDE_CATS.get(s['no'], GROUP_CATS[g])
    out.append({'no': s['no'], 'title': t, 'g': g, 'cats': cats, 'sp': SP_OVERRIDE.get(s['no'], special(t, g)), 'lv': levels(t),
                'kind': kinds(t), 'by': provider(t), 'need': need(t)})

js = ('// Student schemes directory (%d schemes, %d groups), built from "Categorized Student Schemes Directory" (.docx).\n'
      '// cats / sp / lv / kind / by / need are derived from each scheme\'s NAME to drive the filters on schemes.html.\n'
      '// They are a guide, not an eligibility ruling: income limits, dates and amounts are NOT in the source list.\n'
      '// Edit an object below by hand, or rebuild everything: python3 tools/build-schemes-data.py\n\n') % (len(out), len(groups))
js += 'export const SCHEME_GROUPS = ' + json.dumps(groups, ensure_ascii=False) + ';\n\n'
js += 'export const SCHEMES = [\n' + ',\n'.join(json.dumps(o, ensure_ascii=False, separators=(',', ':')) for o in out) + '\n];\n'
open(DST, 'w', encoding='utf-8').write(js)

print('wrote', DST, len(js) // 1024, 'KB;', len(out), 'schemes')
for k in ('by', 'need'): print(k, dict(Counter(o[k] for o in out)))
print('special', dict(Counter(x for o in out for x in o['sp'])))
print('no level (shown at every level):', sum(1 for o in out if not o['lv']))
