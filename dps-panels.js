/* ===== dps-panels.js | DPS표 / 룬·쥬얼 / 비교 모달 UI ===== */
/* 계산 결과를 표와 모달로 보여주는 화면 전용 모듈이다. 계산식은 calc.js를 호출한다. */

/* ===== 00. DPS표 상수 / 모드 설정 ===== */
const DPS_TABLE_DIFFICULTIES=DPS_CONFIG.dpsTable.difficulties;
const COOP_DPS_TABLE_DIFFICULTIES=DPS_TABLE_DIFFICULTIES.slice(0, DPS_TABLE_DIFFICULTIES.indexOf('Hall Of Fame') + 1);
const COOP_DPS_TABLE_PENANCE_MIN=0;
const COOP_DPS_TABLE_PENANCE_MAX=COOP_PENANCE_MAX;
const DPS_TABLE_PENANCE_MIN=DPS_CONFIG.dpsTable.penanceMin ?? 0;
const DPS_TABLE_PENANCE_MAX=DPS_CONFIG.dpsTable.penanceMax ?? 20;
const DPS_TABLE_DECIMALS=DPS_CONFIG.dpsTable.decimals ?? 1;
const DPS_MODAL_MODES=['solo','coop','tower'];
let activeDpsTableMode='solo';
let dpsTableMinDps='1.0';
/* ===== 01. DPS표 입력값 / 위험도 표시 ===== */
function isDpsTableOpen(){
  const modal=$('monthRuneModal');
  const panel=modal?.querySelector('[data-month-rune-panel="dps"]');
  return !!(modal?.classList.contains('is-open') && panel && !panel.hidden);
}
function getDpsTableTowerGroupSize(){
  if(document.body?.classList.contains('is-mobile')) return 90;
  return 30;
}
function syncDpsMinDpsInputs(){
  ['dpsTableMinDps','dpsTableMinDpsMain'].forEach(id=>{
    const el=$(id);
    if(el && el.value!==dpsTableMinDps) el.value=dpsTableMinDps;
  });
}
function setDpsTableMinDps(value, options={}){
  const integerPart=dpsTableMinDpsIntegerPart(value);
  dpsTableMinDps=options.format ? normalizeDpsTableMinDpsValue(integerPart) : integerPart;
  syncDpsMinDpsInputs();
  updateDpsRiskViews();
  if(isDpsTableOpen()) renderDpsTablePanelContent();
  if(!storageState.isLoading){
    saveState({silent:true});
    scheduleAutoSaveToast();
  }
}
function parseDpsTableMinDps(){
  const normalized=normalizeDpsTableMinDpsValue(dpsTableMinDps);
  const n=Number(String(normalized||'').replace(/,/g,'').trim());
  return Number.isFinite(n) && n>=0 ? n : null;
}
function formatDpsTableValue(value){
  if(!Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR',{minimumFractionDigits:DPS_TABLE_DECIMALS, maximumFractionDigits:DPS_TABLE_DECIMALS});
}
function updateDpsRiskViews(currentDps){
  const card=qs('.dps-card');
  const dpsEl=$('dpsVal');
  if(!card) return;
  const minDps=parseDpsTableMinDps();
  const raw=Number.isFinite(currentDps) ? currentDps : Number(String(dpsEl?.textContent||'').replace(/,/g,'').trim());
  const isRisk=minDps!==null && Number.isFinite(raw) && raw<=minDps;
  card.classList.toggle('is-dps-risk', !!isRisk);
  let badge=$('dpsRiskBadge');
  if(!badge){
    badge=document.createElement('div');
    badge.id='dpsRiskBadge';
    badge.className='dps-risk-badge';
    card.appendChild(badge);
  }
  badge.style.display=isRisk ? 'inline-flex' : 'none';
  if(isRisk) badge.textContent=`위험구간`;
}
/* DPS표 행은 현재 DPS보기 상태에 맞춰 기본/유물 표시값을 선택한다. */
/* ===== 02. DPS표 행렬 생성 / 표시값 산출 ===== */
function dpsTablePreviewValue(diff, penance, round, options={}){
  if(isArtifactDpsViewEnabled()) return calculateArtifactDpsPreview(diff, penance, round, options).dps;
  return computeDpsPreview(diff, penance, round, options);
}
function dpsTableDisplayTitle(){
  return isArtifactDpsViewEnabled() ? '유물 DPS표' : 'DPS표';
}
function syncDpsTableLabels(){
  const label=dpsTableDisplayTitle();
  setText('dpsTableMenuButton', label);
  const titleEl=$('monthRuneTitle');
  if(titleEl && isDpsTableOpen()) titleEl.textContent=label;
  const closeBtn=$('monthRuneModal')?.querySelector('.month-rune-close');
  if(closeBtn && isDpsTableOpen()) closeBtn.setAttribute('aria-label', `${label} 닫기`);
}

function buildDpsTable(round){
  const minDps=parseDpsTableMinDps();
  const currentDiff=vs('diff');
  const currentPen=Math.max(DPS_TABLE_PENANCE_MIN, Math.min(DPS_TABLE_PENANCE_MAX, Math.round(v('penance'))));
  const head=DPS_TABLE_DIFFICULTIES.map(d=>`<th class="${d===currentDiff?'dps-current-column':''}">${d}</th>`).join('');
  const rows=[];
  for(let pen=DPS_TABLE_PENANCE_MIN; pen<=DPS_TABLE_PENANCE_MAX; pen++){
    const rowCurrent=pen===currentPen;
    const cells=DPS_TABLE_DIFFICULTIES.map(diff=>{
      const value=dpsTablePreviewValue(diff, pen, round, {battleMode:'solo'});
      const danger=minDps!==null && dpsTableRiskCompareValue(value)<=minDps;
      const currentCell=rowCurrent && diff===currentDiff;
      const classes=[danger?'dps-risk-cell':'', currentCell?'dps-current-cell':''].filter(Boolean).join(' ');
      return `<td class="${classes}">${formatDpsTableValue(value)}</td>`;
    }).join('');
    rows.push(`<tr${rowCurrent?' class="dps-current-row"':''}><th>${pen}</th>${cells}</tr>`);
  }
  return `<table class="dps-matrix dps-round-matrix"><thead><tr><th>고행</th>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
function buildCoopDpsMatrix(players, round){
  const minDps=parseDpsTableMinDps();
  const currentDiff=vs('diff');
  const currentPen=Math.max(COOP_DPS_TABLE_PENANCE_MIN, Math.min(COOP_DPS_TABLE_PENANCE_MAX, Math.round(v('penance'))));
  const head=COOP_DPS_TABLE_DIFFICULTIES.map(diff=>`<th class="${diff===currentDiff?'dps-current-column':''}">${diff}</th>`).join('');
  const rows=[];
  for(let pen=COOP_DPS_TABLE_PENANCE_MIN; pen<=COOP_DPS_TABLE_PENANCE_MAX; pen++){
    const rowCurrent=pen===currentPen;
    const cells=COOP_DPS_TABLE_DIFFICULTIES.map(diff=>{
      const value=dpsTablePreviewValue(diff, pen, round, {battleMode:'coop', coopPlayers:String(players)});
      const danger=minDps!==null && dpsTableRiskCompareValue(value)<=minDps;
      const currentCell=rowCurrent && diff===currentDiff;
      const classes=[danger?'dps-risk-cell':'', currentCell?'dps-current-cell':''].filter(Boolean).join(' ');
      return `<td class="${classes}">${formatDpsTableValue(value)}</td>`;
    }).join('');
    rows.push(`<tr${rowCurrent?' class="dps-current-row"':''}><th>${pen}</th>${cells}</tr>`);
  }
  return `<table class="dps-matrix dps-round-matrix dps-coop-matrix"><thead><tr><th>고행</th>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
function buildCoopDpsTable(round){
  return [2,3].map(players=>`
    <section class="dps-coop-block" aria-label="협동 ${players}인 DPS표">
      <header class="dps-coop-head"><b>협동 ${players}인</b><span>${round}라운드 · 0~13고행</span></header>
      <div class="dps-table-scroll dps-coop-scroll">${buildCoopDpsMatrix(players, round)}</div>
    </section>
  `).join('');
}
function buildDpsTowerTable(){
  const minDps=parseDpsTableMinDps();
  const currentDiff=vs('diff');
  const currentFloor=normalizedTowerFloorNumber(challengeTowerFloorStoredValue());
  const tower=DPS_CONFIG.dpsTable.tower || {};
  const range={ min:Math.max(1, Math.round(tower.minFloor || 1)), max:Math.max(1, Math.round(tower.maxFloor || 90)) };
  const groupSize=getDpsTableTowerGroupSize();
  const chunks=chunkDpsTowerFloors(range.min, range.max, groupSize);
  const blocks=chunks.map(floors=>{
    const rows=floors.map(floor=>{
      const value=dpsTablePreviewValue('도전의 탑', 0, floor, {battleMode:'solo'});
      const danger=minDps!==null && dpsTableRiskCompareValue(value)<=minDps;
      const currentCell=currentFloor===floor;
      const classes=['dps-cell', danger?'dps-risk-cell':'', currentCell?'dps-current-cell':''].filter(Boolean).join(' ');
      const enemyItems=towerEnemySummaryItems(floor);
      const enemySummaryHtml=enemyItems.map(([label,value])=>`<span class="dps-tower-enemy-item"><em>${label}</em><b>${value}</b></span>`).join('');
      return `<tr${currentCell?' class="dps-current-row"':''}><th>${floor}층</th><td class="${classes}"><b class="dps-tower-value">${formatDpsTableValue(value)}</b><span class="dps-tower-enemy">${enemySummaryHtml}</span></td></tr>`;
    }).join('');
    const first=floors[0], last=floors[floors.length-1];
    return `<div class="dps-tower-block" aria-label="도전의탑 ${first}층부터 ${last}층까지"><table class="dps-matrix dps-tower-matrix"><thead><tr><th>층</th><th>DPS</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
  return `<div class="dps-tower-grid" data-tower-group-size="${groupSize}">${blocks}</div>`;
}
function renderDpsTableTabs(round, options={}){
  return [
    {key:'solo',label:'개인'},
    {key:'coop',label:'협동'},
    {key:'tower',label:'도전의탑'}
  ].map(tab=>{
    const active=activeDpsTableMode===tab.key;
    return `
      <button type="button" class="ui-tab-btn dps-table-tab ${active?'is-active':''}" data-dps-table-mode="${tab.key}" role="tab" aria-selected="${active?'true':'false'}">
        <b>${tab.label}</b>
      </button>
    `;
  }).join('');
}
/* ===== 03. 공통 모달 헤더 / 탭 설정 ===== */
const MONTH_RUNE_MODAL_TITLES={
  compare:'프리셋 분석',
  runes:'이달의 룬',
  jewels:'쥬얼',
  dps:'DPS표'
};
const MONTH_RUNE_MODAL_CLASS_NAMES=['is-modal-compare','is-modal-runes','is-modal-jewels','is-modal-dps'];
function buildCompareHeaderControls(){
  return `<div class="excel-compare-controls excel-compare-header-controls">
    <label class="ui-action-btn excel-compare-file-btn excel-compare-base-file-btn">기준 파일<input id="excelCompareBaseFile" type="file" accept=".json,.txt,application/json,text/plain"></label>
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
/* ===== 04. DPS표 패널 렌더링 ===== */
function dpsTableRound(){
  return normalizedRoundNumber(targetRoundStoredValue());
}
function renderDpsTablePanel(){
  return `<section class="month-rune-panel dps-table-inline-panel" data-month-rune-panel="dps" role="tabpanel" aria-labelledby="monthRuneTitle" hidden>
    <div class="dps-table-body" id="dpsTableMount" data-dps-table-mount></div>
  </section>`;
}
function dpsTablePanelInnerHtml(){
  const round=dpsTableRound();
  syncDpsMinDpsInputs();
  let tableHtml='';
  if(activeDpsTableMode==='tower'){
    tableHtml=`<div class="dps-table-scroll">${buildDpsTowerTable()}</div>`;
  }else if(activeDpsTableMode==='coop'){
    tableHtml=`<div class="dps-coop-stack">${buildCoopDpsTable(round)}</div>`;
  }else{
    tableHtml=`<div class="dps-table-scroll">${buildDpsTable(round)}</div>`;
  }
  const modeClass=activeDpsTableMode==='tower' ? 'dps-tower-panel' : (activeDpsTableMode==='coop' ? 'dps-coop-panel' : 'dps-solo-panel');
  return `<section class="dps-table-panel dps-table-mode-panel ${modeClass}">${tableHtml}</section>`;
}
function syncDpsTableModalModeClass(){
  const dialog=$('monthRuneModal')?.querySelector('.month-rune-modal');
  ['solo','coop','tower'].forEach(mode=>{
    dialog?.classList.remove(`is-dps-mode-${mode}`);
    document.body?.classList.remove(`is-dps-mode-${mode}`);
  });
  const mode=['solo','coop','tower'].includes(activeDpsTableMode) ? activeDpsTableMode : 'solo';
  dialog?.classList.add(`is-dps-mode-${mode}`);
  document.body?.classList.add(`is-dps-mode-${mode}`);
}
function renderDpsTablePanelContent(){
  const round=dpsTableRound();
  syncDpsTableModalModeClass();
  syncDpsTableLabels();
  qsa('[data-dps-table-tabs-mount]').forEach(tabs=>{
    tabs.innerHTML=renderDpsTableTabs(round, {compact:true});
  });
  const inner=dpsTablePanelInnerHtml();
  qsa('[data-dps-table-mount]').forEach(mount=>{
    mount.innerHTML=inner;
  });
}
function switchDpsTableMode(mode){
  if(!['solo','coop','tower'].includes(mode) || activeDpsTableMode===mode) return;
  activeDpsTableMode=mode;
  renderDpsTablePanelContent();
}
let dpsTowerResizeTimer=0;
window.addEventListener('resize', ()=>{
  if(!isDpsTableOpen() || !['tower','coop'].includes(activeDpsTableMode)) return;
  clearTimeout(dpsTowerResizeTimer);
  dpsTowerResizeTimer=setTimeout(renderDpsTablePanelContent, 120);
}, {passive:true});
/* ===== 05. 모달 열기·닫기 / DPS표 진입 ===== */
function createModalShell(id, className, innerHtml){
  if($(id)) return;
  const modal=document.createElement('div');
  modal.id=id;
  modal.className=className;
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=innerHtml;
  document.body.appendChild(modal);
}
function setModalOpen(id, bodyClass, open){
  const modal=$(id);
  if(!modal) return null;
  modal.classList.toggle('is-open', open);
  modal.setAttribute('aria-hidden', open ? 'false' : 'true');
  document.body.classList.toggle(bodyClass, open);
  return modal;
}
function openDpsTable(mode='auto'){
  const fallbackMode=isTowerDifficulty() ? 'tower' : (isCoopActive() ? 'coop' : 'solo');
  const normalizedMode=mode==='round' ? 'solo' : (mode==='auto' ? fallbackMode : mode);
  activeDpsTableMode=DPS_MODAL_MODES.includes(normalizedMode) ? normalizedMode : fallbackMode;
  closeConvenienceMenu();
  openMonthRune('dps');
}
/* ===== 06. 이달룬 카드 렌더링 ===== */
function expandMonthRuneCodeGroup(code, desc){
  const codeText=String(code||'').trim();
  const descText=desc||'';
  const parts=codeText.split(/\s*\/\s*/).map(part=>part.trim()).filter(Boolean);
  const isRuneCodeGroup=parts.length>1 && parts.every(part=>/^\d{1,2}[A-D]\+?$/.test(part));
  if(!isRuneCodeGroup) return [[codeText, descText]];
  return parts.map(part=>[part, descText]);
}
function monthRunePairs(items){
  const pairs=[];
  for(let i=0;i<items.length;i+=2){
    pairs.push(...expandMonthRuneCodeGroup(items[i]||'', items[i+1]||''));
  }
  return pairs;
}
function renderMonthRuneRows(items){
  return monthRunePairs(items).map(([code,desc])=>`
    <div class="month-rune-effect-row">
      <b>${escapeCompareHtml(code)}</b>
      <span>${escapeCompareHtml(desc)}</span>
    </div>
  `).join('');
}
function renderMonthRuneCard(item){
  return `
    <article class="month-rune-card">
      <header class="month-rune-card-head">
        <b>${item.month}월 룬</b>
      </header>
      <div class="month-rune-compare">
        <section class="month-rune-side normal">
          <h3>일반 <em>RP+1</em></h3>
          <div class="month-rune-effects">${renderMonthRuneRows(item.normal)}</div>
        </section>
        <section class="month-rune-side plus">
          <h3>플러스 <em>RP+2</em></h3>
          <div class="month-rune-effects">${renderMonthRuneRows(item.plus)}</div>
        </section>
      </div>
    </article>
  `;
}
/* ===== 07. 쥬얼 카드 / 이미지 fallback ===== */
function getJewelImageKey(name){
  return `jw/${String(name||'').trim()}.png`;
}
function getJewelImageSources(name){
  const safeName=encodeURIComponent(String(name||'').trim());
  const key=getJewelImageKey(name);
  const version=encodeURIComponent(window.DPS_BUILD_VERSION || 'dev');
  const assetUrl=typeof window.dpsAssetUrl==='function' ? window.dpsAssetUrl : null;
  const remoteUrl=typeof window.dpsRemoteAssetUrl==='function'
    ? window.dpsRemoteAssetUrl(key, key)
    : `https://sldbox.github.io/dps/jw/${safeName}.png?v=${version}`;
  return {
    src:assetUrl ? assetUrl(`./jw/${safeName}.png`, key) : `./jw/${safeName}.png?v=${version}`,
    fallback:remoteUrl
  };
}
function handleJewelImageError(img){
  if(!img) return;
  const fallbackSrc=img.dataset?.fallbackSrc || '';
  if(fallbackSrc){
    img.dataset.fallbackSrc='';
    img.src=fallbackSrc;
    return;
  }
  const visual=img.closest('.jewel-card-visual');
  if(visual) visual.classList.add('is-missing');
  img.remove();
}
function bindJewelImageEvents(){
  document.addEventListener('error', e=>{
    const img=e.target?.closest?.('.jewel-card-visual img[data-jewel-image]');
    if(img) handleJewelImageError(img);
  }, true);
}
function renderJewelAbility(label, text){
  const value=String(text||'').trim();
  const isUnreleased=value==='미발견';
  return `
    <div class="jewel-ability ${isUnreleased?'is-unreleased':''}">
      <b>${escapeCompareHtml(label)}</b>
      <span>${escapeCompareHtml(value)}</span>
    </div>
  `;
}
function renderJewelCard(row){
  const name=String(row?.[0]||'');
  const legendary=String(row?.[1]||'');
  const mythic=String(row?.[2]||'');
  const initial=name ? name.charAt(0) : '?';
  const imageSources=getJewelImageSources(name);
  const fallbackAttr=imageSources.fallback && imageSources.fallback!==imageSources.src ? ` data-fallback-src="${escapeCompareHtml(imageSources.fallback)}"` : '';
  return `
    <article class="jewel-card">
      <header class="jewel-card-head">
        <div class="jewel-card-visual" aria-hidden="true">
          <img src="${escapeCompareHtml(imageSources.src)}"${fallbackAttr} data-jewel-image="1" alt="" loading="lazy">
          <span>${escapeCompareHtml(initial)}</span>
        </div>
        <b>${escapeCompareHtml(name)}</b>
      </header>
      <div class="jewel-ability-list">
        ${renderJewelAbility('전설', legendary)}
        ${renderJewelAbility('신화', mythic)}
      </div>
    </article>
  `;
}
function renderMonthRunePanelContent(info){
  const months=(info.months||[]);
  const content=months.length ? months.map(renderMonthRuneCard).join('') : '<div class="month-rune-empty">이달룬 데이터가 없습니다.</div>';
  const noteText=String(info.note||'').trim();
  const noteHtml=noteText ? `<div class="month-rune-note">${escapeCompareHtml(noteText)}</div>` : '';
  return `${noteHtml}<div class="month-rune-grid">${content}</div>`;
}
function renderMonthRunePanel(info){
  return `
    <section class="month-rune-panel is-active" data-month-rune-panel="runes" role="tabpanel" aria-labelledby="monthRuneTitle">
      ${renderMonthRunePanelContent(info)}
    </section>
  `;
}
function renderJewelPanelContent(items){
  const list=Array.isArray(items)?items:[];
  const content=list.length ? list.map(renderJewelCard).join('') : '<div class="month-rune-empty">쥬얼 데이터가 없습니다.</div>';
  return `<div class="jewel-grid">${content}</div>`;
}
function renderJewelPanel(items){
  return `
    <section class="month-rune-panel" data-month-rune-panel="jewels" role="tabpanel" aria-labelledby="monthRuneTitle" hidden>
      ${renderJewelPanelContent(items)}
    </section>
  `;
}
/* ===== 08. 모달 탭 전환 / 이벤트 바인딩 ===== */
function syncComparePanelAfterRender(){
  hydrateCompareControls();
  if(compareState.lastResult) renderExcelComparison(compareState.lastResult,{preserveFilter:true});
  else if(compareState.sourceType==='json' && compareState.backupState) renderJsonComparison(compareState.backupState);
  else if(compareState.sourceType==='traitPreset' && compareState.traitPresetBundle) compareSelectedTraitPreset({preserveRestore:true});
  else if(compareState.workbook && compareState.sourceType==='excel') compareSelectedExcelSheet({preserveRestore:true});
  else updateCompareActionButtons();
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
