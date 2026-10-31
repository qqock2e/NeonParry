'use strict';
const http=require('node:http');
const{RoomStore,ApiError}=require('./rooms.cjs');
const DEFAULT_ORIGINS=['http://localhost:8000','http://127.0.0.1:8000','https://qqock2e.github.io'];
function parseOrigins(text){
  const values=text===undefined?DEFAULT_ORIGINS:text.split(',').map(s=>s.trim()).filter(Boolean);
  for(const origin of values){let url;try{url=new URL(origin);}catch{throw Error('Invalid ALLOWED_ORIGINS origin.');}if(!['http:','https:'].includes(url.protocol)||url.origin!==origin)throw Error('ALLOWED_ORIGINS must contain exact HTTP(S) origins without paths.');}
  return new Set(values);
}
function createServer({store=new RoomStore(),origins=parseOrigins(process.env.ALLOWED_ORIGINS),rateLimit=300}={}){
  const buckets=new Map();
  const server=http.createServer(async(req,res)=>{
    const json=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
    res.setHeader('Vary','Origin');
    try{
      const origin=req.headers.origin;
      if(origin&&!origins.has(origin))throw new ApiError(403,'ORIGIN_DENIED','Origin is not allowed.');
      if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
      if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'600'});res.end();return;}
      const url=new URL(req.url,'http://service.local');
      if(req.method==='GET'&&url.pathname==='/health'){json(200,{status:'ok',apiVersion:1,storage:'memory'});return;}
      const ip=req.socket.remoteAddress||'unknown',now=Date.now();
      for(const [key,b]of buckets)if(now>=b.resetAt)buckets.delete(key);
      const bucket=buckets.get(ip)||{count:0,resetAt:now+60000};bucket.count++;buckets.set(ip,bucket);
      if(bucket.count>rateLimit){res.setHeader('Retry-After',Math.ceil((bucket.resetAt-now)/1000));throw new ApiError(429,'RATE_LIMITED','Too many requests.');}
      const body=async()=>{
        if(!((req.headers['content-type']||'').split(';')[0].trim().toLowerCase()==='application/json'))throw new ApiError(415,'JSON_REQUIRED','Use application/json.');
        const chunks=[];let size=0;
        for await(const chunk of req.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>2048){req.resume();throw new ApiError(413,'BODY_TOO_LARGE','Request body exceeds 2 KiB.');}chunks.push(chunk);}
        const text=Buffer.concat(chunks).toString('utf8');
        let data;try{data=JSON.parse(text);}catch{throw new ApiError(400,'INVALID_JSON','Invalid JSON body.');}
        if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiError(400,'INVALID_BODY','Expected an object.');return data;
      };
      const name=data=>{const value=data.name===undefined?'Player':data.name;if(typeof value!=='string'||!value.trim()||value.trim().length>24||/[\u0000-\u001f\u007f]/.test(value))throw new ApiError(400,'INVALID_NAME','Name must be 1–24 characters without control characters.');return value.trim();};
      if(req.method==='POST'&&url.pathname==='/api/v1/rooms'){json(201,store.create(name(await body())));return;}
      const route=url.pathname.match(/^\/api\/v1\/rooms\/([A-Z2-9]{6})(?:\/(join|ready))?$/);
      if(!route)throw new ApiError(404,'NOT_FOUND','Unknown endpoint.');
      const[,code,action]=route;
      if(req.method==='POST'&&action==='join'){json(201,store.join(code,name(await body())));return;}
      const match=(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9_-]{43})$/);
      if(!match)throw new ApiError(401,'TOKEN_REQUIRED','A room player token is required.');
      const token=match[1];
      if(req.method==='GET'&&!action){json(200,store.status(code,token));return;}
      if(req.method==='DELETE'&&!action){json(200,store.leave(code,token));return;}
      if(req.method==='POST'&&action==='ready'){const data=await body();if(typeof data.ready!=='boolean')throw new ApiError(400,'INVALID_READY','Ready must be a boolean.');json(200,store.ready(code,token,data.ready));return;}
      throw new ApiError(405,'METHOD_NOT_ALLOWED','Method not allowed.');
    }catch(error){
      if(error instanceof ApiError)json(error.status,{error:{code:error.code,message:error.message}});
      else{console.error('[backend] request failed');if(!res.headersSent)json(500,{error:{code:'INTERNAL_ERROR',message:'Internal server error.'}});else res.end();}
    }
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=32;
  const timer=setInterval(()=>store.prune(),60000);timer.unref();server.once('close',()=>clearInterval(timer));
  return server;
}
if(require.main===module){
  const port=Number(process.env.PORT||8080);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT.');
  const server=createServer();server.listen(port,process.env.HOST||'0.0.0.0',()=>console.log(`Neon Parry backend listening on ${port}`));
  let stopping=false;for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{if(stopping)return;stopping=true;server.close(()=>process.exit(0));setTimeout(()=>{server.closeAllConnections();process.exit(1);},10000).unref();});
}
module.exports={createServer,parseOrigins};
