/* ===== app.js | 화면 상태·렌더링·이벤트·파일 연동 ===== */

/* ===== 00. DOM 헬퍼 ===== */
const $=id=>document.getElementById(id);
const qs=selector=>document.querySelector(selector);
const qsa=selector=>document.querySelectorAll(selector);

/* ===== 01. 설정 / 전역 상태 ===== */
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

const INV={};
TRAITS.forEach(t=>{INV[t[0]]=0;});
Object.assign(INV,{116:1});
const AUTO_INVEST_EXCLUDED_ROWS=new Set([45,87]);
const ENCHANT_INPUT_IDS=['enchAD','enchCRI','enchUA','enchTD','enchSR','enchHR'];
const ENCHANT_INPUT_ID_SET=new Set(ENCHANT_INPUT_IDS);

/* ===== 02. 공통 UI / 입력값 유틸 ===== */
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
function showToast(message, type='ok', durationMs){
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
    const requestedMs=Number(durationMs);
    const visibleMs=Number.isFinite(requestedMs) && requestedMs>0 ? requestedMs : (text.includes('\n') ? 5200 : 2200);
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
function syncSelectOptionsBySignature(select, signature, options, signatureKey='optionSignature'){
  if(!select) return;
  if(select.dataset[signatureKey]!==signature){
    setSelectOptions(select, options);
    select.dataset[signatureKey]=signature;
  }
}
function normalizedUnsignedDigits(value, fallback='0'){
  const digits=String(value ?? '').replace(/[^0-9]/g,'').replace(/^0+(?=\d)/,'');
  return digits || fallback;
}
function clampedIntegerString(value, min, max, fallback=0){
  const digits=normalizedUnsignedDigits(value, '');
  const number=digits ? Number(digits) : fallback;
  const finite=Number.isFinite(number) ? Math.round(number) : fallback;
  return String(Math.max(min, Math.min(max, finite)));
}
function setClassState(el, classNames, active){
  if(!el) return;
  const names=Array.isArray(classNames) ? classNames : [classNames];
  names.forEach(name=>el.classList.toggle(name, !!active));
}
function setTextMap(map){
  Object.entries(map).forEach(([id,value])=>setText(id,value));
}
const RUNE_CHOICE_TARGETS=[['ap','rAP'],['ua','rUA'],['td','rTD'],['harmony','rHarmony']];

/* ===== 03. 입력 / 선택 컨트롤 동기화 ===== */
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
function penanceOptionLabel(value){return value>0 ? `${value} 고행` : '선택 안함';}
function syncPenanceOptions(){
  const el=$('penance');
  if(!el) return;
  const current=normalizePenanceValue(el.value || el.dataset.penanceValue || '0', SOLO_PENANCE_MAX);
  syncSelectOptionsBySignature(
    el,
    String(SOLO_PENANCE_MAX),
    Array.from({length:SOLO_PENANCE_MAX+1}, (_,value)=>({value,label:penanceOptionLabel(value)})),
    'penanceMax'
  );
  el.value=current;
  el.dataset.penanceValue=current;
}
function powerBlessOptionLabel(value){return Number(value)>0 ? String(value) : '선택 안함';}
function powerBlessDisplayText(value){
  return powerBlessOptionLabel(normalizePowerBlessRawValue(value));
}
function syncPowerBlessOptions(){
  const el=$('pbless');
  if(!el) return;
  const current=normalizePowerBlessRawValue(el.value);
  syncSelectOptionsBySignature(
    el,
    `pbless:${POWER_BLESS_ALL_OPTIONS.join(',')}`,
    POWER_BLESS_ALL_OPTIONS.map(value=>({value,label:powerBlessOptionLabel(value)}))
  );
  el.value=current;
}
function setCoopModeOptions(value='OFF'){
  const coop=$('coopMode');
  if(!coop) return;
  const normalized=normalizeOnOffValue(value,'OFF');
  syncSelectOptionsBySignature(coop, 'coop-mode-toggle', [{value:'OFF',label:'OFF'},{value:'ON',label:'ON'}]);
  coop.value=normalized;
}
function setCoopPlayersOptions(value=COOP_PLAYERS_DEFAULT){
  const players=$('coopPlayers');
  if(!players) return;
  const normalized=normalizeCoopPlayersValue(value);
  syncSelectOptionsBySignature(players, 'coop-players', ['2','3'].map(playerCount=>({value:playerCount,label:playerCount})));
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
  if(typeof SHARD_VALUE_IDS!=='undefined' && SHARD_VALUE_IDS.has(el.id)){
    const normalized=normalizeShardStorageValue(el.value);
    el.value=normalized.replace(/\B(?=(\d{3})+(?!\d))/g,',');
    return;
  }
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
/* ===== 04. 메인 화면 렌더링 / 재계산 ===== */
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
  renderDamageBoardRoundTime(s);
}
function currentRoundTimeBonusSeconds(){
  return enemyRoundTimeBonus(vs('diff'));
}
function renderDamageBoardRoundTime(s){
  const roundTime=Number(s?.roundTime);
  const bonus=currentRoundTimeBonusSeconds();
  const rpTimeText=enemyRoundTimeBonus(vs('diff'))>0 || isTowerDifficulty(vs('diff'))
    ? `RP ${fmt(bonus,0)}초 / 최대 8초`
    : '-';
  setText('enemyRoundTimeQuick', Number.isFinite(roundTime) ? `${fmt(roundTime,1)}초` : '—');
  setText('enemyRpTimeQuick', rpTimeText);
}
function renderResourceSummary(s){
  const totalSp=s.effectiveSP ?? effectiveSP();
  const usedSp=s.spUsedTotal ?? ((s.spO||0)+(s.spU||0));
  const spRemain=totalSp-usedSp;
  const epOwned=v('ep');
  const epRemain=epOwned-s.epU;
  const rpRemain=v('rp')-s.rpU;
  const soulRemain=v('soul')-s.soulU;
  setTextMap({
    spTotalBasicView:fullNumber(totalSp),
    spAttackView:fullNumber(s.spO), spUtilityView:fullNumber(s.spU), spRemainBasicView:fullNumber(spRemain),
    epUsedBasicView:fullNumber(s.epU), epRemainBasicView:fullNumber(epRemain),
    rpUsedBasicView:fullNumber(s.rpU), rpRemainBasicView:fullNumber(rpRemain),
    soulUsedBasicView:fullNumber(s.soulU), soulRemainBasicView:fullNumber(soulRemain)
  });
  syncSpBankDisplay();
}
function syncControlDisplays(){
  [syncSelectButtons,syncBuffChoiceButtons,syncBattleMode,syncDifficultyTargetControls,syncErosionControls,syncPowerBlessOptions,formatAllMoneyInputs].forEach(fn=>fn());
}
function syncSpBankApplyControl(){
  const select=$('spBankApply');
  if(!select) return false;
  const state=normalizeSpBankApplyValue(select.value);
  if(select.value!==state) select.value=state;
  return true;
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
/* 버스 보드: 렌더링 / 행 클릭 피드백 */
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
  const renderPartyRows=(targetId, divisorKey)=>{
    const target=$(targetId);
    if(!target) return;
    target.innerHTML=XP_CUT_DIVISOR_ROWS.map(row=>{
      const divisor=row[divisorKey];
      const value=big(base/divisor);
      return `<button class="bus-cut-row" type="button"><span class="bus-cut-stage">${row.stage}</span><span class="bus-cut-value" data-value="${value}" data-feedback="÷${divisor}배"><span class="bus-cut-text">${value}</span></span></button>`;
    }).join('');
  };
  renderPartyRows('xpCutRows2','party2');
  renderPartyRows('xpCutRows3','party3');
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
  if(!row || !row.closest('.bus-cut-card')) return false;
  e?.preventDefault?.();
  return showXpCutRowFeedback(row);
}
function bindBusCutEvents(){
  document.addEventListener('click', e=>activateXpCutRowFeedback(e.target,e));
  document.addEventListener('keydown', e=>{
    if(e.key==='Enter' || e.key===' ') activateXpCutRowFeedback(e.target,e);
  });
}
/* 데미지 보드: 성소스킬 / 유물 DPS 표시 전환 */
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
/* ===== 05. 모달 패널 콘텐츠 / 비교·DPS표·이달룬·쥬얼 ===== */
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
/* DPS표: 기본/유물 DPS 상태별 표기값 */
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

function dpsTableCellHtml(value, active){
  const minDps=parseDpsTableMinDps();
  const danger=minDps!==null && dpsTableRiskCompareValue(value)<=minDps;
  const classes=[danger?'dps-risk-cell':'', active?'dps-current-cell':''].filter(Boolean).join(' ');
  return `<td class="${classes}">${formatDpsTableValue(value)}</td>`;
}
function buildPenanceDpsMatrix({difficulties, penanceMin, penanceMax, currentPen, round, previewOptions={}, tableClass=''}){
  const currentDiff=vs('diff');
  const clampedPen=Math.max(penanceMin, Math.min(penanceMax, Math.round(currentPen)));
  const head=difficulties.map(diff=>`<th class="${diff===currentDiff?'dps-current-column':''}">${diff}</th>`).join('');
  const rows=[];
  for(let pen=penanceMin; pen<=penanceMax; pen++){
    const rowCurrent=pen===clampedPen;
    const cells=difficulties.map(diff=>{
      const value=dpsTablePreviewValue(diff, pen, round, previewOptions);
      return dpsTableCellHtml(value, rowCurrent && diff===currentDiff);
    }).join('');
    rows.push(`<tr${rowCurrent?' class="dps-current-row"':''}><th>${pen}</th>${cells}</tr>`);
  }
  return `<table class="dps-matrix dps-round-matrix${tableClass ? ' '+tableClass : ''}"><thead><tr><th>고행</th>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
function buildDpsTable(round){
  return buildPenanceDpsMatrix({
    difficulties:DPS_TABLE_DIFFICULTIES,
    penanceMin:DPS_TABLE_PENANCE_MIN,
    penanceMax:DPS_TABLE_PENANCE_MAX,
    currentPen:v('penance'),
    round,
    previewOptions:{battleMode:'solo'}
  });
}
function buildCoopDpsMatrix(players, round){
  return buildPenanceDpsMatrix({
    difficulties:COOP_DPS_TABLE_DIFFICULTIES,
    penanceMin:COOP_DPS_TABLE_PENANCE_MIN,
    penanceMax:COOP_DPS_TABLE_PENANCE_MAX,
    currentPen:v('penance'),
    round,
    previewOptions:{battleMode:'coop', coopPlayers:String(players)},
    tableClass:'dps-coop-matrix'
  });
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
function renderDpsTableTabs(){
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
function dpsTableRound(){
  return normalizedRoundNumber(targetRoundStoredValue());
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
  syncDpsTableModalModeClass();
  syncDpsTableLabels();
  qsa('[data-dps-table-tabs-mount]').forEach(tabs=>{
    tabs.innerHTML=renderDpsTableTabs();
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
function openDpsTable(mode='auto'){
  const fallbackMode=isTowerDifficulty() ? 'tower' : (isCoopActive() ? 'coop' : 'solo');
  const normalizedMode=mode==='round' ? 'solo' : (mode==='auto' ? fallbackMode : mode);
  activeDpsTableMode=DPS_MODAL_MODES.includes(normalizedMode) ? normalizedMode : fallbackMode;
  closeConvenienceMenu();
  openMonthRune('dps');
}
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
function syncComparePanelAfterRender(){
  hydrateCompareControls();
  if(compareState.lastResult) renderExcelComparison(compareState.lastResult,{preserveFilter:true});
  else if(compareState.sourceType==='json' && compareState.backupState) renderJsonComparison(compareState.backupState);
  else if(compareState.sourceType==='traitPreset' && compareState.traitPresetBundle) compareSelectedTraitPreset({preserveRestore:true});
  else if(compareState.workbook && compareState.sourceType==='excel') compareSelectedExcelSheet({preserveRestore:true});
  else updateCompareActionButtons();
}
/* ===== 06. 엑셀 워크북·저장파일 비교 / 현재 입력값 적용 ===== */
const compareState={workbook:null,backupState:null,traitPresetBundle:null,baseTraitPresetBundle:null,baseFileRejected:false,sourceType:null,lastResult:null,activeFilter:'all',restoreState:null,applied:false,selectedSheetName:'',baseTraitPresetId:''};
function resetCompareState(){Object.assign(compareState,{workbook:null,backupState:null,traitPresetBundle:null,baseTraitPresetBundle:null,baseFileRejected:false,sourceType:null,lastResult:null,activeFilter:'all',restoreState:null,applied:false,selectedSheetName:'',baseTraitPresetId:''});}
const EXCEL_COMPARE_STATS=[
  ['AD','공격력','L4','M4',s=>s.displayAD,s=>s.M4],
  ['APS','성소 마법공격력','L5','M5',s=>s.displayAPS,s=>s.displayAPS],
  ['APU','유닛 마법공격력','L6','M6',s=>s.displayAPU,s=>s.actualAPU],
  ['AS','공격속도','L7','M7',s=>s.M7,s=>s.M7],
  ['CRI','크리티컬 확률','L8','M8',s=>s.M8,s=>s.M8],
  ['CD','크리티컬 데미지','L9','M9',s=>s.rawCD,s=>s.M9],
  ['MC','다중 크리티컬','L10','M10',s=>s.M10,s=>s.M10],
  ['TD','총 데미지','L11','M11',s=>s.rawTD,s=>s.M11],
  ['DR','방어력 감소','L12','M12',s=>s.M12,s=>s.actualM12],
  ['UA','유닛 가속','L13','M13',s=>s.displayUA,s=>s.M13],
  ['SR','실드 감소','L14','M14',s=>s.displaySR,s=>s.actualSR],
  ['HR','체력 감소','L15','M15',s=>s.displayHR,s=>s.actualHR],
  ['MD','멀티 타겟','L16','M16',s=>s.M16,s=>s.M16],
  ['MP','멀티 확률','L17','M17',s=>s.M17,s=>s.M17],
  ['MCP','멀티 크리 확률','L18','M18',s=>s.M18,s=>s.M18]
];
function readU16(view, offset){ return view.getUint16(offset,true); }
function readU32(view, offset){ return view.getUint32(offset,true); }
async function inflateZipEntry(bytes){
  if(typeof DecompressionStream!=='function') throw new Error('이 브라우저는 XLSM 압축 해제를 지원하지 않습니다.');
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function readZipEntries(file){
  const bytes=new Uint8Array(await file.arrayBuffer());
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let eocd=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
    if(readU32(view,i)===0x06054b50){ eocd=i; break; }
  }
  if(eocd<0) throw new Error('올바른 엑셀파일이 아닙니다.');
  const count=readU16(view,eocd+10);
  let pos=readU32(view,eocd+16);
  const decoder=new TextDecoder();
  const entries=new Map();
  for(let i=0;i<count;i++){
    if(readU32(view,pos)!==0x02014b50) throw new Error('엑셀파일 ZIP 목록을 읽을 수 없습니다.');
    const method=readU16(view,pos+10);
    const compressedSize=readU32(view,pos+20);
    const nameLength=readU16(view,pos+28);
    const extraLength=readU16(view,pos+30);
    const commentLength=readU16(view,pos+32);
    const localOffset=readU32(view,pos+42);
    const name=decoder.decode(bytes.slice(pos+46,pos+46+nameLength));
    const localNameLength=readU16(view,localOffset+26);
    const localExtraLength=readU16(view,localOffset+28);
    const start=localOffset+30+localNameLength+localExtraLength;
    const compressed=bytes.slice(start,start+compressedSize);
    let data;
    if(method===0) data=compressed;
    else if(method===8) data=await inflateZipEntry(compressed);
    else throw new Error(`지원하지 않는 엑셀파일 압축 방식입니다. (${method})`);
    entries.set(name,data);
    pos+=46+nameLength+extraLength+commentLength;
  }
  return entries;
}
function parseXml(bytes){
  const xml=new TextDecoder('utf-8').decode(bytes);
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror')) throw new Error('엑셀파일 XML을 해석하지 못했습니다.');
  return doc;
}
function xmlLocalAll(root,name){ return [...root.getElementsByTagNameNS('*',name)]; }
function excelCellMap(sheetDoc, sharedStrings){
  const cells={};
  xmlLocalAll(sheetDoc,'c').forEach(cell=>{
    const ref=cell.getAttribute('r');
    const value=xmlLocalAll(cell,'v')[0]?.textContent ?? '';
    const type=cell.getAttribute('t');
    cells[ref]=type==='s' ? (sharedStrings[Number(value)] ?? '') : value;
  });
  return cells;
}
async function readExcelWorkbook(file){
  const zip=await readZipEntries(file);
  const workbook=parseXml(zip.get('xl/workbook.xml'));
  const rels=parseXml(zip.get('xl/_rels/workbook.xml.rels'));
  const relMap={};
  xmlLocalAll(rels,'Relationship').forEach(rel=>{ relMap[rel.getAttribute('Id')]=rel.getAttribute('Target'); });
  const shared=[];
  if(zip.has('xl/sharedStrings.xml')){
    const sharedDoc=parseXml(zip.get('xl/sharedStrings.xml'));
    xmlLocalAll(sharedDoc,'si').forEach(si=>shared.push(xmlLocalAll(si,'t').map(t=>t.textContent||'').join('')));
  }
  const sheets=xmlLocalAll(workbook,'sheet').map(node=>{
    const name=node.getAttribute('name');
    const relId=node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id') || node.getAttribute('r:id');
    const target=relMap[relId];
    const path=target?.startsWith('/') ? target.slice(1) : `xl/${target}`;
    return {name,path};
  }).filter(sheet=>sheet.name&&sheet.path&&zip.has(sheet.path));
  if(!sheets.length) throw new Error('비교할 엑셀 시트를 찾을 수 없습니다.');
  return {
    fileName:file.name,
    sheets,
    getCells(sheetName){
      const sheet=sheets.find(item=>item.name===sheetName);
      if(!sheet) throw new Error('선택한 시트를 찾을 수 없습니다.');
      return excelCellMap(parseXml(zip.get(sheet.path)),shared);
    }
  };
}
function excelCompareNumberValue(value){
  if(value===undefined || value===null || String(value).trim()==='') return 0;
  const n=Number(String(value).replace(/,/g,'').trim());
  return Number.isFinite(n) ? n : null;
}
function excelCompareRound(value, digits=6){
  const n=Number(value);
  if(!Number.isFinite(n)) return n;
  const factor=10**digits;
  return Math.round((n + Number.EPSILON) * factor) / factor;
}
function compareNumber(change, current, tolerance=0.0005){
  const target=excelCompareNumberValue(change), base=excelCompareNumberValue(current);
  if(target===null||base===null) return {diff:null,status:'warn'};
  const diff=target-base;
  const limit=Math.max(tolerance,Math.abs(target)*0.00005);
  return {diff,status:Math.abs(diff)<=limit?'same':Math.abs(diff)<=limit*10?'near':'diff'};
}
function formatCompareNumber(value){
  const n=excelCompareNumberValue(value);
  return n===null ? '—' : parseFloat(excelCompareRound(n,6).toFixed(6)).toLocaleString('ko-KR');
}
function formatCompareDiff(diff){
  if(!Number.isFinite(diff)) return '확인 불가';
  if(Math.abs(diff)<0.0000005) return '일치';
  const value=excelCompareRound(diff,6);
  return `${value>0?'+':''}${parseFloat(value.toFixed(6)).toLocaleString('ko-KR')}`;
}
function escapeCompareHtml(value){
  return String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
}
const COMPARE_SPECIAL_RUNE_LABELS={ap:'마법공격력',ua:'유닛 가속',td:'총 데미지',harmony:'총 데미지 & 유닛 가속','td&ua':'총 데미지 & 유닛 가속','td＆ua':'총 데미지 & 유닛 가속'};
function compareNormalizedText(value){
  return String(value??'').trim().replace(/\s+/g,'').toLowerCase();
}
function findSelectOptionByText(select, value){
  const text=String(value??'').trim();
  const normalized=compareNormalizedText(text);
  return [...select.options].find(item=>{
    const optionValue=String(item.value??'').trim();
    const optionText=String(item.textContent??'').trim();
    return optionValue===text || optionText===text ||
      compareNormalizedText(optionValue)===normalized ||
      compareNormalizedText(optionText)===normalized;
  }) || null;
}
function compareSelectDisplayText(value,id){
  const text=String(value??'').trim();
  if(id==='runeChoiceType'){
    const runeLabel=COMPARE_SPECIAL_RUNE_LABELS[compareNormalizedText(text)];
    if(runeLabel) return runeLabel;
  }
  const select=$(id);
  if(select?.tagName==='SELECT'){
    const option=findSelectOptionByText(select, text);
    if(option) return String(option.textContent||option.value||'').trim() || '—';
  }
  return text || '—';
}
function compareDisplayText(value,id){
  if(id==='pbless') return powerBlessDisplayText(value);
  if(typeof value==='boolean') return value?'ON':'OFF';
  if(id) return compareSelectDisplayText(value,id);
  const text=String(value??'').trim();
  return text || '—';
}
function compareNumberDiffClass(diff){
  if(!Number.isFinite(diff)) return 'diff-warn';
  if(Math.abs(diff)<0.0000005) return 'diff-same';
  return diff>0 ? 'diff-positive' : 'diff-negative';
}
function buildCompareTextRow(kind, name, changeValue, currentValue, options={}){
  const id=options.id;
  const changeText=compareDisplayText(changeValue,id);
  const currentText=compareDisplayText(currentValue,id);
  const same=compareNormalizedText(changeText)===compareNormalizedText(currentText);
  return {kind,name,current:escapeCompareHtml(currentText),change:escapeCompareHtml(changeText),
    difference:same?'일치':escapeCompareHtml(changeText),status:same?'same':'diff',diffClass:same?'diff-same':'diff-text'};
}
function buildRuneChoiceCompareRow(kind, changeValues, currentValues){
  const display=values=>{
    const v=normalizeRuneChoiceValue(values?.runeChoiceValue);
    if(v===0) return '선택 안함';
    const t=normalizeRuneChoiceType(values?.runeChoiceType);
    return `${RUNE_CHOICE_TYPE_LABELS[t] || RUNE_CHOICE_TYPE_LABELS.harmony} +${v.toLocaleString('ko-KR')}`;
  };
  return buildCompareTextRow(kind, '룬 특수 옵션', display(changeValues), display(currentValues));
}
function buildCompareNumberRow(kind, name, changeValue, currentValue, tolerance=0.0005){
  const compare=compareNumber(changeValue,currentValue,tolerance);
  const currentText=formatCompareNumber(currentValue);
  const changeText=formatCompareNumber(changeValue);
  return {kind,name,current:currentText,change:changeText,difference:formatCompareDiff(compare.diff),
    status:compare.status,diffClass:compareNumberDiffClass(compare.diff)};
}
function webControlDisplay(id){
  const el=$(id);
  if(!el) return '—';
  if(EROSION_CONTROL_IDS.has(id)) return erosionStoredValue(id);
  if(id==='round') return targetRoundStoredValue();
  if(id==='challengeTowerFloor') return challengeTowerFloorStoredValue();
  if(el.type==='checkbox') return el.checked?'ON':'OFF';
  return String(el.value??'');
}
const EXCEL_TITLE_BONUS_MAP={'패왕':'12','패왕+':'13','제왕':'14','제왕+':'15','신황':'16','신황+':'17'};
const EXCEL_RUNE_TYPE_MAP={'AP':'ap','UA':'ua','TD':'td','TD&UA':'harmony','TD＆UA':'harmony','마법공격력':'ap','마법 공격력':'ap','유닛가속':'ua','유닛 가속':'ua','총데미지':'td','총 데미지':'td','총데미지&유닛가속':'harmony','총 데미지 & 유닛 가속':'harmony','총뎀가속':'harmony'};
const FIELD_REGISTRY={
  sp:{kind:'기본 정보',name:'시작 SP',compare:true,save:true,excel:'number'},
  xp:{kind:'기본 정보',name:'보유 XP',compare:true,save:true,excel:'number'},
  bxp:{kind:'기본 정보',name:'보유 BXP',compare:true,save:true,excel:'number'},
  rp:{kind:'기본 정보',name:'보유 RP',compare:true,save:true,excel:'number'},
  soul:{kind:'기본 정보',name:'본인 심연의혼',compare:true,save:true,excel:'number'},
  coralShard:{kind:'기본 정보',name:'코랄의 파편',compare:true,save:true,excel:'number'},
  aiurShard:{kind:'기본 정보',name:'아이어의 파편',compare:true,save:true,excel:'number'},
  xerusShard:{kind:'기본 정보',name:'제루스의 파편',compare:true,save:true,excel:'number'},
  diff:{kind:'기본 정보',name:'난이도',compare:true,save:true,excel:'select'},
  round:{kind:'기본 정보',name:'목표 라운드',compare:true,save:true,excel:'number'},
  challengeTowerFloor:{kind:'기본 정보',name:'도전의탑 층',compare:true,save:true,excel:'number'},
  soloMode:{kind:'기본 정보',name:'개인',compare:true,save:true,excel:'select'},
  coopMode:{kind:'기본 정보',name:'협동',compare:true,save:true,excel:'select'},
  coopPlayers:{kind:'기본 정보',name:'협동 인원수',compare:true,save:true,excel:'select'},
  coopPassenger2Dr:{kind:'기본 정보',name:'승객 2P 방어력 감소',compare:true,save:true,excel:'select'},
  coopPassenger3Dr:{kind:'기본 정보',name:'승객 3P 방어력 감소',compare:true,save:true,excel:'select'},
  team:{kind:'기본 정보',name:'출발 지원 인원수',compare:true,save:true,excel:'number'},
  pbless:{kind:'기본 정보',name:'파워 블레스',compare:true,save:true,excel:'select'},
  spBankApply:{kind:'기본 정보',name:'SP 은행',compare:true,save:true},
  penance:{kind:'기본 정보',name:'고행 단계',compare:true,save:true,excel:'number'},
  titleTdBonus:{kind:'기본 정보',name:'타이틀 총 데미지',compare:true,save:true,excel:'number'},
  dpsTableMinDps:{kind:'기본 정보',name:'도전할 최소 DPS',compare:true,save:true,excel:'number'},
  erosionStack:{kind:'기본 정보',name:'침식 스텍',compare:true,save:true,excel:'number'},
  jewelErosionRes:{kind:'기본 정보',name:'심연 내성',compare:true,save:true,excel:'number'},
  aprRuneNormal:{kind:'룬효과 버프',name:'4월 일반',compare:true,save:true},
  aprRunePlus:{kind:'룬효과 버프',name:'4월 강화(+)',compare:true,save:true},
  sepRuneNormal:{kind:'룬효과 버프',name:'9월 일반',compare:true,save:true},
  sepRunePlus:{kind:'룬효과 버프',name:'9월 강화(+)',compare:true,save:true},
  overEnhance:{kind:'룬효과 버프',name:'오버핸스',compare:true,save:true},
  repairEnhance:{kind:'룬효과 버프',name:'리페핸스',compare:true,save:true},
  enhanceMaster:{kind:'룬효과 버프',name:'강화의 달인',compare:true,save:true},
  dailyCouponBuff:{kind:'룬효과 버프',name:'일일쿠폰',compare:true,save:true},
  shareUserBuff:{kind:'룬효과 버프',name:'나눔유저',compare:true,save:true},
  unitUniqueBuff:{kind:'룬효과 버프',name:'단일유닛버프',compare:true,save:true},
  basePierceBuff:{kind:'룬효과 버프',name:'방어력관통 10%',compare:true,save:true},
  prodArtifact:{kind:'룬효과 버프',name:'유물',compare:true,save:true},
  prodNova:{kind:'룬효과 버프',name:'비밀 작전 노바',compare:true,save:true},
  prodTeratron:{kind:'룬효과 버프',name:'테라트론',compare:true,save:true},
  prodAmon:{kind:'룬효과 버프',name:'아몬',compare:true,save:true},
  prodAdun:{kind:'룬효과 버프',name:'아둔의 창',compare:true,save:true},
  prodKerrigan:{kind:'룬효과 버프',name:'불새 케리건',compare:true,save:true},
  prodOvermind:{kind:'룬효과 버프',name:'초월체',compare:true,save:true},
  prodNarud:{kind:'룬효과 버프',name:'나루드',compare:true,save:true},
  flowerSkill1:{kind:'룬효과 버프',name:'근성의 꽃가루',compare:true,save:true},
  flowerSkill2:{kind:'룬효과 버프',name:'바람의 꽃가루',compare:true,save:true},
  flowerSkill3:{kind:'룬효과 버프',name:'안개의 꽃가루',compare:true,save:true},
  rAD:{kind:'룬정보',name:'공격력',compare:true,save:true,excel:'number'},
  rModAD:{kind:'룬정보',name:'공격력 개조',compare:true,save:true,excel:'number'},
  runeChoiceType:{kind:'룬정보',name:'룬 특수 옵션',compare:true,save:true,excel:'select'},
  runeChoiceValue:{kind:'룬정보',name:'룬 특수 옵션',compare:true,save:true,excel:'number'},
  rAS:{kind:'룬정보',name:'공격속도',compare:true,save:true,excel:'number'},
  rModAS:{kind:'룬정보',name:'공격속도 개조',compare:true,save:true,excel:'number'},
  rCD:{kind:'룬정보',name:'크리티컬 데미지',compare:true,save:true,excel:'number'},
  rModCD:{kind:'룬정보',name:'크리티컬 데미지 개조',compare:true,save:true,excel:'number'},
  rCRI:{kind:'룬정보',name:'크리티컬 확률',compare:true,save:true,excel:'number'},
  rModCRI:{kind:'룬정보',name:'크리티컬 확률 개조',compare:true,save:true,excel:'number'},
  rReinf:{kind:'룬정보',name:'룬 강화 수',compare:true,save:true,excel:'number'},
  rAsc:{kind:'룬정보',name:'룬 각성',compare:true,save:true,excel:'select'},
  raceOpt:{kind:'룬정보',name:'종족 업그레이드',compare:true,save:true,excel:'select'},
  opt10:{kind:'룬정보',name:'10강 옵션',compare:true,save:true,excel:'select'},
  opt15:{kind:'룬정보',name:'15강 옵션',compare:true,save:true,excel:'select'},
  transOpt:{kind:'룬정보',name:'초월 옵션',compare:true,save:true,excel:'select'},
  addAD:{kind:'에디셔널',name:'공격력',compare:true,save:true,excel:'number'},
  addAS:{kind:'에디셔널',name:'공격속도',compare:true,save:true,excel:'number'},
  addCD:{kind:'에디셔널',name:'크리티컬 데미지',compare:true,save:true,excel:'number'},
  addCRI:{kind:'에디셔널',name:'크리티컬 확률',compare:true,save:true,excel:'number'},
  addAP:{kind:'에디셔널',name:'마법공격력',compare:true,save:true,excel:'number'},
  addTD:{kind:'에디셔널',name:'총 데미지',compare:true,save:true,excel:'number'},
  addUA:{kind:'에디셔널',name:'유닛 가속',compare:true,save:true,excel:'number'},
  enchAD:{kind:'인챈트 레벨 / 결과',name:'공격력',save:true,excel:'number'},
  enchCRI:{kind:'인챈트 레벨 / 결과',name:'크리티컬 확률',save:true,excel:'number'},
  enchUA:{kind:'인챈트 레벨 / 결과',name:'유닛 가속',save:true,excel:'number'},
  enchTD:{kind:'인챈트 레벨 / 결과',name:'총 데미지',save:true,excel:'number'},
  enchSR:{kind:'인챈트 레벨 / 결과',name:'실드 감소',save:true,excel:'number'},
  enchHR:{kind:'인챈트 레벨 / 결과',name:'체력 감소',save:true,excel:'number'},
  enchantCode:{kind:'인챈트 레벨 / 결과',name:'인챈트 코드',save:true},
  optTier:{kind:'특성 보드',name:'특성 최적화',compare:true,save:true},
  utilOptTier:{kind:'특성 보드',name:'유틸 마스터',compare:true,save:true},
  traitLimitAD:{kind:'특성 투자 제한',name:'공격력',compare:true,save:true},
  traitLimitAS:{kind:'특성 투자 제한',name:'공격속도',compare:true,save:true},
  traitLimitCRI:{kind:'특성 투자 제한',name:'크리티컬 확률',compare:true,save:true},
  traitLimitCD:{kind:'특성 투자 제한',name:'크리티컬 데미지',compare:true,save:true},
  traitLimitMC:{kind:'특성 투자 제한',name:'다중 크리',compare:true,save:true},
  traitLimitDR:{kind:'특성 투자 제한',name:'방어력 감소',compare:true,save:true},
  traitLimitTD:{kind:'특성 투자 제한',name:'총 데미지',compare:true,save:true},
  traitLimitUA:{kind:'특성 투자 제한',name:'유닛 가속',compare:true,save:true},
  traitLimitMultiTarget:{kind:'특성 투자 제한',name:'멀티타겟',compare:true,save:true},
  traitLimitInfinite:{kind:'특성 투자 제한',name:'무한특성',compare:true,save:true},
  skillDouble:{kind:'성소 보드',name:'더블스페',compare:true,save:true,excel:'number'},
  skillMode:{kind:'성소 보드',name:'모드',compare:true,save:true},
  skillRound:{kind:'성소 보드',name:'라운드',compare:true,save:true,excel:'number'},
  unitGrade:{kind:'룬효과 버프',name:'유닛 등급',compare:true},
  unitLevel:{kind:'룬효과 버프',name:'유닛 레벨',compare:true},
};
const fieldEntriesByFlag=flag=>Object.entries(FIELD_REGISTRY).filter(([,field])=>field[flag]).map(([id])=>id);
const EXCEL_NUMERIC_INPUT_IDS=new Set(Object.entries(FIELD_REGISTRY).filter(([,field])=>field.excel==='number').map(([id])=>id));
const EXCEL_SELECT_INPUT_IDS=new Set(Object.entries(FIELD_REGISTRY).filter(([,field])=>field.excel==='select').map(([id])=>id));
const COMPARE_VALUE_META=Object.fromEntries(Object.entries(FIELD_REGISTRY).filter(([,field])=>field.compare).map(([id,field])=>[id,{kind:field.kind,name:field.name}]));
const USER_STATE_VALUE_IDS=new Set(fieldEntriesByFlag('save'));
const ENCHANT_COMPARE_ITEMS=[['enchAD','공격력'],['enchCRI','크리티컬 확률'],['enchUA','유닛 가속'],['enchTD','총 데미지'],['enchSR','실드 감소'],['enchHR','체력 감소']];
const LATEST_SPEC_ADDITIONAL_STRUCTURE_MESSAGE='불러온 엑셀파일은 5.4392 버전과 구조가 달라 프리셋 분석 기능을 사용할 수 없습니다.';
const LATEST_SPEC_ADDITIONAL_LABELS=[['Q36','AD'],['Q37','AS'],['Q38','CD'],['Q39','CRI'],['Q40','AP'],['Q41','TD'],['Q42','UA']];
const SPEC_ADDITIONAL_CELLS={addAD:'R36',addAS:'R37',addCD:'R38',addCRI:'R39',addAP:'R40',addTD:'R41',addUA:'R42'};
function normalizeStructureText(value){
  return excelText(value).replace(/\s+/g,'').toLowerCase();
}
function inspectSpecAdditionalStructure(specCells){
  const mismatches=LATEST_SPEC_ADDITIONAL_LABELS.filter(([ref,expected])=>
    normalizeStructureText(specCells[ref])!==normalizeStructureText(expected)
  ).map(([ref,expected])=>({ref,expected,actual:excelText(specCells[ref])||'값 없음'}));
  return { valid:mismatches.length===0, mismatches, message:LATEST_SPEC_ADDITIONAL_STRUCTURE_MESSAGE };
}
function validateTraitPresetExcelSpecAdditionalStructure(workbook){
  try{
    const specCells=workbook?.getCells?.('스펙');
    const additionalInfo=inspectSpecAdditionalStructure(specCells || {});
    if(!additionalInfo.valid) throw new Error(additionalInfo.message);
  }catch(e){
    throw new Error(LATEST_SPEC_ADDITIONAL_STRUCTURE_MESSAGE);
  }
}
function getSpecAdditionalValue(specCells, id){
  const ref=SPEC_ADDITIONAL_CELLS[id];
  const value=ref ? specCells[ref] : undefined;
  return DECIMAL_DISPLAY_INPUT_IDS.has(id) ? normalizeDecimalDisplayValue(value) : value;
}
function getSpecEnchantCode(specCells){
  return ['G52','G53','G54','G55','G56','G57'].map(ref=>{
    const value=excelNumber(specCells[ref]);
    return String(Math.max(0,Math.min(9,Math.round(value??0))));
  }).join('');
}
function normalizeEnchantCompareCode(code){
  return String(code??'').replace(/[^0-9]/g,'').padEnd(6,'0').slice(0,6);
}
function enchantCompareCodeFromValues(values={}){
  const saved=normalizeEnchantCompareCode(values.enchantCode);
  if(saved.replace(/0/g,'')) return saved;
  return ENCHANT_COMPARE_ITEMS.map(([id])=>{
    const n=parseInt(String(values[id]??'0').replace(/[^0-9]/g,''),10);
    return String(Math.max(0,Math.min(9,Number.isFinite(n)?n:0)));
  }).join('');
}
function buildEnchantCompareRows(changeCode,currentCode){
  const change=normalizeEnchantCompareCode(changeCode);
  const current=normalizeEnchantCompareCode(currentCode);
  return ENCHANT_COMPARE_ITEMS.map(([,name],index)=>
    buildCompareNumberRow('인챈트 레벨 / 결과',name,change[index]||0,current[index]||0,0.0001)
  );
}
function applyRuneChoiceState(values, cells){
  const type=excelStateValue('runeChoiceType', cells.I6, {valueMap:EXCEL_RUNE_TYPE_MAP}) || 'harmony';
  const value=excelNumber(cells.J6) ?? 0;
  values.runeChoiceType=type;
  values.runeChoiceValue=String(value);
  RUNE_CHOICE_TARGETS.forEach(([kind,id])=>{ values[id]=String(kind===type ? value : 0); });
}
function buildExcelChoiceRow(name, excel, id, options={}){
  const changeValue=options.boolean ? (excelFlag(excel)?'ON':'OFF') : String(excel??'');
  const currentValue=webControlDisplay(id);
  return buildCompareTextRow('룬효과 버프',name,changeValue,currentValue,{id});
}
function compareExcelInputValue(value,id){
  if(EXCEL_NUMERIC_INPUT_IDS.has(id)) return formatCompareNumber(value);
  if(EXCEL_SELECT_INPUT_IDS.has(id) && (value===undefined || value===null || String(value).trim()==='')){
    const el=$(id);
    return el?.tagName==='SELECT' ? String(el.options[0]?.value ?? '') : '';
  }
  return String(value??'').replace(/,/g,'').trim();
}
function isExcelTowerContext(cells={}, sheetName=''){
  const name=String(sheetName || '').replace(/\s+/g,'').toLowerCase();
  if(name.includes('도전의탑') || name.includes('도전의타워')) return true;
  return difficultyName(firstExcelValue(cells,['B4','N41']))===TOWER_DIFFICULTY_NAME;
}
function excelRoundFieldId(cells={}, sheetName=''){
  return isExcelTowerContext(cells, sheetName) ? 'challengeTowerFloor' : 'round';
}
function excelRoundFieldName(cells={}, sheetName=''){
  return isExcelTowerContext(cells, sheetName) ? '도전의탑 층' : '목표 라운드';
}
function buildExcelInputSpecs(cells,specCells,sheetName=''){
  const roundFieldId=excelRoundFieldId(cells,sheetName);
  const roundFieldName=excelRoundFieldName(cells,sheetName);
  return [
    ['기본 정보','시작 SP',Math.round(Number(normalizedExcelTotalSpValue(cells))||0),'sp'],
    ['기본 정보','보유 XP',specCells.R20,'xp'],
    ['기본 정보','보유 BXP',specCells.R21,'bxp'],
    ['기본 정보','보유 RP',cells.B16,'rp'],
    ['기본 정보','본인 심연의혼',cells.B19,'soul'],
    ['기본 정보','코랄의 파편',specCells.R26,'coralShard'],
    ['기본 정보','아이어의 파편',specCells.R27,'aiurShard'],
    ['기본 정보','제루스의 파편',specCells.R28,'xerusShard'],
    ['기본 정보','난이도',firstExcelValue(cells,['B4','N41']),'diff'],
    ['기본 정보','고행 단계',firstExcelValue(cells,['B6','N42','AD8']),'penance'],
    ['기본 정보',roundFieldName,firstExcelValue(cells,['B7','N43']),roundFieldId],
    ['기본 정보','출발 지원 인원수',cells.D5,'team'],
    ['기본 정보','타이틀 총 데미지',EXCEL_TITLE_BONUS_MAP[excelText(specCells.S17)]??specCells.S17,'titleTdBonus'],
    ['기본 정보','침식 스텍',cells.H10,'erosionStack'],
    ['기본 정보','심연 내성',cells.H11,'jewelErosionRes'],
    ['기본 정보','파워 블레스',normalizePowerBlessRawValue(cells.D4),'pbless'],
    ['룬정보','공격력',cells.J5,'rAD'],
    ['룬정보','공격력 개조',specCells.C19,'rModAD'],
    ['룬정보','룬 특수 옵션',EXCEL_RUNE_TYPE_MAP[excelText(cells.I6)]??cells.I6,'runeChoiceType'],
    ['룬정보','룬 특수 옵션',cells.J6,'runeChoiceValue'],
    ['룬정보','공격속도',cells.J7,'rAS'],
    ['룬정보','공격속도 개조',specCells.C21,'rModAS'],
    ['룬정보','크리티컬 데미지',cells.J8,'rCD'],
    ['룬정보','크리티컬 데미지 개조',specCells.C22,'rModCD'],
    ['룬정보','크리티컬 확률',cells.J9,'rCRI'],
    ['룬정보','크리티컬 확률 개조',specCells.C23,'rModCRI'],
    ['룬정보','룬 강화 수',cells.J11,'rReinf'],
    ['룬정보','룬 각성',cells.J12,'rAsc'],
    ['룬정보','종족 업그레이드',cells.J13,'raceOpt'],
    ['룬정보','10강 옵션',resolveExcelSelectValue('opt10',cells.J14)??cells.J14,'opt10'],
    ['룬정보','15강 옵션',resolveExcelSelectValue('opt15',cells.J15)??cells.J15,'opt15'],
    ['룬정보','초월 옵션',resolveExcelSelectValue('transOpt',cells.J16)??cells.J16,'transOpt'],
    ['에디셔널','공격력',specCells.R36,'addAD'],
    ['에디셔널','공격속도',specCells.R37,'addAS'],
    ['에디셔널','크리티컬 데미지',specCells.R38,'addCD'],
    ['에디셔널','크리티컬 확률',specCells.R39,'addCRI'],
    ['에디셔널','마법공격력',specCells.R40,'addAP'],
    ['에디셔널','총 데미지',specCells.R41,'addTD'],
    ['에디셔널','유닛 가속',specCells.R42,'addUA']
  ];
}
function buildExcelInputRows(cells,specCells,sheetName=''){
  const rows=[];
  buildExcelInputSpecs(cells,specCells,sheetName).forEach(([kind,name,excel,id])=>{
    if(id==='runeChoiceType'){
      rows.push(buildRuneChoiceCompareRow('룬정보', {
        runeChoiceType:EXCEL_RUNE_TYPE_MAP[excelText(cells.I6)]??cells.I6,
        runeChoiceValue:cells.J6
      }, {
        runeChoiceType:vs('runeChoiceType'),
        runeChoiceValue:webControlDisplay('runeChoiceValue')
      }));
      return;
    }
    if(id==='runeChoiceValue') return;
    const changeValue=compareExcelInputValue(excel,id);
    const currentValue=EXCEL_NUMERIC_INPUT_IDS.has(id) ? formatCompareNumber(webControlDisplay(id)) : String(webControlDisplay(id)).replace(/,/g,'').trim();
    if(EXCEL_NUMERIC_INPUT_IDS.has(id)) rows.push(buildCompareNumberRow(kind,name,changeValue,currentValue));
    else rows.push(buildCompareTextRow(kind,name,changeValue,currentValue,{id}));
  });
  return rows;
}
function validateExcelCompareSheet(cells,sheetName){
  if(!Number.isFinite(Number(cells.M19))||!Number.isFinite(Number(cells.L4))){
    throw new Error(`"${sheetName}" 시트는 현재 계산기와 비교할 수 있는 셀 구조가 아닙니다.`);
  }
}
function buildExcelStatRows(cells,stats){
  return EXCEL_COMPARE_STATS.map(([,name,displayCell,,getDisplay])=>{
    const excelDisplay=excelCompareNumberValue(cells[displayCell]);
    const webDisplay=excelCompareRound(getDisplay(stats),6);
    const displayCompare=compareNumber(excelDisplay,webDisplay);
    return {kind:'데미지 보드',name,current:formatCompareNumber(webDisplay),change:formatCompareNumber(excelDisplay),
      difference:formatCompareDiff(displayCompare.diff),status:displayCompare.status,diffClass:compareNumberDiffClass(displayCompare.diff)};
  });
}
function buildExcelTraitRows(cells){
  return TRAITS.filter(t=>t[0]>=42&&t[0]<=138).map(t=>{
    const row=t[0], changeValue=excelCompareNumberValue(cells[`H${row}`]), currentValue=Number(INV[row]||0);
    return buildCompareNumberRow('특성 보드',t[1],changeValue,currentValue,0.0001);
  }).filter(row=>row.status!=='same');
}
function buildExcelBuffRows(cells,specCells){
  return [
    buildExcelChoiceRow('4월 일반',specCells.N52,'aprRuneNormal'),
    buildExcelChoiceRow('4월 강화(+)',specCells.O52,'aprRunePlus'),
    buildExcelChoiceRow('9월 일반',specCells.N53,'sepRuneNormal'),
    buildExcelChoiceRow('9월 강화(+)',specCells.O53,'sepRunePlus'),
    buildExcelChoiceRow('오버핸스',cells.H14,'overEnhance'),
    buildExcelChoiceRow('리페핸스',cells.H15,'repairEnhance'),
    buildExcelChoiceRow('강화의 달인',cells.H16,'enhanceMaster'),
    buildExcelChoiceRow('일일쿠폰',specCells.R24,'dailyCouponBuff',{boolean:true}),
    buildExcelChoiceRow('나눔유저',cells.H116,'shareUserBuff',{boolean:true}),
    buildExcelChoiceRow('단일유닛버프',cells.H6,'unitUniqueBuff',{boolean:true}),
    buildExcelChoiceRow('방어력관통 10%',cells.H8,'basePierceBuff',{boolean:true}),
    buildExcelChoiceRow('유물',cells.F11,'prodArtifact',{boolean:true}),
    buildExcelChoiceRow('비밀 작전 노바',cells.F4,'prodNova',{boolean:true}),
    buildExcelChoiceRow('테라트론',cells.F5,'prodTeratron',{boolean:true}),
    buildExcelChoiceRow('아몬',cells.F6,'prodAmon',{boolean:true}),
    buildExcelChoiceRow('아둔의 창',cells.F7,'prodAdun',{boolean:true}),
    buildExcelChoiceRow('불새 케리건',cells.F8,'prodKerrigan',{boolean:true}),
    buildExcelChoiceRow('초월체',cells.F9,'prodOvermind',{boolean:true}),
    buildExcelChoiceRow('나루드',cells.F10,'prodNarud',{boolean:true}),
    buildExcelChoiceRow('근성의 꽃가루',cells.F13,'flowerSkill1',{boolean:true}),
    buildExcelChoiceRow('바람의 꽃가루',cells.F14,'flowerSkill2',{boolean:true}),
    buildExcelChoiceRow('안개의 꽃가루',cells.F15,'flowerSkill3',{boolean:true})
  ];
}
function buildExcelComparison(cells, specCells, zeroCells, fileName, sheetName){
  validateExcelCompareSheet(cells,sheetName);
  const stats=computeStatsRaw();
  const dpsCompare=compareNumber(cells.M19,stats.M19);
  const inputRows=buildExcelInputRows(cells,specCells,sheetName);
  const enchantRows=buildEnchantCompareRows(getSpecEnchantCode(specCells),webControlDisplay('enchantCode'));
  const statRows=buildExcelStatRows(cells,stats);
  const buffRows=buildExcelBuffRows(cells,specCells);
  const traitRows=buildExcelTraitRows(cells);
  const zeroRows=buildZeroScoreCompareRows(zeroCells);
  const dpsRow=buildCompareNumberRow('DPS','웹 기준 DPS',cells.M19,stats.M19);
  return {
    fileName,
    sheetName,
    sourceType:'excel',
    summary:{
      dps:{change:excelCompareNumberValue(cells.M19),current:stats.M19,diff:dpsCompare.diff,status:dpsCompare.status},
      statDiffs:statRows.filter(r=>r.status!=='same').length,
      inputDiffs:inputRows.filter(r=>r.status!=='same').length + enchantRows.filter(r=>r.status!=='same').length,
      traitDiffs:traitRows.length,
      buffDiffs:buffRows.filter(r=>r.status!=='same').length,
      zeroDiffs:zeroRows.filter(r=>r.status!=='same').length
    },
    rows:[
      dpsRow,
      ...inputRows,
      ...enchantRows,
      ...statRows,
      ...buffRows,
      ...zeroRows,
      ...traitRows
    ]
  };
}
const COMPARE_FILTER_LABELS={all:'전체 보기',stat:'스탯 차이',input:'입력값 차이',buff:'룬효과 버프 차이',trait:'특성 차이',zero:'승단 차이'};
const COMPARE_FILTER_ORDER=['all','stat','input','buff','trait','zero'];
const COMPARE_SUMMARY_COUNT_KEYS={stat:'statDiffs',input:'inputDiffs',buff:'buffDiffs',trait:'traitDiffs',zero:'zeroDiffs'};
const EXCEL_COMPARE_COLGROUP='<colgroup><col class="compare-col-kind"><col class="compare-col-name"><col class="compare-col-current"><col class="compare-col-change"><col class="compare-col-diff"></colgroup>';
const EXCEL_COMPARE_EMPTY_HTML='<div class="excel-compare-empty">기준 프리셋과 비교 프리셋을 선택하세요.<small>엑셀파일은 시트 단위, 특성 프리셋 파일은 프리셋 제목 단위로 비교합니다.</small></div>';
function hydrateCompareControls(){
  const select=$('excelCompareSheet');
  const baseSelect=$('excelCompareBasePreset');
  const baseRejected=!!compareState.baseFileRejected;
  if(baseSelect){
    const bundle=compareState.baseTraitPresetBundle;
    const store=baseRejected ? {presets:[]} : (bundle || loadTraitPresetStore());
    const presets=Array.isArray(store.presets) ? store.presets : [];
    const ids=presets.map(preset=>preset.id);
    const localSelected=!bundle ? selectedTraitPresetId() : '';
    const fallback=ids.includes(compareState.baseTraitPresetId) ? compareState.baseTraitPresetId : (ids.includes(localSelected) ? localSelected : (ids[0] || ''));
    baseSelect.innerHTML=presets.map(preset=>`<option value="${escapeCompareHtml(preset.id)}">${escapeCompareHtml(preset.name)}</option>`).join('') || '<option value="">기준 프리셋 없음</option>';
    baseSelect.disabled=!presets.length;
    baseSelect.value=fallback;
    compareState.baseTraitPresetId=fallback;
  }
  if(!select){ updateCompareTargetFileAccess(); return; }
  if(compareState.sourceType==='excel' && compareState.workbook){
    const sheets=compareState.workbook.sheets || [];
    const names=sheets.map(sheet=>sheet.name);
    const selected=names.includes(compareState.selectedSheetName) ? compareState.selectedSheetName : (names[0] || '');
    select.innerHTML=sheets.map(sheet=>`<option value="${escapeCompareHtml(sheet.name)}">${escapeCompareHtml(sheet.name)}</option>`).join('');
    select.disabled=!sheets.length;
    if(selected){
      select.value=selected;
      compareState.selectedSheetName=selected;
    }
  }else if(compareState.sourceType==='traitPreset' && compareState.traitPresetBundle){
    const bundle=compareState.traitPresetBundle;
    const presets=Array.isArray(bundle.presets) ? bundle.presets : [];
    const ids=presets.map(preset=>preset.id);
    const selected=ids.includes(compareState.selectedSheetName) ? compareState.selectedSheetName : (ids[0] || '');
    select.innerHTML=presets.map(preset=>`<option value="${escapeCompareHtml(preset.id)}">${escapeCompareHtml(preset.name)}</option>`).join('') || '<option value="">프리셋 없음</option>';
    select.disabled=!presets.length;
    if(selected){
      select.value=selected;
      compareState.selectedSheetName=selected;
    }
  }else if(compareState.sourceType==='json' && compareState.backupState){
    select.innerHTML='<option value="savedFile">저장파일</option>';
    select.value='savedFile';
    select.disabled=true;
    compareState.selectedSheetName='savedFile';
  }else{
    select.innerHTML='<option value="">비교파일을 불러오세요</option>';
    select.disabled=true;
    compareState.selectedSheetName='';
  }
  updateCompareTargetFileAccess();
}
function compareHasValidBase(){
  return !!selectedBaseTraitPreset();
}
function updateCompareTargetFileAccess(){
  const input=$('excelCompareFile');
  const label=document.querySelector('.excel-compare-target-file-btn');
  const enabled=compareHasValidBase();
  if(input) input.disabled=!enabled;
  if(label){
    label.classList.toggle('is-disabled',!enabled);
    label.setAttribute('aria-disabled',enabled?'false':'true');
  }
}
function clearCompareTargetSelection(){
  compareState.workbook=null;
  compareState.backupState=null;
  compareState.traitPresetBundle=null;
  compareState.sourceType=null;
  compareState.lastResult=null;
  compareState.activeFilter='all';
  compareState.restoreState=null;
  compareState.applied=false;
  compareState.selectedSheetName='';
  const targetFile=$('excelCompareFile');
  const targetSelect=$('excelCompareSheet');
  if(targetFile) targetFile.value='';
  if(targetSelect){
    targetSelect.innerHTML='<option value="">비교파일을 불러오세요</option>';
    targetSelect.disabled=true;
    targetSelect.value='';
  }
}
function rejectCompareBaseFile(message){
  compareState.baseTraitPresetBundle=null;
  compareState.baseTraitPresetId='';
  compareState.baseFileRejected=true;
  clearCompareTargetSelection();
  hydrateCompareControls();
  const body=$('excelCompareBody');
  if(body) body.innerHTML=`<div class="excel-compare-error">${escapeCompareHtml(message || '분석 기준 파일을 불러올 수 없습니다.')}</div>`;
  updateCompareActionButtons();
}
function selectedExcelSheetName(){
  if(compareState.sourceType!=='excel' || !compareState.workbook) return '';
  const select=$('excelCompareSheet');
  const candidate=String((select && !select.disabled && select.value) || compareState.selectedSheetName || '').trim();
  const names=(compareState.workbook.sheets||[]).map(sheet=>sheet.name);
  const sheetName=names.includes(candidate) ? candidate : '';
  if(sheetName){
    compareState.selectedSheetName=sheetName;
    if(select && select.value!==sheetName) select.value=sheetName;
  }
  return sheetName;
}

const COMPARE_INPUT_EXCLUDE_KINDS=new Set(['DPS','데미지 보드','룬효과 버프','특성 보드','더제로 승단 정보']);
function compareSummaryCard(filter,label,count,active){
  const isAll=filter==='all';
  const stateClass=isAll ? 'same is-all' : count ? 'diff' : 'same';
  const selectedClass=active===filter ? 'is-active' : '';
  const valueText=`${count}개`;
  const content=isAll
    ? `<span>${label}</span>`
    : `<span>${label}</span><b>${valueText}</b>`;
  return `<button type="button" class="ui-choice-card excel-compare-summary-card ${stateClass} ${selectedClass}" data-excel-compare-filter="${filter}" aria-pressed="${active===filter?'true':'false'}">${content}</button>`;
}
function compareRowMatchesFilter(row,filter){
  if(filter==='all') return true;
  if(!row || row.status==='same') return false;
  if(filter==='stat') return row.kind==='데미지 보드';
  if(filter==='buff') return row.kind==='룬효과 버프';
  if(filter==='trait') return row.kind==='특성 보드';
  if(filter==='zero') return row.kind==='더제로 승단 정보';
  if(filter==='input') return !COMPARE_INPUT_EXCLUDE_KINDS.has(row.kind);
  return true;
}
function compareSummaryHtml(summary,active){
  return COMPARE_FILTER_ORDER.map(filter=>compareSummaryCard(
    filter,
    COMPARE_FILTER_LABELS[filter],
    filter==='all' ? 0 : (summary[COMPARE_SUMMARY_COUNT_KEYS[filter]] || 0),
    active
  )).join('');
}
function setCompareError(message, options={}){
  const body=$('excelCompareBody');
  const apply=$('excelCompareApplyBtn');
  const reset=$('excelCompareResetBtn');
  if(apply) apply.disabled=true;
  if(reset) reset.disabled=false;
  if(body){
    const html=escapeCompareHtml(message ?? '비교 실패');
    body.innerHTML=`<div class="excel-compare-error">${options.keepVersionMarkup ? html.replace('5.4392','<span class="excel-compare-version">5.4392</span>') : html}</div>`;
  }
  updateCompareActionButtons();
}
function compareRowsHtml(rows,emptyMessage){
  return rows.map(row=>`<tr class="${row.status}"><td>${escapeCompareHtml(row.kind)}</td><th>${escapeCompareHtml(row.name)}</th><td>${row.current}</td><td>${row.change}</td><td class="compare-diff ${row.diffClass||''}">${row.difference}</td></tr>`).join('') ||
    `<tr class="same"><td colspan="5" class="excel-compare-no-diff">${escapeCompareHtml(emptyMessage)}</td></tr>`;
}
function renderExcelComparison(result,options={}){
  const body=$('excelCompareBody');
  if(!body) return;
  compareState.lastResult=result;
  if(!options.preserveFilter) compareState.activeFilter='all';
  const active=COMPARE_FILTER_LABELS[compareState.activeFilter] ? compareState.activeFilter : 'all';
  compareState.activeFilter=active;
  const {summary}=result;
  const visibleRows=(result.rows||[]).filter(row=>compareRowMatchesFilter(row,active));
  const emptyMessage=active==='all' ? '기준 프리셋과 비교 프리셋이 모두 일치합니다.' : `${COMPARE_FILTER_LABELS[active] || '선택한 구분'} 항목에서 차이 난 값이 없습니다.`;
  body.innerHTML=`
    <div class="excel-compare-summary">${compareSummaryHtml(summary,active)}</div>
    <div class="excel-compare-table-wrap">
      <table class="excel-compare-table excel-compare-table-head">${EXCEL_COMPARE_COLGROUP}<thead><tr><th>구분</th><th>항목</th><th>기준 프리셋</th><th>비교 프리셋</th><th>차이</th></tr></thead></table>
      <div class="excel-compare-table-scroll">
        <table class="excel-compare-table excel-compare-table-body">${EXCEL_COMPARE_COLGROUP}<tbody>${compareRowsHtml(visibleRows,emptyMessage)}</tbody></table>
      </div>
    </div>`;
  updateCompareActionButtons();
}
function openCompareInfo(){
  openMonthRune('compare');
}
function closeCompareInfo(){
  closeMonthRune();
}
function compareCanApply(){
  if(compareState.applied) return false;
  if(compareState.sourceType==='json') return !!compareState.backupState;
  if(compareState.sourceType==='traitPreset') return !!selectedCompareTraitPreset();
  if(compareState.sourceType==='excel'){
    return !!(compareState.workbook && selectedExcelSheetName() && compareState.lastResult);
  }
  return false;
}
function updateCompareActionButtons(){
  const apply=$('excelCompareApplyBtn');
  const reset=$('excelCompareResetBtn');
  const restore=$('excelCompareRestoreBtn');
  if(apply) apply.disabled=!compareCanApply();
  if(reset) reset.disabled=!(compareState.sourceType || compareState.lastResult || compareState.workbook || compareState.backupState || compareState.traitPresetBundle);
  if(restore) restore.disabled=!compareState.restoreState;
  updateCompareTargetFileAccess();
}
function clearCompareRestoreState(){
  compareState.restoreState=null;
  compareState.applied=false;
  updateCompareActionButtons();
}
function restoreComparisonCurrentState(){
  if(!compareState.restoreState) return;
  try{
    const restoreState=compareState.restoreState;
    applyStateObject(restoreState);
    const saved=saveState({silent:true});
    if(saved===false) throw new Error('현재값은 복원했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.');
    compareState.restoreState=null;
    compareState.applied=false;
    if(compareState.sourceType==='json' && compareState.backupState) renderJsonComparison(compareState.backupState);
    else if(compareState.sourceType==='traitPreset'){ hydrateCompareControls(); compareSelectedTraitPreset({preserveRestore:true}); }
    else if(compareState.sourceType==='excel'){ hydrateCompareControls(); compareSelectedExcelSheet({preserveRestore:true}); }
    updateCompareActionButtons();
    notifyStorageAction('현재값 복원 완료','ok',{statusAction:'load'});
  }catch(e){
    logAppError('[compare restore failed]',e);
    showToast(e?.message||String(e),'err');
  }
}
function resetExcelComparison(options={}){
  resetCompareState();
  const select=$('excelCompareSheet');
  const baseSelect=$('excelCompareBasePreset');
  const file=$('excelCompareFile');
  const baseFile=$('excelCompareBaseFile');
  const apply=$('excelCompareApplyBtn');
  const reset=$('excelCompareResetBtn');
  const restore=$('excelCompareRestoreBtn');
  const body=$('excelCompareBody');
  if(select){
    select.innerHTML='<option value="">비교파일을 불러오세요</option>';
    select.disabled=true;
  }
  if(baseSelect){ baseSelect.innerHTML='<option value="">기준 프리셋 없음</option>'; baseSelect.disabled=true; baseSelect.value=''; }
  if(file) file.value='';
  if(baseFile) baseFile.value='';
  hydrateCompareControls();
  if(apply) apply.disabled=true;
  if(reset) reset.disabled=true;
  if(restore) restore.disabled=true;
  if(body) body.innerHTML=EXCEL_COMPARE_EMPTY_HTML;
  if(options.close) closeCompareInfo();
}
function resolveExcelSelectValue(id, value){
  const select=$(id);
  const text=excelText(value);
  if(!select||!text) return null;
  const option=findSelectOptionByText(select, text);
  return option ? option.value : null;
}
function firstExcelValue(cells, refs){
  for(const ref of refs){
    if(cells[ref]!==undefined && cells[ref]!==null && cells[ref]!=='') return cells[ref];
  }
  return null;
}
function hasExcelCellValue(cells={}, ref=''){
  return cells[ref]!==undefined && cells[ref]!==null && String(cells[ref]).trim()!=='';
}
function excelSpBankBonusValue(cells={}){
  const direct=hasExcelCellValue(cells,'AM9') ? excelNumber(cells.AM9) : null;
  if(direct!==null) return Math.max(0,direct);
  const ticks=hasExcelCellValue(cells,'AL9') ? excelNumber(cells.AL9) : null;
  if(ticks===null || ticks<=0) return 0;
  const unitBonus=hasExcelCellValue(cells,'D89') ? excelNumber(cells.D89) : null;
  if(unitBonus!==null && unitBonus>0) return unitBonus*ticks;
  const bankLevel=hasExcelCellValue(cells,'H89') ? excelNumber(cells.H89) : null;
  return bankLevel!==null && bankLevel>0 ? bankLevel*1000*ticks : 0;
}
function excelSpBankApplyValue(cells={}){
  return excelSpBankBonusValue(cells)>0 ? '반영' : '미반영';
}
function normalizedExcelTotalSpValue(cells={}){
  const total=hasExcelCellValue(cells,'B9') ? excelNumber(cells.B9) : null;
  if(total===null) return cells.B9;
  const spBankBonus=excelSpBankBonusValue(cells);
  return spBankBonus>0 && total>=spBankBonus ? total-spBankBonus : total;
}
function excelStateValue(id, value, options={}){
  const el=$(id);
  if(!el || value===undefined || value===null || value==='') return undefined;
  if(TRAIT_LIMIT_INPUT_IDS.has(id)){
    const text=String(value ?? '').trim();
    if(text==='' || text==='∞' || /^inf(inity)?$/i.test(text)) return '0';
  }
  if(el.tagName==='SELECT'){
    return options.valueMap?.[excelText(value)] ?? resolveExcelSelectValue(id,value) ?? undefined;
  }
  if(el.type==='checkbox') return excelFlag(value);
  if(options.number){
    const number=excelNumber(value);
    if(number===null) return undefined;
    return String(options.integer ? Math.round(number) : number);
  }
  return String(value);
}
function buildExcelState(cells, specCells, zeroCells, sheetName=''){
  const state=makeStateObject();
  const values={...state.values, soloMode:'ON', coopMode:'OFF', coopPlayers:'', coopPassenger2Dr:'0', coopPassenger3Dr:'0'};
  const roundFieldId=excelRoundFieldId(cells,sheetName);
  const assign=(id,value,options={})=>{
    const resolved=excelStateValue(id,value,options);
    if(resolved===undefined) return 0;
    values[id]=resolved;
    return 1;
  };
  let applied=0;
  [
    ['diff',firstExcelValue(cells,['B4','N41'])],
    ['penance',firstExcelValue(cells,['B6','N42','AD8'])],
    [roundFieldId,firstExcelValue(cells,['B7','N43'])],
    ['team',cells.D5],
    ['unitGrade',cells.H4],['unitLevel',cells.H5],
    ['unitUniqueBuff',cells.H6],['basePierceBuff',cells.H8],
    ['erosionStack',cells.H10],['jewelErosionRes',cells.H11],
    ['overEnhance',cells.H14],['repairEnhance',cells.H15],['enhanceMaster',cells.H16],
    ['shareUserBuff',cells.H116],
    ['coralShard',specCells.R26],['aiurShard',specCells.R27],['xerusShard',specCells.R28],
    ['prodNova',cells.F4],['prodTeratron',cells.F5],['prodAmon',cells.F6],['prodAdun',cells.F7],
    ['prodKerrigan',cells.F8],['prodOvermind',cells.F9],['prodNarud',cells.F10],['prodArtifact',cells.F11],
    ['flowerSkill1',cells.F13],['flowerSkill2',cells.F14],['flowerSkill3',cells.F15],
    ['rAD',cells.J5],['rAS',cells.J7],['rCD',cells.J8],['rCRI',cells.J9],
    ['rModAD',specCells.C19],['rModAS',specCells.C21],['rModCD',specCells.C22],['rModCRI',specCells.C23],
    ['rReinf',cells.J11],['rAsc',cells.J12],['raceOpt',cells.J13],
    ['opt10',cells.J14],['opt15',cells.J15],['transOpt',cells.J16],
    ['addAD',getSpecAdditionalValue(specCells,'addAD')],['addAS',getSpecAdditionalValue(specCells,'addAS')],
    ['addCD',getSpecAdditionalValue(specCells,'addCD')],['addCRI',getSpecAdditionalValue(specCells,'addCRI')],
    ['addAP',getSpecAdditionalValue(specCells,'addAP')],['addTD',getSpecAdditionalValue(specCells,'addTD')],
    ['addUA',getSpecAdditionalValue(specCells,'addUA')]
  ].forEach(([id,value])=>{ applied+=assign(id,value); });
  if(cells.D4!==undefined && cells.D4!==null && cells.D4!==''){
    values.pbless=normalizePowerBlessRawValue(cells.D4);
    applied++;
  }
  applied+=assign('sp',normalizedExcelTotalSpValue(cells),{number:true,integer:true});
  applied+=assign('xp',specCells.R20,{number:true,integer:true});
  applied+=assign('bxp',specCells.R21,{number:true,integer:true});
  applied+=assign('rp',cells.B16,{number:true,integer:true});
  applied+=assign('soul',cells.B19,{number:true,integer:true});
  applied+=assign('aprRuneNormal',specCells.N52);
  applied+=assign('aprRunePlus',specCells.O52);
  applied+=assign('sepRuneNormal',specCells.N53);
  applied+=assign('sepRunePlus',specCells.O53);
  applied+=assign('dailyCouponBuff',specCells.R24);
  applied+=assign('titleTdBonus',specCells.S17,{valueMap:EXCEL_TITLE_BONUS_MAP});
  [
    ['traitLimitAD',cells.F25],['traitLimitAS',cells.F26],['traitLimitCRI',cells.F27],['traitLimitCD',cells.F28],
    ['traitLimitMC',cells.F29],['traitLimitDR',cells.F30],['traitLimitTD',cells.F31],['traitLimitUA',cells.F32],
    ['traitLimitMultiTarget',cells.F33],['traitLimitInfinite',cells.F34]
  ].forEach(([id,value])=>{ applied+=assign(id,value); });
  const enchantCode=getSpecEnchantCode(specCells);
  values.enchantCode=enchantCode;
  ENCHANT_INPUT_IDS.forEach((id,index)=>{ values[id]=enchantCode[index]||'0'; });
  applied+=ENCHANT_INPUT_IDS.length + 1;
  applyRuneChoiceState(values,cells);
  applied+=2;
  const inv={...state.inv};
  TRAITS.filter(t=>t[0]>=42&&t[0]<=138).forEach(([row])=>{
    const value=excelNumber(cells[`H${row}`]);
    if(value===null) return;
    inv[row]=Math.max(0,Math.min(TMAX[row]||999,Math.round(value)));
    applied++;
  });
  values.spBankApply=excelSpBankApplyValue(cells);
  syncSpBankPresetState(values, inv);
  if(hasExcelCellValue(cells,'H89')) applied++;
  inv[116]=1;
  const zeroScore=zeroScoreStateFromExcel(zeroCells) || state.zeroScore;
  if(zeroScore?.rows?.length) applied+=zeroScore.rows.reduce((sum,row)=>sum+(row.type==='penance'?5:(row.type==='towerCombo'?4:2)),0);
  return {state:makeStorageEnvelope({...state,values,inv,zeroScore}),applied};
}

function readFileAsText(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.addEventListener('load',()=>resolve(String(reader.result||'')),{once:true});
    reader.addEventListener('error',()=>reject(new Error('파일을 읽지 못했습니다.')),{once:true});
    reader.readAsText(file,'utf-8');
  });
}
function isCompareNumericValueId(id){
  return EXCEL_NUMERIC_INPUT_IDS.has(id);
}
function compareSavedValueDisplay(value,id){
  if(TRAIT_LIMIT_INPUT_IDS.has(id)) return traitLimitDisplayText(value);
  if(id==='spBankApply') return spBankApplyDisplayValue(value);
  if(isCompareNumericValueId(id)) return formatCompareNumber(value);
  return compareDisplayText(value,id);
}
function buildSavedValueCompareRows(changeState,currentState,options={}){
  const onlyDiffs=options.onlyDiffs!==false;
  const ordered=userStateElementIds();
  const skipped=new Set(['excelCompareFile','excelCompareSheet','enchantCode','runeChoiceType','runeChoiceValue',...ENCHANT_INPUT_IDS]);
  const ids=[...new Set([...ordered,'dpsTableMinDps',...Object.keys(currentState.values||{}),...Object.keys(changeState.values||{})])]
    .filter(id=>id && !skipped.has(id) && isUserStateValueId(id));
  const rows=[];
  const runeRow=buildRuneChoiceCompareRow('룬정보', changeState.values||{}, currentState.values||{});
  if(!onlyDiffs || runeRow.status!=='same') rows.push(runeRow);
  ids.forEach(id=>{
    const meta=COMPARE_VALUE_META[id] || {kind:'입력값',name:id};
    const numeric=isCompareNumericValueId(id);
    const changeValue=compareSavedValueDisplay(changeState.values?.[id],id);
    const currentValue=compareSavedValueDisplay(currentState.values?.[id],id);
    rows.push(numeric ? buildCompareNumberRow(meta.kind,meta.name,changeValue,currentValue) : buildCompareTextRow(meta.kind,meta.name,changeValue,currentValue,{id}));
  });
  return onlyDiffs ? rows.filter(row=>row.status!=='same') : rows;
}
function buildSavedTraitCompareRows(changeState,currentState){
  const currentInv=currentState?.inv || INV;
  return TRAITS.filter(t=>t[0]>=42&&t[0]<=138).map(t=>{
    const row=t[0], changeValue=Number(changeState.inv?.[row]||0), currentValue=Number(currentInv?.[row]||0);
    return buildCompareNumberRow('특성 보드',t[1],changeValue,currentValue,0.0001);
  }).filter(row=>row.status!=='same');
}
function snapshotComparisonState(changeState,currentState){
  const restoreState=currentState || makeStateObject();
  applyStateObject(changeState);
  try{
    return {state:makeStateObject(),stats:computeStatsRaw()};
  }finally{
    applyStateObject(restoreState);
  }
}
function buildStateStatRows(changeStats,currentStats){
  return EXCEL_COMPARE_STATS.map(([,name,,,getDisplay])=>{
    const changeDisplay=excelCompareRound(getDisplay(changeStats),6);
    const currentDisplay=excelCompareRound(getDisplay(currentStats),6);
    const displayCompare=compareNumber(changeDisplay,currentDisplay);
    return {kind:'데미지 보드',name,current:formatCompareNumber(currentDisplay),change:formatCompareNumber(changeDisplay),
      difference:formatCompareDiff(displayCompare.diff),status:displayCompare.status,diffClass:compareNumberDiffClass(displayCompare.diff)};
  });
}
function buildJsonComparison(changeState,options={}){
  const liveState=makeStateObject();
  const baseState=options.baseState ? normalizeSavedState(options.baseState) : liveState;
  const currentSnapshot=options.baseState ? snapshotComparisonState(baseState,liveState) : {state:liveState,stats:computeStatsRaw()};
  const currentState={...currentSnapshot.state,fileName:options.baseFileName || currentSnapshot.state.fileName,sheetName:options.baseSheetName || currentSnapshot.state.sheetName};
  const currentStats=currentSnapshot.stats;
  const changeSnapshot=snapshotComparisonState(changeState,liveState);
  const effectiveChangeState={...changeSnapshot.state,fileName:changeState.fileName || changeSnapshot.state.fileName,sheetName:changeState.sheetName || changeSnapshot.state.sheetName};
  const changeStats=changeSnapshot.stats;
  const dpsCompare=compareNumber(changeStats.M19,currentStats.M19);
  const dpsRow=buildCompareNumberRow('DPS','웹 기준 DPS',changeStats.M19,currentStats.M19);
  const inputRows=buildSavedValueCompareRows(effectiveChangeState,currentState,{onlyDiffs:false});
  const enchantRows=buildEnchantCompareRows(enchantCompareCodeFromValues(effectiveChangeState.values),enchantCompareCodeFromValues(currentState.values));
  const statRows=buildStateStatRows(changeStats,currentStats);
  const traitRows=buildSavedTraitCompareRows(effectiveChangeState,currentState);
  const zeroRows=buildSavedZeroScoreCompareRows(effectiveChangeState.zeroScore,currentState.zeroScore,{onlyDiffs:true});
  const inputDiffs=inputRows.filter(r=>r.status!=='same' && r.kind!=='룬효과 버프').length + enchantRows.filter(r=>r.status!=='same').length;
  const buffDiffs=inputRows.filter(r=>r.status!=='same' && r.kind==='룬효과 버프').length;
  return {
    fileName:options.fileName || effectiveChangeState.fileName || '저장파일',
    sheetName:options.sheetName || effectiveChangeState.sheetName || '저장파일',
    sourceType:options.sourceType || 'json',
    summary:{
      dps:{change:changeStats.M19,current:currentStats.M19,diff:dpsCompare.diff,status:dpsCompare.status},
      statDiffs:statRows.filter(r=>r.status!=='same').length,
      inputDiffs,
      traitDiffs:traitRows.length,
      buffDiffs,
      zeroDiffs:zeroRows.length
    },
    rows:[dpsRow,...inputRows,...enchantRows,...statRows,...zeroRows,...traitRows]
  };
}
function renderJsonComparison(changeState,options={}){
  if(options.useSelectedBase){
    const basePreset=selectedBaseTraitPreset();
    if(!basePreset) throw new Error('기준 프리셋을 선택하세요.');
    const baseState=normalizeSavedState(basePreset.state);
    if(!baseState) throw new Error('기준 프리셋 데이터가 올바르지 않습니다.');
    return renderExcelComparison(buildJsonComparison(changeState,{
      baseState,
      sourceType:'json',
      baseFileName:(compareState.baseTraitPresetBundle || {}).fileName || '기준 프리셋',
      baseSheetName:basePreset.name
    }));
  }
  renderExcelComparison(buildJsonComparison(changeState));
}
function applySelectedComparison(){
  if(compareState.sourceType==='json') return applySelectedJsonBackup();
  if(compareState.sourceType==='traitPreset') return applySelectedTraitPreset();
  return applySelectedExcelSheet();
}
function applySelectedJsonBackup(){
  if(!compareState.backupState || compareState.applied) return;
  const previousState=makeStateObject();
  try{
    applyStateObject(compareState.backupState);
    const saved=saveState({silent:true});
    if(saved===false) throw new Error('변경값은 적용했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.');
    compareState.restoreState=previousState;
    compareState.applied=true;
    renderJsonComparison(compareState.backupState);
    updateCompareActionButtons();
    notifyStorageAction('현재 입력값에 적용 완료','ok',{statusAction:'load'});
  }catch(e){
    try{ applyStateObject(previousState); }catch(rollbackError){ logAppError('[backup apply rollback failed]', rollbackError); }
    compareState.restoreState=null;
    compareState.applied=false;
    logAppError('[backup apply failed]',e);
    showToast(e?.message||String(e),'err');
    updateCompareActionButtons();
  }
}
function applySelectedExcelSheet(){
  if(!compareState.workbook || compareState.applied) return;
  const sheetName=selectedExcelSheetName();
  if(!sheetName){ showToast('선택한 시트를 찾을 수 없습니다.','err'); return; }
  const previousState=makeStateObject();
  try{
    const cells=compareState.workbook.getCells(sheetName);
    validateExcelCompareSheet(cells,sheetName);
    const specCells=compareState.workbook.getCells('스펙');
    const zeroCells=getZeroScoreSheetCells(compareState.workbook);
    const additionalInfo=inspectSpecAdditionalStructure(specCells);
    if(!additionalInfo.valid) throw new Error(additionalInfo.message);
    const imported=buildExcelState(cells,specCells,zeroCells,sheetName);
    compareState.selectedSheetName=sheetName;
    applyStateObject(imported.state);
    const saved=saveState({silent:true});
    if(saved===false) throw new Error('변경값은 적용했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.');
    compareState.selectedSheetName=sheetName;
    compareState.restoreState=previousState;
    compareState.applied=true;
    hydrateCompareControls();
    compareSelectedExcelSheet({preserveRestore:true});
    updateCompareActionButtons();
    notifyStorageAction(`변경값 ${imported.applied}개 적용 완료`,'ok',{statusAction:'import'});
  }catch(e){
    try{ applyStateObject(previousState); }catch(rollbackError){ logAppError('[Excel apply rollback failed]', rollbackError); }
    compareState.restoreState=null;
    compareState.applied=false;
    logAppError('[Excel apply failed]',e);
    showToast(e?.message||String(e),'err');
    updateCompareActionButtons();
  }
}
function buildExcelComparisonForSelectedBase(cells,specCells,zeroCells,fileName,sheetName){
  const basePreset=selectedBaseTraitPreset();
  if(!basePreset) throw new Error('기준 프리셋을 선택하세요.');
  const baseState=normalizeSavedState(basePreset.state);
  if(!baseState) throw new Error('기준 프리셋 데이터가 올바르지 않습니다.');
  const liveState=makeStateObject();
  applyStateObject(baseState);
  try{
    return buildExcelComparison(cells,specCells,zeroCells,fileName,sheetName);
  }finally{
    applyStateObject(liveState);
  }
}
function compareSelectedExcelSheet(options={}){
  if(!compareState.workbook) return;
  hydrateCompareControls();
  const sheetName=selectedExcelSheetName();
  if(!sheetName) return;
  compareState.lastResult=null;
  if(!options.preserveRestore) clearCompareRestoreState();
  try{
    const cells=compareState.workbook.getCells(sheetName);
    const specCells=compareState.workbook.getCells('스펙');
    const zeroCells=getZeroScoreSheetCells(compareState.workbook);
    const additionalInfo=inspectSpecAdditionalStructure(specCells);
    if(!additionalInfo.valid){
      setCompareError(additionalInfo.message, {keepVersionMarkup:true});
      return;
    }
    compareState.sourceType='excel';
    compareState.selectedSheetName=sheetName;
    renderExcelComparison(buildExcelComparisonForSelectedBase(cells,specCells,zeroCells,compareState.workbook.fileName,sheetName));
    updateCompareActionButtons();
  }catch(e){
    logAppError('[Excel compare failed]',e);
    setCompareError(e?.message||String(e));
  }
}
function isTraitPresetCompareBundle(parsed){
  return !!(parsed && typeof parsed==='object' && isTraitPresetFileType(parsed.type) && Array.isArray(parsed.presets));
}
function isCurrentTraitPresetBundlePayload(parsed){
  if(!isTraitPresetCompareBundle(parsed)) return false;
  if(+parsed.fileVersion!==TRAIT_PRESET_FILE_VERSION || +parsed.schemaVersion!==TRAIT_PRESET_SCHEMA_VERSION) return false;
  return parsed.presets.every(item=>{
    if(!item || typeof item!=='object' || hasOwn(item,'savedState') || hasOwn(item,'data')) return false;
    if(!item.state || typeof item.state!=='object') return false;
    if((+item.schemaVersion || 0)<TRAIT_PRESET_SCHEMA_VERSION || (+item.state.schemaVersion || 0)<TRAIT_PRESET_SCHEMA_VERSION) return false;
    return hasTraitPresetTowerFloorField(item.state);
  });
}
function isUnsupportedOldSavedStatePayload(parsed){
  if(!parsed || typeof parsed!=='object' || Array.isArray(parsed)) return false;
  if(isTraitPresetCompareBundle(parsed)) return false;
  const hasSavedShape=hasOwn(parsed,'values') || hasOwn(parsed,'inv') || hasOwn(parsed,'zeroScore') || hasOwn(parsed,'computed') || hasOwn(parsed,'storageVersion') || hasOwn(parsed,'savedAt');
  if(!hasSavedShape) return false;
  if(hasOwn(parsed,'computed')) return true;
  const version=String(parsed.storageVersion || '').trim();
  if(!version && (hasOwn(parsed,'values') || hasOwn(parsed,'inv'))) return true;
  if(version && version!==STORAGE_VERSION) return true;
  const schema=+parsed.schemaVersion || 0;
  if(schema && schema<TRAIT_PRESET_SCHEMA_VERSION) return true;
  return false;
}
function isUnsupportedOldTraitPresetPayload(parsed){
  if(!parsed || typeof parsed!=='object') return false;
  if(Array.isArray(parsed)) return true;
  if(parsed.type && !isTraitPresetFileType(parsed.type)) return true;
  if(hasOwn(parsed,'presets') && (!isCurrentTraitPresetBundlePayload(parsed))) return true;
  if(isUnsupportedOldSavedStatePayload(parsed)) return true;
  if(hasOwn(parsed,'savedState') || hasOwn(parsed,'data')) return true;
  if(hasOwn(parsed,'state') && (hasOwn(parsed,'id') || hasOwn(parsed,'name') || hasOwn(parsed,'schemaVersion'))) return true;
  return false;
}
async function readCompareJsonSource(file){
  const raw=await readFileAsText(file);
  const parsed=safeJsonParse(raw);
  if(!parsed) throw new Error('저장파일 형식이 아닙니다.');
  if(isUnsupportedOldTraitPresetPayload(parsed)) throw new Error(TRAIT_PRESET_UNSUPPORTED_OLD_MESSAGE);
  if(isTraitPresetCompareBundle(parsed)){
    const store=normalizeTraitPresetStore(parsed);
    if(!store.presets.length) throw new Error(parsed.presets.length ? TRAIT_PRESET_UNSUPPORTED_OLD_MESSAGE : '비교할 특성 프리셋이 없습니다.');
    return {sourceType:'traitPreset',traitPresetBundle:{fileName:file.name,defaultPresetId:store.defaultPresetId,presets:store.presets}};
  }
  const state=normalizeSavedState(parsed);
  if(!state) throw new Error('계산기 저장값 형식이 아닙니다.');
  return {sourceType:'json',backupState:{...state,fileName:file.name}};
}
async function handleBaseCompareFile(file){
  try{
    compareState.baseFileRejected=false;
    if(isExcelPresetImportFile(file)){
      throw new Error('기준 파일은 특성 프리셋 파일만 사용할 수 있습니다. 엑셀 파일은 비교 파일에서 불러오세요.');
    }
    const source=await readCompareJsonSource(file);
    if(source.sourceType!=='traitPreset'){
      throw new Error('기준 파일은 특성 프리셋 파일만 사용할 수 있습니다. 저장값 파일은 비교 파일에서 불러오세요.');
    }
    compareState.baseTraitPresetBundle=source.traitPresetBundle;
    const presets=compareState.baseTraitPresetBundle.presets || [];
    const preferred=presets.find(preset=>preset.id===compareState.baseTraitPresetBundle.defaultPresetId) || presets[0];
    compareState.baseTraitPresetId=preferred?.id || '';
    compareState.baseFileRejected=false;
    compareState.applied=false;
    hydrateCompareControls();
    if(compareState.sourceType==='traitPreset' && compareState.traitPresetBundle) compareSelectedTraitPreset();
    else updateCompareActionButtons();
    showToast(`기준 파일 로드 완료: ${file?.name || '기준 파일'}`,'ok');
  }catch(e){
    logAppError('[compare base file failed]',e);
    if(isUnsupportedOldTraitPresetError(e)) showUnsupportedOldTraitPresetToast();
    rejectCompareBaseFile(e?.message||String(e));
  }
}
async function handleExcelCompareFile(file){
  const basePreset=selectedBaseTraitPreset();
  const body=$('excelCompareBody');
  if(!basePreset){
    clearCompareTargetSelection();
    hydrateCompareControls();
    if(body) body.innerHTML='<div class="excel-compare-error">기준 파일을 먼저 불러오세요.</div>';
    updateCompareActionButtons();
    return;
  }
  const preservedBaseBundle=compareState.baseTraitPresetBundle;
  const preservedBaseId=compareState.baseTraitPresetId;
  resetCompareState();
  compareState.baseTraitPresetBundle=preservedBaseBundle;
  compareState.baseTraitPresetId=preservedBaseId;
  compareState.baseFileRejected=false;
  hydrateCompareControls();
  if(body) body.innerHTML='<div class="excel-compare-empty">파일을 분석하고 있습니다.</div>';
  try{
    const name=String(file?.name||'').toLowerCase();
    const type=String(file?.type||'').toLowerCase();
    if(name.endsWith('.json') || name.endsWith('.txt') || type.includes('json') || type.startsWith('text/')){
      const jsonSource=await readCompareJsonSource(file);
      compareState.sourceType=jsonSource.sourceType;
      compareState.workbook=null;
      compareState.backupState=jsonSource.backupState || null;
      compareState.traitPresetBundle=jsonSource.traitPresetBundle || null;
      if(jsonSource.sourceType==='traitPreset'){
        const bundle=jsonSource.traitPresetBundle;
        const preferred=(bundle.presets || []).find(preset=>preset.id===bundle.defaultPresetId) || (bundle.presets || [])[0];
        compareState.selectedSheetName=preferred?.id || '';
        hydrateCompareControls();
        compareSelectedTraitPreset();
      }else{
        compareState.selectedSheetName='savedFile';
        hydrateCompareControls();
        renderJsonComparison(compareState.backupState,{useSelectedBase:true});
      }
      updateCompareActionButtons();
      return;
    }
    compareState.workbook=await readExcelWorkbook(file);
    compareState.backupState=null;
    compareState.traitPresetBundle=null;
    compareState.sourceType='excel';
    if(!compareState.workbook.sheets?.length) throw new Error('엑셀 시트를 찾을 수 없습니다.');
    const preferred=compareState.workbook.sheets.some(sheet=>sheet.name==='고행')?'고행':compareState.workbook.sheets[0].name;
    compareState.selectedSheetName=preferred;
    hydrateCompareControls();
    compareSelectedExcelSheet();
  }catch(e){
    resetCompareState();
    hydrateCompareControls();
    logAppError('[compare file failed]',e);
    if(isUnsupportedOldTraitPresetError(e)) showUnsupportedOldTraitPresetToast();
    const apply=$('excelCompareApplyBtn');
    const reset=$('excelCompareResetBtn');
    if(apply) apply.disabled=true;
    if(reset) reset.disabled=true;
    if(body) body.innerHTML=`<div class="excel-compare-error">${escapeCompareHtml(e?.message||String(e))}</div>`;
    updateCompareActionButtons();
  }
}
function bindExcelCompareEvents(){
  document.addEventListener('click',e=>{
    const filterTarget=e.target.closest('[data-excel-compare-filter]');
    if(filterTarget){
      compareState.activeFilter=filterTarget.getAttribute('data-excel-compare-filter') || 'all';
      if(compareState.lastResult) renderExcelComparison(compareState.lastResult,{preserveFilter:true});
      return;
    }
    if(e.target.closest('[data-excel-compare-apply]')) applySelectedComparison();
    if(e.target.closest('[data-excel-compare-restore]')) restoreComparisonCurrentState();
    if(e.target.closest('[data-excel-compare-reset]')) requestConfirmAction('excelCompareReset','한 번 더 누르면 프리셋 분석 초기화', resetExcelComparison);
  });
  document.addEventListener('change',e=>{
    if(e.target.id==='excelCompareBaseFile'&&e.target.files?.[0]){
      const selectedFile=e.target.files[0];
      handleBaseCompareFile(selectedFile).finally(()=>{ e.target.value=''; });
    }
    if(e.target.id==='excelCompareFile'&&e.target.files?.[0]){
      const selectedFile=e.target.files[0];
      handleExcelCompareFile(selectedFile).finally(()=>{ e.target.value=''; });
    }
    if(e.target.id==='excelCompareSheet' && compareState.sourceType==='excel'){ compareState.selectedSheetName=e.target.value; compareSelectedExcelSheet(); }
    if(e.target.id==='excelCompareBasePreset'){
      compareState.baseTraitPresetId=e.target.value;
      if(compareState.sourceType==='traitPreset') compareSelectedTraitPreset();
      else if(compareState.sourceType==='excel') compareSelectedExcelSheet();
      else if(compareState.sourceType==='json' && compareState.backupState){
        try{ renderJsonComparison(compareState.backupState,{useSelectedBase:true}); updateCompareActionButtons(); }
        catch(err){
          logAppError('[JSON compare base change failed]',err);
          const body=$('excelCompareBody');
          if(body) body.innerHTML=`<div class="excel-compare-error">${escapeCompareHtml(err?.message||String(err))}</div>`;
          updateCompareActionButtons();
        }
      }else updateCompareActionButtons();
    }
    if(e.target.id==='excelCompareSheet' && compareState.sourceType==='traitPreset'){ compareState.selectedSheetName=e.target.value; compareSelectedTraitPreset(); }
  });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeCompareInfo(); });
}
/* ===== 07. 특성 보드 / 투자 조작 / 최적화 ===== */
const INFINITE_TRAIT_TIER='무한∞';
const TIERS=['루키','비기너','아마추어','프로','엑스퍼트','마스터','디바인','더원1','더원2',INFINITE_TRAIT_TIER,'EP특성','RP특성','심연특성'];
function updateTraits(){
  const body=$('traitBody');
  if(!body) return;
  body.innerHTML=TIERS.map(tier=>{
    const rows=TRAITS.filter(t=>t[2]===tier && t[0]!==116).map(t=>{
      const [row,name,,type,rate]=t;
      const n=INV[row]||0, mx=TMAX[row]||999;
      const isMax=n>=mx;
      const cost=nextCost(row);
      const rStr=traitEffectText(row,type,rate);
      return `<div class="tr">
        <div><div class="tr-name">${name}</div><div class="tr-type">${rStr}${isMax?' · 최대 투자됨':` · 다음비용 ${fullNumber(cost)}`}</div></div>
        <div class="tr-ctrl">
          <button type="button" class="ui-step-btn" data-action="traitAdjust" data-row="${row}" data-delta="-1" ${n<=0?'disabled':''}>−</button>
          <div class="trait-value-pair">
            <input class="tv-input" type="text" inputmode="numeric" value="${n}" data-row="${row}">
            <span class="trait-max-sep">/</span>
            <span class="trait-max-val">${mx}</span>
          </div>
          <button type="button" class="ui-step-btn" data-action="traitAdjust" data-row="${row}" data-delta="1" ${isMax?'disabled':''}>+</button>
          <button type="button" class="ui-action-btn trait-master-btn" data-action="traitMax" data-row="${row}" ${isMax?'disabled':''}>MAX</button>
        </div>
      </div>`;
    }).join('');
    return `<div class="trait-group"><h4><span class="trait-title">${tier}</span><span class="trait-tools"><button type="button" class="ui-action-btn mini-btn master" data-action="masterTier" data-tier="${tier}">구간 마스터</button><button type="button" class="ui-action-btn mini-btn reset danger" data-action="resetTier" data-tier="${tier}">초기화</button></span></h4>${rows}</div>`;
  }).join('');
}
let traitKeyNavGuardUntil=0;
function commitTraitInput(el){
  const row=+(el && el.dataset ? el.dataset.row : NaN);
  if(!Number.isFinite(row)) return;
  setInv(row,+el.value);
}
function getTraitScrollHost(){
  return qs('.col-right') || document.scrollingElement || document.documentElement;
}
function getNextTraitInputRow(el,dir){
  const inputs=Array.from(qsa('.tv-input[data-row]'));
  const idx=inputs.indexOf(el);
  const nextIndex=Math.max(0,Math.min(inputs.length-1,idx+dir));
  return +(inputs[nextIndex]?.dataset?.row ?? el?.dataset?.row);
}
function focusTraitInputRow(row,hostScroll,pageX,pageY){
  const host=getTraitScrollHost();
  const focusNow=()=>{
    const next=qs(`.tv-input[data-row="${row}"]`);
    if(!next) return false;
    try{next.focus({preventScroll:true});}catch(_e){next.focus();}
    try{next.select();}catch(_e){}
    if(host) host.scrollTop=hostScroll;
    try{window.scrollTo(pageX,pageY);}catch(_e){}
    return true;
  };
  setTimeout(()=>{ if(!focusNow()) requestAnimationFrame(focusNow); },0);
}
function bindTraitInputEvents(){
  document.addEventListener('change', e=>{
    if(Date.now()<traitKeyNavGuardUntil) return;
    const input=e.target.closest && e.target.closest('.tv-input[data-row]');
    if(input) commitTraitInput(input);
  }, true);
  document.addEventListener('keydown', e=>{
    const input=e.target.closest && e.target.closest('.tv-input[data-row]');
    if(!input || (e.key!=='Tab' && e.key!=='Enter')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const dir=e.shiftKey?-1:1;
    const nextRow=getNextTraitInputRow(input,dir);
    const host=getTraitScrollHost();
    const hostScroll=host ? host.scrollTop : 0;
    const pageX=window.scrollX, pageY=window.scrollY;
    traitKeyNavGuardUntil=Date.now()+250;
    commitTraitInput(input);
    focusTraitInputRow(nextRow,hostScroll,pageX,pageY);
  }, true);
  document.addEventListener('click', e=>{
    const input=e.target.closest && e.target.closest('.tv-input[data-row]');
    if(input) input.select();
  }, true);
}
function adjustTraitBy(row,d,step=1){
  row=+row;
  d=+d;
  step=Math.max(1,Math.round(+step||1));
  if(row===116 || !Number.isFinite(row) || !Number.isFinite(d) || d===0) return false;
  const before=INV[row]||0;
  let applied=0;
  if(d>0){
    for(let i=0;i<step;i++){
      if(addOneIfAffordable(row)) applied++;
      else break;
    }
    if(applied===0) try{showToast('보유 재화가 부족합니다','err');}catch(e){}
  }else{
    const next=Math.max(0,before-step);
    applied=before-next;
    INV[row]=next;
  }
  if(applied>0){
    recalc();
    scheduleAutoSaveToast();
    return true;
  }
  return false;
}
let traitHoldTimer=null;
let traitHoldRepeatTimer=null;
let traitHoldSuppressClickUntil=0;
function stopTraitAdjustHold(){
  if(traitHoldTimer) clearTimeout(traitHoldTimer);
  if(traitHoldRepeatTimer) clearTimeout(traitHoldRepeatTimer);
  traitHoldTimer=null;
  traitHoldRepeatTimer=null;
  traitHoldSuppressClickUntil=Date.now()+260;
}
function startTraitAdjustHold(trigger,e){
  if(!trigger || trigger.disabled) return;
  const row=+trigger.dataset.row;
  const delta=+trigger.dataset.delta;
  if(!Number.isFinite(row) || !Number.isFinite(delta) || delta===0) return;
  if(e){ e.preventDefault(); e.stopPropagation(); }
  stopTraitAdjustHold();
  let count=0;
  const every=Math.max(1,DPS_CONFIG.ui.traitHoldAccelEvery||7);
  const maxStep=Math.max(1,DPS_CONFIG.ui.traitHoldMaxStep||50);
  const apply=()=>{
    const step=Math.min(maxStep, 1+Math.floor(count/every));
    count++;
    adjustTraitBy(row,delta,step);
  };
  apply();
  traitHoldTimer=setTimeout(function repeat(){
    apply();
    traitHoldRepeatTimer=setTimeout(repeat, DPS_CONFIG.ui.traitHoldRepeatMs||55);
  }, DPS_CONFIG.ui.traitHoldInitialDelay||320);
}
function bindTraitHoldEvents(){
  document.addEventListener('pointerdown', e=>{
    const btn=e.target.closest('[data-action="traitAdjust"]');
    if(!btn) return;
    startTraitAdjustHold(btn,e);
  }, true);
  ['pointerup','pointercancel','pointerleave','blur'].forEach(type=>{
    window.addEventListener(type, stopTraitAdjustHold, true);
  });
}
function setInv(row,val){
  if(row===116) return;
  if(isNaN(val)||val<0) val=0;
  const wanted=Math.round(val);
  const applied=setRowToAffordableValue(row,wanted);
  if(applied<wanted) try{showToast('보유 재화 한도까지만 입력되었습니다','err');}catch(e){}
  recalc();
  scheduleAutoSaveToast();
}
function adjMax(row){
  try{
    if(row===116) return false;
    const before=INV[row]||0;
    fillRowToBudget(row);
    recalc();
    scheduleAutoSaveToast();
    try{showToast((INV[row]||0)>before?'가능한 만큼 MAX 적용':'보유 재화가 부족합니다',(INV[row]||0)>before?'ok':'err');}catch(e){}
    return (INV[row]||0)>before;
  }catch(e){
    logAppError('[adjMax failed]', e);
    return false;
  }
}
function masterTier(tier){
  TRAITS.forEach(t=>{
    const row=t[0];
    if(t[2]!==tier || row===116 || AUTO_INVEST_EXCLUDED_ROWS.has(row)) return;
    fillRowToBudget(row);
  });
  recalc();
  scheduleAutoSaveToast();
  try{showToast('보유 재화 한도 내 구간 마스터 완료','ok');}catch(e){}
}
function resetTier(tier){
  TRAITS.forEach(t=>{
    const row=t[0];
    if(t[2]!==tier || row===116) return;
    INV[row]=0;
  });
  if(116 in INV) INV[116]=1;
  recalc();
  scheduleAutoSaveToast();
  try{showToast('구간 초기화 완료','ok');}catch(e){}
}
const UTILITY_OPT_TYPES=new Set(['유틸','경험치','AP','RA']);
const UTILITY_OPT_TIERS=['루키','비기너','아마추어','프로','엑스퍼트','마스터','디바인','더원1','더원2'];
function isUtilityOptimizationTrait(t, maxTierIndex=null){
  if(!Array.isArray(t)) return false;
  const row=t[0], tier=t[2], type=t[3];
  if(row===116) return false;
  const tierIdx=UTILITY_OPT_TIERS.indexOf(tier);
  if(tierIdx<0) return false;
  if(maxTierIndex!==null && tierIdx>maxTierIndex) return false;
  return UTILITY_OPT_TYPES.has(type);
}
function utilityRowsOrNotify(){
  const idx=UTILITY_OPT_TIERS.indexOf(vs('utilOptTier')||'루키');
  const maxTierIndex=idx>=0 ? idx : UTILITY_OPT_TIERS.indexOf('더원2');
  const rows=TRAITS.filter(t=>isUtilityOptimizationTrait(t, maxTierIndex)).map(t=>t[0]);
  if(rows.length) return rows;
  try{showToast('선택 범위에 유틸 특성이 없습니다','err');}catch(e){}
  return null;
}
function optimizeUtility(){
  const rows=utilityRowsOrNotify();
  if(!rows) return false;
  let changed=0;
  rows.forEach(row=>{
    const before=INV[row]||0;
    fillRowToBudget(row);
    if((INV[row]||0)!==before) changed++;
  });
  recalc();
  scheduleAutoSaveToast();
  try{showToast(changed ? '유틸 마스터 완료' : '보유 재화가 부족하거나 이미 최대입니다', changed ? 'ok' : 'err');}catch(e){}
  return changed>0;
}
function isSpAttackClearTrait(t){
  if(!Array.isArray(t)) return false;
  const row=+t[0];
  return Number.isFinite(row) && row!==116 && SP_ROWS.has(row) && !isUtilitySpTrait(t);
}
function isSpUtilityClearTrait(t){
  if(!Array.isArray(t)) return false;
  const row=+t[0];
  return Number.isFinite(row) && row!==116 && SP_ROWS.has(row) && isUtilitySpTrait(t);
}
function clearTraitInvestmentsBy(predicate){
  let changed=0;
  TRAITS.forEach(t=>{
    if(!predicate(t)) return;
    const row=+t[0];
    if((INV[row]||0)>0){
      INV[row]=0;
      changed++;
    }
  });
  if(116 in INV) INV[116]=1;
  recalc();
  scheduleAutoSaveToast();
  return changed;
}
function clearUtility(){
  const changed=clearTraitInvestmentsBy(isSpUtilityClearTrait);
  try{showToast(changed ? '유틸 초기화 완료 · 사용한 SP (유틸) 0' : '초기화할 유틸 특성이 없습니다', changed ? 'ok' : 'err');}catch(e){}
  return changed>0;
}
function renderTraitEfficiencyItem(cand,idx){
  return `
    <div class="trait-efficiency-grid trait-efficiency-row">
      <span class="trait-eff-name">${escapeCompareHtml(cand.label)}</span>
      <span>${escapeCompareHtml(traitRecommendationInvestText(cand))}</span>
      <span>${escapeCompareHtml(traitRecommendationGainText(cand.gain))}</span>
      <span>${escapeCompareHtml(traitRecommendationCostText(cand))}</span>
      <button type="button" class="ui-action-btn mini-btn master trait-eff-apply" data-action="applyTraitEfficiencyTop" data-rank="${idx}">적용</button>
    </div>`;
}
function renderTraitEfficiencyTop5(){
  const body=$('traitEfficiencyTop5Body');
  if(!body) return;
  let list=[];
  try{ list=buildTraitEfficiencyRecommendations(5); }catch(e){
    logAppError('[trait top5 failed]', e);
    body.innerHTML='<div class="trait-efficiency-empty">추천 항목 계산 실패</div>';
    return;
  }
  body.innerHTML=list.length
    ? list.map(renderTraitEfficiencyItem).join('')
    : '<div class="trait-efficiency-empty">현재 적용 가능한 추천 항목이 없습니다.</div>';
}
function applyTraitEfficiencyTop(trigger){
  const rank=Math.max(0, Math.round(+trigger?.dataset?.rank||0));
  const cand=buildTraitEfficiencyRecommendations(5)[rank];
  if(!cand){
    try{showToast('적용할 추천 항목이 없습니다','err');}catch(e){}
    return false;
  }
  const currentCost=cand.changes.reduce((sum,[row,add])=>sum+traitOptimizationDeltaCost(row,add),0);
  const rem=traitOptimizationRemaining(cand.kind);
  if(!Number.isFinite(currentCost) || currentCost<=0 || currentCost>rem){
    try{showToast('보유 재화가 부족합니다','err');}catch(e){}
    renderTraitEfficiencyTop5();
    return false;
  }
  for(const [row,add] of cand.changes){
    INV[row]=Math.min(TMAX[row]||999,(INV[row]||0)+add);
  }
  recalc();
  scheduleAutoSaveToast();
  try{showToast(`${cand.label} ${traitRecommendationInvestText(cand)} 적용 완료`,'ok');}catch(e){}
  return true;
}
function clearAll(){
  try{
    const changed=clearTraitInvestmentsBy(isSpAttackClearTrait);
    try{showToast(changed ? '특성 초기화 완료 · 사용한 SP (공격) 0' : '초기화할 공격 특성이 없습니다', changed ? 'ok' : 'err');}catch(e){}
    return changed>0;
  }catch(e){
    logAppError('[clearAll failed]', e);
    alertApp('특성 초기화 실패: '+(e && e.message ? e.message : e));
    return false;
  }
}
/* ===== 08. 저장 / 복구 / 특성 프리셋 ===== */
const STORAGE_VERSION=DPS_CONFIG.storage.version;
const STORAGE_SCOPE=DPS_CONFIG.storage.scope;
const STORAGE_KEY=DPS_CONFIG.storage.key;
const CLIENT_KEY=DPS_CONFIG.storage.clientKey;
const TRAIT_PRESET_STORAGE_KEY=DPS_CONFIG.storage.traitPresetKey || 'gbd_dps_calculator:trait_presets';
const TRAIT_PRESET_FILE_TYPE='sld_dps_trait_presets';
const TRAIT_PRESET_FILE_VERSION=2;
const TRAIT_PRESET_SCHEMA_VERSION=2;
const TRAIT_PRESET_NAME_PLACEHOLDER='예시) 더파300라버스';
const TRAIT_PRESET_UNSUPPORTED_OLD_MESSAGE='구버전 프리셋은 더 이상 지원하지 않습니다.\n호환 엑셀버전: 5.4392\n엑셀 파일을 다시 불러온 뒤, 새 특성 프리셋을 생성해 주세요.';
const TRAIT_PRESET_SYNC_EXCLUDED_VALUE_IDS=new Set([
  'diff','penance','round','challengeTowerFloor','soloMode','coopMode','coopPlayers','coopPassenger2Dr','coopPassenger3Dr','team','pbless','spBankApply',
  'overEnhance','repairEnhance','enhanceMaster',
  'dailyCouponBuff','shareUserBuff','unitUniqueBuff','basePierceBuff',
  'prodArtifact','prodNova','prodTeratron','prodAmon','prodAdun','prodKerrigan','prodOvermind','prodNarud',
  'flowerSkill1','flowerSkill2','flowerSkill3',
  'optTier','utilOptTier',
  'traitLimitAD','traitLimitAS','traitLimitCRI','traitLimitCD','traitLimitMC','traitLimitDR','traitLimitTD','traitLimitUA','traitLimitMultiTarget','traitLimitInfinite'
]);
function isTraitPresetFileType(type){
  return type===TRAIT_PRESET_FILE_TYPE;
}
function isUnsupportedOldTraitPresetError(error){
  return String(error?.message || error || '')===TRAIT_PRESET_UNSUPPORTED_OLD_MESSAGE;
}
function showUnsupportedOldTraitPresetToast(){
  try{ cancelScheduledAutoSaveToast(); }catch(e){}
  try{ showToast(TRAIT_PRESET_UNSUPPORTED_OLD_MESSAGE,'err',10000); }catch(e){}
}
const INTERNAL_VALUE_IDS=new Set([
  'dt','ep','rAP','rTD','rUA','rHarmony'
]);
const IGNORED_SAVED_VALUE_IDS=[...(DPS_CONFIG.state.skipElementIds || []),...INTERNAL_VALUE_IDS];
const NORMALIZED_MONEY_VALUE_IDS=new Set(['sp','xp','bxp','rp','soul']);
const SHARD_VALUE_IDS=new Set(['coralShard','aiurShard','xerusShard']);
function normalizeMoneyStorageValue(value, id=''){
  const digits=normalizedUnsignedDigits(value, '');
  if(id==='xp') return digits && !/^0+$/.test(digits) ? digits : '1';
  return digits || '0';
}
function normalizeShardStorageValue(value){
  return clampedIntegerString(value, 0, 9999, 0);
}
function normalizeShardStorageValues(values){
  if(!values || typeof values!=='object') return values;
  SHARD_VALUE_IDS.forEach(id=>{ values[id]=normalizeShardStorageValue(values[id]); });
  return values;
}
function normalizeMoneyStorageValues(values){
  if(!values || typeof values!=='object') return values;
  NORMALIZED_MONEY_VALUE_IDS.forEach(id=>{
    if(hasOwn(values,id)) values[id]=normalizeMoneyStorageValue(values[id], id);
  });
  return values;
}
function normalizedSpBankInvestmentLevel(inv){
  if(!inv || typeof inv!=='object') return 0;
  return Math.max(0, Math.min(TMAX[SP_BANK_TRAIT_ROW]||999, Math.round(+(inv[SP_BANK_TRAIT_ROW]||0))));
}
function resolveSpBankApplyFromValues(values){
  return hasOwn(values,'spBankApply') ? normalizeSpBankApplyValue(values.spBankApply) : '미반영';
}
function syncSpBankPresetState(values, inv){
  if(!values || typeof values!=='object' || !inv || typeof inv!=='object') return;
  const bankLevel=normalizedSpBankInvestmentLevel(inv);
  const applyState=resolveSpBankApplyFromValues(values);
  inv[SP_BANK_TRAIT_ROW]=bankLevel;
  values.spBankApply=applyState;
}
function isUserStateValueId(id){ return USER_STATE_VALUE_IDS.has(id); }
function userStateElementIds(){ return storageElementIds().filter(isUserStateValueId); }
const storageState={isLoading:false,suppressSave:false,factoryState:null,saveFailCount:0,hasSavedState:false};
function isStorageLocked(){return storageState.isLoading || storageState.suppressSave;}
function storageElementIds(){
  const skip=new Set(DPS_CONFIG.state.skipElementIds || []);
  return Array.from(qsa('input[id],select[id],textarea[id]'))
    .filter(el=>el.id && el.type!=='file' && !skip.has(el.id))
    .map(el=>el.id);
}
function elementDefaultValue(el){
  if(el.tagName==='SELECT'){
    const selected=Array.from(el.options || []).find(opt=>opt.defaultSelected) || el.options?.[0];
    return selected ? selected.value : '';
  }
  if(el.type==='checkbox') return !!el.defaultChecked;
  if(el.type==='radio') return el.defaultChecked ? el.value : undefined;
  return el.defaultValue ?? '';
}
function readElementValue(el){
  if(el.type==='checkbox') return !!el.checked;
  if(el.type==='radio') return el.checked ? el.value : undefined;
  if(EROSION_CONTROL_IDS.has(el.id)) return erosionStoredValue(el.id);
  if(el.id==='round') return targetRoundStoredValue();
  if(el.id==='challengeTowerFloor') return challengeTowerFloorStoredValue();
  if(el.id==='penance') return penanceStoredValue();
  if(SHARD_VALUE_IDS.has(el.id)) return normalizeShardStorageValue(el.value);
  if(NORMALIZED_MONEY_VALUE_IDS.has(el.id)) return normalizeMoneyStorageValue(el.value, el.id);
  return el.value;
}
function writeElementValue(el, value){
  if(el.id==='spBankApply') value=normalizeSpBankApplyValue(value);
  if(el.id==='penance'){
    const stored=normalizePenanceValue(value, SOLO_PENANCE_MAX);
    el.dataset.penanceValue=stored;
    value=stored;
  }
  if(el.id==='round'){
    const stored=normalizedRoundString(value);
    el.dataset.roundValue=stored;
    value=stored;
  }
  if(el.id==='challengeTowerFloor'){
    const stored=normalizedTowerFloorString(value);
    el.dataset.challengeTowerFloorValue=stored;
    value=stored;
  }
  if(DECIMAL_DISPLAY_INPUT_IDS.has(el.id)) value=normalizeDecimalDisplayValue(value);
  if(EROSION_CONTROL_IDS.has(el.id)){
    const stored=normalizeErosionControlValue(el.id, value);
    el.dataset.erosionValue=stored;
    value=stored;
  }
  if(el.id==='pbless'){
    value=normalizePowerBlessRawValue(value);
    syncPowerBlessOptions();
  }
  if(SHARD_VALUE_IDS.has(el.id)) value=normalizeShardStorageValue(value);
  if(NORMALIZED_MONEY_VALUE_IDS.has(el.id)) value=normalizeMoneyStorageValue(value, el.id);
  if(el.type==='checkbox') el.checked=!!value;
  else el.value=value;
  if(TRAIT_LIMIT_INPUT_IDS.has(el.id)) syncTraitLimitInputDisplay(el);
}
function getClientId(){
  try{
    let id=localStorage.getItem(CLIENT_KEY);
    if(id) return id;
    const seed=(typeof crypto!=='undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now()+'_'+Math.random().toString(16).slice(2);
    id='dps_'+seed;
    localStorage.setItem(CLIENT_KEY,id);
    return id;
  }catch(e){ return 'dps_memory_only'; }
}
function makePublicDefaultState(){
  const values={};
  userStateElementIds().forEach(id=>{
    const el=$(id);
    if(el) values[id]=elementDefaultValue(el);
  });
  Object.assign(values,{optTier:values.optTier ?? '루키', utilOptTier:values.utilOptTier ?? '루키'});
  Object.entries(TRAIT_LIMIT_DEFAULTS).forEach(([id,value])=>{ if(!hasOwn(values,id)) values[id]=value; });
  values.dpsTableMinDps='1.0';
  normalizeShardStorageValues(values);
  const inv={};
  TRAITS.forEach(t=>{ inv[t[0]]=0; });
  inv[116]=1;
  return makeStorageEnvelope({
    values,
    inv,
    zeroScore:collectZeroScoreState(),
    savedAt:0,
    scope:'public_default'
  });
}
function captureFactoryState(){ storageState.factoryState=makePublicDefaultState(); }
function makeStorageEnvelope(partial){
  return {
    schemaVersion:+partial.schemaVersion || TRAIT_PRESET_SCHEMA_VERSION,
    values:partial.values || {},
    inv:partial.inv || {},
    zeroScore:partial.zeroScore ? normalizeZeroScoreState(partial.zeroScore) : undefined,
    savedAt:+partial.savedAt || Date.now(),
    storageVersion:partial.storageVersion || STORAGE_VERSION,
    scope:partial.scope || STORAGE_SCOPE,
    ui:partial.ui && typeof partial.ui==='object' ? partial.ui : {fontScale:DPS_CONFIG.ui.fontScaleDefault},
    clientId:partial.clientId || getClientId()
  };
}
function makeStateObject(){
  normalizeXpInput();
  const values={};
  userStateElementIds().forEach(id=>{
    const el=$(id);
    if(!el) return;
    let value=readElementValue(el);
    if(value!==undefined){
      if(id==='round' || id==='skillRound') value=normalizedRoundString(value);
      if(id==='challengeTowerFloor') value=normalizedTowerFloorString(value);
      if(TRAIT_LIMIT_INPUT_IDS.has(id)) value=normalizeTraitLimitStorageValue(value);
      if(id==='spBankApply') value=normalizeSpBankApplyValue(value);
      values[id]=value;
    }
  });
  values.optTier=vs('optTier') || values.optTier || '루키';
  values.utilOptTier=vs('utilOptTier') || values.utilOptTier || '루키';
  Object.entries(TRAIT_LIMIT_DEFAULTS).forEach(([id,value])=>{ values[id]=vs(id) || values[id] || value; });
  if(hasOwn(values,'spBankApply')) values.spBankApply=normalizeSpBankApplyValue(values.spBankApply);
  TRAIT_LIMIT_INPUT_IDS.forEach(id=>{ values[id]=normalizeTraitLimitStorageValue(values[id] ?? TRAIT_LIMIT_DEFAULTS[id] ?? '0'); });
  const normalizedRune=normalizeRuneChoiceValues(values);
  values.runeChoiceType=normalizedRune.runeChoiceType;
  values.runeChoiceValue=normalizedRune.runeChoiceValue;
  values.dpsTableMinDps=normalizeDpsTableMinDpsValue(dpsTableMinDps);
  normalizeShardStorageValues(values);
  normalizeMoneyStorageValues(values);
  const inv={...INV};
  syncSpBankPresetState(values, inv);
  return makeStorageEnvelope({
    values,
    inv,
    zeroScore:collectZeroScoreState(),
    savedAt:Date.now(),
    ui:{fontScale:getFontScale()}
  });
}
function savedTowerFloorValue(values={}){
  return normalizedTowerFloorString(values.challengeTowerFloor ?? TOWER_FLOOR_INPUT_MIN);
}
function sanitizeSavedValues(values){
  if(!values || typeof values!=='object') values={};
  const out=normalizeRuneChoiceValues(values);
  IGNORED_SAVED_VALUE_IDS.forEach(id=>delete out[id]);
  Object.keys(out).forEach(id=>{ if(!isUserStateValueId(id)) delete out[id]; });
  out.challengeTowerFloor=savedTowerFloorValue(out);
  if(hasOwn(out,'overEnhance')) out.overEnhance=String(normalizeOverEnhanceValue(out.overEnhance));
  if(out.raceOpt==='해당 없음') out.raceOpt='없음';
  const coopMode=normalizeOnOffValue(out.coopMode,'OFF')==='ON';
  out.soloMode=coopMode ? 'OFF' : 'ON';
  out.coopMode=coopMode ? 'ON' : 'OFF';
  if(hasOwn(out,'coopPlayers')) out.coopPlayers=normalizeCoopPlayersValue(out.coopPlayers || out.team);
  out.coopPassenger2Dr=normalizeCoopPassengerDefenseReduceValue(out.coopPassenger2Dr);
  out.coopPassenger3Dr=normalizeCoopPassengerDefenseReduceValue(out.coopPassenger3Dr);
  if(hasOwn(out,'team')) out.team=normalizeTeamCountValue(out.team);
  if(hasOwn(out,'penance')) out.penance=normalizePenanceValue(out.penance, SOLO_PENANCE_MAX);
  ['round','skillRound'].forEach(id=>{
    if(hasOwn(out,id)) out[id]=normalizedRoundString(out[id]);
  });
  if(hasOwn(out,'challengeTowerFloor')) out.challengeTowerFloor=normalizedTowerFloorString(out.challengeTowerFloor);
  if(hasOwn(out,'pbless')) out.pbless=normalizePowerBlessRawValue(out.pbless);
  DECIMAL_DISPLAY_INPUT_IDS.forEach(id=>{
    if(hasOwn(out,id)) out[id]=normalizeDecimalDisplayValue(out[id]);
  });
  if(hasOwn(out,'spBankApply')) out.spBankApply=normalizeSpBankApplyValue(out.spBankApply);
  delete out['spBank'+'BudgetMode'];
  if(hasOwn(out,'runeChoiceType') || hasOwn(out,'runeChoiceValue')){
    const normalizedRune=normalizeRuneChoiceValues(out);
    out.runeChoiceType=normalizedRune.runeChoiceType;
    out.runeChoiceValue=normalizedRune.runeChoiceValue;
  }
  TRAIT_LIMIT_INPUT_IDS.forEach(id=>{
    if(!hasOwn(out,id)) return;
    out[id]=normalizeTraitLimitStorageValue(out[id]);
  });
  normalizeShardStorageValues(out);
  normalizeMoneyStorageValues(out);
  return out;
}

function normalizeSavedState(data){
  if(!data || typeof data!=='object') return null;
  const rawValues=(data.values && typeof data.values==='object') ? data.values : {};
  const hasRawValues=Object.keys(rawValues).some(id=>isUserStateValueId(id) || id==='dpsTableMinDps');
  const values=sanitizeSavedValues(rawValues);
  const inv=(data.inv && typeof data.inv==='object') ? {...data.inv} : {};
  syncSpBankPresetState(values, inv);
  const hasZeroScore=!!(data.zeroScore && Array.isArray(data.zeroScore.rows));
  if(!hasRawValues && !Object.keys(inv).length && !hasZeroScore) return null;
  return makeStorageEnvelope({
    values,
    inv,
    zeroScore:data.zeroScore,
    savedAt:data.savedAt,
    schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,
    storageVersion:data.storageVersion,
    scope:data.scope,
    ui:data.ui,
    clientId:data.clientId
  });
}

function mergeSharedValuesIntoPresetState(presetState, sharedState){
  const preset=normalizeSavedState(presetState);
  if(!preset) return null;
  const shared=normalizeSavedState(sharedState);
  if(!shared) return preset;
  return makeStorageEnvelope({
    values:{...preset.values, ...shared.values},
    inv:preset.inv,
    zeroScore:shared.zeroScore || preset.zeroScore,
    savedAt:preset.savedAt,
    storageVersion:preset.storageVersion,
    scope:preset.scope,
    ui:preset.ui,
    clientId:preset.clientId
  });
}
function buildTraitPresetApplyState(preset, options={}){
  const state=normalizeSavedState(preset?.state);
  if(!state) return null;
  if(options.preserveSharedValues===true) return mergeSharedValuesIntoPresetState(state, makeStateObject());
  return state;
}
let autoSaveToastTimer=0;
function cancelScheduledAutoSaveToast(){
  if(autoSaveToastTimer){
    clearTimeout(autoSaveToastTimer);
    autoSaveToastTimer=0;
  }
}
function scheduleAutoSaveToast(){
  if(isStorageLocked()) return;
  cancelScheduledAutoSaveToast();
  autoSaveToastTimer=setTimeout(()=>{
    autoSaveToastTimer=0;
    const saved=saveState({silent:true});
    if(saved!==false) notifyStorageAction('저장됨','ok',{statusAction:'save'});
  }, 550);
}
function applyStateObject(data){
  if(!data) return;
  storageState.isLoading=true;
  try{
    if(data.ui && Number.isFinite(+data.ui.fontScale)) applyFontScale(+data.ui.fontScale, {silent:true});
    dpsTableMinDps=normalizeDpsTableMinDpsValue(data.values?.dpsTableMinDps ?? data.dpsTableMinDps ?? '1.0') || '1.0';
    syncDpsMinDpsInputs();
    const sanitizedValues=sanitizeSavedValues(data.values || {});
    if(hasOwn(sanitizedValues,'enhanceMaster')){
      const masterEl=$('enhanceMaster');
      if(masterEl) writeElementValue(masterEl, sanitizedValues.enhanceMaster);
    }
    Object.entries(sanitizedValues).forEach(([id,val])=>{
      if(id==='dpsTableMinDps') return;
      const el=$(id);
      if(el) writeElementValue(el,val);
    });
    syncBattleMode();
    syncDifficultyTargetControls();
    syncPowerBlessOptions();
    normalizeXpInput();
    syncAutoEP();
    Object.keys(INV).forEach(k=>{ INV[k]=0; });
    Object.entries(data.inv || {}).forEach(([row,val])=>{
      const r=+row;
      if(!Number.isFinite(r) || !(r in INV)) return;
      INV[r]=Math.max(0, Math.min(TMAX[r]||999, Math.round(+val||0)));
    });
    INV[116]=1;
    enforceBudgets();
    if(hasOwn(sanitizedValues,'runeChoiceType') || hasOwn(sanitizedValues,'runeChoiceValue')) syncRuneChoice();
    else hydrateRuneChoiceFromHidden();
    applyZeroScoreState(data.zeroScore ? normalizeZeroScoreState(data.zeroScore) : data.zeroScore);
    syncEnchantCodeFromInputs(true);
    syncControlDisplays();
    recalc();
  }finally{ storageState.isLoading=false; }
}
function resetToFactoryState(){
  if(!storageState.factoryState) captureFactoryState();
  applyStateObject(storageState.factoryState);
}
function safeJsonParse(raw){
  const text=String(raw??'').replace(/^﻿/,'').trim();
  const attempts=[text];
  const first=text.indexOf('{'), last=text.lastIndexOf('}');
  if(first>=0 && last>first) attempts.push(text.slice(first,last+1));
  for(const item of attempts){
    try{return JSON.parse(item);}catch(e){}
  }
  return null;
}
const TRAIT_PRESET_STATUS_STORAGE_KEY=DPS_CONFIG.storage.traitPresetStatusKey || 'gbd_dps_calculator:trait_preset_status';
function emptyTraitPresetStatusData(){
  return {updatedPresetIds:[],lastAction:'latest',selectedTraitPresetId:''};
}
function normalizeTraitPresetStatusData(data){
  const base=emptyTraitPresetStatusData();
  if(!data || typeof data!=='object' || Array.isArray(data)) return base;
  const updatedPresetIds=Array.isArray(data.updatedPresetIds)
    ? [...new Set(data.updatedPresetIds.map(id=>String(id || '').trim()).filter(Boolean))]
    : [];
  const lastAction=String(data.lastAction || base.lastAction || 'latest');
  const selectedTraitPresetId=String(data.selectedTraitPresetId || '').trim();
  return {updatedPresetIds,lastAction,selectedTraitPresetId};
}
function loadTraitPresetStatusData(){
  try{
    const raw=localStorage.getItem(TRAIT_PRESET_STATUS_STORAGE_KEY);
    if(!raw) return emptyTraitPresetStatusData();
    const parsed=safeJsonParse(raw);
    if(parsed && typeof parsed==='object') return normalizeTraitPresetStatusData(parsed);
  }catch(e){}
  return emptyTraitPresetStatusData();
}
function saveTraitPresetStatusData(data){
  const normalized=normalizeTraitPresetStatusData(data);
  try{ localStorage.setItem(TRAIT_PRESET_STATUS_STORAGE_KEY, JSON.stringify(normalized)); }catch(e){}
  return normalized;
}
function currentTraitPresetStatusData(partial={}){
  const status=normalizeTraitPresetStatusData({...loadTraitPresetStatusData(), ...partial});
  const store=loadTraitPresetStore();
  const validIds=new Set(store.presets.map(preset=>preset.id));
  status.updatedPresetIds=status.updatedPresetIds.filter(id=>validIds.has(id));
  if(status.selectedTraitPresetId && !validIds.has(status.selectedTraitPresetId)) status.selectedTraitPresetId='';
  return {status,store};
}
function traitPresetExportButtonText(status, store){
  return store.presets.length && status.updatedPresetIds.length>0 ? '내보내기 필요' : '내보내기';
}
function renderTraitPresetStatus(status, store){
  const needsExport=store.presets.length>0 && status.updatedPresetIds.length>0;
  const label=traitPresetExportButtonText(status, store);
  qsa('[data-action="exportTraitPresets"]').forEach(btn=>{
    btn.textContent=label;
    btn.classList.toggle('is-export-needed', needsExport);
    btn.setAttribute('aria-label', needsExport ? '특성 프리셋 내보내기 필요' : '특성 프리셋 내보내기');
  });
}
function updateTraitPresetStatus(partial={}, options={}){
  const {status,store}=currentTraitPresetStatusData(partial);
  renderTraitPresetStatus(status,store);
  if(options.persist) saveTraitPresetStatusData(status);
}
function restoreTraitPresetStatus(){
  updateTraitPresetStatus({}, {persist:true});
}
function markTraitPresetUpdated(ids, action='update'){
  const previous=loadTraitPresetStatusData();
  const updatedPresetIds=[...new Set([...previous.updatedPresetIds, ...ids.map(id=>String(id || '').trim()).filter(Boolean)])];
  updateTraitPresetStatus({updatedPresetIds,lastAction:action},{persist:true});
}
function clearTraitPresetUpdatedStatus(action='latest'){
  updateTraitPresetStatus({updatedPresetIds:[],lastAction:action},{persist:true});
}
function notifyStorageAction(message, type='ok', options={}){
  if(type==='ok' && options.statusAction && !options.skipHeaderStatus){
    updateTraitPresetStatus({lastAction:options.statusAction},{persist:true});
  }
  try{ showToast(message, type); }catch(e){}
}
function notifyTraitPresetExportComplete(){
  clearTraitPresetUpdatedStatus('export');
  refreshTraitPresetControls(selectedTraitPresetId());
  try{ showToast('특성 프리셋 내보내기 완료', 'ok'); }catch(e){}
}
function saveState(options={}){
  const silent=!!options.silent;
  if(isStorageLocked()) return false;
  try{
    const state=makeStateObject();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageState.hasSavedState=true;
    storageState.saveFailCount=0;
    if(!silent) notifyStorageAction('입력값 저장 완료','ok',{statusAction:'save'});
    return true;
  }catch(e){
    logAppError(e);
    storageState.saveFailCount++;
    const msg='저장 실패 · 브라우저 저장공간/권한 확인';
    if(!silent || storageState.saveFailCount===1) notifyStorageAction(msg,'err');
    if(!silent) alertAppError('저장 실패: ', e);
    return false;
  }
}
function loadState(){
  if(!storageState.factoryState) captureFactoryState();
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    const saved=raw ? normalizeSavedState(safeJsonParse(raw)) : null;
    storageState.hasSavedState=!!saved;
    if(!saved){
      resetToFactoryState();
      return;
    }
    applyStateObject(saved);
  }catch(e){
    storageState.hasSavedState=false;
    logAppWarn('loadState failed', e);
    resetToFactoryState();
  }
}
/* ===== 09. 특성 프리셋 저장 / 로드 / 비교 ===== */
function normalizeTraitPresetName(value){
  return String(value ?? '').replace(/\s+/g,' ').trim().slice(0,40);
}
function stateFileBaseName(fileName=''){
  return normalizeTraitPresetName(String(fileName || '').replace(/\.[^.]+$/,'')) || '가져온 프리셋';
}
function makeTraitPresetId(){
  const seed=(typeof crypto!=='undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `trait_${String(seed).replace(/[^0-9A-Za-z_-]/g,'')}`;
}
function appendUniqueTraitPreset(presets, seen, preset){
  if(!preset) return;
  if(seen.has(preset.id)) preset.id=makeTraitPresetId();
  seen.add(preset.id);
  presets.push(preset);
}
function emptyTraitPresetStore(){
  return {type:TRAIT_PRESET_FILE_TYPE,fileVersion:TRAIT_PRESET_FILE_VERSION,schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,storageVersion:STORAGE_VERSION,updatedAt:Date.now(),defaultPresetId:'',presets:[]};
}
function hasTraitPresetTowerFloorField(state){
  const values=(state && typeof state==='object' && state.values && typeof state.values==='object') ? state.values : {};
  return hasOwn(values,'challengeTowerFloor');
}
function dispatchTraitPresetStoreChanged(detail={}){
  try{ window.dispatchEvent(new CustomEvent('dps:traitPresetStoreChanged',{detail})); }catch(e){}
}
function markPresetStateCurrentVersion(state){
  const normalized=normalizeSavedState(state);
  if(!normalized) return null;
  return makeStorageEnvelope({...normalized,schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,storageVersion:STORAGE_VERSION,savedAt:+normalized.savedAt || Date.now()});
}
function cleanTraitPresetForExport(preset,index=0){
  const normalized=normalizeTraitPresetItem(preset,index,{forceCurrentVersion:true,clearExportRefresh:true});
  if(!normalized) return null;
  const state=markPresetStateCurrentVersion(normalized.state);
  if(!state) return null;
  return {
    id:normalized.id,
    name:normalized.name,
    schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,
    createdAt:normalized.createdAt,
    updatedAt:normalized.updatedAt || Date.now(),
    meta:traitPresetMetaFromSavedState(state),
    state
  };
}
function finalizeTraitPresetStoreForExport(store){
  const source=(store && typeof store==='object') ? store : emptyTraitPresetStore();
  const seen=new Set();
  const presets=[];
  (Array.isArray(source.presets) ? source.presets : []).forEach((item,index)=>{
    const preset=cleanTraitPresetForExport(item,index);
    appendUniqueTraitPreset(presets, seen, preset);
  });
  return {
    type:TRAIT_PRESET_FILE_TYPE,
    fileVersion:TRAIT_PRESET_FILE_VERSION,
    schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,
    storageVersion:STORAGE_VERSION,
    updatedAt:Date.now(),
    defaultPresetId:'',
    presets
  };
}
function traitPresetMetaFromValues(values={}){
  const coopMode=normalizeOnOffValue(values.coopMode,'OFF')==='ON';
  const players=normalizeCoopPlayersValue(values.coopPlayers || values.team || COOP_PLAYERS_DEFAULT);
  const tower=isTowerDifficulty(values.diff);
  const towerFloor=normalizedTowerFloorString(values.challengeTowerFloor || TOWER_FLOOR_INPUT_MIN);
  return {
    diff:String(values.diff || ''),
    penance:String(values.penance || '0'),
    round:String(values.round || '1'),
    challengeTowerFloor:towerFloor,
    mode:tower ? `${towerFloor}층` : (coopMode ? `협동${players}인` : '개인')
  };
}
function traitPresetMetaFromState(){
  return traitPresetMetaFromValues({diff:vs('diff'),penance:vs('penance'),round:targetRoundStoredValue(),challengeTowerFloor:challengeTowerFloorStoredValue(),coopMode:vs('coopMode'),coopPlayers:vs('coopPlayers'),team:vs('team')});
}
function traitPresetMetaFromSavedState(state){
  const values=(state && typeof state==='object' && state.values && typeof state.values==='object') ? state.values : {};
  return traitPresetMetaFromValues(values);
}

function normalizeTraitPresetItem(item,index=0,context={}){
  if(!item || typeof item!=='object') return null;
  if(!item.state || typeof item.state!=='object') return null;
  const name=normalizeTraitPresetName(item.name || `가져온 프리셋 ${index+1}`);
  if(!name) return null;
  const sourceFileVersion=+context.fileVersion || TRAIT_PRESET_FILE_VERSION;
  const sourceSchemaVersion=+context.schemaVersion || TRAIT_PRESET_SCHEMA_VERSION;
  const itemSchemaVersion=+item.schemaVersion || 0;
  const stateSchemaVersion=+item.state.schemaVersion || 0;
  if(sourceFileVersion<TRAIT_PRESET_FILE_VERSION || sourceSchemaVersion<TRAIT_PRESET_SCHEMA_VERSION || itemSchemaVersion<TRAIT_PRESET_SCHEMA_VERSION || stateSchemaVersion<TRAIT_PRESET_SCHEMA_VERSION) return null;
  if(!hasTraitPresetTowerFloorField(item.state)) return null;
  const state=normalizeSavedState(item.state);
  if(!state) return null;
  const now=Date.now();
  return {
    id:String(item.id || makeTraitPresetId()),
    name,
    schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,
    createdAt:+item.createdAt || +item.savedAt || now,
    updatedAt:+item.updatedAt || +state.savedAt || now,
    meta:{...((item.meta && typeof item.meta==='object') ? item.meta : {}), ...traitPresetMetaFromSavedState(state)},
    state
  };
}
function normalizeTraitPresetStore(data){
  const empty=emptyTraitPresetStore();
  if(!data || typeof data!=='object' || Array.isArray(data) || !Array.isArray(data.presets)) return empty;
  if(data.type && !isTraitPresetFileType(data.type)) return empty;
  const sourceFileVersion=+data.fileVersion || 0;
  const sourceSchemaVersion=+data.schemaVersion || 0;
  if(sourceFileVersion && sourceFileVersion<TRAIT_PRESET_FILE_VERSION) return empty;
  if(sourceSchemaVersion && sourceSchemaVersion<TRAIT_PRESET_SCHEMA_VERSION) return empty;
  const seen=new Set();
  const presets=[];
  const itemContext={fileVersion:sourceFileVersion || TRAIT_PRESET_FILE_VERSION,schemaVersion:sourceSchemaVersion || TRAIT_PRESET_SCHEMA_VERSION,storageVersion:data.storageVersion || ''};
  data.presets.forEach((item,index)=>{
    const preset=normalizeTraitPresetItem(item,index,itemContext);
    appendUniqueTraitPreset(presets, seen, preset);
  });
  return {...empty,updatedAt:+data.updatedAt || Date.now(),defaultPresetId:'',presets};
}
function loadTraitPresetStore(){
  try{
    const raw=localStorage.getItem(TRAIT_PRESET_STORAGE_KEY);
    return normalizeTraitPresetStore(raw ? safeJsonParse(raw) : null);
  }catch(e){
    logAppWarn('loadTraitPresetStore failed', e);
    return emptyTraitPresetStore();
  }
}
function saveTraitPresetStore(store,options={}){
  const normalized=normalizeTraitPresetStore({...store,updatedAt:Date.now()});
  localStorage.setItem(TRAIT_PRESET_STORAGE_KEY, JSON.stringify(normalized));
  if(options.dispatch!==false) dispatchTraitPresetStoreChanged({source:options.source || 'save'});
  return normalized;
}
function selectedTraitPresetId(){
  return $('traitPresetSelect')?.value || '';
}
function resetTraitPresetNameInput(){
  const input=$('traitPresetName');
  if(!input) return;
  input.value='';
  input.placeholder=TRAIT_PRESET_NAME_PLACEHOLDER;
}
function resolveTraitPresetSelection(store,requestedId=''){
  const presets=Array.isArray(store?.presets) ? store.presets : [];
  if(!presets.length) return '';
  const requested=String(requestedId || '');
  if(requested && presets.some(preset=>preset.id===requested)) return requested;
  return firstTraitPresetSelectId(store);
}
function rememberTraitPresetSelection(id){
  updateTraitPresetStatus({selectedTraitPresetId:String(id || '').trim()},{persist:true});
}

const TRAIT_PRESET_SELECT_GROUPS=[
  {key:'solo', label:'개인'},
  {key:'coop', label:'협동'},
  {key:'tower', label:'도전의탑'}
];
const TRAIT_PRESET_DIFFICULTY_ORDER=[...DPS_CONFIG.dpsTable.difficulties, TOWER_DIFFICULTY_NAME];
function traitPresetValueSource(preset){
  const values=(preset && preset.state && preset.state.values && typeof preset.state.values==='object') ? preset.state.values : {};
  const meta=(preset && preset.meta && typeof preset.meta==='object') ? preset.meta : {};
  return {values,meta};
}
function traitPresetNumberValue(value, fallback=0){
  const normalized=String(value ?? '').replace(/[^0-9.+-]/g,'');
  const number=Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}
function traitPresetDifficultyOrder(diffName){
  const index=TRAIT_PRESET_DIFFICULTY_ORDER.indexOf(difficultyName(diffName));
  return index>=0 ? index : TRAIT_PRESET_DIFFICULTY_ORDER.length;
}
function traitPresetSortInfo(preset){
  const {values,meta}=traitPresetValueSource(preset);
  const diff=values.diff || meta.diff || '';
  const towerFloor=traitPresetNumberValue(values.challengeTowerFloor || meta.challengeTowerFloor, TOWER_FLOOR_INPUT_MIN);
  return {
    diffOrder:traitPresetDifficultyOrder(diff),
    penance:traitPresetNumberValue(values.penance || meta.penance, 0),
    round:traitPresetNumberValue(values.round || meta.round, 1),
    towerFloor,
    name:normalizeTraitPresetName(preset?.name || ''),
    createdAt:+preset?.createdAt || 0,
    updatedAt:+preset?.updatedAt || 0
  };
}
function compareTraitPresetForSelect(a,b,categoryKey){
  const left=traitPresetSortInfo(a);
  const right=traitPresetSortInfo(b);
  const numberKeys=categoryKey==='tower'
    ? ['towerFloor','diffOrder','penance','round','createdAt','updatedAt']
    : ['diffOrder','penance','round','towerFloor','createdAt','updatedAt'];
  for(const key of numberKeys){
    if(left[key]!==right[key]) return left[key]-right[key];
  }
  return left.name.localeCompare(right.name,'ko');
}
function traitPresetCategoryKey(preset){
  const {values,meta}=traitPresetValueSource(preset);
  if(isTowerDifficulty(values.diff || meta.diff)) return 'tower';
  if(normalizeOnOffValue(values.coopMode,'OFF')==='ON') return 'coop';
  return 'solo';
}
function sortedTraitPresetBuckets(store){
  const buckets=TRAIT_PRESET_SELECT_GROUPS.reduce((out,group)=>{ out[group.key]=[]; return out; },{});
  (Array.isArray(store?.presets) ? store.presets : []).forEach(preset=>{
    const key=traitPresetCategoryKey(preset);
    (buckets[key] || buckets.solo).push(preset);
  });
  TRAIT_PRESET_SELECT_GROUPS.forEach(group=>{
    buckets[group.key].sort((a,b)=>compareTraitPresetForSelect(a,b,group.key));
  });
  return buckets;
}
function firstTraitPresetSelectId(store){
  const buckets=sortedTraitPresetBuckets(store);
  for(const group of TRAIT_PRESET_SELECT_GROUPS){
    const preset=buckets[group.key]?.[0];
    if(preset?.id) return preset.id;
  }
  return '';
}
function traitPresetOptionName(preset, categoryKey){
  const {values,meta}=traitPresetValueSource(preset);
  let name=normalizeTraitPresetName(preset?.name || '');
  name=name.replace(/^(개인|솔로|협동|버스)\s*[-–—:·]\s*/,'').trim();
  if(categoryKey==='tower'){
    name=name.replace(/^(도전의\s*탑|도전의탑)\s*[-–—:·]?\s*/,'').trim();
    if(/^\d+$/.test(name)) name=`${name}층`;
    if(!name){
      const floor=normalizedTowerFloorString(values.challengeTowerFloor || meta.challengeTowerFloor || '');
      name=floor ? `${floor}층` : '';
    }
  }
  return name || normalizeTraitPresetName(preset?.name || '프리셋');
}
function traitPresetSelectLabel(preset, updatedIds, categoryKey){
  const suffix=updatedIds.has(preset.id) ? ' · 업데이트됨' : '';
  return `${traitPresetOptionName(preset, categoryKey)}${suffix}`;
}
function renderTraitPresetSelectOptions(select, store, selected, updatedIds){
  const hasPresets=Array.isArray(store?.presets) && store.presets.length>0;
  select.innerHTML='';
  const empty=document.createElement('option');
  empty.value='';
  empty.textContent=hasPresets ? '프리셋 목록' : '저장된 프리셋 없음';
  empty.disabled=true;
  empty.hidden=hasPresets;
  select.appendChild(empty);
  const buckets=sortedTraitPresetBuckets(store);
  TRAIT_PRESET_SELECT_GROUPS.forEach(group=>{
    const presets=buckets[group.key] || [];
    if(!presets.length) return;
    const optgroup=document.createElement('optgroup');
    optgroup.label=group.label;
    presets.forEach(preset=>{
      const option=document.createElement('option');
      option.value=preset.id;
      option.textContent=traitPresetSelectLabel(preset, updatedIds, group.key);
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
  });
  select.value=selected || '';
  select.disabled=!hasPresets;
}
function refreshTraitPresetControls(selectedId){
  const store=loadTraitPresetStore();
  const status=loadTraitPresetStatusData();
  const updatedIds=new Set(status.updatedPresetIds);
  const select=$('traitPresetSelect');
  const nameInput=$('traitPresetName');
  const selected=resolveTraitPresetSelection(store,selectedId || selectedTraitPresetId() || status.selectedTraitPresetId);
  if(select) renderTraitPresetSelectOptions(select, store, selected, updatedIds);
  const currentId=select?.value || '';
  const current=store.presets.find(preset=>preset.id===currentId);
  dispatchTraitPresetStoreChanged({source:'selection', selectedTraitPresetId:current?.id || ''});
  qsa('[data-action="loadTraitPreset"],[data-action="updateTraitPreset"],[data-action="renameTraitPreset"],[data-action="deleteTraitPreset"],[data-action="compareTraitPreset"]').forEach(btn=>{
    btn.disabled=!current;
  });
  qsa('[data-action="exportTraitPresets"]').forEach(btn=>{ btn.disabled=!store.presets.length; });
  renderTraitPresetStatus(status, store);
  if(nameInput) nameInput.placeholder=TRAIT_PRESET_NAME_PLACEHOLDER;
}
function saveTraitPreset(){
  const input=$('traitPresetName');
  const name=normalizeTraitPresetName(input?.value || '');
  if(!name){
    notifyStorageAction('프리셋 이름을 입력하세요.','err');
    if(input) input.focus();
    return false;
  }
  try{
    let store=loadTraitPresetStore();
    const now=Date.now();
    const state=makeStateObject();
    const index=store.presets.findIndex(preset=>preset.name===name);
    let id;
    if(index>=0){
      const prev=store.presets[index];
      id=prev.id;
      store.presets[index]={...prev,name,schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,updatedAt:now,meta:traitPresetMetaFromState(),state};
    }else{
      id=makeTraitPresetId();
      store.presets.push({id,name,schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,createdAt:now,updatedAt:now,meta:traitPresetMetaFromState(),state});
    }
    store=saveTraitPresetStore(store);
    markTraitPresetUpdated([id],'update');
    rememberTraitPresetSelection(id);
    refreshTraitPresetControls(id);
    resetTraitPresetNameInput();
    notifyStorageAction(index>=0 ? `프리셋 덮어쓰기 완료: ${name}` : `프리셋 저장 완료: ${name}`,'ok',{statusAction:'save'});
    return true;
  }catch(e){
    logAppError('[trait preset save failed]',e);
    notifyStorageAction(e?.message || '프리셋 저장 실패','err');
    return false;
  }
}
function applyTraitPresetState(preset,options={}){
  const state=buildTraitPresetApplyState(preset, options);
  if(!state) throw new Error('프리셋 데이터가 올바르지 않습니다.');
  state.ui={fontScale:getFontScale()};
  applyStateObject(state);
  if(options.persist!==false){
    const saved=saveState({silent:true});
    if(saved===false) throw new Error('프리셋은 적용했지만 브라우저 저장에 실패했습니다.');
  }
}
function loadTraitPresetById(id,options={}){
  const store=loadTraitPresetStore();
  const preset=store.presets.find(item=>item.id===id);
  if(!preset){
    if(options.notifyMissing!==false) notifyStorageAction('불러올 프리셋을 선택하세요.','err');
    return false;
  }
  try{
    applyTraitPresetState(preset,{persist:true,preserveSharedValues:options.preserveSharedValues===true,syncTraitPresetId:id});
    rememberTraitPresetSelection(id);
    refreshTraitPresetControls(id);
    if(options.notifySuccess!==false) notifyStorageAction(`프리셋 로드 완료: ${preset.name}`,'ok',{statusAction:'load'});
    return true;
  }catch(e){
    logAppError('[trait preset load failed]',e);
    notifyStorageAction(e?.message || '프리셋 로드 실패','err');
    return false;
  }
}
function loadTraitPreset(){
  return loadTraitPresetById(selectedTraitPresetId(),{preserveSharedValues:false});
}
function buildSyncedTraitPresetState(baseState, targetState, now){
  const base=normalizeSavedState(baseState);
  const target=normalizeSavedState(targetState);
  if(!base || !target) return null;
  const values={...base.values};
  TRAIT_PRESET_SYNC_EXCLUDED_VALUE_IDS.forEach(id=>{
    if(hasOwn(target.values,id)) values[id]=target.values[id];
    else delete values[id];
  });
  normalizeMoneyStorageValues(values);
  return makeStorageEnvelope({
    values,
    inv:{...target.inv},
    zeroScore:target.zeroScore,
    savedAt:now,
    storageVersion:base.storageVersion,
    scope:target.scope,
    ui:target.ui,
    clientId:target.clientId
  });
}
function stableTraitPresetValue(value){
  if(value && typeof value==='object'){
    const normalize=input=>{
      if(Array.isArray(input)) return input.map(normalize);
      if(input && typeof input==='object'){
        return Object.keys(input).sort().reduce((out,key)=>{ out[key]=normalize(input[key]); return out; },{});
      }
      return input ?? '';
    };
    return JSON.stringify(normalize(value));
  }
  return String(value ?? '');
}
function hasTraitPresetValueChanges(previous, current, options={}){
  const ids=new Set([...Object.keys(previous.values || {}), ...Object.keys(current.values || {})]);
  for(const id of ids){
    if(options.ignoreSyncExcluded && TRAIT_PRESET_SYNC_EXCLUDED_VALUE_IDS.has(id)) continue;
    if(stableTraitPresetValue(previous.values?.[id])!==stableTraitPresetValue(current.values?.[id])) return true;
  }
  return false;
}
function hasSharedTraitPresetValueChanges(previousState, currentState){
  const previous=normalizeSavedState(previousState);
  const current=normalizeSavedState(currentState);
  return !previous || !current || hasTraitPresetValueChanges(previous, current, {ignoreSyncExcluded:true});
}
function stableTraitPresetInv(inv){
  const source=(inv && typeof inv==='object') ? inv : {};
  const out={};
  Object.keys(source).sort((a,b)=>+a-+b).forEach(row=>{
    const value=Math.max(0,Math.round(+source[row] || 0));
    if(value>0) out[row]=value;
  });
  return stableTraitPresetValue(out);
}
function hasTraitPresetStateChanges(previousState, currentState){
  const previous=normalizeSavedState(previousState);
  const current=normalizeSavedState(currentState);
  if(!previous || !current) return true;
  if(hasTraitPresetValueChanges(previous, current)) return true;
  if(stableTraitPresetInv(previous.inv)!==stableTraitPresetInv(current.inv)) return true;
  if(stableTraitPresetValue(normalizeZeroScoreState(previous.zeroScore || {rows:[]}))!==stableTraitPresetValue(normalizeZeroScoreState(current.zeroScore || {rows:[]}))) return true;
  return false;
}
function updateTraitPreset(){
  const id=selectedTraitPresetId();
  let store=loadTraitPresetStore();
  const selectedIndex=store.presets.findIndex(item=>item.id===id);
  const preset=store.presets[selectedIndex];
  if(!preset){ notifyStorageAction('업데이트할 프리셋을 선택하세요.','err'); return false; }
  try{
    const now=Date.now();
    const baseState=markPresetStateCurrentVersion({...makeStateObject(),savedAt:now});
    if(!baseState) throw new Error('현재 화면값을 프리셋 상태로 저장할 수 없습니다.');
    if(!hasTraitPresetStateChanges(preset.state, baseState)){
      notifyStorageAction('프리셋 변경사항 없음','warn');
      return false;
    }
    const syncSharedValues=hasSharedTraitPresetValueChanges(preset.state, baseState);
    const updatedIds=[];
    store.presets=store.presets.map((item,index)=>{
      if(index!==selectedIndex && !syncSharedValues) return item;
      const nextState=index===selectedIndex ? baseState : buildSyncedTraitPresetState(baseState,item.state,now);
      if(!nextState) return item;
      updatedIds.push(item.id);
      return {...item,updatedAt:now,schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,meta:traitPresetMetaFromSavedState(nextState),state:nextState};
    });
    store=saveTraitPresetStore(store,{source:'updateTraitPreset'});
    localStorage.setItem(STORAGE_KEY, JSON.stringify(baseState));
    storageState.hasSavedState=true;
    markTraitPresetUpdated(updatedIds,'update');
    rememberTraitPresetSelection(id);
    refreshTraitPresetControls(id);
    notifyStorageAction(`프리셋 업데이트 완료: ${preset.name}`,'ok',{skipHeaderStatus:true});
    return true;
  }catch(e){
    logAppError('[trait preset update failed]',e);
    notifyStorageAction(e?.message || '프리셋 업데이트 실패','err');
    return false;
  }
}
function renameTraitPreset(){
  const id=selectedTraitPresetId();
  let store=loadTraitPresetStore();
  const preset=store.presets.find(item=>item.id===id);
  if(!preset){ notifyStorageAction('이름을 변경할 프리셋을 선택하세요.','err'); return false; }
  const next=normalizeTraitPresetName(prompt('새 프리셋 이름을 입력하세요.', preset.name));
  if(!next || next===preset.name) return false;
  if(store.presets.some(item=>item.id!==id && item.name===next)){
    notifyStorageAction('같은 이름의 프리셋이 이미 있습니다.','err');
    return false;
  }
  try{
    preset.name=next;
    preset.updatedAt=Date.now();
    store=saveTraitPresetStore(store);
    rememberTraitPresetSelection(id);
    refreshTraitPresetControls(id);
    notifyStorageAction(`프리셋 이름 변경 완료: ${next}`,'ok',{statusAction:'save'});
    return true;
  }catch(e){
    logAppError('[trait preset rename failed]',e);
    notifyStorageAction(e?.message || '프리셋 이름 변경 실패','err');
    return false;
  }
}
function deleteTraitPreset(){
  const id=selectedTraitPresetId();
  const store=loadTraitPresetStore();
  const preset=store.presets.find(item=>item.id===id);
  if(!preset){ notifyStorageAction('삭제할 프리셋을 선택하세요.','err'); return false; }
  return requestConfirmAction(`deleteTraitPreset:${id}`,`한 번 더 누르면 프리셋 삭제: ${preset.name}`,()=>{
    try{
      let nextStore=loadTraitPresetStore();
      nextStore.presets=nextStore.presets.filter(item=>item.id!==id);
      saveTraitPresetStore(nextStore);
      rememberTraitPresetSelection('');
      refreshTraitPresetControls();
      notifyStorageAction(`프리셋 삭제 완료: ${preset.name}`,'ok',{statusAction:'delete'});
      return true;
    }catch(e){
      logAppError('[trait preset delete failed]',e);
      notifyStorageAction(e?.message || '프리셋 삭제 실패','err');
      return false;
    }
  });
}
function resetToFirstVisitState(){
  try{
    try{
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TRAIT_PRESET_STORAGE_KEY);
      localStorage.removeItem(TRAIT_PRESET_STATUS_STORAGE_KEY);
      localStorage.removeItem(DPS_CONFIG.storage.fontKey);
    }catch(e){}
    resetToFactoryState();
    refreshTraitPresetControls('');
    clearTraitPresetUpdatedStatus('latest');
    resetTraitPresetNameInput();
    notifyStorageAction('전체 초기화 완료','ok');
    return true;
  }catch(e){
    logAppError('[full reset failed]',e);
    notifyStorageAction(e?.message || '전체 초기화 실패','err');
    return false;
  }
}
let traitPresetResetButtonTimer=0;
function resetTraitPresetResetButton(trigger){
  const btn=trigger || $('traitPresetResetAllBtn');
  if(!btn) return;
  btn.dataset.confirming='0';
  btn.textContent='전체 초기화';
}
function requestTraitPresetFullReset(trigger){
  const btn=trigger || $('traitPresetResetAllBtn');
  const delay=DPS_CONFIG.ui.confirmDelayMs || 1600;
  if(btn?.dataset.confirming==='1'){
    clearTimeout(traitPresetResetButtonTimer);
    resetTraitPresetResetButton(btn);
    return resetToFirstVisitState();
  }
  if(btn){
    btn.dataset.confirming='1';
    btn.textContent='한번 더';
    clearTimeout(traitPresetResetButtonTimer);
    traitPresetResetButtonTimer=setTimeout(()=>resetTraitPresetResetButton(btn), delay);
  }
  notifyStorageAction('한 번 더 누르면 전체 초기화','warn');
  return false;
}
function currentWebDpsVersion(){
  return String(window.DPS_BUILD_VERSION || window.APP_VERSION || STORAGE_VERSION || 'dev');
}
function makeTraitPresetFileName(customName=''){
  const cleaned=String(customName ?? '')
    .replace(/\.[Tt][Xx][Tt]$/,'')
    .replace(/[\\/:*?"<>|]/g,'_')
    .replace(/[\u0000-\u001f\u007f]/g,'')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/[. ]+$/,'')
    .slice(0,80);
  if(cleaned) return `${cleaned}.txt`;
  const now=new Date(), pad=n=>String(n).padStart(2,'0');
  const date=String(now.getFullYear()).slice(2)+pad(now.getMonth()+1)+pad(now.getDate());
  return `특성프리셋-${date}.txt`;
}
let traitPresetExportDownloadLocked=false;
function setTraitPresetExportSavingState(active){
  qsa('[data-trait-preset-export-save]').forEach(btn=>{ btn.disabled=!!active; });
}
function createTraitPresetExportModal(){
  window.DpsModal.createShell('traitPresetExportModal','trait-preset-excel-modal-shell',`
    <div class="trait-preset-excel-backdrop" data-trait-preset-export-close="1"></div>
    <section class="trait-preset-excel-modal" role="dialog" aria-modal="true" aria-labelledby="traitPresetExportTitle">
      <header class="trait-preset-excel-head">
        <h2 id="traitPresetExportTitle">특성 프리셋 내보내기</h2>
        <button type="button" class="ui-icon-btn trait-preset-excel-close" data-trait-preset-export-close="1" aria-label="특성 프리셋 내보내기 닫기">×</button>
      </header>
      <div class="trait-preset-excel-body">
        <label class="trait-preset-excel-field"><span>저장 파일명</span><input id="traitPresetExportName" type="text" maxlength="80" autocomplete="off" placeholder="파일명을 입력하세요"/></label>
        <button class="btn pri ui-action-btn trait-preset-excel-save" type="button" data-trait-preset-export-save="1">내보내기</button>
      </div>
    </section>`);
}
function openTraitPresetExportModal(){
  try{
    if(!isStorageLocked()) saveState({silent:true});
    const store=loadTraitPresetStore();
    if(!store.presets.length){ notifyStorageAction('내보낼 프리셋이 없습니다.','err'); return false; }
    const selectedPreset=store.presets.find(item=>item.id===selectedTraitPresetId()) || store.presets.find(item=>item.id===loadTraitPresetStatusData().selectedTraitPresetId);
    createTraitPresetExportModal();
    const input=$('traitPresetExportName');
    if(input) input.value=selectedPreset?.name || '';
    window.DpsModal.setOpen('traitPresetExportModal','trait-preset-excel-modal-open',true);
    setTimeout(()=>{ input?.focus(); input?.select(); },0);
    return true;
  }catch(e){
    logAppError('[trait preset export modal failed]',e);
    notifyStorageAction(e?.message || '특성 프리셋 내보내기 준비 실패','err');
    return false;
  }
}
function closeTraitPresetExportModal(){
  window.DpsModal.setOpen('traitPresetExportModal','trait-preset-excel-modal-open',false);
}
function downloadTraitPresetExport(customName=''){
  if(traitPresetExportDownloadLocked) return false;
  traitPresetExportDownloadLocked=true;
  setTraitPresetExportSavingState(true);
  try{
    if(!isStorageLocked()) saveState({silent:true});
    const store=loadTraitPresetStore();
    if(!store.presets.length){ notifyStorageAction('내보낼 프리셋이 없습니다.','err'); return false; }
    const exportStore=finalizeTraitPresetStoreForExport(store);
    saveTraitPresetStore(exportStore,{source:'export'});
    delete exportStore.webDpsVersion;
    const payload=JSON.stringify({webDpsVersion:currentWebDpsVersion(),...exportStore,type:TRAIT_PRESET_FILE_TYPE,fileVersion:TRAIT_PRESET_FILE_VERSION,exportedAt:new Date().toISOString(),defaultPresetName:''}, null, 2);
    const blob=new Blob([payload], {type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=makeTraitPresetFileName(customName);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    closeTraitPresetExportModal();
    refreshTraitPresetControls(selectedTraitPresetId());
    notifyTraitPresetExportComplete();
    return true;
  }catch(e){
    logAppError('[trait preset export failed]',e);
    notifyStorageAction(e?.message || '특성 프리셋 내보내기 실패','err');
    return false;
  }finally{
    window.setTimeout(()=>{
      traitPresetExportDownloadLocked=false;
      setTraitPresetExportSavingState(false);
    }, 300);
  }
}
function exportTraitPresets(){
  return openTraitPresetExportModal();
}
window.exportTraitPresets=exportTraitPresets;
function openTraitPresetImportPicker(){
  setTimeout(()=>{
    const input=$('traitPresetImportFile');
    if(input) input.click();
  },60);
}
function normalizeTraitPresetImportData(parsed){
  if(!parsed || typeof parsed!=='object' || Array.isArray(parsed)) throw new Error('특성 프리셋 파일 형식이 아닙니다.');
  if(!isTraitPresetFileType(parsed.type) || !Array.isArray(parsed.presets)) throw new Error(TRAIT_PRESET_UNSUPPORTED_OLD_MESSAGE);
  const sourceFileVersion=+parsed.fileVersion || 0;
  const sourceSchemaVersion=+parsed.schemaVersion || 0;
  if(sourceFileVersion<TRAIT_PRESET_FILE_VERSION || sourceSchemaVersion<TRAIT_PRESET_SCHEMA_VERSION) throw new Error(TRAIT_PRESET_UNSUPPORTED_OLD_MESSAGE);
  const importContext={fileVersion:sourceFileVersion,schemaVersion:sourceSchemaVersion,storageVersion:parsed.storageVersion || ''};
  const presets=parsed.presets.map((item,index)=>normalizeTraitPresetItem(item,index,importContext)).filter(Boolean);
  if(!presets.length) throw new Error(parsed.presets.length ? TRAIT_PRESET_UNSUPPORTED_OLD_MESSAGE : '가져올 수 있는 프리셋이 없습니다.');
  return {presets};
}
function mergeTraitPresetImport(imported){
  let store=loadTraitPresetStore();
  let added=0, replaced=0, firstImportedPresetId='';
  imported.presets.forEach((preset,index)=>{
    const existingIndex=store.presets.findIndex(item=>item.name===preset.name);
    if(existingIndex>=0){
      const id=store.presets[existingIndex].id;
      store.presets[existingIndex]={...preset,id,createdAt:store.presets[existingIndex].createdAt || preset.createdAt,updatedAt:Date.now()};
      if(index===0) firstImportedPresetId=id;
      replaced++;
    }else{
      const id=store.presets.some(item=>item.id===preset.id) ? makeTraitPresetId() : preset.id;
      store.presets.push({...preset,id,createdAt:preset.createdAt || Date.now(),updatedAt:Date.now()});
      if(index===0) firstImportedPresetId=id;
      added++;
    }
  });
  store=saveTraitPresetStore(store,{source:'import'});
  clearTraitPresetUpdatedStatus('import');
  return {store,added,replaced,firstImportedPresetId};
}
function isExcelPresetImportFile(file){
  const name=String(file?.name||'').toLowerCase();
  const type=String(file?.type||'').toLowerCase();
  return name.endsWith('.xlsx') || name.endsWith('.xlsm') || type.includes('spreadsheet') || type.includes('excel.sheet.macroenabled');
}
const traitPresetExcelImportState={workbook:null,fileName:''};
function createTraitPresetExcelImportModal(){
  window.DpsModal.createShell('traitPresetExcelImportModal','trait-preset-excel-modal-shell',`
    <div class="trait-preset-excel-backdrop" data-trait-preset-excel-close="1"></div>
    <section class="trait-preset-excel-modal" role="dialog" aria-modal="true" aria-labelledby="traitPresetExcelTitle">
      <header class="trait-preset-excel-head">
        <h2 id="traitPresetExcelTitle">엑셀 프리셋 가져오기</h2>
        <button type="button" class="ui-icon-btn trait-preset-excel-close" data-trait-preset-excel-close="1" aria-label="엑셀 프리셋 가져오기 닫기">×</button>
      </header>
      <div class="trait-preset-excel-body">
        <div class="trait-preset-excel-file" id="traitPresetExcelFileView">엑셀 파일</div>
        <label class="trait-preset-excel-field"><span>시트 선택</span><select id="traitPresetExcelSheet"></select></label>
        <label class="trait-preset-excel-field"><span>프리셋 이름 지정</span><input id="traitPresetExcelName" type="text" maxlength="40" autocomplete="off"/></label>
        <button class="btn pri ui-action-btn trait-preset-excel-save" type="button" data-trait-preset-excel-save="1">선택 시트 프리셋 저장</button>
      </div>
    </section>`);
}
function openTraitPresetExcelImportModal(workbook,fileName){
  traitPresetExcelImportState.workbook=workbook;
  traitPresetExcelImportState.fileName=fileName || workbook?.fileName || '엑셀파일';
  createTraitPresetExcelImportModal();
  const fileView=$('traitPresetExcelFileView');
  const sheetSelect=$('traitPresetExcelSheet');
  const nameInput=$('traitPresetExcelName');
  const sheets=Array.isArray(workbook?.sheets) ? workbook.sheets : [];
  if(fileView) fileView.textContent=`파일: ${traitPresetExcelImportState.fileName}`;
  if(sheetSelect){
    sheetSelect.innerHTML=sheets.map(sheet=>`<option value="${escapeCompareHtml(sheet.name)}">${escapeCompareHtml(sheet.name)}</option>`).join('');
    const preferred=sheets.some(sheet=>sheet.name==='고행') ? '고행' : (sheets[0]?.name || '');
    sheetSelect.value=preferred;
  }
  if(nameInput){
    nameInput.dataset.autofill='1';
    nameInput.value=sheetSelect?.value || stateFileBaseName(fileName);
  }
  window.DpsModal.setOpen('traitPresetExcelImportModal','trait-preset-excel-modal-open',true);
}
function closeTraitPresetExcelImportModal(){
  window.DpsModal.setOpen('traitPresetExcelImportModal','trait-preset-excel-modal-open',false);
}
function selectedTraitPresetExcelSheetName(){
  const workbook=traitPresetExcelImportState.workbook;
  const select=$('traitPresetExcelSheet');
  const candidate=String(select?.value || '').trim();
  const names=(workbook?.sheets || []).map(sheet=>sheet.name);
  return names.includes(candidate) ? candidate : '';
}
function saveSelectedExcelSheetAsTraitPreset(){
  const workbook=traitPresetExcelImportState.workbook;
  const sheetName=selectedTraitPresetExcelSheetName();
  const name=normalizeTraitPresetName($('traitPresetExcelName')?.value || sheetName);
  if(!workbook || !sheetName){ notifyStorageAction('저장할 엑셀 시트를 선택하세요.','err'); return false; }
  if(!name){ notifyStorageAction('프리셋 이름을 입력하세요.','err'); return false; }
  try{
    const cells=workbook.getCells(sheetName);
    validateExcelCompareSheet(cells,sheetName);
    const specCells=workbook.getCells('스펙');
    const zeroCells=getZeroScoreSheetCells(workbook);
    const additionalInfo=inspectSpecAdditionalStructure(specCells);
    if(!additionalInfo.valid) throw new Error(additionalInfo.message);
    const importedState=buildExcelState(cells,specCells,zeroCells,sheetName).state;
    const now=Date.now();
    const imported={presets:[{
      id:makeTraitPresetId(),
      name,
      schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,
      createdAt:now,
      updatedAt:now,
      meta:traitPresetMetaFromSavedState(importedState),
      state:importedState
    }]};
    const result=mergeTraitPresetImport(imported);
    const savedPresetId=result.firstImportedPresetId || result.store.presets.find(item=>item.name===name)?.id || '';
    if(savedPresetId) loadTraitPresetById(savedPresetId,{notifySuccess:false,preserveSharedValues:false});
    else refreshTraitPresetControls('');
    closeTraitPresetExcelImportModal();
    notifyStorageAction(result.replaced ? `엑셀 프리셋 갱신 및 로드 완료: ${name}` : `엑셀 프리셋 저장 및 로드 완료: ${name}`,'ok',{statusAction:'import'});
    return true;
  }catch(e){
    logAppError('[trait preset excel import failed]',e);
    notifyStorageAction(e?.message || '엑셀 프리셋 저장 실패','err');
    return false;
  }
}
async function importTraitPresetFile(file){
  try{
    if(isExcelPresetImportFile(file)){
      const workbook=await readExcelWorkbook(file);
      if(!workbook.sheets?.length) throw new Error('엑셀 시트를 찾을 수 없습니다.');
      validateTraitPresetExcelSpecAdditionalStructure(workbook);
      openTraitPresetExcelImportModal(workbook,file?.name || '엑셀파일');
      return true;
    }
    const raw=await readFileAsText(file);
    const parsed=safeJsonParse(raw);
    if(isUnsupportedOldTraitPresetPayload(parsed)) throw new Error(TRAIT_PRESET_UNSUPPORTED_OLD_MESSAGE);
    const imported=normalizeTraitPresetImportData(parsed);
    const result=mergeTraitPresetImport(imported);
    const loadId=result.firstImportedPresetId || '';
    if(loadId) loadTraitPresetById(loadId,{notifySuccess:false,preserveSharedValues:false});
    else refreshTraitPresetControls('');
    notifyStorageAction(`프리셋 가져오기 및 로드 완료 · 추가 ${result.added} / 갱신 ${result.replaced}`,'ok',{statusAction:'import'});
    return true;
  }catch(e){
    logAppError('[trait preset import failed]',e);
    if(isUnsupportedOldTraitPresetError(e)) showUnsupportedOldTraitPresetToast();
    else notifyStorageAction(e?.message || '특성 프리셋 가져오기 실패','err');
    return false;
  }
}
/* 특성 프리셋: 비교 패널 연동 */
function selectedBaseTraitPreset(){
  if(compareState.baseFileRejected) return null;
  const store=compareState.baseTraitPresetBundle || loadTraitPresetStore();
  const select=$('excelCompareBasePreset');
  const presets=Array.isArray(store.presets) ? store.presets : [];
  const candidate=String((select && !select.disabled && select.value) || compareState.baseTraitPresetId || '').trim();
  const preset=presets.find(item=>item.id===candidate) || null;
  if(preset){
    compareState.baseTraitPresetId=preset.id;
    if(select && select.value!==preset.id) select.value=preset.id;
  }
  return preset;
}
function selectedCompareTraitPreset(){
  if(compareState.sourceType!=='traitPreset' || !compareState.traitPresetBundle) return null;
  const presets=Array.isArray(compareState.traitPresetBundle.presets) ? compareState.traitPresetBundle.presets : [];
  if(!presets.length) return null;
  const select=$('excelCompareSheet');
  const candidate=String((select && !select.disabled && select.value) || compareState.selectedSheetName || '').trim();
  const preset=presets.find(item=>item.id===candidate) || presets[0] || null;
  if(preset){
    compareState.selectedSheetName=preset.id;
    if(select && select.value!==preset.id) select.value=preset.id;
  }
  return preset;
}
function buildTraitPresetComparison(preset){
  if(!preset) throw new Error('비교할 특성 프리셋을 선택하세요.');
  const state=normalizeSavedState(preset.state);
  if(!state) throw new Error('특성 프리셋 데이터가 올바르지 않습니다.');
  const basePreset=selectedBaseTraitPreset();
  if(!basePreset) throw new Error('기준 프리셋을 선택하세요.');
  const baseState=normalizeSavedState(basePreset.state);
  if(!baseState) throw new Error('기준 프리셋 데이터가 올바르지 않습니다.');
  const bundle=compareState.traitPresetBundle || {};
  const baseBundle=compareState.baseTraitPresetBundle || {};
  return buildJsonComparison(
    {...state,fileName:bundle.fileName || '특성 프리셋 파일',sheetName:preset.name},
    {fileName:bundle.fileName || '특성 프리셋 파일',sheetName:preset.name,sourceType:'traitPreset',baseState,baseFileName:baseBundle.fileName || '기준 프리셋',baseSheetName:basePreset.name}
  );
}
function renderTraitPresetComparison(preset){
  renderExcelComparison(buildTraitPresetComparison(preset));
}
function applySelectedTraitPreset(){
  const preset=selectedCompareTraitPreset();
  if(!preset || compareState.applied) return;
  const previousState=makeStateObject();
  const basePreset=selectedBaseTraitPreset();
  try{
    const state=buildTraitPresetApplyState(preset,{preserveSharedValues:false});
    if(!state) throw new Error('특성 프리셋 데이터가 올바르지 않습니다.');
    let appliedName='기준 프리셋';
    if(!basePreset) throw new Error('기준 프리셋을 선택하세요.');
    let store=loadTraitPresetStore();
    let index=store.presets.findIndex(item=>item.id===basePreset.id);
    if(index<0) index=store.presets.findIndex(item=>item.name===basePreset.name);
    const now=Date.now();
    const prev=index>=0 ? store.presets[index] : {
      id:String(basePreset.id || makeTraitPresetId()),
      name:normalizeTraitPresetName(basePreset.name || '기준 프리셋'),
      createdAt:+basePreset.createdAt || now,
      updatedAt:now
    };
    const nextState=markPresetStateCurrentVersion({...state,savedAt:now});
    const nextPreset={...prev,id:prev.id,name:prev.name,createdAt:prev.createdAt,updatedAt:now,schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,meta:traitPresetMetaFromSavedState(nextState),state:nextState};
    if(index>=0) store.presets[index]=nextPreset;
    else store.presets.push(nextPreset);
    if(compareState.baseTraitPresetBundle && Array.isArray(compareState.baseTraitPresetBundle.presets)){
      const bundleIndex=compareState.baseTraitPresetBundle.presets.findIndex(item=>item.id===basePreset.id || item.name===basePreset.name);
      if(bundleIndex>=0){
        const bundlePrev=compareState.baseTraitPresetBundle.presets[bundleIndex];
        const nextBundlePreset={...bundlePrev,id:bundlePrev.id,name:bundlePrev.name,createdAt:bundlePrev.createdAt,updatedAt:now,schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,meta:traitPresetMetaFromSavedState(nextState),state:nextState};
        compareState.baseTraitPresetBundle.presets[bundleIndex]=nextBundlePreset;
      }
    }
    store=saveTraitPresetStore(store,{source:'compareApply'});
    compareState.baseTraitPresetId=compareState.baseTraitPresetBundle ? basePreset.id : nextPreset.id;
    appliedName=nextPreset.name;
    applyStateObject(nextState);
    const saved=saveState({silent:true});
    if(saved===false) throw new Error('비교 프리셋 값은 적용했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.');
    compareState.restoreState=previousState;
    compareState.applied=true;
    hydrateCompareControls();
    renderTraitPresetComparison(preset);
    updateCompareActionButtons();
    notifyStorageAction(`비교 프리셋 값 적용 완료: ${appliedName}`,'ok',{statusAction:'load'});
  }catch(e){
    try{ applyStateObject(previousState); }catch(rollbackError){ logAppError('[trait preset compare rollback failed]', rollbackError); }
    compareState.restoreState=null;
    compareState.applied=false;
    logAppError('[trait preset compare apply failed]',e);
    showToast(e?.message||String(e),'err');
    updateCompareActionButtons();
  }
}
function compareSelectedTraitPreset(options={}){
  if(!compareState.traitPresetBundle) return;
  hydrateCompareControls();
  const preset=selectedCompareTraitPreset();
  if(!preset) return;
  compareState.lastResult=null;
  if(!options.preserveRestore) clearCompareRestoreState();
  try{
    compareState.sourceType='traitPreset';
    compareState.selectedSheetName=preset.id;
    renderTraitPresetComparison(preset);
    updateCompareActionButtons();
  }catch(e){
    logAppError('[trait preset compare failed]',e);
    setCompareError(e?.message||String(e));
  }
}
function compareTraitPreset(){
  const id=selectedTraitPresetId();
  const store=loadTraitPresetStore();
  const preset=store.presets.find(item=>item.id===id);
  if(!preset){
    notifyStorageAction('특성 프리셋을 먼저 가져오거나 로드해야 프리셋 분석을 사용할 수 있습니다.','err');
    refreshTraitPresetControls('');
    return false;
  }
  resetCompareState();
  compareState.baseTraitPresetId=id;
  openCompareInfo();
  hydrateCompareControls();
  const body=$('excelCompareBody');
  if(body) body.innerHTML=EXCEL_COMPARE_EMPTY_HTML;
  updateCompareActionButtons();
  if(preset){
    showToast(`기준 프리셋 선택: ${preset.name}`,'ok');
  }
  return true;
}
function bindTraitPresetEvents(){
  document.addEventListener('change',e=>{
    if(e.target?.id==='traitPresetSelect') loadTraitPresetById(e.target.value,{preserveSharedValues:false});
    if(e.target?.id==='traitPresetImportFile' && e.target.files?.[0]){
      const file=e.target.files[0];
      importTraitPresetFile(file).finally(()=>{ e.target.value=''; });
    }
    if(e.target?.id==='traitPresetExcelSheet'){
      const nameInput=$('traitPresetExcelName');
      if(nameInput && (nameInput.dataset.autofill==='1' || !nameInput.value.trim())){
        nameInput.value=e.target.value || '';
        nameInput.dataset.autofill='1';
      }
    }
  });
  document.addEventListener('input',e=>{
    if(e.target?.id==='traitPresetExcelName') e.target.dataset.autofill='0';
  });
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-trait-preset-excel-close]')) closeTraitPresetExcelImportModal();
    if(e.target.closest('[data-trait-preset-excel-save]')) saveSelectedExcelSheetAsTraitPreset();
    if(e.target.closest('[data-trait-preset-export-close]')) closeTraitPresetExportModal();
    if(e.target.closest('[data-trait-preset-export-save]')){
      e.preventDefault();
      e.stopPropagation();
      downloadTraitPresetExport($('traitPresetExportName')?.value || '');
    }
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if($('traitPresetExcelImportModal')?.classList.contains('is-open')) closeTraitPresetExcelImportModal();
      if($('traitPresetExportModal')?.classList.contains('is-open')) closeTraitPresetExportModal();
    }
    if(e.key==='Enter' && e.target?.id==='traitPresetExportName'){
      e.preventDefault();
      e.stopPropagation();
      downloadTraitPresetExport(e.target.value || '');
    }
  });
}
/* ===== 10. 화면 제어 / 글자 크기 / 확인 작업 ===== */
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
/* ===== 11. 더제로 승단 계산기 ===== */
/* 더제로 승단: 엑셀/저장파일 비교 상태 변환 */
const ZERO_EXCEL_PENANCE_ROWS=[
  'Practice','Very Easy','Easy','Normal','Hard','Very Hard','Hell','Inferno','Lunatic','Holic','Epic','Ultimate','Impossible','The Final'
].map((name,index)=>({name,row:13+index}));
function buildZeroPenanceCalcRow(name){
  return `
          <tr class="zero-calc-row" data-row-type="penance">
            <td class="zero-calc-name">${name}</td>
            <td><input class="zero-calc-current" inputmode="numeric" type="text" value="0"/></td>
            <td><input class="zero-calc-target" inputmode="numeric" type="text" value="0"/></td>
            <td><button class="ui-toggle-btn zero-star-toggle" data-action="zeroScoreStar" type="button" aria-pressed="false">+2</button></td>
            <td><input class="zero-current-honor zero-honor-input" inputmode="latin" maxlength="1" placeholder="B" type="text" value="0"/></td>
            <td><input class="zero-target-honor zero-honor-input" inputmode="latin" maxlength="1" placeholder="X" type="text" value="0"/></td>
            <td><b class="zero-row-score">0</b></td>
          </tr>`;
}
function buildZeroTowerCalcRow(){
  return `
          <tr class="zero-calc-row" data-row-type="towerCombo">
            <td class="zero-calc-name">도전의탑</td>
            <td><input class="zero-calc-current" inputmode="numeric" type="text" value="0"/></td>
            <td><input class="zero-calc-target" inputmode="numeric" type="text" value="0"/></td>
            <td><button class="ui-toggle-btn zero-star-toggle zero-star-disabled" type="button" disabled aria-disabled="true" aria-pressed="false">비활성화</button></td>
            <td><input class="zero-tower-honor-current" inputmode="numeric" type="text" value="0"/></td>
            <td><input class="zero-tower-honor-target" inputmode="numeric" type="text" value="0"/></td>
            <td><b class="zero-row-score">0</b></td>
          </tr>`;
}
function renderZeroScoreCalculatorRows(){
  const rows=$('zeroScoreRows');
  if(!rows || rows.dataset.rendered==='1') return;
  rows.innerHTML=ZERO_EXCEL_PENANCE_ROWS.map(({name})=>buildZeroPenanceCalcRow(name)).join('') + buildZeroTowerCalcRow();
  rows.dataset.rendered='1';
}
/* 더제로 승단: 점수 계산 공통 */
/* 더제로 승단 점수 계산은 calc.js에서 로드된다. */
function compareZeroTextRow(name, changeValue, currentValue){
  return buildCompareTextRow('더제로 승단 정보',name,changeValue,currentValue);
}
function compareZeroNumberRow(kind,name,changeValue,currentValue){
  return buildCompareNumberRow(kind,name,changeValue,currentValue,0.0001);
}
/* 더제로 승단: 저장파일/프리셋 분석 행 생성 */
function addZeroPenanceCompareRows(rows,name,change={},current={}){
  const currentCalc=zeroScoreRowCalculation(current);
  const changeCalc=zeroScoreRowCalculation(change);
  rows.push(compareZeroNumberRow('더제로 승단 정보',`${name} 현재 일반`,change.current ?? 0,current.current ?? 0));
  rows.push(compareZeroNumberRow('더제로 승단 정보',`${name} 목표 일반`,change.target ?? 0,current.target ?? 0));
  rows.push(compareZeroTextRow(`${name} 24스타`,change.star?'ON':'OFF',current.star?'ON':'OFF'));
  rows.push(compareZeroTextRow(`${name} 현재 명예`,zeroHonorDisplay(change.currentHonor||''),zeroHonorDisplay(current.currentHonor||'')));
  rows.push(compareZeroTextRow(`${name} 목표 명예`,zeroHonorDisplay(change.targetHonor||''),zeroHonorDisplay(current.targetHonor||'')));
  rows.push(compareZeroNumberRow('더제로 승단 정보',`${name} 목표 추가점수`,changeCalc.score,currentCalc.score));
}
function addZeroTowerComboCompareRows(rows,label,change={},current={}){
  rows.push(compareZeroNumberRow('더제로 승단 정보',`${label} 현재 일반`,change.current ?? 0,current.current ?? 0));
  rows.push(compareZeroNumberRow('더제로 승단 정보',`${label} 목표 일반`,change.target ?? 0,current.target ?? 0));
  rows.push(compareZeroTextRow(`${label} 24스타`,'비활성화','비활성화'));
  rows.push(compareZeroNumberRow('더제로 승단 정보',`${label} 현재 명예`,change.honorCurrent ?? 0,current.honorCurrent ?? 0));
  rows.push(compareZeroNumberRow('더제로 승단 정보',`${label} 목표 명예`,change.honorTarget ?? 0,current.honorTarget ?? 0));
  rows.push(compareZeroNumberRow('더제로 승단 정보',`${label} 목표 추가점수`,zeroScoreRowCalculation(change).score,zeroScoreRowCalculation(current).score));
}
function buildSavedZeroScoreCompareRows(changeZeroScore,currentZeroScore,options={}){
  const onlyDiffs=options.onlyDiffs!==false;
  const changeState=normalizeZeroScoreState(changeZeroScore);
  const currentState=normalizeZeroScoreState(currentZeroScore);
  const changeRows=changeState.rows;
  const currentRows=currentState.rows;
  const rows=[];
  ZERO_EXCEL_PENANCE_ROWS.forEach(({name},index)=>addZeroPenanceCompareRows(rows,name,changeRows[index] || {},currentRows[index] || {}));
  addZeroTowerComboCompareRows(rows,'도전의탑',changeRows[14] || {},currentRows[14] || {});
  const changeSummary=zeroScoreSummaryFromState(changeState);
  const currentSummary=zeroScoreSummaryFromState(currentState);
  rows.push(compareZeroNumberRow('더제로 승단 정보','현재 승단점수',changeSummary.currentTotal,currentSummary.currentTotal));
  rows.push(compareZeroNumberRow('더제로 승단 정보','목표 완료',changeSummary.targetScore,currentSummary.targetScore));
  return onlyDiffs ? rows.filter(row=>row.status!=='same') : rows;
}
function buildZeroScoreCompareRows(zeroCells){
  if(!zeroCells) return [];
  const webState=collectZeroScoreState() || {rows:[]};
  const rows=[];
  ZERO_EXCEL_PENANCE_ROWS.forEach(({name,row},index)=>{
    const web=webState.rows[index] || {};
    const webCalc=zeroScoreRowCalculation(web);
    rows.push(compareZeroNumberRow('더제로 승단 정보',`${name} 현재 일반`,zeroCells[`B${row}`],web.current ?? 0));
    rows.push(compareZeroNumberRow('더제로 승단 정보',`${name} 목표 일반`,zeroCells[`C${row}`],web.target ?? 0));
    rows.push(compareZeroTextRow(`${name} 24스타`,excelFlag(zeroCells[`D${row}`])?'ON':'OFF',web.star?'ON':'OFF'));
    rows.push(compareZeroTextRow(`${name} 현재 명예`,zeroHonorDisplay(normalizeZeroHonorValue(zeroCells[`E${row}`])),zeroHonorDisplay(web.currentHonor||'')));
    rows.push(compareZeroTextRow(`${name} 목표 명예`,zeroHonorDisplay(normalizeZeroHonorValue(zeroCells[`F${row}`])),zeroHonorDisplay(web.targetHonor||'')));
    rows.push(compareZeroNumberRow('더제로 승단 정보',`${name} 목표 추가점수`,zeroCells[`G${row}`],webCalc.score));
  });
  const comboExcel={
    type:'towerCombo',
    current:String(Math.max(0,Math.min(90,Math.round(excelNumber(zeroCells.B27) ?? 0)))),
    target:String(Math.max(0,Math.min(90,Math.round(excelNumber(zeroCells.C27) ?? 0)))),
    honorCurrent:String(Math.max(0,Math.min(90,Math.round(excelNumber(zeroCells.B28) ?? 0)))),
    honorTarget:String(Math.max(0,Math.min(90,Math.round(excelNumber(zeroCells.C28) ?? 0)))),
    star:false,currentHonor:'0',targetHonor:'0'
  };
  const comboWeb=zeroTowerComboFromRows(webState.rows);
  addZeroTowerComboCompareRows(rows,'도전의탑',comboExcel,comboWeb);
  const webSummary=zeroScoreSummaryFromState(webState);
  rows.push(compareZeroNumberRow('더제로 승단 정보','현재 승단점수',zeroCells.H28,webSummary.currentTotal));
  rows.push(compareZeroNumberRow('더제로 승단 정보','목표 완료',zeroCells.I28,webSummary.targetScore));
  return rows;
}
const ZERO_RANK_FALLBACK_TABLE=[
  {name:'입문',score:0},{name:'견습',score:100},{name:'숙련',score:150},{name:'전문',score:200},
  {name:'장인',score:250},{name:'명장',score:300},{name:'명장+',score:350},{name:'도인',score:400},
  {name:'도인+',score:450},{name:'지존',score:500},{name:'지존+',score:550},{name:'패왕',score:600},
  {name:'패왕+',score:650},{name:'제왕',score:700},{name:'제왕+',score:750},{name:'신황',score:800},{name:'신황+',score:850}
];
function getZeroRankTable(){
  const rows=[...qsa('.zero-rank-table tbody tr')].map(row=>{
    const cells=row.querySelectorAll('td');
    const name=excelText(cells[0]?.textContent);
    const score=excelNumber(cells[2]?.textContent);
    return name && score!==null ? {name,score,row} : null;
  }).filter(Boolean);
  return rows.length ? rows : ZERO_RANK_FALLBACK_TABLE;
}
function zeroRankEntry(score){
  const value=Number(score)||0;
  return getZeroRankTable().reduce((best,item)=>value>=item.score ? item : best, getZeroRankTable()[0] || ZERO_RANK_FALLBACK_TABLE[0]);
}
function zeroRankName(score){
  return zeroRankEntry(score)?.name || '입문';
}
function zeroBenefitRankName(article){
  const text=excelText(article?.querySelector('h4 span')?.textContent);
  return text.replace(/^\[/,'').replace(/\]$/,'').trim();
}
function updateZeroRankHighlights(currentRank, targetRank){
  const current=excelText(currentRank);
  const target=excelText(targetRank);
  qsa('.zero-rank-table tbody tr').forEach(row=>{
    const name=excelText(row.querySelector('td')?.textContent);
    row.classList.toggle('zero-rank-current', !!current && name===current);
    row.classList.toggle('zero-rank-target', !!target && name===target);
    row.classList.toggle('zero-rank-same', !!current && current===target && name===current);
  });
  qsa('.zero-benefit-rank').forEach(article=>{
    const name=zeroBenefitRankName(article);
    article.classList.toggle('zero-rank-current', !!current && name===current);
    article.classList.toggle('zero-rank-target', !!target && name===target);
    article.classList.toggle('zero-rank-same', !!current && current===target && name===current);
  });
  const card=qs('.zero-rank-result-card');
  if(card){
    card.classList.toggle('zero-rank-same', !!current && current===target);
    card.classList.toggle('zero-rank-upgrade', !!current && !!target && current!==target);
  }
}
function updateZeroScoreCalculator(){
  const calc=qs('.zero-score-calc');
  if(!calc) return;
  let total=0;
  let currentTotal=0;
  calc.querySelectorAll('.zero-calc-row').forEach(row=>{
    const type=row.dataset.rowType || 'penance';
    const current=row.querySelector('.zero-calc-current')?.value;
    const target=row.querySelector('.zero-calc-target')?.value;
    let currentScore=0;
    let targetScore=0;
    let score=0;
    if(type==='penance'){
      const cur=zeroScoreNumber(current,0,20);
      const tar=zeroScoreNumber(target,0,20);
      const star=row.querySelector('.zero-star-toggle.active') ? 2 : 0;
      const currentHonor=normalizeZeroHonorValue(row.querySelector('.zero-current-honor')?.value || '');
      const targetHonor=normalizeZeroHonorValue(row.querySelector('.zero-target-honor')?.value || '');
      const currentPenanceScore=zeroPenanceScore(cur);
      const targetPenanceScore=zeroPenanceScore(tar);
      const currentHonorScore=zeroHonorScore(currentHonor);
      const targetHonorScore=zeroHonorScore(targetHonor);
      currentScore=currentPenanceScore+currentHonorScore+star;
      targetScore=targetPenanceScore+targetHonorScore;
      score=Math.max(0,targetPenanceScore-currentPenanceScore)+Math.max(0,targetHonorScore-currentHonorScore);
    }else if(type==='tower'){
      currentScore=zeroTowerScore(current);
      targetScore=zeroTowerScore(target);
      score=Math.max(0, targetScore-currentScore);
    }else if(type==='honorTower'){
      currentScore=zeroHonorTowerScore(current);
      targetScore=zeroHonorTowerScore(target);
      score=Math.max(0, targetScore-currentScore);
    }else if(type==='towerCombo'){
      const honorCurrent=row.querySelector('.zero-tower-honor-current')?.value;
      const honorTarget=row.querySelector('.zero-tower-honor-target')?.value;
      const towerCurrentScore=zeroTowerScore(current);
      const towerTargetScore=zeroTowerScore(target);
      const honorCurrentScore=zeroHonorTowerScore(honorCurrent);
      const honorTargetScore=zeroHonorTowerScore(honorTarget);
      currentScore=towerCurrentScore+honorCurrentScore;
      targetScore=towerTargetScore+honorTargetScore;
      score=Math.max(0, towerTargetScore-towerCurrentScore)+Math.max(0, honorTargetScore-honorCurrentScore);
    }
    currentTotal+=currentScore;
    total+=score;
    const out=row.querySelector('.zero-row-score');
    if(out) out.textContent=String(score);
  });
  const targetScore=currentTotal+total;
  const currentEl=calc.querySelector('.zero-current-score');
  const totalEl=calc.querySelector('.zero-total-add');
  const targetEl=calc.querySelector('.zero-target-score');
  const currentRankEl=calc.querySelector('.zero-current-rank');
  const targetRankEl=calc.querySelector('.zero-target-rank');
  const currentRank=zeroRankName(currentTotal);
  const targetRank=zeroRankName(targetScore);
  if(currentEl) currentEl.textContent=String(currentTotal);
  if(totalEl) totalEl.textContent=String(total);
  if(targetEl) targetEl.textContent=String(targetScore);
  if(currentRankEl) currentRankEl.textContent=currentRank;
  if(targetRankEl) targetRankEl.textContent=targetRank;
  updateZeroRankHighlights(currentRank,targetRank);
}
function collectZeroScoreState(){
  const calc=qs('.zero-score-calc');
  if(!calc) return null;
  return {
    rows:Array.from(calc.querySelectorAll('.zero-calc-row')).map(row=>{
      const type=row.dataset.rowType || 'penance';
      const state={
        type,
        current:row.querySelector('.zero-calc-current')?.value ?? '0',
        target:row.querySelector('.zero-calc-target')?.value ?? '0',
        star:type==='penance' && !!row.querySelector('.zero-star-toggle.active'),
        currentHonor:normalizeZeroHonorValue(row.querySelector('.zero-current-honor')?.value ?? ''),
        targetHonor:normalizeZeroHonorValue(row.querySelector('.zero-target-honor')?.value ?? '')
      };
      if(type==='towerCombo'){
        state.honorCurrent=row.querySelector('.zero-tower-honor-current')?.value ?? '0';
        state.honorTarget=row.querySelector('.zero-tower-honor-target')?.value ?? '0';
      }
      return state;
    })
  };
}
function setZeroScoreStarButton(starBtn,active){
  if(!starBtn) return;
  setClassState(starBtn, ['active','is-active'], active);
  starBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
  starBtn.textContent=active ? 'ON +2' : '+2';
}
function applyZeroScoreState(zeroScore){
  const calc=qs('.zero-score-calc');
  if(!calc) return;
  const rows=zeroScore ? normalizeZeroScoreState(zeroScore).rows : [];
  calc.querySelectorAll('.zero-calc-row').forEach((row,idx)=>{
    const type=row.dataset.rowType || 'penance';
    const saved=type==='towerCombo' ? zeroTowerComboFromRows(rows,idx) : (rows[idx] || {});
    const current=row.querySelector('.zero-calc-current');
    const target=row.querySelector('.zero-calc-target');
    const currentHonor=row.querySelector('.zero-current-honor');
    const targetHonor=row.querySelector('.zero-target-honor');
    const honorCurrent=row.querySelector('.zero-tower-honor-current');
    const honorTarget=row.querySelector('.zero-tower-honor-target');
    if(current) current.value=String(saved.current ?? '0');
    if(target) target.value=String(saved.target ?? '0');
    if(currentHonor) currentHonor.value=normalizeZeroHonorValue(saved.currentHonor ?? '').toUpperCase();
    if(targetHonor) targetHonor.value=normalizeZeroHonorValue(saved.targetHonor ?? '').toUpperCase();
    if(honorCurrent) honorCurrent.value=String(saved.honorCurrent ?? '0');
    if(honorTarget) honorTarget.value=String(saved.honorTarget ?? '0');
    setZeroScoreStarButton(row.querySelector('.zero-star-toggle:not(:disabled)'), !!saved.star);
  });
  updateZeroScoreCalculator();
}
function commitZeroScoreChange(){
  updateZeroScoreCalculator();
  if(!isStorageLocked()){
    saveState({silent:true});
    scheduleAutoSaveToast();
  }
}
function toggleZeroScoreStar(trigger){
  if(!trigger) return;
  setZeroScoreStarButton(trigger,!trigger.classList.contains('active'));
  commitZeroScoreChange();
}
function normalizeZeroHonorInputElement(el){
  if(!el || !el.classList?.contains('zero-honor-input')) return;
  el.value=normalizeZeroHonorValue(el.value).toUpperCase();
}
function bindZeroScoreCalculator(){
  if(document.documentElement.dataset.zeroScoreCalcBound==='1') return;
  document.documentElement.dataset.zeroScoreCalcBound='1';
  const updateAndSave=(target)=>{
    if(!(target && target.closest && target.closest('.zero-score-calc'))) return;
    normalizeZeroHonorInputElement(target);
    commitZeroScoreChange();
  };
  document.addEventListener('input', e=>updateAndSave(e.target), true);
  document.addEventListener('change', e=>updateAndSave(e.target), true);
}
function setZeroRankTab(trigger){
  const card=trigger && trigger.closest ? trigger.closest('.zero-rank-card') : null;
  if(!card) return;
  const key=trigger.dataset.zeroRankTab || 'rank';
  card.querySelectorAll('.zero-rank-tab').forEach(btn=>{
    const active=btn.dataset.zeroRankTab===key;
    setClassState(btn, ['active','is-active'], active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  card.querySelectorAll('.zero-rank-panel').forEach(panel=>{
    setClassState(panel, 'active', panel.dataset.zeroRankPanel===key);
  });
}
/* ===== 12. 공통 이벤트 바인딩 / 앱 초기화 ===== */
let appEventsBound=false;
function setDisclosureOpen(toggle, panel, open){
  if(!toggle || !panel) return false;
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  panel.hidden=!open;
  return true;
}
function toggleDisclosure(toggle, panel){
  return setDisclosureOpen(toggle, panel, toggle?.getAttribute('aria-expanded')!=='true');
}
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
  const {toggle, menu}=getConvenienceMenuParts();
  return setDisclosureOpen(toggle, menu, open);
}
function closeConvenienceMenu(){
  setConvenienceMenuOpen(false);
}
function toggleConvenienceMenu(){
  const {toggle, menu}=getConvenienceMenuParts();
  return toggleDisclosure(toggle, menu);
}
function getDpsStandardHelpParts(){
  return {toggle:$('dpsStandardHelpToggle'), bubble:$('dpsStandardHelpBubble')};
}
function setDpsStandardHelpOpen(open){
  const {toggle,bubble}=getDpsStandardHelpParts();
  return setDisclosureOpen(toggle, bubble, open);
}
function closeDpsStandardHelp(){
  setDpsStandardHelpOpen(false);
}
function toggleDpsStandardHelp(){
  const {toggle,bubble}=getDpsStandardHelpParts();
  return toggleDisclosure(toggle, bubble);
}
function bindConvenienceMenuEvents(){
  document.addEventListener('click', e=>{
    const { wrap }=getConvenienceMenuParts();
    if(e.target.closest('.header-convenience-menu a')){
      closeConvenienceMenu();
      return;
    }
    if(!wrap || wrap.contains(e.target)) return;
    closeConvenienceMenu();
  });
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape') closeConvenienceMenu();
  });
}
function bindDpsStandardHelpEvents(){
  document.addEventListener('click', e=>{
    if(e.target.closest('.damage-board-title')) return;
    closeDpsStandardHelp();
  });
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape') closeDpsStandardHelp();
  });
}
const ACTION_HANDLERS={
  optimizeSP,
  optimizeUtility,
  clearUtility:()=>requestConfirmAction('clearUtility','한 번 더 누르면 유틸 초기화', clearUtility),
  applyTraitEfficiencyTop,
  clearAll:()=>requestConfirmAction('clearAll','한 번 더 누르면 유틸 제외 특성 초기화', clearAll),
  saveTraitPreset,
  loadTraitPreset,
  updateTraitPreset,
  renameTraitPreset,
  deleteTraitPreset,
  resetAllTraitPresetState:requestTraitPresetFullReset,
  exportTraitPresets,
  importTraitPresets: openTraitPresetImportPicker,
  compareTraitPreset,
  openDpsTable,
  openMonthRuneTab:(trigger)=>openMonthRune(trigger?.dataset?.monthRuneOpenTab || 'compare'),
  toggleConvenienceMenu,
  toggleDpsStandardHelp,
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
    if(target.id==='spBankApply') syncSpBankApplyControl();
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
    bindConvenienceMenuEvents, bindDpsStandardHelpEvents, bindZeroScoreCalculator, bindTraitLimitDisplayEvents, bindReactiveInputs,
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
try{
  initApp();
  markAppReady();
}catch(e){
  markAppError('D1001', e);
}
