/** Custom strategy records. Copyright (C) 2026 KASAI SOLUTIONS INC. GPL-3.0-or-later. */
import {decodeGame} from './game-record.js';
import {initialState,toSFEN,moveToUSI,positionKey} from './shogi.js';
import {strategyData} from './strategy.js';
export const CUSTOM_STORAGE='shogi-master-custom-strategies-v1';
export const MAX_CUSTOM_PLANS=50;
export const MAX_PLAN_MOVES=512;
const idPattern=/^custom-[a-zA-Z0-9-]{1,80}$/;
const createId=()=>`custom-${globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}`;
function cleanText(value,max,label){if(typeof value!=='string')throw Error(`${label}を文字列で入力してください。`);const text=value.trim();if(text.length>max)throw Error(`${label}は${max}文字以内にしてください。`);return text;}
export function normalizePlan(input,{id=input?.id,now=new Date().toISOString()}={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('独自戦法の形式が正しくありません。');
 const name=cleanText(input.name,40,'戦法名');if(!name)throw Error('戦法名を入力してください。');
 const notes=cleanText(input.notes??'',2000,'狙い・研究メモ');
 const base=input.base??'auto';if(!Object.hasOwn(strategyData,base))throw Error('参考にする基本戦法を選んでください。');
 if(input.side!==0&&input.side!==1)throw Error('研究する側は先手または後手を選んでください。');
 const initialSfen=cleanText(input.initialSfen??toSFEN(initialState()),200,'開始局面');
 const moves=typeof input.moves==='string'?input.moves.trim().split(/\s+/).filter(Boolean):input.moves;
 if(!Array.isArray(moves)||moves.length>MAX_PLAN_MOVES)throw Error(`独自戦法の手順は${MAX_PLAN_MOVES}手以内にしてください。`);
 const decoded=decodeGame({initialSfen,moves});
 if(id!==undefined&&!idPattern.test(id))throw Error('独自戦法のIDが正しくありません。');
 return {id:id||createId(),name,notes,base,side:input.side,initialSfen:toSFEN(decoded.states[0]),moves:decoded.moves.map(moveToUSI),updatedAt:now};
}
export function normalizePlanLibrary(data){
 if(typeof data==='string'){if(data.length>1024*1024)throw Error('独自戦法ファイルは1MB以内にしてください。');data=JSON.parse(data);}
 if(!data||data.format!=='shogi-master-custom-strategies'||data.version!==1||!Array.isArray(data.plans))throw Error('将棋名人の独自戦法ファイルではありません。');
 if(data.plans.length>MAX_CUSTOM_PLANS)throw Error(`保存できる独自戦法は${MAX_CUSTOM_PLANS}件までです。`);
 const ids=new Set();return data.plans.map(raw=>{const plan=normalizePlan(raw,{now:typeof raw.updatedAt==='string'?raw.updatedAt:new Date().toISOString()});if(ids.has(plan.id))throw Error('同じIDの独自戦法が複数含まれています。');ids.add(plan.id);return plan;});
}
export function encodePlanLibrary(plans){return {format:'shogi-master-custom-strategies',version:1,site:'将棋名人｜Shogi Master',plans:plans.map(p=>normalizePlan(p,{now:p.updatedAt}))};}
export function upsertPlan(plans,input){
 if(!Array.isArray(plans))throw Error('独自戦法の保存一覧が正しくありません。');
 const plan=normalizePlan(input),index=plans.findIndex(p=>p.id===plan.id);
 if(index<0&&plans.length>=MAX_CUSTOM_PLANS)throw Error(`独自戦法は${MAX_CUSTOM_PLANS}件まで保存できます。不要な戦法を書き出して整理してください。`);
 const next=plans.slice();if(index<0)next.push(plan);else next[index]=plan;return {plans:next,plan};
}
export function mergePlanLibraries(current,incoming){
 const next=current.slice();for(const plan of incoming){const index=next.findIndex(p=>p.id===plan.id);if(index<0)next.push({...plan,moves:[...plan.moves]});else{const copy={...plan,id:createId(),name:(plan.name+'（読込）').slice(0,40),moves:[...plan.moves]};next.push(copy);}}
 if(next.length>MAX_CUSTOM_PLANS)throw Error(`読み込み後の戦法数が${MAX_CUSTOM_PLANS}件を超えます。`);return next;
}
export function planFromCurrent(record,{name='新しい独自戦法',base='auto'}={}){
 const loaded=decodeGame(record);return normalizePlan({name,notes:'',base,side:record.side===1?1:0,initialSfen:toSFEN(loaded.states[0]),moves:loaded.moves.slice(0,loaded.cursor).map(moveToUSI)});
}
export function recordForPlan(plan){const valid=normalizePlan(plan,{now:plan.updatedAt});return {version:2,initialSfen:valid.initialSfen,moves:[...valid.moves],cursor:valid.moves.length};}
export function describePlanLine(plan){const valid=normalizePlan(plan,{now:plan.updatedAt});return decodeGame({initialSfen:valid.initialSfen,moves:valid.moves});}
const guideCache=new Map();
/** The saved line is a study guide, only offered at an exactly matching legal position. */
export function getPlanGuide(plan,state){
 const cacheKey=JSON.stringify([plan?.id,plan?.updatedAt,plan?.name,plan?.notes,plan?.base,plan?.side,plan?.initialSfen,plan?.moves]);let positions=guideCache.get(cacheKey);
 if(!positions){const {states,moves}=describePlanLine(plan);positions=new Map();for(let index=0;index<states.length;index++){const key=positionKey(states[index]);if(!positions.has(key))positions.set(key,{matched:true,finished:index===moves.length,index,move:moves[index]||null});}guideCache.set(cacheKey,positions);if(guideCache.size>24)guideCache.delete(guideCache.keys().next().value);}
 const result=positions.get(positionKey(state));return result?{...result,move:result.move?{...result.move}:null}:{matched:false,finished:false,index:null,move:null};
}
