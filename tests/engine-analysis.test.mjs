import test from 'node:test';
import assert from 'node:assert/strict';
import {hasExactScore,selectBestmoveInfo} from '../engine-analysis.js';
const info=(move,depth,score,extra={})=>({pv:[move,'3c3d'],depth,score,...extra});

test('later search bounds do not erase an exact evaluation for the same move',()=>{
  const exact=info('7g7f',16,{cp:35}),bound=info('7g7f',17,{cp:90,bound:'lowerbound'});
  assert.equal(selectBestmoveInfo('7g7f',[exact,bound]),exact);
});
test('final bestmove uses its own score after MultiPV ranks change',()=>{
  const oldTop=info('7g7f',18,{cp:55},{multipv:1}),newTop=info('2g2f',18,{cp:45},{multipv:2});
  assert.equal(selectBestmoveInfo('2g2f',[oldTop,newTop]),newTop);
  assert.equal(selectBestmoveInfo('3g3f',[oldTop,newTop]),null);
});
test('deepest complete exact record is retained with its own PV and depth',()=>{
  const shallow=info('7g7f',15,{cp:20},{time:800}),deep=info('7g7f',17,{cp:40},{time:700});
  assert.equal(selectBestmoveInfo('7g7f',[deep,shallow]),deep);
  const updated={...deep,score:{cp:41},time:900};
  assert.equal(selectBestmoveInfo('7g7f',[deep,updated]),updated);
});
test('a matching bound is returned only when no matching exact score exists',()=>{
  const bound=info('2g2f',17,{cp:-50,bound:'upperbound'});
  assert.equal(selectBestmoveInfo('2g2f',[info('7g7f',18,{cp:30}),bound]),bound);
  assert.equal(hasExactScore(bound),false);
});
test('invalid numerical scores and unknown bounds are never exact',()=>{
  for(const score of [{cp:NaN},{cp:Infinity},{cp:5,bound:'unknown'},null]){
    const entry=info('7g7f',16,score);assert.equal(hasExactScore(entry),false);assert.equal(selectBestmoveInfo('7g7f',[entry]),null);
  }
  assert.equal(hasExactScore(info('7g7f',16,{cp:0})),true);
  assert.equal(hasExactScore(info('7g7f',16,{mate:-7})),true);
});
test('selection does not mutate scores, bounds, PVs or input order',()=>{
  const records=[info('7g7f',15,{cp:40}),info('7g7f',16,{cp:60,bound:'lowerbound'})],before=JSON.stringify(records);
  selectBestmoveInfo('7g7f',records);assert.equal(JSON.stringify(records),before);
});
