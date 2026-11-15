/** Browser speech output only. No microphone, recording, or external API is used. */
const PIECE_SPEECH = Object.freeze({P:'歩',L:'香車',N:'桂馬',S:'銀',G:'金',B:'角',R:'飛車',K:'玉','+P':'と金','+L':'成香','+N':'成桂','+S':'成銀','+B':'馬','+R':'龍'});
const sideName = side => side === 0 ? '先手' : '後手';
const squareName = index => `${9 - index % 9}筋${Math.floor(index / 9) + 1}段`;
const isSquare = n => Number.isInteger(n) && n >= 0 && n < 81;

/** Read origin and destination explicitly so blind listeners can follow the board. */
export function moveNarration(stateBefore, move, ply) {
  if (!stateBefore || !move || !isSquare(move.to)) return '';
  const piece = move.drop || (isSquare(move.from) ? stateBefore.board?.[move.from]?.type : null);
  if (!PIECE_SPEECH[piece]) return '';
  const count = Number.isInteger(ply) && ply > 0 ? `${ply}手目。` : '';
  const from = move.drop ? '持ち駒の' : `${squareName(move.from)}から${squareName(move.to)}へ、`;
  let message = `${count}${sideName(stateBefore.turn)}。${from}${PIECE_SPEECH[piece]}`;
  message += move.drop ? `を${squareName(move.to)}に打ちました。` : 'を動かしました。';
  const taken = stateBefore.board?.[move.to];
  if (!move.drop && taken && taken.owner !== stateBefore.turn) message += `${PIECE_SPEECH[taken.type] || '駒'}を取りました。`;
  if (move.promote) message += '成りました。';
  return message;
}

/** Positive cp/mate values always mean sente is ahead, regardless of whose turn. */
export function evaluationNarration(cpSente, {mateSente = null} = {}) {
  if (typeof mateSente === 'number' && Number.isFinite(mateSente)) {
    const winner = mateSente < 0 ? '後手' : '先手';
    return `AI解析では、${winner}に詰み筋があります。`;
  }
  if (typeof cpSente !== 'number' || !Number.isFinite(cpSente)) return '形勢の評価はまだ確定していません。';
  const value = Math.abs(cpSente);
  if (value < 160) return 'AI解析では、形勢は互角です。';
  const leader = cpSente > 0 ? '先手' : '後手', other = cpSente > 0 ? '後手' : '先手';
  if (value < 550) return `AI解析では、${leader}がやや有利、${other}がやや不利です。`;
  if (value < 1400) return `AI解析では、${leader}が優勢、${other}が劣勢です。`;
  return `AI解析では、${leader}が大きく優勢、${other}が大きく劣勢です。`;
}

/**
 * Start OFF on every load. setEnabled(true) must be called from a user gesture.
 * platform may inject {speechSynthesis, SpeechSynthesisUtterance} for tests.
 * A Japanese voice is required; there is no English-voice fallback.
 */
export function createNarrator({onStatus = () => {}, onTranscript = () => {}, onVoices = () => {}, platform = globalThis} = {}) {
  const synth = platform?.speechSynthesis;
  const Utterance = platform?.SpeechSynthesisUtterance;
  const supported = Boolean(synth && typeof synth.speak === 'function' && typeof synth.cancel === 'function' && typeof Utterance === 'function');
  let enabled = false, destroyed = false, active = null, queue = [], generation = 0;
  let voices = [], prefs = {voiceURI:'',rate:1,volume:1};
  const seen = new Set();
  let lastStatus = '';
  function emitStatus(code, text) {
    const signature = `${code}|${text}|${enabled}`;
    if (signature === lastStatus) return;
    lastStatus = signature;
    onStatus({code,text,enabled,supported});
  }
  function idleStatus() {
    if (!supported) return emitStatus('unsupported','このブラウザは音声読み上げに対応していません。');
    if (!enabled) return emitStatus('off','ナレーション OFF');
    if (!voices.length) return emitStatus('no-voice','日本語音声が見つかりません。端末の日本語音声設定を確認してください。');
    emitStatus('ready','ナレーション ON');
  }
  function publicVoices() {
    return voices.map(({voiceURI,name,lang,default:preferred,localService}) => ({voiceURI,name,lang,default:Boolean(preferred),localService:Boolean(localService)}));
  }
  function cancelCurrent() {
    generation++;
    const previous = active;
    active = null;
    if (previous) { previous.utterance.onend = null; previous.utterance.onerror = null; }
    if (supported) { try { synth.cancel(); } catch { /* cancellation is best effort */ } }
  }
  function stop() {
    queue = [];
    cancelCurrent();
    idleStatus();
  }
  function pump() {
    if (destroyed || !enabled || !supported || active || !queue.length) return;
    if (!voices.length) { idleStatus(); return; }
    const entry = queue.shift(), token = generation;
    const utterance = new Utterance(entry.text);
    const selected = voices.find(voice => voice.voiceURI === prefs.voiceURI) || voices.find(voice => voice.default) || voices[0];
    utterance.voice = selected;
    utterance.lang = selected.lang || 'ja-JP';
    utterance.rate = prefs.rate;
    utterance.volume = prefs.volume;
    active = {utterance,entry};
    const complete = () => {
      if (destroyed || token !== generation || active?.utterance !== utterance) return;
      active = null;
      if (queue.length) pump(); else idleStatus();
    };
    utterance.onend = complete;
    utterance.onerror = event => {
      if (destroyed || token !== generation || active?.utterance !== utterance) return;
      if (event?.error === 'canceled' || event?.error === 'interrupted') { complete(); return; }
      queue = []; enabled = false; cancelCurrent();
      emitStatus('error',event?.error === 'not-allowed'
        ? '音声を開始できませんでした。ナレーションをもう一度 ON にしてください。'
        : '音声を読み上げられませんでした。端末の音声設定を確認して、もう一度 ON にしてください。');
    };
    emitStatus('speaking','ナレーション再生中');
    try { synth.speak(utterance); }
    catch { queue = []; enabled = false; cancelCurrent(); emitStatus('error','音声を開始できませんでした。もう一度 ON にしてください。'); }
  }
  function refreshVoices() {
    if (destroyed) return;
    try { voices = supported && typeof synth.getVoices === 'function' ? [...synth.getVoices()].filter(v => /^ja(?:[-_]|$)/i.test(v.lang || '')) : []; }
    catch { voices = []; }
    voices.sort((a,b) => Number(b.default) - Number(a.default) || Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name,'ja'));
    onVoices(publicVoices());
    if (!active) idleStatus();
    pump();
  }
  function setEnabled(value) {
    if (destroyed) return false;
    const next = Boolean(value) && supported;
    if (!next) { enabled = false; stop(); seen.clear(); return false; }
    if (!enabled) { enabled = true; seen.clear(); cancelCurrent(); }
    refreshVoices();
    return enabled;
  }
  function configure(values = {}) {
    if (typeof values.voiceURI === 'string') prefs.voiceURI = values.voiceURI;
    if (typeof values.rate === 'number' && Number.isFinite(values.rate)) prefs.rate = Math.max(0.7,Math.min(1.5,values.rate));
    if (typeof values.volume === 'number' && Number.isFinite(values.volume)) prefs.volume = Math.max(0,Math.min(1,values.volume));
    return {...prefs};
  }
  function speak(text, {key = '',priority = false} = {}) {
    if (destroyed) return false;
    text = String(text ?? '').replace(/\s+/g,' ').trim().slice(0,1000);
    if (!text) return false;
    // Text remains available on screen even while sound is disabled or unavailable.
    onTranscript(text);
    if (!enabled || !supported) return false;
    const id = String(key || text);
    if (seen.has(id)) return false;
    seen.add(id);
    if (seen.size > 64) seen.delete(seen.values().next().value);
    if (priority === true || priority === 'interrupt' || priority === 'high') {
      queue = [];
      cancelCurrent();
    }
    // Keep the newest facts when several moves happen before narration finishes.
    if (queue.length >= 3) queue.shift();
    queue.push({text,key:id});
    pump();
    return true;
  }
  const oldVoicesChanged = supported ? synth.onvoiceschanged : null;
  const hasListener = supported && typeof synth.addEventListener === 'function';
  if (hasListener) synth.addEventListener('voiceschanged',refreshVoices);
  else if (supported) synth.onvoiceschanged = refreshVoices;
  refreshVoices();
  return {
    setEnabled,configure,speak,stop,
    getVoices:publicVoices,
    get supported() { return supported; },
    get enabled() { return enabled; },
    destroy() {
      if (destroyed) return;
      enabled = false; stop(); destroyed = true;
      if (hasListener) synth.removeEventListener?.('voiceschanged',refreshVoices);
      else if (supported && synth.onvoiceschanged === refreshVoices) synth.onvoiceschanged = oldVoicesChanged;
      seen.clear();
    }
  };
}
