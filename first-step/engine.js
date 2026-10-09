"use strict";
// 日時は保存時にISO、集計は日本時間。時間は秒で記録する。
const FirstStep = (() => {
  const KEY = "yurumana-first-step-v1";
  const categories = ["準備", "動画・授業", "レポート", "復習・整理"];
  const rows = [
    ["pc", "PCを開く", 0, "start", "portal", "PCを開きます。", "PCを開きました。"],
    ["portal", "大学の学習ページを開く", 0, "start", "choose", "大学の学習ページを開きます。", "大学の学習ページを開きました。"],
    ["plan", "今日の学習内容を確認する", 0, "start", "choose", "今日の学習内容を確認します。", "今日の学習内容を確認しました。"],
    ["choose", "次に見る授業を決める", 0, "start", "play", "次に見る授業を決めます。", "次に見る授業を決めました。"],
    ["deadline", "締切を1つ確認する", 0, "start", "report-page", "締切を1つ確認します。", "締切を1つ確認しました。"],
    ["play", "動画の再生ボタンを押す", 1, "start", "video", "動画の再生ボタンを押します。", "動画の再生ボタンを押しました。"],
    ["video", "動画を1本見る", 1, "work", "question", "動画を1本見ます。", "動画を1本見ました。"],
    ["lesson", "授業を1回分進める", 1, "work", "question", "授業を1回分進めます。", "授業を1回分進めました。"],
    ["memo", "授業のメモを1つ取る", 1, "work", "video", "授業のメモを1つ取ります。", "授業のメモを1つ取りました。"],
    ["question", "レポートの設問を読む", 2, "start", "report5", "レポートの設問を読みます。", "レポートの設問を読みました。"],
    ["report-page", "レポートのページを開く", 2, "start", "question", "レポートのページを開きます。", "レポートのページを開きました。"],
    ["draft", "レポートの下書きを始める", 2, "work", "report5", "レポートの下書きを始めます。", "レポートの下書きを始めました。"],
    ["report5", "レポートを5分進める", 2, "work", "report10", "レポートを5分進めます。", "レポートを5分進めました。"],
    ["report10", "レポートを10分進める", 2, "work", "finish-report", "レポートを10分進めます。", "レポートを10分進めました。"],
    ["report15", "レポートを15分進める", 2, "work", "finish-report", "レポートを15分進めます。", "レポートを15分進めました。"],
    ["finish-report", "レポートを完成させる", 2, "work", "submit", "レポートを完成させます。", "レポートを完成させました。"],
    ["submit", "レポートを1本提出する", 2, "work", "next", "レポートを1本提出します。", "レポートを1本提出しました。"],
    ["review", "前回の授業内容を5分復習する", 3, "work", "next", "前回の授業内容を5分復習します。", "前回の授業内容を5分復習しました。"],
    ["notes", "ノートを5分見返す", 3, "work", "next", "ノートを5分見返します。", "ノートを5分見返しました。"],
    ["schedule", "学習予定を確認する", 3, "start", "next", "学習予定を確認します。", "学習予定を確認しました。"],
    ["next", "次にやることを1つ決める", 3, "start", null, "次にやることを1つ決めます。", "次にやることを1つ決めました。"]
  ];
  const missions = rows.map(([id, name, category, type, next, goal, report]) => ({id, name, category: categories[category], type, next, goal: `今日の目標：${goal}`, report, countTime: type === "work", automatic: true}));
  const defaults = () => ({schemaVersion: 1, settings: {soundEnabled: true, volume: 0.35, motion: "full"}, customMissions: [], records: [], activeSession: null, route: {done: [], lastId: null}});
  const id = prefix => `${prefix}-${globalThis.crypto.randomUUID()}`;
  const allMissions = data => [...missions, ...data.customMissions];
  function suggest(data, from = data.route.lastId, excluded = []) {
    const all = allMissions(data), visited = new Set([...data.route.done, ...excluded]);
    let candidate = all.find(m => m.id === from)?.next;
    const seen = new Set();
    while (candidate && !seen.has(candidate)) {
      seen.add(candidate);
      const m = all.find(m => m.id === candidate);
      if (!m) break;
      if (!visited.has(m.id)) return m;
      candidate = m.next;
    }
    return all.find(m => m.automatic && !visited.has(m.id)) || null;
  }
  function elapsed(active, now = Date.now()) {
    if (!active || active.phase === "countdown" || active.mission.type !== "work") return 0;
    return Math.max(0, Math.min(31536000, Math.floor((active.elapsedMs + (active.resumedAt === null ? 0 : Math.max(0, now - active.resumedAt))) / 1000)));
  }
  function pause(active, now = Date.now()) {
    if (active.phase === "running" && active.resumedAt !== null) {
      active.elapsedMs += Math.max(0, now - active.resumedAt);
      active.elapsedMs = Math.min(active.elapsedMs, 31536000000);
      active.resumedAt = null;
    }
  }
  function begin(mission, now = Date.now()) {
    return {id: id("session"), mission: {...mission}, phase: "countdown", countdownEnd: now + 5000, startedAt: null, elapsedMs: 0, resumedAt: null, timerTarget: null};
  }
  function startWork(active, now = Date.now()) {
    if (active.phase !== "countdown" || now < active.countdownEnd) return false;
    active.phase = "running";
    active.startedAt = new Date(active.countdownEnd).toISOString();
    active.resumedAt = active.mission.type === "work" ? active.countdownEnd : null;
    return true;
  }
  function complete(data, now = Date.now()) {
    const active = data.activeSession;
    if (!active || active.phase !== "running") return null;
    const seconds = elapsed(active, now);
    const record = {id: active.id, missionId: active.mission.id, name: active.mission.name, type: active.mission.type, startedAt: active.startedAt, completedAt: new Date(now).toISOString(), elapsedSeconds: seconds, studySeconds: active.mission.countTime ? seconds : 0, corrected: false};
    if (data.records.some(r => r.id === record.id)) return null;
    data.records.push(record);
    data.route.done = [...new Set([...data.route.done, active.mission.id])];
    data.route.lastId = active.mission.id;
    data.activeSession = null;
    return record;
  }
  function dayKey(value = Date.now()) {
    const date = new Date(value);
    return new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  }
  function weekKey(value = Date.now()) {
    const key = dayKey(value), date = new Date(`${key}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    return date.toISOString().slice(0,10);
  }
  function totals(records) { return {count: records.length, seconds: records.reduce((sum, r) => sum + r.studySeconds, 0)}; }
  function statistics(records, now = Date.now()) {
    const today = dayKey(now), week = weekKey(now);
    return {today: totals(records.filter(r => dayKey(r.completedAt) === today)), week: totals(records.filter(r => weekKey(r.completedAt) === week)), all: totals(records)};
  }
  function formatTime(seconds, precise = false) {
    seconds = Math.max(0, Math.floor(seconds));
    if (precise) return `${Math.floor(seconds / 3600) ? Math.floor(seconds / 3600) + ":" : ""}${String(Math.floor(seconds / 60) % 60).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;
    const minutes = Math.floor(seconds / 60), hours = Math.floor(minutes / 60);
    if (seconds > 0 && seconds < 60) return "1分未満";
    return hours ? `${hours}時間${minutes % 60 ? minutes % 60 + "分" : ""}` : `${minutes}分`;
  }
  // バックアップを新しいオブジェクトへ検証・コピーする。不正データでは既存データを変えない。
  function validate(raw) {
    const bad = () => { throw new Error("バックアップの形式が正しくありません。対応バージョンは1です。"); };
    const obj = x => x && typeof x === "object" && !Array.isArray(x);
    const str = (x, max = 200, empty = false) => typeof x === "string" && x.length <= max && (empty || x.trim().length > 0);
    const validId = x => str(x,100) && /^[a-zA-Z0-9_-]+$/.test(x);
    const number = (x, max = 31536000) => Number.isSafeInteger(x) && x >= 0 && x <= max;
    const date = x => typeof x === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x;
    function mission(m, custom = false) {
      if (!obj(m) || !validId(m.id) || (custom && !m.id.startsWith("custom-")) || !str(m.name) || !str(m.category,60) || !["start","work"].includes(m.type) || typeof m.automatic !== "boolean" || m.countTime !== (m.type === "work") || !str(m.goal,1000,true) || !str(m.report,1000,true) || (m.next !== null && !validId(m.next))) bad();
      return {id:m.id, name:m.name, category:m.category, type:m.type, automatic:m.automatic, countTime:m.countTime, goal:m.goal, report:m.report, next:m.next};
    }
    if (!obj(raw) || raw.schemaVersion !== 1 || !obj(raw.settings) || typeof raw.settings.soundEnabled !== "boolean" || (raw.settings.volume !== undefined && (typeof raw.settings.volume !== "number" || !Number.isFinite(raw.settings.volume) || raw.settings.volume < 0 || raw.settings.volume > 1)) || !["full","light","off"].includes(raw.settings.motion) || !Array.isArray(raw.customMissions) || raw.customMissions.length > 100 || !Array.isArray(raw.records) || raw.records.length > 10000 || !obj(raw.route) || !Array.isArray(raw.route.done) || raw.route.done.length > 150 || !raw.route.done.every(validId) || new Set(raw.route.done).size !== raw.route.done.length || (raw.route.lastId !== null && !validId(raw.route.lastId))) bad();
    const out = defaults(); out.settings = {soundEnabled:raw.settings.soundEnabled, volume:raw.settings.volume ?? 0.35, motion:raw.settings.motion};
    out.customMissions = raw.customMissions.map(m => mission(m,true));
    if (new Set(out.customMissions.map(m=>m.id)).size !== out.customMissions.length || out.customMissions.some(m=>missions.some(p=>p.id===m.id))) bad();
    out.records = raw.records.map(r => {
      if (!obj(r) || !validId(r.id) || !validId(r.missionId) || !str(r.name) || !["start","work"].includes(r.type) || !date(r.startedAt) || !date(r.completedAt) || Date.parse(r.completedAt) < Date.parse(r.startedAt) || !number(r.elapsedSeconds) || !number(r.studySeconds) || typeof r.corrected !== "boolean" || (r.type === "start" && r.studySeconds !== 0)) bad();
      return {id:r.id, missionId:r.missionId, name:r.name, type:r.type, startedAt:r.startedAt, completedAt:r.completedAt, elapsedSeconds:r.elapsedSeconds, studySeconds:r.studySeconds, corrected:r.corrected};
    });
    if (new Set(out.records.map(r=>r.id)).size !== out.records.length) bad();
    out.route = {done:[...raw.route.done], lastId:raw.route.lastId};
    if (raw.activeSession !== null) {
      const a = raw.activeSession;
      if (!obj(a) || !validId(a.id) || out.records.some(r=>r.id === a.id) || !["countdown","running"].includes(a.phase) || !number(a.countdownEnd,8640000000000000) || !number(a.elapsedMs,31536000000) || (a.resumedAt !== null && !number(a.resumedAt,8640000000000000)) || (a.timerTarget !== null && !number(a.timerTarget)) || (a.phase === "running" ? !date(a.startedAt) : a.startedAt !== null) || (a.phase === "countdown" && (a.resumedAt !== null || a.elapsedMs !== 0 || a.timerTarget !== null)) || (a.phase === "running" && a.resumedAt !== null && a.resumedAt < Date.parse(a.startedAt))) bad();
      out.activeSession = {id:a.id, mission:mission(a.mission), phase:a.phase, countdownEnd:a.countdownEnd, startedAt:a.startedAt, elapsedMs:a.elapsedMs, resumedAt:a.resumedAt, timerTarget:a.timerTarget};
    }
    return out;
  }
  return {KEY, categories, missions, defaults, id, allMissions, suggest, elapsed, pause, begin, startWork, complete, dayKey, weekKey, totals, statistics, formatTime, validate};
})();
if (typeof module !== "undefined") module.exports = FirstStep;
