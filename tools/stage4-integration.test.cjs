'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),script=path.join(__dirname,'integrate-stage4-art.py');
const targets=['game/index.html','game/sw.js','tools/package-game.py'];
function fixture(){
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'stage4-integration-'));
  const config=JSON.parse(fs.readFileSync(path.join(__dirname,'stage4-runtime-assets.json')));
  for(const f of ['tools/stage4-runtime-assets.json',...targets]){fs.mkdirSync(path.dirname(path.join(repo,f)),{recursive:true});fs.copyFileSync(path.join(root,f),path.join(repo,f));}
  for(const f of new Set(['precache','lazy','offline','scripts','styles'].flatMap(k=>config[k]))){const p=path.join(repo,'game',f);fs.mkdirSync(path.dirname(p),{recursive:true});if(!fs.existsSync(p))fs.writeFileSync(p,'local asset fixture');}
  return {repo,config,cleanup:()=>fs.rmSync(repo,{recursive:true,force:true})};
}
function run(repo,...args){return spawnSync(process.env.PYTHON||(process.platform==='win32'?'python':'python3'),[script,'--repo',repo,'--include-offline-packager',...args],{encoding:'utf8'});}
function snapshot(repo){return targets.map(f=>fs.readFileSync(path.join(repo,f),'utf8'));}
function mutate(repo,file,edit){const p=path.join(repo,file);fs.writeFileSync(p,edit(fs.readFileSync(p,'utf8')));}
function treeSnapshot(repo){
  const entries=[];
  function visit(directory){
    for(const name of fs.readdirSync(directory).sort()){
      const p=path.join(directory,name),stat=fs.lstatSync(p,{bigint:true}),relative=path.relative(repo,p);
      if(stat.isDirectory()){entries.push([relative,'directory',String(stat.mtimeNs)]);visit(p);}
      else entries.push([relative,String(stat.mtimeNs),fs.readFileSync(p).toString('base64')]);
    }
  }
  visit(repo);return entries;
}
test('additive integration preserves a newer Codex cache version and offline packager modifications, then is byte-idempotent',()=>{
  const f=fixture();try{
    mutate(f.repo,'game/sw.js',s=>s.replace(/(const VERSION\s*=\s*')[^']+/,"$1codex-local-release-42")+'\n// Codex local cache guard kept\n');
    mutate(f.repo,'tools/package-game.py',s=>s+'\n# Codex local offline split checksum fix kept\n');
    mutate(f.repo,'game/index.html',s=>s.replace('</head>','<!-- Codex local navigation edit kept -->\n</head>'));
    const r=run(f.repo);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).releasePreserved,'codex-local-release-42');
    const first=snapshot(f.repo);assert(first[0].includes('Codex local navigation edit kept'));assert(first[1].includes('Codex local cache guard kept'));assert(first[2].includes('Codex local offline split checksum fix kept'));
    for(const file of [...f.config.scripts,...f.config.styles])assert(first[0].includes('./'+file+'?v=codex-local-release-42'));
    const again=run(f.repo);assert.equal(again.status,0,again.stderr);assert.equal(JSON.parse(again.stdout).changed,0);assert.deepEqual(snapshot(f.repo),first);
    const dry=run(f.repo,'--check');assert.equal(dry.status,0,dry.stderr);assert.deepEqual(snapshot(f.repo),first);
  }finally{f.cleanup();}
});
test('an unfamiliar offline packager aborts the whole plan before changing HTML or SW',()=>{
  const f=fixture();try{
    mutate(f.repo,'tools/package-game.py',s=>s.replace(/^with zipfile\.ZipFile\(/m,'with other_zip_writer('));
    const before=snapshot(f.repo),r=run(f.repo);assert.notEqual(r.status,0);assert.match(r.stderr,/Offline packager differs/);assert.deepEqual(snapshot(f.repo),before);
  }finally{f.cleanup();}
});
test('missing and escaping runtime assets abort without modifying cache or entry files',()=>{
  for(const bad of ['missing-stage4-file.webp','../outside.webp']){
    const f=fixture();try{f.config.precache.push(bad);fs.writeFileSync(path.join(f.repo,'tools/stage4-runtime-assets.json'),JSON.stringify(f.config));const before=snapshot(f.repo),r=run(f.repo);assert.notEqual(r.status,0);assert.match(r.stderr,/Missing or unsafe local asset/);assert.deepEqual(snapshot(f.repo),before);}finally{f.cleanup();}
  }
});
test('a local asset symlink escaping game is rejected before any write',t=>{
  const f=fixture();try{fs.writeFileSync(path.join(f.repo,'outside.webp'),'fixture');try{fs.symlinkSync('../outside.webp',path.join(f.repo,'game','outside-link.webp'));}catch(error){if(process.platform==='win32'&&error.code==='EPERM'){t.skip('Windows account cannot create file symlinks; rejection remains untested');return;}throw error;}f.config.precache.push('outside-link.webp');fs.writeFileSync(path.join(f.repo,'tools/stage4-runtime-assets.json'),JSON.stringify(f.config));const before=snapshot(f.repo),r=run(f.repo);assert.notEqual(r.status,0);assert.deepEqual(snapshot(f.repo),before);}finally{f.cleanup();}
});
test('adopting complete asset tags preserves same-line scripts, styles, comments and script literals',()=>{
  const f=fixture();try{
    const scriptName=f.config.scripts[0],styleName=f.config.styles[0];
    const before='<script defer src="./codex-before.js"></script><!-- Codex 同列前 -->';
    const after='<script defer src="./codex-after.js"></script><!-- Codex 同列後 -->';
    const comment='<!-- Example only: <script src="./'+scriptName+'?v=comment"></script> -->';
    const literal='<script>const sample = \'<link href="./'+styleName+'?v=literal">\';</script>';
    const shared=before+'<script data-label="x > y"\n defer src="./'+scriptName+'?v=old"></script>'+after;
    const style="<link rel='stylesheet' href='./"+styleName+"?v=old'><meta name='codex-local' content='kept'><!-- style suffix -->";
    mutate(f.repo,'game/index.html',s=>s.replace(/^[ \t]*(<script defer src="\.\/cast-outfit\.js[^\r\n]*)/m,
      shared+'\n'+style+'\n'+comment+'\n'+literal+'\n<!-- same-line anchor prefix -->$1'));
    const result=run(f.repo);assert.equal(result.status,0,result.stderr);
    const html=snapshot(f.repo)[0];
    assert(html.includes(before+after),'only the exact adopted script tag should disappear');
    assert(html.includes("<meta name='codex-local' content='kept'><!-- style suffix -->"));
    assert(html.includes(comment));assert(html.includes(literal));assert(html.includes('<!-- same-line anchor prefix -->'));
    const initial=treeSnapshot(f.repo),again=run(f.repo);assert.equal(again.status,0,again.stderr);assert.equal(JSON.parse(again.stdout).changed,0);assert.deepEqual(treeSnapshot(f.repo),initial);
  }finally{f.cleanup();}
});
test('a fetch listener before install keeps valid JavaScript and both asset collections',()=>{
  const f=fixture();try{
    const sw="'use strict';\nconst VERSION = 'codex-fetch-first-77';\nconst ASSETS = ['./codex-base.js'];\nconst NATIVE_ATLASES = new Set(['./codex-native.webp']);\n// Codex fetch policy kept\nself.addEventListener('fetch', event => event);\n// Codex install policy kept\nself.addEventListener('install', event => event);\n";
    fs.writeFileSync(path.join(f.repo,'game/sw.js'),sw);
    const result=run(f.repo);assert.equal(result.status,0,result.stderr);
    const output=snapshot(f.repo)[1],events=[];
    const state=vm.runInNewContext(output+'\n({version:VERSION,assets:ASSETS,lazy:[...NATIVE_ATLASES]});',{self:{addEventListener:(name,handler)=>{assert.equal(typeof handler,'function');events.push(name);}}});
    assert.equal(state.version,'codex-fetch-first-77');assert.deepEqual(events,['fetch','install']);
    assert.deepEqual(Array.from(state.assets),['./codex-base.js',...f.config.precache.map(p=>'./'+p)]);
    assert.deepEqual(Array.from(state.lazy),['./codex-native.webp',...f.config.lazy.map(p=>'./'+p)]);
    assert(output.includes('// Codex fetch policy kept'));assert(output.includes('// Codex install policy kept'));
    const initial=treeSnapshot(f.repo),again=run(f.repo);assert.equal(again.status,0,again.stderr);assert.equal(JSON.parse(again.stdout).changed,0);assert.deepEqual(treeSnapshot(f.repo),initial);
  }finally{f.cleanup();}
});
test('unknown or ambiguous entrypoint anchors reject every managed write, including a requested report',()=>{
  const cases=[
    ['game/index.html',s=>s.replace('./cast-outfit.js','./codex-other-entry.js'),/cast-outfit entrypoint/],
    ['game/index.html',s=>s.replace('</head>','<script src="./cast-outfit.js?v=second"></script>\n</head>'),/cast-outfit entrypoint/],
    ['game/sw.js',s=>s.replace("self.addEventListener('fetch'","self.addEventListener('codex-fetch'"),/SW structure differs/],
    ['game/sw.js',s=>s+"\nself.addEventListener('install', event => event);\n",/SW structure differs/],
    ['tools/package-game.py',s=>s.replace(/^with zipfile\.ZipFile\(/m,'with codex_zip_writer('),/Offline packager differs/],
  ];
  for(const [file,edit,error] of cases){
    const f=fixture();try{
      mutate(f.repo,file,edit);const before=treeSnapshot(f.repo),report=path.join(f.repo,'new-report-dir','result.json');
      const result=run(f.repo,'--report',report);assert.notEqual(result.status,0,file);assert.match(result.stderr,error);assert.deepEqual(treeSnapshot(f.repo),before,file);
    }finally{f.cleanup();}
  }
});
test('ambiguous asset script content is rejected instead of deleting local code',()=>{
  const f=fixture();try{
    mutate(f.repo,'game/index.html',s=>s.replace('</head>','<script src="./'+f.config.scripts[0]+'?v=local">window.codexLocal = true;</script>\n</head>'));
    const before=treeSnapshot(f.repo),result=run(f.repo);assert.notEqual(result.status,0);assert.match(result.stderr,/Ambiguous HTML asset script body/);assert.deepEqual(treeSnapshot(f.repo),before);
  }finally{f.cleanup();}
});
test('--check plans an unapplied integration without any file or directory writes, even with --report',()=>{
  const f=fixture();try{
    mutate(f.repo,'game/index.html',s=>s.replace(/^[ \t]*<!-- pharmacy-stage4-art start -->\r?\n[\s\S]*?^[ \t]*<!-- pharmacy-stage4-art end -->\r?\n/gm,''));
    mutate(f.repo,'game/sw.js',s=>s.replace(/\/\/ pharmacy-stage4-art start [^\r\n]+\r?\n[\s\S]*?\/\/ pharmacy-stage4-art end [^\r\n]+\r?\n/g,''));
    mutate(f.repo,'tools/package-game.py',s=>s.replace(/# pharmacy-stage4-art start\r?\n[\s\S]*?# pharmacy-stage4-art end\r?\n/g,''));
    const before=treeSnapshot(f.repo),report=path.join(f.repo,'not-created','check.json'),result=run(f.repo,'--check','--report',report);
    assert.equal(result.status,0,result.stderr);const summary=JSON.parse(result.stdout);assert.equal(summary.dryRun,true);assert.equal(summary.changed,3);assert.equal(summary.report.files.length,3);assert.equal(summary.report.dryRun,true);assert.deepEqual(treeSnapshot(f.repo),before);assert.equal(fs.existsSync(report),false);
    const applied=run(f.repo);assert.equal(applied.status,0,applied.stderr);const initial=treeSnapshot(f.repo);
    const again=run(f.repo);assert.equal(again.status,0,again.stderr);assert.equal(JSON.parse(again.stdout).changed,0);assert.deepEqual(treeSnapshot(f.repo),initial,'idempotent apply must not replace unchanged files');
  }finally{f.cleanup();}
});
