"use strict";
// DOM・保存から独立した進捗とペース計算。日付処理・祝日判定は履修ナビと共用。
const PaceEngine = (() => {
  const dates = typeof StudyCalculator !== "undefined" ? StudyCalculator : require("../rishu-navi/calculator.js");
  const DAY = 86400000;
  const countCompleted = course => course.sessions.filter(session => session.complete).length;
  function setSessionComplete(session, complete) {
    session.complete = complete;
    session.report = complete;
    session.videos.fill(complete);
  }
  function setReport(session, submitted) {
    session.report = submitted;
    if (submitted) session.videos.fill(true);
    session.complete = submitted && session.videos.every(Boolean);
  }
  function setVideo(session, index, watched) {
    session.videos[index] = watched;
    if (!watched) session.report = false;
    session.complete = session.report && session.videos.every(Boolean);
  }
  function setBulk(course, count) {
    course.sessions.forEach((session, index) => setSessionComplete(session, index < count));
  }
  function bulkWouldOverwrite(course, count) {
    return course.sessions.some((session, index) => {
      const expected = index < count;
      return session.complete !== expected || session.report !== expected || session.videos.some(value => value !== expected);
    }) && course.sessions.some(session => session.complete || session.report || session.videos.some(Boolean));
  }
  function releaseDate(course, config) {
    const section = config.sections[course.type];
    if (section.quarter === "q4") {
      if (config.q4Start) return config.q4Start;
      // 正式開始日が未設定なら、少なくとも3Q最終締切の翌日より前には入れない。
      const last = config.sections.onDemand3Q.milestones.at(-1).date;
      return dates.dateKey(new Date(dates.parseDate(last).getTime() + DAY));
    }
    return config.q3Start || "0001-01-01";
  }
  function courseStatus(course, start, config) {
    const section = config.sections[course.type];
    const complete = countCompleted(course);
    const finished = complete === section.totalSessions;
    const final = section.milestones.at(-1);
    const expired = !finished && Boolean(final && final.date < start);
    // 完了数は、飛び飛びでも単純に個数で数える。
    const next = section.milestones.find(m => m.date >= start && m.target > complete);
    const missed = section.milestones.filter(m => m.type === "soft" && m.date < start && m.target > complete);
    return { complete, finished, expired, next, missed, final, remaining: section.totalSessions - complete };
  }
  function dayMinutes(date, settings, holidays) {
    if (dates.isHoliday(date, holidays)) {
      if (settings.holidayRule === "off") return 0;
      if (settings.holidayRule === "custom") return settings.holidayMinutes;
    }
    return settings.weekdays[date.getUTCDay()];
  }
  function makeDays(start, end, settings, holidays) {
    const days = [];
    for (let time = dates.parseDate(start).getTime(); time <= dates.parseDate(end).getTime(); time += DAY) {
      const date = new Date(time);
      const minutes = dayMinutes(date, settings, holidays);
      days.push({ date: dates.dateKey(date), weekday: date.getUTCDay(), minutes, remainingMinutes: minutes, count: 0 });
    }
    return days;
  }
  // 比例配分＋最大剰余。平均所要時間を使い、各日の残容量を超えない。
  function distribute(days, needed, average, release, deadline) {
    const eligible = days.filter(day => day.date >= release && day.date <= deadline && day.remainingMinutes > 0);
    const capacities = eligible.map(day => Math.max(0, Math.floor((day.remainingMinutes + 1e-8) / average)));
    const capacityCount = capacities.reduce((a, b) => a + b, 0);
    const placeCount = Math.min(needed, capacityCount);
    const totalTime = eligible.reduce((sum, day) => sum + day.remainingMinutes, 0);
    const quotas = eligible.map(day => totalTime ? placeCount * day.remainingMinutes / totalTime : 0);
    const allocations = quotas.map((quota, i) => Math.min(capacities[i], Math.floor(quota)));
    let left = placeCount - allocations.reduce((a, b) => a + b, 0);
    const order = eligible.map((_, i) => i).sort((a, b) => (quotas[b] - Math.floor(quotas[b])) - (quotas[a] - Math.floor(quotas[a])) || eligible[b].remainingMinutes - eligible[a].remainingMinutes || a - b);
    while (left > 0) {
      for (const i of order) {
        if (allocations[i] < capacities[i]) { allocations[i]++; left--; }
        if (!left) break;
      }
    }
    eligible.forEach((day, i) => {
      day.count += allocations[i];
      day.remainingMinutes = Math.max(0, day.remainingMinutes - allocations[i] * average);
    });
    return { placed: placeCount, unplaced: needed - placeCount };
  }
  function calculate(state, config, holidays) {
    const { startDate: start, mode } = state.settings;
    if (!dates.parseDate(start)) return { error: "有効な計算開始日を選んでください。" };
    const statuses = state.courses.map(course => ({ course, ...courseStatus(course, start, config) }));
    const expired = statuses.filter(status => status.expired);
    const active = statuses.filter(status => status.course.type !== "seminar" && !status.finished && !status.expired);
    if (!active.length) return { empty: state.courses.length ? "自主学習科目の残作業はありません。完了科目・演習・締切を過ぎた科目の記録はそのまま残っています。" : "科目を追加して、曜日ごとの学習時間を設定してください。", expired };
    if (active.some(status => !Number.isSafeInteger(status.course.minutes) || status.course.minutes <= 0)) return { error: "科目の「その他」の想定時間に、正の整数を入力してください。", expired };
    let nextDate;
    if (mode === "next") nextDate = active.filter(s => s.next).map(s => s.next.date).sort()[0];
    const tasks = active.flatMap(status => {
      const milestone = mode === "next" ? status.next : status.final;
      if (!milestone || (mode === "next" && milestone.date !== nextDate)) return [];
      return [{ deadline: milestone.date, release: releaseDate(status.course, config), type: milestone.type,
        count: Math.max(0, milestone.target - status.complete), minutes: status.course.minutes }];
    });
    if (!tasks.length) return { empty: "次の締切までに必要な作業はありません。", expired };
    const end = tasks.map(task => task.deadline).sort().at(-1);
    for (let year = dates.parseDate(start).getUTCFullYear(); year <= dates.parseDate(end).getUTCFullYear(); year++) {
      if (!holidays[year]) return { error: `${year}年の祝日データがありません。対応年の開始日を選んでください。`, expired };
    }
    const days = makeDays(start, end, state.settings, holidays);
    // 同じ締切・開始可能日を持つ作業をまとめ、回数で加重平均する。
    const groups = [];
    tasks.forEach(task => {
      let group = groups.find(group => group.deadline === task.deadline && group.release === task.release);
      if (!group) { group = { deadline: task.deadline, release: task.release, type: task.type, count: 0, minutes: 0 }; groups.push(group); }
      group.count += task.count;
      group.minutes += task.count * task.minutes;
      if (task.type === "hard") group.type = "hard";
    });
    // 早い最終締切を先に確保。同日なら開始可能日の遅い作業から確保する。
    groups.sort((a, b) => a.deadline.localeCompare(b.deadline) || b.release.localeCompare(a.release));
    groups.forEach(group => {
      group.average = group.minutes / group.count;
      group.available = days.filter(day => day.date >= group.release && day.date <= group.deadline).reduce((sum, day) => sum + day.remainingMinutes, 0);
      Object.assign(group, distribute(days, group.count, group.average, group.release, group.deadline));
      group.missingMinutes = group.unplaced * group.average;
    });
    const earliestRelease = tasks.map(task => task.release).sort()[0];
    const availableMinutes = days.filter(day => day.date >= earliestRelease).reduce((sum, day) => sum + day.minutes, 0);
    const totalCount = groups.reduce((sum, group) => sum + group.count, 0);
    const neededMinutes = groups.reduce((sum, group) => sum + group.minutes, 0);
    const unplaced = groups.reduce((sum, group) => sum + group.unplaced, 0);
    const missingMinutes = groups.reduce((sum, group) => sum + group.missingMinutes, 0);
    days.forEach(day => {
      day.seminars = state.courses.filter(course => course.type === "seminar" && countCompleted(course) < config.sections.seminar.totalSessions && course.weekday === day.weekday && !course.cancellations.includes(day.date)).map(course => ({ name: course.name, color: course.color }));
    });
    return { start, end, days, groups, totalCount, neededMinutes, average: neededMinutes / totalCount,
      availableMinutes, unplaced, missingMinutes, expired, calendarDays: days.length, placed: totalCount - unplaced };
  }
  return { countCompleted, setSessionComplete, setReport, setVideo, setBulk, bulkWouldOverwrite, releaseDate, courseStatus, dayMinutes, distribute, calculate };
})();
if (typeof module !== "undefined") module.exports = PaceEngine;
