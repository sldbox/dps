/* ===== modal.js | 모달 공통 API ===== */

/* ===== 00. 공통 모달 API ===== */
const modalById = id => document.getElementById(id);

(() => {
  'use strict';

  function createShell(id, className, innerHtml) {
    const existing = modalById(id);
    if (existing) return existing;
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = className;
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = innerHtml;
    document.body.appendChild(modal);
    return modal;
  }

  function setOpen(id, bodyClass, open, options = {}) {
    const modal = modalById(id);
    if (!modal) return null;
    const active = !!open;
    modal.classList.toggle('is-open', active);
    modal.setAttribute('aria-hidden', active ? 'false' : 'true');
    if (bodyClass) {
      document.body?.classList.toggle(bodyClass, active);
      if (options.rootClass) document.documentElement?.classList.toggle(bodyClass, active);
    }
    return modal;
  }

  function isOpen(id) {
    return !!modalById(id)?.classList.contains('is-open');
  }

  function syncModeClasses(dialog, modes, activeMode = '') {
    const variants = Array.isArray(modes) ? modes : [];
    variants.forEach(mode => {
      dialog?.classList.remove(`is-dps-mode-${mode}`);
      document.body?.classList.remove(`is-dps-mode-${mode}`);
    });
    if (!variants.includes(activeMode)) return;
    dialog?.classList.add(`is-dps-mode-${activeMode}`);
    document.body?.classList.add(`is-dps-mode-${activeMode}`);
  }

  window.DpsModal = Object.freeze({ createShell, setOpen, isOpen, syncModeClasses });
})();


/* ===== 01. 분석 / DPS표 / 룬·쥬얼 모달 ===== */
const MONTH_RUNE_MODAL_TITLES={
  compare:'프리셋 분석',
  runes:'이달의 룬',
  jewels:'쥬얼',
  dps:'DPS표'
};
const MONTH_RUNE_MODAL_CLASS_NAMES=['is-modal-compare','is-modal-runes','is-modal-jewels','is-modal-dps'];
const DPS_TABLE_MIN_DPS_INPUT_SELECTOR='#dpsTableMinDps,#dpsTableMinDpsMain';
function getDpsTableMinDpsInput(target){
  return target?.closest?.(DPS_TABLE_MIN_DPS_INPUT_SELECTOR) || null;
}
function syncFreshDpsTableMinDpsFocus(input){
  const fresh=$(input.id);
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
  const modal=$('monthRuneModal');
  if(!modal) return;
  const next=MONTH_RUNE_MODAL_TITLES[tabName] ? tabName : 'compare';
  const title=next==='dps' ? dpsTableDisplayTitle() : MONTH_RUNE_MODAL_TITLES[next];
  const dialog=modal.querySelector('.month-rune-modal');
  const titleEl=$('monthRuneTitle');
  const actions=$('monthRuneHeaderActions');
  const closeBtn=modal.querySelector('.month-rune-close');
  if(dialog){
    dialog.classList.remove(...MONTH_RUNE_MODAL_CLASS_NAMES);
    dialog.classList.add(`is-modal-${next}`);
  }
  if(titleEl) titleEl.textContent=title;
  if(closeBtn) closeBtn.setAttribute('aria-label', `${title} 닫기`);
  if(actions){
    actions.innerHTML=next==='compare'
      ? buildCompareHeaderControls()
      : next==='dps'
        ? `<div class="dps-table-tabs month-rune-header-tabs" id="dpsTableTabsMount" data-dps-table-tabs-mount role="tablist" aria-label="DPS 기준 선택">${renderDpsTableTabs()}</div>`
        : '';
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
  const modal=$('monthRuneModal');
  if(!modal) return;
  const next=['compare','runes','jewels','dps'].includes(tabName) ? tabName : 'compare';
  modal.querySelectorAll('[data-month-rune-panel]').forEach(panel=>{
    const active=panel.dataset.monthRunePanel===next;
    setClassState(panel, 'is-active', active);
    panel.hidden=!active;
  });
  renderMonthRuneModalHeader(next);
  if(next!=='dps'){
    window.DpsModal?.syncModeClasses(modal.querySelector('.month-rune-modal'), DPS_MODAL_MODES);
  }
  if(next==='compare') syncComparePanelAfterRender();
  if(next==='dps') renderDpsTablePanelContent();
}
function createMonthRuneModal(){
  const info=MONTHLY_RUNE_INFO || {months:[]};
  const jewels=RAW_JEWEL_DATA || [];
  window.DpsModal.createShell('monthRuneModal','month-rune-modal-shell',`
    <div class="month-rune-backdrop" data-month-rune-close="1"></div>
    <section class="month-rune-modal is-modal-compare" role="dialog" aria-modal="true" aria-labelledby="monthRuneTitle">
      <header class="month-rune-head">
        <h2 id="monthRuneTitle" class="month-rune-title">프리셋 분석</h2>
        <div class="month-rune-header-actions" id="monthRuneHeaderActions"></div>
        <button type="button" class="ui-icon-btn month-rune-close" data-month-rune-close="1" aria-label="프리셋 분석 닫기">×</button>
      </header>
      <div class="month-rune-body">
        <section class="month-rune-panel is-active" data-month-rune-panel="compare" role="tabpanel" aria-labelledby="monthRuneTitle">${buildCompareApplyPanel()}</section>
        ${renderMonthRunePanel(info)}
        ${renderJewelPanel(jewels)}
        ${renderDpsTablePanel()}
      </div>
    </section>`);
}
function openMonthRune(tabName='compare'){
  if(typeof tabName!=='string') tabName='compare';
  closeConvenienceMenu();
  createMonthRuneModal();
  selectMonthRuneModalTab(tabName);
  window.DpsModal.setOpen('monthRuneModal','month-rune-modal-open',true);
}
function closeMonthRune(){
  const modal=$('monthRuneModal');
  window.DpsModal.setOpen('monthRuneModal','month-rune-modal-open',false);
  window.DpsModal?.syncModeClasses(modal?.querySelector('.month-rune-modal'), DPS_MODAL_MODES);
}
function bindMonthRuneEvents(){
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-month-rune-close]')) closeMonthRune();
  });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeMonthRune(); });
}
function bindDpsTableEvents(){
  document.addEventListener('click', function(e){
    const modeTarget=e.target.closest('[data-dps-table-mode]');
    if(!modeTarget) return;
    switchDpsTableMode(modeTarget.getAttribute('data-dps-table-mode'));
  });
  document.addEventListener('keydown', function(e){
    const minInput=getDpsTableMinDpsInput(e.target);
    if(!minInput) return;
    if(e.key==='.' || e.key===',' || e.key==='Decimal'){
      e.preventDefault();
      return;
    }
    if(e.key==='Enter'){
      e.preventDefault();
      setDpsTableMinDps(minInput.value,{format:true});
      minInput.blur();
    }
  }, true);
  document.addEventListener('input', function(e){
    const minInput=getDpsTableMinDpsInput(e.target);
    if(!minInput) return;
    setDpsTableMinDps(minInput.value);
    syncFreshDpsTableMinDpsFocus(minInput);
  });
  document.addEventListener('focusout', function(e){
    const minInput=getDpsTableMinDpsInput(e.target);
    if(!minInput) return;
    setDpsTableMinDps(minInput.value,{format:true});
  }, true);
}
