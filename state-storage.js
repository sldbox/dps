/* ===== state-storage.js | 현재 입력 상태 저장 / 복구 / 백업 ===== */
/* DOM 입력값과 INV 특성 투자를 상태 객체로 직렬화하고, localStorage·백업 파일과 동기화한다. */

/* ===== 00. 저장 키 / 파일 스키마 상수 ===== */
const STORAGE_VERSION=DPS_CONFIG.storage.version;
const STORAGE_SCOPE=DPS_CONFIG.storage.scope;
const STORAGE_KEY=DPS_CONFIG.storage.key;
const CLIENT_KEY=DPS_CONFIG.storage.clientKey;
const TRAIT_PRESET_STORAGE_KEY=DPS_CONFIG.storage.traitPresetKey || 'gbd_dps_calculator:trait_presets';
const TRAIT_PRESET_FILE_TYPE='sld_dps_trait_presets';
const TRAIT_PRESET_LEGACY_FILE_TYPES=new Set(['gbd_dps_trait_presets']);
const TRAIT_PRESET_FILE_VERSION=2;
const TRAIT_PRESET_SCHEMA_VERSION=2;
const TRAIT_PRESET_NAME_PLACEHOLDER='예시) 더파300라버스';
/* ===== 01. 저장파일 형식 판별 ===== */
function isTraitPresetFileType(type){
  return type===TRAIT_PRESET_FILE_TYPE || TRAIT_PRESET_LEGACY_FILE_TYPES.has(type);
}
/* ===== 02. 저장 대상 요소 / 읽기·쓰기 유틸 ===== */
const INTERNAL_VALUE_IDS=new Set([
  'dt','ep','rAP','rTD','rUA','rHarmony'
]);
const IGNORED_SAVED_VALUE_IDS=[...(DPS_CONFIG.state.skipElementIds || []),...INTERNAL_VALUE_IDS];
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
  if(el.type==='checkbox') el.checked=!!value;
  else el.value=value;
  if(TRAIT_LIMIT_INPUT_IDS.has(el.id)) syncTraitLimitInputDisplay(el);
}
/* ===== 03. 상태 객체 생성 / 클라이언트 식별자 ===== */
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
  return makeStorageEnvelope({
    values,
    inv:{...INV},
    zeroScore:collectZeroScoreState(),
    savedAt:Date.now(),
    ui:{fontScale:getFontScale()}
  });
}
/* ===== 04. 저장 상태 마이그레이션 / 값 정규화 ===== */
function legacyTowerFloorFromZeroScore(zeroScore){
  const rows=Array.isArray(zeroScore?.rows) ? zeroScore.rows : [];
  const tower=rows.find(row=>row && row.type==='towerCombo');
  if(!tower) return '';
  const candidates=[tower.target, tower.honorTarget, tower.current, tower.honorCurrent];
  for(const value of candidates){
    const raw=String(value ?? '').replace(/,/g,'').trim();
    if(raw!=='' && Number.isFinite(Number(raw))) return raw;
  }
  return '';
}
function migratedTowerFloorValue(values={}, context={}){
  const direct=values.challengeTowerFloor ?? values.towerFloor ?? values.challengeFloor ?? values.challengeTower;
  const legacy=legacyTowerFloorFromZeroScore(context.zeroScore) || context.meta?.challengeTowerFloor || context.meta?.towerFloor || '';
  return normalizedTowerFloorString(direct ?? legacy ?? TOWER_FLOOR_INPUT_MIN);
}
function sanitizeSavedValues(values, context={}){
  if(!values || typeof values!=='object') values={};
  const out=normalizeRuneChoiceValues(values);
  IGNORED_SAVED_VALUE_IDS.forEach(id=>delete out[id]);
  Object.keys(out).forEach(id=>{ if(!isUserStateValueId(id)) delete out[id]; });
  out.challengeTowerFloor=migratedTowerFloorValue(out, context);
  if(hasOwn(out,'overEnhance')) out.overEnhance=String(normalizeOverEnhanceValue(out.overEnhance));
  if(out.raceOpt==='해당 없음') out.raceOpt='없음';
  const coopMode=normalizeOnOffValue(out.coopMode,'OFF')==='ON';
  out.soloMode=coopMode ? 'OFF' : 'ON';
  out.coopMode=coopMode ? 'ON' : 'OFF';
  if(hasOwn(out,'coopPlayers')) out.coopPlayers=normalizeCoopPlayersValue(out.coopPlayers || out.team);
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
  if(hasOwn(out,'runeChoiceType') || hasOwn(out,'runeChoiceValue')){
    const normalizedRune=normalizeRuneChoiceValues(out);
    out.runeChoiceType=normalizedRune.runeChoiceType;
    out.runeChoiceValue=normalizedRune.runeChoiceValue;
  }
  TRAIT_LIMIT_INPUT_IDS.forEach(id=>{
    if(!hasOwn(out,id)) return;
    out[id]=normalizeTraitLimitStorageValue(out[id]);
  });
  return out;
}

function normalizeSavedState(data){
  if(!data || typeof data!=='object') return null;
  const rawValues=(data.values && typeof data.values==='object') ? data.values : {};
  const hasRawValues=Object.keys(rawValues).some(id=>isUserStateValueId(id) || id==='dpsTableMinDps');
  const values=sanitizeSavedValues(rawValues, data);
  const inv=(data.inv && typeof data.inv==='object') ? {...data.inv} : {};
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

/* ===== 05. 프리셋 적용용 상태 조합 ===== */
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
function syncTraitPresetStoreWithCurrentState(currentState, options={}){
  if(options.syncTraitPresets!==true || isStorageLocked()) return;
  let store;
  try{ store=loadTraitPresetStore(); }catch(e){ return; }
  if(!store.presets.length) return;
  const state=normalizeSavedState(currentState);
  if(!state) return;
  const selectedId=String(options.selectedTraitPresetId || selectedTraitPresetId() || '');
  if(!selectedId) return;
  const index=store.presets.findIndex(preset=>preset.id===selectedId);
  if(index<0) return;
  const now=Date.now();
  const prev=store.presets[index];
  const nextState=makeStorageEnvelope({
    values:{...state.values},
    inv:{...state.inv},
    zeroScore:state.zeroScore,
    savedAt:now,
    storageVersion:state.storageVersion,
    scope:state.scope,
    ui:state.ui,
    clientId:state.clientId
  });
  store.presets[index]={...prev, updatedAt:now, meta:traitPresetMetaFromSavedState(nextState), state:nextState};
  saveTraitPresetStore(store);
}
let autoSaveToastTimer=0;
/* ===== 06. 상태 적용 / 자동 저장 상태 ===== */
function scheduleAutoSaveToast(){
  if(isStorageLocked()) return;
  if(autoSaveToastTimer) clearTimeout(autoSaveToastTimer);
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
/* ===== 07. JSON 파싱 / 프리셋 상태 표시 ===== */
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
const TRAIT_PRESET_EXPORT_CURRENT_APPLIED_MESSAGE='최신 통합 프리셋으로 적용되었습니다.\n가져온 프리셋 정보가 최신 구조로 갱신되어 저장되었습니다.\n전체 초기화나 다시 가져오기 없이 바로 사용하시면 됩니다.';
const TRAIT_PRESET_STATUS_LABELS={save:'저장됨',load:'불러옴',delete:'삭제됨',import:'가져옴',export:'내보냄'};
function padStatusPart(value){return String(value).padStart(2,'0');}
function formatTraitPresetStatusDate(year, month, day, hour, minute, action){
  return `${padStatusPart(Number(year)%100)}년 ${padStatusPart(month)}월 ${padStatusPart(day)}일 ${padStatusPart(hour)}:${padStatusPart(minute)} - ${action}`;
}
function formatTraitPresetStatus(action, date=new Date()){
  const label=TRAIT_PRESET_STATUS_LABELS[action];
  if(!label) return '';
  return formatTraitPresetStatusDate(date.getFullYear(), date.getMonth()+1, date.getDate(), date.getHours(), date.getMinutes(), label);
}
function normalizeTraitPresetStatusText(message){
  const text=String(message || '').replace(/^최근 상태\s+/, '').trim();
  if(!text) return '';
  const actionMatch=text.match(/\s*-\s*(저장됨|불러옴|삭제됨|가져옴|내보냄)$/) || text.match(/\s+(저장됨|불러옴|삭제됨|가져옴|내보냄)$/);
  if(!actionMatch) return text;
  const action=actionMatch[1];
  const timeText=text.slice(0, actionMatch.index).trim();
  const currentYear=new Date().getFullYear();
  let match=timeText.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if(match) return formatTraitPresetStatusDate(currentYear, match[1], match[2], match[3], match[4], action);
  match=timeText.match(/^(?:(\d{2}|\d{4})년\s*)?(\d{1,2})월\s*(\d{1,2})일\s+(\d{1,2}):(\d{2})$/);
  if(match) return formatTraitPresetStatusDate(match[1] || currentYear, match[2], match[3], match[4], match[5], action);
  match=timeText.match(/^(?:(\d{2}|\d{4})[-년\s]+)?(\d{1,2})[-월\s]+(\d{1,2})(?:일)?[-\s]+(\d{1,2}):(\d{2})$/);
  if(match) return formatTraitPresetStatusDate(match[1] || currentYear, match[2], match[3], match[4], match[5], action);
  return text;
}
function renderTraitPresetStatusText(message){
  const text=normalizeTraitPresetStatusText(message);
  return text ? escapeCompareHtml(text) : '';
}
function updateTraitPresetStatus(message, options={}){
  const text=normalizeTraitPresetStatusText(message);
  const view=$('traitPresetStatusView');
  if(view) view.innerHTML=renderTraitPresetStatusText(text);
  if(options.persist){
    try{ localStorage.setItem(TRAIT_PRESET_STATUS_STORAGE_KEY, text); }catch(e){}
  }
}
function restoreTraitPresetStatus(){
  let message='';
  try{ message=localStorage.getItem(TRAIT_PRESET_STATUS_STORAGE_KEY) || ''; }catch(e){}
  const normalized=normalizeTraitPresetStatusText(message);
  updateTraitPresetStatus(normalized);
  if(normalized && normalized!==message){
    try{ localStorage.setItem(TRAIT_PRESET_STATUS_STORAGE_KEY, normalized); }catch(e){}
  }
}
function notifyStorageAction(message, type='ok', options={}){
  const statusAction=options.statusAction || '';
  const statusMessage=type==='ok' && statusAction ? formatTraitPresetStatus(statusAction) : '';
  const displayMessage=statusMessage || message;
  if(statusMessage) updateTraitPresetStatus(statusMessage, {persist:true});
  try{ showToast(displayMessage, type); }catch(e){}
}
function notifyTraitPresetExportComplete(wasLegacyPreset){
  const statusMessage=formatTraitPresetStatus('export');
  updateTraitPresetStatus(statusMessage, {persist:true});
  try{ showToast(wasLegacyPreset ? TRAIT_PRESET_EXPORT_CURRENT_APPLIED_MESSAGE : '특성 프리셋 내보내기 완료', 'ok'); }catch(e){}
}
/* ===== 08. localStorage 저장 / 로드 ===== */
function saveState(options={}){
  const silent=!!options.silent;
  if(isStorageLocked()) return false;
  try{
    const state=makeStateObject();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageState.hasSavedState=true;
    storageState.saveFailCount=0;
    syncTraitPresetStoreWithCurrentState(state, options);
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
/* ===== 09. 저장파일명 보조 ===== */
function stateFileBaseName(fileName=''){
  return normalizeTraitPresetName(String(fileName || '').replace(/\.[^.]+$/,'')) || '가져온 프리셋';
}
