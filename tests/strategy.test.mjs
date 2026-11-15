import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,cloneState,moveFromUSI,moveToUSI,applyMove,isInCheck} from '../shogi.js';
import {getAdaptivePlan,strategyData,castles} from '../strategy.js';
const play=(sequence)=>{const history=[initialState()];for(const usi of sequence){const s=history.at(-1),m=moveFromUSI(s,usi);assert.ok(m,usi);history.push(applyMove(s,m));}return {state:history.at(-1),history};};
const mirror=s=>({board:s.board.map(p=>p?{type:p.type,owner:1-p.owner}:null).reverse(),hands:[{...s.hands[1]},{...s.hands[0]}],turn:1-s.turn,moveNumber:s.moveNumber});
const plan=(p={},extra={})=>getAdaptivePlan({state:initialState(),side:0,preferred:'auto',adaptive:true,...p,...extra});

test('initial selection is preserved without evidence and guides remain legal',()=>{
 for(const preferred of Object.keys(strategyData)){
  const s=initialState(),p=plan({state:s,preferred});assert.equal(p.key,preferred);assert.equal(p.changed,false);assert.equal(p.isHeuristic,true);if(strategyData[preferred].moves.length){assert.ok(p.guideMove);assert.ok(moveFromUSI(s,moveToUSI(p.guideMove)));}else assert.equal(p.guideMove,null);
 }
});
test('opponent ranging rook changes uncommitted yagura to anti-ranging plan',()=>{
 const game=play(['7g7f','3c3d','2g2f','4c4d','2f2e','8b4b']);
 const p=plan(game,{preferred:'yagura'});assert.equal(p.key,'anti-ranging');assert.equal(p.changed,true);assert.match(p.opponent,/四間飛車/);assert.ok(p.guideMove);
});
test('gote sees the same relative opponent structure and mirrored guide',()=>{
 const game=play(['7g7f','3c3d','2g2f','4c4d','2f2e','8b4b']);
 const a=plan(game,{preferred:'yagura'}),mirrored={state:mirror(game.state),history:game.history.map(mirror)};
 const b=plan(mirrored,{preferred:'yagura',side:1});assert.equal(a.key,b.key);assert.equal(a.name,b.name);assert.equal(a.opponent,b.opponent);assert.ok(b.guideMove);assert.equal(b.guideMove.from,80-a.guideMove.from);assert.equal(b.guideMove.to,80-a.guideMove.to);
});
test('adaptive off preserves selected plan even against ranging rook',()=>{
 const game=play(['7g7f','3c3d','2g2f','4c4d','2f2e','8b4b']);const p=plan(game,{preferred:'yagura',adaptive:false});assert.equal(p.key,'yagura');assert.equal(p.changed,false);
});
test('committed own rook is not switched back by opponent ranging',()=>{
 const game=play(['7g7f','3c3d','6g6f','4c4d','2h6h','8b4b']);const p=plan(game,{preferred:'ibisha'});assert.equal(p.key,'mutual-ranging');assert.match(p.name,/四間飛車/);assert.equal(p.guideMove,null);
});
test('own established ranging structure overrides unused initial preference',()=>{
 const game=play(['7g7f','8c8d','6g6f','8d8e','2h6h']);const p=plan(game,{preferred:'ibisha'});assert.match(p.name,/四間飛車/);assert.notEqual(p.key,'ibisha');assert.equal(p.guideMove,null);
});
test('advanced opponent pawn stops prewritten openings',()=>{
 const game=play(['7g7f','8c8d','6g6f','8d8e']);const p=plan(game,{preferred:'yagura'});assert.equal(p.key,'respond-pressure');assert.equal(p.guideMove,null);assert.match(p.reason,/8筋/);
});
test('opponent rook pawn first push adapts auto but not explicit preference',()=>{
 const game=play(['7g7f','8c8d']);assert.equal(plan(game).key,'shiken');assert.equal(plan(game,{preferred:'yagura'}).key,'yagura');
});
test('engine disadvantage is oriented to selected side and guide is suspended',()=>{
 assert.equal(plan({}, {cpSente:-600,side:0}).key,'defend');assert.notEqual(plan({}, {cpSente:-600,side:1}).key,'defend');assert.equal(plan({}, {cpSente:600,side:1}).key,'defend');assert.equal(plan({}, {cpSente:-600}).guideMove,null);
});
test('king in check overrides strategy without proposing unsafe opening move',()=>{
 const s=cloneState(initialState());s.board[4]={type:'R',owner:1};s.board[13]=null;s.board[22]=null;s.board[58]=null;assert.ok(isInCheck(s,0));
 const p=plan({state:s},{preferred:'nakabisha'});assert.equal(p.key,'check');assert.equal(p.guideMove,null);
 const fixed=plan({state:s},{preferred:'nakabisha',adaptive:false});assert.equal(fixed.key,'nakabisha');assert.equal(fixed.changed,false);assert.equal(fixed.guideMove,null);
});
test('non-moving player gets explanation but never a guide move',()=>{
 assert.equal(plan({}, {side:1,preferred:'shiken'}).guideMove,null);
});
test('late or exchanged positions stop obsolete opening lists',()=>{
 const s=initialState();s.moveNumber=40;assert.equal(plan({state:s}).key,'position');assert.equal(plan({state:s}).guideMove,null);
 const exchanged=initialState();exchanged.board[54]=null;exchanged.hands[1].P=1;assert.equal(plan({state:exchanged}).guideMove,null);
});
test('sparse imported puzzles and unknown preferences are handled conservatively',()=>{
 const sparse=initialState();sparse.board=sparse.board.map(p=>p?.type==='K'?p:null);const p=plan({state:sparse});assert.equal(p.key,'position');assert.equal(p.guideMove,null);
 assert.equal(plan({},{preferred:'__proto__'}).key,'auto');
});
test('guidance does not mutate state, history, or engine inputs',()=>{
 const game=play(['7g7f','8c8d']);const before=JSON.stringify(game);plan(game,{preferred:'shiken'});assert.equal(JSON.stringify(game),before);
});
test('opponent center and third-file rook labels use its own perspective',()=>{
 const central=play(['7g7f','5c5d','2g2f','8b5b']);assert.match(plan(central,{preferred:'ibisha'}).opponent,/中飛車/);
 const third=play(['7g7f','3c3d','2g2f','8b3b']);assert.match(plan(third,{preferred:'ibisha'}).opponent,/三間飛車/);
});
test('manual strategy remains named after captures while its static guide stops',()=>{
 const s=initialState();s.board[54]=null;s.hands[1].P=1;const p=plan({state:s},{preferred:'yagura',adaptive:false});assert.equal(p.name,'矢倉');assert.equal(p.guideMove,null);assert.equal(p.changed,false);
});
test('catalog has 64 distinct strategies and 24 separate castle goals',()=>{
 assert.equal(Object.keys(strategyData).length,64);assert.equal(new Set(Object.values(strategyData).map(x=>x.name)).size,64);
 assert.equal(castles.length,24);assert.equal(new Set(castles.map(x=>x.id)).size,24);assert.equal(new Set(castles.map(x=>x.name)).size,24);
 for(const [key,s]of Object.entries(strategyData)){for(const prop of ['name','text','category','family','conditions','caution'])assert.equal(typeof s[prop],'string',`${key}.${prop}`);assert.ok(['auto','ibisha','yagura','shiken','sanken','nakabisha','mukaibisha','other-ranging'].includes(s.family));assert.ok(Array.isArray(s.moves));}
 for(const c of castles){assert.ok(c.id&&c.name&&c.text&&c.caution);assert.equal(c.moves,undefined);}
});
test('all 64 selected openings only offer legal guides on either player side',()=>{
 for(const preferred of Object.keys(strategyData))for(const side of [0,1]){
  const s=initialState();s.turn=side;const p=getAdaptivePlan({state:s,side,preferred,adaptive:false});
  if(p.guideMove)assert.ok(moveFromUSI(s,moveToUSI(p.guideMove)),`${preferred} side${side}`);
 }
});
test('detailed ibisha variation adapts by family rather than being called ranging',()=>{
 const game=play(['7g7f','3c3d','2g2f','4c4d','2f2e','8b4b']);
 assert.equal(plan(game,{preferred:'kaku-bogin'}).key,'anti-ranging');
 assert.equal(plan(game,{preferred:'elmo-kyusen'}).key,'elmo-kyusen');
 assert.equal(plan(game,{preferred:'saginomiya'}).key,'saginomiya');
});
test('selected ranging variation name survives a compatible rook commitment',()=>{
 const game=play(['7g7f','3c3d','6g6f','8c8d','2h6h','6a5b']);
 const p=plan(game,{preferred:'fujii-system'});assert.equal(p.key,'fujii-system');assert.equal(p.name,'藤井システム');assert.equal(p.guideMove,null);
});
