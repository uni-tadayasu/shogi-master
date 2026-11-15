/* Integration smoke test: Node worker_threads adapter + real browser WASM.
   Tests legal engine output, settings, warm searches, supersession and stop.
   Reported milliseconds are observations on this runner, not speed promises.
   Run: node engine-vendor/test-engine.cjs */
const {Worker:NodeWorker,parentPort,workerData}=require('node:worker_threads');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{fileURLToPath,pathToFileURL}=require('node:url');
class BrowserWorker {
 constructor(url){this.w=new NodeWorker(__filename,{workerData:{url:String(url)}});this.w.on('message',data=>this.onmessage?.({data}));this.w.on('error',e=>this.onerror?.({message:e.message}));}
 postMessage(data){this.w.postMessage(data)}
 terminate(){return this.w.terminate()}
}
if(workerData){
 const url=workerData.url,ctx={console,URL,setTimeout,clearTimeout,performance,TextDecoder,TextEncoder,WebAssembly,Worker:BrowserWorker};
 ctx.self=ctx;ctx.location={href:url};ctx.postMessage=data=>parentPort.postMessage(data);
 ctx.fetch=async url=>new Response(fs.readFileSync(fileURLToPath(url)),{headers:{'Content-Type':'application/wasm'}});
 vm.createContext(ctx);
 ctx.importScripts=(...urls)=>{for(const u of urls)vm.runInContext(fs.readFileSync(fileURLToPath(new URL(u,url)),'utf8'),ctx,{filename:u})};
 parentPort.on('message',data=>ctx.onmessage?.({data}));
 vm.runInContext(fs.readFileSync(fileURLToPath(url),'utf8'),ctx,{filename:url});
}else (async()=>{
 const {initialState,toSFEN,moveFromUSI,applyMove}=await import('../shogi.js');
 const initial=initialState(),regressionMoves=['7g7f','3c3d','2g2f','8b5b','2f2e'];
 const url=pathToFileURL(require('node:path').join(__dirname,'engine-worker.js'));
 const w=new BrowserWorker(url),sfen=toSFEN(initial);
 let initialized=false,phase=0,readyCount=0;
 const sent=new Map(),info=new Map(),settings=new Map(),positions=new Map(),bootStarted=performance.now();
 const timeout=setTimeout(()=>{console.error('TIMEOUT');w.terminate();process.exit(1)},25000);
 function search(id,options={}){let position=initial;for(const usi of options.moves||[])position=applyMove(position,moveFromUSI(position,usi));positions.set(id,position);sent.set(id,performance.now());w.postMessage({type:'analyze',id,sfen,timeMs:1000,multiPV:1,hashMB:32,...options});}
 function report(d,label){const rows=info.get(d.id)||[];assert.ok(rows.length,'expected actual search output');assert.ok(moveFromUSI(positions.get(d.id),d.bestmove),'engine must return a legal move');console.log(label,JSON.stringify({id:d.id,bestmove:d.bestmove,wallMs:Math.round(performance.now()-sent.get(d.id)),engineMs:Math.max(...rows.map(x=>x.time||0)),depth:Math.max(...rows.map(x=>x.depth||0)),multiPV:Math.max(...rows.map(x=>x.multipv||1)),hashMB:settings.get(d.id)?.hashMB}));}
 w.onerror=e=>{console.error(e);process.exit(1)};
 w.onmessage=({data:d})=>{
  if(d.type==='error'){console.error('ENGINE ERROR',d);process.exit(1)}
  if(d.type==='configured')settings.set(d.id,d);
  if(d.type==='info'){const rows=info.get(d.id)||[];rows.push(d);info.set(d.id,rows);}
  if(d.type==='ready'){readyCount++;assert.ok(Number.isFinite(d.memoryBytes)&&d.memoryBytes>0&&d.memoryBytes<512*1024*1024,`startup heap ${d.memoryBytes} must avoid the native 1024MB allocation`);if(!initialized){initialized=true;console.log('READY',d.name,'startupMs',Math.round(performance.now()-bootStarted),'heapMB',Math.round(d.memoryBytes/1024/1024));search(1,{multiPV:3});}}
  if(d.type==='done'&&phase===0){assert.equal(d.id,1);report(d,'THREE_CANDIDATES');assert.ok(info.get(1).some(x=>x.multipv===3),'comparison mode must search three candidates');phase=1;search(2,{hashMB:128});}
  else if(d.type==='done'&&phase===1){assert.equal(d.id,2);report(d,'FOCUSED_ONE_SECOND');assert.equal(settings.get(2).hashMB,128);assert.equal(settings.get(2).multiPV,1);assert.ok(info.get(2).every(x=>x.multipv===1));phase=2;search(3,{hashMB:128});}
  else if(d.type==='done'&&phase===2){assert.equal(d.id,3);report(d,'WARM_ONE_SECOND');assert.equal(readyCount,1,'completed analyses must reuse the warm engine');assert.ok(info.get(3).every(x=>x.multipv===1));phase=3;search(4,{timeMs:10000,hashMB:128});setTimeout(()=>search(5,{initialSfen:sfen,moves:['7g7f'],timeMs:300,hashMB:64}),30);}
  else if(d.type==='done'&&phase===3){assert.equal(d.id,5,'superseded search must not complete');report(d,'SUPERSEDED_WITH_NEW_CONFIG');assert.equal(settings.get(5).hashMB,64);phase=4;search(6,{timeMs:10000,hashMB:64});setTimeout(()=>w.postMessage({type:'stop'}),50);}
  else if(d.type==='stopped'){assert.equal(phase,4);console.log('STOP',d);phase=5;search(7,{timeMs:200,hashMB:65536,multiPV:99});}
  else if(d.type==='done'&&phase===5){assert.equal(d.id,7,'stopped search must not complete');report(d,'RESTART_SAFE_CONFIG');assert.equal(settings.get(7).hashMB,32);assert.equal(settings.get(7).multiPV,1);phase=6;search(8,{initialSfen:sfen,moves:regressionMoves,hashMB:32});}
  else if(d.type==='done'&&phase===6){assert.equal(d.id,8);report(d,'FIVE_PLY_POSITION_HASH32');phase=7;search(9,{initialSfen:sfen,moves:regressionMoves,hashMB:64});}
  else if(d.type==='done'&&phase===7){assert.equal(d.id,9);report(d,'FIVE_PLY_POSITION_HASH64');clearTimeout(timeout);w.terminate();console.log('PASS');}
 };
 w.postMessage({type:'init'});
})().catch(error=>{console.error(error);process.exit(1)});
