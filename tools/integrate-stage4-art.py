#!/usr/bin/env python3
"""Add only Stage4-owned HTML/SW/package hooks; retain existing release numbers.

This never runs the packager, accesses an account, resets data, or publishes.
The current target bytes, not a bundled replacement file, are the input.
"""
import argparse
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

OWNED = 'pharmacy-stage4-art'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def strip_block(text, kind):
    if kind == 'html':
        pattern = r'^[ \t]*<!-- '+OWNED+r' start -->\r?\n.*?^[ \t]*<!-- '+OWNED+r' end -->\r?\n'
    elif kind == 'python':
        pattern = r'# '+OWNED+r' start\r?\n.*?# '+OWNED+r' end\r?\n'
    else:
        pattern = r'// '+OWNED+r' start [^\r\n]+\r?\n.*?// '+OWNED+r' end [^\r\n]+\r?\n'
    return re.sub(pattern, '', text, flags=re.S|re.M)

class AssetTags(HTMLParser):
    """Locate real tags without reserializing HTML or touching adjacent bytes."""
    def __init__(self, text, config):
        super().__init__(convert_charrefs=False)
        self.text = text
        self.starts = [0]
        for match in re.finditer('\n', text):
            self.starts.append(match.end())
        self.resources = {
            'script': {'./'+name for name in config['scripts']},
            'link': {'./'+name for name in config['styles']},
        }
        self.removals = []
        self.anchors = []
        self.pending = None

    def tag_offset(self):
        line, column = self.getpos()
        return self.starts[line-1]+column

    def role(self, tag, attrs):
        if tag not in self.resources:
            return None
        attribute = 'src' if tag == 'script' else 'href'
        values = [value for name, value in attrs if name == attribute]
        paths = [(value or '').split('?', 1)[0] for value in values]
        owned = any(value in self.resources[tag] for value in paths)
        anchor = tag == 'script' and './cast-outfit.js' in paths
        if not owned and not anchor:
            return None
        if len(values) != 1:
            raise ValueError('Ambiguous HTML asset attributes; no changes written. Merge manually.')
        return 'asset' if owned else 'anchor'

    def handle_starttag(self, tag, attrs):
        role = self.role(tag, attrs)
        if role is None:
            return
        start = self.tag_offset()
        end = start+len(self.get_starttag_text())
        if tag == 'link':
            self.removals.append((start, end))
        else:
            self.pending = (start, end, role)

    def handle_startendtag(self, tag, attrs):
        if tag == 'script' and self.role(tag, attrs) is not None:
            raise ValueError('Ambiguous self-closing HTML script; no changes written. Merge manually.')
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag != 'script' or self.pending is None:
            return
        start, content, role = self.pending
        end = self.tag_offset()
        closing = re.match(r'</script\s*>', self.text[end:], re.I)
        if closing is None or (role == 'asset' and self.text[content:end].strip()):
            raise ValueError('Ambiguous HTML asset script body; no changes written. Merge manually.')
        (self.removals if role == 'asset' else self.anchors).append((start, end+closing.end()))
        self.pending = None

    def close(self):
        super().close()
        if self.pending is not None:
            raise ValueError('Unclosed HTML asset script; no changes written. Merge manually.')

def asset_tags(text, config):
    tags = AssetTags(text, config)
    tags.feed(text)
    tags.close()
    return tags

def plan(repo, include_packager=False):
    config=json.loads((repo/'tools/stage4-runtime-assets.json').read_text())
    for field in ['precache','lazy','offline','scripts','styles']:
        for value in config[field]:
            p=Path(value)
            target=repo/'game'/p
            if p.is_absolute() or '..' in p.parts or not target.is_file() or not target.resolve().is_relative_to((repo/'game').resolve()):
                raise ValueError('Missing or unsafe local asset: '+value)
    sw_path=repo/'game/sw.js'; sw=sw_path.read_bytes().decode()
    version=re.findall(r"const\s+VERSION\s*=\s*['\"]([^'\"]+)['\"]",sw)
    if len(version)!=1 or not re.fullmatch(r'[A-Za-z0-9_.-]+',version[0]):
        raise ValueError('Cannot safely identify the existing SW VERSION; merge manually.')
    version=version[0];changes=[]
    def add(path,text,original):
        changes.append((path,text.encode(),{'file':str(path.relative_to(repo)),'beforeBytes':len(original),'beforeSHA256':sha(original),'afterBytes':len(text.encode()),'afterSHA256':sha(text.encode()),'changed':original!=text.encode()}))
    html_path=repo/'game/index.html';original=html_path.read_bytes();html=original.decode();nl='\r\n' if '\r\n' in html else '\n'
    html=strip_block(html,'html')
    # Remove/adopt only the new asset tags, including a prior idempotent run.
    for start,end in sorted(asset_tags(html,config).removals,reverse=True):
        html=html[:start]+html[end:]
    anchors=asset_tags(html,config).anchors
    if len(anchors)!=1:raise ValueError('Cannot uniquely find the existing cast-outfit entrypoint; merge manually.')
    anchor=anchors[0][0];line_start=html.rfind('\n',0,anchor)+1
    # A same-line local tag/comment remains intact. Put our markers on their own
    # lines so stripping only this owned block is byte-idempotent on later runs.
    prefix=nl if html[line_start:anchor].strip() else ''
    if not prefix:anchor=line_start
    lines=['  <!-- '+OWNED+' start -->']+['  <link rel="stylesheet" href="./'+name+'?v='+version+'">' for name in config['styles']]+['  <script defer src="./'+name+'?v='+version+'"></script>' for name in config['scripts']]+['  <!-- '+OWNED+' end -->']
    html=html[:anchor]+prefix+nl.join(lines)+nl+html[anchor:];add(html_path,html,original)
    original=sw_path.read_bytes();sw=strip_block(sw,'js');nl='\r\n' if '\r\n' in sw else '\n'
    installs=list(re.finditer(r"^[ \t]*self\.addEventListener\(\s*['\"]install['\"]",sw,re.M))
    fetches=list(re.finditer(r"^[ \t]*self\.addEventListener\(\s*['\"]fetch['\"]",sw,re.M))
    assets=re.search(r'^[ \t]*const\s+ASSETS\s*=',sw,re.M)
    native=re.search(r'^[ \t]*const\s+NATIVE_ATLASES\s*=\s*new Set',sw,re.M)
    if len(installs)!=1 or len(fetches)!=1 or not assets or not native or assets.start()>installs[0].start() or native.start()>fetches[0].start():
        raise ValueError('SW structure differs; no changes written. Merge the explicit asset lists manually.')
    # Existing arrays, caches, VERSION, error handling and fetch policy stay intact.
    lazy='// '+OWNED+' start lazy'+nl+'for (const asset of '+json.dumps(['./'+p for p in config['lazy']])+') NATIVE_ATLASES.add(asset);'+nl+'// '+OWNED+' end lazy'+nl
    precache='// '+OWNED+' start precache'+nl+'ASSETS.push(...'+json.dumps(['./'+p for p in config['precache']])+');'+nl+'// '+OWNED+' end precache'+nl
    # Insert from the end so either listener order retains valid offsets.
    for offset,hook in sorted([(fetches[0].start(),lazy),(installs[0].start(),precache)],reverse=True):
        sw=sw[:offset]+hook+sw[offset:]
    add(sw_path,sw,original)
    if include_packager:
        p=repo/'tools/package-game.py';original=p.read_bytes();code=strip_block(original.decode(),'python');nl='\r\n' if '\r\n' in code else '\n'
        anchors=list(re.finditer(r'^with\s+zipfile\.ZipFile\(',code,re.M))
        if len(anchors)!=1 or not re.search(r'^files\s*=',code,re.M):
            raise ValueError('Offline packager differs; no changes written. Merge config.offline into its file list manually.')
        anchor=anchors[0]
        hook='# '+OWNED+' start'+nl+"files = list(dict.fromkeys(files + json.loads((Path(__file__).resolve().parent/'stage4-runtime-assets.json').read_text(encoding='utf-8'))['offline']))"+nl+'# '+OWNED+' end'+nl
        code=code[:anchor.start()]+hook+code[anchor.start():];add(p,code,original)
    return changes,version

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--repo',type=Path,default=Path('.'));parser.add_argument('--include-offline-packager',action='store_true');parser.add_argument('--check',action='store_true',help='Plan only; never write files, including --report.');parser.add_argument('--report',type=Path,help='Write JSON on apply; with --check, include it in stdout instead.')
    args=parser.parse_args();repo=args.repo.resolve();changes,version=plan(repo,args.include_offline_packager)
    report={'schemaVersion':1,'existingReleasePreserved':version,'dryRun':args.check,'files':[entry for _,_,entry in changes],'playerDataTouched':False,'deployed':False}
    if not args.check:
        for path,data,entry in changes:
            if not entry['changed']:continue
            temp=path.with_name(path.name+'.stage4.tmp');temp.write_bytes(data);temp.replace(path)
    summary={'releasePreserved':version,'changed':sum(entry['changed'] for _,_,entry in changes),'dryRun':args.check}
    if args.report:
        if args.check:summary['report']=report
        else:args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(summary))

if __name__=='__main__':main()
