'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../frontend/js/duel-engine.js'),S=require('../frontend/js/duel-survival.js');
const make=seed=>E.createMatch({mode:'survival',players:['you','cpu'],startAt:0,seed:seed||123});
const me=m=>m.players[0],cpu=m=>m.players[1];
function attack(m,id='you'){return E.input(m,id,{type:'attack'},m.now);}
function defend(m,id){for(const a of [...m.attacks])if(a.to===id&&a.state!=='dormant'&&Math.abs(a.impactAt-m.now)<15)E.input(m,id,{type:'guard',dir:a.dir},m.now);}
function safeAdvance(m,to){for(let at=m.now+10;at<=to&&m.status!=='finished';at+=10){E.advance(m,at);defend(m,'you');defend(m,'cpu');}}
test('shared scheduled threats have identical types, directions and timings for both players',()=>{
 const m=make();safeAdvance(m,15000);assert.ok(m.patternIndex>5);
 E.advance(m,m.nextPatternAt);const latest=m.attacks.filter(a=>a.patternId===m.patternIndex-1);assert.equal(latest.length,2);
 const normalized=latest.map(({attackId,to,...a})=>a);assert.deepEqual(normalized[0],normalized[1]);
 const n=make();safeAdvance(n,15000);E.advance(n,n.nextPatternAt);assert.deepEqual(n.attacks,m.attacks);
});
test('activity is kill-earned, capped at 100 and has bounded combo/perfect bonuses',()=>{
 const m=make();E.advance(m,500);assert.equal(me(m).activity,0);
 safeAdvance(m,25000);assert.ok(me(m).activity>0);assert.ok(me(m).activity<=100);assert.ok(me(m).parryStreak>5);assert.ok(me(m).perfectStreak>5);
 me(m).activity=100;me(m).energy=100;safeAdvance(m,30000);assert.equal(me(m).activity,100);
 assert.equal(E.input(m,'you',{type:'upgrade'},m.now).ok,false);assert.equal(me(m).offer,null);
});
test('activity consumes up to 10: attack, partial cancellation, exact cancellation, half-strength reflection',()=>{
 for(const [activity,amp,expectedOwn,expectedRival] of [[10,0,0,10],[6,10,4,0],[10,6,0,2],[10,10,0,0],[3,0,0,3]]){
  const m=make();E.advance(m,0);me(m).activity=activity;me(m).amplification=amp;const result=attack(m);
  assert.equal(result.ok,true);assert.equal(me(m).activity,0);assert.equal(me(m).amplification,expectedOwn);assert.equal(cpu(m).amplification,expectedRival);assert.equal(m.attacks.length,0,'activity never shoots a projectile');
 }
 const m=make();E.advance(m,0);me(m).activity=100;attack(m);assert.equal(me(m).activity,90);assert.equal(attack(m).reason,'cooldown');
});
test('pending amplification applies exactly once to a core hit, not an empty parry',()=>{
 const m=make();E.advance(m,0);me(m).amplification=10;E.input(m,'you',{type:'guard',dir:'left'},0);assert.equal(me(m).amplification,10);
 E.advance(m,4500);const hits=m.events.filter(e=>e.type==='hit'&&e.playerId==='you');assert.ok(hits.length>=1);assert.equal(hits[0].amplification,10);assert.equal(me(m).amplification,0);
 E.advance(m,6500);assert.ok(m.events.filter(e=>e.type==='hit'&&e.playerId==='you').slice(1).every(e=>e.amplification===0));
});
test('boss entry is individual: drain, warning, waiting and wave deadline',()=>{
 const m=make();m.now=59975;m.nextPatternAt=60000;m.lastPatternArrival=-Infinity;
 m.attacks=[{attackId:999,to:'cpu',from:'field',kind:'virus',dir:'up',state:'pending',launchedAt:59000,impactAt:60500}];
 E.advance(m,60000);assert.ok(m.boss);assert.ok(me(m).boss);assert.equal(cpu(m).boss,null);assert.equal(cpu(m).waveState,'draining');
 const chosen=m.boss.kind;E.input(m,'cpu',{type:'guard',dir:'up'},60500);assert.ok(cpu(m).boss);assert.equal(cpu(m).boss.kind,chosen);assert.equal(cpu(m).boss.phaseAt,60500);
 me(m).boss.phase='done';me(m).boss.result='cleared';me(m).waveState='waiting';me(m).activity=20;
 assert.equal(attack(m).reason,'boss_waiting');E.advance(m,105000);assert.equal(m.boss,null);assert.equal(m.attacks.length,0);
});
test('dormant worms become clearable on boss reservation; Normal to Extreme ramp is bounded',()=>{
 const m=make();m.now=59975;m.nextPatternAt=Infinity;m.attacks=[{attackId:998,to:'you',from:'field',kind:'worm',dir:'up',state:'dormant',remaining:3,impactAt:null,launchedAt:59000}];E.advance(m,60000);assert.equal(m.attacks[0].state,'pending');assert.ok(Number.isFinite(m.attacks[0].impactAt));
 const first=make();const a=E.snapshot(first,0);assert.equal(a.speedPercent,20);assert.equal(a.rules.guardWindowMs,300);
 first.now=180000;first.nextPatternAt=Infinity;first.nextBossAt=Infinity;const b=E.snapshot(first,180000);assert.equal(b.speedPercent,75);assert.equal(b.rules.guardWindowMs,200);assert.equal(b.rules.perfectWindowMs,55);
});
test('harder threats and perfect kills earn more activity; misses reset streaks',()=>{
 function kill(kind,offset=0){const m=make();m.now=1000;m.nextPatternAt=Infinity;m.nextBossAt=Infinity;m.attacks=[{attackId:100,to:'you',from:'field',kind,dir:'up',state:'pending',launchedAt:0,impactAt:1000}];E.input(m,'you',{type:'guard',dir:'up'},1000+offset);return m;}
 assert.ok(me(kill('worm')).activity>me(kill('virus')).activity);assert.ok(me(kill('virus')).activity>me(kill('virus',150)).activity);
 const m=kill('virus');E.input(m,'you',{type:'guard',dir:'left'},m.now);assert.equal(me(m).parryStreak,0);assert.equal(me(m).perfectStreak,0);
});

test('missing the ring does not deal damage until physical core contact; short taps use press time',()=>{
 const m=make();m.now=1000;m.nextPatternAt=Infinity;m.nextBossAt=Infinity;m.attacks=[{attackId:99,to:'you',from:'field',kind:'virus',dir:'up',state:'pending',launchedAt:0,impactAt:1000}];
 E.advance(m,1400);assert.equal(me(m).vulnerability,0);assert.equal(m.attacks.length,1);
 const guarded=E.input(m,'you',{type:'guard',dir:'up'},1100);assert.equal(guarded.guarded,true);assert.equal(me(m).vulnerability,0);
 m.attacks=[{attackId:100,to:'you',from:'field',kind:'virus',dir:'down',state:'pending',launchedAt:0,impactAt:1000}];me(m).amplification=10;E.advance(m,1595);assert.equal(me(m).vulnerability,24);assert.equal(me(m).amplification,0);
});

test('complete survival boss waves pause spawning, allow waiting, then resume matched patterns',()=>{
 const m=make(995);let previous=false,starts=0,ends=0,sawWaiting=false,patternsAtEntry=0;
 for(let at=25;at<=170000&&ends<2;at+=25){
  E.advance(m,at);if(m.status==='finished')throw Error('Unexpected elimination');
  if(m.boss&&!previous){starts++;patternsAtEntry=m.patternIndex;}if(m.boss)assert.equal(m.patternIndex,patternsAtEntry);
  for(const p of m.players){
   if(p.boss){const f=p.boss;
    if(f.phase==='reaction')E.input(m,p.id,{type:'guard',dir:f.sequence[f.sequenceIndex]},at);
    else if(f.phase==='active'){const a=f.attacks.find(a=>Math.abs(a.impactAt-at)<15);if(a)E.input(m,p.id,{type:'guard',dir:a.dir},at);}
   }else for(const a of[...m.attacks])if(a.to===p.id&&a.state!=='dormant'&&Math.abs(a.impactAt-at-(p.id==='cpu'?150:0))<15)E.input(m,p.id,{type:'guard',dir:a.dir},at);
  }
  if(m.boss&&m.players.some(p=>p.waveState==='waiting')&&m.players.some(p=>p.waveState!=='waiting'))sawWaiting=true;
  if(!m.boss&&previous)ends++;previous=!!m.boss;
 }
 assert.equal(starts,2);assert.equal(ends,2);assert.ok(sawWaiting);assert.equal(m.status,'running');assert.ok(m.nextPatternAt>m.now);
 E.advance(m,m.nextPatternAt);const newest=m.attacks.filter(a=>a.patternId===m.patternIndex-1);assert.equal(newest.length,2);
});
test('boss kind selection can reach every registered boss and reserved invisible threats are cancelled',()=>{
 const kinds=new Set();for(let seed=1;seed<=32;seed++){const m=make(seed);m.now=59975;m.nextPatternAt=Infinity;m.attacks=[{attackId:100,to:'you',kind:'virus',dir:'up',state:'pending',launchedAt:61000,impactAt:63000}];E.advance(m,60000);kinds.add(m.boss.kind);assert.equal(m.attacks.length,0);assert.ok(me(m).boss);}
 assert.deepEqual([...kinds].sort(),require('../frontend/js/duel-boss.js').KINDS.slice().sort());
});

test('Trojan escape keeps its common lane; a missed host produces an unguardable core follow-up',()=>{
 const m=make();m.now=1000;m.nextPatternAt=Infinity;m.nextBossAt=Infinity;
 m.attacks=[{attackId:100,to:'you',from:'field',kind:'virus',dir:'up',state:'pending',launchedAt:0,impactAt:1000,trojan:true,escapeDir:'left'}];
 E.input(m,'you',{type:'guard',dir:'up'},1000);assert.equal(m.attacks[0].kind,'trojan');assert.equal(m.attacks[0].dir,'left');
 m.attacks=[{attackId:101,to:'you',from:'field',kind:'virus',dir:'up',state:'pending',launchedAt:0,impactAt:1000,trojan:true,escapeDir:'left'}];
 E.advance(m,1600);assert.equal(m.attacks[0].kind,'echo');assert.equal(m.attacks[0].echo,true);
 const hp=me(m).vulnerability,arrival=m.attacks[0].impactAt;E.advance(m,arrival);assert.equal(me(m).vulnerability,hp+8);
});

test('Trojan follow-ups and shared base patterns reserve staggered parry arrivals',()=>{
 const m=make();m.now=1000;m.nextPatternAt=Infinity;m.nextBossAt=Infinity;
 m.attacks=[{attackId:101,to:'you',from:'field',kind:'virus',dir:'up',state:'pending',launchedAt:0,impactAt:1000,trojan:true,escapeDir:'left'},{attackId:102,to:'you',from:'field',kind:'virus',dir:'left',state:'pending',launchedAt:1300,impactAt:2900}];
 E.input(m,'you',{type:'guard',dir:'up'},1000);const times=m.attacks.map(a=>a.impactAt).sort((a,b)=>a-b);assert.ok(times[1]-times[0]>=520);
});
