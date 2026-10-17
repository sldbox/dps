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
}
function setDonationBuffType(value){
  const select=$('donationBuffType');
  if(!select) return false;
  const normalized=normalizeDonationBuffType(value);
  select.value=select.value===normalized ? 'none' : normalized;
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
  const ctx=getDpsContextValues();
  const modeTokens=String(ctx.modePrimary||'—').split(' · ').map(token=>token.trim()).filter(Boolean);
  const difficultyTokens=String(ctx.diff||'—').split(' · ').map(token=>token.trim()).filter(Boolean);
  return `<span class="right-mode-first">${modeTokens.map(token=>`<span>${escapeHtml(token)}</span>`).join('')}</span><span class="right-mode-second">${difficultyTokens.map(token=>`<span>${escapeHtml(token)}</span>`).join('')}</span>`;
}
function renderRightHeroContext(){
  const target=$('rightHeroCompactContext');
  if(target) target.innerHTML=dpsBoardContextHtml();
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
/* 공통 모달
 * - 포커스/닫기 처리
 * - DPS표와 프리셋 등 공용 모달 동작
 */
(() => {
  'use strict';

  /* 공통 모달 상태·쉘 */
  const DPS_TABLE_MODAL_ID='dpsTableModal';
  const BOARD_MODAL_IDS=Object.freeze(['sanctuarySkillModal','busPassengerModal','zeroRankInfoModal']);
  let eventsBound=false;

  function createShell(id,className,innerHtml){
    const existing=document.getElementById(id);
    if(existing) return existing;
    const modal=document.createElement('div');
    modal.id=id;
    modal.className=className;
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML=innerHtml;
    document.body.appendChild(modal);
    return modal;
  }

  function setOpen(id,bodyClass,open,options={}){
    const modal=document.getElementById(id);
    if(!modal) return null;
    const active=!!open;
    modal.classList.toggle('is-open',active);
    modal.setAttribute('aria-hidden',active?'false':'true');
    if(bodyClass){
      document.body?.classList.toggle(bodyClass,active);
      if(options.rootClass) document.documentElement?.classList.toggle(bodyClass,active);
    }
    return modal;
  }

  function isOpen(id){
    return document.getElementById(id)?.classList.contains('is-open')===true;
  }

  function syncModeClasses(dialog,modes,activeMode=''){
    const variants=Array.isArray(modes)?modes:[];
    variants.forEach(mode=>{
      dialog?.classList.remove(`is-dps-mode-${mode}`);
      document.body?.classList.remove(`is-dps-mode-${mode}`);
    });
    if(!variants.includes(activeMode)) return;
    dialog?.classList.add(`is-dps-mode-${activeMode}`);
    document.body?.classList.add(`is-dps-mode-${activeMode}`);
  }

  /* 보드 분리 모달 */
  function closeBoardModal(id=''){
    const ids=BOARD_MODAL_IDS.includes(id) ? [id] : BOARD_MODAL_IDS;
    ids.forEach(modalId=>setOpen(modalId,'board-modal-open',false,{rootClass:true}));
    if(!BOARD_MODAL_IDS.some(isOpen)){
      document.body?.classList.remove('board-modal-open');
      document.documentElement?.classList.remove('board-modal-open');
    }
  }
  function openBoardModal(id){
    if(!BOARD_MODAL_IDS.includes(id)) return;
    closeBoardModal();
    const modal=setOpen(id,'board-modal-open',true,{rootClass:true});
    requestAnimationFrame(()=>{
      const closeButton=modal?.querySelector('.board-modal-close');
      if(closeButton && typeof closeButton.focus==='function') closeButton.focus({preventScroll:true});
    });
  }
  function getOpenBoardModalId(){
    return BOARD_MODAL_IDS.find(isOpen) || '';
  }

  /* DPS표 */
  function renderDpsTableModalHeader(){
    const modal=document.getElementById(DPS_TABLE_MODAL_ID);
    if(!modal) return;
    const title=dpsTableDisplayTitle();
    const titleEl=document.getElementById('dpsTableTitle');
    const actions=document.getElementById('dpsTableHeaderActions');
    const closeButton=modal.querySelector('.dps-table-modal-close');
    if(titleEl) titleEl.textContent=title;
    if(closeButton) closeButton.setAttribute('aria-label',`${title} 닫기`);
    if(actions){
      actions.innerHTML=`<div class="dps-table-tabs dps-table-header-tabs" id="dpsTableTabsMount" data-dps-table-tabs-mount role="tablist" aria-label="DPS 기준 선택">${renderDpsTableTabs()}</div>`;
    }
  }

  function renderDpsTablePanel(){
    return `<section class="dps-table-modal-panel dps-table-inline-panel" role="tabpanel" aria-labelledby="dpsTableTitle">
      <div class="dps-table-body" id="dpsTableMount" data-dps-table-mount></div>
    </section>`;
  }

  function createDpsTableModal(){
    return createShell(DPS_TABLE_MODAL_ID,'dps-table-modal-shell',`
      <div class="dps-table-modal-backdrop" data-dps-table-close="1"></div>
      <section class="dps-table-modal" role="dialog" aria-modal="true" aria-labelledby="dpsTableTitle">
        <header class="dps-table-modal-head">
          <div class="dps-table-modal-brand"><span class="dps-table-modal-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"><rect x="2.5" y="3" width="19" height="18" rx="4"/><path d="m6 16 4-4 3 2 5-6m-3 0h3v3"/></svg></span><div><h2 id="dpsTableTitle" class="dps-table-modal-title">DPS표</h2><small>DAMAGE ANALYTICS</small></div></div>
          <div class="dps-table-modal-actions" id="dpsTableHeaderActions"></div>
          <button type="button" class="ui-icon-btn dps-table-modal-close" data-dps-table-close="1" aria-label="DPS표 닫기">×</button>
        </header>
        <div class="dps-table-modal-body">
          ${renderDpsTablePanel()}
        </div>
      </section>`);
  }

  function openDpsTableModal(){
    createDpsTableModal();
    renderDpsTableModalHeader();
    renderDpsTablePanelContent();
    setOpen(DPS_TABLE_MODAL_ID,'dps-table-modal-open',true);
  }

  function closeDpsTableModal(){
    if(!isOpen(DPS_TABLE_MODAL_ID)) return;
    const modal=document.getElementById(DPS_TABLE_MODAL_ID);
    setOpen(DPS_TABLE_MODAL_ID,'dps-table-modal-open',false);
    syncModeClasses(modal?.querySelector('.dps-table-modal'),DPS_MODAL_MODES);
  }

  /* 통합 이벤트·공개 API */
  function handleDocumentClick(event){
    const target=event.target instanceof Element?event.target:null;
    if(!target) return;
    const boardModalClose=target.closest('[data-board-modal-close]');
    if(boardModalClose){
      closeBoardModal(boardModalClose.closest('.board-modal-shell')?.id || '');
      return;
    }
    if(target.closest('[data-dps-table-close]')){
      closeDpsTableModal();
      return;
    }
    const modeTarget=target.closest('[data-dps-table-mode]');
    if(modeTarget) switchDpsTableMode(modeTarget.getAttribute('data-dps-table-mode'));
  }

  function handleDocumentKeydown(event){
    if(event.key==='Escape'){
      const openBoardId=getOpenBoardModalId();
      if(openBoardId){
        closeBoardModal(openBoardId);
        event.preventDefault();
        return;
      }
      if(isOpen(DPS_TABLE_MODAL_ID)) closeDpsTableModal();
      return;
    }
  }

  function bindEvents(){
    if(eventsBound) return;
    eventsBound=true;
    document.addEventListener('click',handleDocumentClick);
    document.addEventListener('change',event=>{if(event.target?.matches?.('[data-dps-view-diff]')) changeDpsVisualDifficulty(event.target.value);});
    document.addEventListener('keydown',handleDocumentKeydown,true);
  }

  window.DpsModal=Object.freeze({
    createShell,
    setOpen,
    isOpen,
    syncModeClasses,
    openDpsTableModal,
    closeDpsTableModal,
    openBoardModal,
    closeBoardModal,
    bindEvents
  });
})();

/* DPS표 모드·미리보기·모달 */
const DPS_TABLE_DIFFICULTIES=DPS_CONFIG.dpsTable.difficulties;
const COOP_DPS_TABLE_DIFFICULTIES=DPS_TABLE_DIFFICULTIES.slice(0, DPS_TABLE_DIFFICULTIES.indexOf('Hall Of Fame') + 1);
const COOP_DPS_TABLE_PENANCE_MIN=0;
const COOP_DPS_TABLE_PENANCE_MAX=COOP_PENANCE_MAX;
const DPS_TABLE_PENANCE_MIN=DPS_CONFIG.dpsTable.penanceMin ?? 0;
const DPS_TABLE_PENANCE_MAX=DPS_CONFIG.dpsTable.penanceMax ?? 20;
const DPS_TABLE_DECIMALS=DPS_CONFIG.dpsTable.decimals ?? 1;
const DPS_MODAL_MODES=['solo','coop','tower','planet'];
let activeDpsTableMode='solo';
function isDpsTableOpen(){
  return $('dpsTableModal')?.classList.contains('is-open')===true;
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
  const menuLabel=$('dpsTableMenuButton')?.querySelector('.header-reference-label');
  if(menuLabel) menuLabel.textContent=label;
  const titleEl=$('dpsTableTitle');
  if(titleEl && isDpsTableOpen()) titleEl.textContent=label;
  const closeBtn=$('dpsTableModal')?.querySelector('.dps-table-modal-close');
  if(closeBtn && isDpsTableOpen()) closeBtn.setAttribute('aria-label', `${label} 닫기`);
}

// 고행별 전체 난이도 격자 대신, 계산 결과를 난이도별 압축 비교로 표시합니다.
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
// DPS표 공통 적 정보: 체력 → 실드 → 방어력 → 물량. 시간·RP는 계산에만 사용한다.
function renderDpsEnemyDetails(items){
  return `<div class="dps-enemy-details">${items.map(([label,value])=>`<div class="dps-enemy-detail"><span>${escapeHtml(String(label))}</span><strong>${escapeHtml(String(value))}</strong></div>`).join('')}</div>`;
}
function renderDpsStatHead(label){
  return `<div class="dps-stat-table-head" role="row"><span>${escapeHtml(label)}</span><span>DPS</span><span>적 정보</span></div>`;
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
  const cells=values.map(({pen,dps})=>`<div class="dps-stat-row${pen===current?' is-current':''}" role="row" data-dps-penance="${pen}">
      <span class="dps-stat-stage" role="cell">${pen} 고행</span>
      <strong class="dps-stat-dps" role="cell">${formatDpsTableValue(dps)}</strong>
      <div class="dps-stat-enemies" role="cell">${renderDpsEnemyDetails(enemyItems)}</div>
    </div>`).join('');
  return `<div class="dps-overview">
    <div class="dps-overview-main">
      <div class="dps-overview-condition"><div class="dps-overview-title">모드 / 난이도</div><strong class="dps-overview-mode">${coop?'협동전 · '+teamCount+'인':'개인전'} · ${current} 고행 · ${round} 라운드</strong><label class="dps-overview-select"><span>난이도 선택</span><select id="dpsVisualDifficulty" data-dps-view-diff aria-label="비교할 난이도 선택">${diffOptions}</select></label></div>
      <div class="dps-overview-highlight"><div class="dps-overview-title">현재 DPS</div><strong>${formatDpsTableValue(currentValue)}</strong><span class="dps-overview-dps-unit">DPS</span></div>
      <section class="dps-table-enemy-summary" aria-label="현재 조건의 적 정보"><div class="dps-overview-title">적 정보</div>${renderDpsEnemyDetails(enemyItems)}</section>
    </div>
    <div class="dps-overview-results"><div class="dps-overview-list-head"><strong>고행별 DPS</strong><span>${penanceMin}–${penanceMax} · ${values.length}개</span></div>
      <div class="dps-stat-table" role="table" aria-label="${escapeHtml(difficulty)} 고행별 DPS 및 적 정보">${renderDpsStatHead('고행')}${cells}</div></div>
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
  const middle=Math.floor((min+max)/2);
  const halves=[[],[]];
  let currentFloorDetails='';
  let currentFloorDps=NaN;
  for(let floor=min;floor<=max;floor++){
    const value=dpsTablePreviewValue(diff,0,floor,{battleMode:'solo',teamCount});
    const enemyItems=tower?towerEnemySummaryItems(floor):planetEnemySummaryItems(floor);
    if(floor===current){
      currentFloorDps=value;
      currentFloorDetails=renderDpsEnemyDetails(enemyItems);
    }
    halves[floor<=middle?0:1].push(`<article class="dps-floor-card dps-stat-row${floor===current?' is-current':''}" role="row" data-dps-floor="${floor}">
      <span class="dps-stat-stage" role="cell">${floor}층</span>
      <strong class="dps-stat-dps" role="cell">${formatDpsTableValue(value)}</strong>
      <div class="dps-stat-enemies" role="cell">${renderDpsEnemyDetails(enemyItems)}</div>
    </article>`);
  }
  const halfHtml=halves.map((half,index)=>`<section class="dps-floor-half" aria-label="${index===0?min:middle+1}층부터 ${index===0?middle:max}층">
    <header class="dps-floor-range">${index===0?min:middle+1}–${index===0?middle:max}층</header>
    <div class="dps-floor-half-entries" role="table">${renderDpsStatHead('층')}${half.join('')}</div>
  </section>`).join('');
  return `<div class="dps-floor-view">
    <div class="dps-current-floor-summary" aria-label="현재 선택 ${current}층 DPS 및 적 정보">
      <div class="dps-current-floor-number"><small>현재 선택 층</small><strong>${current}층</strong></div>
      <div class="dps-current-floor-score"><small>예상 DPS</small><strong>${formatDpsTableValue(currentFloorDps)}</strong></div>
      <div class="dps-current-floor-enemies"><span class="dps-current-floor-label">적 정보</span>${currentFloorDetails||'<span>정보 없음</span>'}</div>
    </div>
    <div class="dps-floor-split-grid">${halfHtml}</div>
  </div>`;
}
function renderDpsTableTabs(){
  return [
    {key:'solo',label:'개인전'},
    {key:'coop',label:'협동전'},
    {key:'tower',label:'도전의탑'},
    {key:'planet',label:'행성탐사'}
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
  const mode=activeDpsTableMode;
  const floorMode=mode==='tower'||mode==='planet';
  const modeNames={solo:'개인전',coop:'협동전',tower:'도전의탑',planet:'행성탐사'};
  const content=floorMode?buildDpsFloorCards(mode):buildDpsVisualComparison(round,mode);
  return `<section class="dps-table-panel dps-table-mode-panel dps-redesigned-panel ${floorMode?'dps-floor-panel':'dps-comparison-panel'}">
    <div class="dps-analysis-strip"><div class="dps-analysis-heading"><span class="dps-analysis-kicker">DAMAGE OVERVIEW</span><strong>${modeNames[mode]} · DPS 한눈에 보기</strong><small>${floorMode?'층별 DPS와 적 정보':'난이도 선택 · 고행별 DPS 비교'}</small></div></div>
    ${content}
  </section>`;
}
function syncDpsTableModalModeClass(){
  const dialog=$('dpsTableModal')?.querySelector('.dps-table-modal');
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
  if(!DPS_MODAL_MODES.includes(mode) || activeDpsTableMode===mode) return;
  activeDpsTableMode=mode;
  renderDpsTablePanelContent();
}
let dpsTowerResizeTimer=0;
window.addEventListener('resize', ()=>{
  if(!isDpsTableOpen() || !['tower','planet','coop'].includes(activeDpsTableMode)) return;
  clearTimeout(dpsTowerResizeTimer);
  dpsTowerResizeTimer=setTimeout(renderDpsTablePanelContent, 120);
}, {passive:true});
function openDpsTable(mode='auto'){
  const fallbackMode=isTowerDifficulty() ? 'tower' : (isPlanetExplorationDifficulty() ? 'planet' : (isCoopActive() ? 'coop' : 'solo'));
  const normalizedMode=mode==='round' ? 'solo' : (mode==='auto' ? fallbackMode : mode);
  activeDpsTableMode=DPS_MODAL_MODES.includes(normalizedMode) ? normalizedMode : fallbackMode;
  dpsVisualDifficulty='';
  window.DpsModal.openDpsTableModal();
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
  donationBuffType:{kind:'룬효과 버프',name:'나눔후원 적용',save:true},
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
  const fillPercent=rawPercent===null ? 0 : Math.min(100,Math.max(0,achievementRate));
  const contextHtml=`<div class="right-hero-context dps-base-unit-context" aria-label="유닛 보드 모드 및 난이도"><span class="dps-lbl">모드 / 난이도</span><strong class="right-hero-compact-mode">${dpsBoardContextHtml()}</strong></div>`;
  const requiredHtml=`<div class="dps-base-unit-summary-item"><span class="dps-lbl">클리어 기준</span><b class="dps-num">${dpsBaseUnitSummaryMarkup(valid ? dpsBaseUnitNumberText(requiredDps,DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS) : '—')}</b></div>`;
  const expectedHtml=`<div class="dps-base-unit-summary-item dps-base-unit-expected"><span class="dps-lbl">클리어 기대값</span><b class="dps-num">${dpsBaseUnitSummaryMarkup(valid ? dpsBaseUnitNumberText(expectedDps,DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS) : '—')}</b><div class="unit-achievement" aria-label="클리어 달성률 ${escapeHtml(shownPercent)}"><div class="unit-achievement-label"><span>달성률</span><strong>${escapeHtml(shownPercent)}</strong></div><div class="unit-achievement-track" role="progressbar" aria-label="클리어 달성률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(fillPercent)}"><span class="unit-achievement-fill${fillPercent>=100?' is-complete':''}" style="--achievement-fill:${fillPercent}%"></span></div><div class="unit-achievement-scale"><small>0%</small><small>100%</small></div></div></div>`;
  // CSS 변수로 실제 달성률과 별개인 0~100% 게이지 채움 폭을 전달합니다.
  el.innerHTML=`<div class="dps-base-unit-summary-row">${contextHtml}${requiredHtml}${expectedHtml}</div>`;

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
  return `<div class="dps-base-unit-qty-control" data-dps-base-unit-qty-control="${escapeHtml(unit.id)}"><button class="ui-choice-btn dps-base-unit-qty-btn" data-dps-base-unit-qty-delta="-1" data-dps-base-unit-id="${escapeHtml(unit.id)}" type="button" aria-label="${label} 수량 감소">−</button><input class="dps-base-unit-qty-input" id="${idPrefix}${slotIndex+1}" data-dps-base-unit-slot-quantity="${escapeHtml(unit.id)}" inputmode="numeric" type="text" min="0" max="${limit}" value="${escapeHtml(value)}" aria-label="${label} 수량"/><button class="ui-choice-btn dps-base-unit-qty-btn" data-dps-base-unit-qty-delta="1" data-dps-base-unit-id="${escapeHtml(unit.id)}" type="button" aria-label="${label} 수량 증가"${increaseDisabled}>+</button></div>`;
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
    <div class="dps-jewel-settings-title">능력치 설정</div>
    <div class="dps-jewel-fields">${field('ad','공격력')}${field('as','공격속도')}${field('td','총데미지')}${field('ua','가속')}${field('enhance','강화')}${field('mythic','신화 여부')}</div>
    <div class="dps-jewel-final" aria-label="${escapeHtml(name)} 최종 옵션">
      ${dpsJewelFinalStatsHtml(finalStats)}
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
  if(!unit){
    const emptySelect='<option value="" selected>유닛 선택 후 사용 가능</option>';
    return `<div class="dps-base-unit-settings is-unassigned" aria-label="빈 슬롯 상세 설정">
      <label class="dps-base-unit-setting is-disabled"><span>강화 기대값</span><input class="dps-base-unit-setting-input" type="text" value="" placeholder="유닛 선택 후 사용" disabled></label>
      <label class="dps-base-unit-setting is-disabled"><span>한계 돌파</span><select class="dps-base-unit-setting-select" disabled>${emptySelect}</select></label>
      <label class="dps-base-unit-setting is-disabled"><span>전설·신화 쥬얼</span><select class="dps-base-unit-setting-select" disabled>${emptySelect}</select></label>
      <div class="dps-base-unit-action-buttons"><div class="dps-base-unit-void-power-control"><span class="dps-base-unit-void-power-usage">—</span><button class="ui-choice-btn dps-base-unit-option-btn" type="button" disabled>공허의 힘</button></div><button class="ui-choice-btn dps-base-unit-option-btn" type="button" disabled>슬롯 확장</button></div>
      <p class="unit-slot-empty-guidance">위에서 유닛을 선택하면 모든 설정을 바로 사용할 수 있습니다.</p>
    </div>`;
  }
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
  const empty=!unit;
  const selectId=`dpsBaseUnitSlot${slotIndex+1}`;
  const selectControl=`<div class="dps-base-unit-select-wrap"><button class="ui-icon-btn dps-base-unit-clear-btn" data-dps-base-unit-clear-slot="${slotIndex}" type="button" aria-label="유닛 선택 해제"${empty?' disabled':''}>×</button><select class="dps-base-unit-select" id="${selectId}" data-dps-base-unit-slot="${slotIndex}" aria-label="슬롯 ${slotIndex+1} 유닛 선택">${dpsBaseUnitSelectOptionsHtml(unitId,slots)}</select></div>`;
  const result=unit ? dpsBaseUnitResultDisplayMap.get(String(unit.id || '')) || null : null;
  const attack=result ? dpsBaseUnitAttackText(result) : '—';
  const pierce=result ? dpsBaseUnitPercentText(result.effectivePierce) : (unit ? (dpsBaseUnitIsArtifact(unit) ? '0%' : dpsBaseUnitPercentText(dpsBaseUnitBoardBasePierce + dpsBaseUnitPierceBonus(unit))) : '—');
  const dps=result ? dpsBaseUnitDpsText(result) : '—';
  const entry=`<div class="dps-base-unit-entry dps-base-unit-slot${empty ? ' is-empty' : ''}${unit && dpsBaseUnitHasQuantity(unit) ? ' has-quantity' : ' is-fixed'}" data-dps-base-unit-slot-row="${slotIndex}">${dpsBaseUnitFieldHtml(dpsBaseUnitNameFieldLabelHtml(unit),'dps-base-unit-name-field',selectControl)}${dpsBaseUnitFieldHtml('공격력','dps-base-unit-attack-field',`<span class="dps-base-unit-board-cell dps-base-unit-board-attack">${escapeHtml(attack)}</span>`)}${dpsBaseUnitFieldHtml('방어력 관통','dps-base-unit-pierce-field',`<span class="dps-base-unit-board-cell dps-base-unit-board-pierce">${escapeHtml(pierce)}</span>`)}${dpsBaseUnitFieldHtml(unit && dpsBaseUnitIsArtifact(unit)?'파장 총 DPS':'총 DPS','dps-base-unit-dps-field',`<b class="dps-base-unit-board-cell dps-base-unit-board-dps">${escapeHtml(dps)}</b>`)}${dpsBaseUnitFieldHtml('수량','dps-base-unit-quantity-field',`<div class="dps-base-unit-board-cell dps-base-unit-board-quantity">${dpsBaseUnitQuantityControlHtml(unit,slotIndex)}</div>`)}</div>`;
  return `<article class="dps-base-unit-card right-unit-slot-card${empty?' is-empty':''}" aria-label="유닛 슬롯 ${slotIndex+1}"><div class="right-unit-slot-performance">${entry}</div><div class="right-unit-slot-settings">${dpsBaseUnitSettingsHtml(unit,slotIndex)}</div></article>`;
}
let dpsUnitSelectedSlot=0;
let dpsUnitDetailOpen=false;
function dpsBaseUnitSlotsHtml(slots){
  dpsUnitSelectedSlot=Math.max(0,Math.min(slots.length-1,dpsUnitSelectedSlot));
  const activeCount=slots.filter(unitId=>!!dpsBaseUnitById(unitId)).length;
  const headings=`<div class="unit-list-heading"><span>슬롯</span><span>유닛명</span><span>수량</span><span>공격력</span><span>관통</span><span>DPS</span><span>관리</span></div>`;
  const rows=slots.map((unitId,index)=>{
    const unit=dpsBaseUnitById(unitId);
    const info=unit ? dpsBaseUnitResultDisplayMap.get(String(unit.id||'')) : null;
    const attack=unit && info ? dpsBaseUnitAttackText(info) : '';
    const pierce=unit && info ? dpsBaseUnitPercentText(info.effectivePierce) : '';
    const dps=unit && info ? dpsBaseUnitDpsText(info) : '';
    const unitName=unit ? dpsBaseUnitDisplayLabel(unit) : '';
    const quantity=unit ? (dpsBaseUnitHasQuantity(unit) ? dpsBaseUnitQuantityText(unit) : '1') : '';
    const selected=index===dpsUnitSelectedSlot && dpsUnitDetailOpen;
    return `<div class="unit-list-row${selected?' is-selected':''}${unit?'':' is-unassigned'}"><b class="unit-list-index">${index+1}</b><strong class="unit-list-name-readonly" title="${escapeHtml(unitName)}">${escapeHtml(unitName)}</strong><span class="unit-list-quantity">${escapeHtml(quantity)}</span><span class="unit-list-attack">${escapeHtml(attack)}</span><span class="unit-list-pierce">${escapeHtml(pierce)}</span><strong class="unit-list-dps">${escapeHtml(dps)}</strong><div class="unit-list-actions"><button type="button" class="unit-list-settings" data-unit-list-select="${index}" aria-label="슬롯 ${index+1} 설정 열기" aria-haspopup="dialog" aria-expanded="${selected}" aria-controls="dpsUnitSlotModal" title="슬롯 ${index+1} 설정">설정</button><button type="button" class="unit-list-remove" data-unit-list-remove="${index}" aria-label="슬롯 ${index+1} 제거" title="슬롯 ${index+1} 제거"${unit?'':' disabled'}>×</button></div></div>`;
  }).join('');
  const summaryMessage=activeCount ? `<strong class="unit-list-usage">${activeCount} / ${slots.length} 슬롯 활성화됨</strong>` : '<strong class="unit-list-empty-notice">유닛 설정이 필요합니다</strong>';
  return `<section class="unit-list-collection" aria-label="유닛 슬롯 관리"><header class="right-unit-collection-heading"><span class="right-unit-collection-mark" aria-hidden="true">▦</span><span><strong>유닛 슬롯 관리</strong><small>유닛과 수량은 설정에서 변경</small></span><span class="unit-list-status" role="status" aria-live="polite">${summaryMessage}</span></header><div class="unit-list-panel" aria-label="유닛 슬롯 조회 목록">${headings}${rows}</div></section>`;
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
  $('unitSlotModalClose')?.focus({preventScroll:true});
  dpsUnitDetailOpen=false;
  syncDpsBaseUnitControl({skipJewelConfig:true});
  $('dpsBaseUnitSlotStack')?.querySelector(`[data-unit-list-select="${dpsUnitSelectedSlot}"]`)?.focus({preventScroll:true});
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
function removeDpsBaseUnitSlot(slotIndex){
  const slots=currentDpsBaseUnitSlots();
  const index=Number(slotIndex);
  if(!Number.isInteger(index) || index<0 || index>=slots.length || !slots[index]) return false;
  const removedUnit=slots[index];
  slots[index]='';
  if(!slots.includes(removedUnit)) resetDpsBaseUnitSlotSettings(removedUnit);
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
  if(previous && previous!==next && dpsBaseUnitHasQuantity(previous) && !slots.includes(previous)) setDpsBaseUnitQuantity(previous,0);
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
  sanitizeDpsBaseUnitVoidPowerAvailability(selectedIds);
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

function bindDpsBaseUnitControlEvents(){
  if(document.documentElement.dataset.dpsBaseUnitControlBound==='1') return;
  document.documentElement.dataset.dpsBaseUnitControlBound='1';
  document.addEventListener('keydown', e=>{
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
  document.addEventListener('click', e=>{
    const removeButton=e.target?.closest?.('[data-unit-list-remove]');
    if(removeButton?.closest?.('#dpsBaseUnitSlotStack')){
      e.preventDefault();
      if(removeDpsBaseUnitSlot(removeButton.getAttribute('data-unit-list-remove'))) commitAppUpdate();
      return;
    }
    const unitRow=e.target?.closest?.('[data-unit-list-select]');
    if(unitRow?.closest?.('[data-dps-base-unit-control]')){
      e.preventDefault();
      dpsUnitSelectedSlot=Number(unitRow.dataset.unitListSelect)||0;
      dpsUnitDetailOpen=true;
      syncDpsBaseUnitControl({skipJewelConfig:true});
      $('unitSlotModalClose')?.focus({preventScroll:true});
      return;
    }
    const closeDetail=e.target?.closest?.('[data-unit-detail-close],[data-unit-detail-backdrop]');
    if(closeDetail?.closest?.('#dpsUnitSlotModal')){
      e.preventDefault();
      closeDpsUnitSlotModal();
      return;
    }
    const clearUnit=e.target?.closest?.('[data-dps-base-unit-clear-slot]');
    if(clearUnit?.closest?.('[data-dps-base-unit-control]')){
      e.preventDefault();
      if(removeDpsBaseUnitSlot(clearUnit.getAttribute('data-dps-base-unit-clear-slot'))) commitAppUpdate();
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

/* 스펙·유닛 보드 전환 및 상태 이벤트 */
function setDamageBoardTab(active){
  const next=active==='unit' ? 'unit' : 'spec';
  const changed=isUnitBoardRecommendationMode() !== (next==='unit');
  qsa('[data-damage-board-tab]').forEach(tab=>{
    const isActive=tab.dataset.damageBoardTab===next;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  qsa('[data-damage-board-panel]').forEach(panel=>{
    const isActive=panel.dataset.damageBoardPanel===next;
    panel.classList.toggle('is-active', isActive);
    panel.hidden=!isActive;
  });
  if(changed) renderTraitRecommendations();
}
function bindDamageBoardTabEvents(){
  document.addEventListener('click', e=>{
    const tab=e.target?.closest?.('[data-damage-board-tab]');
    if(!tab || tab.disabled) return;
    e.preventDefault();
    setDamageBoardTab(tab.dataset.damageBoardTab);
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
    if(artifactToggle.disabled || planetExplorationRestrictionsActive()) return;
    setArtifactDpsViewEnabled(!isArtifactDpsViewEnabled());
    requestAppUpdate();
  }, true);
}
/* 특성 보드: 목록·수동 투자·추천·최적화 */
const INFINITE_TRAIT_TIER='무한∞';
const TIERS=['루키','비기너','아마추어','프로','엑스퍼트','마스터','디바인','더원1','더원2',INFINITE_TRAIT_TIER,'EP특성','RP특성','심연특성'];
const OPTIMIZATION_TIERS=TIERS.filter(tier=>tier!==INFINITE_TRAIT_TIER).concat(INFINITE_TRAIT_TIER);
// 펼침 여부는 화면 상태로만 관리하며 프리셋 데이터에는 저장하지 않는다.
const expandedTraitTiers=new Set();
function setTraitTierExpanded(tier,expanded){
  if(!TIERS.includes(tier)) return;
  if(expanded) expandedTraitTiers.add(tier);
  else expandedTraitTiers.delete(tier);
  const panel=Array.from(qsa('.trait-tier-panel[data-tier]')).find(el=>el.dataset.tier===tier);
  if(!panel) return;
  const toggle=panel.querySelector('.trait-tier-toggle');
  const list=panel.querySelector('.trait-invest-list');
  panel.classList.toggle('is-expanded',expanded);
  if(toggle) toggle.setAttribute('aria-expanded',String(expanded));
  if(list) list.hidden=!expanded;
}
function setAllTraitTiersExpanded(expanded){
  TIERS.forEach(tier=>setTraitTierExpanded(tier,expanded));
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
      const rStr=traitEffectText(row,type,rate);
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
      <h4><button type="button" class="trait-tier-toggle" data-action="toggleTraitTier" data-tier="${tier}" aria-expanded="${isExpanded}" aria-controls="traitTierContent${tierIndex+1}"><span class="trait-title"><span class="trait-tier-index" aria-hidden="true">${String(tierIndex+1).padStart(2,'0')}</span><span class="trait-tier-name">${tier}<small class="trait-tier-caption">TRAIT COLLECTION</small></span></span></button><span class="trait-tools"><button type="button" class="ui-action-btn mini-btn master" data-action="masterTier" data-tier="${tier}">구간 마스터</button><button type="button" class="ui-action-btn mini-btn reset danger" data-action="resetTier" data-tier="${tier}">초기화</button></span></h4>
      <div class="trait-invest-list" id="traitTierContent${tierIndex+1}" ${isExpanded?'':'hidden'}>${rows}</div>
    </section>`;
  }).join('');
}
/* 특성 추천: 가상 투자 계획을 단계별로 계산하여 화면 스크롤을 유지 */
let traitRecommendationTimer=0;
let traitRecommendationRevision=0;
let currentTraitRecommendationPlan=null;
const traitRecommendationCache=new Map();
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
  const table=$('traitRecommendationRows'),status=$('traitRecommendationStatus'),refund=$('traitRecommendationRefund'),investAll=$('traitRecommendationInvestAll');
  if(!table||!status||!refund||!investAll) return;
  const useUnitBoard=isUnitBoardRecommendationMode();
  setText('traitRecommendationDpsLabel',useUnitBoard ? '클리어 기대값' : 'DPS');
  synchronizeTraitRecommendationCredits();
  refund.disabled=!hasTraitRecommendationCredits();
  const revision=++traitRecommendationRevision;
  cancelTraitRecommendationCalculation();
  const cached=traitRecommendationCache.get(useUnitBoard);
  if(cached && cached.appRevision===appCalculationRevision){
    currentTraitRecommendationPlan=cached.plan;
    investAll.disabled=!cached.plan;
    status.textContent=cached.status;
    table.innerHTML=cached.rows;
    return;
  }
  currentTraitRecommendationPlan=null;
  investAll.disabled=true;
  const snapshot=traitRecommendationPlanSnapshot(useUnitBoard);
  function cacheResult(){
    traitRecommendationCache.set(useUnitBoard,{
      appRevision:appCalculationRevision,
      plan:currentTraitRecommendationPlan,
      status:status.textContent,
      rows:table.innerHTML
    });
  }
  const remaining=snapshot.remaining;
  const resources=Object.entries(remaining).map(([kind,value])=>`${TRAIT_RECOMMENDATION_RESOURCE_LABELS[kind]} ${traitRecommendationNumberText(value)}`).join(' · ');
  if(!Object.values(remaining).some(value=>value>0)){
    status.textContent=`남은 재화 없음 · ${resources}`;
    table.innerHTML='<tr><td colspan="5">추천에 사용할 잔여 재화가 없습니다.</td></tr>';
    return;
  }
  const initial=traitRecommendationStats(useUnitBoard);
  if(useUnitBoard && !initial.dpsBaseUnit?.isActive){
    status.textContent='유닛을 선택하면 클리어 기대값 기준으로 추천을 계산합니다.';
    table.innerHTML='<tr><td colspan="5">유닛 보드에서 유닛을 먼저 선택해 주세요.</td></tr>';
    return;
  }
  status.textContent=`잔여 재화 전체 기준 · 투자 계획 계산 중 · ${resources}`;
  table.innerHTML='<tr><td colspan="5">여러 특성의 투자 수량과 효율을 계산하는 중입니다.</td></tr>';
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
      status.textContent='계산 중 입력 상태가 변경되었습니다. 다음 자동 갱신 결과를 확인해 주세요.';
      table.innerHTML='<tr><td colspan="5">현재 입력 기준으로 다시 계산해 주세요.</td></tr>';
      return;
    }
    const changes=[...allocations];
    if(!changes.length){
      status.textContent=`${resources} · 제한과 잔여 재화 내에서 투자 가능한 DPS 상승 없음`;
      table.innerHTML='<tr><td colspan="5">현재 조건에서 DPS를 높이는 투자 계획이 없습니다.</td></tr>';
      cacheResult();
      return;
    }
    const combined=withTemporaryTraitInvestments(changes,()=>traitRecommendationStats(useUnitBoard));
    const finalDps=traitRecommendationDpsValue(combined,useUnitBoard);
    const originalDps=traitRecommendationDpsValue(initial,useUnitBoard);
    if(!traitRecommendationLimitsOk(combined,initial) || !Number.isFinite(finalDps) || finalDps<=originalDps){
      status.textContent='최종 투자 제한 검증에 실패했습니다. 현재 값은 변경되지 않았습니다.';
      table.innerHTML='<tr><td colspan="5">투자 제한과 현재 조건을 확인해 주세요.</td></tr>';
      return;
    }
    const items=changes.map(([row,amount])=>{
      const kind=traitOptimizationResourceInfo(row).kind;
      const cost=traitOptimizationDeltaCost(row,amount);
      const stats=withTemporaryTraitInvestments([[row,amount]],()=>traitRecommendationStats(useUnitBoard));
      const dps=traitRecommendationDpsValue(stats,useUnitBoard);
      return {row,kind,amount,cost,dps,gain:dps-originalDps};
    });
    currentTraitRecommendationPlan={snapshot,items,finalDps};
    investAll.disabled=false;
    status.textContent=`잔여 재화 전체 기준 · ${items.length}개 특성 투자 계획 · ${useUnitBoard ? '클리어 기대값' : 'DPS'} ${traitRecommendationNumberText(originalDps,1)} → ${traitRecommendationNumberText(finalDps,1)} (+${traitRecommendationNumberText(finalDps-originalDps,1)})`;
    table.innerHTML=items.map(item=>`<tr>
      <td>${escapeHtml(traitName(item.row))}</td>
      <td>${fullNumber(item.amount)}</td>
      <td title="${TRAIT_RECOMMENDATION_RESOURCE_LABELS[item.kind]} ${fullNumber(item.cost)}">${TRAIT_RECOMMENDATION_RESOURCE_LABELS[item.kind]} ${traitRecommendationNumberText(item.cost)}</td>
      <td><strong title="${fmt(item.dps,1)}">${traitRecommendationNumberText(item.dps,1)}</strong><small title="${item.gain>=0?'+':''}${fmt(item.gain,1)}">${item.gain>=0?'+':''}${traitRecommendationNumberText(item.gain,1)} ${useUnitBoard ? '기대값' : 'DPS'}</small></td>
      <td><button class="btn pri ui-action-btn trait-recommendation-apply" data-action="applyTraitRecommendation" data-row="${item.row}" data-amount="${item.amount}" type="button">투자</button></td>
    </tr>`).join('');
    cacheResult();
  }
  function step(){
    if(revision!==traitRecommendationRevision) return;
    traitRecommendationTimer=0;
    try{
      const started=performance.now();
      let evaluated=0;
      let progressKind='';
      // The investment snapshot is the same for every candidate within a pass.
      // Apply it once per batch instead of once per candidate.
      while(evaluated<6 && performance.now()-started<10){
        if(!passStarted && !beginPass()){finalize();return;}
        const kind=kinds[kindIndex];
        progressKind=kind;
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
      if(!passStarted && progressKind){
        status.textContent=`투자 계획 계산 중 · ${TRAIT_RECOMMENDATION_RESOURCE_LABELS[progressKind]} ${Math.min(pass+1,MAX_PASSES_PER_RESOURCE)}/${MAX_PASSES_PER_RESOURCE} · ${resources}`;
      }
      scheduleTraitRecommendationCalculation(step);
    }catch(error){
      rememberAppIssue('error','특성 추천 투자 계획',error);
      status.textContent='특성 추천 계산을 완료하지 못했습니다.';
      table.innerHTML='<tr><td colspan="5">추천 계산 오류 · 현재 투자값은 변경되지 않았습니다.</td></tr>';
      investAll.disabled=true;
    }
  }
  scheduleTraitRecommendationCalculation(step);
}
function applyCurrentTraitRecommendationPlan(){
  if(!currentTraitRecommendationPlan) return false;
  return applyTraitRecommendationPlan(currentTraitRecommendationPlan);
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
  if(116 in INV) INV[116]=0;
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
/* 반응형 레이아웃
 * - 뷰포트 상태 클래스 관리
 * - 모바일/태블릿/세로 화면 전환 보조
 */
(() => {
  'use strict';

  /* 반응형 상태·측정 헬퍼 */
  const MODES = ['is-pc-landscape', 'is-pc-portrait', 'is-tablet', 'is-mobile', 'is-portrait-view', 'is-mobile-device', 'is-tablet-device', 'is-narrow-mobile', 'is-tabbed'];
  const TABBED_PAGES = [
    { key: 'basic', label: '기본 정보', selectors: ['.trait-preset-panel', '.col-left'] },
    { key: 'trait', label: '특성 관리', selectors: ['.trait-board-panel'] },
    { key: 'specUnit', label: '분석 보드', selectors: ['.stat-dps-card'] }
  ];
  const state = {
    tabs: null,
    pages: [],
    restore: new Map(),
    raf: 0,
    arrangedTabbed: false,
    layoutWidth: 0,
    layoutPortrait: null,
    activeIndex: 0,
    activeKey: null,
    resumeRaf: 0,
    initialized: false
  };
  /* 뷰포트 판정 */
  function getViewportSize() {
    const root = document.documentElement;
    return {
      w: root.clientWidth || window.innerWidth || 0,
      h: root.clientHeight || window.innerHeight || 0
    };
  }
  function getMode() {
    const { w, h } = getViewportSize();
    const shortSide = Math.min(w, h);
    const longSide = Math.max(w, h);
    const portrait = h > w;
    if (shortSide <= 600) return 'is-mobile';
    if (shortSide <= 1024 && longSide <= 1366) return 'is-tablet';
    if (portrait) return 'is-pc-portrait';
    return 'is-pc-landscape';
  }
  function updateMobileOffsets() {
    const header = document.querySelector('.hdr');
    const tabs = document.querySelector('.mobile-section-tabs');
    const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    const tabsHeight = tabs ? Math.ceil(tabs.getBoundingClientRect().height) : 0;
    const { w, h } = getViewportSize();
    document.documentElement.style.setProperty('--mobile-vw', `${w}px`);
    document.documentElement.style.setProperty('--mobile-header-h', `${headerHeight}px`);
    document.documentElement.style.setProperty('--mobile-tabs-h', `${tabsHeight}px`);
    document.documentElement.style.setProperty('--mobile-vh', `${h}px`);
  }
  function applyMode() {
    const mode = getMode();
    const { w, h } = getViewportSize();
    const shortSide = Math.min(w, h);
    const direction = h > w ? 'is-portrait-view' : '';
    const deviceClass = mode === 'is-mobile' ? 'is-mobile-device' : (mode === 'is-tablet' ? 'is-tablet-device' : '');
    const widthClass = mode === 'is-mobile' && shortSide <= 430 ? 'is-narrow-mobile' : '';
    document.body.classList.remove(...MODES);
    document.documentElement.classList.remove(...MODES);
    document.body.classList.add(mode);
    document.documentElement.classList.add(mode);
    if (mode === 'is-mobile' || mode === 'is-tablet' || mode === 'is-pc-portrait') {
      document.body.classList.add('is-tabbed');
      document.documentElement.classList.add('is-tabbed');
    }
    if (direction) {
      document.body.classList.add(direction);
      document.documentElement.classList.add(direction);
    }
    if (deviceClass) {
      document.body.classList.add(deviceClass);
      document.documentElement.classList.add(deviceClass);
    }
    if (widthClass) {
      document.body.classList.add(widthClass);
      document.documentElement.classList.add(widthClass);
    }
    state.layoutWidth = w;
    state.layoutPortrait = h > w;
    syncTabbedLayout();
    updateMobileOffsets();
  }
  /* 탭 레이아웃 */
  function rememberPosition(el) {
    if (!el || state.restore.has(el)) return;
    const marker = document.createComment(`mobile-restore:${el.className || el.tagName}`);
    el.parentNode.insertBefore(marker, el);
    state.restore.set(el, marker);
  }
  function getOrCreatePage(key) {
    let page = document.querySelector(`.mobile-page[data-mobile-page="${key}"]`);
    if (!page) {
      page = document.createElement('div');
      page.className = `mobile-page mobile-page-${key}`;
      page.dataset.mobilePage = key;
    }
    page.id = `mobilePage-${key}`;
    page.setAttribute('role', 'tabpanel');
    page.setAttribute('tabindex', '0');
    return page;
  }
  function getPageIndexByKey(key) {
    if (!key) return -1;
    return state.pages.findIndex(page => page.key === key);
  }
  function buildTabs(colWork, pages) {
    if (!state.tabs) {
      state.tabs = document.createElement('div');
      state.tabs.className = 'mobile-section-tabs';
      state.tabs.setAttribute('aria-label', '화면 전환');
      colWork.parentNode.insertBefore(state.tabs, colWork);
      state.tabs.addEventListener('keydown', handleTabKeydown);
    }
    state.tabs.textContent = '';
    const pageRow = document.createElement('div');
    pageRow.className = 'mobile-section-page-row';
    pageRow.setAttribute('role', 'tablist');
    pageRow.setAttribute('aria-label', '화면 전환');
    pages.forEach((page, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = `mobileTab-${page.key}`;
      btn.className = ['mobile-section-tab', 'mobile-section-page-tab', page.toneClass].filter(Boolean).join(' ');
      const glyph = page.key === 'basic' ? '▤' : page.key === 'trait' ? '✦' : '▥';
      btn.innerHTML = `<span class="mobile-tab-glyph" aria-hidden="true">${glyph}</span><span class="mobile-tab-label">${page.label}</span>`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('aria-controls', page.el.id);
      btn.tabIndex = -1;
      page.el.setAttribute('aria-labelledby', btn.id);
      btn.addEventListener('click', () => showTabbedPage(idx, true));
      pageRow.appendChild(btn);
    });
    state.tabs.append(pageRow);
  }
  function handleTabKeydown(event) {
    const tabs = Array.from(state.tabs?.querySelectorAll('.mobile-section-page-tab') || []);
    const currentIndex = tabs.indexOf(document.activeElement);
    if (currentIndex < 0) return;
    let nextIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    showTabbedPage(nextIndex, false);
    tabs[nextIndex]?.focus();
  }
  function setActiveTab(activeIndex) {
    const nextIndex = Math.max(0, Math.min(state.pages.length - 1, activeIndex));
    state.activeIndex = nextIndex;
    state.activeKey = state.pages[nextIndex]?.key || state.activeKey;
    if (state.tabs) {
      state.tabs.querySelectorAll('.mobile-section-page-tab').forEach((btn, idx) => {
        const active = idx === nextIndex;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.tabIndex = active ? 0 : -1;
      });
    }
    state.pages.forEach((page, idx) => {
      const active = idx === nextIndex;
      page.el.classList.toggle('active', active);
      page.el.hidden = !active;
      page.el.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
  }
  function showTabbedPage(index, resetPageScroll = false) {
    if (!state.pages.length) return;
    const nextIndex = Math.max(0, Math.min(state.pages.length - 1, index));
    setActiveTab(nextIndex);
    if (resetPageScroll) state.pages[nextIndex].el.scrollTop = 0;
    updateMobileOffsets();
  }
  function arrangeTabbed(colWork) {
    const pages = [];
    const keepKey = state.activeKey || state.pages[state.activeIndex]?.key || 'basic';
    TABBED_PAGES.forEach((config) => {
      const elements = config.selectors.map(selector => document.querySelector(selector)).filter(Boolean);
      if (!elements.length) return;
      const page = getOrCreatePage(config.key);
      page.textContent = '';
      page.dataset.mobileLabel = config.label;
      elements.forEach((el) => {
        rememberPosition(el);
        page.appendChild(el);
      });
      colWork.appendChild(page);
      pages.push({ ...config, el: page });
    });
    state.pages = pages;
    buildTabs(colWork, pages);
    colWork.classList.add('is-mobile-arranged');
    state.arrangedTabbed = true;
    const keepIndex = getPageIndexByKey(keepKey);
    showTabbedPage(keepIndex >= 0 ? keepIndex : state.activeIndex);
  }
  function restoreDesktop() {
    if (!state.arrangedTabbed) return;
    state.restore.forEach((marker, el) => {
      if (marker.parentNode) marker.parentNode.insertBefore(el, marker.nextSibling);
    });
    Array.from(document.querySelectorAll('.mobile-page')).forEach(page => page.remove());
    if (state.tabs) state.tabs.remove();
    document.querySelector('.col-work')?.classList.remove('is-mobile-arranged');
    state.tabs = null;
    state.pages = [];
    state.arrangedTabbed = false;
  }
  function syncTabbedLayout() {
    const colWork = document.querySelector('.col-work');
    if (!colWork) return;
    if (document.body.classList.contains('is-tabbed')) {
      if (!state.arrangedTabbed) arrangeTabbed(colWork);
      else {
        showTabbedPage(getPageIndexByKey(state.activeKey));
      }
    } else {
      restoreDesktop();
    }
  }

  function isTextInput(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName !== 'INPUT') return false;
    return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes((el.type || '').toLowerCase());
  }
  function bindInputAutoSelect() {
    if (document.documentElement.dataset.inputAutoSelectBound === '1') return;
    document.documentElement.dataset.inputAutoSelectBound = '1';
    document.addEventListener('focusin', (event) => {
      const el = event.target;
      if (!isTextInput(el)) return;
      requestAnimationFrame(() => {
        if(typeof el.select==='function') el.select();
      });
    });
  }
  /* 갱신·초기화 */
  function scheduleApply() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(() => {
      state.raf = 0;
      const { w, h } = getViewportSize();
      const portrait = h > w;
      const widthChanged = Math.abs(w - state.layoutWidth) > 1;
      const orientationChanged = state.layoutPortrait !== portrait;
      if (widthChanged || orientationChanged) applyMode();
      else updateMobileOffsets();
    });
  }
  function scheduleResumeApply() {
    if (state.resumeRaf) return;
    state.resumeRaf = requestAnimationFrame(() => {
      state.resumeRaf = 0;
      applyMode();
    });
  }
  function markResponsiveReady() {
    window.__dpsResponsiveLayoutReady = true;
    if (typeof window.dpsMarkResponsiveLayoutReady === 'function') {
      window.dpsMarkResponsiveLayoutReady();
    }
  }

  function initializeResponsiveLayout() {
    if (state.initialized) {
      markResponsiveReady();
      return;
    }
    state.initialized = true;
    applyMode();
    bindInputAutoSelect();
    markResponsiveReady();
  }
  function syncResponsiveLayout() {
    if (!state.initialized) {
      initializeResponsiveLayout();
      return;
    }
    applyMode();
    markResponsiveReady();
  }
  window.dpsSyncResponsiveLayout = syncResponsiveLayout;
  // Script loading: data → calc → app → preset. Initialize only after preset has loaded.
  window.dpsInitializeResponsiveLayout = initializeResponsiveLayout;
  window.addEventListener('resize', scheduleApply, { passive: true });
  window.addEventListener('orientationchange', scheduleApply, { passive: true });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleApply, { passive: true });
  window.addEventListener('pageshow', scheduleResumeApply, { passive: true });
  window.addEventListener('focus', scheduleResumeApply, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleResumeApply();
  }, { passive: true });
  window.addEventListener('load', updateMobileOffsets, { once: true });
})();

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
  return '<button class="ui-toggle-btn zero-star-toggle" data-action="zeroScoreStar" type="button" aria-pressed="false" aria-label="24 스타 미적용">24 스타 미적용</button>';
}
function buildZeroScoreCalcRow(config){
  const name=escapeHtml(config.name);
  const penance=config.type==='penance';
  const generalCurrent=penance ? zeroScorePenanceSelectHtml('zero-calc-current',`${config.name} 일반 현재`) : zeroScoreInputHtml('zero-calc-current',{label:`${config.name} 일반 현재`});
  const generalTarget=penance ? zeroScorePenanceSelectHtml('zero-calc-target',`${config.name} 일반 목표`) : zeroScoreInputHtml('zero-calc-target',{label:`${config.name} 일반 목표`});
  const honorCurrent=penance ? zeroScoreHonorSelectHtml(config.currentHonorClass,`${config.name} 명예 현재`) : zeroScoreInputHtml(config.currentHonorClass,{...config.honorOptions,label:`${config.name} 명예 현재`});
  const honorTarget=penance ? zeroScoreHonorSelectHtml(config.targetHonorClass,`${config.name} 명예 목표`) : zeroScoreInputHtml(config.targetHonorClass,{...config.honorOptions,label:`${config.name} 명예 목표`});
  const group=(label,note,cssClass,current,target)=>`<section class="zero-calc-group ${cssClass}"><div class="zero-calc-group-head"><strong>${label}</strong><small>${note}</small></div><div class="zero-calc-pair"><label class="zero-calc-field"><span>현재</span>${current}</label><span class="zero-calc-arrow" aria-hidden="true">→</span><label class="zero-calc-field"><span>목표</span>${target}</label></div></section>`;
  return `<article class="zero-calc-row" data-row-type="${config.type}">
    <button class="zero-calc-row-head" type="button" aria-expanded="false" aria-label="${name} 승단 점수 입력 펼치기">
      <span class="zero-calc-name"><span class="zero-calc-row-symbol" aria-hidden="true">✦</span><strong>${name}</strong><small>${penance?'DIFFICULTY':'CHALLENGE TOWER'}</small></span>
      <span class="zero-calc-score"><span>추가점수</span><b class="zero-row-score">0</b><small>POINTS</small></span>
    </button>
    <div class="zero-calc-details" hidden>
      <div class="zero-calc-fields">
        ${group(penance?'일반 고행':'도전의탑','현재 → 목표','zero-calc-general',generalCurrent,generalTarget)}
        ${group(penance?'명예':'명예의탑','현재 → 목표','zero-calc-honor',honorCurrent,honorTarget)}
      </div>
      ${config.star !== false ? `<div class="zero-calc-star"><span class="zero-calc-star-copy"><strong>24스타 보너스</strong><small>적용 시 +2점 · 기존 계산 유지</small></span>${zeroScoreStarButtonHtml()}</div>` : ''}
    </div>
  </article>`;
}
function buildZeroPenanceCalcRow(name){
  return buildZeroScoreCalcRow({type:'penance',name,currentHonorClass:'zero-current-honor zero-honor-input',targetHonorClass:'zero-target-honor zero-honor-input',honorOptions:{inputmode:'latin',maxlength:2,placeholder:'B'}});
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
  setTogglePressed(starBtn, active, {activeText:'24 스타 적용중', inactiveText:'24 스타 미적용'});
  if(starBtn) starBtn.setAttribute('aria-label',active?'24 스타 적용중':'24 스타 미적용');
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
  const details=header?.nextElementSibling;
  if(!details?.classList.contains('zero-calc-details')) return;
  header.setAttribute('aria-expanded',String(expanded));
  header.setAttribute('aria-label',`${header.querySelector('.zero-calc-name strong')?.textContent || '승단'} 승단 점수 입력 ${expanded?'접기':'펼치기'}`);
  details.hidden=!expanded;
}
function setAllZeroScoreRowsExpanded(expanded){
  $('zeroScoreRows')?.querySelectorAll('.zero-calc-row-head').forEach(header=>setZeroScoreRowExpanded(header,expanded));
}
function bindZeroScoreCalculator(){
  if(document.documentElement.dataset.zeroScoreCalcBound==='1') return;
  document.documentElement.dataset.zeroScoreCalcBound='1';
  const rows=$('zeroScoreRows');
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
  applyTraitRecommendation:(trigger)=>applyTraitRecommendation(+trigger.dataset.row,+trigger.dataset.amount),
  applyTraitRecommendationPlan:()=>applyCurrentTraitRecommendationPlan(),
  refundTraitRecommendations:()=>requestConfirmAction('refundTraitRecommendations','한 번 더 누르면 추천 투자만 전체환불',refundTraitRecommendations),
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
  openSanctuarySkillModal:()=>window.DpsModal.openBoardModal('sanctuarySkillModal'),
  openBusPassengerModal:()=>window.DpsModal.openBoardModal('busPassengerModal'),
  openZeroRankInfoModal:()=>window.DpsModal.openBoardModal('zeroRankInfoModal'),
  zeroScoreStar:(trigger)=>toggleZeroScoreStar(trigger),
  expandAllZeroScoreRows:()=>setAllZeroScoreRowsExpanded(true),
  collapseAllZeroScoreRows:()=>setAllZeroScoreRowsExpanded(false),
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
  collapseAllTraitTiers:()=>setAllTraitTiersExpanded(false),
  expandAllTraitTiers:()=>setAllTraitTiersExpanded(true),
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
    bindFontScaleViewportGuard, bindActionEvents, bindTraitHoldEvents, bindTraitInputEvents,
    ()=>window.DpsModal.bindEvents(), ()=>window.DpsPreset.bindEvents(), bindJewelImageEvents,
    bindZeroScoreCalculator, bindTraitLimitDisplayEvents, bindTraitLimitChoiceEvents, bindDpsBaseUnitControlEvents, bindReactiveInputs,
    bindButtonPressFeedback, bindDamageBoardTabEvents, bindDamageBoardSwitchEvents, bindAppTitleVersion
  ].forEach(fn=>fn());
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
    window.dpsInitializeResponsiveLayout();
    initApp();
    markAppReady();
  }catch(e){
    markAppError('D1001', e);
  }
};
