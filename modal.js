/* ===== modal.js | 공통 모달 유틸 / 정보&안내 모달 ===== */
/* 모달 쉘 생성·열기/닫기 공통 함수와 정보&안내 탭 콘텐츠를 관리한다. */


/* ===== 00. 공통 모달 유틸 ===== */
(function(){
  'use strict';

  function byId(id){ return document.getElementById(id); }

  function createModalShell(id, className, innerHtml){
    if(byId(id)) return byId(id);
    const modal=document.createElement('div');
    modal.id=id;
    modal.className=className;
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML=innerHtml;
    document.body.appendChild(modal);
    return modal;
  }

  function setModalOpen(id, bodyClass, open, options={}){
    const modal=byId(id);
    if(!modal) return null;
    const active=!!open;
    modal.classList.toggle('is-open', active);
    modal.setAttribute('aria-hidden', active ? 'false' : 'true');
    if(bodyClass){
      document.body?.classList.toggle(bodyClass, active);
      if(options.rootClass) document.documentElement?.classList.toggle(bodyClass, active);
    }
    return modal;
  }

  function isModalOpen(id){
    return !!byId(id)?.classList.contains('is-open');
  }

  window.DpsModal={createModalShell,setModalOpen,isModalOpen};
  window.createModalShell=createModalShell;
  window.setModalOpen=setModalOpen;
})();


/* ===== 01. 프리셋 분석 / DPS표 / 이달의룬 / 쥬얼 모달 ===== */
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
  createModalShell('monthRuneModal','month-rune-modal-shell',`
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
  setModalOpen('monthRuneModal','month-rune-modal-open',true);
  if(options.openFilePicker && tabName==='compare') requestCompareFileSelect();
}
function closeMonthRune(){
  setModalOpen('monthRuneModal','month-rune-modal-open',false);
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


/* ===== 02. 정보&안내 모달 데이터 / 탭 정의 ===== */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const NOTICE_TABS = [
    { id: 'patch-notes', label: '패치노트', meta: '업데이트 안내' },
    { id: 'preset-guide', label: '프리셋 관련', meta: '저장·동기화' },
    { id: 'notes', label: 'DPS 계산 기준', meta: '참고사항' },
    { id: 'creator', label: '문의', meta: '제보 채널' }
  ];
  const NOTICE_TAB_IDS = new Set(NOTICE_TABS.map((tab) => tab.id));
  const NOTICE_CONTENT = {

    'patch-notes': {
      title: '패치노트',
      level: 'info',
      html: `
        <div class="notice-version-labels" role="tablist" aria-label="패치노트 버전 선택">
          <button type="button" class="notice-version-label active" data-notice-version-label="v105" aria-selected="true">V 1.0.5</button>
          <button type="button" class="notice-version-label" data-notice-version-label="v104" aria-selected="false">V 1.0.4</button>
          <button type="button" class="notice-version-label" data-notice-version-label="v103" aria-selected="false">V 1.0.3</button>
          <button type="button" class="notice-version-label" data-notice-version-label="v102" aria-selected="false">V 1.0.2</button>
          <button type="button" class="notice-version-label" data-notice-version-label="v101" aria-selected="false">V 1.0.1</button>
        </div>
        <div class="notice-version-panels">
          <section class="notice-version-panel active" data-notice-version-panel="v105">
            <header class="notice-version-head"><h3>V 1.0.5</h3><p>2026.07.03</p></header>
            <div class="notice-step-card"><h3>기본정보 안내 개선</h3><ul>
              <li>총 SP 입력 위치를 바로 찾을 수 있도록 총 SP 아래에 안내 문구와 위쪽 화살표를 추가했습니다.</li>
              <li>안내 문구는 PC, 태블릿, 모바일에서 한 줄로 보이도록 맞췄습니다.</li>
              <li>에디셔널 평균값 안내는 더 짧게 읽히도록 “평균값을 입력하면 표기 스탯에 반영됩니다.”로 정리했습니다.</li>
            </ul></div>
            <div class="notice-step-card"><h3>특성 프리셋 개선</h3><ul>
              <li>프리셋 목록에서 이름을 누르면 그 프리셋이 바로 적용됩니다.</li>
              <li>프리셋 업데이트를 누르면 현재 화면값이 선택한 프리셋에 저장됩니다.</li>
              <li>총 SP처럼 함께 쓰는 값은 다른 프리셋에도 같이 반영됩니다.</li>
              <li>난이도와 목표 라운드처럼 프리셋마다 달라야 하는 값은 선택한 프리셋에만 저장됩니다.</li>
              <li>엑셀에서 SP 은행 특성이 1 이상이면 SP 은행이 켜진 상태로 불러오고, 총 SP에 이미 포함된 7,250,000은 다시 더하지 않습니다.</li>
              <li>내보내기 버튼이 강조되면 파일로 저장하지 않은 변경사항이 있다는 뜻입니다.</li>
            </ul></div>
          </section>
          <section class="notice-version-panel" data-notice-version-panel="v104" hidden>
            <header class="notice-version-head"><h3>V 1.0.4</h3><p>2026.07.01</p></header>
            <div class="notice-step-card"><h3>구버전 프리셋 지원 종료</h3><ul>
              <li>v2 통합 프리셋은 그대로 사용할 수 있습니다.</li>
              <li>v2보다 오래된 구버전 프리셋은 더 이상 지원하지 않습니다.</li>
              <li>구버전 프리셋을 사용 중이라면 엑셀 파일을 다시 불러온 뒤, 새 특성 프리셋을 생성해 주세요.</li>
              <li>오래된 프리셋 변환 기능을 정리하여 프리셋 가져오기, 내보내기, 분석 기능이 더 안정적으로 동작하도록 개선했습니다.</li>
            </ul></div>
          </section>
          <section class="notice-version-panel" data-notice-version-panel="v103" hidden>
            <header class="notice-version-head"><h3>V 1.0.3</h3><p>2026.06.29</p></header>
            <div class="notice-step-card"><h3>유물 DPS 추가</h3><ul><li>유물 DPS ON을 누르면 유물 대상 DPS가 표시됩니다.</li></ul></div>
            <div class="notice-step-card"><h3>유물 DPS표</h3><ul><li>유물 DPS ON 시 편의 - DPS표가 유물 DPS표로 변경됩니다.</li><li>개인, 협동, 도전의탑 DPS표가 유물 기준으로 표기됩니다.</li></ul></div>
            <div class="notice-step-card"><h3>프리셋 분석 기능 업데이트</h3><ul><li>단순 비교뿐만 아니라 타인의 데이터 프리셋과 본인의 데이터 프리셋을 비교할 수 있습니다.</li><li>웹버전 특성계산기를 쓰는 유저는 프리셋 내보내기 파일을 공유받아 고행 클리어컷 DPS를 비교할 수 있습니다.</li></ul></div>
            <div class="notice-step-card"><h3>기타 개선</h3><ul><li>기타 사소한 기능 추가와 사용성 개선을 반영했습니다.</li></ul></div>
          </section>
          <section class="notice-version-panel" data-notice-version-panel="v102" hidden>
            <header class="notice-version-head"><h3>V 1.0.2</h3><p>2026.06.21</p></header>
            <div class="notice-step-card"><h3>테마 변경</h3><ul><li>밝은 테마에서 어두운 테마로 변경되었습니다.</li></ul></div>
            <div class="notice-step-card"><h3>특성 프리셋 기능 추가</h3><ul><li>원하는 특성을 저장하고 언제든 로드 버튼으로 불러올 수 있습니다.</li><li>여러 프리셋을 등록한 뒤 내보내기를 하면 한 개의 파일로 여러 프리셋을 백업 관리할 수 있습니다.</li></ul></div>
            <div class="notice-step-card"><h3>비교분석 / DPS표 업데이트</h3><ul><li>비교분석 기능에서 특성 프리셋 파일을 불러와 프리셋별 특성 분석이 가능합니다.</li><li>DPS표에 협동이 추가되었습니다. 버스 기사 DPS를 보는 용도가 주 목적입니다.</li></ul></div>
          </section>
          <section class="notice-version-panel" data-notice-version-panel="v101" hidden>
            <header class="notice-version-head"><h3>V 1.0.1</h3><p>2026.06.13</p></header>
            <div class="notice-step-card"><h3>편의기능</h3><ul><li>DPS표: 유저 스펙 기반 난이도별 DPS 정보 표를 추가했습니다.</li><li>비교하기: 엑셀 데이터를 웹에 적용하거나 상대방의 DPS 웹 파일을 받아 비교할 수 있습니다. 엑셀 5.4392와 웹백업.txt를 지원합니다.</li><li>웹사이트 기반 데이터 관리: 입력값 저장, 삭제, 백업, 복원을 지원합니다.</li><li>입력값 저장 후 새로고침해도 값이 유지됩니다. 캐시를 삭제하면 초기화되므로 입력값 백업을 권장합니다.</li><li>이달의룬/쥬얼 효과 목록을 추가했습니다.</li><li>넥서스 히든조합&정수 계산 사이트 이동 버튼을 추가했습니다.</li><li>PC 가로/세로, 모바일, 태블릿을 모두 지원합니다.</li></ul></div>
            <div class="notice-step-card"><h3>DPS표 개선 및 기능추가</h3><ul><li>웹에서 라운드 입력에 반응하여 DPS가 표시됩니다.</li><li>난이도 Hall of fame, Abyss Road, Deep Abyss가 추가되었습니다.</li><li>도전의탑이 추가되었습니다.</li><li>도전의탑은 1층~90층으로 표시하고, 층마다 방어력·체력·실드·스폰 마리수를 보여주도록 변경했습니다.</li><li>도전의탑은 계산기 기능 DPS이므로 DPS가 높게 나와도 클리어 가능을 보장하지 않습니다.</li></ul></div>
            <div class="notice-step-card"><h3>비교하기 업데이트</h3><ul><li>Reunite 님의 엑셀 5.4392 버전을 기준으로 웹 데이터를 추출 적용할 수 있습니다.</li><li>구버전 사용은 가능하지만 데이터 추출 시트·열·행 차이가 발생하면 비교하기 기능이 차단됩니다.</li><li>데이터 구조가 같은 엑셀을 추가하면 현재값은 웹 데이터, 변경값은 웹 데이터 또는 엑셀 데이터로 표시됩니다.</li><li>변경값 적용 시 변경값의 모든 데이터가 웹에 적용됩니다.</li><li>엑셀 파일 비교 시 고행 시트뿐 아니라 모든 엑셀 시트의 DPS를 비교 적용할 수 있습니다.</li><li>현재값과 변경값의 오차는 -/+로 표시하고, 두 값이 같으면 일치로 표시합니다.</li></ul></div>
            <div class="notice-step-card"><h3>더제로 승단 정보</h3><ul><li>더제로 승단 점수, 혜택, 계산방식, 실제 승단점수 계산표를 구현했습니다.</li><li>엑셀 - 더제로승단 시트 데이터와 연동하여 자동 입력됩니다. 비교하기 기능을 사용하면 됩니다.</li></ul></div>
            <div class="notice-step-card"><h3>이달의룬 / 쥬얼</h3><ul><li>개복디 인게임에 있는 이달의룬 효과목록을 추가했습니다.</li><li>개복디 인게임에 있는 쥬얼 효과목록을 추가했습니다.</li></ul></div>
          </section>
        </div>
      `,
      actions: []
    },
    'preset-guide': {
      title: '프리셋 관련',
      level: 'note',
      html: `
        <div class="notice-hero-card notice-hero-note">
          <span class="notice-hero-label">특성 프리셋</span>
          <strong>프리셋을 고르면 바로 불러오고, 업데이트는 현재 프리셋을 기준으로 저장합니다.</strong>
          <p>다른 프리셋으로 이동하기 전에 현재 값을 남기고 싶다면 먼저 프리셋 업데이트를 눌러 주세요.</p>
        </div>
        <div class="notice-step-card">
          <h3>프리셋 목록 사용</h3>
          <ul>
            <li>프리셋 목록에서 이름을 누르면 선택한 프리셋이 바로 화면에 적용됩니다.</li>
            <li>목록에 보이는 번호, 기본, 업데이트됨 표시는 관리하기 쉽게 보여주는 표시입니다.</li>
            <li>표시가 붙어도 저장된 프리셋 이름 자체가 바뀌는 것은 아닙니다.</li>
          </ul>
        </div>
        <div class="notice-step-card">
          <h3>프리셋 업데이트를 누르면</h3>
          <ul>
            <li>현재 선택한 프리셋에는 지금 화면의 값이 저장됩니다.</li>
            <li>모든 프리셋에서 같이 쓰는 값은 다른 프리셋에도 같이 반영됩니다.</li>
            <li>총 SP는 같이 쓰는 값이라 다른 프리셋에도 함께 반영됩니다.</li>
            <li>프리셋마다 따로 써야 하는 값은 현재 선택한 프리셋에만 저장됩니다.</li>
            <li>내보내기 버튼이 강조되면 아직 파일로 저장하지 않은 변경사항이 있다는 뜻입니다.</li>
            <li>변경한 프리셋을 백업하거나 다른 사람에게 보내려면 내보내기 버튼으로 새 파일을 저장해 주세요.</li>
          </ul>
        </div>
        <div class="notice-step-card">
          <h3>현재 프리셋에만 저장되는 값</h3>
          <p>아래 값은 프리셋마다 다르게 쓰는 값입니다. 업데이트를 눌러도 다른 프리셋으로 따라 바뀌지 않습니다.</p>
          <ul>
            <li>기본 정보: 난이도, 고행 단계, 목표 라운드, 도전의탑 층</li>
            <li>플레이 방식: 개인/협동 선택, 협동 인원수, 출발 지원 인원수</li>
            <li>지원 설정: 파워 블레스, SP 은행 적용 상태</li>
            <li>룬효과/버프: 오버핸스, 리페핸스, 강화의 달인, 선택 버프, 꽃가루 버프</li>
            <li>특성 관련: 특성 투자값 전체, 특성 투자 제한, 루키 특성부터 심연 특성까지</li>
          </ul>
        </div>
        <div class="notice-step-card">
          <h3>SP 은행과 엑셀 불러오기</h3>
          <ul>
            <li>엑셀에서 SP 은행 특성이 1 이상이면 SP 은행은 켜진 상태로 불러옵니다.</li>
            <li>엑셀의 총 SP에 SP 은행 보너스 7,250,000이 이미 들어간 경우, 남은 SP에 다시 더하지 않습니다.</li>
            <li>SP 은행 특성에 투자한 SP는 그대로 투자 SP로 계산합니다.</li>
          </ul>
        </div>
        <div class="notice-step-card">
          <h3>예시</h3>
          <ul>
            <li>A 프리셋에서 난이도만 바꾸고 업데이트하면 A 프리셋에만 저장됩니다.</li>
            <li>B, C, D 프리셋의 난이도는 기존 값 그대로 유지됩니다.</li>
            <li>총 SP처럼 모든 프리셋이 같이 써야 하는 입력값을 바꾸면 다른 프리셋에도 함께 반영됩니다.</li>
          </ul>
        </div>
      `,
      actions: []
    },
    notes: {
      title: 'DPS 계산 기준',
      level: 'note',
      html: `
        <div class="notice-hero-card notice-hero-note">
          <span class="notice-hero-label">참고사항</span>
          <strong>모드마다 적용되는 DPS 계산 기준이 다릅니다.</strong>
          <p>실제 DPS 계산은 현재 선택한 모드 기준으로 처리됩니다.</p>
        </div>
        <div class="notice-step-card">
          <h3>먼저 알아둘 점</h3>
          <ul>
            <li>현재 모드에서 쓰지 않는 항목은 DPS 계산에 반영되지 않습니다.</li>
            <li>유물 DPS 스위치는 데미지 보드와 DPS표의 표시 기준만 바꾸며, 실제 유물 체크값·저장값·기본 DPS 계산값은 변경하지 않습니다.</li>
          </ul>
        </div>
        <div class="notice-step-card">
          <h3>개인전</h3>
          <ul>
            <li>내가 입력한 스펙, 특성, 룬, 인첸트 값을 기준으로 계산합니다.</li>
            <li>적 물량은 1배 기준으로 계산합니다.</li>
          </ul>
        </div>
        <div class="notice-step-card">
          <h3>협동전</h3>
          <ul>
            <li>협동 가능한 난이도에서만 협동 DPS로 계산합니다.</li>
            <li>협동 DPS표는 2인/3인 적 물량을 기준으로 계산합니다.</li>
            <li>2P, 3P의 스펙은 따로 입력받지 않고 모두 0으로 계산합니다.</li>
            <li>도전의 탑, Abyss road, Deep Abyss에서는 협동 DPS가 적용되지 않습니다.</li>
          </ul>
        </div>
        <div class="notice-step-card">
          <h3>도전의 탑</h3>
          <ul>
            <li>도전의 탑은 목표 라운드가 아니라 도전의탑 층수로 계산합니다.</li>
            <li>고행 단계와 목표 라운드는 저장되지만, 도전의 탑 DPS에는 적용되지 않습니다.</li>
            <li>1층~80층은 정해진 기준값으로 계산합니다.</li>
            <li>81층~90층은 별도 기준값으로 계산합니다.</li>
            <li>층별 적 체력, 실드, 물량 기준을 반영합니다.</li>
          </ul>
        </div>
        <div class="notice-step-card">
          <h3>Abyss road / Deep Abyss</h3>
          <ul>
            <li>침식 스텍과 심연 내성은 Abyss road, Deep Abyss에서 적용됩니다.</li>
            <li>Abyss road는 고행 단계가 적용됩니다.</li>
            <li>Deep Abyss는 고행 단계가 적용되지 않습니다.</li>
            <li>Abyss road, Deep Abyss에서는 협동 DPS가 적용되지 않습니다.</li>
            <li>코랄/아이어/제루스 파편은 0~9999 입력값을 저장하고, 현재 DPS에는 250/400 생산 버프 조건만 적용됩니다.</li>
            <li>Deep Abyss에서는 출발 지원 인원수로 늘어나는 팀 특성 배율이 적용되지 않습니다.</li>
          </ul>
        </div>
      `,
      actions: []
    },
    creator: {
      title: '문의',
      level: 'info',
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
      `,
      actions: []
    }
  };

  let activeTab = 'patch-notes';

  function tabHtml(target) {
    return NOTICE_TABS.map((tab) => {
      const active = tab.id === target;
      return `<button type="button" class="notice-tab${active ? ' active' : ''}" data-notice-tab="${tab.id}" aria-selected="${active ? 'true' : 'false'}"><span>${tab.label}</span><small>${tab.meta}</small></button>`;
    }).join('');
  }
  function contentHtml(target) {
    const item = NOTICE_CONTENT[target] || NOTICE_CONTENT['patch-notes'];
    return `<section class="notice-content notice-level-${item.level || 'note'}" data-notice-content="${target}"><h2><span>${item.title}</span></h2><div class="notice-content-body">${item.html}</div></section>`;
  }
  function renderNoticeInto(root, target = activeTab) {
    if (!root) return;
    activeTab = NOTICE_TAB_IDS.has(target) ? target : 'patch-notes';
    root.innerHTML = `<div class="notice-tabs" role="tablist" aria-label="정보&안내 탭">${tabHtml(activeTab)}</div><div class="notice-content-mount">${contentHtml(activeTab)}</div>`;
  }
  function ensureNoticeModal() {
    let shell = $('noticeModalShell');
    if (shell) return shell;
    shell = window.DpsModal.createModalShell('noticeModalShell', 'notice-modal-shell', `
      <div class="notice-modal-backdrop" data-notice-close="1"></div>
      <section class="notice-modal" role="dialog" aria-modal="true" aria-labelledby="noticeModalTitle">
        <header class="notice-modal-head">
          <div class="notice-modal-title-wrap"><span class="notice-modal-icon" aria-hidden="true">i</span><div><span class="notice-modal-kicker">DPS CALCULATOR</span><h2 id="noticeModalTitle">정보&안내</h2></div></div>
          <button type="button" class="notice-modal-close" data-notice-close="1" aria-label="정보&안내 닫기">×</button>
        </header>
        <div class="notice-modal-body" id="noticeModalBody"></div>
      </section>`);
    return shell;
  }
  function openNoticeModal(tab = 'patch-notes') {
    ensureNoticeModal();
    renderNoticeInto($('noticeModalBody'), tab);
    window.DpsModal.setModalOpen('noticeModalShell','notice-modal-open',true, { rootClass: true });
  }
  function closeNoticeModal() {
    window.DpsModal.setModalOpen('noticeModalShell','notice-modal-open',false, { rootClass: true });
  }
  function selectNoticePatchVersion(labelButton) {
    const versionKey = labelButton?.getAttribute('data-notice-version-label');
    const content = labelButton?.closest('[data-notice-content="patch-notes"]');
    if (!versionKey || !content) return;
    content.querySelectorAll('[data-notice-version-label]').forEach((button) => {
      const active = button === labelButton;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    content.querySelectorAll('[data-notice-version-panel]').forEach((panel) => {
      const active = panel.getAttribute('data-notice-version-panel') === versionKey;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
  }
  function handleNoticeClick(event) {
    const openTarget = event.target.closest('[data-action="openNoticeModal"], [data-notice-open]');
    if (openTarget) { event.preventDefault(); openNoticeModal('patch-notes'); return; }
    const closeTarget = event.target.closest('[data-notice-close]');
    if (closeTarget) { event.preventDefault(); closeNoticeModal(); return; }
    const versionTarget = event.target.closest('[data-notice-version-label]');
    if (versionTarget) { event.preventDefault(); selectNoticePatchVersion(versionTarget); return; }
    const tabTarget = event.target.closest('[data-notice-tab]');
    if (tabTarget) {
      event.preventDefault();
      activeTab = tabTarget.getAttribute('data-notice-tab') || 'patch-notes';
      const modalBody = $('noticeModalBody');
      if (modalBody && $('noticeModalShell')?.classList.contains('is-open')) renderNoticeInto(modalBody, activeTab);
    }
  }
  function initNotice() {
    document.addEventListener('click', handleNoticeClick, true);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && $('noticeModalShell')?.classList.contains('is-open')) closeNoticeModal(); });
  }
  window.DpsNotice = { open: openNoticeModal, close: closeNoticeModal };
  window.openNoticeModal = openNoticeModal;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNotice, { once: true });
  else initNotice();
})();
