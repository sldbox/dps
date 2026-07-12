/* ===== preset.js | 저장·복구·특성 프리셋·프리셋 분석 ===== */

/* app.js의 화면·계산 API를 사용하며 브라우저 저장, 프리셋 저장소, 가져오기·내보내기·분석을 관리한다. */
/* ===== 00. 공통 상수 / 저장값 정규화 ===== */
const STORAGE_VERSION=DPS_CONFIG.storage.version;
const STORAGE_SCOPE=DPS_CONFIG.storage.scope;
const STORAGE_KEY=DPS_CONFIG.storage.key;
const CLIENT_KEY=DPS_CONFIG.storage.clientKey;
const TRAIT_PRESET_STORAGE_KEY=DPS_CONFIG.storage.traitPresetKey || 'gbd_dps_calculator:trait_presets';
const TRAIT_PRESET_FILE_TYPE='sld_dps_trait_presets';
const TRAIT_PRESET_FILE_VERSION=2;
const TRAIT_PRESET_SCHEMA_VERSION=2;
const TRAIT_PRESET_MIN_FILE_VERSION=2;
const TRAIT_PRESET_MIN_SCHEMA_VERSION=2;
const TRAIT_PRESET_UNIT_BOARD_SCHEMA_VERSION=2;
const TRAIT_PRESET_JEWEL_SETTINGS_SCHEMA_VERSION=1;
// 유닛 보드는 로컬 저장에는 포함하고, 프리셋에서는 파일 하단 전용 구역으로 분리한다.
const TRAIT_PRESET_EXCLUDED_VALUE_IDS=new Set([
  'dpsBaseUnits','dpsBaseUnitSlots','dpsJewelSettings','dpsNormalJewelSettings','dpsNormalJewelAssignments','dpsBaseUnitSlotExpansions',
  ...dpsBaseUnitQuantityIds(),
  ...dpsBaseUnitSettingIds()
]);
function isTraitPresetExcludedValueId(id){
  return TRAIT_PRESET_EXCLUDED_VALUE_IDS.has(String(id || ''));
}
const TRAIT_PRESET_NAME_PLACEHOLDER='예시) 더파300라버스';
const TRAIT_PRESET_UNSUPPORTED_OLD_MESSAGE='구버전 프리셋은 더 이상 지원하지 않습니다.\n호환 엑셀버전: 5.4392\n엑셀 파일을 다시 불러온 뒤, 새 특성 프리셋을 생성해 주세요.';
const TRAIT_PRESET_SINGLE_UPDATE_VALUE_IDS=new Set([
  'diff','penance','round','challengeTowerFloor','soloMode','coopMode','coopPassenger2Dr','coopPassenger3Dr','team','pbless','spBankApply',
  'overEnhance','repairEnhance','enhanceMaster',
  'prodArtifact','prodNova','prodTeratron','prodAmon','prodAdun','prodKerrigan','prodOvermind','prodNarud',
  'flowerSkill1','flowerSkill2','flowerSkill3',
  'traitLimitAD','traitLimitAS','traitLimitCRI','traitLimitCD','traitLimitMC','traitLimitDR','traitLimitTD','traitLimitUA','traitLimitMultiTarget','traitLimitInfinite'
]);
const TRAIT_PRESET_UPDATE_SCOPE_KIND_ORDER=Object.freeze([
  '기본 정보','룬효과 버프','룬정보','에디셔널','인챈트 레벨 / 결과','특성 보드','특성 투자 제한','더제로 승단 정보','성소 보드','쥬얼 설정','유닛 보드'
]);
const TRAIT_PRESET_UPDATE_SCOPE_HIDDEN_VALUE_IDS=new Set(['enchantCode']);
const TRAIT_PRESET_UPDATE_SCOPE_EXTRA_GROUPS=Object.freeze({
  shared:Object.freeze([
    Object.freeze({kind:'더제로 승단 정보',names:Object.freeze(['계산'])}),
    Object.freeze({kind:'쥬얼 설정',names:Object.freeze(['일반 쥬얼','전설·신화 쥬얼'])})
  ]),
  single:Object.freeze([
    Object.freeze({kind:'특성 보드',names:Object.freeze(['투자수'])}),
    Object.freeze({kind:'유닛 보드',names:Object.freeze(['유닛 정보','수량','강화 기대값','한계 돌파','전설·신화 쥬얼','일반 쥬얼 선택 슬롯','슬롯 확장','공허의 힘'])})
  ])
});
function isTraitPresetFileType(type){
  return type===TRAIT_PRESET_FILE_TYPE;
}
function isUnsupportedOldTraitPresetError(error){
  return String(error?.message || error || '')===TRAIT_PRESET_UNSUPPORTED_OLD_MESSAGE;
}
function showUnsupportedOldTraitPresetToast(){
  cancelScheduledAutoSaveToast();
  showToast(TRAIT_PRESET_UNSUPPORTED_OLD_MESSAGE,'err',10000);
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
function normalizeStoredElementValue(id, value){
  if(id==='dpsBaseUnits') return normalizeDpsBaseUnitsValue(value);
  if(id==='dpsBaseUnitSlots') return serializeDpsBaseUnitSlots(value);
  if(id==='dpsJewelSettings') return serializeDpsJewelSettings(value);
  if(id==='dpsNormalJewelSettings') return serializeDpsNormalJewelSettings(value);
  if(id==='dpsNormalJewelAssignments') return serializeDpsNormalJewelAssignments(value);
  if(id==='dpsBaseUnitSlotExpansions') return serializeDpsBaseUnitSlotExpansions(value);
  if(dpsBaseUnitQuantityIds().includes(id)) return normalizeDpsBaseUnitQuantityValue(value);
  if(DPS_BASE_UNIT_ENHANCE_IDS.has(id)) return normalizeDpsBaseUnitEnhanceValue(value);
  if(DPS_BASE_UNIT_LIMIT_BREAK_IDS.has(id)) return normalizeDpsBaseUnitLimitBreakValue(value);
  if(DPS_BASE_UNIT_JEWEL_IDS.has(id)) return normalizeDpsJewelName(value);
  if(DPS_BASE_UNIT_VOID_POWER_IDS.has(id)) return normalizeDpsBaseUnitVoidPowerValue(value);
  if(SHARD_VALUE_IDS.has(id)) return normalizeShardStorageValue(value);
  if(NORMALIZED_MONEY_VALUE_IDS.has(id)) return normalizeMoneyStorageValue(value, id);
  return value;
}
function readElementValue(el){
  if(el.type==='checkbox') return !!el.checked;
  if(el.type==='radio') return el.checked ? el.value : undefined;
  if(EROSION_CONTROL_IDS.has(el.id)) return erosionStoredValue(el.id);
  if(el.id==='round') return targetRoundStoredValue();
  if(el.id==='challengeTowerFloor') return challengeTowerFloorStoredValue();
  if(el.id==='penance') return penanceStoredValue();
  return normalizeStoredElementValue(el.id, el.value);
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
  value=normalizeStoredElementValue(el.id, value);
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
/* ----- 00-1. 브라우저 상태 캡처 / 적용 ----- */
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
  out.dpsBaseUnits=normalizeDpsBaseUnitsValue(out.dpsBaseUnits ?? '');
  if(hasOwn(out,'dpsBaseUnitSlots')) out.dpsBaseUnitSlots=serializeDpsBaseUnitSlots(out.dpsBaseUnitSlots);
  if(hasOwn(out,'dpsJewelSettings')) out.dpsJewelSettings=serializeDpsJewelSettings(out.dpsJewelSettings);
  if(hasOwn(out,'dpsNormalJewelSettings')) out.dpsNormalJewelSettings=serializeDpsNormalJewelSettings(out.dpsNormalJewelSettings);
  if(hasOwn(out,'dpsBaseUnitSlotExpansions')) out.dpsBaseUnitSlotExpansions=serializeDpsBaseUnitSlotExpansions(out.dpsBaseUnitSlotExpansions);
  if(hasOwn(out,'dpsNormalJewelAssignments')) out.dpsNormalJewelAssignments=serializeDpsNormalJewelAssignments(out.dpsNormalJewelAssignments);
  dpsBaseUnitQuantityIds().forEach(id=>{ if(hasOwn(out,id)) out[id]=normalizeDpsBaseUnitQuantityValue(out[id]); });
  DPS_BASE_UNIT_ENHANCE_IDS.forEach(id=>{ if(hasOwn(out,id)) out[id]=normalizeDpsBaseUnitEnhanceValue(out[id]); });
  DPS_BASE_UNIT_LIMIT_BREAK_IDS.forEach(id=>{ if(hasOwn(out,id)) out[id]=normalizeDpsBaseUnitLimitBreakValue(out[id]); });
  DPS_BASE_UNIT_JEWEL_IDS.forEach(id=>{ if(hasOwn(out,id)) out[id]=normalizeDpsJewelName(out[id]); });
  DPS_BASE_UNIT_VOID_POWER_IDS.forEach(id=>{ if(hasOwn(out,id)) out[id]=normalizeDpsBaseUnitVoidPowerValue(out[id]); });
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
  const sourceValues=(data.values && typeof data.values==='object') ? data.values : {};
  const rawValues={...sourceValues};
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


function sanitizeTraitPresetValues(values){
  const out={...sanitizeSavedValues(values)};
  Object.keys(out).forEach(id=>{
    if(isTraitPresetExcludedValueId(id)) delete out[id];
  });
  return out;
}
function normalizeTraitPresetState(data){
  const normalized=normalizeSavedState(data);
  if(!normalized) return null;
  const values=sanitizeTraitPresetValues(normalized.values);
  const inv={...normalized.inv};
  syncSpBankPresetState(values, inv);
  const hasZeroScore=!!(normalized.zeroScore && Array.isArray(normalized.zeroScore.rows));
  if(!Object.keys(values).length && !Object.keys(inv).length && !hasZeroScore) return null;
  return makeStorageEnvelope({
    values,
    inv,
    zeroScore:normalized.zeroScore,
    savedAt:normalized.savedAt,
    schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,
    storageVersion:normalized.storageVersion,
    scope:normalized.scope,
    ui:normalized.ui,
    clientId:normalized.clientId
  });
}
function makeTraitPresetStateObject(sourceState=makeStateObject()){
  return normalizeTraitPresetState(sourceState);
}
/* ----- 00-2. 프리셋별 유닛 보드 / 공용 쥬얼 확장 ----- */
function normalizeTraitPresetUnitBoardState(value){
  const source=value && typeof value==='object' && !Array.isArray(value) ? value : {};
  const validUnits=new Set(dpsBaseUnitList().map(unit=>unit.id));
  const usedUnits=new Set();
  const usedSlots=new Set();
  const units=[];
  (Array.isArray(source.units) ? source.units : []).forEach((item,index)=>{
    if(!item || typeof item!=='object') return;
    const unitId=String(item.unitId || item.id || '').trim();
    const unit=dpsBaseUnitById(unitId);
    if(!validUnits.has(unitId) || !unit || usedUnits.has(unitId)) return;
    let slot=Math.max(0,Math.min(dpsBaseUnitSelectionLimit()-1,Math.round(Number(item.slot ?? index)||0)));
    while(usedSlots.has(slot) && slot<dpsBaseUnitSelectionLimit()-1) slot++;
    if(usedSlots.has(slot)) slot=Array.from({length:dpsBaseUnitSelectionLimit()},(_,i)=>i).find(i=>!usedSlots.has(i));
    if(slot===undefined) return;
    usedUnits.add(unitId);
    usedSlots.add(slot);
    const quantity=dpsBaseUnitHasQuantity(unit)
      ? Math.max(1,Number(normalizeDpsBaseUnitQuantityValue(item.quantity ?? item.count ?? 1))||1)
      : 1;
    units.push({
      unitId,
      slot,
      quantity,
      enhanceExpected:Number(normalizeDpsBaseUnitEnhanceValue(item.enhanceExpected ?? item.reinforceExpected ?? item.enhance ?? 0))||0,
      limitBreak:Number(normalizeDpsBaseUnitLimitBreakValue(item.limitBreak ?? 0))||0,
      voidPower:normalizeDpsBaseUnitVoidPowerValue(item.voidPower),
      legendaryMythicJewel:normalizeDpsJewelName(item.legendaryMythicJewel ?? item.jewel ?? '')
    });
  });
  units.sort((a,b)=>a.slot-b.slot);
  const usedLegendaryJewels=new Set();
  units.forEach(item=>{
    const name=normalizeDpsJewelName(item.legendaryMythicJewel);
    item.legendaryMythicJewel=name && !usedLegendaryJewels.has(name) ? name : '';
    if(item.legendaryMythicJewel) usedLegendaryJewels.add(item.legendaryMythicJewel);
  });
  const unitMap=new Map(units.map(item=>[item.unitId,item]));
  units.forEach(item=>{ if(item.unitId==='prodNarud') item.voidPower='OFF'; });
  if(!unitMap.has('prodNarud')) units.forEach(item=>{ item.voidPower='OFF'; });
  const slotExpansions=normalizeDpsBaseUnitSlotExpansions(source.slotExpansions || source.expandedSlots || [])
    .filter(unitId=>unitMap.has(unitId));
  const rawAssignments=source.normalJewelAssignments && typeof source.normalJewelAssignments==='object' && !Array.isArray(source.normalJewelAssignments)
    ? source.normalJewelAssignments
    : {};
  const normalizedAssignments=normalizeDpsNormalJewelAssignments(rawAssignments,units.map(item=>item.unitId));
  const normalJewelAssignments=Object.fromEntries(Object.entries(normalizedAssignments).filter(([unitId])=>unitMap.has(unitId)));
  return {
    schemaVersion:TRAIT_PRESET_UNIT_BOARD_SCHEMA_VERSION,
    units,
    slotExpansions,
    normalJewelAssignments
  };
}
function captureTraitPresetUnitBoardState(){
  ensureDpsBaseUnitStore();
  const assignments=normalizeDpsNormalJewelAssignments($('dpsNormalJewelAssignments')?.value || '{}',currentDpsBaseUnitSlots());
  const units=currentDpsBaseUnitSlots().map((unitId,slot)=>{
    const unit=dpsBaseUnitById(unitId);
    if(!unit) return null;
    return {
      unitId,
      slot,
      quantity:dpsBaseUnitHasQuantity(unit) ? Number(normalizeDpsBaseUnitQuantityValue(dpsBaseUnitQuantityInput(unit)?.value || 1)) : 1,
      enhanceExpected:Number(normalizeDpsBaseUnitEnhanceValue(dpsBaseUnitEnhanceInput(unit)?.value || 0))||0,
      limitBreak:Number(normalizeDpsBaseUnitLimitBreakValue(dpsBaseUnitLimitBreakInput(unit)?.value || 0))||0,
      voidPower:normalizeDpsBaseUnitVoidPowerValue(dpsBaseUnitVoidPowerInput(unit)?.value),
      legendaryMythicJewel:normalizeDpsJewelName(dpsBaseUnitJewelInput(unit)?.value)
    };
  }).filter(Boolean);
  const selectedIds=new Set(units.map(item=>item.unitId));
  const selectedAssignments=Object.fromEntries(Object.entries(assignments).filter(([unitId])=>selectedIds.has(unitId)));
  return normalizeTraitPresetUnitBoardState({
    units,
    slotExpansions:dpsBaseUnitSlotExpansionIds().filter(unitId=>selectedIds.has(unitId)),
    normalJewelAssignments:selectedAssignments
  });
}
function applyTraitPresetUnitBoardState(value,options={}){
  const state=normalizeTraitPresetUnitBoardState(value);
  ensureDpsBaseUnitStore();
  const assignmentStore=$('dpsNormalJewelAssignments');
  const expansionStore=$('dpsBaseUnitSlotExpansions');
  if(assignmentStore) assignmentStore.value=serializeDpsNormalJewelAssignments(state.normalJewelAssignments);
  if(expansionStore) expansionStore.value=serializeDpsBaseUnitSlotExpansions(state.slotExpansions);
  dpsBaseUnitList().forEach(unit=>{
    if(dpsBaseUnitHasQuantity(unit)){
      const input=dpsBaseUnitQuantityInput(unit);
      if(input) input.value='0';
    }
    const enhance=dpsBaseUnitEnhanceInput(unit);
    const limitBreak=dpsBaseUnitLimitBreakInput(unit);
    const jewel=dpsBaseUnitJewelInput(unit);
    const voidPower=dpsBaseUnitVoidPowerInput(unit);
    if(enhance) enhance.value='0';
    if(limitBreak) limitBreak.value='0';
    if(jewel) jewel.value='';
    if(voidPower) voidPower.value='OFF';
  });
  const slots=emptyDpsBaseUnitSlots();
  state.units.forEach(item=>{
    const unit=dpsBaseUnitById(item.unitId);
    if(!unit) return;
    slots[item.slot]=item.unitId;
    if(dpsBaseUnitHasQuantity(unit)){
      const quantity=dpsBaseUnitQuantityInput(unit);
      if(quantity) quantity.value=normalizeDpsBaseUnitQuantityValue(item.quantity);
    }
    const enhance=dpsBaseUnitEnhanceInput(unit);
    const limitBreak=dpsBaseUnitLimitBreakInput(unit);
    const jewel=dpsBaseUnitJewelInput(unit);
    const voidPower=dpsBaseUnitVoidPowerInput(unit);
    if(enhance) enhance.value=normalizeDpsBaseUnitEnhanceValue(item.enhanceExpected);
    if(limitBreak) limitBreak.value=normalizeDpsBaseUnitLimitBreakValue(item.limitBreak);
    if(jewel) jewel.value=normalizeDpsJewelName(item.legendaryMythicJewel);
    if(voidPower) voidPower.value=normalizeDpsBaseUnitVoidPowerValue(item.voidPower);
  });
  if(options.resetArtifactView!==false) setArtifactDpsViewEnabled(false);
  setDpsBaseUnitStoredValue(slots.filter(Boolean),false,{slots,preserveQuantities:true});
  syncDpsBaseUnitControl();
  if(options.recalculate!==false) recalc();
  return state;
}
function normalizeTraitPresetJewelSettings(value){
  if(!value || typeof value!=='object' || Array.isArray(value)) return null;
  const legendarySource=value.legendaryMythicJewels || value.legendaryMythic || value.jewelSettings;
  const normalSource=value.normalJewels || value.normal || value.normalJewelSettings;
  if(legendarySource===undefined && normalSource===undefined) return null;
  return {
    schemaVersion:TRAIT_PRESET_JEWEL_SETTINGS_SCHEMA_VERSION,
    legendaryMythicJewels:normalizeDpsJewelSettings(legendarySource || {}),
    normalJewels:normalizeDpsNormalJewelSettings(normalSource || {})
  };
}
function captureTraitPresetJewelSettings(){
  return normalizeTraitPresetJewelSettings({
    legendaryMythicJewels:dpsJewelSettingsObject(),
    normalJewels:dpsNormalJewelSettingsObject()
  });
}
function applyTraitPresetJewelSettings(value){
  const settings=normalizeTraitPresetJewelSettings(value);
  if(!settings) return null;
  const legendaryStore=$('dpsJewelSettings');
  const normalStore=$('dpsNormalJewelSettings');
  if(legendaryStore) legendaryStore.value=serializeDpsJewelSettings(settings.legendaryMythicJewels);
  if(normalStore) normalStore.value=serializeDpsNormalJewelSettings(settings.normalJewels);
  sanitizeDpsJewelSelections();
  renderDpsJewelConfigGrid();
  renderDpsNormalJewelConfigGrid();
  return settings;
}
function emptyTraitPresetUnitBoardStore(){
  return {schemaVersion:TRAIT_PRESET_UNIT_BOARD_SCHEMA_VERSION,presets:{}};
}
function normalizeTraitPresetUnitBoardStore(value,validPresetIds=[]){
  const requestedIds=[...new Set(validPresetIds.map(id=>String(id || '')).filter(Boolean))];
  const validIds=new Set(requestedIds);
  const source=value && typeof value==='object' && !Array.isArray(value) ? value : {};
  const sourcePresets=source.presets && typeof source.presets==='object' && !Array.isArray(source.presets) ? source.presets : {};
  const presets={};
  Object.entries(sourcePresets).forEach(([presetId,state])=>{
    const id=String(presetId || '');
    if(!id || (validIds.size && !validIds.has(id))) return;
    presets[id]=normalizeTraitPresetUnitBoardState(state);
  });
  return {schemaVersion:TRAIT_PRESET_UNIT_BOARD_SCHEMA_VERSION,presets};
}
function traitPresetHasUnitBoard(store,presetId){
  return !!(store?.unitBoard?.presets && hasOwn(store.unitBoard.presets,String(presetId || '')));
}
function traitPresetUnitBoardState(store,presetId){
  return traitPresetHasUnitBoard(store,presetId) ? normalizeTraitPresetUnitBoardState(store.unitBoard.presets[String(presetId || '')]) : null;
}
function traitPresetUnitBoardHasValues(value){
  const state=normalizeTraitPresetUnitBoardState(value);
  return state.units.length>0 || Object.keys(state.normalJewelAssignments).length>0;
}
function missingTraitPresetUnitBoardIds(store){
  return (store?.presets || []).map(preset=>String(preset.id || '')).filter(id=>id && !traitPresetHasUnitBoard(store,id));
}
function initializeMissingTraitPresetUnitBoards(store,selectedId,currentState){
  const missingIds=missingTraitPresetUnitBoardIds(store);
  missingIds.forEach(id=>{
    const state=id===String(selectedId || '') ? currentState : normalizeTraitPresetUnitBoardState(null);
    setTraitPresetUnitBoardState(store,id,state);
  });
  return missingIds;
}
function setTraitPresetUnitBoardState(store,presetId,state){
  const out=store && typeof store==='object' ? store : emptyTraitPresetStore();
  const validIds=(out.presets || []).map(preset=>preset.id);
  out.unitBoard=normalizeTraitPresetUnitBoardStore(out.unitBoard,validIds);
  out.unitBoard.presets[String(presetId || '')]=normalizeTraitPresetUnitBoardState(state);
  return out;
}
function deleteTraitPresetUnitBoardState(store,presetId){
  if(store?.unitBoard?.presets) delete store.unitBoard.presets[String(presetId || '')];
  return store;
}
function resetTraitPresetUnitBoardValues(values){
  const out={...(values || {})};
  out.dpsBaseUnits='';
  out.dpsBaseUnitSlots='';
  dpsBaseUnitQuantityIds().forEach(id=>{ out[id]='0'; });
  DPS_BASE_UNIT_ENHANCE_IDS.forEach(id=>{ out[id]='0'; });
  DPS_BASE_UNIT_LIMIT_BREAK_IDS.forEach(id=>{ out[id]='0'; });
  DPS_BASE_UNIT_JEWEL_IDS.forEach(id=>{ out[id]=''; });
  DPS_BASE_UNIT_VOID_POWER_IDS.forEach(id=>{ out[id]='OFF'; });
  out.dpsNormalJewelAssignments='{}';
  return out;
}
function mergeTraitPresetWithLocalState(presetState, localState, options={}){
  const preset=normalizeTraitPresetState(presetState);
  if(!preset) return null;
  const local=normalizeSavedState(localState) || makePublicDefaultState();
  let values=options.preserveSharedValues===true
    ? {...preset.values, ...local.values}
    : {...local.values, ...preset.values};
  values=resetTraitPresetUnitBoardValues(values);
  return makeStorageEnvelope({
    values,
    inv:{...preset.inv},
    zeroScore:preset.zeroScore,
    savedAt:preset.savedAt,
    storageVersion:local.storageVersion || preset.storageVersion,
    scope:local.scope || preset.scope,
    ui:preset.ui,
    clientId:local.clientId || preset.clientId
  });
}
function buildTraitPresetApplyState(preset, options={}){
  return mergeTraitPresetWithLocalState(preset?.state, makeStateObject(), options);
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
  renderTraitPresetUpdateStatus();
  cancelScheduledAutoSaveToast();
  autoSaveToastTimer=setTimeout(()=>{
    autoSaveToastTimer=0;
    const saved=saveState({silent:true});
    if(saved!==false){
      renderTraitPresetUpdateStatus();
      notifyStorageAction('저장됨','ok',{statusAction:'save'});
    }
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
    if(!hasOwn(sanitizedValues,'dpsBaseUnitSlots')){
      const slotInput=$('dpsBaseUnitSlots');
      if(slotInput) slotInput.value='';
    }
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
    syncDpsBaseUnitControl();
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
    try{return JSON.parse(item);}catch(error){
      if(item===attempts[attempts.length-1]) rememberAppIssue('warn','JSON 파싱',error);
    }
  }
  return null;
}
const TRAIT_PRESET_STATUS_STORAGE_KEY=DPS_CONFIG.storage.traitPresetStatusKey || 'gbd_dps_calculator:trait_preset_status';
function emptyTraitPresetStatusData(){
  return {updatedPresetIds:[],lastAction:'latest',selectedTraitPresetId:'',pendingJewelSettings:false,pendingUnitBoardPresetIds:[]};
}
function normalizeTraitPresetStatusData(data){
  const base=emptyTraitPresetStatusData();
  if(!data || typeof data!=='object' || Array.isArray(data)) return base;
  const updatedPresetIds=Array.isArray(data.updatedPresetIds)
    ? [...new Set(data.updatedPresetIds.map(id=>String(id || '').trim()).filter(Boolean))]
    : [];
  const lastAction=String(data.lastAction || base.lastAction || 'latest');
  const selectedTraitPresetId=String(data.selectedTraitPresetId || '').trim();
  const pendingJewelSettings=data.pendingJewelSettings===true;
  const pendingUnitBoardPresetIds=Array.isArray(data.pendingUnitBoardPresetIds)
    ? [...new Set(data.pendingUnitBoardPresetIds.map(id=>String(id || '').trim()).filter(Boolean))]
    : [];
  return {updatedPresetIds,lastAction,selectedTraitPresetId,pendingJewelSettings,pendingUnitBoardPresetIds};
}
/* ----- 00-3. 프리셋 상태 표시 / 최신화 판정 ----- */
function loadTraitPresetStatusData(){
  try{
    const raw=localStorage.getItem(TRAIT_PRESET_STATUS_STORAGE_KEY);
    if(!raw) return emptyTraitPresetStatusData();
    const parsed=safeJsonParse(raw);
    if(parsed && typeof parsed==='object') return normalizeTraitPresetStatusData(parsed);
  }catch(error){
    logAppWarn('프리셋 상태 불러오기', error);
  }
  return emptyTraitPresetStatusData();
}
function saveTraitPresetStatusData(data){
  const normalized=normalizeTraitPresetStatusData(data);
  try{ localStorage.setItem(TRAIT_PRESET_STATUS_STORAGE_KEY, JSON.stringify(normalized)); }catch(error){ logAppWarn('프리셋 상태 저장', error); }
  return normalized;
}
function currentTraitPresetStatusData(partial={}){
  const status=normalizeTraitPresetStatusData({...loadTraitPresetStatusData(), ...partial});
  const store=loadTraitPresetStore();
  const validIds=new Set(store.presets.map(preset=>preset.id));
  status.updatedPresetIds=status.updatedPresetIds.filter(id=>validIds.has(id));
  status.pendingUnitBoardPresetIds=status.pendingUnitBoardPresetIds.filter(id=>validIds.has(id));
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
function clearTraitPresetUpdatedStatus(action='latest',options={}){
  const partial={updatedPresetIds:[],lastAction:action};
  if(options.keepPending!==true){
    partial.pendingJewelSettings=false;
    partial.pendingUnitBoardPresetIds=[];
  }
  updateTraitPresetStatus(partial,{persist:true});
}
function stageTraitPresetJewelSettings(settings){
  const store=loadTraitPresetStore();
  const imported=normalizeTraitPresetJewelSettings(settings);
  const stored=normalizeTraitPresetJewelSettings(store.jewelSettings);
  const jewelChanged=!stored || stableTraitPresetValue(stored)!==stableTraitPresetValue(imported);
  const pendingUnitBoardPresetIds=missingTraitPresetUnitBoardIds(store);
  const needsExtensionUpdate=(!stored && jewelChanged) || pendingUnitBoardPresetIds.length>0;
  updateTraitPresetStatus({
    pendingJewelSettings:jewelChanged,
    pendingUnitBoardPresetIds:needsExtensionUpdate ? pendingUnitBoardPresetIds : [],
    lastAction:'import'
  },{persist:true});
  return {jewelChanged,pendingUnitBoardPresetIds,needsUpdate:needsExtensionUpdate};
}
function markTraitPresetJewelSettingsPending(){
  const store=loadTraitPresetStore();
  const stored=normalizeTraitPresetJewelSettings(store.jewelSettings);
  const current=captureTraitPresetJewelSettings();
  const pendingJewelSettings=!stored || stableTraitPresetValue(stored)!==stableTraitPresetValue(current);
  const previous=loadTraitPresetStatusData();
  updateTraitPresetStatus({
    pendingJewelSettings,
    pendingUnitBoardPresetIds:pendingJewelSettings ? missingTraitPresetUnitBoardIds(store) : previous.pendingUnitBoardPresetIds,
    lastAction:'edit'
  },{persist:true});
  renderTraitPresetUpdateStatus(store);
}
function notifyStorageAction(message, type='ok', options={}){
  if(type==='ok' && options.statusAction && !options.skipHeaderStatus){
    updateTraitPresetStatus({lastAction:options.statusAction},{persist:true});
  }
  showToast(message, type);
}
function notifyTraitPresetExportComplete(){
  clearTraitPresetUpdatedStatus('export',{keepPending:true});
  refreshTraitPresetControls(selectedTraitPresetId());
  showToast('특성 프리셋 내보내기 완료', 'ok');
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
    logAppError('saveState',e);
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
/* ===== 01. 프리셋 저장소 / 저장·불러오기 ===== */
/* ----- 01-1. 프리셋 저장소 정규화 / 선택 UI ----- */
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
  return {type:TRAIT_PRESET_FILE_TYPE,fileVersion:TRAIT_PRESET_FILE_VERSION,schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,storageVersion:STORAGE_VERSION,updatedAt:Date.now(),defaultPresetId:'',presets:[],jewelSettings:null,unitBoard:emptyTraitPresetUnitBoardStore()};
}
function hasTraitPresetTowerFloorField(state){
  const values=(state && typeof state==='object' && state.values && typeof state.values==='object') ? state.values : {};
  return hasOwn(values,'challengeTowerFloor');
}
function dispatchTraitPresetStoreChanged(detail={}){
  try{ window.dispatchEvent(new CustomEvent('dps:traitPresetStoreChanged',{detail})); }catch(error){ logAppWarn('프리셋 변경 이벤트', error); }
}
function markPresetStateCurrentVersion(state){
  const normalized=normalizeTraitPresetState(state);
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
  const unitBoard=normalizeTraitPresetUnitBoardStore(source.unitBoard,presets.map(preset=>preset.id));
  const jewelSettings=normalizeTraitPresetJewelSettings(source.jewelSettings);
  return {
    type:TRAIT_PRESET_FILE_TYPE,
    fileVersion:TRAIT_PRESET_FILE_VERSION,
    schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,
    storageVersion:STORAGE_VERSION,
    updatedAt:Date.now(),
    defaultPresetId:'',
    presets,
    jewelSettings,
    unitBoard
  };
}
function traitPresetMetaFromValues(values={}){
  const coopMode=normalizeOnOffValue(values.coopMode,'OFF')==='ON';
  const tower=isTowerDifficulty(values.diff);
  const towerFloor=normalizedTowerFloorString(values.challengeTowerFloor || TOWER_FLOOR_INPUT_MIN);
  return {
    diff:String(values.diff || ''),
    penance:String(values.penance || '0'),
    round:String(values.round || '1'),
    challengeTowerFloor:towerFloor,
    mode:tower ? `${towerFloor}층` : (coopMode ? '협동3인' : '개인')
  };
}
function traitPresetMetaFromState(){
  return traitPresetMetaFromValues({diff:vs('diff'),penance:vs('penance'),round:targetRoundStoredValue(),challengeTowerFloor:challengeTowerFloorStoredValue(),coopMode:vs('coopMode'),team:vs('team')});
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
  if(sourceFileVersion<TRAIT_PRESET_MIN_FILE_VERSION || sourceSchemaVersion<TRAIT_PRESET_MIN_SCHEMA_VERSION || itemSchemaVersion<TRAIT_PRESET_MIN_SCHEMA_VERSION || stateSchemaVersion<TRAIT_PRESET_MIN_SCHEMA_VERSION) return null;
  if(!hasTraitPresetTowerFloorField(item.state)) return null;
  const state=normalizeTraitPresetState(item.state);
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
  if(sourceFileVersion && sourceFileVersion<TRAIT_PRESET_MIN_FILE_VERSION) return empty;
  if(sourceSchemaVersion && sourceSchemaVersion<TRAIT_PRESET_MIN_SCHEMA_VERSION) return empty;
  const seen=new Set();
  const presets=[];
  const presetIdMap=new Map();
  const itemContext={fileVersion:sourceFileVersion || TRAIT_PRESET_FILE_VERSION,schemaVersion:sourceSchemaVersion || TRAIT_PRESET_SCHEMA_VERSION,storageVersion:data.storageVersion || ''};
  data.presets.forEach((item,index)=>{
    const sourceId=String(item?.id || '');
    const preset=normalizeTraitPresetItem(item,index,itemContext);
    if(!preset) return;
    appendUniqueTraitPreset(presets, seen, preset);
    if(sourceId && !presetIdMap.has(sourceId)) presetIdMap.set(sourceId,preset.id);
  });
  const jewelSettings=normalizeTraitPresetJewelSettings(data.jewelSettings);
  const sourceUnitBoard=normalizeTraitPresetUnitBoardStore(data.unitBoard);
  const unitBoard=emptyTraitPresetUnitBoardStore();
  Object.entries(sourceUnitBoard.presets).forEach(([sourceId,state])=>{
    const targetId=presetIdMap.get(sourceId) || (presets.some(preset=>preset.id===sourceId) ? sourceId : '');
    if(targetId) unitBoard.presets[targetId]=normalizeTraitPresetUnitBoardState(state);
  });
  const normalizedUnitBoard=normalizeTraitPresetUnitBoardStore(unitBoard,presets.map(preset=>preset.id));
  return {...empty,updatedAt:+data.updatedAt || Date.now(),defaultPresetId:'',presets,jewelSettings,unitBoard:normalizedUnitBoard};
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
  const selectedTraitPresetIdValue=String(id || '').trim();
  const previous=loadTraitPresetStatusData();
  updateTraitPresetStatus({selectedTraitPresetId:selectedTraitPresetIdValue},{persist:true});
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
  renderTraitPresetUpdateStatus(store);
  if(nameInput) nameInput.placeholder=TRAIT_PRESET_NAME_PLACEHOLDER;
}
/* ----- 01-2. 프리셋 생성 / 로드 / 업데이트 / 삭제 ----- */
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
    const state=makeTraitPresetStateObject();
    if(!state) throw new Error('현재 화면값을 프리셋 상태로 저장할 수 없습니다.');
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
    setTraitPresetUnitBoardState(store,id,captureTraitPresetUnitBoardState());
    store.jewelSettings=captureTraitPresetJewelSettings();
    store=saveTraitPresetStore(store,{source:'saveTraitPreset'});
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
  applyTraitPresetJewelSettings(options.jewelSettings);
  applyTraitPresetUnitBoardState(options.unitBoardIncluded ? options.unitBoardState : null);
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
    applyTraitPresetState(preset,{
      persist:true,
      preserveSharedValues:options.preserveSharedValues===true,
      jewelSettings:store.jewelSettings,
      unitBoardIncluded:traitPresetHasUnitBoard(store,id),
      unitBoardState:traitPresetUnitBoardState(store,id)
    });
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
function traitPresetUpdateScopeGroups(scope){
  const normalizedScope=scope==='single' ? 'single' : 'shared';
  const isSingle=normalizedScope==='single';
  const grouped=new Map();
  const entries=Object.entries(FIELD_REGISTRY);
  if(isSingle){
    const order=new Map([...TRAIT_PRESET_SINGLE_UPDATE_VALUE_IDS].map((id,index)=>[id,index]));
    entries.sort(([a],[b])=>(order.get(a) ?? Number.MAX_SAFE_INTEGER)-(order.get(b) ?? Number.MAX_SAFE_INTEGER));
  }
  entries.forEach(([id,field])=>{
    if(!field?.save || TRAIT_PRESET_UPDATE_SCOPE_HIDDEN_VALUE_IDS.has(id) || isTraitPresetExcludedValueId(id)) return;
    if(TRAIT_PRESET_SINGLE_UPDATE_VALUE_IDS.has(id)!==isSingle) return;
    const kind=String(field.kind || '기타');
    const name=String(field.name || id);
    const names=grouped.get(kind) || [];
    if(!names.includes(name)) names.push(name);
    grouped.set(kind,names);
  });
  (TRAIT_PRESET_UPDATE_SCOPE_EXTRA_GROUPS[normalizedScope] || []).forEach(group=>{
    const names=grouped.get(group.kind) || [];
    group.names.forEach(name=>{ if(!names.includes(name)) names.push(name); });
    grouped.set(group.kind,names);
  });
  return [...grouped.entries()]
    .map(([kind,names])=>({kind,names}))
    .sort((a,b)=>{
      const aIndex=TRAIT_PRESET_UPDATE_SCOPE_KIND_ORDER.indexOf(a.kind);
      const bIndex=TRAIT_PRESET_UPDATE_SCOPE_KIND_ORDER.indexOf(b.kind);
      return (aIndex<0 ? Number.MAX_SAFE_INTEGER : aIndex)-(bIndex<0 ? Number.MAX_SAFE_INTEGER : bIndex);
    });
}
function traitPresetUpdateScopeGroupHtml(group){
  const items=group.names.map(name=>`<li>${escapeHtml(name)}</li>`).join('');
  return `<section class="trait-preset-update-scope-group"><h5>${escapeHtml(group.kind)}</h5><ul>${items}</ul></section>`;
}
function renderTraitPresetUpdateScope(scope='shared'){
  const normalizedScope=scope==='single' ? 'single' : 'shared';
  const list=document.querySelector(`[data-trait-preset-update-scope-list="${normalizedScope}"]`);
  if(!list) return false;
  list.innerHTML=traitPresetUpdateScopeGroups(normalizedScope).map(traitPresetUpdateScopeGroupHtml).join('');
  return true;
}
function setTraitPresetUpdateScopeView(scope, options={}){
  const normalizedScope=scope==='single' ? 'single' : 'shared';
  qsa('[data-trait-preset-update-scope-tab]').forEach(tab=>{
    const active=tab.dataset.traitPresetUpdateScopeTab===normalizedScope;
    tab.setAttribute('aria-selected',active ? 'true' : 'false');
    tab.tabIndex=active ? 0 : -1;
    if(active && options.focus) tab.focus();
  });
  qsa('[data-trait-preset-update-scope-panel]').forEach(panel=>{
    panel.hidden=panel.dataset.traitPresetUpdateScopePanel!==normalizedScope;
  });
  renderTraitPresetUpdateScope(normalizedScope);
  return normalizedScope;
}
function renderTraitPresetUpdateScopePopover(){
  return setTraitPresetUpdateScopeView('shared');
}
function setTraitPresetUpdateScopePopoverOpen(open, options={}){
  const toggle=$('traitPresetUpdateScopeBtn');
  const popover=$('traitPresetUpdateScopePopover');
  if(!toggle || !popover) return false;
  const next=!!open;
  if(next) setTraitPresetUpdateScopeView('shared');
  popover.hidden=!next;
  toggle.setAttribute('aria-expanded',next ? 'true' : 'false');
  toggle.closest('.trait-preset-title')?.classList.toggle('is-update-scope-open',next);
  if(!next && options.restoreFocus) toggle.focus();
  return next;
}
function toggleTraitPresetUpdateScopePopover(){
  const popover=$('traitPresetUpdateScopePopover');
  return setTraitPresetUpdateScopePopoverOpen(!!popover?.hidden);
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
function buildSyncedTraitPresetState(baseState, targetState, now){
  const base=normalizeTraitPresetState(baseState);
  const target=normalizeTraitPresetState(targetState);
  if(!base || !target) return null;
  const values={...base.values};
  TRAIT_PRESET_SINGLE_UPDATE_VALUE_IDS.forEach(id=>{
    if(hasOwn(target.values,id)) values[id]=target.values[id];
    else delete values[id];
  });
  normalizeMoneyStorageValues(values);
  return makeStorageEnvelope({
    values,
    inv:{...target.inv},
    zeroScore:base.zeroScore,
    savedAt:now,
    storageVersion:base.storageVersion,
    scope:target.scope,
    ui:target.ui,
    clientId:target.clientId
  });
}
function hasTraitPresetValueChanges(previous, current, options={}){
  const ids=new Set([...Object.keys(previous.values || {}), ...Object.keys(current.values || {})]);
  for(const id of ids){
    if(options.ignoreSyncExcluded && TRAIT_PRESET_SINGLE_UPDATE_VALUE_IDS.has(id)) continue;
    if(stableTraitPresetValue(previous.values?.[id])!==stableTraitPresetValue(current.values?.[id])) return true;
  }
  return false;
}
function hasSharedTraitPresetValueChanges(previousState, currentState){
  const previous=normalizeTraitPresetState(previousState);
  const current=normalizeTraitPresetState(currentState);
  return !previous || !current || hasTraitPresetValueChanges(previous,current,{ignoreSyncExcluded:true});
}
function hasSharedTraitPresetZeroScoreChanges(previousState,currentState){
  const previous=normalizeTraitPresetState(previousState);
  const current=normalizeTraitPresetState(currentState);
  if(!previous || !current) return true;
  return stableTraitPresetValue(normalizeZeroScoreState(previous.zeroScore || {rows:[]}))
    !==stableTraitPresetValue(normalizeZeroScoreState(current.zeroScore || {rows:[]}));
}
function hasSharedTraitPresetChanges(previousState,currentState){
  return hasSharedTraitPresetValueChanges(previousState,currentState)
    || hasSharedTraitPresetZeroScoreChanges(previousState,currentState);
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
function hasTraitPresetStateChanges(previousState,currentState){
  const previous=normalizeTraitPresetState(previousState);
  const current=normalizeTraitPresetState(currentState);
  if(!previous || !current) return true;
  if(hasTraitPresetValueChanges(previous,current)) return true;
  if(stableTraitPresetInv(previous.inv)!==stableTraitPresetInv(current.inv)) return true;
  return stableTraitPresetValue(normalizeZeroScoreState(previous.zeroScore || {rows:[]}))!==stableTraitPresetValue(normalizeZeroScoreState(current.zeroScore || {rows:[]}));
}
function traitPresetUpdateStatus(store=loadTraitPresetStore()){
  const id=selectedTraitPresetId();
  const preset=store.presets.find(item=>item.id===id);
  if(!preset) return {preset:null,needsUpdate:false};
  const status=loadTraitPresetStatusData();
  const hasStoredUnitBoard=traitPresetHasUnitBoard(store,id);
  const unitBoardExtensionNeeded=!hasStoredUnitBoard && (
    traitPresetUnitBoardHasValues(captureTraitPresetUnitBoardState()) || status.pendingUnitBoardPresetIds.includes(id)
  );
  const jewelExtensionNeeded=!normalizeTraitPresetJewelSettings(store.jewelSettings) && status.pendingJewelSettings;
  return {preset,needsUpdate:unitBoardExtensionNeeded || jewelExtensionNeeded};
}
function renderTraitPresetUpdateStatus(store){
  const status=traitPresetUpdateStatus(store);
  qsa('[data-action="updateTraitPreset"]').forEach(btn=>{
    btn.textContent=status.needsUpdate ? '업데이트 필요' : '프리셋 업데이트';
    btn.classList.toggle('is-update-needed',status.needsUpdate);
    btn.setAttribute('aria-label',status.needsUpdate ? '현재 프리셋 업데이트 필요' : '현재 프리셋 업데이트');
  });
  return status.needsUpdate;
}
function updateTraitPreset(){
  const id=selectedTraitPresetId();
  let store=loadTraitPresetStore();
  const selectedIndex=store.presets.findIndex(item=>item.id===id);
  const preset=store.presets[selectedIndex];
  if(!preset){ notifyStorageAction('업데이트할 프리셋을 선택하세요.','err'); return false; }
  try{
    const now=Date.now();
    const localState={...makeStateObject(),savedAt:now};
    const currentState=markPresetStateCurrentVersion(localState);
    if(!currentState) throw new Error('현재 화면값을 프리셋 상태로 저장할 수 없습니다.');
    const status=loadTraitPresetStatusData();
    const currentUnitBoard=captureTraitPresetUnitBoardState();
    const currentJewelSettings=captureTraitPresetJewelSettings();
    const stateChanged=hasTraitPresetStateChanges(preset.state,currentState);
    const unitBoardChanged=traitPresetHasUnitBoard(store,id)
      ? stableTraitPresetValue(traitPresetUnitBoardState(store,id))!==stableTraitPresetValue(currentUnitBoard)
      : traitPresetUnitBoardHasValues(currentUnitBoard) || status.pendingUnitBoardPresetIds.includes(id);
    const storedJewelSettings=normalizeTraitPresetJewelSettings(store.jewelSettings);
    const jewelChanged=storedJewelSettings
      ? stableTraitPresetValue(storedJewelSettings)!==stableTraitPresetValue(currentJewelSettings)
      : status.pendingJewelSettings;
    if(!stateChanged && !unitBoardChanged && !jewelChanged){
      renderTraitPresetUpdateStatus(store);
      notifyStorageAction('프리셋 변경사항 없음','warn');
      return false;
    }
    const syncSharedValues=stateChanged && hasSharedTraitPresetChanges(preset.state,currentState);
    const updatedIds=[];
    store.presets=store.presets.map((item,index)=>{
      if(index!==selectedIndex && !syncSharedValues) return item;
      const nextState=index===selectedIndex ? currentState : buildSyncedTraitPresetState(currentState,item.state,now);
      if(!nextState) return item;
      updatedIds.push(item.id);
      return {...item,updatedAt:now,schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,meta:traitPresetMetaFromSavedState(nextState),state:nextState};
    });
    const extensionUpgradeIds=initializeMissingTraitPresetUnitBoards(store,id,currentUnitBoard);
    setTraitPresetUnitBoardState(store,id,currentUnitBoard);
    store.jewelSettings=currentJewelSettings;
    store=saveTraitPresetStore(store,{source:'updateTraitPreset'});
    localStorage.setItem(STORAGE_KEY,JSON.stringify(localState));
    storageState.hasSavedState=true;
    const statusIds=new Set(updatedIds.length ? updatedIds : [id]);
    if(jewelChanged || extensionUpgradeIds.length) store.presets.forEach(item=>statusIds.add(item.id));
    markTraitPresetUpdated([...statusIds],'update');
    updateTraitPresetStatus({pendingJewelSettings:false,pendingUnitBoardPresetIds:[]},{persist:true});
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
      deleteTraitPresetUnitBoardState(nextStore,id);
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
    }catch(error){
      logAppWarn('전체 저장 데이터 제거', error);
    }
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
    btn.textContent='한번더!';
    clearTimeout(traitPresetResetButtonTimer);
    traitPresetResetButtonTimer=setTimeout(()=>resetTraitPresetResetButton(btn), delay);
  }
  notifyStorageAction('한 번 더 누르면 전체 초기화','warn');
  return false;
}
/* ===== 02. 프리셋 가져오기 / 내보내기 / 분석 연동 ===== */
/* ----- 02-1. 내보내기 / 가져오기 모달 및 파일 처리 ----- */
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
    const {unitBoard,jewelSettings,...exportMain}=exportStore;
    const payload=JSON.stringify({webDpsVersion:currentWebDpsVersion(),...exportMain,type:TRAIT_PRESET_FILE_TYPE,fileVersion:TRAIT_PRESET_FILE_VERSION,exportedAt:new Date().toISOString(),defaultPresetName:'',jewelSettings,unitBoard}, null, 2);
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
  if(sourceFileVersion<TRAIT_PRESET_MIN_FILE_VERSION || sourceSchemaVersion<TRAIT_PRESET_MIN_SCHEMA_VERSION) throw new Error(TRAIT_PRESET_UNSUPPORTED_OLD_MESSAGE);
  const importContext={fileVersion:sourceFileVersion,schemaVersion:sourceSchemaVersion,storageVersion:parsed.storageVersion || ''};
  const presets=parsed.presets.map((item,index)=>normalizeTraitPresetItem(item,index,importContext)).filter(Boolean);
  if(!presets.length) throw new Error(parsed.presets.length ? TRAIT_PRESET_UNSUPPORTED_OLD_MESSAGE : '가져올 수 있는 프리셋이 없습니다.');
  return {
    presets,
    jewelSettings:normalizeTraitPresetJewelSettings(parsed.jewelSettings),
    unitBoard:normalizeTraitPresetUnitBoardStore(parsed.unitBoard,presets.map(preset=>preset.id))
  };
}
function mergeTraitPresetImport(imported,options={}){
  let store=loadTraitPresetStore();
  let added=0, replaced=0, firstImportedPresetId='';
  const preserveExistingUnitBoardOnReplace=options.preserveExistingUnitBoardOnReplace===true;
  const importedUnitBoard=normalizeTraitPresetUnitBoardStore(imported?.unitBoard,(imported?.presets || []).map(preset=>preset.id));
  const importedJewelSettings=normalizeTraitPresetJewelSettings(imported?.jewelSettings);
  if(importedJewelSettings) store.jewelSettings=importedJewelSettings;
  (imported.presets || []).forEach((preset,index)=>{
    const sourceId=preset.id;
    const existingIndex=store.presets.findIndex(item=>item.name===preset.name);
    let targetId;
    if(existingIndex>=0){
      targetId=store.presets[existingIndex].id;
      store.presets[existingIndex]={...preset,id:targetId,createdAt:store.presets[existingIndex].createdAt || preset.createdAt,updatedAt:Date.now()};
      replaced++;
    }else{
      targetId=store.presets.some(item=>item.id===preset.id) ? makeTraitPresetId() : preset.id;
      store.presets.push({...preset,id:targetId,createdAt:preset.createdAt || Date.now(),updatedAt:Date.now()});
      added++;
    }
    if(hasOwn(importedUnitBoard.presets,sourceId)){
      const preserveExisting=existingIndex>=0 && preserveExistingUnitBoardOnReplace && traitPresetHasUnitBoard(store,targetId);
      if(!preserveExisting) setTraitPresetUnitBoardState(store,targetId,importedUnitBoard.presets[sourceId]);
    }else if(existingIndex>=0 && !preserveExistingUnitBoardOnReplace){
      deleteTraitPresetUnitBoardState(store,targetId);
    }
    if(index===0) firstImportedPresetId=targetId;
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
        <div class="trait-preset-excel-field"><span>적용 상태</span><output class="trait-preset-excel-value" id="traitPresetExcelApplyStatus">-</output></div>
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
    sheetSelect.innerHTML=sheets.map(sheet=>`<option value="${escapeHtml(sheet.name)}">${escapeHtml(sheet.name)}</option>`).join('');
    const preferred=sheets.some(sheet=>sheet.name==='고행') ? '고행' : (sheets[0]?.name || '');
    sheetSelect.value=preferred;
  }
  if(nameInput){
    nameInput.dataset.autofill='1';
    nameInput.value=sheetSelect?.value || stateFileBaseName(fileName);
  }
  syncTraitPresetExcelImportMode();
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
function syncTraitPresetExcelImportMode(){
  const sheetName=selectedTraitPresetExcelSheetName();
  const jewelMode=sheetName===EXCEL_JEWEL_SHEET_NAME;
  const nameInput=$('traitPresetExcelName');
  const applyStatus=$('traitPresetExcelApplyStatus');
  const saveButton=document.querySelector('[data-trait-preset-excel-save]');
  if(nameInput){
    nameInput.disabled=jewelMode;
    if(jewelMode){
      nameInput.value='-';
      nameInput.dataset.autofill='1';
    }else if(nameInput.dataset.autofill==='1' || !nameInput.value.trim() || nameInput.value==='-'){
      nameInput.value=sheetName;
      nameInput.dataset.autofill='1';
    }
  }
  if(applyStatus) applyStatus.textContent=jewelMode ? '공용 쥬얼 데이터' : `${sheetName} 시트 데이터 & 공용 쥬얼 데이터`;
  if(saveButton) saveButton.textContent=jewelMode ? '쥬얼 데이터만 가져오기' : '선택 시트 프리셋 저장';
}
function importExcelJewelsToCurrentPreset(workbook){
  const previousJewelSettings=captureTraitPresetJewelSettings();
  try{
    const jewelImport=readExcelJewelSettings(workbook);
    if(!jewelImport.present || !jewelImport.settings) throw new Error('선택한 엑셀파일에 쥬얼 시트가 없습니다.');
    applyExcelJewelSettings(jewelImport);
    const saved=saveState({silent:true});
    if(saved===false) throw new Error('쥬얼값은 적용했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.');
    const staged=stageTraitPresetJewelSettings(jewelImport.settings);
    renderTraitPresetUpdateStatus();
    closeTraitPresetExcelImportModal();
    const suffix=staged.needsUpdate ? ' · 프리셋 업데이트 필요' : ' · 기존 데이터와 동일';
    notifyStorageAction(`쥬얼 데이터 가져오기 완료 · 전설/신화 ${jewelImport.recognizedLegendary}개 · 일반 ${jewelImport.normalCount}개${suffix}`,'ok',{statusAction:'import'});
    return true;
  }catch(e){
    try{
      applyTraitPresetJewelSettings(previousJewelSettings);
      sanitizeDpsJewelSelections();
      syncDpsBaseUnitControl();
    }catch(rollbackError){ logAppError('[trait preset Excel jewel rollback failed]',rollbackError); }
    logAppError('[trait preset Excel jewel import failed]',e);
    notifyStorageAction(e?.message || '쥬얼 데이터 가져오기 실패','err');
    return false;
  }
}
function saveSelectedExcelSheetAsTraitPreset(){
  const workbook=traitPresetExcelImportState.workbook;
  const sheetName=selectedTraitPresetExcelSheetName();
  if(!workbook || !sheetName){ notifyStorageAction('가져올 엑셀 시트를 선택하세요.','err'); return false; }
  if(sheetName===EXCEL_JEWEL_SHEET_NAME) return importExcelJewelsToCurrentPreset(workbook);
  const name=normalizeTraitPresetName($('traitPresetExcelName')?.value || sheetName);
  if(!name){ notifyStorageAction('프리셋 이름을 입력하세요.','err'); return false; }
  try{
    const cells=workbook.getCells(sheetName);
    validateExcelCompareSheet(cells,sheetName);
    const specCells=workbook.getCells('스펙');
    const zeroCells=getZeroScoreSheetCells(workbook);
    const additionalInfo=inspectSpecAdditionalStructure(specCells);
    if(!additionalInfo.valid) throw new Error(additionalInfo.message);
    const importedState=buildExcelState(cells,specCells,zeroCells,sheetName).state;
    const jewelImport=readExcelJewelSettings(workbook);
    const now=Date.now();
    const presetId=makeTraitPresetId();
    const imported={presets:[{
      id:presetId,
      name,
      schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,
      createdAt:now,
      updatedAt:now,
      meta:traitPresetMetaFromSavedState(importedState),
      state:importedState
    }],jewelSettings:jewelImport.present ? jewelImport.settings : null,unitBoard:{
      schemaVersion:TRAIT_PRESET_UNIT_BOARD_SCHEMA_VERSION,
      presets:{[presetId]:normalizeTraitPresetUnitBoardState(null)}
    }};
    const result=mergeTraitPresetImport(imported,{preserveExistingUnitBoardOnReplace:true});
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
/* ----- 02-2. 프리셋 분석 패널 연동 ----- */
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
  const baseBundle=compareState.baseTraitPresetBundle || loadTraitPresetStore();
  return buildJsonComparison(
    {...state,fileName:bundle.fileName || '특성 프리셋 파일',sheetName:preset.name},
    {
      fileName:bundle.fileName || '특성 프리셋 파일',
      sheetName:preset.name,
      sourceType:'traitPreset',
      baseState,
      baseFileName:baseBundle.fileName || '기준 프리셋',
      baseSheetName:basePreset.name,
      changeJewelSettings:bundle.jewelSettings,
      currentJewelSettings:baseBundle.jewelSettings,
      changeUnitBoardIncluded:traitPresetHasUnitBoard(bundle,preset.id),
      changeUnitBoard:traitPresetUnitBoardState(bundle,preset.id),
      currentUnitBoardIncluded:traitPresetHasUnitBoard(baseBundle,basePreset.id),
      currentUnitBoard:traitPresetUnitBoardState(baseBundle,basePreset.id)
    }
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
  const targetBundle=compareState.traitPresetBundle || {};
  const targetHasUnitBoard=traitPresetHasUnitBoard(targetBundle,preset.id);
  const targetUnitBoard=traitPresetUnitBoardState(targetBundle,preset.id);
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
    if(targetHasUnitBoard) setTraitPresetUnitBoardState(store,nextPreset.id,targetUnitBoard);
    else deleteTraitPresetUnitBoardState(store,nextPreset.id);
    if(compareState.baseTraitPresetBundle && Array.isArray(compareState.baseTraitPresetBundle.presets)){
      const bundleIndex=compareState.baseTraitPresetBundle.presets.findIndex(item=>item.id===basePreset.id || item.name===basePreset.name);
      if(bundleIndex>=0){
        const bundlePrev=compareState.baseTraitPresetBundle.presets[bundleIndex];
        const nextBundlePreset={...bundlePrev,id:bundlePrev.id,name:bundlePrev.name,createdAt:bundlePrev.createdAt,updatedAt:now,schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,meta:traitPresetMetaFromSavedState(nextState),state:nextState};
        compareState.baseTraitPresetBundle.presets[bundleIndex]=nextBundlePreset;
        if(targetHasUnitBoard) setTraitPresetUnitBoardState(compareState.baseTraitPresetBundle,nextBundlePreset.id,targetUnitBoard);
        else deleteTraitPresetUnitBoardState(compareState.baseTraitPresetBundle,nextBundlePreset.id);
      }
    }
    store=saveTraitPresetStore(store,{source:'compareApply'});
    compareState.baseTraitPresetId=compareState.baseTraitPresetBundle ? basePreset.id : nextPreset.id;
    appliedName=nextPreset.name;
    applyStateObject(nextState);
    applyTraitPresetUnitBoardState(targetHasUnitBoard ? targetUnitBoard : null);
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
    if(e.target?.id==='traitPresetExcelSheet') syncTraitPresetExcelImportMode();
  });
  document.addEventListener('input',e=>{
    if(e.target?.id==='traitPresetExcelName') e.target.dataset.autofill='0';
  });
  document.addEventListener('click',e=>{
    const updateScopeToggle=e.target.closest('[data-trait-preset-update-scope-toggle]');
    if(updateScopeToggle){
      e.preventDefault();
      e.stopPropagation();
      toggleTraitPresetUpdateScopePopover();
      return;
    }
    if(e.target.closest('[data-trait-preset-update-scope-close]')){
      e.preventDefault();
      setTraitPresetUpdateScopePopoverOpen(false,{restoreFocus:true});
      return;
    }
    const updateScopeTab=e.target.closest('[data-trait-preset-update-scope-tab]');
    if(updateScopeTab){
      e.preventDefault();
      e.stopPropagation();
      setTraitPresetUpdateScopeView(updateScopeTab.dataset.traitPresetUpdateScopeTab);
      return;
    }
    const updateScopePopover=$('traitPresetUpdateScopePopover');
    if(updateScopePopover && !updateScopePopover.hidden && !e.target.closest('#traitPresetUpdateScopePopover')){
      setTraitPresetUpdateScopePopoverOpen(false);
    }
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
    const updateScopeTab=e.target.closest?.('[data-trait-preset-update-scope-tab]');
    if(updateScopeTab && ['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
      e.preventDefault();
      const scope=(e.key==='ArrowLeft' || e.key==='Home') ? 'shared' : 'single';
      setTraitPresetUpdateScopeView(scope,{focus:true});
      return;
    }
    if(e.key==='Escape'){
      if(!$('traitPresetUpdateScopePopover')?.hidden) setTraitPresetUpdateScopePopoverOpen(false,{restoreFocus:true});
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

/* ===== 03. 프리셋 공개 API ===== */
window.DpsPreset=Object.freeze({
  init:function(){
    refreshTraitPresetControls();
    restoreTraitPresetStatus();
    renderTraitPresetUpdateScopePopover();
  },
  bindEvents:bindTraitPresetEvents,
  refresh:refreshTraitPresetControls,
  saveCurrent:saveTraitPreset,
  loadSelected:loadTraitPreset,
  applyPreset:loadTraitPresetById,
  updateCurrent:updateTraitPreset,
  renameCurrent:renameTraitPreset,
  deleteCurrent:deleteTraitPreset,
  resetAll:requestTraitPresetFullReset,
  openImport:openTraitPresetImportPicker,
  importFile:importTraitPresetFile,
  exportFile:exportTraitPresets,
  openAnalysis:compareTraitPreset,
  updateTraitPreset,
  normalizeStore:normalizeTraitPresetStore,
  loadStore:loadTraitPresetStore
});
