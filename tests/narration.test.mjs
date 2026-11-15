import test from 'node:test';
import assert from 'node:assert/strict';
import {createNarrator,moveNarration,evaluationNarration} from '../narration.js';
import {initialState,moveFromUSI,fromSFEN} from '../shogi.js';

function fakeSpeech(initialVoices = [{voiceURI:'ja-local',name:'Japanese',lang:'ja-JP',default:true,localService:true}]) {
  const listeners = new Map();
  const synth = {
    voices:initialVoices, spoken:[], cancelCount:0,
    getVoices(){return this.voices;},
    speak(u){this.spoken.push(u);},
    cancel(){this.cancelCount++;},
    addEventListener(name,fn){listeners.set(name,fn);},
    removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);},
    changeVoices(v){this.voices=v;listeners.get('voiceschanged')?.();}
  };
  class Utterance { constructor(text){this.text=text;} }
  return {synth,platform:{speechSynthesis:synth,SpeechSynthesisUtterance:Utterance},listeners};
}

test('narration starts OFF and still supplies text without speaking',()=>{
 const f=fakeSpeech(),transcripts=[];const n=createNarrator({platform:f.platform,onTranscript:t=>transcripts.push(t)});
 assert.equal(n.enabled,false);assert.equal(n.supported,true);assert.equal(n.speak('先手です。'),false);
 assert.deepEqual(transcripts,['先手です。']);assert.equal(f.synth.spoken.length,0);
 n.setEnabled(true);assert.equal(n.speak('先手です。',{key:'first'}),true);assert.equal(f.synth.spoken.length,1);
});

test('only one utterance plays at once; queue keeps latest three pending facts',()=>{
 const f=fakeSpeech(),n=createNarrator({platform:f.platform});n.setEnabled(true);
 for(let i=0;i<5;i++)n.speak(`手数${i}`,{key:`event-${i}`});
 assert.deepEqual(f.synth.spoken.map(u=>u.text),['手数0']);
 f.synth.spoken[0].onend();assert.equal(f.synth.spoken.at(-1).text,'手数2');
 f.synth.spoken.at(-1).onend();assert.equal(f.synth.spoken.at(-1).text,'手数3');
 f.synth.spoken.at(-1).onend();assert.equal(f.synth.spoken.at(-1).text,'手数4');
});

test('duplicate events are not queued and disabling cancels active and pending speech',()=>{
 const f=fakeSpeech(),n=createNarrator({platform:f.platform});n.setEnabled(true);
 n.speak('解析結果',{key:'position-1'});assert.equal(n.speak('同じ局面',{key:'position-1'}),false);
 n.speak('次の結果',{key:'position-2'});const oldEnd=f.synth.spoken[0].onend;n.setEnabled(false);oldEnd();
 assert.equal(n.enabled,false);assert.equal(f.synth.spoken.length,1);assert.ok(f.synth.cancelCount>=2);
 n.setEnabled(true);n.speak('解析結果',{key:'position-1'});assert.equal(f.synth.spoken.length,2);
});

test('high priority moves interrupt obsolete speech and ignore stale completion callbacks',()=>{
 const f=fakeSpeech(),n=createNarrator({platform:f.platform});n.setEnabled(true);n.speak('古い形勢',{key:'old'});
 const oldEnd=f.synth.spoken[0].onend;n.speak('古い戦法',{key:'old-plan'});n.speak('新しい指し手',{key:'new',priority:'high'});oldEnd();
 assert.deepEqual(f.synth.spoken.map(u=>u.text),['古い形勢','新しい指し手']);
 f.synth.spoken[1].onend();assert.equal(f.synth.spoken.length,2);
});

test('Japanese voices arrive asynchronously and English voices are never used as fallback',()=>{
 const f=fakeSpeech([{voiceURI:'en',name:'English',lang:'en-US'}]),statuses=[],n=createNarrator({platform:f.platform,onStatus:s=>statuses.push(s)});
 n.setEnabled(true);n.speak('日本語の読み上げ');assert.equal(f.synth.spoken.length,0);assert.equal(statuses.at(-1).code,'no-voice');
 f.synth.changeVoices([{voiceURI:'ja2',name:'日本語',lang:'ja_JP',default:false}]);
 assert.equal(f.synth.spoken.length,1);assert.equal(f.synth.spoken[0].voice.voiceURI,'ja2');
 assert.equal(n.getVoices().length,1);
});

test('voice selection, rate and volume settings apply safely to new speech',()=>{
 const f=fakeSpeech([{voiceURI:'ja1',name:'一',lang:'ja-JP',default:true},{voiceURI:'ja2',name:'二',lang:'ja-JP'}]);
 const n=createNarrator({platform:f.platform});n.configure({voiceURI:'ja2',rate:99,volume:-1});n.setEnabled(true);n.speak('テスト');
 assert.equal(f.synth.spoken[0].voice.voiceURI,'ja2');assert.equal(f.synth.spoken[0].rate,1.5);assert.equal(f.synth.spoken[0].volume,0);
});

test('unsupported browsers and speech failures report visible state without throwing',()=>{
 const statuses=[],n=createNarrator({platform:{},onStatus:s=>statuses.push(s)});assert.equal(n.supported,false);assert.equal(n.setEnabled(true),false);assert.equal(statuses.at(-1).code,'unsupported');
 const f=fakeSpeech(),errors=[],n2=createNarrator({platform:f.platform,onStatus:s=>errors.push(s)});n2.setEnabled(true);n2.speak('再生');
 f.synth.spoken[0].onerror({error:'not-allowed'});assert.equal(n2.enabled,false);assert.equal(errors.at(-1).code,'error');assert.match(errors.at(-1).text,/もう一度 ON/);
});

test('destroy cancels speech, removes voice listener, and cannot be re-enabled',()=>{
 const f=fakeSpeech(),n=createNarrator({platform:f.platform});n.setEnabled(true);n.speak('再生');n.destroy();n.destroy();
 assert.equal(f.listeners.size,0);assert.equal(n.enabled,false);assert.equal(n.setEnabled(true),false);assert.equal(n.speak('もう一度'),false);
});

test('move narration identifies side, origin, destination, captures, drops and promotion',()=>{
 const initial=initialState();assert.equal(moveNarration(initial,moveFromUSI(initial,'7g7f'),1),'1手目。先手。7筋7段から7筋6段へ、歩を動かしました。');
 const capture=fromSFEN('4k4/4s4/4P4/9/9/9/9/9/4K4 b - 1');
 assert.match(moveNarration(capture,moveFromUSI(capture,'5c5b+'),4),/銀を取りました。成りました。/);
 const drop=fromSFEN('4k4/9/9/9/9/9/9/9/4K4 w p 1');
 assert.equal(moveNarration(drop,moveFromUSI(drop,'P*3d'),2),'2手目。後手。持ち駒の歩を3筋4段に打ちました。');
});

test('evaluation narration consistently orients advantage to sente and gote',()=>{
 assert.match(evaluationNarration(50),/互角/);assert.match(evaluationNarration(-450),/後手がやや有利、先手がやや不利/);
 assert.match(evaluationNarration(800),/先手が優勢、後手が劣勢/);assert.match(evaluationNarration(-1600),/後手が大きく優勢/);
 assert.match(evaluationNarration(null),/まだ確定していません/);assert.match(evaluationNarration(30000,{mateSente:-3}),/後手に詰み筋/);
});
