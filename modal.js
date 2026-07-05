/* ===== modal.js | 모달 공통 API / 정보 모달 ===== */

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

  window.DpsModal = { createShell, setOpen, isOpen };
})();


/* ===== 01. 분석 / DPS표 / 룬·쥬얼 모달 ===== */
const MONTH_RUNE_MODAL_TITLES={
  compare:'프리셋 분석',
  runes:'이달의 룬',
  jewels:'쥬얼',
  dps:'DPS표'
};
const MONTH_RUNE_MODAL_CLASS_NAMES=['is-modal-compare','is-modal-runes','is-modal-jewels','is-modal-dps'];
function buildCompareHeaderControls(){
  return `<div class="excel-compare-controls excel-compare-header-controls">
    <label class="ui-action-btn excel-compare-file-btn excel-compare-base-file-btn">기준 파일<input id="excelCompareBaseFile" type="file" accept=".xlsm,.xlsx,.json,.txt,application/json,text/plain,application/vnd.ms-excel.sheet.macroEnabled.12"></label>
    <select id="excelCompareBasePreset" aria-label="기준 프리셋 목록" disabled><option value="">기준 프리셋 목록</option></select>
    <label class="ui-action-btn excel-compare-file-btn excel-compare-target-file-btn">비교 파일<input id="excelCompareFile" type="file" accept=".xlsm,.xlsx,.json,.txt,application/json,text/plain,application/vnd.ms-excel.sheet.macroEnabled.12"></label>
    <select id="excelCompareSheet" aria-label="비교 프리셋 목록" disabled><option value="">비교파일을 불러오세요</option></select>
    <button id="excelCompareApplyBtn" class="ui-action-btn excel-compare-apply-btn" type="button" data-excel-compare-apply="1" disabled>비교 프리셋값 적용</button>
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
        ? `<div class="dps-table-tabs month-rune-header-tabs" id="dpsTableTabsMount" data-dps-table-tabs-mount role="tablist" aria-label="DPS 기준 선택">${renderDpsTableTabs(dpsTableRound(), {compact:true})}</div>`
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
    const dialog=modal.querySelector('.month-rune-modal');
    DPS_MODAL_MODES.forEach(mode=>{
      dialog?.classList.remove(`is-dps-mode-${mode}`);
      document.body?.classList.remove(`is-dps-mode-${mode}`);
    });
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
function openMonthRune(tabName='compare', options={}){
  if(typeof tabName!=='string'){
    options={};
    tabName='compare';
  }
  closeConvenienceMenu();
  createMonthRuneModal();
  selectMonthRuneModalTab(tabName);
  window.DpsModal.setOpen('monthRuneModal','month-rune-modal-open',true);
  if(options.openFilePicker && tabName==='compare') requestCompareFileSelect();
}
function closeMonthRune(){
  window.DpsModal.setOpen('monthRuneModal','month-rune-modal-open',false);
  DPS_MODAL_MODES.forEach(mode=>document.body?.classList.remove(`is-dps-mode-${mode}`));
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
    const minInput=e.target.closest('#dpsTableMinDps,#dpsTableMinDpsMain');
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
    const minInput=e.target.closest('#dpsTableMinDps,#dpsTableMinDpsMain');
    if(!minInput) return;
    const before=minInput.value;
    setDpsTableMinDps(before);
    const fresh=$(minInput.id);
    if(fresh){
      fresh.focus({preventScroll:true});
      const pos=fresh.value.length;
      try{ fresh.setSelectionRange(pos,pos); }catch(_e){}
    }
  });
  document.addEventListener('focusout', function(e){
    const minInput=e.target.closest('#dpsTableMinDps,#dpsTableMinDpsMain');
    if(!minInput) return;
    setDpsTableMinDps(minInput.value,{format:true});
  }, true);
}


/* ===== 02. 정보 모달 ===== */
(() => {
  'use strict';

  const NOTICE_TABS = [
    ['info', '정보', 'DPS 기준'],
    ['creator', '문의', '제보 채널']
  ];
  const NOTICE_TAB_IDS = new Set(NOTICE_TABS.map(([id]) => id));
  const NOTICE_CONTENT = {
    info: {
      title: '정보',
      html: `
        <div class="notice-hero-card">
          <span class="notice-hero-label">DPS 계산기준</span>
          <strong>웹 특성 계산기 독자적 계산법 적용</strong>
        </div>
        <div class="notice-step-card">
          <h3>개인</h3>
          <p>내 스팩 x 버프 x 피해보정 x 크리/공속 보정 × 적 방어력 &amp; 체력 &amp; 실드 &amp; 물량 ÷ 라운드 시간</p>
        </div>
        <div class="notice-step-card">
          <h3>협동</h3>
          <p>내 스팩 x 버프 x 피해보정 x 크리/공속 보정 × 2P·3P 모든 스팩 0 기준 × 적 방어력 &amp; 체력 &amp; 실드 &amp; 물량 ÷ 라운드 시간</p>
          <ul>
            <li>2인 협동은 2배 물량, 3인 협동은 3배 물량 적용</li>
            <li>기본정보에서 2P·3P 승객 방어력감소 선택 가능</li>
          </ul>
        </div>
        <div class="notice-step-card">
          <h3>도전의탑</h3>
          <p>내 스팩 x 버프 x 피해보정 x 크리/공속 보정 × 적 방어력 &amp; 체력 &amp; 실드 &amp; 물량 ÷ 라운드 시간 + RP 최대 8초 추가 (방관 &amp; 총뎀)</p>
        </div>
      `
    },
    creator: {
      title: '문의',
      html: `
        <div class="notice-creator-card">
          <div><span>문의</span><b>회장</b></div>
          <div><span>핸들값</span><b>3-S2-1-2461127</b></div>
        </div>
        <div class="notice-step-card">
          <h3>문의할 때 제작자에게 전달할 파일 및 내용</h3>
          <ul>
            <li>웹버전 통합 프리셋 파일
              <ul>
                <li>프리셋 명</li>
              </ul>
            </li>
            <li>엑셀 파일 문제인 경우 엑셀 파일
              <ul>
                <li>고행 시트 명</li>
              </ul>
            </li>
            <li>어떤 문제인지</li>
            <li>원래 나와야 하는 값과 실제로 보인 값</li>
            <li>가능하면 스크린샷</li>
          </ul>
        </div>
        <div class="notice-discord-row">
          <span>개복디 오픈디스코드</span>
          <a href="https://discord.gg/z7DwqvGeB5" target="_blank" rel="noopener noreferrer">입장하기</a>
        </div>
      `
    }
  };

  let activeTab = 'info';
  const resolveTab = (tab) => NOTICE_TAB_IDS.has(tab) ? tab : 'info';

  function renderNoticeTabs(target) {
    return NOTICE_TABS.map(([id, label, meta]) => {
      const active = id === target;
      return `<button type="button" class="notice-tab${active ? ' active' : ''}" data-notice-tab="${id}" aria-selected="${active ? 'true' : 'false'}"><span>${label}</span><small>${meta}</small></button>`;
    }).join('');
  }

  function renderNoticeContent(target) {
    const item = NOTICE_CONTENT[target] || NOTICE_CONTENT.info;
    return `<section class="notice-content" data-notice-content="${target}"><h2><span>${item.title}</span></h2><div class="notice-content-body">${item.html}</div></section>`;
  }

  function renderNoticeInto(root, target = activeTab) {
    if (!root) return;
    activeTab = resolveTab(target);
    root.innerHTML = `<div class="notice-tabs" role="tablist" aria-label="정보&안내 탭">${renderNoticeTabs(activeTab)}</div><div class="notice-content-mount">${renderNoticeContent(activeTab)}</div>`;
  }

  function ensureNoticeModal() {
    const existing = modalById('noticeModalShell');
    if (existing) return existing;
    return window.DpsModal.createShell('noticeModalShell', 'notice-modal-shell', `
      <div class="notice-modal-backdrop" data-notice-close="1"></div>
      <section class="notice-modal" role="dialog" aria-modal="true" aria-labelledby="noticeModalTitle">
        <header class="notice-modal-head">
          <div class="notice-modal-title-wrap"><span class="notice-modal-icon" aria-hidden="true">i</span><div><span class="notice-modal-kicker">DPS CALCULATOR</span><h2 id="noticeModalTitle">정보&안내</h2></div></div>
          <button type="button" class="notice-modal-close" data-notice-close="1" aria-label="정보&안내 닫기">×</button>
        </header>
        <div class="notice-modal-body" id="noticeModalBody"></div>
      </section>`);
  }

  function openNoticeModal(tab = 'info') {
    ensureNoticeModal();
    renderNoticeInto(modalById('noticeModalBody'), tab);
    window.DpsModal.setOpen('noticeModalShell', 'notice-modal-open', true, { rootClass: true });
  }

  function closeNoticeModal() {
    window.DpsModal.setOpen('noticeModalShell', 'notice-modal-open', false, { rootClass: true });
  }

  function handleNoticeClick(event) {
    if (event.target.closest('[data-action="openNoticeModal"], [data-notice-open]')) {
      event.preventDefault();
      openNoticeModal('info');
      return;
    }
    if (event.target.closest('[data-notice-close]')) {
      event.preventDefault();
      closeNoticeModal();
      return;
    }
    const tabTarget = event.target.closest('[data-notice-tab]');
    if (tabTarget) {
      event.preventDefault();
      renderNoticeInto(modalById('noticeModalBody'), tabTarget.getAttribute('data-notice-tab'));
    }
  }

  function initNotice() {
    document.addEventListener('click', handleNoticeClick, true);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && window.DpsModal.isOpen('noticeModalShell')) closeNoticeModal();
    });
  }

  window.DpsNotice = { open: openNoticeModal, close: closeNoticeModal };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNotice, { once: true });
  else initNotice();
})();
