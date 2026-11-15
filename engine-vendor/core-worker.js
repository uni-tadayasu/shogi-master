/* 将棋名人 engine bridge. Copyright (C) 2026. GPL-3.0-or-later. */
'use strict';
importScripts('./yaneuraou.k-p.js');
let engine = null;
let currentId = null;
let engineName = 'YaneuraOu NNUE KP256';
let currentHashMB = 32;
let stage = 'initialization';
const diagnostics = [];
const emit = (message) => self.postMessage(message);
function diagnostic(raw,source='stderr') {
  const message=String(raw).trim().slice(0,600);if(!message)return;
  diagnostics.push({source,message});if(diagnostics.length>12)diagnostics.shift();
  emit({type:'diagnostic',id:currentId,source,message});
}
function reportError(error) {
  const message=String(error?.message||error);
  const details=diagnostics.map(d=>`${d.source}: ${d.message}`).join('\n');
  engine=null;
  emit({type:'error',id:currentId,stage,message:`${message} [${stage}]${details?'\n'+details:''}`,diagnostics:[...diagnostics]});
}
function lineReceived(raw) {
  const line = String(raw).trim();
  if(line.startsWith('info string ')||/error|failed|assertion|exception/i.test(line))diagnostic(line,'stdout');
  if (line.startsWith('id name ')) engineName = line.slice(8);
  if (line.startsWith('bestmove ')) {
    const parts = line.split(/\s+/);
    emit({type:'done', id:currentId, bestmove:parts[1], ponder:parts[2] === 'ponder' ? parts[3] : null});
    return;
  }
  if (!line.startsWith('info ') || !line.includes(' pv ')) return;
  const fields = line.split(/\s+/);
  const value = (key) => { const i=fields.indexOf(key); return i >= 0 ? fields[i+1] : undefined; };
  const number = (key) => { const v=Number(value(key)); return Number.isFinite(v) ? v : undefined; };
  const scoreAt = fields.indexOf('score');
  if (scoreAt < 0) return;
  let score;
  if (fields[scoreAt+1] === 'cp') score={cp:Number(fields[scoreAt+2])};
  else if (fields[scoreAt+1] === 'mate') {
    const rawMate=fields[scoreAt+2];
    score={mate:rawMate==='+' ? 999 : rawMate==='-' ? -999 : Number(rawMate)};
  } else return;
  if (fields.includes('lowerbound')) score.bound='lowerbound';
  if (fields.includes('upperbound')) score.bound='upperbound';
  emit({type:'info',id:currentId,depth:number('depth'),seldepth:number('seldepth'),nodes:number('nodes'),nps:number('nps'),time:number('time'),multipv:number('multipv') || 1,score,pv:fields.slice(fields.indexOf('pv')+1)});
}
async function init() {
  engine = await YaneuraOu_K_P({locateFile: name => new URL(name,self.location.href).href, printErr: line => diagnostic(line)});
  engine.addMessageListener(lineReceived);
  for (const command of [
    // Threads invokes resize_threads(), which also allocates the current hash.
    // Set hash first so the native default (1024MB) is never allocated.
    'usi', 'setoption name USI_Hash value 32', 'setoption name Threads value 1',
    'setoption name USI_Ponder value false', 'setoption name USI_OwnBook value false',
    'setoption name BookFile value no_book', 'setoption name MultiPV value 3',
    'setoption name PvInterval value 150', 'setoption name MinimumThinkingTime value 1',
    'setoption name NetworkDelay value 0', 'setoption name NetworkDelay2 value 0',
    'setoption name RoundUpToFullSecond value false', 'setoption name EnteringKingRule value CSARule27',
    'isready', 'usinewgame'
  ]) {stage='initialization: '+command;engine.postMessage(command);}
  emit({type:'ready',name:engineName,evaluation:'SuishoPetite 2021-11',threads:1,memoryBytes:engine.HEAPU8.buffer.byteLength});
}
const ready = init().catch(reportError);
self.onmessage = async ({data}) => {
  if (data.type !== 'analyze') return;
  await ready;
  if (!engine) return;
  try {
    currentId=data.id;
    stage='validation';
    const sfen=String(data.initialSfen || data.sfen || '').trim();
    if (!sfen || /[\r\n]/.test(sfen)) throw new Error('局面 SFEN が不正です。');
    const moves=Array.isArray(data.moves) ? data.moves : [];
    if (!moves.every(move => /^(?:[1-9][a-i][1-9][a-i]\+?|[PLNSGBR]\*[1-9][a-i])$/.test(move))) throw new Error('棋譜の指し手が不正です。');
    // Validate again at the worker boundary: callers can include imported or
    // older settings. Do not let a stale setting allocate arbitrary memory.
    const multiPV=[1,3].includes(Number(data.multiPV)) ? Number(data.multiPV) : 1;
    const hashMB=[32,64,128].includes(Number(data.hashMB)) ? Number(data.hashMB) : 32;
    const suppliedTime=Number(data.timeMs);
    const timeMs=Math.max(100,Math.min(60000,Math.round(data.timeMs!==null&&data.timeMs!==undefined&&data.timeMs!==''&&Number.isFinite(suppliedTime)?suppliedTime:1000)));
    stage='configuration';
    if (hashMB !== currentHashMB) {
      engine.postMessage('setoption name USI_Hash value '+hashMB);
      currentHashMB=hashMB;
    }
    engine.postMessage('setoption name MultiPV value '+multiPV);
    emit({type:'configured',id:currentId,timeMs,multiPV,hashMB,threads:1});
    stage='position';
    engine.postMessage('position sfen '+sfen+(moves.length ? ' moves '+moves.join(' ') : ''));
    stage='search';
    engine.postMessage('go movetime '+timeMs);
    stage='idle';
  } catch(error) { reportError(error); }
};
