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
    let dragging=false,ghost=null,hover=null;
    function stopHover(){
      if(hover)hover.classList.remove('drag-target','drag-invalid');
      hover=null;
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
      const candidate=document.elementFromPoint(e.clientX,e.clientY)?.closest('.cell')||null;
      if(candidate!==hover){
        stopHover();
        hover=candidate;
        if(hover)hover.classList.add(hover.dataset.locked==='true'?'drag-invalid':'drag-target');
      }
    }
    function end(e){
      if(e.pointerId!==pointerId)return;
      const index=hover?Number(hover.dataset.index):null;
      if(dragging){
        e.preventDefault();
        // Prevent the synthetic click fired after a touch drag from selecting
        // the same tile again.
        node.dataset.dragSuppress=String(Date.now());
      }
      cleanup();
      if(dragging&&index!==null)onDrop(payload,index);
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
