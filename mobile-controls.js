/** Smartphone app navigation and gesture handling. */
export const MOBILE_QUERY='(max-width: 700px), (max-width: 1000px) and (max-height: 500px)';

export function mountMobileControls({openStudio=()=>{}}={}) {
 const media=matchMedia(MOBILE_QUERY),buttons=[...document.querySelectorAll('.mobile-nav [data-mobile-view]')];
 const editable=target=>target instanceof Element&&!!target.closest('input,textarea,[contenteditable="true"]');
 function selectView(view){
  if(!['board','setup','analysis','history'].includes(view))return;
  document.body.dataset.mobileView=view;
  for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.mobileView===view));
 }
 selectView('board');
 for(const button of buttons)button.addEventListener('click',()=>selectView(button.dataset.mobileView));
 document.getElementById('mobile-studio-btn')?.addEventListener('click',openStudio);
 // Keep ordinary one-finger scrolling inside panels and dialogs. Never cancel clicks.
 for(const eventName of ['touchstart','touchmove'])document.addEventListener(eventName,event=>{
  if(media.matches&&event.touches.length>1&&event.cancelable)event.preventDefault();
 },{passive:false});
 for(const eventName of ['gesturestart','gesturechange'])document.addEventListener(eventName,event=>{
  if(media.matches&&event.cancelable)event.preventDefault();
 },{passive:false});
 for(const eventName of ['contextmenu','selectstart','dragstart','dblclick'])document.addEventListener(eventName,event=>{
  if(media.matches&&!editable(event.target)&&event.cancelable)event.preventDefault();
 });
 // A restored tab must not start on a page-scroll offset from the desktop layout.
 function sync(){if(media.matches)window.scrollTo(0,0);}
 media.addEventListener('change',sync);sync();
 return {selectView};
}
