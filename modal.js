/* 공통 모달
 * - 포커스/닫기 처리
 * - DPS표와 프리셋 등 공용 모달 동작
 */
(() => {
  'use strict';

  /* 공통 모달 상태·쉘 */
  const DPS_TABLE_MODAL_ID='dpsTableModal';
  const BOARD_MODAL_IDS=Object.freeze(['sanctuarySkillModal','busPassengerModal','zeroRankInfoModal']);
  let eventsBound=false;

  function createShell(id,className,innerHtml){
    const existing=document.getElementById(id);
    if(existing) return existing;
    const modal=document.createElement('div');
    modal.id=id;
    modal.className=className;
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML=innerHtml;
    document.body.appendChild(modal);
    return modal;
  }

  function setOpen(id,bodyClass,open,options={}){
    const modal=document.getElementById(id);
    if(!modal) return null;
    const active=!!open;
    modal.classList.toggle('is-open',active);
    modal.setAttribute('aria-hidden',active?'false':'true');
    if(bodyClass){
      document.body?.classList.toggle(bodyClass,active);
      if(options.rootClass) document.documentElement?.classList.toggle(bodyClass,active);
    }
    return modal;
  }

  function isOpen(id){
    return document.getElementById(id)?.classList.contains('is-open')===true;
  }

  function syncModeClasses(dialog,modes,activeMode=''){
    const variants=Array.isArray(modes)?modes:[];
    variants.forEach(mode=>{
      dialog?.classList.remove(`is-dps-mode-${mode}`);
      document.body?.classList.remove(`is-dps-mode-${mode}`);
    });
    if(!variants.includes(activeMode)) return;
    dialog?.classList.add(`is-dps-mode-${activeMode}`);
    document.body?.classList.add(`is-dps-mode-${activeMode}`);
  }

  /* 보드 분리 모달 */
  function closeBoardModal(id=''){
    const ids=BOARD_MODAL_IDS.includes(id) ? [id] : BOARD_MODAL_IDS;
    ids.forEach(modalId=>setOpen(modalId,'board-modal-open',false,{rootClass:true}));
    if(!BOARD_MODAL_IDS.some(isOpen)){
      document.body?.classList.remove('board-modal-open');
      document.documentElement?.classList.remove('board-modal-open');
    }
  }
  function openBoardModal(id){
    if(!BOARD_MODAL_IDS.includes(id)) return;
    closeBoardModal();
    const modal=setOpen(id,'board-modal-open',true,{rootClass:true});
    requestAnimationFrame(()=>{
      const closeButton=modal?.querySelector('.board-modal-close');
      if(closeButton && typeof closeButton.focus==='function') closeButton.focus({preventScroll:true});
    });
  }
  function getOpenBoardModalId(){
    return BOARD_MODAL_IDS.find(isOpen) || '';
  }

  /* DPS표 */
  function renderDpsTableModalHeader(){
    const modal=document.getElementById(DPS_TABLE_MODAL_ID);
    if(!modal) return;
    const title=dpsTableDisplayTitle();
    const titleEl=document.getElementById('dpsTableTitle');
    const actions=document.getElementById('dpsTableHeaderActions');
    const closeButton=modal.querySelector('.dps-table-modal-close');
    if(titleEl) titleEl.textContent=title;
    if(closeButton) closeButton.setAttribute('aria-label',`${title} 닫기`);
    if(actions){
      actions.innerHTML=`<div class="dps-table-tabs dps-table-header-tabs" id="dpsTableTabsMount" data-dps-table-tabs-mount role="tablist" aria-label="DPS 기준 선택">${renderDpsTableTabs()}</div>`;
    }
  }

  function renderDpsTablePanel(){
    return `<section class="dps-table-modal-panel" id="dpsTableContent" role="tabpanel" aria-labelledby="dpsTableTitle">
      <div class="dps-table-body" id="dpsTableMount" data-dps-table-mount></div>
    </section>`;
  }

  function createDpsTableModal(){
    return createShell(DPS_TABLE_MODAL_ID,'dps-table-modal-shell',`
      <div class="dps-table-modal-backdrop" data-dps-table-close="1"></div>
      <section class="dps-table-modal" role="dialog" aria-modal="true" aria-labelledby="dpsTableTitle">
        <header class="dps-table-modal-head">
          <div class="dps-table-modal-brand"><span class="dps-table-modal-mark" aria-hidden="true">✦</span><div><h2 id="dpsTableTitle" class="dps-table-modal-title">DPS표</h2></div></div>
          <button type="button" class="ui-icon-btn dps-table-modal-close" data-dps-table-close="1" aria-label="DPS표 닫기">×</button>
        </header>
        <div class="dps-table-modal-actions" id="dpsTableHeaderActions"></div>
        <div class="dps-table-modal-body">
          ${renderDpsTablePanel()}
        </div>
      </section>`);
  }

  function openDpsTableModal(){
    createDpsTableModal();
    renderDpsTableModalHeader();
    renderDpsTablePanelContent();
    setOpen(DPS_TABLE_MODAL_ID,'dps-table-modal-open',true);
  }

  function closeDpsTableModal(){
    if(!isOpen(DPS_TABLE_MODAL_ID)) return;
    const modal=document.getElementById(DPS_TABLE_MODAL_ID);
    setOpen(DPS_TABLE_MODAL_ID,'dps-table-modal-open',false);
    syncModeClasses(modal?.querySelector('.dps-table-modal'),DPS_MODAL_MODES);
  }

  /* 통합 이벤트·공개 API */
  function handleDocumentClick(event){
    const target=event.target instanceof Element?event.target:null;
    if(!target) return;
    const boardModalClose=target.closest('[data-board-modal-close]');
    if(boardModalClose){
      closeBoardModal(boardModalClose.closest('.board-modal-shell')?.id || '');
      return;
    }
    if(target.closest('[data-dps-table-close]')){
      closeDpsTableModal();
      return;
    }
    const modeTarget=target.closest('[data-dps-table-mode]');
    if(modeTarget) switchDpsTableMode(modeTarget.getAttribute('data-dps-table-mode'));
    if(target.closest('[data-dps-current-row]')){
      target.closest('.dps-floor-column')?.querySelector('.dps-stat-row.is-current')?.scrollIntoView({block:'center',behavior:'instant'});
    }
  }

  function handleDocumentKeydown(event){
    const tab=event.target?.closest?.('[data-dps-table-mode]');
    if(tab && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      const tabs=Array.from(document.querySelectorAll('[data-dps-table-mode]'));
      const index=tabs.indexOf(tab);
      const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      const mode=tabs[next].getAttribute('data-dps-table-mode');
      switchDpsTableMode(mode);
      document.querySelector(`[data-dps-table-mode="${mode}"]`)?.focus({preventScroll:true});
      event.preventDefault();
      return;
    }
    if(event.key==='Escape'){
      const openBoardId=getOpenBoardModalId();
      if(openBoardId){
        closeBoardModal(openBoardId);
        event.preventDefault();
        return;
      }
      if(isOpen(DPS_TABLE_MODAL_ID)) closeDpsTableModal();
      return;
    }
  }

  function bindEvents(){
    if(eventsBound) return;
    eventsBound=true;
    document.addEventListener('click',handleDocumentClick);
    document.addEventListener('change',event=>{
      if(event.target?.matches?.('[data-dps-view-diff]')) changeDpsVisualDifficulty(event.target.value);
    });
    document.addEventListener('keydown',handleDocumentKeydown,true);
  }

  window.DpsModal=Object.freeze({
    createShell,
    setOpen,
    isOpen,
    syncModeClasses,
    openDpsTableModal,
    closeDpsTableModal,
    openBoardModal,
    closeBoardModal,
    bindEvents
  });
})();
