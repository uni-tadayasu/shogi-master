import test from 'node:test';
import assert from 'node:assert/strict';
import {strategyTransition,appendStrategyEvent} from '../strategy-events.js';
test('a repeated plan or first render does not announce a change',()=>{
 const p={key:'yagura',name:'矢倉'};
 assert.equal(strategyTransition(null,p),null);
 assert.equal(strategyTransition(p,{...p,reason:'説明更新'}),null);
});
test('transition explains both the original and changed strategy',()=>{
 const e=strategyTransition({key:'yagura',name:'矢倉'},{key:'anti',name:'対振り飛車',reason:'相手が中飛車'},{ply:4,now:12});
 assert.equal(e.text,'「矢倉」から「対振り飛車」に変わりました。');
 assert.equal(e.ply,4);assert.equal(e.reason,'相手が中飛車');
 assert.equal(appendStrategyEvent([e],{...e,time:13}).length,1);
});
test('a custom strategy rename is a visible change and history is bounded',()=>{
 const p={key:'custom:a',name:'自作A'},n={key:'custom:a',name:'自作B'};
 assert.ok(strategyTransition(p,n));
 let history=[];for(let i=0;i<205;i++) history=appendStrategyEvent(history,strategyTransition(p,n,{ply:i,now:i}));
 assert.equal(history.length,200);assert.equal(history[0].ply,5);
});
