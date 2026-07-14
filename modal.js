(() => {
  'use strict';

  /* 공통 모달 */
  const MONTH_RUNE_MODAL_TITLES=Object.freeze({
    compare:'프리셋 분석',
    runes:'이달의 룬',
    jewels:'쥬얼',
    dps:'DPS표'
  });
  const MONTH_RUNE_MODAL_CLASS_NAMES=Object.freeze(['is-modal-compare','is-modal-runes','is-modal-jewels','is-modal-dps']);
  const DPS_TABLE_MIN_DPS_INPUT_SELECTOR='#dpsTableMinDps,#dpsTableMinDpsMain';
  let dpsJewelSettingsReturnFocus=null;
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

  /* 쥬얼 설정 */
  function setJewelSettingsButtonExpanded(expanded){
    document.querySelectorAll('[data-dps-jewel-config-open]').forEach(button=>{
      button.setAttribute('aria-expanded',expanded?'true':'false');
    });
  }

  function createJewelSettingsModal(){
    return createShell('dpsJewelSettingsModal','dps-jewel-settings-modal-shell',`
      <div class="dps-jewel-settings-backdrop" data-dps-jewel-config-close="1"></div>
      <section class="dps-jewel-settings-modal" role="dialog" aria-modal="true" aria-labelledby="dpsJewelSettingsTitle">
        <header class="dps-jewel-settings-head">
          <h2 id="dpsJewelSettingsTitle">쥬얼 설정</h2>
          <button type="button" class="ui-icon-btn dps-jewel-settings-close" data-dps-jewel-config-close="1" aria-label="쥬얼 설정 닫기">×</button>
        </header>
        <div class="dps-jewel-settings-body" data-dps-jewel-config>
          <div class="dps-jewel-config-grid" id="dpsJewelConfigGrid"></div>
        </div>
      </section>`);
  }

  function openJewelSettings(){
    dpsJewelSettingsReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const modal=createJewelSettingsModal();
    if(typeof renderDpsJewelConfigGrids==='function') renderDpsJewelConfigGrids();
    setOpen('dpsJewelSettingsModal','dps-jewel-settings-modal-open',true);
    setJewelSettingsButtonExpanded(true);
    requestAnimationFrame(()=>{
      modal.querySelector('[data-dps-jewel-config-close]')?.focus?.({preventScroll:true});
    });
  }

  function closeJewelSettings(){
    if(!isOpen('dpsJewelSettingsModal')) return;
    const modal=setOpen('dpsJewelSettingsModal','dps-jewel-settings-modal-open',false);
    setJewelSettingsButtonExpanded(false);
    if(modal && dpsJewelSettingsReturnFocus?.isConnected){
      dpsJewelSettingsReturnFocus.focus({preventScroll:true});
    }
    dpsJewelSettingsReturnFocus=null;
  }

  /* 분석·DPS표·룬·쥬얼 */
  function getDpsTableMinDpsInput(target){
    return target instanceof Element?target.closest(DPS_TABLE_MIN_DPS_INPUT_SELECTOR):null;
  }

  function syncFreshDpsTableMinDpsFocus(input){
    const fresh=document.getElementById(input.id);
    if(!fresh) return;
    fresh.focus({preventScroll:true});
    const pos=fresh.value.length;
    if(typeof fresh.setSelectionRange==='function') fresh.setSelectionRange(pos,pos);
  }

  function buildCompareHeaderControls(){
    return `<div class="excel-compare-controls excel-compare-header-controls">
      <label class="ui-action-btn excel-compare-file-btn excel-compare-base-file-btn">기준 파일<input id="excelCompareBaseFile" type="file" accept=".json,.txt,application/json,text/plain"></label>
      <select id="excelCompareBasePreset" aria-label="기준 프리셋 목록" disabled><option value="">기준 프리셋 목록</option></select>
      <label class="ui-action-btn excel-compare-file-btn excel-compare-target-file-btn">비교 파일<input id="excelCompareFile" type="file" accept=".xlsm,.xlsx,.json,.txt,application/json,text/plain,application/vnd.ms-excel.sheet.macroEnabled.12"></label>
      <select id="excelCompareSheet" aria-label="비교 프리셋 목록" disabled><option value="">비교파일을 불러오세요</option></select>
      <button id="excelCompareApplyBtn" class="ui-action-btn excel-compare-apply-btn" type="button" data-excel-compare-apply="1" disabled>비교 프리셋값 적용</button>
      <button id="excelCompareJewelOnlyBtn" class="ui-action-btn excel-compare-jewel-only-btn" type="button" data-excel-compare-jewel-only="1" disabled>쥬얼 데이터만 적용</button>
      <button id="excelCompareRestoreBtn" class="ui-action-btn excel-compare-restore-btn" type="button" data-excel-compare-restore="1" disabled>기준 프리셋 복원</button>
      <button id="excelCompareResetBtn" class="ui-action-btn excel-compare-reset-btn" type="button" data-excel-compare-reset="1" disabled>초기화</button>
    </div>`;
  }

  function renderMonthRuneModalHeader(tabName){
    const modal=document.getElementById('monthRuneModal');
    if(!modal) return;
    const next=MONTH_RUNE_MODAL_TITLES[tabName]?tabName:'compare';
    const title=next==='dps'?dpsTableDisplayTitle():MONTH_RUNE_MODAL_TITLES[next];
    const dialog=modal.querySelector('.month-rune-modal');
    const titleEl=document.getElementById('monthRuneTitle');
    const actions=document.getElementById('monthRuneHeaderActions');
    const closeButton=modal.querySelector('.month-rune-close');
    if(dialog){
      dialog.classList.remove(...MONTH_RUNE_MODAL_CLASS_NAMES);
      dialog.classList.add(`is-modal-${next}`);
    }
    if(titleEl) titleEl.textContent=title;
    if(closeButton) closeButton.setAttribute('aria-label',`${title} 닫기`);
    if(actions){
      actions.innerHTML=next==='compare'
        ?buildCompareHeaderControls()
        :next==='dps'
          ?`<div class="dps-table-tabs month-rune-header-tabs" id="dpsTableTabsMount" data-dps-table-tabs-mount role="tablist" aria-label="DPS 기준 선택">${renderDpsTableTabs()}</div>`
          :'';
    }
  }

  function buildCompareApplyPanel(){
    return `<section class="dps-table-panel excel-compare-panel">
      <div class="excel-compare-body" id="excelCompareBody">${EXCEL_COMPARE_EMPTY_HTML}</div>
    </section>`;
  }

  function renderDpsTablePanel(){
    return `<section class="month-rune-panel dps-table-inline-panel" data-month-rune-panel="dps" role="tabpanel" aria-labelledby="monthRuneTitle" hidden>
      <div class="dps-table-body" id="dpsTableMount" data-dps-table-mount></div>
    </section>`;
  }

  function selectMonthRuneModalTab(tabName){
    const modal=document.getElementById('monthRuneModal');
    if(!modal) return;
    const next=['compare','runes','jewels','dps'].includes(tabName)?tabName:'compare';
    modal.querySelectorAll('[data-month-rune-panel]').forEach(panel=>{
      const active=panel.dataset.monthRunePanel===next;
      setClassState(panel,'is-active',active);
      panel.hidden=!active;
    });
    renderMonthRuneModalHeader(next);
    if(next!=='dps') syncModeClasses(modal.querySelector('.month-rune-modal'),DPS_MODAL_MODES);
    if(next==='compare') syncComparePanelAfterRender();
    if(next==='dps') renderDpsTablePanelContent();
  }

  function createMonthRuneModal(){
    const data=window.DPS_DATA||{};
    const info=data.MONTHLY_RUNE_INFO||{months:[]};
    const jewels=data.RAW_JEWEL_DATA||[];
    return createShell('monthRuneModal','month-rune-modal-shell',`
      <div class="month-rune-backdrop" data-month-rune-close="1"></div>
      <section class="month-rune-modal is-modal-compare" role="dialog" aria-modal="true" aria-labelledby="monthRuneTitle">
        <header class="month-rune-head">
          <h2 id="monthRuneTitle" class="month-rune-title">프리셋 분석</h2>
          <div class="month-rune-header-actions" id="monthRuneHeaderActions"></div>
          <button type="button" class="ui-icon-btn month-rune-close" data-month-rune-close="1" aria-label="프리셋 분석 닫기">×</button>
        </header>
        <div class="month-rune-body">
          <section class="month-rune-panel is-active" data-month-rune-panel="compare" role="tabpanel" aria-labelledby="monthRuneTitle">${buildCompareApplyPanel()}</section>
          ${renderMonthRuneModalPanel('runes',renderMonthRunePanelContent(info))}
          ${renderMonthRuneModalPanel('jewels',renderJewelPanelContent(jewels))}
          ${renderDpsTablePanel()}
        </div>
      </section>`);
  }

  function openMonthRune(tabName='compare'){
    const next=typeof tabName==='string'?tabName:'compare';
    closeConvenienceMenu();
    createMonthRuneModal();
    selectMonthRuneModalTab(next);
    setOpen('monthRuneModal','month-rune-modal-open',true);
  }

  function closeMonthRune(){
    if(!isOpen('monthRuneModal')) return;
    const modal=document.getElementById('monthRuneModal');
    setOpen('monthRuneModal','month-rune-modal-open',false);
    syncModeClasses(modal?.querySelector('.month-rune-modal'),DPS_MODAL_MODES);
  }

  /* 통합 이벤트 */
  function handleDocumentClick(event){
    const target=event.target instanceof Element?event.target:null;
    if(!target) return;
    if(target.closest('[data-dps-jewel-config-close]')){
      closeJewelSettings();
      return;
    }
    if(target.closest('[data-month-rune-close]')){
      closeMonthRune();
      return;
    }
    const modeTarget=target.closest('[data-dps-table-mode]');
    if(modeTarget) switchDpsTableMode(modeTarget.getAttribute('data-dps-table-mode'));
  }

  function handleDocumentKeydown(event){
    if(event.key==='Escape'){
      if(isOpen('dpsJewelSettingsModal')) closeJewelSettings();
      if(isOpen('monthRuneModal')) closeMonthRune();
      return;
    }
    const minInput=getDpsTableMinDpsInput(event.target);
    if(!minInput) return;
    if(event.key==='.' || event.key===',' || event.key==='Decimal'){
      event.preventDefault();
      return;
    }
    if(event.key==='Enter'){
      event.preventDefault();
      setDpsTableMinDps(minInput.value,{format:true});
      minInput.blur();
    }
  }

  function handleDocumentInput(event){
    const minInput=getDpsTableMinDpsInput(event.target);
    if(!minInput) return;
    setDpsTableMinDps(minInput.value);
    syncFreshDpsTableMinDpsFocus(minInput);
  }

  function handleDocumentFocusOut(event){
    const minInput=getDpsTableMinDpsInput(event.target);
    if(minInput) setDpsTableMinDps(minInput.value,{format:true});
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
    openMonthRune,
    closeMonthRune,
    bindEvents
  });
})();
