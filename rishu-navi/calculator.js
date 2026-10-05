"use strict";
// 日付の計算はUTC午前0時で統一。今日の取得だけ端末のローカル日付を使用。
const StudyCalculator = (() => {
  const DAY_MS = 86400000;
  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(0, 0, 0, 0);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
  }
  function dateKey(date) { return date.toISOString().slice(0, 10); }
  function todayKey() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function formatMinutes(minutes, rest = false) {
    const value = Math.max(0, Math.round(Number(minutes) || 0));
    if (!value) return rest ? "お休み" : "0分";
    const hours = Math.floor(value / 60), remainder = value % 60;
    return (hours ? `${hours}時間` : "") + (remainder ? `${remainder}分` : "");
  }
  function formatDate(value) {
    const date = parseDate(value);
    return date ? `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日` : "";
  }
  function isHoliday(date, holidays) { return Boolean(holidays[date.getUTCFullYear()]?.[dateKey(date)]); }
  function calculateStudyTime(startValue, deadlineValue, weekdays, rule, holidayMinutes, holidays) {
    const start = parseDate(startValue), deadline = parseDate(deadlineValue);
    if (!start) return { error: "開始日を入力してください。有効な日付を選ぶと再計算します。" };
    if (!deadline) return { error: "最終締切の設定が正しくありません。管理者に確認してください。" };
    if (start > deadline) return { error: "開始日が最終締切を過ぎています。締切当日か、それより前の日を選んでください。" };
    // データがない年を平日扱いにせず、誤った結果を防ぐ。
    for (let year = start.getUTCFullYear(); year <= deadline.getUTCFullYear(); year++) {
      if (!holidays[year]) return { error: `${year}年の祝日データがありません。対応年の開始日を選んでください（${Math.min(...Object.keys(holidays))}〜${Math.max(...Object.keys(holidays))}年）。` };
    }
    let totalMinutes = 0, studyDays = 0;
    const calendarDays = Math.round((deadline - start) / DAY_MS) + 1;
    for (let time = start.getTime(); time <= deadline.getTime(); time += DAY_MS) {
      const date = new Date(time);
      let minutes = weekdays[date.getUTCDay()];
      if (isHoliday(date, holidays)) {
        if (rule === "off") minutes = 0;
        if (rule === "custom") minutes = holidayMinutes;
      }
      totalMinutes += minutes;
      if (minutes > 0) studyDays++;
    }
    return { totalMinutes, studyDays, calendarDays, averageWeeklyMinutes: totalMinutes / calendarDays * 7 };
  }
  function calculateCourses(totalMinutes, config) {
    return config.courseModels.map(model => ({ ...model, count: Math.floor(totalMinutes / (model.minutes * config.sessionsPerCourse)) }));
  }
  return { parseDate, dateKey, todayKey, formatMinutes, formatDate, isHoliday, calculateStudyTime, calculateCourses };
})();
if (typeof module !== "undefined") module.exports = StudyCalculator;
