'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const{setTimeout:delay}=require('node:timers/promises');
const{createServer}=require('../server.cjs');
const{RoomStore}=require('../rooms.cjs');
const{RULES}=require('../../frontend/js/duel-engine.js');

async function until(predicate){
  const deadline=Date.now()+2000;
  while(!predicate()){
    if(Date.now()>=deadline)throw Error('Timed out waiting for clash state.');
    await delay(4);
  }
}
async function fixture(t,options={}){
  let now=10000;
  const store=new RoomStore({now:()=>now,disconnectGraceMs:2000}),server=createServer({store,tickMs:5,...options});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port,streams=[];
  t.after(()=>{
    for(const stream of streams)stream.controller.abort();
    return new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
  });
  async function request(path,{method='GET',token,data,headers={}}={}){
    const response=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:data===undefined?undefined:JSON.stringify(data)});
    return{status:response.status,data:await response.json()};
  }
  const post=(path,data,token)=>request(path,{method:'POST',data,token});
  const roomPath=code=>'/api/v1/rooms/'+code;
  async function create(players,mode='clash'){
    const host=await post('/api/v1/rooms',{name:players[0],mode});assert.equal(host.status,201);
    const path=roomPath(host.data.room.code),members=[host.data];
    for(const name of players.slice(1)){
      const joined=await post(path+'/join',{name});assert.equal(joined.status,201);members.push(joined.data);
    }
    return{path,members,code:host.data.room.code};
  }
  async function ready(path,members){
    let state;
    for(const member of members){state=await post(path+'/ready',{ready:true},member.playerToken);assert.equal(state.status,200);}
    assert.equal(state.data.phase,'starting');return state.data;
  }
  async function stream(path,member){
    const controller=new AbortController(),states=[];
    const entry={controller,states,closed:false,error:null};streams.push(entry);
    const response=await fetch(base+path+'/battle',{headers:{Authorization:'Bearer '+member.playerToken},signal:controller.signal});
    assert.equal(response.status,200);
    (async()=>{
      let buffer='';const decoder=new TextDecoder();
      try{
        for await(const chunk of response.body){
          buffer+=decoder.decode(chunk,{stream:true});let split;
          while((split=buffer.indexOf('\n\n'))>=0){
            const frame=buffer.slice(0,split);buffer=buffer.slice(split+2);
            if(frame.startsWith('event: state\ndata: '))states.push(JSON.parse(frame.slice('event: state\ndata: '.length)));
          }
        }
      }catch(error){if(!controller.signal.aborted)entry.error=error;}
      finally{entry.closed=true;}
    })();
    await until(()=>states.length);return entry;
  }
  return{store,request,post,create,ready,stream,setTime:value=>{now=value;},advance:ms=>{now+=ms;}};
}

test('survival online uses the shared 1v1 engine, streams activity/OVF turns, and rematches',async t=>{
 const f=await fixture(t),{path,members,code}=await f.create(['One','Two'],'survival');
 const third=await f.post(path+'/join',{name:'Third'});assert.equal(third.status,409);
 await f.ready(path,members);const streams=await Promise.all(members.map(p=>f.stream(path,p)));f.setTime(13000);
 const room=f.store.get(code),p=room.battle.players[0],rival=room.battle.players[1];
 assert.equal(room.battle.mode,'survival');p.activity=30;p.energy=30;p.overflow=8;
 const use=await f.post(path+'/input',{type:'attack',dir:'up',seq:1,matchId:room.match.id},members[0].playerToken);
 assert.equal(use.status,200);assert.equal(use.data.spent,18);assert.deepEqual(use.data.state.battle.players[1].amplificationQueue,[18]);assert.equal(use.data.state.battle.players[0].overflow,0);
 await until(()=>streams[1].states.some(s=>s.battle.players[1].amplification===18));
 const rejected=await f.post(path+'/input',{type:'upgrade',seq:2,offerId:'x',choiceId:'y'},members[0].playerToken);assert.equal(rejected.status,400);
 f.setTime(14200);const state=await f.request(path+'/battle/state',{token:members[0].playerToken});assert.equal(state.status,200);
 const threats=state.data.battle.attacks;assert.equal(threats.length,2);assert.equal(threats[0].dir,threats[1].dir);assert.equal(threats[0].impactAt,threats[1].impactAt);
 f.store.forfeit(code,members[0].playerToken);await f.ready(path,members);assert.equal(room.battle.mode,'survival');assert.equal(room.battle.players[0].activity,0);
});
test('survival random matchmaking is paired separately and uses epoch clocks without catch-up loops',async t=>{
 const f=await fixture(t);f.setTime(1794000000000);
 const one=await f.post('/api/v1/matchmaking',{name:'One',mode:'survival'});assert.equal(one.status,201);assert.equal(one.data.status,'waiting');
 const two=await f.post('/api/v1/matchmaking',{name:'Two',mode:'survival'});assert.equal(two.status,201);assert.equal(two.data.room.match.mode,'survival');
 const room=f.store.get(two.data.room.code);assert.ok(room.battle.now>=1794000000000);assert.equal(room.maxPlayers,2);
});
