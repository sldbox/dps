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

let calculationElementOverrides=null;
function withCalculationElementOverrides(ids,callback){
  const previous=calculationElementOverrides;
  const next=previous ? new Map(previous) : new Map();
  (ids || []).forEach(id=>{
    const real=document.getElementById(id);
    if(!real) return;
    const clone=real.cloneNode(true);
    if('value' in real) clone.value=real.value;
    if('checked' in real) clone.checked=real.checked;
    if('indeterminate' in real) clone.indeterminate=real.indeterminate;
    next.set(id,clone);
  });
  calculationElementOverrides=next;
  try{return callback();}
  finally{calculationElementOverrides=previous;}
}
const $=id=>calculationElementOverrides?.get(id) || document.getElementById(id);
const qs=selector=>document.querySelector(selector);
const qsa=selector=>document.querySelectorAll(selector);
function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, char=>({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));
}

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
function setElementProp(id, prop, value){const el=$(id); if(el) el[prop]=value;}
function setText(id,val){setElementProp(id,'textContent',val);}
function setValue(id,val){setElementProp(id,'value',String(val));}
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
function setTogglePressed(el, active, options={}){
  if(!el) return;
  setClassState(el, options.classes || ['active','is-active'], active);
  el.setAttribute(options.attribute || 'aria-pressed', active ? 'true' : 'false');
  if(options.activeText || options.inactiveText) el.textContent=active ? (options.activeText || '') : (options.inactiveText || '');
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
  commitAppUpdate();
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
    setTogglePressed(item, !!input?.checked, {classes:'is-active'});
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
  syncTeamSelect({restorePersonal: !!sourceId && !coopOn, preserveCurrent: !sourceId});
}
function syncTeamSelect(options={}){
  const el=$('team');
  if(!el) return;
  const row=el.closest?.('[data-basic-row="team"]');
  const coopActive=typeof isCoopActive==='function' ? isCoopActive(vs('diff')) : normalizeOnOffValue(vs('coopMode'),'OFF')==='ON';
  const current=normalizeTeamCountValue(el.value);
  const optionValues=coopActive ? [2,3] : [1,2,3];
  syncSelectOptionsBySignature(
    el,
    `team:${coopActive?'coop':'solo'}:${optionValues.join(',')}`,
    optionValues.map(value=>({value,label:String(value)})),
    'teamOptionSignature'
  );
  el.disabled=false;
  row?.classList.remove('is-locked');
  if(coopActive){
    if(current==='1') el.dataset.personalTeamValue=current;
    const source=options.preserveCurrent ? current : (el.dataset.coopTeamValue || current);
    const value=normalizeTeamCountValue(source, 2)==='1' ? '2' : normalizeTeamCountValue(source, 2);
    el.value=value;
    el.dataset.coopTeamValue=value;
    syncCoopPassengerRows();
    return;
  }
  const restored=options.restorePersonal && el.dataset.personalTeamValue ? el.dataset.personalTeamValue : current;
  const value=normalizeTeamCountValue(restored, 1);
  el.value=value;
  el.dataset.personalTeamValue=value;
  syncCoopPassengerRows();
}
function syncCoopPassengerRows(){
  const coopActive=typeof isCoopActive==='function' ? isCoopActive(vs('diff')) : normalizeOnOffValue(vs('coopMode'),'OFF')==='ON';
  const teamCount=typeof effectiveTeamCount==='function' ? effectiveTeamCount() : Math.max(1, Math.min(3, Number(v('team')) || 1));
  qsa('[data-coop-passenger-row]').forEach(row=>{
    const player=Number(row.dataset.coopPassengerRow)||0;
    row.hidden=!coopActive || player>teamCount;
  });
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
function renderDpsSummary(s){
  updateDpsContextSummary();
  syncDpsBaseUnitControl();
  const artifactView=isArtifactDpsViewEnabled();
  setText('dpsMainLabel', artifactView ? '유물 DPS' : 'DPS');
  if(shouldHideDpsForRound()){
    setText('dpsVal', '—');
    renderDpsBaseUnitSummary(s,true);
    syncDpsMinDpsInputs();
    updateDpsRiskViews(NaN);
    if(isDpsTableOpen()) renderDpsTablePanelContent();
    return;
  }
  const artifactResult=artifactView ? currentArtifactDpsResult() : null;
  const displayDps=artifactView ? artifactResult.dps : s.M19;
  setText('dpsVal', Number.isFinite(displayDps) ? displayDps.toFixed(2) : '—');
  renderDpsBaseUnitSummary(s,false);
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
  ['PIERCE', s=>`${fmt(s.effectivePierce,0)}%`, s=>`${fmt(s.effectivePierce,0)}%`],
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
  const teamCount=typeof effectiveTeamCount==='function' ? effectiveTeamCount() : Math.max(1, Math.min(3, Number(v('team')) || 1));
  qsa('[data-coop-stat-row]').forEach(row=>{
    const player=Number(row.dataset.coopStatRow)||0;
    row.hidden=!coopActive || player>teamCount;
  });
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
}
function renderCalculatedViews(s){
  renderEnemyData(s.enemyData);
  renderSkillDamage(s);
  renderDpsSummary(s);
  renderStatSummary(s);
  syncSpecDpsSpeedSwitch();
  syncArtifactDpsViewSwitch();
  syncDpsTableLabels();
  renderEnhanceSummary(s.enhanceStats);
  renderResourceSummary(s);
  updateTraits();
}
/* 계산 실행·예약 */
let appCalculationRevision=0;
let appUpdateTimer=0;
let pendingAppUpdateSave=false;
function invalidateAppCalculations(){
  appCalculationRevision++;
}
function recalc(options={}){
  try{
    syncPreCalculationViews();
    withArtifactDpsViewBuffApplied(()=>{
      const stats=computeStatsRaw();
      invalidateAppCalculations();
      renderCalculatedViews(stats);
    });
    if(options.save!==false) saveState({silent:true});
  }catch(e){rememberAppIssue('error','recalc',e);}
}
function requestAppUpdate(options={}){
  invalidateAppCalculations();
  pendingAppUpdateSave = pendingAppUpdateSave || options.save!==false;
  if(appUpdateTimer) clearTimeout(appUpdateTimer);
  appUpdateTimer=setTimeout(()=>{
    const save=pendingAppUpdateSave;
    appUpdateTimer=0;
    pendingAppUpdateSave=false;
    recalc({save});
  }, DPS_CONFIG.ui.updateDelay);
}
function commitAppUpdate(options={}){
  const recalculate=options.recalculate ?? 'defer';
  const save=options.save!==false;
  const saveNow=options.saveNow===true;
  if(recalculate==='now'){
    if(appUpdateTimer) clearTimeout(appUpdateTimer);
    appUpdateTimer=0;
    pendingAppUpdateSave=false;
    recalc({save:save && saveNow});
  }else if(recalculate!==false) requestAppUpdate({save:save && saveNow});
  if(save) scheduleAutoSave();
}
function renderEnhanceSummary(stats=null){
  const e=stats || unitEnhanceStats();
  setTextMap({
    enhanceChanceView:(e.chance*100).toFixed(2)+'%',
    enhanceCountView:`${fmt(e.count,0)}회`,
    enhanceValueView:fmt(e.value,0)
  });
}
function renderEnchantPreview(){
  const keys=['ad','cri','ua','td','sr','hr'];
  const outIds=['enchOutAD','enchOutCRI','enchOutUA','enchOutTD','enchOutSR','enchOutHR'];
  const enchantStats=currentEnchantStats();
  keys.forEach((key,i)=>{
    const e=enchantStats[i];
    const val=key==='ua'
      ? e[key].toFixed(2)+'×'
      : fmt(e[key], ['ad','cri','td'].includes(key)?0:2);
    const out=$(outIds[i]);
    if(out) out.textContent=val;
  });
}

const XP_CUT_DIVISOR_GROUPS=[
  {
    label:'협동 2인',
    rows:[
      {stage:'1단계', divisor:10},
      {stage:'2단계', divisor:20},
      {stage:'3단계', divisor:30},
      {stage:'4단계', divisor:40}
    ]
  },
  {
    label:'협동 3인',
    rows:[
      {stage:'1단계', divisor:6},
      {stage:'2단계', divisor:12},
      {stage:'3단계', divisor:22},
      {stage:'4단계', divisor:30}
    ]
  }
];
function renderXpCut(){
  const base=Math.max(0, v('sp'))*0.8;
  const target=$('xpCutRows');
  if(!target) return;
  target.innerHTML=XP_CUT_DIVISOR_GROUPS.map(group=>{
    const rows=group.rows.map(row=>{
      const value=big(base/row.divisor);
      return `<div class="bus-cut-row"><span class="bus-cut-stage">${row.stage}·${row.divisor}배</span><span class="bus-cut-value">${value}</span></div>`;
    }).join('');
    return `<div class="bus-cut-group"><span class="bus-cut-mode">${group.label}</span><div class="bus-cut-group-rows">${rows}</div></div>`;
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
const UNIFIED_DPS_SPEED_MODE_INPUT_IDS=Object.freeze(['specDpsSpeedMode','dpsBaseUnitSpeedMode']);
function setUnifiedDpsSpeedModeValue(enabled){
  const disabled=!speedModeSupported();
  const active=!disabled && !!enabled;
  UNIFIED_DPS_SPEED_MODE_INPUT_IDS.forEach(id=>{
    const input=$(id);
    if(input) input.value=active ? 'ON' : 'OFF';
  });
  return {active,disabled};
}
function normalizeUnifiedDpsSpeedModeValue(){
  const active=UNIFIED_DPS_SPEED_MODE_INPUT_IDS.some(id=>storedSpeedModeEnabled(id));
  return setUnifiedDpsSpeedModeValue(active);
}
function syncSpecDpsSpeedSwitch(){
  const toggle=$('specDpsSpeedModeToggle');
  if(!toggle) return;
  const {active,disabled}=normalizeUnifiedDpsSpeedModeValue();
  syncOnOffSwitch(toggle,{active,disabled,label:'스피드 모드',containerSelector:'.spec-dps-speed-switch-wrap'});
}
function applyUnifiedDpsSpeedModeToggle(active){
  setUnifiedDpsSpeedModeValue(!active);
  syncSpecDpsSpeedSwitch();
  syncDpsBaseUnitConditionSwitches();
  commitAppUpdate();
  return true;
}
function toggleSpecDpsSpeedMode(){
  const toggle=$('specDpsSpeedModeToggle');
  const {active,disabled}=normalizeUnifiedDpsSpeedModeValue();
  if(toggle?.disabled || disabled) return false;
  return applyUnifiedDpsSpeedModeToggle(active);
}
/* 유닛 보드 전투 모드·적 방어 효과 스위치 */
function syncDpsBaseUnitConditionSwitch(toggle){
  if(!toggle) return;
  const inputId=toggle.dataset.dpsBaseUnitConditionToggle || '';
  const input=$(inputId);
  const label=toggle.dataset.dpsBaseUnitConditionLabel || '설정';
  if(inputId==='dpsBaseUnitSpeedMode'){
    const {active,disabled}=normalizeUnifiedDpsSpeedModeValue();
    syncOnOffSwitch(toggle,{active,disabled,label,containerSelector:'.dps-base-unit-condition-item'});
    return;
  }
  const disabled=dpsBaseUnitConditionLocked(inputId);
  if(disabled && input) input.value='OFF';
  const active=!disabled && storedSpeedModeEnabled(inputId);
  syncOnOffSwitch(toggle,{active,disabled,label,containerSelector:'.dps-base-unit-condition-item'});
}
function syncDpsBaseUnitConditionSwitches(){
  qsa('[data-dps-base-unit-condition-toggle]').forEach(syncDpsBaseUnitConditionSwitch);
}
function toggleDpsBaseUnitCondition(toggle){
  const inputId=toggle?.dataset?.dpsBaseUnitConditionToggle || '';
  const input=$(inputId);
  if(!input || toggle.disabled) return false;
  if(inputId==='dpsBaseUnitSpeedMode'){
    const {active,disabled}=normalizeUnifiedDpsSpeedModeValue();
    if(disabled) return false;
    return applyUnifiedDpsSpeedModeToggle(active);
  }
  if(dpsBaseUnitConditionLocked(inputId)) return false;
  input.value=storedSpeedModeEnabled(inputId) ? 'OFF' : 'ON';
  syncDpsBaseUnitConditionSwitch(toggle);
  commitAppUpdate();
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
  if(!storageState.isLoading) scheduleAutoSave();
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

let dpsPreviewCacheRevision=-1;
const dpsPreviewValueCache=new Map();
function dpsTablePreviewValue(diff, penance, round, options={}){
  if(dpsPreviewCacheRevision!==appCalculationRevision){
    dpsPreviewValueCache.clear();
    dpsPreviewCacheRevision=appCalculationRevision;
  }
  const artifactView=isArtifactDpsViewEnabled();
  const cacheKey=JSON.stringify([artifactView,diff,penance,round,options.battleMode||'',options.teamCount||'']);
  if(dpsPreviewValueCache.has(cacheKey)) return dpsPreviewValueCache.get(cacheKey);
  const value=artifactView
    ? calculateArtifactDpsPreview(diff, penance, round, options).dps
    : computeDpsPreview(diff, penance, round, options);
  dpsPreviewValueCache.set(cacheKey,value);
  return value;
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
function buildCoopDpsMatrix(round, teamCount){
  return buildPenanceDpsMatrix({
    difficulties:COOP_DPS_TABLE_DIFFICULTIES,
    penanceMin:COOP_DPS_TABLE_PENANCE_MIN,
    penanceMax:COOP_DPS_TABLE_PENANCE_MAX,
    currentPen:v('penance'),
    round,
    previewOptions:{battleMode:'coop', teamCount},
    tableClass:`dps-coop-matrix dps-coop-${teamCount}-matrix`
  });
}
function selectedCoopDpsTableTeamCount(){
  return normalizeTeamCountValue(vs('team'), 2)==='3' ? 3 : 2;
}
function buildCoopDpsTable(round){
  const teamCount=selectedCoopDpsTableTeamCount();
  const roundLabel=`${round} 라운드`;
  const block=`
    <div class="dps-coop-group" aria-label="협동 ${teamCount}인 DPS표">
      <div class="dps-coop-title"><b>협동 ${teamCount}인 · ${roundLabel}</b></div>
      <div class="dps-coop-scroll">${buildCoopDpsMatrix(round, teamCount)}</div>
    </div>
  `;
  return `<div class="dps-table-scroll dps-coop-table-scroll"><div class="dps-coop-stack">${block}</div></div>`;
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
function monthRuneEffectGroups(items){
  const groups=[];
  monthRunePairs(items).forEach(([code,desc])=>{
    const descText=String(desc||'').trim();
    const last=groups[groups.length-1];
    if(last && last.desc===descText){
      last.codes.push(code);
      return;
    }
    groups.push({codes:[code],desc:descText});
  });
  return groups;
}
function renderMonthRuneCodePills(codes){
  return (codes||[]).filter(Boolean).map(code=>`<b class="month-rune-code-pill">${escapeHtml(code)}</b>`).join('');
}
function renderMonthRuneRows(items, className=''){
  return monthRuneEffectGroups(items).map(group=>`
    <div class="month-rune-effect-row${className ? ' '+className : ''}">
      <div class="month-rune-code-list">${renderMonthRuneCodePills(group.codes)}</div>
      <span>${escapeHtml(group.desc)}</span>
    </div>
  `).join('');
}
function renderMonthRuneVariant(title, base, items, className=''){
  return `
    <section class="month-rune-side ${className}">
      <h3><span>${escapeHtml(title)}</span><em>${escapeHtml(base)}</em></h3>
      <div class="month-rune-effects">${renderMonthRuneRows(items, className)}</div>
    </section>
  `;
}
function renderMonthRuneCard(item, info={}){
  const title=item.title || `${item.month}월 룬`;
  return `
    <article class="month-rune-card">
      <header class="month-rune-card-head">
        <div class="month-rune-title-block">
          <b>${escapeHtml(title)}</b>
        </div>
      </header>
      <div class="month-rune-compare">
        ${renderMonthRuneVariant('일반 룬', info.normalBase || 'RP+1', item.normal||[], 'normal')}
        ${renderMonthRuneVariant('이달의 룬+', info.plusBase || 'RP+2', item.plus||[], 'plus')}
      </div>
    </article>
  `;
}
function renderMonthRunePanelContent(info){
  const months=Array.isArray(info?.months)?info.months:[];
  const content=months.length ? months.map(item=>renderMonthRuneCard(item, info)).join('') : '<div class="month-rune-empty">이달룬 데이터가 없습니다.</div>';
  return `<div class="month-rune-grid">${content}</div>`;
}
function getJewelImageSources(name){
  const safeName=encodeURIComponent(String(name||'').trim());
  const key=`jw/${String(name||'').trim()}.png`;
  const version=encodeURIComponent(window.DPS_BUILD_VERSION || 'dev');
  const assetUrl=typeof window.dpsAssetUrl==='function' ? window.dpsAssetUrl : null;
  const remoteUrl=typeof window.dpsRemoteAssetUrl==='function'
    ? window.dpsRemoteAssetUrl(key, key)
    : `https://sldbox.github.io/dps/jw/${safeName}.png?v=${version}`;
  const localUrl=assetUrl ? assetUrl(`./jw/${safeName}.png`, key) : `./jw/${safeName}.png?v=${version}`;
  return {
    src:remoteUrl,
    fallback:localUrl
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
function renderMonthRuneModalPanel(name,content,active=false){
  return `<section class="month-rune-panel${active?' is-active':''}" data-month-rune-panel="${name}" role="tabpanel" aria-labelledby="monthRuneTitle"${active?'':' hidden'}>${content}</section>`;
}
const FIELD_REGISTRY={
  sp:{kind:'기본 정보',name:'시작 SP',save:true},
  xp:{kind:'기본 정보',name:'보유 XP',save:true},
  bxp:{kind:'기본 정보',name:'보유 BXP',save:true},
  rp:{kind:'기본 정보',name:'보유 RP',save:true},
  soul:{kind:'기본 정보',name:'본인 심연의혼',save:true},
  coralShard:{kind:'기본 정보',name:'코랄의 파편',save:true},
  aiurShard:{kind:'기본 정보',name:'아이어의 파편',save:true},
  xerusShard:{kind:'기본 정보',name:'제루스의 파편',save:true},
  diff:{kind:'기본 정보',name:'난이도',save:true},
  round:{kind:'기본 정보',name:'목표 라운드',save:true},
  challengeTowerFloor:{kind:'기본 정보',name:'도전의탑 층',save:true},
  soloMode:{kind:'기본 정보',name:'개인',save:true},
  coopMode:{kind:'기본 정보',name:'협동',save:true},
  coopPassenger2Dr:{kind:'기본 정보',name:'승객 2P 방어력 감소',save:true},
  coopPassenger3Dr:{kind:'기본 정보',name:'승객 3P 방어력 감소',save:true},
  team:{kind:'기본 정보',name:'출발 지원 인원수',save:true},
  pbless:{kind:'기본 정보',name:'파워 블레스',save:true},
  spBankApply:{kind:'기본 정보',name:'SP 은행',save:true},
  penance:{kind:'기본 정보',name:'고행 단계',save:true},
  titleTdBonus:{kind:'기본 정보',name:'타이틀 총 데미지',save:true},
  dpsTableMinDps:{kind:'기본 정보',name:'도전할 최소 DPS',save:true},
  specDpsSpeedMode:{kind:'스펙 보드',name:'스피드 모드',save:true},
  dpsBaseUnits:{kind:'유닛 보드',name:'유닛 구성',save:true},
  dpsBaseUnitSlots:{kind:'유닛 보드',name:'유닛 선택 위치',save:true},
  dpsJewelSettings:{kind:'쥬얼 설정',name:'전설·신화 쥬얼',save:true},
  dpsBaseUnitExtraSettings:{kind:'유닛 보드',name:'추가 유닛 쥬얼 & 한계 돌파',save:true},
  dpsBaseUnitSlotExpansions:{kind:'유닛 보드',name:'슬롯 확장',save:true},
  dpsBaseUnitSpeedMode:{kind:'유닛 보드',name:'스피드 모드',save:true},
  dpsBaseUnitShieldOff:{kind:'유닛 보드',name:'적버프 제거 · 쉴드오프',save:true},
  dpsBaseUnitShieldMaster:{kind:'유닛 보드',name:'슈퍼실드 주기변경 · 쉴드마스',save:true},
  erosionStack:{kind:'기본 정보',name:'침식 스텍',save:true},
  jewelErosionRes:{kind:'기본 정보',name:'심연 내성',save:true},
  aprRuneNormal:{kind:'룬효과 버프',name:'4월 일반',save:true},
  aprRunePlus:{kind:'룬효과 버프',name:'4월 강화(+)',save:true},
  sepRuneNormal:{kind:'룬효과 버프',name:'9월 일반',save:true},
  sepRunePlus:{kind:'룬효과 버프',name:'9월 강화(+)',save:true},
  overEnhance:{kind:'룬효과 버프',name:'오버핸스',save:true},
  repairEnhance:{kind:'룬효과 버프',name:'리페핸스',save:true},
  enhanceMaster:{kind:'룬효과 버프',name:'강화의 달인',save:true},
  prodArtifact:{kind:'룬효과 버프',name:'유물',save:true},
  prodNova:{kind:'룬효과 버프',name:'비밀 작전 노바',save:true},
  prodTeratron:{kind:'룬효과 버프',name:'테라트론',save:true},
  prodAmon:{kind:'룬효과 버프',name:'아몬',save:true},
  prodAdun:{kind:'룬효과 버프',name:'아둔의 창',save:true},
  prodKerrigan:{kind:'룬효과 버프',name:'불새 케리건',save:true},
  prodOvermind:{kind:'룬효과 버프',name:'초월체',save:true},
  prodNarud:{kind:'룬효과 버프',name:'나루드',save:true},
  flowerSkill1:{kind:'룬효과 버프',name:'근성의 꽃가루',save:true},
  flowerSkill2:{kind:'룬효과 버프',name:'바람의 꽃가루',save:true},
  flowerSkill3:{kind:'룬효과 버프',name:'안개의 꽃가루',save:true},
  rAD:{kind:'룬정보',name:'공격력',save:true},
  rModAD:{kind:'룬정보',name:'공격력 개조',save:true},
  runeChoiceType:{kind:'룬정보',name:'룬 특수 옵션',save:true},
  runeChoiceValue:{kind:'룬정보',name:'룬 특수 옵션',save:true},
  rAS:{kind:'룬정보',name:'공격속도',save:true},
  rModAS:{kind:'룬정보',name:'공격속도 개조',save:true},
  rCD:{kind:'룬정보',name:'크리티컬 데미지',save:true},
  rModCD:{kind:'룬정보',name:'크리티컬 데미지 개조',save:true},
  rCRI:{kind:'룬정보',name:'크리티컬 확률',save:true},
  rModCRI:{kind:'룬정보',name:'크리티컬 확률 개조',save:true},
  rReinf:{kind:'룬정보',name:'룬 강화 수',save:true},
  rAsc:{kind:'룬정보',name:'룬 각성',save:true},
  raceOpt:{kind:'룬정보',name:'종족 업그레이드',save:true},
  opt10:{kind:'룬정보',name:'10강 옵션',save:true},
  opt15:{kind:'룬정보',name:'15강 옵션',save:true},
  transOpt:{kind:'룬정보',name:'초월 옵션',save:true},
  addAD:{kind:'에디셔널',name:'공격력',save:true},
  addAS:{kind:'에디셔널',name:'공격속도',save:true},
  addCD:{kind:'에디셔널',name:'크리티컬 데미지',save:true},
  addCRI:{kind:'에디셔널',name:'크리티컬 확률',save:true},
  addAP:{kind:'에디셔널',name:'마법공격력',save:true},
  addTD:{kind:'에디셔널',name:'총 데미지',save:true},
  addUA:{kind:'에디셔널',name:'유닛 가속',save:true},
  enchAD:{kind:'인챈트 레벨 / 결과',name:'공격력',save:true},
  enchCRI:{kind:'인챈트 레벨 / 결과',name:'크리티컬 확률',save:true},
  enchUA:{kind:'인챈트 레벨 / 결과',name:'유닛 가속',save:true},
  enchTD:{kind:'인챈트 레벨 / 결과',name:'총 데미지',save:true},
  enchSR:{kind:'인챈트 레벨 / 결과',name:'실드 감소',save:true},
  enchHR:{kind:'인챈트 레벨 / 결과',name:'체력 감소',save:true},
  enchantCode:{kind:'인챈트 레벨 / 결과',name:'인챈트 코드',save:true},
  optTier:{kind:'특성 보드',name:'특성 최적화',save:true},
  utilOptTier:{kind:'특성 보드',name:'유틸 마스터',save:true},
  traitLimitAD:{kind:'특성 투자 제한',name:'공격력',save:true},
  traitLimitAS:{kind:'특성 투자 제한',name:'공격속도',save:true},
  traitLimitCRI:{kind:'특성 투자 제한',name:'크리티컬 확률',save:true},
  traitLimitCD:{kind:'특성 투자 제한',name:'크리티컬 데미지',save:true},
  traitLimitMultiTarget:{kind:'특성 투자 제한',name:'멀티타겟',save:true},
  traitLimitInfinite:{kind:'특성 투자 제한',name:'무한특성',save:true},
  skillDouble:{kind:'성소 보드',name:'더블스페',save:true},
  skillMode:{kind:'성소 보드',name:'모드',save:true},
  skillRound:{kind:'성소 보드',name:'라운드',save:true},
  unitGrade:{kind:'룬효과 버프',name:'유닛 등급'},
  unitLevel:{kind:'룬효과 버프',name:'유닛 레벨'},
};

/* 유닛 보드 상태·표시 */
function dpsBaseUnitFieldEntries(){
  const units=dpsBaseUnitList();
  const quantityEntries=units.filter(dpsBaseUnitHasQuantity).map(unit=>[
    dpsBaseUnitQuantityInputId(unit),
    {kind:'유닛 보드',name:`${unit.label || unit.id} 수량`,save:true}
  ]);
  const settingEntries=units.flatMap(unit=>{
    const entries=[[dpsBaseUnitEnhanceInputId(unit),{kind:'유닛 보드',name:`${unit.label || unit.id} 강화 기대값`,save:true}]];
    if(dpsBaseUnitSupportsAdvancedOptions(unit)) entries.push(
      [dpsBaseUnitLimitBreakInputId(unit),{kind:'유닛 보드',name:`${unit.label || unit.id} 한계 돌파`,save:true}],
      [dpsBaseUnitJewelInputId(unit),{kind:'유닛 보드',name:`${unit.label || unit.id} 전설·신화 쥬얼`,save:true}],
      [dpsBaseUnitVoidPowerInputId(unit),{kind:'유닛 보드',name:`${unit.label || unit.id} 공허의 힘`,save:true}]
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
  const unit=resolveDpsBaseUnit(unitOrId);
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
const DPS_BASE_UNIT_MAX_SPEED_EPSILON=0.000001;

function dpsBaseUnitResultHasMaxAttackSpeed(result){
  if(result?.isMaxAttackSpeed===true) return true;
  const cooldown=Number(result?.finalCooldown);
  const maxSpeedCooldown=Number(result?.maxSpeedCooldown);
  return Number.isFinite(cooldown) && Number.isFinite(maxSpeedCooldown) && maxSpeedCooldown>0 && cooldown<=maxSpeedCooldown+DPS_BASE_UNIT_MAX_SPEED_EPSILON;
}
function dpsBaseUnitDisplayLabel(unit){
  return dpsBaseUnitLabel(unit);
}
function dpsBaseUnitCooldownText(value){
  const cooldown=Number(value);
  if(!Number.isFinite(cooldown) || cooldown<=0) return '';
  return cooldown.toLocaleString('ko-KR',{minimumFractionDigits:4,maximumFractionDigits:4});
}
function dpsBaseUnitFinalCooldownText(result){
  return dpsBaseUnitCooldownText(result?.finalCooldown);
}
function dpsBaseUnitMaxCooldownText(result){
  return dpsBaseUnitCooldownText(result?.maxSpeedCooldown);
}
function dpsBaseUnitNameFieldLabelHtml(unit){
  const result=unit ? dpsBaseUnitResultDisplayMap.get(String(unit.id || '')) || null : null;
  const maxSpeed=unit && !dpsBaseUnitIsArtifact(unit) && dpsBaseUnitResultHasMaxAttackSpeed(result);
  const speedText=unit && !dpsBaseUnitIsArtifact(unit) ? (maxSpeed ? dpsBaseUnitMaxCooldownText(result) : dpsBaseUnitFinalCooldownText(result)) : '';
  const speedLabel=maxSpeed ? '공속MAX' : '공속';
  const speedHtml=speedText ? `<span class="dps-base-unit-speed-value">(${speedLabel}: ${escapeHtml(speedText)})</span>` : '';
  return `<span class="dps-base-unit-name-label${maxSpeed?' is-max-attack-speed':''}">유닛명${speedHtml}</span>`;
}

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
  const selectedResultEntries=(hidden ? [] : results).map(item=>[String(item?.unitId || ''),item]).filter(([id])=>id);
  dpsBaseUnitResultDisplayMap=new Map(selectedResultEntries);
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
  return dpsBaseUnitHasQuantity(unit) ? normalizeDpsBaseUnitQuantityValue(dpsBaseUnitStoreInput('quantity',unit)?.value || 0,unit) : '1';
}
function dpsBaseUnitQuantityControlHtml(unit, slotIndex){
  if(!unit) return '<span class="dps-base-unit-fixed-qty is-auto-value">—</span>';
  if(!dpsBaseUnitHasQuantity(unit)) return '<span class="dps-base-unit-fixed-qty is-auto-value">1</span>';
  const limit=dpsBaseUnitQuantityLimit(unit);
  const value=normalizeDpsBaseUnitQuantityValue(dpsBaseUnitStoreInput('quantity',unit)?.value || 0,unit);
  const label=escapeHtml(dpsBaseUnitLabel(unit.id));
  return `<div class="dps-base-unit-qty-control" data-dps-base-unit-qty-control="${escapeHtml(unit.id)}"><button class="ui-choice-btn dps-base-unit-qty-btn" data-dps-base-unit-qty-delta="-1" data-dps-base-unit-id="${escapeHtml(unit.id)}" type="button" aria-label="${label} 수량 감소">−</button><input class="dps-base-unit-qty-input" id="dpsBaseUnitSlotQty${slotIndex+1}" data-dps-base-unit-slot-quantity="${escapeHtml(unit.id)}" inputmode="numeric" type="text" min="0" max="${limit}" value="${escapeHtml(value)}" aria-label="${label} 수량"/><button class="ui-choice-btn dps-base-unit-qty-btn" data-dps-base-unit-qty-delta="1" data-dps-base-unit-id="${escapeHtml(unit.id)}" type="button" aria-label="${label} 수량 증가">+</button></div>`;
}
function dpsJewelOptionHtml(values,selected,suffix=''){
  return (Array.isArray(values) ? values : []).map(value=>`<option value="${escapeHtml(value)}"${String(value)===String(selected)?' selected':''}>${escapeHtml(value)}${suffix}</option>`).join('');
}
function dpsJewelAbilityTexts(name){
  const row=(window.DPS_DATA?.RAW_JEWEL_DATA || []).find(item=>String(item?.[0] || '')===String(name || '')) || [];
  return {legendary:String(row[1] || ''),mythic:String(row[2] || '')};
}
function dpsJewelFinalStatItemHtml(label,value,suffix='%'){
  return `<span class="dps-jewel-final-item"><em>${escapeHtml(label)}</em><b>${escapeHtml(value)}${escapeHtml(suffix)}</b></span>`;
}
function dpsJewelFinalStatsHtml(finalStats){
  return `<span class="dps-jewel-final-label">최종</span>
      ${dpsJewelFinalStatItemHtml('공격력',finalStats.ad)}
      ${dpsJewelFinalStatItemHtml('공격속도',finalStats.as)}
      ${dpsJewelFinalStatItemHtml('총데미지',finalStats.td)}
      ${dpsJewelFinalStatItemHtml('가속',finalStats.ua)}`;
}
function dpsJewelConfigCardHtml(name,settings){
  const input=typeof normalizeDpsJewelSettingForName==='function' ? normalizeDpsJewelSettingForName(name,settings?.[name]) : normalizeDpsJewelSetting(settings?.[name]);
  const finalStats=dpsJewelFinalStats(name,settings);
  const options=window.DPS_DATA?.DPS_JEWEL_INPUT_OPTIONS || {};
  const fieldOptions=key=>{
    if(typeof dpsJewelIsChrysoberyl==='function' && dpsJewelIsChrysoberyl(name) && ['ad','as','td','ua'].includes(key)){
      const fixed=Number(DPS_CHRYSOBERYL_FIXED_STATS?.[key]) || 0;
      return fixed ? [0,fixed] : [0];
    }
    return options[key];
  };
  const field=(key,label)=>`<label class="dps-jewel-field"><span>${label}</span><select data-dps-jewel-name="${escapeHtml(name)}" data-dps-jewel-field="${key}" aria-label="${escapeHtml(name)} ${label}">${dpsJewelOptionHtml(fieldOptions(key),input[key])}</select></label>`;
  const mythic=finalStats.mythic==='Y';
  const gradeClass=mythic?'is-mythic':'is-legendary';
  const gradeText=mythic?'신화':'전설';
  const initial=name ? name.charAt(0) : '?';
  const imageSources=getJewelImageSources(name);
  const fallbackAttr=imageSources.fallback && imageSources.fallback!==imageSources.src ? ` data-fallback-src="${escapeHtml(imageSources.fallback)}"` : '';
  const ability=dpsJewelAbilityTexts(name);
  return `<article class="dps-jewel-card${mythic?' is-mythic':''}" data-dps-jewel-card="${escapeHtml(name)}">
    <header class="dps-jewel-card-head">
      <div class="jewel-card-visual" aria-hidden="true">
        <img src="${escapeHtml(imageSources.src)}"${fallbackAttr} data-jewel-image="1" alt="" loading="lazy">
        <span>${escapeHtml(initial)}</span>
      </div>
      <div class="dps-jewel-title-block"><b class="${gradeClass}">${escapeHtml(gradeText)} ${escapeHtml(name)}</b></div>
    </header>
    <div class="jewel-ability-list dps-jewel-ability-list">
      ${renderJewelAbility('전설', ability.legendary)}
      ${renderJewelAbility('신화', ability.mythic)}
    </div>
    <div class="dps-jewel-final" aria-label="${escapeHtml(name)} 최종 옵션">
      ${dpsJewelFinalStatsHtml(finalStats)}
    </div>
    <div class="dps-jewel-fields">${field('ad','공격력')}${field('as','공격속도')}${field('td','총데미지')}${field('ua','가속')}${field('enhance','강화')}${field('mythic','신화')}</div>
  </article>`;
}
function refreshDpsJewelConfigCard(name,settings=null,focusKey=''){
  const grid=$('dpsJewelConfigGrid');
  if(!grid) return false;
  const card=[...grid.querySelectorAll('[data-dps-jewel-card]')].find(item=>String(item.getAttribute('data-dps-jewel-card') || '')===String(name || ''));
  if(!card) return false;
  const normalized=settings || dpsJewelSettingsObject();
  const input=typeof normalizeDpsJewelSettingForName==='function' ? normalizeDpsJewelSettingForName(name,normalized?.[name]) : normalizeDpsJewelSetting(normalized?.[name]);
  const finalStats=dpsJewelFinalStats(name,normalized);
  const mythic=finalStats.mythic==='Y';
  card.classList.toggle('is-mythic',mythic);
  const title=card.querySelector('.dps-jewel-title-block b');
  if(title){
    const titleText=`${mythic?'신화':'전설'} ${name}`;
    const titleClass=mythic?'is-mythic':'is-legendary';
    if(title.textContent!==titleText) title.textContent=titleText;
    if(title.className!==titleClass) title.className=titleClass;
  }
  const finalBox=card.querySelector('.dps-jewel-final');
  if(finalBox){
    const finalHtml=dpsJewelFinalStatsHtml(finalStats);
    if(finalBox.innerHTML!==finalHtml) finalBox.innerHTML=finalHtml;
  }
  ['ad','as','td','ua','enhance','mythic'].forEach(field=>{
    const control=card.querySelector(`[data-dps-jewel-field="${field}"]`);
    const next=String(input[field] ?? '');
    if(control && String(control.value)!==next) control.value=next;
  });
  if(focusKey){
    requestAnimationFrame(()=>card.querySelector(`[data-dps-jewel-field="${String(focusKey).replace(/"/g,'\\"')}"]`)?.focus({preventScroll:true}));
  }
  return true;
}
function updateDpsJewelConfig(select){
  const store=$('dpsJewelSettings');
  const name=normalizeDpsJewelName(select?.getAttribute?.('data-dps-jewel-name'));
  const key=String(select?.getAttribute?.('data-dps-jewel-field') || '');
  if(!store || !name || !['ad','as','td','ua','enhance','mythic'].includes(key)) return false;
  const before=serializeDpsJewelSettings(store.value || '{}');
  const settings=normalizeDpsJewelSettings(store.value || '{}');
  const current=normalizeDpsJewelSettingForName(name,settings[name]);
  const activeBefore=dpsJewelSettingIsActive(current,name);
  if(dpsJewelIsChrysoberyl(name) && ['ad','as','td','ua'].includes(key)){
    const fixed=Number(DPS_CHRYSOBERYL_FIXED_STATS?.[key]) || 0;
    const stats=Number(select.value)===fixed && fixed>0 ? DPS_CHRYSOBERYL_FIXED_STATS : DPS_CHRYSOBERYL_EMPTY_STATS;
    settings[name]=normalizeDpsJewelSettingForName(name,dpsChrysoberylSettingWithStats(current,stats));
  }else{
    settings[name]={...settings[name],[key]:normalizeDpsJewelSetting({...settings[name],[key]:select.value})[key]};
  }
  const next=serializeDpsJewelSettings(settings);
  if(before===next){
    refreshDpsJewelConfigCard(name,settings,key);
    return false;
  }
  store.value=next;
  const activeAfter=dpsJewelSettingIsActive(settings[name],name);
  const selectionChanged=activeBefore!==activeAfter ? sanitizeDpsJewelSelections() : false;
  refreshDpsJewelConfigCard(name,settings,key);
  if(activeBefore!==activeAfter || selectionChanged) syncDpsBaseUnitControl({skipJewelConfig:true});
  markTraitPresetJewelSettingsPending();
  return true;
}
function renderDpsJewelConfigGrids(options={}){
  const grid=$('dpsJewelConfigGrid');
  const store=$('dpsJewelSettings');
  if(!grid || !store) return;
  const settings=normalizeDpsJewelSettings(store.value || '{}');
  const normalized=serializeDpsJewelSettings(settings);
  if(store.value!==normalized) store.value=normalized;
  const names=dpsJewelNames();
  const cards=[...grid.querySelectorAll('[data-dps-jewel-card]')];
  const sameCards=cards.length===names.length && cards.every((card,index)=>String(card.getAttribute('data-dps-jewel-card') || '')===String(names[index] || ''));
  if(options.force || !sameCards){
    grid.innerHTML=names.map(name=>dpsJewelConfigCardHtml(name,settings)).join('');
    return;
  }
  names.forEach(name=>refreshDpsJewelConfigCard(name,settings));
}
function dpsJewelSettingIsActive(value,name=''){
  const setting=typeof normalizeDpsJewelSettingForName==='function' ? normalizeDpsJewelSettingForName(name,value) : normalizeDpsJewelSetting(value);
  if(typeof dpsJewelIsChrysoberyl==='function' && dpsJewelIsChrysoberyl(name)) return dpsChrysoberylSettingIsFixed(setting);
  return ['ad','as','td','ua','enhance'].some(key=>Number(setting[key])>0) || setting.mythic==='Y';
}
function activeDpsJewelNames(settings=dpsJewelSettingsObject()){return dpsJewelNames().filter(name=>dpsJewelSettingIsActive(settings?.[name],name));}
function dpsBaseUnitJewelSelectionOrder(){
  return currentDpsBaseUnitSlots().filter(Boolean);
}
function dpsBaseUnitActiveExtraJewelCount(unitOrId){
  const unit=resolveDpsBaseUnit(unitOrId);
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
function sanitizeDpsBaseUnitBelowHellSettings(){
  let changed=false;
  dpsBaseUnitList().forEach(unit=>{
    const enhance=dpsBaseUnitStoreInput('enhance',unit);
    if(enhance && !dpsBaseUnitCanUseEnhance(unit) && normalizeDpsBaseUnitEnhanceValue(enhance.value,0)!=='0'){
      enhance.value='0';
      changed=true;
    }
    const limitBreak=dpsBaseUnitStoreInput('limitBreak',unit);
    if(limitBreak && !dpsBaseUnitCanUseLimitBreak(unit) && normalizeDpsBaseUnitLimitBreakValue(limitBreak.value)!=='0'){
      limitBreak.value='0';
      changed=true;
    }
    if(dpsBaseUnitHasQuantity(unit)){
      const quantity=dpsBaseUnitStoreInput('quantity',unit);
      const next=normalizeDpsBaseUnitQuantityValue(quantity?.value || 0,unit);
      if(quantity && quantity.value!==next){
        quantity.value=next;
        changed=true;
      }
    }
  });
  const extraStore=$('dpsBaseUnitExtraSettings');
  if(extraStore){
    const normalized=serializeDpsBaseUnitExtraSettings(normalizeDpsBaseUnitExtraSettings(extraStore.value || '{}'));
    if(extraStore.value!==normalized){
      extraStore.value=normalized;
      changed=true;
    }
  }
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
function dpsBaseUnitJewelOptionsHtml(selectedName,ownerKey,options={}){
  const usage=dpsLegendaryJewelActiveUsage();
  const excluded=new Set(Array.isArray(options.excludeNames) ? options.excludeNames.map(name=>normalizeDpsJewelName(name)).filter(Boolean) : []);
  const names=activeDpsJewelNames().filter(name=>{
    if(excluded.has(name) && name!==selectedName) return false;
    const owner=usage.get(name);
    return !owner || owner===ownerKey || name===selectedName;
  });
  return `<option value="">없음</option>${names.map(name=>`<option value="${escapeHtml(name)}"${name===selectedName?' selected':''}>${escapeHtml(name)}</option>`).join('')}`;
}
function dpsBaseUnitAdditionalSettingsHtml(unit){
  if(!dpsBaseUnitAllowsSlotExpansion(unit) || !dpsBaseUnitSlotExpanded(unit)) return '';
  const values=dpsBaseUnitExtraSlotSettings(unit);
  const allowLimitBreak=dpsBaseUnitCanUseLimitBreak(unit);
  const fields=values.map((setting,index)=>{
    const unitNumber=index+2;
    const limitOptions=allowLimitBreak
      ? Array.from({length:7},(_,value)=>`<option value="${value}"${value===setting.limitBreak?' selected':''}>${value}</option>`).join('')
      : '<option value="0" selected>사용 불가</option>';
    const ownerKey=dpsBaseUnitJewelOwnerKey(unit.id,index);
    const jewelOptions=dpsBaseUnitJewelOptionsHtml(setting.legendaryMythicJewel,ownerKey);
    return `<div class="dps-base-unit-extra-slot"><span class="dps-base-unit-extra-slot-title">${unitNumber}기</span><label class="${allowLimitBreak?'':'is-disabled'}"><span>한계 돌파</span><select data-dps-base-unit-extra-limit-break="${escapeHtml(unit.id)}" data-dps-base-unit-extra-index="${index}" aria-label="${escapeHtml(dpsBaseUnitLabel(unit))} ${unitNumber}기 한계 돌파${allowLimitBreak?'':' 사용 불가'}"${allowLimitBreak?'':' disabled'}>${limitOptions}</select></label><label><span>전설·신화 쥬얼</span><select data-dps-base-unit-extra-jewel="${escapeHtml(unit.id)}" data-dps-base-unit-extra-index="${index}" aria-label="${escapeHtml(dpsBaseUnitLabel(unit))} ${unitNumber}기 전설·신화 쥬얼">${jewelOptions}</select></label></div>`;
  }).join('');
  return `<section class="dps-base-unit-extra-settings" data-dps-base-unit-extra-settings="${escapeHtml(unit.id)}" aria-label="${escapeHtml(dpsBaseUnitLabel(unit))} 추가 유닛 쥬얼 및 한계 돌파 설정"><h4>추가 유닛 쥬얼 &amp; 한계 돌파 설정</h4><div class="dps-base-unit-extra-grid">${fields}</div></section>`;
}
function applyDpsBaseUnitJewelAssignment(jewelName,ownerKey,writeAssignment){
  const next=normalizeDpsJewelName(jewelName);
  if(next) clearDpsJewelFromOtherAssignments(next,ownerKey);
  if(typeof writeAssignment==='function') writeAssignment(next);
  sanitizeDpsJewelSelections();
  syncDpsBaseUnitControl();
  return next;
}
function updateDpsBaseUnitExtraSetting(select){
  const unitId=String(select?.getAttribute?.('data-dps-base-unit-extra-limit-break') || select?.getAttribute?.('data-dps-base-unit-extra-jewel') || '');
  const index=Math.max(0,Math.min(DPS_BASE_UNIT_EXTRA_SLOT_COUNT-1,Math.round(Number(select?.getAttribute?.('data-dps-base-unit-extra-index'))||0)));
  const unit=dpsBaseUnitById(unitId);
  if(!dpsBaseUnitAllowsSlotExpansion(unit)) return;
  const settings=dpsBaseUnitExtraSettingsObject();
  const items=Array.from({length:DPS_BASE_UNIT_EXTRA_SLOT_COUNT},(_,slotIndex)=>normalizeDpsBaseUnitExtraSlotSetting(settings[unitId]?.[slotIndex],unit));
  if(select.hasAttribute('data-dps-base-unit-extra-limit-break')){
    items[index].limitBreak=dpsBaseUnitCanUseLimitBreak(unit) ? Number(normalizeDpsBaseUnitLimitBreakValue(select.value))||0 : 0;
    settings[unitId]=items;
    setDpsBaseUnitExtraSettings(settings);
    syncDpsBaseUnitControl();
    return;
  }
  applyDpsBaseUnitJewelAssignment(select.value,dpsBaseUnitJewelOwnerKey(unitId,index),next=>{
    items[index].legendaryMythicJewel=next;
    settings[unitId]=items;
    setDpsBaseUnitExtraSettings(settings);
  });
}
function updateDpsBaseUnitJewelAssignment(select){
  const unitId=String(select?.getAttribute?.('data-dps-base-unit-slot-jewel') || '');
  const unit=dpsBaseUnitById(unitId);
  if(!unit) return;
  applyDpsBaseUnitJewelAssignment(select.value,dpsBaseUnitJewelOwnerKey(unitId),next=>{
    const store=dpsBaseUnitStoreInput('jewel',unit);
    if(store) store.value=next;
  });
}
function dpsBaseUnitVoidPowerAvailable(selectedIds=null){
  const ids=Array.isArray(selectedIds)
    ? selectedIds
    : dpsBaseUnitSelectionIds(normalizeDpsBaseUnitsValue($('dpsBaseUnits')?.value || ''));
  return ids.includes('prodNarud');
}
function dpsBaseUnitVoidPowerCost(unitOrId){
  const unit=resolveDpsBaseUnit(unitOrId);
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
  const unit=resolveDpsBaseUnit(unitOrId);
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
  const canUseEnhance=dpsBaseUnitCanUseEnhance(unit);
  const canUseLimitBreak=dpsBaseUnitCanUseLimitBreak(unit);
  const voidPowerAvailable=dpsBaseUnitVoidPowerAvailable();
  const voidPowerEligible=unit.id!=='prodNarud';
  const voidPower=voidPowerAvailable && voidPowerEligible ? normalizeDpsBaseUnitVoidPowerValue(dpsBaseUnitStoreInput('voidPower',unit)?.value) : 'OFF';
  const voidPowerUsage=dpsBaseUnitVoidPowerUsage();
  const voidPowerLimit=dpsBaseUnitVoidPowerLimit();
  const voidPowerCanEnable=voidPowerAvailable && voidPowerEligible && (voidPower==='ON' || voidPowerUsage+dpsBaseUnitVoidPowerCost(unit)<=voidPowerLimit);
  const slotExpanded=dpsBaseUnitSlotExpanded(unit);
  const shownEnhance=canUseEnhance ? enhance : '0';
  const limitOptions=canUseLimitBreak
    ? Array.from({length:7},(_,value)=>`<option value="${value}"${String(value)===limitBreak?' selected':''}>${value}</option>`).join('')
    : '<option value="0" selected>사용 불가</option>';
  const voidButton=`<div class="dps-base-unit-void-power-control"><span class="dps-base-unit-void-power-usage">${voidPowerUsage} / ${voidPowerLimit}</span><button class="ui-choice-btn dps-base-unit-option-btn${voidPower==='ON'?' is-active':''}" id="dpsBaseUnitSlotVoidPower${slotIndex+1}" data-dps-base-unit-void-power-toggle="${unitId}" type="button" aria-pressed="${voidPower==='ON'?'true':'false'}" aria-label="${label} 공허의 힘"${voidPowerCanEnable?'':' disabled'}>공허의 힘</button></div>`;
  const slotButton=dpsBaseUnitAllowsSlotExpansion(unit) ? `<button class="ui-choice-btn dps-base-unit-option-btn dps-base-unit-slot-expansion-btn${slotExpanded?' is-active':''}" data-dps-base-unit-slot-expansion-toggle="${unitId}" type="button" aria-pressed="${slotExpanded?'true':'false'}" aria-label="${label} 추가 유닛 쥬얼 및 한계 돌파 설정">슬롯 확장</button>` : '';
  const actionButtons=`<div class="dps-base-unit-action-buttons">${voidButton}${slotButton}</div>`;
  const mainSettings=`<div class="dps-base-unit-settings" data-dps-base-unit-settings="${unitId}"><label class="dps-base-unit-setting dps-base-unit-enhance-setting${canUseEnhance?'':' is-disabled'}"><span>강화 기대값</span><input class="dps-base-unit-setting-input" id="dpsBaseUnitSlotEnhance${slotIndex+1}" data-dps-base-unit-slot-enhance="${unitId}" type="text" inputmode="decimal" min="0" max="1000" value="${escapeHtml(shownEnhance)}" aria-label="${label} 강화 기대값${canUseEnhance?'':' 사용 불가'}"${canUseEnhance?'':' disabled'}/></label><label class="dps-base-unit-setting${canUseLimitBreak?'':' is-disabled'}"><span>한계 돌파</span><select class="dps-base-unit-setting-select" id="dpsBaseUnitSlotLimitBreak${slotIndex+1}" data-dps-base-unit-slot-limit-break="${unitId}" aria-label="${label} 한계 돌파${canUseLimitBreak?'':' 사용 불가'}"${canUseLimitBreak?'':' disabled'}>${limitOptions}</select></label><label class="dps-base-unit-setting"><span>전설·신화 쥬얼</span><select class="dps-base-unit-setting-select" id="dpsBaseUnitSlotJewel${slotIndex+1}" data-dps-base-unit-slot-jewel="${unitId}" aria-label="${label} 전설·신화 쥬얼">${dpsBaseUnitJewelOptionsHtml(jewelName,dpsBaseUnitJewelOwnerKey(unit.id))}</select></label>${actionButtons}</div>`;
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
      return `<option value="${escapeHtml(unit.id)}"${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}>${escapeHtml(dpsBaseUnitDisplayLabel(unit))}</option>`;
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
  const pierce=result ? dpsBaseUnitPercentText(result.effectivePierce) : (unit ? (dpsBaseUnitIsArtifact(unit) ? '0%' : dpsBaseUnitPercentText(dpsBaseUnitBoardBasePierce + dpsBaseUnitPierceBonus(unit))) : '—');
  const dps=result ? dpsBaseUnitDpsText(result) : '—';
  const entry=`<div class="dps-base-unit-entry dps-base-unit-slot${empty ? ' is-empty' : ''}${unit && dpsBaseUnitHasQuantity(unit) ? ' has-quantity' : ' is-fixed'}" data-dps-base-unit-slot-row="${slotIndex}">${dpsBaseUnitFieldHtml(dpsBaseUnitNameFieldLabelHtml(unit),'dps-base-unit-name-field',selectControl)}${dpsBaseUnitFieldHtml('공격력','dps-base-unit-attack-field',`<span class="dps-base-unit-board-cell dps-base-unit-board-attack">${escapeHtml(attack)}</span>`)}${dpsBaseUnitFieldHtml('방어력 관통','dps-base-unit-pierce-field',`<span class="dps-base-unit-board-cell dps-base-unit-board-pierce">${escapeHtml(pierce)}</span>`)}${dpsBaseUnitFieldHtml(unit && dpsBaseUnitIsArtifact(unit)?'파장 총 DPS':'총 DPS','dps-base-unit-dps-field',`<b class="dps-base-unit-board-cell dps-base-unit-board-dps">${escapeHtml(dps)}</b>`)}${dpsBaseUnitFieldHtml('수량','dps-base-unit-quantity-field',`<div class="dps-base-unit-board-cell dps-base-unit-board-quantity">${dpsBaseUnitQuantityControlHtml(unit,slotIndex)}</div>`)}</div>`;
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
    const current=normalizeDpsBaseUnitQuantityValue(input.value || 0,unit);
    const next=selected.has(unit.id) ? (Number(current)>0 ? current : '1') : '0';
    if(input.value!==next) input.value=next;
  });
}
function normalizeDpsBaseUnitQuantityInput(input){
  if(!input) return '0';
  const unitId=input.getAttribute?.('data-dps-base-unit-slot-quantity') || '';
  const unit=dpsBaseUnitById(unitId);
  const next=normalizeDpsBaseUnitQuantityValue(input.value || 0,unit);
  if(input.value!==next) input.value=next;
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
  input.value=normalizeDpsBaseUnitQuantityValue(value,unit);
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
const DPS_BASE_UNIT_STORE_CONTROLS=Object.freeze({
  enhance:{attribute:'data-dps-base-unit-slot-enhance',storeField:'enhance',normalize:value=>normalizeDpsBaseUnitEnhanceValue(value,0),fallback:'0'},
  limitBreak:{attribute:'data-dps-base-unit-slot-limit-break',storeField:'limitBreak',normalize:normalizeDpsBaseUnitLimitBreakValue,fallback:'0'}
});
function syncDpsBaseUnitStoreControl(control, kind, options={}){
  const config=DPS_BASE_UNIT_STORE_CONTROLS[kind];
  const unitId=String(control?.getAttribute?.(config?.attribute || '') || '');
  const unit=dpsBaseUnitById(unitId);
  if(!config || !unit) return config?.fallback || '0';
  let next=config.normalize(control.value);
  if(kind==='enhance' && !dpsBaseUnitCanUseEnhance(unit)) next='0';
  if(kind==='limitBreak' && !dpsBaseUnitCanUseLimitBreak(unit)) next='0';
  const store=dpsBaseUnitStoreInput(config.storeField,unit);
  if(store) store.value=next;
  if(options.commit || control.value!==next) control.value=next;
  return next;
}
function syncDpsBaseUnitEnhanceControl(input,commit=false){
  return syncDpsBaseUnitStoreControl(input,'enhance',{commit});
}
function syncDpsBaseUnitLimitBreakControl(select){
  return syncDpsBaseUnitStoreControl(select,'limitBreak',{commit:true});
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
  const requestedSlots=options.slots ? normalizeDpsBaseUnitSlotValues(options.slots) : currentDpsBaseUnitSlots();
  const slots=reconcileDpsBaseUnitSlots(requestedSlots,selectedIds);
  writeDpsBaseUnitSelection(input,slotInput,slots);
  syncDpsBaseUnitControl();
  if(notify){
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }
}
function changeDpsBaseUnitSlot(slotIndex, unitId, options={}){
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
  if(next && previous!==next) applyDpsBaseUnitAddDefaults(next);
  if(next && dpsBaseUnitHasQuantity(next)) setDpsBaseUnitQuantity(next,Math.max(1,Number(dpsBaseUnitQuantityText(next))||1));
  setDpsBaseUnitStoredValue(slots.filter(Boolean),options.notify!==false,{slots});
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
function syncDpsBaseUnitControl(options={}){
  ensureDpsBaseUnitStore();
  sanitizeDpsBaseUnitBelowHellSettings();
  sanitizeDpsJewelSelections();
  sanitizeDpsBaseUnitBelowHellSettings();
  if(!options.skipJewelConfig) renderDpsJewelConfigGrids();
  const input=$('dpsBaseUnits');
  const slotInput=$('dpsBaseUnitSlots');
  if(!input || !slotInput) return;
  const selectedIds=dpsBaseUnitSelectionIds(normalizeDpsBaseUnitsValue(input.value || ''));
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
function adjustDpsBaseUnitQuantity(unitId, delta, options={}){
  const unit=dpsBaseUnitById(unitId);
  if(!unit || !dpsBaseUnitHasQuantity(unit)) return;
  const current=Number(dpsBaseUnitQuantityText(unit)) || 0;
  setDpsBaseUnitQuantity(unitId, current + Number(delta || 0));
  syncDpsBaseUnitSelectionFromQuantities(options.notify!==false);
}
function dpsBaseUnitDefaultEnhanceValue(unitOrId){
  const unit=dpsBaseUnitById(unitOrId);
  if(!unit) return '0';
  return '500';
}
function applyDpsBaseUnitAddDefaults(unitId){
  const unit=dpsBaseUnitById(unitId);
  if(!unit) return false;
  const enhance=dpsBaseUnitStoreInput('enhance',unit);
  if(enhance) enhance.value=dpsBaseUnitDefaultEnhanceValue(unit);
  return true;
}

function bindDpsBaseUnitControlEvents(){
  if(document.documentElement.dataset.dpsBaseUnitControlBound==='1') return;
  document.documentElement.dataset.dpsBaseUnitControlBound='1';
  document.addEventListener('click', e=>{
    const clearUnit=e.target?.closest?.('[data-dps-base-unit-clear-slot]');
    if(clearUnit?.closest?.('[data-dps-base-unit-control]')){
      e.preventDefault();
      changeDpsBaseUnitSlot(clearUnit.getAttribute('data-dps-base-unit-clear-slot'),'',{notify:false});
      commitAppUpdate();
      return;
    }
    const qtyBtn=e.target?.closest?.('[data-dps-base-unit-qty-delta]');
    if(qtyBtn?.closest?.('[data-dps-base-unit-control]')){
      e.preventDefault();
      adjustDpsBaseUnitQuantity(qtyBtn.getAttribute('data-dps-base-unit-id') || '', qtyBtn.getAttribute('data-dps-base-unit-qty-delta'),{notify:false});
      commitAppUpdate();
      return;
    }
    const voidToggle=e.target?.closest?.('[data-dps-base-unit-void-power-toggle]');
    if(voidToggle?.closest?.('[data-dps-base-unit-control]')){
      e.preventDefault();
      toggleDpsBaseUnitVoidPower(voidToggle.getAttribute('data-dps-base-unit-void-power-toggle') || '');
      commitAppUpdate();
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
      changeDpsBaseUnitSlot(select.getAttribute('data-dps-base-unit-slot'),select.value,{notify:false});
      commitAppUpdate();
      return;
    }
    const enhance=e.target?.closest?.('[data-dps-base-unit-slot-enhance]');
    if(enhance?.closest?.('[data-dps-base-unit-control]')){
      syncDpsBaseUnitEnhanceControl(enhance,true);
      commitAppUpdate();
      return;
    }
    const jewelConfig=e.target?.closest?.('[data-dps-jewel-field]');
    if(jewelConfig?.closest?.('[data-dps-jewel-config]')){
      if(updateDpsJewelConfig(jewelConfig)) commitAppUpdate();
      return;
    }
    const extraSetting=e.target?.closest?.('[data-dps-base-unit-extra-limit-break],[data-dps-base-unit-extra-jewel]');
    if(extraSetting?.closest?.('[data-dps-base-unit-control]')){
      updateDpsBaseUnitExtraSetting(extraSetting);
      commitAppUpdate();
      return;
    }
    const unitJewel=e.target?.closest?.('[data-dps-base-unit-slot-jewel]');
    if(unitJewel?.closest?.('[data-dps-base-unit-control]')){
      updateDpsBaseUnitJewelAssignment(unitJewel);
      commitAppUpdate();
      return;
    }
    const limitBreak=e.target?.closest?.('[data-dps-base-unit-slot-limit-break]');
    if(limitBreak?.closest?.('[data-dps-base-unit-control]')){
      syncDpsBaseUnitLimitBreakControl(limitBreak);
      commitAppUpdate();
    }
  }, true);
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
  return qs('.mobile-page-trait.active') || qs('.col-mid') || document.scrollingElement || document.documentElement;
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
    applied=setRowToAffordableValue(row,before+step)-before;
    if(applied===0) showToast('보유 재화가 부족합니다','warn');
  }else{
    const next=Math.max(0,before-step);
    applied=before-next;
    INV[row]=next;
  }
  if(applied>0){
    commitAppUpdate({recalculate:'now'});
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
function commitTraitInvestmentChange(){
  commitAppUpdate({recalculate:'now'});
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
  commitTraitInvestmentChange();
}
function adjMax(row){
  try{
    if(row===116) return false;
    const before=INV[row]||0;
    fillRowToBudget(row);
    commitTraitInvestmentChange();
    if((INV[row]||0)<=before) showToast('보유 재화가 부족합니다','warn');
    return (INV[row]||0)>before;
  }catch(e){
    rememberAppIssue('error','[adjMax failed]', e);
    return false;
  }
}
function forEachTraitInTier(tier, options={}, callback=()=>{}){
  TRAITS.forEach(t=>{
    const row=t[0];
    if(t[2]!==tier || row===116) return;
    if(options.excludeAutoInvest && AUTO_INVEST_EXCLUDED_ROWS.has(row)) return;
    callback(t,row);
  });
}
function masterTier(tier){
  forEachTraitInTier(tier,{excludeAutoInvest:true},(_,row)=>fillRowToBudget(row));
  commitTraitInvestmentChange();
}
function resetTier(tier){
  forEachTraitInTier(tier,{},(_,row)=>{ INV[row]=0; });
  if(116 in INV) INV[116]=1;
  commitTraitInvestmentChange();
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
  commitTraitInvestmentChange();
  if(!changed) showToast('보유 재화가 부족하거나 이미 최대입니다','warn');
  return changed>0;
}
function isSpClearTrait(t,{utility=false}={}){
  if(!Array.isArray(t)) return false;
  const row=+t[0];
  return Number.isFinite(row) && row!==116 && SP_ROWS.has(row) && isUtilitySpTrait(t)===utility;
}
function isSpAttackClearTrait(t){return isSpClearTrait(t,{utility:false});}
function isSpUtilityClearTrait(t){return isSpClearTrait(t,{utility:true});}
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
  commitTraitInvestmentChange();
  return changed;
}
function clearUtility(){
  const changed=clearTraitInvestmentsBy(isSpUtilityClearTrait);
  if(!changed) showToast('초기화할 유틸 특성이 없습니다','warn');
  return changed>0;
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
const APP_TITLE_ROTATION=Object.freeze({
  main:{value:'개복디 특성 계산기'},
  creator:{label:'제작자', value:'회장 | 3-S2-1-2461127'},
  mainMs:5000,
  creatorMs:3000,
  transitionMs:180,
  versionMs:1200
});
function getAppTitleViewMeta(mode){
  if(mode==='version') return {label:'버전정보', value:(window.APP_VERSION || window.DPS_BUILD_VERSION || 'V1.0')};
  return APP_TITLE_ROTATION[mode] || APP_TITLE_ROTATION.main;
}
function buildAppTitleHtml(mode, meta){
  if(mode==='main') return `<span class="hdr-title-mainline">${escapeHtml(meta.value)}</span>`;
  return `<span class="hdr-title-stack"><span class="hdr-title-label">${escapeHtml(meta.label)}</span><span class="hdr-title-main">${escapeHtml(meta.value)}</span></span>`;
}
let appTitleRotationTimer=0;
let appTitleTransitionTimer=0;
let appTitleVersionTimer=0;
function clearAppTitleRotationTimers(){
  if(appTitleRotationTimer){
    clearTimeout(appTitleRotationTimer);
    appTitleRotationTimer=0;
  }
  if(appTitleTransitionTimer){
    clearTimeout(appTitleTransitionTimer);
    appTitleTransitionTimer=0;
  }
}
function renderAppTitleView(mode){
  const title=$('appTitleView');
  if(!title) return;
  const meta=getAppTitleViewMeta(mode);
  const text=meta.label ? `${meta.label} ${meta.value}` : meta.value;
  title.dataset.titleView=mode;
  title.classList.toggle('is-creator-view', mode==='creator');
  title.classList.toggle('is-version-view', mode==='version');
  title.innerHTML=buildAppTitleHtml(mode, meta);
  title.setAttribute('aria-label', `${text} · 앱 버전 보기`);
}
function scheduleAppTitleRotation(mode){
  const delay=mode==='creator' ? APP_TITLE_ROTATION.creatorMs : APP_TITLE_ROTATION.mainMs;
  appTitleRotationTimer=setTimeout(()=>{
    const title=$('appTitleView');
    if(!title) return;
    title.classList.add('is-transitioning');
    appTitleTransitionTimer=setTimeout(()=>{
      const nextMode=mode==='creator' ? 'main' : 'creator';
      renderAppTitleView(nextMode);
      title.classList.remove('is-transitioning');
      scheduleAppTitleRotation(nextMode);
    },APP_TITLE_ROTATION.transitionMs);
  },delay);
}
function restartAppTitleRotation(){
  const title=$('appTitleView');
  if(!title) return;
  clearAppTitleRotationTimers();
  title.classList.remove('is-transitioning');
  renderAppTitleView('main');
  scheduleAppTitleRotation('main');
}
function showAppTitleVersion(){
  const title=$('appTitleView');
  if(!title) return;
  clearAppTitleRotationTimers();
  title.classList.remove('is-transitioning');
  renderAppTitleView('version');
  if(appTitleVersionTimer) clearTimeout(appTitleVersionTimer);
  appTitleVersionTimer=setTimeout(()=>{
    appTitleVersionTimer=0;
    restartAppTitleRotation();
  },APP_TITLE_ROTATION.versionMs);
}
function bindAppTitleVersion(){
  const title=$('appTitleView');
  if(!title) return;
  restartAppTitleRotation();
  title.addEventListener('click', showAppTitleVersion);
  title.addEventListener('keydown', e=>{
    if(e.key==='Enter' || e.key===' '){
      e.preventDefault();
      showAppTitleVersion();
    }
  });
}
/* 더제로 승단 */

const ZERO_PENANCE_ROWS=[
  'Practice','Very Easy','Easy','Normal','Hard','Very Hard','Hell','Inferno','Lunatic','Holic','Epic','Ultimate','Impossible','The Final'
].map((name,index)=>({name,row:13+index}));
function zeroScoreInputHtml(className, options={}){
  const inputMode=options.inputmode || 'numeric';
  const placeholder=options.placeholder ? ` placeholder="${escapeHtml(options.placeholder)}"` : '';
  const maxLength=options.maxlength ? ` maxlength="${Number(options.maxlength)}"` : '';
  return `<input class="${className}" inputmode="${inputMode}"${maxLength}${placeholder} type="text" value="0"/>`;
}
function zeroScoreStarButtonHtml(enabled){
  return enabled
    ? '<button class="ui-toggle-btn zero-star-toggle" data-action="zeroScoreStar" type="button" aria-pressed="false">+2</button>'
    : '<button class="ui-toggle-btn zero-star-toggle zero-star-disabled" type="button" disabled aria-disabled="true" aria-pressed="false">비활성화</button>';
}
function buildZeroScoreCalcRow(config){
  return `
          <tr class="zero-calc-row" data-row-type="${config.type}">
            <td class="zero-calc-name">${escapeHtml(config.name)}</td>
            <td>${zeroScoreInputHtml('zero-calc-current')}</td>
            <td>${zeroScoreInputHtml('zero-calc-target')}</td>
            <td>${zeroScoreStarButtonHtml(config.star !== false)}</td>
            <td>${zeroScoreInputHtml(config.currentHonorClass,config.honorOptions)}</td>
            <td>${zeroScoreInputHtml(config.targetHonorClass,config.honorOptions)}</td>
            <td><b class="zero-row-score">0</b></td>
          </tr>`;
}
function buildZeroPenanceCalcRow(name){
  return buildZeroScoreCalcRow({type:'penance',name,currentHonorClass:'zero-current-honor zero-honor-input',targetHonorClass:'zero-target-honor zero-honor-input',honorOptions:{inputmode:'latin',maxlength:1,placeholder:'B'}});
}
function buildZeroTowerCalcRow(){
  return buildZeroScoreCalcRow({type:'towerCombo',name:'도전의탑',star:false,currentHonorClass:'zero-tower-honor-current',targetHonorClass:'zero-tower-honor-target'});
}
function renderZeroScoreCalculatorRows(){
  const rows=$('zeroScoreRows');
  if(!rows || rows.dataset.rendered==='1') return;
  rows.innerHTML=ZERO_PENANCE_ROWS.map(({name})=>buildZeroPenanceCalcRow(name)).join('') + buildZeroTowerCalcRow();
  rows.dataset.rendered='1';
}

const ZERO_RANK_FALLBACK_TABLE=[
  {name:'입문',score:0},{name:'견습',score:100},{name:'숙련',score:150},{name:'전문',score:200},
  {name:'장인',score:250},{name:'명장',score:300},{name:'명장+',score:350},{name:'도인',score:400},
  {name:'도인+',score:450},{name:'지존',score:500},{name:'지존+',score:550},{name:'패왕',score:600},
  {name:'패왕+',score:650},{name:'제왕',score:700},{name:'제왕+',score:750},{name:'신황',score:800},{name:'신황+',score:850}
];
function getZeroRankTable(){
  const rows=[...qsa('.zero-rank-entry')].map(row=>{
    const name=dataText(row.dataset.rankName);
    const score=dataNumber(row.dataset.rankScore);
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
  const current=dataText(currentRank);
  const target=dataText(targetRank);
  qsa('.zero-rank-entry').forEach(row=>{
    const name=dataText(row.dataset.rankName);
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
const ZERO_SCORE_DOM_FIELDS=Object.freeze({
  current:{selector:'.zero-calc-current',fallback:'0'},
  target:{selector:'.zero-calc-target',fallback:'0'},
  currentHonor:{selector:'.zero-current-honor',fallback:'0',normalize:value=>normalizeZeroHonorValue(value).toUpperCase()},
  targetHonor:{selector:'.zero-target-honor',fallback:'0',normalize:value=>normalizeZeroHonorValue(value).toUpperCase()},
  honorCurrent:{selector:'.zero-tower-honor-current',fallback:'0'},
  honorTarget:{selector:'.zero-tower-honor-target',fallback:'0'}
});
function zeroScoreDomField(row, key){
  const def=ZERO_SCORE_DOM_FIELDS[key];
  return def ? row.querySelector(def.selector) : null;
}
function readZeroScoreDomField(row, key){
  const def=ZERO_SCORE_DOM_FIELDS[key];
  const value=zeroScoreDomField(row,key)?.value ?? def?.fallback ?? '0';
  return def?.normalize ? def.normalize(value) : value;
}
function writeZeroScoreDomField(row, key, value){
  const def=ZERO_SCORE_DOM_FIELDS[key];
  const field=zeroScoreDomField(row,key);
  if(field) field.value=def?.normalize ? def.normalize(value ?? def.fallback) : String(value ?? def?.fallback ?? '0');
}
function collectZeroScoreState(){
  const calc=qs('.zero-score-calc');
  if(!calc) return null;
  return {
    rows:Array.from(calc.querySelectorAll('.zero-calc-row')).map(row=>{
      const type=row.dataset.rowType || 'penance';
      const state={
        type,
        current:readZeroScoreDomField(row,'current'),
        target:readZeroScoreDomField(row,'target'),
        star:type==='penance' && !!row.querySelector('.zero-star-toggle.active'),
        currentHonor:readZeroScoreDomField(row,'currentHonor').toLowerCase(),
        targetHonor:readZeroScoreDomField(row,'targetHonor').toLowerCase()
      };
      if(type==='towerCombo'){
        state.honorCurrent=readZeroScoreDomField(row,'honorCurrent');
        state.honorTarget=readZeroScoreDomField(row,'honorTarget');
      }
      return state;
    })
  };
}
function setZeroScoreStarButton(starBtn,active){
  setTogglePressed(starBtn, active, {activeText:'ON +2', inactiveText:'+2'});
}
function applyZeroScoreState(zeroScore){
  const calc=qs('.zero-score-calc');
  if(!calc) return;
  const rows=zeroScore ? normalizeZeroScoreState(zeroScore).rows : [];
  calc.querySelectorAll('.zero-calc-row').forEach((row,idx)=>{
    const type=row.dataset.rowType || 'penance';
    const saved=type==='towerCombo' ? zeroTowerComboFromRows(rows,idx) : (rows[idx] || {});
    ['current','target','currentHonor','targetHonor','honorCurrent','honorTarget'].forEach(key=>writeZeroScoreDomField(row,key,saved[key]));
    setZeroScoreStarButton(row.querySelector('.zero-star-toggle:not(:disabled)'), !!saved.star);
  });
  updateZeroScoreCalculator();
}
function commitZeroScoreChange(){
  updateZeroScoreCalculator();
  if(!isStorageLocked()) scheduleAutoSave();
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

/* 이벤트·초기화 */
let appEventsBound=false;
const ACTION_HANDLERS={
  optimizeSP,
  optimizeUtility,
  clearUtility:()=>requestConfirmAction('clearUtility','한 번 더 누르면 유틸 초기화', clearUtility),
  clearAll:()=>requestConfirmAction('clearAll','한 번 더 누르면 유틸 제외 특성 초기화', clearAll),
  saveTraitPreset:(...args)=>window.DpsPreset.saveCurrent(...args),
  loadTraitPreset:(...args)=>window.DpsPreset.loadSelected(...args),
  updateTraitPreset:(...args)=>window.DpsPreset.updateCurrent(...args),
  deleteTraitPreset:(...args)=>window.DpsPreset.deleteCurrent(...args),
  resetAllTraitPresetState:(...args)=>window.DpsPreset.resetAll(...args),
  backupTraitPresets:(...args)=>window.DpsPreset.openBackup(...args),
  importTraitPresets:(...args)=>window.DpsPreset.openImport(...args),
  openDpsTable,
  openMonthRuneTab:(trigger)=>window.DpsModal.openMonthRune(trigger?.dataset?.monthRuneOpenTab || 'compare'),
  openSanctuarySkillModal:()=>window.DpsModal.openBoardModal('sanctuarySkillModal'),
  openBusPassengerModal:()=>window.DpsModal.openBoardModal('busPassengerModal'),
  openZeroRankInfoModal:()=>window.DpsModal.openBoardModal('zeroRankInfoModal'),
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
  'traitPresetName',
  'traitPresetSelect',
  'traitPresetImportFile',
  'traitPresetBackupName',
  'dpsTableMinDps',
  'dpsTableMinDpsMain',
  'artifactDpsViewToggle'
]);
const RUNE_CHOICE_SYNC_IDS=new Set(['runeChoiceType','runeChoiceValue']);
const DEDICATED_DPS_BASE_UNIT_REACTIVE_SELECTOR=[
  '[data-dps-base-unit-slot]',
  '[data-dps-jewel-field]',
  '[data-dps-base-unit-extra-limit-break]',
  '[data-dps-base-unit-extra-jewel]',
  '[data-dps-base-unit-slot-jewel]',
  '[data-dps-base-unit-slot-limit-break]'
].join(',');
function shouldHandleReactiveInput(target){
  if(isStorageLocked()) return false;
  if(!target || !target.id) return false;
  if(REACTIVE_INPUT_EXCLUDED_IDS.has(target.id)) return false;
  if(target.matches?.('[data-dps-base-unit-slot-enhance]')) return false;
  if(target.matches?.(DEDICATED_DPS_BASE_UNIT_REACTIVE_SELECTOR)) return false;
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
      syncDpsBaseUnitSelectionFromQuantities(false);
    }
    if(target.id==='team'){
      syncTeamSelect({preserveCurrent:true});
    }
    if(TRAIT_LIMIT_INPUT_IDS.has(target.id) && String(target.value).replace(/,/g,'').trim()==='0') syncTraitLimitInputDisplay(target);
    if(target.matches('select')) syncSelectButtons();
    if(target.matches('.buff-choice-input')) syncBuffChoiceButtons();
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      commitAppUpdate();
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
    ()=>window.DpsModal.bindEvents(), ()=>window.DpsPreset.bindEvents(), bindJewelImageEvents,
    bindZeroScoreCalculator, bindTraitLimitDisplayEvents, bindDpsBaseUnitControlEvents, bindReactiveInputs,
    bindButtonPressFeedback, bindDamageBoardSwitchEvents, bindDpsBaseUnitConditionEvents, bindAppTitleVersion
  ].forEach(fn=>fn());
}
function initApp(){
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
