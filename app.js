/* ===== app.js | 앱 부트스트랩 / 공통 UI / 재계산 흐름 ===== */
/* 분리 모듈은 전역 함수로 로드되고, 이 파일은 초기화 순서와 공통 이벤트 연결만 담당한다. */

/* ===== 00. DOM 헬퍼 ===== */
const $=id=>document.getElementById(id);
const qs=selector=>document.querySelector(selector);
const qsa=selector=>document.querySelectorAll(selector);

/* ===== 01. 전역 설정 / 캐시·저장·UI 기준값 ===== */
var DPS_CONFIG={
  storage:{
    version:(window.DPS_BUILD_VERSION || 'dev'),
    scope:'browser_local',
    key:'gbd_dps_calculator:personal_state',
    fontKey:'gbd_dps_calculator:font_scale',
    clientKey:'gbd_dps_calculator:client_id',
    traitPresetKey:'gbd_dps_calculator:trait_presets',
    traitPresetStatusKey:'gbd_dps_calculator:trait_preset_status'
  },

  state:{
    skipElementIds:['dpsTableMinDpsMain','ep','artifactDpsViewToggle']
  },

  dpsTable:{
    difficulties:['Practice','Very Easy','Easy','Normal','Hard','Very Hard','Hell','Inferno','Lunatic','Holic','Epic','Ultimate','Impossible','The Final','Hall Of Fame','Abyss road','Deep Abyss'],
    tower:{minFloor:1,maxFloor:90},
    penanceMin:0,
    penanceMax:20,
    decimals:1
  },

  ui:{
    updateDelay:16,
    confirmDelayMs:1600,
    traitHoldInitialDelay:320,
    traitHoldRepeatMs:55,
    traitHoldAccelEvery:7,
    traitHoldMaxStep:50,
    fontScaleDefault:1,
    fontScaleMin:0.9,
    fontScaleMax:2,
    fontScaleStep:0.05,
    mobileMaxWidth:600
  }
};

window.DPS_CONFIG=DPS_CONFIG;
/* calc.js가 계산 함수, data.js가 고정 데이터를 제공한다. */

/* ===== 02. 전역 투자 상태 / 입력 공통 상수 ===== */
const INV={};
TRAITS.forEach(t=>{INV[t[0]]=0;});
Object.assign(INV,{116:1});
const AUTO_INVEST_EXCLUDED_ROWS=new Set([45,87]);
const ENCHANT_INPUT_IDS=['enchAD','enchCRI','enchUA','enchTD','enchSR','enchHR'];
const ENCHANT_INPUT_ID_SET=new Set(ENCHANT_INPUT_IDS);
/* 특성 비용·효율 계산은 calc.js에서 로드된다. */

/* ===== 03. 공통 알림 / 입력값 읽기·쓰기 유틸 ===== */
function rememberAppIssue(kind, label, error){
  try{
    window.DPS_LAST_ISSUE={kind,label,error,time:Date.now()};
  }catch(_){}
}
function logAppError(label, error){rememberAppIssue('error', label, error);}
function logAppWarn(label, error){rememberAppIssue('warn', label, error);}
function alertApp(message){
  try{ alert(message); }catch(_){}
}
function alertAppError(prefix, error){
  alertApp(prefix+(error?.message || error));
}
function showToast(message, type='ok'){
  try{
    let root=$('toastRoot');
    if(!root){
      root=document.createElement('div');
      root.id='toastRoot';
      root.className='toast-root';
      root.setAttribute('aria-live','polite');
      document.body.appendChild(root);
    }
    const el=document.createElement('div');
    const text=String(message ?? '');
    el.className='toast '+type;
    el.textContent=text;
    root.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('show'));
    const visibleMs=text.includes('\n') ? 5200 : 2200;
    setTimeout(()=>{
      el.classList.remove('show');
      setTimeout(()=>el.remove(), 220);
    }, visibleMs);
  }catch(e){}
}
function v(id){
  const el=$(id); if(!el) return 0;
  if(id==='round') return normalizedRoundNumber(targetRoundStoredValue());
  if(id==='challengeTowerFloor') return normalizedTowerFloorNumber(challengeTowerFloorStoredValue());
  if(id==='penance') return effectivePenanceValue();
  if(id==='pbless') return effectivePowerBlessValue();
  const raw=String(el.value??'').replace(/,/g,'').trim();
  if(id==='skillRound') return normalizedRoundNumber(raw);
  return +raw||0;
}
function vs(id){const el=$(id); return el ? el.value : '';}
function normalizeXpInput(){
  const el=$('xp');
  if(!el) return 1;
  const n=Math.max(1, v('xp'));
  if(v('xp')!==n) el.value=String(n.toLocaleString('ko-KR'));
  return n;
}
function setText(id,val){const el=$(id); if(el) el.textContent=val;}
function setValue(id,val){const el=$(id); if(el) el.value=String(val);}
function setSelectOptions(select, options){
  if(!select) return;
  select.innerHTML='';
  options.forEach(({value,label,selected=false})=>{
    const option=document.createElement('option');
    option.value=String(value);
    option.textContent=String(label ?? value);
    option.selected=!!selected;
    select.appendChild(option);
  });
}
function setClassState(el, classNames, active){
  if(!el) return;
  const names=Array.isArray(classNames) ? classNames : [classNames];
  names.forEach(name=>el.classList.toggle(name, !!active));
}
function hasOwn(obj,key){
  return !!obj && Object.prototype.hasOwnProperty.call(obj,key);
}
function setTextMap(map){
  Object.entries(map).forEach(([id,value])=>setText(id,value));
}
const RUNE_CHOICE_TARGETS=[['ap','rAP'],['ua','rUA'],['td','rTD'],['harmony','rHarmony']];
/* ===== 04. 입력 컨트롤 동기화 / 계산 전 상태 보정 ===== */
/* 난이도, 룬 선택, 협동/고행/인첸트 입력을 계산 가능한 상태로 정규화한다. */
function renderEnemyData(data){
  if(!data) return;
  setText('enemyArmorQuick', fullNumber(data.armor));
  setText('enemyHpQuick', fullNumber(data.hp));
  setText('enemyShieldQuick', fullNumber(data.shield));
  setText('enemyCountQuick', enemyDisplayCountText(data.round));
}
function syncRuneChoice(){
  const type=vs('runeChoiceType') || 'harmony';
  const value=v('runeChoiceValue');
  RUNE_CHOICE_TARGETS.forEach(([kind,id])=>setValue(id, kind===type ? value : 0));
}
function hydrateRuneChoiceFromHidden(){
  const typeEl=$('runeChoiceType');
  const valueEl=$('runeChoiceValue');
  if(!typeEl || !valueEl) return;
  const selected=RUNE_CHOICE_TARGETS.find(([,id])=>v(id)!==0);
  typeEl.value=selected ? selected[0] : 'harmony';
  valueEl.value=String(selected ? v(selected[1]) : 0);
  syncRuneChoice();
}
function setSelectButton(id,value){
  const el=$(id);
  if(!el) return;
  el.value=value;
  syncSelectButtons();
  requestAppUpdate();
  scheduleAutoSaveToast();
}
function syncSelectButtons(){
  qsa('.seg-btns[data-target]').forEach(group=>{
    const id=group.dataset.target;
    const val=$(id)?.value;
    group.querySelectorAll('button[data-value]').forEach(btn=>{
      setClassState(btn, 'active', btn.dataset.value===val);
    });
  });
}
function isEffectiveBuffChoiceActive(input){
  if(!input) return false;
  if(input.id==='prodArtifact' && isArtifactDpsViewEnabled()) return true;
  return !!input.checked;
}
function syncBuffChoiceButtons(){
  qsa('.buff-choice-item').forEach(item=>{
    const input=item.querySelector('input[type="checkbox"]');
    const active=isEffectiveBuffChoiceActive(input);
    setClassState(item, 'is-active', active);
    item.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}
function penanceOptionLabel(value){return value>0 ? `${value} 고행` : '없음';}
function syncPenanceOptions(){
  const el=$('penance');
  if(!el) return;
  const current=normalizePenanceValue(el.value || el.dataset.penanceValue || '0', SOLO_PENANCE_MAX);
  const signature=String(SOLO_PENANCE_MAX);
  if(el.dataset.penanceMax!==signature){
    setSelectOptions(el, Array.from({length:SOLO_PENANCE_MAX+1}, (_,value)=>({value,label:penanceOptionLabel(value)})));
    el.dataset.penanceMax=signature;
  }
  el.value=current;
  el.dataset.penanceValue=current;
}
function powerBlessOptionLabel(value){return Number(value)>0 ? String(value) : '없음';}
function powerBlessDisplayText(value){
  return powerBlessOptionLabel(normalizePowerBlessRawValue(value));
}
function syncPowerBlessOptions(){
  const el=$('pbless');
  if(!el) return;
  const current=normalizePowerBlessRawValue(el.value);
  const signature=`pbless:${POWER_BLESS_ALL_OPTIONS.join(',')}`;
  if(el.dataset.optionSignature!==signature){
    setSelectOptions(el, POWER_BLESS_ALL_OPTIONS.map(value=>({value,label:powerBlessOptionLabel(value)})));
    el.dataset.optionSignature=signature;
  }
  el.value=current;
}
function setCoopModeOptions(value='OFF'){
  const coop=$('coopMode');
  if(!coop) return;
  const normalized=normalizeOnOffValue(value,'OFF');
  const signature='coop-mode-toggle';
  if(coop.dataset.optionSignature!==signature){
    setSelectOptions(coop, [{value:'OFF',label:'OFF'},{value:'ON',label:'ON'}]);
    coop.dataset.optionSignature=signature;
  }
  coop.value=normalized;
}
function setCoopPlayersOptions(value=COOP_PLAYERS_DEFAULT){
  const players=$('coopPlayers');
  if(!players) return;
  const normalized=normalizeCoopPlayersValue(value);
  const signature='coop-players';
  if(players.dataset.optionSignature!==signature){
    setSelectOptions(players, ['2','3'].map(playerCount=>({value:playerCount,label:playerCount})));
    players.dataset.optionSignature=signature;
  }
  players.value=normalized;
}
function syncBattleMode(sourceId=''){
  const solo=$('soloMode'), coop=$('coopMode'), players=$('coopPlayers');
  if(!solo || !coop) return;
  setCoopModeOptions(coop.value);
  const sourceValue=sourceId==='soloMode' ? normalizeOnOffValue(solo.value,'ON') : normalizeOnOffValue(coop.value,'OFF');
  const coopOn=sourceId==='soloMode' ? sourceValue!=='ON' : sourceValue==='ON';
  solo.value=coopOn ? 'OFF' : 'ON';
  coop.value=coopOn ? 'ON' : 'OFF';
  setCoopPlayersOptions(players ? players.value : COOP_PLAYERS_DEFAULT);
  syncPenanceOptions();
  syncTeamSelect();
}
function syncTeamSelect(){
  const el=$('team');
  if(!el) return;
  el.value=normalizeTeamCountValue(el.value);
}
function syncErosionControls(){
  EROSION_CONTROL_IDS.forEach(id=>{
    const el=$(id);
    if(!el) return;
    const stored=normalizeErosionControlValue(id, el.value || el.dataset.erosionValue || EROSION_CONTROL_DEFAULTS[id]);
    el.type='text';
    el.inputMode='numeric';
    el.value=stored;
    el.dataset.erosionValue=stored;
  });
}
function resetTeamOnDifficultyChange(){
  syncBattleMode('coopPlayers');
  syncTeamSelect();
}
function clampEnchantInput(el){
  let n=parseInt(String(el.value||'0').replace(/[^0-9]/g,''),10);
  if(!Number.isFinite(n)) n=0;
  n=Math.max(0,Math.min(9,n));
  el.value=String(n);
  return n;
}
function syncEnchantInputs(){
  const code=ENCHANT_INPUT_IDS.map(id=>{
    const el=$(id);
    return el ? clampEnchantInput(el) : 0;
  }).join('');
  const hidden=$('enchantCode');
  if(hidden) hidden.value=code;
}
function syncEnchantCodeFromInputs(updateInputs=true){
  const hidden=$('enchantCode');
  const hasInputs=ENCHANT_INPUT_IDS.some(id=>$(id));
  if(!hasInputs) return;
  if(updateInputs && hidden){
    const code=String(hidden.value||'999999').padEnd(6,'0');
    ENCHANT_INPUT_IDS.forEach((id,i)=>{
      const el=$(id);
      if(el) el.value=String(Math.max(0,Math.min(9,parseInt(code[i]||'0',10)||0)));
    });
  }
  syncEnchantInputs();
}
function formatMoneyInput(el){
  if(!el) return;
  const raw=String(el.value||'').replace(/[^\d-]/g,'');
  if(raw===''||raw==='-'){el.value=raw;return;}
  const neg=raw[0]==='-';
  const digits=(neg?raw.slice(1):raw).replace(/^0+(?=\d)/,'');
  el.value=(neg?'-':'') + (digits?digits.replace(/\B(?=(\d{3})+(?!\d))/g,','):'0');
}
const DECIMAL_DISPLAY_INPUT_IDS=new Set(['addAD','addAS','addCD','addCRI','addAP','addTD','addUA']);
function formatAllMoneyInputs(){
  qsa('.money-input').forEach(formatMoneyInput);
  DECIMAL_DISPLAY_INPUT_IDS.forEach(id=>{
    const el=$(id);
    if(el) el.value=normalizeDecimalDisplayValue(el.value);
  });
}
/* 룬/강화/스탯 계산 보조 함수는 calc.js에서 로드된다. */
/* 메인 DPS 계산은 calc.js의 computeStatsRaw()를 사용한다. */

/* ===== 05. 메인 화면 렌더링 / 재계산 파이프라인 ===== */
function currentArtifactDpsResult(){
  const diff=vs('diff');
  const battleMode=isCoopMode() ? 'coop' : 'solo';
  if(isTowerDifficulty()){
    return calculateArtifactDpsPreview(TOWER_DIFFICULTY_NAME, 0, challengeTowerFloorStoredValue(), {battleMode:'solo'});
  }
  return calculateArtifactDpsPreview(diff, v('penance'), targetRoundStoredValue(), {battleMode, coopPlayers:vs('coopPlayers')});
}
function renderDpsSummary(s){
  updateDpsContextSummary();
  const artifactView=isArtifactDpsViewEnabled();
  setText('dpsMainLabel', artifactView ? '유물 DPS' : 'DPS');
  if(shouldHideDpsForRound()){
    setText('dpsVal', '—');
    syncDpsMinDpsInputs();
    updateDpsRiskViews(NaN);
    if(isDpsTableOpen()) renderDpsTablePanelContent();
    return;
  }
  const displayDps=artifactView ? currentArtifactDpsResult().dps : s.M19;
  setText('dpsVal', Number.isFinite(displayDps) ? displayDps.toFixed(2) : '—');
  syncDpsMinDpsInputs();
  updateDpsRiskViews(displayDps);
  if(isDpsTableOpen()) renderDpsTablePanelContent();
}
const STAT_COMPARE_ROWS=[
  ['AD', s=>fmt(s.displayAD,0), s=>fmt(s.M4,0)],
  ['APS', s=>fmt(s.displayAPS,0), s=>fmt(s.displayAPS,0)],
  ['APU', s=>fmt(s.displayAPU,0), s=>fmt(s.actualAPU ?? s.displayAPU,0)],
  ['AS', s=>fmt(s.M7,1), s=>fmt(s.M7,1)],
  ['CRI', s=>fmt(s.M8,1), s=>fmt(s.M8,1)],
  ['CD', s=>fmt(s.rawCD,1), s=>fmt(s.M9,2)],
  ['MC', s=>fmt(s.M10,0), s=>fmt(s.M10,0)],
  ['TD', s=>fmt(s.rawTD,1), s=>fmt(s.M11,2)],
  ['DR', s=>fmt(s.M12,0), s=>fmt(s.actualM12,0)],
  ['PIERCE', s=>`${fmt(s.excelPierce,0)}%`, s=>`${fmt(s.excelPierce,0)}%`],
  ['UA', s=>fmt(s.displayUA,4), s=>fmt(s.M13,4)],
  ['SR', s=>fmt(s.displaySR,2), s=>fmt(s.actualSR ?? s.displaySR,2)],
  ['HR', s=>fmt(s.displayHR,2), s=>fmt(s.actualHR ?? s.displayHR,2)],
  ['MD', s=>fmt(s.M16,0), s=>fmt(s.M16,0)],
  ['MP', s=>fmt(s.M17,0), s=>fmt(s.M17,0)],
  ['MCP', s=>fmt(s.M18,0), s=>fmt(s.M18,0)]
];
function renderStatSummary(s){
  STAT_COMPARE_ROWS.forEach(([key,display,actual])=>{
    setText('s'+key+'Display', display(s));
    setText('s'+key+'Actual', actual(s));
  });
}
function renderResourceSummary(s){
  const bankSP=s.spBankApplied ? (s.spBank||0) : 0;
  const spOwn=s.effectiveSP||effectiveSP();
  const spRemain=spOwn-s.spTotal;
  const epOwned=v('ep');
  const epRemain=epOwned-s.epU;
  const rpRemain=v('rp')-s.rpU;
  const soulRemain=v('soul')-s.soulU;
  setTextMap({
    spAttackView:fullNumber(s.spO), spUtilityView:fullNumber(s.spU), spRemainBasicView:fullNumber(spRemain),
    epUsedBasicView:fullNumber(s.epU), epRemainBasicView:fullNumber(epRemain),
    rpUsedBasicView:fullNumber(s.rpU), rpRemainBasicView:fullNumber(rpRemain),
    soulUsedBasicView:fullNumber(s.soulU), soulRemainBasicView:fullNumber(soulRemain)
  });
  syncSpBankDisplay(bankSP);
}
function syncControlDisplays(){
  [syncSelectButtons,syncBuffChoiceButtons,syncBattleMode,syncDifficultyTargetControls,syncErosionControls,syncPowerBlessOptions,formatAllMoneyInputs].forEach(fn=>fn());
}
function syncPreCalculationViews(){
  normalizeRoundInputs();
  syncExclusiveRuneOptions();
  syncRuneChoice();
  syncEnchantInputs();
  syncControlDisplays();
  syncTraitLimitInputs();
  renderEnchantPreview();
  renderXpCut();
  renderEnhanceSummary();
}
function renderCalculatedViews(s){
  renderEnemyData(s.enemyData);
  renderSkillDamage(s);
  renderDpsSummary(s);
  renderStatSummary(s);
  renderDamageBoardView();
  renderResourceSummary(s);
  updateTraits();
  renderTraitEfficiencyTop5();
}
function recalc(){
  try{
    syncPreCalculationViews();
    withArtifactDpsViewBuffApplied(()=>renderCalculatedViews(computeStatsRaw()));
    saveState({silent:true});
  }catch(e){logAppError(e);}
}
function renderEnhanceSummary(){
  const e=unitEnhanceStats();
  setTextMap({
    enhanceChanceView:(e.chance*100).toFixed(2)+'%',
    enhanceCountView:`${fmt(e.count,0)}회`,
    enhanceValueView:fmt(e.value,0)
  });
}
function renderEnchantPreview(){
  const keys=['ad','cri','ua','td','sr','hr'];
  const outIds=['enchOutAD','enchOutCRI','enchOutUA','enchOutTD','enchOutSR','enchOutHR'];
  keys.forEach((key,i)=>{
    const e=enchantAt(i);
    const val=key==='ua'
      ? e[key].toFixed(2)+'×'
      : fmt(e[key], ['ad','cri','td'].includes(key)?0:2);
    const out=$(outIds[i]);
    if(out) out.textContent=val;
  });
}
/* ===== 05-1. 버스보드 렌더링 / XP 컷 행 피드백 ===== */
const XP_CUT_DIVISOR_ROWS=[
  {stage:'1단계', party2:10, party3:6},
  {stage:'2단계', party2:20, party3:12},
  {stage:'3단계', party2:30, party3:22},
  {stage:'4단계', party2:40, party3:30}
];
let xpCutRowFeedbackTimer=0;
let xpCutRowFeedbackCells=[];
function renderXpCut(){
  restoreXpCutRowFeedback();
  const base=Math.max(0, v('sp'))*0.8;
  const el=$('xpCutRows');
  if(!el) return;
  const valueCell=(partyLabel, divisor)=>{
    const value=big(base/divisor);
    return `<td class="bus-cut-value" data-value="${value}" data-feedback="÷${divisor}배"><span class="bus-cut-party">${partyLabel}</span><span class="bus-cut-text">${value}</span></td>`;
  };
  el.innerHTML=XP_CUT_DIVISOR_ROWS.map(row=>`<tr class="bus-cut-row" role="button" tabindex="0"><td>${row.stage}</td>${valueCell('2인', row.party2)}${valueCell('3인', row.party3)}</tr>`).join('');
}
function restoreXpCutRowFeedback(){
  if(xpCutRowFeedbackTimer) clearTimeout(xpCutRowFeedbackTimer);
  xpCutRowFeedbackTimer=0;
  xpCutRowFeedbackCells.forEach(cell=>{
    if(!cell || !cell.isConnected) return;
    const text=cell.querySelector('.bus-cut-text');
    if(text) text.textContent=cell.dataset.value || text.textContent;
    cell.classList.remove('is-feedback');
  });
  xpCutRowFeedbackCells=[];
}
function showXpCutRowFeedback(row){
  if(!row) return false;
  restoreXpCutRowFeedback();
  const cells=Array.from(row.querySelectorAll('.bus-cut-value'));
  if(!cells.length) return false;
  cells.forEach(cell=>{
    const text=cell.querySelector('.bus-cut-text');
    if(!text || !cell.dataset.feedback) return;
    text.textContent=cell.dataset.feedback;
    cell.classList.add('is-feedback');
  });
  xpCutRowFeedbackCells=cells;
  xpCutRowFeedbackTimer=setTimeout(restoreXpCutRowFeedback, 1000);
  return true;
}
function activateXpCutRowFeedback(target,e){
  const row=target?.closest?.('.bus-cut-row');
  if(!row || !$('xpCutRows')?.contains(row)) return false;
  e?.preventDefault?.();
  return showXpCutRowFeedback(row);
}
function bindBusCutEvents(){
  document.addEventListener('click', e=>activateXpCutRowFeedback(e.target,e));
  document.addEventListener('keydown', e=>{
    if(e.key==='Enter' || e.key===' ') activateXpCutRowFeedback(e.target,e);
  });
}
/* ===== 05-2. 데미지 보드 / 유물 DPS 표시 전환 ===== */
function isArtifactDpsViewEnabled(){
  const toggle=$('artifactDpsViewToggle');
  return toggle?.getAttribute('aria-checked')==='true';
}
function withArtifactDpsViewBuffApplied(callback){
  const artifactEl=$('prodArtifact');
  if(!artifactEl || !isArtifactDpsViewEnabled()) return callback();
  const checked=artifactEl.checked;
  artifactEl.checked=true;
  try{
    return callback();
  }finally{
    artifactEl.checked=checked;
  }
}
function syncArtifactDpsViewSwitch(){
  const toggle=$('artifactDpsViewToggle');
  if(!toggle) return;
  const active=isArtifactDpsViewEnabled();
  toggle.classList.toggle('is-active', active);
  toggle.setAttribute('aria-checked', active ? 'true' : 'false');
}
function renderDamageBoardView(){
  syncArtifactDpsViewSwitch();
  syncDpsTableLabels();
}
function renderSkillDamage(s){
  const ap=s?.displayAPU ?? 535;
  const rows=calculateSkillDamageRows({ap,doubleSpace:v('skillDouble'),round:v('skillRound'),mode:vs('skillMode')});
  const apView=$('skillAPView');
  if(apView) apView.textContent=fmt(ap,0);
  const pv=$('skillPenaltyView');
  if(pv) pv.textContent=`${(rows.penalty*100).toFixed(1)}%`;
  const el=$('skillRows');
  if(!el) return;
  el.innerHTML=rows.items.map(row=>`<tr><td>${row.name}</td><td>${fmt(row.total,1)}%</td><td>AP ${fmt(ap,0)} / 더블 ${fmt(rows.doubleSpace,2)}</td></tr>`).join('');
}
let appUpdateTimer=0;
function requestAppUpdate(){
  if(appUpdateTimer) clearTimeout(appUpdateTimer);
  appUpdateTimer=setTimeout(()=>{appUpdateTimer=0; recalc();}, DPS_CONFIG.ui.updateDelay);
}
/* ===== 06. 분리 모듈 역할표 ===== */
/*
 * dps-panels.js     : DPS표, 이달룬/쥬얼/비교 모달 UI
 * compare-import.js : 엑셀/저장파일/프리셋 비교와 현재 입력값 적용
 * trait-board.js    : 특성보드 입력, 초기화, 최적화, 효율 Top 5
 * state-storage.js  : 현재 입력 상태 저장, 복구, 백업, 상태 마이그레이션
 * trait-presets.js  : 특성 프리셋 저장, 로드, import/export, 프리셋 비교
 * zero-score.js     : 더제로 승단 계산기와 승단 점수 비교
 */

/* ===== 07. 화면 제어 / 글자 크기 / 확인 작업 ===== */
function isFontScaleLockedViewport(){
  const w=window.innerWidth || document.documentElement.clientWidth || 0;
  const h=window.innerHeight || document.documentElement.clientHeight || 0;
  const max=DPS_CONFIG.ui.mobileMaxWidth || 600;
  const mobile=window.matchMedia ? window.matchMedia(`(max-width:${max}px)`).matches : window.innerWidth<=max;
  return mobile || (w>=768 && w<=1368 && h>w);
}
function getFontScale(){
  if(isFontScaleLockedViewport()) return DPS_CONFIG.ui.fontScaleDefault;
  const root=document.documentElement;
  const raw=root.style.getPropertyValue('--app-font-scale') || String(DPS_CONFIG.ui.fontScaleDefault);
  const n=parseFloat(raw);
  return Number.isFinite(n) ? n : DPS_CONFIG.ui.fontScaleDefault;
}
function applyFontScale(scale, options={}){
  const label=$('fontScaleLabel');
  if(isFontScaleLockedViewport()){
    document.documentElement.style.setProperty('--app-font-scale', DPS_CONFIG.ui.fontScaleDefault.toFixed(2));
    if(label) label.textContent='100%';
    return false;
  }
  const min=DPS_CONFIG.ui.fontScaleMin, max=DPS_CONFIG.ui.fontScaleMax;
  const next=Math.max(min, Math.min(max, Number(scale)||DPS_CONFIG.ui.fontScaleDefault));
  document.documentElement.style.setProperty('--app-font-scale', next.toFixed(2));
  if(label) label.textContent=Math.round(next*100)+'%';
  try{ localStorage.setItem(DPS_CONFIG.storage.fontKey, String(next)); }catch(e){}
  if(!options.silent) notifyStorageAction('글씨 크기 '+Math.round(next*100)+'% 저장 완료', 'ok');
  return true;
}
function loadFontScale(){
  let scale=DPS_CONFIG.ui.fontScaleDefault;
  try{
    const saved=parseFloat(localStorage.getItem(DPS_CONFIG.storage.fontKey)||'');
    if(Number.isFinite(saved)) scale=saved;
  }catch(e){}
  applyFontScale(scale, {silent:true});
}
function changeFontScale(delta){
  if(isFontScaleLockedViewport()) return false;
  return applyFontScale(getFontScale()+delta);
}
function bindFontScaleViewportGuard(){
  window.addEventListener('resize', ()=>{
    if(isFontScaleLockedViewport()) applyFontScale(DPS_CONFIG.ui.fontScaleDefault, {silent:true});
  });
}
let appTitleVersionTimer=0;
function showAppTitleVersion(){
  const title=$('appTitleView');
  if(!title) return;
  if(!title.dataset.originalText) title.dataset.originalText=title.textContent || '개복디 특성 계산기';
  title.textContent=(window.APP_VERSION || 'V1.0');
  if(appTitleVersionTimer) clearTimeout(appTitleVersionTimer);
  appTitleVersionTimer=setTimeout(()=>{
    title.textContent=title.dataset.originalText || '개복디 특성 계산기';
  },1200);
}
function bindAppTitleVersion(){
  const title=$('appTitleView');
  if(!title) return;
  title.addEventListener('click', showAppTitleVersion);
  title.addEventListener('keydown', e=>{
    if(e.key==='Enter' || e.key===' '){
      e.preventDefault();
      showAppTitleVersion();
    }
  });
}
let pendingConfirmAction=null;
function requestConfirmAction(key,message,run){
  const now=Date.now();
  const delay=DPS_CONFIG.ui.confirmDelayMs || 1600;
  if(pendingConfirmAction && pendingConfirmAction.key===key && now<pendingConfirmAction.until){
    const timer=pendingConfirmAction.timer;
    pendingConfirmAction=null;
    if(timer) clearTimeout(timer);
    return run();
  }
  if(pendingConfirmAction && pendingConfirmAction.timer) clearTimeout(pendingConfirmAction.timer);
  try{showToast(message,'warn');}catch(e){}
  pendingConfirmAction={
    key,
    until:now+delay,
    timer:setTimeout(()=>{
      if(pendingConfirmAction && pendingConfirmAction.key===key) pendingConfirmAction=null;
    }, delay)
  };
  return false;
}
/* ===== 08. 공통 이벤트 바인딩 / 앱 초기화 ===== */
let appEventsBound=false;
function getConvenienceMenuParts(){
  const wrap=document.querySelector('.header-convenience');
  if(!wrap) return {};
  return {
    wrap,
    toggle:wrap.querySelector('.header-convenience-toggle'),
    menu:wrap.querySelector('.header-convenience-menu')
  };
}
function setConvenienceMenuOpen(open){
  const { toggle, menu }=getConvenienceMenuParts();
  if(!toggle || !menu) return false;
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  menu.hidden=!open;
  return true;
}
function closeConvenienceMenu(){
  setConvenienceMenuOpen(false);
}
function toggleConvenienceMenu(){
  const { toggle }=getConvenienceMenuParts();
  const open=toggle?.getAttribute('aria-expanded')==='true';
  return setConvenienceMenuOpen(!open);
}
function bindConvenienceMenuEvents(){
  document.addEventListener('click', e=>{
    const { wrap }=getConvenienceMenuParts();
    if(!wrap || wrap.contains(e.target)) return;
    closeConvenienceMenu();
  });
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape') closeConvenienceMenu();
  });
  document.addEventListener('click', e=>{
    if(e.target.closest('.header-convenience-menu a')) closeConvenienceMenu();
  });
}
const ACTION_HANDLERS={
  optimizeSP,
  optimizeUtility:(trigger,e)=>optimizeUtility(trigger,e),
  clearUtility:()=>requestConfirmAction('clearUtility','한 번 더 누르면 유틸 초기화', ()=>clearUtility()),
  applyTraitEfficiencyTop:(trigger,e)=>applyTraitEfficiencyTop(trigger,e),
  clearAll:()=>requestConfirmAction('clearAll','한 번 더 누르면 유틸 제외 특성 초기화', ()=>clearAll()),
  saveTraitPreset:(trigger,e)=>saveTraitPreset(trigger,e),
  loadTraitPreset:(trigger,e)=>loadTraitPreset(trigger,e),
  renameTraitPreset:(trigger,e)=>renameTraitPreset(trigger,e),
  deleteTraitPreset:(trigger,e)=>deleteTraitPreset(trigger,e),
  setDefaultTraitPreset:(trigger,e)=>setDefaultTraitPreset(trigger,e),
  resetAllTraitPresetState:(trigger,e)=>requestTraitPresetFullReset(trigger,e),
  exportTraitPresets:(trigger,e)=>exportTraitPresets(trigger,e),
  importTraitPresets:(trigger,e)=>openTraitPresetImportPicker(trigger,e),
  compareTraitPreset:(trigger,e)=>compareTraitPreset(trigger,e),
  openDpsTable:(trigger,e)=>openDpsTable(trigger,e),
  openMonthRuneTab:(trigger)=>openMonthRune(trigger?.dataset?.monthRuneOpenTab || 'compare'),
  toggleConvenienceMenu:(trigger,e)=>toggleConvenienceMenu(trigger,e),
  zeroRankTab:(trigger)=>setZeroRankTab(trigger),
  zeroScoreStar:(trigger)=>toggleZeroScoreStar(trigger),
  decreaseFont:()=>changeFontScale(-DPS_CONFIG.ui.fontScaleStep),
  increaseFont:()=>changeFontScale(DPS_CONFIG.ui.fontScaleStep),
  resetFont:()=>applyFontScale(DPS_CONFIG.ui.fontScaleDefault),
  selectButton:(trigger)=>setSelectButton(trigger.closest('.seg-btns')?.dataset.target, trigger.dataset.value),
  traitAdjust:(trigger)=>{
    if(Date.now()<traitHoldSuppressClickUntil) return false;
    return adjustTraitBy(+trigger.dataset.row,+trigger.dataset.delta,1);
  },
  traitMax:(trigger)=>adjMax(+trigger.dataset.row),
  masterTier:(trigger)=>masterTier(trigger.dataset.tier||''),
  resetTier:(trigger)=>{ const tier=trigger.dataset.tier||''; return requestConfirmAction(`resetTier:${tier}`, `한 번 더 누르면 ${tier} 초기화`, ()=>resetTier(tier)); }
};
function bindActionEvents(){
  document.addEventListener('click', e=>{
    const trigger=e.target.closest('[data-action]');
    if(!trigger) return;
    const action=trigger.getAttribute('data-action');
    const fn=ACTION_HANDLERS[action];
    if(!fn) return;
    e.preventDefault();
    fn(trigger, e);
  });
}
const REACTIVE_INPUT_EXCLUDED_IDS=new Set([
  'excelCompareFile',
  'excelCompareSheet',
  'excelCompareBasePreset',
  'traitPresetName',
  'traitPresetSelect',
  'traitPresetImportFile',
  'traitPresetExportName',
  'dpsTableMinDps',
  'dpsTableMinDpsMain',
  'artifactDpsViewToggle'
]);
const RUNE_CHOICE_SYNC_IDS=new Set(['runeChoiceType','runeChoiceValue']);
function shouldHandleReactiveInput(target){
  if(isStorageLocked()) return false;
  if(!target || !target.id) return false;
  if(REACTIVE_INPUT_EXCLUDED_IDS.has(target.id)) return false;
  if(target.classList && target.classList.contains('tv-input')) return false;
  return target.matches && target.matches('input, select, textarea');
}
function bindReactiveInputs(){
  let raf=0;
  const schedule=(target)=>{
    if(!shouldHandleReactiveInput(target)) return;
    if(target.matches('.money-input')) formatMoneyInput(target);
    if(target.id==='xp') normalizeXpInput();
    if(target.id==='round' || target.id==='skillRound' || target.id==='challengeTowerFloor') normalizeRoundInput(target.id);
    if(target.id==='diff'){
      resetDifficultyDependentFields();
      resetTeamOnDifficultyChange();
      syncDifficultyTargetControls();
      syncErosionControls();
    }
    if(RUNE_CHOICE_SYNC_IDS.has(target.id)) syncRuneChoice();
    if(ENCHANT_INPUT_ID_SET.has(target.id)) syncEnchantInputs();
    if(RUNE_OPTION_SELECT_ID_SET.has(target.id)) syncExclusiveRuneOptions();
    if(target.id==='soloMode' || target.id==='coopMode'){
      syncBattleMode(target.id);
    }
    if(target.id==='coopPlayers'){
      syncBattleMode('coopPlayers');
    }
    if(target.id==='team'){
      syncTeamSelect();
    }
    if(TRAIT_LIMIT_INPUT_IDS.has(target.id) && String(target.value).replace(/,/g,'').trim()==='0') syncTraitLimitInputDisplay(target);
    if(target.matches('select')) syncSelectButtons();
    if(target.matches('.buff-choice-input')) syncBuffChoiceButtons();
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      requestAppUpdate();
      scheduleAutoSaveToast();
    });
  };
  document.addEventListener('input', e=>schedule(e.target), true);
  document.addEventListener('change', e=>schedule(e.target), true);
}
function bindButtonPressFeedback(){
  const selector='button,.btn';
  document.addEventListener('pointerdown', e=>{
    const btn=e.target && e.target.closest ? e.target.closest(selector) : null;
    if(!btn || btn.disabled) return;
    btn.classList.add('is-pressed');
    setTimeout(()=>btn.classList.remove('is-pressed'), 180);
  }, true);
}
function bindArtifactDpsViewEvents(){
  document.addEventListener('click', e=>{
    const toggle=e.target?.closest?.('#artifactDpsViewToggle');
    if(!toggle) return;
    e.preventDefault();
    toggle.setAttribute('aria-checked', isArtifactDpsViewEnabled() ? 'false' : 'true');
    requestAppUpdate();
  }, true);
}
function bindAppEvents(){
  if(appEventsBound) return;
  appEventsBound=true;
  [
    bindFontScaleViewportGuard, bindActionEvents, bindBusCutEvents, bindTraitHoldEvents, bindTraitInputEvents,
    bindDpsTableEvents, bindExcelCompareEvents, bindTraitPresetEvents, bindMonthRuneEvents, bindJewelImageEvents,
    bindConvenienceMenuEvents, bindZeroScoreCalculator, bindTraitLimitDisplayEvents, bindReactiveInputs,
    bindButtonPressFeedback, bindArtifactDpsViewEvents, bindAppTitleVersion
  ].forEach(fn=>fn());
}
function initApp(){
  loadFontScale();
  renderZeroScoreCalculatorRows();
  bindAppEvents();
  syncEnchantCodeFromInputs(true);
  syncSelectButtons();
  syncBuffChoiceButtons();
  syncExclusiveRuneOptions();
  updateZeroScoreCalculator();
  formatAllMoneyInputs();
  syncTraitLimitInputs();
  loadState();
  applyDefaultTraitPresetOnBoot();
  refreshTraitPresetControls();
  restoreTraitPresetStatus();
}
function markAppReady(){
  try{
    if(typeof window.dpsSyncResponsiveLayout === 'function') window.dpsSyncResponsiveLayout();
  }catch(e){}
  if(typeof window.dpsMarkAppReady==='function'){
    window.dpsMarkAppReady();
    return;
  }
  try{document.documentElement.classList.remove('dps-booting');}catch(e){}
  try{
    const boot=$('dpsBootScreen');
    if(boot) boot.setAttribute('aria-hidden','true');
  }catch(e){}
}
function markAppError(code, error){
  if(typeof window.dpsShowBootError==='function') window.dpsShowBootError(code, error);
  else{
    try{window.DPS_LAST_INIT_ERROR={code,error,time:Date.now()};}catch(e){}
  }
}
function startDpsApp(){
  try{
    initApp();
    markAppReady();
  }catch(e){
    markAppError('D1001', e);
  }
}
window.startDpsApp=startDpsApp;
