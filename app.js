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
  syncTeamSelect({restorePersonal: !!sourceId && !coopOn});
}
function syncTeamSelect(options={}){
  const el=$('team');
  if(!el) return;
  const row=el.closest?.('[data-basic-row="team"]');
  const coopActive=typeof isCoopActive==='function' ? isCoopActive(vs('diff')) : normalizeOnOffValue(vs('coopMode'),'OFF')==='ON';
  const current=normalizeTeamCountValue(el.value);
  if(coopActive){
    if(current!=='3') el.dataset.personalTeamValue=current;
    el.value='3';
    el.disabled=true;
    row?.classList.add('is-locked');
    return;
  }
  el.disabled=false;
  const value=normalizeTeamCountValue(options.restorePersonal && el.dataset.personalTeamValue ? el.dataset.personalTeamValue : current);
  el.value=value;
  el.dataset.personalTeamValue=value;
  row?.classList.remove('is-locked');
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
  const rpTimeText=bonus>0 || isTowerDifficulty(vs('diff'))
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
  if(window.ExcelFeature?.isBlocked?.()){
    window.ExcelFeature?.showEnded?.();
    window.ExcelFeature?.guard?.();
    return;
  }
  hydrateCompareControls();
  if(compareState.lastResult) renderExcelComparison(compareState.lastResult,{preserveFilter:true});
  else if(compareState.sourceType==='json' && compareState.backupState) renderJsonComparison(compareState.backupState);
  else if(compareState.sourceType==='traitPreset' && compareState.traitPresetBundle) compareSelectedTraitPreset({preserveRestore:true});
  else if(compareState.workbook && compareState.sourceType==='excel') compareSelectedExcelSheet({preserveRestore:true});
  else updateCompareActionButtons();
}
/* 엑셀·프리셋 비교 기능은 excel.js로 분리 */

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
  return percent===null ? '—' : `${dpsBaseUnitNumberText(percent,{trillion:true})}%`;
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
function dpsBaseUnitFieldHtml(fieldLabel, fieldClass, content){
  return `<div class="dps-base-unit-field ${fieldClass}"><span class="dps-base-unit-field-label">${fieldLabel}</span>${content}</div>`;
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
  const entry=`<div class="dps-base-unit-entry dps-base-unit-slot${empty ? ' is-empty' : ''}${unit && dpsBaseUnitHasQuantity(unit) ? ' has-quantity' : ' is-fixed'}" data-dps-base-unit-slot-row="${slotIndex}">${dpsBaseUnitFieldHtml('유닛명','dps-base-unit-name-field',selectControl)}${dpsBaseUnitFieldHtml('공격력','dps-base-unit-attack-field',`<span class="dps-base-unit-board-cell dps-base-unit-board-attack">${escapeHtml(attack)}</span>`)}${dpsBaseUnitFieldHtml('방어력 관통','dps-base-unit-pierce-field',`<span class="dps-base-unit-board-cell dps-base-unit-board-pierce">${escapeHtml(pierce)}</span>`)}${dpsBaseUnitFieldHtml(unit && dpsBaseUnitIsArtifact(unit)?'파장 총 DPS':'총 DPS','dps-base-unit-dps-field',`<b class="dps-base-unit-board-cell dps-base-unit-board-dps">${escapeHtml(dps)}</b>`)}${dpsBaseUnitFieldHtml('수량','dps-base-unit-quantity-field',`<div class="dps-base-unit-board-cell dps-base-unit-board-quantity">${dpsBaseUnitQuantityControlHtml(unit,slotIndex)}</div>`)}</div>`;
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
function writeDpsBaseUnitSelection(input,slotInput,slots){
  const selectedIds=slots.filter(Boolean);
  const normalized=normalizeDpsBaseUnitsValue(selectedIds);
  input.value=normalized;
  slotInput.value=serializeDpsBaseUnitSlots(slots);
  syncDpsBaseUnitQuantitiesForSelection(selectedIds);
  return normalized;
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
  writeDpsBaseUnitSelection(input,slotInput,slots);
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
  writeDpsBaseUnitSelection(input,slotInput,slots);
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

/* 엑셀 입력·비교 처리 기능은 excel.js로 분리 */

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
  backupTraitPresets:(...args)=>window.DpsPreset.openBackup(...args),
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
  'traitPresetBackupName',
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
