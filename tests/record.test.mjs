import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,toSFEN,moveToUSI,moveFromUSI} from '../shogi.js';
import {decodeGame,makeRecord,appendMove,previousCursor} from '../game-record.js';
const line=()=>decodeGame('position startpos moves 7g7f 3c3d 2g2f 8c8d');

test('rewound records retain all future moves and restore the display cursor',()=>{
 const game=line(),record=makeRecord(game.states,game.moves,1),restored=decodeGame(JSON.stringify(record));
 assert.equal(record.version,2);assert.equal(record.moves.length,4);assert.equal(record.cursor,1);
 assert.equal(restored.cursor,1);assert.equal(restored.moves.length,4);
 assert.equal(toSFEN(restored.states[1]),record.sfen);
 assert.equal(toSFEN(restored.states[4]),toSFEN(game.states[4]));
});
test('explicit cursor zero survives export, import, and default-cursor handling',()=>{
 const game=line(),record=makeRecord(game.states,game.moves,0),restored=decodeGame(record);
 assert.equal(restored.cursor,0);assert.equal(toSFEN(restored.states[0]),toSFEN(initialState()));
 assert.equal(makeRecord(game.states,game.moves).cursor,4);
});
test('old version 1 records default to the final move',()=>{
 const record={version:1,initialSfen:toSFEN(initialState()),moves:['7g7f','3c3d']};
 const restored=decodeGame(record);assert.equal(restored.cursor,2);assert.equal(restored.states.length,3);
});
test('integer display cursors clamp but nonintegers and strings are rejected',()=>{
 const game=line(),base=makeRecord(game.states,game.moves);
 assert.equal(decodeGame({...base,cursor:-8}).cursor,0);
 assert.equal(decodeGame({...base,cursor:999}).cursor,4);
 for(const cursor of [1.5,'1',null,NaN,Infinity])assert.throws(()=>decodeGame({...base,cursor}),/整数/);
});
test('branching archives the complete former line without mutating source history',()=>{
 const game=line(),before=JSON.stringify(game),branchMove=moveFromUSI(game.states[2],'6i7h');
 const branch=appendMove(game.states,game.moves,2,branchMove);
 assert.equal(JSON.stringify(game),before);
 assert.equal(branch.cursor,3);assert.equal(branch.moves.length,3);assert.equal(moveToUSI(branch.moves[2]),'6i7h');
 assert.deepEqual(branch.archived.moves,['7g7f','3c3d','2g2f','8c8d']);
 assert.equal(branch.archived.cursor,4);
 const old=decodeGame(branch.archived);assert.equal(toSFEN(old.states[4]),toSFEN(game.states[4]));
});
test('adding a move at the end has no archive and validates legality',()=>{
 const game=line(),before=JSON.stringify(game),next=appendMove(game.states,game.moves,4,'6i7h');
 assert.equal(next.archived,null);assert.equal(next.moves.length,5);assert.equal(JSON.stringify(game),before);
 assert.throws(()=>appendMove(game.states,game.moves,4,'7g7e'),/指せない/);
 assert.throws(()=>appendMove(game.states,game.moves,4,null),/形式/);
});
test('undo reaches the initial position while preserving redo information',()=>{
 const game=line(),before=JSON.stringify(game);let cursor=4;
 while(cursor)cursor=previousCursor(game.states,cursor,'study',0);
 assert.equal(cursor,0);assert.equal(previousCursor(game.states,0,'study',0),0);
 assert.equal(JSON.stringify(game),before);assert.equal(game.states.length,5);
 const redo=makeRecord(game.states,game.moves,4);assert.equal(decodeGame(redo).cursor,4);
});
test('AI undo returns to the human turn without deleting the AI response',()=>{
 const game=line();
 assert.equal(previousCursor(game.states,4,'play',0),2);
 assert.equal(previousCursor(game.states,3,'play',0),2);
 assert.equal(previousCursor(game.states,3,'play',1),1);
 assert.equal(previousCursor(game.states,1,'play',1),0);
 assert.equal(game.moves.length,4);
});
test('SFEN and USI position forms reconstruct the same initial and final positions',()=>{
 const initial=toSFEN(initialState());
 for(const input of [initial,'sfen '+initial,'position sfen '+initial,'startpos','position startpos']){
  const game=decodeGame(input);assert.equal(game.cursor,0);assert.equal(toSFEN(game.states[0]),initial);
 }
 const a=decodeGame('position sfen '+initial+' moves 7g7f 3c3d');
 const b=decodeGame('position startpos moves 7g7f 3c3d');
 assert.equal(toSFEN(a.states.at(-1)),toSFEN(b.states.at(-1)));
});
test('malformed records, illegal later moves, and excessive histories fail clearly',()=>{
 for(const bad of [null,[],{},'',{initialSfen:toSFEN(initialState()),moves:[7]}])assert.throws(()=>decodeGame(bad));
 assert.throws(()=>decodeGame('position startpos unknown 7g7f'),/moves/);
 assert.throws(()=>decodeGame('position startpos moves 7g7f 7g7f'),/2手目/);
 assert.throws(()=>decodeGame({initialSfen:toSFEN(initialState()),moves:Array(20001).fill('7g7f')}),/20000/);
 assert.throws(()=>makeRecord([initialState()],['7g7f'],0),/一致/);
});
