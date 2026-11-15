/** Small, deterministic records of visible strategy transitions. */
export function strategyTransition(previous, next, {ply=0,source='analysis',now=Date.now()}={}) {
  if (!next || !next.key || !next.name || !previous) return null;
  if (previous.key===next.key && previous.name===next.name) return null;
  const before=String(previous.name), after=String(next.name);
  return {
    id:`${now}-${ply}`, ply:Math.max(0,Math.floor(ply)), source,
    from:before, to:after, key:String(next.key), reason:String(next.reason||''),
    text:`「${before}」から「${after}」に変わりました。`, time:now
  };
}
export function appendStrategyEvent(events,event,limit=200) {
  if (!event) return events;
  const last=events.at(-1);
  if (last && last.ply===event.ply && last.from===event.from && last.to===event.to && last.source===event.source) return events;
  return [...events,event].slice(-limit);
}
