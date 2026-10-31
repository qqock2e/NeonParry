'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const{createServer,parseOrigins}=require('../server.cjs');
const{RoomStore}=require('../rooms.cjs');
async function fixture(t,options={}){
  const server=createServer({origins:new Set(['https://game.example']),...options});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base='http://127.0.0.1:'+server.address().port;
  async function request(path,{method='GET',body,token,origin='https://game.example',headers={}}={}){
    const response=await fetch(base+path,{method,headers:{Origin:origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
    const data=response.status===204?null:await response.json();return{response,data};
  }
  return{request,base};
}
test('standalone service health, exact CORS origins, preflight and no frontend file serving',async t=>{
  const{request}=await fixture(t);
  const health=await request('/health');assert.equal(health.response.status,200);assert.equal(health.data.apiVersion,1);assert.equal(health.response.headers.get('Access-Control-Allow-Origin'),'https://game.example');
  assert.equal((await request('/health',{origin:'https://evil.example'})).response.status,403);
  assert.equal((await request('/api/v1/rooms',{method:'OPTIONS'})).response.status,204);
  assert.equal((await request('/../package.json')).response.status,404);assert.equal((await request('/')).response.status,404);
  assert.throws(()=>parseOrigins('*'));assert.throws(()=>parseOrigins('https://game.example/path'));
});
test('two players join, independently ready and receive the same server-issued start/seed',async t=>{
  let now=10000;const store=new RoomStore({now:()=>now});const{request}=await fixture(t,{store});
  const host=(await request('/api/v1/rooms',{method:'POST',body:{name:'호스트'}})).data;
  const path='/api/v1/rooms/'+host.room.code;
  const guest=(await request(path+'/join',{method:'POST',body:{name:'Guest'}})).data;
  assert.notEqual(host.playerToken,guest.playerToken);assert.equal(guest.room.players.length,2);
  const first=await request(path+'/ready',{method:'POST',token:host.playerToken,body:{ready:true}});assert.equal(first.data.phase,'waiting');
  const second=await request(path+'/ready',{method:'POST',token:guest.playerToken,body:{ready:true}});assert.equal(second.data.phase,'starting');assert.equal(second.data.match.startAt,13000);
  const shared=(await request(path,{token:host.playerToken})).data;assert.deepEqual(shared.match,second.data.match);
  assert.ok(!JSON.stringify(shared).includes('token'));assert.equal(shared.players[0].name,'호스트');
  now=13000;assert.equal((await request(path,{token:guest.playerToken})).data.phase,'playing');
  assert.equal((await request(path+'/ready',{method:'POST',token:host.playerToken,body:{ready:false}})).response.status,409);
  const left=await request(path,{method:'DELETE',token:host.playerToken});assert.equal(left.data.room.phase,'waiting');assert.equal(left.data.room.match,null);
  assert.equal((await request(path,{token:host.playerToken})).response.status,401);
  assert.equal((await request(path,{method:'DELETE',token:guest.playerToken})).data.closed,true);
  assert.equal((await request(path,{token:guest.playerToken})).response.status,404);
});
test('membership is private, cross-room tokens fail, only two participants can join',async t=>{
  const{request}=await fixture(t);
  const host=(await request('/api/v1/rooms',{method:'POST',body:{}})).data;
  const other=(await request('/api/v1/rooms',{method:'POST',body:{}})).data;
  const path='/api/v1/rooms/'+host.room.code;
  assert.equal((await request(path)).response.status,401);assert.equal((await request(path,{token:other.playerToken})).response.status,401);
  const joins=await Promise.all([request(path+'/join',{method:'POST',body:{name:'A'}}),request(path+'/join',{method:'POST',body:{name:'B'}})]);
  assert.deepEqual(joins.map(j=>j.response.status).sort(),[201,409]);
});
test('invalid/oversized input, invalid ready flags and rate limits return stable errors',async t=>{
  const{request}=await fixture(t);
  assert.equal((await request('/api/v1/rooms',{method:'POST',body:{name:'x'.repeat(25)}})).data.error.code,'INVALID_NAME');
  assert.equal((await request('/api/v1/rooms',{method:'POST',body:{name:'x'.repeat(3000)}})).response.status,413);
  assert.equal((await request('/api/v1/rooms',{method:'POST',body:{},headers:{'Content-Type':'text/plain'}})).response.status,415);
  const host=(await request('/api/v1/rooms',{method:'POST',body:{}})).data;
  assert.equal((await request('/api/v1/rooms/'+host.room.code+'/ready',{method:'POST',token:host.playerToken,body:{ready:'yes'}})).response.status,400);
  const limited=await fixture(t,{rateLimit:1});await limited.request('/api/v1/rooms',{method:'POST',body:{}});
  const denied=await limited.request('/api/v1/rooms',{method:'POST',body:{}});assert.equal(denied.response.status,429);assert.ok(denied.response.headers.get('Retry-After'));
});
test('idle room expiry and global capacity bound memory',()=>{
  let now=0;const store=new RoomStore({now:()=>now,ttlMs:100,maxRooms:1});const host=store.create('A');
  assert.throws(()=>store.create('B'),e=>e.status===503);now=99;store.status(host.room.code,host.playerToken);now=198;assert.equal(store.status(host.room.code,host.playerToken).players.length,1);
  now=298;assert.throws(()=>store.status(host.room.code,host.playerToken),e=>e.status===404);assert.equal(store.rooms.size,0);assert.ok(store.create('B'));
});
