'use strict';
const {randomBytes,randomInt,timingSafeEqual}=require('node:crypto');
const {createHash}=require('node:crypto');
class ApiError extends Error{
  constructor(status,code,message){super(message);this.status=status;this.code=code;}
}
const digest=token=>createHash('sha256').update(token).digest();
function player(name){return{id:randomBytes(12).toString('hex'),name,ready:false,token:randomBytes(32).toString('base64url')};}
class RoomStore{
  constructor({now=Date.now,ttlMs=15*60*1000,maxRooms=1000}={}){this.rooms=new Map();this.now=now;this.ttlMs=ttlMs;this.maxRooms=maxRooms;}
  prune(){const now=this.now();for(const [code,room]of this.rooms)if(now-room.touchedAt>=this.ttlMs)this.rooms.delete(code);}
  get(code){this.prune();const room=this.rooms.get(code);if(!room)throw new ApiError(404,'ROOM_NOT_FOUND','Room not found or expired.');return room;}
  snapshot(room){
    const now=this.now();if(room.phase==='starting'&&now>=room.match.startAt){room.phase='playing';room.revision++;}
    return{code:room.code,hostId:room.players[0].id,phase:room.phase,revision:room.revision,players:room.players.map(({id,name,ready})=>({id,name,ready})),match:room.match?{...room.match}:null,serverTime:now};
  }
  attach(room,name){const entry=player(name),token=entry.token;delete entry.token;entry.tokenHash=digest(token);room.players.push(entry);room.touchedAt=this.now();room.revision++;return{room:this.snapshot(room),playerId:entry.id,playerToken:token};}
  create(name){
    this.prune();if(this.rooms.size>=this.maxRooms)throw new ApiError(503,'ROOM_CAPACITY','Room capacity reached.');
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code;
    do{code=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');}while(this.rooms.has(code));
    const room={code,players:[],phase:'waiting',match:null,revision:0,touchedAt:this.now()};this.rooms.set(code,room);return this.attach(room,name);
  }
  join(code,name){const room=this.get(code);if(room.players.length>=2||room.phase!=='waiting')throw new ApiError(409,'ROOM_FULL','Room is full or already starting.');return this.attach(room,name);}
  authorize(code,token){const room=this.get(code),hash=digest(token),entry=room.players.find(p=>timingSafeEqual(p.tokenHash,hash));if(!entry)throw new ApiError(401,'INVALID_TOKEN','Invalid room membership.');room.touchedAt=this.now();return{room,entry};}
  status(code,token){return this.snapshot(this.authorize(code,token).room);}
  ready(code,token,ready){
    const{room,entry}=this.authorize(code,token);this.snapshot(room);if(room.phase!=='waiting')throw new ApiError(409,'MATCH_STARTED','Leave the room to cancel this match.');
    if(entry.ready!==ready){entry.ready=ready;room.revision++;}
    if(room.players.length===2&&room.players.every(p=>p.ready)){room.phase='starting';room.match={id:randomBytes(16).toString('hex'),seed:randomBytes(4).readUInt32BE(),startAt:this.now()+3000};room.revision++;}
    return this.snapshot(room);
  }
  leave(code,token){const{room,entry}=this.authorize(code,token);room.players=room.players.filter(p=>p!==entry);if(!room.players.length){this.rooms.delete(code);return{closed:true};}room.match=null;room.phase='waiting';for(const p of room.players)p.ready=false;room.revision++;return{closed:false,room:this.snapshot(room)};}
}
module.exports={RoomStore,ApiError};
