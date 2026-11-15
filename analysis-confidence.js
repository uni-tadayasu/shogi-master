/** Uncalibrated display conversion, NOT observed wins or a model-calibrated probability.
 * Copyright (C) 2026 KASAI SOLUTIONS INC. GPL-3.0-or-later.
 * The scale 600 is a UI heuristic selected for this project. No calibration set
 * or measured win-rate claim is attached to SuishoPetite 2021-11 here.
 */
export const WIN_RATE_NOTICE='局面評価を単純換算した未校正の目安。対戦成績から求めた勝率ではありません。';
export const WIN_RATE_FORMULA='100 / (1 + exp(-研究側評価値 / 600))、表示範囲1〜99%';
export function referenceWinRate(score,{turn=0,side=0,depth=0}={}){
 const common={notice:WIN_RATE_NOTICE,formula:WIN_RATE_FORMULA,shallow:Number.isFinite(depth)&&depth<10};
 if(![0,1].includes(turn)||![0,1].includes(side)||!score||typeof score!=='object')return {...common,status:'unavailable',reason:'評価値未確定',own:null,opponent:null};
 if(score.bound||score.lowerbound||score.upperbound)return {...common,status:'unavailable',reason:'境界値のため未確定',own:null,opponent:null};
 const sign=turn===side?1:-1;
 if(typeof score.mate==='number'&&Number.isFinite(score.mate))return {...common,status:'mate',reason:score.mate*sign>=0?'研究側に詰み筋':'相手に詰み筋',own:null,opponent:null};
 if(typeof score.cp!=='number'||!Number.isFinite(score.cp))return {...common,status:'unavailable',reason:'評価値未確定',own:null,opponent:null};
 const cp=score.cp*sign,own=Math.max(1,Math.min(99,Math.round(100/(1+Math.exp(-cp/600)))));
 return {...common,status:'estimate',reason:'未校正の評価値換算',cp,own,opponent:100-own};
}

/** Position-only key: renaming a plan does not change its analyzed position. */
export function analysisFingerprint(plan){
 if(!plan||![0,1].includes(plan.side)||typeof plan.initialSfen!=='string')throw Error('解析対象の局面形式が正しくありません。');
 const moves=Array.isArray(plan.moves)?plan.moves:typeof plan.moves==='string'?plan.moves.trim().split(/\s+/).filter(Boolean):null;
 if(!moves||moves.some(m=>typeof m!=='string'))throw Error('解析対象の手順形式が正しくありません。');
 return JSON.stringify([plan.side,plan.initialSfen.trim().replace(/\s+/g,' '),moves]);
}
export function makeAnalysisSnapshot({plan,info,turn,timeMs,at=new Date().toISOString()}){
 const score=info?.score;if(!score||!((typeof score.cp==='number'&&Number.isFinite(score.cp))||(typeof score.mate==='number'&&Number.isFinite(score.mate))))return null;
 const snapshot={version:1,fingerprint:analysisFingerprint(plan),side:plan.side,turn,timeMs,depth:Math.max(0,Number(info.depth)||0),score:{...score},at,engine:'YaneuraOu NNUE KP256 9.80git / SuishoPetite 2021-11'};
 return matchingAnalysisSnapshot(snapshot,plan);
}
export function matchingAnalysisSnapshot(snapshot,plan){
 try{if(!snapshot||snapshot.version!==1||snapshot.fingerprint!==analysisFingerprint(plan)||snapshot.side!==plan.side||![0,1].includes(snapshot.turn)||!Number.isFinite(snapshot.timeMs)||snapshot.timeMs<100||snapshot.timeMs>60000||!Number.isFinite(snapshot.depth)||snapshot.depth<0||typeof snapshot.at!=='string'||!Number.isFinite(Date.parse(snapshot.at)))return null;
 const score=snapshot.score;if(!score||!((typeof score.cp==='number'&&Number.isFinite(score.cp))||(typeof score.mate==='number'&&Number.isFinite(score.mate))))return null;
 if(score.bound!==undefined&&!['lowerbound','upperbound'].includes(score.bound))return null;
 return {...snapshot,score:{...score}};
 }catch{return null;}
}
