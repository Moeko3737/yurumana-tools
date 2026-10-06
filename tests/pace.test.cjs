const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const config = require('../assets/data/academic-config.js');
const engine = require('../pace-navi/engine.js');
const store = require('../pace-navi/storage.js');
const context = vm.createContext({});vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../assets/data/holidays.js'),'utf8')+';globalThis.holidays=JAPAN_HOLIDAYS',context);const holidays=context.holidays;
let serial=0;
const course = type => store.createCourse(type,config,`test-${++serial}`);
const state = (courses=[],start='2026-10-06',mode='next',minutes=480) => {const s=store.defaults();s.courses=courses;s.settings={...s.settings,startDate:start,mode,weekdays:Array(7).fill(minutes)};return s;};
const run = s => engine.calculate(s,config,holidays);
assert.ok(run(state()).empty);console.log('A: 科目0件 PASS');
let q3=course('onDemand3Q');let r=run(state([q3]));assert.equal(r.totalCount,5);assert.equal(r.end,'2026-10-29');console.log('B: 3Q 0/15 → 5回 PASS');
engine.setBulk(q3,3);r=run(state([q3],'2026-10-30'));assert.equal(r.totalCount,7);assert.equal(r.end,'2026-11-12');assert.equal(engine.courseStatus(q3,'2026-10-30',config).missed.length,1);console.log('C: ソフト締切経過の繰り越し PASS');
engine.setBulk(q3,15);assert.ok(engine.courseStatus(q3,'2026-10-06',config).finished);assert.ok(run(state([q3])).empty);console.log('D: 完了科目 PASS');
let pixiv=course('pixiv3Q');assert.equal(run(state([pixiv])).totalCount,1);console.log('E: pixiv 0/8 → 1回 PASS');
engine.setBulk(pixiv,1);r=run(state([pixiv]));assert.equal(r.end,'2026-11-29');assert.equal(r.totalCount,7);console.log('F: pixiv 1/8 → 残り7回 PASS');
let live=course('live');engine.setBulk(live,3);assert.equal(run(state([live])).totalCount,2);console.log('G: ライブ 3/15 → 2回 PASS');
q3=course('onDemand3Q');engine.setReport(q3.sessions[7],true);assert.ok(q3.sessions[7].videos.every(Boolean));assert.ok(q3.sessions[7].complete);console.log('H: 通常レポートで動画6本完了 PASS');
for(const type of ['pixiv3Q','live']){const c=course(type);engine.setReport(c.sessions[0],true);assert.deepEqual(c.sessions[0].videos,[true]);assert.equal(engine.countCompleted(c),1);}console.log('I: pixiv/ライブのレポート PASS');
engine.setSessionComplete(q3.sessions[0],true);engine.setSessionComplete(q3.sessions[3],true);assert.equal(engine.countCompleted(q3),3);assert.ok(engine.bulkWouldOverwrite(q3,3));console.log('J: 飛び飛び・上書き検知 PASS');
const seminar=course('seminar');seminar.name='演習A';seminar.weekday=3;const seminar2=course('seminar');seminar2.name='演習B';seminar2.weekday=3;
r=run(state([course('onDemand3Q'),seminar,seminar2]));assert.equal(r.days.find(d=>d.date==='2026-10-07').seminars.length,2);console.log('K: 同曜日の複数演習 PASS');
seminar.cancellations=['2026-10-07'];r=run(state([course('onDemand3Q'),seminar,seminar2]));assert.equal(r.days.find(d=>d.date==='2026-10-07').seminars.length,1);console.log('L: 休講例外 PASS');
r=run(state([course('onDemand3Q')],'2026-10-06','next',0));assert.equal(r.placed,0);assert.equal(r.unplaced,5);assert.equal(r.availableMinutes,0);console.log('M: 全曜日0分 PASS');
r=run(state([course('onDemand3Q')],'2026-10-29','next',120));assert.equal(r.placed,1);assert.equal(r.unplaced,4);assert.equal(r.days[0].count,1);assert.equal(r.missingMinutes,480);console.log('N: 容量超過なし・不足量 PASS');
const both=[course('onDemand3Q'),course('onDemand4Q')];assert.equal(run(state(both)).totalCount,5);r=run(state(both,'2026-10-06','final'));assert.equal(r.totalCount,30);assert.equal(r.groups.length,2);console.log('O: モード切替 PASS');
assert.equal(r.groups[0].deadline,'2026-11-29');assert.equal(r.groups[0].placed,15);assert.equal(r.groups[1].release,'2026-12-14');assert.equal(r.days.filter(d=>d.date>'2026-11-29'&&d.date<'2026-12-14').reduce((s,d)=>s+d.count,0),0);
assert.equal(r.days.filter(d=>d.date<='2026-11-29').reduce((s,d)=>s+d.count,0),15);assert.equal(r.days.filter(d=>d.date>='2026-12-14').reduce((s,d)=>s+d.count,0),15);console.log('P: 3Q締切尊重・4Q開始前に配分なし PASS');
const s=state([q3,seminar,pixiv]);const restored=store.validate(JSON.parse(JSON.stringify(s)),config);assert.deepEqual(restored,s);console.log('R/S: JSONと保存データ形式の往復 PASS');
for(const bad of [{}, {...s,schemaVersion:2}, {...s,settings:{...s.settings,weekdays:[1]}}, {...s,courses:[{...q3,color:'bad'}]}, {...s,courses:[{...q3,minutes:-1}]}, {...s,courses:[q3,q3]}]) assert.throws(()=>store.validate(bad,config));
const original=JSON.stringify(s);assert.throws(()=>store.validate(JSON.parse('{"schemaVersion":1}'),config));assert.equal(JSON.stringify(s),original);
assert.ok(run(state([course('onDemand3Q')],'2026-11-30')).expired.length);assert.ok(run(state([course('onDemand3Q')],'')).error);
const invalid=course('onDemand3Q');invalid.minutes=null;assert.ok(run(state([invalid])).error);
const avgA=course('onDemand3Q'),avgB=course('onDemand3Q');avgA.minutes=100;avgB.minutes=150;engine.setBulk(avgA,2);engine.setBulk(avgB,3);r=run(state([avgA,avgB]));assert.equal(r.totalCount,5);assert.equal(r.neededMinutes,600);assert.equal(r.average,120);
const holidayState=state([course('onDemand3Q')],'2026-10-12');holidayState.settings.holidayRule='off';assert.equal(run(holidayState).days[0].minutes,0);holidayState.settings.holidayRule='custom';holidayState.settings.holidayMinutes=240;assert.equal(run(holidayState).days[0].minutes,240);
const shortState=state([course('onDemand3Q')],'2026-10-06','next',60);assert.equal(run(shortState).placed,0);assert.ok(run(shortState).availableMinutes>run(shortState).neededMinutes);
// 同じ最終締切でも、4Q開始前の時間を4Qに使わず、ライブと容量を共有。
r=run(state([course('live'),course('onDemand4Q')],'2026-11-30','final',120));assert.ok(r.days.every(day=>(day.minutes-day.remainingMinutes)<=day.minutes+1e-6));assert.equal(r.days.reduce((sum,day)=>sum+day.count,0),r.placed);
const noQ4={...config,q4Start:null};assert.equal(engine.releaseDate(course('onDemand4Q'),noQ4),'2026-11-30');
engine.setVideo(q3.sessions[7],0,false);assert.equal(q3.sessions[7].complete,false);assert.equal(q3.sessions[7].report,false);
console.log('追加: 加重平均・未配置・祝日・期限超過・空欄・不正JSON・共用容量・未設定開始日 PASS');
// 100種類の入力でも本数合計・日別上限を維持。
for(let i=0;i<100;i++){
 const courses=[course('onDemand3Q'),course('pixiv3Q')];courses[0].minutes=100+i;courses[1].minutes=150;const test=state(courses);test.settings.weekdays=Array.from({length:7},(_,d)=>((i+d*7)%33)*15);const res=run(test);
 assert.equal(res.days.reduce((sum,day)=>sum+day.count,0),res.placed);assert.equal(res.placed+res.unplaced,res.totalCount);assert.ok(res.days.every(day=>day.count===0 || day.minutes>=day.count*res.groups[0].average-1e-6));
}
console.log('比例配分の本数保存・時間上限（100パターン）PASS');

// 演習の表示は自主学習の時間や祝日ルールから独立する。
const holidaySeminar=course('seminar');holidaySeminar.weekday=1;holidaySeminar.name='祝日の演習';
const seminarHolidayState=state([course('onDemand3Q'),holidaySeminar],'2026-10-12','next',0);
seminarHolidayState.settings.holidayRule='off';
let holidayDay=run(seminarHolidayState).days[0];
assert.equal(holidayDay.minutes,0);assert.equal(holidayDay.count,0);assert.equal(holidayDay.seminars.length,1);
holidaySeminar.cancellations=['2026-10-12'];assert.equal(run(seminarHolidayState).days[0].seminars.length,0);
console.log('演習: 祝日・自主学習0分でも表示、明示した休講日は除外 PASS');
