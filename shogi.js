/** Dependency-free standard shogi rules. Sente is 0; index = rank * 9 + (9 - file). */
export const PIECE_LABELS = Object.freeze({ P: '歩', L: '香', N: '桂', S: '銀', G: '金', B: '角', R: '飛', K: '玉', '+P': 'と', '+L': '成香', '+N': '成桂', '+S': '成銀', '+B': '馬', '+R': '龍' });
export const PIECE_VALUES = Object.freeze({ P: 100, L: 300, N: 320, S: 450, G: 550, B: 800, R: 1000, K: 20000, '+P': 550, '+L': 550, '+N': 550, '+S': 550, '+B': 1100, '+R': 1300 });
const HAND_TYPES = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];
const PROMOTABLE = new Set(['P', 'L', 'N', 'S', 'B', 'R']);
const START_SFEN = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';
const KING = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
const GOLD = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]];
const SILVER = [[-1,-1],[0,-1],[1,-1],[-1,1],[1,1]];
const ORTHOGONAL = [[0,-1],[-1,0],[1,0],[0,1]];
const DIAGONAL = [[-1,-1],[1,-1],[-1,1],[1,1]];
const emptyHands = () => ({ P:0, L:0, N:0, S:0, G:0, B:0, R:0 });
const inBoard = (x,y) => x >= 0 && x < 9 && y >= 0 && y < 9;
const inZone = (y,owner) => owner === 0 ? y <= 2 : y >= 6;
const deadRank = (type,y,owner) => (type === 'P' || type === 'L') ? y === (owner ? 8 : 0) : type === 'N' && (owner ? y >= 7 : y <= 1);
const unpromote = type => type.replace('+','');

export function initialState() { return fromSFEN(START_SFEN); }

export function cloneState(s) {
  return { board:s.board.map(p => p ? {...p} : null), hands:s.hands.map(h => ({...h})), turn:s.turn, moveNumber:s.moveNumber };
}

function movement(type) {
  switch (type) {
    case 'K': return { steps:KING, slides:[] };
    case 'G': case '+P': case '+L': case '+N': case '+S': return { steps:GOLD, slides:[] };
    case 'S': return { steps:SILVER, slides:[] };
    case 'N': return { steps:[[-1,-2],[1,-2]], slides:[] };
    case 'P': return { steps:[[0,-1]], slides:[] };
    case 'L': return { steps:[], slides:[[0,-1]] };
    case 'B': return { steps:[], slides:DIAGONAL };
    case 'R': return { steps:[], slides:ORTHOGONAL };
    case '+B': return { steps:ORTHOGONAL, slides:DIAGONAL };
    case '+R': return { steps:DIAGONAL, slides:ORTHOGONAL };
    default: return { steps:[], slides:[] };
  }
}

/** Attack map includes pinned pieces, as required when determining king safety. */
function attacksSquare(s,from,target) {
  const p=s.board[from];
  const fx=from%9, fy=Math.floor(from/9), tx=target%9, ty=Math.floor(target/9);
  const dx=tx-fx, dy=ty-fy, direction=p.owner ? -1 : 1;
  const {steps,slides}=movement(p.type);
  if (steps.some(([x,y]) => x === dx && y*direction === dy)) return true;
  for (const [sx,sy0] of slides) {
    const sy=sy0*direction;
    if (sx === 0 ? dx !== 0 || dy*sy <= 0 : sy === 0 ? dy !== 0 || dx*sx <= 0 : Math.abs(dx)!==Math.abs(dy) || dx*sx <= 0 || dy*sy <= 0) continue;
    let x=fx+sx, y=fy+sy;
    while (inBoard(x,y)) {
      const i=y*9+x;
      if (i === target) return true;
      if (s.board[i]) break;
      x+=sx; y+=sy;
    }
  }
  return false;
}

export function isInCheck(s,side=s.turn) {
  const king=s.board.findIndex(p => p && p.owner === side && p.type === 'K');
  if (king < 0) return true;
  for (let i=0;i<81;i++) {
    if (s.board[i] && s.board[i].owner !== side && attacksSquare(s,i,king)) return true;
  }
  return false;
}

function pseudoMoves(s) {
  const moves=[];
  for (let from=0;from<81;from++) {
    const p=s.board[from];
    if (!p || p.owner !== s.turn) continue;
    const fx=from%9, fy=Math.floor(from/9), direction=p.owner ? -1 : 1;
    const {steps,slides}=movement(p.type);
    const add=(x,y) => {
      if (!inBoard(x,y)) return false;
      const to=y*9+x, occupant=s.board[to];
      if (occupant && (occupant.owner === p.owner || occupant.type === 'K')) return false;
      const canPromote=PROMOTABLE.has(p.type) && (inZone(fy,p.owner) || inZone(y,p.owner));
      if (!deadRank(p.type,y,p.owner)) moves.push({from,to,promote:false,drop:null});
      if (canPromote) moves.push({from,to,promote:true,drop:null});
      return !occupant;
    };
    for (const [dx,dy] of steps) add(fx+dx,fy+dy*direction);
    for (const [dx,dy] of slides) {
      let x=fx+dx,y=fy+dy*direction;
      while (inBoard(x,y)) {
        if (!add(x,y)) break;
        x+=dx; y+=dy*direction;
      }
    }
  }
  for (const type of HAND_TYPES) {
    if (!(s.hands[s.turn][type] > 0)) continue;
    const pawnFiles=new Set(type === 'P' ? s.board.flatMap((p,i) => p && p.owner === s.turn && p.type === 'P' ? [i%9] : []) : []);
    for (let to=0;to<81;to++) {
      if (s.board[to] || deadRank(type,Math.floor(to/9),s.turn) || pawnFiles.has(to%9)) continue;
      moves.push({from:null,to,promote:false,drop:type});
    }
  }
  return moves;
}

/** Apply a structurally valid move without checking legality; call legalMoves first. */
export function applyMove(s,m) {
  if (!m || !Number.isInteger(m.to) || m.to < 0 || m.to >= 81) throw new Error('移動先が不正です。');
  const next=cloneState(s), target=next.board[m.to];
  if (m.drop) {
    if (!HAND_TYPES.includes(m.drop) || next.hands[s.turn][m.drop] < 1 || target) throw new Error('持ち駒を打てません。');
    next.hands[s.turn][m.drop]--;
    next.board[m.to]={type:m.drop,owner:s.turn};
  } else {
    if (!Number.isInteger(m.from) || m.from < 0 || m.from >= 81) throw new Error('移動元が不正です。');
    const piece=next.board[m.from];
    if (!piece || piece.owner !== s.turn || (target && (target.owner === s.turn || target.type === 'K'))) throw new Error('その駒は移動できません。');
    if (target) next.hands[s.turn][unpromote(target.type)]++;
    if (m.promote && !PROMOTABLE.has(piece.type)) throw new Error('その駒は成れません。');
    next.board[m.to]={type:m.promote ? '+'+piece.type : piece.type,owner:piece.owner};
    next.board[m.from]=null;
  }
  next.turn=1-s.turn;
  next.moveNumber=s.moveNumber+1;
  return next;
}

function collectLegal(s,skipPawnMate=false,firstOnly=false) {
  const moves=[];
  for (const m of pseudoMoves(s)) {
    const next=applyMove(s,m);
    if (isInCheck(next,s.turn)) continue;
    // A checking pawn drop cannot be blocked by a drop, so defensive generation
    // may safely skip the pawn-drop-mate recursion when testing its replies.
    if (!skipPawnMate && m.drop === 'P' && isInCheck(next,next.turn) && collectLegal(next,true,true).length === 0) continue;
    moves.push(m);
    if (firstOnly) return moves;
  }
  return moves;
}

export function legalMoves(s) { return collectLegal(s); }

export function terminalStatus(s) {
  if (collectLegal(s,false,true).length) return {over:false,reason:null,winner:null};
  return {over:true,reason:isInCheck(s) ? 'checkmate' : 'no-legal-moves',winner:1-s.turn};
}

const squareUSI = i => String(9-i%9)+String.fromCharCode(97+Math.floor(i/9));
const squareIndex = text => (text.charCodeAt(1)-97)*9+(9-Number(text[0]));

export function moveToUSI(m) { return m.drop ? m.drop+'*'+squareUSI(m.to) : squareUSI(m.from)+squareUSI(m.to)+(m.promote ? '+' : ''); }

/** Engine/import moves are only accepted when legal in this exact position. */
export function moveFromUSI(s,text) {
  if (typeof text !== 'string') return null;
  text=text.trim();
  if (!/^(?:[PLNSGBR]\*[1-9][a-i]|[1-9][a-i][1-9][a-i]\+?)$/.test(text)) return null;
  const drop=text[1] === '*' ? text[0] : null;
  const from=drop ? null : squareIndex(text.slice(0,2));
  const to=squareIndex(text.slice(2,4));
  const promote=!drop && text.endsWith('+');
  return legalMoves(s).find(m => m.from === from && m.to === to && m.drop === drop && m.promote === promote) || null;
}

export function moveLabel(s,m) {
  if (!m) return '—';
  const type=m.drop || s.board[m.from]?.type;
  return (s.turn === 0 ? '▲' : '△')+'９８７６５４３２１'[m.to%9]+'一二三四五六七八九'[Math.floor(m.to/9)]+(PIECE_LABELS[type] || '?')+(m.promote ? '成' : '')+(m.drop ? '打' : '');
}

export function toSFEN(s) {
  const ranks=[];
  for (let y=0;y<9;y++) {
    let row='',empty=0;
    for (let x=0;x<9;x++) {
      const p=s.board[y*9+x];
      if (!p) { empty++; continue; }
      if (empty) { row+=empty; empty=0; }
      row+=p.owner === 0 ? p.type : p.type.toLowerCase();
    }
    if (empty) row+=empty;
    ranks.push(row);
  }
  let hand='';
  for (let side=0;side<2;side++) for (const type of HAND_TYPES) {
    const n=s.hands[side][type];
    if (n) hand+=(n > 1 ? String(n) : '')+(side === 0 ? type : type.toLowerCase());
  }
  return ranks.join('/')+' '+(s.turn === 0 ? 'b' : 'w')+' '+(hand || '-')+' '+s.moveNumber;
}

export function positionKey(s) { return toSFEN(s).split(' ').slice(0,3).join(' '); }

/** Parse bounded SFEN. Incomplete material is allowed for exercises, impossible
 * inventories, kings, nifu, dead unpromoted pieces, and an attacked nonmoving king are rejected. */
export function fromSFEN(input) {
  if (typeof input !== 'string' || input.length > 512) throw new Error('SFENは512文字以内で入力してください。');
  const text=input.trim().replace(/^sfen\s+/,''), parts=text.split(/\s+/);
  if (parts.length !== 4 || !/^[bw]$/.test(parts[1]) || !/^[1-9]\d{0,6}$/.test(parts[3])) throw new Error('SFENの形式が正しくありません。盤面・手番・持ち駒・手数を指定してください。');
  const ranks=parts[0].split('/');
  if (ranks.length !== 9) throw new Error('SFENの盤面は9段で指定してください。');
  const s={board:Array(81).fill(null),hands:[emptyHands(),emptyHands()],turn:parts[1] === 'b' ? 0 : 1,moveNumber:Number(parts[3])};
  for (let y=0;y<9;y++) {
    let x=0;
    for (let i=0;i<ranks[y].length;i++) {
      let char=ranks[y][i],promoted=false;
      if (/^[1-9]$/.test(char)) { x+=Number(char); if (x>9) throw new Error('SFENの各段は9マス必要です。'); continue; }
      if (char === '+') { promoted=true; char=ranks[y][++i]; }
      if (!char || !/^[PLNSGBRKplnsgbrk]$/.test(char) || x >= 9) throw new Error('SFENの駒表記が正しくありません。');
      const base=char.toUpperCase(),owner=char === base ? 0 : 1;
      if (promoted && !PROMOTABLE.has(base)) throw new Error('金将と玉将は成れません。');
      s.board[y*9+x++]={type:(promoted ? '+' : '')+base,owner};
    }
    if (x !== 9) throw new Error('SFENの各段は9マス必要です。');
  }
  if (parts[2] !== '-') {
    if (!/^(?:[1-9]\d*)?[RBGSNLPrbgsnlp](?:(?:[1-9]\d*)?[RBGSNLPrbgsnlp])*$/.test(parts[2])) throw new Error('SFENの持ち駒が正しくありません。');
    const used=new Set();
    for (const match of parts[2].matchAll(/(\d*)([RBGSNLPrbgsnlp])/g)) {
      const char=match[2],base=char.toUpperCase(),owner=char === base ? 0 : 1,n=match[1] ? Number(match[1]) : 1;
      if (used.has(char) || n > 18) throw new Error('SFENの持ち駒の数が正しくありません。');
      used.add(char); s.hands[owner][base]=n;
    }
  }
  const maximum={P:18,L:4,N:4,S:4,G:4,B:2,R:2,K:2}, totals={P:0,L:0,N:0,S:0,G:0,B:0,R:0,K:0},kings=[0,0],pawnFiles=[new Set(),new Set()];
  for (let i=0;i<81;i++) {
    const p=s.board[i]; if (!p) continue;
    totals[unpromote(p.type)]++;
    if (p.type === 'K') kings[p.owner]++;
    if (deadRank(p.type,Math.floor(i/9),p.owner)) throw new Error('動けない位置の歩・香・桂は成駒にしてください。');
    if (p.type === 'P') {
      if (pawnFiles[p.owner].has(i%9)) throw new Error('二歩の局面は読み込めません。');
      pawnFiles[p.owner].add(i%9);
    }
  }
  for (const h of s.hands) for (const type of HAND_TYPES) totals[type]+=h[type];
  if (kings[0] !== 1 || kings[1] !== 1) throw new Error('先手・後手の玉将を1枚ずつ配置してください。');
  for (const type of Object.keys(maximum)) if (totals[type] > maximum[type]) throw new Error('将棋の駒の総数を超えています。');
  if (isInCheck(s,1-s.turn)) throw new Error('手番ではない側の玉に王手がかかっています。手番を確認してください。');
  return s;
}
