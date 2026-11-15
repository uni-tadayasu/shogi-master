/* 将棋名人 async broker. Copyright (C) 2026. GPL-3.0-or-later.
 * The synchronous WASM search runs in a replaceable nested Worker. This broker
 * remains responsive to cancellation, including while the engine is searching.
 */
'use strict';
let core=null, generation=0, ready=false, busy=false, pending=null, activeId=null;
const emit=message => self.postMessage(message);
function startCore() {
  if (core) core.terminate();
  const token=++generation;
  ready=false; busy=false; activeId=null;
  try {
    core=new Worker(new URL('./core-worker.js',self.location.href));
    core.onmessage=({data})=>{
      if (token !== generation) return;
      if (data.type==='ready') {
        ready=true;
        emit(data);
        sendPending();
      } else if (data.type==='info' || data.type==='done') {
        if (data.id !== activeId) return;
        emit(data);
        if (data.type==='done') { busy=false; activeId=null; sendPending(); }
      } else if (data.type==='error') {
        busy=false; activeId=null;
        if (!ready) { core.terminate(); core=null; generation++; pending=null; }
        emit(data);
      }
    };
    core.onerror=event=>{
      if (token !== generation) return;
      const failedId=activeId;
      core.terminate(); core=null; generation++;
      ready=false; busy=false; activeId=null; pending=null;
      emit({type:'error',id:failedId,message:event.message || '将棋エンジンを開始できませんでした。'});
    };
  } catch(error) { core=null; emit({type:'error',message:String(error.message || error)}); }
}
function sendPending() {
  if (!ready || busy || !pending || !core) return;
  const request=pending; pending=null;
  busy=true; activeId=request.id;
  core.postMessage(request);
}
self.onmessage=({data})=>{
  if (!data || typeof data!=='object') return;
  if (data.type==='init') {
    if (!core) startCore();
  } else if (data.type==='analyze') {
    pending=data;
    if (!core || busy) startCore();
    sendPending();
  } else if (data.type==='stop') {
    const stoppedId=activeId;
    pending=null;
    if (core) core.terminate();
    core=null; generation++; ready=false; busy=false; activeId=null;
    emit({type:'stopped',id:stoppedId});
  }
};
