import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,toSFEN} from '../shogi.js';
import {studyLine,studyPosition,stepStudyBack,stepStudyForward,appendStudyMove} from '../studio-workbench.js';
const start=toSFEN(initialState());
test('study board accepts alternating legal moves and keeps the original line immutable',()=>{
 const a=studyLine(start);const b=appendStudyMove(a,'7g7f');const c=appendStudyMove(b,'3c3d');
 assert.deepEqual(a.moves,[]);assert.deepEqual(c.moves,['7g7f','3c3d']);assert.equal(studyPosition(c).turn,0);
 assert.throws(()=>appendStudyMove(b,'2g2f'),/現在の局面/);
});
test('study undo and redo preserve the complete future sequence',()=>{
 const a=studyLine(start,['7g7f','3c3d','2g2f']);const b=stepStudyBack(stepStudyBack(a));
 assert.deepEqual(b.moves,['7g7f']);assert.deepEqual(b.future,['3c3d','2g2f']);
 assert.deepEqual(stepStudyForward(stepStudyForward(b)),a);
 assert.equal(stepStudyBack(studyLine(start)).moves.length,0);
});
test('study branching requires explicit replacement and retains source future until then',()=>{
 const a=stepStudyBack(studyLine(start,['7g7f','3c3d']));
 assert.throws(()=>appendStudyMove(a,'8c8d'),/分岐/);
 const b=appendStudyMove(a,'8c8d',{replaceFuture:true});
 assert.deepEqual(a.future,['3c3d']);assert.deepEqual(b.moves,['7g7f','8c8d']);assert.deepEqual(b.future,[]);
});
test('study rejects impossible typed lines before they can reach board analysis',()=>{
 assert.throws(()=>studyLine(start,['7g7e']));assert.throws(()=>studyLine('invalid',[]));
});
test('study line preserves legal promotions and can undo them',()=>{
 const initial='k8/9/9/4S4/9/9/9/9/8K b - 1';
 const a=appendStudyMove(studyLine(initial),'5d5c+');assert.equal(studyPosition(a).board[22].type,'+S');
 assert.equal(studyPosition(stepStudyBack(a)).board[31].type,'S');
 const b=appendStudyMove(studyLine(initial),'5d5c');assert.equal(studyPosition(b).board[22].type,'S');
});
test('study drop consumes own hand and undo restores it',()=>{
 const initial='k8/9/9/9/9/9/9/9/8K b P 1';const a=appendStudyMove(studyLine(initial),'P*5e');
 assert.equal(studyPosition(a).hands[0].P,0);assert.equal(studyPosition(a).board[40].type,'P');
 assert.equal(studyPosition(stepStudyBack(a)).hands[0].P,1);
});
