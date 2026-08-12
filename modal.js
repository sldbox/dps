(() => {
  'use strict';

  /* 공통 모달 상태·쉘 */
  const DPS_TABLE_MODAL_ID='dpsTableModal';
  const DPS_TABLE_MIN_DPS_INPUT_SELECTOR='#dpsTableMinDps,#dpsTableMinDpsMain';
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

  function dispatchUnitJewelModalEvent(type,detail){
    window.dispatchEvent(new CustomEvent(type,detail===undefined ? undefined : {detail}));
  }
  function openJewelSettings(){
    dispatchUnitJewelModalEvent('dps:unitJewelModalRequest',{panel:'jewel'});
  }

  function closeJewelSettings(){
    dispatchUnitJewelModalEvent('dps:unitJewelModalCloseRequest');
  }


  /* 앱 입력 모달 */
  let appInputModalState=null;
  function createAppInputModal(){
    return createShell('appInputModal','app-input-modal-shell',`
      <div class="app-input-modal-backdrop" data-app-input-close="cancel"></div>
      <section class="app-input-modal" role="dialog" aria-modal="true" aria-labelledby="appInputModalTitle" aria-describedby="appInputModalMessage">
        <header class="app-input-modal-head">
          <h2 id="appInputModalTitle" class="app-input-modal-title">입력</h2>
          <button type="button" class="ui-icon-btn app-input-modal-close" data-app-input-close="cancel" aria-label="입력 모달 닫기">×</button>
        </header>
        <div class="app-input-modal-body">
          <p id="appInputModalMessage" class="app-input-modal-message"></p>
          <input id="appInputModalField" class="app-input-modal-field" type="text" autocomplete="off" maxlength="80"/>
        </div>
        <footer class="app-input-modal-actions">
          <button type="button" class="btn subtle ui-action-btn" data-app-input-close="cancel">취소</button>
          <button type="button" class="btn pri ui-action-btn" data-app-input-confirm="1">확인</button>
        </footer>
      </section>`);
  }
  function closeAppInputModal(result={confirmed:false,value:''}){
    if(!isOpen('appInputModal')) return;
    const state=appInputModalState;
    appInputModalState=null;
    setOpen('appInputModal','app-input-modal-open',false,{rootClass:true});
    if(typeof state?.resolve==='function') state.resolve(result);
  }
  function openAppInputModal(options={}){
    createAppInputModal();
    const titleEl=document.getElementById('appInputModalTitle');
    const messageEl=document.getElementById('appInputModalMessage');
    const input=document.getElementById('appInputModalField');
    if(titleEl) titleEl.textContent=String(options.title || '입력');
    if(messageEl) messageEl.textContent=String(options.message || '값을 입력하세요.');
    if(input){
      input.value=String(options.value ?? '');
      input.placeholder=String(options.placeholder || '');
      input.maxLength=Math.max(1,Math.min(120,Number(options.maxLength) || 80));
    }
    if(appInputModalState) closeAppInputModal({confirmed:false,value:''});
    setOpen('appInputModal','app-input-modal-open',true,{rootClass:true});
    return new Promise(resolve=>{
      appInputModalState={resolve};
      requestAnimationFrame(()=>{
        if(!input) return;
        input.focus({preventScroll:true});
        if(typeof input.select==='function') input.select();
      });
    });
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
  function getDpsTableMinDpsInput(target){
    return target instanceof Element?target.closest(DPS_TABLE_MIN_DPS_INPUT_SELECTOR):null;
  }

  function withDpsTableMinDpsInput(event, handler){
    const minInput=getDpsTableMinDpsInput(event.target);
    if(!minInput) return false;
    handler(minInput,event);
    return true;
  }

  function syncFreshDpsTableMinDpsFocus(input){
    const fresh=document.getElementById(input.id);
    if(!fresh) return;
    fresh.focus({preventScroll:true});
    const pos=fresh.value.length;
    if(typeof fresh.setSelectionRange==='function') fresh.setSelectionRange(pos,pos);
  }

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
    return `<section class="dps-table-modal-panel dps-table-inline-panel" role="tabpanel" aria-labelledby="dpsTableTitle">
      <div class="dps-table-body" id="dpsTableMount" data-dps-table-mount></div>
    </section>`;
  }

  function createDpsTableModal(){
    return createShell(DPS_TABLE_MODAL_ID,'dps-table-modal-shell',`
      <div class="dps-table-modal-backdrop" data-dps-table-close="1"></div>
      <section class="dps-table-modal" role="dialog" aria-modal="true" aria-labelledby="dpsTableTitle">
        <header class="dps-table-modal-head">
          <h2 id="dpsTableTitle" class="dps-table-modal-title">DPS표</h2>
          <div class="dps-table-modal-actions" id="dpsTableHeaderActions"></div>
          <button type="button" class="ui-icon-btn dps-table-modal-close" data-dps-table-close="1" aria-label="DPS표 닫기">×</button>
        </header>
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
    if(target.closest('[data-app-input-close]')){
      closeAppInputModal({confirmed:false,value:''});
      return;
    }
    if(target.closest('[data-app-input-confirm]')){
      const input=document.getElementById('appInputModalField');
      closeAppInputModal({confirmed:true,value:String(input?.value || '')});
      return;
    }
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
  }

  function handleDocumentKeydown(event){
    if(event.key==='Escape'){
      if(isOpen('appInputModal')){
        closeAppInputModal({confirmed:false,value:''});
        event.preventDefault();
        return;
      }
      const openBoardId=getOpenBoardModalId();
      if(openBoardId){
        closeBoardModal(openBoardId);
        event.preventDefault();
        return;
      }
      if(isOpen(DPS_TABLE_MODAL_ID)) closeDpsTableModal();
      return;
    }
    if(event.key==='Enter' && isOpen('appInputModal')){
      const input=document.getElementById('appInputModalField');
      if(event.target===input){
        event.preventDefault();
        closeAppInputModal({confirmed:true,value:String(input?.value || '')});
        return;
      }
    }
    withDpsTableMinDpsInput(event,(minInput)=>{
      if(event.key==='.' || event.key===',' || event.key==='Decimal'){
        event.preventDefault();
        return;
      }
      if(event.key==='Enter'){
        event.preventDefault();
        setDpsTableMinDps(minInput.value,{format:true});
        minInput.blur();
      }
    });
  }

  function handleDocumentInput(event){
    withDpsTableMinDpsInput(event,(minInput)=>{
      setDpsTableMinDps(minInput.value);
      syncFreshDpsTableMinDpsFocus(minInput);
    });
  }

  function handleDocumentFocusOut(event){
    withDpsTableMinDpsInput(event,(minInput)=>setDpsTableMinDps(minInput.value,{format:true}));
  }

  function bindEvents(){
    if(eventsBound) return;
    eventsBound=true;
    document.addEventListener('click',handleDocumentClick);
    document.addEventListener('keydown',handleDocumentKeydown,true);
    document.addEventListener('input',handleDocumentInput);
    document.addEventListener('focusout',handleDocumentFocusOut,true);
  }

  window.DpsModal=Object.freeze({
    createShell,
    setOpen,
    isOpen,
    syncModeClasses,
    openJewelSettings,
    closeJewelSettings,
    openDpsTableModal,
    closeDpsTableModal,
    openBoardModal,
    closeBoardModal,
    openAppInputModal,
    closeAppInputModal,
    bindEvents
  });
})();
