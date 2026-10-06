"use strict";
const $ = id => document.getElementById(id);
const config = ACADEMIC_CONFIG;
const engine = PaceEngine;
const dates = StudyCalculator;
const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const loaded = PaceStorage.load(config);
let state = loaded.state;
let saveBlocked = Boolean(loaded.blocked);
let announceTimer;
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function storageMessage(message) {
  $("storage-message").hidden = !message;
  $("storage-message").textContent = message || "";
}
function saveAndRender() {
  if (!saveBlocked && dates.parseDate(state.settings.startDate)) storageMessage(PaceStorage.save(state));
  updateCourseSummaries();
  renderResults();
  updateWorkspaceSummary();
}
function getCourse(element) { return state.courses.find(course => course.id === element.closest(".course")?.dataset.id); }
function buildSections() {
  $("course-sections").replaceChildren();
  Object.entries(config.sections).forEach(([type, section]) => {
    const details = node("details", undefined, "course-section");
    details.id = `section-${type}`;
    details.open = false;
    const summary = node("summary");
    summary.append(node("span", section.label), node("span", "", "section-count"));
    const list = node("div"); list.id = `courses-${type}`;
    const add = node("button", "＋ 科目を追加", "add-course"); add.type = "button"; add.dataset.add = type;
    details.append(summary, list, add); $("course-sections").append(details);
    state.courses.filter(course => course.type === type).forEach(course => list.append(buildCourse(course)));
  });
  updateCourseSummaries();
}
function buildCourse(course) {
  const section = config.sections[course.type];
  const prefix = course.id;
  const card = node("article", undefined, "course"); card.dataset.id = prefix;
  card.style.setProperty("--course-color", course.color);
  const timeMarkup = course.type === "seminar" ? `
    <div class="field wide"><label for="${prefix}-weekday">毎週の曜日</label><select id="${prefix}-weekday" data-field="weekday">${[1,2,3,4,5,6,0].map(day => `<option value="${day}" ${day === course.weekday ? "selected" : ""}>${DAYS[day]}曜日</option>`).join("")}</select></div>` : `
    <div class="wide time-fields"><div class="field"><label for="${prefix}-time">1回あたりの想定学習時間</label><select id="${prefix}-time" data-field="time-choice">${[100,120,150].map(minutes => `<option value="${minutes}" ${!course.customTime && course.minutes === minutes ? "selected" : ""}>${minutes}分</option>`).join("")}<option value="custom" ${course.customTime ? "selected" : ""}>その他</option></select></div><div class="field" data-custom-time ${course.customTime ? "" : "hidden"}><label for="${prefix}-custom">その他の時間（分）</label><input type="number" id="${prefix}-custom" min="1" max="1000000" step="1" inputmode="numeric" data-field="custom-minutes" value="${course.customTime && course.minutes !== null ? course.minutes : ""}" aria-describedby="${prefix}-time-error"><p class="help" id="${prefix}-time-error" data-time-error hidden>正の整数を入力してください。</p></div></div>`;
  card.innerHTML = `<div class="course-top"><h3 data-title></h3><span class="tag">${section.tag}</span></div>
    <div class="fields"><div class="field"><label for="${prefix}-name">科目名</label><input id="${prefix}-name" data-field="name" maxlength="200" value="${escapeHTML(course.name)}" placeholder="例：Webアプリケーション開発3"></div><div class="field"><label for="${prefix}-color">カラー</label><input type="color" id="${prefix}-color" data-field="color" value="${course.color}"></div>${timeMarkup}</div>
    <p class="course-progress" data-progress></p><div class="progress-track" aria-hidden="true"><div class="progress-fill"></div></div>
    <div class="sessions" role="group" aria-label="各回の完了状態">${course.sessions.map((session, i) => `<button type="button" class="session-button ${section.videos === 6 && section.milestones.some(milestone => milestone.target === i+1) ? "break-after" : ""}" data-session="${i}" aria-pressed="${session.complete}" aria-label="第${i+1}回 ${session.complete ? "完了" : "未完了"}">${i+1}回</button>`).join("")}</div>
    <p class="help progress-only">${section.videos === 6 ? `${section.milestones.map(milestone => milestone.target+"回").join("・")}が締切の区切りです。` : ""}数字を押すと、その回の完了・未完了を切り替えます。</p>
    ${course.type === "seminar" ? seminarExceptions(course, prefix) : ""}
    <p data-course-message class="course-message"></p>
    <button type="button" class="remove-course settings-only" data-delete>この科目を削除</button>`;
  // 設定には編集用の見出し、本画面には科目ごとの開閉欄を表示する。
  const top = card.querySelector(".course-top");
  const settingsTop = top.cloneNode(true);
  settingsTop.classList.add("settings-only");
  card.prepend(settingsTop);
  const disclosure = node("details", undefined, "course-disclosure progress-only");
  const summary = node("summary");
  summary.append(top, card.querySelector("[data-progress]"), card.querySelector(".progress-track"), node("span", "開いてチェック", "course-open-hint"));
  disclosure.append(summary);
  Array.from(card.children).filter(child => child.classList.contains("sessions") || child.classList.contains("progress-only") || child.hasAttribute("data-course-message")).forEach(child => disclosure.append(child));
  card.append(disclosure);
  return card;
}
function seminarExceptions(course, prefix) {
  return `<details class="settings-only"><summary>休講日を設定（任意）</summary><div class="field"><label for="${prefix}-cancel">休講日</label><div class="date-row"><input type="date" id="${prefix}-cancel"><button type="button" data-add-cancel>休講日を追加</button></div><p class="help" data-cancel-message role="status"></p><ul class="cancellations"></ul></div></details>`;
}
function updateCourseSummaries() {
  Object.keys(config.sections).forEach(type => {
    $(`section-${type}`).querySelector(".section-count").textContent = ` · ${state.courses.filter(course => course.type === type).length}科目`;
  });
  state.courses.forEach(course => {
    const card = document.querySelector(`.course[data-id="${course.id}"]`);
    if (!card) return;
    const section = config.sections[course.type];
    const status = engine.courseStatus(course, state.settings.startDate, config);
    card.classList.toggle("finished", status.finished);
    card.style.setProperty("--course-color", course.color);
    card.querySelectorAll("[data-title]").forEach(title => { title.textContent = course.name || "科目名を入力してください"; });
    card.querySelector("[data-progress]").textContent = `${status.complete} / ${section.totalSessions}${status.finished ? "　✓ 完了" : ""}`;
    card.querySelector(".progress-fill").style.width = `${status.complete / section.totalSessions * 100}%`;
    card.querySelectorAll("[data-session]").forEach(button => {
      const index = Number(button.dataset.session), complete = course.sessions[index].complete;
      button.setAttribute("aria-pressed", String(complete)); button.setAttribute("aria-label", `第${index+1}回 ${complete ? "完了" : "未完了"}`);
    });
    const message = card.querySelector("[data-course-message]");
    message.classList.toggle("alert", status.expired || status.missed.length > 0);
    if (status.finished) message.textContent = "完了した科目の記録は、そのまま残しています。";
    else if (course.type === "seminar") message.textContent = "演習は自主学習の本数・時間計算には含めません。";
    else if (status.expired) message.textContent = "最終締切を過ぎています。単位取得に必要な最終締切のため、未完了分は未来のペースに含めません。正式な取扱いは大学の案内をご確認ください。";
    else if (status.next) message.textContent = `${status.missed.length ? "途中締切は過ぎています。未完了分も含め、" : ""}${dates.formatDate(status.next.date)}までにあと${status.next.target-status.complete}回が目安です。${status.next.type === "soft" ? "途中締切を過ぎると成績に影響する場合があります。" : "最終締切です。"}`;
    else message.textContent = "";
    if (course.type === "seminar") {
      const ul = card.querySelector(".cancellations"); ul.replaceChildren();
      course.cancellations.forEach(date => {
        const li = node("li", dates.formatDate(date)); const button = node("button", "解除");button.type="button"; button.dataset.removeCancel=date;button.setAttribute("aria-label", `${dates.formatDate(date)}の休講を解除`);li.append(button);ul.append(li);
      });
    }
  });
}
function initializeSettings() {
  $("weekday-inputs").replaceChildren();
  [1,2,3,4,5,6,0].forEach(day => {
    const row = node("div", undefined, "weekday");
    row.innerHTML = `<div class="slider-label"><label for="day-${day}">${DAYS[day]}曜日</label><output id="output-${day}" for="day-${day}"></output></div><input id="day-${day}" type="range" min="${config.slider.min}" max="${config.slider.max}" step="${config.slider.step}" value="${state.settings.weekdays[day]}">`;
    $("weekday-inputs").append(row);
  });
  $("start-date").value = state.settings.startDate;
  $("holiday-minutes").value = state.settings.holidayMinutes;
  ["min", "max", "step"].forEach(key => $("holiday-minutes")[key] = config.slider[key]);
  document.querySelector(`input[name="holiday-rule"][value="${state.settings.holidayRule}"]`).checked = true;
  renderSettings();
}
function renderSettings() {
  // 2つの画面は同じ計算期間を共有する。
  document.querySelectorAll("[data-calculation-mode]").forEach(input => { input.checked = input.value === state.settings.mode; });
  DAYS.forEach((_,day) => {
    const text = dates.formatMinutes(state.settings.weekdays[day], true);
    $(`output-${day}`).textContent = text;
    $(`day-${day}`).setAttribute("aria-valuetext", text);
  });
  $("weekly-total").textContent = dates.formatMinutes(state.settings.weekdays.reduce((sum,value)=>sum+value,0));
  $("holiday-custom").hidden = state.settings.holidayRule !== "custom";
  const text = dates.formatMinutes(state.settings.holidayMinutes,true);
  $("holiday-output").textContent=text;$("holiday-minutes").setAttribute("aria-valuetext",text);
}
function expiredWarning(statuses, container) {
  if (!statuses?.length) return;
  const warning = node("div", undefined, "warning");warning.append(node("strong","最終締切を過ぎている未完了科目があります"));
  statuses.forEach(status=>warning.append(node("p",`${status.course.name || "名称未入力の科目"}：残り${status.remaining}回。${dates.formatDate(status.final.date)}の最終締切を過ぎています。`)));
  warning.append(node("p","最終締切を過ぎると単位取得ができないため、正式な取扱いを大学の案内で確認してください。未来のおすすめペースには含めません。"));container.append(warning);
}
function appendMetric(list, title, value, major = false) {
  const item=node("div",undefined,major ? "major" : "");item.append(node("dt",title),node("dd",value));list.append(item);
}
function renderResults() {
  const container = $("results");
  const pace = $("daily-pace");
  const expanded = pace.querySelector(".more-days")?.open || false;
  container.replaceChildren();
  pace.replaceChildren();
  const result = engine.calculate(state,config,JAPAN_HOLIDAYS);
  expiredWarning(result.expired,container);
  let announcement = "";
  if(result.error || result.empty) {
    container.append(node("p",result.error || result.empty,result.error ? "warning" : ""));
    announcement=result.error || result.empty;
    pace.append(node("p", result.error || result.empty, result.error ? "warning" : "help"));
    // 演習だけの登録でも、曜日と休講を確認できるよう直近7日を表示。
    if(result.empty && state.courses.some(course=>course.type === "seminar" && engine.countCompleted(course)<config.sections.seminar.totalSessions) && dates.parseDate(state.settings.startDate)) {
      pace.replaceChildren(node("p","演習の曜日メモ（開始日から7日間）","help"));
      const days=Array.from({length:7},(_,index)=>{
        const date=new Date(dates.parseDate(state.settings.startDate).getTime()+index*86400000),key=dates.dateKey(date),weekday=date.getUTCDay();
        return {date:key,weekday,minutes:0,count:0,seminars:state.courses.filter(course=>course.type === "seminar" && engine.countCompleted(course)<config.sections.seminar.totalSessions && course.weekday===weekday && !course.cancellations.includes(key)).map(course=>({name:course.name,color:course.color}))};
      });
      pace.append(buildDayList(days,true));
    }
  } else {
    container.append(node("p",`${state.settings.mode === "next" ? "次の締切" : "最終締切の範囲"}：${dates.formatDate(result.end)}まで（開始日から${result.calendarDays}日間）`));
    const metrics=node("dl",undefined,"summary-grid");
    appendMetric(metrics,"残り",`${result.totalCount}本`,true);
    appendMetric(metrics,"必要な学習時間",`約${dates.formatMinutes(result.neededMinutes)}`);
    appendMetric(metrics,"確保できる学習時間",dates.formatMinutes(result.availableMinutes));
    appendMetric(metrics,"1本あたりの目安",`約${Math.round(result.average)}分`);
    appendMetric(metrics,"配置できた本数",`${result.placed}本`);container.append(metrics);
    container.append(node("p","科目ごとの想定学習時間を、残り回数で加重平均しています。", "help"));
    if(result.unplaced) {
      const hard = result.groups.some(group=>group.type === "hard" && group.unplaced>0);
      container.append(node("p",hard ? "⚠️ 最終締切までの学習時間が不足しています" : "📝 次の締切までの配分を見直すと安心です", "status-message"));
      const warning=node("div",undefined,"warning");
      warning.append(node("p",`必要な${result.totalCount}本のうち、${result.placed}本分まで配置できました。あと${result.unplaced}本、約${dates.formatMinutes(result.missingMinutes)}に相当する作業が未配置です。`));
      warning.append(node("p",`総時間の不足：${dates.formatMinutes(Math.max(0,result.neededMinutes-result.availableMinutes))}。総時間が足りていても、1本分の時間を確保できる日が少ない場合や、早い締切までの時間が足りない場合は配置できません。`));
      warning.append(node("p",hard ? "最終締切を過ぎると単位取得ができないため、学習時間の見直しをおすすめします。" : "途中締切を過ぎても未完了分は次の目標に含めますが、成績に影響する場合があります。"));container.append(warning);
    } else container.append(node("p",result.availableMinutes >= result.neededMinutes*1.25 ? "🌱 余裕をもって進められそうです。あくまで目安です。" : "☕️ 今の学習時間で進められそうです。あくまで目安です。","status-message"));
    if(result.availableMinutes===0)container.append(node("p","対象期間の学習可能時間が設定されていません。曜日や祝日の時間を見直してください。","warning"));
    if(state.settings.mode==="final")container.append(node("p","早い最終締切の作業から時間を確保しています。3Qの作業を4Qの締切へ先送りせず、4Qは授業開始日以降に配分します。","help"));
    const deadlines=node("div",undefined,"deadline-list");
    result.groups.forEach(group=>deadlines.append(node("p",`${dates.formatDate(group.deadline)} ${group.type === "hard" ? "最終締切" : "途中締切"}：${group.count}本・約${dates.formatMinutes(group.minutes)}／配置${group.placed}本${group.unplaced ? `・不足${group.unplaced}本（約${dates.formatMinutes(group.missingMinutes)}）` : ""}${group.release>result.start ? `。${dates.formatDate(group.release)}から学習` : ""}`,"deadline-line")));
    container.append(deadlines);
    pace.append(node("p", `${dates.formatDate(result.start)} 〜 ${dates.formatDate(result.end)}`, "help"));
    if (result.unplaced) pace.append(node("p", `未配置の作業が${result.unplaced}本あります。「締切の見通し」で不足量を確認できます。`, "warning"));
    pace.append(buildDayList(result.days.slice(0,7)));
    if(result.days.length>7){const more=node("details",undefined,"more-days");more.open=expanded;more.append(node("summary",`続きを見る・閉じる（残り${result.days.length-7}日）`),buildDayList(result.days.slice(7)));pace.append(more);}
    pace.append(node("p","どの科目を進めるか迷ったら、次の締切までの残り回数が多い科目や、進捗が遅れている科目から進めるのがおすすめです。","help"));
    announcement=`残り${result.totalCount}本、必要な学習時間約${dates.formatMinutes(result.neededMinutes)}、配置${result.placed}本${result.unplaced ? `、未配置${result.unplaced}本` : ""}。`;
  }
  clearTimeout(announceTimer);announceTimer=setTimeout(()=>$("result-live").textContent=announcement,400);
}
function buildDayList(days, seminarOnly=false) {
  const list=node("ul",undefined,"daily-list");
  days.forEach(day=>{
    const date=dates.parseDate(day.date),row=node("li",undefined,"daily-row");const time=node("time",`${date.getUTCMonth()+1}/${date.getUTCDate()}（${DAYS[day.weekday]}）`);time.dateTime=day.date;
    const value=node("div",seminarOnly ? "" : day.count ? `${day.count}本` : day.minutes===0 ? (day.seminars.length ? "自主学習はお休み" : "お休み") : "0本（配分なし）","daily-count");
    if(!seminarOnly)value.append(node("span",`学習可能：${dates.formatMinutes(day.minutes)}`,"daily-time"));
    day.seminars.forEach(seminar=>{const line=node("span",undefined,"seminar-note");line.style.setProperty("--seminar-color",seminar.color);line.append(node("span",undefined,"seminar-dot"),node("span",`＋ 演習「${seminar.name || "名称未入力"}」`));value.append(line);});
    if(seminarOnly && !day.seminars.length)value.textContent="演習なし";
    row.append(time,value);list.append(row);
  });return list;
}
// 科目入力。名前・時間の入力中にフォーム全体を作り直さず、フォーカスを保つ。
$("course-sections").addEventListener("input",event=>{
  const input=event.target,course=getCourse(input);if(!course)return;
  const field=input.dataset.field;
  if(field==="name")course.name=input.value;
  else if(field==="color")course.color=input.value;
  else if(field==="weekday")course.weekday=Number(input.value);
  else if(field==="time-choice"){
    course.customTime=input.value==="custom";
    course.minutes=course.customTime ? null : Number(input.value);
    const card=input.closest(".course");card.querySelector("[data-custom-time]").hidden=!course.customTime;card.querySelector('[data-field="custom-minutes"]').value="";
  } else if(field==="custom-minutes"){
    const number=Number(input.value);course.minutes=input.value!=="" && Number.isSafeInteger(number) && number>0 && number<=1000000 ? number : null;
    input.setAttribute("aria-invalid",String(course.minutes===null));input.closest(".field").querySelector("[data-time-error]").hidden=course.minutes!==null;
  } else return;
  saveAndRender();
});
$("course-sections").addEventListener("click",event=>{
  const button=event.target.closest("button");if(!button)return;
  if(button.dataset.add){
    if(state.courses.length>=500){$("backup-message").textContent="登録できる科目は500件までです。";return;}
    const course=PaceStorage.createCourse(button.dataset.add,config,`course-${crypto.randomUUID()}`);state.courses.push(course);$(`courses-${course.type}`).append(buildCourse(course));saveAndRender();document.getElementById(`${course.id}-name`).focus();return;
  }
  const course=getCourse(button);if(!course)return;const card=button.closest(".course");
  if(button.dataset.session!==undefined){const session=course.sessions[Number(button.dataset.session)];engine.setSessionComplete(session,!session.complete);}
  else if(button.hasAttribute("data-delete")){
    if(!confirm(`「${course.name || "名称未入力の科目"}」を削除しますか？進捗も削除されます。`))return;
    state.courses=state.courses.filter(item=>item.id!==course.id);card.remove();$(`section-${course.type}`).querySelector("[data-add]").focus();
  } else if(button.hasAttribute("data-add-cancel")){
    const input=document.getElementById(`${course.id}-cancel`),message=card.querySelector("[data-cancel-message]");
    if(!dates.parseDate(input.value)){message.textContent="有効な休講日を選んでください。";return;}
    if(!course.cancellations.includes(input.value)){if(course.cancellations.length>=1000){message.textContent="休講日の登録は1科目1,000件までです。";return;}course.cancellations.push(input.value);}course.cancellations.sort();message.textContent="休講日を追加しました。";
  } else if(button.dataset.removeCancel){course.cancellations=course.cancellations.filter(date=>date!==button.dataset.removeCancel);}
  else return;
  saveAndRender();
});
document.addEventListener("input",event=>{
  const input=event.target;
  if(input.id==="start-date")state.settings.startDate=input.value;
  else if(/^day-[0-6]$/.test(input.id))state.settings.weekdays[Number(input.id.slice(-1))]=Number(input.value);
  else if(input.name==="holiday-rule")state.settings.holidayRule=input.value;
  else if(input.id==="holiday-minutes")state.settings.holidayMinutes=Number(input.value);
  else if(input.hasAttribute("data-calculation-mode"))state.settings.mode=input.value;
  else return;
  renderSettings();saveAndRender();
});
$("today").addEventListener("click",()=>{state.settings.startDate=dates.todayKey();$("start-date").value=state.settings.startDate;saveAndRender();});
$("export").addEventListener("click",()=>{
  if(!dates.parseDate(state.settings.startDate)){$("backup-message").textContent="バックアップ前に有効な計算開始日を選んでください。";return;}
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),link=node("a");link.href=url;link.download=`yurumana-pace-${dates.todayKey()}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);$("backup-message").textContent="バックアップを書き出しました。ファイルを保存してください。";
});
$("import").addEventListener("change",async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>5*1024*1024)throw new Error("バックアップは5MB以下のJSONファイルを選んでください。");
    const imported=PaceStorage.validate(JSON.parse(await file.text()),config);
    if(!confirm("現在の全データを、このバックアップの内容で置き換えます。よろしいですか？"))return;
    state=imported;saveBlocked=false;buildSections();initializeSettings();saveAndRender();markSetupComplete();setupMode=false;updateDialogControls();$("backup-message").textContent="バックアップから復元しました。設定を閉じると進捗とおすすめペースを確認できます。";
  }catch(error){$("backup-message").textContent=error instanceof SyntaxError ? "JSONを読み込めませんでした。元のデータは変更していません。" : error.message;}
  finally{event.target.value="";}
});
$("reset").addEventListener("click",()=>{
  if(!confirm("登録科目・進捗・学習時間など、ペースナビの全データを削除します。必要なら先にバックアップしてください。リセットしますか？"))return;
  state=PaceStorage.defaults();saveBlocked=false;buildSections();initializeSettings();saveAndRender();try{localStorage.removeItem(SETUP_KEY);}catch{} setupMode=true;showSettingsPanel("courses");$("backup-message").textContent="ペースナビのデータをリセットしました。";
});
$("q4-start-help").textContent = config.q4Start ? `4Qの作業は${dates.formatDate(config.q4Start)}以降に配分します。` : "4Qの作業は3Q最終締切より後に配分します。正式な授業開始日は大学の案内で確認してください。";
buildSections();initializeSettings();storageMessage(loaded.error);renderResults();


// 初回案内の完了状態は既存の学習データとは別に保存する。
const SETUP_KEY = "yurumana-pace-setup-v1";
let setupMode = false;
let currentPanel = "courses";
function markSetupComplete() {
  try { localStorage.setItem(SETUP_KEY, "complete"); } catch { /* 学習データのバックアップは引き続き使える。 */ }
}
function updateWorkspaceSummary() {
  $("progress-empty").hidden = state.courses.length > 0;
  const completed = state.courses.reduce((sum, course) => sum + engine.countCompleted(course), 0);
  const total = state.courses.reduce((sum, course) => sum + config.sections[course.type].totalSessions, 0);
  $("progress-overview").textContent = state.courses.length ? `${state.courses.length}科目 · ${completed} / ${total}回 完了` : "まずは科目を登録しましょう";
  $("current-settings").textContent = `計算開始：${dates.formatDate(state.settings.startDate) || "未設定"} · 通常週：${dates.formatMinutes(state.settings.weekdays.reduce((sum, minutes) => sum + minutes, 0))}`;
}
function updateDialogControls() {
  $("setup-step").hidden = !setupMode;
  $("setup-description").hidden = !setupMode;
  $("settings-navigation").hidden = setupMode;
  $("restore-in-setup").hidden = !setupMode;
  $("setup-back").hidden = !setupMode || currentPanel !== "time";
  $("close-settings").textContent = setupMode ? "あとで設定" : "閉じる";
  $("close-settings").setAttribute("aria-label", setupMode ? "初回設定をあとで行う" : "設定を閉じる");
  $("settings-heading").textContent = setupMode ? (currentPanel === "time" ? "勉強できる時間を設定" : currentPanel === "data" ? "バックアップを復元" : "科目を登録") : "設定";
  $("setup-step").textContent = currentPanel === "time" ? "はじめの設定 · 2 / 2" : "はじめの設定 · 1 / 2";
  $("setup-description").textContent = currentPanel === "time" ? "普段の1日に、自主学習へ使えそうな時間を設定しましょう。0分のままでも始められます。" : "まずは履修している科目を登録しましょう。あとから設定で変更できます。";
  $("settings-done").textContent = setupMode ? (currentPanel === "courses" ? "次へ：学習時間を設定" : currentPanel === "time" ? "登録して始める" : "科目登録に戻る") : "設定を閉じる";
}
function showSettingsPanel(panel) {
  currentPanel = panel;
  ["courses", "time", "data"].forEach(key => $("settings-" + key).hidden = key !== panel);
  document.querySelectorAll("[data-panel]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.panel === panel)));
  $("settings-error").hidden = true;
  updateDialogControls();
  $("settings-dialog").scrollTop = 0;
}
function openSettings(panel = "courses", firstRun = false) {
  setupMode = firstRun;
  $("settings-course-host").append($("course-sections"));
  document.querySelectorAll(".course-section").forEach(section => {
    section.open = section.id === "section-onDemand3Q" || Boolean(section.querySelector(".course"));
  });
  showSettingsPanel(panel);
  $("settings-dialog").showModal();
}
function closeSettings() {
  if (setupMode) markSetupComplete();
  $("settings-dialog").close();
}
function validateSetupCourses() {
  const invalid = state.courses.find(course => !course.name.trim() || (course.type !== "seminar" && (!Number.isSafeInteger(course.minutes) || course.minutes <= 0)));
  if (!state.courses.length || invalid) {
    $("settings-error").textContent = !state.courses.length ? "科目を追加してください。今は登録しない場合は「あとで設定」で閉じられます。" : "科目名と、正の整数の想定学習時間を入力してください。";
    $("settings-error").hidden = false;
    if (invalid) {
      const card = document.querySelector(`.course[data-id="${invalid.id}"]`);
      card.closest(".course-section").open = true;
      card.querySelector(!invalid.name.trim() ? '[data-field="name"]' : '[data-field="custom-minutes"]').focus();
    }
    return false;
  }
  return true;
}
function prepareProgressView() {
  document.querySelectorAll("#progress-host .course-section").forEach(section => { section.open = true; });
}
function showWorkspaceView(view) {
  const panels = { progress: "progress-surface", pace: "pace-surface", outlook: "outlook-surface" };
  Object.entries(panels).forEach(([key, id]) => { $(id).hidden = key !== view; });
  document.querySelectorAll("[data-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.view === view)));
}
function initializeWorkspace() {
  prepareProgressView();
  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => showWorkspaceView(button.dataset.view)));
  updateWorkspaceSummary();
  $("open-settings").addEventListener("click", () => openSettings());
  $("register-courses").addEventListener("click", () => openSettings());
  $("close-settings").addEventListener("click", closeSettings);
  $("settings-dialog").addEventListener("cancel", () => { if (setupMode) markSetupComplete(); });
  $("settings-dialog").addEventListener("close", () => {
    document.querySelectorAll("#course-sections details").forEach(details => { details.open = false; });
    $("progress-host").append($("course-sections"));
    prepareProgressView();
    updateWorkspaceSummary();
    $("open-settings").focus();
  });
  $("settings-navigation").addEventListener("click", event => {
    const button = event.target.closest("[data-panel]");
    if (button) showSettingsPanel(button.dataset.panel);
  });
  $("restore-in-setup").addEventListener("click", () => showSettingsPanel("data"));
  $("setup-back").addEventListener("click", () => showSettingsPanel("courses"));
  $("settings-done").addEventListener("click", () => {
    if (!setupMode) { closeSettings(); return; }
    if (currentPanel === "data") { showSettingsPanel("courses"); return; }
    if (currentPanel === "courses") {
      if (validateSetupCourses()) showSettingsPanel("time");
      return;
    }
    if (!dates.parseDate(state.settings.startDate)) {
      $("settings-error").textContent = "有効な計算開始日を選んでください。";
      $("settings-error").hidden = false;
      $("start-date").focus();
      return;
    }
    markSetupComplete(); closeSettings();
  });
  let complete = false;
  try { complete = localStorage.getItem(SETUP_KEY) === "complete"; } catch { /* 初回案内は使える。 */ }
  // 既存ユーザーは登録データをそのまま使い、新しい初回案内を出さない。
  if (!complete && state.courses.length === 0 && !saveBlocked) openSettings("courses", true);
  else if (state.courses.length > 0) markSetupComplete();
}

initializeWorkspace();
