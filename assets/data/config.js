// 締切・科目負荷・入力範囲はここで変更します。
const APP_CONFIG = {
  defaultTerm: "2026-3q",
  terms: {
    "2026-3q": { label: "2026年度3Q", startDate: null, finalDeadline: "2026-11-29" },
    "2026-4q": { label: "2026年度4Q", startDate: "2026-12-14", finalDeadline: "2027-02-14" }
  },
  sessionsPerCourse: 15,
  courseModels: [
    { key: "relaxed", label: "余裕あり", emoji: "🌱", minutes: 150 },
    { key: "standard", label: "がんばる", emoji: "📚", minutes: 120 },
    { key: "tight", label: "かつかつ", emoji: "🔥", minutes: 100 }
  ],
  slider: { min: 0, max: 480, step: 15 }
};
