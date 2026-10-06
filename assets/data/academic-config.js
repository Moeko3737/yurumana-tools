"use strict";
// 日程はユーザー提供の2026年度締切表と、このチャットの学事暦で確認。
// 授業開始: 3Q 2026-10-06 / 4Q 2026-12-14。変更はこのファイルだけで行う。
const ACADEMIC_CONFIG = {
  academicYear: 2026,
  q3Start: "2026-10-06",
  q4Start: "2026-12-14",
  slider: { min: 0, max: 480, step: 15 },
  sections: {
    onDemand3Q: { label: "オンデマンド科目（3Q）", tag: "オンデマンド · 3Q", totalSessions: 15, videos: 6, quarter: "q3", milestones: [
      { date: "2026-10-29", target: 5, type: "soft" },
      { date: "2026-11-12", target: 10, type: "soft" },
      { date: "2026-11-29", target: 15, type: "hard" }
    ] },
    onDemand4Q: { label: "オンデマンド科目（4Q）", tag: "オンデマンド · 4Q", totalSessions: 15, videos: 6, quarter: "q4", milestones: [
      { date: "2027-01-13", target: 5, type: "soft" },
      { date: "2027-01-28", target: 10, type: "soft" },
      { date: "2027-02-14", target: 15, type: "hard" }
    ] },
    pixiv3Q: { label: "pixiv提携科目（3Q）", tag: "pixiv · 3Q", totalSessions: 8, videos: 1, quarter: "q3", milestones: [
      { date: "2026-10-29", target: 1, type: "soft" },
      { date: "2026-11-29", target: 8, type: "hard" }
    ] },
    pixiv4Q: { label: "pixiv提携科目（4Q）", tag: "pixiv · 4Q", totalSessions: 8, videos: 1, quarter: "q4", milestones: [
      { date: "2027-01-13", target: 1, type: "soft" },
      { date: "2027-02-14", target: 8, type: "hard" }
    ] },
    live: { label: "ライブ映像科目", tag: "ライブ", totalSessions: 15, videos: 1, quarter: "q3", milestones: [
      { date: "2026-11-29", target: 5, type: "soft" },
      { date: "2027-02-14", target: 15, type: "hard" }
    ] },
    seminar: { label: "演習科目", tag: "演習", totalSessions: 15, videos: 0, milestones: [] }
  }
};
if (typeof module !== "undefined") module.exports = ACADEMIC_CONFIG;
