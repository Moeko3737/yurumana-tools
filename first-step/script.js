"use strict";
const F = FirstStep;
const $ = id => document.getElementById(id);
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const button = (action, text, className = "", extra = "") => `<button type="button" data-action="${action}" class="${className}" ${extra}>${text}</button>`;
const isoNow = () => new Date().toISOString();
let data = F.defaults(), blocked = false, screen = "home", selected = null, lastRecord = null;
let alternativeIds = [], restored = false, timerAnnounced = false, interval;
let audioContext, celebrationTimeout;
try {
  const saved = localStorage.getItem(F.KEY);
  if (saved) data = F.validate(JSON.parse(saved));
} catch {
  blocked = true;
  $("storage-status").hidden = false;
  $("storage-status").textContent = "保存データを読み込めませんでした。元のデータは上書きしていません。「設定」から元のデータを書き出すか、バックアップを復元してください。";
}
function status(message = "") { $("status").textContent = message; }
function save() {
  if (blocked) return;
  try { localStorage.setItem(F.KEY, JSON.stringify(data)); $("storage-status").hidden = true; }
  catch { $("storage-status").hidden = false; $("storage-status").textContent = "このブラウザに保存できませんでした。記録を残すには設定からバックアップを書き出してください。"; }
}
function updateSound() {
  $("sound-toggle").textContent = data.settings.soundEnabled ? "音 ON" : "音 OFF";
  $("sound-toggle").setAttribute("aria-pressed", String(data.settings.soundEnabled));
}
// 承認した1枚の画像から、CSSで3つの姿を表示する。
function buddy(pose = "sit", small = false) {
  return `<div class="buddy-stage${small ? " buddy-small" : ""}" aria-hidden="true"><div class="mascot mascot-${pose}"><span class="buddy-flower flower-left">✿</span><span class="buddy-flower flower-right">✿</span></div></div>`;
}
function heading(title) { return `<h2 id="screen-heading" tabindex="-1">${title}</h2>`; }
function show(name, html, focus = true) {
  screen = name; document.body.dataset.screen = name; $("screen").innerHTML = html; status();
  if (focus) $("screen-heading")?.focus({preventScroll:true});
  window.scrollTo({top:0, behavior:"instant"});
}
function home(focus = true) {
  show("home", `${buddy("rest")}${heading("なにか、ちょっとやる？")}
    <div class="home-actions">${button("automatic","おまかせ","primary large")}${button("choose","自分で選ぶ","large")}</div>
    <details id="home-menu"><summary>記録と設定</summary><nav class="home-links" aria-label="記録と設定">${button("today","今日の記録")}${button("history","これまでの記録")}${button("custom","マイミッション")}${button("settings","設定")}</nav></details>`, focus);
}
function shareBox(kind, mission) {
  const text = kind === "goal" ? mission.goal || `今日の目標：${mission.name}` : mission.report || `今日の達成：${mission.name}`;
  return `<details class="share-box"><summary>${kind === "goal" ? "目標宣言" : "達成報告"}の文章をコピー</summary><label for="share-text">コピーする文章（編集できます）</label><textarea id="share-text" maxlength="1000">${escapeHTML(text)}</textarea>${button("copy","文章をコピー")}
    <p id="copy-message" class="help" role="status"></p><a id="slack-link" class="slack-link" href="https://zen-student.slack.com/archives/C0C5ZDWTQF5" target="_blank" rel="noopener noreferrer" hidden>ゆるまなのSlackチャンネルを開く →</a></details>`;
}
function propose(mission) {
  if (!mission) { choose(); status("ひと通り進みました。次は好きなミッションを選べます。"); return; }
  selected = {...mission};
  show("proposal", `${button("home","← トップへ","back")}${buddy("sit")}${heading("これとか、どう？")}
    <div class="mission-main"><h3 class="mission-title">${escapeHTML(mission.name)}</h3></div>
    ${button("start","今からやる","primary large")}
    <div class="actions">${button("alternative","別のにする")}${button("choose","自分で選ぶ")}</div>
    ${button("skip","もうできてる → 次の候補","quiet")}${shareBox("goal",mission)}`);
}
function choose() {
  const all = F.allMissions(data), categories = [...new Set(all.map(m=>m.category))];
  show("choose", `${button("return","← 戻る","back")}${heading("気になるものを、1つ選んでみよう。")}
    <p class="help">動画1本と授業1回分は、別のミッションです。</p>
    ${categories.map(category => `<section class="selection-group"><h3>${escapeHTML(category)}</h3><div class="selection-list">${all.filter(m=>m.category === category).map(m=>button("select", `${escapeHTML(m.name)}<small>${m.type === "work" ? "作業" : "着手"}</small>`, "", `data-id="${m.id}"`)).join("")}</div></section>`).join("")}`);
}
function startCountdown() {
  if (blocked) { status("保存データを保護するため、先に設定からバックアップの復元またはリセットを行ってください。"); return; }
  if (!selected || data.activeSession) return;
  data.activeSession = F.begin(selected); timerAnnounced = false; save(); countdown();
}
function countdown() {
  show("countdown", `${heading("じゃ、のんびりいこう。")}${buddy("rest")}
    <div id="countdown-number" class="countdown-number center" aria-live="polite" aria-atomic="true">5</div>
    ${button("cancel-countdown","いったん戻る","large")}`);
  tick();
}
function running() {
  const a = data.activeSession;
  if (!a) return home();
  show("running", `${buddy("sit",true)}${heading("いまは、これだけ。") }
    <h3 class="mission-title">${escapeHTML(a.mission.name)}</h3>
    ${a.mission.type === "work" ? `<div class="center"><p id="timer-label" class="eyebrow">経過時間</p><div id="work-time" class="time-display" role="timer" aria-live="off">00:00</div><p id="elapsed-time" class="elapsed"></p></div>
      <p id="timer-message" class="notice" role="status" hidden></p><div id="timer-ended" class="actions" hidden>${button("extend","あと5分")}${button("continue","このまま続ける")}</div>
      <div class="actions">${button("pause",a.resumedAt === null ? "再開" : "一時停止")}</div>` : ""}
    ${button("complete","できた！","primary large")}
    ${a.mission.type === "work" ? `<details class="timer-settings"><summary>作業用タイマーを設定・変更</summary><label for="timer-choice">タイマーの長さ</label><select id="timer-choice"><option value="0">タイマーなし</option><option value="5">5分</option><option value="10">10分</option><option value="15">15分</option><option value="25">25分</option><option value="custom">自由設定</option></select><div id="custom-timer" hidden><label for="timer-minutes">時間（1〜1440分）</label><input id="timer-minutes" type="number" min="1" max="1440" value="5" inputmode="numeric"></div>${button("set-timer","この設定にする")}<p class="help">今からの時間を設定します。時間になっても自動完了はしません。</p></details>` : ""}
    <div class="actions">${button("change","違うことにする")}${button("quit","今回はここまで")}</div>`);
  tick();
}
function tick() {
  const a = data.activeSession;
  if (!a || restored) return;
  const now = Date.now();
  if (a.phase === "countdown") {
    const seconds = Math.max(0, Math.ceil((a.countdownEnd - now) / 1000));
    if ($("countdown-number") && $("countdown-number").textContent !== String(seconds)) $("countdown-number").textContent = seconds ? String(seconds) : "スタート！";
    const mascot = document.querySelector(".mascot");
    if (mascot) mascot.className = `mascot mascot-${seconds > 3 ? "rest" : seconds > 1 ? "sit" : "hop"}`;
    if (F.startWork(a,now)) { save(); running(); status(); }
  } else if (screen === "running" && a.mission.type === "work") {
    const elapsed = F.elapsed(a,now), remaining = a.timerTarget === null ? null : Math.max(0,a.timerTarget-elapsed);
    $("timer-label").textContent = remaining === null ? "経過時間" : "残り時間";
    $("work-time").textContent = F.formatTime(remaining === null ? elapsed : remaining,true);
    $("elapsed-time").textContent = `${remaining === null ? "" : `経過 ${F.formatTime(elapsed,true)} · `}${a.resumedAt === null ? "一時停止中" : "計測中"}`;
    const ended = remaining === 0;
    $("timer-message").hidden = !ended;
    $("timer-ended").hidden = !ended;
    if (ended) {
      $("timer-message").textContent = "時間になりました。続けるか、できたかは自分で選べます。";
      if (!timerAnnounced) { timerAnnounced = true; sound(false); }
    }
  }
}
function restoredScreen() {
  restored = true;
  const a = data.activeSession;
  // 再読み込みまでの時刻差を仮計測し、確認画面では停止する。長時間の分は完了後に修正可能。
  F.pause(a); save();
  show("restore", `${heading("前回の続きから再開しますか？")}<h3 class="mission-title">${escapeHTML(a.mission.name)}</h3>
    <p class="notice">離れていた間の時間も仮の計測に含まれます。実際に学習した時間は、完了後に確認・修正してください。今は計測を停止しています。</p>
    <div class="actions">${button("resume-session","再開する","primary")}${button("quit","今回は終了する")}</div>`);
}
function recordEditor(record) {
  return `<details><summary>記録した時間を修正する</summary><form data-form="time" data-id="${record.id}"><label for="time-${record.id}">実際に勉強した時間（分）</label><input class="edit-time" id="time-${record.id}" name="minutes" type="number" min="0" max="525600" step="0.01" value="${Math.round(record.studySeconds / 60 * 100) / 100}" required ${record.type === "start" ? "disabled" : ""}>
    <p class="help">${record.type === "start" ? "着手ミッションは完了数に含め、学習時間は0分として記録します。" : "0分でもOK。離れていた時間や休憩を除いて調整できます。"}</p>${record.type === "work" ? `<button type="submit">時間を保存</button>` : ""}</form></details>`;
}
function completed(record, mission) {
  lastRecord = record; selected = mission;
  show("completed", `${buddy("hop")}${heading("できたね。")}
    <h3 class="mission-title">${escapeHTML(record.name)}</h3>
    <div id="celebration" class="celebration-message" hidden><span id="cheer" role="status">やった〜</span>${button("skip-celebration","動きをとめる","quiet",'id="skip-celebration"')}</div>
    <div class="actions equal-actions">${button("another","もう1個やる")}${button("finish","今日はここまで")}</div>
    ${record.type === "work" ? `<p id="recorded-time" class="help">学習時間 ${F.formatTime(record.studySeconds)}</p>${recordEditor(record)}` : ""}
    ${shareBox("report",mission)}`);
}
function summary() {
  const today = data.records.filter(r=>F.dayKey(r.completedAt) === F.dayKey());
  const totals = F.totals(today);
  data.route = {done:[],lastId:null}; alternativeIds = []; save();
  show("summary", `${buddy("rest",true)}${heading("じゃ、またね〜")}
    <details class="today-summary"><summary>今日のまとめ</summary>
    <ul>${today.map(r=>`<li>${escapeHTML(r.name)}</li>`).join("") || "<li>今回はここまで。完了記録は追加していません。</li>"}</ul>
    <p><strong>完了ミッション：${totals.count}個</strong><br>学習時間：${F.formatTime(totals.seconds)}</p></details>
    <div class="actions">${button("today","今日の記録を見る")}${button("home","トップへ戻る")}</div>`);
}
function recordMarkup(r) {
  const date = new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit"}).format(new Date(r.completedAt));
  return `<article class="record"><h3>${escapeHTML(r.name)}</h3><p class="help">${date} · ${r.type === "start" ? "着手" : "作業"} · 学習時間 ${F.formatTime(r.studySeconds)}${r.corrected ? "（修正済み）" : ""}</p>${recordEditor(r)}<div class="actions">${button("delete-record","記録を削除","quiet danger",`data-id="${r.id}"`)}</div></article>`;
}
function records(todayOnly = false) {
  const stats = F.statistics(data.records), today = F.dayKey();
  const rows = data.records.filter(r=>!todayOnly || F.dayKey(r.completedAt) === today).slice().sort((a,b)=>b.completedAt.localeCompare(a.completedAt));
  const days = [...new Set(rows.map(r=>F.dayKey(r.completedAt)))];
  const weeks = [...new Set(data.records.map(r=>F.weekKey(r.completedAt)))].sort().reverse();
  show(todayOnly ? "today" : "history", `${button("home","← トップへ","back")}${heading(todayOnly ? "今日の記録" : "これまでの記録")}
    <dl class="stats"><div class="stat-major"><dt>${todayOnly ? "今日の学習時間" : "今週のがんばった時間"}</dt><dd>${F.formatTime(todayOnly ? stats.today.seconds : stats.week.seconds)}</dd></div>
    <div><dt>${todayOnly ? "今日" : "今週"}の完了ミッション</dt><dd>${todayOnly ? stats.today.count : stats.week.count}個</dd></div><div><dt>累計完了ミッション</dt><dd>${stats.all.count}個</dd></div><div><dt>累計学習時間</dt><dd>${F.formatTime(stats.all.seconds)}</dd></div></dl>
    ${todayOnly ? "" : `<details><summary>週ごとの学習時間</summary>${weeks.map(week=>`<div class="week-line"><span>${week}からの週</span><strong>${F.formatTime(F.totals(data.records.filter(r=>F.weekKey(r.completedAt) === week)).seconds)}</strong></div>`).join("") || "<p>まだ記録がありません。</p>"}</details>`}
    ${days.map(day=>`<section class="history-day"><h3>${day}（日本時間）</h3>${rows.filter(r=>F.dayKey(r.completedAt) === day).map(recordMarkup).join("")}</section>`).join("") || "<p>まだ完了記録がありません。小さな一歩も、ここに残ります。</p>"}`);
}
function customList() {
  show("custom", `${button("home","← トップへ","back")}${heading("マイミッション")}${button("new-custom","ミッションを追加","primary")}
    <div class="custom-list">${data.customMissions.map(m=>`<article class="record"><h3>${escapeHTML(m.name)}</h3><p class="help">${m.type === "work" ? "作業" : "着手"} · ${escapeHTML(m.category)} · おまかせ${m.automatic ? "ON" : "OFF"}</p><div class="actions">${button("select","これをやる","",`data-id="${m.id}"`)}${button("edit-custom","編集","",`data-id="${m.id}"`)}${button("toggle-custom",m.automatic ? "おまかせから外す" : "おまかせに含める","",`data-id="${m.id}"`)}${button("delete-custom","削除","danger",`data-id="${m.id}"`)}</div></article>`).join("") || "<p class=\"help\">自分に合う小さな一歩を追加できます。</p>"}</div>`);
}
function customEditor(id = null) {
  const m = data.customMissions.find(m=>m.id === id) || {name:"",type:"start",category:"マイミッション",automatic:false,goal:"",report:""};
  show("custom-editor", `${button("custom","← マイミッションへ","back")}${heading(id ? "ミッションを編集" : "ミッションを追加")}
    <form data-form="custom" ${id ? `data-id="${id}"` : ""}>
    <label for="mission-name">ミッション名（必須）</label><input id="mission-name" name="name" maxlength="200" value="${escapeHTML(m.name)}" required>
    <label for="mission-type">種別</label><select id="mission-type" name="type"><option value="start" ${m.type === "start" ? "selected" : ""}>着手（短い行動・学習時間0分）</option><option value="work" ${m.type === "work" ? "selected" : ""}>作業（経過時間を計測）</option></select>
    <label for="mission-category">カテゴリ（任意）</label><input id="mission-category" name="category" maxlength="60" value="${escapeHTML(m.category)}">
    <label class="check-label"><input type="checkbox" name="automatic" ${m.automatic ? "checked" : ""}>おまかせにも登場させる</label>
    <label for="mission-goal">目標宣言文（任意）</label><textarea id="mission-goal" name="goal" maxlength="1000" placeholder="今日の目標：Pythonの問題を1問解く">${escapeHTML(m.goal)}</textarea>
    <label for="mission-report">達成報告文（任意）</label><textarea id="mission-report" name="report" maxlength="1000" placeholder="今日の達成：Pythonの問題を1問解く">${escapeHTML(m.report)}</textarea>
    <p class="help">空欄の文章は「今日の目標：ミッション名」「今日の達成：ミッション名」にします。</p><button type="submit" class="primary large">保存する</button></form>`);
}
function settings() {
  show("settings", `${button("home","← トップへ","back")}${heading("設定・バックアップ")}
    <label class="check-label"><input id="sound-setting" type="checkbox" ${data.settings.soundEnabled ? "checked" : ""}>お祝いの音を鳴らす</label>
    <label for="volume-setting">効果音の音量 <output id="volume-output">${Math.round(data.settings.volume*100)}%</output></label><input id="volume-setting" type="range" min="0" max="100" step="5" value="${Math.round(data.settings.volume*100)}">
    <label for="motion-setting">祝福の演出</label><select id="motion-setting"><option value="full" ${data.settings.motion === "full" ? "selected" : ""}>この子とお祝い</option><option value="light" ${data.settings.motion === "light" ? "selected" : ""}>軽め（動きを抑える）</option><option value="off" ${data.settings.motion === "off" ? "selected" : ""}>演出なし</option></select>
    <p class="help">OSで「動きを減らす」を設定している場合も、演出を軽くします。音量は端末側でも調整できます。</p>
    <h3>データのバックアップ</h3><p class="help">この端末・ブラウザに保存します。自動同期はありません。ブラウザのデータ削除に備えて、書き出しておくと安心です。</p>
    <div class="actions">${button("export","データを書き出す")}<label class="file-label" for="import">バックアップから復元する<input id="import" type="file" accept=".json,application/json"></label></div>
    <p class="help">復元は現在のデータを置き換えます。対応はバージョン1、最大5MBです。</p>${button("reset","全データを削除する","danger")}`);
}
async function copyText() {
  const field = $("share-text");
  try { await navigator.clipboard.writeText(field.value); $("copy-message").textContent = "コピーしました。"; $("slack-link").hidden = false; }
  catch {
    field.focus(); field.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch { /* 手動コピーを案内する。 */ }
    $("copy-message").textContent = copied ? "コピーしました。" : "文章を選択しました。端末のコピー操作でコピーしてください。";
    $("slack-link").hidden = false;
  }
}
function initAudio() {
  if (!data.settings.soundEnabled || data.settings.volume === 0) return;
  try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); if (audioContext.state === "suspended") audioContext.resume().catch(()=>{}); } catch { /* 音が使えなくても操作は続けられる。 */ }
}
function sound(celebrate = true) {
  if (!data.settings.soundEnabled || data.settings.volume === 0) return;
  try {
    initAudio(); if (!audioContext) return;
    const notes = celebrate ? [523.25,659.25,783.99,1046.5] : [659.25,783.99];
    notes.forEach((freq,i)=>{
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), start = audioContext.currentTime+i*.12;
      oscillator.type="sine"; oscillator.frequency.value=freq;
      gain.gain.setValueAtTime(0,start); gain.gain.linearRampToValueAtTime(.185*data.settings.volume,start+.025); gain.gain.exponentialRampToValueAtTime(.001,start+.45);
      oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(start); oscillator.stop(start+.5);
    });
  } catch { /* 音声再生失敗で記録を止めない。 */ }
}
function stopCelebration() {
  clearTimeout(celebrationTimeout);
  document.querySelector(".mascot")?.classList.remove("buddy-celebrate");
  if ($("celebration")) $("celebration").hidden = true;
}
function celebrate() {
  sound(); stopCelebration();
  if (data.settings.motion === "off") return;
  const light = data.settings.motion === "light" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("celebration").classList.toggle("motion-light",light);
  $("celebration").hidden = false;
  const mascot = document.querySelector(".mascot");
  mascot?.classList.toggle("buddy-still",light);
  mascot?.classList.add("buddy-celebrate");
  celebrationTimeout=setTimeout(stopCelebration,light ? 1800 : 3200);
}
function exitActive(change = false) {
  if (data.activeSession && !confirm("このミッションを未完了のまま終了しますか？完了記録は追加しません。")) return;
  const mission = data.activeSession?.mission;
  data.activeSession = null; restored = false; save();
  if(change) { selected=mission;choose(); } else summary();
}
$("screen").addEventListener("click", async event=>{
  const control=event.target.closest("[data-action]");if(!control)return;
  const action=control.dataset.action, id=control.dataset.id;
  initAudio();
  switch(action) {
    case "skip-celebration": stopCelebration();$("screen-heading")?.focus();break;
    case "home": stopCelebration(); home(); break;
    case "return": selected ? propose(selected) : home(); break;
    case "automatic": alternativeIds=[];propose(F.suggest(data));break;
    case "choose": stopCelebration();choose();break;
    case "select": alternativeIds=[];propose(F.allMissions(data).find(m=>m.id===id));break;
    case "alternative": alternativeIds=[...new Set([...alternativeIds,selected.id])];propose(F.suggest(data,data.route.lastId,alternativeIds));break;
    case "skip": data.route.done=[...new Set([...data.route.done,selected.id])];data.route.lastId=selected.id;save();propose(F.suggest(data));break;
    case "start": initAudio();startCountdown();break;
    case "cancel-countdown": data.activeSession=null;save();propose(selected);break;
    case "pause": if(data.activeSession.resumedAt===null)data.activeSession.resumedAt=Date.now();else F.pause(data.activeSession);save();control.textContent=data.activeSession.resumedAt===null ? "再開" : "一時停止";tick();break;
    case "set-timer": {
      const value=$("timer-choice").value, minutes=Number(value === "custom" ? $("timer-minutes").value : value);
      if(!Number.isInteger(minutes) || minutes<0 || minutes>1440 || (value === "custom" && minutes===0)){status("1〜1440分の整数を入力してください。");break;}
      data.activeSession.timerTarget=minutes ? F.elapsed(data.activeSession)+minutes*60 : null;timerAnnounced=false;save();tick();status("タイマーを設定しました。");break;
    }
    case "extend": data.activeSession.timerTarget=F.elapsed(data.activeSession)+300;timerAnnounced=false;save();tick();break;
    case "continue": data.activeSession.timerTarget=null;timerAnnounced=false;save();tick();break;
    case "resume-session": restored=false;if(data.activeSession.phase === "countdown"){data.activeSession.countdownEnd=Date.now()+5000;save();countdown();}else{if(data.activeSession.mission.type === "work")data.activeSession.resumedAt=Date.now();save();running();}break;
    case "complete": {
      if(data.records.length>=10000){status("記録は10,000件までです。バックアップを保存してから過去の記録を整理してください。");break;}
      const mission=data.activeSession?.mission, record=F.complete(data);
      if(!record)break; save();completed(record,mission);celebrate();break;
    }
    case "another": stopCelebration();alternativeIds=[];propose(F.suggest(data));break;
    case "finish": stopCelebration();summary();break;
    case "change": exitActive(true);break;
    case "quit": exitActive();break;
    case "copy": await copyText();break;
    case "today": records(true);break;
    case "history": records();break;
    case "custom": customList();break;
    case "new-custom": if(data.customMissions.length>=100){status("マイミッションは100件までです。");break;}customEditor();break;
    case "edit-custom": customEditor(id);break;
    case "toggle-custom": {const m=data.customMissions.find(m=>m.id===id);m.automatic=!m.automatic;save();customList();break;}
    case "delete-custom": if(confirm("このマイミッションを削除しますか？過去の完了記録は残ります。")){data.customMissions=data.customMissions.filter(m=>m.id!==id);data.route.done=data.route.done.filter(done=>done!==id);if(data.route.lastId===id)data.route.lastId=null;save();customList();}break;
    case "delete-record": if(confirm("この完了記録を削除しますか？")){data.records=data.records.filter(r=>r.id!==id);save();records(screen === "today");}break;
    case "settings": settings();break;
    case "export": {
      let payload=JSON.stringify(data,null,2);
      if(blocked){try{payload=localStorage.getItem(F.KEY)||payload;}catch{status("元の保存データにアクセスできません。");break;}}
      const blob=new Blob([payload],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`yurumana-first-step-${F.dayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status("バックアップを書き出しました。");break;
    }
    case "reset": if(confirm("はじめの一歩の記録・マイミッション・設定をすべて削除しますか？必要なら先にバックアップを書き出してください。")){data=F.defaults();blocked=false;selected=null;lastRecord=null;save();updateSound();settings();status("このツールのデータをリセットしました。");}break;
  }
});
$("screen").addEventListener("submit", event=>{
  event.preventDefault();const form=event.target;
  if(blocked){status("先にバックアップの復元またはリセットを行ってください。");return;}
  const values=new FormData(form);
  if(form.dataset.form === "custom") {
    const name=String(values.get("name")||"").trim();if(!name){status("ミッション名を入力してください。");return;}
    const type=values.get("type"), mission={id:form.dataset.id||F.id("custom"),name,type,category:String(values.get("category")||"").trim()||"マイミッション",automatic:values.get("automatic")==="on",goal:String(values.get("goal")||"").trim(),report:String(values.get("report")||"").trim(),next:null,countTime:type === "work"};
    const index=data.customMissions.findIndex(m=>m.id === mission.id);if(index>=0)data.customMissions[index]=mission;else data.customMissions.push(mission);save();customList();status("保存しました。");
  } else if(form.dataset.form === "time") {
    const minutes=Number(values.get("minutes")),record=data.records.find(r=>r.id === form.dataset.id);
    if(!record || !Number.isFinite(minutes) || minutes<0 || minutes>525600){status("0〜525600分の範囲で入力してください。");return;}
    record.studySeconds=Math.round(minutes*60);record.corrected=true;save();
    if(screen === "completed")completed(record,selected);else records(screen === "today");status("学習時間を修正しました。");
  }
});
$("screen").addEventListener("change",async event=>{
  const input=event.target;
  if(input.id === "timer-choice")$("custom-timer").hidden=input.value!=="custom";
  else if(input.id === "sound-setting"){data.settings.soundEnabled=input.checked;save();updateSound();}
  else if(input.id === "volume-setting"){data.settings.volume=Number(input.value)/100;save();$("volume-output").textContent=`${input.value}%`;}
  else if(input.id === "motion-setting"){data.settings.motion=input.value;save();}
  else if(input.id === "import") {
    const file=input.files[0];if(!file)return;
    try {
      if(file.size>5*1024*1024)throw new Error("ファイルは5MBまでです。");
      const imported=F.validate(JSON.parse(await file.text()));
      if(!confirm("現在のデータをバックアップの内容に置き換えますか？記録を追加で重ねることはしません。"))return;
      data=imported;blocked=false;restored=false;selected=null;save();updateSound();
      if(data.activeSession)restoredScreen();else settings();status("バックアップを復元しました。");
    }catch(error){status(`復元できませんでした。元のデータはそのままです。${error instanceof SyntaxError ? "JSONファイルを確認してください。" : error.message}`);}
    finally{input.value="";}
  }
});
$("sound-toggle").addEventListener("click",()=>{data.settings.soundEnabled=!data.settings.soundEnabled;save();updateSound();if($("sound-setting"))$("sound-setting").checked=data.settings.soundEnabled;});
document.addEventListener("visibilitychange",()=>{if(!document.hidden)tick();});
window.addEventListener("pagehide",save);
updateSound();interval=setInterval(tick,200);
if(data.activeSession)restoredScreen();else home(false);
