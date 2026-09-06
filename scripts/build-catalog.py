"""Build a pinned gameplay catalog without copying temporary signed image URLs."""
import json, hashlib, re
from pathlib import Path
raw=json.loads(Path('docs/rules-audit/sources/card-details.json').read_text())['items']
corrections=json.loads(Path('docs/rules-audit/card-data-corrections.json').read_text())['cards']
cards=[]
for c in raw:
 if c['slug']=='rebecca-having-a-moment': continue
 if c['slug'] in corrections:c['power']=corrections[c['slug']]['power']
 text=c.get('rules_text') or ''
 if c['slug']=='alt-cunningham-soulkiller-architect':
  text='{Spend} Your next Program this turn plays for -1 €$ for each friendly min Gig, to a minimum of 1 €$.\n'+text
  c['power']=0
 if c['slug'] in ['animals-wrecker','emergency-atlus','psycho-squad','rockn-rockerboy']: text=''
 cards.append(dict(id=c['slug'],sourceId=c['id'],name=c['name'],subtitle=c.get('subname') or '',nameFull=c['name']+(' — '+c['subname'] if c.get('subname') else ''),type=c['card_type'],color=c['color'],cost=c['cost'],power=c['power'],ram=c['ram'],sell=c['is_eddiable'],tags=c['classifications'],text=text,image='/cards/'+c['slug']+'.webp',source='https://cyberpunktcg.com/cards/'+c['slug'],printings=[dict(id=p['id'],number=p['collector_number'],set=p['set']['code'],setName=p['set']['name']) for p in c['printings']]))
# All 17 layouts were reviewed against the pinned official renderings on 2026-09-06.
for c in cards:
 if c['type']!='Gear': continue
 text=c['text']; reminder='(Equip to a friendly Unit or face-up Legend.)'
 if text.startswith('(Equip '): text=text.split('\n',1)[1] if '\n' in text else ''
 intrinsic=text if c['id']=='zetatech-berserk' else ''
 flavor='One cut, one kill.' if c['id']=='mantis-blades' else ''
 inherited='' if intrinsic or flavor else text
 c['gearText']=dict(intrinsic=intrinsic,inherited=inherited,reminder=reminder,flavor=flavor)
 if flavor:c['text']=reminder
# Only a leading keyword grants that keyword. References in another effect
# (e.g. Street Racer granting Adrenaline) do not grant it to the source.
for c in cards:
 text=c.get('gearText',{}).get('inherited',c['text'])
 c['keywords']=re.findall(r'^\s*\{(Blocker|Adrenaline|Go Solo|Quick)\}',text,re.M)
Path('packages/catalog/cards.json').write_text(json.dumps(cards,ensure_ascii=False,indent=2)+'\n')
Path('packages/catalog/manifest.json').write_text(json.dumps(dict(version='2026-09-06.2',cutoff='2026-09-05',candidateCount=len(cards),certified=False,sha256=hashlib.sha256(json.dumps(cards,sort_keys=True).encode()).hexdigest()),indent=2)+'\n')
print('Built',len(cards),'candidate cards; certification remains tracked separately.')
