'use strict';
// Optional lobby transport. Loading this file never makes network requests.
// Tokens stay with the caller; nothing is persisted or added to URLs.
(() => {
  class OnlineError extends Error {
    constructor(message,code,status=0){super(message);this.name='OnlineError';this.code=code;this.status=status;}
  }
  function createClient(baseUrl=window.NEON_CONFIG?.apiBaseUrl){
    if(!baseUrl)throw new OnlineError('Backend URL is not configured.','OFFLINE');
    let base;try{base=new URL(baseUrl);}catch{throw new OnlineError('Invalid backend URL.','INVALID_URL');}
    if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)throw new OnlineError('Use an HTTP(S) backend URL without credentials or query.','INVALID_URL');
    const prefix=base.href.replace(/\/$/,'');
    async function request(path,{method='GET',data,token}={}){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
      try{
        const headers={};if(data!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization=`Bearer ${token}`;
        const response=await fetch(prefix+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data),signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'error'});
        let body;try{body=await response.json();}catch{throw new OnlineError('Invalid backend response.','INVALID_RESPONSE',response.status);}
        if(!response.ok)throw new OnlineError(body.error?.message||'Backend request failed.',body.error?.code||'HTTP_ERROR',response.status);
        return body;
      }catch(error){
        if(error instanceof OnlineError)throw error;
        throw new OnlineError(controller.signal.aborted?'Backend request timed out.':'Backend is unreachable.',controller.signal.aborted?'TIMEOUT':'NETWORK_ERROR');
      }finally{clearTimeout(timer);}
    }
    function roomPath(code){if(typeof code!=='string'||!/^([A-Z2-9]){6}$/.test(code.toUpperCase()))throw new OnlineError('Invalid room code.','INVALID_ROOM_CODE');return'/api/v1/rooms/'+code.toUpperCase();}
    return Object.freeze({
      health:()=>request('/health'),
      createRoom:(name='Player')=>request('/api/v1/rooms',{method:'POST',data:{name}}),
      joinRoom:(code,name='Player')=>request(roomPath(code)+'/join',{method:'POST',data:{name}}),
      getRoom:(code,token)=>request(roomPath(code),{token}),
      setReady:(code,token,ready)=>request(roomPath(code)+'/ready',{method:'POST',data:{ready},token}),
      leaveRoom:(code,token)=>request(roomPath(code),{method:'DELETE',token})
    });
  }
  window.NeonOnline=Object.freeze({createClient,OnlineError,isConfigured:()=>!!window.NEON_CONFIG?.apiBaseUrl});
})();
