/** Visible starting-strategy choice for the local workshop. */
import {strategyData} from './strategy.js';

export function mountBaseStrategySelector(dialog){
 const grid=dialog.querySelector('.studio-field-grid');
 const select=dialog.querySelector('#studio-base');
 const field=select?.closest('.field');
 if(!grid||!select||!field)throw Error('アレンジ元の戦法選択を準備できませんでした。');
 grid.classList.add('studio-strategy-fields');
 field.classList.add('studio-base-field');
 grid.querySelector('[for="studio-name"]')?.classList.add('studio-name-field');
 const side=grid.querySelector('[for="studio-side"]');
 side?.classList.add('studio-side-field');
 field.querySelector('span').textContent='アレンジ元の戦法';
 grid.insertBefore(field,side);
 const free=select.querySelector('option[value="auto"]');
 if(free)free.textContent='自由に作る（戦法を指定しない）';

 const details=document.createElement('details');
 details.className='studio-base-guide';
 const summary=document.createElement('summary');
 summary.textContent='元の戦法の特徴';
 const description=document.createElement('p');
 description.id='studio-base-description';
 const note=document.createElement('p');
 note.className='studio-base-note';
 note.textContent='元の戦法を変えても、作成中の手順は残ります。AIは現在の盤面から候補を考えます。';
 details.append(summary,description,note);
 grid.after(details);
 select.setAttribute('aria-describedby',description.id);

 function refresh(){
  const data=strategyData[select.value];
  if(!data||select.value==='auto'){
   summary.textContent='自由に作る · 研究の進め方';
   description.textContent='戦法を指定せず、盤面で自由に指しながらAIの候補や形勢を比較できます。';
   return;
  }
  summary.textContent=`${data.name} · 元の戦法の特徴`;
  description.textContent=data.text;
 }
 select.addEventListener('change',refresh);
 refresh();
 return {refresh,destroy(){select.removeEventListener('change',refresh);details.remove();}};
}
