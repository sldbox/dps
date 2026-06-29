/* ===== trait-presets.js | 특성 프리셋 저장 / 로드 / import-export / 비교 ===== */
/* 현재 상태를 프리셋으로 보관하고, 프리셋 파일 import/export와 프리셋 간 비교를 담당한다. */

/* ===== 00. 프리셋 이름 / ID / 기본 저장소 ===== */
function normalizeTraitPresetName(value){
  return String(value ?? '').replace(/\s+/g,' ').trim().slice(0,40);
}
function makeTraitPresetId(){
  const seed=(typeof crypto!=='undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `trait_${String(seed).replace(/[^0-9A-Za-z_-]/g,'')}`;
}
function emptyTraitPresetStore(){
  return {type:TRAIT_PRESET_FILE_TYPE,fileVersion:TRAIT_PRESET_FILE_VERSION,schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,storageVersion:STORAGE_VERSION,updatedAt:Date.now(),defaultPresetId:'',presets:[]};
}
/* ===== 01. 프리셋 버전 판별 / 마이그레이션 ===== */
function hasTraitPresetTowerFloorField(state){
  const values=(state && typeof state==='object' && state.values && typeof state.values==='object') ? state.values : {};
  return hasOwn(values,'challengeTowerFloor');
}
function isCurrentTraitPresetStructure(preset,stateArg){
  const state=stateArg || preset?.state || {};
  return (+preset?.schemaVersion || 0)>=TRAIT_PRESET_SCHEMA_VERSION && (+state.schemaVersion || 0)>=TRAIT_PRESET_SCHEMA_VERSION && hasTraitPresetTowerFloorField(state);
}
function hasLegacyTraitPresetSourceMarker(preset){
  return !!(preset && (preset.migratedFromFileVersion || preset.migratedFromSchemaVersion || preset.migratedFromLegacySchema || preset.missingChallengeTowerFloor===true));
}
function normalizeTraitPresetVersionState(value){
  const text=String(value || '').trim().toLowerCase();
  if(['legacy','old','outdated','구버전'].includes(text)) return 'legacy';
  if(['current','latest','new','최신','최신버전'].includes(text)) return 'current';
  return '';
}
function shouldTreatTraitPresetAsLegacy(preset,stateArg){
  if(!preset) return false;
  const state=stateArg || preset.state || {};
  const explicitState=normalizeTraitPresetVersionState(preset.versionState || preset.presetVersionState || preset.versionStatus);
  if(explicitState==='legacy') return true;
  if(!isCurrentTraitPresetStructure(preset,state)) return true;
  if(explicitState==='current') return false;
  return preset.needsExportRefresh===true && hasLegacyTraitPresetSourceMarker(preset);
}
/* ===== 02. export 정리 / 저장소 변경 이벤트 ===== */
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
    if(!preset) return;
    if(seen.has(preset.id)) preset.id=makeTraitPresetId();
    seen.add(preset.id);
    presets.push(preset);
  });
  let defaultPresetId=String(source.defaultPresetId || '');
  if(defaultPresetId && !presets.some(item=>item.id===defaultPresetId)){
    const byName=presets.find(item=>item.name===source.defaultPresetName);
    defaultPresetId=byName ? byName.id : '';
  }
  return {
    type:TRAIT_PRESET_FILE_TYPE,
    fileVersion:TRAIT_PRESET_FILE_VERSION,
    schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,
    storageVersion:STORAGE_VERSION,
    updatedAt:Date.now(),
    defaultPresetId,
    presets
  };
}
/* ===== 03. 프리셋 메타데이터 생성 ===== */
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

function numberFromPresetName(name, suffixPattern=''){
  const text=String(name || '');
  const pattern=suffixPattern ? new RegExp(`(\d{1,3})\s*${suffixPattern}`,'i') : /(\d{1,3})/;
  const match=text.match(pattern);
  return match ? match[1] : '';
}
function migrateTraitPresetStateByName(state, name=''){
  const base=normalizeSavedState(state);
  if(!base) return null;
  const values={...base.values};
  const text=String(name || '').replace(/\s+/g,'').toLowerCase();
  const hasTower=/도전의?탑|challenge(?:tower)?|tower/.test(text);
  const hasDeep=/deepabyss|딥어비스|깊은어비스/.test(text);
  const hasAbyss=!hasDeep && (/abyssroad|어비스/.test(text));
  const hasHof=/halloffame|호프|명예의전당/.test(text);
  const hasFinal=/thefinal|더파이널|더파/.test(text);
  if(hasTower){
    values.diff=TOWER_DIFFICULTY_NAME;
    values.challengeTowerFloor=normalizedTowerFloorString(
      legacyTowerFloorFromZeroScore(base.zeroScore) || numberFromPresetName(name, '층') || values.challengeTowerFloor || values.round || TOWER_FLOOR_INPUT_MIN
    );
  }else if(hasDeep){
    values.diff='Deep Abyss';
  }else if(hasAbyss){
    values.diff='Abyss road';
  }else if(hasHof){
    values.diff='Hall Of Fame';
  }else if(hasFinal){
    values.diff='The Final';
  }
  const roundFromName=!hasTower ? numberFromPresetName(name, '(?:라운드|라)') : '';
  if(roundFromName) values.round=normalizedRoundString(roundFromName);
  if(/개인|solo/.test(text)){
    values.soloMode='ON';
    values.coopMode='OFF';
  }else if(/협동|버스|coop|3인|2인/.test(text)){
    const players=/2인/.test(text) ? '2' : '3';
    values.soloMode='OFF';
    values.coopMode='ON';
    values.coopPlayers=players;
    values.team=players;
  }
  const sanitized=sanitizeSavedValues(values,{...base,values,zeroScore:base.zeroScore});
  return makeStorageEnvelope({
    values:sanitized,
    inv:base.inv,
    zeroScore:base.zeroScore,
    savedAt:base.savedAt,
    schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,
    storageVersion:base.storageVersion,
    scope:base.scope,
    ui:base.ui,
    clientId:base.clientId
  });
}
/* ===== 04. 프리셋 항목·저장소 정규화 ===== */
function normalizeTraitPresetItem(item,index=0,context={}){
  if(!item || typeof item!=='object') return null;
  const stateSource=item.state || item.savedState || item.data || item;
  const name=normalizeTraitPresetName(item.name || item.title || `가져온 프리셋 ${index+1}`);
  if(!name) return null;
  const legacyVersion=+item.schemaVersion || +stateSource.schemaVersion || 0;
  const sourceFileVersion=+context.fileVersion || +item.fileVersion || 0;
  const sourceSchemaVersion=+context.schemaVersion || 0;
  let state=legacyVersion && legacyVersion>=TRAIT_PRESET_SCHEMA_VERSION
    ? normalizeSavedState(stateSource)
    : migrateTraitPresetStateByName(stateSource, name);
  if(!state) return null;
  const now=Date.now();
  const sourceStorageVersion=stateSource.storageVersion || item.storageVersion || context.storageVersion || state.storageVersion || '';
  const legacyFromOldFile=sourceFileVersion>0 && sourceFileVersion<TRAIT_PRESET_FILE_VERSION;
  const legacyFromOldSchema=sourceSchemaVersion>0 && sourceSchemaVersion<TRAIT_PRESET_SCHEMA_VERSION;
  const legacyFromItemSchema=!legacyVersion || legacyVersion<TRAIT_PRESET_SCHEMA_VERSION;
  const legacyFromMissingTowerFloor=!hasTraitPresetTowerFloorField(state);
  const explicitVersionState=normalizeTraitPresetVersionState(item.versionState || item.presetVersionState || item.versionStatus);
  const explicitLegacyRefresh=item.needsExportRefresh===true && (!isCurrentTraitPresetStructure(item,state) || hasLegacyTraitPresetSourceMarker(item) || explicitVersionState==='legacy');
  const needsExportRefresh=context.clearExportRefresh===true ? false : (
    explicitVersionState==='legacy' ||
    explicitLegacyRefresh ||
    legacyFromOldFile ||
    legacyFromOldSchema ||
    legacyFromItemSchema ||
    legacyFromMissingTowerFloor
  );
  if(context.forceCurrentVersion===true){
    state=markPresetStateCurrentVersion(state);
  }
  const preset={
    id:String(item.id || makeTraitPresetId()),
    name,
    schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,
    versionState:needsExportRefresh ? 'legacy' : 'current',
    createdAt:+item.createdAt || +item.savedAt || now,
    updatedAt:+item.updatedAt || +state.savedAt || now,
    meta:{...((item.meta && typeof item.meta==='object') ? item.meta : {}), ...traitPresetMetaFromSavedState(state)},
    state
  };
  if(needsExportRefresh){
    preset.needsExportRefresh=true;
    if(legacyFromOldFile) preset.migratedFromFileVersion=String(sourceFileVersion || '0');
    if(legacyFromOldSchema) preset.migratedFromSchemaVersion=String(sourceSchemaVersion || '0');
    if(legacyFromItemSchema) preset.migratedFromLegacySchema=String(legacyVersion || '0');
    if(legacyFromMissingTowerFloor) preset.missingChallengeTowerFloor=true;
    if((legacyFromOldFile || legacyFromOldSchema || legacyFromItemSchema || legacyFromMissingTowerFloor) && sourceStorageVersion && sourceStorageVersion!==STORAGE_VERSION){
      preset.migratedFromStorageVersion=String(sourceStorageVersion);
    }
  }
  return preset;
}
function normalizeTraitPresetStore(data){
  const empty=emptyTraitPresetStore();
  const source=(data && typeof data==='object') ? data : {};
  const rawPresets=Array.isArray(source.presets) ? source.presets : (Array.isArray(data) ? data : []);
  const seen=new Set();
  const presets=[];
  const itemContext={fileVersion:+source.fileVersion || 0,schemaVersion:+source.schemaVersion || 0,storageVersion:source.storageVersion || ''};
  rawPresets.forEach((item,index)=>{
    const preset=normalizeTraitPresetItem(item,index,itemContext);
    if(!preset) return;
    if(seen.has(preset.id)) preset.id=makeTraitPresetId();
    seen.add(preset.id);
    presets.push(preset);
  });
  let defaultPresetId=String(source.defaultPresetId || '');
  if(defaultPresetId && !presets.some(item=>item.id===defaultPresetId)){
    const byName=presets.find(item=>item.name===source.defaultPresetName);
    defaultPresetId=byName ? byName.id : '';
  }
  return {...empty,fileVersion:TRAIT_PRESET_FILE_VERSION,schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,storageVersion:STORAGE_VERSION,updatedAt:+source.updatedAt || Date.now(),defaultPresetId,presets};
}
/* ===== 05. 프리셋 저장소 로드 / 컨트롤 렌더링 ===== */
function loadTraitPresetStore(){
  try{
    const raw=localStorage.getItem(TRAIT_PRESET_STORAGE_KEY);
    return normalizeTraitPresetStore(raw ? safeJsonParse(raw) : null);
  }catch(e){
    logAppWarn('loadTraitPresetStore failed', e);
    return emptyTraitPresetStore();
  }
}
/* ===== 06. 프리셋 CRUD / 상태 적용 ===== */
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
  const defaultId=String(store?.defaultPresetId || '');
  if(defaultId && presets.some(preset=>preset.id===defaultId)) return defaultId;
  return presets[0].id || '';
}

function traitPresetVersionInfo(preset){
  if(!preset) return {state:'empty',label:'프리셋을 불러와 주세요',className:'preset-version-empty'};
  const state=preset.state || {};
  const legacy=shouldTreatTraitPresetAsLegacy(preset,state);
  if(legacy) return {state:'legacy',label:'구버전 · 내보내기 필요',className:'preset-version-legacy'};
  return {state:'current',label:'최신버전',className:'preset-version-current'};
}
function currentTraitPresetNoticeStatus(){
  const store=loadTraitPresetStore();
  const id=selectedTraitPresetId();
  const preset=store.presets.find(item=>item.id===id) || null;
  const info=traitPresetVersionInfo(preset);
  return {
    ...info,
    hasPreset:!!preset,
    presetId:preset?.id || '',
    presetName:preset?.name || '',
    presetCount:store.presets.length
  };
}
function traitPresetVersionHeaderLabel(info){
  if(info?.state==='current') return '최신버전';
  if(info?.state==='legacy') return '구버전';
  return '확인 필요';
}
window.DpsTraitPresetVersion={info:traitPresetVersionInfo,status:currentTraitPresetNoticeStatus};
function updateTraitPresetVersionView(preset){
  const view=$('traitPresetVersionView');
  const info=traitPresetVersionInfo(preset);
  if(view){
    view.className=`trait-preset-version-badge ${info.className}`;
    view.innerHTML=`<span class="trait-preset-version-label">프리셋 버전</span><span class="trait-preset-version-separator">-</span><span class="trait-preset-version-value">${escapeCompareHtml(traitPresetVersionHeaderLabel(info))}</span>`;
  }
  const title=$('.trait-preset-title');
  if(title){
    title.classList.remove('preset-version-current','preset-version-legacy','preset-version-unknown','preset-version-empty');
    title.classList.add(info.className);
  }
}
function refreshTraitPresetControls(selectedId){
  const store=loadTraitPresetStore();
  const select=$('traitPresetSelect');
  const nameInput=$('traitPresetName');
  const defaultBtn=$('traitPresetDefaultBtn');
  const selected=resolveTraitPresetSelection(store,selectedId || selectedTraitPresetId());
  if(select){
    const hasPresets=store.presets.length>0;
    select.innerHTML='';
    const empty=document.createElement('option');
    empty.value='';
    empty.textContent=hasPresets ? '프리셋 목록' : '저장된 프리셋 없음';
    empty.disabled=true;
    empty.hidden=hasPresets;
    select.appendChild(empty);
    store.presets.forEach(preset=>{
      const option=document.createElement('option');
      option.value=preset.id;
      option.textContent=preset.id===store.defaultPresetId ? `${preset.name} · 기본` : preset.name;
      select.appendChild(option);
    });
    select.value=selected || '';
    select.disabled=!hasPresets;
  }
  const currentId=select?.value || '';
  const current=store.presets.find(preset=>preset.id===currentId);
  updateTraitPresetVersionView(current);
  dispatchTraitPresetStoreChanged({source:'selection', selectedTraitPresetId:current?.id || '', versionState:traitPresetVersionInfo(current).state});
  if(defaultBtn) defaultBtn.textContent=current && current.id===store.defaultPresetId ? '기본 해제' : '기본 지정';
  qsa('[data-action="loadTraitPreset"],[data-action="renameTraitPreset"],[data-action="deleteTraitPreset"],[data-action="setDefaultTraitPreset"]').forEach(btn=>{
    btn.disabled=!current;
  });
  qsa('[data-action="exportTraitPresets"]').forEach(btn=>{ btn.disabled=!store.presets.length; });
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
      store.presets[index]={...prev,name,updatedAt:now,meta:traitPresetMetaFromState(),state};
    }else{
      id=makeTraitPresetId();
      store.presets.push({id,name,createdAt:now,updatedAt:now,meta:traitPresetMetaFromState(),state});
    }
    store=saveTraitPresetStore(store);
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
    const saved=saveState({silent:true, syncTraitPresets:options.syncTraitPresets, selectedTraitPresetId:options.syncTraitPresetId});
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
  return loadTraitPresetById(selectedTraitPresetId());
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
      if(nextStore.defaultPresetId===id) nextStore.defaultPresetId='';
      saveTraitPresetStore(nextStore);
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
function setDefaultTraitPreset(){
  const id=selectedTraitPresetId();
  let store=loadTraitPresetStore();
  const preset=store.presets.find(item=>item.id===id);
  if(!preset){ notifyStorageAction('기본으로 지정할 프리셋을 선택하세요.','err'); return false; }
  try{
    const removing=store.defaultPresetId===id;
    store.defaultPresetId=removing ? '' : id;
    store=saveTraitPresetStore(store);
    refreshTraitPresetControls(id);
    notifyStorageAction(removing ? '기본 프리셋 해제 완료' : `기본 프리셋 지정 완료: ${preset.name}`,'ok',{statusAction:'save'});
    return true;
  }catch(e){
    logAppError('[trait preset default failed]',e);
    notifyStorageAction(e?.message || '기본 프리셋 지정 실패','err');
    return false;
  }
}
/* ===== 07. 첫 방문 상태 복원 / 프리셋 전체 초기화 ===== */
function resetToFirstVisitState(){
  try{
    try{
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TRAIT_PRESET_STORAGE_KEY);
      localStorage.removeItem(DPS_CONFIG.storage.fontKey);
    }catch(e){}
    resetToFactoryState();
    refreshTraitPresetControls('');
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
/* ===== 08. 프리셋 파일명 / export 모달 ===== */
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
  createModalShell('traitPresetExportModal','trait-preset-excel-modal-shell',`
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
    const defaultPreset=store.presets.find(item=>item.id===store.defaultPresetId);
    createTraitPresetExportModal();
    const input=$('traitPresetExportName');
    if(input) input.value=defaultPreset?.name || '';
    setModalOpen('traitPresetExportModal','trait-preset-excel-modal-open',true);
    setTimeout(()=>{ input?.focus(); input?.select(); },0);
    return true;
  }catch(e){
    logAppError('[trait preset export modal failed]',e);
    notifyStorageAction(e?.message || '특성 프리셋 내보내기 준비 실패','err');
    return false;
  }
}
function closeTraitPresetExportModal(){
  setModalOpen('traitPresetExportModal','trait-preset-excel-modal-open',false);
}
function downloadTraitPresetExport(customName=''){
  if(traitPresetExportDownloadLocked) return false;
  traitPresetExportDownloadLocked=true;
  setTraitPresetExportSavingState(true);
  try{
    if(!isStorageLocked()) saveState({silent:true});
    const store=loadTraitPresetStore();
    if(!store.presets.length){ notifyStorageAction('내보낼 프리셋이 없습니다.','err'); return false; }
    const wasLegacyPreset=store.presets.some(preset=>shouldTreatTraitPresetAsLegacy(preset));
    const exportStore=finalizeTraitPresetStoreForExport(store);
    saveTraitPresetStore(exportStore,{source:'export'});
    const defaultPreset=exportStore.presets.find(item=>item.id===exportStore.defaultPresetId);
    delete exportStore.webDpsVersion;
    const payload=JSON.stringify({webDpsVersion:currentWebDpsVersion(),...exportStore,type:TRAIT_PRESET_FILE_TYPE,fileVersion:TRAIT_PRESET_FILE_VERSION,exportedAt:new Date().toISOString(),defaultPresetName:defaultPreset?.name || ''}, null, 2);
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
    notifyTraitPresetExportComplete(wasLegacyPreset);
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
/* ===== 09. 프리셋 파일 import / 병합 ===== */
function openTraitPresetImportPicker(){
  setTimeout(()=>{
    const input=$('traitPresetImportFile');
    if(input) input.click();
  },60);
}
function normalizeTraitPresetImportData(parsed,fileName=''){
  if(!parsed) throw new Error('특성 프리셋 파일 형식이 아닙니다.');
  const stateOnly=normalizeSavedState(parsed);
  if(stateOnly && !Array.isArray(parsed.presets)){
    const name=normalizeTraitPresetName(parsed.name || stateFileBaseName(fileName));
    const legacyPreset={
      id:makeTraitPresetId(),
      name,
      schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,
      versionState:'legacy',
      needsExportRefresh:true,
      migratedFromLegacySchema:String(+parsed.schemaVersion || 0),
      createdAt:Date.now(),
      updatedAt:Date.now(),
      meta:traitPresetMetaFromSavedState(stateOnly),
      state:stateOnly
    };
    if(!hasTraitPresetTowerFloorField(stateOnly)) legacyPreset.missingChallengeTowerFloor=true;
    const sourceStorageVersion=parsed.storageVersion || stateOnly.storageVersion || '';
    if(sourceStorageVersion && sourceStorageVersion!==STORAGE_VERSION) legacyPreset.migratedFromStorageVersion=String(sourceStorageVersion);
    return {defaultPresetId:'',defaultPresetName:'',presets:[legacyPreset]};
  }
  const source=Array.isArray(parsed) ? {presets:parsed} : parsed;
  const importContext={fileVersion:+source.fileVersion || 0,schemaVersion:+source.schemaVersion || 0,storageVersion:source.storageVersion || ''};
  const presets=Array.isArray(source.presets) ? source.presets.map((item,index)=>normalizeTraitPresetItem(item,index,importContext)).filter(Boolean) : [];
  if(!presets.length) throw new Error('가져올 수 있는 프리셋이 없습니다.');
  return {defaultPresetId:String(source.defaultPresetId || ''),defaultPresetName:normalizeTraitPresetName(source.defaultPresetName || ''),presets};
}
function mergeTraitPresetImport(imported){
  let store=loadTraitPresetStore();
  let added=0, replaced=0, firstImportedPresetId='', defaultImportedPresetId='';
  const idMap=new Map();
  imported.presets.forEach((preset,index)=>{
    const existingIndex=store.presets.findIndex(item=>item.name===preset.name);
    if(existingIndex>=0){
      const id=store.presets[existingIndex].id;
      idMap.set(preset.id,id);
      store.presets[existingIndex]={...preset,id,createdAt:store.presets[existingIndex].createdAt || preset.createdAt,updatedAt:Date.now()};
      if(index===0) firstImportedPresetId=id;
      replaced++;
    }else{
      const id=store.presets.some(item=>item.id===preset.id) ? makeTraitPresetId() : preset.id;
      idMap.set(preset.id,id);
      store.presets.push({...preset,id,createdAt:preset.createdAt || Date.now(),updatedAt:Date.now()});
      if(index===0) firstImportedPresetId=id;
      added++;
    }
  });
  if(imported.defaultPresetId && idMap.has(imported.defaultPresetId)){
    defaultImportedPresetId=idMap.get(imported.defaultPresetId);
    store.defaultPresetId=defaultImportedPresetId;
  }else if(imported.defaultPresetName){
    const importedDefault=imported.presets.find(item=>item.name===imported.defaultPresetName);
    const mappedId=importedDefault ? idMap.get(importedDefault.id) : '';
    const defaultPreset=mappedId ? store.presets.find(item=>item.id===mappedId) : store.presets.find(item=>item.name===imported.defaultPresetName);
    if(defaultPreset){
      defaultImportedPresetId=defaultPreset.id;
      store.defaultPresetId=defaultImportedPresetId;
    }
  }
  store=saveTraitPresetStore(store,{source:'import'});
  return {store,added,replaced,firstImportedPresetId,defaultImportedPresetId};
}
/* ===== 10. 엑셀 시트 프리셋 저장 ===== */
function isExcelPresetImportFile(file){
  const name=String(file?.name||'').toLowerCase();
  const type=String(file?.type||'').toLowerCase();
  return name.endsWith('.xlsx') || name.endsWith('.xlsm') || type.includes('spreadsheet') || type.includes('excel.sheet.macroenabled');
}
const traitPresetExcelImportState={workbook:null,fileName:''};
function createTraitPresetExcelImportModal(){
  createModalShell('traitPresetExcelImportModal','trait-preset-excel-modal-shell',`
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
  setModalOpen('traitPresetExcelImportModal','trait-preset-excel-modal-open',true);
}
function closeTraitPresetExcelImportModal(){
  setModalOpen('traitPresetExcelImportModal','trait-preset-excel-modal-open',false);
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
    const imported={defaultPresetId:'',defaultPresetName:'',presets:[{
      id:makeTraitPresetId(),
      name,
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
    const imported=normalizeTraitPresetImportData(parsed,file?.name || '');
    const result=mergeTraitPresetImport(imported);
    const loadId=result.defaultImportedPresetId || result.firstImportedPresetId || '';
    if(loadId) loadTraitPresetById(loadId,{notifySuccess:false,preserveSharedValues:false});
    else refreshTraitPresetControls('');
    notifyStorageAction(`프리셋 가져오기 및 로드 완료 · 추가 ${result.added} / 갱신 ${result.replaced}`,'ok',{statusAction:'import'});
    return true;
  }catch(e){
    logAppError('[trait preset import failed]',e);
    notifyStorageAction(e?.message || '특성 프리셋 가져오기 실패','err');
    return false;
  }
}
/* ===== 11. 프리셋 비교 패널 ===== */
function selectedBaseTraitPreset(){
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
    delete nextPreset.needsExportRefresh;
    delete nextPreset.migratedFromStorageVersion;
    delete nextPreset.migratedFromFileVersion;
    delete nextPreset.migratedFromSchemaVersion;
    delete nextPreset.migratedFromLegacySchema;
    delete nextPreset.missingChallengeTowerFloor;
    if(index>=0) store.presets[index]=nextPreset;
    else store.presets.push(nextPreset);
    if(compareState.baseTraitPresetBundle && Array.isArray(compareState.baseTraitPresetBundle.presets)){
      const bundleIndex=compareState.baseTraitPresetBundle.presets.findIndex(item=>item.id===basePreset.id || item.name===basePreset.name);
      if(bundleIndex>=0){
        const bundlePrev=compareState.baseTraitPresetBundle.presets[bundleIndex];
        const nextBundlePreset={...bundlePrev,id:bundlePrev.id,name:bundlePrev.name,createdAt:bundlePrev.createdAt,updatedAt:now,schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,meta:traitPresetMetaFromSavedState(nextState),state:nextState};
        delete nextBundlePreset.needsExportRefresh;
        delete nextBundlePreset.migratedFromStorageVersion;
        delete nextBundlePreset.migratedFromFileVersion;
        delete nextBundlePreset.migratedFromSchemaVersion;
        delete nextBundlePreset.migratedFromLegacySchema;
        delete nextBundlePreset.missingChallengeTowerFloor;
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
  const body=$('excelCompareBody');
  const apply=$('excelCompareApplyBtn');
  const reset=$('excelCompareResetBtn');
  if(!options.preserveRestore) clearCompareRestoreState();
  try{
    compareState.sourceType='traitPreset';
    compareState.selectedSheetName=preset.id;
    renderTraitPresetComparison(preset);
    updateCompareActionButtons();
  }catch(e){
    logAppError('[trait preset compare failed]',e);
    if(apply) apply.disabled=true;
    if(reset) reset.disabled=false;
    if(body) body.innerHTML=`<div class="excel-compare-error">${escapeCompareHtml(e?.message||String(e))}</div>`;
    updateCompareActionButtons();
  }
}
function compareTraitPreset(){
  const id=selectedTraitPresetId();
  const store=loadTraitPresetStore();
  const preset=store.presets.find(item=>item.id===id);
  resetCompareState();
  if(preset){
    compareState.baseTraitPresetId=id;
  }
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
/* ===== 12. 기본 프리셋 부팅 적용 / 이벤트 바인딩 ===== */
function applyDefaultTraitPresetOnBoot(){
  const store=loadTraitPresetStore();
  const preset=store.presets.find(item=>item.id===store.defaultPresetId);
  if(!preset) return false;
  try{
    applyTraitPresetState(preset,{persist:false,preserveSharedValues:storageState.hasSavedState});
    return true;
  }catch(e){
    logAppWarn('[trait preset default boot failed]',e);
    return false;
  }
}
function bindTraitPresetEvents(){
  document.addEventListener('change',e=>{
    if(e.target?.id==='traitPresetSelect') refreshTraitPresetControls(e.target.value);
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
