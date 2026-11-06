(function(root,factory){
  'use strict';const api=factory(typeof module==='object'&&module.exports?require('./duel-boss.js'):root.NeonDuelBoss);
  if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NeonDuelSurvival=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Boss){
  'use strict';
  const DIRS=['up','right','down','left'];
  const ENEMIES={virus:{damage:14,travel:2200,gain:3},ddos:{damage:24,travel:2200,gain:4},trojan:{damage:34,travel:1800,gain:6},worm:{damage:30,travel:900,gain:8},ransom:{damage:8,travel:1250,gain:4},phishing:{damage:40,travel:1900,gain:7},echo:{damage:8,travel:700,gain:2}};
  const RULES=Object.freeze({energyMax:100,energyStart:0,attackCost:10,activityMax:100,activitySpendMax:10,overflowMax:20,bossClearReduction:30,attackCooldownMs:350,guardCooldownMs:180,guardWindowMs:300,perfectWindowMs:85,emptyGuardDamage:4,vulnerabilityMax:100,bossIntervalMs:60000,bossWaveMs:45000,paceRampMs:180000,maxEvents:96});
  const coreAt=a=>a.echo?a.impactAt:a.launchedAt+(a.impactAt-a.launchedAt)*(a.kind==='worm'?Math.sqrt(185/116):185/116);
  const round=n=>Math.round(n*10)/10,opposite=d=>DIRS[(DIRS.indexOf(d)+2)%4];
  const rand=m=>{m.rng=(Math.imul(m.rng,1664525)+1013904223)>>>0;return m.rng/2**32;};
  function pacing(m){const t=Math.min(1,Math.max(0,(m.now-m.startAt)/RULES.paceRampMs));return{speed:1.2+.55*t,gap:Math.round(1305-975*t),guard:300-100*t,perfect:85-30*t};}
  function event(m,type,details={}){m.events.push({id:m.nextEventId++,type,at:m.now,...details});if(m.events.length>RULES.maxEvents)m.events.splice(0,m.events.length-RULES.maxEvents);}
  function createMatch({players,startAt=0,seed=1}={}){
    if(!Array.isArray(players)||players.length!==2||players.some(p=>typeof p!=='string'||!p)||new Set(players).size!==2||!Number.isFinite(startAt))throw new TypeError('Survival needs two distinct players and a finite start time.');
    let rng=2166136261;for(const c of String(seed))rng=Math.imul(rng^c.charCodeAt(0),16777619)>>>0;
    return{mode:'survival',startAt,seed,rng,now:Math.min(0,startAt),status:'countdown',winnerId:null,finishedAt:null,finishReason:null,
      players:players.map((id,i)=>({id,vulnerability:0,energy:0,activity:0,amplification:0,amplificationQueue:[],overflow:0,parryStreak:0,perfectStreak:0,streak:0,kills:0,eliminated:false,boss:null,waveState:null,lockedUntil:{},lastGuardAt:{},lastAttackAt:-Infinity,lastSeq:-1,targetId:players[1-i],offer:null,upgrades:{}})),
      attacks:[],events:[],nextAttackId:1,nextEventId:1,nextPatternAt:startAt+1200,lastPatternArrival:-Infinity,patternIndex:0,nextBossAt:startAt+60000,boss:null};
  }
  function player(m,id){return m.players.find(p=>p.id===id);}
  function finish(m){const alive=m.players.filter(p=>!p.eliminated);if(alive.length>1)return;m.status='finished';m.winnerId=alive[0]?.id??null;m.finishedAt=m.now;m.finishReason=alive.length?'vulnerability':'draw';event(m,'finish',{winnerId:m.winnerId});}
  // Keep the total for CPU/status compatibility; damage consumes only one queued turn.
  function queue(p){
    if(!Array.isArray(p.amplificationQueue))p.amplificationQueue=[];
    const total=p.amplificationQueue.reduce((n,v)=>n+v,0);
    if(Math.abs(total-p.amplification)>.01)p.amplificationQueue=p.amplification>0?[p.amplification]:[];
    return p.amplificationQueue;
  }
  function syncPressure(p){p.amplification=round(p.amplificationQueue.reduce((n,v)=>n+v,0));}
  function reducePressure(p,amount){
    const turns=queue(p);let left=amount;
    while(left>0&&turns.length){const take=Math.min(left,turns[0]);turns[0]=round(turns[0]-take);left=round(left-take);if(turns[0]<=0)turns.shift();}
    syncPressure(p);return round(amount-left);
  }
  function damage(m,p,base,details={},core=true){
    const bonus=core?(queue(p).shift()||0):0;if(core)syncPressure(p);
    const amount=round(base+bonus);p.vulnerability=round(Math.min(100,p.vulnerability+amount));p.parryStreak=0;p.perfectStreak=0;
    event(m,core?'hit':'miss',{playerId:p.id,damage:amount,amplification:bonus,vulnerability:p.vulnerability,...details});
    if(p.vulnerability>=100){p.eliminated=true;p.waveState='eliminated';event(m,'eliminate',{playerId:p.id});}
  }
  function gain(m,p,kind,perfect,boss=false){
    p.parryStreak++;p.perfectStreak=perfect?p.perfectStreak+1:0;
    if(perfect&&p.perfectStreak>=3){const old=p.overflow;p.overflow=Math.min(RULES.overflowMax,p.overflow+2);if(p.overflow>old)event(m,'overflow',{playerId:p.id,overflow:p.overflow});}
    if(boss)return 0;
    const base=ENEMIES[kind].gain,chain=Math.min(2,Math.floor(p.parryStreak/5)*.5),precision=Math.min(3,Math.floor(p.perfectStreak/3)*.5);
    const value=round((base*(perfect?1.5:1)+chain+precision)*.5);p.activity=round(Math.min(100,p.activity+value));p.energy=p.activity;
    return value;
  }
  function completeBoss(m,p){
    if(p.waveState==='waiting')return;
    p.waveState='waiting';const cleared=p.boss.result==='cleared';
    const reduced=cleared?reducePressure(p,RULES.bossClearReduction):0;
    event(m,'boss_done',{playerId:p.id,cleared,reduced});
  }
  function addAttack(m,p,pattern){
    const a={...pattern,attackId:m.nextAttackId++,to:p.id,from:'field',source:'pattern'};m.attacks.push(a);event(m,'attack',{...a,playerId:p.id});return a;
  }
  function reserve(m,earliest,to){
    const gap=Math.min(520,pacing(m).gap);let at=earliest;
    const slots=m.attacks.filter(a=>!a.echo&&a.state!=='dormant'&&(!to||a.to===to)).map(a=>a.impactAt).sort((a,b)=>a-b);
    for(const slot of slots)if(Math.abs(at-slot)<gap)at=slot+gap;
    return at;
  }
  function spawnPattern(m){
    const index=m.patternIndex++,pace=pacing(m),roll=rand(m),dir=DIRS[Math.floor(rand(m)*4)];
    let kind=index>=40&&roll<.17?'phishing':index>=25&&roll<.33?'ransom':index>=15&&roll<.43?'worm':index>=3&&roll<.64?'ddos':'virus';
    const travel=Math.round(ENEMIES[kind].travel/pace.speed),impactAt=reserve(m,Math.max(m.now+travel,m.lastPatternArrival+pace.gap));
    m.lastPatternArrival=impactAt;
    const others=DIRS.filter(d=>d!==dir),pattern={patternId:index,kind,dir,launchedAt:impactAt-travel,impactAt,state:'pending',trojan:index>=8&&rand(m)<.13,escapeDir:others[Math.floor(rand(m)*3)],remaining:2+Math.floor(rand(m)*2)};
    if(kind==='phishing'){pattern.decoyDir=opposite(dir);pattern.revealAt=impactAt-pace.guard;}
    if(kind==='worm'){pattern.state='dormant';pattern.launchedAt=m.now;pattern.impactAt=null;pattern.trojan=false;}
    for(const p of m.players)if(!p.eliminated)addAttack(m,p,pattern);
    m.nextPatternAt=m.now+pace.gap;
  }
  function wakeWorm(m,p,a){a.hopAt=m.now;const travel=Math.round(ENEMIES.worm.travel/pacing(m).speed);a.impactAt=reserve(m,m.now+200+travel,p.id);a.launchedAt=a.impactAt-travel;a.state='pending';event(m,'worm_charge',{playerId:p.id,attackId:a.attackId,dir:a.dir});}
  function releaseTrojan(m,p,a,guarded){
    if(!a.trojan||p.eliminated)return;
    const kind=guarded?'trojan':'echo',travel=Math.round(ENEMIES[kind].travel/pacing(m).speed),at=m.now+(guarded?400:0);
    const arrival=guarded?reserve(m,at+travel,p.id):at+travel;
    addAttack(m,p,{patternId:a.patternId,kind,dir:guarded?a.escapeDir:a.dir,launchedAt:arrival-travel,impactAt:arrival,state:'pending',echo:!guarded,trojan:false,escapeDir:a.escapeDir});
  }
  function startWave(m){
    const kinds=Boss.KINDS||['domain','destroy'];const kind=kinds[Math.floor(rand(m)*kinds.length)],seed=Math.floor(rand(m)*2**32);
    m.boss={kind,seed,startedAt:m.now,deadline:m.now+RULES.bossWaveMs,phase:'draining'};m.nextBossAt+=60000;
    event(m,'boss_wave',{kind});
    m.attacks=m.attacks.filter(a=>a.state==='dormant'||a.launchedAt<=m.now);
    // Dormant worms must become clearable after pattern generation stops.
    for(const p of m.players){p.waveState=p.eliminated?'eliminated':'draining';for(const a of m.attacks.filter(a=>a.to===p.id&&a.state==='dormant'))wakeWorm(m,p,a);}
  }
  function bossEffects(m,p,effects){for(const e of effects){
    if(e.type==='damage')damage(m,p,e.amount,{source:'boss',kind:p.boss.kind,dir:e.dir});
    else if(e.type==='miss')damage(m,p,e.amount,{source:'boss',dir:e.dir,reason:e.reason},false);
    else if(e.type==='repair'){const healing=Math.min(p.vulnerability,e.amount);p.vulnerability=round(p.vulnerability-healing);event(m,'boss_repair',{playerId:p.id,healing});}
    else if(e.type==='guard'){const activityGain=gain(m,p,'virus',!!e.perfect,true);event(m,'guard',{...e,at:m.now,playerId:p.id,source:'boss',activityGain});}
    if(p.eliminated)break;
  }}
  function updateWave(m){
    if(!m.boss)return;
    for(const p of m.players){
      if(p.eliminated)continue;
      if(p.waveState==='draining'&&!m.attacks.some(a=>a.to===p.id)){
        p.boss=Boss.createFight({kind:m.boss.kind,seed:m.boss.seed,startAt:m.now});p.waveState='boss';event(m,'boss_start',{playerId:p.id,kind:m.boss.kind});
      }
      if(p.boss?.phase==='done')completeBoss(m,p);
      if(p.boss&&p.boss.phase!=='done'){
        const old=p.boss.phase;bossEffects(m,p,Boss.advance(p.boss,m.now));
        if(p.boss.phase!==old)event(m,'boss_phase',{playerId:p.id,phase:p.boss.phase});
        if(p.boss.phase==='done')completeBoss(m,p);
      }
    }
    if(m.now>=m.boss.deadline){
      for(const p of m.players.filter(p=>!p.eliminated&&p.waveState!=='waiting')){
        damage(m,p,Math.max(20,(p.boss?.remaining||1)*20),{source:'boss',reason:'wave_timeout'});p.waveState='waiting';
      }
      m.attacks=[];
    }
    const alive=m.players.filter(p=>!p.eliminated);
    if(alive.every(p=>p.waveState==='waiting')){
      const kind=m.boss.kind;for(const p of m.players){p.boss=null;p.waveState=null;}m.boss=null;m.nextPatternAt=m.now+1000;m.lastPatternArrival=-Infinity;
      while(m.nextBossAt<=m.now)m.nextBossAt+=60000;event(m,'boss_end',{kind});
    }
  }
  function tick(m,at){
    m.now=at;if(at<m.startAt)return;m.status='running';
    if(!m.boss&&at>=m.nextBossAt)startWave(m);
    if(!m.boss&&at>=m.nextPatternAt)spawnPattern(m);
    const due=m.attacks.filter(a=>a.state!=='dormant'&&at>=coreAt(a));
    m.attacks=m.attacks.filter(a=>!due.includes(a));
    for(const a of due){const p=player(m,a.to);if(p.eliminated)continue;damage(m,p,ENEMIES[a.kind].damage,{attackId:a.attackId,dir:a.dir,kind:a.kind});
      if(a.kind==='ransom')p.lockedUntil[a.dir]=m.now+1200;releaseTrojan(m,p,a,false);
    }
    updateWave(m);finish(m);
  }
  function advance(m,now){
    if(!Number.isFinite(now))throw new TypeError('Invalid time');if(now<m.now)return m;
    if(m.status==='finished'){m.now=now;return m;}
    while(m.now<now&&m.status!=='finished')tick(m,Math.min(now,m.now+25));
    if(m.status!=='finished'&&m.now===now)tick(m,now);return m;
  }
  function input(m,id,command,now){
    if(!Number.isFinite(now))return{ok:false,reason:'invalid_time'};advance(m,now);const p=player(m,id),guardAt=Math.max(m.startAt,Math.min(m.now,now));
    if(!p)return{ok:false,reason:'invalid_player'};if(m.status!=='running'||p.eliminated)return{ok:false,reason:p.eliminated?'eliminated':m.status};
    if(command?.seq!==undefined){if(!Number.isSafeInteger(command.seq)||command.seq<=p.lastSeq)return{ok:false,reason:'duplicate'};p.lastSeq=command.seq;}
    if(command?.type==='attack'){
      if(p.waveState==='waiting'||p.boss?.phase==='done')return{ok:false,reason:'boss_waiting'};
      if(m.now-p.lastAttackAt<RULES.attackCooldownMs)return{ok:false,reason:'cooldown'};
      const spend=round(Math.min(RULES.activitySpendMax+p.overflow,p.activity));if(spend<=0)return{ok:false,reason:'energy'};
      const rival=player(m,p.targetId);if(!rival||rival.eliminated)return{ok:false,reason:'invalid_target'};
      const previous=p.amplification,overflow=p.overflow;
      const cancelled=reducePressure(p,spend+overflow);
      const reflected=previous>0?round(Math.max(0,spend-previous)/2):spend;
      p.activity=round(p.activity-spend);p.energy=p.activity;p.overflow=0;p.perfectStreak=0;p.lastAttackAt=m.now;
      if(reflected>0){queue(rival).push(reflected);syncPressure(rival);}
      event(m,'activity',{playerId:p.id,to:rival.id,spent:spend,cancelled,reflected,overflow,amplification:p.amplification});return{ok:true,spent:spend,cancelled,reflected};
    }
    if(command?.type!=='guard'||!DIRS.includes(command.dir))return{ok:false,reason:'invalid_input'};
    if(p.waveState==='waiting'||p.eliminated)return{ok:false,reason:'boss_waiting'};
    if(p.boss){const previous=p.boss.phase,result=Boss.guard(p.boss,command.dir,m.now,guardAt);bossEffects(m,p,result.effects);if(previous!==p.boss.phase)event(m,'boss_phase',{playerId:p.id,phase:p.boss.phase});updateWave(m);finish(m);return{ok:result.ok,guarded:result.effects.some(e=>e.type==='guard'),perfect:result.effects.some(e=>e.perfect),reason:result.reason};}
    if(m.now<(p.lockedUntil[command.dir]||0))return{ok:false,reason:'lane_locked'};
    if(m.now-(p.lastGuardAt[command.dir]??-Infinity)<RULES.guardCooldownMs)return{ok:false,reason:'cooldown'};p.lastGuardAt[command.dir]=m.now;
    const a=m.attacks.filter(a=>a.to===id&&a.dir===command.dir&&!a.echo&&a.state!=='dormant'&&guardAt>=a.launchedAt&&(a.revealAt===undefined||guardAt>=a.revealAt)&&Math.abs(a.impactAt-guardAt)<=pacing(m).guard).sort((a,b)=>a.impactAt-b.impactAt)[0];
    if(!a){damage(m,p,4,{dir:command.dir},false);finish(m);return{ok:true,guarded:false,perfect:false};}
    m.attacks=m.attacks.filter(x=>x!==a);const perfect=Math.abs(a.impactAt-guardAt)<=pacing(m).perfect,activityGain=gain(m,p,a.kind,perfect);p.kills++;
    if(perfect){const healing=Math.min(p.vulnerability,a.kind==='worm'?20:4);p.vulnerability=round(p.vulnerability-healing);event(m,'guard',{playerId:id,attackId:a.attackId,dir:a.dir,kind:a.kind,perfect,healing,activityGain});}
    else event(m,'guard',{playerId:id,attackId:a.attackId,dir:a.dir,kind:a.kind,perfect,activityGain});
    for(const worm of m.attacks.filter(x=>x.to===id&&x.dir===command.dir&&x.state==='dormant'))if(--worm.remaining<=0)wakeWorm(m,p,worm);
    releaseTrojan(m,p,a,true);updateWave(m);return{ok:true,guarded:true,perfect,activityGain};
  }
  function snapshot(m,at){advance(m,at);const pace=pacing(m);return{mode:m.mode,startAt:m.startAt,now:m.now,status:m.status,winnerId:m.winnerId,finishedAt:m.finishedAt,finishReason:m.finishReason,
    rules:{...RULES,guardWindowMs:pace.guard,perfectWindowMs:pace.perfect},speedPercent:round((pace.speed-1)*100),rechargeRate:0,nextBossAt:m.boss?null:m.nextBossAt,boss:m.boss?{...m.boss}:null,
    players:m.players.map(p=>({...p,amplificationQueue:[...queue(p)],lockedUntil:{...p.lockedUntil},lastGuardAt:undefined,boss:p.boss?Boss.snapshot(p.boss):null,upgrades:{},offer:null})),attacks:m.attacks.map(a=>({...a})),events:m.events.map(e=>({...e}))};}
  function forfeit(m,id,now){advance(m,now);const p=player(m,id);if(p&&!p.eliminated&&m.status!=='finished'){p.eliminated=true;finish(m);}return{ok:true};}
  return Object.freeze({RULES,ENEMIES,createMatch,advance,input,snapshot,forfeit});
});
