/* 앱 제어 레이어
 * - 설정·상태: 저장소/전역 옵션, DOM 헬퍼
 * - UI 동기화: 입력 정규화, 표시값 갱신, 제한 상태
 * - DPS표/모달: 표 렌더링과 모드 전환
 * - 유닛 보드: 선택/슬롯/보석/공허 처리
 * - 프리셋·최적화·이벤트: 사용자 액션 연결
 */
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
    skipElementIds:['ep','artifactDpsViewToggle']
  },

  dpsTable:{
    difficulties:['Practice','Very Easy','Easy','Normal','Hard','Very Hard','Hell','Inferno','Lunatic','Holic','Epic','Ultimate','Impossible','The Final','Hall Of Fame','Abyss road','Deep Abyss'],
    tower:{minFloor:1,maxFloor:90},
    planet:{minFloor:1,maxFloor:100},
    penanceMin:0,
    penanceMax:20,
    decimals:2
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
  if(id==='planetExplorationFloor') return normalizedPlanetExplorationFloorNumber(planetExplorationFloorStoredValue());
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
const SPEC_BOARD_PIERCE_VALUES=Object.freeze([0,10,15,20,25,30,35,40]);
const SPEC_BOARD_PIERCE_VALUE_SET=new Set(SPEC_BOARD_PIERCE_VALUES.map(String));
function normalizeSpecBoardPierceValue(value){
  const raw=String(value ?? '').replace(/,/g,'').trim();
  return SPEC_BOARD_PIERCE_VALUE_SET.has(raw) ? raw : '0';
}
function specBoardPierceValue(){
  return Number(normalizeSpecBoardPierceValue(vs('specBoardPierce'))) || 0;
}

/* 입력·화면 동기화 */
function renderEnemyData(data,stats){
  if(!data) return;
  const waveCount=enemyDisplayCountText(data.round);
  const values={
    ArmorDisplayQuick:fullNumber(Number(data.armor)||0),
    HpQuick:fullNumber(data.hp),
    ShieldQuick:fullNumber(data.shield),
    WaveCountQuick:waveCount || '—'
  };
  Object.entries(values).forEach(([name,value])=>setText('enemy'+name,value));
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
function syncDonationBuffControl(){
  const select=$('donationBuffType');
  if(!select) return;
  const value=normalizeDonationBuffType(select.value);
  if(select.value!==value) select.value=value;
  qsa('.donation-buff-grid button[data-value]').forEach(button=>{
    const selected=button.dataset.value===value;
    button.classList.toggle('active',selected);
    button.setAttribute('aria-pressed',selected ? 'true' : 'false');
  });
}
function setDonationBuffType(value){
  const select=$('donationBuffType');
  if(!select) return false;
  const normalized=normalizeDonationBuffType(value);
  select.value=normalized;
  syncDonationBuffControl();
  syncSelectButtons();
  commitAppUpdate();
  return true;
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
function syncModeChoiceButtons(){
  const coop=normalizeOnOffValue($('coopMode')?.value,'OFF')==='ON';
  const bank=normalizeSpBankApplyValue($('spBankApply')?.value);
  qsa('[data-mode-choice]').forEach(button=>{
    const group=button.dataset.modeChoice;
    const selected=group==='battle' ? button.dataset.value===(coop?'coop':'solo') : button.dataset.value===bank;
    button.setAttribute('aria-pressed',selected ? 'true' : 'false');
    button.classList.toggle('is-selected',selected);
  });
}
function syncBattleMode(sourceId='', options={}){
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
  syncTeamSelect({restorePersonal: !!sourceId && !coopOn, preserveCurrent: !sourceId, defaultCoop: !!options.defaultCoop && coopOn});
  syncModeChoiceButtons();
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
    // 사용자가 개인전에서 협동전으로 전환하면 3인을 기본 선택한다.
    // 프리셋 로드·난이도 갱신에는 이 기본값을 강제하지 않고 저장된 2/3인을 유지한다.
    const source=options.defaultCoop ? '3' : ((current==='2' || current==='3') ? current : (el.dataset.coopTeamValue || '3'));
    const value=normalizeTeamCountValue(source, 3)==='1' ? '3' : normalizeTeamCountValue(source, 3);
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
  setText('dpsMainLabel', artifactView ? '현재 유물 DPS' : '현재 DPS');
  if(shouldHideDpsForRound()){
    setText('dpsVal', '—');
    renderDpsBaseUnitSummary(s,true);
    if(isDpsTableOpen()) renderDpsTablePanelContent();
    return;
  }
  const artifactResult=artifactView ? currentArtifactDpsResult() : null;
  const displayDps=artifactView ? artifactResult.dps : s.M19;
  setText('dpsVal', Number.isFinite(displayDps) ? displayDps.toFixed(2) : '—');
  renderDpsBaseUnitSummary(s,false);
  if(isDpsTableOpen()) renderDpsTablePanelContent();
}
const STAT_COMPARE_ROWS=[
  ['AD', s=>fmt(s.displayAD,0), s=>fmt(s.M4,0)],
  ['APS', s=>fmt(s.displayAPS,0), s=>fmt(s.displayAPS,0)],
  ['APU', s=>fmt(s.displayAPU,0), s=>fmt(s.actualAPU ?? s.displayAPU,0)],
  ['AS', s=>fmt(s.M7,1), s=>fmt(s.M7,1)],
  ['CRI', s=>fmt(s.M8,1), s=>fmt(s.M8,1)],
  ['CD', s=>fmt(s.displayCD,1), s=>fmt(s.actualCD,2)],
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
function dpsBoardContextHtml(){
  const context=getDpsContextValues();
  const difficulty=selectedControlText($('diff'));
  return `<span class="spec-board-mode">${escapeHtml(context.modePrimary)}</span><span class="spec-board-difficulty">${escapeHtml(difficulty)}</span>`;
}
function renderRightHeroContext(){
  const target=$('rightHeroCompactContext');
  if(target) target.innerHTML=dpsBoardContextHtml();
  const tower=isTowerDifficulty();
  const planet=isPlanetExplorationDifficulty();
  setText('specHeroStageLabel',tower||planet?'현재 층':'현재 고행 / 라운드');
  setText('specHeroStage',tower?`${challengeTowerFloorStoredValue()}층`:planet?`${planetExplorationFloorStoredValue()}층`:`${effectivePenanceValue()} 고행`);
  setText('specHeroRound',tower||planet?'':`${normalizedRoundNumber(targetRoundStoredValue())} 라운드`);
}
function renderStatSummary(s){
  renderRightHeroContext();
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
  [syncSelectButtons,syncDonationBuffControl,syncBuffChoiceButtons,syncBattleMode,syncSpBankApplyControl,syncDifficultyTargetControls,syncErosionControlElements,syncPowerBlessOptions,syncSpecDpsSpeedSwitch,normalizeAllDpsBaseUnitQuantityInputs,formatAllMoneyInputs].forEach(fn=>fn());
}
function syncSpBankApplyControl(){
  const select=$('spBankApply');
  if(!select) return false;
  const state=normalizeSpBankApplyValue(select.value);
  if(select.value!==state) select.value=state;
  syncModeChoiceButtons();
  return true;
}
function syncPreCalculationViews(){
  normalizeRoundInputs();
  syncExclusiveRuneOptions();
  syncRuneChoice();
  syncDonationBuffControl();
  syncEnchantInputs();
  syncControlDisplays();
  syncTraitLimitInputs();
  renderEnchantPreview();
  renderXpCut();
}
function renderCalculatedViews(s){
  renderEnemyData(s.enemyData,s);
  renderSkillDamage(s);
  renderDpsSummary(s);
  renderStatSummary(s);
  syncSpecDpsSpeedSwitch();
  syncArtifactDpsViewSwitch();
  syncPlanetExplorationRestrictedControls();
  syncDpsTableLabels();
  renderEnhanceSummary(s.enhanceStats);
  renderResourceSummary(s);
  updateTraits();
  renderTraitRecommendations();
}
/* 특성 투자 제한: 원본 ON/OFF 셀렉트와 좌우 선택 버튼 동기화 */
const TRAIT_LIMIT_STATUS_FIELDS=['traitLimitAD','traitLimitAS','traitLimitCRI','traitLimitCD','traitLimitMultiTarget','traitLimitInfinite'];
function syncTraitLimitControlPresentation(){
  for(const id of ['traitLimitMultiTarget','traitLimitInfinite']){
    const field=$(id);
    if(!field) continue;
    document.querySelectorAll(`[data-limit-select="${id}"]`).forEach(button=>{
      button.setAttribute('aria-pressed',String(button.dataset.limitValue===field.value));
    });
  }
}
function bindTraitLimitChoiceEvents(){
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-limit-select][data-limit-value]');
    if(!button || button.disabled) return;
    const field=$(button.dataset.limitSelect);
    if(!field || field.value===button.dataset.limitValue) return;
    field.value=button.dataset.limitValue;
    syncTraitLimitControlPresentation();
    field.dispatchEvent(new Event('change',{bubbles:true}));
  });
  document.addEventListener('input',event=>{
    if(TRAIT_LIMIT_STATUS_FIELDS.includes(event.target?.id)) syncTraitLimitControlPresentation();
  },true);
  document.addEventListener('change',event=>{
    if(TRAIT_LIMIT_STATUS_FIELDS.includes(event.target?.id)) syncTraitLimitControlPresentation();
  },true);
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
    syncTraitLimitControlPresentation();
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
  const save=options.save!==false && !dpsUnitSlotPending;
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
  const unitLimit=dpsBaseUnitQuantityLimit();
  const sepPlusUniqueAd=SYSTEM_COMMON_BUFFS.uniqueUnit.baseAd + septemberPlusUniqueAdBonus(e.septemberPlus);
  setTextMap({
    enhanceChanceView:(e.chance*100).toFixed(2)+'%',
    enhanceCountView:`${fmt(e.count,0)}회`,
    enhanceValueView:fmt(e.value,0),
    sepRuneQuantityView:fmt(unitLimit,0),
    sepRuneAttackView:`+${fmt(sepPlusUniqueAd,0)}`
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
    label:'협동전 2인',
    rows:[
      {stage:'1단계', divisor:10},
      {stage:'2단계', divisor:20},
      {stage:'3단계', divisor:30},
      {stage:'4단계', divisor:40}
    ]
  },
  {
    label:'협동전 3인',
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

function planetExplorationRestrictionsActive(){
  return typeof isPlanetExplorationDifficulty==='function' && isPlanetExplorationDifficulty();
}
function isArtifactDpsViewEnabled(){
  const toggle=$('artifactDpsViewToggle');
  return !planetExplorationRestrictionsActive() && toggle?.getAttribute('aria-checked')==='true';
}
function setArtifactDpsViewEnabled(enabled){
  const toggle=$('artifactDpsViewToggle');
  if(!toggle) return;
  toggle.setAttribute('aria-checked', enabled && !planetExplorationRestrictionsActive() ? 'true' : 'false');
  syncArtifactDpsViewSwitch();
}
function syncArtifactDpsViewSwitch(){
  const toggle=$('artifactDpsViewToggle');
  if(!toggle) return;
  const disabled=planetExplorationRestrictionsActive();
  if(disabled) toggle.setAttribute('aria-checked','false');
  const active=isArtifactDpsViewEnabled();
  toggle.disabled=disabled;
  toggle.classList.toggle('is-active',active);
  toggle.setAttribute('aria-checked',active ? 'true' : 'false');
  toggle.setAttribute('aria-disabled',disabled ? 'true' : 'false');
  toggle.setAttribute('aria-label',`유물 DPS ${disabled ? '사용 불가' : (active ? '켬' : '끔')}`);
  toggle.closest('.artifact-dps-switch-wrap')?.classList.toggle('is-disabled',disabled);
}
function syncOnOffSwitch(toggle,{active=false,disabled=false,label='설정',containerSelector=''}){
  if(!toggle) return;
  toggle.disabled=disabled;
  toggle.classList.toggle('is-active',active);
  toggle.setAttribute('aria-checked',active ? 'true' : 'false');
  toggle.setAttribute('aria-disabled',disabled ? 'true' : 'false');
  toggle.setAttribute('aria-label',`${label} ${active ? '켬' : '끔'}`);
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
  const toggles=qsa('[data-spec-dps-speed-toggle]');
  if(!toggles.length) return;
  const {active,disabled}=normalizeUnifiedDpsSpeedModeValue();
  toggles.forEach(toggle=>syncOnOffSwitch(toggle,{active,disabled,label:'스피드 모드',containerSelector:'.spec-dps-speed-switch-wrap'}));
}
function syncPlanetExplorationRestrictedControls(){
  const disabled=planetExplorationRestrictionsActive();
  const artifact=$('prodArtifact');
  if(artifact){
    if(disabled) artifact.checked=false;
    artifact.disabled=disabled;
    artifact.closest('.buff-choice-item')?.classList.toggle('is-disabled',disabled);
  }
  syncBuffChoiceButtons();
  if(disabled) setArtifactDpsViewEnabled(false);
}
function applyUnifiedDpsSpeedModeToggle(active){
  setUnifiedDpsSpeedModeValue(!active);
  syncSpecDpsSpeedSwitch();
  commitAppUpdate();
  return true;
}
function toggleSpecDpsSpeedMode(){
  const toggle=$('specDpsSpeedModeToggle');
  const {active,disabled}=normalizeUnifiedDpsSpeedModeValue();
  if(toggle?.disabled || disabled) return false;
  return applyUnifiedDpsSpeedModeToggle(active);
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
/* DPS표: 모드·난이도·고행별 계산 및 화면 구성 */
const DPS_TABLE_DIFFICULTIES=DPS_CONFIG.dpsTable.difficulties;
const COOP_DPS_TABLE_DIFFICULTIES=DPS_TABLE_DIFFICULTIES.slice(0, DPS_TABLE_DIFFICULTIES.indexOf('Hall Of Fame') + 1);
const COOP_DPS_TABLE_PENANCE_MIN=0;
const COOP_DPS_TABLE_PENANCE_MAX=COOP_PENANCE_MAX;
const DPS_TABLE_PENANCE_MIN=Math.max(0,DPS_CONFIG.dpsTable.penanceMin ?? 0);
const DPS_TABLE_PENANCE_MAX=DPS_CONFIG.dpsTable.penanceMax ?? 20;
const DPS_TABLE_DECIMALS=DPS_CONFIG.dpsTable.decimals ?? 1;
const DPS_TABLE_MODES=['solo','coop','tower','planet'];
let activeDpsTableMode='solo';
function isDpsTableOpen(){
  return $('damageBoardTableTab')?.getAttribute('aria-selected')==='true' && !$('workspace-dps')?.hidden;
}
function formatDpsTableValue(value){
  if(!Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR',{minimumFractionDigits:DPS_TABLE_DECIMALS, maximumFractionDigits:DPS_TABLE_DECIMALS});
}

let dpsPreviewCacheRevision=-1;
const dpsPreviewValueCache=new Map();
const dpsPreviewCoreCache=new Map();
function dpsTablePreviewCore(diff,round,options,artifactView){
  const cacheKey=JSON.stringify([artifactView,diff,round,options.battleMode||'',options.teamCount||'']);
  if(dpsPreviewCoreCache.has(cacheKey)) return dpsPreviewCoreCache.get(cacheKey);
  try{
    const core=calculateDpsPreviewCore(diff,round,options,artifactView);
    dpsPreviewCoreCache.set(cacheKey,core);
    return core;
  }catch(e){
    rememberAppIssue('error','[DPS preview core failed]',e);
    return null;
  }
}
function dpsTablePreviewValue(diff, penance, round, options={}){
  if(dpsPreviewCacheRevision!==appCalculationRevision){
    dpsPreviewValueCache.clear();
    dpsPreviewCoreCache.clear();
    dpsPreviewCacheRevision=appCalculationRevision;
  }
  const artifactView=isArtifactDpsViewEnabled();
  const cacheKey=JSON.stringify([artifactView,diff,penance,round,options.battleMode||'',options.teamCount||'']);
  if(dpsPreviewValueCache.has(cacheKey)) return dpsPreviewValueCache.get(cacheKey);
  const previewOptions={...options,previewCore:dpsTablePreviewCore(diff,round,options,artifactView)};
  const value=artifactView
    ? calculateArtifactDpsPreview(diff, penance, round, previewOptions).dps
    : computeDpsPreview(diff, penance, round, previewOptions);
  dpsPreviewValueCache.set(cacheKey,value);
  return value;
}
function dpsTableDisplayTitle(){
  return isArtifactDpsViewEnabled() ? '유물 DPS표' : 'DPS표';
}
function syncDpsTableLabels(){
  const label=dpsTableDisplayTitle();
  const tabLabel=$('damageBoardTableLabel');
  if(tabLabel) tabLabel.textContent=label;
}

// DPS표는 보기 전용 선택값으로 비교하며 기본 설정을 변경하지 않습니다.
let dpsVisualDifficulty='';
function selectedDpsVisualDifficulty(mode){
  const options=mode==='coop'?COOP_DPS_TABLE_DIFFICULTIES:DPS_TABLE_DIFFICULTIES;
  return options.includes(dpsVisualDifficulty)
    ? dpsVisualDifficulty
    : (options.includes(vs('diff'))?vs('diff'):options[0]);
}
function selectedDpsTableTeamCount(coop=false){
  const teamCount=Number(normalizeTeamCountValue(vs('team'),coop?2:1));
  return coop ? Math.max(2,teamCount) : teamCount;
}
function renderDpsStatHead(label){
  return `<thead><tr>${[label,'DPS','체력','실드','방어력','물량'].map(text=>`<th scope="col">${escapeHtml(text)}</th>`).join('')}</tr></thead>`;
}
function renderDpsStatTable(rows,label,context){
  const range=`${rows[0].stage}–${rows[rows.length-1].stage} ${label}`;
  return `<table class="dps-stat-table" aria-label="${escapeHtml(context+' · '+range)}"><colgroup><col class="dps-col-stage"><col class="dps-col-value"><col><col><col><col></colgroup>${renderDpsStatHead(label)}<tbody>${rows.map(row=>`<tr class="dps-stat-row${row.current?' is-current':''}" data-dps-${label==='층'?'floor':'penance'}="${row.stage}"${row.current?' aria-current="true"':''}>
      <th scope="row" class="dps-stat-stage">${row.stage}<small>${label}</small></th>
      <td class="dps-stat-dps">${formatDpsTableValue(row.dps)}</td>
      ${row.enemyItems.map(([name,value])=>`<td class="dps-stat-enemy" aria-label="${escapeHtml(name)}">${escapeHtml(String(value))}</td>`).join('')}
    </tr>`).join('')}</tbody></table>`;
}
function dpsTableContextText(diff,coop=false,teamCount=1){
  const speed=specDpsSpeedModeEnabled(diff)?'스피드':'일반';
  const battle=coop?`협동전 · ${teamCount}인`:'개인전';
  const display=(isTowerDifficulty(diff)||isPlanetExplorationDifficulty(diff))?'클래식':enemyDisplayModeLabel(diff);
  return `${speed} · ${battle} · ${display}`;
}
function dpsTableContextHtml(diff,coop=false,teamCount=1,showDifficulty=false,options=''){
  const summary=escapeHtml(dpsTableContextText(diff,coop,teamCount));
  const detail=showDifficulty?`<strong class="dps-overview-difficulty">${escapeHtml(diff)}</strong>`:options;
  return `<div class="dps-overview-condition"><span>모드 / 난이도</span><strong class="dps-overview-mode">${summary}</strong>${detail}</div>`;
}
function renderDpsTableSummary(current,label,dps,enemyItems,mode='',context='',round=null){
  const number=`<span>${mode?'현재 선택 층':'현재 고행 / 라운드'}</span><strong>${current}<small>${label}</small></strong>${round===null?'':`<span class="dps-current-round">${round} 라운드</span>`}`;
  const condition=mode?`<button type="button" class="dps-current-condition dps-current-jump" data-dps-current-row aria-label="${mode==='tower'?'도전의탑':'행성탐사'} 현재 ${current}층으로 이동">${number}<i>층 위치 보기 <span aria-hidden="true">↓</span></i></button>`:`<div class="dps-current-condition">${number}</div>`;
  return `<div class="dps-table-summary" aria-label="현재 ${current}${label} DPS 및 적 정보"><div class="dps-table-metrics${context?' is-comparison':''}">${context}${condition}<div class="dps-table-score"><span>${mode?'해당 층 DPS':'현재 DPS'}</span><strong>${formatDpsTableValue(dps)}</strong></div></div><dl class="dps-table-enemies">${enemyItems.map(([name,value])=>`<div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join('')}</dl></div>`;
}
function buildDpsVisualComparison(round,mode){
  const coop=mode==='coop';
  const difficulty=selectedDpsVisualDifficulty(mode);
  const teamCount=selectedDpsTableTeamCount(coop);
  const penanceMin=coop?COOP_DPS_TABLE_PENANCE_MIN:DPS_TABLE_PENANCE_MIN;
  const penanceMax=coop?COOP_DPS_TABLE_PENANCE_MAX:DPS_TABLE_PENANCE_MAX;
  const current=Math.max(penanceMin,Math.min(penanceMax,Math.round(v('penance'))));
  const values=[];
  for(let pen=penanceMin;pen<=penanceMax;pen++){
    const dps=dpsTablePreviewValue(difficulty,pen,round,{battleMode:coop?'coop':'solo',teamCount});
    values.push({pen,dps});
  }
  const currentValue=values.find(item=>item.pen===current)?.dps;
  const enemy=enemyRoundData(round,difficulty);
  const enemyFactor=coop?teamCount:1;
  const enemyItems=[
    ['체력',fullNumber(enemy.hp)],
    ['실드',fullNumber(enemy.shield)],
    ['방어력',fullNumber(enemy.armor)],
    ['물량',fullNumber((Number(enemy.count)||0)*enemyFactor)]
  ];
  const diffOptions=(coop?COOP_DPS_TABLE_DIFFICULTIES:DPS_TABLE_DIFFICULTIES).map(item=>`<option value="${escapeHtml(item)}"${item===difficulty?' selected':''}>${escapeHtml(item)}</option>`).join('');
  const rows=values.map(({pen,dps})=>({stage:pen,dps,enemyItems,current:pen===current}));
  const context=dpsTableContextHtml(difficulty,coop,teamCount,false,`<label class="dps-overview-select"><select id="dpsVisualDifficulty" data-dps-view-diff aria-label="비교할 난이도 선택">${diffOptions}</select></label>`);
  return `<div class="dps-overview">
    ${renderDpsTableSummary(current,'고행',currentValue,enemyItems,'',context,round)}
    ${renderDpsStatTable(rows,'고행',difficulty+' 고행별 DPS 및 적 정보')}
  </div>`;
}
function changeDpsVisualDifficulty(value){
  const choices=activeDpsTableMode==='coop'?COOP_DPS_TABLE_DIFFICULTIES:DPS_TABLE_DIFFICULTIES;
  if(!choices.includes(value)||!isDpsTableOpen()) return;
  dpsVisualDifficulty=value;
  renderDpsTablePanelContent();
}
function buildDpsFloorCards(mode){
  const tower=mode==='tower';
  const config=(tower?DPS_CONFIG.dpsTable.tower:DPS_CONFIG.dpsTable.planet)||{};
  const current=tower?normalizedTowerFloorNumber(challengeTowerFloorStoredValue()):normalizedPlanetExplorationFloorNumber(planetExplorationFloorStoredValue());
  const min=Math.max(1,Math.round(config.minFloor||1));
  const max=Math.max(min,Math.round(config.maxFloor||(tower?90:100)));
  const diff=tower?'도전의 탑':(isPlanetExplorationDifficulty()?vs('diff'):'행성탐사-코랄');
  const teamCount=selectedDpsTableTeamCount();
  const rows=[];
  let currentFloorDps=NaN;
  for(let floor=min;floor<=max;floor++){
    const value=dpsTablePreviewValue(diff,0,floor,{battleMode:'solo',teamCount});
    const enemyItems=tower?towerEnemySummaryItems(floor):planetEnemySummaryItems(floor);
    if(floor===current) currentFloorDps=value;
    rows.push({stage:floor,dps:value,enemyItems,current:floor===current});
  }
  const currentEnemy=rows.find(row=>row.current)?.enemyItems||[];
  return `<section class="dps-floor-column" data-dps-floor-board="${mode}" aria-label="${tower?'도전의탑':'행성탐사'} DPS">
    <header class="dps-floor-heading"><h3>${tower?'도전의탑':'행성탐사'}</h3></header>
    ${renderDpsTableSummary(current,'층',currentFloorDps,currentEnemy,mode,dpsTableContextHtml(diff,false,teamCount,true))}
    ${renderDpsStatTable(rows,'층',diff+' 층별 DPS 및 적 정보')}
  </section>`;
}
function renderDpsTableTabs(){
  const current=['tower','planet'].includes(activeDpsTableMode)?'floor':activeDpsTableMode;
  return [
    {key:'solo',label:'개인전'},
    {key:'coop',label:'협동전'},
    {key:'floor',label:'도탑 / 행성'}
  ].map(tab=>{
    const active=current===tab.key;
    return `<button id="dpsTableTab-${tab.key}" type="button" class="dps-table-tab integrated-tab${active?' is-active':''}" data-dps-table-mode="${tab.key}" role="tab" aria-controls="dpsTableContent" aria-selected="${active?'true':'false'}" tabindex="${active?'0':'-1'}"><b>${tab.label}</b></button>`;
  }).join('');
}
function dpsTablePanelInnerHtml(){
  const round=normalizedRoundNumber(targetRoundStoredValue());
  const mode=activeDpsTableMode;
  return `<section class="dps-table-panel">${mode==='tower'||mode==='planet'?`<div class="dps-floor-tabs integrated-tabs" role="tablist" aria-label="도탑·행성 전환"><button type="button" role="tab" class="dps-floor-tab integrated-tab${mode==='tower'?' is-active':''}" aria-selected="${mode==='tower'}" data-dps-floor-mode="tower">도전의탑</button><button type="button" role="tab" class="dps-floor-tab integrated-tab${mode==='planet'?' is-active':''}" aria-selected="${mode==='planet'}" data-dps-floor-mode="planet">행성탐사</button></div>${buildDpsFloorCards(mode)}`:buildDpsVisualComparison(round,mode)}</section>`;
}
function renderDpsTablePanelContent(){
  const focused=document.activeElement;
  const focusId=focused?.closest('#workspace-dps')?focused.id:'';
  syncDpsTableLabels();
  qsa('[data-dps-table-tabs-mount]').forEach(tabs=>{
    tabs.innerHTML=renderDpsTableTabs();
  });
  const inner=dpsTablePanelInnerHtml();
  qsa('[data-dps-table-mount]').forEach(mount=>{
    mount.innerHTML=inner;
  });
  const content=$('dpsTableContent');
  if(content){
    const tab=['tower','planet'].includes(activeDpsTableMode)?'floor':activeDpsTableMode;
    content.setAttribute('aria-labelledby',`dpsTableTab-${tab}`);
  }
  if(focusId) $(focusId)?.focus({preventScroll:true});
}
function switchDpsTableMode(mode){
  const next=mode==='floor'?(['tower','planet'].includes(activeDpsTableMode)?activeDpsTableMode:'tower'):mode;
  if(!DPS_TABLE_MODES.includes(next) || activeDpsTableMode===next) return;
  activeDpsTableMode=next;
  renderDpsTablePanelContent();
}
function openDpsTable(mode='auto'){
  const fallbackMode=isTowerDifficulty() ? 'tower' : (isPlanetExplorationDifficulty() ? 'planet' : (isCoopActive() ? 'coop' : 'solo'));
  const normalizedMode=mode==='round' ? 'solo' : (mode==='auto' ? fallbackMode : mode);
  activeDpsTableMode=DPS_TABLE_MODES.includes(normalizedMode) ? normalizedMode : fallbackMode;
  dpsVisualDifficulty='';
  // 모바일·태블릿에서는 분석 보드 페이지도 함께 엽니다.
  if(document.body.classList.contains('is-tabbed')){
    const analysisTab=$('mobileTab-specUnit');
    if(analysisTab && analysisTab.getAttribute('aria-selected')!=='true') analysisTab.click();
  }
  setDamageBoardTab('table');
}
function bindDpsTableEvents(){
  const workspace=$('workspace-dps');
  if(!workspace) return;
  workspace.addEventListener('click',event=>{
    const mode=event.target.closest('[data-dps-table-mode]');
    if(mode) switchDpsTableMode(mode.dataset.dpsTableMode);
    const floorMode=event.target.closest('[data-dps-floor-mode]');
    if(floorMode) switchDpsTableMode(floorMode.dataset.dpsFloorMode);
    if(event.target.closest('[data-dps-current-row]')){
      event.target.closest('.dps-floor-column')?.querySelector('.dps-stat-row.is-current')?.scrollIntoView({block:'center',behavior:'instant'});
    }
  });
  workspace.addEventListener('change',event=>{
    if(event.target.matches('[data-dps-view-diff]')) changeDpsVisualDifficulty(event.target.value);
  });
  workspace.addEventListener('keydown',event=>{
    const tab=event.target.closest('[data-dps-table-mode]');
    if(!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const tabs=[...workspace.querySelectorAll('[data-dps-table-mode]')];
    const index=tabs.indexOf(tab);
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    const mode=tabs[next].dataset.dpsTableMode;
    switchDpsTableMode(mode);
    workspace.querySelector(`[data-dps-table-mode="${mode}"]`)?.focus({preventScroll:true});
    event.preventDefault();
  });
}
/* 기본 정보·유닛 저장 필드 레지스트리 */
const FIELD_REGISTRY={
  sp:{kind:'기본 정보',name:'시작 SP',save:true},
  xp:{kind:'기본 정보',name:'보유 XP',save:true},
  bxp:{kind:'기본 정보',name:'보유 BXP',save:true},
  rp:{kind:'기본 정보',name:'보유 RP',save:true},
  soul:{kind:'기본 정보',name:'본인 심연의혼',save:true},
  coralShard:{kind:'목표설정',name:'코랄의 파편',save:true},
  aiurShard:{kind:'목표설정',name:'아이어의 파편',save:true},
  xerusShard:{kind:'목표설정',name:'제루스의 파편',save:true},
  diff:{kind:'목표설정',name:'난이도',save:true},
  round:{kind:'목표설정',name:'목표 라운드',save:true},
  challengeTowerFloor:{kind:'목표설정',name:'도전의탑 층',save:true},
  planetExplorationFloor:{kind:'목표설정',name:'행성탐사 층',save:true},
  soloMode:{kind:'목표설정',name:'개인전',save:true},
  coopMode:{kind:'목표설정',name:'협동전',save:true},
  coopPassenger2Dr:{kind:'목표설정',name:'승객 2P 방어력 감소',save:true},
  coopPassenger3Dr:{kind:'목표설정',name:'승객 3P 방어력 감소',save:true},
  team:{kind:'목표설정',name:'출발 지원 인원수',save:true},
  pbless:{kind:'목표설정',name:'파워 블레스',save:true},
  spBankApply:{kind:'기본 정보',name:'SP 은행',save:true},
  penance:{kind:'목표설정',name:'고행 단계',save:true},
  titleTdBonus:{kind:'목표설정',name:'타이틀 총 데미지',save:true},
  specDpsSpeedMode:{kind:'스펙 보드',name:'스피드 모드',save:true},
  dpsBaseUnits:{kind:'유닛 보드',name:'유닛 구성',save:true},
  dpsBaseUnitSlots:{kind:'유닛 보드',name:'유닛 선택 위치',save:true},
  dpsBaseUnitVisibleSlotCount:{kind:'유닛 보드',name:'표시 슬롯 수',save:true},
  dpsJewelSettings:{kind:'쥬얼 설정',name:'전설·신화 쥬얼',save:true},
  dpsBaseUnitExtraSettings:{kind:'유닛 보드',name:'추가 유닛 쥬얼 & 한계 돌파',save:true},
  dpsBaseUnitSlotExpansions:{kind:'유닛 보드',name:'슬롯 확장',save:true},
  dpsBaseUnitSpeedMode:{kind:'유닛 보드',name:'스피드 모드',save:true},
  erosionStack:{kind:'목표설정',name:'어비스 침색 스텍',save:true},
  jewelErosionRes:{kind:'목표설정',name:'어비스 심연 내성',save:true},
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
  specBoardPierce:{kind:'룬효과 버프',name:'방어력 관통',save:true},
  donationBuffType:{kind:'룬효과 버프',name:'나눔 유저 적용',save:true},
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
    {kind:'유닛 보드',name:`${unit.label || unit.id} 마리수`,save:true}
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
// 슬롯 확장은 현재 유닛 수량이 5마리 이상일 때만 사용할 수 있습니다.
// 데하카처럼 수량이 1마리로 고정된 유닛은 자동으로 비활성화됩니다.
function dpsBaseUnitSlotExpansionAvailable(unitOrId){
  const unit=resolveDpsBaseUnit(unitOrId);
  return !!unit && dpsBaseUnitAllowsSlotExpansion(unit) && dpsBaseUnitHasQuantity(unit)
    && Number(dpsBaseUnitQuantityText(unit))>=5;
}
function dpsBaseUnitSlotExpanded(unitOrId){
  const unit=resolveDpsBaseUnit(unitOrId);
  return dpsBaseUnitSlotExpansionAvailable(unit) && dpsBaseUnitSlotExpansionIds().includes(unit.id);
}
function toggleDpsBaseUnitSlotExpansion(unitId){
  const unit=dpsBaseUnitById(unitId);
  const store=$('dpsBaseUnitSlotExpansions');
  if(!unit || !store || !dpsBaseUnitSlotExpansionAvailable(unit)) return false;
  const ids=dpsBaseUnitSlotExpansionIds();
  const index=ids.indexOf(unit.id);
  if(index>=0){
    ids.splice(index,1);
    dpsUnitExpandedCardIds.delete(unit.id);
  }else ids.push(unit.id);
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
function dpsBaseUnitPlanetSelectionRestricted(){
  return typeof isPlanetExplorationDifficulty==='function' && isPlanetExplorationDifficulty();
}
function dpsBaseUnitAllowedForCurrentPlanet(unitOrId){
  const unit=dpsBaseUnitById(unitOrId);
  if(!unit || !dpsBaseUnitPlanetSelectionRestricted()) return true;
  if(typeof dpsBaseUnitPlanetCritDamageMultiplier!=='function') return true;
  return dpsBaseUnitPlanetCritDamageMultiplier(unit, vs('diff'))>0.1;
}
function filterDpsBaseUnitSlotsForCurrentPlanet(slots){
  const normalized=normalizeDpsBaseUnitSlotValues(slots);
  if(!dpsBaseUnitPlanetSelectionRestricted()) return normalized;
  return normalized.map(id=>id && dpsBaseUnitAllowedForCurrentPlanet(id) ? id : '');
}
function filterDpsBaseUnitIdsForCurrentPlanet(ids){
  const normalized=dpsBaseUnitSelectionIds(ids);
  if(!dpsBaseUnitPlanetSelectionRestricted()) return normalized;
  return normalized.filter(id=>dpsBaseUnitAllowedForCurrentPlanet(id));
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
function dpsBaseUnitSpeedDisplay(unit,result){
  const maximum=!!unit && !dpsBaseUnitIsArtifact(unit) && dpsBaseUnitResultHasMaxAttackSpeed(result);
  return {
    label:maximum ? '최대공속' : '공격속도',
    value:unit && !dpsBaseUnitIsArtifact(unit)
      ? ((maximum ? dpsBaseUnitMaxCooldownText(result) : dpsBaseUnitFinalCooldownText(result)) || '—') : '—',
    maximum
  };
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
    if(options.compactTenThousands) return compact(10000,'만');
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
function renderDpsBaseUnitSummary(s,hidden=false){
  const el=$('dpsBaseUnitSummary');
  if(!el) return;
  const info=s?.dpsBaseUnit;
  const results=Array.isArray(info?.results) ? info.results : [];
  const basePierce=Number(info?.basePierceBonus)||0;
  dpsBaseUnitBoardBasePierce=basePierce;
  const selectedResultEntries=(hidden ? [] : results).map(item=>[String(item?.unitId || ''),item]).filter(([id])=>id);
  dpsBaseUnitResultDisplayMap=new Map(selectedResultEntries);
  syncDpsBaseUnitControl();
  const requiredDps=Number(info?.requiredDps);
  if(hidden){
    el.hidden=true;
    el.innerHTML='';
    return;
  }
  const valid=Number.isFinite(requiredDps) && requiredDps>0;
  const expectedDps=Math.max(0,Number(info?.expectedDps)||0);
  const achievementRate=Math.max(0,Number(info?.achievementRate)||0);
  const rawPercent=valid ? dpsBaseUnitAchievementPercent(achievementRate) : null;
  const shownPercent=rawPercent===null ? '—' : dpsBaseUnitAchievementText(achievementRate);
  const contextHtml=`<div class="right-hero-context dps-base-unit-context" aria-label="유닛 보드 모드 및 난이도"><span class="unit-summary-label">모드 / 난이도</span><strong class="right-hero-compact-mode">${dpsBoardContextHtml()}</strong></div>`;
  const tower=isTowerDifficulty();
  const planet=isPlanetExplorationDifficulty();
  const currentStage=tower?`${challengeTowerFloorStoredValue()}층`:planet?`${planetExplorationFloorStoredValue()}층`:`${effectivePenanceValue()} 고행`;
  const currentRound=tower||planet?'':`${normalizedRoundNumber(targetRoundStoredValue())} 라운드`;
  const stageHtml=`<div class="unit-summary-stage"><span class="unit-summary-label">현재 ${tower||planet?'층':'고행 / 라운드'}</span><strong>${escapeHtml(currentStage)}</strong><small>${escapeHtml(currentRound||' ')}</small></div>`;
  const requiredHtml=`<div class="dps-base-unit-summary-item"><span class="dps-feature-heading"><span class="dps-lbl">클리어 기준</span></span><b class="dps-num">${dpsBaseUnitSummaryMarkup(valid ? dpsBaseUnitNumberText(requiredDps,DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS) : '—')}</b></div>`;
  const expectedHtml=`<div class="dps-base-unit-summary-item dps-base-unit-expected"><span class="dps-feature-heading"><span class="dps-lbl">클리어 기대값</span></span><b class="dps-num">${dpsBaseUnitSummaryMarkup(valid ? dpsBaseUnitNumberText(expectedDps,DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS) : '—')}</b></div>`;
  const achievementHtml=`<div class="unit-achievement" aria-label="클리어 달성률 ${escapeHtml(shownPercent)}"><div class="unit-achievement-label"><span>달성률 <button type="button" class="unit-achievement-help-trigger" data-action="toggleAchievementHelp" aria-label="달성률 안내 열기" aria-controls="unitAchievementHelpPopover" aria-expanded="false">?</button></span></div><b class="dps-num unit-achievement-value">${escapeHtml(shownPercent)}</b></div>`;
  const enemy=s?.enemyData;
  const enemyHp=Number(enemy?.hp);
  const enemyShield=Number(enemy?.shield);
  const enemyCount=Number.isFinite(Number(enemy?.round))
    ? enemyDisplayCountText(enemy.round)
    : Number.isFinite(Number(enemy?.count)) ? fullNumber(Number(enemy.count)) : '—';
  const enemyStats=[
    ['체력',enemyHp],['실드',enemyShield],['방어력',Number(enemy?.armor)]
  ];
  const enemyCells=enemyStats.map(([label,value])=>`<div><dt>${label}</dt><dd>${Number.isFinite(value)&&value>=0?escapeHtml(fullNumber(value)):'—'}</dd></div>`).join('');
  const enemyHtml=`<dl class="dps-base-unit-enemies" aria-label="적 정보">${enemyCells}<div><dt>물량</dt><dd>${escapeHtml(enemyCount)}</dd></div></dl>`;
  closeDpsBaseUnitAchievementHelp();
  el.innerHTML=`<div class="dps-base-unit-summary-row"><div class="dps-base-unit-top">${contextHtml}${stageHtml}</div><div class="dps-base-unit-results" aria-label="유닛 클리어 결과">${requiredHtml}${expectedHtml}${achievementHtml}</div>${enemyHtml}</div>`;

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
function dpsBaseUnitQuantityControlHtml(unit, slotIndex, idPrefix='dpsBaseUnitSlotQty'){
  if(!unit) return '<span class="dps-base-unit-fixed-qty is-auto-value">—</span>';
  if(!dpsBaseUnitHasQuantity(unit)) return '<span class="dps-base-unit-fixed-qty is-auto-value">1</span>';
  const limit=dpsBaseUnitQuantityLimit(unit);
  const value=normalizeDpsBaseUnitQuantityValue(dpsBaseUnitStoreInput('quantity',unit)?.value || 0,unit);
  const increaseDisabled=Number(value)>=limit ? ' disabled aria-disabled="true"' : '';
  const label=escapeHtml(dpsBaseUnitLabel(unit.id));
  return `<div class="dps-base-unit-qty-control" data-dps-base-unit-qty-control="${escapeHtml(unit.id)}"><button class="ui-choice-btn dps-base-unit-qty-btn" data-dps-base-unit-qty-delta="-1" data-dps-base-unit-id="${escapeHtml(unit.id)}" type="button" aria-label="${label} 마리수 감소">−</button><input class="dps-base-unit-qty-input" id="${idPrefix}${slotIndex+1}" data-dps-base-unit-slot-quantity="${escapeHtml(unit.id)}" inputmode="numeric" type="text" min="0" max="${limit}" value="${escapeHtml(value)}" aria-label="${label} 마리수"/><button class="ui-choice-btn dps-base-unit-qty-btn" data-dps-base-unit-qty-delta="1" data-dps-base-unit-id="${escapeHtml(unit.id)}" type="button" aria-label="${label} 마리수 증가"${increaseDisabled}>+</button></div>`;
}
/* 쥬얼 이미지·표시 및 설정 */
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
      <b><span class="jewel-ability-grade-icon" aria-hidden="true">${label==='신화'?'✦':'◆'}</span>${escapeHtml(label)}</b>
      <span>${escapeHtml(value)}</span>
    </div>
  `;
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
  return `<span class="dps-jewel-final-label">최종 능력치</span>
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
  const field=(key,label)=>`<label class="dps-jewel-field" data-jewel-stat="${key}"><span>${label}</span><select data-dps-jewel-name="${escapeHtml(name)}" data-dps-jewel-field="${key}" aria-label="${escapeHtml(name)} ${label}">${dpsJewelOptionHtml(fieldOptions(key),input[key])}</select></label>`;
  const mythic=finalStats.mythic==='Y';
  const gradeClass=mythic?'is-mythic':'is-legendary';
  const gradeText=mythic?'신화':'전설';
  const initial=name ? name.charAt(0) : '?';
  const imageSources=getJewelImageSources(name);
  const fallbackAttr=imageSources.fallback && imageSources.fallback!==imageSources.src ? ` data-fallback-src="${escapeHtml(imageSources.fallback)}"` : '';
  const ability=dpsJewelAbilityTexts(name);
  return `<article class="dps-jewel-card${mythic?' is-mythic':''}" data-dps-jewel-card="${escapeHtml(name)}">
    <button type="button" class="dps-jewel-card-head" data-dps-jewel-toggle aria-expanded="false" aria-label="${escapeHtml(name)} 능력치 설정 펼치기">
      <div class="jewel-card-visual" aria-hidden="true">
        <img src="${escapeHtml(imageSources.src)}"${fallbackAttr} data-jewel-image="1" alt="" loading="lazy">
        <span>${escapeHtml(initial)}</span>
      </div>
      <div class="dps-jewel-title-block"><b class="${gradeClass}">${escapeHtml(gradeText)} ${escapeHtml(name)}</b></div>
      <span class="dps-jewel-expand-mark" aria-hidden="true">⌄</span>
    </button>
    <div class="dps-jewel-card-detail" hidden>
    <div class="jewel-ability-list dps-jewel-ability-list">
      ${renderJewelAbility('전설', ability.legendary)}
      ${renderJewelAbility('신화', ability.mythic)}
    </div>
    <div class="dps-jewel-settings-title">능력치 설정</div>
    <div class="dps-jewel-fields">${field('ad','공격력')}${field('as','공격속도')}${field('td','총데미지')}${field('ua','가속')}${field('enhance','강화')}${field('mythic','신화 여부')}</div>
    <div class="dps-jewel-final" aria-label="${escapeHtml(name)} 최종 옵션">
      ${dpsJewelFinalStatsHtml(finalStats)}
    </div>
    </div>
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
  // 5마리 이상에서 확장한 유닛만 추가 쥬얼 슬롯을 예약합니다.
  if(!dpsBaseUnitAllowsSlotExpansion(unit) || !dpsBaseUnitSlotExpanded(unit)) return 0;
  return DPS_BASE_UNIT_EXTRA_SLOT_COUNT;
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
  const settings=dpsJewelSettingsObject();
  return `<option value="">없음</option>${names.map(name=>{
    const grade=dpsJewelFinalStats(name,settings).mythic==='Y' ? '신화' : '전설';
    return `<option value="${escapeHtml(name)}"${name===selectedName?' selected':''}>${escapeHtml(`${grade} ${name}`)}</option>`;
  }).join('')}`;
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
// 자동 생성된 나루드만 상세 설정 확인 안내를 표시한다. 유닛 선택 및 계산에는 영향을 주지 않는다.
let dpsUnitAutoNarudReviewSlot=-1;
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
function sanitizeDpsBaseUnitVoidPowerAvailability(){
  const limit=dpsBaseUnitVoidPowerLimit();
  let used=0;
  currentDpsBaseUnitSlots().filter(Boolean).forEach(unitId=>{
    const unit=dpsBaseUnitById(unitId);
    const input=dpsBaseUnitStoreInput('voidPower',unit);
    if(!dpsBaseUnitSupportsAdvancedOptions(unit) || !input || normalizeDpsBaseUnitVoidPowerValue(input.value)!=='ON') return;
    const cost=dpsBaseUnitVoidPowerCost(unit);
    if(unitId==='prodNarud' || used+cost>limit) input.value='OFF';
    else used+=cost;
  });
}

// 유닛 카드와 상세 모달은 동일한 3열 순서를 사용하며, 상세 모달만 입력 컨트롤을 표시한다.
function dpsBaseUnitCompactFieldsHtml(unit,slotIndex,readOnly=false){
  const result=unit ? dpsBaseUnitResultDisplayMap.get(String(unit.id || '')) || null : null;
  const attack=result ? dpsBaseUnitAttackText(result) : '—';
  const pierce=result ? dpsBaseUnitPercentText(result.effectivePierce) : (unit && dpsBaseUnitIsArtifact(unit) ? '0%' : '—');
  const dps=result ? dpsBaseUnitDpsText(result) : '—';
  const speed=dpsBaseUnitSpeedDisplay(unit,result);
  const unitId=unit ? escapeHtml(unit.id) : '';
  const label=unit ? escapeHtml(dpsBaseUnitLabel(unit)) : '미설정';
  const enhance=unit ? normalizeDpsBaseUnitEnhanceValue(dpsBaseUnitStoreInput('enhance',unit)?.value,0) : '—';
  const canUseEnhance=!!unit && dpsBaseUnitCanUseEnhance(unit);
  const canUseLimitBreak=!!unit && dpsBaseUnitCanUseLimitBreak(unit);
  const advanced=!!unit && dpsBaseUnitSupportsAdvancedOptions(unit);
  const limitBreak=canUseLimitBreak ? normalizeDpsBaseUnitLimitBreakValue(dpsBaseUnitStoreInput('limitBreak',unit)?.value) : '0';
  const jewelName=advanced ? normalizeDpsJewelName(dpsBaseUnitStoreInput('jewel',unit)?.value) : '';
  const voidPower=advanced && unit.id!=='prodNarud' ? normalizeDpsBaseUnitVoidPowerValue(dpsBaseUnitStoreInput('voidPower',unit)?.value) : 'OFF';
  const voidUsage=dpsBaseUnitVoidPowerUsage();
  const voidLimit=dpsBaseUnitVoidPowerLimit();
  const voidCanEnable=advanced && unit.id!=='prodNarud' && (voidPower==='ON' || voidUsage+dpsBaseUnitVoidPowerCost(unit)<=voidLimit);
  const plain=(title,value,extraClass='')=>dpsBaseUnitFieldHtml(title,`unit-slot-compact-field ${extraClass}`,`<span class="unit-slot-compact-value">${escapeHtml(String(value))}</span>`);
  const fields=[
    plain('공격력',attack),
    plain(speed.label,speed.value,speed.maximum?'is-max-speed':''),
    plain('방어력 관통',pierce),
    plain(unit && dpsBaseUnitIsArtifact(unit)?'파장 총 DPS':'총 DPS',dps),
  ];
  if(readOnly){
    const quantity=unit ? dpsBaseUnitQuantityText(unit) : '—';
    const voidText=advanced && unit.id!=='prodNarud' && voidPower==='ON' ? `${voidUsage} / ${voidLimit}` : '-';
    fields.push(
      plain('강화 기대값',unit ? String(canUseEnhance?enhance:0) : '—'),
      plain('한계 돌파',unit ? (canUseLimitBreak?limitBreak:'사용 불가') : '—'),
      plain('전설·신화 쥬얼',unit ? (advanced ? (jewelName||'없음') : '사용 불가') : '—'),
      plain('마리수',quantity),
      plain('공허의 힘',voidText)
    );
  }else{
    const emptyOption=unit ? '사용 불가' : '유닛 선택 후 사용';
    const limitOptions=canUseLimitBreak
      ? Array.from({length:7},(_,value)=>`<option value="${value}"${String(value)===limitBreak?' selected':''}>${value}</option>`).join('')
      : `<option value="0" selected>${emptyOption}</option>`;
    const jewelOptions=advanced ? dpsBaseUnitJewelOptionsHtml(jewelName,dpsBaseUnitJewelOwnerKey(unit.id)) : `<option value="" selected>${emptyOption}</option>`;
    const enhanceControl=`<input class="dps-base-unit-setting-input" ${unit?`id="dpsBaseUnitSlotEnhance${slotIndex+1}" data-dps-base-unit-slot-enhance="${unitId}"`:''} type="text" inputmode="decimal" min="0" max="1000" value="${unit?escapeHtml(String(canUseEnhance?enhance:0)):''}" aria-label="${label} 강화 기대값"${canUseEnhance?'':' disabled'}/>`;
    const limitControl=`<select class="dps-base-unit-setting-select" ${unit?`id="dpsBaseUnitSlotLimitBreak${slotIndex+1}" data-dps-base-unit-slot-limit-break="${unitId}"`:''} aria-label="${label} 한계 돌파"${canUseLimitBreak?'':' disabled'}>${limitOptions}</select>`;
    const jewelControl=`<select class="dps-base-unit-setting-select" ${unit?`id="dpsBaseUnitSlotJewel${slotIndex+1}" data-dps-base-unit-slot-jewel="${unitId}"`:''} aria-label="${label} 전설·신화 쥬얼"${advanced?'':' disabled'}>${jewelOptions}</select>`;
    const quantityControl=`<div class="dps-base-unit-board-cell dps-base-unit-board-quantity">${dpsBaseUnitQuantityControlHtml(unit,slotIndex)}</div>`;
    const voidControl=`<button class="ui-choice-btn dps-base-unit-void-power-control${voidPower==='ON'?' is-active':''}" type="button" ${unit?`id="dpsBaseUnitSlotVoidPower${slotIndex+1}" data-dps-base-unit-void-power-toggle="${unitId}"`:''} aria-pressed="${voidPower==='ON'}" aria-label="${label} 공허의 힘 ${voidUsage} / ${voidLimit}"${voidCanEnable?'':' disabled'}>${advanced?`${voidUsage} / ${voidLimit}`:'—'}</button>`;
    fields.push(
      dpsBaseUnitFieldHtml('강화 기대값','unit-slot-compact-field',enhanceControl),
      dpsBaseUnitFieldHtml('한계 돌파','unit-slot-compact-field',limitControl),
      dpsBaseUnitFieldHtml('전설·신화 쥬얼','unit-slot-compact-field',jewelControl),
      dpsBaseUnitFieldHtml('마리수','unit-slot-compact-field',quantityControl),
      dpsBaseUnitFieldHtml('공허의 힘','unit-slot-compact-field',voidControl)
    );
  }
  return `<div class="unit-slot-compact-grid${readOnly?' is-readonly':''}" aria-label="유닛 상세 수치">${fields.join('')}</div>`;
}
function dpsBaseUnitSlotExpansionButtonHtml(unit){
  if(!unit || !dpsBaseUnitAllowsSlotExpansion(unit)) return '';
  const available=dpsBaseUnitSlotExpansionAvailable(unit);
  const expanded=dpsBaseUnitSlotExpanded(unit);
  const reason=dpsBaseUnitHasQuantity(unit)?'수량 5마리 이상 필요':'수량 1마리 제한';
  const label=escapeHtml(dpsBaseUnitLabel(unit));
  return `<button class="ui-choice-btn dps-base-unit-option-btn dps-base-unit-slot-expansion-btn${expanded?' is-active':''}" data-dps-base-unit-slot-expansion-toggle="${escapeHtml(unit.id)}" type="button" aria-pressed="${expanded}" aria-label="${label} 슬롯 확장${available?'':` 불가, ${reason}`}"${available?'':' disabled'}>슬롯 확장</button>`;
}
function dpsBaseUnitSettingsHtml(unit,slotIndex){
  return dpsBaseUnitCompactFieldsHtml(unit,slotIndex)+ (unit ? dpsBaseUnitAdditionalSettingsHtml(unit) : '<p class="unit-slot-empty-guidance">위에서 유닛을 선택하면 모든 설정을 바로 사용할 수 있습니다.</p>');
}

function dpsBaseUnitSelectOptionsHtml(selectedId, selectedIds){
  const selectedSet=new Set(selectedIds.filter(Boolean));
  const planetRestricted=dpsBaseUnitPlanetSelectionRestricted();
  const groups=new Map();
  sortedDpsBaseUnits().forEach(unit=>{
    const grade=unit.grade || '기타';
    if(!groups.has(grade)) groups.set(grade,[]);
    groups.get(grade).push(unit);
  });
  const groupHtml=[...groups.entries()].map(([grade,units])=>{
    const options=units.map(unit=>{
      const selected=unit.id===selectedId;
      const duplicateDisabled=!selected && selectedSet.has(unit.id);
      const planetDisabled=planetRestricted && !dpsBaseUnitAllowedForCurrentPlanet(unit);
      const disabled=duplicateDisabled || planetDisabled;
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
  const selectControl=`<div class="dps-base-unit-select-wrap"><select class="dps-base-unit-select" id="dpsBaseUnitSlot${slotIndex+1}" data-dps-base-unit-slot="${slotIndex}" aria-label="슬롯 ${slotIndex+1} 유닛 선택">${dpsBaseUnitSelectOptionsHtml(unitId,slots)}</select></div>`;
  const name=dpsBaseUnitFieldHtml('유닛명','dps-base-unit-name-field',selectControl);
  return `<article class="dps-base-unit-card right-unit-slot-card${unit?'':' is-empty'}" aria-label="유닛 슬롯 ${slotIndex+1}"><div class="dps-base-unit-entry" data-dps-base-unit-slot-row="${slotIndex}">${name}</div><div class="right-unit-slot-settings">${dpsBaseUnitSettingsHtml(unit,slotIndex)}</div></article>`;
}

let dpsUnitSelectedSlot=0;
let dpsUnitDetailOpen=false;
let dpsUnitSlotPending=null;
function beginDpsUnitSlotAddition(index,initialUnitId=''){
  // 기존 상태와 변경된 쥬얼 배정까지 함께 복원할 수 있도록 저장 입력을 보관한다.
  ensureDpsBaseUnitStore();
  dpsUnitSlotPending={
    index,
    previousSelectedSlot:dpsUnitSelectedSlot,
    fields:new Map([...USER_STATE_VALUE_IDS].map(id=>[id,$(id)?.value]).filter(([,value])=>value!==undefined))
  };
  if(typeof cancelScheduledAutoSave==='function') cancelScheduledAutoSave();
  dpsUnitSelectedSlot=index;
  dpsUnitDetailOpen=true;
  if(initialUnitId) changeDpsBaseUnitSlot(index,initialUnitId,{notify:false});
  else syncDpsBaseUnitControl({skipJewelConfig:true});
  // 비표시 원본 select 대신 화면에 생성된 실제 선택 버튼으로 포커스를 이동한다.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(!dpsUnitDetailOpen || dpsUnitSlotPending?.index!==index) return;
    const button=$('dpsBaseUnitSlot'+(index+1))?.nextElementSibling;
    (button?.matches('.app-select-trigger') ? button : $('unitSlotModalClose'))?.focus({preventScroll:true});
  }));
}
function restorePendingDpsUnitSlot(){
  const pending=dpsUnitSlotPending;
  if(!pending) return;
  dpsUnitSlotPending=null;
  pending.fields.forEach((value,id)=>{ const field=$(id); if(field) field.value=value; });
  dpsUnitSelectedSlot=pending.previousSelectedSlot;
}
function confirmDpsUnitSlotModal(){
  if(!dpsUnitDetailOpen) return;
  if(dpsUnitSelectedSlot===dpsUnitAutoNarudReviewSlot && currentDpsBaseUnitSlots()[dpsUnitSelectedSlot]==='prodNarud') dpsUnitAutoNarudReviewSlot=-1;
  if(dpsUnitSlotPending){
    const pending=dpsUnitSlotPending;
    // 유닛 미선택 상태는 슬롯 생성 확정으로 취급하지 않는다.
    if(!dpsBaseUnitById(currentDpsBaseUnitSlots()[pending.index])) return;
    dpsUnitSlotPending=null;
    const visible=$('dpsBaseUnitVisibleSlotCount');
    if(visible) visible.value=String(Math.max(dpsUnitVisibleCount(currentDpsBaseUnitSlots()),pending.index+1));
    dpsUnitDetailOpen=false;
    syncDpsBaseUnitControl({skipJewelConfig:true});
    commitAppUpdate();
    $('dpsBaseUnitSlotStack')?.querySelector(`[data-unit-list-select="${pending.index}"]`)?.focus({preventScroll:true});
    return;
  }
  closeDpsUnitSlotModal();
}
// 기존 유닛 배치값은 항상 10칸으로 보존하고, 화면에 표시할 슬롯 수만 따로 관리합니다.
function dpsUnitVisibleCount(slots){
  const input=$('dpsBaseUnitVisibleSlotCount');
  const parsed=Number.parseInt(input?.value || '1',10);
  const stored=Number.isFinite(parsed) ? Math.min(10,Math.max(1,parsed)) : 1;
  const lastUsed=slots.reduce((last,id,i)=>id && i!==dpsUnitSlotPending?.index ? i+1 : last,0);
  const visible=Math.max(stored,lastUsed,1);
  if(input && input.value!==String(visible)) input.value=String(visible);
  return visible;
}
const dpsUnitExpandedCardIds=new Set();
function dpsUnitExpandedSettingsHtml(unit){
  if(!unit || !dpsBaseUnitSlotExpanded(unit)) return '';
  const opened=dpsUnitExpandedCardIds.has(unit.id);
  const rows=opened ? dpsBaseUnitExtraSlotSettings(unit).map((setting,index)=>`<div class="unit-slot-expansion-row"><span><small>${index+2}기 쥬얼</small><b>${escapeHtml(setting.legendaryMythicJewel || '없음')}</b></span><span><small>${index+2}기 한계돌파</small><b>${escapeHtml(String(setting.limitBreak ?? 0))}</b></span></div>`).join('') : '';
  return `<div class="unit-slot-expansion"><button type="button" class="unit-slot-expansion-toggle" data-unit-slot-expansion-toggle="${escapeHtml(unit.id)}" aria-expanded="${opened}" aria-label="${escapeHtml(dpsBaseUnitLabel(unit))} 2~5기 상세 ${opened?'접기':'펼치기'}">슬롯 확장 활성화 <span aria-hidden="true">${opened?'⌃':'⌄'}</span></button>${opened?`<div class="unit-slot-expansion-rows">${rows}</div>`:''}</div>`;
}

function dpsBaseUnitSlotsHtml(slots){
  dpsUnitSelectedSlot=Math.max(0,Math.min(slots.length-1,dpsUnitSelectedSlot));
  if(slots[dpsUnitAutoNarudReviewSlot]!=='prodNarud') dpsUnitAutoNarudReviewSlot=-1;
  const visibleCount=dpsUnitVisibleCount(slots);
  const basicRows=[];
  const rows=slots.slice(0,visibleCount).map((unitId,index)=>{
    const unit=dpsBaseUnitById(unitId);
    const info=unit ? dpsBaseUnitResultDisplayMap.get(String(unit.id||'')) : null;
    const attack=unit && info ? dpsBaseUnitAttackText(info) : '—';
    const pierce=unit && info ? dpsBaseUnitPercentText(info.effectivePierce) : '—';
    const dps=unit && info ? dpsBaseUnitDpsText(info) : '—';
    const unitName=unit ? dpsBaseUnitDisplayLabel(unit) : '유닛 미설정';
    const quantity=unit ? (dpsBaseUnitHasQuantity(unit) ? dpsBaseUnitQuantityText(unit) : '1') : '—';
    if(unit){
      basicRows.push(`<tr><th scope="row">${String(index+1).padStart(2,'0')}</th><td>${escapeHtml(unitName)}</td><td>${escapeHtml(quantity)}</td><td>${escapeHtml(attack)}</td><td>${escapeHtml(pierce)}</td></tr>`);
    }
    const grade=unit ? String(unit.grade || '유닛') : '유닛 선택 대기';
    const selected=index===dpsUnitSelectedSlot && dpsUnitDetailOpen;
    const narudReview=index===dpsUnitAutoNarudReviewSlot && unitId==='prodNarud';
    return `<article class="unit-slot-overview-card${selected?' is-selected':''}${unit?'':' is-unassigned'}${narudReview?' is-narud-review':''}" aria-label="${index+1}번 유닛 슬롯">
      <div class="unit-slot-card-head"><div class="unit-slot-heading"><span class="unit-slot-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><span class="unit-slot-heading-label">유닛 슬롯</span></div><div class="unit-slot-card-actions">${index>0 ? `<button type="button" class="unit-list-remove" data-unit-list-remove="${index}" aria-label="${index+1}번 슬롯 삭제">×</button>` : '<span class="unit-slot-card-remove-placeholder" aria-hidden="true"></span>'}</div></div>
      <button type="button" class="unit-slot-card-main" data-unit-list-select="${index}" aria-label="${index+1}번 슬롯 ${narudReview?'나루드 세부 설정 필요, ':''}상세 설정 열기" aria-haspopup="dialog" aria-expanded="${selected}" aria-controls="dpsUnitSlotModal">
        <span class="unit-slot-identity"><span class="unit-slot-grade">${escapeHtml(grade)}</span><b>${escapeHtml(unitName)}</b></span>
        ${dpsBaseUnitCompactFieldsHtml(unit,index,true)}
        ${narudReview?'<span class="unit-slot-narud-review-note"><strong>나루드 세부 설정 필요</strong><small>카드를 눌러 설정을 확인해 주세요</small></span>':''}
      </button>
      ${dpsUnitExpandedSettingsHtml(unit)}</article>`;
  }).join('');
  const basicInfo=`<div class="unit-basic-summary"><table aria-label="설정된 유닛 기본정보"><colgroup><col class="unit-basic-number"><col class="unit-basic-name"><col class="unit-basic-quantity"><col class="unit-basic-attack"><col class="unit-basic-pierce"></colgroup><thead><tr><th scope="col">슬롯 번호</th><th scope="col">유닛명</th><th scope="col">마리수</th><th scope="col">공격력</th><th scope="col">관통</th></tr></thead><tbody>${basicRows.join('') || '<tr><td colspan="5" class="unit-basic-empty">유닛을 설정하면 기본정보가 표시됩니다.</td></tr>'}</tbody></table></div>`;
  const next=visibleCount<slots.length
    ? `<button class="unit-slot-add-card" type="button" data-unit-slot-add="${visibleCount}" aria-label="${visibleCount+1}번 유닛 슬롯 추가"><span class="unit-slot-add-symbol" aria-hidden="true">+</span><strong>${visibleCount+1}번 슬롯 추가</strong></button>` : '';
  return `<section class="unit-list-collection" aria-label="유닛 슬롯 관리">${basicInfo}<div class="unit-slot-cards-grid" aria-label="유닛 슬롯 카드 목록">${rows}${next}</div></section>`;
}

let dpsUnitSlotModalSyncing=false;
function syncDpsUnitSlotModal(slots){
  // 입력 blur/change가 렌더링 도중 다시 호출되어 DOM을 이중 교체하지 않도록 보호
  if(dpsUnitSlotModalSyncing) return;
  dpsUnitSlotModalSyncing=true;
  try{
  const shell=$('dpsUnitSlotModal');
  const panel=$('dpsUnitSlotDetail');
  const title=$('dpsUnitSlotDetailTitle');
  if(!shell || !panel || !title) return;
  shell.hidden=!dpsUnitDetailOpen;
  shell.classList.toggle('is-open',dpsUnitDetailOpen);
  document.body.classList.toggle('unit-slot-modal-open',dpsUnitDetailOpen);
  if(!dpsUnitDetailOpen){
    if(panel.innerHTML) panel.replaceChildren();
    return;
  }
  title.textContent=`슬롯 ${dpsUnitSelectedSlot+1} 상세 설정`;
  const confirmButton=shell.querySelector('[data-unit-detail-confirm]');
  if(confirmButton){
    const missingUnit=!!dpsUnitSlotPending && !dpsBaseUnitById(slots[dpsUnitSelectedSlot]);
    confirmButton.disabled=missingUnit;
  }
  const expansionContainer=shell.querySelector('[data-unit-detail-expansion]');
  if(expansionContainer) expansionContainer.innerHTML=dpsBaseUnitSlotExpansionButtonHtml(dpsBaseUnitById(slots[dpsUnitSelectedSlot]));
  shell.querySelector('.unit-slot-modal-footer')?.classList.toggle('has-expansion',!!expansionContainer?.innerHTML);
  const removeButton=shell.querySelector('[data-unit-detail-remove]');
  if(removeButton) removeButton.disabled=!dpsBaseUnitById(slots[dpsUnitSelectedSlot]) && !dpsUnitSlotPending;
  const card=dpsBaseUnitSlotHtml(slots[dpsUnitSelectedSlot],dpsUnitSelectedSlot,slots);
  if(panel.innerHTML!==card){
    const state=captureDpsBaseUnitViewState(panel);
    const scrollArea=shell.querySelector('.unit-slot-modal-scroll');
    const previousScroll=scrollArea?.scrollTop || 0;
    panel.innerHTML=card;
    restoreDpsBaseUnitViewState(panel,state);
    if(scrollArea) scrollArea.scrollTop=previousScroll;
  }
  }finally{ dpsUnitSlotModalSyncing=false; }
}
function closeDpsUnitSlotModal(){
  if(!dpsUnitDetailOpen) return;
  const pendingIndex=dpsUnitSlotPending?.index;
  if(dpsUnitSlotPending) restorePendingDpsUnitSlot();
  dpsUnitDetailOpen=false;
  syncDpsBaseUnitControl({skipJewelConfig:true});
  if(pendingIndex!==undefined){
    // 닫기/ESC/배경 클릭은 임시 입력을 모두 취소하고, 새 슬롯도 생성하지 않는다.
    requestAppUpdate({save:false});
    $('dpsBaseUnitSlotStack')?.querySelector(`[data-unit-slot-add="${pendingIndex}"]`)?.focus({preventScroll:true});
  }else{
    $('dpsBaseUnitSlotStack')?.querySelector(`[data-unit-list-select="${dpsUnitSelectedSlot}"]`)?.focus({preventScroll:true});
  }
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
  if(!unit || !dpsBaseUnitSupportsAdvancedOptions(unit) || unit.id==='prodNarud'){
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
  if(next==='ON'){
    const slots=currentDpsBaseUnitSlots();
    const index=slots.indexOf(unit.id);
    // 설정된 유닛은 이동·덮어쓰지 않으며, 나루드가 아직 없을 때 바로 다음 빈 슬롯에만 생성한다.
    if(index>=0 && index<slots.length-1 && !slots[index+1] && !slots.includes('prodNarud')
      && dpsBaseUnitAllowedForCurrentPlanet(dpsBaseUnitById('prodNarud'))){
      changeDpsBaseUnitSlot(index+1,'prodNarud',{notify:false});
      dpsUnitAutoNarudReviewSlot=index+1;
    }
  }
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
  const selectedIds=filterDpsBaseUnitIdsForCurrentPlanet(initialIds).slice(0,dpsBaseUnitSelectionLimit());
  const requestedSlots=options.slots ? normalizeDpsBaseUnitSlotValues(options.slots) : currentDpsBaseUnitSlots();
  const slots=reconcileDpsBaseUnitSlots(filterDpsBaseUnitSlotsForCurrentPlanet(requestedSlots),selectedIds);
  writeDpsBaseUnitSelection(input,slotInput,slots);
  syncDpsBaseUnitControl();
  if(notify){
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }
}
function resetDpsBaseUnitSlotSettings(unitId){
  const unit=dpsBaseUnitById(unitId);
  if(!unit) return;
  const defaults={quantity:'0',enhance:'0',limitBreak:'0',jewel:'',voidPower:'OFF'};
  Object.entries(defaults).forEach(([field,value])=>{
    const store=dpsBaseUnitStoreInput(field,unit);
    if(store) store.value=value;
  });
  const extras=dpsBaseUnitExtraSettingsObject();
  if(Object.prototype.hasOwnProperty.call(extras,unit.id)){
    delete extras[unit.id];
    setDpsBaseUnitExtraSettings(extras);
  }
  const expansions=$('dpsBaseUnitSlotExpansions');
  if(expansions) expansions.value=serializeDpsBaseUnitSlotExpansions(dpsBaseUnitSlotExpansionIds().filter(id=>id!==unit.id));
}
let dpsUnitSlotPendingRemove=null;
function showDpsUnitSlotRemoveDialog(index,unitId){
  const dialog=$('dpsUnitSlotRemoveDialog');
  if(!dialog || typeof dialog.showModal!=='function') return false;
  const unit=dpsBaseUnitById(unitId);
  dpsUnitSlotPendingRemove={index,unitId};
  const title=$('dpsUnitSlotRemoveTitle');
  const description=$('dpsUnitSlotRemoveDescription');
  if(title) title.textContent=`${index+1}번 슬롯 삭제`;
  if(description) description.textContent=`${unit ? dpsBaseUnitDisplayLabel(unit) : '선택된 유닛'} 및 해당 슬롯의 설정값이 초기화됩니다. 삭제하시겠습니까?`;
  if(!dialog.open) dialog.showModal();
  dialog.querySelector('[data-unit-slot-remove-cancel]')?.focus({preventScroll:true});
  return true;
}
function closeDpsUnitSlotRemoveDialog(){
  const dialog=$('dpsUnitSlotRemoveDialog');
  if(dialog?.open) dialog.close();
  dpsUnitSlotPendingRemove=null;
}
function removeDpsBaseUnitSlot(slotIndex,{keepSlot=false,confirmed=false}={}){
  const slots=currentDpsBaseUnitSlots();
  const index=Number(slotIndex);
  const visible=dpsUnitVisibleCount(slots);
  if(!Number.isInteger(index) || index<0 || index>=visible) return false;
  const removedUnit=slots[index];
  if(removedUnit==='prodNarud') dpsUnitAutoNarudReviewSlot=-1;
  else if(!keepSlot && dpsUnitAutoNarudReviewSlot>index) dpsUnitAutoNarudReviewSlot--;
  if(keepSlot){
    // The modal's × removes only the selected unit, not the created slot.
    if(!removedUnit) return false;
    slots[index]='';
  }else{
    // Slot 1 is permanent. Other slots can be closed before selecting any unit.
    if(index===0) return false;
    if(removedUnit && !confirmed){
      showDpsUnitSlotRemoveDialog(index,removedUnit);
      return false;
    }
    slots.splice(index,1);
    slots.push('');
    const count=$('dpsBaseUnitVisibleSlotCount');
    if(count) count.value=String(Math.max(1,visible-1));
    if(dpsUnitSelectedSlot>index) dpsUnitSelectedSlot--;
  }
  if(removedUnit && !slots.includes(removedUnit)){
    dpsUnitExpandedCardIds.delete(removedUnit);
    resetDpsBaseUnitSlotSettings(removedUnit);
  }
  if(dpsUnitDetailOpen && dpsUnitSelectedSlot===index) dpsUnitDetailOpen=false;
  setDpsBaseUnitStoredValue(slots.filter(Boolean),false,{slots});
  return true;
}
function changeDpsBaseUnitSlot(slotIndex, unitId, options={}){
  const index=Math.max(0,Math.min(dpsBaseUnitSelectionLimit()-1,Number(slotIndex)||0));
  const slots=currentDpsBaseUnitSlots();
  const previous=slots[index];
  const requestedUnit=dpsBaseUnitById(unitId);
  const next=requestedUnit && dpsBaseUnitAllowedForCurrentPlanet(requestedUnit) ? String(unitId) : '';
  if(next){
    const duplicateIndex=slots.indexOf(next);
    if(duplicateIndex>=0 && duplicateIndex!==index) slots[duplicateIndex]='';
  }
  slots[index]=next;
  if(index===dpsUnitAutoNarudReviewSlot && next!=='prodNarud') dpsUnitAutoNarudReviewSlot=-1;
  if(previous && previous!==next && !slots.includes(previous)){
    dpsUnitExpandedCardIds.delete(previous);
    if(dpsBaseUnitHasQuantity(previous)) setDpsBaseUnitQuantity(previous,0);
  }
  if(next && previous!==next) applyDpsBaseUnitAddDefaults(next);
  if(next && dpsBaseUnitHasQuantity(next)) setDpsBaseUnitQuantity(next,Math.max(1,Number(dpsBaseUnitQuantityText(next))||1));
  setDpsBaseUnitStoredValue(slots.filter(Boolean),options.notify!==false,{slots});
}
function captureDpsBaseUnitViewState(stack){
  if(!stack) return {focus:null};
  const active=stack.contains(document.activeElement) ? document.activeElement : null;
  let focus=active?.id ? {type:'id',id:active.id,start:active.selectionStart,end:active.selectionEnd} : null;
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
  if(focus.type==='id'){
    const target=document.getElementById(focus.id);
    if(target && stack.contains(target)){
      target.focus({preventScroll:true});
      if(typeof focus.start==='number' && target.setSelectionRange) target.setSelectionRange(focus.start,focus.end);
    }
    return;
  }
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
  if(target) target.focus({preventScroll:true});
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
  const selectedIds=filterDpsBaseUnitIdsForCurrentPlanet(dpsBaseUnitSelectionIds(normalizeDpsBaseUnitsValue(input.value || '')));
  sanitizeDpsBaseUnitVoidPowerAvailability();
  const rawSlots=String(slotInput.value || '');
  let slots=filterDpsBaseUnitSlotsForCurrentPlanet(rawSlots ? normalizeDpsBaseUnitSlotValues(rawSlots) : compactDpsBaseUnitSlots(selectedIds));
  const slotIds=slots.filter(Boolean);
  const sameSelection=slotIds.length===selectedIds.length && slotIds.every((id,index)=>id===selectedIds[index]);
  if(!sameSelection) slots=reconcileDpsBaseUnitSlots(slots,selectedIds);
  writeDpsBaseUnitSelection(input,slotInput,slots);
  normalizeAllDpsBaseUnitQuantityInputs();
  const stack=$('dpsBaseUnitSlotStack');
  if(stack){
    const html=dpsBaseUnitSlotsHtml(slots);
    if(stack.innerHTML!==html) stack.innerHTML=html;
  }
  syncDpsUnitSlotModal(slots);
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

function closeDpsBaseUnitAchievementHelp(){
  const popup=$('unitAchievementHelpPopover');
  if(!popup || popup.hidden) return;
  popup.hidden=true;
  document.querySelectorAll('[data-action="toggleAchievementHelp"]').forEach(btn=>btn.setAttribute('aria-expanded','false'));
}
function positionDpsBaseUnitAchievementHelp(trigger,popup){
  if(!trigger || !popup || popup.hidden) return;
  const rect=trigger.getBoundingClientRect();
  const width=popup.offsetWidth,height=popup.offsetHeight;
  const left=Math.min(Math.max(10,rect.left+rect.width/2-width/2),Math.max(10,window.innerWidth-width-10));
  const below=rect.bottom+9;
  const top=below+height<=window.innerHeight-10
    ? below
    : rect.top-height-9>=10 ? rect.top-height-9
    : Math.min(Math.max(10,below),Math.max(10,window.innerHeight-height-10));
  popup.style.left=`${Math.round(left)}px`;
  popup.style.top=`${Math.round(top)}px`;
}
function switchDpsBaseUnitAchievementHelpTab(tab){
  const tabs=tab.closest('.unit-achievement-help-tabs');
  const popup=tab.closest('.unit-achievement-help-popover, .zero-rank-guide-view');
  if(!tabs || !popup?.contains(tabs)) return;
  tabs.querySelectorAll('[role="tab"]').forEach(button=>{
    const selected=button===tab;
    button.setAttribute('aria-selected',String(selected));
    button.tabIndex=selected?0:-1;
    const panel=$(button.getAttribute('aria-controls'));
    if(panel) panel.hidden=!selected;
  });
  // 승단 점수는 독립 모달로 이동했습니다. 달성률 가이드만 위치를 계산합니다.
  if(popup.id==='unitAchievementHelpPopover'){
    positionDpsBaseUnitAchievementHelp(document.querySelector('[data-action="toggleAchievementHelp"]'),popup);
  }
}
function bindDpsBaseUnitControlEvents(){
  if(document.documentElement.dataset.dpsBaseUnitControlBound==='1') return;
  document.documentElement.dataset.dpsBaseUnitControlBound='1';
  document.addEventListener('keydown', e=>{
    const helpTab=e.target?.closest?.('#unitAchievementHelpPopover .unit-achievement-help-tabs [role="tab"]');
    if(helpTab && ['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
      const tabs=[...helpTab.parentElement.querySelectorAll('[role="tab"]')];
      const index=tabs.indexOf(helpTab);
      const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      e.preventDefault();
      switchDpsBaseUnitAchievementHelpTab(tabs[next]);
      tabs[next].focus();
      return;
    }
    if(e.key==='Escape') closeDpsBaseUnitAchievementHelp();
    if(!dpsUnitDetailOpen) return;
    const shell=$('dpsUnitSlotModal');
    if(!shell || shell.hidden) return;
    if(e.key==='Escape'){
      e.preventDefault();
      e.stopPropagation();
      closeDpsUnitSlotModal();
    }else if(e.key==='Tab'){
      const controls=[...shell.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
      if(!controls.length) return;
      const first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey && (document.activeElement===first || !shell.contains(document.activeElement))){e.preventDefault();last.focus();}
      else if(!e.shiftKey && (document.activeElement===last || !shell.contains(document.activeElement))){e.preventDefault();first.focus();}
    }
  },true);
  window.addEventListener('resize',()=>{
    const popup=$('unitAchievementHelpPopover');
    if(popup && !popup.hidden) positionDpsBaseUnitAchievementHelp(document.querySelector('[data-action="toggleAchievementHelp"]'),popup);
  });
  document.addEventListener('click', e=>{
    const helpTab=e.target?.closest?.('#unitAchievementHelpPopover .unit-achievement-help-tabs [role="tab"]');
    if(helpTab){
      e.preventDefault();
      switchDpsBaseUnitAchievementHelpTab(helpTab);
      return;
    }
    const helpTrigger=e.target?.closest?.('[data-action="toggleAchievementHelp"]');
    const helpPopover=$('unitAchievementHelpPopover');
    if(helpTrigger){
      e.preventDefault();
      if(helpPopover){
        const wasOpen=!helpPopover.hidden;
        closeDpsBaseUnitAchievementHelp();
        if(!wasOpen){
          helpPopover.hidden=false;
          helpTrigger.setAttribute('aria-expanded','true');
          positionDpsBaseUnitAchievementHelp(helpTrigger,helpPopover);
        }
      }
      return;
    }
    if(helpPopover && !helpPopover.hidden && !helpPopover.contains(e.target)) closeDpsBaseUnitAchievementHelp();
    const cancelSlotRemoval=e.target?.closest?.('[data-unit-slot-remove-cancel]');
    if(cancelSlotRemoval?.closest?.('#dpsUnitSlotRemoveDialog')){
      e.preventDefault();
      closeDpsUnitSlotRemoveDialog();
      return;
    }
    const confirmSlotRemoval=e.target?.closest?.('[data-unit-slot-remove-confirm]');
    if(confirmSlotRemoval?.closest?.('#dpsUnitSlotRemoveDialog')){
      e.preventDefault();
      const pending=dpsUnitSlotPendingRemove;
      closeDpsUnitSlotRemoveDialog();
      // Stale dialog safety: never delete a different unit if the slot changed meanwhile.
      if(pending && currentDpsBaseUnitSlots()[pending.index]===pending.unitId
        && removeDpsBaseUnitSlot(pending.index,{confirmed:true})) commitAppUpdate();
      return;
    }
    const addSlot=e.target?.closest?.('[data-unit-slot-add]');
    if(addSlot?.closest?.('#dpsBaseUnitSlotStack')){
      e.preventDefault();
      const currentSlots=currentDpsBaseUnitSlots();
      const current=dpsUnitVisibleCount(currentSlots);
      const requested=Number(addSlot.dataset.unitSlotAdd);
      if(requested===current && current<10 && !dpsUnitSlotPending){
        beginDpsUnitSlotAddition(current);
      }
      return;
    }
    const removeButton=e.target?.closest?.('[data-unit-list-remove]');
    if(removeButton?.closest?.('#dpsBaseUnitSlotStack')){
      e.preventDefault();
      if(removeDpsBaseUnitSlot(removeButton.getAttribute('data-unit-list-remove'))) commitAppUpdate();
      return;
    }
    const expansionToggle=e.target?.closest?.('[data-unit-slot-expansion-toggle]');
    if(expansionToggle?.closest?.('#dpsBaseUnitSlotStack')){
      e.preventDefault();
      const unitId=expansionToggle.getAttribute('data-unit-slot-expansion-toggle');
      if(dpsUnitExpandedCardIds.has(unitId)) dpsUnitExpandedCardIds.delete(unitId);
      else dpsUnitExpandedCardIds.add(unitId);
      syncDpsBaseUnitControl({skipJewelConfig:true});
      $('dpsBaseUnitSlotStack')?.querySelector(`[data-unit-slot-expansion-toggle="${unitId}"]`)?.focus({preventScroll:true});
      return;
    }
    const unitRow=e.target?.closest?.('[data-unit-list-select]');
    if(unitRow?.closest?.('[data-dps-base-unit-control]')){
      e.preventDefault();
      const index=Number(unitRow.dataset.unitListSelect)||0;
      dpsUnitSelectedSlot=index;
      dpsUnitDetailOpen=true;
      syncDpsBaseUnitControl({skipJewelConfig:true});
      $('unitSlotModalClose')?.focus({preventScroll:true});
      return;
    }
    const confirmDetail=e.target?.closest?.('[data-unit-detail-confirm]');
    if(confirmDetail?.closest?.('#dpsUnitSlotModal')){
      e.preventDefault();
      confirmDpsUnitSlotModal();
      return;
    }
    const removeDetail=e.target?.closest?.('[data-unit-detail-remove]');
    if(removeDetail?.closest?.('#dpsUnitSlotModal')){
      e.preventDefault();
      if(dpsUnitSlotPending){
        restorePendingDpsUnitSlot();
        dpsUnitDetailOpen=false;
        syncDpsBaseUnitControl({skipJewelConfig:true});
        requestAppUpdate({save:false});
      }else if(removeDpsBaseUnitSlot(dpsUnitSelectedSlot,{keepSlot:true})) commitAppUpdate();
      return;
    }
    const closeDetail=e.target?.closest?.('[data-unit-detail-close],[data-unit-detail-backdrop]');
    if(closeDetail?.closest?.('#dpsUnitSlotModal')){
      e.preventDefault();
      closeDpsUnitSlotModal();
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
      const unitId=voidToggle.getAttribute('data-dps-base-unit-void-power-toggle') || '';
      const state=toggleDpsBaseUnitVoidPower(unitId);
      if(state==='ON'){
        const slots=currentDpsBaseUnitSlots();
        const index=slots.indexOf(unitId);
        if(!slots.includes('prodNarud') && index>=0){
          if(index===slots.length-1) showToast('공허의 힘은 저장됐지만 마지막 슬롯 뒤에는 나루드를 추가할 수 없습니다.','warn');
          else if(slots[index+1]) showToast('공허의 힘은 저장됐습니다. 다음 슬롯이 사용 중이므로 나루드를 자동 추가하지 않았습니다.','warn');
          else showToast('공허의 힘은 저장됐습니다. 현재 설정에서는 나루드를 자동 추가할 수 없습니다.','warn');
        }
      }
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
      dpsUnitSelectedSlot=Number(select.getAttribute('data-dps-base-unit-slot'))||0;
      changeDpsBaseUnitSlot(dpsUnitSelectedSlot,select.value,{notify:false});
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

/* 통합 헤더 하위 탭: 원래 DOM을 유지하여 계산·저장 필드 재생성을 방지 */
function activateIntegratedTab(group,index){
  const tabs=[...qsa(`[data-integrated-tab="${group}"]`)];
  const panels=qsa(`[data-integrated-panel="${group}"]`);
  if(!tabs.some(button=>button.dataset.integratedIndex===String(index))) return;
  tabs.forEach(button=>{
    const active=button.dataset.integratedIndex===String(index);
    button.classList.toggle('is-active',active);
    button.setAttribute('aria-selected',String(active));
    button.tabIndex=active?0:-1;
  });
  panels.forEach(panel=>{
    const active=panel.dataset.integratedIndex===String(index);
    panel.classList.toggle('is-active',active);
    panel.hidden=!active;
  });
  if(group==='unitDetails' && index===1) renderDpsJewelConfigGrids();
}
function bindIntegratedTabEvents(){
  let basicModalReturnFocus=null;
  function closeBasicSettingsModal(){
    const overlay=$('basicSettingsModalOverlay');
    if(!overlay || overlay.hidden) return;
    overlay.hidden=true;
    document.body.classList.remove('basic-settings-modal-open');
    if(basicModalReturnFocus?.isConnected) basicModalReturnFocus.focus({preventScroll:true});
    basicModalReturnFocus=null;
  }
  function selectBasicSettingsModalTab(type,focusTab=false){
    if(type!=='bus' && type!=='sanctuary') return;
    const items=[['bus','basicSettingsModalBus','basicSettingsModalBusTab'],['sanctuary','basicSettingsModalSanctuary','basicSettingsModalSanctuaryTab']];
    items.forEach(([key,viewId,tabId])=>{
      const active=key===type;
      $(viewId).hidden=!active;
      const tab=$(tabId);
      tab.classList.toggle('is-active',active);
      tab.setAttribute('aria-selected',String(active));
      tab.tabIndex=active?0:-1;
      if(active && focusTab) tab.focus({preventScroll:true});
    });
  }
  function openBasicSettingsModal(type,trigger){
    if(type!=='bus' && type!=='sanctuary') return;
    const overlay=$('basicSettingsModalOverlay');
    const dialog=$('basicSettingsModal');
    if(!overlay || !dialog) return;
    basicModalReturnFocus=trigger;
    selectBasicSettingsModalTab(type);
    overlay.hidden=false;
    document.body.classList.add('basic-settings-modal-open');
    dialog.focus({preventScroll:true});
  }
  document.addEventListener('click',event=>{
    const trigger=event.target.closest?.('[data-basic-modal-open]');
    if(trigger){openBasicSettingsModal(trigger.dataset.basicModalOpen,trigger);return;}
    const modalTab=event.target.closest?.('[data-basic-modal-tab]');
    if(modalTab){selectBasicSettingsModalTab(modalTab.dataset.basicModalTab);return;}
    if(event.target.id==='basicSettingsModalOverlay' || event.target.closest?.('[data-basic-modal-close]')) closeBasicSettingsModal();
  });
  document.addEventListener('keydown',event=>{
    const overlay=$('basicSettingsModalOverlay');
    if(!overlay || overlay.hidden) return;
    if(event.key==='Escape'){event.preventDefault();closeBasicSettingsModal();return;}
    const modalTab=event.target.closest?.('[data-basic-modal-tab]');
    if(modalTab && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();
      const next=event.key==='Home'?'bus':event.key==='End'?'sanctuary':(modalTab.dataset.basicModalTab==='bus'?'sanctuary':'bus');
      selectBasicSettingsModalTab(next,true);
      return;
    }
    if(event.key!=='Tab') return;
    const dialog=$('basicSettingsModal');
    const focusables=[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>!el.closest('[hidden]') && el.getClientRects().length);
    if(!focusables.length){event.preventDefault();dialog.focus();return;}
    const first=focusables[0],last=focusables[focusables.length-1];
    if(event.shiftKey && (document.activeElement===first || document.activeElement===dialog)){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    else if(!dialog.contains(document.activeElement)){event.preventDefault();first.focus();}
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-integrated-tab]');
    if(!button) return;
    activateIntegratedTab(button.dataset.integratedTab,Number(button.dataset.integratedIndex));
  });
  document.addEventListener('keydown',event=>{
    const button=event.target.closest?.('[data-integrated-tab]');
    if(!button || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const group=button.dataset.integratedTab;
    const tabs=[...qsa(`[data-integrated-tab="${group}"]`)];
    const current=tabs.indexOf(button);
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    event.preventDefault();
    activateIntegratedTab(group,Number(tabs[next].dataset.integratedIndex));
    tabs[next].focus({preventScroll:true});
  });
  // Each jewel disclosure retains its controls and data when folded.
  document.addEventListener('click',event=>{
    const toggle=event.target.closest?.('[data-dps-jewel-toggle]');
    if(!toggle) return;
    const card=toggle.closest('[data-dps-jewel-card]');
    const wasOpen=card?.classList.contains('is-expanded');
    qsa('#dpsJewelConfigGrid [data-dps-jewel-card]').forEach(item=>{
      item.classList.remove('is-expanded');
      item.querySelector('[data-dps-jewel-toggle]')?.setAttribute('aria-expanded','false');
      const content=item.querySelector('.dps-jewel-card-detail');
      if(content) content.hidden=true;
    });
    if(card && !wasOpen){
      card.classList.add('is-expanded');
      toggle.setAttribute('aria-expanded','true');
      const content=card.querySelector('.dps-jewel-card-detail');
      if(content) content.hidden=false;
    }
  });
}

/* 스펙·유닛 보드 전환 및 상태 이벤트 */
let activeDamageBoardMode='spec';
function setDamageBoardTab(active){
  const next=['unit','table'].includes(active) ? active : 'spec';
  const changed=next!=='table' && activeDamageBoardMode!==next;
  if(next!=='table') activeDamageBoardMode=next;
  qsa('[data-damage-board-tab]').forEach(tab=>{
    const isActive=tab.dataset.damageBoardTab===next;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex=isActive ? 0 : -1;
  });
  qsa('[data-damage-board-panel]').forEach(panel=>{
    const isActive=panel.dataset.damageBoardPanel===next;
    panel.classList.toggle('is-active', isActive);
    panel.hidden=!isActive;
  });
  if(next==='table') renderDpsTablePanelContent();
  if(changed) renderTraitRecommendations();
}
/* 분석 보드: Document PiP는 원본을 미러링하고, 독립 창은 앱을 자체 실행한다. */
let analysisPipWindow=null;
const analysisWindowRecords=new Set();
let analysisWindowObserver=null;
let analysisPipLayoutObserver=null;
let analysisWindowRenderFrame=0;
let analysisPipOpening=false;
let analysisIndependentOpened=false;
function analysisPipAllowed(){
  return document.body.classList.contains('is-pc-landscape')
    && !document.body.classList.contains('is-tabbed')
    && window.matchMedia('(orientation:landscape) and (hover:hover) and (pointer:fine)').matches;
}
function setAnalysisPipButtonState(open){
  const button=$('analysisPipToggle');
  if(button) button.dataset.pipOpen=String(open);
  const action=$('analysisPipMenuPip');
  if(action) action.textContent=open?'PiP 닫기':'PiP 열기';
}
function setAnalysisPipMenuOpen(open,restoreFocus=false){
  const menu=$('analysisPipMenu');
  const button=$('analysisPipToggle');
  if(!menu || !button) return;
  const next=!!open && analysisPipAllowed();
  menu.hidden=!next;
  button.setAttribute('aria-expanded',String(next));
  button.setAttribute('aria-label',next?'DPS 분석 보드 창 메뉴 닫기':'DPS 분석 보드 창 메뉴 열기');
  if(next){
    const rect=button.getBoundingClientRect();
    const width=menu.offsetWidth;
    const height=menu.offsetHeight;
    menu.style.left=Math.max(8,Math.min(rect.right-width,window.innerWidth-width-8))+'px';
    menu.style.top=Math.max(8,rect.bottom+5+height<=window.innerHeight ? rect.bottom+5 : rect.top-height-5)+'px';
    menu.querySelector('button')?.focus();
  }else if(restoreFocus) button.focus();
}
function closeAnalysisPip(){
  const pip=analysisPipWindow;
  if(!pip) return;
  cleanupAnalysisWindow(pip);
  if(!pip.closed) pip.close();
}
function analysisPipSourcePath(source,root){
  const indices=[];
  for(let node=source;node && node!==root;node=node.parentElement){
    if(!node.parentElement) return '';
    indices.unshift([...node.parentElement.children].indexOf(node));
  }
  return indices.join('.');
}
function analysisPipSourceAtPath(path,root){
  if(path==null || path==='') return null;
  return path.split('.').reduce((node,index)=>node?.children[Number(index)],root);
}
function renderAnalysisWindow(win){
  if(win.closed) return;
  const original=qs('.right-analytics-workspace');
  const host=win.document.getElementById('dpsPipView');
  if(!original || !host) return;
  const previous=host.querySelector('.right-analytics-workspace');
  const active=win.document.activeElement?.closest?.('[data-pip-source-path]');
  const focusPath=active?.dataset.pipSourcePath;
  const selection=active && 'selectionStart' in active ? {start:active.selectionStart,end:active.selectionEnd}:null;
  const scrollTop=win.document.scrollingElement?.scrollTop || 0;
  const innerScrolls=new Map();
  previous?.querySelectorAll('[data-pip-scroll]').forEach(element=>innerScrolls.set(element.dataset.pipScroll,[element.scrollTop,element.scrollLeft]));
  const clone=original.cloneNode(true);
  clone.querySelectorAll('button,input,select,textarea,[role="button"]').forEach(element=>{
    const path=analysisPipSourcePath(element,clone);
    if(path) element.dataset.pipSourcePath=path;
  });
  clone.querySelectorAll('button.app-select-trigger').forEach(button=>button.remove());
  clone.querySelectorAll('select.app-select-native-source').forEach(select=>{
    select.classList.remove('app-select-native-source');
    select.removeAttribute('aria-hidden');
    select.removeAttribute('tabindex');
  });
  clone.querySelectorAll('select,input,textarea').forEach(control=>{
    const source=analysisPipSourceAtPath(control.dataset.pipSourcePath,original);
    if(!source) return;
    if(control.type==='checkbox'||control.type==='radio') control.checked=source.checked;
    else control.value=source.value;
  });
  const closeButton=clone.querySelector('#analysisPipToggle');
  if(closeButton){
    closeButton.textContent='×';
    closeButton.setAttribute('aria-label','이 분석 보드 창 닫기');
    closeButton.removeAttribute('aria-haspopup');
    closeButton.removeAttribute('aria-controls');
    closeButton.removeAttribute('aria-expanded');
    delete closeButton.dataset.pipOpen;
    closeButton.dataset.analysisWindowClose='true';
  }
  clone.querySelectorAll('.dps-overview,.dps-base-unit-slot-stack,.dps-jewel-config-grid').forEach((element,index)=>{element.dataset.pipScroll=String(index);});
  host.replaceChildren(clone);
  clone.querySelectorAll('[data-pip-scroll]').forEach(element=>{
    const scroll=innerScrolls.get(element.dataset.pipScroll);
    if(scroll){element.scrollTop=scroll[0];element.scrollLeft=scroll[1];}
  });
  win.document.documentElement.style.setProperty('--app-font-scale',getComputedStyle(document.documentElement).getPropertyValue('--app-font-scale'));
  if(win.document.scrollingElement) win.document.scrollingElement.scrollTop=scrollTop;
  if(focusPath){
    const current=[...clone.querySelectorAll('[data-pip-source-path]')].find(element=>element.dataset.pipSourcePath===focusPath);
    current?.focus({preventScroll:true});
    if(current && selection && typeof current.setSelectionRange==='function'){
      try{current.setSelectionRange(selection.start,selection.end);}catch{}
    }
  }
}
function scheduleAnalysisWindowRender(){
  if(!analysisWindowRecords.size || analysisWindowRenderFrame) return;
  analysisWindowRenderFrame=requestAnimationFrame(()=>{
    analysisWindowRenderFrame=0;
    for(const win of analysisWindowRecords){
      if(win.closed) cleanupAnalysisWindow(win);
      else renderAnalysisWindow(win);
    }
  });
}
function cleanupAnalysisWindow(win){
  if(!analysisWindowRecords.delete(win) && analysisPipWindow!==win) return;
  if(analysisPipWindow===win){
    analysisPipWindow=null;
    analysisPipLayoutObserver?.disconnect();
    analysisPipLayoutObserver=null;
    setAnalysisPipButtonState(false);
  }
  if(!analysisWindowRecords.size){
    analysisWindowObserver?.disconnect();
    analysisWindowObserver=null;
    if(analysisWindowRenderFrame) cancelAnimationFrame(analysisWindowRenderFrame);
    analysisWindowRenderFrame=0;
  }
}
function initializeAnalysisWindow(win){
  const source=qs('.right-analytics-workspace');
  if(!source) throw new Error('DPS 분석 보드를 찾을 수 없습니다.');
  win.document.title='DPS 분석 보드 · PiP';
  win.document.documentElement.lang='ko';
  win.document.body.className='dps-pip-body';
  document.head.querySelectorAll('style,link[rel="stylesheet"]').forEach(sheet=>{
    const copy=sheet.cloneNode(true);
    if(copy.tagName==='LINK') copy.href=sheet.href;
    win.document.head.appendChild(copy);
  });
  const host=win.document.createElement('main');
  host.id='dpsPipView';
  host.className='dps-pip-view col-right';
  win.document.body.appendChild(host);
  win.document.addEventListener('click',event=>{
    const control=event.target.closest('button,[role="button"]');
    if(!control) return;
    event.preventDefault();
    if(control.dataset.analysisWindowClose==='true'){
      win.close();
      return;
    }
    const original=analysisPipSourceAtPath(control.dataset.pipSourcePath,source);
    if(original && !original.disabled){
      original.click();
      if($('dpsUnitSlotModal') && !$('dpsUnitSlotModal').hidden) window.focus();
    }
    scheduleAnalysisWindowRender();
  });
  win.document.addEventListener('change',event=>{
    const control=event.target.closest('select,input,textarea');
    const original=analysisPipSourceAtPath(control?.dataset.pipSourcePath,source);
    if(!original || original.disabled) return;
    if(control.type==='checkbox'||control.type==='radio') original.checked=control.checked;
    else original.value=control.value;
    original.dispatchEvent(new Event('change',{bubbles:true}));
    scheduleAnalysisWindowRender();
  });
  win.document.addEventListener('input',event=>{
    const control=event.target.closest('input,textarea');
    const original=analysisPipSourceAtPath(control?.dataset.pipSourcePath,source);
    if(!original || original.disabled) return;
    original.value=control.value;
    original.dispatchEvent(new Event('input',{bubbles:true}));
    scheduleAnalysisWindowRender();
  });
  win.addEventListener('pagehide',()=>cleanupAnalysisWindow(win),{once:true});
  analysisWindowRecords.add(win);
  if(!analysisWindowObserver){
    analysisWindowObserver=new MutationObserver(scheduleAnalysisWindowRender);
    analysisWindowObserver.observe(source,{subtree:true,childList:true,characterData:true,attributes:true});
  }
  renderAnalysisWindow(win);
}
async function toggleAnalysisPip(){
  if(analysisPipWindow && !analysisPipWindow.closed){closeAnalysisPip();return;}
  if(!analysisPipAllowed() || analysisPipOpening) return;
  if(!window.isSecureContext || !window.documentPictureInPicture?.requestWindow){
    showToast('PiP는 HTTPS 환경의 지원 브라우저(Chrome·Edge)에서 사용할 수 있습니다.','warn');
    return;
  }
  analysisPipOpening=true;
  try{
    // 사용자 클릭 활성화가 유효할 때 Document PiP 창부터 생성한다.
    const pip=await window.documentPictureInPicture.requestWindow({width:760,height:690});
    analysisPipWindow=pip;
    initializeAnalysisWindow(pip);
    analysisPipLayoutObserver=new MutationObserver(()=>{
      if(!analysisPipAllowed()) closeAnalysisPip();
    });
    analysisPipLayoutObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
    if(!analysisPipAllowed()){closeAnalysisPip();return;}
    setAnalysisPipButtonState(true);
  }catch(error){
    if(analysisPipWindow) closeAnalysisPip();
    rememberAppIssue('warn','분석 보드 PiP 열기',error);
    showToast('PiP 창을 열지 못했습니다. 브라우저 지원 및 팝업 권한을 확인해 주세요.','warn');
  }finally{
    analysisPipOpening=false;
  }
}
function openIndependentAnalysisWindow(){
  if(!analysisPipAllowed()) return;
  analysisIndependentOpened=true;
  // 기존 입력값을 먼저 저장해, 완전히 별도로 실행되는 새 창도 같은 상태로 시작한다.
  saveState({silent:true});
  const url=new URL(window.location.href);
  url.searchParams.set('dpsWindow','independent');
  url.searchParams.delete('fresh');
  url.searchParams.delete('__dps_check');
  // noopener는 원본 창이 닫혀도 창이 유지되도록 연결 관계를 끊는다.
  // 브라우저 표준에 따라 noopener를 쓰면 window.open은 창을 열어도 null을 반환한다.
  window.open(url.href,'_blank','noopener,popup=yes,width=820,height=740,resizable=yes,scrollbars=yes');
}
function bindAnalysisPipButton(){
  const button=$('analysisPipToggle');
  if(window.DPS_INDEPENDENT_WINDOW && button){
    document.title='DPS 분석 보드 · 독립 창';
    button.textContent='×';
    button.setAttribute('aria-label','독립 창 닫기');
    button.removeAttribute('aria-haspopup');
    button.removeAttribute('aria-controls');
    button.removeAttribute('aria-expanded');
    button.addEventListener('click',()=>window.close());
  }else{
    button?.addEventListener('click',()=>setAnalysisPipMenuOpen($('analysisPipMenu')?.hidden));
  }
  $('analysisPipMenu')?.addEventListener('click',event=>{
    const action=event.target.closest('[data-analysis-window-action]');
    if(!action) return;
    setAnalysisPipMenuOpen(false);
    if(action.dataset.analysisWindowAction==='pip') toggleAnalysisPip();
    else if(action.dataset.analysisWindowAction==='independent') openIndependentAnalysisWindow();
  });
  document.addEventListener('click',event=>{
    if($('analysisPipMenu')?.hidden!==false) return;
    if(event.target.closest('#analysisPipMenu,#analysisPipToggle')) return;
    setAnalysisPipMenuOpen(false);
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape' || $('analysisPipMenu')?.hidden!==false) return;
    event.preventDefault();
    setAnalysisPipMenuOpen(false,true);
  });
  window.addEventListener('resize',()=>setAnalysisPipMenuOpen(false));
  window.addEventListener('scroll',()=>setAnalysisPipMenuOpen(false),true);
  // 서로 다른 독립 창은 localStorage를 통해 상태를 공유한다. 수신 시 재저장은 하지 않는다.
  window.addEventListener('storage',event=>{
    if((!window.DPS_INDEPENDENT_WINDOW && !analysisIndependentOpened) || event.key!==STORAGE_KEY || !event.newValue || !window.__dpsAppReady) return;
    try{
      const state=normalizeSavedState(safeJsonParse(event.newValue));
      if(!state) return;
      cancelScheduledAutoSave();
      if(appUpdateTimer) clearTimeout(appUpdateTimer);
      appUpdateTimer=0;
      pendingAppUpdateSave=false;
      applyStateObject(state,{save:false});
      syncSelectButtons();
      syncBuffChoiceButtons();
    }catch(error){
      rememberAppIssue('warn','독립 창 상태 동기화',error);
    }
  });
  window.addEventListener('pagehide',()=>{
    for(const win of analysisWindowRecords){
      cleanupAnalysisWindow(win);
      if(!win.closed) win.close();
    }
  });
}
function bindDamageBoardTabEvents(){
  document.addEventListener('click',e=>{
    const tab=e.target?.closest?.('[data-damage-board-tab]');
    if(!tab || tab.disabled) return;
    e.preventDefault();
    if(tab.dataset.damageBoardTab==='table') openDpsTable();
    else setDamageBoardTab(tab.dataset.damageBoardTab);
  },true);
  document.addEventListener('keydown',event=>{
    const tab=event.target.closest?.('[data-damage-board-tab]');
    if(!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const tabs=[...tab.parentElement.querySelectorAll('[data-damage-board-tab]')];
    const current=tabs.indexOf(tab);
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    event.preventDefault();
    if(tabs[next].dataset.damageBoardTab==='table') openDpsTable();
    else setDamageBoardTab(tabs[next].dataset.damageBoardTab);
    tabs[next].focus({preventScroll:true});
  });
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
    if(artifactToggle.disabled || planetExplorationRestrictionsActive()) return;
    setArtifactDpsViewEnabled(!isArtifactDpsViewEnabled());
    requestAppUpdate();
  }, true);
}
/* 특성 보드: 목록·수동 투자·추천·최적화 */
const INFINITE_TRAIT_TIER='무한∞';
const TIERS=['루키','비기너','아마추어','프로','엑스퍼트','마스터','디바인','더원1','더원2',INFINITE_TRAIT_TIER,'EP특성','RP특성','심연특성'];
const OPTIMIZATION_TIERS=TIERS;
// 펼침 여부는 화면 상태로만 관리하며 프리셋 데이터에는 저장하지 않는다.
const expandedTraitTiers=new Set();
// 입력 요소를 DOM에 그대로 둔 채 높이만 애니메이션으로 전환한다.
function setAccordionContentExpanded(content,expanded){
  if(!content) return;
  const oldAnimation=content.getAnimations?.().find(animation=>animation.id==='dpsAccordion');
  oldAnimation?.cancel();
  const wasOpen=!content.hidden;
  const fromHeight=wasOpen ? content.getBoundingClientRect().height : 0;
  if(expanded) content.hidden=false;
  content.inert=!expanded;
  content.setAttribute('aria-hidden',String(!expanded));
  if(fromHeight===0 && !expanded){content.hidden=true;return;}
  const toHeight=expanded ? content.scrollHeight : 0;
  if(Math.abs(fromHeight-toHeight)<1 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !content.animate){
    content.hidden=!expanded;
    return;
  }
  const animation=content.animate([{height:`${fromHeight}px`,opacity:expanded?0:1},{height:`${toHeight}px`,opacity:expanded?1:0}],{duration:250,easing:'cubic-bezier(.22,1,.36,1)'});
  animation.id='dpsAccordion';
  animation.onfinish=()=>{if(!expanded) content.hidden=true;};
}
function setTraitTierExpanded(tier,expanded){
  if(!TIERS.includes(tier)) return;
  if(expanded) [...expandedTraitTiers].filter(open=>open!==tier).forEach(open=>setTraitTierExpanded(open,false));
  if(expanded) expandedTraitTiers.add(tier);
  else expandedTraitTiers.delete(tier);
  const panel=Array.from(qsa('.trait-tier-panel[data-tier]')).find(el=>el.dataset.tier===tier);
  if(!panel) return;
  const toggle=panel.querySelector('.trait-tier-toggle');
  const list=panel.querySelector('.trait-invest-list');
  panel.classList.toggle('is-expanded',expanded);
  if(toggle) toggle.setAttribute('aria-expanded',String(expanded));
  setAccordionContentExpanded(list,expanded);
}
function updateTraits(){
  const body=$('traitBody');
  if(!body) return;
  body.innerHTML=TIERS.map((tier,tierIndex)=>{
    const tierTraits=TRAITS.filter(t=>t[2]===tier && t[0]!==116);
    const rows=tierTraits.map((t,index)=>{
      const [row,name,,type,rate]=t;
      const n=INV[row]||0, mx=TMAX[row]||999;
      const isMax=n>=mx;
      const cost=nextCost(row);
      // 어비스 난이도의 특성별 계수는 기존 DPS 계산과 동일하게 표시한다.
      const currentRate=isAbyssDifficulty() ? ({133:15,134:7.5,135:1.5,136:3}[row] ?? rate) : rate;
      const rStr=row===58?'강화수 +1':row===96?'2단 강화 +0.5':traitEffectText(row,type,currentRate);
      return `<article class="tr trait-invest-card${isMax?' is-mastered':''}" data-trait-id="${row}">
        <div class="trait-invest-main">
          <span class="trait-invest-index" aria-hidden="true">${String(index+1).padStart(2,'0')}</span>
          <div class="trait-row-detail">
            <div class="trait-invest-topline"><div class="tr-name">${escapeHtml(name)}</div><div class="tr-type"><span class="trait-effect-text">${escapeHtml(rStr)}</span><span class="trait-cost-chip ${isMax?'is-complete':''}">${isMax?'✓ 마스터 완료':`다음 투자 · ${fullNumber(cost)}`}</span></div></div>
          </div>
        </div>
        <div class="tr-ctrl" aria-label="${escapeHtml(name)} 투자 조절">
          <button type="button" class="ui-step-btn" data-action="traitAdjust" data-row="${row}" data-delta="-1" ${n<=0?'disabled':''} aria-label="${escapeHtml(name)} 1 환불">−</button>
          <div class="trait-value-pair">
            <input class="tv-input" type="text" inputmode="numeric" value="${n}" data-row="${row}" aria-label="${escapeHtml(name)} 현재 투자">
            <span class="trait-max-sep">/</span><span class="trait-max-val">${mx}</span>
          </div>
          <button type="button" class="ui-step-btn" data-action="traitAdjust" data-row="${row}" data-delta="1" ${isMax?'disabled':''} aria-label="${escapeHtml(name)} 1 투자">+</button>
          <button type="button" class="ui-action-btn trait-master-btn" data-action="traitMax" data-row="${row}" ${isMax?'disabled':''}>마스터</button>
        </div>
      </article>`;
    }).join('');
    const isExpanded=expandedTraitTiers.has(tier);
    return `<section class="trait-group trait-tier-panel${isExpanded?' is-expanded':''}" data-tier-index="${tierIndex+1}" data-tier="${tier}">
      <h4><button type="button" class="trait-tier-toggle" data-action="toggleTraitTier" data-tier="${tier}" aria-expanded="${isExpanded}" aria-controls="traitTierContent${tierIndex+1}"><span class="trait-title"><span class="trait-tier-index" aria-hidden="true">${String(tierIndex+1).padStart(2,'0')}</span><span class="trait-tier-name">${tier}</span></span></button><span class="trait-tools"><button type="button" class="ui-action-btn mini-btn master" data-action="masterTier" data-tier="${tier}">구간 마스터</button><button type="button" class="ui-action-btn mini-btn reset danger" data-action="resetTier" data-tier="${tier}">초기화</button></span></h4>
      <div class="trait-invest-list" id="traitTierContent${tierIndex+1}" ${isExpanded?'':'hidden'}>${rows}</div>
    </section>`;
  }).join('');
}
/* 특성 추천: 가상 투자 계획을 단계별로 계산하여 화면 스크롤을 유지 */
let traitRecommendationTimer=0;
let traitRecommendationRevision=0;
const traitRecommendationCache=new Map();
let traitRecommendationActiveKey='';
let selectedTraitRecommendationRow=null;
let traitRecommendationSelectionTimer=0;
let traitRecommendationSelectionAt=0;
function clearTraitRecommendationSelection(){
  if(traitRecommendationSelectionTimer) clearTimeout(traitRecommendationSelectionTimer);
  traitRecommendationSelectionTimer=0;
  selectedTraitRecommendationRow?.classList.remove('is-selected');
  selectedTraitRecommendationRow?.setAttribute('aria-pressed','false');
  selectedTraitRecommendationRow=null;
  traitRecommendationSelectionAt=0;
}
function activateTraitRecommendationRow(row){
  if(!row?.isConnected || !row.matches('.trait-recommendation-row')) return false;
  const now=Date.now();
  const shouldInvest=selectedTraitRecommendationRow===row && now-traitRecommendationSelectionAt<=650;
  clearTraitRecommendationSelection();
  if(shouldInvest) return applyTraitRecommendation(+row.dataset.row,+row.dataset.amount);
  selectedTraitRecommendationRow=row;
  traitRecommendationSelectionAt=now;
  row.classList.add('is-selected');
  row.setAttribute('aria-pressed','true');
  traitRecommendationSelectionTimer=setTimeout(clearTraitRecommendationSelection,650);
  return true;
}
function cancelTraitRecommendationCalculation(){
  if(traitRecommendationTimer) clearTimeout(traitRecommendationTimer);
  traitRecommendationTimer=0;
}
function scheduleTraitRecommendationCalculation(step){
  // Short cooperative batches avoid the per-candidate delay without blocking page scrolling.
  traitRecommendationTimer=setTimeout(step,0);
}
function isUnitBoardRecommendationMode(){
  return $('damageBoardUnitTab')?.getAttribute('aria-selected')==='true';
}
function traitRecommendationNumberText(value,decimals=0){
  return Math.abs(Number(value))>=10000
    ? dpsBaseUnitNumberText(value,{trillion:true,compactTenThousands:true})
    : (decimals ? fmt(value,decimals) : fullNumber(value));
}
function renderTraitRecommendations(){
  const table=$('traitRecommendationRows');
  if(!table) return;
  const useUnitBoard=isUnitBoardRecommendationMode();
  const snapshot=traitRecommendationPlanSnapshot(useUnitBoard);
  const key=JSON.stringify(snapshot);
  if(key===traitRecommendationActiveKey) return;
  traitRecommendationActiveKey=key;
  clearTraitRecommendationSelection();
  setText('traitRecommendationDpsLabel',useUnitBoard ? '클리어 기대값' : 'DPS');
  const revision=++traitRecommendationRevision;
  cancelTraitRecommendationCalculation();
  const cached=traitRecommendationCache.get(useUnitBoard);
  if(cached?.key===key){
    table.innerHTML=cached.rows;
    return;
  }
  function cacheResult(){
    traitRecommendationCache.set(useUnitBoard,{key,rows:table.innerHTML});
  }
  const remaining=snapshot.remaining;
  if(!Object.values(remaining).some(value=>value>0)){
    table.innerHTML='<tr><td colspan="4">추천에 사용할 잔여 재화가 없습니다.</td></tr>';
    return;
  }
  const initial=traitRecommendationStats(useUnitBoard);
  if(useUnitBoard && !initial.dpsBaseUnit?.isActive){
    table.innerHTML='<tr><td colspan="4">유닛 보드에서 유닛을 먼저 선택해 주세요.</td></tr>';
    return;
  }
  table.innerHTML='<tr><td colspan="4">여러 특성의 투자 수량과 효율을 계산하는 중입니다.</td></tr>';
  const kinds=['SP','EP','RP','SOUL'];
  const targets=Object.fromEntries(kinds.map(kind=>[kind,TRAITS.filter(t=>t[0]!==116 && traitOptimizationResourceInfo(t[0])?.kind===kind && traitRecommendationAllowsTrait(t))]));
  const allocations=new Map();
  const spent={SP:0,EP:0,RP:0,SOUL:0};
  const steps=Object.create(null);
  const MAX_PASSES_PER_RESOURCE=32;
  const candidateScores=Object.fromEntries(kinds.map(kind=>[kind,new Map()]));
  let kindIndex=0,pass=0,cursor=0,best=null,base=null,allowance=0,available=0,passStarted=false;
  let passTargets=[],scanningAll=false,forceFullScan=false;
  function advanceResource(){kindIndex++;pass=0;passStarted=false;}
  function beginPass(){
    while(kindIndex<kinds.length){
      const kind=kinds[kindIndex];
      available=Math.max(0,remaining[kind]-spent[kind]);
      if(available<=0 || !targets[kind].length || pass>=MAX_PASSES_PER_RESOURCE){advanceResource();continue;}
      // 먼저 일부 재화만 투자하여 단계별 효율 역전 가능성을 평가한다.
      allowance=pass<4 ? Math.max(1,Math.floor(available*.30)) : pass<8 ? Math.max(1,Math.floor(available*.50)) : available;
      // 효율 상위 후보를 빠르게 재평가하고 주기적으로 전체 대상을 다시 훑는다.
      scanningAll=forceFullScan || pass===0 || pass%5===0;
      passTargets=scanningAll ? targets[kind] : targets[kind].slice().sort((a,b)=>(candidateScores[kind].get(b[0])||0)-(candidateScores[kind].get(a[0])||0)).slice(0,Math.min(10,targets[kind].length));
      base=withTemporaryTraitInvestments([...allocations],()=>traitRecommendationStats(useUnitBoard));
      best=null;
      cursor=0;
      passStarted=true;
      return true;
    }
    return false;
  }
  function finalize(){
    if(revision!==traitRecommendationRevision) return;
    if(!traitRecommendationPlanMatches(snapshot)){
      table.innerHTML='<tr><td colspan="4">현재 입력 기준으로 다시 계산해 주세요.</td></tr>';
      return;
    }
    const changes=[...allocations];
    if(!changes.length){
      table.innerHTML='<tr><td colspan="4">현재 조건에서 DPS를 높이는 투자 계획이 없습니다.</td></tr>';
      cacheResult();
      return;
    }
    const combined=withTemporaryTraitInvestments(changes,()=>traitRecommendationStats(useUnitBoard));
    const finalDps=traitRecommendationDpsValue(combined,useUnitBoard);
    const originalDps=traitRecommendationDpsValue(initial,useUnitBoard);
    if(!traitRecommendationLimitsOk(combined,initial) || !Number.isFinite(finalDps) || finalDps<=originalDps){
      table.innerHTML='<tr><td colspan="4">투자 제한과 현재 조건을 확인해 주세요.</td></tr>';
      return;
    }
    const items=changes.map(([row,amount])=>{
      const kind=traitOptimizationResourceInfo(row).kind;
      const cost=traitOptimizationDeltaCost(row,amount);
      const stats=withTemporaryTraitInvestments([[row,amount]],()=>traitRecommendationStats(useUnitBoard));
      const dps=traitRecommendationDpsValue(stats,useUnitBoard);
      return {row,kind,amount,cost,dps,gain:dps-originalDps};
    });
    // 계산된 추천 계획은 유지하고, 기본 화면에는 재화별 효율 상위 2개만 표시한다.
    const displayed=kinds.flatMap(kind=>items.filter(item=>item.kind===kind)
      .sort((a,b)=>(b.gain/Math.max(1,b.cost))-(a.gain/Math.max(1,a.cost)) || b.gain-a.gain)
      .slice(0,2));
    table.innerHTML=displayed.map(item=>`<tr class="trait-recommendation-row" data-action="applyTraitRecommendation" data-row="${item.row}" data-amount="${item.amount}" tabindex="0" role="button" aria-pressed="false" aria-label="${escapeHtml(traitName(item.row))} ${fullNumber(item.amount)}개 추천 투자. 두 번 누르면 투자">
      <td>${escapeHtml(traitName(item.row))}</td>
      <td>${fullNumber(item.amount)}</td>
      <td>${TRAIT_RECOMMENDATION_RESOURCE_LABELS[item.kind]} ${traitRecommendationNumberText(item.cost)}</td>
      <td><strong>${traitRecommendationNumberText(item.dps,1)}</strong><small>${item.gain>=0?'+':''}${traitRecommendationNumberText(item.gain,1)} ${useUnitBoard ? '기대값' : 'DPS'}</small></td>
    </tr>`).join('');
    cacheResult();
  }
  function step(){
    if(revision!==traitRecommendationRevision) return;
    traitRecommendationTimer=0;
    try{
      const started=performance.now();
      let evaluated=0;
      // The investment snapshot is the same for every candidate within a pass.
      // Apply it once per batch instead of once per candidate.
      while(evaluated<6 && performance.now()-started<10){
        if(!passStarted && !beginPass()){finalize();return;}
        const kind=kinds[kindIndex];
        withTemporaryTraitInvestments([...allocations],()=>{
          while(cursor<passTargets.length && evaluated<6 && performance.now()-started<10){
            const t=passTargets[cursor++];
            const candidate=bestTraitRecommendationForRow(t,base,allowance,useUnitBoard);
            candidateScores[kind].set(t[0],candidate?.score||0);
            if(candidate && (!best || candidate.score>best.score || (candidate.score===best.score && (candidate.gain>best.gain || (candidate.gain===best.gain && candidate.row<best.row))))) best=candidate;
            evaluated++;
          }
        });
        if(cursor>=passTargets.length){
          if(best){
            allocations.set(best.row,(allocations.get(best.row)||0)+best.amount);
            spent[kind]+=best.cost;
            pass++;
            forceFullScan=false;
          }else if(!scanningAll){
            forceFullScan=true;
          }else if(allowance<available){
            // If a small allocation cannot be used, retry with the full remainder.
            pass=MAX_PASSES_PER_RESOURCE-1;
          }else advanceResource();
          passStarted=false;
        }
      }
      scheduleTraitRecommendationCalculation(step);
    }catch(error){
      rememberAppIssue('error','특성 추천 투자 계획',error);
      table.innerHTML='<tr><td colspan="4">추천 계산 오류 · 현재 투자값은 변경되지 않았습니다.</td></tr>';
    }
  }
  scheduleTraitRecommendationCalculation(step);
}
/* 수동 특성 입력·반복 투자 이벤트 */
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
    const panel=next.closest('.trait-tier-panel[data-tier]');
    if(panel && !expandedTraitTiers.has(panel.dataset.tier)) setTraitTierExpanded(panel.dataset.tier,true);
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
    const target=e.target;
    if(!(target instanceof Element)) return;
    const input=target.closest('.tv-input[data-row]');
    if(input){input.select();return;}
    const card=target.closest('.trait-invest-card[data-trait-id]');
    if(!card || target.closest('button, a, select, textarea, input, [role="button"]')) return;
    const field=card.querySelector('.tv-input[data-row]');
    if(!field || field.disabled || field.readOnly) return;
    field.focus({preventScroll:true});
    field.select();
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
  if(116 in INV) INV[116]=0;
  commitTraitInvestmentChange();
}
/* 특성 초기화·유틸 최적화 */
const UTILITY_OPT_TYPES=new Set(['유틸','경험치','AP','RA']);
const UTILITY_OPT_TIERS=OPTIMIZATION_TIERS;
function isUtilityOptimizationTrait(t, maxTierIndex=null){
  if(!Array.isArray(t)) return false;
  const row=t[0], tier=t[2], type=t[3];
  if(row===116 || row===112) return false;
  if((row===131 || row===132) && !isAbyssDifficulty()) return false;
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
function isUtilityClearTrait(t){
  if(!Array.isArray(t) || t[0]===116) return false;
  // 엑셀의 유틸 초기화 범위: SP의 AP/경험치/각성석과 전 재화의 편의·보조 특성.
  return t[3]==='유틸' || (SP_ROWS.has(t[0]) && isUtilitySpTrait(t));
}
function isAttackClearTrait(t){
  return Array.isArray(t) && t[0]!==116 && !isUtilityClearTrait(t);
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
  if(116 in INV) INV[116]=0;
  commitTraitInvestmentChange();
  return changed;
}
function clearUtility(){
  const changed=clearTraitInvestmentsBy(isUtilityClearTrait);
  if(!changed) showToast('초기화할 유틸 특성이 없습니다','warn');
  return changed>0;
}
function clearAll(){
  try{
    const changed=clearTraitInvestmentsBy(isAttackClearTrait);
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
function setFontScalePopoverOpen(open, restoreFocus=false){
  const popover=$('fontScalePopover');
  const trigger=document.querySelector('.font-scale-trigger');
  if(!popover || !trigger) return;
  const next=!!open && !isFontScaleLockedViewport();
  popover.hidden=!next;
  trigger.setAttribute('aria-expanded',String(next));
  trigger.setAttribute('aria-label',next?'글씨 크기 조절 닫기':'글씨 크기 조절 열기');
  if(next) popover.querySelector('[data-action="decreaseFont"]')?.focus();
  else if(restoreFocus) trigger.focus();
}
function toggleFontScalePopover(){
  setFontScalePopoverOpen($('fontScalePopover')?.hidden);
}
function bindFontScalePopover(){
  document.addEventListener('click',event=>{
    const popover=$('fontScalePopover');
    if(!popover || popover.hidden || event.target.closest('.font-scale-ctrl')) return;
    setFontScalePopoverOpen(false);
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape' || $('fontScalePopover')?.hidden!==false) return;
    event.preventDefault();
    setFontScalePopoverOpen(false,true);
  });
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
    if(isFontScaleLockedViewport()) {
      applyFontScale(DPS_CONFIG.ui.fontScaleDefault, {silent:true});
      setFontScalePopoverOpen(false);
    }
  });
}
const APP_TITLE_ROTATION=Object.freeze({
  main:{value:'개복디 특성 게산기'},
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
  const label=options.label ? ` aria-label="${escapeHtml(options.label)}"` : '';
  const range=options.range ? ` min="${options.range[0]}" max="${options.range[1]}" step="1"` : '';
  return `<input class="${className}" inputmode="${inputMode}"${maxLength}${placeholder}${label}${range} autocomplete="off" type="${options.range ? 'number' : 'text'}" value="${options.range ? options.range[0] : '0'}"/>`;
}
function zeroScorePenanceSelectHtml(className, label){
  const values=Array.from({length:20},(_,index)=>index+1);
  return `<select class="${className}" aria-label="${escapeHtml(label)}"><option value="0">없음</option>${values.map(value=>`<option value="${value}">${value}</option>`).join('')}</select>`;
}
function zeroScoreHonorSelectHtml(className, label){
  const options=[['0','없음'],['b','B'],['a','A'],['s','S'],['x','X'],['xd','XD']];
  return `<select class="${className}" aria-label="${escapeHtml(label)}">${options.map(([value,name])=>`<option value="${value}">${name}</option>`).join('')}</select>`;
}
function zeroScoreStarButtonHtml(){
  return '<button class="ui-toggle-btn zero-star-toggle" data-action="zeroScoreStar" type="button" aria-pressed="false" aria-label="24스타 미적용">미적용</button>';
}
function buildZeroScoreCalcRow(config){
  const name=escapeHtml(config.name);
  const penance=config.type==='penance';
  const generalCurrent=penance ? zeroScorePenanceSelectHtml('zero-calc-current',`${config.name} 일반 현재`) : zeroScoreInputHtml('zero-calc-current',{label:`${config.name} 일반 현재`});
  const generalTarget=penance ? zeroScorePenanceSelectHtml('zero-calc-target',`${config.name} 일반 목표`) : zeroScoreInputHtml('zero-calc-target',{label:`${config.name} 일반 목표`});
  const honorCurrent=penance ? zeroScoreHonorSelectHtml(config.currentHonorClass,`${config.name} 명예 현재`) : zeroScoreInputHtml(config.currentHonorClass,{...config.honorOptions,label:`${config.name} 명예 현재`});
  const honorTarget=penance ? zeroScoreHonorSelectHtml(config.targetHonorClass,`${config.name} 명예 목표`) : zeroScoreInputHtml(config.targetHonorClass,{...config.honorOptions,label:`${config.name} 명예 목표`});
  const field=(label,control)=>`<label class="zero-calc-field"><span>${label}</span>${control}</label>`;
  const generalLabel=penance?'일반 고행':'도전의탑';
  const honorLabel=penance?'명예':'명예의탑';
  const starControl=config.star===false
    ? '<span class="zero-calc-unavailable" aria-label="24스타 해당 없음">해당 없음</span>'
    : zeroScoreStarButtonHtml();
  return `<article class="zero-calc-row" data-row-type="${config.type}">
    <div class="zero-calc-row-bar">
      <button class="zero-calc-row-head" type="button" aria-expanded="false" aria-label="${name} 승단 점수 입력 펼치기">
        <span class="zero-calc-name"><span class="zero-calc-row-symbol" aria-hidden="true">${String(config.number).padStart(2,'0')}</span><strong>${name}</strong></span>
      </button>
    </div>
    <div class="zero-calc-details" hidden>
      <div class="zero-calc-fields">
        ${field(`현재 ${generalLabel}`,generalCurrent)}
        ${field(`목표 ${generalLabel}`,generalTarget)}
        ${field(`현재 ${honorLabel}`,honorCurrent)}
        ${field(`목표 ${honorLabel}`,honorTarget)}
        <div class="zero-calc-metric"><span>24스타</span>${starControl}</div>
        <div class="zero-calc-metric zero-calc-score"><span>추가점수</span><b class="zero-row-score">0</b></div>
      </div>
    </div>
  </article>`;
}
function buildZeroPenanceCalcRow(name,number){
  return buildZeroScoreCalcRow({type:'penance',name,number,currentHonorClass:'zero-current-honor zero-honor-input',targetHonorClass:'zero-target-honor zero-honor-input',honorOptions:{inputmode:'latin',maxlength:2,placeholder:'B'}});
}
function buildZeroTowerCalcRow(){
  return buildZeroScoreCalcRow({type:'towerCombo',name:'도전의탑',number:ZERO_PENANCE_ROWS.length+1,star:false,currentHonorClass:'zero-tower-honor-current',targetHonorClass:'zero-tower-honor-target'});
}
function renderZeroScoreCalculatorRows(){
  const rows=$('zeroScoreRows');
  if(!rows || rows.dataset.rendered==='1') return;
  rows.innerHTML=ZERO_PENANCE_ROWS.map(({name},index)=>buildZeroPenanceCalcRow(name,index+1)).join('') + buildZeroTowerCalcRow();
  rows.dataset.rendered='1';
}

const ZERO_RANK_FALLBACK_TABLE=[{"name":"입문","score":0,"benefits":["룬 강화 성공 보정 +10% 버프 부여","쥬얼 9개 사용 가능"]},{"name":"견습","score":100,"benefits":["룬 강화 성공 보정 +30% 버프 부여","쥬얼 10개 사용 가능","인챈트북 점수 +20%"]},{"name":"숙련","score":150,"benefits":["전설 쥬얼 기본 드랍률 보정 +10%","룬 강화 성공 보정 +50% 버프 부여","쥬얼 11개 사용 가능","인챈트북 점수 +30%","300라운드 도달 시 각성석 1개 추가 지급"]},{"name":"전문","score":200,"benefits":["전설 쥬얼 기본 드랍률 보정 +20%","룬 강화 성공 보정 +75% 버프 부여","쥬얼 12개 사용 가능","총 데미지 +2%","인챈트북 점수 +40%","300라운드 도달 시 각성석 1개 추가 지급","일일쿠폰 등록 시 인챈트북 1개 추가 지급"]},{"name":"장인","score":250,"benefits":["전설 쥬얼 기본 드랍률 보정 +30%","룬 강화 성공 보정 +100% 버프 부여","쥬얼 13개 사용 가능","총 데미지 +4%","인챈트북 점수 +50%","300라운드 도달 시 각성석 1개 추가 지급","일일쿠폰 등록 시 인챈트북 1개 추가 지급"]},{"name":"명장","score":300,"benefits":["전설 쥬얼 기본 드랍률 보정 +40%","룬 강화 성공 보정 +125% 버프 부여","쥬얼 14개 사용 가능","라운드 한계 경험치 +1","총 데미지 +6%","인챈트북 점수 +60%","300라운드 도달 시 각성석 2개 추가 지급","일일쿠폰 등록 시 인챈트북 1개 추가 지급","고철 획득시 50% 확률로 1개 추가획득"]},{"name":"명장+","score":350,"benefits":["전설 쥬얼 기본 드랍률 보정 +45%","룬 강화 성공 보정 +125% 버프 부여","쥬얼 15개 사용 가능","라운드 한계 경험치 +1","총 데미지 +6%","인챈트북 점수 +70%","XP5 +1","300라운드 도달 시 각성석 2개 추가 지급","일일쿠폰 등록 시 인챈트북 1개 추가 지급","고철 획득시 50% 확률로 1개 추가획득"]},{"name":"도인","score":400,"benefits":["전설 쥬얼 기본 드랍률 보정 +50%","룬 강화 성공 보정 +150% 버프 부여","쥬얼 16개 사용 가능","라운드 한계 경험치 +2","총 데미지 +8%","인챈트북 점수 +80%","XP5 +1","300라운드에 각성석 2개 추가 지급","일일 쿠폰 등록 시 인챈트북 2개 추가 지급","고철 획득시 50% 확률로 1개 추가획득","카오스 · 코스모스 룬 옵션 최소치 추가 보정"]},{"name":"도인+","score":450,"benefits":["전설 쥬얼 기본 드랍률 보정 +55%","룬 강화 성공 보정 +150% 버프 부여","쥬얼 17개 사용 가능","라운드 한계 경험치 +2","총 데미지 +8%","인챈트북 점수 +90%","XP5 +2","300라운드에 각성석 2개 추가 지급","일일 쿠폰 등록 시 인챈트북 2개 추가 지급","고철 획득시 50% 확률로 1개 추가획득","카오스 · 코스모스 룬 옵션 최소치 추가 보정"]},{"name":"지존","score":500,"benefits":["전설 쥬얼 기본 드랍률 보정 +60%","룬 강화 성공 보정 +200% 버프 부여","쥬얼 18개 사용 가능","라운드 한계 경험치 +3","총 데미지 +10%","인챈트북 점수 +100%","XP5 +2","300라운드에 각성석 2개 추가 지급","일일 쿠폰 등록 시 인챈트북 2개 추가 지급","고철 획득시 50% 확률로 1개 추가획득","카오스 · 코스모스 룬 옵션 최소치 추가 보정","고유룬 6개 장착 가능"]},{"name":"지존+","score":550,"benefits":["전설 쥬얼 기본 드랍률 보정 +65%","룬 강화 성공 보정 +200% 버프 부여","쥬얼 19개 사용 가능","라운드 한계 경험치 +3","총 데미지 +10%","인챈트북 점수 +110%","XP5 +3","300라운드에 각성석 2개 추가 지급","일일 쿠폰 등록 시 인챈트북 2개 추가 지급","고철 획득시 50% 확률로 1개 추가획득","카오스 · 코스모스 룬 옵션 최소치 추가 보정","고유룬 6개 장착 가능"]},{"name":"패왕","score":600,"benefits":["전설 쥬얼 기본 드랍률 보정 +70%","룬 강화 성공 보정 +250% 버프 부여","쥬얼 20개 사용 가능","라운드 한계 경험치 +4","총 데미지 +12%","인챈트북 점수 +120%","XP5 +3","300라운드에 각성석 3개 추가 지급","일일 쿠폰 등록 시 인챈트북 2개 추가 지급","고철 획득시 100% 확률로 1개 추가획득","카오스 · 코스모스 룬 옵션 최소치 추가 보정","고유룬 6개 장착 가능","고철 상점의 부적 효과 1.5배 증폭"]},{"name":"패왕+","score":650,"benefits":["전설 쥬얼 기본 드랍률 보정 +80%","룬 강화 성공 보정 +250% 버프 부여","쥬얼 21개 사용 가능","라운드 한계 경험치 +4","총 데미지 +13%","인챈트북 점수 +130%","XP5 +4","300라운드에 각성석 3개 추가 지급","일일 쿠폰 등록 시 인챈트북 2개 추가 지급","고철 획득시 100% 확률로 1개 추가획득","카오스 · 코스모스 룬 옵션 최소치 추가 보정","고유룬 6개 장착 가능","고철 상점의 부적 효과 1.5배 증폭"]},{"name":"제왕","score":700,"benefits":["전설 쥬얼 기본 드랍률 보정 +100%","룬 강화 성공 보정 +300% 버프 부여","쥬얼 22개 사용 가능","라운드 한계 경험치 +5","총 데미지 +14%","인챈트북 점수 +140%","XP5 +4","300라운드에 각성석 3개 추가 지급","일일 쿠폰 등록 시 인챈트북 3개 추가 지급","고철 획득시 100% 확률로 1개 추가획득","카오스 · 코스모스 룬 옵션 최소치 추가 보정","고유룬 6개 장착 가능","고철 상점의 부적 효과 1.5배 증폭","카오스 · 코스모스 룬 최종 드랍 확률 2배"]},{"name":"제왕+","score":750,"benefits":["전설 쥬얼 기본 드랍률 보정 +120%","룬 강화 성공 보정 +300% 버프 부여","쥬얼 23개 사용 가능","라운드 한계 경험치 +5","총 데미지 +15%","인챈트북 점수 +150%","XP5 +5","300라운드에 각성석 3개 추가 지급","일일 쿠폰 등록 시 인챈트북 3개 추가 지급","고철 획득시 100% 확률로 1개 추가획득","카오스 · 코스모스 룬 옵션 최소치 추가 보정","고유룬 6개 장착 가능","고철 상점의 부적 효과 1.5배 증폭","카오스 · 코스모스 룬 최종 드랍 확률 2배"]},{"name":"신황","score":800,"benefits":["전설 쥬얼 기본 드랍률 보정 +140%","룬 강화 성공 보정 +350% 버프 부여","쥬얼 25개 사용 가능","라운드 한계 경험치 +6","총 데미지 +16%","인챈트북 점수 +160%","XP5 +5","300라운드에 각성석 3개 추가 지급","일일 쿠폰 등록 시 인챈트북 4개 추가 지급","고철 획득시 100% 확률로 1개 추가획득","카오스 · 코스모스 룬 옵션 최소치 추가 보정","고유룬 7개 장착 가능","고철 상점의 부적 효과 1.5배 증폭","카오스 · 코스모스 룬 최종 드랍 확률 2배"]},{"name":"신황+","score":850,"benefits":["전설 쥬얼 기본 드랍률 보정 +160%","룬 강화 성공 보정 +350% 버프 부여","쥬얼 26개 사용 가능","라운드 한계 경험치 +6","총 데미지 +17%","인챈트북 점수 +170%","XP5 +6","300라운드에 각성석 3개 추가 지급","일일 쿠폰 등록 시 인챈트북 4개 추가 지급","고철 획득시 100% 확률로 1개 추가획득","카오스 · 코스모스 룬 옵션 최소치 추가 보정","고유룬 7개 장착 가능","고철 상점의 부적 효과 1.5배 증폭","카오스 · 코스모스 룬 최종 드랍 확률 2배"]}];
function getZeroRankTable(){
  return ZERO_RANK_FALLBACK_TABLE;
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
  const card=qs('.zero-rank-result-card');
  if(card){
    card.classList.toggle('zero-rank-same', !!current && current===target);
    card.classList.toggle('zero-rank-upgrade', !!current && !!target && current!==target);
  }
}
// 혜택 미리보기는 조회 상태만 별도로 보관합니다. 승단 점수와 프리셋은 변경하지 않습니다.
let zeroBenefitActualIndex=0;
let zeroBenefitViewIndex=null;
function renderZeroBenefitsPreview(){
  const table=getZeroRankTable();
  if(!table.length) return;
  const current=Math.max(0,Math.min(table.length-1,zeroBenefitActualIndex));
  const index=Math.max(0,Math.min(table.length-1,zeroBenefitViewIndex ?? current));
  const entry=table[index];
  const title=$('zeroCurrentBenefitsTitle');
  const items=$('zeroCurrentBenefitsItems');
  const label=$('zeroBenefitsViewLabel');
  const position=$('zeroBenefitsPosition');
  const prev=$('zeroBenefitsPrev');
  const next=$('zeroBenefitsNext');
  if(title) title.textContent=`더제로 ${entry.name} 혜택`;
  if(label) label.textContent=index===current?'현재 타이틀':'단계 미리보기';
  if(position) position.textContent=`${index+1} / ${table.length}`;
  if(prev) prev.disabled=index===0;
  if(next) next.disabled=index===table.length-1;
  if(items){
    const benefits=entry.benefits||[];
    // Column-major reading order: for 10 benefits, left 1~6 and right 7~10.
    // Longer tiers distribute the overflow to avoid unnecessarily tall columns.
    const rows=benefits.length<=6 ? Math.ceil(benefits.length/2) : Math.max(6,Math.ceil(benefits.length/2));
    items.style.setProperty('--benefits-rows',String(Math.max(1,rows)));
    items.replaceChildren(...benefits.map((text,index)=>{
      const row=document.createElement('span');
      const number=document.createElement('span');
      number.className='zero-benefit-index';
      number.textContent=String(index+1).padStart(2,'0');
      number.setAttribute('aria-hidden','true');
      const description=document.createElement('span');
      description.className='zero-benefit-description';
      description.textContent=text;
      row.append(number,description);
      return row;
    }));
  }
}
function stepZeroBenefitsPreview(direction){
  const table=getZeroRankTable();
  const current=zeroBenefitViewIndex ?? zeroBenefitActualIndex;
  zeroBenefitViewIndex=Math.max(0,Math.min(table.length-1,current+direction));
  renderZeroBenefitsPreview();
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
  zeroBenefitActualIndex=getZeroRankTable().indexOf(zeroRankEntry(currentTotal));
  renderZeroBenefitsPreview();
}
const ZERO_SCORE_DOM_FIELDS=Object.freeze({
  current:{selector:'.zero-calc-current',fallback:'0'},
  target:{selector:'.zero-calc-target',fallback:'0'},
  currentHonor:{selector:'.zero-current-honor',fallback:'0',normalize:value=>normalizeZeroHonorValue(value)},
  targetHonor:{selector:'.zero-target-honor',fallback:'0',normalize:value=>normalizeZeroHonorValue(value)},
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
  if(!field) return;
  if(row.dataset.rowType==='penance' && (key==='current' || key==='target')){
    field.value=String(Math.max(0,Math.min(20,Math.trunc(Number(value) || 0))));
    return;
  }
  field.value=def?.normalize ? def.normalize(value ?? def.fallback) : String(value ?? def?.fallback ?? '0');
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
  setTogglePressed(starBtn, active, {activeText:'적용 ✓', inactiveText:'미적용'});
  if(starBtn) starBtn.setAttribute('aria-label',active?'24스타 적용중':'24스타 미적용');
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
  if(!el || !el.classList?.contains('zero-honor-input') || el.tagName==='SELECT') return;
  el.value=normalizeZeroHonorValue(el.value).toUpperCase();
}
function setZeroScoreRowExpanded(header,expanded){
  const row=header?.closest('.zero-calc-row');
  const details=row?.querySelector('.zero-calc-details');
  if(!details) return;
  if(expanded){
    $('zeroScoreRows')?.querySelectorAll('.zero-calc-row-head[aria-expanded="true"]').forEach(other=>{
      if(other!==header) setZeroScoreRowExpanded(other,false);
    });
  }
  header.setAttribute('aria-expanded',String(expanded));
  row.classList.toggle('is-expanded',expanded);
  header.setAttribute('aria-label',`${header.querySelector('.zero-calc-name strong')?.textContent || '승단'} 승단 점수 입력 ${expanded?'접기':'펼치기'}`);
  setAccordionContentExpanded(details,expanded);
}
function bindZeroScoreCalculator(){
  if(document.documentElement.dataset.zeroScoreCalcBound==='1') return;
  document.documentElement.dataset.zeroScoreCalcBound='1';
  const rows=$('zeroScoreRows');
  const scoreHelp=$('zeroRankScorePopover');
  scoreHelp?.addEventListener('click',event=>{
    const tab=event.target.closest('.unit-achievement-help-tabs [role="tab"]');
    if(tab){event.preventDefault();switchDpsBaseUnitAchievementHelpTab(tab);}
  });
  scoreHelp?.addEventListener('keydown',event=>{
    const tab=event.target.closest('.unit-achievement-help-tabs [role="tab"]');
    if(!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const tabs=[...tab.parentElement.querySelectorAll('[role="tab"]')];
    const index=tabs.indexOf(tab);
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    event.preventDefault();
    switchDpsBaseUnitAchievementHelpTab(tabs[next]);
    tabs[next].focus();
  });
  const benefitsHelp=$('zeroTitleBenefitsPopover');
  benefitsHelp?.addEventListener('click',event=>{
    const control=event.target.closest('[data-zero-benefits-step]');
    if(!control || control.disabled) return;
    event.preventDefault();
    stepZeroBenefitsPreview(Number(control.dataset.zeroBenefitsStep));
  });
  // 더제로 승단 정보 헤더의 단일 버튼이 두 가지 안내를 여는 공통 모달.
  // 표시용 단계 탐색과 승단 계산·프리셋 데이터는 완전히 분리합니다.
  const rankGuideOverlay=$('zeroRankGuideOverlay');
  const rankGuideDialog=$('zeroRankGuideModal');
  const rankGuideTrigger=$('zeroRankGuideOpen');
  let rankGuideReturnFocus=null;
  const rankGuideTabs=[
    ['score','zeroRankScorePopover','zeroRankGuideScoreTab'],
    ['benefits','zeroTitleBenefitsPopover','zeroRankGuideBenefitsTab']
  ];
  function selectRankGuideTab(type,focusTab=false){
    if(type!=='score' && type!=='benefits') return;
    rankGuideTabs.forEach(([key,viewId,tabId])=>{
      const active=key===type;
      const view=$(viewId),tab=$(tabId);
      if(view) view.hidden=!active;
      if(tab){
        tab.classList.toggle('is-active',active);
        tab.setAttribute('aria-selected',String(active));
        tab.tabIndex=active?0:-1;
        if(active && focusTab) tab.focus({preventScroll:true});
      }
    });
    if(type==='benefits') renderZeroBenefitsPreview();
  }
  function closeRankGuide(){
    if(!rankGuideOverlay || rankGuideOverlay.hidden) return;
    rankGuideOverlay.hidden=true;
    document.body.classList.remove('zero-rank-guide-open');
    rankGuideTrigger?.setAttribute('aria-expanded','false');
    rankGuideReturnFocus?.focus({preventScroll:true});
    rankGuideReturnFocus=null;
  }
  function openRankGuide(){
    if(!rankGuideOverlay || !rankGuideDialog) return;
    rankGuideReturnFocus=document.activeElement;
    zeroBenefitViewIndex=null;
    renderZeroBenefitsPreview();
    selectRankGuideTab('score');
    rankGuideOverlay.hidden=false;
    document.body.classList.add('zero-rank-guide-open');
    rankGuideTrigger?.setAttribute('aria-expanded','true');
    rankGuideDialog.focus({preventScroll:true});
  }
  rankGuideTrigger?.addEventListener('click',openRankGuide);
  rankGuideOverlay?.addEventListener('click',event=>{
    if(event.target===rankGuideOverlay || event.target.closest('[data-zero-rank-guide-close]')){
      closeRankGuide();return;
    }
    const tab=event.target.closest('[data-zero-rank-guide-tab]');
    if(tab) selectRankGuideTab(tab.dataset.zeroRankGuideTab);
  });
  document.addEventListener('keydown',event=>{
    if(rankGuideOverlay?.hidden!==false) return;
    if(event.key==='Escape'){
      event.preventDefault();event.stopPropagation();closeRankGuide();return;
    }
    const guideTab=event.target.closest?.('[data-zero-rank-guide-tab]');
    if(guideTab && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();
      const next=event.key==='Home'?'score':event.key==='End'?'benefits':(guideTab.dataset.zeroRankGuideTab==='score'?'benefits':'score');
      selectRankGuideTab(next,true);
      return;
    }
    if(event.key==='Tab'){
      const focusables=[...rankGuideDialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')]
        .filter(node=>!node.closest('[hidden]') && node.getClientRects().length);
      if(!focusables.length){event.preventDefault();rankGuideDialog.focus();return;}
      const first=focusables[0],last=focusables[focusables.length-1];
      if(event.shiftKey && (document.activeElement===first || !rankGuideDialog.contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  rows?.addEventListener('click',event=>{
    const header=event.target.closest('.zero-calc-row-head');
    if(!header || !rows.contains(header)) return;
    setZeroScoreRowExpanded(header,header.getAttribute('aria-expanded')!=='true');
  });
  const updateAndSave=(target,finalize=false)=>{
    if(!(target && target.closest && target.closest('.zero-score-calc'))) return;
    const penanceRow=target.closest('.zero-calc-row[data-row-type="penance"]');
    if(penanceRow && target.matches('.zero-calc-current,.zero-calc-target')){
      if(target.value===''){
        if(!finalize) return; // Allow replacing a number without saving an empty value.
        target.value='0';
      }
      const value=Number(target.value);
      target.value=String(Number.isFinite(value) ? Math.max(0,Math.min(20,Math.trunc(value))) : 0);
    }
    normalizeZeroHonorInputElement(target);
    commitZeroScoreChange();
  };
  document.addEventListener('input', e=>updateAndSave(e.target), true);
  document.addEventListener('change', e=>updateAndSave(e.target,true), true);
  document.addEventListener('focusout', e=>{
    const target=e.target;
    if(target?.matches?.('.zero-calc-row[data-row-type="penance"] .zero-calc-current,.zero-calc-row[data-row-type="penance"] .zero-calc-target') && target.value==='') updateAndSave(target,true);
  }, true);
}

/* 이벤트·초기화 */
let appEventsBound=false;
const ACTION_HANDLERS={
  optimizeSP,
  optimizeUtility,
  applyTraitRecommendation:(trigger)=>activateTraitRecommendationRow(trigger),
  clearUtility:()=>requestConfirmAction('clearUtility','한 번 더 누르면 유틸 초기화', clearUtility),
  clearAll:()=>requestConfirmAction('clearAll','한 번 더 누르면 편의/보조 제외 공격 특성 초기화', clearAll),
  saveTraitPreset:(...args)=>window.DpsPreset.saveCurrent(...args),
  loadTraitPreset:(...args)=>window.DpsPreset.loadSelected(...args),
  updateTraitPreset:(...args)=>window.DpsPreset.updateCurrent(...args),
  deleteTraitPreset:(...args)=>window.DpsPreset.deleteCurrent(...args),
  resetAllTraitPresetState:(...args)=>window.DpsPreset.resetAll(...args),
  backupTraitPresets:(...args)=>window.DpsPreset.openBackup(...args),
  importTraitPresets:(...args)=>window.DpsPreset.openImport(...args),
  openDpsTable,
  zeroScoreStar:(trigger)=>toggleZeroScoreStar(trigger),
  toggleFontScalePopover,
  decreaseFont:()=>changeFontScale(-DPS_CONFIG.ui.fontScaleStep),
  increaseFont:()=>changeFontScale(DPS_CONFIG.ui.fontScaleStep),
  resetFont:()=>applyFontScale(DPS_CONFIG.ui.fontScaleDefault),
  selectButton:(trigger)=>setSelectButton(trigger.closest('.seg-btns')?.dataset.target, trigger.dataset.value),
  donationBuff:(trigger)=>setDonationBuffType(trigger.dataset.value),
  traitAdjust:(trigger)=>{
    if(Date.now()<traitHoldSuppressClickUntil) return false;
    return adjustTraitBy(+trigger.dataset.row,+trigger.dataset.delta,1);
  },
  traitMax:(trigger)=>adjMax(+trigger.dataset.row),
  toggleTraitTier:(trigger)=>{ const tier=trigger.dataset.tier||''; setTraitTierExpanded(tier,!expandedTraitTiers.has(tier)); },
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
  document.addEventListener('keydown', e=>{
    if((e.key!=='Enter' && e.key!==' ') || !e.target.matches?.('.trait-recommendation-row[data-action="applyTraitRecommendation"]')) return;
    e.preventDefault();
    activateTraitRecommendationRow(e.target);
  });
}
const REACTIVE_INPUT_EXCLUDED_IDS=new Set([
  'traitPresetName',
  'traitPresetSelect',
  'traitPresetImportFile',
  'traitPresetBackupName',
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
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-mode-choice]');
    if(!button || button.disabled) return;
    event.preventDefault();
    if(button.dataset.modeChoice==='battle'){
      const coop=$('coopMode');
      if(!coop || coop.value===(button.dataset.value==='coop'?'ON':'OFF')) return;
      coop.value=button.dataset.value==='coop' ? 'ON' : 'OFF';
      coop.dispatchEvent(new Event('change',{bubbles:true}));
    }else if(button.dataset.modeChoice==='sp-bank'){
      const bank=$('spBankApply');
      if(!bank || bank.value===button.dataset.value) return;
      bank.value=button.dataset.value;
      bank.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
  let raf=0;
  const schedule=(target)=>{
    if(!shouldHandleReactiveInput(target)) return;
    if(target.matches('.money-input')) formatMoneyInput(target);
    if(target.id==='spBankApply') syncSpBankApplyControl();
    if(target.id==='xp') normalizeXpInput();
    if(target.id==='round' || target.id==='skillRound' || target.id==='challengeTowerFloor' || target.id==='planetExplorationFloor') normalizeRoundInput(target.id);
    if(target.id==='diff'){
      resetDifficultyDependentFields();
      resetTeamOnDifficultyChange();
      syncDifficultyTargetControls();
      syncErosionControlElements();
      syncPlanetExplorationRestrictedControls();
    }
    if(RUNE_CHOICE_SYNC_IDS.has(target.id)) syncRuneChoice();
    if(ENCHANT_INPUT_ID_SET.has(target.id)) syncEnchantInputs();
    if(RUNE_OPTION_SELECT_ID_SET.has(target.id)) syncExclusiveRuneOptions();
    if(target.id==='soloMode' || target.id==='coopMode'){
      syncBattleMode(target.id,{defaultCoop:true});
    }
    if(target?.matches?.('[data-dps-base-unit-quantity-store],[data-dps-base-unit-slot-quantity]')){
      normalizeDpsBaseUnitQuantityInput(target);
      syncDpsBaseUnitSelectionFromQuantities(false);
    }
    if(target.id==='team'){
      syncTeamSelect({preserveCurrent:true});
    }
    if(TRAIT_LIMIT_INPUT_IDS.has(target.id) && String(target.value).replace(/,/g,'').trim()==='0') syncTraitLimitInputDisplay(target);
    if(target.id==='donationBuffType') syncDonationBuffControl();
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
function bindAppEvents(){
  if(appEventsBound) return;
  appEventsBound=true;
  [
    bindFontScaleViewportGuard, bindFontScalePopover, bindActionEvents, bindTraitHoldEvents, bindTraitInputEvents,
    bindIntegratedTabEvents, ()=>window.DpsPreset.bindEvents(), bindJewelImageEvents,
    bindZeroScoreCalculator, bindTraitLimitDisplayEvents, bindTraitLimitChoiceEvents, bindDpsBaseUnitControlEvents, bindReactiveInputs,
    bindButtonPressFeedback, bindAnalysisPipButton, bindDamageBoardTabEvents, bindDpsTableEvents, bindDamageBoardSwitchEvents, bindAppTitleVersion
  ].forEach(fn=>fn());
}
// 일반 select는 계산·저장 이벤트의 원본으로 유지하고, 표시와 조작만 앱 내부 목록으로 대체합니다.
function initAppSelectDropdowns(){
  if(window.__dpsAppSelectDropdownsReady) return;
  window.__dpsAppSelectDropdownsReady=true;
  const nativeSelector='select:not([data-preview-board]):not(#traitPresetSelect):not(.hidden-field):not(.trait-limit-source):not(.trait-preset-native-select):not([hidden]):not([aria-hidden="true"])';
  const triggerClass='app-select-trigger';
  const menu=document.createElement('div');
  menu.className='app-select-menu';
  menu.id='appSelectMenu';
  menu.setAttribute('role','listbox');
  menu.setAttribute('aria-label','선택 항목');
  menu.hidden=true;
  document.body.appendChild(menu);
  let activeSelect=null;
  let activeButton=null;
  let scheduled=false;
  const buttons=new Map();
  const isSupported=select=>select?.matches?.(nativeSelector) && !select.closest('[data-trait-preset-custom-select]');
  const label=select=>select.getAttribute('aria-label') || (select.id ? document.querySelector(`label[for="${CSS.escape(select.id)}"]`)?.textContent.trim() : '') || select.closest('label')?.querySelector('span')?.textContent.trim() || '항목 선택';
  function optionsFor(select){
    return [...select.options].filter(option=>!option.hidden && !option.parentElement?.hidden);
  }
  function syncButton(select,button){
    if(!select.isConnected || !button.isConnected) return;
    const option=select.selectedOptions?.[0];
    button.querySelector('.app-select-button-value').textContent=option?.textContent.trim() || '선택 안함';
    button.disabled=select.disabled || !optionsFor(select).some(item=>!item.disabled && !item.parentElement?.disabled);
    button.setAttribute('aria-label',`${label(select)}: ${option?.textContent.trim() || '선택 안함'}`);
    if(activeSelect===select && (button.disabled || button.hidden)) closeMenu();
  }
  function enhance(select){
    if(!isSupported(select)) return;
    let button=buttons.get(select);
    if(button?.isConnected && button.previousElementSibling===select){ syncButton(select,button); return; }
    const computed=window.getComputedStyle(select);
    if(computed.display==='none' || computed.visibility==='hidden') return;
    button=document.createElement('button');
    button.type='button';
    button.className=triggerClass;
    button.setAttribute('aria-haspopup','listbox');
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-controls','appSelectMenu');
    button.innerHTML='<span class="app-select-button-value"></span><span class="app-select-button-chevron" aria-hidden="true"></span>';
    button.style.setProperty('--app-select-control-height',computed.height);
    button.style.setProperty('--app-select-control-font-size',computed.fontSize);
    button.style.setProperty('--app-select-control-font-family',computed.fontFamily);
    button.style.setProperty('--app-select-control-radius',computed.borderRadius);
    // 원본을 먼저 측정한 뒤 숨겨 기존 입력창의 배치·계산 연결을 유지합니다.
    select.insertAdjacentElement('afterend',button);
    select.classList.add('app-select-native-source');
    select.setAttribute('aria-hidden','true');
    select.tabIndex=-1;
    buttons.set(select,button);
    syncButton(select,button);
  }
  function closeMenu(restoreFocus=false){
    if(!activeSelect) return;
    const button=activeButton;
    activeSelect=null;
    activeButton=null;
    menu.hidden=true;
    menu.replaceChildren();
    if(button){
      button.classList.remove('is-open');
      button.setAttribute('aria-expanded','false');
      if(restoreFocus && button.isConnected) button.focus({preventScroll:true});
    }
  }
  function placeMenu(){
    if(!activeButton?.isConnected){closeMenu();return;}
    const rect=activeButton.getBoundingClientRect();
    const viewport=window.visualViewport;
    const viewTop=viewport ? viewport.offsetTop : 0;
    const viewHeight=viewport ? viewport.height : window.innerHeight;
    const viewLeft=viewport ? viewport.offsetLeft : 0;
    const viewWidth=viewport ? viewport.width : window.innerWidth;
    const padding=8;
    const below=Math.max(0,viewTop+viewHeight-rect.bottom-padding);
    const above=Math.max(0,rect.top-viewTop-padding);
    const openAbove=below<Math.min(190,above) && above>below;
    const room=Math.max(84,(openAbove?above:below)-7);
    const width=Math.min(viewWidth-padding*2,Math.max(rect.width,Math.min(210,viewWidth-padding*2)));
    const left=Math.max(viewLeft+padding,Math.min(rect.left,viewLeft+viewWidth-padding-width));
    menu.style.width=`${Math.round(width)}px`;
    menu.style.maxHeight=`${Math.max(72,Math.min(300,Math.floor(room)))}px`;
    menu.style.left=`${Math.round(left)}px`;
    menu.style.top=openAbove ? 'auto' : `${Math.round(rect.bottom+5)}px`;
    menu.style.bottom=openAbove ? `${Math.round(window.innerHeight-rect.top+5)}px` : 'auto';
    menu.classList.toggle('opens-up',openAbove);
  }
  function getItems(){ return [...menu.querySelectorAll('[data-app-select-value]')]; }
  function focusItem(item){ if(item){item.focus({preventScroll:true});item.scrollIntoView({block:'nearest'});} }
  function openMenu(select,button,focusList=false){
    if(!select || select.disabled || !button?.isConnected) return;
    if(activeSelect) closeMenu();
    syncButton(select,button);
    activeSelect=select;
    activeButton=button;
    button.classList.add('is-open');
    button.setAttribute('aria-expanded','true');
    menu.setAttribute('aria-label',label(select));
    menu.replaceChildren();
    [...select.children].forEach(node=>{
      if(node.tagName==='OPTGROUP'){
        if(node.hidden) return;
        const group=document.createElement('div');
        group.className='app-select-group-label';
        group.textContent=node.label;
        menu.appendChild(group);
        [...node.children].forEach(appendOption);
      }else if(node.tagName==='OPTION') appendOption(node);
    });
    function appendOption(option){
      if(option.hidden) return;
      const item=document.createElement('button');
      item.type='button';
      item.className='app-select-option';
      item.dataset.appSelectValue=option.value;
      item.setAttribute('role','option');
      item.setAttribute('aria-selected',String(select.value===option.value));
      item.disabled=option.disabled || option.parentElement?.disabled || false;
      if(select.value===option.value) item.classList.add('is-selected');
      const check=document.createElement('span');
      check.className='app-select-option-check';
      check.setAttribute('aria-hidden','true');
      check.textContent=select.value===option.value ? '✓' : '';
      const title=document.createElement('span');
      title.className='app-select-option-text';
      title.textContent=option.textContent.trim();
      item.append(check,title);
      menu.appendChild(item);
    }
    menu.hidden=false;
    placeMenu();
    if(focusList){focusItem(getItems().find(item=>item.classList.contains('is-selected')&&!item.disabled) || getItems().find(item=>!item.disabled));}
    else getItems().find(item=>item.classList.contains('is-selected'))?.scrollIntoView({block:'nearest'});
  }
  function selectItem(item){
    if(!activeSelect || !item || item.disabled) return;
    const select=activeSelect;
    const button=activeButton;
    const changed=select.value!==item.dataset.appSelectValue;
    select.value=item.dataset.appSelectValue;
    closeMenu(true);
    syncButton(select,button);
    if(changed){
      // 기존 코드가 사용하는 네이티브 change 경로를 반드시 한 번만 실행합니다.
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }
    requestSync();
  }
  function refresh(){
    scheduled=false;
    document.querySelectorAll(nativeSelector).forEach(select=>{
      if(select.classList.contains('app-select-native-source')){
        const button=buttons.get(select);
        if(button?.isConnected) syncButton(select,button);
      }else enhance(select);
    });
    for(const [select,button] of buttons){
      if(select.isConnected && button.isConnected) syncButton(select,button);
      if(!select.isConnected || !button.isConnected){
        if(select===activeSelect) closeMenu();
        buttons.delete(select);
      }
    }
  }
  function requestSync(){
    if(scheduled) return;
    scheduled=true;
    window.requestAnimationFrame(refresh);
  }
  document.addEventListener('click',event=>{
    const option=event.target.closest?.('.app-select-option');
    if(option?.closest('.app-select-menu')){selectItem(option);return;}
    const trigger=event.target.closest?.(`.${triggerClass}`);
    if(trigger){
      const select=trigger.previousElementSibling;
      if(activeButton===trigger) closeMenu();
      else openMenu(select,trigger);
      return;
    }
    const targetLabel=event.target.closest?.('label[for]');
    if(targetLabel){
      const select=document.getElementById(targetLabel.htmlFor);
      const button=buttons.get(select);
      if(button && !targetLabel.contains(button)){
        event.preventDefault();
        if(activeButton===button) closeMenu();
        else openMenu(select,button);
        return;
      }
    }
    if(activeSelect && !menu.contains(event.target)) closeMenu();
    requestSync();
  });
  // 유닛 상세 모달의 Escape 단축키보다 먼저 열린 목록만 닫습니다.
  window.addEventListener('keydown',event=>{
    if(event.key==='Escape' && activeSelect){
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    }
  },true);
  document.addEventListener('keydown',event=>{
    const trigger=event.target.closest?.(`.${triggerClass}`);
    if(trigger && ['ArrowDown','ArrowUp','Home','End',' '].includes(event.key)){
      event.preventDefault();
      if(activeButton!==trigger) openMenu(trigger.previousElementSibling,trigger,true);
      return;
    }
    if(!activeSelect) return;
    if(event.key==='Escape'){
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if(!menu.contains(event.target)) return;
    const items=getItems().filter(item=>!item.disabled);
    const index=items.indexOf(document.activeElement);
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();
      let next=index;
      if(event.key==='Home') next=0;
      else if(event.key==='End') next=items.length-1;
      else if(event.key==='ArrowDown') next=(index+1)%items.length;
      else next=(index-1+items.length)%items.length;
      focusItem(items[next]);
    }
    if(event.key==='Tab') closeMenu();
  });
  document.addEventListener('change',event=>{
    if(event.target.matches?.('select')) requestSync();
  });
  document.addEventListener('input',requestSync);
  document.addEventListener('focusin',event=>{
    if(activeSelect && !menu.contains(event.target) && event.target!==activeButton) closeMenu();
  });
  const observer=new MutationObserver(records=>{
    if(records.some(record=>{
      if(record.type==='attributes') return record.target.matches?.('select,option,optgroup');
      if(record.target.matches?.('select,optgroup')) return true;
      return [...record.addedNodes].some(node=>node.nodeType===1 && (node.matches?.('select') || node.querySelector?.('select')));
    })) requestSync();
  });
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','hidden','selected','value']});
  window.addEventListener('resize',()=>{ if(activeSelect) placeMenu();requestSync(); },{passive:true});
  window.addEventListener('scroll',event=>{if(activeSelect && !menu.contains(event.target)) closeMenu();},{passive:true,capture:true});
  window.visualViewport?.addEventListener('resize',()=>{if(activeSelect) placeMenu();},{passive:true});
  // 프리셋 로드 등 직접 .value를 변경하는 기존 코드와 화면 표시를 동기화합니다.
  window.addEventListener('dps:preset-loaded',requestSync);
  refresh();
}

function initApp(){
  loadFontScale();
  renderZeroScoreCalculatorRows();
  bindAppEvents();
  syncEnchantCodeFromInputs(true);
  syncSelectButtons();
  syncDonationBuffControl();
  syncBuffChoiceButtons();
  syncDpsBaseUnitControl();
  syncExclusiveRuneOptions();
  updateZeroScoreCalculator();
  formatAllMoneyInputs();
  syncTraitLimitInputs();
  loadState();
  window.DpsPreset.init();
  initAppSelectDropdowns();
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
