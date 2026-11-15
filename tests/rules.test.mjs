import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,cloneState,legalMoves,applyMove,isInCheck,toSFEN,fromSFEN,moveToUSI,moveFromUSI,moveLabel,positionKey,terminalStatus} from '../shogi.js';

const index=(x,y)=>y*9+x;
const hand=()=>({P:0,L:0,N:0,S:0,G:0,B:0,R:0});
function position(pieces=[],hands={},turn=0) {
  const s={board:Array(81).fill(null),hands:[hand(),hand()],turn,moveNumber:1};
  for (const [type,owner,x,y] of pieces) s.board[index(x,y)]={type,owner};
  Object.assign(s.hands[turn],hands); return s;
}
const kings=[['K',0,8,8],['K',1,0,0]];
const usis=s=>legalMoves(s).map(moveToUSI);
const matePieces=[['K',0,8,8],['G',0,4,2],['K',1,4,0],['L',1,3,0],['L',1,5,0],['P',1,3,1],['P',1,5,1]];

test('initial position has 30 legal moves and 900 depth-two positions',()=>{
  const s=initialState(); assert.equal(legalMoves(s).length,30);
  assert.equal(legalMoves(s).reduce((n,m)=>n+legalMoves(applyMove(s,m)).length,0),900);
  assert.equal(isInCheck(s),false);
});
test('initial SFEN and move numbering round trip',()=>{
  const s=initialState();
  assert.equal(toSFEN(s),'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1');
  const m=moveFromUSI(s,'7g7f'); assert.ok(m);
  const next=applyMove(s,m); assert.equal(next.turn,1); assert.equal(next.moveNumber,2);
  assert.deepEqual(fromSFEN(toSFEN(next)),next); assert.equal(moveLabel(s,m),'▲７六歩');
});
test('applyMove and cloneState preserve source state and objects',()=>{
  const s=initialState(),snapshot=JSON.stringify(s),next=applyMove(s,moveFromUSI(s,'7g7f'));
  next.hands[0].P=4; next.board[0].type='P';
  assert.equal(JSON.stringify(s),snapshot);
  const c=cloneState(s); c.board[1].type='R'; assert.equal(s.board[1].type,'N');
});
test('illegal engine moves and malformed USI are rejected',()=>{
  const s=initialState();
  for(const m of ['7g7e','7g7f+','P*5e','resign','0000','7j7f','9a9b','__proto__','7g7f more']) assert.equal(moveFromUSI(s,m),null,m);
});
test('captures demote promoted pieces into hand',()=>{
  const s=position([...kings,['R',0,4,4],['+P',1,4,2]]);
  const m=moveFromUSI(s,'5e5c'); assert.ok(m);
  const n=applyMove(s,m); assert.equal(n.hands[0].P,1); assert.equal(n.board[index(4,2)].type,'R');
  assert.equal(s.hands[0].P,0);
});
test('nifu forbids drops only on files with own unpromoted pawn',()=>{
  const s=position([...kings,['P',0,4,4]],{P:1});
  assert.ok(legalMoves(s).filter(m=>m.drop==='P').every(m=>m.to%9!==4));
  s.board[index(4,4)].type='+P'; assert.ok(moveFromUSI(s,'P*5f'));
});
test('both sides obey dead-rank drop restrictions',()=>{
  for(const side of [0,1]) {
    const s=position(kings,{P:1,L:1,N:1},side);
    for (const m of legalMoves(s).filter(m=>m.drop)) {
      const relativeY=side===0?Math.floor(m.to/9):8-Math.floor(m.to/9);
      assert.ok(relativeY >= (m.drop==='N'?2:1));
    }
  }
});
test('pawn and lance must promote on final rank',()=>{
  for (const type of ['P','L']) {
    const s=position([...kings,[type,0,4,1]]),moves=usis(s);
    assert.ok(moves.includes('5b5a+')); assert.ok(!moves.includes('5b5a'));
  }
});
test('knight must promote on final two ranks',()=>{
  const s=position([...kings,['N',0,4,3]]),moves=usis(s);
  assert.ok(moves.includes('5d6b+')); assert.ok(moves.includes('5d4b+'));
  assert.ok(!moves.includes('5d6b')); assert.ok(!moves.includes('5d4b'));
});
test('promotion is optional on entry to and exit from promotion zone',()=>{
  const s=position([...kings,['S',0,4,3]]);
  assert.ok(moveFromUSI(s,'5d5c')); assert.ok(moveFromUSI(s,'5d5c+'));
  s.board[index(4,3)]=null;s.board[index(4,2)]={type:'S',owner:0};
  assert.ok(moveFromUSI(s,'5c6d'));assert.ok(moveFromUSI(s,'5c6d+'));
});
test('gote direction and promotion zone are mirrored',()=>{
  const s=position([...kings,['P',1,4,7]],{},1),moves=usis(s);
  assert.ok(moves.includes('5h5i+'));assert.ok(!moves.includes('5h5i'));assert.ok(!moves.includes('5h5g'));
});
test('pinned piece cannot uncover own king',()=>{
  const s=position([['K',0,4,8],['G',0,4,7],['R',1,4,0],['K',1,0,0]]),moves=usis(s);
  assert.ok(!moves.includes('5h4h'));assert.ok(!moves.includes('5h6h'));assert.ok(moves.includes('5h5g'));
});
test('a check can be blocked only by drops on the checking ray',()=>{
  const s=position([['K',0,4,8],['R',1,4,0],['K',1,0,0]],{G:1});
  assert.equal(isInCheck(s),true);
  const drops=legalMoves(s).filter(m=>m.drop);assert.equal(drops.length,7);assert.ok(drops.every(m=>m.to%9===4));
});
test('pawn-drop mate is forbidden',()=>{
  const s=position(matePieces,{P:1});assert.equal(moveFromUSI(s,'P*5b'),null);
});
test('checking pawn drop with king escape is allowed',()=>{
  const s=position(matePieces.filter(([type,owner,x,y])=>!(owner===1&&x===3&&y===0)),{P:1});
  const m=moveFromUSI(s,'P*5b');assert.ok(m);assert.equal(isInCheck(applyMove(s,m)),true);
  assert.ok(moveFromUSI(applyMove(s,m),'5a6a'));
});
test('non-pawn drop mate is allowed and detected',()=>{
  const s=position(matePieces,{G:1}),m=moveFromUSI(s,'G*5b');assert.ok(m);
  assert.deepEqual(terminalStatus(applyMove(s,m)),{over:true,reason:'checkmate',winner:0});
});
test('moving a board pawn to deliver mate is allowed',()=>{
  const pieces=matePieces.map(p=>p[0]==='G'&&p[1]===0?['P',0,4,2]:p);
  pieces.push(['G',0,3,2]); const s=position(pieces);
  assert.ok(moveFromUSI(s,'5c5b'));
  assert.equal(terminalStatus(applyMove(s,moveFromUSI(s,'5c5b'))).over,true);
});
test('king cannot move into attack or capture the opposing king',()=>{
  const s=position([['K',0,4,4],['K',1,4,3]]);
  assert.ok(!usis(s).includes('5e5d'));assert.ok(!usis(s).includes('5e4d'));
});
test('promoted bishop and rook gain correct short-range steps',()=>{
  const s=position([...kings,['+B',0,4,4]]);
  assert.ok(moveFromUSI(s,'5e5d'));assert.ok(!moveFromUSI(s,'5e5c'));assert.ok(moveFromUSI(s,'5e3c'));
  s.board[index(4,4)].type='+R';assert.ok(moveFromUSI(s,'5e4d'));assert.ok(!moveFromUSI(s,'5e3c'));assert.ok(moveFromUSI(s,'5e5c'));
});
test('position key excludes move number, includes side to move',()=>{
  const s=initialState(),n=cloneState(s);n.moveNumber=99;assert.equal(positionKey(s),positionKey(n));
  n.turn=1;assert.notEqual(positionKey(s),positionKey(n));
});
test('SFEN roundtrips promoted pieces, asymmetric hands and gote turn',()=>{
  const s=position([...kings,['+P',0,4,4],['+R',1,6,3]],{P:2,G:1},1);
  s.hands[0].R=1;s.hands[0].P=3;s.moveNumber=157;
  assert.deepEqual(fromSFEN(toSFEN(s)),s);
});
test('SFEN rejects malformed fields and impossible material',()=>{
  const start=toSFEN(initialState());
  for (const bad of ['',start+' extra',start.replace(' b ',' x '),start.replace(' - 1',' - 0'),start.replace(' - 1',' K 1'),start.replace(' - 1',' 0P 1'),start.replace(' - 1',' PP 1'),start.replace(' - 1',' 99P 1'),start.replace('LNSGKGSNL','LNSG+KGSNL'),start.replace('LNSGKGSNL','LNSGGGSNL'),start.replace('/9/9/9/','/8/9/9/'),'x'.repeat(513)]) assert.throws(()=>fromSFEN(bad),undefined,bad);
});
test('SFEN rejects nifu, dead pieces and nonmoving checked king',()=>{
  const nifu=position([...kings,['P',0,4,4],['P',0,4,5]]);assert.throws(()=>fromSFEN(toSFEN(nifu)),/二歩/);
  const dead=position([...kings,['P',0,4,0]]);assert.throws(()=>fromSFEN(toSFEN(dead)),/動けない/);
  const check=position([...kings,['R',0,0,4]]);assert.throws(()=>fromSFEN(toSFEN(check)),/手番ではない/);
  check.turn=1;assert.deepEqual(fromSFEN(toSFEN(check)),check);
});
test('normal game sequence remains valid and moves are consistently encoded',()=>{
  let s=initialState();
  for(const text of ['7g7f','3c3d','2g2f','8c8d','2f2e','8d8e','2e2d','2c2d','2h2d']) {
    const m=moveFromUSI(s,text);assert.ok(m,text);assert.equal(moveToUSI(m),text);s=applyMove(s,m);
    assert.deepEqual(fromSFEN(toSFEN(s)),s);
  }
  assert.equal(s.hands[0].P,1);assert.equal(s.hands[1].P,1);assert.equal(terminalStatus(s).over,false);
});
