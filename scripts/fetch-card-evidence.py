"""Fetch one pinned official rendering per eligible identity; never change the roster."""
import json,hashlib,urllib.request,concurrent.futures
from pathlib import Path
raw=json.loads(Path('docs/rules-audit/sources/card-details.json').read_text())['items']
out=Path('docs/rules-audit/evidence/cards');out.mkdir(parents=True,exist_ok=True)
def fetch(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CyberpunkTCG-rules-audit/1.0'}),timeout=40) as r:return r.read()
def download(c):
 path=out/(c['slug']+'.webp');source=c['source_image_url']
 if not path.exists():
  try:data=fetch(source)
  except Exception:
   fresh=json.loads(fetch('https://api.netdeck.gg/api/cards/cyberpunk/'+c['slug']))
   matches=[p for p in fresh['printings'] if p['source_image_url']==source]
   if not matches:raise RuntimeError('Pinned rendering no longer available: '+c['slug'])
   data=fetch(matches[0]['image_url'])
  if data[:4]!=b'RIFF':raise RuntimeError('Not a WebP: '+c['slug'])
  path.write_bytes(data)
 return {'id':c['slug'],'source':source,'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'reviewed':False}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 results=list(pool.map(download,[c for c in raw if c['slug']!='rebecca-having-a-moment']))
Path('docs/rules-audit/evidence/card-image-manifest.json').write_text(json.dumps(results,indent=2)+'\n')
print('Fetched',len(results),'pinned renderings. Visual verification is separate.')
