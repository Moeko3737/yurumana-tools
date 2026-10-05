"use strict";
const $ = id => document.getElementById(id);
const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const calc = StudyCalculator;
let announceTimer;
function configureSlider(input) {
  Object.assign(input, APP_CONFIG.slider);
  input.setAttribute("aria-valuetext", "お休み");
}
function buildWeekdays() {
  DISPLAY_ORDER.forEach(day => {
    const row = document.createElement("div");
    row.className = "weekday";
    row.innerHTML = `<div class="slider-label"><label for="day-${day}">${DAYS[day]}曜日</label><output for="day-${day}" id="output-${day}">お休み</output></div><input type="range" id="day-${day}" value="0">`;
    $("weekday-inputs").append(row);
    configureSlider($(`day-${day}`));
    const chart = document.createElement("div");
    chart.className = "chart-row";
    chart.innerHTML = `<span>${DAYS[day]}</span><div class="track" aria-hidden="true"><div class="bar" id="bar-${day}"></div></div><span class="chart-time" id="chart-time-${day}">お休み</span>`;
    $("weekday-chart").append(chart);
  });
}
function render() {
  const weekdays = DAYS.map((_, day) => Number($(`day-${day}`).value));
  const weekly = weekdays.reduce((sum, minutes) => sum + minutes, 0);
  const rule = document.querySelector('input[name="holiday-rule"]:checked').value;
  const holidayMinutes = Number($("holiday-minutes").value);
  $("holiday-custom").hidden = rule !== "custom";
  DAYS.forEach((_, day) => {
    const text = calc.formatMinutes(weekdays[day], true);
    $(`output-${day}`).textContent = text;
    $(`day-${day}`).setAttribute("aria-valuetext", text);
    $(`chart-time-${day}`).textContent = text;
    $(`bar-${day}`).style.width = `${weekdays[day] / APP_CONFIG.slider.max * 100}%`;
  });
  const holidayText = calc.formatMinutes(holidayMinutes, true);
  $("holiday-output").textContent = holidayText;
  $("holiday-minutes").setAttribute("aria-valuetext", holidayText);
  $("weekly-total").textContent = calc.formatMinutes(weekly);
  const term = APP_CONFIG.terms[$("term").value];
  const startValue = $("start-date").value;
  const result = term.startDate && calc.parseDate(startValue) && startValue < term.startDate
    ? { error: `${term.label}の開始日は、授業開始日の${calc.formatDate(term.startDate)}以降を選んでください。` }
    : calc.calculateStudyTime(startValue, term.finalDeadline, weekdays, rule, holidayMinutes, JAPAN_HOLIDAYS);
  $("result-error").hidden = !result.error;
  $("valid-results").hidden = Boolean(result.error);
  if (result.error) {
    $("result-error").textContent = result.error;
    clearTimeout(announceTimer);
    $("live-summary").textContent = "";
    return;
  }
  $("period").textContent = `${calc.formatDate($("start-date").value)} 〜 ${calc.formatDate(APP_CONFIG.terms[$("term").value].finalDeadline)}`;
  $("total-time").textContent = calc.formatMinutes(result.totalMinutes);
  $("result-weekly").textContent = calc.formatMinutes(weekly);
  $("study-days").textContent = `${result.studyDays}日`;
  $("calendar-days").textContent = `${result.calendarDays}日`;
  $("average-weekly").textContent = calc.formatMinutes(result.averageWeeklyMinutes);
  $("course-results").replaceChildren();
  const courses = calc.calculateCourses(result.totalMinutes, APP_CONFIG);
  courses.forEach(model => {
    const row = document.createElement("div"); row.className = "course-row";
    row.innerHTML = `<h3><span aria-hidden="true">${model.emoji}</span> ${model.label}</h3><div class="course-count">${model.count}科目程度</div><div class="course-detail">（2単位科目なら${model.count * 2}単位相当）<br>1レポートあたり${model.minutes}分想定 · 1科目${calc.formatMinutes(model.minutes * APP_CONFIG.sessionsPerCourse)}</div>`;
    $("course-results").append(row);
  });
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    $("live-summary").textContent = `締切まで${calc.formatMinutes(result.totalMinutes)}、学習可能日${result.studyDays}日。${courses.map(model => `${model.label}${model.count}科目程度`).join("、")}。`;
  }, 350);
}
buildWeekdays();
configureSlider($("holiday-minutes"));
Object.entries(APP_CONFIG.terms).forEach(([key, term]) => {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = term.label;
  $("term").append(option);
});
$("term").value = APP_CONFIG.defaultTerm;
function selectTerm() {
  const term = APP_CONFIG.terms[$("term").value];
  const deadline = calc.parseDate(term.finalDeadline);
  $("deadline").textContent = deadline ? `最終締切：${deadline.getUTCMonth() + 1}月${deadline.getUTCDate()}日（${deadline.getUTCFullYear()}年）` : "最終締切の設定を確認してください";
  $("start-date").min = term.startDate || "";
  $("start-date").value = term.startDate || calc.todayKey();
  $("today").disabled = Boolean(term.startDate && calc.todayKey() < term.startDate);
  $("today-help").hidden = !$("today").disabled;
  render();
}
$("term").addEventListener("input", selectTerm);
$("term").addEventListener("change", selectTerm);
$("session-count").textContent = APP_CONFIG.sessionsPerCourse;
$("today").addEventListener("click", () => {
  const today = calc.todayKey();
  const minimum = APP_CONFIG.terms[$("term").value].startDate;
  if (minimum && today < minimum) return;
  $("start-date").value = today;
  render();
});
$("settings").addEventListener("submit", event => event.preventDefault());
$("settings").addEventListener("input", render);
$("settings").addEventListener("change", render);
selectTerm();
