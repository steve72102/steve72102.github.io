(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MindEngine = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const SUBJECTS = {
    pharmaceutics: { name: '藥劑生物藥劑', realm: '流光工坊', icon: '◈', color: 'mint' },
    pharmacology: { name: '藥理藥化', realm: '星紋高塔', icon: '✧', color: 'violet' },
    herbal: { name: '藥物分析與生藥', realm: '森語秘境', icon: '❋', color: 'gold' }
  };
  const TIERS = [
    { name: '普通', chance: 60, bonus: 0, label: 'common' },
    { name: '稀有', chance: 30, bonus: 2, label: 'rare' },
    { name: '史詩', chance: 9, bonus: 4, label: 'epic' },
    { name: '極品', chance: 1, bonus: 6, label: 'legendary' }
  ];
  const ITEMS = [
    ['pharmaceutics', '溶離旅人瓶', '擴散之羅盤', '半衰沙漏', '恆星藥劑法典'],
    ['pharmacology', '受體學徒戒', '訊號護符', '靶點星杖', '萬象藥理王冠'],
    ['herbal', '森語採集袋', '鑑別之鏡', '分析月燈', '生命樹聖典']
  ].flatMap(([subject, ...names]) => names.map((name, tier) => ({ id: subject + '-' + tier, subject, name, tier })));
  const MAX = 100000000;
  function today(date = new Date()) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const get = type => p.find(x => x.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function fresh(day = today()) { return { version: 1, xp: 0, tickets: 0, progress: 0, pity: 0, draws: 0, totalCorrect: 0, claimed: '', day, rewarded: [], inventory: {}, equipped: null, wrong: [], mastered: [], session: null }; }
  function rollDay(s, day) { if (s.day !== day) { s.day = day; s.rewarded = []; } }
  function claim(s, day = today()) {
    rollDay(s, day);
    if (s.claimed === day) return null;
    const index = Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000) % 3;
    const item = ITEMS.filter(i => i.tier === 0)[index];
    s.claimed = day; s.inventory[item.id] = Math.min(MAX, (s.inventory[item.id] || 0) + 1);
    if (!s.equipped) s.equipped = item.id;
    return item;
  }
  function reward(s, q, correct, day = today()) {
    rollDay(s, day);
    if (!correct) { if (!s.wrong.includes(q.id)) s.wrong.push(q.id); return { xp: 0, ticket: 0, repeated: false }; }
    s.wrong = s.wrong.filter(id => id !== q.id);
    if (!s.mastered.includes(q.id)) s.mastered.push(q.id);
    if (s.rewarded.includes(q.id)) return { xp: 0, ticket: 0, repeated: true };
    const equipped = ITEMS.find(i => i.id === s.equipped);
    const xp = 10 + (equipped && equipped.subject === q.subject ? TIERS[equipped.tier].bonus : 0);
    s.rewarded.push(q.id); s.xp = Math.min(MAX, s.xp + xp); s.totalCorrect = Math.min(MAX, s.totalCorrect + 1); s.progress++;
    const ticket = s.progress >= 5 ? 1 : 0;
    if (ticket) { s.progress -= 5; s.tickets = Math.min(MAX, s.tickets + 1); }
    return { xp, ticket, repeated: false };
  }
  function draw(s, random = Math.random) {
    if (s.tickets < 1) return null;
    const n = random() * 100;
    const tier = s.pity >= 29 ? 3 : n < 60 ? 0 : n < 90 ? 1 : n < 99 ? 2 : 3;
    const pool = ITEMS.filter(i => i.tier === tier);
    const item = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    const duplicate = !!s.inventory[item.id];
    const bonus = duplicate ? [10, 20, 40, 80][tier] : 0;
    s.tickets--; s.draws = Math.min(MAX, s.draws + 1); s.pity = tier === 3 ? 0 : s.pity + 1;
    s.inventory[item.id] = Math.min(MAX, (s.inventory[item.id] || 0) + 1); s.xp = Math.min(MAX, s.xp + bonus);
    return { item, duplicate, bonus, guaranteed: n < 99 && tier === 3 };
  }
  function shuffle(list, random = Math.random) { const out = list.slice(); for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }
  function begin(s, questions, label, random = Math.random) {
    questions = questions.filter(q => !q.needsReview);
    if (!questions.length) return false;
    s.session = { ids: shuffle(questions, random).slice(0, 5).map(q => q.id), index: 0, answers: [], label: String(label).slice(0, 60) };
    return true;
  }
  function answer(s, q, choice, day = today()) {
    const run = s.session;
    if (!run || run.ids[run.index] !== q.id || run.answers.length !== run.index || !Number.isInteger(choice) || choice < 0 || choice > 3) return null;
    const correct = choice === q.answer;
    const result = { choice, correct, ...reward(s, q, correct, day) };
    run.answers.push(result);
    return result;
  }
  function next(s) { if (s.session && s.session.answers.length > s.session.index) s.session.index++; }
  function restore(raw, questions) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) throw new Error('存檔格式或版本不相容。');
    const byId = new Map(questions.map(q => [q.id, q]));
    const ids = (value) => { if (!Array.isArray(value) || value.length > questions.length || value.some(x => typeof x !== 'string' || !byId.has(x)) || new Set(value).size !== value.length) throw new Error('存檔含有無效題目。'); return value.slice(); };
    const num = (value, max = MAX) => { if (!Number.isInteger(value) || value < 0 || value > max) throw new Error('存檔數值不正確。'); return value; };
    const date = value => { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z'))) throw new Error('存檔日期不正確。'); return value; };
    const s = fresh(date(raw.day));
    for (const key of ['xp', 'tickets', 'draws', 'totalCorrect']) s[key] = num(raw[key]);
    s.progress = num(raw.progress, 4); s.pity = num(raw.pity, 29); s.claimed = raw.claimed === '' ? '' : date(raw.claimed);
    for (const key of ['rewarded', 'wrong', 'mastered']) s[key] = ids(raw[key]);
    if (!raw.inventory || typeof raw.inventory !== 'object' || Array.isArray(raw.inventory) || Object.keys(raw.inventory).length > ITEMS.length) throw new Error('裝備存檔不正確。');
    for (const [id, count] of Object.entries(raw.inventory)) { if (!ITEMS.some(i => i.id === id)) throw new Error('未知裝備。'); s.inventory[id] = num(count); }
    if (raw.equipped !== null && !s.inventory[raw.equipped]) throw new Error('無法裝備未持有物品。');
    s.equipped = raw.equipped;
    if (raw.session !== null) {
      const r = raw.session;
      if (!r || typeof r !== 'object' || !Array.isArray(r.answers) || typeof r.label !== 'string' || r.label.length > 60) throw new Error('關卡存檔不正確。');
      const list = ids(r.ids), index = num(r.index, list.length);
      if (list.length < 1 || list.length > 5 || r.answers.length < index || r.answers.length > Math.min(index + 1, list.length)) throw new Error('關卡進度不正確。');
      const answers = r.answers.map((a, n) => {
        const choice = num(a.choice, 3), correct = choice === byId.get(list[n]).answer;
        if (a.correct !== correct || typeof a.repeated !== 'boolean') throw new Error('答題紀錄不正確。');
        return { choice, correct, repeated: a.repeated, xp: num(a.xp, 16), ticket: num(a.ticket, 1) };
      });
      s.session = { ids: list, index, answers, label: r.label };
    }
    return s;
  }
  return { SUBJECTS, TIERS, ITEMS, today, fresh, rollDay, claim, reward, draw, shuffle, begin, answer, next, restore };
});
