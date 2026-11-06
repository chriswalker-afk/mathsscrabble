/**
 * Pointer-based drag for mouse, touch and pen. This intentionally does not
 * depend on HTML5 drag-and-drop, which is unreliable on touchscreens.
 * Click-to-place and keyboard controls remain available independently.
 */
export function enableTileDrag(node, payload, onDrop) {
  node.draggable=false;
  node.style.touchAction='none';
  node.addEventListener('pointerdown',start);
  function start(event){
    if(event.button!==0||node.disabled)return;
    const pointerId=event.pointerId,origin={x:event.clientX,y:event.clientY};
    let dragging=false,ghost=null,hover=null,dropTarget=null;
    function stopHover(){
      if(hover)hover.classList.remove('drag-target','drag-invalid','rack-before','rack-after');
      hover=null;dropTarget=null;
    }
    function candidateAt(x,y){
      const node=document.elementFromPoint(x,y)?.closest('.cell, #rack .tile, #rack, .rack-row');
      if(!node)return null;
      if(node.classList.contains('cell')){
        const locked=node.dataset.locked==='true';
        return {node,valid:!locked,target:{kind:'board',index:Number(node.dataset.index)},side:null};
      }
      if(node.matches('#rack .tile')){
        const rect=node.getBoundingClientRect();
        const after=x>rect.left+rect.width/2;
        return {node,valid:true,target:{kind:'rack',index:Number(node.dataset.rackIndex)+(after?1:0)},side:after?'rack-after':'rack-before'};
      }
      const rack=document.getElementById('rack');
      if(!rack)return null;
      const tiles=[...rack.querySelectorAll('.tile')];
      const index=tiles.findIndex(tile=>x<tile.getBoundingClientRect().left+tile.getBoundingClientRect().width/2);
      return {node:rack,valid:true,target:{kind:'rack',index:index<0?tiles.length:index},side:null};
    }
    function cleanup(){
      window.removeEventListener('pointermove',move);
      window.removeEventListener('pointerup',end);
      window.removeEventListener('pointercancel',cancel);
      stopHover();
      ghost?.remove();
      node.classList.remove('drag-source');
      document.body.classList.remove('tile-in-flight');
    }
    function move(e){
      if(e.pointerId!==pointerId)return;
      const distance=Math.hypot(e.clientX-origin.x,e.clientY-origin.y);
      if(!dragging&&distance<8)return;
      if(!dragging){
        dragging=true;
        const rect=node.getBoundingClientRect();
        ghost=node.cloneNode(true);
        ghost.removeAttribute('id');
        ghost.removeAttribute('data-tile-id');
        ghost.removeAttribute('tabindex');
        ghost.setAttribute('aria-hidden','true');
        ghost.classList.remove('selected','marked','drag-source');
        ghost.classList.add('drag-ghost');
        ghost.style.width=rect.width+'px';
        ghost.style.height=rect.height+'px';
        document.body.append(ghost);
        node.classList.add('drag-source');
        document.body.classList.add('tile-in-flight');
      }
      e.preventDefault();
      ghost.style.left=e.clientX+'px';
      ghost.style.top=e.clientY+'px';
      const candidate=candidateAt(e.clientX,e.clientY);
      stopHover();
      if(candidate){
        hover=candidate.node;
        dropTarget=candidate.valid?candidate.target:null;
        hover.classList.add(candidate.valid?'drag-target':'drag-invalid');
        if(candidate.side)hover.classList.add(candidate.side);
      }
    }
    function end(e){
      if(e.pointerId!==pointerId)return;
      const destination=candidateAt(e.clientX,e.clientY);
      const target=destination?.valid?destination.target:dropTarget;
      if(dragging){
        e.preventDefault();
        // Prevent the synthetic click fired after a touch drag from selecting
        // the same tile again.
        node.dataset.dragSuppress=String(Date.now());
      }
      cleanup();
      if(dragging&&target)onDrop(payload,target);
    }
    function cancel(e){if(e.pointerId===pointerId)cleanup();}
    window.addEventListener('pointermove',move,{passive:false});
    window.addEventListener('pointerup',end);
    window.addEventListener('pointercancel',cancel);
  }
}
export function wasDragClick(event){
  const stamp=Number(event.currentTarget.dataset.dragSuppress);
  if(stamp&&Date.now()-stamp<450){event.preventDefault();return true;}
  return false;
}
