const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../game/sw.js'),'utf8');
function worker(fail=false){
 const handlers={},stored=new Map([['mind-quest-old',new Map([['old','working copy']])],['unrelated',new Map()]]),base='https://example.test/game/';let skipped=false;
 const caches={open:async name=>{if(!stored.has(name))stored.set(name,new Map());return {addAll:async reqs=>{for(const r of reqs){assert.equal(r.cache,'reload','a new release must not copy stale HTTP-cache files');if(fail)throw Error('network');stored.get(name).set(r.url,'fresh content');}},match:async request=>stored.get(name).get(typeof request==='string'?request:request.url)};},delete:async name=>stored.delete(name),keys:async()=>[...stored.keys()]};
 vm.runInNewContext(source,{Request:class extends Request{constructor(url,init){super(new URL(url,base),init);}},URL,caches,self:{addEventListener:(type,fn)=>handlers[type]=fn,skipWaiting:async()=>{skipped=true;},clients:{claim:async()=>{}},registration:{scope:base}},fetch:async()=>{}});
 return {stored,handlers,skipped:()=>skipped,run:async type=>{let task;handlers[type]({waitUntil:p=>task=p});return task;}};
}
test('release install fetches fresh files despite an older HTTP cache, then replaces only own old caches',async()=>{
 const w=worker();await w.run('install');assert.ok(w.skipped());const current=[...w.stored.keys()].find(k=>k.startsWith('mind-quest-v3'));assert.ok(w.stored.get(current).has('https://example.test/game/academy-ui.js'));assert.ok(w.stored.get(current).has('https://example.test/game/assets/academy/mortar.webp'));await w.run('activate');assert.equal(w.stored.has('mind-quest-old'),false);assert.ok(w.stored.has('unrelated'));
});
test('failed release download removes partial cache and keeps the prior working offline copy',async()=>{
 const w=worker(true);await assert.rejects(w.run('install'),/network/);assert.equal(w.skipped(),false);assert.deepEqual([...w.stored.keys()],['mind-quest-old','unrelated']);assert.equal(w.stored.get('mind-quest-old').get('old'),'working copy');
});

test('a question deep link uses the precached lesson page while offline',async()=>{
 const w=worker();await w.run('install');let response;
 w.handlers.fetch({request:new Request('https://example.test/game/learn.html?q=pharmacology-115-2-65'),respondWith:p=>response=p});
 assert.equal(await response,'fresh content');
});
