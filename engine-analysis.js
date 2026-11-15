/** Associate a final USI move with its own evaluation, never its old rank.
 * Copyright (C) 2026 KASAI SOLUTIONS INC. GPL-3.0-or-later. */
function scoreKind(info) {
  const score=info?.score;
  if (!score || !((typeof score.cp==='number'&&Number.isFinite(score.cp)) || (typeof score.mate==='number'&&Number.isFinite(score.mate)))) return null;
  if (score.bound===undefined || score.bound===null) return 'exact';
  return score.bound==='lowerbound'||score.bound==='upperbound' ? 'bound' : null;
}
export function hasExactScore(info) { return scoreKind(info)==='exact'; }

/**
 * entries must contain only the current request's info records. Keep older exact
 * records even when a later aspiration search emits a bound. The caller must
 * independently verify that bestmove is legal in the current position.
 * The chosen entry's PV, score and depth remain together; nothing is synthesized.
 */
export function selectBestmoveInfo(bestmove, entries = []) {
  let exact=null,bound=null;
  const rank=info=>[Number.isFinite(info.depth)?info.depth:0,Number.isFinite(info.time)?info.time:0,Number.isFinite(info.nodes)?info.nodes:0];
  const newer=(candidate,current)=>{
    if(!current)return true;
    const a=rank(candidate),b=rank(current);
    for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]>b[i];
    return true; // On an otherwise tied record, prefer the later supplied info.
  };
  for(const info of entries){
    if(info?.pv?.[0]!==bestmove)continue;
    const kind=scoreKind(info);
    if(kind==='exact'&&newer(info,exact))exact=info;
    else if(kind==='bound'&&newer(info,bound))bound=info;
  }
  return exact||bound||null;
}
