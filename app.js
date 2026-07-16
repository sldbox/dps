/* 설정·공통 상태 */
const DPS_CONFIG={
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

const $=id=>document.getElementById(id);
const qs=selector=>document.querySelector(selector);
const qsa=selector=>document.querySelectorAll(selector);

const INV={};
TRAITS.forEach(t=>{INV[t[0]]=0;});
Object.assign(INV,{116:1});
const AUTO_INVEST_EXCLUDED_ROWS=new Set([45,87]);
const ENCHANT_INPUT_IDS=['enchAD','enchCRI','enchUA','enchTD','enchSR','enchHR'];
const ENCHANT_INPUT_ID_SET=new Set(ENCHANT_INPUT_IDS);

/* 공통 UI·입력 유틸 */
function rememberAppIssue(kind,label,error){
  window.DPS_LAST_ISSUE={kind,label,error,time:Date.now()};
}
function alertApp(message){
  alert(message);
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
    const text=String(message ?? '').trim();
    if(!text) return;
    const toastKey=`${type}:${text}`;
    if(Array.from(root.children).some(item=>item.dataset.toastKey===toastKey)) return;
    while(root.children.length>=4) root.firstElementChild?.remove();
    const el=document.createElement('div');
    el.className='toast '+type;
    el.dataset.toastKey=toastKey;
    el.textContent=text;
    root.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('show'));
    const requestedMs=Number(durationMs);
    const visibleMs=Number.isFinite(requestedMs) && requestedMs>0 ? requestedMs : (text.includes('\n') ? 5200 : 2200);
    setTimeout(()=>{
      el.classList.remove('show');
      setTimeout(()=>el.remove(), 220);
    }, visibleMs);
  }catch(error){
    rememberAppIssue('warn','showToast',error);
  }
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
  showToast(message,'warn');
  pendingConfirmAction={
    key,
    until:now+delay,
    timer:setTimeout(()=>{
      if(pendingConfirmAction && pendingConfirmAction.key===key) pendingConfirmAction=null;
    }, delay)
  };
  return false;
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

/* 입력·화면 동기화 */
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
  scheduleAutoSave();
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
function syncBuffChoiceButtons(){
  qsa('.buff-choice-item').forEach(item=>{
    const input=item.querySelector('input[type="checkbox"]');
    const active=!!input && ((input.id==='prodArtifact' && isArtifactDpsViewEnabled()) || input.checked);
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
function syncBattleMode(sourceId=''){
  const solo=$('soloMode'), coop=$('coopMode');
  if(!solo || !coop) return;
  const normalizedCoop=normalizeOnOffValue(coop.value,'OFF');
  syncSelectOptionsBySignature(coop, 'coop-mode-toggle', [{value:'OFF',label:'OFF'},{value:'ON',label:'ON'}]);
  coop.value=normalizedCoop;
  const sourceValue=sourceId==='soloMode' ? normalizeOnOffValue(solo.value,'ON') : normalizeOnOffValue(coop.value,'OFF');
  const coopOn=sourceId==='soloMode' ? sourceValue!=='ON' : sourceValue==='ON';
  solo.value=coopOn ? 'OFF' : 'ON';
  coop.value=coopOn ? 'ON' : 'OFF';
  syncPenanceOptions();
  syncTeamSelect();
}
function syncTeamSelect(){
  const el=$('team');
  if(!el) return;
  el.value=normalizeTeamCountValue(el.value);
}
function resetTeamOnDifficultyChange(){
  syncBattleMode('coopMode');
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

function currentArtifactDpsResult(){
  const diff=vs('diff');
  const battleMode=isCoopMode() ? 'coop' : 'solo';
  if(isTowerDifficulty()){
    return calculateArtifactDpsPreview(TOWER_DIFFICULTY_NAME, 0, challengeTowerFloorStoredValue(), {battleMode:'solo'});
  }
  return calculateArtifactDpsPreview(diff, v('penance'), targetRoundStoredValue(), {battleMode});
}
function updateBattleBoards(s,displayDps,unitHidden=false){
  const info=s?.dpsBaseUnit;
  const enemy=s?.enemyData || {};
  const enemyRound=Math.max(0,Number(enemy.round)||0);
  const unitSlots=currentDpsBaseUnitSlots();
  const selectedIds=unitSlots.filter(Boolean);
  const selectedUnitCount=selectedIds.length;
  const artifactUnitSelected=selectedIds.includes('artifactUnit');
  const artifactPrimarySelected=unitSlots[0]==='artifactUnit';
  const artifactResult=Array.isArray(info?.results) ? info.results.find(result=>result?.unitId==='artifactUnit') : null;
  window.DpsAnimation?.updateBattle({
    dps:Number(displayDps),
    requiredDps:Number(info?.requiredDps),
    achievementRate:Number(info?.achievementRate),
    coop:isCoopMode(),
    battleType:battleDataModeKeyForDifficulty(vs('diff')),
    unitHidden,
    selectedUnitCount,
    enemyCount:enemyRoundDisplayCount(enemyRound),
    enemyHp:Number(enemy.hp),
    enemyShield:Number(enemy.shield),
    enemyArmor:Number(enemy.armor),
    defenseReduce1:Number(s?.M12),
    defenseReduce2:coopPassengerDefenseReduceValue('coopPassenger2Dr'),
    defenseReduce3:coopPassengerDefenseReduceValue('coopPassenger3Dr'),
    artifactUnitSelected,
    artifactPrimarySelected,
    artifactAttackRate:Number(artifactResult?.artifactAttackRate)||0,
    artifactWaveInterval:Number(artifactResult?.artifactWaveInterval)||0
  });
}
function renderDpsSummary(s){
  updateDpsContextSummary();
  syncDpsBaseUnitControl();
  const artifactView=isArtifactDpsViewEnabled();
  setText('dpsMainLabel', artifactView ? '유물 DPS' : 'DPS');
  if(shouldHideDpsForRound()){
    setText('dpsVal', '—');
    renderDpsBaseUnitSummary(s,true);
    updateBattleBoards(s,NaN,true);
    syncDpsMinDpsInputs();
    updateDpsRiskViews(NaN);
    if(isDpsTableOpen()) renderDpsTablePanelContent();
    return;
  }
  const artifactResult=artifactView ? currentArtifactDpsResult() : null;
  const displayDps=artifactView ? artifactResult.dps : s.M19;
  setText('dpsVal', Number.isFinite(displayDps) ? displayDps.toFixed(2) : '—');
  renderDpsBaseUnitSummary(s,false);
  updateBattleBoards(s,displayDps,false);
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
  ['DR2P', ()=>fmt(coopPassengerDefenseReduceValue('coopPassenger2Dr'),0), ()=>fmt(coopPassengerDefenseReduceValue('coopPassenger2Dr'),0)],
  ['DR3P', ()=>fmt(coopPassengerDefenseReduceValue('coopPassenger3Dr'),0), ()=>fmt(coopPassengerDefenseReduceValue('coopPassenger3Dr'),0)],
  ['PIERCE', s=>`${fmt(s.excelPierce,0)}%`, s=>`${fmt(s.excelPierce,0)}%`],
  ['UA', s=>fmt(s.displayUA,4), s=>fmt(s.M13,4)],
  ['SR', s=>fmt(s.displaySR,2), s=>fmt(s.actualSR ?? s.displaySR,2)],
  ['HR', s=>fmt(s.displayHR,2), s=>fmt(s.actualHR ?? s.displayHR,2)],
  ['MD', s=>fmt(s.M16,0), s=>fmt(s.M16,0)],
  ['MP', s=>fmt(s.M17,0), s=>fmt(s.M17,0)],
  ['MCP', s=>fmt(s.M18,0), s=>fmt(s.M18,0)]
];
function renderStatSummary(s){
  const artifactView=isArtifactDpsViewEnabled();
  const coopActive=isCoopActive();
  qsa('[data-coop-stat-row]').forEach(row=>{ row.hidden=!coopActive; });
  STAT_COMPARE_ROWS.forEach(([key,display,actual])=>{
    const displayText=artifactView && key==='PIERCE' ? '0%' : display(s);
    const actualText=artifactView && key==='PIERCE' ? '0%' : actual(s);
    setText('s'+key+'Display', displayText);
    setText('s'+key+'Actual', actualText);
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
  [syncSelectButtons,syncBuffChoiceButtons,syncBattleMode,syncDifficultyTargetControls,syncErosionControlElements,syncPowerBlessOptions,syncDpsBaseUnitConditionSwitches,normalizeAllDpsBaseUnitQuantityInputs,formatAllMoneyInputs].forEach(fn=>fn());
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
  syncSpecDpsSpeedSwitch();
  syncArtifactDpsViewSwitch();
  syncDpsTableLabels();
  renderResourceSummary(s);
  updateTraits();
  renderTraitEfficiencyTop5();
}
function recalc(){
  try{
    syncPreCalculationViews();
    withArtifactDpsViewBuffApplied(()=>renderCalculatedViews(computeStatsRaw()));
    saveState({silent:true});
  }catch(e){rememberAppIssue('error','recalc',e);}
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

const XP_CUT_DIVISOR_ROWS=[
  {stage:'1단계', party3:6},
  {stage:'2단계', party3:12},
  {stage:'3단계', party3:22},
  {stage:'4단계', party3:30}
];
function renderXpCut(){
  const base=Math.max(0, v('sp'))*0.8;
  const target=$('xpCutRows3');
  if(!target) return;
  target.innerHTML=XP_CUT_DIVISOR_ROWS.map(row=>{
    const divisor=row.party3;
    const value=big(base/divisor);
    return `<div class="bus-cut-row"><span class="bus-cut-stage">${row.stage}·${divisor}배</span><span class="bus-cut-value">${value}</span></div>`;
  }).join('');
}

function isArtifactDpsViewEnabled(){
  const toggle=$('artifactDpsViewToggle');
  return toggle?.getAttribute('aria-checked')==='true';
}
function setArtifactDpsViewEnabled(enabled){
  const toggle=$('artifactDpsViewToggle');
  if(!toggle) return;
  toggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
  syncArtifactDpsViewSwitch();
}
function syncArtifactDpsViewSwitch(){
  const toggle=$('artifactDpsViewToggle');
  if(!toggle) return;
  const active=isArtifactDpsViewEnabled();
  toggle.classList.toggle('is-active', active);
  toggle.setAttribute('aria-checked', active ? 'true' : 'false');
}
function syncOnOffSwitch(toggle,{active=false,disabled=false,label='설정',containerSelector=''}){
  if(!toggle) return;
  toggle.disabled=disabled;
  toggle.classList.toggle('is-active',active);
  toggle.setAttribute('aria-checked',active ? 'true' : 'false');
  toggle.setAttribute('aria-disabled',disabled ? 'true' : 'false');
  toggle.setAttribute('aria-label',`${label} ${active ? 'ON' : 'OFF'}`);
  if(containerSelector) toggle.closest(containerSelector)?.classList.toggle('is-disabled',disabled);
}
function syncSpecDpsSpeedSwitch(){
  const toggle=$('specDpsSpeedModeToggle');
  const input=$('specDpsSpeedMode');
  if(!toggle || !input) return;
  const disabled=!speedModeSupported();
  if(disabled) input.value='OFF';
  const active=!disabled && storedSpeedModeEnabled('specDpsSpeedMode');
  syncOnOffSwitch(toggle,{active,disabled,label:'스피드 모드',containerSelector:'.spec-dps-speed-switch-wrap'});
}
function toggleSpecDpsSpeedMode(){
  const input=$('specDpsSpeedMode');
  const toggle=$('specDpsSpeedModeToggle');
  if(!input || toggle?.disabled || !speedModeSupported()) return false;
  input.value=storedSpeedModeEnabled('specDpsSpeedMode') ? 'OFF' : 'ON';
  syncSpecDpsSpeedSwitch();
  requestAppUpdate();
  scheduleAutoSave();
  return true;
}
/* 유닛 보드 전투 모드·적 방어 효과 스위치 */
function syncDpsBaseUnitConditionSwitch(toggle){
  if(!toggle) return;
  const inputId=toggle.dataset.dpsBaseUnitConditionToggle || '';
  const input=$(inputId);
  const disabled=dpsBaseUnitConditionLocked(inputId);
  if(disabled && input) input.value='OFF';
  const active=!disabled && storedSpeedModeEnabled(inputId);
  const label=toggle.dataset.dpsBaseUnitConditionLabel || '설정';
  syncOnOffSwitch(toggle,{active,disabled,label,containerSelector:'.dps-base-unit-condition-item'});
}
function syncDpsBaseUnitConditionSwitches(){
  qsa('[data-dps-base-unit-condition-toggle]').forEach(syncDpsBaseUnitConditionSwitch);
}
function toggleDpsBaseUnitCondition(toggle){
  const inputId=toggle?.dataset?.dpsBaseUnitConditionToggle || '';
  const input=$(inputId);
  if(!input || toggle.disabled || dpsBaseUnitConditionLocked(inputId)) return false;
  input.value=storedSpeedModeEnabled(inputId) ? 'OFF' : 'ON';
  syncDpsBaseUnitConditionSwitch(toggle);
  requestAppUpdate();
  scheduleAutoSave();
  return true;
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
/* 모달·비교·DPS표 */
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
    scheduleAutoSave();
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
  const card=$('statDpsSummary');
  const badge=$('dpsRiskBadge');
  const dpsEl=$('dpsVal');
  if(!card) return;
  const minDps=parseDpsTableMinDps();
  const raw=Number.isFinite(currentDps) ? currentDps : Number(String(dpsEl?.textContent||'').replace(/,/g,'').trim());
  const isRisk=minDps!==null && Number.isFinite(raw) && raw<=minDps;
  card.classList.toggle('is-dps-risk', isRisk);
  if(badge) badge.setAttribute('aria-hidden', String(!isRisk));
}

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
function buildCoopDpsMatrix(round){
  return buildPenanceDpsMatrix({
    difficulties:COOP_DPS_TABLE_DIFFICULTIES,
    penanceMin:COOP_DPS_TABLE_PENANCE_MIN,
    penanceMax:COOP_DPS_TABLE_PENANCE_MAX,
    currentPen:v('penance'),
    round,
    previewOptions:{battleMode:'coop'},
    tableClass:'dps-coop-matrix'
  });
}
function buildCoopDpsTable(round){
  return `
    <section class="dps-coop-block" aria-label="협동 3인 DPS표">
      <header class="dps-coop-head"><b>협동 3인</b><span>${round}라운드 · 0~13고행</span></header>
      <div class="dps-table-scroll dps-coop-scroll">${buildCoopDpsMatrix(round)}</div>
    </section>
  `;
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
function dpsTablePanelInnerHtml(){
  const round=normalizedRoundNumber(targetRoundStoredValue());
  syncDpsMinDpsInputs();
  const tableHtml=activeDpsTableMode==='tower'
    ? `<div class="dps-table-scroll">${buildDpsTowerTable()}</div>`
    : activeDpsTableMode==='coop'
      ? buildCoopDpsTable(round)
      : `<div class="dps-table-scroll">${buildDpsTable(round)}</div>`;
  const modeClass=activeDpsTableMode==='tower' ? 'dps-tower-panel' : (activeDpsTableMode==='coop' ? 'dps-coop-panel' : 'dps-solo-panel');
  return `<section class="dps-table-panel dps-table-mode-panel ${modeClass}">${tableHtml}</section>`;
}
function syncDpsTableModalModeClass(){
  const dialog=$('monthRuneModal')?.querySelector('.month-rune-modal');
  const mode=DPS_MODAL_MODES.includes(activeDpsTableMode) ? activeDpsTableMode : 'solo';
  window.DpsModal?.syncModeClasses(dialog, DPS_MODAL_MODES, mode);
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
  window.DpsModal.openMonthRune('dps');
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
      <b>${escapeHtml(code)}</b>
      <span>${escapeHtml(desc)}</span>
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
function getJewelImageSources(name){
  const safeName=encodeURIComponent(String(name||'').trim());
  const key=`jw/${String(name||'').trim()}.png`;
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
      <b>${escapeHtml(label)}</b>
      <span>${escapeHtml(value)}</span>
    </div>
  `;
}
function renderJewelCard(row){
  const name=String(row?.[0]||'');
  const legendary=String(row?.[1]||'');
  const mythic=String(row?.[2]||'');
  const initial=name ? name.charAt(0) : '?';
  const imageSources=getJewelImageSources(name);
  const fallbackAttr=imageSources.fallback && imageSources.fallback!==imageSources.src ? ` data-fallback-src="${escapeHtml(imageSources.fallback)}"` : '';
  return `
    <article class="jewel-card">
      <header class="jewel-card-head">
        <div class="jewel-card-visual" aria-hidden="true">
          <img src="${escapeHtml(imageSources.src)}"${fallbackAttr} data-jewel-image="1" alt="" loading="lazy">
          <span>${escapeHtml(initial)}</span>
        </div>
        <b>${escapeHtml(name)}</b>
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
  const noteHtml=noteText ? `<div class="month-rune-note">${escapeHtml(noteText)}</div>` : '';
  return `${noteHtml}<div class="month-rune-grid">${content}</div>`;
}
function renderJewelPanelContent(items){
  const list=Array.isArray(items)?items:[];
  const content=list.length ? list.map(renderJewelCard).join('') : '<div class="month-rune-empty">쥬얼 데이터가 없습니다.</div>';
  return `<div class="jewel-grid">${content}</div>`;
}
function renderMonthRuneModalPanel(name,content,active=false){
  return `<section class="month-rune-panel${active?' is-active':''}" data-month-rune-panel="${name}" role="tabpanel" aria-labelledby="monthRuneTitle"${active?'':' hidden'}>${content}</section>`;
}
function syncComparePanelAfterRender(){
  hydrateCompareControls();
  if(compareState.lastResult) renderExcelComparison(compareState.lastResult,{preserveFilter:true});
  else if(compareState.sourceType==='json' && compareState.backupState) renderJsonComparison(compareState.backupState);
  else if(compareState.sourceType==='traitPreset' && compareState.traitPresetBundle) compareSelectedTraitPreset({preserveRestore:true});
  else if(compareState.workbook && compareState.sourceType==='excel') compareSelectedExcelSheet({preserveRestore:true});
  else updateCompareActionButtons();
}
/* 파일 해석·비교 상태 */

const compareState={workbook:null,backupState:null,traitPresetBundle:null,baseTraitPresetBundle:null,baseFileRejected:false,sourceType:null,lastResult:null,activeFilter:'all',restoreState:null,restoreJewelSettings:null,restoreTraitPresetStatus:null,applied:false,selectedSheetName:'',baseTraitPresetId:''};
function resetCompareState(){Object.assign(compareState,{workbook:null,backupState:null,traitPresetBundle:null,baseFileRejected:false,sourceType:null,lastResult:null,activeFilter:'all',restoreState:null,restoreJewelSettings:null,restoreTraitPresetStatus:null,applied:false,selectedSheetName:'',baseTraitPresetId:''});}
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
const EXCEL_ZIP_LIMITS=Object.freeze({maxEntries:4096,maxEntryBytes:64*1024*1024,maxDecodedBytes:128*1024*1024});
function readU16(view, offset){ return view.getUint16(offset,true); }
function readU32(view, offset){ return view.getUint32(offset,true); }
function ensureZipRange(length,offset,size,message){
  if(!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset<0 || size<0 || offset+size>length) throw new Error(message);
}
function normalizeExcelZipPath(target){
  const raw=String(target || '').replace(/\\/g,'/').trim();
  if(!raw) return '';
  const source=raw.startsWith('/') ? raw.slice(1) : `xl/${raw}`;
  const parts=[];
  for(const part of source.split('/')){
    if(!part || part==='.') continue;
    if(part==='..'){
      if(!parts.length) return '';
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join('/');
}
async function inflateZipEntry(bytes,expectedSize=0){
  if(typeof DecompressionStream!=='function') throw new Error('이 브라우저는 XLSM 압축 해제를 지원하지 않습니다.');
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const data=new Uint8Array(await new Response(stream).arrayBuffer());
  if(expectedSize>0 && data.length!==expectedSize) throw new Error('엑셀파일 압축 데이터 크기가 올바르지 않습니다.');
  return data;
}
async function readZipDirectory(file){
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes.length<22) throw new Error('올바른 엑셀파일이 아닙니다.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let eocd=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
    if(readU32(view,i)!==0x06054b50) continue;
    const commentLength=readU16(view,i+20);
    if(i+22+commentLength===bytes.length){ eocd=i; break; }
  }
  if(eocd<0) throw new Error('올바른 엑셀파일이 아닙니다.');
  ensureZipRange(bytes.length,eocd,22,'엑셀파일 ZIP 끝 정보를 읽을 수 없습니다.');
  const diskNumber=readU16(view,eocd+4);
  const centralDisk=readU16(view,eocd+6);
  const diskEntryCount=readU16(view,eocd+8);
  const count=readU16(view,eocd+10);
  const centralSize=readU32(view,eocd+12);
  let pos=readU32(view,eocd+16);
  if(diskNumber!==0 || centralDisk!==0 || diskEntryCount!==count) throw new Error('분할 ZIP 형식의 엑셀파일은 지원하지 않습니다.');
  if(count===0xffff || centralSize===0xffffffff || pos===0xffffffff) throw new Error('ZIP64 형식의 엑셀파일은 지원하지 않습니다.');
  if(count>EXCEL_ZIP_LIMITS.maxEntries) throw new Error('엑셀파일의 내부 항목 수가 너무 많습니다.');
  ensureZipRange(bytes.length,pos,centralSize,'엑셀파일 ZIP 목록 위치가 올바르지 않습니다.');
  if(pos+centralSize>eocd) throw new Error('엑셀파일 ZIP 목록 크기가 올바르지 않습니다.');
  const decoder=new TextDecoder('utf-8');
  const entries=new Map();
  for(let i=0;i<count;i++){
    ensureZipRange(bytes.length,pos,46,'엑셀파일 ZIP 목록을 읽을 수 없습니다.');
    if(readU32(view,pos)!==0x02014b50) throw new Error('엑셀파일 ZIP 목록을 읽을 수 없습니다.');
    const flags=readU16(view,pos+8);
    const method=readU16(view,pos+10);
    const compressedSize=readU32(view,pos+20);
    const uncompressedSize=readU32(view,pos+24);
    const nameLength=readU16(view,pos+28);
    const extraLength=readU16(view,pos+30);
    const commentLength=readU16(view,pos+32);
    const localOffset=readU32(view,pos+42);
    const recordSize=46+nameLength+extraLength+commentLength;
    ensureZipRange(bytes.length,pos,recordSize,'엑셀파일 ZIP 항목 정보가 손상되었습니다.');
    if(flags&1) throw new Error('암호화된 엑셀파일은 지원하지 않습니다.');
    if(compressedSize>EXCEL_ZIP_LIMITS.maxEntryBytes || uncompressedSize>EXCEL_ZIP_LIMITS.maxEntryBytes) throw new Error('엑셀파일 내부 항목이 너무 큽니다.');
    const name=decoder.decode(bytes.slice(pos+46,pos+46+nameLength)).replace(/\\/g,'/').replace(/^\/+/, '');
    ensureZipRange(bytes.length,localOffset,30,'엑셀파일 ZIP 항목 위치가 올바르지 않습니다.');
    if(readU32(view,localOffset)!==0x04034b50) throw new Error('엑셀파일 ZIP 항목을 읽을 수 없습니다.');
    const localNameLength=readU16(view,localOffset+26);
    const localExtraLength=readU16(view,localOffset+28);
    ensureZipRange(bytes.length,localOffset+30,localNameLength+localExtraLength,'엑셀파일 ZIP 항목 정보가 손상되었습니다.');
    const localName=decoder.decode(bytes.slice(localOffset+30,localOffset+30+localNameLength)).replace(/\\/g,'/').replace(/^\/+/, '');
    if(localName!==name) throw new Error('엑셀파일 ZIP 항목 이름이 일치하지 않습니다.');
    const dataOffset=localOffset+30+localNameLength+localExtraLength;
    ensureZipRange(bytes.length,dataOffset,compressedSize,'엑셀파일 ZIP 압축 데이터가 손상되었습니다.');
    if(name && !name.endsWith('/')){
      if(entries.has(name)) throw new Error('엑셀파일 ZIP 항목 이름이 중복되었습니다.');
      entries.set(name,{method,compressedSize,uncompressedSize,dataOffset});
    }
    pos+=recordSize;
  }
  if(pos>eocd) throw new Error('엑셀파일 ZIP 목록이 손상되었습니다.');
  return {bytes,entries,cache:new Map(),decodedBytes:0};
}
async function readZipEntry(zip,name,{required=true}={}){
  if(zip.cache.has(name)) return zip.cache.get(name);
  const entry=zip.entries.get(name);
  if(!entry){
    if(required) throw new Error(`엑셀파일 내부 항목을 찾을 수 없습니다. (${name})`);
    return null;
  }
  const compressed=zip.bytes.slice(entry.dataOffset,entry.dataOffset+entry.compressedSize);
  let data;
  if(entry.method===0){
    data=compressed;
    if(data.length!==entry.uncompressedSize) throw new Error('엑셀파일 저장 데이터 크기가 올바르지 않습니다.');
  }else if(entry.method===8) data=await inflateZipEntry(compressed,entry.uncompressedSize);
  else throw new Error(`지원하지 않는 엑셀파일 압축 방식입니다. (${entry.method})`);
  if(data.length>EXCEL_ZIP_LIMITS.maxEntryBytes) throw new Error('엑셀파일 내부 항목이 너무 큽니다.');
  zip.decodedBytes+=data.length;
  if(zip.decodedBytes>EXCEL_ZIP_LIMITS.maxDecodedBytes) throw new Error('엑셀파일 압축 해제 크기가 너무 큽니다.');
  zip.cache.set(name,data);
  return data;
}
function parseXml(bytes){
  if(!bytes) throw new Error('엑셀파일 XML을 찾을 수 없습니다.');
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
    const inlineText=xmlLocalAll(cell,'t').map(node=>node.textContent || '').join('');
    cells[ref]=type==='s' ? (sharedStrings[Number(value)] ?? '') : (type==='inlineStr' ? inlineText : value);
  });
  return cells;
}
async function readExcelWorkbook(file){
  const zip=await readZipDirectory(file);
  const [workbookBytes,relsBytes,sharedBytes]=await Promise.all([
    readZipEntry(zip,'xl/workbook.xml'),
    readZipEntry(zip,'xl/_rels/workbook.xml.rels'),
    readZipEntry(zip,'xl/sharedStrings.xml',{required:false})
  ]);
  const workbook=parseXml(workbookBytes);
  const rels=parseXml(relsBytes);
  const relMap={};
  xmlLocalAll(rels,'Relationship').forEach(rel=>{ relMap[rel.getAttribute('Id')]=rel.getAttribute('Target'); });
  const shared=[];
  if(sharedBytes){
    const sharedDoc=parseXml(sharedBytes);
    xmlLocalAll(sharedDoc,'si').forEach(si=>shared.push(xmlLocalAll(si,'t').map(t=>t.textContent||'').join('')));
  }
  const sheets=xmlLocalAll(workbook,'sheet').map(node=>{
    const name=node.getAttribute('name');
    const relId=node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id') || node.getAttribute('r:id');
    const path=normalizeExcelZipPath(relMap[relId]);
    return {name,path};
  }).filter(sheet=>sheet.name&&sheet.path&&zip.entries.has(sheet.path));
  if(!sheets.length) throw new Error('비교할 엑셀 시트를 찾을 수 없습니다.');
  const sheetBytes=new Map();
  await Promise.all([...new Set(sheets.map(sheet=>sheet.path))].map(async path=>{
    sheetBytes.set(path,await readZipEntry(zip,path));
  }));
  const cellCache=new Map();
  return {
    fileName:file.name,
    sheets,
    getCells(sheetName){
      if(cellCache.has(sheetName)) return cellCache.get(sheetName);
      const sheet=sheets.find(item=>item.name===sheetName);
      if(!sheet) throw new Error('선택한 시트를 찾을 수 없습니다.');
      const cells=excelCellMap(parseXml(sheetBytes.get(sheet.path)),shared);
      cellCache.set(sheetName,cells);
      return cells;
    }
  };
}
const EXCEL_JEWEL_SHEET_NAME='쥬얼';
function excelJewelNumber(value){
  const number=excelCompareNumberValue(value);
  return number===null ? 0 : number;
}
function excelJewelPercent(value){
  const number=excelJewelNumber(value);
  if(number===0) return 0;
  return Math.abs(number)<=1 ? number*100 : number;
}
function emptyExcelJewelSettings(){
  return {schemaVersion:1,legendaryMythicJewels:normalizeDpsJewelSettings({})};
}
function readExcelJewelSettings(workbook){
  const sheetNames=(workbook?.sheets || []).map(sheet=>sheet.name);
  if(!sheetNames.includes(EXCEL_JEWEL_SHEET_NAME)){
    return {present:false,settings:null,recognizedLegendary:0};
  }
  const cells=workbook.getCells(EXCEL_JEWEL_SHEET_NAME);
  const settings=emptyExcelJewelSettings();
  const rowNumbers=Object.keys(cells).map(ref=>Number(String(ref).match(/\d+$/)?.[0])).filter(row=>Number.isFinite(row) && row>=3);
  const maxRow=Math.max(2,...rowNumbers);
  let recognizedLegendary=0;
  for(let row=3;row<=maxRow;row++){
    const raw={
      ad:cells[`B${row}`],as:cells[`C${row}`],td:cells[`D${row}`],ua:cells[`E${row}`],
      name:cells[`F${row}`],enhance:cells[`G${row}`],mythic:cells[`H${row}`]
    };
    const legendaryName=normalizeDpsJewelName(String(raw.name ?? '').trim());
    if(!legendaryName) continue;
    settings.legendaryMythicJewels[legendaryName]=normalizeDpsJewelSetting({
      ad:excelJewelNumber(raw.ad),
      as:excelJewelNumber(raw.as),
      td:excelJewelNumber(raw.td),
      ua:excelJewelPercent(raw.ua),
      enhance:excelJewelNumber(raw.enhance),
      mythic:String(raw.mythic ?? '').trim().toUpperCase()==='Y' ? 'Y' : 'N'
    });
    recognizedLegendary++;
  }
  return {present:true,settings,recognizedLegendary};
}
function applyExcelJewelSettings(jewelImport){
  if(!jewelImport?.present || !jewelImport.settings) return false;
  applyTraitPresetJewelSettings(jewelImport.settings);
  sanitizeDpsJewelSelections();
  syncDpsBaseUnitControl();
  return true;
}
function applyExcelJewelImport(workbook,saveError,rollbackLabel){
  const previousJewelSettings=captureTraitPresetJewelSettings();
  try{
    const jewelImport=readExcelJewelSettings(workbook);
    if(!jewelImport.present || !jewelImport.settings) throw new Error('선택한 엑셀파일에 쥬얼 시트가 없습니다.');
    applyExcelJewelSettings(jewelImport);
    if(saveState({silent:true})===false) throw new Error(saveError);
    return {jewelImport,previousJewelSettings,staged:stageTraitPresetJewelSettings(jewelImport.settings)};
  }catch(error){
    try{
      applyTraitPresetJewelSettings(previousJewelSettings);
      sanitizeDpsJewelSelections();
      syncDpsBaseUnitControl();
    }catch(rollbackError){ rememberAppIssue('error',rollbackLabel,rollbackError); }
    throw error;
  }
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
function escapeHtml(value){
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
  if(id==='pbless') return powerBlessOptionLabel(normalizePowerBlessRawValue(value));
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
  return {kind,name,current:escapeHtml(currentText),change:escapeHtml(changeText),
    difference:same?'일치':escapeHtml(changeText),status:same?'same':'diff',diffClass:same?'diff-same':'diff-text'};
}
function normalizeCompareDetailItems(items){
  return (Array.isArray(items) ? items : []).map(item=>{
    const pair=Array.isArray(item) ? item : [item?.label,item?.value];
    return {label:String(pair[0]??'').trim(),value:String(pair[1]??'—').trim() || '—'};
  }).filter(item=>item.label);
}
function compareDetailHtml(items){
  const normalized=normalizeCompareDetailItems(items);
  return `<dl class="compare-detail-list">${normalized.map(item=>`<div class="compare-detail-item"><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join('')}</dl>`;
}
function compareDetailItemsKey(items){
  return JSON.stringify(normalizeCompareDetailItems(items).map(item=>[compareNormalizedText(item.label),compareNormalizedText(item.value)]));
}
function compareChangedDetailItems(changeItems,currentItems){
  const change=normalizeCompareDetailItems(changeItems);
  const current=normalizeCompareDetailItems(currentItems);
  const currentByLabel=new Map(current.map(item=>[compareNormalizedText(item.label),compareNormalizedText(item.value)]));
  const changeLabels=new Set(change.map(item=>compareNormalizedText(item.label)));
  const changed=change.filter(item=>currentByLabel.get(compareNormalizedText(item.label))!==compareNormalizedText(item.value));
  current.forEach(item=>{
    if(!changeLabels.has(compareNormalizedText(item.label))) changed.push({label:item.label,value:'없음'});
  });
  return changed;
}
function buildCompareDetailRow(kind,name,changeItems,currentItems){
  const same=compareDetailItemsKey(changeItems)===compareDetailItemsKey(currentItems);
  const changedItems=same ? [] : compareChangedDetailItems(changeItems,currentItems);
  return {
    kind,
    name,
    current:compareDetailHtml(currentItems),
    change:compareDetailHtml(changeItems),
    difference:same?'일치':compareDetailHtml(changedItems.length ? changedItems : changeItems),
    status:same?'same':'diff',
    diffClass:same?'diff-same':'diff-text',
    rowClass:'is-detail-row'
  };
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
  coopPassenger2Dr:{kind:'기본 정보',name:'승객 2P 방어력 감소',compare:true,save:true,excel:'select'},
  coopPassenger3Dr:{kind:'기본 정보',name:'승객 3P 방어력 감소',compare:true,save:true,excel:'select'},
  team:{kind:'기본 정보',name:'출발 지원 인원수',compare:true,save:true,excel:'number'},
  pbless:{kind:'기본 정보',name:'파워 블레스',compare:true,save:true,excel:'select'},
  spBankApply:{kind:'기본 정보',name:'SP 은행',compare:true,save:true},
  penance:{kind:'기본 정보',name:'고행 단계',compare:true,save:true,excel:'number'},
  titleTdBonus:{kind:'기본 정보',name:'타이틀 총 데미지',compare:true,save:true,excel:'number'},
  dpsTableMinDps:{kind:'기본 정보',name:'도전할 최소 DPS',compare:true,save:true,excel:'number'},
  specDpsSpeedMode:{kind:'스펙 보드',name:'스피드 모드',compare:true,save:true},
  dpsBaseUnits:{kind:'유닛 보드',name:'유닛 구성',save:true},
  dpsBaseUnitSlots:{kind:'유닛 보드',name:'유닛 선택 위치',save:true},
  dpsJewelSettings:{kind:'쥬얼 설정',name:'전설·신화 쥬얼',save:true},
  dpsBaseUnitExtraSettings:{kind:'유닛 보드',name:'추가 유닛 쥬얼 & 한계 돌파',save:true},
  dpsBaseUnitSlotExpansions:{kind:'유닛 보드',name:'슬롯 확장',save:true},
  dpsBaseUnitSpeedMode:{kind:'유닛 보드',name:'스피드 모드',compare:true,save:true},
  dpsBaseUnitShieldOff:{kind:'유닛 보드',name:'적버프 제거 · 쉴드오프',compare:true,save:true},
  dpsBaseUnitShieldMaster:{kind:'유닛 보드',name:'슈퍼실드 주기변경 · 쉴드마스',compare:true,save:true},
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

/* 유닛 보드 상태·표시 */
function dpsBaseUnitFieldEntries(){
  const units=dpsBaseUnitList();
  const quantityEntries=units.filter(dpsBaseUnitHasQuantity).map(unit=>[
    dpsBaseUnitQuantityInputId(unit),
    {kind:'유닛 보드',name:`${unit.label || unit.id} 수량`,compare:true,save:true}
  ]);
  const settingEntries=units.flatMap(unit=>{
    const entries=[[dpsBaseUnitEnhanceInputId(unit),{kind:'유닛 보드',name:`${unit.label || unit.id} 강화 기대값`,compare:true,save:true}]];
    if(dpsBaseUnitSupportsAdvancedOptions(unit)) entries.push(
      [dpsBaseUnitLimitBreakInputId(unit),{kind:'유닛 보드',name:`${unit.label || unit.id} 한계 돌파`,compare:true,save:true}],
      [dpsBaseUnitJewelInputId(unit),{kind:'유닛 보드',name:`${unit.label || unit.id} 전설·신화 쥬얼`,compare:true,save:true}],
      [dpsBaseUnitVoidPowerInputId(unit),{kind:'유닛 보드',name:`${unit.label || unit.id} 공허의 힘`,compare:true,save:true}]
    );
    return entries;
  });
  return [...quantityEntries,...settingEntries];
}
Object.assign(FIELD_REGISTRY, Object.fromEntries(dpsBaseUnitFieldEntries()));
const DPS_BASE_UNIT_ENHANCE_IDS=new Set(dpsBaseUnitList().map(dpsBaseUnitEnhanceInputId));
const DPS_BASE_UNIT_ADVANCED_OPTION_UNITS=dpsBaseUnitList().filter(dpsBaseUnitSupportsAdvancedOptions);
const DPS_BASE_UNIT_LIMIT_BREAK_IDS=new Set(DPS_BASE_UNIT_ADVANCED_OPTION_UNITS.map(dpsBaseUnitLimitBreakInputId));
const DPS_BASE_UNIT_JEWEL_IDS=new Set(DPS_BASE_UNIT_ADVANCED_OPTION_UNITS.map(dpsBaseUnitJewelInputId));
const DPS_BASE_UNIT_VOID_POWER_IDS=new Set(DPS_BASE_UNIT_ADVANCED_OPTION_UNITS.map(dpsBaseUnitVoidPowerInputId));
const fieldEntriesByFlag=flag=>Object.entries(FIELD_REGISTRY).filter(([,field])=>field[flag]).map(([id])=>id);
const EXCEL_NUMERIC_INPUT_IDS=new Set(Object.entries(FIELD_REGISTRY).filter(([,field])=>field.excel==='number').map(([id])=>id));
const EXCEL_SELECT_INPUT_IDS=new Set(Object.entries(FIELD_REGISTRY).filter(([,field])=>field.excel==='select').map(([id])=>id));
const COMPARE_VALUE_META=Object.fromEntries(Object.entries(FIELD_REGISTRY).filter(([,field])=>field.compare).map(([id,field])=>[id,{kind:field.kind,name:field.name}]));
const USER_STATE_VALUE_IDS=new Set(fieldEntriesByFlag('save'));
function normalizeDpsBaseUnitSlotExpansions(value){
  let source=value;
  if(typeof source==='string'){
    try{ source=JSON.parse(source || '[]'); }catch{ source=source.split('|'); }
  }
  if(!Array.isArray(source)) source=[];
  const valid=new Set(dpsBaseUnitList().filter(dpsBaseUnitAllowsSlotExpansion).map(unit=>unit.id));
  return source.map(id=>String(id || '').trim()).filter((id,index,list)=>valid.has(id) && list.indexOf(id)===index);
}
function serializeDpsBaseUnitSlotExpansions(value){
  return JSON.stringify(normalizeDpsBaseUnitSlotExpansions(value));
}
function dpsBaseUnitSlotExpansionIds(){
  return normalizeDpsBaseUnitSlotExpansions($('dpsBaseUnitSlotExpansions')?.value || '[]');
}
function dpsBaseUnitSlotExpanded(unitOrId){
  const unit=typeof unitOrId==='string' ? dpsBaseUnitById(unitOrId) : unitOrId;
  return !!unit && dpsBaseUnitSlotExpansionIds().includes(unit.id);
}
function toggleDpsBaseUnitSlotExpansion(unitId){
  const unit=dpsBaseUnitById(unitId);
  const store=$('dpsBaseUnitSlotExpansions');
  if(!unit || !store || !dpsBaseUnitAllowsSlotExpansion(unit)) return false;
  const ids=dpsBaseUnitSlotExpansionIds();
  const index=ids.indexOf(unit.id);
  if(index>=0) ids.splice(index,1);
  else ids.push(unit.id);
  store.value=serializeDpsBaseUnitSlotExpansions(ids);
  syncDpsBaseUnitControl();
  return index<0;
}
const DPS_BASE_UNIT_SLOT_SEPARATOR='|';
function emptyDpsBaseUnitSlots(){
  return Array.from({length:dpsBaseUnitSelectionLimit()},()=> '');
}
function normalizeDpsBaseUnitSlotValues(value){
  const validIds=new Set(dpsBaseUnitList().map(unit=>unit.id));
  const source=Array.isArray(value) ? value : String(value ?? '').split(DPS_BASE_UNIT_SLOT_SEPARATOR);
  const slots=emptyDpsBaseUnitSlots();
  const used=new Set();
  for(let i=0;i<slots.length;i++){
    const id=String(source[i] ?? '').trim();
    if(!id || !validIds.has(id) || used.has(id)) continue;
    slots[i]=id;
    used.add(id);
  }
  return slots;
}
function serializeDpsBaseUnitSlots(slots){
  const normalized=normalizeDpsBaseUnitSlotValues(slots);
  return normalized.some(Boolean) ? normalized.join(DPS_BASE_UNIT_SLOT_SEPARATOR) : '';
}
function compactDpsBaseUnitSlots(ids){
  const slots=emptyDpsBaseUnitSlots();
  dpsBaseUnitSelectionIds(ids).slice(0,slots.length).forEach((id,index)=>{ slots[index]=id; });
  return slots;
}
function reconcileDpsBaseUnitSlots(currentSlots, selectedIds){
  const selected=dpsBaseUnitSelectionIds(selectedIds).slice(0,dpsBaseUnitSelectionLimit());
  const selectedSet=new Set(selected);
  const slots=normalizeDpsBaseUnitSlotValues(currentSlots).map(id=>selectedSet.has(id) ? id : '');
  selected.forEach(id=>{
    if(slots.includes(id)) return;
    const emptyIndex=slots.indexOf('');
    if(emptyIndex>=0) slots[emptyIndex]=id;
  });
  return slots;
}
function currentDpsBaseUnitSlots(){
  const raw=vs('dpsBaseUnitSlots');
  return raw ? normalizeDpsBaseUnitSlotValues(raw) : compactDpsBaseUnitSlots(vs('dpsBaseUnits'));
}
function sortedDpsBaseUnits(){
  const units=dpsBaseUnitList();
  const gradeOrder=dpsBaseUnitGradeOrder();
  const raceOrder=dpsBaseUnitRaceOrder();
  const orderIndex=(order,value)=>{ const index=order.indexOf(value); return index<0 ? order.length : index; };
  return units.slice().sort((a,b)=>
    orderIndex(gradeOrder,a.grade)-orderIndex(gradeOrder,b.grade) || orderIndex(raceOrder,a.raceGroup)-orderIndex(raceOrder,b.raceGroup) || units.indexOf(a)-units.indexOf(b)
  );
}
let dpsBaseUnitResultDisplayMap=new Map();
let dpsBaseUnitBoardBasePierce=10;

function dpsBaseUnitPercentText(value){
  const num=Number(value);
  if(!Number.isFinite(num)) return '—';
  const fixed=Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, '');
  return `${fixed}%`;
}
function dpsBaseUnitTruncatedCompactAmount(value,divisor,digits){
  const factor=10**digits;
  const amount=Math.trunc((value/divisor)*factor)/factor;
  return amount.toLocaleString('ko-KR',{minimumFractionDigits:0,maximumFractionDigits:digits});
}
const DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS=Object.freeze({trillion:true,roundTenThousands:true});
function dpsBaseUnitNumberText(value,options={}){
  const number=Number(value);
  if(!Number.isFinite(number)) return '—';
  const sign=number<0 ? '-' : '';
  const absolute=Math.abs(number);
  const compact=(divisor,suffix,digits=2)=>`${sign}${dpsBaseUnitTruncatedCompactAmount(absolute,divisor,digits)}${suffix}`;
  if(options.trillion && absolute>=1000000000000) return compact(1000000000000,'조');
  if(absolute>=100000000) return compact(100000000,'억');
  if(absolute>=10000){
    const convert=options.roundTenThousands ? Math.round : Math.floor;
    return `${sign}${convert(absolute/10000).toLocaleString('ko-KR')}만`;
  }
  if(options.smallDecimals && absolute<1000) return `${sign}${absolute.toFixed(2)}`;
  return `${sign}${Math.round(absolute).toLocaleString('ko-KR')}`;
}
function dpsBaseUnitDpsText(item){
  return dpsBaseUnitNumberText(item?.M19,{smallDecimals:true});
}
function dpsBaseUnitAttackText(item){
  const value=Number(item?.weaponAttack);
  if(!Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR',{minimumFractionDigits:0,maximumFractionDigits:2});
}
function dpsBaseUnitSummaryMarkup(text){
  const value=String(text??'—');
  const match=value.match(/^(.*?)(조|억|만|%)$/);
  if(!match) return `<span class="dps-num-main">${value}</span>`;
  return `<span class="dps-num-main">${match[1]}<span class="dps-num-unit">${match[2]}</span></span>`;
}
function dpsBaseUnitAchievementPercent(value){
  const number=Math.max(0,Number(value));
  return Number.isFinite(number) ? Math.trunc(number) : null;
}
function dpsBaseUnitAchievementText(value){
  const percent=dpsBaseUnitAchievementPercent(value);
  return percent===null ? '—' : `${percent.toLocaleString('ko-KR')}%`;
}
function dpsBaseUnitAchievementState(value){
  const percent=dpsBaseUnitAchievementPercent(value);
  if(percent===null || percent<100) return {label:'달성률 부족',status:'부족'};
  if(percent===100) return {label:'달성률 달성',status:'달성'};
  return {label:'달성률 초과',status:'초과'};
}
function renderDpsBaseUnitSummary(s,hidden=false){
  const el=$('dpsBaseUnitSummary');
  if(!el) return;
  const info=s?.dpsBaseUnit;
  const results=Array.isArray(info?.results) ? info.results : [];
  const rpPierce=Number(info?.rpPierce)||0;
  const basePierce=Number(info?.basePierceBonus)||0;
  dpsBaseUnitBoardBasePierce=basePierce+rpPierce;
  dpsBaseUnitResultDisplayMap=new Map((hidden ? [] : results).map(item=>[String(item?.unitId || ''),item]).filter(([id])=>id));
  syncDpsBaseUnitControl();
  const requiredDps=Number(info?.requiredDps);
  if(hidden || !Number.isFinite(requiredDps) || requiredDps<=0){
    el.hidden=true;
    el.innerHTML='';
    return;
  }
  const expectedDps=Math.max(0,Number(info?.expectedDps)||0);
  const achievementRate=Math.max(0,Number(info?.achievementRate)||0);
  const achievementState=dpsBaseUnitAchievementState(achievementRate);
  el.innerHTML=`<div class="dps-base-unit-summary-row"><div class="dps-base-unit-summary-item"><span class="dps-lbl">클리어 기준</span><b class="dps-num">${dpsBaseUnitSummaryMarkup(dpsBaseUnitNumberText(requiredDps,DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS))}</b></div><div class="dps-base-unit-summary-item"><span class="dps-lbl">클리어 기대값</span><b class="dps-num">${dpsBaseUnitSummaryMarkup(dpsBaseUnitNumberText(expectedDps,DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS))}</b></div><div class="dps-base-unit-summary-item"><span class="dps-lbl">${achievementState.label}</span><b class="dps-num">${dpsBaseUnitSummaryMarkup(dpsBaseUnitAchievementText(achievementRate))}</b></div></div>`;
  el.hidden=false;
}
function appendDpsBaseUnitStoreInput(store,id,value,dataName,unitId){
  if($(id)) return $(id);
  const input=document.createElement('input');
  input.type='hidden';
  input.id=id;
  input.value=String(value);
  input.setAttribute(dataName,unitId);
  store.appendChild(input);
  return input;
}
function ensureDpsBaseUnitStore(){
  const store=$('dpsBaseUnitQuantityStore');
  if(!store) return;
  dpsBaseUnitList().forEach(unit=>{
    if(dpsBaseUnitHasQuantity(unit)) appendDpsBaseUnitStoreInput(store,dpsBaseUnitQuantityInputId(unit),'0','data-dps-base-unit-quantity-store',unit.id);
    appendDpsBaseUnitStoreInput(store,dpsBaseUnitEnhanceInputId(unit),'0','data-dps-base-unit-enhance-store',unit.id);
    if(dpsBaseUnitSupportsAdvancedOptions(unit)){
      appendDpsBaseUnitStoreInput(store,dpsBaseUnitLimitBreakInputId(unit),'0','data-dps-base-unit-limit-break-store',unit.id);
      appendDpsBaseUnitStoreInput(store,dpsBaseUnitJewelInputId(unit),'','data-dps-base-unit-jewel-store',unit.id);
      appendDpsBaseUnitStoreInput(store,dpsBaseUnitVoidPowerInputId(unit),'OFF','data-dps-base-unit-void-power-store',unit.id);
    }
  });
}
const DPS_BASE_UNIT_INPUT_ID_RESOLVERS=Object.freeze({
  quantity:dpsBaseUnitQuantityInputId,
  enhance:dpsBaseUnitEnhanceInputId,
  limitBreak:dpsBaseUnitLimitBreakInputId,
  jewel:dpsBaseUnitJewelInputId,
  voidPower:dpsBaseUnitVoidPowerInputId
});
function dpsBaseUnitStoreInput(field,unit){
  ensureDpsBaseUnitStore();
  const inputId=DPS_BASE_UNIT_INPUT_ID_RESOLVERS[field];
  return inputId ? $(inputId(unit)) : null;
}
function dpsBaseUnitQuantityText(unit){
  return dpsBaseUnitHasQuantity(unit) ? normalizeDpsBaseUnitQuantityValue(dpsBaseUnitStoreInput('quantity',unit)?.value || 0) : '1';
}
function dpsBaseUnitQuantityControlHtml(unit, slotIndex){
  if(!unit) return '<span class="dps-base-unit-fixed-qty is-auto-value">—</span>';
  if(!dpsBaseUnitHasQuantity(unit)) return '<span class="dps-base-unit-fixed-qty is-auto-value">1</span>';
  const limit=dpsBaseUnitQuantityLimit();
  const value=normalizeDpsBaseUnitQuantityValue(dpsBaseUnitStoreInput('quantity',unit)?.value || 0);
  const label=escapeHtml(dpsBaseUnitLabel(unit.id));
  return `<div class="dps-base-unit-qty-control" data-dps-base-unit-qty-control="${escapeHtml(unit.id)}"><button class="ui-choice-btn dps-base-unit-qty-btn" data-dps-base-unit-qty-delta="-1" data-dps-base-unit-id="${escapeHtml(unit.id)}" type="button" aria-label="${label} 수량 감소">−</button><input class="dps-base-unit-qty-input" id="dpsBaseUnitSlotQty${slotIndex+1}" data-dps-base-unit-slot-quantity="${escapeHtml(unit.id)}" inputmode="numeric" type="text" min="0" max="${limit}" value="${escapeHtml(value)}" aria-label="${label} 수량"/><button class="ui-choice-btn dps-base-unit-qty-btn" data-dps-base-unit-qty-delta="1" data-dps-base-unit-id="${escapeHtml(unit.id)}" type="button" aria-label="${label} 수량 증가">+</button></div>`;
}
function dpsJewelOptionHtml(values,selected,suffix=''){
  return (Array.isArray(values) ? values : []).map(value=>`<option value="${escapeHtml(value)}"${String(value)===String(selected)?' selected':''}>${escapeHtml(value)}${suffix}</option>`).join('');
}
function dpsJewelConfigCardHtml(name,settings){
  const input=normalizeDpsJewelSetting(settings?.[name]);
  const finalStats=dpsJewelFinalStats(name,settings);
  const options=window.DPS_DATA?.DPS_JEWEL_INPUT_OPTIONS || {};
  const field=(key,label,suffix='')=>`<label class="dps-jewel-field"><span>${label}</span><select data-dps-jewel-name="${escapeHtml(name)}" data-dps-jewel-field="${key}" aria-label="${escapeHtml(name)} ${label}">${dpsJewelOptionHtml(options[key],input[key],suffix)}</select></label>`;
  const mythic=finalStats.mythic==='Y';
  const gradeClass=mythic?'is-mythic':'is-legendary';
  const gradeText=mythic?'신화':'전설';
  return `<article class="dps-jewel-card"><header><b class="${gradeClass}">${escapeHtml(gradeText)} ${escapeHtml(name)}</b></header><p class="dps-jewel-final"><span>최종</span><b>${escapeHtml(finalStats.ad)}</b><b>${escapeHtml(finalStats.as)}</b><b>${escapeHtml(finalStats.td)}</b><b>${escapeHtml(finalStats.ua)} %</b></p><div class="dps-jewel-fields">${field('ad','공격력')}${field('as','공격속도')}${field('td','총데미지')}${field('ua','가속','%')}${field('enhance','강화')}${field('mythic','신화')}</div></article>`;
}
function updateDpsJewelConfig(select){
  const store=$('dpsJewelSettings');
  const name=normalizeDpsJewelName(select?.getAttribute?.('data-dps-jewel-name'));
  const key=String(select?.getAttribute?.('data-dps-jewel-field') || '');
  if(!store || !name || !['ad','as','td','ua','enhance','mythic'].includes(key)) return;
  const settings=normalizeDpsJewelSettings(store.value || '{}');
  settings[name]={...settings[name],[key]:normalizeDpsJewelSetting({...settings[name],[key]:select.value})[key]};
  store.value=serializeDpsJewelSettings(settings);
  sanitizeDpsJewelSelections();
  syncDpsBaseUnitControl();
  markTraitPresetJewelSettingsPending();
}
function renderDpsJewelConfigGrids(){
  const grid=$('dpsJewelConfigGrid');
  const store=$('dpsJewelSettings');
  if(!grid || !store) return;
  const settings=normalizeDpsJewelSettings(store.value || '{}');
  const normalized=serializeDpsJewelSettings(settings);
  if(store.value!==normalized) store.value=normalized;
  const html=dpsJewelNames().map(name=>dpsJewelConfigCardHtml(name,settings)).join('');
  if(grid.innerHTML!==html) grid.innerHTML=html;
}
function dpsJewelSettingIsActive(value){
  const setting=normalizeDpsJewelSetting(value);
  return ['ad','as','td','ua','enhance'].some(key=>Number(setting[key])>0) || setting.mythic==='Y';
}
function activeDpsJewelNames(settings=dpsJewelSettingsObject()){return dpsJewelNames().filter(name=>dpsJewelSettingIsActive(settings?.[name]));}
function dpsBaseUnitJewelSelectionOrder(){
  return currentDpsBaseUnitSlots().filter(Boolean);
}
function dpsBaseUnitActiveExtraJewelCount(unitOrId){
  const unit=typeof unitOrId==='string' ? dpsBaseUnitById(unitOrId) : unitOrId;
  if(!dpsBaseUnitAllowsSlotExpansion(unit)) return 0;
  return Math.min(DPS_BASE_UNIT_EXTRA_SLOT_COUNT,Math.max(0,dpsBaseUnitQuantity(unit)-1));
}
function dpsBaseUnitJewelOwnerKey(unitId,extraIndex=-1){
  return extraIndex>=0 ? `${unitId}:extra:${extraIndex}` : `${unitId}:primary`;
}
function setDpsBaseUnitExtraSettings(value){
  const store=$('dpsBaseUnitExtraSettings');
  const normalized=normalizeDpsBaseUnitExtraSettings(value);
  if(store) store.value=serializeDpsBaseUnitExtraSettings(normalized);
  return normalized;
}
function dpsLegendaryJewelActiveUsage(){
  const usage=new Map();
  const extras=dpsBaseUnitExtraSettingsObject();
  dpsBaseUnitJewelSelectionOrder().forEach(unitId=>{
    const primary=normalizeDpsJewelName(dpsBaseUnitStoreInput('jewel',unitId)?.value || '');
    if(primary && !usage.has(primary)) usage.set(primary,dpsBaseUnitJewelOwnerKey(unitId));
    (extras[unitId] || []).slice(0,dpsBaseUnitActiveExtraJewelCount(unitId)).forEach((item,index)=>{
      const name=normalizeDpsJewelName(item?.legendaryMythicJewel);
      if(name && !usage.has(name)) usage.set(name,dpsBaseUnitJewelOwnerKey(unitId,index));
    });
  });
  return usage;
}
function sanitizeDpsJewelSelections(){
  const activeLegendary=new Set(activeDpsJewelNames());
  const unitOrder=dpsBaseUnitJewelSelectionOrder();
  const extraSettings=dpsBaseUnitExtraSettingsObject();
  const usedLegendary=new Set();
  let changed=false;
  unitOrder.forEach(unitId=>{
    const input=dpsBaseUnitStoreInput('jewel',unitId);
    const primary=normalizeDpsJewelName(input?.value || '');
    if(primary){
      if(!activeLegendary.has(primary) || usedLegendary.has(primary)){
        input.value='';
        changed=true;
      }else usedLegendary.add(primary);
    }
    const items=extraSettings[unitId];
    if(!Array.isArray(items)) return;
    items.slice(0,dpsBaseUnitActiveExtraJewelCount(unitId)).forEach(item=>{
      const name=normalizeDpsJewelName(item.legendaryMythicJewel);
      if(!name) return;
      if(!activeLegendary.has(name) || usedLegendary.has(name)){
        item.legendaryMythicJewel='';
        changed=true;
      }else usedLegendary.add(name);
    });
  });
  if(changed) setDpsBaseUnitExtraSettings(extraSettings);
  return changed;
}
function clearDpsJewelFromOtherAssignments(jewelName,ownerKey){
  const name=normalizeDpsJewelName(jewelName);
  if(!name) return;
  const extras=dpsBaseUnitExtraSettingsObject();
  dpsBaseUnitList().forEach(unit=>{
    const primary=dpsBaseUnitStoreInput('jewel',unit);
    if(dpsBaseUnitJewelOwnerKey(unit.id)!==ownerKey && normalizeDpsJewelName(primary?.value || '')===name) primary.value='';
    const items=extras[unit.id];
    if(!Array.isArray(items)) return;
    items.forEach((item,index)=>{
      if(dpsBaseUnitJewelOwnerKey(unit.id,index)!==ownerKey && normalizeDpsJewelName(item.legendaryMythicJewel)===name) item.legendaryMythicJewel='';
    });
  });
  setDpsBaseUnitExtraSettings(extras);
}
function dpsBaseUnitJewelOptionsHtml(selectedName,ownerKey){
  const usage=dpsLegendaryJewelActiveUsage();
  const names=activeDpsJewelNames().filter(name=>{
    const owner=usage.get(name);
    return !owner || owner===ownerKey || name===selectedName;
  });
  return `<option value="">없음</option>${names.map(name=>`<option value="${escapeHtml(name)}"${name===selectedName?' selected':''}>${escapeHtml(name)}</option>`).join('')}`;
}
function dpsBaseUnitAdditionalSettingsHtml(unit){
  if(!dpsBaseUnitAllowsSlotExpansion(unit) || !dpsBaseUnitSlotExpanded(unit)) return '';
  const values=dpsBaseUnitExtraSlotSettings(unit);
  const fields=values.map((setting,index)=>{
    const unitNumber=index+2;
    const limitOptions=Array.from({length:7},(_,value)=>`<option value="${value}"${value===setting.limitBreak?' selected':''}>${value}</option>`).join('');
    const ownerKey=dpsBaseUnitJewelOwnerKey(unit.id,index);
    return `<div class="dps-base-unit-extra-slot"><span class="dps-base-unit-extra-slot-title">${unitNumber}기</span><label><span>한계 돌파</span><select data-dps-base-unit-extra-limit-break="${escapeHtml(unit.id)}" data-dps-base-unit-extra-index="${index}" aria-label="${escapeHtml(dpsBaseUnitLabel(unit))} ${unitNumber}기 한계 돌파">${limitOptions}</select></label><label><span>전설·신화 쥬얼</span><select data-dps-base-unit-extra-jewel="${escapeHtml(unit.id)}" data-dps-base-unit-extra-index="${index}" aria-label="${escapeHtml(dpsBaseUnitLabel(unit))} ${unitNumber}기 전설·신화 쥬얼">${dpsBaseUnitJewelOptionsHtml(setting.legendaryMythicJewel,ownerKey)}</select></label></div>`;
  }).join('');
  return `<section class="dps-base-unit-extra-settings" data-dps-base-unit-extra-settings="${escapeHtml(unit.id)}" aria-label="${escapeHtml(dpsBaseUnitLabel(unit))} 추가 유닛 쥬얼 및 한계 돌파 설정"><h4>추가 유닛 쥬얼 &amp; 한계 돌파 설정</h4><div class="dps-base-unit-extra-grid">${fields}</div></section>`;
}
function updateDpsBaseUnitExtraSetting(select){
  const unitId=String(select?.getAttribute?.('data-dps-base-unit-extra-limit-break') || select?.getAttribute?.('data-dps-base-unit-extra-jewel') || '');
  const index=Math.max(0,Math.min(DPS_BASE_UNIT_EXTRA_SLOT_COUNT-1,Math.round(Number(select?.getAttribute?.('data-dps-base-unit-extra-index'))||0)));
  const unit=dpsBaseUnitById(unitId);
  if(!dpsBaseUnitAllowsSlotExpansion(unit)) return;
  const settings=dpsBaseUnitExtraSettingsObject();
  const items=Array.from({length:DPS_BASE_UNIT_EXTRA_SLOT_COUNT},(_,slotIndex)=>normalizeDpsBaseUnitExtraSlotSetting(settings[unitId]?.[slotIndex]));
  let selectedJewel='';
  if(select.hasAttribute('data-dps-base-unit-extra-limit-break')){
    items[index].limitBreak=Number(normalizeDpsBaseUnitLimitBreakValue(select.value))||0;
  }else{
    selectedJewel=normalizeDpsJewelName(select.value);
    items[index].legendaryMythicJewel=selectedJewel;
  }
  settings[unitId]=items;
  setDpsBaseUnitExtraSettings(settings);
  if(selectedJewel) clearDpsJewelFromOtherAssignments(selectedJewel,dpsBaseUnitJewelOwnerKey(unitId,index));
  sanitizeDpsJewelSelections();
  syncDpsBaseUnitControl();
}
function updateDpsBaseUnitJewelAssignment(select){
  const unitId=String(select?.getAttribute?.('data-dps-base-unit-slot-jewel') || '');
  const unit=dpsBaseUnitById(unitId);
  if(!unit) return;
  const next=normalizeDpsJewelName(select.value);
  if(next) clearDpsJewelFromOtherAssignments(next,dpsBaseUnitJewelOwnerKey(unitId));
  const store=dpsBaseUnitStoreInput('jewel',unit);
  if(store) store.value=next;
  sanitizeDpsJewelSelections();
  syncDpsBaseUnitControl();
}
function dpsBaseUnitVoidPowerAvailable(selectedIds=null){
  const ids=Array.isArray(selectedIds)
    ? selectedIds
    : dpsBaseUnitSelectionIds(normalizeDpsBaseUnitsValue($('dpsBaseUnits')?.value || ''));
  return ids.includes('prodNarud');
}
function dpsBaseUnitVoidPowerCost(unitOrId){
  const unit=typeof unitOrId==='string' ? dpsBaseUnitById(unitOrId) : unitOrId;
  if(!unit || !dpsBaseUnitSupportsAdvancedOptions(unit)) return 0;
  return dpsBaseUnitHasQuantity(unit) ? Math.max(0,Number(dpsBaseUnitQuantityText(unit))||0) : 1;
}
function dpsBaseUnitVoidPowerUsage(excludedUnitId=''){
  const excluded=String(excludedUnitId || '');
  return currentDpsBaseUnitSlots().filter(Boolean).reduce((sum,unitId)=>{
    if(unitId===excluded || unitId==='prodNarud') return sum;
    const unit=dpsBaseUnitById(unitId);
    if(!dpsBaseUnitSupportsAdvancedOptions(unit)) return sum;
    const input=dpsBaseUnitStoreInput('voidPower',unit);
    return normalizeDpsBaseUnitVoidPowerValue(input?.value)==='ON' ? sum+dpsBaseUnitVoidPowerCost(unit) : sum;
  },0);
}
function enforceDpsBaseUnitVoidPowerQuantity(unitOrId){
  const unit=typeof unitOrId==='string' ? dpsBaseUnitById(unitOrId) : unitOrId;
  const input=dpsBaseUnitStoreInput('voidPower',unit);
  if(!unit || !dpsBaseUnitSupportsAdvancedOptions(unit) || normalizeDpsBaseUnitVoidPowerValue(input?.value)!=='ON') return false;
  if(unit.id!=='prodNarud' && dpsBaseUnitVoidPowerUsage(unit.id)+dpsBaseUnitVoidPowerCost(unit)<=dpsBaseUnitVoidPowerLimit()) return false;
  input.value='OFF';
  return true;
}
function sanitizeDpsBaseUnitVoidPowerAvailability(selectedIds=null){
  const available=dpsBaseUnitVoidPowerAvailable(selectedIds);
  const limit=dpsBaseUnitVoidPowerLimit();
  let used=0;
  currentDpsBaseUnitSlots().filter(Boolean).forEach(unitId=>{
    const unit=dpsBaseUnitById(unitId);
    const input=dpsBaseUnitStoreInput('voidPower',unit);
    if(!dpsBaseUnitSupportsAdvancedOptions(unit) || !input || normalizeDpsBaseUnitVoidPowerValue(input.value)!=='ON') return;
    const cost=dpsBaseUnitVoidPowerCost(unit);
    if(!available || unitId==='prodNarud' || used+cost>limit) input.value='OFF';
    else used+=cost;
  });
  if(!available){
    dpsBaseUnitList().forEach(unit=>{
      const input=dpsBaseUnitStoreInput('voidPower',unit);
      if(input && normalizeDpsBaseUnitVoidPowerValue(input.value)!=='OFF') input.value='OFF';
    });
  }
  return available;
}

function dpsBaseUnitSettingsHtml(unit,slotIndex){
  if(!unit) return '';
  const unitId=escapeHtml(unit.id);
  const label=escapeHtml(dpsBaseUnitLabel(unit));
  const enhance=normalizeDpsBaseUnitEnhanceValue(dpsBaseUnitStoreInput('enhance',unit)?.value,0);
  if(dpsBaseUnitIsArtifact(unit)){
    const unavailable='<option value="" selected>사용 불가</option>';
    const disabledActions=`<div class="dps-base-unit-action-buttons"><div class="dps-base-unit-void-power-control"><span class="dps-base-unit-void-power-usage">—</span><button class="ui-choice-btn dps-base-unit-option-btn" id="dpsBaseUnitSlotVoidPower${slotIndex+1}" type="button" aria-label="${label} 공허의 힘 사용 불가" disabled>공허의 힘</button></div><button class="ui-choice-btn dps-base-unit-option-btn dps-base-unit-slot-expansion-btn" type="button" aria-label="${label} 추가 유닛 설정 사용 불가" disabled>슬롯 확장</button></div>`;
    return `<div class="dps-base-unit-settings is-artifact" data-dps-base-unit-settings="${unitId}"><label class="dps-base-unit-setting dps-base-unit-enhance-setting"><span>강화 기대값</span><input class="dps-base-unit-setting-input" id="dpsBaseUnitSlotEnhance${slotIndex+1}" data-dps-base-unit-slot-enhance="${unitId}" type="text" inputmode="decimal" min="0" max="1000" value="${escapeHtml(enhance)}" aria-label="${label} 강화 기대값"/></label><label class="dps-base-unit-setting is-disabled"><span>한계 돌파</span><select class="dps-base-unit-setting-select" id="dpsBaseUnitSlotLimitBreak${slotIndex+1}" aria-label="${label} 한계 돌파 사용 불가" disabled>${unavailable}</select></label><label class="dps-base-unit-setting is-disabled"><span>전설·신화 쥬얼</span><select class="dps-base-unit-setting-select" id="dpsBaseUnitSlotJewel${slotIndex+1}" aria-label="${label} 전설·신화 쥬얼 사용 불가" disabled>${unavailable}</select></label>${disabledActions}</div>`;
  }
  const limitBreak=normalizeDpsBaseUnitLimitBreakValue(dpsBaseUnitStoreInput('limitBreak',unit)?.value);
  const jewelName=normalizeDpsJewelName(dpsBaseUnitStoreInput('jewel',unit)?.value);
  const voidPowerAvailable=dpsBaseUnitVoidPowerAvailable();
  const voidPowerEligible=unit.id!=='prodNarud';
  const voidPower=voidPowerAvailable && voidPowerEligible ? normalizeDpsBaseUnitVoidPowerValue(dpsBaseUnitStoreInput('voidPower',unit)?.value) : 'OFF';
  const voidPowerUsage=dpsBaseUnitVoidPowerUsage();
  const voidPowerLimit=dpsBaseUnitVoidPowerLimit();
  const voidPowerCanEnable=voidPowerAvailable && voidPowerEligible && (voidPower==='ON' || voidPowerUsage+dpsBaseUnitVoidPowerCost(unit)<=voidPowerLimit);
  const slotExpanded=dpsBaseUnitSlotExpanded(unit);
  const limitOptions=Array.from({length:7},(_,value)=>`<option value="${value}"${String(value)===limitBreak?' selected':''}>${value}</option>`).join('');
  const voidButton=`<div class="dps-base-unit-void-power-control"><span class="dps-base-unit-void-power-usage">${voidPowerUsage} / ${voidPowerLimit}</span><button class="ui-choice-btn dps-base-unit-option-btn${voidPower==='ON'?' is-active':''}" id="dpsBaseUnitSlotVoidPower${slotIndex+1}" data-dps-base-unit-void-power-toggle="${unitId}" type="button" aria-pressed="${voidPower==='ON'?'true':'false'}" aria-label="${label} 공허의 힘"${voidPowerCanEnable?'':' disabled'}>공허의 힘</button></div>`;
  const slotButton=dpsBaseUnitAllowsSlotExpansion(unit) ? `<button class="ui-choice-btn dps-base-unit-option-btn dps-base-unit-slot-expansion-btn${slotExpanded?' is-active':''}" data-dps-base-unit-slot-expansion-toggle="${unitId}" type="button" aria-pressed="${slotExpanded?'true':'false'}" aria-label="${label} 추가 유닛 쥬얼 및 한계 돌파 설정">슬롯 확장</button>` : '';
  const actionButtons=`<div class="dps-base-unit-action-buttons">${voidButton}${slotButton}</div>`;
  const mainSettings=`<div class="dps-base-unit-settings" data-dps-base-unit-settings="${unitId}"><label class="dps-base-unit-setting dps-base-unit-enhance-setting"><span>강화 기대값</span><input class="dps-base-unit-setting-input" id="dpsBaseUnitSlotEnhance${slotIndex+1}" data-dps-base-unit-slot-enhance="${unitId}" type="text" inputmode="decimal" min="0" max="1000" value="${escapeHtml(enhance)}" aria-label="${label} 강화 기대값"/></label><label class="dps-base-unit-setting"><span>한계 돌파</span><select class="dps-base-unit-setting-select" id="dpsBaseUnitSlotLimitBreak${slotIndex+1}" data-dps-base-unit-slot-limit-break="${unitId}" aria-label="${label} 한계 돌파">${limitOptions}</select></label><label class="dps-base-unit-setting"><span>전설·신화 쥬얼</span><select class="dps-base-unit-setting-select" id="dpsBaseUnitSlotJewel${slotIndex+1}" data-dps-base-unit-slot-jewel="${unitId}" aria-label="${label} 전설·신화 쥬얼">${dpsBaseUnitJewelOptionsHtml(jewelName,dpsBaseUnitJewelOwnerKey(unit.id))}</select></label>${actionButtons}</div>`;
  return mainSettings+dpsBaseUnitAdditionalSettingsHtml(unit);
}
function dpsBaseUnitSelectOptionsHtml(selectedId, selectedIds){
  const selectedSet=new Set(selectedIds.filter(Boolean));
  const groups=new Map();
  sortedDpsBaseUnits().forEach(unit=>{
    const grade=unit.grade || '기타';
    if(!groups.has(grade)) groups.set(grade,[]);
    groups.get(grade).push(unit);
  });
  const groupHtml=[...groups.entries()].map(([grade,units])=>{
    const options=units.map(unit=>{
      const selected=unit.id===selectedId;
      const disabled=!selected && selectedSet.has(unit.id);
      return `<option value="${escapeHtml(unit.id)}"${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}>${escapeHtml(dpsBaseUnitLabel(unit))}</option>`;
    }).join('');
    return `<optgroup label="${escapeHtml(grade)}">${options}</optgroup>`;
  }).join('');
  return `<option value="">선택 안 함</option>${groupHtml}`;
}
function dpsBaseUnitSlotHtml(unitId, slotIndex, slots){
  const unit=dpsBaseUnitById(unitId);
  const empty=!unit;
  const selectId=`dpsBaseUnitSlot${slotIndex+1}`;
  const selectControl=`<div class="dps-base-unit-select-wrap"><button class="ui-icon-btn dps-base-unit-clear-btn" data-dps-base-unit-clear-slot="${slotIndex}" type="button" aria-label="유닛 선택 해제"${empty?' disabled':''}>×</button><select class="dps-base-unit-select" id="${selectId}" data-dps-base-unit-slot="${slotIndex}" aria-label="유닛 선택">${dpsBaseUnitSelectOptionsHtml(unitId,slots)}</select></div>`;
  const result=unit ? dpsBaseUnitResultDisplayMap.get(String(unit.id || '')) || null : null;
  const attack=result ? dpsBaseUnitAttackText(result) : '—';
  const pierce=result ? dpsBaseUnitPercentText(result.excelPierce) : (unit ? (dpsBaseUnitIsArtifact(unit) ? '0%' : dpsBaseUnitPercentText(dpsBaseUnitBoardBasePierce + dpsBaseUnitPierceBonus(unit))) : '—');
  const dps=result ? dpsBaseUnitDpsText(result) : '—';
  const field=(fieldLabel,fieldClass,content)=>`<div class="dps-base-unit-field ${fieldClass}"><span class="dps-base-unit-field-label">${fieldLabel}</span>${content}</div>`;
  const entry=`<div class="dps-base-unit-entry dps-base-unit-slot${empty ? ' is-empty' : ''}${unit && dpsBaseUnitHasQuantity(unit) ? ' has-quantity' : ' is-fixed'}" data-dps-base-unit-slot-row="${slotIndex}">${field('유닛명','dps-base-unit-name-field',selectControl)}${field('공격력','dps-base-unit-attack-field',`<span class="dps-base-unit-board-cell dps-base-unit-board-attack">${escapeHtml(attack)}</span>`)}${field('방어력 관통','dps-base-unit-pierce-field',`<span class="dps-base-unit-board-cell dps-base-unit-board-pierce">${escapeHtml(pierce)}</span>`)}${field(unit && dpsBaseUnitIsArtifact(unit)?'파장 총 DPS':'총 DPS','dps-base-unit-dps-field',`<b class="dps-base-unit-board-cell dps-base-unit-board-dps">${escapeHtml(dps)}</b>`)}${field('수량','dps-base-unit-quantity-field',`<div class="dps-base-unit-board-cell dps-base-unit-board-quantity">${dpsBaseUnitQuantityControlHtml(unit,slotIndex)}</div>`)}</div>`;
  return `<div class="dps-base-unit-card${empty?' is-empty':''}">${entry}${dpsBaseUnitSettingsHtml(unit,slotIndex)}</div>`;
}
function dpsBaseUnitSlotsHtml(slots){
  return slots.map((unitId,index)=>dpsBaseUnitSlotHtml(unitId,index,slots)).join('');
}
function syncDpsBaseUnitQuantitiesForSelection(selectedIds){
  const selected=new Set(selectedIds || []);
  dpsBaseUnitList().forEach(unit=>{
    if(!dpsBaseUnitHasQuantity(unit)) return;
    const input=dpsBaseUnitStoreInput('quantity',unit);
    if(!input) return;
    const current=normalizeDpsBaseUnitQuantityValue(input.value || 0);
    const next=selected.has(unit.id) ? (Number(current)>0 ? current : '1') : '0';
    if(input.value!==next) input.value=next;
  });
}
function normalizeDpsBaseUnitQuantityInput(input){
  if(!input) return '0';
  const next=normalizeDpsBaseUnitQuantityValue(input.value || 0);
  if(input.value!==next) input.value=next;
  const unitId=input.getAttribute?.('data-dps-base-unit-slot-quantity') || '';
  if(unitId){
    const storeInput=dpsBaseUnitStoreInput('quantity',unitId);
    if(storeInput && storeInput.value!==next) storeInput.value=next;
    enforceDpsBaseUnitVoidPowerQuantity(unitId);
  }
  return next;
}
function normalizeAllDpsBaseUnitQuantityInputs(){
  ensureDpsBaseUnitStore();
  dpsBaseUnitList().forEach(unit=>{
    if(dpsBaseUnitHasQuantity(unit)) normalizeDpsBaseUnitQuantityInput(dpsBaseUnitStoreInput('quantity',unit));
  });
}
function setDpsBaseUnitQuantity(unitId, value){
  const unit=dpsBaseUnitById(unitId);
  if(!unit || !dpsBaseUnitHasQuantity(unit)) return '0';
  const input=dpsBaseUnitStoreInput('quantity',unit);
  if(!input) return '0';
  input.value=normalizeDpsBaseUnitQuantityValue(value);
  enforceDpsBaseUnitVoidPowerQuantity(unit);
  return input.value;
}
function syncDpsBaseUnitSelectionFromQuantities(notify=true){
  const fixedIds=dpsBaseUnitSelectionIds(vs('dpsBaseUnits')).filter(id=>!dpsBaseUnitHasQuantity(id));
  const quantityIds=dpsBaseUnitList()
    .filter(unit=>dpsBaseUnitHasQuantity(unit) && Number(dpsBaseUnitQuantityText(unit))>0)
    .map(unit=>unit.id);
  const ids=[...fixedIds, ...quantityIds].filter((id,index,list)=>list.indexOf(id)===index).slice(0,dpsBaseUnitSelectionLimit());
  setDpsBaseUnitStoredValue(ids, notify);
}
function syncDpsBaseUnitEnhanceControl(input,commit=false){
  const unitId=input?.getAttribute?.('data-dps-base-unit-slot-enhance') || '';
  const unit=dpsBaseUnitById(unitId);
  if(!unit) return '0';
  const store=dpsBaseUnitStoreInput('enhance',unit);
  const next=normalizeDpsBaseUnitEnhanceValue(input.value,0);
  if(store) store.value=next;
  if(commit) input.value=next;
  return next;
}
function syncDpsBaseUnitLimitBreakControl(select){
  const unitId=select?.getAttribute?.('data-dps-base-unit-slot-limit-break') || '';
  const unit=dpsBaseUnitById(unitId);
  if(!unit) return '0';
  const next=normalizeDpsBaseUnitLimitBreakValue(select.value);
  const store=dpsBaseUnitStoreInput('limitBreak',unit);
  if(store) store.value=next;
  if(select.value!==next) select.value=next;
  return next;
}
function toggleDpsBaseUnitVoidPower(unitId){
  const unit=dpsBaseUnitById(unitId);
  if(!unit || !dpsBaseUnitSupportsAdvancedOptions(unit) || unit.id==='prodNarud' || !dpsBaseUnitVoidPowerAvailable()){
    const store=dpsBaseUnitStoreInput('voidPower',unit);
    if(store) store.value='OFF';
    sanitizeDpsBaseUnitVoidPowerAvailability();
    return 'OFF';
  }
  const store=dpsBaseUnitStoreInput('voidPower',unit);
  const current=normalizeDpsBaseUnitVoidPowerValue(store?.value);
  const next=current==='ON' ? 'OFF' : 'ON';
  if(next==='ON' && dpsBaseUnitVoidPowerUsage(unit.id)+dpsBaseUnitVoidPowerCost(unit)>dpsBaseUnitVoidPowerLimit()) return 'OFF';
  if(store) store.value=next;
  syncDpsBaseUnitControl();
  return next;
}
function ensureArtifactProductionBuffForUnitSelection(selectedIds){
  const ids=Array.isArray(selectedIds) ? selectedIds : dpsBaseUnitSelectionIds(selectedIds);
  if(!ids.includes('artifactUnit')) return false;
  const artifact=$('prodArtifact');
  if(!artifact || artifact.checked) return false;
  artifact.checked=true;
  return true;
}
function setDpsBaseUnitStoredValue(value, notify=true, options={}){
  const input=$('dpsBaseUnits');
  const slotInput=$('dpsBaseUnitSlots');
  if(!input || !slotInput) return;
  const initialIds=dpsBaseUnitSelectionIds(normalizeDpsBaseUnitsValue(value));
  const selectedIds=initialIds.slice(0,dpsBaseUnitSelectionLimit());
  ensureArtifactProductionBuffForUnitSelection(selectedIds);
  const requestedSlots=options.slots ? normalizeDpsBaseUnitSlotValues(options.slots) : currentDpsBaseUnitSlots();
  const slots=reconcileDpsBaseUnitSlots(requestedSlots,selectedIds);
  const normalized=normalizeDpsBaseUnitsValue(slots.filter(Boolean));
  input.value=normalized;
  slotInput.value=serializeDpsBaseUnitSlots(slots);
  syncDpsBaseUnitQuantitiesForSelection(slots.filter(Boolean));
  syncDpsBaseUnitControl();
  if(notify){
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }
}
function changeDpsBaseUnitSlot(slotIndex, unitId){
  const index=Math.max(0,Math.min(dpsBaseUnitSelectionLimit()-1,Number(slotIndex)||0));
  const slots=currentDpsBaseUnitSlots();
  const previous=slots[index];
  const next=dpsBaseUnitById(unitId) ? String(unitId) : '';
  if(next){
    const duplicateIndex=slots.indexOf(next);
    if(duplicateIndex>=0 && duplicateIndex!==index) slots[duplicateIndex]='';
  }
  slots[index]=next;
  if(previous && previous!==next && dpsBaseUnitHasQuantity(previous) && !slots.includes(previous)) setDpsBaseUnitQuantity(previous,0);
  if(next && dpsBaseUnitHasQuantity(next)) setDpsBaseUnitQuantity(next,Math.max(1,Number(dpsBaseUnitQuantityText(next))||1));
  setDpsBaseUnitStoredValue(slots.filter(Boolean),true,{slots});
}
function captureDpsBaseUnitViewState(stack){
  if(!stack) return {focus:null};
  const active=stack.contains(document.activeElement) ? document.activeElement : null;
  let focus=null;
  if(active?.hasAttribute('data-dps-base-unit-extra-limit-break') || active?.hasAttribute('data-dps-base-unit-extra-jewel')){
    focus={
      type:active.hasAttribute('data-dps-base-unit-extra-limit-break') ? 'extra-limit' : 'extra-jewel',
      unitId:String(active.getAttribute(active.hasAttribute('data-dps-base-unit-extra-limit-break') ? 'data-dps-base-unit-extra-limit-break' : 'data-dps-base-unit-extra-jewel') || ''),
      index:String(active.getAttribute('data-dps-base-unit-extra-index') || '0')
    };
  }else if(active?.hasAttribute('data-dps-base-unit-slot-jewel')){
    focus={type:'named',unitId:String(active.getAttribute('data-dps-base-unit-slot-jewel') || '')};
  }
  return {focus};
}
function restoreDpsBaseUnitViewState(stack,state){
  const focus=state?.focus;
  if(!stack || !focus) return;
  let selector='[data-dps-base-unit-slot-jewel]';
  let unitAttribute='data-dps-base-unit-slot-jewel';
  if(focus.type==='extra-limit'){
    selector='[data-dps-base-unit-extra-limit-break]';
    unitAttribute='data-dps-base-unit-extra-limit-break';
  }else if(focus.type==='extra-jewel'){
    selector='[data-dps-base-unit-extra-jewel]';
    unitAttribute='data-dps-base-unit-extra-jewel';
  }
  const target=[...stack.querySelectorAll(selector)].find(element=>{
    if(String(element.getAttribute(unitAttribute) || '')!==focus.unitId) return false;
    return focus.type==='named' || String(element.getAttribute('data-dps-base-unit-extra-index') || '0')===focus.index;
  });
  if(target) requestAnimationFrame(()=>target.focus({preventScroll:true}));
}
function syncDpsBaseUnitControl(){
  ensureDpsBaseUnitStore();
  sanitizeDpsJewelSelections();
  renderDpsJewelConfigGrids();
  const input=$('dpsBaseUnits');
  const slotInput=$('dpsBaseUnitSlots');
  if(!input || !slotInput) return;
  const selectedIds=dpsBaseUnitSelectionIds(normalizeDpsBaseUnitsValue(input.value || ''));
  ensureArtifactProductionBuffForUnitSelection(selectedIds);
  sanitizeDpsBaseUnitVoidPowerAvailability(selectedIds);
  const rawSlots=String(slotInput.value || '');
  let slots=rawSlots ? normalizeDpsBaseUnitSlotValues(rawSlots) : compactDpsBaseUnitSlots(selectedIds);
  const slotIds=slots.filter(Boolean);
  const sameSelection=slotIds.length===selectedIds.length && slotIds.every((id,index)=>id===selectedIds[index]);
  if(!sameSelection) slots=reconcileDpsBaseUnitSlots(slots,selectedIds);
  const normalized=normalizeDpsBaseUnitsValue(slots.filter(Boolean));
  input.value=normalized;
  slotInput.value=serializeDpsBaseUnitSlots(slots);
  syncDpsBaseUnitQuantitiesForSelection(slots.filter(Boolean));
  normalizeAllDpsBaseUnitQuantityInputs();
  const stack=$('dpsBaseUnitSlotStack');
  if(stack){
    const html=dpsBaseUnitSlotsHtml(slots);
    if(stack.innerHTML!==html){
      const viewState=captureDpsBaseUnitViewState(stack);
      stack.innerHTML=html;
      restoreDpsBaseUnitViewState(stack,viewState);
    }
  }
}
function adjustDpsBaseUnitQuantity(unitId, delta){
  const unit=dpsBaseUnitById(unitId);
  if(!unit || !dpsBaseUnitHasQuantity(unit)) return;
  const current=Number(dpsBaseUnitQuantityText(unit)) || 0;
  setDpsBaseUnitQuantity(unitId, current + Number(delta || 0));
  syncDpsBaseUnitSelectionFromQuantities(true);
}

function bindDpsBaseUnitControlEvents(){
  if(document.documentElement.dataset.dpsBaseUnitControlBound==='1') return;
  document.documentElement.dataset.dpsBaseUnitControlBound='1';
  document.addEventListener('click', e=>{
    const clearUnit=e.target?.closest?.('[data-dps-base-unit-clear-slot]');
    if(clearUnit?.closest?.('[data-dps-base-unit-control]')){
      e.preventDefault();
      changeDpsBaseUnitSlot(clearUnit.getAttribute('data-dps-base-unit-clear-slot'),'');
      requestAppUpdate();
      scheduleAutoSave();
      return;
    }
    const qtyBtn=e.target?.closest?.('[data-dps-base-unit-qty-delta]');
    if(qtyBtn?.closest?.('[data-dps-base-unit-control]')){
      e.preventDefault();
      adjustDpsBaseUnitQuantity(qtyBtn.getAttribute('data-dps-base-unit-id') || '', qtyBtn.getAttribute('data-dps-base-unit-qty-delta'));
      requestAppUpdate();
      scheduleAutoSave();
      return;
    }
    const voidToggle=e.target?.closest?.('[data-dps-base-unit-void-power-toggle]');
    if(voidToggle?.closest?.('[data-dps-base-unit-control]')){
      e.preventDefault();
      toggleDpsBaseUnitVoidPower(voidToggle.getAttribute('data-dps-base-unit-void-power-toggle') || '');
      requestAppUpdate();
      scheduleAutoSave();
      return;
    }
    const slotExpansion=e.target?.closest?.('[data-dps-base-unit-slot-expansion-toggle]');
    if(!slotExpansion?.closest?.('[data-dps-base-unit-control]')) return;
    e.preventDefault();
    toggleDpsBaseUnitSlotExpansion(slotExpansion.getAttribute('data-dps-base-unit-slot-expansion-toggle') || '');
    scheduleAutoSave();
  }, true);
  document.addEventListener('input', e=>{
    const input=e.target?.closest?.('[data-dps-base-unit-slot-enhance]');
    if(!input?.closest?.('[data-dps-base-unit-control]')) return;
    syncDpsBaseUnitEnhanceControl(input,false);
  }, true);
  document.addEventListener('change', e=>{
    const select=e.target?.closest?.('[data-dps-base-unit-slot]');
    if(select?.closest?.('[data-dps-base-unit-control]')){
      changeDpsBaseUnitSlot(select.getAttribute('data-dps-base-unit-slot'),select.value);
      return;
    }
    const enhance=e.target?.closest?.('[data-dps-base-unit-slot-enhance]');
    if(enhance?.closest?.('[data-dps-base-unit-control]')){
      syncDpsBaseUnitEnhanceControl(enhance,true);
      requestAppUpdate();
      scheduleAutoSave();
      return;
    }
    const jewelConfig=e.target?.closest?.('[data-dps-jewel-field]');
    if(jewelConfig?.closest?.('[data-dps-jewel-config]')){
      updateDpsJewelConfig(jewelConfig);
      requestAppUpdate();
      scheduleAutoSave();
      return;
    }
    const extraSetting=e.target?.closest?.('[data-dps-base-unit-extra-limit-break],[data-dps-base-unit-extra-jewel]');
    if(extraSetting?.closest?.('[data-dps-base-unit-control]')){
      updateDpsBaseUnitExtraSetting(extraSetting);
      requestAppUpdate();
      scheduleAutoSave();
      return;
    }
    const unitJewel=e.target?.closest?.('[data-dps-base-unit-slot-jewel]');
    if(unitJewel?.closest?.('[data-dps-base-unit-control]')){
      updateDpsBaseUnitJewelAssignment(unitJewel);
      requestAppUpdate();
      scheduleAutoSave();
      return;
    }
    const limitBreak=e.target?.closest?.('[data-dps-base-unit-slot-limit-break]');
    if(limitBreak?.closest?.('[data-dps-base-unit-control]')) syncDpsBaseUnitLimitBreakControl(limitBreak);
  }, true);
}

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
  }catch{
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
/* 엑셀 가져오기·선택 룬 */
const EXCEL_RUNE_MODIFICATION_COLUMNS=Object.freeze(['C','F','I','L','O']);
const EXCEL_RUNE_MODIFICATION_ROWS=Object.freeze({
  upper:Object.freeze({rModAD:19,rModAS:21,rModCD:22,rModCRI:23}),
  lower:Object.freeze({rModAD:34,rModAS:36,rModCD:37,rModCRI:38})
});
function excelSelectedRuneNumber(cells={}){
  return normalizedIntegerRange(excelNumber(cells.J3),1,10,1);
}
function excelSelectedRuneModificationValues(cells,specCells={}){
  const runeNumber=excelSelectedRuneNumber(cells);
  const column=EXCEL_RUNE_MODIFICATION_COLUMNS[(runeNumber-1)%5];
  const rows=runeNumber<=5 ? EXCEL_RUNE_MODIFICATION_ROWS.upper : EXCEL_RUNE_MODIFICATION_ROWS.lower;
  return Object.fromEntries(Object.entries(rows).map(([id,row])=>[id,specCells[`${column}${row}`]]));
}
function isExcelPenanceSheet(sheetName=''){
  return String(sheetName || '').replace(/\s+/g,'')==='고행';
}
function excelUnitBoardSpeedModeValue(cells={},sheetName=''){
  if(!isExcelPenanceSheet(sheetName)) return undefined;
  const value=excelText(cells.N76).trim().toUpperCase();
  if(value==='O' || value==='ON') return 'ON';
  if(value==='X' || value==='OFF') return 'OFF';
  return undefined;
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
  const runeMods=excelSelectedRuneModificationValues(cells,specCells);
  const unitBoardSpeedMode=excelUnitBoardSpeedModeValue(cells,sheetName);
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
    ...(unitBoardSpeedMode===undefined ? [] : [['유닛 보드','스피드 모드',unitBoardSpeedMode,'dpsBaseUnitSpeedMode']]),
    ['룬정보','공격력',cells.J5,'rAD'],
    ['룬정보','공격력 개조',runeMods.rModAD,'rModAD'],
    ['룬정보','룬 특수 옵션',EXCEL_RUNE_TYPE_MAP[excelText(cells.I6)]??cells.I6,'runeChoiceType'],
    ['룬정보','룬 특수 옵션',cells.J6,'runeChoiceValue'],
    ['룬정보','공격속도',cells.J7,'rAS'],
    ['룬정보','공격속도 개조',runeMods.rModAS,'rModAS'],
    ['룬정보','크리티컬 데미지',cells.J8,'rCD'],
    ['룬정보','크리티컬 데미지 개조',runeMods.rModCD,'rModCD'],
    ['룬정보','크리티컬 확률',cells.J9,'rCRI'],
    ['룬정보','크리티컬 확률 개조',runeMods.rModCRI,'rModCRI'],
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
    return {kind:'스펙 보드',name,current:formatCompareNumber(webDisplay),change:formatCompareNumber(excelDisplay),
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
function normalizedCompareJewelSettings(value){
  const source=value && typeof value==='object' && !Array.isArray(value) ? value : {};
  return {legendaryMythicJewels:normalizeDpsJewelSettings(source.legendaryMythicJewels || source.legendaryMythic || source.jewelSettings || {})};
}
function jewelCompareItems(value){
  const setting=normalizeDpsJewelSetting(value);
  return [['공격력',setting.ad],['공격속도',setting.as],['총데미지',setting.td],['가속',`${setting.ua}%`],['강화',setting.enhance],['신화',setting.mythic]];
}
function buildExcelJewelRows(jewelImport,currentValue){
  if(!jewelImport?.present){
    return [buildCompareTextRow('쥬얼 설정','쥬얼 시트','없음','기준 프리셋 공용 설정')];
  }
  const change=normalizedCompareJewelSettings(jewelImport.settings);
  const current=normalizedCompareJewelSettings(currentValue);
  return dpsJewelNames().map(name=>buildCompareDetailRow(
    '쥬얼 설정',name,
    jewelCompareItems(change.legendaryMythicJewels[name]),
    jewelCompareItems(current.legendaryMythicJewels[name])
  ));
}
function buildTraitPresetJewelCompareRows(changeValue,currentValue){
  const changePresent=!!normalizeTraitPresetJewelSettings(changeValue);
  const currentPresent=!!normalizeTraitPresetJewelSettings(currentValue);
  const change=normalizedCompareJewelSettings(changeValue);
  const current=normalizedCompareJewelSettings(currentValue);
  const rows=[buildCompareTextRow(
    '쥬얼 설정','공용 쥬얼 데이터',
    changePresent?'포함':'없음',
    currentPresent?'포함':'없음'
  )];
  dpsJewelNames().forEach(name=>rows.push(buildCompareDetailRow(
    '쥬얼 설정',`전설·신화 쥬얼 · ${name}`,
    jewelCompareItems(change.legendaryMythicJewels[name]),
    jewelCompareItems(current.legendaryMythicJewels[name])
  )));
  return rows;
}

function buildExcelJewelOnlyComparison(fileName,sheetName,jewelImport,currentJewelSettings){
  if(!jewelImport?.present || !jewelImport.settings) throw new Error('선택한 엑셀파일에 쥬얼 시트가 없습니다.');
  const jewelRows=buildExcelJewelRows(jewelImport,currentJewelSettings);
  return {
    fileName,
    sheetName,
    sourceType:'excel',
    summary:{
      dps:{change:0,current:0,diff:0,status:'same'},
      statDiffs:0,
      inputDiffs:0,
      traitDiffs:0,
      buffDiffs:0,
      jewelDiffs:jewelRows.filter(row=>row.status!=='same').length,
      unitBoardDiffs:0,
      zeroDiffs:0
    },
    rows:jewelRows
  };
}

function buildExcelComparison(cells, specCells, zeroCells, fileName, sheetName, jewelImport=null, currentJewelSettings=null){
  validateExcelCompareSheet(cells,sheetName);
  const stats=computeStatsRaw();
  const dpsCompare=compareNumber(cells.M19,stats.M19);
  const inputRows=buildExcelInputRows(cells,specCells,sheetName);
  const enchantRows=buildEnchantCompareRows(getSpecEnchantCode(specCells),webControlDisplay('enchantCode'));
  const statRows=buildExcelStatRows(cells,stats);
  const buffRows=buildExcelBuffRows(cells,specCells);
  const traitRows=buildExcelTraitRows(cells);
  const zeroRows=buildZeroScoreCompareRows(zeroCells);
  const jewelRows=buildExcelJewelRows(jewelImport,currentJewelSettings);
  const dpsRow=buildCompareNumberRow('스펙 보드','DPS',cells.M19,stats.M19);
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
      jewelDiffs:jewelRows.filter(r=>r.status!=='same').length,
      zeroDiffs:zeroRows.filter(r=>r.status!=='same').length
    },
    rows:[
      dpsRow,
      ...inputRows,
      ...enchantRows,
      ...statRows,
      ...buffRows,
      ...jewelRows,
      ...zeroRows,
      ...traitRows
    ]
  };
}
const COMPARE_FILTERS={
  all:{label:'전체 보기',summaryKeys:[]},
  specInput:{label:'스펙·입력',summaryKeys:['statDiffs','inputDiffs']},
  runeBuff:{label:'룬·버프',summaryKeys:['buffDiffs']},
  traitZero:{label:'특성·승단',summaryKeys:['traitDiffs','zeroDiffs']},
  unit:{label:'유닛 보드',summaryKeys:['unitBoardDiffs']},
  jewel:{label:'쥬얼 설정',summaryKeys:['jewelDiffs']}
};
const COMPARE_FILTER_ORDER=['all','specInput','runeBuff','traitZero','unit','jewel'];
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
    baseSelect.innerHTML=presets.map(preset=>`<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</option>`).join('') || '<option value="">기준 프리셋 없음</option>';
    baseSelect.disabled=!presets.length;
    baseSelect.value=fallback;
    compareState.baseTraitPresetId=fallback;
  }
  if(!select){ updateCompareTargetFileAccess(); return; }
  if(compareState.sourceType==='excel' && compareState.workbook){
    const sheets=compareState.workbook.sheets || [];
    const names=sheets.map(sheet=>sheet.name);
    const selected=names.includes(compareState.selectedSheetName) ? compareState.selectedSheetName : (names[0] || '');
    select.innerHTML=sheets.map(sheet=>`<option value="${escapeHtml(sheet.name)}">${escapeHtml(sheet.name)}</option>`).join('');
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
    select.innerHTML=presets.map(preset=>`<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</option>`).join('') || '<option value="">프리셋 없음</option>';
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
  return !!selectedTraitPresetForComparison('base');
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
  clearCompareRestoreState(false);
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
  if(body) body.innerHTML=`<div class="excel-compare-error">${escapeHtml(message || '분석 기준 파일을 불러올 수 없습니다.')}</div>`;
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

const COMPARE_INPUT_EXCLUDE_KINDS=new Set(['스펙 보드','룬효과 버프','쥬얼 설정','유닛 보드','특성 보드','더제로 승단 정보']);
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
  if(filter==='specInput') return row.kind==='스펙 보드' || !COMPARE_INPUT_EXCLUDE_KINDS.has(row.kind);
  if(filter==='runeBuff') return row.kind==='룬효과 버프';
  if(filter==='traitZero') return row.kind==='특성 보드' || row.kind==='더제로 승단 정보';
  if(filter==='unit') return row.kind==='유닛 보드';
  if(filter==='jewel') return row.kind==='쥬얼 설정';
  return true;
}
function compareFilterCount(summary,filter){
  const config=COMPARE_FILTERS[filter];
  return config ? config.summaryKeys.reduce((total,key)=>total+(Number(summary[key]) || 0),0) : 0;
}
function compareSummaryHtml(summary,active){
  return COMPARE_FILTER_ORDER.map(filter=>compareSummaryCard(
    filter,
    COMPARE_FILTERS[filter].label,
    filter==='all' ? 0 : compareFilterCount(summary,filter),
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
    const html=escapeHtml(message ?? '비교 실패');
    body.innerHTML=`<div class="excel-compare-error">${options.keepVersionMarkup ? html.replace('5.4392','<span class="excel-compare-version">5.4392</span>') : html}</div>`;
  }
  updateCompareActionButtons();
}
function compareRowsHtml(rows,emptyMessage){
  return rows.map(row=>`<tr class="${row.status}${row.rowClass?` ${row.rowClass}`:''}"><td>${escapeHtml(row.kind)}</td><th>${escapeHtml(row.name)}</th><td>${row.current}</td><td>${row.change}</td><td class="compare-diff ${row.diffClass||''}">${row.difference}</td></tr>`).join('') ||
    `<tr class="same"><td colspan="5" class="excel-compare-no-diff">${escapeHtml(emptyMessage)}</td></tr>`;
}
function renderExcelComparison(result,options={}){
  const body=$('excelCompareBody');
  if(!body) return;
  compareState.lastResult=result;
  if(!options.preserveFilter) compareState.activeFilter='all';
  const active=COMPARE_FILTERS[compareState.activeFilter] ? compareState.activeFilter : 'all';
  compareState.activeFilter=active;
  const {summary}=result;
  const visibleRows=(result.rows||[]).filter(row=>compareRowMatchesFilter(row,active));
  const emptyMessage=active==='all' ? '기준 프리셋과 비교 프리셋이 모두 일치합니다.' : `${COMPARE_FILTERS[active]?.label || '선택한 구분'} 항목에서 차이 난 값이 없습니다.`;
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
  window.DpsModal.openMonthRune('compare');
}
function closeCompareInfo(){
  window.DpsModal.closeMonthRune();
}
function compareCanApply(){
  if(compareState.applied) return false;
  if(compareState.sourceType==='json') return !!compareState.backupState;
  if(compareState.sourceType==='traitPreset') return !!selectedTraitPresetForComparison('change');
  if(compareState.sourceType==='excel'){
    const sheetName=selectedExcelSheetName();
    return !!(compareState.workbook && sheetName && sheetName!==EXCEL_JEWEL_SHEET_NAME && compareState.lastResult);
  }
  return false;
}
function updateCompareActionButtons(){
  const apply=$('excelCompareApplyBtn');
  const jewelOnly=$('excelCompareJewelOnlyBtn');
  const reset=$('excelCompareResetBtn');
  const restore=$('excelCompareRestoreBtn');
  if(apply) apply.disabled=!compareCanApply();
  if(jewelOnly){
    const canApplyJewels=!compareState.applied && compareState.sourceType==='excel' && !!compareState.workbook && readExcelJewelSettings(compareState.workbook).present;
    jewelOnly.disabled=!canApplyJewels;
  }
  if(reset) reset.disabled=!(compareState.sourceType || compareState.lastResult || compareState.workbook || compareState.backupState || compareState.traitPresetBundle);
  if(restore) restore.disabled=!(compareState.restoreState || compareState.restoreJewelSettings);
  updateCompareTargetFileAccess();
}
function clearCompareRestoreState(updateButtons=true){
  compareState.restoreState=null;
  compareState.restoreJewelSettings=null;
  compareState.restoreTraitPresetStatus=null;
  compareState.applied=false;
  if(updateButtons) updateCompareActionButtons();
}
function restoreComparisonCurrentState(){
  if(!compareState.restoreState && !compareState.restoreJewelSettings) return;
  try{
    const restoreState=compareState.restoreState;
    const restoreJewelSettings=compareState.restoreJewelSettings;
    const restoreTraitPresetStatus=compareState.restoreTraitPresetStatus;
    if(restoreState) applyStateObject(restoreState);
    if(restoreJewelSettings){
      applyTraitPresetJewelSettings(restoreJewelSettings);
      sanitizeDpsJewelSelections();
      syncDpsBaseUnitControl();
    }
    const saved=saveState({silent:true});
    if(saved===false) throw new Error('현재값은 복원했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.');
    if(restoreTraitPresetStatus) saveTraitPresetStatusData(restoreTraitPresetStatus);
    clearCompareRestoreState(false);
    if(compareState.sourceType==='json' && compareState.backupState) renderJsonComparison(compareState.backupState);
    else if(compareState.sourceType==='traitPreset'){ hydrateCompareControls(); compareSelectedTraitPreset({preserveRestore:true}); }
    else if(compareState.sourceType==='excel'){ hydrateCompareControls(); compareSelectedExcelSheet({preserveRestore:true}); }
    updateCompareActionButtons();
    renderTraitPresetUpdateStatus();
    notifyStorageAction('현재값 복원 완료','ok',{statusAction:'load'});
  }catch(e){
    rememberAppIssue('error','[compare restore failed]',e);
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
  const runeMods=excelSelectedRuneModificationValues(cells,specCells);
  const values={...state.values, soloMode:'ON', coopMode:'OFF', coopPassenger2Dr:'0', coopPassenger3Dr:'0'};
  const roundFieldId=excelRoundFieldId(cells,sheetName);
  const unitBoardSpeedMode=excelUnitBoardSpeedModeValue(cells,sheetName);
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
    ['rModAD',runeMods.rModAD],['rModAS',runeMods.rModAS],['rModCD',runeMods.rModCD],['rModCRI',runeMods.rModCRI],
    ['rReinf',cells.J11],['rAsc',cells.J12],['raceOpt',cells.J13],
    ['opt10',cells.J14],['opt15',cells.J15],['transOpt',cells.J16],
    ['addAD',getSpecAdditionalValue(specCells,'addAD')],['addAS',getSpecAdditionalValue(specCells,'addAS')],
    ['addCD',getSpecAdditionalValue(specCells,'addCD')],['addCRI',getSpecAdditionalValue(specCells,'addCRI')],
    ['addAP',getSpecAdditionalValue(specCells,'addAP')],['addTD',getSpecAdditionalValue(specCells,'addTD')],
    ['addUA',getSpecAdditionalValue(specCells,'addUA')]
  ].forEach(([id,value])=>{ applied+=assign(id,value); });
  if(unitBoardSpeedMode!==undefined) applied+=assign('dpsBaseUnitSpeedMode',unitBoardSpeedMode);
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

/* JSON·프리셋 비교 */
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
const NEW_PRESET_ON_OFF_VALUE_IDS=new Set(['specDpsSpeedMode','dpsBaseUnitSpeedMode','dpsBaseUnitShieldOff','dpsBaseUnitShieldMaster']);
function compareSavedValueDisplay(value,id){
  if(NEW_PRESET_ON_OFF_VALUE_IDS.has(id) && (value===undefined || value===null || String(value).trim()==='')) return '미저장';
  if(TRAIT_LIMIT_INPUT_IDS.has(id)) return traitLimitDisplayText(value);
  if(id==='spBankApply') return spBankApplyDisplayValue(value);
  if(isCompareNumericValueId(id)) return formatCompareNumber(value);
  return compareDisplayText(value,id);
}
function buildSavedValueCompareRows(changeState,currentState,options={}){
  const onlyDiffs=options.onlyDiffs!==false;
  const excludedKinds=new Set(Array.isArray(options.excludeKinds) ? options.excludeKinds : []);
  const includedIds=Array.isArray(options.includeIds) ? options.includeIds : null;
  const ordered=includedIds || userStateElementIds();
  const skipped=new Set(['excelCompareFile','excelCompareSheet','enchantCode','runeChoiceType','runeChoiceValue',...ENCHANT_INPUT_IDS]);
  const sourceIds=includedIds ? ordered : [...ordered,'dpsTableMinDps',...Object.keys(currentState.values||{}),...Object.keys(changeState.values||{})];
  const ids=[...new Set(sourceIds)]
    .filter(id=>id && !skipped.has(id) && isUserStateValueId(id) && !!COMPARE_VALUE_META[id] && !excludedKinds.has(COMPARE_VALUE_META[id].kind));
  const rows=[];
  if(options.includeRuneChoice!==false){
    const runeRow=buildRuneChoiceCompareRow('룬정보', changeState.values||{}, currentState.values||{});
    if(!onlyDiffs || runeRow.status!=='same') rows.push(runeRow);
  }
  ids.forEach(id=>{
    const meta=COMPARE_VALUE_META[id];
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
function traitPresetUnitBoardResultMap(stats){
  return new Map((stats?.dpsBaseUnit?.results || []).map(result=>[String(result?.unitId || ''),result]));
}
function traitPresetUnitBoardUnitItems(unitState,boardState,result,expandedIds){
  if(!unitState) return [['상태','선택 안 함']];
  const unit=dpsBaseUnitById(unitState.unitId);
  const quantity=Math.max(1,Number(unitState.quantity)||1);
  const legendary=normalizeDpsJewelName(unitState.legendaryMythicJewel);
  const extras=(boardState?.additionalUnitSettings?.[unitState.unitId] || []).slice(0,Math.min(DPS_BASE_UNIT_EXTRA_SLOT_COUNT,Math.max(0,quantity-1)));
  const equippedCount=(legendary?1:0)+extras.filter(setting=>normalizeDpsJewelName(setting?.legendaryMythicJewel)).length;
  const unequipped=Math.max(0,quantity-equippedCount);
  const supportsAdvancedOptions=dpsBaseUnitSupportsAdvancedOptions(unit);
  const items=[
    ['유닛명',dpsBaseUnitLabel(unit || unitState.unitId)],
    ['방어력 관통',result ? dpsBaseUnitPercentText(result.excelPierce) : '—'],
    [dpsBaseUnitIsArtifact(unit)?'파장 총 DPS':'총 DPS',result ? dpsBaseUnitDpsText(result) : '—'],
    ['수량',quantity],
    ['강화 기대값',Number(unitState.enhanceExpected)||0]
  ];
  if(supportsAdvancedOptions){
    items.push(['1기 한계 돌파',Number(unitState.limitBreak)||0],['1기 전설·신화 쥬얼',legendary || '없음']);
    (boardState?.additionalUnitSettings?.[unitState.unitId] || []).slice(0,DPS_BASE_UNIT_EXTRA_SLOT_COUNT).forEach((setting,index)=>{
      const normalized=normalizeDpsBaseUnitExtraSlotSetting(setting);
      items.push([`${index+2}기 한계 돌파`,normalized.limitBreak],[`${index+2}기 전설·신화 쥬얼`,normalized.legendaryMythicJewel || '없음']);
    });
    items.push(['공허의 힘',normalizeDpsBaseUnitVoidPowerValue(unitState.voidPower)]);
  }
  if(dpsBaseUnitAllowsSlotExpansion(unit)) items.push(['슬롯 확장',expandedIds.has(unitState.unitId)?'ON':'OFF']);
  if(!dpsBaseUnitIsArtifact(unit)) items.push(['미장착 수량',unequipped]);
  return items;
}
function traitPresetUnitBoardVoidPowerUsage(value){
  const state=normalizeTraitPresetUnitBoardState(value);
  const used=state.units.reduce((sum,item)=>{
    const unit=dpsBaseUnitById(item.unitId);
    if(!dpsBaseUnitSupportsAdvancedOptions(unit) || item.unitId==='prodNarud' || normalizeDpsBaseUnitVoidPowerValue(item.voidPower)!=='ON') return sum;
    return sum+Math.max(1,Number(item.quantity)||1);
  },0);
  return Math.min(dpsBaseUnitVoidPowerLimit(),used);
}
function buildTraitPresetUnitBoardSummaryRows(changeStats,currentStats,changeBoard,currentBoard){
  const changeInfo=changeStats?.dpsBaseUnit || {};
  const currentInfo=currentStats?.dpsBaseUnit || {};
  const changeAchievement=dpsBaseUnitAchievementState(changeInfo.achievementRate);
  const currentAchievement=dpsBaseUnitAchievementState(currentInfo.achievementRate);
  return [
    buildCompareTextRow('유닛 보드','클리어 기준',dpsBaseUnitNumberText(changeInfo.requiredDps,DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS),dpsBaseUnitNumberText(currentInfo.requiredDps,DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS)),
    buildCompareTextRow('유닛 보드','클리어 기대값',dpsBaseUnitNumberText(changeInfo.expectedDps,DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS),dpsBaseUnitNumberText(currentInfo.expectedDps,DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS)),
    buildCompareTextRow('유닛 보드','달성률 상태',changeAchievement.label,currentAchievement.label),
    buildCompareTextRow('유닛 보드','달성률',dpsBaseUnitAchievementText(changeInfo.achievementRate),dpsBaseUnitAchievementText(currentInfo.achievementRate)),
    buildCompareTextRow('유닛 보드','공허의 힘 사용량',`${traitPresetUnitBoardVoidPowerUsage(changeBoard)} / ${dpsBaseUnitVoidPowerLimit()}`,`${traitPresetUnitBoardVoidPowerUsage(currentBoard)} / ${dpsBaseUnitVoidPowerLimit()}`)
  ];
}

function buildTraitPresetUnitBoardCompareRows(changeValue,currentValue,options={}){
  const changeIncluded=options.changeIncluded===true;
  const currentIncluded=options.currentIncluded===true;
  const change=normalizeTraitPresetUnitBoardState(changeIncluded ? changeValue : null);
  const current=normalizeTraitPresetUnitBoardState(currentIncluded ? currentValue : null);
  const changeResults=traitPresetUnitBoardResultMap(options.changeStats);
  const currentResults=traitPresetUnitBoardResultMap(options.currentStats);
  const changeExpanded=new Set(normalizeDpsBaseUnitSlotExpansions(change.slotExpansions));
  const currentExpanded=new Set(normalizeDpsBaseUnitSlotExpansions(current.slotExpansions));
  const rows=[buildCompareTextRow('유닛 보드','유닛 구성',changeIncluded?'포함':'없음 · 선택 안 함',currentIncluded?'포함':'없음 · 선택 안 함')];
  rows.push(buildCompareNumberRow('유닛 보드','선택 유닛 수',change.units.length,current.units.length,0.0001));
  const changeBySlot=new Map(change.units.map(item=>[item.slot,item]));
  const currentBySlot=new Map(current.units.map(item=>[item.slot,item]));
  const slots=[...new Set([...changeBySlot.keys(),...currentBySlot.keys()])].sort((a,b)=>a-b);
  slots.forEach(slot=>{
    const changeUnit=changeBySlot.get(slot);
    const currentUnit=currentBySlot.get(slot);
    rows.push(buildCompareDetailRow(
      '유닛 보드',
      `${slot+1}번 유닛`,
      traitPresetUnitBoardUnitItems(changeUnit,change,changeResults.get(changeUnit?.unitId),changeExpanded),
      traitPresetUnitBoardUnitItems(currentUnit,current,currentResults.get(currentUnit?.unitId),currentExpanded)
    ));
  });
  return rows;
}
function captureDamageBoardCompareData(stats){
  const enemy=stats?.enemyData || {};
  const round=Math.max(0,Number(enemy.round)||0);
  const diffName=vs('diff');
  const rpBonus=enemyRoundTimeBonus(diffName);
  return {
    pierce:`${fmt(stats?.excelPierce,0)}%`,
    armor:fullNumber(enemy.armor),
    count:enemyDisplayCountText(round),
    hp:fullNumber(enemy.hp),
    shield:fullNumber(enemy.shield),
    roundTime:Number.isFinite(Number(stats?.roundTime)) ? `${fmt(stats.roundTime,1)}초` : '—',
    rpTime:rpBonus>0 || isTowerDifficulty(diffName) ? `RP ${fmt(rpBonus,0)}초 / 최대 8초` : '-'
  };
}
function snapshotComparisonState(changeState,currentState,options={}){
  const restoreState=currentState || makeStateObject();
  const includeUnitBoard=options.includeUnitBoard===true;
  const includeJewelSettings=options.includeJewelSettings===true;
  const restoreUnitBoard=includeUnitBoard ? captureTraitPresetUnitBoardState() : null;
  const restoreJewelSettings=includeJewelSettings ? captureTraitPresetJewelSettings() : null;
  applyStateObject(changeState);
  try{
    if(includeJewelSettings){
      applyTraitPresetJewelSettings(options.jewelSettings || {legendaryMythicJewels:{}});
    }
    if(includeUnitBoard){
      applyTraitPresetUnitBoardState(options.unitBoardIncluded ? options.unitBoard : null,{recalculate:false,resetArtifactView:false});
    }
    const stats=computeStatsRaw();
    return {state:makeStateObject(),stats,damageBoard:captureDamageBoardCompareData(stats)};
  }finally{
    applyStateObject(restoreState);
    if(includeJewelSettings && restoreJewelSettings) applyTraitPresetJewelSettings(restoreJewelSettings);
    if(includeUnitBoard && restoreUnitBoard) applyTraitPresetUnitBoardState(restoreUnitBoard,{recalculate:false,resetArtifactView:false});
    if(includeUnitBoard || includeJewelSettings) recalc();
  }
}
function buildStateStatRows(changeStats,currentStats){
  return EXCEL_COMPARE_STATS.map(([,name,,,getDisplay])=>{
    const changeDisplay=excelCompareRound(getDisplay(changeStats),6);
    const currentDisplay=excelCompareRound(getDisplay(currentStats),6);
    const displayCompare=compareNumber(changeDisplay,currentDisplay);
    return {kind:'스펙 보드',name,current:formatCompareNumber(currentDisplay),change:formatCompareNumber(changeDisplay),
      difference:formatCompareDiff(displayCompare.diff),status:displayCompare.status,diffClass:compareNumberDiffClass(displayCompare.diff)};
  });
}
function buildStateDamageBoardContextRows(changeSnapshot,currentSnapshot){
  const change=changeSnapshot?.damageBoard || {};
  const current=currentSnapshot?.damageBoard || {};
  return [
    buildCompareTextRow('스펙 보드','방어력 관통',change.pierce,current.pierce),
    buildCompareTextRow('스펙 보드','적 방어력',change.armor,current.armor),
    buildCompareTextRow('스펙 보드','물량 / 총물량',change.count,current.count),
    buildCompareTextRow('스펙 보드','적 체력',change.hp,current.hp),
    buildCompareTextRow('스펙 보드','실드',change.shield,current.shield),
    buildCompareTextRow('스펙 보드','라운드 시간',change.roundTime,current.roundTime),
    buildCompareTextRow('스펙 보드','RP 시간',change.rpTime,current.rpTime)
  ];
}
function buildJsonComparison(changeState,options={}){
  const liveState=makeStateObject();
  const baseState=options.baseState ? normalizeSavedState(options.baseState) : liveState;
  const traitPresetMode=options.sourceType==='traitPreset';
  const currentSnapshot=options.baseState ? snapshotComparisonState(baseState,liveState,{
    includeUnitBoard:traitPresetMode,
    unitBoardIncluded:options.currentUnitBoardIncluded,
    unitBoard:options.currentUnitBoard,
    includeJewelSettings:traitPresetMode,
    jewelSettings:options.currentJewelSettings
  }) : (()=>{
    const stats=computeStatsRaw();
    return {state:liveState,stats,damageBoard:captureDamageBoardCompareData(stats)};
  })();
  const currentState={...currentSnapshot.state,fileName:options.baseFileName || currentSnapshot.state.fileName,sheetName:options.baseSheetName || currentSnapshot.state.sheetName};
  const currentStats=currentSnapshot.stats;
  const changeSnapshot=snapshotComparisonState(changeState,liveState,{
    includeUnitBoard:traitPresetMode,
    unitBoardIncluded:options.changeUnitBoardIncluded,
    unitBoard:options.changeUnitBoard,
    includeJewelSettings:traitPresetMode,
    jewelSettings:options.changeJewelSettings
  });
  const effectiveChangeState={...changeSnapshot.state,fileName:changeState.fileName || changeSnapshot.state.fileName,sheetName:changeState.sheetName || changeSnapshot.state.sheetName};
  const changeStats=changeSnapshot.stats;
  const compareChangeState=traitPresetMode ? (normalizeTraitPresetState(changeState) || effectiveChangeState) : effectiveChangeState;
  const compareCurrentState=traitPresetMode ? (normalizeTraitPresetState(baseState) || currentState) : currentState;
  const dpsCompare=compareNumber(changeStats.M19,currentStats.M19);
  const dpsRow=buildCompareNumberRow('스펙 보드','DPS',changeStats.M19,currentStats.M19);
  const inputRows=buildSavedValueCompareRows(compareChangeState,compareCurrentState,{
    onlyDiffs:false,
    excludeKinds:traitPresetMode ? ['유닛 보드','쥬얼 설정'] : []
  });
  const unitConditionRows=traitPresetMode ? buildSavedValueCompareRows(compareChangeState,compareCurrentState,{onlyDiffs:false,includeIds:DPS_BASE_UNIT_MODE_VALUE_IDS,includeRuneChoice:false}) : [];
  const enchantRows=buildEnchantCompareRows(enchantCompareCodeFromValues(compareChangeState.values),enchantCompareCodeFromValues(compareCurrentState.values));
  const statRows=[...buildStateStatRows(changeStats,currentStats),...buildStateDamageBoardContextRows(changeSnapshot,currentSnapshot)];
  const traitRows=buildSavedTraitCompareRows(compareChangeState,compareCurrentState);
  const zeroRows=buildSavedZeroScoreCompareRows(compareChangeState.zeroScore,compareCurrentState.zeroScore,{onlyDiffs:true});
  const jewelRows=traitPresetMode ? buildTraitPresetJewelCompareRows(options.changeJewelSettings,options.currentJewelSettings) : [];
  const unitBoardRows=traitPresetMode ? [
    ...unitConditionRows,
    ...buildTraitPresetUnitBoardSummaryRows(changeStats,currentStats,options.changeUnitBoard,options.currentUnitBoard),
    ...buildTraitPresetUnitBoardCompareRows(options.changeUnitBoard,options.currentUnitBoard,{
      changeIncluded:options.changeUnitBoardIncluded,
      currentIncluded:options.currentUnitBoardIncluded,
      changeStats,
      currentStats
    })
  ] : [];
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
      jewelDiffs:jewelRows.filter(r=>r.status!=='same').length,
      unitBoardDiffs:unitBoardRows.filter(r=>r.status!=='same').length,
      zeroDiffs:zeroRows.length
    },
    rows:[dpsRow,...inputRows,...enchantRows,...statRows,...jewelRows,...unitBoardRows,...zeroRows,...traitRows]
  };
}
function renderJsonComparison(changeState,options={}){
  if(options.useSelectedBase){
    const basePreset=selectedTraitPresetForComparison('base');
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
function applySelectedExcelJewelsOnly(){
  if(!compareState.workbook || compareState.applied || compareState.sourceType!=='excel') return false;
  const previousTraitPresetStatus=loadTraitPresetStatusData();
  try{
    const {jewelImport,previousJewelSettings,staged}=applyExcelJewelImport(
      compareState.workbook,
      '쥬얼값은 적용했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.',
      '[Excel jewel-only rollback failed]'
    );
    compareState.restoreState=null;
    compareState.restoreJewelSettings=previousJewelSettings;
    compareState.restoreTraitPresetStatus=previousTraitPresetStatus;
    compareState.applied=true;
    compareSelectedExcelSheet({preserveRestore:true});
    updateCompareActionButtons();
    renderTraitPresetUpdateStatus();
    const suffix=staged.needsUpdate ? ' · 프리셋 업데이트 필요' : ' · 기존 데이터와 동일';
    notifyStorageAction(`쥬얼 데이터 적용 완료 · 전설/신화 ${jewelImport.recognizedLegendary}개${suffix}`,'ok',{statusAction:'import'});
    return true;
  }catch(e){
    clearCompareRestoreState(false);
    rememberAppIssue('error','[Excel jewel-only apply failed]',e);
    showToast(e?.message || String(e),'err');
    updateCompareActionButtons();
    return false;
  }
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
    try{ applyStateObject(previousState); }catch(rollbackError){ rememberAppIssue('error','[backup apply rollback failed]', rollbackError); }
    clearCompareRestoreState(false);
    rememberAppIssue('error','[backup apply failed]',e);
    showToast(e?.message||String(e),'err');
    updateCompareActionButtons();
  }
}
function applySelectedExcelSheet(){
  if(!compareState.workbook || compareState.applied) return;
  const sheetName=selectedExcelSheetName();
  if(!sheetName){ showToast('선택한 시트를 찾을 수 없습니다.','err'); return; }
  if(sheetName===EXCEL_JEWEL_SHEET_NAME) return applySelectedExcelJewelsOnly();
  const previousState=makeStateObject();
  const previousJewelSettings=captureTraitPresetJewelSettings();
  const previousTraitPresetStatus=loadTraitPresetStatusData();
  try{
    const cells=compareState.workbook.getCells(sheetName);
    validateExcelCompareSheet(cells,sheetName);
    const specCells=compareState.workbook.getCells('스펙');
    const zeroCells=getZeroScoreSheetCells(compareState.workbook);
    const additionalInfo=inspectSpecAdditionalStructure(specCells);
    if(!additionalInfo.valid) throw new Error(additionalInfo.message);
    const imported=buildExcelState(cells,specCells,zeroCells,sheetName);
    const jewelImport=readExcelJewelSettings(compareState.workbook);
    compareState.selectedSheetName=sheetName;
    applyStateObject(imported.state);
    if(jewelImport.present) applyExcelJewelSettings(jewelImport);
    const saved=saveState({silent:true});
    if(saved===false) throw new Error('변경값은 적용했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.');
    compareState.selectedSheetName=sheetName;
    compareState.restoreState=previousState;
    compareState.restoreJewelSettings=jewelImport.present ? previousJewelSettings : null;
    compareState.restoreTraitPresetStatus=jewelImport.present ? previousTraitPresetStatus : null;
    compareState.applied=true;
    if(jewelImport.present) stageTraitPresetJewelSettings(jewelImport.settings);
    hydrateCompareControls();
    compareSelectedExcelSheet({preserveRestore:true});
    updateCompareActionButtons();
    renderTraitPresetUpdateStatus();
    notifyStorageAction(`변경값 ${imported.applied}개 적용 완료`,'ok',{statusAction:'import'});
  }catch(e){
    try{
      applyStateObject(previousState);
      applyTraitPresetJewelSettings(previousJewelSettings);
      sanitizeDpsJewelSelections();
      syncDpsBaseUnitControl();
    }catch(rollbackError){ rememberAppIssue('error','[Excel apply rollback failed]', rollbackError); }
    clearCompareRestoreState(false);
    rememberAppIssue('error','[Excel apply failed]',e);
    showToast(e?.message||String(e),'err');
    updateCompareActionButtons();
  }
}
function buildExcelComparisonForSelectedBase(cells,specCells,zeroCells,fileName,sheetName,jewelImport){
  const basePreset=selectedTraitPresetForComparison('base');
  if(!basePreset) throw new Error('기준 프리셋을 선택하세요.');
  const baseState=normalizeSavedState(basePreset.state);
  if(!baseState) throw new Error('기준 프리셋 데이터가 올바르지 않습니다.');
  const liveState=makeStateObject();
  applyStateObject(baseState);
  try{
    const baseBundle=compareState.baseTraitPresetBundle || loadTraitPresetStore();
    return buildExcelComparison(cells,specCells,zeroCells,fileName,sheetName,jewelImport,baseBundle?.jewelSettings);
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
    const jewelImport=readExcelJewelSettings(compareState.workbook);
    compareState.sourceType='excel';
    compareState.selectedSheetName=sheetName;
    if(sheetName===EXCEL_JEWEL_SHEET_NAME){
      const baseBundle=compareState.baseTraitPresetBundle || loadTraitPresetStore();
      renderExcelComparison(buildExcelJewelOnlyComparison(
        compareState.workbook.fileName,
        sheetName,
        jewelImport,
        baseBundle?.jewelSettings
      ));
      updateCompareActionButtons();
      return;
    }
    const cells=compareState.workbook.getCells(sheetName);
    const specCells=compareState.workbook.getCells('스펙');
    const zeroCells=getZeroScoreSheetCells(compareState.workbook);
    const additionalInfo=inspectSpecAdditionalStructure(specCells);
    if(!additionalInfo.valid){
      setCompareError(additionalInfo.message, {keepVersionMarkup:true});
      return;
    }
    renderExcelComparison(buildExcelComparisonForSelectedBase(cells,specCells,zeroCells,compareState.workbook.fileName,sheetName,jewelImport));
    updateCompareActionButtons();
  }catch(e){
    rememberAppIssue('error','[Excel compare failed]',e);
    setCompareError(e?.message||String(e));
  }
}
function isTraitPresetCompareBundle(parsed){
  return !!(parsed && typeof parsed==='object' && isTraitPresetFileType(parsed.type) && Array.isArray(parsed.presets));
}
function isCurrentTraitPresetBundlePayload(parsed){
  if(!isTraitPresetCompareBundle(parsed)) return false;
  const fileVersion=+parsed.fileVersion || 0;
  const schemaVersion=+parsed.schemaVersion || 0;
  if(fileVersion<TRAIT_PRESET_MIN_FILE_VERSION || schemaVersion<TRAIT_PRESET_MIN_SCHEMA_VERSION) return false;
  return parsed.presets.every(item=>{
    if(!item || typeof item!=='object' || hasOwn(item,'savedState') || hasOwn(item,'data')) return false;
    if(!item.state || typeof item.state!=='object') return false;
    if((+item.schemaVersion || 0)<TRAIT_PRESET_MIN_SCHEMA_VERSION || (+item.state.schemaVersion || 0)<TRAIT_PRESET_MIN_SCHEMA_VERSION) return false;
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
    return {sourceType:'traitPreset',traitPresetBundle:{...store,fileName:file.name}};
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
    rememberAppIssue('error','[compare base file failed]',e);
    if(isUnsupportedOldTraitPresetError(e)) showUnsupportedOldTraitPresetToast();
    rejectCompareBaseFile(e?.message||String(e));
  }
}
async function handleExcelCompareFile(file){
  const basePreset=selectedTraitPresetForComparison('base');
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
    rememberAppIssue('error','[compare file failed]',e);
    if(isUnsupportedOldTraitPresetError(e)) showUnsupportedOldTraitPresetToast();
    const apply=$('excelCompareApplyBtn');
    const reset=$('excelCompareResetBtn');
    if(apply) apply.disabled=true;
    if(reset) reset.disabled=true;
    if(body) body.innerHTML=`<div class="excel-compare-error">${escapeHtml(e?.message||String(e))}</div>`;
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
    if(e.target.closest('[data-excel-compare-jewel-only]')) applySelectedExcelJewelsOnly();
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
          rememberAppIssue('error','[JSON compare base change failed]',err);
          const body=$('excelCompareBody');
          if(body) body.innerHTML=`<div class="excel-compare-error">${escapeHtml(err?.message||String(err))}</div>`;
          updateCompareActionButtons();
        }
      }else updateCompareActionButtons();
    }
    if(e.target.id==='excelCompareSheet' && compareState.sourceType==='traitPreset'){ compareState.selectedSheetName=e.target.value; compareSelectedTraitPreset(); }
  });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeCompareInfo(); });
}
/* 특성 보드 */
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
  return qs('.mobile-page-trait.active') || qs('.col-left') || document.scrollingElement || document.documentElement;
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
    try{next.focus({preventScroll:true});}catch{next.focus();}
    if(typeof next.select==='function') next.select();
    if(host) host.scrollTop=hostScroll;
    window.scrollTo(pageX,pageY);
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
    if(applied===0) showToast('보유 재화가 부족합니다','warn');
  }else{
    const next=Math.max(0,before-step);
    applied=before-next;
    INV[row]=next;
  }
  if(applied>0){
    recalc();
    scheduleAutoSave();
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
  if(applied<wanted) showToast('보유 재화 한도까지만 입력되었습니다','warn');
  recalc();
  scheduleAutoSave();
}
function adjMax(row){
  try{
    if(row===116) return false;
    const before=INV[row]||0;
    fillRowToBudget(row);
    recalc();
    scheduleAutoSave();
    if((INV[row]||0)<=before) showToast('보유 재화가 부족합니다','warn');
    return (INV[row]||0)>before;
  }catch(e){
    rememberAppIssue('error','[adjMax failed]', e);
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
  scheduleAutoSave();
}
function resetTier(tier){
  TRAITS.forEach(t=>{
    const row=t[0];
    if(t[2]!==tier || row===116) return;
    INV[row]=0;
  });
  if(116 in INV) INV[116]=1;
  recalc();
  scheduleAutoSave();
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
  showToast('선택 범위에 유틸 특성이 없습니다','warn');
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
  scheduleAutoSave();
  if(!changed) showToast('보유 재화가 부족하거나 이미 최대입니다','warn');
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
  scheduleAutoSave();
  return changed;
}
function clearUtility(){
  const changed=clearTraitInvestmentsBy(isSpUtilityClearTrait);
  if(!changed) showToast('초기화할 유틸 특성이 없습니다','warn');
  return changed>0;
}
function renderTraitEfficiencyItem(cand,idx){
  return `
    <div class="trait-efficiency-grid trait-efficiency-row">
      <span class="trait-eff-name">${escapeHtml(cand.label)}</span>
      <span>${escapeHtml(traitRecommendationInvestText(cand))}</span>
      <span>${escapeHtml(traitRecommendationGainText(cand.gain))}</span>
      <span>${escapeHtml(traitRecommendationCostText(cand))}</span>
      <button type="button" class="ui-action-btn mini-btn master trait-eff-apply" data-action="applyTraitEfficiencyTop" data-rank="${idx}">적용</button>
    </div>`;
}
function renderTraitEfficiencyTop5(){
  const body=$('traitEfficiencyTop5Body');
  if(!body) return;
  try{
    const list=buildTraitEfficiencyRecommendations(5);
    body.innerHTML=list.length
      ? list.map(renderTraitEfficiencyItem).join('')
      : '<div class="trait-efficiency-empty">현재 적용 가능한 추천 항목이 없습니다.</div>';
  }catch(e){
    rememberAppIssue('error','[trait top5 failed]', e);
    body.innerHTML='<div class="trait-efficiency-empty">추천 항목 계산 실패</div>';
  }
}
function applyTraitEfficiencyTop(trigger){
  const rank=Math.max(0, Math.round(+trigger?.dataset?.rank||0));
  const cand=buildTraitEfficiencyRecommendations(5)[rank];
  if(!cand){
    showToast('적용할 추천 항목이 없습니다','warn');
    return false;
  }
  const currentCost=cand.changes.reduce((sum,[row,add])=>sum+traitOptimizationDeltaCost(row,add),0);
  const rem=traitOptimizationRemaining(cand.kind);
  if(!Number.isFinite(currentCost) || currentCost<=0 || currentCost>rem){
    showToast('보유 재화가 부족합니다','warn');
    renderTraitEfficiencyTop5();
    return false;
  }
  for(const [row,add] of cand.changes){
    INV[row]=Math.min(TMAX[row]||999,(INV[row]||0)+add);
  }
  recalc();
  scheduleAutoSave();
  return true;
}
function clearAll(){
  try{
    const changed=clearTraitInvestmentsBy(isSpAttackClearTrait);
    if(!changed) showToast('초기화할 공격 특성이 없습니다','warn');
    return changed>0;
  }catch(e){
    rememberAppIssue('error','[clearAll failed]', e);
    alertApp('특성 초기화 실패: '+(e && e.message ? e.message : e));
    return false;
  }
}
/* 화면 설정 */
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
  try{ localStorage.setItem(DPS_CONFIG.storage.fontKey, String(next)); }catch(error){ rememberAppIssue('warn','글씨 크기 저장', error); }
  if(!options.silent) notifyStorageAction('글씨 크기 '+Math.round(next*100)+'% 저장 완료', 'ok');
  return true;
}
function loadFontScale(){
  let scale=DPS_CONFIG.ui.fontScaleDefault;
  try{
    const saved=parseFloat(localStorage.getItem(DPS_CONFIG.storage.fontKey)||'');
    if(Number.isFinite(saved)) scale=saved;
  }catch(error){
    rememberAppIssue('warn','글씨 크기 불러오기', error);
  }
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
/* 더제로 승단 */

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

function compareZeroTextRow(name, changeValue, currentValue){
  return buildCompareTextRow('더제로 승단 정보',name,changeValue,currentValue);
}
function compareZeroNumberRow(kind,name,changeValue,currentValue){
  return buildCompareNumberRow(kind,name,changeValue,currentValue,0.0001);
}

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
  rows.push(compareZeroNumberRow('더제로 승단 정보','목표 추가점수',changeSummary.total,currentSummary.total));
  rows.push(compareZeroNumberRow('더제로 승단 정보','목표 완료',changeSummary.targetScore,currentSummary.targetScore));
  rows.push(compareZeroTextRow('현재 / 목표 승단',`${zeroRankName(changeSummary.currentTotal)} → ${zeroRankName(changeSummary.targetScore)}`,`${zeroRankName(currentSummary.currentTotal)} → ${zeroRankName(currentSummary.targetScore)}`));
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
  const comboExcel=zeroTowerComboFromRows(zeroScoreStateFromExcel(zeroCells).rows);
  const comboWeb=zeroTowerComboFromRows(webState.rows);
  addZeroTowerComboCompareRows(rows,'도전의탑',comboExcel,comboWeb);
  const webSummary=zeroScoreSummaryFromState(webState);
  rows.push(compareZeroNumberRow('더제로 승단 정보','현재 승단점수',zeroCells.H28,webSummary.currentTotal));
  rows.push(compareZeroNumberRow('더제로 승단 정보','목표 추가점수',(excelNumber(zeroCells.I28) ?? 0)-(excelNumber(zeroCells.H28) ?? 0),webSummary.total));
  rows.push(compareZeroNumberRow('더제로 승단 정보','목표 완료',zeroCells.I28,webSummary.targetScore));
  rows.push(compareZeroTextRow('현재 / 목표 승단',`${zeroRankName(excelNumber(zeroCells.H28) ?? 0)} → ${zeroRankName(excelNumber(zeroCells.I28) ?? 0)}`,`${zeroRankName(webSummary.currentTotal)} → ${zeroRankName(webSummary.targetScore)}`));
  return rows;
}
const ZERO_RANK_FALLBACK_TABLE=[
  {name:'입문',score:0},{name:'견습',score:100},{name:'숙련',score:150},{name:'전문',score:200},
  {name:'장인',score:250},{name:'명장',score:300},{name:'명장+',score:350},{name:'도인',score:400},
  {name:'도인+',score:450},{name:'지존',score:500},{name:'지존+',score:550},{name:'패왕',score:600},
  {name:'패왕+',score:650},{name:'제왕',score:700},{name:'제왕+',score:750},{name:'신황',score:800},{name:'신황+',score:850}
];
function getZeroRankTable(){
  const rows=[...qsa('.zero-rank-entry')].map(row=>{
    const name=excelText(row.dataset.rankName);
    const score=excelNumber(row.dataset.rankScore);
    return name && score!==null ? {name,score,row} : null;
  }).filter(Boolean);
  return rows.length ? rows : ZERO_RANK_FALLBACK_TABLE;
}
function zeroRankEntry(score){
  const value=Number(score)||0;
  const table=getZeroRankTable();
  return table.reduce((best,item)=>value>=item.score ? item : best, table[0] || ZERO_RANK_FALLBACK_TABLE[0]);
}
function zeroRankName(score){
  return zeroRankEntry(score)?.name || '입문';
}
function updateZeroRankHighlights(currentRank, targetRank){
  const current=excelText(currentRank);
  const target=excelText(targetRank);
  qsa('.zero-rank-entry').forEach(row=>{
    const name=excelText(row.dataset.rankName);
    row.classList.toggle('zero-rank-current', !!current && name===current);
    row.classList.toggle('zero-rank-target', !!target && name===target);
    row.classList.toggle('zero-rank-same', !!current && current===target && name===current);
  });
  const card=qs('.zero-rank-result-card');
  if(card){
    card.classList.toggle('zero-rank-same', !!current && current===target);
    card.classList.toggle('zero-rank-upgrade', !!current && !!target && current!==target);
  }
}
function updateZeroScoreCalculator(){
  const calc=qs('.zero-score-calc');
  const state=collectZeroScoreState();
  if(!calc || !state) return;
  let currentTotal=0, total=0;
  calc.querySelectorAll('.zero-calc-row').forEach((row,index)=>{
    const result=zeroScoreRowCalculation(state.rows[index]);
    currentTotal+=result.currentScore;
    total+=result.score;
    const out=row.querySelector('.zero-row-score');
    if(out) out.textContent=String(result.score);
  });
  const targetScore=currentTotal+total;
  const currentRank=zeroRankName(currentTotal);
  const targetRank=zeroRankName(targetScore);
  const values=[
    ['.zero-current-score',currentTotal],
    ['.zero-total-add',total],
    ['.zero-target-score',targetScore],
    ['.zero-current-rank',currentRank],
    ['.zero-target-rank',targetRank]
  ];
  values.forEach(([selector,value])=>{
    const element=calc.querySelector(selector);
    if(element) element.textContent=String(value);
  });
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
    scheduleAutoSave();
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
/* 이벤트·초기화 */
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
const ACTION_HANDLERS={
  optimizeSP,
  optimizeUtility,
  clearUtility:()=>requestConfirmAction('clearUtility','한 번 더 누르면 유틸 초기화', clearUtility),
  applyTraitEfficiencyTop,
  clearAll:()=>requestConfirmAction('clearAll','한 번 더 누르면 유틸 제외 특성 초기화', clearAll),
  saveTraitPreset:(...args)=>window.DpsPreset.saveCurrent(...args),
  loadTraitPreset:(...args)=>window.DpsPreset.loadSelected(...args),
  updateTraitPreset:(...args)=>window.DpsPreset.updateCurrent(...args),
  renameTraitPreset:(...args)=>window.DpsPreset.renameCurrent(...args),
  deleteTraitPreset:(...args)=>window.DpsPreset.deleteCurrent(...args),
  resetAllTraitPresetState:(...args)=>window.DpsPreset.resetAll(...args),
  exportTraitPresets:(...args)=>window.DpsPreset.exportFile(...args),
  importTraitPresets:(...args)=>window.DpsPreset.openImport(...args),
  compareTraitPreset:(...args)=>window.DpsPreset.openAnalysis(...args),
  openDpsTable,
  openMonthRuneTab:(trigger)=>window.DpsModal.openMonthRune(trigger?.dataset?.monthRuneOpenTab || 'compare'),
  toggleConvenienceMenu,
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
  if(target.matches?.('[data-dps-base-unit-slot-enhance]')) return false;
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
      syncErosionControlElements();
    }
    if(RUNE_CHOICE_SYNC_IDS.has(target.id)) syncRuneChoice();
    if(ENCHANT_INPUT_ID_SET.has(target.id)) syncEnchantInputs();
    if(RUNE_OPTION_SELECT_ID_SET.has(target.id)) syncExclusiveRuneOptions();
    if(target.id==='soloMode' || target.id==='coopMode'){
      syncBattleMode(target.id);
    }
    if(target?.matches?.('[data-dps-base-unit-quantity-store],[data-dps-base-unit-slot-quantity]')){
      normalizeDpsBaseUnitQuantityInput(target);
      syncDpsBaseUnitSelectionFromQuantities(true);
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
      scheduleAutoSave();
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
function bindDamageBoardSwitchEvents(){
  document.addEventListener('click', e=>{
    const speedToggle=e.target?.closest?.('[data-spec-dps-speed-toggle]');
    if(speedToggle){
      e.preventDefault();
      toggleSpecDpsSpeedMode();
      return;
    }
    const artifactToggle=e.target?.closest?.('#artifactDpsViewToggle');
    if(!artifactToggle) return;
    e.preventDefault();
    setArtifactDpsViewEnabled(!isArtifactDpsViewEnabled());
    requestAppUpdate();
  }, true);
}
function bindDpsBaseUnitConditionEvents(){
  document.addEventListener('click',e=>{
    const toggle=e.target?.closest?.('[data-dps-base-unit-condition-toggle]');
    if(!toggle || toggle.disabled) return;
    e.preventDefault();
    toggleDpsBaseUnitCondition(toggle);
  },true);
}
function bindAppEvents(){
  if(appEventsBound) return;
  appEventsBound=true;
  [
    bindFontScaleViewportGuard, bindActionEvents, bindTraitHoldEvents, bindTraitInputEvents,
    ()=>window.DpsModal.bindEvents(), bindExcelCompareEvents, ()=>window.DpsPreset.bindEvents(), bindJewelImageEvents,
    bindConvenienceMenuEvents, bindZeroScoreCalculator, bindTraitLimitDisplayEvents, bindDpsBaseUnitControlEvents, bindReactiveInputs,
    bindButtonPressFeedback, bindDamageBoardSwitchEvents, bindDpsBaseUnitConditionEvents, bindAppTitleVersion
  ].forEach(fn=>fn());
}
function initApp(){
  window.DpsAnimation?.init();
  loadFontScale();
  renderZeroScoreCalculatorRows();
  bindAppEvents();
  syncEnchantCodeFromInputs(true);
  syncSelectButtons();
  syncBuffChoiceButtons();
  syncDpsBaseUnitControl();
  syncExclusiveRuneOptions();
  updateZeroScoreCalculator();
  formatAllMoneyInputs();
  syncTraitLimitInputs();
  loadState();
  window.DpsPreset.init();
}
function markAppReady(){
  try{
    if(typeof window.dpsSyncResponsiveLayout === 'function') window.dpsSyncResponsiveLayout();
  }catch(error){ rememberAppIssue('warn','반응형 레이아웃 동기화', error); }
  if(typeof window.dpsMarkAppReady==='function'){
    window.dpsMarkAppReady();
    return;
  }
  document.documentElement.classList.remove('dps-booting');
  try{
    const boot=$('dpsBootScreen');
    if(boot) boot.setAttribute('aria-hidden','true');
  }catch(error){ rememberAppIssue('warn','부팅 화면 숨김', error); }
}
function markAppError(code, error){
  if(typeof window.dpsShowBootError==='function') window.dpsShowBootError(code, error);
  else{
    window.DPS_LAST_INIT_ERROR={code,error,time:Date.now()};
  }
}
window.dpsStartApp=function(){
  if(window.__dpsAppStarted) return;
  window.__dpsAppStarted=true;
  try{
    initApp();
    markAppReady();
  }catch(e){
    markAppError('D1001', e);
  }
};
