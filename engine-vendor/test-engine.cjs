/* Integration smoke test: Node worker_threads adapter + real browser WASM.
   This verifies engine/protocol/cancellation, not real-browser rendering.
   Run: node engine-vendor/test-engine.cjs */
const {Worker:NodeWorker,parentPort,workerData}=require('node:worker_threads');
const fs=require('node:fs'),vm=require('node:vm'),{fileURLToPath,pathToFileURL}=require('node:url');
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
}else{
 const url=pathToFileURL(require('node:path').join(__dirname,'engine-worker.js'));
 const w=new BrowserWorker(url);
 const sfen='lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';
 let initialized=false,phase=0,infos=0;
 const timeout=setTimeout(()=>{console.error('TIMEOUT');w.terminate();process.exit(1)},15000);
 w.onerror=e=>{console.error(e);process.exit(1)};
 w.onmessage=({data:d})=>{
  if(d.type==='error'){console.error('ENGINE ERROR',d);process.exit(1)}
  if(d.type==='info')infos++;
  if(d.type==='ready'&&!initialized){initialized=true;console.log('READY',d.name);w.postMessage({type:'analyze',id:1,sfen,timeMs:1000,multiPV:3});}
  if(d.type==='done'&&phase===0){console.log('SEARCH',JSON.stringify(d),'info count',infos);phase=1;w.postMessage({type:'analyze',id:2,sfen,timeMs:10000});setTimeout(()=>w.postMessage({type:'analyze',id:3,initialSfen:sfen,moves:['7g7f'],timeMs:300}),30);}
  else if(d.type==='done'&&phase===1){if(d.id!==3)throw Error('Stale result');console.log('SUPERSEDED',d);phase=2;w.postMessage({type:'analyze',id:4,sfen,timeMs:10000});setTimeout(()=>w.postMessage({type:'stop'}),50)}
  else if(d.type==='stopped'){console.log('STOP',d);w.postMessage({type:'analyze',id:5,sfen,timeMs:200});}
  else if(d.type==='done'&&phase===2){if(d.id!==5)throw Error('Stale stop result');console.log('RESTART',d);clearTimeout(timeout);w.terminate();console.log('PASS');}
 };
 w.postMessage({type:'init'});
}
