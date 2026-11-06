'use strict';
// Extra import verification for the upcoming PvE redesign; game rules are unchanged.
const test=require('node:test'),assert=require('node:assert/strict');
const Engine=require('../frontend/js/duel-engine.js');
test('PvE shared engine completes both boss types and resumes normal combat after each',()=>{
  const match=Engine.createMatch({players:['you','cpu'],startAt:0,seed:995,mode:'clash'});
  const seen=[];
  for(let cycle=0;cycle<2;cycle++){
    const start=match.nextBossAt;Engine.advance(match,start);seen.push(match.boss.kind);
    for(let at=start;at<start+60000&&match.boss;at+=25){
      Engine.advance(match,at);
      for(const player of match.players){
        if(!match.boss)break;
        const fight=player.boss;
        if(fight.phase==='reaction')Engine.input(match,player.id,{type:'guard',dir:fight.sequence[fight.sequenceIndex]},at);
        else if(fight.phase==='active'){
          const incoming=fight.attacks.find(a=>Math.abs(a.impactAt-at)<=15);
          if(incoming)Engine.input(match,player.id,{type:'guard',dir:incoming.dir},at);
        }
      }
    }
    assert.equal(match.boss,null);assert.equal(match.status,'running');
    assert.ok(match.players.every(p=>!p.eliminated&&p.boss===null));
    assert.equal(match.nextBossAt,match.now+Engine.RULES.bossIntervalMs);
  }
  assert.deepEqual(seen,['domain','destroy']);
  assert.equal(Engine.input(match,'you',{type:'attack',dir:'up'},match.now).ok,true);
});
