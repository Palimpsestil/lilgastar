/* 學測英文 1800 單字測驗：純前端，不需要伺服器；作答紀錄存在這台裝置的瀏覽器（localStorage）。 */
(() => {
'use strict';
const DATA = window.DATA;
const ENV = window.APP_ENV || 'site';
const ROOT = document.documentElement;
if (ENV === 'artifact') ROOT.classList.add('env-artifact');

/* ================= 小工具 ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
const rnd = n => Math.floor(Math.random() * n);
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const pickOne = a => a[rnd(a.length)];
const pad2 = n => String(n).padStart(2, '0');
const norm = s => String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
const ICON = {
  speak: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>',
};

/* ================= 日期（以本地日期計天數） ================= */
const DAY = 864e5;
function today() { const d = new Date(); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY); }
function dkey(n = today()) { const d = new Date(n * DAY); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; }
function dnum(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY) : null; }
function md(n) { const d = new Date(n * DAY); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; }
const WK = '日一二三四五六';
function wk(n) { return WK[new Date(n * DAY).getUTCDay()]; }
function fmtTime(sec) { const m = Math.floor(sec / 60), s = sec % 60; return m ? `${m} 分 ${pad2(s)} 秒` : `${s} 秒`; }

/* ================= 資料 ================= */
const CARDS = DATA.cards.map((c, i) => {
  const sp = c[0].indexOf(' ');
  return { no: i + 1, sec: c[0].slice(0, sp), secName: c[0].slice(sp + 1), topic: c[1], en: c[2], words: [] };
});
const SECS = [];
CARDS.forEach(c => { let s = SECS.find(x => x.key === c.sec); if (!s) SECS.push(s = { key: c.sec, name: c.secName, cards: [] }); s.cards.push(c.no); });

function formsOf(head) {
  const out = [];
  head.split('/').forEach(part => {
    part = part.trim();
    const m = /^([A-Za-z\-]+)\(([a-z]+)\)$/.exec(part);
    if (m) out.push(m[1].toLowerCase(), (m[1] + m[2]).toLowerCase()); else out.push(part.toLowerCase());
  });
  return out;
}
const ZH_STOP = new Set(['某人', '某事', '某物', '東西', '事情', '一種', '一個', '使人', '令人', '感到', '進行']);
function zhBigrams(zh) {
  const set = new Set();
  zh.replace(/（[^）]*）|\([^)]*\)/g, '').split(/[；;，,、]/).forEach(s => {
    s = s.replace(/[的地得之]/g, '').trim();
    if (s.length === 1) set.add(s);
    for (let i = 0; i < s.length - 1; i++) { const b = s.slice(i, i + 2); if (!ZH_STOP.has(b)) set.add(b); }
  });
  return set;
}
const W = DATA.W.map((a, i) => {
  const w = { i, w: a[0], p: a[1], zh: a[2], k: a[3], g: a[4], cat: a[5], lv: a[6], gs: a[7], g10: a[8], as: a[9], ca: a[10], op: a[11], ex: a[12] };
  w.pos = a[1].split('/').map(s => s.replace(/[()]/g, '')).filter(Boolean);
  w.p1 = w.pos[0];
  w.forms = formsOf(a[0]);
  w.say = w.forms[0];
  w.card = CARDS[w.g - 1];
  w.card.words.push(w);
  w.bi = zhBigrams(a[2]);
  w.syn = new Set();
  w.kb = a[3].filter(x => x.includes('{'));
  return w;
});
// 近義詞排除（_原始檔/近義詞排除.txt）：中文字面不同但意思相近，不能同時當選項
(DATA.X || []).forEach(([a, b]) => { if (W[a] && W[b]) { W[a].syn.add(b); W[b].syn.add(a); } });
const BYPOS = {};
W.forEach(w => (BYPOS[w.p1] = BYPOS[w.p1] || []).push(w));
const ORIG = new Map();
DATA.O.forEach(a => ORIG.set(a[0], { wi: a[0], pos: a[1], s: a[2], ds: a[3], di: a[4], zh: a[5] }));
const PAST = DATA.P.map((a, j) => ({ id: j, wi: a[0], src: a[1], no: a[2], stem: a[3], opts: a[4], ans: a[5], oi: a[6], der: a[7] }));
const PAST_BY = new Map();
PAST.forEach(p => { if (!PAST_BY.has(p.wi)) PAST_BY.set(p.wi, []); PAST_BY.get(p.wi).push(p); });
// 中譯英：每組 2 句；每句 [中文, 參考答案, 其他寫法[], 句型重點[], 關鍵字詞[[中, 英]], 易錯提醒[], 句中的 1800 字 index[]]
const TR_TH = DATA.TH || {};
const TR = (DATA.T || []).map(a => ({ id: a[0], th: a[1], title: a[2], s: a[3].map(x => ({ zh: x[0], ref: x[1], alt: x[2], pat: x[3], key: x[4], warn: x[5], wis: x[6] })) }));
const TR_BY = new Map(TR.map(t => [t.id, t]));

// 閱讀測驗：每回 3 篇；每篇 [題材, 英文段落[], 題目[[題幹, 選項[], 圖片選項[], 答案 0–3, 題型, 詳解, 選項中譯]], 中譯段落[], 字詞[[字, 詞性, 中文]], 字數]
const RD = (DATA.R || []).map(a => ({ no: a[0], p: a[1].map(x => ({ topic: x[0], text: x[1], q: x[2].map(q => ({ s: q[0], o: q[1], fig: q[2], a: q[3], t: q[4], e: q[5], z: q[6] })), zh: x[3], v: x[4], wc: x[5] })) }));
const RD_BY = new Map(RD.map(r => [r.no, r]));
const RD_N = RD.reduce((n, r) => n + r.p.length, 0);

// 綜合測驗：每回 2 篇；每篇 [英文段落[]（含 [n] 空格）, 題目[[選項[4], 答案 0–3, 考點, 詳解, 選項中譯]], 中譯段落[], 字數]
const CZ = (DATA.C || []).map(a => ({ no: a[0], p: a[1].map(x => ({ text: x[0], q: x[1].map(q => ({ o: q[0], a: q[1], t: q[2], e: q[3], z: q[4] })), zh: x[2], wc: x[3] })) }));
const CZ_BY = new Map(CZ.map(r => [r.no, r]));
const CZ_N = CZ.reduce((n, r) => n + r.p.length, 0);

// 文意選填：每回 [回數, 題材, 英文段落[]（[[n]] 是空格）, 選項[10], 每格 [答案 0–9, 詞性, 解析], 中譯段落[], 字數]
const BK = (DATA.B || []).map(a => ({ no: a[0], topic: a[1], text: a[2], o: a[3], q: a[4].map(q => ({ a: q[0], pos: q[1], e: q[2] })), zh: a[5], wc: a[6] }));
const BK_BY = new Map(BK.map(r => [r.no, r]));
// 篇章結構：每回 [回數, 題材, 英文段落[]（[[n]] 是空格）, 選項[5], 答案[4]（0–4）, 解析[4], [多餘選項, 解析], 中譯段落[], 字數]
const PS = (DATA.PS || []).map(a => ({ no: a[0], topic: a[1], text: a[2], o: a[3], a: a[4], e: a[5], x: a[6], zh: a[7], wc: a[8] }));
const PS_BY = new Map(PS.map(r => [r.no, r]));
// 混合題：每回 [回數, 類型 F/P/L, 題材, 前言, 段落 [代號, 標題, 內文], 填充 [句子, [[可接受的答案], 原文用字, 解析]×2],
//   多選 [題幹, 選項（只有雙文題有）, 答案代號, 解析], 簡答 [題幹, [可接受的答案], 解析], 中譯[]]
const MX = (DATA.MX || []).map(a => ({ no: a[0], type: a[1], topic: a[2], intro: a[3], b: a[4].map(x => ({ k: x[0], h: x[1], t: x[2] })),
  f: { s: a[5][0], a: a[5][1].map(x => ({ w: x[0], src: x[1], e: x[2] })) }, m: { s: a[6][0], o: a[6][1], a: a[6][2], e: a[6][3] },
  s: { s: a[7][0], a: a[7][1], e: a[7][2] }, zh: a[8] }));
const MX_BY = new Map(MX.map(r => [r.no, r]));
// 混合題多選可以選的代號：雙文題是選項 A–F，論壇題和列舉題是各段的代號
function mxKeys(r) { return r.m.o.length ? 'ABCDEF'.slice(0, r.m.o.length) : r.b.map(x => x.k).join(''); }
// 比對手寫的答案：不分大小寫，去掉雙引號、前後的空白和句尾標點
function mxNorm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[’‘`]/g, "'").replace(/["“”]/g, '').replace(/\s+/g, ' ').replace(/^[\s'(（]+|[\s'.。!！?？)）]+$/g, ''); }
function mxGrade(r, a) {
  a = a || { f: ['', ''], m: '', s: '' };
  const f = r.f.a.map((x, i) => !!mxNorm(a.f[i]) && x.w.some(w => mxNorm(w) === mxNorm(a.f[i])));
  const m = a.m === r.m.a, s = !!mxNorm(a.s) && r.s.a.some(x => mxNorm(x) === mxNorm(a.s));
  return { f, m, s, n: f.filter(Boolean).length + (m ? 1 : 0) + (s ? 1 : 0) };
}

/* ================= 儲存 ================= */
const KEY = 'gsat1800-v1';
const DEFAULTS = { goal: 30, newN: 10, grad: 2, sound: false, autoSay: false, accent: 'en-US', rate: 0.9, autoNext: false,
  mixTyping: false, zhFirst: false, theme: 'auto', fs: 'm', exam: '2027-01-22', reviewN: 30 };
const SETUP0 = { mode: 'e2c', cards: CARDS.map(c => c.no), levels: [3, 4, 5], filter: 'all', count: 20, order: 'random',
  mockN: 10, mockSrc: 'mix', mockTimed: true };
function fresh() { return { app: 'gsat1800', v: 1, w: {}, days: {}, modes: {}, fav: {}, set: { ...DEFAULTS }, setup: { ...SETUP0, cards: SETUP0.cards.slice() }, sess: null, tr: { d: {}, a: {} }, cz: { d: {}, a: {} }, rd: { d: {}, a: {} }, bk: { d: {}, a: {} }, ps: { d: {}, a: {} }, mx: { d: {}, a: {} }, since: dkey() }; }
const HEADS = new Set(W.map(w => w.w));
const TYPE_KEYS = ['e2c', 'c2e', 'cloze', 'past', 'listen', 'coll', 'spell'];
const MODE_KEYS = ['e2c', 'c2e', 'cloze', 'mix', 'past', 'mock', 'cards', 'coll', 'spell', 'listen'];
const FILTER_KEYS = ['all', 'new', 'learning', 'due', 'wrong', 'fav', 'ans', 'recent'];
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (v, d = 0) => { v = +v; return Number.isFinite(v) ? v : d; };
function cleanSess(x) {
  // 未完成的練習：逐欄檢查，任何一題不合格就整個丟掉
  if (!isObj(x) || !Array.isArray(x.qs) || !x.qs.length || x.qs.length > 400) return null;
  const qs = [];
  for (const q of x.qs) {
    if (!isObj(q) || !TYPE_KEYS.includes(q.t) || !W[q.wi]) return null;
    const c = { t: q.t, wi: +q.wi };
    if (q.retry) c.retry = 1;
    if (q.t === 'past') { if (!PAST[q.pid]) return null; c.pid = +q.pid; }
    if (q.t === 'cloze' && !ORIG.has(c.wi)) return null;
    if (q.t === 'coll' || q.t === 'spell') {
      if (!Array.isArray(q.acc) || !q.acc.length) return null;
      c.acc = q.acc.map(String); c.h = Math.max(1, num(q.h, 1));
      if (q.t === 'coll') { if (typeof q.k !== 'string' || !/\{[^}]+\}/.test(q.k)) return null; c.k = q.k; }
    } else {
      if (!Array.isArray(q.opts) || q.opts.length !== 4) return null;
      c.opts = q.opts.map(o => ({ t: String(o && o.t), wi: W[o && o.wi] ? +o.wi : -1, ok: o && o.ok ? 1 : 0 }));
      if (c.opts.filter(o => o.ok).length !== 1) return null;
    }
    qs.push(c);
  }
  const i = Math.max(0, Math.min(qs.length, Math.floor(num(x.i))));
  let a = null;
  if (isObj(x.a)) a = { ok: !!x.a.ok, ...(x.a.j != null ? { j: num(x.a.j, -1) } : {}), ...(x.a.v != null ? { v: String(x.a.v) } : {}) };
  return { title: String(x.title || '練習').slice(0, 40), mode: MODE_KEYS.concat('word').includes(x.mode) ? x.mode : 'mix', qs, i,
    n: Math.max(0, num(x.n)), c: Math.max(0, num(x.c)), wrong: (Array.isArray(x.wrong) ? x.wrong : []).map(Number).filter(k => W[k]),
    t0: num(x.t0, Date.now()), a, words: (Array.isArray(x.words) ? x.words : []).map(Number).filter(k => W[k]) };
}
function normalize(o) {
  const s = fresh();
  if (!isObj(o)) return s;
  if (isObj(o.w)) for (const k in o.w) {
    const r = o.w[k]; if (!HEADS.has(k) || !isObj(r)) continue;
    const t = {};
    for (const f of ['b', 'd', 'n', 'c', 'x', 'st', 'sd', 'lp', 'ls', 'lw', 'wb', 'gr']) if (r[f] != null) t[f] = num(r[f]);
    t.b = Math.max(0, Math.min(6, Math.floor(t.b || 0)));
    for (const f of ['d', 'n', 'c', 'x', 'st']) t[f] = t[f] || 0;
    if (t.x && !t.lw) t.lw = t.ls || today();
    s.w[k] = t;
  }
  if (isObj(o.days)) for (const k in o.days) { const r = o.days[k]; if (dnum(k) != null && isObj(r)) { s.days[k] = { q: num(r.q), c: num(r.c), f: num(r.f) }; if (r.t != null) s.days[k].t = num(r.t); } }
  if (isObj(o.tr)) {
    // 中譯英：d = 每組最後練習的日子，a = 自己寫的答案（鍵為「組-句」）
    if (isObj(o.tr.d)) for (const k in o.tr.d) if (TR_BY.has(+k) && String(+k) === k) s.tr.d[k] = num(o.tr.d[k], today());
    if (isObj(o.tr.a)) for (const k in o.tr.a) { const m = /^(\d+)-([12])$/.exec(k), v = o.tr.a[k]; if (m && TR_BY.has(+m[1]) && typeof v === 'string' && v) s.tr.a[k] = v.slice(0, 2000); }
  }
  if (isObj(o.cz)) {
    // 綜合測驗：a = 每篇五格的作答，d = [對答案那天, 答對題數]
    const okKey = k => { const m = /^(\d+)-([1-9])$/.exec(k); return !!m && CZ_BY.has(+m[1]) && +m[2] <= CZ_BY.get(+m[1]).p.length; };
    if (isObj(o.cz.a)) for (const k in o.cz.a) { const v = o.cz.a[k]; if (okKey(k) && Array.isArray(v) && v.length === 5) s.cz.a[k] = v.map(x => { x = Math.floor(num(x, -1)); return x >= 0 && x <= 3 ? x : -1; }); }
    if (isObj(o.cz.d)) for (const k in o.cz.d) { const v = o.cz.d[k]; if (okKey(k) && Array.isArray(v) && s.cz.a[k] && s.cz.a[k].every(x => x >= 0)) s.cz.d[k] = [num(v[0], today()), Math.max(0, Math.min(5, Math.floor(num(v[1]))))]; }
  }
  if (isObj(o.rd)) {
    // 閱讀測驗：a = 每篇四題的作答，d = [對答案那天, 答對題數]
    const okKey = k => { const m = /^(\d+)-([1-9])$/.exec(k); return !!m && RD_BY.has(+m[1]) && +m[2] <= RD_BY.get(+m[1]).p.length; };
    if (isObj(o.rd.a)) for (const k in o.rd.a) { const v = o.rd.a[k]; if (okKey(k) && Array.isArray(v) && v.length === 4) s.rd.a[k] = v.map(x => { x = Math.floor(num(x, -1)); return x >= 0 && x <= 3 ? x : -1; }); }
    if (isObj(o.rd.d)) for (const k in o.rd.d) { const v = o.rd.d[k]; if (okKey(k) && Array.isArray(v) && s.rd.a[k] && s.rd.a[k].every(x => x >= 0)) s.rd.d[k] = [num(v[0], today()), Math.max(0, Math.min(4, Math.floor(num(v[1]))))]; }
  }
  // 文意選填、篇章結構：a = 每回各格選了第幾個選項（沒填 -1），d = [對答案那天, 答對格數]；答對格數用現在的答案重算
  const pickSet = (src, dst, BY, n, m, keyOf) => {
    if (!isObj(src)) return;
    const okKey = k => String(+k) === k && BY.has(+k);
    if (isObj(src.a)) for (const k in src.a) { const v = src.a[k]; if (okKey(k) && Array.isArray(v) && v.length === n) { const a = v.map(x => { x = Math.floor(num(x, -1)); return x >= 0 && x < m ? x : -1; }); if (a.some(x => x >= 0)) dst.a[k] = a; } }
    if (isObj(src.d)) for (const k in src.d) { const v = src.d[k], a = dst.a[k]; if (okKey(k) && Array.isArray(v) && a && a.every(x => x >= 0)) { const key = keyOf(BY.get(+k)); dst.d[k] = [num(v[0], today()), a.filter((x, i) => x === key[i]).length]; } }
  };
  pickSet(o.bk, s.bk, BK_BY, 10, 10, r => r.q.map(q => q.a));
  pickSet(o.ps, s.ps, PS_BY, 4, 5, r => r.a);
  if (isObj(o.mx)) {
    // 混合題：a = { f: [第 47 格, 第 48 格], m: 多選選的代號, s: 簡答 }，d = [對答案那天, 答對題數, 簡答自己判定算對 0/1]
    const okKey = k => String(+k) === k && MX_BY.has(+k);
    const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
    if (isObj(o.mx.a)) for (const k in o.mx.a) {
      const v = o.mx.a[k]; if (!okKey(k) || !isObj(v)) continue;
      const keys = mxKeys(MX_BY.get(+k));
      const a = { f: [0, 1].map(i => str(Array.isArray(v.f) ? v.f[i] : '', 40)), m: [...new Set(str(v.m, 20).split(''))].filter(c => keys.includes(c)).sort().join(''), s: str(v.s, 200) };
      if (a.f[0] || a.f[1] || a.m || a.s) s.mx.a[k] = a;
    }
    if (isObj(o.mx.d)) for (const k in o.mx.d) {
      const v = o.mx.d[k], a = s.mx.a[k]; if (!okKey(k) || !Array.isArray(v) || !a) continue;
      const g = mxGrade(MX_BY.get(+k), a), self = !g.s && v[2] && mxNorm(a.s) ? 1 : 0;
      s.mx.d[k] = [num(v[0], today()), g.n + self, self];
    }
  }
  if (isObj(o.modes)) for (const k of TYPE_KEYS) { const r = o.modes[k]; if (isObj(r)) s.modes[k] = { q: num(r.q), c: num(r.c) }; }
  if (isObj(o.fav)) for (const k in o.fav) if (HEADS.has(k) && o.fav[k]) s.fav[k] = num(o.fav[k], today());
  const src = isObj(o.set) ? o.set : {};
  const pickv = (k, allowed) => { const v = allowed.find(a => a === src[k] || (typeof a === 'number' && src[k] !== '' && src[k] != null && a === +src[k])); if (v !== undefined) s.set[k] = v; };
  pickv('goal', [10, 20, 30, 50, 80, 100]); pickv('newN', [5, 10, 15, 20, 30]); pickv('reviewN', [20, 30, 50, 100]); pickv('grad', [0, 1, 2, 3]);
  pickv('accent', ['en-US', 'en-GB']); pickv('rate', [0.7, 0.9, 1]); pickv('theme', ['auto', 'light', 'dark']); pickv('fs', ['m', 'l', 'xl']);
  ['sound', 'autoSay', 'autoNext', 'mixTyping', 'zhFirst'].forEach(k => { if (typeof src[k] === 'boolean') s.set[k] = src[k]; });
  if (typeof src.exam === 'string' && dnum(src.exam) != null) s.set.exam = src.exam;
  const su = isObj(o.setup) ? o.setup : {};
  if (MODE_KEYS.includes(su.mode)) s.setup.mode = su.mode;
  if (Array.isArray(su.cards)) { const c = [...new Set(su.cards.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= CARDS.length))].sort((a, b) => a - b); if (c.length) s.setup.cards = c; }
  if (Array.isArray(su.levels)) { const lv = su.levels.map(Number), l = [3, 4, 5].filter(n => lv.includes(n)); if (l.length) s.setup.levels = l; }
  if (FILTER_KEYS.includes(su.filter)) s.setup.filter = su.filter;
  if ([10, 20, 30, 50, 100].includes(+su.count)) s.setup.count = +su.count;
  if (['random', 'seq', 'weak'].includes(su.order)) s.setup.order = su.order;
  if ([10, 20, 30].includes(+su.mockN)) s.setup.mockN = +su.mockN;
  if (['mix', 'orig', 'past'].includes(su.mockSrc)) s.setup.mockSrc = su.mockSrc;
  if (typeof su.mockTimed === 'boolean') s.setup.mockTimed = su.mockTimed;
  s.sess = cleanSess(o.sess);
  if (typeof o.since === 'string' && dnum(o.since) != null) s.since = o.since;
  return s;
}
let storeOK = true;
function load() { try { const t = localStorage.getItem(KEY); return normalize(t ? JSON.parse(t) : null); } catch (e) { storeOK = false; return fresh(); } }
let S = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); storeOK = true; }
  catch (e) { if (storeOK) toast('這個瀏覽器無法儲存進度（可能是無痕模式）'); storeOK = false; }
}

/* ================= 熟練度與間隔複習 ================= */
// 盒子 b：0 未學、1–2 學習中、3–4 熟悉、5–6 精熟；答對且當天第一次升級才升一盒，間隔 1/2/4/7/15/30 天
const INT = [0, 1, 2, 4, 7, 15, 30];
const LVN = ['未學', '學習中', '熟悉', '精熟'];
const wsMake = w => S.w[w.w] || (S.w[w.w] = { b: 0, d: 0, n: 0, c: 0, x: 0, st: 0 });
function lvl(w) { const s = S.w[w.w]; if (!s || (!s.n && !s.b)) return 0; return s.b >= 5 ? 3 : s.b >= 3 ? 2 : 1; }
const isDue = (w, t = today()) => { const s = S.w[w.w]; return !!s && s.b > 0 && s.d <= t; };
const isWrong = w => !!(S.w[w.w] && S.w[w.w].wb);
const isFav = w => !!S.fav[w.w];
function dayRec() { const k = dkey(); return S.days[k] || (S.days[k] = { q: 0, c: 0, f: 0 }); }
function record(w, ok, type, how = {}) {
  const s = wsMake(w), t = today();
  s.n++; s.ls = t;
  if (ok) {
    s.c++;
    if (how.hint) { if (s.b < 1) s.b = 1; s.d = Math.min(s.d || t + 1, t + 1); }
    else {
      if (s.sd !== t) { s.st = (s.st || 0) + 1; s.sd = t; }
      if (s.lp !== t) { s.b = Math.min(6, (s.b || 0) + 1); s.lp = t; }
      s.d = t + INT[s.b];
      if (s.wb && S.set.grad > 0 && s.st >= S.set.grad) { s.wb = 0; s.gr = t; toast(`${w.w} 從錯題本畢業了`); }
    }
  } else {
    s.x++; s.st = 0; s.sd = t; s.b = 1; s.d = t; s.lp = t; s.wb = 1; s.lw = t;
  }
  const r = dayRec(); r.q++; if (ok) r.c++;
  const m = S.modes[type] || (S.modes[type] = { q: 0, c: 0 }); m.q++; if (ok) m.c++;
}
function markEasy(w) { const s = wsMake(w), t = today(); s.b = Math.max(s.b, 5); s.d = t + INT[s.b]; s.lp = t; s.ls = t; s.wb = 0; }
function rateCard(w, r) {
  const s = wsMake(w), t = today(); s.ls = t;
  if (r === 1) { s.b = 1; s.d = t; }
  else if (r === 2) { if (s.b < 1) { s.b = 1; s.d = t + 1; } }
  else markEasy(w);
  dayRec().f++;
}
function streak() {
  let t = today(), n = 0;
  const act = k => { const r = S.days[dkey(k)]; return r && (r.q || r.f || r.t); };
  if (!act(t)) t--;
  while (act(t)) { n++; t--; }
  return n;
}
function levelCounts(list) { const L = [0, 0, 0, 0]; list.forEach(w => L[lvl(w)]++); return L; }

/* ================= 發音（瀏覽器內建語音） ================= */
const TTS = {
  ok: typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined',
  v: null,
  pick() {
    if (!this.ok) return;
    try {
      const vs = window.speechSynthesis.getVoices() || [];
      const want = S.set.accent;
      const en = vs.filter(v => (v.lang || '').replace('_', '-').toLowerCase().startsWith('en'));
      const exact = en.filter(v => v.lang.replace('_', '-').toLowerCase() === want.toLowerCase());
      const pref = /Samantha|Ava|Allison|Susan|Google US|Daniel|Serena|Kate|Google UK|Aria|Jenny|Guy|Libby|Sonia/;
      this.v = exact.find(v => pref.test(v.name)) || exact.find(v => v.localService) || exact[0] || en[0] || null;
    } catch (e) { this.v = null; }
  },
  say(text) {
    if (!this.ok || !S.set.sound || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = this.v ? this.v.lang : S.set.accent;
      if (this.v) u.voice = this.v;
      u.rate = S.set.rate;
      window.speechSynthesis.speak(u);
    } catch (e) { /* 不支援就安靜略過 */ }
  },
  stop() { try { if (this.ok) window.speechSynthesis.cancel(); } catch (e) {} },
};
if (TTS.ok) { TTS.pick(); try { window.speechSynthesis.onvoiceschanged = () => TTS.pick(); } catch (e) {} }
const canListen = () => TTS.ok && S.set.sound;

/* ================= 題目 ================= */
const TYPES = {
  e2c: { name: '英選中', desc: '給英文單字，從四個中文意思選出正確的' },
  c2e: { name: '中選英', desc: '給中文意思，從四個英文單字選出正確的' },
  cloze: { name: '原創題', desc: '本站自編的學測詞彙題，1800 字各一題' },
  past: { name: '歷屆詞彙題', desc: '學測、指考真題，官方選項' },
  listen: { name: '聽音辨義', desc: '聽發音，選中文意思' },
  coll: { name: '搭配詞填空', desc: '打出常見搭配裡缺的字', typing: true },
  spell: { name: '拼字', desc: '看中文，拼出英文', typing: true },
};
const MODES = [
  { id: 'e2c', ...TYPES.e2c }, { id: 'c2e', ...TYPES.c2e }, { id: 'cloze', ...TYPES.cloze },
  { id: 'mix', name: '綜合練習', desc: '選擇題題型混合出題' },
  { id: 'past', ...TYPES.past },
  { id: 'mock', name: '模擬考', desc: '詞彙題限時測驗，交卷才對答案' },
  { id: 'cards', name: '字卡', desc: '翻卡背誦，自己評熟悉度' },
  { id: 'coll', ...TYPES.coll }, { id: 'spell', ...TYPES.spell }, { id: 'listen', ...TYPES.listen },
];
// 主要模式：1 英選中、2 中選英、3 原創題（單字題，共用練習設定）
const MAIN_MODES = ['e2c', 'c2e', 'cloze'];
// 4 之後是題組型，各有自己的頁面，順序和學測考卷一樣：
// 4 綜合測驗（#cloze）、5 文意選填（#bank）、6 篇章結構（#struct）、7 閱讀測驗（#read）、8 混合題（#mixed）、9 中譯英（#trans）
const CZ_MODE = { name: '綜合測驗', desc: '每回 2 篇短文、每篇 5 格，附詳解與中譯' };
const BK_MODE = { name: '文意選填', desc: '每回 10 格配 10 個選項，附解析與中譯' };
const PS_MODE = { name: '篇章結構', desc: '每回 4 格配 5 個句子，附解析與中譯' };
const RD_MODE = { name: '閱讀測驗', desc: '每回 3 篇文章、每篇 4 題，附詳解與中譯' };
const MX_MODE = { name: '混合題', desc: '每回 1 個題組：填充、多選、簡答，附解析' };
const TR_MODE = { name: '中譯英', desc: '看中文寫出英文句子，附參考解答' };
const SETS = [
  { id: 'cloze', m: CZ_MODE, n: CZ.length, next: 'czNext' }, { id: 'bank', m: BK_MODE, n: BK.length, next: 'bkNext' },
  { id: 'struct', m: PS_MODE, n: PS.length, next: 'psNext' }, { id: 'read', m: RD_MODE, n: RD.length, next: 'rdNext' },
  { id: 'mixed', m: MX_MODE, n: MX.length, next: 'mxNext' }, { id: 'trans', m: TR_MODE, n: TR.length, next: 'trNext' },
].filter(x => x.n);
const MODE_NO = {};
SETS.forEach((x, i) => { MODE_NO[x.id] = MAIN_MODES.length + 1 + i; });
const MAIN_N = '三四五六七八九'[SETS.length];
const modeName = m => (MODES.find(x => x.id === m) || {}).name || '練習';
function hasType(t, w) {
  if (t === 'cloze') return ORIG.has(w.i);
  if (t === 'past') return PAST_BY.has(w.i);
  if (t === 'coll') return w.kb.length > 0;
  if (t === 'listen') return canListen();
  return true;
}
function modeHas(mode, w) {
  if (mode === 'mix' || mode === 'cards') return true;
  if (mode === 'mock') { const src = S.setup.mockSrc; return (src !== 'past' && ORIG.has(w.i)) || (src !== 'orig' && PAST_BY.has(w.i)); }
  return hasType(mode, w);
}
function clash(a, b) { if (a === b || a.syn.has(b.i)) return true; for (const x of a.bi) if (b.bi.has(x)) return true; return false; }
function pickDistractors(w, n = 3) {
  const out = [];
  const tryPool = pool => { for (const x of shuffle(pool)) { if (out.length >= n) return; if (x === w || out.includes(x) || (x.g === w.g && x.cat === w.cat) || clash(w, x) || out.some(y => clash(y, x))) continue; out.push(x); } };
  const same = w.card.words.filter(x => x.p1 === w.p1);
  const sec = (BYPOS[w.p1] || []).filter(x => x.card.sec === w.card.sec && x.g !== w.g);
  tryPool(same); tryPool(sec); tryPool(BYPOS[w.p1] || []); tryPool(W);
  if (out.length < n) for (const x of shuffle(W)) { if (out.length >= n) break; if (x !== w && !out.includes(x) && !clash(w, x)) out.push(x); }
  return out;
}
function mixType(w) {
  const o = [['e2c', 3], ['c2e', 3]];
  if (ORIG.has(w.i)) o.push(['cloze', 4]);
  if (PAST_BY.has(w.i)) o.push(['past', 3]);
  if (canListen()) o.push(['listen', 1]);
  if (S.set.mixTyping) { o.push(['spell', 1]); if (w.kb.length) o.push(['coll', 1]); }
  let r = Math.random() * o.reduce((a, b) => a + b[1], 0);
  for (const [t, wt] of o) if ((r -= wt) < 0) return t;
  return 'e2c';
}
function makeQ(t, w, p) {
  if (t === 'cloze') {
    const o = ORIG.get(w.i), ans = o.s.match(/\{([^}]+)\}/)[1];
    return { t, wi: w.i, opts: shuffle([{ t: ans, wi: w.i, ok: 1 }, ...o.ds.map((d, j) => ({ t: d, wi: o.di[j], ok: 0 }))]) };
  }
  if (t === 'past') {
    p = p || pickOne(PAST_BY.get(w.i));
    return { t, wi: w.i, pid: p.id, opts: p.opts.map((x, j) => ({ t: x, wi: p.oi[j], ok: j === p.ans ? 1 : 0 })) };
  }
  if (t === 'coll') { const k = pickOne(w.kb); return { t, wi: w.i, k, acc: [k.match(/\{([^}]+)\}/)[1].toLowerCase()], h: 1 }; }
  if (t === 'spell') return { t, wi: w.i, acc: w.forms.slice(), h: 1 };
  const ds = pickDistractors(w);
  return { t, wi: w.i, opts: shuffle([w, ...ds]).map(x => ({ t: t === 'c2e' ? x.w : x.zh, wi: x.i, ok: x === w ? 1 : 0 })) };
}
function retryOf(q) {
  const c = { ...q, retry: 1 };
  if (q.opts && q.t !== 'past') c.opts = shuffle(q.opts);
  if (q.h) c.h = 1;
  return c;
}

/* ================= 範圍與排序 ================= */
const FILTERS = [['all', '全部'], ['new', '沒學過'], ['learning', '學習中'], ['due', '到期複習'], ['wrong', '錯題本'], ['fav', '收藏'], ['ans', '曾當考題答案'], ['recent', '近十年學測出現']];
function passFilter(w, f, t) {
  const s = S.w[w.w];
  switch (f) {
    case 'new': return lvl(w) === 0;
    case 'learning': return lvl(w) === 1;
    case 'due': return !!(s && s.b > 0 && s.d <= t);
    case 'wrong': return !!(s && s.wb);
    case 'fav': return !!S.fav[w.w];
    case 'ans': return w.ca > 0;
    case 'recent': return w.g10 > 0;
    default: return true;
  }
}
function rangeWords(st = S.setup) {
  const cs = new Set(st.cards), lv = new Set(st.levels), t = today();
  return W.filter(w => cs.has(w.g) && lv.has(w.lv) && passFilter(w, st.filter, t));
}
function orderWords(list, order) {
  if (order === 'seq') return list.slice().sort((a, b) => a.i - b.i);
  if (order === 'weak') {
    const t = today();
    const sc = w => { const s = S.w[w.w]; if (!s || (!s.n && !s.b)) return 3; if (s.wb) return 0; if (s.d <= t) return 1; return 2 + s.b / 10; };
    return shuffle(list).sort((a, b) => sc(a) - sc(b));
  }
  return shuffle(list);
}
function rangeLabel(st) {
  if (st.cards.length === CARDS.length) return '全部 60 組';
  const secs = SECS.filter(s => s.cards.every(n => st.cards.includes(n)));
  const partial = st.cards.filter(n => !secs.some(s => s.cards.includes(n)));
  const parts = secs.map(s => `${s.key} ${s.name}`);
  if (partial.length) parts.push(partial.length <= 4 ? `第 ${partial.sort((a, b) => a - b).join('、')} 組` : `另 ${partial.length} 組`);
  return `${st.cards.length} 組：${parts.join('、')}`;
}

/* ================= 介面小元件 ================= */
let toastT = 0;
function toast(msg) { const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
let dlgDone = null;
function ask(msg, yes = '確定', no = '取消') {
  return new Promise(res => {
    const d = $('#dialog');
    $('#dlgMsg').textContent = msg; $('#dlgYes').textContent = yes; $('#dlgNo').textContent = no;
    d.hidden = false;
    const done = v => { d.hidden = true; dlgDone = null; res(v); };
    dlgDone = done;
    $('#dlgYes').onclick = () => done(true);
    $('#dlgNo').onclick = () => done(false);
    setTimeout(() => $('#dlgNo').focus(), 30);
  });
}
function openSheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; $('.sheet').scrollTop = 0; }
let sheetClose = null;
function closeSheet() { $('#sheet').hidden = true; const f = sheetClose; sheetClose = null; if (f) f(); }
const sayBtn = (text, cls = 'say') => S.set.sound && TTS.ok ? `<button class="${cls}" type="button" data-act="say" data-text="${esc(text)}" aria-label="念出 ${esc(text)}">${ICON.speak}</button>` : '';
const starBtn = w => `<button class="icon-btn ${isFav(w) ? 'on' : ''}" type="button" data-act="star" data-wi="${w.i}" aria-pressed="${isFav(w)}" aria-label="收藏 ${esc(w.w)}">${ICON.star}</button>`;
function mbar(L) {
  return `<div class="mbar" role="img" aria-label="精熟 ${L[3]}、熟悉 ${L[2]}、學習中 ${L[1]}、未學 ${L[0]}">${[3, 2, 1, 0].filter(k => L[k]).map(k => `<i class="L${k}" style="flex:${L[k]} 1 0"></i>`).join('')}</div>`;
}
function legend(L) { return `<div class="legend">${[[3, '精熟'], [2, '熟悉'], [1, '學習中'], [0, '未學']].map(([k, n]) => `<span><i class="L${k}"></i>${n} <b>${L[k]}</b></span>`).join('')}</div>`; }
function minibar(L) { return `<span class="minibar">${[3, 2, 1, 0].filter(k => L[k]).map(k => `<i class="L${k}" style="flex:${L[k]} 1 0"></i>`).join('')}</span>`; }
function wordRow(w, meta = '') {
  const L = lvl(w);
  return `<div class="wrow"><span class="dot L${L}" title="${LVN[L]}"></span><button class="main" type="button" data-act="word" data-wi="${w.i}"><b>${esc(w.w)}</b><small><i>${esc(w.p)}</i>${esc(w.zh)}</small></button><span class="side">${meta ? `<span class="meta">${meta}</span>` : ''}${starBtn(w)}</span></div>`;
}
const blankStem = s => esc(s).replace(/\{[^}]+\}/, '<span class="blank">_____</span>');
const fillStem = s => esc(s).replace(/\{([^}]+)\}/, '<mark>$1</mark>');
const pastBlank = p => esc(p.stem).replace('_____', '<span class="blank">_____</span>');
const pastFill = p => esc(p.stem).replace('_____', `<mark>${esc(p.opts[p.ans])}</mark>`);
function exHTML(ex) {
  if (!ex) return '';
  const i = ex.indexOf('：');
  const src = i > 0 ? ex.slice(0, i) : '', txt = i > 0 ? ex.slice(i + 1) : ex;
  return `<p class="ex">${esc(txt).replace(/\[([^\]]+)\]/g, '<mark>$1</mark>')}</p>${src ? `<p class="src">出處：大考中心 ${esc(src)}英文考科（節錄）</p>` : ''}`;
}
function patHTML(a, h) { return a.split('').map((ch, i) => i < h ? `<b>${esc(ch)}</b>` : /[A-Za-z]/.test(ch) ? '_' : esc(ch)).join(' '); }
async function copyText(text, okMsg = '已複製') {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch (e) { showCopyBox(text, '請長按下面的文字，全選後複製。'); }
}
function showCopyBox(text, msg) {
  openSheet(`<h2 id="sheetTitle">複製文字</h2><p class="muted">${esc(msg)}</p><textarea class="copybox" id="copyBox" readonly>${esc(text)}</textarea>`);
  setTimeout(() => { const b = $('#copyBox'); if (b) { b.focus(); b.select(); } }, 60);
}
function download(name, text) {
  if (ENV === 'artifact') { showCopyBox(text, '預覽版不能下載檔案。請把下面的備份碼複製起來，貼到記事本保存。'); return; }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
    toast('備份檔已下載');
  } catch (e) { showCopyBox(text, '無法下載檔案，請改用複製備份碼。'); }
}

/* ================= 分頁 ================= */
let view = 'home', cardNo = 1, searchQ = '', listTab = 'wrong', listSort = 'recent';

function vHome() {
  const t = today(), rec = S.days[dkey()] || { q: 0, c: 0, f: 0 };
  const due = W.filter(w => isDue(w, t));
  const wrongN = W.filter(isWrong).length;
  const fresh0 = W.filter(w => lvl(w) === 0);
  const pct = Math.min(100, Math.round(rec.q / S.set.goal * 100));
  const exam = dnum(S.set.exam), left = exam == null ? null : exam - t;
  const L = levelCounts(W), stk = streak();
  const ss = S.sess;
  const resume = ss && ss.i < ss.qs.length ? `<div class="resume"><p>上次的「${esc(ss.title)}」做到第 ${ss.i + 1} / ${ss.qs.length} 題</p><div class="btn-row" style="flex:none"><button class="btn small ghost" type="button" data-act="dropResume">不用了</button><button class="btn small primary" type="button" data-act="resume">繼續</button></div></div>` : '';
  return `
  <header class="top">
    <div><p class="eyebrow">學測英文復興計劃</p><h1>今天練什麼？</h1></div>
    ${left != null && left >= 0 ? `<div class="countdown" aria-label="距離學測還有 ${left} 天"><span>距學測</span><b>${left}</b><span>天・${md(exam)}（${wk(exam)}）</span></div>` : ''}
  </header>
  ${resume}
  <section class="card goal">
    <div class="ring" style="--p:${pct}" role="img" aria-label="今天已答 ${rec.q} 題，目標 ${S.set.goal} 題"><div><b>${rec.q}</b><small>/ ${S.set.goal} 題</small></div></div>
    <div class="goal-txt">
      <h2>${rec.q >= S.set.goal ? '今天的目標達成了' : `今天還差 ${S.set.goal - rec.q} 題`}</h2>
      <p>答對 ${rec.c} 題${rec.f ? `・看了 ${rec.f} 張字卡` : ''}</p>
      ${stk ? `<span class="streak">連續 ${stk} 天</span>` : ''}
    </div>
  </section>
  <section class="hero-actions">
    <button class="big ${due.length ? 'primary' : ''}" type="button" data-act="review"><b>今日複習</b><span>${due.length ? `${due.length} 個字到期，這輪複習 ${Math.min(due.length, S.set.reviewN)} 個` : '目前沒有到期的字'}</span></button>
    <button class="big ${due.length ? '' : 'primary'}" type="button" data-act="learn"><b>學新字</b><span>${fresh0.length ? `從第 ${fresh0[0].g} 組接著學 ${Math.min(S.set.newN, fresh0.length)} 個` : '1800 字都學過了'}</span></button>
  </section>
  <section class="card">
    <div class="sec-h"><h2>${MAIN_N}種練習模式</h2><span class="muted num">${esc(rangeLabel(S.setup).split('：')[0])}・每次 ${S.setup.count} 題</span></div>
    <div class="modes3 home">${MAIN_MODES.map((id, k) => `<button class="mode main" type="button" data-act="quickMode" data-m="${id}"><span class="mnum">${k + 1}</span><b>${TYPES[id].name}</b><span>${TYPES[id].desc}</span></button>`).join('')}${SETS.map(x => `<button class="mode main" type="button" data-act="${x.next}"><span class="mnum">${MODE_NO[x.id]}</span><b>${x.m.name}</b><span>${x.m.desc}</span></button>`).join('')}</div>
  </section>
  <section class="quick">
    <button type="button" data-act="goWrong"><b class="num">${wrongN}</b>錯題本</button>
    <button type="button" data-act="mockNow"><b class="num">10 題</b>模擬考</button>
    <button type="button" data-act="goFav"><b class="num">${Object.keys(S.fav).length}</b>收藏</button>
  </section>
  <section class="card">
    <div class="sec-h"><h2>1800 字掌握度</h2><span class="muted num">熟悉以上 ${L[2] + L[3]} 字</span></div>
    ${mbar(L)}${legend(L)}
  </section>
  ${!storeOK ? '<p class="empty">這個瀏覽器目前無法儲存進度，關掉網頁後紀錄會消失。</p>' : ''}`;
}

// 題組型模式的進度：d 的每一筆是 [對答案那天, 答對數]
const dSum = d => Object.values(d).reduce((n, v) => n + (v[1] || 0), 0);
function setNote(id) {
  const n = k => Object.keys(S[k].d).length;
  return id === 'cloze' ? `已做 ${n('cz')} / ${CZ_N} 篇・點了看全部 ${CZ.length} 回`
    : id === 'read' ? `已做 ${n('rd')} / ${RD_N} 篇・點了看全部 ${RD.length} 回`
    : id === 'bank' ? `已做 ${n('bk')} / ${BK.length} 回・點了看全部題目`
    : id === 'struct' ? `已做 ${n('ps')} / ${PS.length} 回・點了看全部題目`
    : id === 'mixed' ? `已做 ${n('mx')} / ${MX.length} 回・點了看全部題目`
    : `已練 ${trDoneN()} / ${TR.length} 組・點了看全部題目`;
}
function vPractice() {
  const st = S.setup, range = rangeWords(st), inR = new Set(range.map(w => w.i));
  const cnt = m => m === 'past' ? PAST.filter(p => inR.has(p.wi)).length : range.filter(w => modeHas(m, w)).length;
  const chip = (k, v, on, label) => `<button class="chip" type="button" data-act="opt" data-k="${k}" data-v="${v}" aria-pressed="${on}">${label}</button>`;
  const isMock = st.mode === 'mock';
  const avail = cnt(st.mode);
  const n = isMock ? Math.min(st.mockN, avail) : st.mode === 'past' ? Math.min(st.count, avail) : Math.min(st.count, avail);
  return `
  <header class="top"><div><p class="eyebrow">自訂練習</p><h1>選題型和範圍</h1></div></header>
  <section class="opt-group"><span class="opt-label">${MAIN_N}種主要模式</span>
    <div class="modes3">${MODES.filter(m => MAIN_MODES.includes(m.id)).map((m, k) => modeBtn(m, cnt(m.id), st.mode, k + 1)).join('')}${SETS.map(x => `<button class="mode main" type="button" data-act="go" data-to="${x.id}"><span class="mnum">${MODE_NO[x.id]}</span><b>${x.m.name}</b><span>${x.m.desc}</span><em>${setNote(x.id)}</em></button>`).join('')}</div>
  </section>
  <section class="opt-group"><span class="opt-label">更多練習</span>
    <div class="modes">${MODES.filter(m => !MAIN_MODES.includes(m.id)).map(m => modeBtn(m, cnt(m.id), st.mode)).join('')}</div>
  </section>
  <section class="card opt-group">
    <div class="range-sum"><div style="min-width:0"><span class="opt-label">範圍</span><p>${esc(rangeLabel(st))}</p></div><button class="btn small" type="button" data-act="pickCards">選組別</button></div>
    <div class="opt-group"><span class="opt-label">級別（大考中心詞彙表）</span><div class="chips">${[3, 4, 5].map(l => chip('lv', l, st.levels.includes(l), `第 ${l} 級`)).join('')}</div></div>
    <div class="opt-group"><span class="opt-label">篩選</span><div class="chips">${FILTERS.map(([k, nm]) => chip('filter', k, st.filter === k, nm)).join('')}</div></div>
    ${isMock ? `
    <div class="opt-group"><span class="opt-label">題數</span><div class="chips">${[10, 20, 30].map(v => chip('mockN', v, st.mockN === v, `${v} 題`)).join('')}</div></div>
    <div class="opt-group"><span class="opt-label">題目來源</span><div class="chips">${[['mix', '原創＋歷屆'], ['orig', '只出原創題'], ['past', '只出歷屆題']].map(([k, nm]) => chip('mockSrc', k, st.mockSrc === k, nm)).join('')}</div></div>
    <div class="opt-group"><span class="opt-label">時間</span><div class="chips">${chip('mockTimed', 1, st.mockTimed, '每題 1 分鐘')}${chip('mockTimed', 0, !st.mockTimed, '不限時')}</div></div>` : `
    <div class="opt-group"><span class="opt-label">${st.mode === 'cards' ? '張數' : '題數'}</span><div class="chips">${[10, 20, 30, 50, 100].map(v => chip('count', v, st.count === v, String(v))).join('')}</div></div>
    <div class="opt-group"><span class="opt-label">出題順序</span><div class="chips">${[['random', '隨機'], ['seq', '依組別順序'], ['weak', '弱點優先']].map(([k, nm]) => chip('order', k, st.order === k, nm)).join('')}</div></div>`}
    <p class="muted" style="font-size:.85rem">符合範圍的字：${range.length} 個${st.mode !== 'mix' && st.mode !== 'cards' ? `，${modeName(st.mode)}可出 ${avail} ${st.mode === 'past' || isMock ? '題' : '字'}` : ''}</p>
  </section>
  <div class="start-bar"><button class="btn primary" type="button" data-act="startSetup" ${n ? '' : 'disabled'}>${n ? `開始${modeName(st.mode)}・${n} ${st.mode === 'cards' ? '張' : '題'}` : '這個範圍沒有題目'}</button></div>`;
}

function modeBtn(m, c, cur, num) {
  const dis = m.id === 'listen' && !canListen();
  const unit = m.id === 'past' || m.id === 'mock' ? '題' : '字';
  return `<button class="mode ${num ? 'main' : ''}" type="button" data-act="setMode" data-m="${m.id}" aria-pressed="${cur === m.id}" ${dis ? 'disabled' : ''}>${num ? `<span class="mnum">${num}</span>` : ''}<b>${m.name}</b><span>${dis ? '這個瀏覽器不支援發音，或已在設定關閉' : m.desc}</span><em>${c} ${unit}可出</em></button>`;
}

function cardPickHTML() {
  const sel = new Set(S.setup.cards);
  return `<h2 id="sheetTitle">選擇組別</h2>
  <div class="btn-row"><button class="btn small" type="button" data-act="cardsAll" data-v="1">全選</button><button class="btn small" type="button" data-act="cardsAll" data-v="0">全不選</button><button class="btn small primary" type="button" data-act="closeSheet">完成（${sel.size} 組）</button></div>
  <div class="pickcards">${SECS.map(sec => `<div class="sec"><div class="sec-h"><h2>${sec.key} ${esc(sec.name)}</h2><button class="btn small ghost" type="button" data-act="secToggle" data-s="${sec.key}">${sec.cards.every(n => sel.has(n)) ? '取消這類' : '整類選取'}</button></div>
    <div class="cgrid">${sec.cards.map(no => `<button class="cpick" type="button" data-act="cardToggle" data-no="${no}" aria-pressed="${sel.has(no)}"><b>${pad2(no)}</b>${esc(CARDS[no - 1].topic)}</button>`).join('')}</div></div>`).join('')}</div>`;
}

function sectionsHTML() {
  return SECS.map(sec => `<section class="sec-block"><h2>${sec.key} ${esc(sec.name)}<span>第 ${sec.cards[0]}–${sec.cards[sec.cards.length - 1]} 組</span></h2>
    <div class="clist">${sec.cards.map(no => { const c = CARDS[no - 1], L = levelCounts(c.words); return `<a class="crow" href="#card-${no}"><span class="no">${pad2(no)}</span><span class="t"><b>${esc(c.topic)}</b><small>${esc(c.en)}</small>${minibar(L)}</span><span class="pc">${L[2] + L[3]}/${c.words.length}<br>熟悉</span></a>`; }).join('')}</div></section>`).join('');
}
function searchWords(q) {
  q = norm(q); if (!q) return [];
  const zh = /[㐀-鿿]/.test(q), res = [];
  for (const w of W) {
    let sc = -1;
    if (zh) { if (w.zh.includes(q)) sc = w.zh.startsWith(q) ? 1 : 2; else if (w.cat.includes(q) || w.card.topic.includes(q)) sc = 4; }
    else {
      const head = w.w.toLowerCase();
      if (w.forms.includes(q)) sc = 0;
      else if (w.forms.some(f => f.startsWith(q))) sc = 1;
      else if (q.length >= 4 && w.forms.some(f => f.length >= 3 && q.startsWith(f) && q.length - f.length <= 3)) sc = 1.5;
      else if (head.includes(q)) sc = 2;
      else if (w.k.some(k => k.toLowerCase().replace(/[{}]/g, '').includes(q))) sc = 3;
    }
    if (sc >= 0) res.push([sc, w]);
  }
  return res.sort((a, b) => a[0] - b[0] || a[1].i - b[1].i).slice(0, 80).map(x => x[1]);
}
function resultsHTML() {
  const list = searchWords(searchQ);
  if (!list.length) return `<p class="empty">找不到「${esc(searchQ)}」。可以輸入英文、中文意思或搭配詞。</p>`;
  return `<p class="muted" style="font-size:.85rem">${list.length >= 80 ? '前 80' : list.length} 個結果</p><div class="wlist">${list.map(w => wordRow(w, `第 ${w.g} 組`)).join('')}</div>`;
}
function vWords() {
  return `<header class="top"><div><p class="eyebrow">單字庫</p><h1>60 組・1800 字</h1></div></header>
  <div class="search">${ICON.search}<input id="q" type="search" placeholder="搜尋英文、中文或搭配詞" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" value="${esc(searchQ)}" aria-label="搜尋單字"></div>
  <div id="results" class="view">${searchQ.trim() ? resultsHTML() : sectionsHTML()}</div>`;
}
function vCard(no) {
  const c = CARDS[no - 1], L = levelCounts(c.words);
  let last = '';
  const rows = c.words.map(w => { const h = w.cat !== last ? `<div class="cat-h">${esc(w.cat)}</div>` : ''; last = w.cat; return h + wordRow(w); }).join('');
  return `<div><a class="back" href="#words">${ICON.left}單字庫</a>
  <header class="top"><div><p class="eyebrow">${esc(c.sec)} ${esc(c.secName)}・第 ${no} 組</p><h1>${esc(c.topic)}</h1><p class="muted en">${esc(c.en)}</p></div></header></div>
  <section class="card">${mbar(L)}${legend(L)}</section>
  <div class="btn-row"><button class="btn primary" type="button" data-act="cardQuiz" data-no="${no}">練習這組 30 字</button><button class="btn" type="button" data-act="cardFlash" data-no="${no}">看字卡</button></div>
  <div class="wlist">${rows}</div>
  <div class="btn-row">${no > 1 ? `<a class="btn" href="#card-${no - 1}">${ICON.left}第 ${no - 1} 組</a>` : ''}${no < CARDS.length ? `<a class="btn" href="#card-${no + 1}">第 ${no + 1} 組${ICON.right}</a>` : ''}</div>`;
}

function listWords(tab) {
  if (tab === 'fav') return W.filter(isFav);
  if (tab === 'grad') return W.filter(w => { const s = S.w[w.w]; return s && !s.wb && s.x > 0; });
  return W.filter(isWrong);
}
function vWrong() {
  const tabs = [['wrong', '錯題'], ['fav', '收藏'], ['grad', '已畢業'], ['sets', '題組']];
  const tabN = k => k === 'sets' ? wkWrong().length : listWords(k).length;
  const head = `<header class="top"><div><p class="eyebrow">我的清單</p><h1>錯題本與收藏</h1></div></header>
  <div class="chips" role="tablist">${tabs.map(([k, n]) => `<button class="chip" type="button" role="tab" data-act="listTab" data-v="${k}" aria-pressed="${listTab === k}" aria-selected="${listTab === k}">${n} ${tabN(k)}</button>`).join('')}</div>`;
  if (listTab === 'sets') return head + wkListHTML();   // 題組的答錯題目另外列（前三個分頁是單字）
  let list = listWords(listTab);
  if (listTab !== 'fav') list = list.slice().sort((a, b) => { const x = S.w[a.w], y = S.w[b.w]; return listSort === 'often' ? (y.x - x.x) || (y.lw - x.lw) : (y.lw - x.lw) || (y.x - x.x); });
  const meta = w => { const s = S.w[w.w]; return listTab === 'fav' ? `第 ${w.g} 組` : `錯 ${s.x} 次・${md(s.lw)}`; };
  const emptyMsg = {
    wrong: `還沒有錯題。練習時答錯的字會自動收進來；之後在 ${S.set.grad || '數'} 個不同的日子答對，就會自動移出。`,
    fav: '還沒有收藏。看到想加強的字，點星號就會收進這裡。',
    grad: '答錯後又練會的字會移到這裡。',
  }[listTab];
  return `${head}
  ${list.length ? `
  <div class="btn-row"><button class="btn primary" type="button" data-act="listQuiz">練習這 ${list.length} 個字</button><button class="btn" type="button" data-act="listCards">看字卡</button><button class="btn" type="button" data-act="copyList">複製清單</button></div>
  ${listTab !== 'fav' ? `<div class="chips">${[['recent', '最近答錯'], ['often', '最常答錯']].map(([k, n]) => `<button class="chip" type="button" data-act="listSort" data-v="${k}" aria-pressed="${listSort === k}">${n}</button>`).join('')}</div>` : ''}
  <div class="wlist">${list.map(w => wordRow(w, meta(w))).join('')}</div>` : `<p class="empty">${emptyMsg}</p>`}`;
}

function vMe() {
  const t = today();
  let tq = 0, tc = 0, days = 0;
  for (const k in S.days) { const r = S.days[k]; tq += r.q || 0; tc += r.c || 0; if (r.q || r.f || r.t) days++; }
  const L = levelCounts(W);
  const bars = []; let mx = 1;
  for (let k = 13; k >= 0; k--) { const r = S.days[dkey(t - k)] || {}; bars.push({ n: t - k, q: r.q || 0 }); mx = Math.max(mx, r.q || 0); }
  const maxI = bars.reduce((b, x, i) => x.q > bars[b].q ? i : b, 0);
  const chart = `<div class="bars" role="img" aria-label="近 14 天每日答題數">${bars.map((b, i) => { const h = Math.round(b.q / mx * 100); return `<div class="b ${b.q ? '' : 'zero'} ${(i === 13 || (i === maxI && b.q)) && b.q ? 'lab' : ''}" style="--h:${h}%" tabindex="0" title="${md(b.n)}：${b.q} 題"><em>${b.q}</em><i style="height:${h}%"></i></div>`; }).join('')}</div>
    <div class="bars-x">${bars.map((b, i) => `<span>${i % 2 === 1 ? md(b.n) : ''}</span>`).join('')}</div>`;
  const heat = SECS.map(sec => `<div class="heat-row"><span>${sec.key} ${esc(sec.name)}</span><div class="heat-cells">${sec.cards.map(no => { const c = CARDS[no - 1], f = c.words.filter(w => lvl(w) >= 2).length / c.words.length; const h = f === 0 ? 0 : f < .25 ? 1 : f < .5 ? 2 : f < .75 ? 3 : 4; return `<a class="H${h} ${h >= 3 ? 'hi' : ''}" href="#card-${no}" title="第 ${no} 組 ${esc(c.topic)}：熟悉以上 ${Math.round(f * 100)}%">${no}</a>`; }).join('')}</div></div>`).join('');
  const trN = trDoneN();
  const setRec = (name, d, total, unit, per, pu) => { const n = Object.keys(d).length; return n ? `<div><span>${name}</span><b>已做 ${n} / ${total} ${unit}<span class="muted">（答對 ${dSum(d)} / ${n * per} ${pu}）</span></b></div>` : ''; };
  const modes = Object.keys(TYPES).filter(k => S.modes[k] && S.modes[k].q).map(k => `<div><span>${TYPES[k].name}</span><b>${Math.round(S.modes[k].c / S.modes[k].q * 100)}%<span class="muted">（${S.modes[k].c}/${S.modes[k].q}）</span></b></div>`).join('')
    + setRec(CZ_MODE.name, S.cz.d, CZ_N, '篇', 5, '題') + setRec(BK_MODE.name, S.bk.d, BK.length, '回', 10, '格') + setRec(PS_MODE.name, S.ps.d, PS.length, '回', 4, '格')
    + setRec(RD_MODE.name, S.rd.d, RD_N, '篇', 4, '題') + setRec(MX_MODE.name, S.mx.d, MX.length, '回', 4, '題')
    + (trN ? `<div><span>${TR_MODE.name}</span><b>已練 ${trN} / ${TR.length} 組</b></div>` : '');
  const often = W.filter(w => S.w[w.w] && S.w[w.w].x > 0).sort((a, b) => S.w[b.w].x - S.w[a.w].x).slice(0, 8);
  const sel = (k, opts) => `<select data-set="${k}" id="set-${k}">${opts.map(([v, n]) => `<option value="${v}" ${String(S.set[k]) === String(v) ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  const sw = (k, label) => `<label class="switch"><input type="checkbox" data-set="${k}" id="set-${k}" ${S.set[k] ? 'checked' : ''} aria-label="${label}"><span></span></label>`;
  const row = (b, s, ctl) => `<div class="set-row"><div><b>${b}</b>${s ? `<small>${s}</small>` : ''}</div>${ctl}</div>`;
  return `<header class="top"><div><p class="eyebrow">學習紀錄</p><h1>我的進度</h1></div></header>
  <section class="tiles">
    <div class="tile"><b>${streak()}</b><span>連續學習天數</span></div>
    <div class="tile"><b>${tq}</b><span>累計答題</span></div>
    <div class="tile"><b>${tq ? Math.round(tc / tq * 100) + '%' : '—'}</b><span>整體正確率</span></div>
    <div class="tile"><b>${L[2] + L[3]}</b><span>熟悉以上的字</span></div>
  </section>
  <section class="card"><div class="sec-h"><h2>近 14 天答題數</h2><span class="muted">學習 ${days} 天</span></div>${chart}</section>
  <section class="card"><div class="sec-h"><h2>60 組熟悉度</h2><span class="muted">顏色越深，熟悉的字越多</span></div><div class="heat">${heat}</div>
    <div class="legend"><span><i class="H0"></i>0%</span><span><i class="H1"></i>未滿 25%</span><span><i class="H2"></i>25–49%</span><span><i class="H3"></i>50–74%</span><span><i class="H4"></i>75% 以上</span></div></section>
  <section class="card"><div class="sec-h"><h2>1800 字掌握度</h2></div>${mbar(L)}${legend(L)}
    <p class="muted" style="font-size:.8rem;margin-top:10px">答對一次升一級，同一天只升一次；間隔 1、2、4、7、15、30 天再考。答錯回到「學習中」，並收進錯題本。</p></section>
  ${modes ? `<section class="card"><div class="sec-h"><h2>各題型紀錄</h2></div><div class="kv">${modes}</div></section>` : ''}
  ${wkCard()}
  ${often.length ? `<section class="card"><div class="sec-h"><h2>最常答錯</h2></div><div class="wlist">${often.map(w => wordRow(w, `錯 ${S.w[w.w].x} 次`)).join('')}</div></section>` : ''}
  <section class="card"><div class="sec-h"><h2>設定</h2></div><div class="set-list">
    ${row('每日目標', '首頁圓環的題數', sel('goal', [10, 20, 30, 50, 80, 100].map(v => [v, `${v} 題`])))}
    ${row('每次學新字', '「學新字」一次幾個', sel('newN', [5, 10, 15, 20, 30].map(v => [v, `${v} 個`])))}
    ${row('每輪複習上限', '「今日複習」一次最多幾個字', sel('reviewN', [20, 30, 50, 100].map(v => [v, `${v} 個`])))}
    ${row('錯題本自動移出', '答錯後，在幾個不同的日子答對就移出', sel('grad', [[1, '答對 1 天'], [2, '答對 2 天'], [3, '答對 3 天'], [0, '不自動移出']]))}
    ${TTS.ok ? row('發音', '使用裝置內建的英文語音', sw('sound', '發音')) + row('答題後自動念出單字', '', sw('autoSay', '答題後自動念出單字')) + row('口音', '', sel('accent', [['en-US', '美式'], ['en-GB', '英式']])) + row('語速', '', sel('rate', [[0.7, '慢'], [0.9, '稍慢'], [1, '正常']])) : row('發音', '這個瀏覽器不支援語音，聽音題型無法使用', '')}
    ${row('答對自動下一題', '答對後 1 秒自動換題', sw('autoNext', '答對自動下一題'))}
    ${row('綜合練習加入拼寫題', '混入拼字和搭配詞填空', sw('mixTyping', '綜合練習加入拼寫題'))}
    ${row('字卡先看中文', '正面顯示中文，翻面看英文', sw('zhFirst', '字卡先看中文'))}
    ${ENV !== 'artifact' ? row('外觀', '', sel('theme', [['auto', '跟隨系統'], ['light', '淺色'], ['dark', '深色']])) : ''}
    ${row('字體大小', '', sel('fs', [['m', '標準'], ['l', '大'], ['xl', '特大']]))}
    ${row('學測日期', '首頁倒數用', `<input type="date" data-set="exam" id="set-exam" value="${esc(S.set.exam)}">`)}
  </div></section>
  <section class="card"><div class="sec-h"><h2>備份與換裝置</h2></div>
    <p class="muted" style="font-size:.85rem;margin-bottom:12px">紀錄只存在這個瀏覽器。換手機、換瀏覽器或清除瀏覽資料前，先備份；到新裝置打開網站後匯入。</p>
    <div class="btn-row">${ENV !== 'artifact' ? '<button class="btn" type="button" data-act="exportFile">下載備份檔</button>' : ''}<button class="btn" type="button" data-act="exportCode">複製備份碼</button></div>
    <div class="btn-row" style="margin-top:10px"><label class="btn" for="importFile">匯入備份檔<input type="file" id="importFile" accept=".json,.txt,application/json,text/plain" class="sr"></label><button class="btn" type="button" data-act="importCode">貼上備份碼</button></div>
    <div class="btn-row" style="margin-top:10px"><button class="btn danger" type="button" data-act="reset">清除所有紀錄</button></div>
  </section>
  <section class="card about"><div class="sec-h"><h2 style="color:var(--ink)">關於</h2><span class="num">版本 ${esc(window.APP_VER || '')}</span></div>
    <p>單字：大學入學考試中心《高中英文參考詞彙表》第 3–5 級，依 83–115 年學測與 91–110 年指考的出現情形挑出 1800 字，分 60 組。</p>
    <p>歷屆詞彙題與考題例句：大學入學考試中心 92–115 學年度學測、93–110 學年度指考英文考科，著作權屬大考中心，僅供非營利學習使用。原創題為本站自編。</p>
    ${CZ.length ? `<p>綜合測驗：本站自編 ${CZ.length} 回、${CZ_N} 篇短文，題目、詳解與中譯皆由本站撰寫。</p>` : ''}
    ${BK.length || PS.length ? `<p>文意選填 ${BK.length} 回（每回 10 格）、篇章結構 ${PS.length} 回（每回 4 格）：本站自編，文章、解析與中譯皆由本站撰寫。</p>` : ''}
    ${RD.length ? `<p>閱讀測驗：本站自編 ${RD.length} 回、${RD_N} 篇文章，題目、詳解與中譯皆由本站撰寫。</p>` : ''}
    ${MX.length ? `<p>混合題：本站自編 ${MX.length} 回，題組形式參考 111–115 學年度學測，文章、題目、解析與中譯皆由本站撰寫。</p>` : ''}
    ${TR.length ? '<p>中譯英：本站自編 50 組、100 句，參考解答由本站撰寫；評分方式依大考中心公布的學測英文非選擇題評分原則整理。</p>' : ''}
    <p>作答紀錄只存在你的裝置，不會上傳。</p>
  </section>`;
}

/* ================= 中譯英 ================= */
const trDoneN = () => TR.filter(t => S.tr.d[t.id]).length;
function trNextId() {
  // 先找還沒練過的；全部練過就回到最久沒練的那組
  const un = TR.find(t => !S.tr.d[t.id]);
  if (un) return un.id;
  return TR.slice().sort((a, b) => S.tr.d[a.id] - S.tr.d[b.id] || a.id - b.id)[0].id;
}
function vTrans() {
  const done = trDoneN(), nx = trNextId();
  const ths = Object.keys(TR_TH).filter(k => TR.some(t => t.th === k));
  return `<div><a class="back" href="#practice">${ICON.left}練習</a>
  <header class="top"><div><p class="eyebrow">第 ${MODE_NO.trans} 種模式・${TR.length} 組 ${TR.length * 2} 句</p><h1>${TR_MODE.name}</h1></div><div class="chip-count"><b>${done}</b><span>/ ${TR.length} 組已練</span></div></header></div>
  <section class="card tr-intro">
    <p>照學測的形式，每組 2 句、前後主題相連。先自己寫，再看參考解答；可以打在格子裡，也可以寫在紙上。</p>
    <div class="btn-row"><button class="btn primary" type="button" data-act="trOpen" data-id="${nx}">${done ? `${done === TR.length ? '複習' : '繼續'}：第 ${nx} 組` : '從第 1 組開始'}</button></div>
  </section>
  <section class="card"><div class="sec-h"><h2>學測中譯英怎麼評分</h2></div>
    <ul class="tr-rules"><li>共 2 題，每題 4 分，合計 8 分。</li><li>每個錯誤扣 0.5 分，扣完為止；相同的拼字或文法錯誤只扣一次。</li><li>句首沒有大寫、標點符號不妥，各扣 0.5 分，只扣一次。</li><li>用錯字、拼錯字、時態錯誤、漏譯都會被扣分。</li></ul>
    <p class="src" style="margin-top:8px">依據：大考中心 115 學年度學測英文考科非選擇題評分原則</p></section>
  ${ths.map(k => { const list = TR.filter(t => t.th === k); return `<section class="sec-block"><h2>${k} ${esc(TR_TH[k])}<span>第 ${list[0].id}–${list[list.length - 1].id} 組</span></h2>
    <div class="clist">${list.map(t => `<button class="crow" type="button" data-act="trOpen" data-id="${t.id}"><span class="no">${pad2(t.id)}</span><span class="t"><b>${esc(t.title)}</b><small>${esc(t.s[0].zh)}</small></span><span class="pc">${S.tr.d[t.id] ? '<span class="tr-done">已練</span>' : ''}</span></button>`).join('')}</div></section>`; }).join('')}`;
}

let TRS = null, trSaveT = 0;
function openTrans(id) {
  if (!TR.length) return;
  TRS = { id: TR_BY.has(+id) ? +id : TR[0].id, shown: false };
  openOverlay('trans'); renderTr();
}
function renderTr() {
  const t = TR_BY.get(TRS.id);
  $('#qmode').textContent = TR_MODE.name;
  $('#qprog').textContent = `第 ${t.id} 組 / ${TR.length}`;
  $('#qscore').innerHTML = '';
  $('#qfill').style.width = `${trDoneN() / TR.length * 100}%`;
  let h = `<p class="kicker">第 ${t.id} 組・${esc(TR_TH[t.th] || '')}・${esc(t.title)}</p>
    <p class="tr-ins">請將以下中文句子譯成正確、通順、達意的英文。每題 4 分，共 8 分。</p>
    ${t.s.map((s, k) => `<div class="trq"><p class="trzh"><span class="trn">${k + 1}.</span>${esc(s.zh)}</p>
      <textarea class="trin" id="trin${k + 1}" data-tr="${t.id}-${k + 1}" rows="3" placeholder="在這裡寫英文（也可以寫在紙上）" autocapitalize="sentences" autocorrect="off" spellcheck="false" aria-label="第 ${k + 1} 題的英文翻譯">${esc(S.tr.a[`${t.id}-${k + 1}`] || '')}</textarea></div>`).join('')}`;
  if (!TRS.shown) h += `<div class="btn-row"><button class="btn primary" type="button" data-act="trShow">參考解答</button></div>`;
  else h += t.s.map((s, k) => trAnsHTML(t, s, k)).join('') + '<p class="tr-tip">對照參考答案自己檢查：每個錯誤扣 0.5 分，相同的錯誤只扣一次；句首大寫和句尾標點也要檢查。和參考答案寫法不同，只要文法正確、意思完整也可以得分。</p>';
  h += `<div class="fnav"><button class="btn small" type="button" data-act="trGo" data-id="${t.id - 1}" ${t.id > 1 ? '' : 'disabled'}>${ICON.left}上一組</button><button class="btn small ghost" type="button" data-act="trList">全部題目</button><button class="btn small ${TRS.shown ? 'primary' : ''}" type="button" data-act="trGo" data-id="${t.id + 1}" ${t.id < TR.length ? '' : 'disabled'}>下一組${ICON.right}</button></div>`;
  $('#qbody').innerHTML = h;
  $('#quiz').scrollTop = 0;
}
function trAnsHTML(t, s, k) {
  const mine = S.tr.a[`${t.id}-${k + 1}`] || '';
  const ws = s.wis.map(i => W[i]).filter(Boolean);
  return `<section class="fb tr-ans">
    <div class="fb-h"><b>第 ${k + 1} 題</b></div>
    <p class="tr-q">${esc(s.zh)}</p>
    <div class="tr-mine" id="trmine${k + 1}" ${mine.trim() ? '' : 'hidden'}><span class="lab">你的答案</span><p class="en">${esc(mine)}</p></div>
    <div class="tr-ref"><div class="lab-row"><span class="lab">參考答案</span>${sayBtn(s.ref, 'say sm')}</div><p class="en">${esc(s.ref)}</p></div>
    <div><span class="lab">其他寫法</span>${s.alt.map(a => `<p class="en">${esc(a)}</p>`).join('')}</div>
    <div><span class="lab">句型重點</span><ul class="tr-list">${s.pat.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
    <div><span class="lab">關鍵字詞</span><div class="colls tr-keys">${s.key.map(([z, e]) => `<span><i>${esc(z)}</i>${esc(e)}</span>`).join('')}</div></div>
    <div><span class="lab">易錯提醒</span><ul class="tr-list warn">${s.warn.flatMap(x => x.split('；')).map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
    ${ws.length ? `<div><span class="lab">句中的 1800 單字（點了看字卡）</span><div class="tr-words">${ws.map(w => `<button type="button" class="tr-w" data-act="word" data-wi="${w.i}">${esc(w.w)}</button>`).join('')}</div></div>` : ''}
  </section>`;
}
function trFlush() { if (trSaveT) { clearTimeout(trSaveT); trSaveT = 0; save(); } }
function trInput(el) {
  const k = el.dataset.tr, v = el.value;
  if (v.trim()) S.tr.a[k] = v.slice(0, 2000); else delete S.tr.a[k];
  const m = $('#trmine' + k.split('-')[1]);
  if (m) { m.hidden = !v.trim(); const p = m.querySelector('p'); if (p) p.textContent = v; }
  clearTimeout(trSaveT); trSaveT = setTimeout(() => { trSaveT = 0; save(); }, 400);
}
function trShow() {
  if (OV !== 'trans' || !TRS || TRS.shown) return;
  trFlush();
  const t = today(), id = TRS.id;
  if (S.tr.d[id] !== t) { const r = dayRec(); r.t = (r.t || 0) + 1; }
  S.tr.d[id] = t; save();
  TRS.shown = true; renderTr();
  setTimeout(() => { const a = $('#qbody .tr-ans'); if (a) a.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }, 40);
}

/* ================= 綜合測驗 ================= */
// S.cz.a["回-篇"] = 五個空格的作答（0–3，沒選是 -1）；S.cz.d["回-篇"] = [對答案那天, 答對題數]
const czKey = (no, pi) => `${no}-${pi}`;
const czDoneN = () => Object.keys(S.cz.d).length;
const czSetDone = r => r.p.filter((_, k) => S.cz.d[czKey(r.no, k + 1)]).length;
const czSetScore = r => r.p.reduce((n, _, k) => n + ((S.cz.d[czKey(r.no, k + 1)] || [])[1] || 0), 0);
function czNext() {
  for (const r of CZ) for (let k = 1; k <= r.p.length; k++) if (!S.cz.d[czKey(r.no, k)]) return [r.no, k];
  return [CZ[0].no, 1];
}
function vCloze() {
  const done = czDoneN(), [nn, nk] = czNext();
  return `<div><a class="back" href="#practice">${ICON.left}練習</a>
  <header class="top"><div><p class="eyebrow">第 ${MODE_NO.cloze} 種模式・${CZ.length} 回 ${CZ_N} 篇</p><h1>${CZ_MODE.name}</h1></div><div class="chip-count"><b>${done}</b><span>/ ${CZ_N} 篇已做</span></div></header></div>
  <section class="card tr-intro">
    <p>照學測綜合測驗的形式，每回 2 篇短文、每篇 5 個空格，每題 1 分，一回共 10 分。選好之後對答案，每題都有詳解和選項中譯，文法題會說明句子結構和其他選項錯在哪裡。</p>
    <div class="btn-row"><button class="btn primary" type="button" data-act="czOpen" data-no="${nn}" data-pi="${nk}">${done ? `${done === CZ_N ? '複習' : '繼續'}：第 ${nn} 回第 ${nk} 篇` : '從第 1 回開始'}</button></div>
  </section>
  ${wkModeCard('cloze')}
  ${CZ.map(r => { const dn = czSetDone(r); return `<section class="sec-block"><h2>第 ${pad2(r.no)} 回<span>${dn ? `已做 ${dn} / ${r.p.length} 篇・答對 ${czSetScore(r)} / ${dn * 5} 題` : `${r.p.length} 篇 ${r.p.length * 5} 題`}</span></h2>
    <div class="clist">${r.p.map((p, k) => { const d = S.cz.d[czKey(r.no, k + 1)];
      return `<button class="crow" type="button" data-act="czOpen" data-no="${r.no}" data-pi="${k + 1}"><span class="no">${k + 1}</span><span class="t"><b>第 ${k + 1} 篇</b><small>第 ${k * 5 + 1}–${k * 5 + 5} 題・約 ${Math.round(p.wc / 10) * 10} 字</small></span><span class="pc">${d ? `<span class="tr-done">${d[1]} / 5</span>` : ''}</span></button>`; }).join('')}</div></section>`; }).join('')}`;
}

let CZS = null;
function openCloze(no, pi) {
  if (!CZ.length) return;
  const r = CZ_BY.get(+no) || CZ[0];
  CZS = { no: r.no, pi: Math.min(r.p.length, Math.max(1, +pi || 1)) };
  openOverlay('cloze'); renderCz(true);
}
function czCur() { const r = CZ_BY.get(CZS.no), p = r.p[CZS.pi - 1], key = czKey(r.no, CZS.pi); return { r, p, key, base: (CZS.pi - 1) * 5, done: S.cz.d[key], ans: S.cz.a[key] || [-1, -1, -1, -1, -1] }; }
// 文章中的空格：作答前顯示已選的字（點一下跳到那一題），對答案後顯示正確答案
function czBlank(p, i, base, done, ans) {
  const q = p.q[i], n = base + i + 1;
  if (done) return `<span class="cz-b ${ans[i] === q.a ? 'ok' : 'no'}" id="czb${i}"><b>${n}</b><span>${esc(q.o[q.a])}</span></span>`;
  return `<button type="button" class="cz-b${ans[i] >= 0 ? ' sel' : ''}" id="czb${i}" data-act="czJump" data-q="${i}" aria-label="第 ${n} 格${ans[i] >= 0 ? `，已選 ${q.o[ans[i]]}` : '，尚未作答'}"><b>${n}</b><span>${ans[i] >= 0 ? esc(q.o[ans[i]]) : '＿＿＿'}</span></button>`;
}
function renderCz(top) {
  const { r, p, base, done, ans } = czCur();
  const flat = []; CZ.forEach(x => x.p.forEach((_, k) => flat.push([x.no, k + 1])));
  const idx = flat.findIndex(x => x[0] === r.no && x[1] === CZS.pi) + 1;
  $('#qmode').textContent = CZ_MODE.name;
  $('#qprog').textContent = `第 ${r.no} 回・第 ${CZS.pi} 篇`;
  $('#qscore').innerHTML = done ? `<span class="${done[1] === 5 ? 'ok' : ''}">${done[1]} / 5</span>` : '';
  $('#qfill').style.width = `${czDoneN() / CZ_N * 100}%`;
  let h = `<p class="kicker">第 ${r.no} 回・第 ${CZS.pi} 篇（第 ${base + 1}–${base + 5} 題）</p>
    ${done ? '' : '<p class="tr-ins">依文意選出最適當的答案。選好的字會填進文章的空格裡；點空格可以跳到那一題。</p>'}
    <article class="rd-text cz-text">${p.text.map(x => `<p>${esc(x).replace(/\[(\d+)\]/g, (_, n) => czBlank(p, +n - base - 1, base, done, ans))}</p>`).join('')}</article>`;
  h += p.q.map((q, i) => { const wide = Math.max(...q.o.map(o => o.length)) > 14;
    return `<section class="czq" id="czq${i}">
      <div class="czq-h"><span class="trn">${base + i + 1}.</span>${done ? `<b class="${ans[i] === q.a ? 'ok' : 'no'}">${ans[i] === q.a ? '答對' : `答錯・正解 (${'ABCD'[q.a]})`}</b><span class="rd-tag">${esc(q.t)}</span>` : ''}</div>
      <div class="cz-opts${wide ? ' one' : ''}">${q.o.map((o, j) => `<button class="opt en${rdOptCls(done, q, ans[i], j)}" type="button" data-act="czPick" data-q="${i}" data-j="${j}" ${done ? 'disabled' : ''} aria-pressed="${ans[i] === j}"><span class="key">${'ABCD'[j]}</span><span class="t">${esc(o)}</span></button>`).join('')}</div>
      ${done ? `<div class="rd-exp"><p>${q.e}</p>${q.z ? `<p class="rd-z">${esc(q.z)}</p>` : ''}</div>` : ''}
    </section>`; }).join('');
  if (!done) h += `<div class="btn-row"><button class="btn primary" type="button" data-act="czSubmit">對答案</button></div>`;
  else h += `<section class="fb rd-res" id="czres"><div class="fb-h"><b>這篇答對 ${done[1]} / 5 題</b><button class="btn small" type="button" data-act="czRedo">重做這篇</button></div></section>
    <details class="rd-more"><summary>全文中譯</summary><div class="rd-zh">${p.zh.map(x => `<p>${esc(x)}</p>`).join('')}</div></details>`;
  h += `<div class="fnav"><button class="btn small" type="button" data-act="czGo" data-d="-1" ${idx > 1 ? '' : 'disabled'}>${ICON.left}上一篇</button><button class="btn small ghost" type="button" data-act="czList">全部題目</button><button class="btn small ${done ? 'primary' : ''}" type="button" data-act="czGo" data-d="1" ${idx < flat.length ? '' : 'disabled'}>下一篇${ICON.right}</button></div>`;
  $('#qbody').innerHTML = h;
  if (top) $('#quiz').scrollTop = 0;
}
function czPick(i, j) {
  if (OV !== 'cloze' || !CZS) return;
  const { p, key, base, done, ans } = czCur();
  if (done) return;
  const a = ans.slice(); a[i] = a[i] === j ? -1 : j;
  if (a.some(x => x >= 0)) S.cz.a[key] = a; else delete S.cz.a[key];
  save();
  $$(`#czq${i} [data-act="czPick"]`).forEach(b => { const on = +b.dataset.j === a[i]; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
  const el = $('#czb' + i); if (el) el.outerHTML = czBlank(p, i, base, false, a);
}
function czJump(i) { const el = $('#czq' + i); if (el) el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
function czSubmit() {
  if (OV !== 'cloze' || !CZS) return;
  const { p, key, base, done, ans } = czCur();
  if (done) return;
  const miss = ans.findIndex(x => x < 0);
  if (miss >= 0) { toast(`第 ${base + miss + 1} 題還沒作答`); czJump(miss); return; }
  const c = p.q.filter((q, i) => ans[i] === q.a).length;
  S.cz.a[key] = ans.slice(); S.cz.d[key] = [today(), c];
  const rec = dayRec(); rec.q += p.q.length; rec.c += c;
  save(); renderCz(true);
}
function czRedo() { if (!CZS) return; const { key } = czCur(); delete S.cz.a[key]; delete S.cz.d[key]; save(); TTS.stop(); renderCz(true); }
function czGo(d) {
  if (!CZS) return;
  const flat = []; CZ.forEach(r => r.p.forEach((_, k) => flat.push([r.no, k + 1])));
  const i = flat.findIndex(x => x[0] === CZS.no && x[1] === CZS.pi) + d;
  if (i < 0 || i >= flat.length) return;
  TTS.stop(); CZS = { no: flat[i][0], pi: flat[i][1] }; renderCz(true);
}

/* ================= 閱讀測驗 ================= */
// S.rd.a["回-篇"] = 四題的作答（0–3，沒選是 -1）；S.rd.d["回-篇"] = [對答案那天, 答對題數]
const rdKey = (no, pi) => `${no}-${pi}`;
const rdDoneN = () => Object.keys(S.rd.d).length;
const rdSetDone = r => r.p.filter((_, k) => S.rd.d[rdKey(r.no, k + 1)]).length;
const rdSetScore = r => r.p.reduce((n, _, k) => n + ((S.rd.d[rdKey(r.no, k + 1)] || [])[1] || 0), 0);
function rdNext() {
  for (const r of RD) for (let k = 1; k <= r.p.length; k++) if (!S.rd.d[rdKey(r.no, k)]) return [r.no, k];
  return [RD[0].no, 1];
}
const rdTopic = t => { const m = /^(.*?)（(.*)）$/.exec(t); return m ? [m[1], m[2]] : [t, '']; };
function vRead() {
  const done = rdDoneN(), [nn, nk] = rdNext();
  return `<div><a class="back" href="#practice">${ICON.left}練習</a>
  <header class="top"><div><p class="eyebrow">第 ${MODE_NO.read} 種模式・${RD.length} 回 ${RD_N} 篇</p><h1>${RD_MODE.name}</h1></div><div class="chip-count"><b>${done}</b><span>/ ${RD_N} 篇已做</span></div></header></div>
  <section class="card tr-intro">
    <p>照學測閱讀測驗的形式，每回 3 篇文章、每篇 4 題，每題 2 分，一回共 24 分。先讀文章作答，再對答案看詳解、全文中譯和重要字詞。</p>
    <div class="btn-row"><button class="btn primary" type="button" data-act="rdOpen" data-no="${nn}" data-pi="${nk}">${done ? `${done === RD_N ? '複習' : '繼續'}：第 ${nn} 回第 ${nk} 篇` : '從第 1 回開始'}</button></div>
  </section>
  ${wkModeCard('read')}
  ${RD.map(r => { const dn = rdSetDone(r); return `<section class="sec-block"><h2>第 ${pad2(r.no)} 回<span>${dn ? `已做 ${dn} / ${r.p.length} 篇・答對 ${rdSetScore(r)} / ${dn * 4} 題` : `${r.p.length} 篇 ${r.p.length * 4} 題`}</span></h2>
    <div class="clist">${r.p.map((p, k) => { const d = S.rd.d[rdKey(r.no, k + 1)], [t1, t2] = rdTopic(p.topic);
      return `<button class="crow" type="button" data-act="rdOpen" data-no="${r.no}" data-pi="${k + 1}"><span class="no">${k + 1}</span><span class="t"><b>${d ? esc(t1) : `第 ${k + 1} 篇`}</b><small>${d ? esc(t2 || `${p.wc} 字`) : `4 題・約 ${Math.round(p.wc / 10) * 10} 字`}</small></span><span class="pc">${d ? `<span class="tr-done">${d[1]} / 4</span>` : ''}</span></button>`; }).join('')}</div></section>`; }).join('')}`;
}

let RDS = null;
function openRead(no, pi) {
  if (!RD.length) return;
  const r = RD_BY.get(+no) || RD[0];
  RDS = { no: r.no, pi: Math.min(r.p.length, Math.max(1, +pi || 1)) };
  openOverlay('read'); renderRd(true);
}
function rdCur() { const r = RD_BY.get(RDS.no), p = r.p[RDS.pi - 1], key = rdKey(r.no, RDS.pi); return { r, p, key, done: S.rd.d[key], ans: S.rd.a[key] || [-1, -1, -1, -1] }; }
function rdOptCls(done, q, pickd, j) { return !done ? (pickd === j ? ' sel' : '') : j === q.a ? ' ok' : pickd === j ? ' no' : ' dim'; }
function renderRd(top) {
  const { r, p, done, ans } = rdCur();
  const idx = RD.indexOf(r) * 3 + RDS.pi, [t1, t2] = rdTopic(p.topic);
  $('#qmode').textContent = RD_MODE.name;
  $('#qprog').textContent = `第 ${r.no} 回・第 ${RDS.pi} 篇`;
  $('#qscore').innerHTML = done ? `<span class="${done[1] === 4 ? 'ok' : ''}">${done[1]} / 4</span>` : '';
  $('#qfill').style.width = `${rdDoneN() / RD_N * 100}%`;
  let h = `<p class="kicker">第 ${r.no} 回・第 ${RDS.pi} 篇（共 ${r.p.length} 篇）${done ? `・${esc(t1)}` : ''}</p>
    <article class="rd-text">${p.text.map(x => `<p>${esc(x)}</p>`).join('')}</article>`;
  h += p.q.map((q, i) => `<section class="rdq" id="rdq${i}">
      <p class="rd-stem"><span class="trn">${i + 1}.</span><span>${q.s}</span></p>
      ${q.fig.length ? `<div class="rd-figs">${q.fig.map((f, j) => `<button class="rd-fig${rdOptCls(done, q, ans[i], j)}" type="button" data-act="rdPick" data-q="${i}" data-j="${j}" ${done ? 'disabled' : ''} aria-pressed="${ans[i] === j}" aria-label="選項 ${'ABCD'[j]}"><span class="key">${'ABCD'[j]}</span>${f}</button>`).join('')}</div>`
        : `<div class="opts">${q.o.map((o, j) => `<button class="opt en${rdOptCls(done, q, ans[i], j)}" type="button" data-act="rdPick" data-q="${i}" data-j="${j}" ${done ? 'disabled' : ''} aria-pressed="${ans[i] === j}"><span class="key">${'ABCD'[j]}</span><span class="t">${esc(o)}</span></button>`).join('')}</div>`}
      ${done ? `<div class="rd-exp"><div class="rd-exp-h"><b class="${ans[i] === q.a ? 'ok' : 'no'}">${ans[i] === q.a ? '答對' : `答錯・正解 (${'ABCD'[q.a]})`}</b><span class="rd-tag">${esc(q.t)}</span></div><p>${q.e}</p>${q.z ? `<p class="rd-z">${esc(q.z)}</p>` : ''}</div>` : ''}
    </section>`).join('');
  if (!done) h += `<div class="btn-row"><button class="btn primary" type="button" data-act="rdSubmit">對答案</button></div>`;
  else h += `<section class="fb rd-res" id="rdres"><div class="fb-h"><b>這篇答對 ${done[1]} / 4 題</b><button class="btn small" type="button" data-act="rdRedo">重做這篇</button></div>
      <p class="rd-src"><span class="lab">題材</span>${esc(t1)}${t2 ? `（${esc(t2)}）` : ''}</p></section>
    <details class="rd-more"><summary>全文中譯</summary><div class="rd-zh">${p.zh.map(x => `<p>${esc(x)}</p>`).join('')}</div></details>
    <details class="rd-more" open><summary>重要字詞</summary><table class="rd-voc"><tbody>${p.v.map(v => `<tr><td class="en">${esc(v[0])}${sayBtn(v[0], 'say sm')}</td><td class="ps">${esc(v[1])}</td><td>${esc(v[2])}</td></tr>`).join('')}</tbody></table></details>`;
  h += `<div class="fnav"><button class="btn small" type="button" data-act="rdGo" data-d="-1" ${idx > 1 ? '' : 'disabled'}>${ICON.left}上一篇</button><button class="btn small ghost" type="button" data-act="rdList">全部題目</button><button class="btn small ${done ? 'primary' : ''}" type="button" data-act="rdGo" data-d="1" ${idx < RD_N ? '' : 'disabled'}>下一篇${ICON.right}</button></div>`;
  $('#qbody').innerHTML = h;
  if (top) $('#quiz').scrollTop = 0;
}
function rdPick(i, j) {
  if (OV !== 'read' || !RDS) return;
  const { key, done, ans } = rdCur();
  if (done) return;
  const a = ans.slice(); a[i] = a[i] === j ? -1 : j;
  if (a.some(x => x >= 0)) S.rd.a[key] = a; else delete S.rd.a[key];
  save();
  $$(`#rdq${i} [data-act="rdPick"]`).forEach(b => { const on = +b.dataset.j === a[i]; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
}
function rdSubmit() {
  if (OV !== 'read' || !RDS) return;
  const { p, key, done, ans } = rdCur();
  if (done) return;
  const miss = ans.findIndex(x => x < 0);
  if (miss >= 0) { toast(`第 ${miss + 1} 題還沒作答`); const el = $('#rdq' + miss); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
  const c = p.q.filter((q, i) => ans[i] === q.a).length;
  S.rd.a[key] = ans.slice(); S.rd.d[key] = [today(), c];
  const rec = dayRec(); rec.q += p.q.length; rec.c += c;
  save(); renderRd(false);
  setTimeout(() => { const el = $('#rdq0'); if (el) el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }, 40);
}
function rdRedo() { if (!RDS) return; const { key } = rdCur(); delete S.rd.a[key]; delete S.rd.d[key]; save(); TTS.stop(); renderRd(true); }
function rdGo(d) {
  if (!RDS) return;
  const flat = []; RD.forEach(r => r.p.forEach((_, k) => flat.push([r.no, k + 1])));
  const i = flat.findIndex(x => x[0] === RDS.no && x[1] === RDS.pi) + d;
  if (i < 0 || i >= flat.length) return;
  TTS.stop(); RDS = { no: flat[i][0], pi: flat[i][1] }; renderRd(true);
}

/* ================= 文意選填、篇章結構 ================= */
// 兩種題型的作答方式相同：點文章裡的空格，從選項裡挑一個；每個選項只能用在一格。
// S.bk.a[回] = 10 格各選了第幾個選項（0–9，沒填 -1），S.bk.d[回] = [對答案那天, 答對格數]；S.ps 一樣（4 格、選項 0–4）
const PK = {
  bank: { kind: 'bank', mode: BK_MODE, list: BK, by: BK_BY, key: 'bk', n: 10, L: 'ABCDEFGHIJ',
    intro: '照學測文意選填的形式，每回 1 篇文章、10 個空格配 10 個選項，每個選項只用一次，每題 1 分。對答案之後，每一格都有詞性和解析，並附全文中譯。',
    ins: '從 (A) 到 (J) 選出最適當的字詞填進空格，每個選項只用一次。點文章裡的空格選答案。' },
  struct: { kind: 'struct', mode: PS_MODE, list: PS, by: PS_BY, key: 'ps', n: 4, L: 'ABCDE',
    intro: '照 115 學年度學測篇章結構的形式，每回 1 篇文章、4 個空格配 5 個句子，其中 1 個句子用不到，每題 2 分。對答案之後，每一格都有解析，也會說明多出來的句子為什麼放不進去，並附全文中譯。',
    ins: '從 (A) 到 (E) 選出最適當的句子填進空格，其中 1 個句子用不到。點文章裡的空格選答案。' },
};
const pkKey = (c, r) => c.kind === 'bank' ? r.q.map(q => q.a) : r.a;
function pkNext(kind) { const c = PK[kind], st = S[c.key]; return (c.list.find(r => !st.d[r.no]) || c.list[0]).no; }
function vPick(kind) {
  const c = PK[kind], st = S[c.key], done = Object.keys(st.d).length, nx = pkNext(kind);
  return `<div><a class="back" href="#practice">${ICON.left}練習</a>
  <header class="top"><div><p class="eyebrow">第 ${MODE_NO[kind]} 種模式・${c.list.length} 回</p><h1>${c.mode.name}</h1></div><div class="chip-count"><b>${done}</b><span>/ ${c.list.length} 回已做</span></div></header></div>
  <section class="card tr-intro">
    <p>${c.intro}</p>
    <div class="btn-row"><button class="btn primary" type="button" data-act="pkOpen" data-kind="${kind}" data-no="${nx}">${done ? `${done === c.list.length ? '複習' : '繼續'}：第 ${nx} 回` : '從第 1 回開始'}</button></div>
  </section>
  ${kind === 'bank' ? wkModeCard('bank') : ''}
  <section class="sec-block"><h2>全部 ${c.list.length} 回<span>${done ? `已做 ${done} 回・答對 ${dSum(st.d)} / ${done * c.n} 格` : `每回 ${c.n} 格`}</span></h2>
    <div class="clist">${c.list.map(r => { const d = st.d[r.no];
      return `<button class="crow" type="button" data-act="pkOpen" data-kind="${kind}" data-no="${r.no}"><span class="no">${pad2(r.no)}</span><span class="t"><b>${d ? esc(r.topic) : `第 ${r.no} 回`}</b><small>${c.n} 格・約 ${Math.round(r.wc / 10) * 10} 字</small></span><span class="pc">${d ? `<span class="tr-done">${d[1]} / ${c.n}</span>` : ''}</span></button>`; }).join('')}</div></section>`;
}

let PKS = null;
function openPick(kind, no) {
  const c = PK[kind]; if (!c || !c.list.length) return;
  PKS = { kind, no: c.by.has(+no) ? +no : c.list[0].no, q: -1 };
  openOverlay(kind); renderPk(true);
}
function pkCur() { const c = PK[PKS.kind], r = c.by.get(PKS.no), st = S[c.key]; return { c, r, st, done: st.d[r.no], ans: st.a[r.no] || Array(c.n).fill(-1), key: pkKey(c, r) }; }
// 把一段文字切成句子（不用 lookbehind，舊版 Safari 才不會整支程式壞掉）
function pkSents(t) {
  const out = [], re = /[.!?]["”’)]*\s+/g; let last = 0, m;
  while ((m = re.exec(t))) { out.push(t.slice(last, m.index + m[0].length).trim()); last = m.index + m[0].length; }
  if (last < t.length) out.push(t.slice(last).trim());
  return out.filter(Boolean);
}
// 文章中的空格。文意選填是一個字詞，用小方塊；篇章結構是一整句，填進去之後要能跟著文章換行
function pkBlank(c, r, i, done, ans, key) {
  const n = i + 1, pick = ans[i], shown = done ? key[i] : pick, bank = c.kind === 'bank';
  const cls = done ? (pick === key[i] ? ' ok' : ' no') : pick >= 0 ? ' sel' : '';
  const txt = shown >= 0 ? esc(r.o[shown]) : bank ? '＿＿＿' : '＿＿＿＿＿＿＿＿';
  const lab = `第 ${n} 格${pick >= 0 ? `，已填 (${c.L[pick]}) ${esc(r.o[pick])}` : '，尚未作答'}`;
  if (bank) return done ? `<span class="cz-b${cls}" id="pkb${i}"><b>${n}</b><span>${txt}</span></span>`
    : `<button type="button" class="cz-b${cls}" id="pkb${i}" data-act="pkAsk" data-q="${i}" aria-label="${lab}"><b>${n}</b><span>${txt}</span></button>`;
  return done ? `<span class="ps-b${cls}" id="pkb${i}"><b>${n}</b>${txt}</span>`
    : `<span class="ps-b${cls}${pick < 0 ? ' empty' : ''}" id="pkb${i}" role="button" tabindex="0" data-act="pkAsk" data-q="${i}" aria-label="${lab}"><b>${n}</b>${txt}</span>`;
}
function pkBankHTML(c, r, ans) {
  const at = j => ans.indexOf(j);
  if (c.kind === 'bank') return `<div class="bk-bank" role="list" aria-label="選項">${r.o.map((o, j) => `<span role="listitem" class="${at(j) >= 0 ? 'used' : ''}"><b>(${c.L[j]})</b><i>${esc(o)}</i>${at(j) >= 0 ? `<em>第 ${at(j) + 1} 格</em>` : ''}</span>`).join('')}</div>`;
  return `<div class="ps-opts" role="list" aria-label="選項">${r.o.map((o, j) => `<div role="listitem" class="ps-opt${at(j) >= 0 ? ' used' : ''}"><span class="key">${c.L[j]}</span><p>${esc(o)}${at(j) >= 0 ? `<em>已填在第 ${at(j) + 1} 格</em>` : ''}</p></div>`).join('')}</div>`;
}
function renderPk(top) {
  const { c, r, st, done, ans, key } = pkCur();
  const idx = c.list.indexOf(r) + 1, L = c.L, bank = c.kind === 'bank';
  $('#qmode').textContent = c.mode.name;
  $('#qprog').textContent = `第 ${r.no} 回 / ${c.list.length}`;
  $('#qscore').innerHTML = done ? `<span class="${done[1] === c.n ? 'ok' : ''}">${done[1]} / ${c.n}</span>` : '';
  $('#qfill').style.width = `${Object.keys(st.d).length / c.list.length * 100}%`;
  let h = `<p class="kicker">第 ${r.no} 回（共 ${c.list.length} 回）${done ? `・${esc(r.topic)}` : ''}</p>`;
  if (!done) h += `<p class="tr-ins">${c.ins}</p>${pkBankHTML(c, r, ans)}`;
  h += `<article class="rd-text ${bank ? 'cz-text' : 'ps-text'}">${r.text.map(x => `<p>${esc(x).replace(/\[\[(\d+)\]\]/g, (_, n) => pkBlank(c, r, +n - 1, done, ans, key))}</p>`).join('')}</article>`;
  if (!done) h += `<div class="btn-row"><button class="btn primary" type="button" data-act="pkSubmit">對答案</button></div>`;
  else {
    const res = i => `<b class="${ans[i] === key[i] ? 'ok' : 'no'}">${ans[i] === key[i] ? '答對' : `答錯・你填的是 (${L[ans[i]]})${bank ? ' ' + esc(r.o[ans[i]]) : ''}`}</b>`;
    h += key.map((k, i) => `<section class="czq pkq" id="pkq${i}">
      <div class="czq-h"><span class="trn">${i + 1}.</span><b class="pk-w">(${L[k]})${bank ? ' ' + esc(r.o[k]) : ''}</b>${bank ? `<span class="rd-tag">${esc(r.q[i].pos)}</span>` : ''}</div>
      ${bank ? '' : `<p class="ps-sent">${esc(r.o[k])}</p>`}
      <div class="rd-exp"><div class="rd-exp-h">${res(i)}</div><p>${esc(bank ? r.q[i].e : r.e[i])}</p></div></section>`).join('');
    if (!bank) h += `<section class="czq pkq" id="pkqx"><div class="czq-h"><b class="pk-w">(${L[r.x[0]]})</b><span class="rd-tag">用不到的句子</span></div><p class="ps-sent">${esc(r.o[r.x[0]])}</p><div class="rd-exp"><p>${esc(r.x[1])}</p></div></section>`;
    h += `<section class="fb rd-res" id="pkres"><div class="fb-h"><b>這回答對 ${done[1]} / ${c.n} 格</b><button class="btn small" type="button" data-act="pkRedo">重做這回</button></div>
      <p class="rd-src"><span class="lab">題材</span>${esc(r.topic)}</p></section>
    <details class="rd-more"><summary>全文中譯</summary><div class="rd-zh">${r.zh.map(x => `<p>${esc(x)}</p>`).join('')}</div></details>`;
  }
  h += `<div class="fnav"><button class="btn small" type="button" data-act="pkGo" data-d="-1" ${idx > 1 ? '' : 'disabled'}>${ICON.left}上一回</button><button class="btn small ghost" type="button" data-act="pkList">全部題目</button><button class="btn small ${done ? 'primary' : ''}" type="button" data-act="pkGo" data-d="1" ${idx < c.list.length ? '' : 'disabled'}>下一回${ICON.right}</button></div>`;
  $('#qbody').innerHTML = h;
  if (top) $('#quiz').scrollTop = 0;
}
// 點空格：從底部面板選答案。面板會蓋住文章，所以把空格前後的句子一起帶上去
function pkAsk(i) {
  if (!PKS || OV !== PKS.kind) return;
  const { c, r, done, ans } = pkCur(); if (done || !(i >= 0 && i < c.n)) return;
  PKS.q = i;
  const L = c.L, tag = `[[${i + 1}]]`, par = r.text.find(x => x.includes(tag)) || '';
  const fillIn = s => esc(s).replace(/\[\[(\d+)\]\]/g, (_, n) => +n === i + 1 ? `<mark>（${n}）＿＿＿</mark>` : ans[n - 1] >= 0 ? `<u>${esc(r.o[ans[n - 1]])}</u>` : `（${n}）＿＿＿`);
  let ctx;
  if (c.kind === 'bank') ctx = `<p class="bk-ctx">${fillIn(pkSents(par).find(s => s.includes(tag)) || par)}</p>`;
  else {
    const at = par.indexOf(tag), a = pkSents(par.slice(0, at)).pop(), b = pkSents(par.slice(at + tag.length))[0];
    ctx = `<div class="bk-ctx ps-ctx"><p><span class="lab">前一句</span>${a ? fillIn(a) : '（這一格在段落開頭）'}</p><p><mark>（${i + 1}）＿＿＿＿＿＿</mark></p><p><span class="lab">後一句</span>${b ? fillIn(b) : '（這一格在段落結尾）'}</p></div>`;
  }
  const opts = r.o.map((o, j) => { const at = ans.indexOf(j);
    return `<button class="opt en${ans[i] === j ? ' sel' : at >= 0 ? ' used' : ''}" type="button" data-act="pkChoose" data-j="${j}" aria-pressed="${ans[i] === j}"><span class="key">${L[j]}</span><span class="t">${esc(o)}${at >= 0 && at !== i ? `<small>已填在第 ${at + 1} 格</small>` : ''}</span></button>`; }).join('');
  openSheet(`<h2 id="sheetTitle">第 ${i + 1} 格</h2>${ctx}<div class="${c.kind === 'bank' ? 'bk-pick' : 'ps-pick'}">${opts}</div>${ans[i] >= 0 ? '<div class="btn-row"><button class="btn small" type="button" data-act="pkClear">清除這一格</button></div>' : ''}`);
}
function pkChoose(j) {
  if (!PKS || OV !== PKS.kind || PKS.q < 0) return;
  const { c, r, st, done, ans } = pkCur(); if (done) return;
  const a = ans.slice(), i = PKS.q;
  if (!(j >= 0 && j < r.o.length) || a[i] === j) a[i] = -1;
  else { const at = a.indexOf(j); if (at >= 0) a[at] = -1; a[i] = j; }   // 每個選項只能用在一格
  if (a.some(x => x >= 0)) st.a[r.no] = a; else delete st.a[r.no];
  save(); closeSheet(); renderPk(false);
  const el = $('#pkb' + i); if (el) el.scrollIntoView({ block: 'nearest' });
}
function pkSubmit() {
  if (!PKS || OV !== PKS.kind) return;
  const { c, r, st, done, ans, key } = pkCur(); if (done) return;
  const miss = ans.findIndex(x => x < 0);
  if (miss >= 0) { toast(`第 ${miss + 1} 格還沒填`); const el = $('#pkb' + miss); if (el) el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
  const n = ans.filter((x, i) => x === key[i]).length;
  st.a[r.no] = ans.slice(); st.d[r.no] = [today(), n];
  const rec = dayRec(); rec.q += c.n; rec.c += n;
  save(); renderPk(true);
}
function pkRedo() { if (!PKS) return; const { r, st } = pkCur(); delete st.a[r.no]; delete st.d[r.no]; save(); renderPk(true); }
function pkGo(d) {
  if (!PKS) return;
  const c = PK[PKS.kind], i = c.list.findIndex(x => x.no === PKS.no) + d;
  if (i < 0 || i >= c.list.length) return;
  PKS = { kind: PKS.kind, no: c.list[i].no, q: -1 }; renderPk(true);
}

/* ================= 混合題 ================= */
// S.mx.a[回] = { f: [第 47 格, 第 48 格], m: 多選選的代號（例如 "ACF"）, s: 簡答 }
// S.mx.d[回] = [對答案那天, 答對題數 0–4（47、48、49、50 各算一題）, 簡答自己判定算對 0/1]
const MX_TYPE = { F: '論壇留言', P: '兩篇短文', L: '列舉資訊' };
const mxTopic = r => r.topic.replace(/（[^（）]*）$/, '');
function mxNext() { return (MX.find(r => !S.mx.d[r.no]) || MX[0]).no; }
function vMixed() {
  const done = Object.keys(S.mx.d).length, nx = mxNext();
  return `<div><a class="back" href="#practice">${ICON.left}練習</a>
  <header class="top"><div><p class="eyebrow">第 ${MODE_NO.mixed} 種模式・${MX.length} 回</p><h1>${MX_MODE.name}</h1></div><div class="chip-count"><b>${done}</b><span>/ ${MX.length} 回已做</span></div></header></div>
  <section class="card tr-intro">
    <p>照學測混合題的形式，每回 1 個題組，有三種：論壇留言、兩篇短文對照、列舉資訊。題目是填充 2 格、多選 1 題、簡答 1 題。填充要從文章裡找字，並依句子改變字形。對答案之後有解析和全文中譯。</p>
    <div class="btn-row"><button class="btn primary" type="button" data-act="mxOpen" data-no="${nx}">${done ? `${done === MX.length ? '複習' : '繼續'}：第 ${nx} 回` : '從第 1 回開始'}</button></div>
  </section>
  ${wkModeCard('mixed')}
  <section class="sec-block"><h2>全部 ${MX.length} 回<span>${done ? `已做 ${done} 回・答對 ${dSum(S.mx.d)} / ${done * 4} 題` : '每回 4 題'}</span></h2>
    <div class="clist">${MX.map(r => { const d = S.mx.d[r.no];
      return `<button class="crow" type="button" data-act="mxOpen" data-no="${r.no}"><span class="no">${pad2(r.no)}</span><span class="t"><b>${d ? esc(mxTopic(r)) : `第 ${r.no} 回`}</b><small>${MX_TYPE[r.type]}・填充、多選、簡答</small></span><span class="pc">${d ? `<span class="tr-done">${d[1]} / 4</span>` : ''}</span></button>`; }).join('')}</div></section>`;
}

let MXS = null;
function openMixed(no) {
  if (!MX.length) return;
  MXS = { no: MX_BY.has(+no) ? +no : MX[0].no };
  openOverlay('mixed'); renderMx(true);
}
function mxCur() { const r = MX_BY.get(MXS.no); return { r, done: S.mx.d[r.no], ans: S.mx.a[r.no] || { f: ['', ''], m: '', s: '' } }; }
function renderMx(top) {
  const { r, done, ans } = mxCur(), g = done ? mxGrade(r, ans) : null, keys = mxKeys(r), idx = MX.indexOf(r) + 1;
  $('#qmode').textContent = MX_MODE.name;
  $('#qprog').textContent = `第 ${r.no} 回 / ${MX.length}`;
  $('#qscore').innerHTML = done ? `<span class="${done[1] === 4 ? 'ok' : ''}">${done[1]} / 4</span>` : '';
  $('#qfill').style.width = `${Object.keys(S.mx.d).length / MX.length * 100}%`;
  const paras = t => t.split('\n').map(x => `<p>${esc(x)}</p>`).join('');
  let h = `<p class="kicker">第 ${r.no} 回（共 ${MX.length} 回）・${MX_TYPE[r.type]}${done ? `・${esc(mxTopic(r))}` : ''}</p>
    <p class="mx-intro">${esc(r.intro)}</p>`;
  h += r.type === 'P' ? r.b.map(b => `<article class="rd-text mx-text"><h3>${esc(b.h)}</h3>${paras(b.t)}</article>`).join('')
    : `<div class="mx-posts">${r.b.map(b => `<div class="mx-post"><span class="key">${b.k}</span><div><h3>${esc(b.h)}</h3>${paras(b.t)}</div></div>`).join('')}</div>`;
  // 47–48 填充
  const fin = i => done ? `<span class="mx-ans ${g.f[i] ? 'ok' : 'no'}"><b>${47 + i}</b>${mxNorm(ans.f[i]) ? esc(ans.f[i]) : '（沒填）'}</span>`
    : `<span class="mx-inw"><b>${47 + i}</b><input class="mx-in" id="mxf${i}" data-mx="f${i}" type="text" value="${esc(ans.f[i])}" maxlength="40" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" aria-label="第 ${47 + i} 格"></span>`;
  h += `<section class="mxq" id="mxq0"><div class="mxq-h"><b class="trn">47–48</b><span class="rd-tag">填充</span></div>
    ${done ? '' : '<p class="tr-ins">從文章裡找出最適當的單詞（word）填進空格，並依句子結構改變字形。每格只能填一個單詞。</p>'}
    <p class="mx-fill">${esc(r.f.s).replace(/__(47|48)__/g, (_, n) => fin(+n - 47))}</p>
    ${done ? r.f.a.map((x, i) => `<div class="rd-exp"><div class="rd-exp-h"><b class="${g.f[i] ? 'ok' : 'no'}">${47 + i}. ${g.f[i] ? '答對' : '答錯'}・正解 <i>${esc(x.w.join(' / '))}</i></b><span class="rd-tag">原文 ${esc(x.src)}</span></div><p>${esc(x.e)}</p></div>`).join('') : ''}</section>`;
  // 49 多選
  const sel = k => ans.m.includes(k), right = k => r.m.a.includes(k);
  const mcls = k => !done ? (sel(k) ? ' sel' : '') : right(k) ? (sel(k) ? ' ok' : ' miss') : sel(k) ? ' no' : ' dim';
  h += `<section class="mxq" id="mxq1"><div class="mxq-h"><b class="trn">49</b><span class="rd-tag">多選</span></div>
    <p class="rd-stem"><span>${esc(r.m.s)}</span></p>
    ${done ? '' : '<p class="tr-ins">答案不只一個，全部選對才算答對。</p>'}
    ${r.m.o.length ? `<div class="opts">${r.m.o.map((o, j) => `<button class="opt en${mcls(keys[j])}" type="button" data-act="mxPick" data-c="${keys[j]}" ${done ? 'disabled' : ''} aria-pressed="${sel(keys[j])}"><span class="key">${keys[j]}</span><span class="t">${esc(o)}</span></button>`).join('')}</div>`
      : `<div class="mx-letters">${r.b.map(b => `<button class="mx-l${mcls(b.k)}" type="button" data-act="mxPick" data-c="${b.k}" ${done ? 'disabled' : ''} aria-pressed="${sel(b.k)}"><b>${b.k}</b>${esc(b.h)}</button>`).join('')}</div>`}
    ${done ? `<div class="rd-exp"><div class="rd-exp-h"><b class="${g.m ? 'ok' : 'no'}">${g.m ? '答對' : '答錯'}・正解 ${r.m.a.split('').join('、')}</b></div><p>${esc(r.m.e)}</p>${g.m ? '' : '<p class="rd-z">綠色實線是選對的，綠色虛線是漏選的，紅色是選錯的。</p>'}</div>` : ''}</section>`;
  // 50 簡答
  const wrote = !!mxNorm(ans.s);
  h += `<section class="mxq" id="mxq2"><div class="mxq-h"><b class="trn">50</b><span class="rd-tag">簡答</span></div>
    <p class="rd-stem"><span>${esc(r.s.s)}</span></p>
    ${done ? `<div class="tr-mine"><span class="lab">你的答案</span><p class="en">${wrote ? esc(ans.s) : '（沒寫）'}</p></div>
      <div class="rd-exp"><div class="rd-exp-h"><b class="${g.s || done[2] ? 'ok' : 'no'}">${g.s ? '答對' : done[2] ? '自己判定算對' : wrote ? '和參考答案不同' : '沒有作答'}・參考答案 <i>${esc(r.s.a[0])}</i></b></div><p>${esc(r.s.e)}</p>
      ${g.s || !wrote ? '' : `<div class="mx-self"><span>${done[2] ? '已經改成算對。' : '如果意思和參考答案一樣、拼字也正確，可以自己改成算對。'}</span><button class="btn small" type="button" data-act="mxSelf">${done[2] ? '改回算錯' : '我寫對了'}</button></div>`}</div>`
      : `<input class="mx-short" id="mxs" data-mx="s" type="text" value="${esc(ans.s)}" maxlength="200" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" placeholder="在這裡寫答案" aria-label="第 50 題的答案">`}</section>`;
  if (!done) h += `<div class="btn-row"><button class="btn primary" type="button" data-act="mxSubmit">對答案</button></div>`;
  else h += `<section class="fb rd-res" id="mxres"><div class="fb-h"><b>這回答對 ${done[1]} / 4 題</b><button class="btn small" type="button" data-act="mxRedo">重做這回</button></div>
      <p class="rd-src"><span class="lab">題材</span>${esc(mxTopic(r))}</p></section>
    <details class="rd-more"><summary>全文中譯</summary><div class="rd-zh">${r.zh.map(x => `<p>${esc(x)}</p>`).join('')}</div></details>`;
  h += `<div class="fnav"><button class="btn small" type="button" data-act="mxGo" data-d="-1" ${idx > 1 ? '' : 'disabled'}>${ICON.left}上一回</button><button class="btn small ghost" type="button" data-act="mxList">全部題目</button><button class="btn small ${done ? 'primary' : ''}" type="button" data-act="mxGo" data-d="1" ${idx < MX.length ? '' : 'disabled'}>下一回${ICON.right}</button></div>`;
  $('#qbody').innerHTML = h;
  if (top) $('#quiz').scrollTop = 0;
}
function mxStore(r, a, lazy) {
  if (a.f[0] || a.f[1] || a.m || a.s) S.mx.a[r.no] = a; else delete S.mx.a[r.no];
  if (lazy) { clearTimeout(trSaveT); trSaveT = setTimeout(() => { trSaveT = 0; save(); }, 400); } else save();
}
function mxInput(el) {
  if (OV !== 'mixed' || !MXS) return;
  const { r, done, ans } = mxCur(); if (done) return;
  const a = { f: ans.f.slice(), m: ans.m, s: ans.s }, k = el.dataset.mx;
  if (k === 's') a.s = el.value.slice(0, 200); else if (k === 'f0' || k === 'f1') a.f[+k[1]] = el.value.slice(0, 40); else return;
  mxStore(r, a, true);
}
function mxPick(k) {
  if (OV !== 'mixed' || !MXS) return;
  const { r, done, ans } = mxCur(); if (done || !mxKeys(r).includes(k) || k.length !== 1) return;
  const set = new Set(ans.m.split('')); if (set.has(k)) set.delete(k); else set.add(k);
  const a = { f: ans.f.slice(), m: [...set].sort().join(''), s: ans.s };
  mxStore(r, a);
  $$('#mxq1 [data-act="mxPick"]').forEach(b => { const on = a.m.includes(b.dataset.c); b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
}
async function mxSubmit() {
  if (OV !== 'mixed' || !MXS) return;
  trFlush();
  const { r, done, ans } = mxCur(); if (done) return;
  const a = { f: ans.f.map(x => x.trim()), m: ans.m, s: ans.s.trim() };
  const miss = [!a.f[0] && '47', !a.f[1] && '48', !a.m && '49', !a.s && '50'].filter(Boolean);
  if (miss.length === 4) { toast('還沒有作答'); return; }
  if (miss.length && !await ask(`第 ${miss.join('、')} 題還沒作答，要直接對答案嗎？`, '對答案', '繼續作答')) return;
  if (OV !== 'mixed' || !MXS || MXS.no !== r.no || S.mx.d[r.no]) return;   // 對話框開著的時候已經離開這一回
  const g = mxGrade(r, a);
  S.mx.a[r.no] = a; S.mx.d[r.no] = [today(), g.n, 0];
  const rec = dayRec(); rec.q += 4; rec.c += g.n;
  save(); renderMx(true);
}
// 簡答題和參考答案不完全一樣時，讓學生自己判定；只在對答案當天同步調整當天的答對數
function mxSelf() {
  if (OV !== 'mixed' || !MXS) return;
  const { r, done, ans } = mxCur(); if (!done) return;
  const g = mxGrade(r, ans); if (g.s || !mxNorm(ans.s)) return;
  const v = done[2] ? 0 : 1;
  if (done[0] === today()) { const rec = dayRec(); rec.c = Math.max(0, rec.c + (v ? 1 : -1)); }
  S.mx.d[r.no] = [done[0], g.n + v, v]; save(); renderMx(false);
}
function mxRedo() { if (!MXS) return; const { r } = mxCur(); delete S.mx.a[r.no]; delete S.mx.d[r.no]; save(); renderMx(true); }
function mxGo(d) {
  if (!MXS) return;
  const i = MX.findIndex(x => x.no === MXS.no) + d;
  if (i < 0 || i >= MX.length) return;
  trFlush(); MXS = { no: MX[i].no }; renderMx(true);
}

/* ================= 題組弱點分析 ================= */
// 不另外存資料：用已經存下來的作答（S.cz / S.bk / S.ps / S.rd / S.mx）和每題的標籤現算，所以之前做過的題組也算得進去。
// 重做某一篇會清掉那一篇的作答，統計以最後一次對答案為準。
const WEAK_MIN = 5;   // 一類至少作答幾題才列出正確率
// 原始標籤很細（閱讀有四十多種），of() 把它們併成幾大類；新增標籤時 build.py 會提醒有沒有對不上的
const WEAK = {
  cloze: { name: CZ_MODE.name, short: '綜合', unit: '題', groups: ['字義', '片語', '文法', '連接詞與轉承語', '介系詞', '上下文'],
    of: t => /^字義/.test(t) ? '字義' : /^片語/.test(t) ? '片語' : /^文法/.test(t) ? '文法' : /^(連接詞|轉承語)/.test(t) ? '連接詞與轉承語' : /^介系詞/.test(t) ? '介系詞' : /^上下文/.test(t) ? '上下文' : '其他' },
  bank: { name: BK_MODE.name, short: '選填', unit: '格', groups: ['名詞', '動詞', '形容詞與副詞', '分詞與動名詞', '片語'],
    of: t => /片語/.test(t) ? '片語' : /分詞|動名詞/.test(t) ? '分詞與動名詞' : /形容詞|副詞/.test(t) ? '形容詞與副詞' : /名詞/.test(t) ? '名詞' : /動詞/.test(t) ? '動詞' : '其他' },
  struct: { name: PS_MODE.name, short: '篇章', unit: '格', groups: ['篇章結構'], of: () => '篇章結構' },
  read: { name: RD_MODE.name, short: '閱讀', unit: '題', groups: ['主旨與標題', '細節', '細節（NOT 題）', '細節（原因）', '推論', '圖片題', '字義與指涉', '寫作目的與結構'],
    of: t => { const b = t.split('（')[0];
      return b === '主旨' || b === '標題' ? '主旨與標題'
        : b === '細節' ? (/NOT/.test(t) ? '細節（NOT 題）' : /原因|主因|因果/.test(t) ? '細節（原因）' : '細節')
        : b === '圖片題' ? '圖片題'
        : /^(字義|片語)/.test(b) || b === '指涉' ? '字義與指涉'
        : /推論$/.test(b) ? '推論'
        : /^(寫作|段落|篇章|作者)/.test(b) ? '寫作目的與結構' : '其他'; } },
  mixed: { name: MX_MODE.name, short: '混合', unit: '題', groups: ['填充', '多選', '簡答'], of: t => t },
};
const WEAK_ORDER = ['cloze', 'bank', 'struct', 'read', 'mixed'];   // 和考卷的順序一樣
const WEAK_CARD = ['cloze', 'bank', 'read', 'mixed'];              // 篇章結構沒有分類標籤，只列進答錯清單
// 每一題一筆：m 模式、g 分類、t 原始標籤、ok 有沒有答對、day 對答案那天、no/pi/i 第幾回、第幾篇、第幾題（混合題 i：0–1 填充、2 多選、3 簡答）
function wkItems() {
  const out = [];
  const pass = (m, st, BY) => {
    for (const k in st.d) {
      const [no, pi] = k.split('-').map(Number), r = BY.get(no), p = r && r.p[pi - 1], a = st.a[k];
      if (!p || !Array.isArray(a)) continue;
      p.q.forEach((q, i) => out.push({ m, g: WEAK[m].of(q.t), t: q.t, ok: a[i] === q.a, day: st.d[k][0], no, pi, i }));
    }
  };
  pass('cloze', S.cz, CZ_BY);
  for (const k in S.bk.d) {
    const r = BK_BY.get(+k), a = S.bk.a[k]; if (!r || !Array.isArray(a)) continue;
    r.q.forEach((q, i) => out.push({ m: 'bank', g: WEAK.bank.of(q.pos), t: q.pos, ok: a[i] === q.a, day: S.bk.d[k][0], no: r.no, pi: 0, i }));
  }
  for (const k in S.ps.d) {
    const r = PS_BY.get(+k), a = S.ps.a[k]; if (!r || !Array.isArray(a)) continue;
    r.a.forEach((x, i) => out.push({ m: 'struct', g: '篇章結構', t: '', ok: a[i] === x, day: S.ps.d[k][0], no: r.no, pi: 0, i }));
  }
  pass('read', S.rd, RD_BY);
  for (const k in S.mx.d) {
    const r = MX_BY.get(+k), a = S.mx.a[k], d = S.mx.d[k]; if (!r || !a) continue;
    const g = mxGrade(r, a), it = (t, ok, i) => out.push({ m: 'mixed', g: t, t, ok: !!ok, day: d[0], no: r.no, pi: 0, i });
    it('填充', g.f[0], 0); it('填充', g.f[1], 1); it('多選', g.m, 2); it('簡答', g.s || d[2], 3);
  }
  return out;
}
// 一個模式的統計：rows 先列題數夠的（答對率低的在前），題數不夠的排後面；weak 是答對率最低、而且不到八成的那一類
function wkStats(items, m) {
  const by = {}; let n = 0, c = 0;
  items.forEach(x => { if (x.m !== m) return; const r = by[x.g] || (by[x.g] = { g: x.g, n: 0, c: 0 }); r.n++; n++; if (x.ok) { r.c++; c++; } });
  const ord = g => { const i = WEAK[m].groups.indexOf(g); return i < 0 ? 99 : i; };
  const rows = Object.values(by).map(r => ({ g: r.g, n: r.n, c: r.c, few: r.n < WEAK_MIN, rate: r.c / r.n }))
    .sort((a, b) => (a.few - b.few) || (a.few ? 0 : (a.rate - b.rate) || (b.n - a.n)) || (ord(a.g) - ord(b.g)));
  return { n, c, rows, weak: rows.length && !rows[0].few && rows[0].rate < 0.8 ? rows[0] : null };
}
function wkRowsHTML(m, st) {
  return st.rows.map(r => {
    const pct = Math.round(r.rate * 100), miss = r.n - r.c;
    const cls = r.few ? ' few' : pct < 60 ? ' lo' : pct < 80 ? ' mid' : ' hi';
    const inner = `<span class="wk-n">${esc(r.g)}${st.weak === r ? '<em class="wk-tag">最弱</em>' : ''}</span><span class="wk-c num">${r.c} / ${r.n}</span>${r.few ? '<span class="wk-p few">題數還不夠</span>' : `<b class="wk-p num">${pct}%</b>`}<span class="wk-go" aria-hidden="true">${miss ? ICON.right : ''}</span><span class="wk-bar" aria-hidden="true"><i style="width:${r.few ? 0 : pct}%"></i></span>`;
    return miss ? `<button class="wk-row${cls}" type="button" data-act="wkGroup" data-m="${m}" data-g="${esc(r.g)}" aria-label="${esc(r.g)}：答對 ${r.c} / ${r.n}，看答錯的 ${miss} ${WEAK[m].unit}">${inner}</button>` : `<div class="wk-row${cls}">${inner}</div>`;
  }).join('');
}
// 還沒做的題組裡，含最多「最弱那一類」題目的那一篇（混合題每回的題型都一樣，不推薦）
function wkRec(m, st) {
  if (!st.weak) return null;
  const g = st.weak.g; let best = null;
  const see = (n, o) => { if (n > (best ? best.n : 0)) best = { n, ...o }; };
  if (m === 'cloze' || m === 'read') {
    const list = m === 'cloze' ? CZ : RD, d = m === 'cloze' ? S.cz.d : S.rd.d, act = m === 'cloze' ? 'czOpen' : 'rdOpen';
    list.forEach(r => r.p.forEach((p, k) => { if (!d[`${r.no}-${k + 1}`]) see(p.q.filter(q => WEAK[m].of(q.t) === g).length, { id: `${r.no}-${k + 1}`, where: `第 ${r.no} 回第 ${k + 1} 篇`, unit: '篇', attrs: `data-act="${act}" data-no="${r.no}" data-pi="${k + 1}"` }); }));
  } else if (m === 'bank') {
    BK.forEach(r => { if (!S.bk.d[r.no]) see(r.q.filter(q => WEAK.bank.of(q.pos) === g).length, { id: `${r.no}`, where: `第 ${r.no} 回`, unit: '回', attrs: `data-act="pkOpen" data-kind="bank" data-no="${r.no}"` }); });
  }
  // 推薦的如果就是「繼續」按鈕要去的那一篇，不用再列一次
  const next = m === 'cloze' ? czNext().join('-') : m === 'read' ? rdNext().join('-') : m === 'bank' ? String(pkNext('bank')) : '';
  return best && best.id !== next ? best : null;
}
// 紀錄頁的卡片：四種題組模式各列一段
function wkCard() {
  const items = wkItems();
  const blocks = WEAK_CARD.map(m => { const st = wkStats(items, m); return st.n ? `<div class="wk-m"><div class="wk-mh"><b>${WEAK[m].name}</b><span class="num">答對 ${st.c} / ${st.n} ${WEAK[m].unit}</span></div>${wkRowsHTML(m, st)}</div>` : ''; }).filter(Boolean);
  if (!blocks.length) return '';
  return `<section class="card"><div class="sec-h"><h2>題組弱點分析</h2><span class="muted">答對率低的排前面</span></div>
    <div class="wk">${blocks.join('')}</div>
    <p class="wk-note">點一類可以看答錯的題目。一類至少答過 ${WEAK_MIN} 題才列出正確率；重做過的題組以最後一次作答為準。</p></section>`;
}
// 各題組模式自己那一頁的卡片：這個模式的分類答對率，加上推薦的下一篇
function wkModeCard(m) {
  const st = wkStats(wkItems(), m); if (!st.n) return '';
  const rec = wkRec(m, st);
  return `<section class="card"><div class="sec-h"><h2>各類題目的答對率</h2><span class="muted num">答對 ${st.c} / ${st.n} ${WEAK[m].unit}</span></div>
    <div class="wk"><div class="wk-m">${wkRowsHTML(m, st)}</div></div>
    ${rec ? `<div class="wk-rec"><p>還沒做的題組裡，${rec.where}的「${esc(st.weak.g)}」最多（${rec.n} ${WEAK[m].unit}）。</p><button class="btn small" type="button" ${rec.attrs}>做這${rec.unit}</button></div>` : ''}
    <p class="wk-note">點一類可以看答錯的題目。一類至少答過 ${WEAK_MIN} 題才列出正確率。</p></section>`;
}
// 錯題本的「題組」分頁：所有答錯的題組題目，點了回到那一篇的詳解
let wkM = 'all', wkG = '';
const wkWrong = () => wkItems().filter(x => !x.ok);
const plain = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent || ''; };
function wkQHTML(x) {
  const L = 'ABCDEFGHIJ'; let loc, sum;
  if (x.m === 'cloze') { const q = CZ_BY.get(x.no).p[x.pi - 1].q[x.i], a = S.cz.a[czKey(x.no, x.pi)][x.i];
    loc = `第 ${x.no} 回第 ${x.pi} 篇・第 ${(x.pi - 1) * 5 + x.i + 1} 題`; sum = `正解 (${L[q.a]}) ${q.o[q.a]}・你選 (${L[a]}) ${q.o[a]}`;
  } else if (x.m === 'read') { loc = `第 ${x.no} 回第 ${x.pi} 篇・第 ${x.i + 1} 題`; sum = plain(RD_BY.get(x.no).p[x.pi - 1].q[x.i].s);
  } else if (x.m === 'bank') { const r = BK_BY.get(x.no), a = S.bk.a[x.no][x.i], k = r.q[x.i].a;
    loc = `第 ${x.no} 回・第 ${x.i + 1} 格`; sum = `正解 (${L[k]}) ${r.o[k]}・你填 (${L[a]}) ${r.o[a]}`;
  } else if (x.m === 'struct') { const r = PS_BY.get(x.no), a = S.ps.a[x.no][x.i], k = r.a[x.i];
    loc = `第 ${x.no} 回・第 ${x.i + 1} 格`; sum = `正解 (${L[k]})・你填 (${L[a]})　${r.o[k]}`;
  } else { const r = MX_BY.get(x.no), a = S.mx.a[x.no];
    if (x.i < 2) { loc = `第 ${x.no} 回・第 ${47 + x.i} 格`; sum = `正解 ${r.f.a[x.i].w.join(' / ')}・你填 ${mxNorm(a.f[x.i]) ? a.f[x.i] : '（沒填）'}`; }
    else if (x.i === 2) { loc = `第 ${x.no} 回・第 49 題`; sum = `正解 ${r.m.a.split('').join('、')}・你選 ${a.m ? a.m.split('').join('、') : '（沒選）'}`; }
    else { loc = `第 ${x.no} 回・第 50 題`; sum = `參考答案 ${r.s.a[0]}・你寫 ${mxNorm(a.s) ? a.s : '（沒寫）'}`; }
  }
  return `<button class="crow wk-q" type="button" data-act="wkOpen" data-m="${x.m}" data-no="${x.no}" data-pi="${x.pi}" data-i="${x.i}"><span class="no">${WEAK[x.m].short}</span><span class="t"><b>${loc}</b><small>${x.t ? `<i class="wk-t">${esc(x.t)}</i>` : ''}${esc(sum)}</small></span><span class="pc">${md(x.day)}</span></button>`;
}
function wkListHTML() {
  const all = wkWrong();
  if (!all.length) return `<p class="empty">${wkItems().length ? '目前沒有答錯的題組題目。' : '綜合測驗、文意選填、篇章結構、閱讀測驗、混合題對完答案後，答錯的題目會收在這裡，點一下就回到那一篇的詳解。'}</p>`;
  const cnt = m => all.filter(x => x.m === m).length;
  if (wkM !== 'all' && !cnt(wkM)) { wkM = 'all'; wkG = ''; }
  if (wkM === 'all') wkG = '';
  const inM = wkM === 'all' ? all : all.filter(x => x.m === wkM);
  const list = (wkG ? inM.filter(x => x.g === wkG) : inM).sort((a, b) => (b.day - a.day) || (WEAK_ORDER.indexOf(a.m) - WEAK_ORDER.indexOf(b.m)) || (a.no - b.no) || (a.pi - b.pi) || (a.i - b.i));
  const chips = [['all', '全部', all.length], ...WEAK_ORDER.filter(cnt).map(m => [m, WEAK[m].name, cnt(m)])];
  return `<div class="chips">${chips.map(([k, n, c]) => `<button class="chip" type="button" data-act="wkMode" data-v="${k}" aria-pressed="${wkM === k}">${n} ${c}</button>`).join('')}</div>
  ${wkG ? `<div class="wk-f"><span>只看「${esc(wkG)}」${list.length ? `・${list.length} ${WEAK[wkM].unit}` : ''}</span><button class="btn small" type="button" data-act="wkClearG">看全部類別</button></div>` : ''}
  ${list.length ? `<div class="clist">${list.map(wkQHTML).join('')}</div><p class="wk-note">點一題回到那一篇的詳解。重做那一篇並答對，題目就會從這裡消失。</p>` : '<p class="empty">這一類目前沒有答錯的題目。</p>'}`;
}
function wkOpen(m, no, pi, i) {
  let id;
  if (m === 'cloze') { openCloze(no, pi); id = 'czq' + i; }
  else if (m === 'read') { openRead(no, pi); id = 'rdq' + i; }
  else if (m === 'bank' || m === 'struct') { openPick(m, no); id = 'pkq' + i; }
  else if (m === 'mixed') { openMixed(no); id = 'mxq' + (i < 2 ? 0 : i - 1); }
  else return;
  setTimeout(() => { const el = $('#' + id); if (el) el.scrollIntoView({ block: 'start' }); }, 40);
}

const VIEWS = { home: vHome, practice: vPractice, words: vWords, wrong: vWrong, me: vMe, trans: vTrans, cloze: vCloze, read: vRead,
  bank: () => BK.length ? vPick('bank') : vPractice(), struct: () => PS.length ? vPick('struct') : vPractice(), mixed: () => MX.length ? vMixed() : vPractice() };
const SET_VIEWS = ['trans', 'cloze', 'read', 'bank', 'struct', 'mixed'];
function render() {
  const el = $('#view');
  el.innerHTML = view === 'card' ? vCard(cardNo) : VIEWS[view]();
  const tab = view === 'card' ? 'words' : SET_VIEWS.includes(view) ? 'practice' : view;
  $$('.tabs a').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}
function route() {
  const h = (location.hash || '').replace(/^#/, '');
  const m = /^card-(\d+)$/.exec(h);
  if (m) { view = 'card'; cardNo = Math.min(CARDS.length, Math.max(1, +m[1])); }
  else view = VIEWS[h] ? h : 'home';
  render();
  window.scrollTo(0, 0);
}
function go(v) { if (location.hash === '#' + v) route(); else location.hash = v; }

/* ================= 練習（選擇題、拼寫） ================= */
let Q = null, OV = null, autoT = 0;
function openOverlay(kind) { OV = kind; $('#quiz').hidden = false; document.body.style.overflow = 'hidden'; $('#quiz').scrollTop = 0; }
function closeOverlay() {
  trFlush();
  OV = null; Q = null; F = null; TRS = null; CZS = null; RDS = null; PKS = null; MXS = null; clearInterval(mockTimer); clearTimeout(autoT); TTS.stop();
  if (M && !M.done) M = null;
  $('#quiz').hidden = true; document.body.style.overflow = ''; render();
}
function startQs(qs, title, mode, words) {
  if (!qs.length) { toast('這個範圍沒有可出的題目'); return; }
  Q = { title, mode, qs, i: 0, n: 0, c: 0, wrong: [], t0: Date.now(), a: null, words: words || [...new Set(qs.map(q => q.wi))] };
  S.sess = Q; save(); openOverlay('quiz'); renderQ();
}
function startQuiz(words, title, mode, count) {
  let qs;
  if (mode === 'past') {
    qs = [];
    words.forEach(w => shuffle(PAST_BY.get(w.i) || []).forEach(p => qs.push(makeQ('past', w, p))));
    qs = qs.slice(0, count || qs.length);
  } else qs = words.map(w => makeQ(mode === 'mix' ? mixType(w) : mode, w));
  startQs(qs, title, mode, words.map(w => w.i));
}
function headerQ() {
  $('#qmode').textContent = Q.title;
  $('#qprog').textContent = `${Math.min(Q.i + 1, Q.qs.length)} / ${Q.qs.length}`;
  $('#qscore').innerHTML = `<span class="ok">✓ ${Q.c}</span>　<span class="no">✗ ${Q.n - Q.c}</span>`;
  $('#qfill').style.width = `${(Q.i + (Q.a ? 1 : 0)) / Q.qs.length * 100}%`;
}
function collQ(q, filled) { return esc(q.k).replace(/\{([^}]+)\}/, (m, a) => filled ? `<mark>${a}</mark>` : `<span class="pattern" id="pat">${patHTML(a, q.h)}</span>`); }
function renderQ() {
  const q = Q.qs[Q.i], w = W[q.wi];
  Q.a = null; headerQ();
  let h = '';
  if (q.retry) h += '<p class="kicker" style="color:var(--rose-ink)">剛才答錯的題目，再試一次（不計分）</p>';
  switch (q.t) {
    case 'e2c': h += `<div class="prompt"><p class="kicker">選出正確的中文意思</p><div class="hw">${esc(w.w)}${sayBtn(w.say)}</div><p class="pos">${esc(w.p)}</p></div>`; break;
    case 'c2e': h += `<div class="prompt"><p class="kicker">選出正確的英文單字</p><div class="zhq">${esc(w.zh)}</div><p class="pos">${esc(w.p)}</p></div>`; break;
    case 'listen': h += `<div class="prompt"><p class="kicker">聽發音，選出正確的意思</p><button class="play" type="button" data-act="say" data-text="${esc(w.say)}" aria-label="播放發音">${ICON.speak}</button><p class="muted" style="font-size:.85rem">沒聽清楚可以再按一次</p></div>`; break;
    case 'cloze': h += `<p class="kicker">選出最適當的選項・原創題</p><p class="stem">${blankStem(ORIG.get(w.i).s)}</p>`; break;
    case 'past': { const p = PAST[q.pid]; h += `<p class="kicker">歷屆詞彙題・${esc(p.src)} 第 ${p.no} 題</p><p class="stem">${pastBlank(p)}</p>`; break; }
    case 'coll': h += `<div class="prompt"><p class="kicker">填入常見搭配裡缺少的字</p><div class="colloc-q">${collQ(q)}</div><p><span class="pos">${esc(w.p)}</span>　${esc(w.zh)}</p></div>`; break;
    case 'spell': h += `<div class="prompt"><p class="kicker">拼出這個英文單字</p><div class="zhq">${esc(w.zh)}</div><p class="pos">${esc(w.p)}</p><p class="pattern" id="pat">${patHTML(w.forms[0], q.h)}</p></div>`; break;
  }
  if (q.opts) {
    const en = q.t !== 'e2c' && q.t !== 'listen';
    h += `<div class="opts" role="group" aria-label="選項">${q.opts.map((o, j) => `<button class="opt ${en ? 'en' : ''}" type="button" data-act="pick" data-j="${j}"><span class="key">${'ABCD'[j]}</span><span class="t">${esc(o.t)}</span></button>`).join('')}</div>`;
  } else {
    h += `<form class="typing" data-form="type" autocomplete="off"><input id="typeIn" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="輸入答案">
      <div class="btn-row" id="typeBtns"><button type="button" class="btn" data-act="hint">提示一個字母</button><button type="button" class="btn" data-act="giveup">不會，看答案</button><button type="submit" class="btn primary">送出</button></div></form>`;
  }
  h += '<div id="fb"></div>';
  $('#qbody').innerHTML = h;
  $('#quiz').scrollTop = 0;
  if (q.t === 'listen') setTimeout(() => TTS.say(w.say), 250);
  if (!q.opts) setTimeout(() => { const i = $('#typeIn'); if (i) i.focus({ preventScroll: true }); }, 60);
}
function pick(j) {
  if (!Q || Q.a || OV !== 'quiz') return;
  const q = Q.qs[Q.i]; if (!q.opts || !q.opts[j]) return;
  const ok = !!q.opts[j].ok;
  Q.a = { j, ok };
  $$('#qbody .opt').forEach((b, k) => { b.disabled = true; b.classList.add(q.opts[k].ok ? 'ok' : k === j ? 'no' : 'dim'); });
  afterAnswer(q, ok, {});
}
function submitTyping(giveup) {
  if (!Q || Q.a || OV !== 'quiz') return;
  const q = Q.qs[Q.i], inp = $('#typeIn'); if (!inp || q.opts) return;
  const v = norm(inp.value);
  if (!giveup && !v) { inp.focus(); return; }
  const ok = !giveup && q.acc.includes(v);
  Q.a = { v: inp.value.trim(), ok };
  inp.readOnly = true; inp.classList.add(ok ? 'ok' : 'no');
  if (giveup) inp.value = '';
  $('#typeBtns').hidden = true;
  const pat = $('#pat');
  if (pat) pat.innerHTML = `<b>${esc(q.t === 'coll' ? q.k.match(/\{([^}]+)\}/)[1] : W[q.wi].forms[0])}</b>`;
  afterAnswer(q, ok, { hint: ok && q.h > 1 });
}
function hint() {
  const q = Q && Q.qs[Q.i]; if (!q || q.opts || Q.a) return;
  const ans = q.t === 'coll' ? q.k.match(/\{([^}]+)\}/)[1] : W[q.wi].forms[0];
  if (q.h >= ans.length - 1) { toast('已經是最後一個提示了'); return; }
  q.h++;
  $('#pat').innerHTML = patHTML(ans, q.h);
  const inp = $('#typeIn'); if (inp) inp.focus({ preventScroll: true });
}
function afterAnswer(q, ok, how) {
  if (!q.retry) {
    Q.n++; if (ok) Q.c++; else Q.wrong.push(q.wi);
    record(W[q.wi], ok, q.t, how);
    if (!ok) Q.qs.splice(Math.min(Q.i + 4, Q.qs.length), 0, retryOf(q));
  }
  S.sess = Q; save(); headerQ();
  showFb(q, ok, how);
  if (q.t !== 'listen' && S.set.autoSay) TTS.say(W[q.wi].say);
  clearTimeout(autoT);
  if (ok && S.set.autoNext) autoT = setTimeout(() => { if (OV === 'quiz' && Q && Q.a) nextQ(); }, 1100);
}
function optList(q, pj) {
  const zhOpt = q.t === 'e2c' || q.t === 'listen';
  return `<div class="optlist">${q.opts.map((o, j) => {
    const x = o.wi >= 0 ? W[o.wi] : null, picked = pj === j;
    const cls = o.ok ? 'okc' : picked ? 'noc' : '';
    const label = zhOpt ? (x ? x.w : '') : o.t;
    const mean = x ? (zhOpt ? x.zh : (norm(label) !== x.w.toLowerCase() && !x.forms.includes(norm(label)) ? `${x.w}：${x.zh}` : x.zh)) : '（不在 1800 字範圍內）';
    return `<div class="${cls}"><span>${o.ok ? '✓' : picked ? '✗' : ''}</span><span class="e">${esc(label)}</span><span class="m">${esc(mean)}</span></div>`;
  }).join('')}</div>`;
}
function showFb(q, ok, how) {
  const w = W[q.wi];
  let h = `<div class="fb ${ok ? 'ok' : 'no'}">
    <div class="fb-h"><b>${ok ? (how.hint ? '答對了（有用提示）' : '答對了') : '答錯了'}</b>${q.retry ? '<span class="tag">補練不計分</span>' : ''}</div>
    <div class="fb-word"><button class="w" type="button" data-act="word" data-wi="${w.i}">${esc(w.w)}</button><span class="pos">${esc(w.p)}</span><span class="z">${esc(w.zh)}</span><span class="tools">${sayBtn(w.say, 'icon-btn')}${starBtn(w)}</span></div>
    <div class="colls">${w.k.map(k => `<span>${esc(k.replace(/[{}]/g, ''))}</span>`).join('')}</div>`;
  const pj = Q.a ? Q.a.j : -1;
  if (q.t === 'cloze') { const o = ORIG.get(w.i); h += `<p class="sent">${fillStem(o.s)}</p><p class="zh-tr">${esc(o.zh)}</p>${optList(q, pj)}`; }
  else if (q.t === 'past') { const p = PAST[q.pid]; h += `<p class="sent">${pastFill(p)}</p><p class="src">出處：大考中心 ${esc(p.src)}英文考科 第 ${p.no} 題${p.der ? `；答案 ${esc(p.opts[p.ans])} 是 ${esc(w.w)} 的衍生字` : ''}</p>${optList(q, pj)}`; }
  else {
    if (q.opts) h += optList(q, pj);
    if (q.t === 'coll') h += `<p class="sent">${collQ(q, true)}</p>`;
    if (!q.opts && !ok && Q.a.v) h += `<p class="diff">你的答案：<del>${esc(Q.a.v)}</del></p>`;
    if (q.t === 'spell' && w.forms.length > 1) h += `<p class="muted" style="font-size:.85rem">寫成 ${w.forms.map(esc).join(' 或 ')} 都算對</p>`;
    if (w.ex) h += exHTML(w.ex);
  }
  h += `<div class="fb-actions">${ok && !q.retry && lvl(w) < 3 ? `<button class="btn" type="button" data-act="easy" data-wi="${w.i}">太簡單，標為精熟</button>` : ''}<button class="btn primary" type="button" data-act="next" id="nextBtn">${Q.i + 1 >= Q.qs.length ? '看結果' : '下一題'}</button></div></div>`;
  $('#fb').innerHTML = h;
  setTimeout(() => { const f = $('#fb .fb'); if (f) f.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); if (q.opts) { const b = $('#nextBtn'); if (b) b.focus({ preventScroll: true }); } }, 40);
}
function nextQ() {
  if (!Q || Q.i >= Q.qs.length) return;
  clearTimeout(autoT); TTS.stop();
  Q.i++;
  if (Q.i >= Q.qs.length) return endQuiz();
  Q.a = null; S.sess = Q; save(); renderQ();
}
let lastQ = null;
function endQuiz() {
  const q = Q; S.sess = null; save(); lastQ = q;
  const pct = q.n ? Math.round(q.c / q.n * 100) : 0, secs = Math.round((Date.now() - q.t0) / 1000);
  const wrongWs = [...new Set(q.wrong)].map(i => W[i]);
  $('#qmode').textContent = q.title; $('#qprog').textContent = '完成'; $('#qfill').style.width = '100%';
  $('#qscore').innerHTML = '';
  $('#qbody').innerHTML = `<div class="summary"><p class="kicker">${esc(q.title)}・${q.n} 題</p><div class="score-big">${q.c}<small> / ${q.n}</small></div><p class="muted">正確率 ${pct}%・用時 ${fmtTime(secs)}</p></div>
    ${wrongWs.length ? `<section class="card"><div class="sec-h"><h2>這次答錯的字</h2><span class="muted">已收進錯題本</span></div><div class="wlist">${wrongWs.map(w => wordRow(w)).join('')}</div></section>` : '<p class="empty">全部答對。</p>'}
    <div class="btn-row">${wrongWs.length ? `<button class="btn primary" type="button" data-act="retryWrong">再練錯的 ${wrongWs.length} 個字</button>` : ''}<button class="btn" type="button" data-act="again">同樣的字再一輪</button></div>
    <div class="btn-row"><button class="btn" type="button" data-act="copyScore">複製成績</button><button class="btn" type="button" data-act="close">完成</button></div>`;
  $('#quiz').scrollTop = 0;
}

/* ================= 字卡 ================= */
let F = null;
function startCards(words, title, then) {
  if (!words.length) { toast('沒有可以看的字卡'); return; }
  F = { title, list: words.map(w => w.i), i: 0, flip: false, res: {}, then };
  openOverlay('cards'); renderF();
}
function renderF() {
  $('#qmode').textContent = F.title; $('#qscore').innerHTML = '';
  if (F.i >= F.list.length) return cardsDone();
  $('#qprog').textContent = `${F.i + 1} / ${F.list.length}`;
  $('#qfill').style.width = `${F.i / F.list.length * 100}%`;
  const w = W[F.list[F.i]], zf = S.set.zhFirst, o = ORIG.get(w.i);
  const front = zf ? `<div class="zhq">${esc(w.zh)}</div><p class="pos">${esc(w.p)}</p>` : `<div class="hw">${esc(w.w)}</div><p class="pos">${esc(w.p)}</p>${sayBtn(w.say)}`;
  const back = `<div class="top-line"><span class="hw" style="font-size:2rem">${esc(w.w)}</span>${sayBtn(w.say)}${starBtn(w)}</div>
    <p><span class="pos">${esc(w.p)}</span>　<b>${esc(w.zh)}</b></p>
    <div class="colls">${w.k.map(k => `<span>${esc(k.replace(/[{}]/g, ''))}</span>`).join('')}</div>
    ${o ? `<p class="sent">${fillStem(o.s)}</p><p class="zh-tr">${esc(o.zh)}</p>` : ''}${exHTML(w.ex)}
    <p class="src">學測出現 ${w.gs} 屆（近十年 ${w.g10} 屆）・指考 ${w.as} 屆・第 ${w.lv} 級</p>`;
  const r = F.res[w.i];
  $('#qbody').innerHTML = `${F.flip ? `<div class="fcard back">${back}</div>` : `<div class="fcard" data-act="flip" role="button" tabindex="0" aria-label="翻面">${front}<span class="hint">點一下翻面</span></div>`}
    <div class="rate" role="group" aria-label="評分">
      <button class="r1" type="button" data-act="rate" data-r="1" aria-pressed="${r === 1}">還不熟<small>列入今天複習</small></button>
      <button class="r2" type="button" data-act="rate" data-r="2" aria-pressed="${r === 2}">記住了<small>之後用測驗確認</small></button>
      <button class="r3" type="button" data-act="rate" data-r="3" aria-pressed="${r === 3}">太簡單<small>標為精熟</small></button></div>
    <div class="fnav"><button class="btn small ghost" type="button" data-act="fprev" ${F.i ? '' : 'disabled'}>${ICON.left}上一張</button><button class="btn small ghost" type="button" data-act="fnext">下一張${ICON.right}</button></div>`;
  $('#quiz').scrollTop = 0;
  if (!F.flip && !zf && S.set.autoSay) TTS.say(w.say);
}
function flip() { if (!F || F.i >= F.list.length) return; F.flip = !F.flip; renderF(); if (F.flip && S.set.zhFirst && S.set.autoSay) TTS.say(W[F.list[F.i]].say); }
function rate(r) { if (!F || F.i >= F.list.length) return; const w = W[F.list[F.i]]; rateCard(w, r); F.res[w.i] = r; save(); F.i++; F.flip = false; renderF(); }
function cardsDone() {
  const ws = F.list.map(i => W[i]);
  const n1 = ws.filter(w => F.res[w.i] === 1), n3 = ws.filter(w => F.res[w.i] === 3);
  const test = ws.filter(w => F.res[w.i] !== 3);
  $('#qprog').textContent = '完成'; $('#qfill').style.width = '100%';
  $('#qbody').innerHTML = `<div class="summary"><p class="kicker">${esc(F.title)}</p><div class="score-big">${ws.length}<small> 張</small></div>
    <p class="muted">還不熟 ${n1.length}・記住了 ${ws.length - n1.length - n3.length}・太簡單 ${n3.length}</p></div>
    <div class="btn-row">${test.length ? `<button class="btn primary" type="button" data-act="cardsTest">${F.then === 'quiz' ? '開始小測驗' : '測驗這些字'}（${test.length} 題）</button>` : ''}${n1.length ? `<button class="btn" type="button" data-act="cardsWeak">再看還不熟的 ${n1.length} 張</button>` : ''}</div>
    <div class="btn-row"><button class="btn" type="button" data-act="close">完成</button></div>`;
}

/* ================= 模擬考 ================= */
let M = null, mockTimer = 0;
function startMock(list, n, src, timed) {
  const qs = [];
  for (const w of shuffle(list)) {
    if (qs.length >= n) break;
    const can = [];
    if (src !== 'past' && ORIG.has(w.i)) can.push('cloze');
    if (src !== 'orig' && PAST_BY.has(w.i)) can.push('past');
    if (can.length) qs.push(makeQ(pickOne(can), w));
  }
  if (!qs.length) { toast('這個範圍沒有可出的模擬考題'); return; }
  M = { qs, pick: qs.map(() => -1), i: 0, t0: Date.now(), limit: timed ? qs.length * 60 : 0, done: false };
  openOverlay('mock'); renderM();
  clearInterval(mockTimer); mockTimer = setInterval(tickM, 1000);
}
function mockLeft() { return M.limit ? M.limit - Math.floor((Date.now() - M.t0) / 1000) : null; }
function tickM() {
  if (!M || M.done || OV !== 'mock') { clearInterval(mockTimer); return; }
  const left = mockLeft(), el = $('#qscore');
  if (left == null) { if (el) el.innerHTML = `<span class="mtime">${fmtClock(Math.floor((Date.now() - M.t0) / 1000))}</span>`; return; }
  if (el) el.innerHTML = `<span class="mtime ${left <= 60 ? 'warn' : ''}">剩 ${fmtClock(Math.max(0, left))}</span>`;
  if (left <= 0) { toast('時間到，自動交卷'); gradeMock(); }
}
const fmtClock = s => `${Math.floor(s / 60)}:${pad2(s % 60)}`;
function renderM() {
  if (M.done) return renderMockResult();
  const q = M.qs[M.i], n = M.qs.length;
  $('#qmode').textContent = '模擬考・詞彙題'; $('#qprog').textContent = `${M.i + 1} / ${n}`;
  $('#qfill').style.width = `${M.pick.filter(x => x >= 0).length / n * 100}%`;
  const stem = q.t === 'cloze' ? blankStem(ORIG.get(q.wi).s) : pastBlank(PAST[q.pid]);
  const src = q.t === 'past' ? `${PAST[q.pid].src} 第 ${PAST[q.pid].no} 題` : '原創題';
  $('#qbody').innerHTML = `<p class="kicker">第 ${M.i + 1} 題・${esc(src)}</p><p class="stem">${stem}</p>
    <div class="opts" role="group" aria-label="選項">${q.opts.map((o, j) => `<button class="opt en ${M.pick[M.i] === j ? 'sel' : ''}" type="button" data-act="mpick" data-j="${j}" aria-pressed="${M.pick[M.i] === j}"><span class="key">${'ABCD'[j]}</span><span class="t">${esc(o.t)}</span></button>`).join('')}</div>
    <div class="fnav"><button class="btn small" type="button" data-act="mprev" ${M.i ? '' : 'disabled'}>${ICON.left}上一題</button>${M.i < n - 1 ? `<button class="btn small" type="button" data-act="mnext">下一題${ICON.right}</button>` : '<button class="btn small primary" type="button" data-act="msubmit">交卷</button>'}</div>
    <section class="card"><div class="sec-h"><h2>作答狀況</h2><span class="muted">已答 ${M.pick.filter(x => x >= 0).length} / ${n}</span></div>
      <div class="palette">${M.qs.map((x, k) => `<button type="button" class="${M.pick[k] >= 0 ? 'done' : ''} ${k === M.i ? 'cur' : ''}" data-act="mgo" data-k="${k}" aria-label="第 ${k + 1} 題">${k + 1}</button>`).join('')}</div>
      <div class="btn-row" style="margin-top:12px"><button class="btn primary" type="button" data-act="msubmit">交卷</button></div></section>`;
  tickM();
}
async function submitMock() {
  const left = M.pick.filter(x => x < 0).length;
  if (!await ask(left ? `還有 ${left} 題沒作答，確定交卷？` : '確定交卷？', '交卷', '再檢查')) return;
  gradeMock();
}
function gradeMock() {
  if (!M || M.done) return;
  clearInterval(mockTimer);
  M.done = true; M.t1 = Date.now();
  M.ok = M.qs.map((q, k) => M.pick[k] >= 0 && !!q.opts[M.pick[k]].ok);
  M.qs.forEach((q, k) => record(W[q.wi], M.ok[k], q.t));
  save(); renderMockResult();
}
function renderMockResult() {
  const n = M.qs.length, c = M.ok.filter(Boolean).length, secs = Math.round((M.t1 - M.t0) / 1000);
  $('#qmode').textContent = '模擬考・成績'; $('#qprog').textContent = `${c} / ${n}`; $('#qscore').innerHTML = ''; $('#qfill').style.width = '100%';
  const items = M.qs.map((q, k) => {
    const w = W[q.wi], p = q.t === 'past' ? PAST[q.pid] : null, o = q.t === 'cloze' ? ORIG.get(q.wi) : null;
    const mine = M.pick[k] >= 0 ? q.opts[M.pick[k]].t : '未作答', right = q.opts.find(x => x.ok).t;
    const ol = optList(q, M.pick[k]);
    return `<details id="mr-${k}" ${M.ok[k] ? '' : 'open'}><summary><span class="mk ${M.ok[k] ? 'okc' : 'noc'}">${M.ok[k] ? '✓' : '✗'}</span><span>第 ${k + 1} 題　<span class="en">${esc(right)}</span>${M.ok[k] ? '' : `　<span class="muted">你選 ${esc(mine)}</span>`}</span></summary>
      <div class="body"><p class="sent">${p ? pastFill(p) : fillStem(o.s)}</p>${o ? `<p class="zh-tr">${esc(o.zh)}</p>` : `<p class="src">出處：大考中心 ${esc(p.src)}英文考科 第 ${p.no} 題</p>`}${ol}
      <div class="fb-word"><button class="w" type="button" data-act="word" data-wi="${w.i}">${esc(w.w)}</button><span class="pos">${esc(w.p)}</span><span class="z">${esc(w.zh)}</span><span class="tools">${starBtn(w)}</span></div></div></details>`;
  }).join('');
  const wrongN = M.ok.filter(x => !x).length;
  $('#qbody').innerHTML = `<div class="summary"><p class="kicker">模擬考・詞彙題 ${n} 題</p><div class="score-big">${c}<small> / ${n}</small></div><p class="muted">正確率 ${Math.round(c / n * 100)}%・用時 ${fmtTime(secs)}</p></div>
    <div class="palette">${M.qs.map((x, k) => `<button type="button" class="${M.ok[k] ? 'okp' : 'nop'}" data-act="mjump" data-k="${k}" aria-label="第 ${k + 1} 題">${k + 1}</button>`).join('')}</div>
    <section class="card review">${items}</section>
    <div class="btn-row">${wrongN ? `<button class="btn primary" type="button" data-act="mockWrong">練習錯的 ${wrongN} 個字</button>` : ''}<button class="btn" type="button" data-act="mockAgain">再考一回</button><button class="btn" type="button" data-act="close">完成</button></div>`;
  $('#quiz').scrollTop = 0;
}

/* ================= 單字詳情 ================= */
function openWord(wi) {
  const w = W[wi], s = S.w[w.w], o = ORIG.get(wi), ps = PAST_BY.get(wi) || [], L = lvl(w), t = today();
  const rec = s && s.n ? `作答 ${s.n} 次，答對 ${s.c} 次${s.x ? `，答錯 ${s.x} 次` : ''}。` : s && s.b ? '看過字卡，還沒有作答紀錄。' : '還沒練過。';
  const next = s && s.b ? (s.d <= t ? '今天要複習' : `下次複習：${md(s.d)}（${s.d - t} 天後）`) : '';
  openSheet(`<div class="d-head"><div class="hw" id="sheetTitle">${esc(w.w)}${sayBtn(w.say)}${starBtn(w)}</div>
      <p><span class="pos">${esc(w.p)}</span>　<b style="font-size:1.1rem">${esc(w.zh)}</b></p></div>
    <div class="d-tags"><span class="tag blue">第 ${w.lv} 級</span><a class="tag" href="#card-${w.g}" data-act="closeSheet">第 ${w.g} 組・${esc(w.card.topic)}</a><span class="tag ${L === 3 ? 'sage' : L ? 'gold' : ''}">${LVN[L]}</span>${s && s.wb ? '<span class="tag rose">在錯題本</span>' : ''}</div>
    <div class="d-sec"><h3>常見搭配</h3><div class="colls">${w.k.map(k => `<span>${esc(k.replace(/[{}]/g, ''))}</span>`).join('')}</div></div>
    ${o ? `<div class="d-sec"><h3>例句（本站原創）</h3><p class="sent">${fillStem(o.s)}${sayBtn(o.s.replace(/[{}]/g, ''), 'icon-btn')}</p><p class="zh-tr">${esc(o.zh)}</p></div>` : ''}
    ${w.ex && !ps.some(p => w.ex.startsWith(p.src + '：')) ? `<div class="d-sec"><h3>歷屆考題裡的用法</h3>${exHTML(w.ex)}</div>` : ''}
    ${ps.length ? `<div class="d-sec"><h3>歷屆詞彙題</h3>${ps.map(p => `<p class="sent">${pastFill(p)}</p><p class="src">${esc(p.src)} 第 ${p.no} 題・選項：${p.opts.map(esc).join(' / ')}</p>`).join('')}</div>` : ''}
    <div class="d-sec"><h3>考試出現情形</h3><p style="font-size:.9rem">學測 ${w.gs}/35 份（近十年 ${w.g10} 份）・指考 ${w.as}/22 份・當過正確答案 ${w.ca} 次・列為選項 ${w.op} 次</p></div>
    <div class="d-sec"><h3>我的紀錄</h3><p style="font-size:.9rem">${rec}${next ? `<br>${next}` : ''}</p></div>
    <div class="btn-row"><button class="btn primary" type="button" data-act="wordQuiz" data-wi="${wi}">專練這個字</button>${L < 3 ? `<button class="btn" type="button" data-act="easyWord" data-wi="${wi}">太簡單，標為精熟</button>` : ''}</div>
    ${s ? `<div class="btn-row">${s.wb ? `<button class="btn small" type="button" data-act="unwrong" data-wi="${wi}">移出錯題本</button>` : ''}<button class="btn small danger" type="button" data-act="wordReset" data-wi="${wi}">重設這個字的紀錄</button></div>` : ''}`);
}

/* ================= 備份 ================= */
const backupText = () => JSON.stringify({ app: 'gsat1800', v: 1, at: new Date().toISOString(), data: S });
async function importData(text) {
  let o;
  try { o = JSON.parse(String(text || '').trim()); } catch (e) { toast('讀不懂這份備份，請確認內容完整'); return; }
  const d = o && o.app === 'gsat1800' && o.data ? o.data : (o && o.w && o.set ? o : null);
  if (!d) { toast('這不是學測 1800 的備份'); return; }
  const n = Object.keys(d.w || {}).length;
  if (!await ask(`要用這份備份（${n} 個字的紀錄）取代目前的進度嗎？`, '取代')) return;
  S = normalize(d); save(); applyLook(); TTS.pick();
  if (!$('#sheet').hidden) closeSheet();
  render(); toast('已匯入備份');
}

/* ================= 外觀 ================= */
function applyLook() {
  if (ENV !== 'artifact') { if (S.set.theme === 'auto') ROOT.removeAttribute('data-theme'); else ROOT.setAttribute('data-theme', S.set.theme); }
  if (S.set.fs === 'm') ROOT.removeAttribute('data-fs'); else ROOT.setAttribute('data-fs', S.set.fs);
}

/* ================= 動作 ================= */
const wOf = el => W[+el.dataset.wi];
const busy = () => (OV === 'quiz' && !!Q && Q.i < Q.qs.length) || (OV === 'mock' && !!M && !M.done) || (OV === 'cards' && !!F && F.i < F.list.length);
const ACT = {
  go: el => go(el.dataset.to),
  goFav: () => { listTab = 'fav'; go('wrong'); },
  goWrong: () => { listTab = 'wrong'; go('wrong'); },   // 首頁的「錯題本」數的是單字，所以固定開單字那一頁（不是上次停在的分頁）
  review: () => {
    const t = today();
    const due = W.filter(w => isDue(w, t)).sort((a, b) => (isWrong(b) - isWrong(a)) || (S.w[a.w].d - S.w[b.w].d) || (S.w[a.w].b - S.w[b.w].b));
    if (!due.length) { toast('目前沒有到期的字，先學新字吧'); return; }
    startQuiz(shuffle(due.slice(0, S.set.reviewN)), '今日複習', 'mix');
  },
  learn: () => {
    const list = W.filter(w => lvl(w) === 0).slice(0, S.set.newN);
    if (!list.length) { toast('1800 字都學過了，改用今日複習或自訂練習'); return; }
    startCards(list, '學新字', 'quiz');
  },
  mockNow: () => startMock(W, 10, 'mix', true),
  trNext: () => openTrans(trNextId()),
  trOpen: el => openTrans(+el.dataset.id),
  trGo: el => { const id = +el.dataset.id; if (!TRS || !TR_BY.has(id)) return; trFlush(); TTS.stop(); TRS = { id, shown: false }; renderTr(); },
  trShow: () => trShow(),
  trList: () => { closeOverlay(); go('trans'); },
  czNext: () => { const [no, pi] = czNext(); openCloze(no, pi); },
  czOpen: el => openCloze(+el.dataset.no, +el.dataset.pi),
  czPick: el => czPick(+el.dataset.q, +el.dataset.j),
  czJump: el => czJump(+el.dataset.q),
  czSubmit: () => czSubmit(),
  czRedo: () => czRedo(),
  czGo: el => czGo(+el.dataset.d),
  czList: () => { closeOverlay(); go('cloze'); },
  rdNext: () => { const [no, pi] = rdNext(); openRead(no, pi); },
  rdOpen: el => openRead(+el.dataset.no, +el.dataset.pi),
  rdPick: el => rdPick(+el.dataset.q, +el.dataset.j),
  rdSubmit: () => rdSubmit(),
  rdRedo: () => rdRedo(),
  rdGo: el => rdGo(+el.dataset.d),
  rdList: () => { closeOverlay(); go('read'); },
  bkNext: () => openPick('bank', pkNext('bank')),
  psNext: () => openPick('struct', pkNext('struct')),
  pkOpen: el => openPick(el.dataset.kind, +el.dataset.no),
  pkAsk: el => pkAsk(+el.dataset.q),
  pkChoose: el => pkChoose(+el.dataset.j),
  pkClear: () => pkChoose(-1),
  pkSubmit: () => pkSubmit(),
  pkRedo: () => pkRedo(),
  pkGo: el => pkGo(+el.dataset.d),
  pkList: () => { const k = PKS && PKS.kind; closeOverlay(); if (k) go(k); },
  mxNext: () => openMixed(mxNext()),
  mxOpen: el => openMixed(+el.dataset.no),
  mxPick: el => mxPick(el.dataset.c),
  mxSubmit: () => mxSubmit(),
  mxSelf: () => mxSelf(),
  mxRedo: () => mxRedo(),
  mxGo: el => mxGo(+el.dataset.d),
  mxList: () => { closeOverlay(); go('mixed'); },
  wkGroup: el => { listTab = 'sets'; wkM = el.dataset.m; wkG = el.dataset.g; go('wrong'); },
  wkMode: el => { wkM = el.dataset.v; wkG = ''; render(); },
  wkClearG: () => { wkG = ''; render(); },
  wkOpen: el => wkOpen(el.dataset.m, +el.dataset.no, +el.dataset.pi, +el.dataset.i),
  resume: () => { if (!S.sess) return; Q = S.sess; openOverlay('quiz'); if (Q.a) nextQ(); else renderQ(); },
  dropResume: () => { S.sess = null; save(); render(); },
  setMode: el => { S.setup.mode = el.dataset.m; save(); render(); },
  quickMode: el => {
    const st = S.setup;
    st.mode = el.dataset.m;
    if (!rangeWords(st).some(w => modeHas(st.mode, w))) st.filter = 'all';
    save(); ACT.startSetup();
  },
  opt: el => {
    const k = el.dataset.k, v = el.dataset.v, st = S.setup;
    if (k === 'lv') { const n = +v; st.levels = st.levels.includes(n) ? st.levels.filter(x => x !== n) : st.levels.concat(n).sort(); if (!st.levels.length) st.levels = [n]; }
    else if (k === 'count' || k === 'mockN') st[k] = +v;
    else if (k === 'mockTimed') st.mockTimed = v === '1';
    else st[k] = v;
    save(); render();
  },
  pickCards: () => { openSheet(cardPickHTML()); sheetClose = () => { save(); render(); }; },
  cardToggle: el => { const n = +el.dataset.no, c = S.setup.cards; S.setup.cards = c.includes(n) ? c.filter(x => x !== n) : c.concat(n).sort((a, b) => a - b); if (!S.setup.cards.length) S.setup.cards = [n]; $('#sheetBody').innerHTML = cardPickHTML(); },
  secToggle: el => { const sec = SECS.find(s => s.key === el.dataset.s), sel = new Set(S.setup.cards), all = sec.cards.every(n => sel.has(n)); sec.cards.forEach(n => all ? sel.delete(n) : sel.add(n)); S.setup.cards = sel.size ? [...sel].sort((a, b) => a - b) : sec.cards.slice(); $('#sheetBody').innerHTML = cardPickHTML(); },
  cardsAll: el => { S.setup.cards = el.dataset.v === '1' ? CARDS.map(c => c.no) : [1]; $('#sheetBody').innerHTML = cardPickHTML(); },
  startSetup: () => {
    const st = S.setup;
    let list = rangeWords(st).filter(w => modeHas(st.mode, w));
    if (!list.length) { toast('這個範圍沒有題目，請調整範圍或篩選'); return; }
    if (st.mode === 'mock') return startMock(list, st.mockN, st.mockSrc, st.mockTimed);
    list = orderWords(list, st.order);
    if (st.mode === 'cards') return startCards(list.slice(0, st.count), '字卡');
    if (st.mode === 'past') return startQuiz(list, TYPES.past.name, 'past', st.count);
    startQuiz(list.slice(0, st.count), modeName(st.mode), st.mode);
  },
  cardQuiz: el => { const c = CARDS[+el.dataset.no - 1]; startQuiz(shuffle(c.words), `第 ${c.no} 組`, 'mix'); },
  cardFlash: el => { const c = CARDS[+el.dataset.no - 1]; startCards(c.words, `第 ${c.no} 組字卡`); },
  word: el => openWord(+el.dataset.wi),
  closeSheet: () => closeSheet(),
  say: el => TTS.say(el.dataset.text),
  star: el => {
    const w = wOf(el); if (S.fav[w.w]) delete S.fav[w.w]; else S.fav[w.w] = today();
    save();
    $$(`[data-act="star"][data-wi="${w.i}"]`).forEach(b => { b.classList.toggle('on', isFav(w)); b.setAttribute('aria-pressed', isFav(w)); });
    toast(isFav(w) ? `已收藏 ${w.w}` : `已取消收藏 ${w.w}`);
    if (OV == null && $('#sheet').hidden && (view === 'wrong' || view === 'home')) render();
  },
  pick: el => pick(+el.dataset.j),
  hint: () => hint(),
  giveup: () => submitTyping(true),
  next: () => nextQ(),
  easy: el => { markEasy(wOf(el)); save(); toast(`${wOf(el).w} 已標為精熟`); el.remove(); },
  easyWord: el => { markEasy(wOf(el)); save(); toast(`${wOf(el).w} 已標為精熟`); openWord(+el.dataset.wi); if (OV == null) render(); },
  unwrong: el => { const s = S.w[wOf(el).w]; if (s) { s.wb = 0; s.gr = today(); } save(); openWord(+el.dataset.wi); if (OV == null) render(); },
  wordReset: async el => { const w = wOf(el); if (!await ask(`要清除 ${w.w} 的作答紀錄嗎？`, '清除')) return; delete S.w[w.w]; save(); openWord(w.i); if (OV == null) render(); },
  wordQuiz: el => {
    const w = wOf(el);
    const types = ['e2c', 'c2e', 'cloze', 'past', 'coll', 'spell'].filter(t => hasType(t, w));
    closeSheet();
    if (busy()) { toast('請先完成目前的練習'); return; }
    startQs(shuffle(types).map(t => makeQ(t, w)), `${w.w} 專練`, 'word', [w.i]);
  },
  quit: async () => {
    if (OV === 'quiz' && Q && Q.i < Q.qs.length) {
      if (Q.n && !await ask('先離開這次練習？已作答的紀錄都已儲存，之後可以在「今日」接著做。', '離開', '繼續作答')) return;
    } else if (OV === 'mock' && M && !M.done) {
      if (!await ask('離開模擬考？這次的作答不會計分。', '離開', '繼續作答')) return;
    }
    closeOverlay();
  },
  close: () => closeOverlay(),
  retryWrong: () => { const ws = [...new Set(lastQ.wrong)].map(i => W[i]); startQuiz(shuffle(ws), '錯題再練', 'mix'); },
  again: () => { const ws = (lastQ.words || []).map(i => W[i]); if (lastQ.mode === 'word') return ACT.wordQuiz({ dataset: { wi: ws[0].i } }); startQuiz(shuffle(ws), lastQ.title, lastQ.mode === 'past' ? 'past' : (TYPES[lastQ.mode] ? lastQ.mode : 'mix')); },
  copyScore: () => { const q = lastQ; copyText(`學測英文復興計劃｜${q.title} ${q.n} 題答對 ${q.c} 題（${q.n ? Math.round(q.c / q.n * 100) : 0}%）`, '已複製成績'); },
  flip: () => flip(),
  rate: el => rate(+el.dataset.r),
  fprev: () => { if (F && F.i > 0) { F.i--; F.flip = false; renderF(); } },
  fnext: () => { if (F) { F.i++; F.flip = false; renderF(); } },
  cardsTest: () => { const ws = F.list.map(i => W[i]).filter(w => F.res[w.i] !== 3); const title = F.then === 'quiz' ? '新字小測驗' : `${F.title}測驗`; startQuiz(shuffle(ws.length ? ws : F.list.map(i => W[i])), title, 'mix'); },
  cardsWeak: () => { const ws = F.list.map(i => W[i]).filter(w => F.res[w.i] === 1); startCards(ws, '還不熟的字', F.then); },
  mpick: el => { if (!M || M.done) return; const j = +el.dataset.j; M.pick[M.i] = M.pick[M.i] === j ? -1 : j; renderM(); },
  mprev: () => { if (M.i > 0) { M.i--; renderM(); } },
  mnext: () => { if (M.i < M.qs.length - 1) { M.i++; renderM(); } },
  mgo: el => { M.i = +el.dataset.k; renderM(); },
  msubmit: () => submitMock(),
  mjump: el => { const d = $(`#mr-${el.dataset.k}`); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } },
  mockWrong: () => { const ws = M.qs.filter((q, k) => !M.ok[k]).map(q => W[q.wi]); startQuiz(shuffle(ws), '模擬考錯題', 'mix'); },
  mockAgain: () => { const st = S.setup; const list = (st.mode === 'mock' ? rangeWords(st) : W); startMock(list.length ? list : W, M.qs.length, st.mode === 'mock' ? st.mockSrc : 'mix', !!M.limit); },
  listTab: el => { listTab = el.dataset.v; render(); },
  listSort: el => { listSort = el.dataset.v; render(); },
  listQuiz: () => { const ws = listWords(listTab); startQuiz(shuffle(ws), listTab === 'fav' ? '收藏練習' : listTab === 'grad' ? '已畢業複習' : '錯題練習', 'mix'); },
  listCards: () => startCards(listWords(listTab), listTab === 'fav' ? '收藏字卡' : '錯題字卡'),
  copyList: () => {
    const ws = listWords(listTab);
    const name = listTab === 'fav' ? '收藏' : listTab === 'grad' ? '已畢業' : '錯題本';
    copyText(`學測英文復興計劃｜${name}（${ws.length} 字）\n` + ws.map(w => { const s = S.w[w.w]; return `${w.w}（${w.p}）${w.zh}${s && s.x ? `｜錯 ${s.x} 次` : ''}`; }).join('\n'), '已複製清單');
  },
  exportFile: () => download(`學測1800備份_${dkey()}.json`, backupText()),
  exportCode: () => copyText(backupText(), '已複製備份碼，請貼到記事本保存'),
  importCode: () => openSheet(`<h2 id="sheetTitle">貼上備份碼</h2><p class="muted">把之前複製的備份碼整段貼進來。</p><textarea class="copybox" id="pasteBox" placeholder='{"app":"gsat1800",...}'></textarea><div class="btn-row"><button class="btn primary" type="button" data-act="doImport">匯入</button></div>`),
  doImport: () => importData($('#pasteBox').value),
  reset: async () => {
    if (!await ask('要清除所有作答紀錄、錯題本和收藏嗎？清除後無法復原，建議先備份。', '全部清除')) return;
    const set = S.set; S = fresh(); S.set = set; save(); render(); toast('已清除所有紀錄');
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  if (el.tagName === 'A' && el.dataset.act === 'closeSheet') { closeSheet(); return; }
  e.preventDefault(); fn(el, e);
});
document.addEventListener('submit', e => { if (e.target.matches('[data-form="type"]')) { e.preventDefault(); submitTyping(false); } });
document.addEventListener('input', e => {
  if (e.target.id === 'q') { searchQ = e.target.value; const r = $('#results'); if (r) r.innerHTML = searchQ.trim() ? resultsHTML() : sectionsHTML(); }
  else if (e.target.dataset && e.target.dataset.tr) trInput(e.target);
  else if (e.target.dataset && e.target.dataset.mx) mxInput(e.target);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'importFile') { const f = el.files && el.files[0]; if (f) { const r = new FileReader(); r.onload = () => importData(r.result); r.readAsText(f); } el.value = ''; return; }
  const k = el.dataset && el.dataset.set; if (!k) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (['goal', 'newN', 'grad', 'reviewN', 'rate'].includes(k)) v = +v;
  if (k === 'exam' && !dnum(v)) return;
  S.set[k] = v; save(); applyLook();
  if (k === 'accent') TTS.pick();
  if (k === 'sound' && !v) TTS.stop();
  render();
});
document.addEventListener('keydown', e => {
  if (!$('#dialog').hidden) { if (e.key === 'Escape' && dlgDone) dlgDone(false); return; }
  if (!$('#sheet').hidden) { if (e.key === 'Escape') closeSheet(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('span[role="button"][data-act]')) { e.preventDefault(); e.target.click(); return; }
  if (OV === 'mixed' && e.key === 'Enter' && e.target.dataset && e.target.dataset.mx) { e.preventDefault(); const nx = e.target.dataset.mx === 'f0' ? $('#mxf1') : null; if (nx) nx.focus(); else e.target.blur(); return; }
  if (!OV) return;
  const tag = e.target.tagName, typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  if (e.key === 'Escape') { ACT.quit(); return; }
  const k4 = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf((e.key || '').toLowerCase());
  const onBtn = e.target.tagName === 'BUTTON' || e.target.tagName === 'A';
  if (OV === 'quiz' && Q) {
    if (Q.a) {
      if (onBtn && (e.key === 'Enter' || e.key === ' ')) return;  // 讓按鈕自己處理，避免連跳兩題
      if (e.key === 'Enter' || (!typing && (e.key === ' ' || e.key === 'ArrowRight'))) { e.preventDefault(); nextQ(); }
      return;
    }
    if (typing) return;
    if (k4 >= 0 && e.key.length === 1 && !e.metaKey && !e.ctrlKey) { e.preventDefault(); pick(k4); }
  } else if (OV === 'cards' && F) {
    if (F.i >= F.list.length || e.target.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    else if (e.key === 'ArrowRight') ACT.fnext(); else if (e.key === 'ArrowLeft') ACT.fprev();
    else if ('123'.includes(e.key) && e.key.length === 1) rate(+e.key);
  } else if (OV === 'mock' && M && !M.done) {
    if (k4 >= 0 && e.key.length === 1 && !e.metaKey && !e.ctrlKey) { M.pick[M.i] = k4; renderM(); }
    else if (e.key === 'ArrowRight') ACT.mnext(); else if (e.key === 'ArrowLeft') ACT.mprev();
  }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') trFlush(); else if (!OV) render(); });
window.addEventListener('hashchange', route);

applyLook();
route();
if (ENV !== 'artifact' && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
// 給自動測試用
window.__app = { get S() { return S; }, normalize, render, go, openWord, W, ORIG, PAST, PAST_BY, CARDS, ACT, makeQ, pickDistractors, record, rangeWords, startQuiz, startMock, pick, submitTyping, nextQ, rate, get Q() { return Q; }, get M() { return M; }, get F() { return F; }, lvl, levelCounts, searchWords, mixType, clash, TR, openTrans, get TRS() { return TRS; }, CZ, RD, BK, PS, MX, SETS, MODE_NO, openPick, openMixed, mxGrade, mxNorm, pkSents, get PKS() { return PKS; }, get MXS() { return MXS; }, get OV() { return OV; },
  wk: { WEAK, WEAK_MIN, items: wkItems, stats: wkStats, rec: wkRec, wrong: wkWrong, open: wkOpen, get m() { return wkM; }, get g() { return wkG; } } };
})();
