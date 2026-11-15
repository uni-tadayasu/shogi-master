/** Interactive, legal strategy line editing. Copyright KASAI SOLUTIONS INC. GPL-3.0-or-later. */
import {decodeGame} from './game-record.js';
import {legalMoves,moveFromUSI,moveToUSI,moveLabel,toSFEN,PIECE_LABELS,isInCheck} from './shogi.js';

export function studyLine(initialSfen,moves=[]){
 const record=decodeGame({initialSfen,moves});
 return {initialSfen:toSFEN(record.states[0]),moves:record.moves.map(moveToUSI),future:[]};
}
export function studyPosition(line){return decodeGame({initialSfen:line.initialSfen,moves:line.moves}).states.at(-1);}
export function stepStudyBack(line){if(!line.moves.length)return line;return {...line,moves:line.moves.slice(0,-1),future:[line.moves.at(-1),...line.future]};}
export function stepStudyForward(line){if(!line.future.length)return line;return {...line,moves:[...line.moves,line.future[0]],future:line.future.slice(1)};}
export function appendStudyMove(line,usi,{replaceFuture=false}={}){
 if(line.moves.length>=512)throw Error('独自戦法は512手以内にしてください。');
 if(line.future.length&&!replaceFuture)throw Error('戻した先の手順があります。分岐して作り直すか選んでください。');
 const move=moveFromUSI(studyPosition(line),usi);if(!move)throw Error('その手は現在の局面では指せません。');
 return {...line,moves:[...line.moves,moveToUSI(move)],future:[]};
}

export function mountStudyBoard(host,{onChange=()=>{},onStatus=()=>{}}={}){
 host.innerHTML=`<div class="study-heading"><h3>盤上で構想を育てる</h3><span id="studio-board-turn" role="status"></span></div><p class="studio-help">両者の駒を交互に動かせます。AI候補を指すか、自分の着想を試してください。</p><div class="study-hands" id="studio-hand-top" aria-label="上側の持ち駒"></div><div class="study-board-wrap"><div id="studio-board" class="study-board" role="group" aria-label="独自戦法の将棋盤"></div></div><div class="study-hands" id="studio-hand-bottom" aria-label="下側の持ち駒"></div><div class="study-promotion" id="studio-promotion" hidden><p>この駒を成りますか？</p><button type="button" id="studio-promote-yes" class="button button-primary">成る</button><button type="button" id="studio-promote-no" class="button button-outline">成らない</button><button type="button" id="studio-promote-cancel" class="button button-outline">キャンセル</button></div><div class="study-branch" id="studio-branch" hidden><p>ここから新しい手順に分岐します。戻した先の手順は置き換わります。</p><button type="button" id="studio-branch-yes" class="button button-primary">この手から作り直す</button><button type="button" id="studio-branch-no" class="button button-outline">元の手順を残す</button></div><div class="study-toolbar"><button type="button" id="studio-undo" class="button button-outline">一手戻す</button><button type="button" id="studio-redo" class="button button-outline">やり直す</button><button type="button" id="studio-flip" class="button button-outline">盤面反転</button></div><p class="study-position-note" id="studio-board-note" role="status"></p>`;
 const $=id=>host.querySelector('#'+id);
 let line=null,state=null,selection=null,promotion=null,pendingBranch=null,flipped=false,enabled=true;
 function resetSelection(){selection=null;promotion=null;pendingBranch=null;$('studio-promotion').hidden=true;$('studio-branch').hidden=true;}
 function emit(next,message){line=next;resetSelection();render();onChange([...line.moves],message);}
 function apply(usi){try{if(!enabled||!line)return;if(line.future.length){pendingBranch=usi;$('studio-branch').hidden=false;$('studio-promotion').hidden=true;return;}emit(appendStudyMove(line,usi),'手順を一手追加しました。');}catch(e){onStatus(e.message,true);}}
 function chooseSquare(index){if(!state||!enabled||promotion||pendingBranch)return;
  const moves=legalMoves(state);
  if(selection){const candidates=moves.filter(m=>m.to===index&&(selection.drop?m.drop===selection.drop:m.from===selection.from&&!m.drop));if(candidates.length===1){apply(moveToUSI(candidates[0]));return;}if(candidates.length>1){promotion=candidates;$('studio-promotion').hidden=false;return;}}
  const piece=state.board[index];selection=piece?.owner===state.turn?{from:index}:null;render();
 }
 function hand(side,el){el.replaceChildren();const label=document.createElement('strong');label.textContent=side===0?'▲先手':'△後手';el.append(label);let count=0;for(const type of ['R','B','G','S','N','L','P']){const n=state?.hands[side][type]||0;if(!n)continue;count++;const b=document.createElement('button');b.type='button';b.className='study-hand-piece'+(selection?.drop===type&&state.turn===side?' is-selected':'');b.textContent=PIECE_LABELS[type]+' '+n;b.setAttribute('aria-label',`${side===0?'先手':'後手'}の持ち駒 ${PIECE_LABELS[type]} ${n}枚`);b.disabled=!enabled||side!==state.turn;b.addEventListener('click',()=>{if(promotion||pendingBranch)return;selection=selection?.drop===type?null:{drop:type};render();});el.append(b);}if(!count){const empty=document.createElement('span');empty.textContent='持ち駒なし';el.append(empty);}}
 function render(){if(!line)return;state=studyPosition(line);const moves=enabled?legalMoves(state):[],targets=new Set(selection?moves.filter(m=>selection.drop?m.drop===selection.drop:m.from===selection.from&&!m.drop).map(m=>m.to):[]),board=$('studio-board');board.replaceChildren();board.setAttribute('aria-disabled',String(!enabled));for(let display=0;display<81;display++){const i=flipped?80-display:display,p=state.board[i],button=document.createElement('button');button.type='button';button.className='study-square'+(selection?.from===i?' is-selected':'')+(targets.has(i)?' is-target':'');button.setAttribute('aria-label',`${9-i%9}${'一二三四五六七八九'[Math.floor(i/9)]} ${p?`${p.owner===0?'先手':'後手'} ${PIECE_LABELS[p.type]}`:'空きマス'}`);button.disabled=!enabled;const coords=document.createElement('small');coords.className='study-coord';if(display<9)coords.textContent=9-i%9;button.append(coords);if(p){const piece=document.createElement('span');piece.className='study-piece'+(p.owner===(flipped?0:1)?' is-opponent':'')+(p.type.startsWith('+')?' is-promoted':'')+(PIECE_LABELS[p.type].length>1?' is-multi':'');piece.textContent=PIECE_LABELS[p.type];button.append(piece);}button.addEventListener('click',()=>chooseSquare(i));board.append(button);}hand(flipped?0:1,$('studio-hand-top'));hand(flipped?1:0,$('studio-hand-bottom'));$('studio-undo').disabled=!enabled||!line.moves.length;$('studio-redo').disabled=!enabled||!line.future.length;$('studio-board-turn').textContent=`${line.moves.length}手目 · ${state.turn===0?'先手▲':'後手△'}の手番${isInCheck(state)?'・王手':''}`;$('studio-board-note').textContent=enabled?`${line.moves.length}手目までを保存・解析します。${line.future.length?` 戻した先に${line.future.length}手あります。`:''}`:'手順の入力を修正すると、盤上での編集を再開できます。';}
 $('studio-undo').addEventListener('click',()=>emit(stepStudyBack(line),'一手戻しました。やり直すボタンで元に戻せます。'));
 $('studio-redo').addEventListener('click',()=>emit(stepStudyForward(line),'元の手順を一手進めました。'));
 $('studio-flip').addEventListener('click',()=>{flipped=!flipped;resetSelection();render();});
 for(const [id,promote]of [['studio-promote-yes',true],['studio-promote-no',false]])$(id).addEventListener('click',()=>{const m=promotion?.find(x=>x.promote===promote);promotion=null;$('studio-promotion').hidden=true;if(m)apply(moveToUSI(m));});
 $('studio-promote-cancel').addEventListener('click',()=>{resetSelection();render();});
 $('studio-branch-yes').addEventListener('click',()=>{try{if(pendingBranch)emit(appendStudyMove(line,pendingBranch,{replaceFuture:true}),'新しい手順に分岐しました。');}catch(e){onStatus(e.message,true);}});
 $('studio-branch-no').addEventListener('click',()=>{resetSelection();render();});
 return {
  setLine(sfen,moves,{keepFuture=false,side=0}={}){const next=studyLine(sfen,moves);if(keepFuture&&line&&next.initialSfen===line.initialSfen&&next.moves.join(' ')===line.moves.join(' '))next.future=[...line.future];line=next;flipped=side===1;enabled=true;resetSelection();render();},
  invalidate(){enabled=false;resetSelection();render();},
  append(usi){apply(usi);},
  getLine(){return line?{...line,moves:[...line.moves],future:[...line.future]}:null;}
 };
}
