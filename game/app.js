(() => {
  'use strict';
  const E = window.MindEngine, C = window.MindCombat, A = window.MindAcademy, J = window.MindJourney, R = window.MindAdventure, bank = window.MIND_BANK;
  const view = document.getElementById('view');
  if (!E || !C || !A || !window.MindAcademyUI || !window.MindLesson || !window.MindBattleUI || !bank?.questions?.length) { view.textContent = '題庫尚未載入，請重新整理。離線版請先完整解壓縮整個資料夾。'; return; }
  const questions = bank.questions, byId = new Map(questions.map(q => [q.id, q]));
  const KEY = 'mind-quest-save-v3';
  function freshSave(){const s=Object.assign(E.fresh(),{arena:C.fresh(),appearance:A.fresh(),profile:J.profile(),rpg:R.fresh(),wishes:window.MindWish.fresh()});s.companion=J.companion(undefined,s);return s;}
  let state = freshSave(), page = 'home', subjectYear = 'all', calculations = false, selected = null, blockedSave = false, originalSave = null, toastTimer, cloud;
  const $ = id => document.getElementById(id);
  function node(tag, attrs = {}, ...children) {
    const n = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue;
      if (key.startsWith('on')) n.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'class') n.className = value;
      else if (key === 'text') n.textContent = value;
      else if (key === 'checked' || key === 'disabled') n[key] = value;
      else n.setAttribute(key, value);
    }
    children.flat(Infinity).filter(c => c !== null && c !== undefined && c !== false).forEach(c => n.append(c instanceof Node ? c : document.createTextNode(String(c))));
    return n;
  }
  const btn = (text, onClick, cls = '', disabled = false) => node('button', { class: 'button ' + cls, onClick, disabled, type: 'button' }, text);
  const note = text => node('p', { class: 'note' }, text);
  const symbol = item => node('div', { class: 'item-symbol', 'aria-hidden': 'true' }, ['◈', '✧', '❋'][Object.keys(E.SUBJECTS).indexOf(item.subject)]);
  function random() { if (window.crypto?.getRandomValues) { const x = new Uint32Array(1); crypto.getRandomValues(x); return x[0] / 4294967296; } return Math.random(); }
  function warn(message) { $('storage-warning').textContent = message; $('storage-warning').hidden = false; }
  function restoreSave(raw) { const restored = E.restore(raw, questions); restored.arena = C.restore(raw.arena, questions); restored.appearance = A.restore(raw.appearance); restored.profile=J.profile(raw.profile);restored.companion=J.companion(raw.companion,restored);restored.rpg=R.restore(raw.rpg);restored.wishes=window.MindWish.restore(raw.wishes);const held=restored.rpg.loadout.handheld;if(held&&restored.equipped!==held&&(restored.equipped||E.ITEMS.some(i=>i.id===held)))throw Error('手持物與知識裝備存檔不一致。');if(held&&E.ITEMS.some(i=>i.id===held)&&!restored.inventory[held])throw Error('手持知識裝備未持有。');if(!held&&restored.equipped)restored.rpg.loadout.handheld=restored.equipped;for(const id of Object.values(restored.rpg.loadout)){const g=R.gear(id);if(g?.level&&Math.floor(restored.xp/100)+1<g.level)throw Error('裝備等級高於角色等級。');}for(const [id,stage] of Object.entries(restored.rpg.training))if(Math.floor(restored.xp/100)+1<(R.gear(id)?.level||1)+(stage-1)*10)throw Error('研習等級高於角色等級。');return restored; }
  try {
    originalSave = localStorage.getItem(KEY) || localStorage.getItem('mind-quest-save-v2') || localStorage.getItem('mind-quest-save-v1');
    if (originalSave) state = restoreSave(JSON.parse(originalSave));
  } catch (_) {
    if (originalSave) { blockedSave = true; warn('原有存檔無法讀取，已保留原始資料。請到「存檔與說明」下載救援備份或匯入有效備份；目前進度暫存在本頁。'); }
    else warn('瀏覽器目前無法保存進度。離開前請到「存檔與說明」匯出備份。');
  }
  E.rollDay(state, E.today());
  function save() {
    if(state.equipped)state.rpg.loadout.handheld=state.equipped;
    else if(E.ITEMS.some(i=>i.id===state.rpg.loadout.handheld))state.rpg.loadout.handheld=null;
    R.recordBattle(state);
    if (blockedSave) return;
    try { if(cloud)cloud.localSave();else localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (_) { warn('進度無法寫入瀏覽器。請匯出備份，避免關閉頁面後遺失進度。'); }
  }
  function toast(text) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4200); }
  function header() {
    $('profile-avatar').replaceChildren(academyUI.portrait(state.appearance, 'sidebar')); $('profile-name').textContent = state.profile.name || '尚未命名的旅人';
    if(cloud)$('account-status').textContent=cloud.snapshot().message;
    $('tickets').textContent = state.tickets; $('coins').textContent = state.arena.coins;
    $('level').textContent = `Lv. ${Math.floor(state.xp / 100) + 1} · ${state.xp < 500 ? '見習探索者' : state.xp < 2000 ? '知識守望者' : '星光學者'}`;
    $('xp-bar').value = state.xp % 100;
    $('xp-label').textContent = `${state.xp % 100} / 100 XP · 總經驗 ${state.xp}`;
    $('wrong-badge').textContent = state.wrong.length;
    document.querySelectorAll('[data-page]').forEach(b => { const active = b.dataset.page === (page === 'battle' ? 'arena' : page); b.classList.toggle('active', active); if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }
  function go(nextPage, focus = true) { if(nextPage!=='duel'&&duelUI.active()){toast('你正在雙人連線中，請先在對戰頁取消或離開連線。');return;} if(nextPage!=='home')academyUI.leave(nextPage==='account'); page = nextPage; selected = null; render(); if (focus) { $('main').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); } }
  function title(text, kicker) { $('page-title').textContent = text; $('page-kicker').textContent = kicker; }
  function openModal(...children) { $('modal-content').replaceChildren(...children.filter(c=>c!==null&&c!==undefined&&c!==false)); if (!$('modal').open) $('modal').showModal(); }
  function closeModal() { $('modal').close(); }
  function knowledgeFor(item) {
    const pool = questions.filter(q => !q.needsReview && q.subject === item.subject);
    const terms = item.subject === 'pharmaceutics' ? ['溶離', '擴散', '半衰期', '生體可用率'] : item.subject === 'pharmacology' ? ['受體', '訊息', '標靶', '作用機轉'] : ['生藥', '鑑別', '分析', '成分'];
    return pool.find(q => (q.title + q.explanation).includes(terms[item.tier])) || pool[item.tier];
  }
  function lore(item, claimAction = false) {
    const q = knowledgeFor(item), tier = E.TIERS[item.tier];
    openModal(symbol(item), node('p', { class: 'eyebrow' }, `${tier.name}裝備 · ${E.SUBJECTS[item.subject].name}`), node('h2', {}, item.name), node('h3', {}, q.title), window.MindLesson.render(q, node, {question:true}), node('p', { class: 'source' }, q.source + ` · 第 ${q.number} 題`), note(`裝備效果：此科每題首次答對 +${tier.bonus} XP。戰鬥攻擊 +${C.GEAR_ATTACK[item.tier]}、生命 +${C.GEAR_HP[item.tier]}，同科再 +6 攻擊。重複裝備保留收藏次數。`), node('div', { class: 'modal-actions' }, claimAction ? btn('讀過知識，領取裝備', () => { const full=state.claimed!==E.today()&&!E.bagRoom(state), got = E.claim(state), coins = C.claimCoins(state.arena); closeModal(); save(); render(); toast((got ? '獲得 ' + got.name + '！' : full?'背包滿了，今日裝備待整理後再領。':'今日知識已收下。') + (coins ? '今日補給已結算（基礎 80 金幣）。' : '今日金幣已領取。')); }) : btn('挑戰這張知識卡', () => { closeModal(); start([q], item.name + ' · 知識試煉'); }), !claimAction && state.inventory[item.id] ? btn(state.equipped === item.id ? '已裝備' : '裝備它', () => { state.equipped = item.id; save(); closeModal(); render(); toast('已裝備 ' + item.name); }, 'secondary', state.equipped === item.id) : null));
  }
  function todayItem() { const day = E.today(); return E.ITEMS.filter(i => i.tier === 0)[Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000) % 3]; }
  function sectionHeading(text, description) { return node('div', { class: 'section-title' }, node('h2', {}, text), node('p', {}, description)); }
  function start(pool, label) {
    pool = pool.filter(q => !q.needsReview);
    if (!pool.length) { toast('這個篩選沒有可用題目，請試試其他年份。'); return; }
    if (state.session && state.session.index < state.session.ids.length) {
      openModal(node('h2', {}, '還有一場進行中的冒險'), note('可以繼續原本的題目，或結束這次關卡後開新一場。已獲得的獎勵與錯題都會保留。'), node('div', { class: 'modal-actions' }, btn('繼續原關卡', () => { closeModal(); go('quiz'); }), btn('開始新關卡', () => { E.begin(state, pool, label, random); save(); closeModal(); go('quiz'); }, 'secondary')));
      return;
    }
    E.begin(state, pool, label, random); save(); go('quiz');
  }
  function home() { return academyUI.home(); }
  function practice() {
    title('今天，也前進一點。', 'YOUR LITTLE ADVENTURE');
    const item = todayItem(), claimed = state.claimed === E.today() && state.arena.login === E.today();
    const hero = node('section', { class: 'hero-card' }, node('div', { class: 'hero-copy' }, node('span', { class: 'pill' }, '✦ 每一份好奇，都算數'), node('h2', {}, '把知識收進行囊，', node('br'), '展開你的冒險。'), node('p', {}, '一次 5 題，一點新的理解。', node('br'), '從你的思維筆記，走向三座知識秘境。'), btn(state.session && state.session.index < state.session.ids.length ? '繼續冒險 →' : '開始今日冒險 →', () => state.session && state.session.index < state.session.ids.length ? go('quiz') : start(questions, '今日綜合冒險'))), node('div', { class: 'world-art', 'aria-hidden': 'true' }, node('div', { class: 'orbital' }), node('span', { class: 'spark a' }, '✦'), node('span', { class: 'spark b' }, '✧'), node('span', { class: 'spark c' }, '✺'), node('div', { class: 'book' }, node('div', { class: 'book-leaf' }, '❋'), node('div', { class: 'book-leaf' }, '✧')), node('span', { class: 'world-caption' }, 'A WORLD BUILT FROM YOUR MIND')));
    const daily = node('section', { class: 'panel daily' }, symbol(item), node('div', {}, node('p', { class: 'eyebrow' }, 'DAILY DISCOVERY'), node('h3', {}, claimed ? '今日知識，已收入行囊' : '今日補給 · ' + item.name), node('p', {}, '讀一張知識卡，領裝備與 80 金幣。')), btn(claimed ? '查看知識' : '領取補給 ↗', () => lore(item, !claimed), 'small secondary'));
    const track = node('section', { class: 'panel' }, node('div', { class: 'ticket-track' }, node('h3', {}, '下一張星願券'), node('strong', {}, `${state.progress} / 5`)), node('p', {}, '答對不同題目，讓好奇心成為抽獎機會。'), node('div', { class: 'steps', role: 'img', 'aria-label': `累積 ${state.progress} 題，共需 5 題` }, Array.from({ length: 5 }, (_, i) => node('span', { class: 'step' + (i < state.progress ? ' done' : '') }))));
    const year = node('select', { id: 'exam-year', onChange: e => { subjectYear = e.target.value; render(); } }, node('option', { value: 'all' }, '所有年份'), [...new Set(questions.map(q => q.exam))].sort().reverse().map(v => node('option', { value: v }, v)));
    year.value = subjectYear;
    const filter = node('div', { class: 'filters' }, node('label', { for: 'exam-year' }, '試題年份'), year, node('label', {}, node('input', { type: 'checkbox', checked: calculations, onChange: e => { calculations = e.target.checked; render(); } }), '計算相關題'));
    const realms = node('div', { class: 'realm-grid' }, Object.entries(E.SUBJECTS).map(([key, s], i) => {
      const pool = questions.filter(q => !q.needsReview && q.subject === key && (subjectYear === 'all' || q.exam === subjectYear) && (!calculations || q.calculation));
      return node('article', { class: 'realm ' + s.color }, node('div', { class: 'realm-top' }, node('span', { class: 'realm-icon', 'aria-hidden': 'true' }, s.icon), node('span', { class: 'realm-number' }, '0' + (i + 1))), node('p', { class: 'eyebrow' }, s.name), node('h3', {}, s.realm), node('p', {}, `${pool.length.toLocaleString()} 題知識碎片 · 每次最多 5 題`), btn('進入秘境 →', () => start(pool, s.name + (subjectYear === 'all' ? '' : ' · ' + subjectYear)), '', !pool.length));
    }));
    return [hero, node('section', { class: 'panel' }, node('h3', {}, '有個概念還沒讀懂？'), node('p', {}, '用藥名或關鍵字查完整題目、逐步詳解與小圖，不影響遊戲進度。'), node('a', { class: 'button secondary', href: './learn.html', target: '_blank', rel: 'noopener' }, '查閱題目與詳解 ↗')), combatUI.banner(), node('div', { class: 'two-col' }, daily, track), sectionHeading('選一座秘境，開始探索', '三門學科 / 同一段成長旅程'), filter, realms, node('div', { class: 'mini-stats' }, node('span', {}, node('strong', {}, state.mastered.length), '題曾答對'), node('span', {}, node('strong', {}, state.wrong.length), '題等待複習'), node('span', {}, node('strong', {}, questions.length.toLocaleString()), '題附筆記解析'))];
  }
  function quiz() {
    const run = state.session;
    if (!run) { page = 'home'; return home(); }
    if (run.index >= run.ids.length) return summary();
    title('每個答案，都是一步。', 'KNOWLEDGE EXPEDITION');
    const q = byId.get(run.ids[run.index]), answered = run.answers[run.index];
    const panel = node('section', { class: 'panel question-panel' });
    panel.append(node('div', { class: 'question-top' }, node('span', {}, run.label), node('strong', {}, `${run.index + 1} / ${run.ids.length}`)), node('progress', { max: run.ids.length, value: run.index, 'aria-label': '關卡進度' }), node('div', { class: 'mini-stats' }, node('span', {}, E.SUBJECTS[q.subject].name), node('span', {}, q.exam + ' · 第 ' + q.number + ' 題')), node('h2', { class: 'question-text' }, q.question));
    const answers = node('div', { class: 'answers', role: 'group', 'aria-label': '作答選項' });
    q.options.forEach((option, i) => answers.append(node('button', { class: 'answer' + (!answered && selected === i ? ' selected' : '') + (answered && i === q.answer ? ' correct' : '') + (answered && i === answered.choice && !answered.correct ? ' incorrect' : ''), disabled: !!answered, 'aria-pressed': String((answered ? answered.choice : selected) === i), onClick: () => { selected = i; render(); view.querySelectorAll('.answer')[i].focus({ preventScroll: true }); } }, node('span', { class: 'answer-letter' }, String.fromCharCode(65 + i)), node('span', {}, option, answered && i === q.answer ? ' ✓ 正確答案' : answered && i === answered.choice ? ' ✕ 你的選擇' : ''))));
    panel.append(answers);
    if (answered) {
      const rewardText = answered.correct ? answered.repeated ? '今天這題已領過獎勵，理解再加深一點。' : `+${answered.xp} XP` + (answered.ticket ? ' · 獲得 1 張星願券！' : ` · 星願進度 ${state.progress}/5`) : '已加入錯題修練，讀懂原因就有收穫。';
      panel.append(node('section', { class: 'feedback' + (answered.correct ? '' : ' wrong'), 'aria-live': 'polite' }, node('h3', {}, answered.correct ? '✦ 答對了！' : '再想一次，也是一種前進。'), node('p', { class: 'note' }, rewardText), node('h3', {}, q.title), window.MindLesson.render(q, node), node('small', {}, q.source + ` · 第 ${q.number} 題`)));
    }
    panel.append(node('div', { class: 'question-actions' }, btn('返回學院', () => go('home'), 'secondary'), answered ? btn(run.index + 1 === run.ids.length ? '完成這次冒險 →' : '下一題 →', () => { E.next(state); selected = null; save(); render(); $('main').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }) : btn('確認答案', () => { if (selected === null) return; const result=E.answer(state, q, selected);if(result)R.earnNote(state,q.id,result.correct); save(); render(); const feedback = view.querySelector('.feedback'); if (feedback) feedback.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }, '', selected === null)));
    panel.append(note('每題每天只會發放一次答對獎勵；讀完解析再繼續，錯題可隨時重練。'));
    return [panel];
  }
  function summary() {
    title('知識，已成為你的裝備。', 'EXPEDITION COMPLETE');
    const run = state.session, correct = run.answers.filter(a => a.correct).length;
    return [node('section', { class: 'panel summary' }, node('div', { class: 'result-icon', 'aria-hidden': 'true' }, '✦'), node('p', { class: 'eyebrow' }, 'ONE SMALL STEP, WELL TAKEN'), node('h2', {}, correct === run.ids.length ? '這一段旅程，收穫滿滿。' : '每一次理解，都值得慶祝。'), note('答對的題目累積實力，錯題也會成為下一段冒險的方向。'), node('div', { class: 'summary-stats' }, [['答對題數', `${correct}/${run.ids.length}`], ['獲得經驗', '+' + run.answers.reduce((n, a) => n + a.xp, 0)], ['獲得星願券', '+' + run.answers.reduce((n, a) => n + a.ticket, 0)]].map(([label, value]) => node('div', {}, node('strong', {}, value), node('small', {}, label)))), btn('回到學院', () => go('home')), btn('複習錯題', () => go('review'), 'secondary'), state.tickets ? btn('去開寶箱 ✧', () => go('draw'), 'gold') : null)];
  }
  function review() {
    title('再遇見，就更懂一點。', 'THE PRACTICE GARDEN');
    const pool = state.wrong.map(id => byId.get(id)).filter(q => !q.needsReview);
    if (!pool.length) return [node('section', { class: 'empty' }, node('span', { class: 'empty-icon', 'aria-hidden': 'true' }, '◎'), node('h2', {}, '錯題花園，正在等你探索'), node('p', {}, '答錯的題目會留在這裡。重新答對後，就能帶著理解離開。'), btn('開始探索', () => go('home')))];
    return [node('section', { class: 'panel' }, node('h3', {}, `${pool.length} 道題目，值得再想一次`), note('答對後會自動移出錯題清單。每天首次答對同一題，仍可獲得經驗與星願進度。'), btn('開始錯題修練 →', () => start(pool, '錯題修練'))), sectionHeading('從一個疑問開始', '點選題目可單獨練習'), node('div', { class: 'review-list' }, pool.slice(0, 40).map(q => node('button', { class: 'review-card', onClick: () => start([q], '單題修練') }, node('small', {}, E.SUBJECTS[q.subject].name + ' · ' + q.exam), node('p', {}, q.question)))), pool.length > 40 ? note('先列出前 40 題；開始錯題修練時會從完整清單抽題。') : null];
  }
  function inventory() {
    title('把理解，穿戴在身上。', 'YOUR KNOWLEDGE COLLECTION');
    return [node('div', { class: 'notice' }, '每件裝備都有一張知識卡。可穿戴 1 件裝備，提升答題經驗、戰鬥攻擊與生命；未收集的卡片也能先閱讀、練習。對戰中的裝備數值以開戰時為準。'), node('div', { class: 'inventory-grid' }, E.ITEMS.map(item => {
      const tier = E.TIERS[item.tier], owned = state.inventory[item.id] || 0, equipped = state.equipped === item.id;
      return node('article', { class: 'equipment ' + tier.label + (owned ? '' : ' locked') }, node('span', { class: 'rarity' }, tier.name + (owned ? ` ×${owned}` : ' · 尚未收集')), symbol(item), node('h3', {}, item.name), node('p', {}, `${E.SUBJECTS[item.subject].name}答對 +${tier.bonus} XP；戰鬥攻擊 +${C.GEAR_ATTACK[item.tier]}、生命 +${C.GEAR_HP[item.tier]}、減傷 ${C.GEAR_GUARD[item.tier]}。同科再加 6 攻擊。`), btn('知識卡 ↗', () => lore(item), 'small secondary'), owned ? btn(equipped ? '已裝備 ✓' : '裝備', () => { state.equipped = item.id; save(); render(); toast('已裝備 ' + item.name); }, 'small', equipped) : null);
    }))];
  }
  function draw() {
    title('讓好奇，開出驚喜。', 'THE WISHING CHEST');
    const stage = node('section', { class: 'panel draw-stage' }, node('p', { class: 'eyebrow' }, 'EARNED BY LEARNING'), node('div', { class: 'chest', 'aria-hidden': 'true' }, '◈'), node('h2', {}, '星願寶箱'), node('p', {}, '每一張星願券，都來自你的理解。'), btn('消耗 1 張星願券 · 開啟寶箱', () => {
      const result = E.draw(state, random);
      if (!result) { toast(!E.bagRoom(state)?'背包已滿，請先到背包整理 1 格；星願券尚未扣除。':'先答對 5 道不同題目，就能獲得星願券。'); return; }
      save(); render();
      const item = result.item;
      openModal(node('p', { class: 'eyebrow' }, result.guaranteed ? '保底星光，降臨！' : 'A NEW DISCOVERY'), symbol(item), node('h2', {}, E.TIERS[item.tier].name + ' · ' + item.name), note(result.duplicate ? `再次遇見這件裝備，收藏數量 +1，額外獲得 ${result.bonus} XP。` : '新裝備已收入圖鑑。打開知識卡，讓這次收穫多一點意義。'), note(`對應學科答對 +${E.TIERS[item.tier].bonus} XP；需先穿戴。`), btn('閱讀知識並裝備 →', () => lore(item)));
    }, 'gold', state.tickets < 1), note(`目前持有 ${state.tickets} 張星願券`));
    const details = node('section', { class: 'panel' }, node('h3', {}, '每一份機率，清清楚楚'), node('table', { class: 'odds', 'aria-label': '裝備抽獎機率' }, node('tbody', {}, E.TIERS.map(t => node('tr', {}, node('td', {}, t.name), node('td', {}, t.chance + '%'))))), node('div', { class: 'pity' }, `極品保底進度 ${state.pity} / 30`, node('br'), `最多再 ${30 - state.pity} 抽，必得極品裝備。`), note('連續 29 抽沒有極品，第 30 抽必得。提早獲得極品會重置進度；同稀有度的 3 件裝備等機率。'), note('重複裝備額外轉為經驗：普通 10、稀有 20、史詩 40、極品 80 XP。'), note('只有遊戲內獎勵，沒有付費、廣告或現金交易。星願券不會過期。'));
    return [node('div', { class: 'draw-layout' }, stage, details)];
  }
  function download(content, filename, type = 'application/json') { const url = URL.createObjectURL(new Blob([content], { type })); const a = node('a', { href: url, download: filename }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function exportSave() { download(JSON.stringify(state, null, 2), '思維冒險-存檔-' + E.today() + '.json'); toast('存檔已匯出，請妥善保管下載檔案。'); }
  async function importSave(file) {
    if (!file) return;
    if (file.size > 2000000 || !file.name.toLowerCase().endsWith('.json')) { toast('請選擇小於 2 MB 的 JSON 遊戲存檔。'); return; }
    try {
      const parsed = JSON.parse(await file.text(), (key, value) => { if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('存檔包含不支援的欄位。'); return value; });
      const imported = restoreSave(parsed);
      openModal(node('h2', {}, '匯入這份旅程？'), note(`備份進度：Lv. ${Math.floor(imported.xp / 100) + 1}、${imported.tickets} 張星願券、${imported.mastered.length} 道曾答對題目、${imported.arena.coins} 金幣、${imported.arena.supplies} 張補給券。匯入將取代目前旅程，Google 登入時也會同步到此帳號。`), node('div', { class: 'modal-actions' }, btn('先備份目前存檔', exportSave, 'secondary'), btn('確認匯入', () => { state = imported; E.rollDay(state, E.today()); blockedSave = false; $('storage-warning').hidden = true; save(); closeModal(); go('home'); toast('旅程已還原，歡迎回來。'); })));
    } catch (error) { toast('匯入失敗：' + (error instanceof SyntaxError ? '不是有效的 JSON 存檔。' : error.message)); }
  }
  function settings() {
    title('好好保存，你的每一步。', 'YOUR JOURNEY, YOUR DATA');
    const input = node('input', { type: 'file', accept: '.json,application/json', class: 'file-input', onChange: e => { importSave(e.target.files[0]); e.target.value = ''; } });
    return [node('div', { class: 'settings-grid' },
      node('section', { class: 'panel' }, node('h3', {}, '存檔跟著你走'), note('Google 玩家會自動保存到帳號專屬雲端空間；會依最近修改時間自動接續最新版本，替換前保留一份救援備份。請確認「雲端已保存」後再換裝置，並讓裝置日期時間保持自動設定。離線或訪客進度先存在此瀏覽器，清除瀏覽資料前務必匯出備份。網站版與離線版可用備份轉移。'), btn('匯出遊戲存檔 ↓', exportSave), cloud?.recovery()?btn('下載先前版本救援備份',()=>download(cloud.recovery(),'mind-quest-previous-save.json'),'secondary'):null, node('label', { class: 'button secondary file-label' }, '匯入備份', input), blockedSave ? btn('下載原始存檔救援檔', () => download(originalSave, 'mind-quest-recovery.json'), 'secondary') : null),
      node('section', { class: 'panel' }, node('h3', {}, '不用訂閱，也能繼續玩'), note('所有題目、解析與遊戲規則都已放在網頁檔案裡，沒有呼叫 ChatGPT 或付費 API。單人模式可離線；雙人模式需網路與連線服務，不需 ChatGPT 訂閱。也建議下載完整離線版備份。'), location.protocol === 'file:' ? note('你正在使用獨立離線版。記得定期備份存檔。') : node('a', { class: 'button gold', href: '../downloads/mind-quest-offline.html', target: '_blank', rel: 'noopener' }, '下載完整離線版 ↓'), note('電腦下載後先完整解壓縮，再開啟資料夾內的 index.html。網站服務若日後有變動，已下載的版本仍可執行。手機建議使用已快取的網站。')),
      node('section', { class: 'panel wide' }, node('h3', {}, '冒險規則'), note('藥學學院各樓館與樓層可進入原有關卡。人物都是免費外觀。新玩家完成每日補給與 5 題不同題目後領養夥伴；領養後每天每題首次答對累積 1 成長點，10 點升 1 級，20 與 60 點進化。夥伴不改變戰鬥能力，外觀與成長會隨存檔保存。'), node('ul', { class: 'rules' }, node('li', {}, '每日補給：以台北時間午夜換日，讀完當日知識卡可領一件普通裝備與 80 金幣（金幣也可在商城領取，每日僅一次）。不必連續登入，沒有斷簽懲罰。'), node('li', {}, '答題獎勵：每道題目每天第一次答對可得 10 XP，對應裝備可加成；每累積 5 道獲獎題目得到 1 張星願券。進度可跨日累積。'), node('li', {}, '錯題修練：答錯不扣分，會留下題目等待複習。重練答對後移出錯題清單。'), node('li', {}, '裝備與等級：每 100 XP 升一級；共有外套、披風、上衣、褲子、鞋子、帽子、配戴物與手持物八欄。Lv.30／40／50／60 免費解鎖四套音樂造型，可分件混搭或保留舊款；許願裝備仍須達標示等級。人物基礎戰鬥等級加成上限為 Lv.20。'), node('li', {}, '週賽：每場 2 回合、每回合 3 題。台北時間週一 00:00 換季；每日每隻怪只計最佳積分，刷新時補發差額。銅 0、銀 600、金 1800、鑽石 3600 分。Google 登入並同步後可加入全服友善週榜，各組一位週冠軍，自選地區稱號，21 天收入加成依鑽／金／銀／銅為 35%／30%／25%／20%。請在週日結束前連線同步成績。'), node('li', {}, '補給：在商城用金幣買臨時補給券，於回合開始前消耗 1 張可預習本回合 3 題的概念、完整題意、答案內容與記憶重點。開始作答後不可再查看；兩回合各需一張。刷卡購買尚未開放。'), node('li', {}, '背包：一般背包初始 50 格，知識道具每件佔 1 格。實際持有的服裝與配件另收在專屬背包，穿戴或卸下都不佔一般背包容量；同款保留件數。等級造型另列於衣櫥。每道題每天首次答對可得 1 本理解筆記，用來研習喜歡的舊款或新款，提升目前品質與能力而不改造型。一般背包可用金幣擴充至 100 格；滿袋時不扣知識寶箱票券，仍可取得服裝、領取戰利品與許願衣帽。'), node('li', {}, '中央許願池：每次 1,000 金幣，20 級 8 款共 80%、40 級 4 款共 18%、60 級 2 款共 1.89%、80 級頂裝 0.01%、金幣獎 0.1%。金幣獎為本次投入後共同獎池的 1%（無條件捨去、至少 1,000），發獎後從池中扣除；各抽獨立、沒有保底。需要 Google 登入與連線。'), node('li', {}, '星願寶箱抽獎：普通 60%、稀有 30%、史詩 9%、極品 1%，連續 30 抽內至少獲得一次極品。沒有付費購買。'))),
      node('section', { class: 'panel' }, node('h3', {}, '題庫從哪裡來？'), note(`目前收錄 ${questions.length.toLocaleString()} 題，來自「我的思維資料夾」108–115 年的 ${bank.packs.length} 組主題教學筆記。涵蓋藥劑生物藥劑、藥理藥化，以及藥物分析與生藥學。`), note('僅轉入可取得完整文字、單一答案與解析的題目；缺圖、已標記爭議或缺少結構化筆記的題目未收錄。115-1 藥物分析與生藥學暫未收錄。計算相關篩選以題幹關鍵字輔助分類。'), note(bank.lessonReview.scope), note('每題作答後顯示原筆記來源。內容供國考複習，不作臨床處方依據；仍可能有原筆記誤差，遇到疑義請回看原題與正式答案。')),
      node('section', { class: 'panel' }, node('h3', {}, '讓遊戲單純，也讓資料安心'), note('可選用 Google 登入。登入後會將暱稱、人物、寵物與遊戲進度上傳到 Firebase 帳號專屬存檔，供跨裝置接續；僅帳號本人可讀寫。沒有廣告或分析追蹤碼。Google 處理登入資訊，網站不取得你的密碼。共同大廳透過 PeerJS 向同房最多 60 位玩家分享遊戲暱稱、外觀、衣著、稱號與位置，不分享帳號、信箱或存檔。雙人連線使用 PeerJS 配對，向對手交換暱稱、等級、裝備與本場答題資料；不開啟鏡頭或麥克風。匯入備份與連線資料都會檢查格式，不執行收到的文字。'), note('網頁無法代替系統防毒軟體，也不會假裝掃描你的電腦。請維持作業系統、瀏覽器與 Windows Defender 更新。離線進度先保存在本機，雙人模式為友誼賽；全服週榜公開遊戲暱稱、積分與段位供登入玩家查閱，Google 帳號與私人存檔不公開。週榜依雲端存檔計分，尚未提供伺服器全程答題驗證與防作弊。'), node('a', { class: 'quiet-link', href: 'https://github.com/steve72102/steve72102.github.io/tree/main/game', target: '_blank', rel: 'noopener noreferrer' }, '查看遊戲程式碼 ↗'))
    )];
  }
  function render() { E.rollDay(state, E.today()); if (C.rollWeek(state.arena)) save();if(cloud?.snapshot().locked||!state.profile.enrolled||cloud?.snapshot().phase==='connecting'){page='account';academyUI.leave();}header(); const routes = { home, account:accountUI.page, practice, wardrobe: academyUI.wardrobe, quiz, review, inventory, draw, settings, bag:adventureUI.bag,quests:adventureUI.quests,arena: combatUI.arena, battle:()=>[...combatUI.battle(),state.arena.battle?.phase==='done'?adventureUI.pending():null], shop:()=>{const panels=combatUI.shop();return [panels[0],panels[1],economyUI.shop(),adventureUI.shop(),...panels.slice(2)];}, duel: duelUI.page, rankings:rankingsUI.page }; const content = (routes[page] || home)();if(!['home','account','bag','quests'].includes(page))content.unshift(btn('← 回到學院大廳',()=>go('home'),'secondary small game-page-back')); view.replaceChildren(...content.filter(Boolean)); academyUI.mount(); }
  const combatUI = window.MindBattleUI({ E, C, node, btn, note, go, title, save, render, toast, openModal, closeModal, questions, getState: () => state, random, money:moneyAction, rankings:()=>rankingsUI.open(), appearance: () => academyUI.portrait(state.appearance, 'fighter') });
  const duelUI = window.MindDuelUI({ E, C, node, btn, note, title, save, render, toast, openModal, closeModal, questions, getState: () => state, random, portrait: (look,variant) => academyUI.portrait(look,variant), isVisible: () => page === 'duel' });
  const academyUI = window.MindAcademyUI({ node, btn, note, title, go, render, save, toast, start, questions, getState: () => state, openModal,closeModal,adventure:()=>adventureUI,wishing:()=>wishUI,economy:()=>economyUI,finance:()=>economyNetwork, daily: () => lore(todayItem(), !(state.claimed === E.today() && state.arena.login === E.today())) });
  const adventureUI=window.MindAdventureUI({node,btn,note,title,go,save,render,toast,openModal,closeModal,getState:()=>state,portrait:(look,variant)=>academyUI.portrait(look,variant),lore,money:moneyAction});
  const accountUI=window.MindAccountUI({node,btn,note,title,getState:()=>state,save,go,toast,account:()=>cloud,exportSave,openModal,closeModal});
  const wishNetwork=window.MindWishCloud({account:()=>cloud,economy:()=>economyNetwork,changed:()=>wishUI.update()});
  const wishUI=window.MindWishUI({node,btn,note,openModal,closeModal,getState:()=>state,account:()=>cloud,network:()=>wishNetwork,adventure:()=>adventureUI,go,render});
  const economyNetwork=window.MindEconomyCloud({account:()=>cloud,changed:()=>{if(cloud)render();}});
  const economyUI=window.MindEconomyUI({node,btn,note,openModal,closeModal,getState:()=>state,toast,render,network:()=>economyNetwork,account:()=>cloud,building:()=>academyUI.currentBuilding(),openClass:(b,room)=>academyUI.openClass(b,room),rankings:()=>rankingsUI});
  const rankingsNetwork=window.MindRankingsCloud({account:()=>cloud,getState:()=>state,changed:()=>{if(page==='rankings')render();}});
  const rankingsUI=window.MindRankingsUI({node,btn,note,title,go,getState:()=>state,network:()=>rankingsNetwork,economy:()=>economyNetwork,account:()=>cloud,openModal,closeModal,toast});
  async function moneyAction(action,param,local,message,failure='目前無法完成，請確認金幣與背包空間。'){
    if(cloud?.snapshot().uid){if(!economyNetwork.snapshot().ready){toast('多人金幣帳本正在同步，請稍後再試。');return false;}return !!(await economyUI.run(()=>economyNetwork.mutate(action,param),message));}
    if(local()){closeModal();save();render();toast(message);return true;}toast(failure);return false;
  }
  cloud=window.MindCloud({getState:()=>state,setState:(s,options)=>{if(!options?.preserveScene)academyUI.disconnect();state=s;if(!options?.preserveAnswer)selected=null;},restore:restoreSave,fresh:freshSave,economy:()=>economyNetwork,changed:()=>{if(cloud){render();wishUI.update();economyNetwork.observe();rankingsNetwork.observe();}},busy:()=>duelUI.active(),warning:warn});
  $('nav').addEventListener('click', event => { const target = event.target.closest('[data-page]'); if (target) go(target.dataset.page); });
  $('account-status').addEventListener('click',()=>go('account'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  for(const type of ['click','pointerdown','keydown'])document.addEventListener(type,event=>{if(cloud.snapshot().wishing){event.preventDefault();event.stopImmediatePropagation();}},true);
  $('modal').addEventListener('cancel',event=>{if(cloud.snapshot().wishing)event.preventDefault();});
  cloud.init();wishNetwork.watch();
  render();
  if ('serviceWorker' in navigator && ['https:', 'http:'].includes(location.protocol)) {
    navigator.serviceWorker.register('./sw.js?v=20261031-regional-titles', {updateViaCache:'none'}).then(reg => {
      const updateStatus = async () => { const names = await caches.keys(); if (names.some(n => n.startsWith('mind-quest-'))) $('connection').textContent = navigator.onLine ? '離線冒險已準備好' : '離線模式 · 繼續冒險'; };
      navigator.serviceWorker.ready.then(updateStatus);
      reg.addEventListener('updatefound', () => { const worker = reg.installing; if (worker) worker.addEventListener('statechange', () => { if (worker.state === 'installed') updateStatus(); }); });
    }).catch(() => { $('connection').textContent = '網頁模式 · 可下載離線版'; });
  }
})();
