/* 将棋名人 engine bridge. Copyright (C) 2026. GPL-3.0-or-later. */
'use strict';
importScripts('./yaneuraou.k-p.js');
let engine = null;
let currentId = null;
let engineName = 'YaneuraOu NNUE KP256';
const emit = (message) => self.postMessage(message);
function lineReceived(raw) {
  const line = String(raw).trim();
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
  engine = await YaneuraOu_K_P({locateFile: name => new URL(name,self.location.href).href, printErr: line => emit({type:'diagnostic',message:String(line)})});
  engine.addMessageListener(lineReceived);
  for (const command of [
    'usi', 'setoption name Threads value 1', 'setoption name USI_Hash value 32',
    'setoption name USI_Ponder value false', 'setoption name USI_OwnBook value false',
    'setoption name BookFile value no_book', 'setoption name MultiPV value 3',
    'setoption name PvInterval value 150', 'setoption name MinimumThinkingTime value 1',
    'setoption name NetworkDelay value 0', 'setoption name NetworkDelay2 value 0',
    'setoption name RoundUpToFullSecond value false', 'setoption name EnteringKingRule value CSARule27',
    'isready', 'usinewgame'
  ]) engine.postMessage(command);
  emit({type:'ready',name:engineName,evaluation:'SuishoPetite 2021-11',threads:1});
}
const ready = init().catch(error => emit({type:'error',message:String(error.message || error)}));
self.onmessage = async ({data}) => {
  if (data.type !== 'analyze') return;
  await ready;
  if (!engine) return;
  try {
    currentId=data.id;
    const sfen=String(data.initialSfen || data.sfen || '').trim();
    if (!sfen || /[\r\n]/.test(sfen)) throw new Error('局面 SFEN が不正です。');
    const moves=Array.isArray(data.moves) ? data.moves : [];
    if (!moves.every(move => /^(?:[1-9][a-i][1-9][a-i]\+?|[PLNSGBR]\*[1-9][a-i])$/.test(move))) throw new Error('棋譜の指し手が不正です。');
    const multiPV=Math.max(1,Math.min(5,Math.round(Number(data.multiPV)||3)));
    const timeMs=Math.max(100,Math.min(60000,Math.round(Number(data.timeMs)||1500)));
    engine.postMessage('setoption name MultiPV value '+multiPV);
    engine.postMessage('position sfen '+sfen+(moves.length ? ' moves '+moves.join(' ') : ''));
    engine.postMessage('go movetime '+timeMs);
  } catch(error) { emit({type:'error',id:currentId,message:String(error.message || error)}); }
};
