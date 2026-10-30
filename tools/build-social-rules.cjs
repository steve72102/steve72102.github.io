const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
let source=fs.readFileSync(path.join(__dirname,'firestore-base.rules'),'utf8');
let fragment=fs.readFileSync(path.join(__dirname,'social-rules.fragment'),'utf8');
const blocks=[];
for(let offset=0;offset<64;offset+=8){
 const checks=Array.from({length:8},(_,j)=>{const i=offset+j;return '(keys.size() <= '+i+' || (operation(keys['+i+']) && small(n[keys['+i+']],9007199254740991) && n[keys['+i+']] >= b.get(keys['+i+'],0)))';}).join(' && ');
 blocks.push('    function cursorChanges'+offset+'(keys,b,n) { return '+checks+'; }');
}
blocks.push('    function cursorsValid(b,n,keys) { return keys is list && keys.size() <= 64 && n.keys().hasAll(b.keys()) && n.diff(b).affectedKeys().hasOnly(keys) && '+Array.from({length:8},(_,j)=>'(keys.size() <= '+j*8+' || cursorChanges'+j*8+'(keys,b,n))').join(' && ')+'; }');
fragment=blocks.join('\n')+'\n'+fragment;
source=source.replace('    match /players/{uid} {',()=>fragment+'\n    match /players/{uid} {');
source=source.replace("'updatedAt', 'coins', 'fountain']","'updatedAt', 'coins', 'fountain', 'economy']");
source=source.replace("&& r.walletBefore == before.get('coins', r.walletBefore)","&& r.walletBefore == (before.get('economy',null) == null ? before.get('coins',r.walletBefore) : sd('money',before.economy.key).coins)");
source=source.replace("&& (!d.keys().hasAny(['coins'])", "&& (d.get('economy',null) == null || projection(uid,d))\n          && (!d.keys().hasAny(['coins'])");
source=source.replace("&& (request.resource.data.get('fountain', null)","&& (resource.data.get('economy',null) == null || request.resource.data.get('economy',null) != null)\n        && (request.resource.data.get('fountain', null)");
fs.writeFileSync(path.join(root,'game/firestore.rules'),source);
console.log('Firestore rules generated:',Buffer.byteLength(source),'bytes');
