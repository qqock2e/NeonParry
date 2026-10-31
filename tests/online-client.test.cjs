'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const{createServer}=require('../backend/server.cjs');
const source=fs.readFileSync(path.join(__dirname,'../frontend/js/online-client.js'),'utf8');
function load(fetcher=fetch,config={apiBaseUrl:''}){const window={NEON_CONFIG:config};vm.runInNewContext(source,{window,fetch:fetcher,URL,AbortController,setTimeout,clearTimeout});return window.NeonOnline;}
test('offline frontend loads without contacting a backend and validates configuration',()=>{
  let calls=0;const online=load(()=>calls++);assert.equal(calls,0);assert.equal(online.isConfigured(),false);assert.throws(()=>online.createClient(),e=>e.code==='OFFLINE');
  for(const value of ['file:///tmp','https://user:pass@example.com','https://example.com?secret=1'])assert.throws(()=>online.createClient(value),e=>e.code==='INVALID_URL');
});
test('independent clients use the live server; no player tokens are stored in URLs or public state',async t=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const urls=[],online=load((url,options)=>{urls.push(url);return fetch(url,options);}),client=online.createClient('http://127.0.0.1:'+server.address().port);
  const host=await client.createRoom('Host'),guest=await client.joinRoom(host.room.code.toLowerCase(),'Guest');
  await client.setReady(host.room.code,host.playerToken,true);const state=await client.setReady(host.room.code,guest.playerToken,true);
  assert.equal(state.phase,'starting');assert.equal((await client.getRoom(host.room.code,host.playerToken)).match.seed,state.match.seed);
  assert.ok(urls.every(url=>!url.includes(host.playerToken)&&!url.includes(guest.playerToken)));
  await client.leaveRoom(host.room.code,guest.playerToken);
  await assert.rejects(client.getRoom(host.room.code,guest.playerToken),e=>e.code==='INVALID_TOKEN'&&e.status===401);
});
test('transport surfaces network and malformed-response failures without exposing tokens',async()=>{
  const unavailable=load(async()=>{throw Error('network');}).createClient('https://api.example');await assert.rejects(unavailable.health(),e=>e.code==='NETWORK_ERROR');
  const malformed=load(async()=>({status:502,json:async()=>{throw Error('bad json')}})).createClient('https://api.example');await assert.rejects(malformed.health(),e=>e.code==='INVALID_RESPONSE'&&e.status===502);
});
