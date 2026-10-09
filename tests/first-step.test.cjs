const assert = require('node:assert/strict');
const F = require('../first-step/engine.js');
const mission = id => F.missions.find(m=>m.id===id);
let d=F.defaults();
assert.equal(F.suggest(d).id,'pc');d.route.done=['pc'];d.route.lastId='pc';assert.equal(F.suggest(d).id,'portal');
d.route.done.push('portal');d.route.lastId='portal';assert.equal(F.suggest(d).id,'choose');
d.route.done.push('choose');d.route.lastId='choose';assert.equal(F.suggest(d).id,'play');
d.route.done.push('play');d.route.lastId='play';assert.equal(F.suggest(d).id,'video');
assert.equal(F.suggest({...d,route:{done:['report-page'],lastId:'report-page'}}).id,'question');
assert.equal(F.suggest({...d,route:{done:['question'],lastId:'question'}}).id,'report5');
console.log('段階的提案・スキップ・動画と授業の区別 PASS');
const now=Date.UTC(2026,9,9,1);
d=F.defaults();d.activeSession=F.begin(mission('video'),now);
assert.equal(F.complete(d,now+1000),null);assert.equal(F.startWork(d.activeSession,now+4999),false);assert.equal(F.startWork(d.activeSession,now+5000),true);
assert.equal(F.elapsed(d.activeSession,now+35000),30);
F.pause(d.activeSession,now+35000);assert.equal(F.elapsed(d.activeSession,now+95000),30);d.activeSession.resumedAt=now+95000;
assert.equal(F.elapsed(d.activeSession,now+155000),90);const r=F.complete(d,now+155000);assert.equal(r.studySeconds,90);assert.equal(F.complete(d,now+155001),null);assert.equal(d.records.length,1);
assert.deepEqual(F.validate(JSON.parse(JSON.stringify(d))),d);
d.activeSession=F.begin(mission('pc'),now+200000);F.startWork(d.activeSession,now+205000);assert.equal(F.complete(d,now+905000).studySeconds,0);
console.log('5秒除外・一時停止・時刻差計測・手動完了・連打防止・準備0分 PASS');
for(const minutes of [5,10,15,25,47]){let a=F.begin(mission('video'),now);F.startWork(a,now+5000);a.timerTarget=minutes*60;assert.equal(a.timerTarget-F.elapsed(a,now+5000+minutes*60000),0);assert.equal(a.phase,'running');}
console.log('各タイマー・終了時も実行中 PASS');
assert.equal(F.dayKey('2026-10-11T15:00:00.000Z'),'2026-10-12');assert.equal(F.weekKey('2026-10-11T14:59:59.000Z'),'2026-10-05');assert.equal(F.weekKey('2026-10-11T15:00:00.000Z'),'2026-10-12');
const stats=F.statistics(d.records,now+905000);assert.equal(stats.today.count,2);assert.equal(stats.week.seconds,90);d.records[0].studySeconds=0;d.records[0].corrected=true;assert.equal(F.statistics(d.records,now+905000).all.seconds,0);
console.log('日本時間・月曜週境界・修正後の集計 PASS');
let c={id:'custom-test',name:'Pythonを1問',category:'自分用',type:'work',next:null,goal:'',report:'',countTime:true,automatic:false};d.customMissions=[c];d.route={done:F.missions.map(m=>m.id),lastId:'next'};assert.equal(F.suggest(d),null);c.automatic=true;assert.equal(F.suggest(d).id,'custom-test');
d.activeSession=F.begin(c,now+1000000);assert.deepEqual(F.validate(JSON.parse(JSON.stringify(d))),d);F.startWork(d.activeSession,now+1005000);assert.deepEqual(F.validate(JSON.parse(JSON.stringify(d))),d);F.pause(d.activeSession,now+1009000);assert.deepEqual(F.validate(JSON.parse(JSON.stringify(d))),d);
console.log('自作ミッション許可・実行状態バックアップ往復 PASS');
for(const mutate of [x=>x.schemaVersion=2,x=>x.settings.motion='bad',x=>x.records.push({...x.records[0]}),x=>x.records[0].studySeconds=-1,x=>x.records[0].elapsedSeconds=Infinity,x=>x.records[0].completedAt='2026-02-30T00:00:00.000Z',x=>x.customMissions[0].id='pc',x=>x.customMissions[0].name='',x=>x.activeSession.resumedAt=-1,x=>x.route.done.push('pc')]){const raw=JSON.parse(JSON.stringify(d));mutate(raw);assert.throws(()=>F.validate(raw));}
assert.equal(F.formatTime(0),'0分');assert.equal(F.formatTime(59),'1分未満');assert.equal(F.formatTime(13500),'3時間45分');assert.equal(F.formatTime(3601,true),'1:00:01');
console.log('不正JSON・重複ID・日付・数値・バージョン検証・時間表記 PASS');
for(const activity of ['video','report','test'])for(const mood of ['none','little','ready'])for(const minutes of [5,10,15,25]){
  const plan=F.createPlan(activity,mood,minutes);assert.equal(plan.steps[0].mission.name,'PCを開く');assert.equal(plan.steps[0].seconds,60);assert.equal(plan.steps[1].seconds,60);
  assert.equal(plan.steps.filter(s=>s.mission.type==='work').length,mood==='none'?0:1);
  assert.ok(plan.steps.every(s=>!s.mission.name.includes('ノート')&&!s.mission.name.includes('練習問題')&&!s.mission.name.includes('設問')));
  const saved=F.defaults();saved.plan=plan;assert.deepEqual(F.validate(JSON.parse(JSON.stringify(saved))).plan,plan);
}
const direct=F.createPlan('video','little',13,false);assert.equal(direct.steps.length,1);assert.equal(direct.steps[0].seconds,780);
const old=F.defaults();delete old.preferences;delete old.plan;assert.deepEqual(F.validate(old).preferences,F.defaults().preferences);
const result=F.defaults();result.activeSession=F.begin(mission('video'),now);F.startWork(result.activeSession,now+5000);F.complete(result,now+65000,'submitted');assert.equal(F.validate(result).records[0].outcome,'submitted');
assert.throws(()=>F.createPlan('constructor','ready',5));assert.throws(()=>F.createPlan('report','none',0));
console.log('36組合せ/準備1分/やる気なしは作業なし/方法を決めつけない/次の作業の自由時間/旧データ互換/結果保存 PASS');

const sharingRecords = [
  {missionId:"step-pc",name:"PCを開く",type:"start",studySeconds:0},
  {missionId:"pc",name:"PCを開く",type:"start",studySeconds:0},
  {missionId:"step-work-report-5",name:"確認レポートを5分だけ進める",type:"work",studySeconds:300},
  {missionId:"step-work-report-10",name:"確認レポートを10分だけ進める",type:"work",studySeconds:120,outcome:"submitted",corrected:true},
  {missionId:"step-work-video-15",name:"授業を15分だけ進める",type:"work",studySeconds:900},
  {missionId:"step-work-test-5",name:"5分だけテスト勉強をする",type:"work",studySeconds:30},
  {missionId:"custom-1",name:"自分の作業",type:"work",studySeconds:0}
];
const beforeSharing = JSON.stringify(sharingRecords);
assert.deepEqual(F.reportLines(sharingRecords),["☑︎PCを開く","☑︎確認レポートを進める：7分（提出できた）","☑︎授業を進める：15分","☑︎テスト勉強：1分未満","☑︎自分の作業：0分"]);
assert.equal(JSON.stringify(sharingRecords),beforeSharing);
console.log("共有文: 異なる設定時間の作業を集約・修正時間・準備重複・提出・自作・記録保持 PASS");
