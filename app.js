import {initialState,cloneState,legalMoves,applyMove,isInCheck,toSFEN,fromSFEN,moveToUSI,moveFromUSI,moveLabel,positionKey,terminalStatus,PIECE_LABELS} from './shogi.js';

const $=id=>document.getElementById(id);
const STORAGE='shogi-meijin-v1';
const labels={P:'歩',L:'香',N:'桂',S:'銀',G:'金',B:'角',R:'飛',K:'玉','+P':'と','+L':'成香','+N':'成桂','+S':'成銀','+B':'馬','+R':'龍'};
const sideName=n=>n===0?'先手':'後手';
let settings={side:0,strategy:'auto',mode:'study',time:3000};
let states=[initialState()],moves=[],cursor=0,flipped=false,selected=null,legal=[],candidates=[],selectedCandidate=0;
let worker=null,requestId=0,thinking=false,engineFailed=false,engineName='やねうら王 NNUE',pendingPromotion=null,autoTimer=null;
const state=()=>states[cursor];
const engineResults=new Map();
let analysisBatches=new Map(),latestCandidates=[];
let toastTimer;
function toast(message){let el=$('toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast';el.setAttribute('role','status');document.body.append(el);}el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4200);}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify({version:1,initialSfen:toSFEN(states[0]),moves:moves.map(moveToUSI),cursor,settings}));}catch{}}
function decodeGame(data){
 let initial,mv=[];
 if(typeof data==='string'){
  const raw=data.trim();
  if(raw.startsWith('{'))return decodeGame(JSON.parse(raw));
  const parts=raw.replace(/^position\s+/,'').split(/\s+moves\s+/);
  initial=parts[0]==='startpos'?initialState():fromSFEN(parts[0].replace(/^sfen\s+/,''));
  mv=parts[1]?parts[1].trim().split(/\s+/):[];
 }else{
  if(!data||typeof data.initialSfen!=='string'||!Array.isArray(data.moves))throw Error('棋譜データの形式が違います。');
  initial=fromSFEN(data.initialSfen);mv=data.moves;
 }
 if(mv.length>2000)throw Error('棋譜は2000手以内にしてください。');
 const nextStates=[initial],nextMoves=[];
 for(const usi of mv){if(typeof usi!=='string')throw Error('指し手が文字列ではありません。');const m=moveFromUSI(nextStates.at(-1),usi);if(!m)throw Error(`${nextMoves.length+1}手目「${usi}」が合法手ではありません。`);nextMoves.push(m);nextStates.push(applyMove(nextStates.at(-1),m));}
 return {states:nextStates,moves:nextMoves};
}
function restore(){try{const data=JSON.parse(localStorage.getItem(STORAGE));if(!data)return;const loaded=decodeGame(data);states=loaded.states;moves=loaded.moves;cursor=Math.max(0,Math.min(moves.length,Number(data.cursor)||0));const s=data.settings||{};settings={side:s.side===1?1:0,strategy:['auto','yagura','ibisha','shiken','sanken','nakabisha'].includes(s.strategy)?s.strategy:'auto',mode:s.mode==='play'?'play':'study',time:[1000,3000,8000].includes(s.time)?s.time:3000};flipped=settings.side===1;}catch{toast('保存された棋譜を読み込めなかったため、初期局面で開始しました。');}}
function gameResult(){
 const s=state(),key=positionKey(s),occ=[];
 if(engineResults.has(key))return engineResults.get(key);
 for(let i=0;i<=cursor;i++)if(positionKey(states[i])===key)occ.push(i);
 if(occ.length>=4){const start=occ.at(-4);for(const side of [0,1]){let count=0,all=true;for(let i=start;i<cursor;i++)if(states[i].turn===side){count++;if(!isInCheck(states[i+1],1-side))all=false;}if(count&&all)return{over:true,reason:'perpetual-check',winner:1-side};}return{over:true,reason:'repetition',winner:null};}
 return terminalStatus(s);
}
function resultText(result){if(result.reason==='declaration')return `${sideName(result.winner)}の勝ち · 入玉宣言`;if(result.reason==='resign')return `${sideName(result.winner)}の勝ち · AI投了判定`;return result.reason==='repetition'?'千日手 · 引き分け':result.reason==='perpetual-check'?`${sideName(result.winner)}の勝ち · 連続王手の千日手`:result.over?`${sideName(result.winner)}の勝ち · ${result.reason==='checkmate'?'詰み':'合法手なし'}`:'';}
function activeMove(){return candidates[selectedCandidate]?.move||null;}
function boardIndexToDisplay(i){return flipped?80-i:i;}
function renderBoard(){
 const s=state(),board=$('board');board.replaceChildren();
 const previous=cursor?moves[cursor-1]:null,best=activeMove();
 const validTargets=new Set(selected?legal.filter(m=>selected.drop?m.drop===selected.drop:m.from===selected.from).map(m=>m.to):[]);
 for(let display=0;display<81;display++){
  const i=flipped?80-display:display,p=s.board[i],x=i%9,y=Math.floor(i/9),button=document.createElement('button');
  button.type='button';button.className='square';button.dataset.index=i;button.setAttribute('role','gridcell');
  button.setAttribute('aria-label',`${9-x}${['一','二','三','四','五','六','七','八','九'][y]} ${p?sideName(p.owner)+' '+labels[p.type]:'空きマス'}`);
  if(previous?.from===i)button.classList.add('last-from');if(previous?.to===i)button.classList.add('last-to');
  if(selected?.from===i)button.classList.add('selected');if(validTargets.has(i))button.classList.add('legal');
  if(best?.to===i)button.classList.add('recommended');
  if(p?.type==='K'&&isInCheck(s,p.owner))button.classList.add('check');
  if(p){const piece=document.createElement('span');piece.className='piece'+(p.owner===(flipped?0:1)?' opponent':'')+(p.type.startsWith('+')?' promoted':'')+(labels[p.type].length>1?' multi-character':'');piece.dataset.owner=p.owner;piece.textContent=labels[p.type];button.append(piece);}
  button.addEventListener('click',()=>clickSquare(i));board.append(button);
 }
 const files=$('file-labels');if(files)files.innerHTML=(flipped?[1,2,3,4,5,6,7,8,9]:[9,8,7,6,5,4,3,2,1]).map(n=>`<span>${n}</span>`).join('');
 const ranks=$('rank-labels');if(ranks)ranks.innerHTML=(flipped?['九','八','七','六','五','四','三','二','一']:['一','二','三','四','五','六','七','八','九']).map(n=>`<span>${n}</span>`).join('');
 renderHands();drawArrow();
}
function renderHands(){
 for(const owner of [0,1]){const container=$(`hand-${owner}`);container.replaceChildren();
  for(const type of ['R','B','G','S','N','L','P']){const count=state().hands[owner][type]||0;if(!count)continue;const b=document.createElement('button');b.type='button';b.className='hand-piece'+(selected?.drop===type&&state().turn===owner?' selected':'');b.disabled=owner!==state().turn||isAIturn()||gameResult().over;b.setAttribute('aria-label',`${sideName(owner)}の持ち駒 ${labels[type]} ${count}枚`);const name=document.createElement('span');name.textContent=labels[type];const num=document.createElement('small');num.textContent=String(count);b.append(name,num);b.addEventListener('click',()=>{selected=selected?.drop===type?null:{drop:type};renderBoard();});container.append(b);}
  if(!container.children.length){const none=document.createElement('span');none.className='hand-empty';none.textContent='持ち駒なし';container.append(none);}
 }
 const top=flipped?0:1,bottom=1-top;
 // The rack IDs denote ownership. Moving them preserves event listeners and accessibility.
 const topHost=$('hand-top'),bottomHost=$('hand-bottom');if(topHost&&bottomHost){topHost.append($(`hand-${top}`));bottomHost.append($(`hand-${bottom}`));}
 if($('player-top'))$('player-top').textContent=`${sideName(top)}${top===settings.side?' · あなた':settings.mode==='play'?' · AI':' · 相手'}`;
 if($('player-bottom'))$('player-bottom').textContent=`${sideName(bottom)}${bottom===settings.side?' · あなた':settings.mode==='play'?' · AI':' · 相手'}`;
 for(const [place,owner]of[['top',top],['bottom',bottom]]){const el=$(`sidebadge-${place}`);if(el){el.textContent=owner===0?'▲':'△';el.classList.toggle('active',state().turn===owner);}}
}
function drawArrow(){const svg=$('arrow-layer');if(!svg)return;svg.setAttribute('viewBox','0 0 900 900');svg.replaceChildren();const m=activeMove();if(!m||m.from===null||m.drop)return;
 const a=boardIndexToDisplay(m.from),b=boardIndexToDisplay(m.to),x1=(a%9)*100+50,y1=Math.floor(a/9)*100+50,x2=(b%9)*100+50,y2=Math.floor(b/9)*100+50;
 svg.innerHTML='<defs><marker id="move-arrow" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 Z" fill="#ac6c2e"/></marker></defs>';
 const line=document.createElementNS('http://www.w3.org/2000/svg','line');for(const [key,value]of Object.entries({x1,y1,x2,y2,stroke:'#ac6c2e','stroke-width':10,'stroke-linecap':'round','marker-end':'url(#move-arrow)',opacity:'.76'}))line.setAttribute(key,String(value));svg.append(line);
}
function isAIturn(){return settings.mode==='play'&&state().turn!==settings.side;}
function clickSquare(i){
 if(gameResult().over){toast('終局しています。棋譜を戻すか、新しい対局を始めてください。');return;}
 if(isAIturn()){toast('AIが考えています。研究モードなら両者の手を入力できます。');return;}
 if(selected){const options=legal.filter(m=>m.to===i&&(selected.drop?m.drop===selected.drop:m.from===selected.from));if(options.length){if(options.length>1){pendingPromotion=options;$('promotion-dialog').showModal();}else commitMove(options[0]);return;}}
 if(state().board[i]?.owner===state().turn)selected=selected?.from===i?null:{from:i};else selected=null;
 renderBoard();
}
function commitMove(m){
 const verified=moveFromUSI(state(),moveToUSI(m));if(!verified){toast('この局面では指せない手です。再解析してください。');return;}
 clearTimeout(autoTimer);moves=moves.slice(0,cursor);states=states.slice(0,cursor+1);moves.push(verified);states.push(applyMove(state(),verified));cursor++;selected=null;pendingPromotion=null;persist();refreshPosition();
}
function refreshPosition(){legal=legalMoves(state());candidates=[];selectedCandidate=0;render();startAnalysis();}
function render(){
 renderBoard();renderHistory();renderGuide();
 $('move-counter').textContent=String(cursor);
 const result=gameResult();$('turn-label').textContent=result.over?resultText(result):`${sideName(state().turn)}の手番${isInCheck(state())?' · 王手':''}`;
 $('phase-label').textContent=result.over?'終局':cursor<20?'序盤':cursor<60?'中盤':'終盤';
 $('undo-btn').disabled=cursor===0;$('history-prev').disabled=cursor===0;$('history-next').disabled=cursor===moves.length;$('history-last').disabled=cursor===moves.length;
 $('apply-best-btn').disabled=true;
 renderCandidates();
}
function renderHistory(){const el=$('history-list');el.replaceChildren();if(!cursor){const p=document.createElement('p');p.className='history-empty';p.textContent='盤上の駒を選んで、最初の一手を。';el.append(p);}
 for(let i=0;i<moves.length;i++){const b=document.createElement('button');b.type='button';b.className='history-item'+(i+1===cursor?' current':'')+(i+1>cursor?' future':'');const n=document.createElement('small');n.textContent=String(i+1).padStart(2,'0');const label=document.createElement('span');label.textContent=moveLabel(states[i],moves[i]);b.append(n,label);b.addEventListener('click',()=>goTo(i+1));el.append(b);}
 const active=el.querySelector('.current');if(active){const a=active.getBoundingClientRect(),r=el.getBoundingClientRect();if(a.top<r.top)el.scrollTop+=a.top-r.top;else if(a.bottom>r.bottom)el.scrollTop+=a.bottom-r.bottom;}
}
function goTo(index){clearTimeout(autoTimer);cursor=Math.max(0,Math.min(moves.length,index));selected=null;persist();refreshPosition();}
function startAnalysis(){
 clearTimeout(autoTimer);requestId++;candidates=[];analysisBatches=new Map();latestCandidates=[];selectedCandidate=0;thinking=false;
 const result=gameResult();$('eval-label').textContent=result.over?resultText(result):'解析中';$('eval-score').textContent='—';$('eval-detail').textContent='評価は先手基準 · ＋は先手有利';$('eval-bar').style.width='50%';$('pv-line').textContent='読み筋を解析しています…';$('analysis-detail').textContent='局面をエンジンに送信';$('apply-best-btn').disabled=true;
 if(result.over){worker?.postMessage({type:'stop'});$('engine-status').textContent='終局';$('eval-detail').textContent=result.reason==='repetition'?'同一局面が4回出現しました。':'対局終了。棋譜を戻して検討できます。';$('pv-line').textContent='棋譜から局面を戻して検討できます。';$('analysis-detail').textContent='解析終了';renderCandidates();return;}
 if(engineFailed){$('engine-status').textContent='AI読込エラー';$('eval-label').textContent='評価を取得できません';$('analysis-detail').textContent='「再解析」で再読み込みしてください。';return;}
 thinking=true;$('engine-status').textContent='AI解析中';$('engine-status').classList.add('thinking');
 worker?.postMessage({type:'analyze',id:requestId,sfen:toSFEN(state()),initialSfen:toSFEN(states[0]),moves:moves.slice(0,cursor).map(moveToUSI),timeMs:settings.time,multiPV:3});renderCandidates();
}
function createEngine(){if(worker)worker.terminate();engineFailed=false;try{worker=new Worker(new URL('./engine-vendor/engine-worker.js',import.meta.url));worker.onmessage=handleEngine;worker.onerror=e=>engineError(e.message);worker.postMessage({type:'init'});}catch(e){engineError(e.message);}}
function engineError(message){engineFailed=true;thinking=false;$('engine-status').textContent='AI読込エラー';$('engine-status').classList.remove('thinking');$('eval-label').textContent='AIを読み込めません';$('analysis-detail').textContent='HTTP(S)で開き、「再解析」を押してください。';$('apply-best-btn').disabled=true;console.error('Engine:',message);}
function handleEngine(event){const msg=event.data;
 if(msg.type==='error'){engineError(msg.message);return;}
 if(msg.type==='ready'){engineName=msg.name||engineName;if(!thinking)$('engine-status').textContent='AI準備完了';return;}
 if(msg.id!==requestId)return;
 if(msg.type==='info'){
  if(!Array.isArray(msg.pv)||!msg.pv.length)return;const move=moveFromUSI(state(),msg.pv[0]);if(!move)return;
  const index=Math.max(0,(msg.multipv||msg.multiPV||1)-1);if(index>2)return;
  const entry={...msg,move};latestCandidates[index]=entry;let batch=analysisBatches.get(msg.depth)||[];batch[index]=entry;analysisBatches.set(msg.depth,batch);const expected=Math.min(3,legal.length);if(Array.from({length:expected},(_,i)=>batch[i]).every(Boolean)){candidates=batch.slice(0,expected);renderCandidates();renderEvaluation(candidates[0]);renderBoard();}
  $('analysis-detail').textContent=`深さ ${msg.depth||'—'} · ${Number(msg.nodes||0).toLocaleString('ja-JP')}局面 · ${((msg.time||0)/1000).toFixed(1)}秒`;
 }
 if(msg.type==='done'){
  if(msg.bestmove==='win'||msg.bestmove==='resign'){engineResults.set(positionKey(state()),{over:true,reason:msg.bestmove==='win'?'declaration':'resign',winner:msg.bestmove==='win'?state().turn:1-state().turn});refreshPosition();return;}
  thinking=false;$('engine-status').classList.remove('thinking');$('engine-status').textContent='解析完了';
  if(msg.bestmove){const move=moveFromUSI(state(),msg.bestmove);if(move&&(!candidates[0]||moveToUSI(candidates[0].move)!==msg.bestmove)){const matching=latestCandidates.find(c=>c&&moveToUSI(c.move)===msg.bestmove)||candidates.find(c=>c&&moveToUSI(c.move)===msg.bestmove);const top=matching||{move,pv:[msg.bestmove],score:null,depth:0};candidates=[top,...candidates.filter(c=>c&&moveToUSI(c.move)!==msg.bestmove)].slice(0,3);selectedCandidate=0;if(top.score)renderEvaluation(top);else{$('eval-label').textContent='評価値未確定';$('eval-score').textContent='—';}}}
  renderCandidates();renderBoard();
  if(candidates[0]){$('apply-best-btn').disabled=isAIturn();if(isAIturn()&&cursor===moves.length){const id=requestId;autoTimer=setTimeout(()=>{if(id===requestId&&isAIturn()&&candidates[0])commitMove(candidates[0].move);},450);}}
  else{$('eval-label').textContent='候補を取得できません';$('analysis-detail').textContent='再解析してください。';}
 }
}
function scoreNumber(info){if(!info?.score)return null;const s=info.score;if(typeof s.mate==='number')return Math.sign(s.mate||1)*30000;if(typeof s.cp==='number')return s.cp;if(s.type==='cp')return Number(s.value);if(s.type==='mate')return Math.sign(Number(s.value)||1)*30000;return null;}
function scoreLabel(info,sente=false){if(!info?.score)return '—';let sign=sente&&state().turn===1?-1:1;const score=info.score;const mate=typeof score.mate==='number'?score.mate:score.type==='mate'?Number(score.value):null;if(mate!==null)return `${mate*sign<0?'−':''}詰 ${Math.abs(mate)}`;const n=scoreNumber(info)*sign;return `${n>0?'+':''}${n}`;}
function renderEvaluation(info){const score=scoreNumber(info);if(score===null)return;const sente=score*(state().turn===0?1:-1),abs=Math.abs(sente);let label=abs<160?'互角':`${sideName(sente>0?0:1)}${abs<550?'やや有利':abs<1400?'優勢':'勝勢'}`;if(abs>=29000)label=`${sideName(sente>0?0:1)}に詰み筋`;
 $('eval-label').textContent=label;$('eval-score').textContent=scoreLabel(info,true);$('eval-bar').style.width=`${Math.max(3,Math.min(97,50+47*Math.tanh(sente/1300)))}%`;$('eval-detail').textContent='先手基準の評価値 · バーは形勢の目安（勝率ではありません）';
}
function renderCandidates(){
 const el=$('candidates');el.replaceChildren();const ready=candidates.some(Boolean);
 if(!ready){const p=document.createElement('p');p.className='candidate-empty';p.textContent=gameResult().over?'この対局は終了しました。':engineFailed?'再解析でAIを読み込み直せます。':'AIが候補手を比較しています…';el.append(p);}
 candidates.forEach((c,i)=>{if(!c)return;const button=document.createElement('button');button.type='button';button.className='candidate'+(i===selectedCandidate?' active':'');button.setAttribute('aria-pressed',String(i===selectedCandidate));const rank=document.createElement('span');rank.className='candidate-rank';rank.textContent=String(i+1).padStart(2,'0');const move=document.createElement('strong');move.className='candidate-move';move.textContent=moveLabel(state(),c.move);const score=document.createElement('span');score.className='candidate-score';score.textContent=scoreLabel(c,true);const depth=document.createElement('small');depth.className='candidate-depth';depth.textContent=c.depth?`深さ${c.depth}`:'';button.append(rank,move,depth,score);button.addEventListener('click',()=>{selectedCandidate=i;renderCandidates();renderBoard();});el.append(button);});
 const active=candidates[selectedCandidate];if(active){let s=cloneState(state()),line=[];for(const usi of (active.pv||[]).slice(0,8)){const m=moveFromUSI(s,usi);if(!m)break;line.push(moveLabel(s,m));s=applyMove(s,m);}$('pv-line').textContent=line.join(' → ');}
 $('apply-best-btn').disabled=!active||thinking||isAIturn()||gameResult().over;
 const b=$('apply-best-btn');if(b){const text=b.querySelector('span');if(text)text.textContent=selectedCandidate?'選択した候補を指す':'推奨手を指す';}
}
const strategyData={
 auto:{name:'AIにおまかせ',text:'局面に合わせて、攻めと守りのバランスがよい手を比較します。',moves:['7g7f','2g2f']},
 ibisha:{name:'居飛車',text:'飛車を右側に据え、飛車先の歩を伸ばして攻めの足場をつくります。',moves:['2g2f','2f2e','7g7f']},
 yagura:{name:'矢倉',text:'角道を開けたら銀を上げ、金銀で玉を厚く囲う構想です。相手の速攻にも注意。',moves:['7g7f','7i6h','6g6f','6h7g','6i7h']},
 shiken:{name:'四間飛車',text:'角道を開けてから止め、飛車を6筋へ。玉は反対側で囲います。',moves:['7g7f','6g6f','2h6h','3i4h','5i4h']},
 sanken:{name:'三間飛車',text:'飛車を7筋に振り、角と連携して左側から動く構想です。',moves:['7g7f','6g6f','2h7h','3i4h']},
 nakabisha:{name:'中飛車',text:'中央の歩を伸ばし、飛車を5筋へ。中央の主導権を目指します。',moves:['5g5f','5f5e','2h5h','7g7f']}
};
function rotateUSI(usi){return usi.replace(/([1-9])([a-i])/g,(_,f,r)=>`${10-Number(f)}${String.fromCharCode(202-r.charCodeAt(0))}`);}
function guideMove(){if(cursor>16||state().turn!==settings.side||isInCheck(state()))return null;for(const usi of strategyData[settings.strategy].moves){const m=moveFromUSI(state(),settings.side===1?rotateUSI(usi):usi);if(m)return m;}return null;}
function renderGuide(){const d=strategyData[settings.strategy],s=state(),guide=guideMove();let text=d.text;if(s.turn!==settings.side)text=settings.mode==='play'?'AIが相手の指し手を考えています。着手後に、あなたの次の一手を解析します。':`${sideName(s.turn)}の指し手を盤上で入力すると、その局面での応手を再解析します。`;else if(guide)text=`${d.name}の参考手：${moveLabel(s,guide)}。${d.text}`;else if(isInCheck(s))text='王手されています。まず玉の安全を確保できる候補手を確認してください。';$('advice-text').textContent=text;
 let button=$('guide-move-btn');if(!button){button=document.createElement('button');button.id='guide-move-btn';button.className='guide-button';button.type='button';$('advice-text').after(button);button.addEventListener('click',()=>{const m=guideMove();if(m)commitMove(m);});}
 button.hidden=!guide||gameResult().over;button.textContent=guide?`戦法の参考手 ${moveLabel(s,guide)} を指す`:'';
}
function reset(){clearTimeout(autoTimer);engineResults.clear();states=[initialState()];moves=[];cursor=0;selected=null;flipped=settings.side===1;persist();refreshPosition();}
function bind(){
 $('side-select').value=settings.side;$('strategy-select').value=settings.strategy;$('mode-select').value=settings.mode;$('time-select').value=settings.time;
 $('side-select').addEventListener('change',e=>{settings.side=Number(e.target.value);flipped=settings.side===1;persist();refreshPosition();});
 $('strategy-select').addEventListener('change',e=>{settings.strategy=e.target.value;persist();renderGuide();toast('戦法は序盤の参考手に反映されます。AI候補は探索の推奨順です。');});
 $('mode-select').addEventListener('change',e=>{settings.mode=e.target.value;persist();refreshPosition();});
 $('time-select').addEventListener('change',e=>{settings.time=Number(e.target.value);persist();startAnalysis();});
 $('new-game').addEventListener('click',()=>{$('reset-dialog').showModal();});$('reset-confirm').addEventListener('click',()=>{$('reset-dialog').close();reset();});$('reset-cancel').addEventListener('click',()=>$('reset-dialog').close());
 $('undo-btn').addEventListener('click',()=>{const count=settings.mode==='play'&&cursor>1&&state().turn===settings.side?2:1;const next=Math.max(0,cursor-count);moves=moves.slice(0,next);states=states.slice(0,next+1);goTo(next);});
 $('flip-btn').addEventListener('click',()=>{flipped=!flipped;renderBoard();});
 $('analyze-btn').addEventListener('click',()=>{if(engineFailed)createEngine();startAnalysis();});
 $('apply-best-btn').addEventListener('click',()=>{const m=activeMove();if(m)commitMove(m);});
 $('history-prev').addEventListener('click',()=>goTo(cursor-1));$('history-next').addEventListener('click',()=>goTo(cursor+1));$('history-last').addEventListener('click',()=>goTo(moves.length));
 for(const [id,promote]of[['promo-yes',true],['promo-no',false]])$(id).addEventListener('click',()=>{const m=pendingPromotion?.find(x=>Boolean(x.promote)===promote);$('promotion-dialog').close();if(m)commitMove(m);});
 $('promotion-dialog').addEventListener('cancel',()=>{pendingPromotion=null;});
 $('help-btn').addEventListener('click',()=>$('help-dialog').showModal());$('close-help').addEventListener('click',()=>$('help-dialog').close());
 $('import-btn').addEventListener('click',()=>{$('sfen-input').value='';$('import-error').textContent='';$('import-dialog').showModal();});$('import-cancel').addEventListener('click',()=>$('import-dialog').close());
 $('import-confirm').addEventListener('click',()=>{try{const loaded=decodeGame($('sfen-input').value);states=loaded.states;moves=loaded.moves;cursor=moves.length;selected=null;$('import-dialog').close();persist();refreshPosition();toast('局面・棋譜を読み込みました。');}catch(e){$('import-error').textContent=`読み込めません：${e.message}`;}});
 const file=document.createElement('input');file.type='file';file.accept='.json,.sfen,.txt';file.id='import-file';file.className='import-file';file.setAttribute('aria-label','棋譜ファイルを選ぶ');$('sfen-input').before(file);file.addEventListener('change',async()=>{const f=file.files[0];if(!f)return;if(f.size>1024*1024){toast('棋譜ファイルは1MB以下にしてください。');return;}$('sfen-input').value=await f.text();});
 $('export-btn').addEventListener('click',()=>{const data={version:1,site:'将棋名人',initialSfen:toSFEN(states[0]),moves:moves.slice(0,cursor).map(moveToUSI),sfen:toSFEN(state())};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`shogi-meijin-${new Date().toISOString().slice(0,10)}-${cursor}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('棋譜を保存しました。読込から続きを再開できます。');});
 document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)||document.querySelector('dialog[open]'))return;if(e.key==='ArrowLeft'){e.preventDefault();goTo(cursor-1);}if(e.key==='ArrowRight'){e.preventDefault();goTo(cursor+1);}if(e.key==='Escape'){selected=null;renderBoard();}});
}
restore();bind();createEngine();refreshPosition();
