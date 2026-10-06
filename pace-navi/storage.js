"use strict";
const PaceStorage = (() => {
  const KEY = "yurumana-pace-navi-v1";
  const VERSION = 1;
  const dates = typeof StudyCalculator !== "undefined" ? StudyCalculator : require("../rishu-navi/calculator.js");
  function defaults() {
    return { schemaVersion: VERSION, courses: [], settings: { startDate: dates.todayKey(), weekdays: Array(7).fill(0), holidayRule: "normal", holidayMinutes: 0, mode: "next" } };
  }
  function validate(data, config) {
    const fail = () => { throw new Error("対応するバックアップ形式ではありません。元のデータは変更していません。"); };
    if (!data || data.schemaVersion !== VERSION || !Array.isArray(data.courses) || data.courses.length > 500 || !data.settings) fail();
    const settings = data.settings;
    const validMinutes = value => Number.isInteger(value) && value >= config.slider.min && value <= config.slider.max && value % config.slider.step === 0;
    if (!dates.parseDate(settings.startDate) || !Array.isArray(settings.weekdays) || settings.weekdays.length !== 7 || !settings.weekdays.every(validMinutes) || !validMinutes(settings.holidayMinutes) || !["normal", "off", "custom"].includes(settings.holidayRule) || !["next", "final"].includes(settings.mode)) fail();
    const ids = new Set();
    const courses = data.courses.map(course => {
      if (!course || typeof course.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(course.id) || ids.has(course.id) || !Object.hasOwn(config.sections, course.type)) fail();
      ids.add(course.id);
      const section = config.sections[course.type];
      if (typeof course.name !== "string" || course.name.length > 200 || !/^#[0-9a-f]{6}$/i.test(course.color) || !Array.isArray(course.sessions) || course.sessions.length !== section.totalSessions) fail();
      if (course.type !== "seminar" && course.minutes !== null && (!Number.isSafeInteger(course.minutes) || course.minutes <= 0 || course.minutes > 1000000)) fail();
      if (typeof course.customTime !== "boolean") fail();
      if (course.type === "seminar" && (!Number.isInteger(course.weekday) || course.weekday < 0 || course.weekday > 6)) fail();
      if (!Array.isArray(course.cancellations) || course.cancellations.length > 1000 || !course.cancellations.every(date => Boolean(dates.parseDate(date)))) fail();
      const sessions = course.sessions.map(session => {
        if (!session || typeof session.complete !== "boolean" || typeof session.report !== "boolean" || !Array.isArray(session.videos) || session.videos.length !== section.videos || !session.videos.every(value => typeof value === "boolean")) fail();
        if (course.type !== "seminar" && (session.complete !== session.report || (session.report && !session.videos.every(Boolean)))) fail();
        return { complete: session.complete, report: session.report, videos: [...session.videos] };
      });
      return { id: course.id, type: course.type, name: course.name, color: course.color, minutes: course.type === "seminar" ? null : course.minutes, customTime: course.customTime, weekday: course.weekday ?? 3, cancellations: [...new Set(course.cancellations)], sessions };
    });
    return { schemaVersion: VERSION, courses, settings: { startDate: settings.startDate, weekdays: [...settings.weekdays], holidayRule: settings.holidayRule, holidayMinutes: settings.holidayMinutes, mode: settings.mode } };
  }
  function load(config) {
    try {
      const raw = localStorage.getItem(KEY);
      return { state: raw ? validate(JSON.parse(raw), config) : defaults() };
    } catch { return { state: defaults(), error: "保存データを読み込めませんでした。元の保存データは残しています。バックアップから復元するか、全データをリセットしてください。", blocked: true }; }
  }
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return null; }
    catch { return "このブラウザでは保存できません。画面上の変更は使えますが、離れる前にバックアップを書き出してください。"; }
  }
  function createCourse(type, config, id) {
    const section = config.sections[type];
    return { id, type, name: "", color: "#789780", minutes: type === "seminar" ? null : 120, customTime: false, weekday: 3, cancellations: [], sessions: Array.from({ length: section.totalSessions }, () => ({ complete: false, report: false, videos: Array(section.videos).fill(false) })) };
  }
  return { KEY, VERSION, defaults, validate, load, save, createCourse };
})();
if (typeof module !== "undefined") module.exports = PaceStorage;
