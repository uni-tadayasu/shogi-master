/**
 * 将棋名人｜Shogi Master record helpers.
 * Copyright (C) 2026 KASAI SOLUTIONS INC. GPL-3.0-or-later.
 * A record keeps the complete line plus a separate display cursor, so rewinding
 * never destroys the moves needed by redo or a saved-session restore.
 */
import {initialState,fromSFEN,toSFEN,moveToUSI,moveFromUSI,applyMove} from './shogi.js';

const MAX_MOVES=20000;
function boundedCursor(value,length){
 if(value===undefined)return length;
 if(!Number.isSafeInteger(value))throw Error('表示する手数は整数で指定してください。');
 return Math.max(0,Math.min(length,value));
}
function validateLine(states,moves){
 if(!Array.isArray(states)||!Array.isArray(moves)||states.length!==moves.length+1||!states[0])throw Error('局面と棋譜の数が一致していません。');
}
function splitPosition(raw){
 const parts=raw.replace(/^position\s+/,'').split(/\s+/);
 let initial;
 if(parts[0]==='startpos'){initial=initialState();parts.shift();}
 else{if(parts[0]==='sfen')parts.shift();initial=fromSFEN(parts.splice(0,4).join(' '));}
 if(parts.length&&parts.shift()!=='moves')throw Error('USI局面の指し手には moves を指定してください。');
 return {initial,mv:parts};
}

/** Accept SFEN, USI `position`, or version 1/2 JSON; validate every actual move. */
export function decodeGame(data){
 let initial,mv,cursor;
 if(typeof data==='string'){
  const raw=data.trim();
  if(raw.startsWith('{'))return decodeGame(JSON.parse(raw));
  ({initial,mv}=splitPosition(raw));
 }else{
  if(!data||Array.isArray(data)||typeof data.initialSfen!=='string'||!Array.isArray(data.moves))throw Error('棋譜データの形式が違います。');
  initial=fromSFEN(data.initialSfen);mv=data.moves;cursor=data.cursor;
 }
 if(mv.length>MAX_MOVES)throw Error(`棋譜は${MAX_MOVES}手以内にしてください。`);
 const nextStates=[initial],nextMoves=[];
 for(const usi of mv){
  if(typeof usi!=='string')throw Error('指し手が文字列ではありません。');
  const move=moveFromUSI(nextStates.at(-1),usi);
  if(!move)throw Error(`${nextMoves.length+1}手目「${usi}」が合法手ではありません。`);
  nextMoves.push(move);nextStates.push(applyMove(nextStates.at(-1),move));
 }
 return {states:nextStates,moves:nextMoves,cursor:boundedCursor(cursor,nextMoves.length)};
}

/** Export the full line, even when the displayed position is in its middle. */
export function makeRecord(states,moves,cursor){
 validateLine(states,moves);
 const position=boundedCursor(cursor,moves.length);
 return {version:2,site:'将棋名人｜Shogi Master',initialSfen:toSFEN(states[0]),moves:moves.map(moveToUSI),cursor:position,sfen:toSFEN(states[position])};
}

/** Apply a legal move to the display cursor; return a restorable former line. */
export function appendMove(states,moves,cursor,move){
 validateLine(states,moves);
 const position=boundedCursor(cursor,moves.length);
 let usi;
 try{usi=typeof move==='string'?move:moveToUSI(move);}catch{throw Error('指し手の形式が正しくありません。');}
 const verified=moveFromUSI(states[position],usi);
 if(!verified)throw Error('この局面では指せない手です。');
 const archived=position<moves.length?makeRecord(states,moves,moves.length):null;
 const nextMoves=moves.slice(0,position);nextMoves.push(verified);
 const nextStates=states.slice(0,position+1);nextStates.push(applyMove(states[position],verified));
 return {states:nextStates,moves:nextMoves,cursor:position+1,archived};
}

/** Undo one ply in study, or an AI reply + human move when back at human turn. */
export function previousCursor(states,cursor,mode,side){
 if(!Array.isArray(states)||!states.length)throw Error('局面履歴がありません。');
 const position=boundedCursor(cursor,states.length-1);
 const count=mode==='play'&&position>1&&states[position].turn===side?2:1;
 return Math.max(0,position-count);
}
