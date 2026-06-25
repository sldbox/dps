/* ===== 00. DOM 헬퍼 ===== */
const $=id=>document.getElementById(id);
const qs=selector=>document.querySelector(selector);
const qsa=selector=>document.querySelectorAll(selector);

/* ===== 01. 설정 / 기준 데이터 ===== */
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
    skipElementIds:['dpsTableMinDpsMain','ep']
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
function enchantAt(pos){
  syncEnchantCodeFromInputs(false);
  const code=($('enchantCode')?.value||'999999').padEnd(6,'0');
  const lv=Math.max(0,Math.min(9,parseInt(code[pos]||'0',10)||0));
  return ENCHANT_TABLE[lv];
}

/* ===== 02. 전역 상태 / 특성 투자 상태 ===== */
const INV={};
TRAITS.forEach(t=>{INV[t[0]]=0;});
Object.assign(INV,{116:1});
const AUTO_INVEST_EXCLUDED_ROWS=new Set([45,87]);
const ENCHANT_INPUT_IDS=['enchAD','enchCRI','enchUA','enchTD','enchSR','enchHR'];
const ENCHANT_INPUT_ID_SET=new Set(ENCHANT_INPUT_IDS);
const FIXED_STEP_AFTER_150={93:76000,94:76000,95:114000};
function fixedStepAfter150(row){return FIXED_STEP_AFTER_150[row] || 0;}
function nextCost(row){
  const step=STEP_COST[row];
  const n=INV[row]||0;
  const mx=TMAX[row]||999;
  if(n>=mx) return Infinity;
  if(step) return Number.isFinite(step[n]) ? step[n] : Infinity;
  const p=COST[row];
  if(!p){
    if(RP_ROWS.has(row)) return nextRpCost(row);
    return Infinity;
  }
  const [a,d,mx2]=p;
  if(n>=mx2) return Infinity;
  const fixed=fixedStepAfter150(row);
  if(fixed && n>=150) return fixed;
  return n<400 ? a+n*d : a+400*d+(n-400)*(d/2);
}
function cumCost(row){
  const n=Math.min(INV[row]||0,TMAX[row]||999);
  const step=STEP_COST[row];
  if(step) return step.slice(0,n).reduce((a,b)=>a+(+b||0),0);
  const p=COST[row];
  if(!p) return 0;
  const [a,d,mx]=p; const nn=Math.min(n,mx);
  if(nn<=0) return 0;
  const fixed=fixedStepAfter150(row);
  if(fixed && nn>150){
    const base=(150*(2*a+(149)*d))/2;
    return base + (nn-150)*fixed;
  }
  const e=Math.min(nn,400);
  let s=(e*(2*a+(e-1)*d))/2;
  if(nn>400){const ov=nn-400,x0=a+400*d;s+=(ov*(2*x0+(ov-1)*(d/2)))/2;}
  return s;
}
/* ===== 03. 공통 UI / 입력값 유틸 ===== */
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
    el.className='toast '+type;
    el.textContent=message;
    root.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('show'));
    setTimeout(()=>{
      el.classList.remove('show');
      setTimeout(()=>el.remove(), 220);
    }, 2200);
  }catch(e){}
}
const ROUND_INPUT_MIN=1;
const ROUND_INPUT_MAX=300;
function normalizedRoundNumber(value, fallback=ROUND_INPUT_MIN){
  const raw=String(value ?? '').replace(/,/g,'').trim();
  const num=raw==='' ? NaN : Number(raw);
  const base=Number.isFinite(num) ? num : fallback;
  return Math.max(ROUND_INPUT_MIN, Math.min(ROUND_INPUT_MAX, Math.round(base)));
}
function normalizedRoundString(value){ return String(normalizedRoundNumber(value)); }
function v(id){const el=$(id); if(!el) return 0; const raw=String(el.value??'').replace(/,/g,'').trim(); if(id==='round'||id==='skillRound') return normalizedRoundNumber(raw); return +raw||0;}
function vs(id){const el=$(id); return el ? el.value : '';}
const BASE_DISPLAY_STATS={ad:5, as:5, cri:5};
function effectiveXpValue(){return Math.max(1, v('xp'));}
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
const RUNE_CHOICE_TARGETS=[['ap','rAP'],['ua','rUA'],['td','rTD'],['harmony','rHarmony']];
const RUNE_CHOICE_TYPE_LABELS={
  ap:'마법공격력',
  ua:'유닛 가속',
  td:'총 데미지',
  harmony:'총 데미지 & 유닛 가속'
};
const RUNE_CHOICE_TYPE_ALIASES={
  ap:'ap', ua:'ua', td:'td', harmony:'harmony',
  'td&ua':'harmony','td＆ua':'harmony','총뎀가속':'harmony','총데미지&유닛가속':'harmony','총데미지＆유닛가속':'harmony'
};
function normalizeRuneChoiceType(value){
  const key=String(value??'').trim().replace(/\s+/g,'').toLowerCase();
  return RUNE_CHOICE_TYPE_ALIASES[key] || (RUNE_CHOICE_TYPE_LABELS[key] ? key : 'harmony');
}
function normalizeRuneChoiceValue(value){
  const n=Number(String(value??'0').replace(/,/g,'').trim());
  return Number.isFinite(n) ? n : 0;
}
function normalizeRuneChoiceValues(values={}){
  const out={...values};
  out.runeChoiceType=normalizeRuneChoiceType(out.runeChoiceType || 'harmony');
  out.runeChoiceValue=String(normalizeRuneChoiceValue(out.runeChoiceValue));
  return out;
}

/* ===== 04. 계산 보조 / 난이도 / 룬 / 특성 효과 ===== */
const TOWER_DIFFICULTY_NAME='도전의 탑';
const ABYSS_DIFFICULTIES=new Set(['Abyss road','Deep Abyss']);
const COOP_DISABLED_DIFFICULTIES=new Set([TOWER_DIFFICULTY_NAME,...ABYSS_DIFFICULTIES]);
const SOLO_START_LOCK_DIFFICULTIES=new Set([TOWER_DIFFICULTY_NAME,'Deep Abyss']);
function difficultyName(value=vs('diff')){return String(value || '').trim();}
function isDifficultyIn(value, set){return set.has(difficultyName(value));}
function isAbyssDifficulty(diffName=vs('diff')){return isDifficultyIn(diffName, ABYSS_DIFFICULTIES);}
function isCoopAllowedDifficulty(diffName=vs('diff')){return !isDifficultyIn(diffName, COOP_DISABLED_DIFFICULTIES);}
function isSoloStartDifficulty(diffName=vs('diff')){return isDifficultyIn(diffName, SOLO_START_LOCK_DIFFICULTIES);}
function abyssEffectiveStack(){
  if(!isAbyssDifficulty()) return 0;
  const round=Math.max(0, v('round'));
  const abyssRes=(INV[131]||0) * 3;
  const deepExtra=difficultyName()==='Deep Abyss' ? Math.floor(round/10)*5 : 0;
  return Math.max(0, round - abyssRes + deepExtra);
}
function abyssTdPenalty(){
  return abyssEffectiveStack() * 0.5;
}
function abyssSlowMultiplier(){
  return Math.pow(0.9875, abyssEffectiveStack());
}
function abyssAdPenalty(){
  if(!isAbyssDifficulty()) return 0;
  const base=difficultyName()==='Deep Abyss' ? 5 : 0.75;
  const stack=Math.max(0, v('erosionStack'));
  const jewelRes=Math.max(0, Math.min(100, v('jewelErosionRes')));
  const traitRes=(INV[132]||0) * 0.025;
  return Math.max(0, base * stack * (1 - (jewelRes/100 + traitRes)));
}
function traitRate(t){
  const row=t[0];
  if(isAbyssDifficulty()){
    if(row===133) return 15;
    if(row===134) return 7.5;
    if(row===135) return 1.5;
  }
  return t[4]||0;
}
function sumStat(type){
  let s=0;
  TRAITS.forEach(t=>{
    if(t[3]!==type||T_UA.has(t[0])) return;
    let val=(INV[t[0]]||0)*traitRate(t);
    if(t[5]==='team' && !isSoloStartDifficulty()) val*=Math.max(1,v('team')||1);
    if(t[0]===70||t[0]===103||t[0]===110) val=Math.round(val*10)/10;
    s+=val;
  });
  return s;
}
function uaProd(){
  const rates={99:0.24,111:0.08,136:(isAbyssDifficulty()?3:0.4)};
  let p=1;
  for(const [r,rate] of Object.entries(rates)){
    const n=INV[+r]||0;
    if(n>0){
      let val=Math.pow(1+rate/100,n);
      if(+r===99||+r===111) val=Math.round(val*10000)/10000;
      p*=val;
    }
  }
  return p;
}
function dps0(hpRemain,enemyArmor,dr,pierce,dmgReduce){
  const armor=Math.max(0, Number.isFinite(enemyArmor)?enemyArmor:enemyRoundData(v('round')).armor);
  const hp=Math.max(0.01, Number.isFinite(hpRemain)?hpRemain:1);
  const dmg=Number.isFinite(dmgReduce)?dmgReduce:(DIFF[vs('diff')]||DIFF['The Final']).dmg;
  return (100/(100+armor*(1-dr/100)*(1-pierce/100))) / hp * (dmg/100);
}
function actualDrWithPierce(dr,pierce){
  return dr + (100-dr) * (pierce / 100);
}
const COOP_PASSENGER_TARGET_EFFECTS=Object.freeze({defenseReduce:0,pierce:0,hpReduce:0,shieldReduce:0});
function enemyDurabilityRemain(enemyData, displayHR, displaySR){
  const hp=enemyData?.hp || 0;
  const shield=enemyData?.shield || 0;
  const total=Math.max(0, hp + shield);
  if(total<=0) return {remain:1,hpRatio:1,shieldRatio:0};
  const hpRatio=hp / total;
  const shieldRatio=shield / total;
  const remain=Math.max(0.01, hpRatio * (1 - displayHR / 100) + shieldRatio * (1 - displaySR / 100));
  return {remain,hpRatio,shieldRatio};
}
function targetDurabilityRemain(enemyData, targetEffects){
  return enemyDurabilityRemain(enemyData, targetEffects.hpReduce, targetEffects.shieldReduce);
}
function battleTargetDps0Average(ownTarget,passengerTarget,enemyArmor,dmgReduce){
  const playerCount=battleEnemyCountMultiplier();
  const ownDps0=dps0(ownTarget.hpRemain, enemyArmor, ownTarget.defenseReduce, ownTarget.pierce, dmgReduce);
  if(playerCount<=1) return ownDps0;

  // 협동 2P/3P 몹은 내가 직접 잡지만, 승객의 방감/방관/체력감소/실드감소는 전부 0 기준으로 본다.
  const passengerDps0=dps0(passengerTarget.hpRemain, enemyArmor, passengerTarget.defenseReduce, passengerTarget.pierce, dmgReduce);
  return (ownDps0 + passengerDps0 * (playerCount - 1)) / playerCount;
}
function dps2(cri,mc,cd,md,mp,mcp,radiation=0){
  let a=cri;
  let d=md;
  let e=mp;
  let f=mcp;
  if(radiation===1 || radiation===true){
    a=a/2;
    d=0;
    e=0;
    f=0;
  }
  if(a>=300) return 1+cd/100+mc*cd*2/300+d/100*e/100*(1+f/100*cd/100+f/100*mc*cd*2/300);
  if(a>=100) return 1+cd/100+mc*a/300*cd*2/300+d/100*e/100*(1+f/100*cd/100+f/100*mc*a/300*cd*2/300);
  return 1+a/100*cd/100+mc*a/100*a/300*cd*2/300+d/100*e/100*(1+f/100*cd/100+f/100*mc*a/300*cd*2/300);
}
function lookupFloor(table, round){
  const r=Math.max(1,Math.round(+round||1));
  let last=null;
  for(const row of table){
    if(row[0] <= r) last=row; else break;
  }
  return last || table[0];
}
function isTowerDifficulty(){return difficultyName()===TOWER_DIFFICULTY_NAME;}
function enemyRoundData(round){
  const maxRound=isTowerDifficulty()?90:300;
  const r=Math.max(0,Math.min(maxRound,Math.round(+round||0)));
  if(r<=0) return {round:0,armor:0,unitRound:0,count:0,hp:0,shield:0};
  const armorTable=isTowerDifficulty()?TOWER_ARMOR_TABLE:ENEMY_ARMOR_TABLE;
  const unitTable=isTowerDifficulty()?TOWER_UNIT_TABLE:ENEMY_UNIT_TABLE;
  const armorRow=lookupFloor(armorTable, r);
  const unitRow=lookupFloor(unitTable, r);
  return {
    round:r,
    armor: armorRow && armorRow[0] <= r ? armorRow[1] : 0,
    unitRound: unitRow ? unitRow[0] : r,
    count: unitRow ? unitRow[1] : 0,
    hp: unitRow ? unitRow[2] : 0,
    shield: unitRow ? unitRow[3] : 0
  };
}
function enemyRoundCountTotal(round){
  if(isTowerDifficulty()) return enemyRoundData(round).count;
  const r=Math.max(0,Math.min(300,Math.round(+round||0)));
  if(r<=0) return 0;
  return ENEMY_UNIT_TABLE.reduce((total,row)=>total+(row[0]<=r ? (+row[1]||0) : 0),0);
}
function enemyRoundDisplayCount(round){
  return enemyRoundData(round).count * battleEnemyCountMultiplier();
}
function enemyTotalDisplayCount(round){
  return enemyRoundCountTotal(round) * battleEnemyCountMultiplier();
}
function enemyDisplayCountText(round){
  if(isTowerDifficulty()) return fullNumber(enemyRoundData(round).count);
  return `${fullNumber(enemyRoundDisplayCount(round))} / ${fullNumber(enemyTotalDisplayCount(round))}`;
}

function towerClearTime(floor){
  const row=lookupFloor(TOWER_TIME_TABLE, Math.max(1, Math.round(+floor||1)));
  const value=row ? Number(row[1]) : 60;
  return Number.isFinite(value) && value>0 ? value : 60;
}
function towerFloorEnemyData(floor){
  const r=Math.max(1, Math.min(90, Math.round(+floor||1)));
  const armorRow=lookupFloor(TOWER_ARMOR_TABLE, r);
  const unitRow=lookupFloor(TOWER_UNIT_TABLE, r);
  return {
    round:r,
    armor: armorRow && armorRow[0] <= r ? armorRow[1] : 0,
    count: unitRow ? unitRow[1] : 0,
    hp: unitRow ? unitRow[2] : 0,
    shield: unitRow ? unitRow[3] : 0
  };
}
function towerBurdenScore(floor, displayHR, displaySR){
  const enemy=towerFloorEnemyData(floor);
  if(!enemy.count) return 1;
  const hpRemain=Math.max(0, (enemy.hp||0) * (1 - Math.max(0, displayHR||0)/100));
  const shieldRemain=Math.max(0, (enemy.shield||0) * (1 - Math.max(0, displaySR||0)/100));
  const durability=Math.max(1, hpRemain + shieldRemain);
  return Math.max(1, enemy.count * durability / towerClearTime(enemy.round));
}
function towerDpsDisplayMultiplier(floor, displayHR, displaySR){
  const r=Math.max(1, Math.min(90, Math.round(+floor||1)));
  if(r<=80) return 1;
  const base=towerBurdenScore(81, displayHR, displaySR);
  const current=towerBurdenScore(r, displayHR, displaySR);
  if(!Number.isFinite(base) || !Number.isFinite(current) || current<=0) return 1;
  return Math.min(1, Math.max(0.000001, base/current));
}
function contentDpsDisplayMultiplier(diffName, round, displayHR, displaySR){
  return difficultyName(diffName)===TOWER_DIFFICULTY_NAME ? towerDpsDisplayMultiplier(round, displayHR, displaySR) : 1;
}
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
  if(id==='enhanceMaster') syncPowerBlessOptions({auto:true});
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
function syncBuffChoiceButtons(){
  qsa('.buff-choice-item').forEach(item=>{
    const input=item.querySelector('input[type="checkbox"]');
    const active=!!(input && input.checked);
    setClassState(item, 'is-active', active);
    item.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}
const POWER_BLESS_OPTIONS_BY_MASTER={ON:[20,40,60],'ON+':[30,60,90]};
const POWER_BLESS_AUTO_VALUES={ON:{1:20,2:40,3:60},'ON+':{1:30,2:60,3:90}};
const COOP_PLAYERS_DEFAULT='3';
const COOP_PLAYERS_DISABLED_LABEL='협동 활성화 필요';
const SOLO_ONLY_LABEL='OFF';
const POWER_BLESS_DISABLED_LABEL='강화의달인 활성화 필요';
const ABYSS_DISABLED_LABEL='어비스 활성화 필요';
const EROSION_CONTROL_DEFAULTS={erosionStack:'500',jewelErosionRes:'30'};
const EROSION_CONTROL_IDS=new Set(Object.keys(EROSION_CONTROL_DEFAULTS));
const SOLO_PENANCE_MAX=20;
const COOP_PENANCE_MAX=13;
function powerBlessAllowedOptions(master){return POWER_BLESS_OPTIONS_BY_MASTER[master] || [];}
function normalizeOnOffValue(value, fallback='OFF'){
  const text=String(value??'').trim().toUpperCase();
  return text==='ON' ? 'ON' : text==='OFF' ? 'OFF' : fallback;
}
function normalizeCoopPlayersValue(value, fallback=COOP_PLAYERS_DEFAULT){
  const text=String(value??'').trim();
  return text==='3' ? '3' : text==='2' ? '2' : fallback;
}
function normalizeTeamCountValue(value, fallback=1){
  const n=Math.round(Number(value));
  return String(Math.max(1, Math.min(3, Number.isFinite(n) ? n : fallback)));
}
function isCoopMode(){return normalizeOnOffValue(vs('coopMode'),'OFF')==='ON';}
function isCoopActive(diffName=vs('diff')){return isCoopMode() && isCoopAllowedDifficulty(diffName);}
function coopPlayerCount(){return Number(normalizeCoopPlayersValue(vs('coopPlayers')));}
function battleEnemyCountMultiplier(){return isCoopActive() ? coopPlayerCount() : 1;}
function currentPenanceMax(){return isCoopActive() ? COOP_PENANCE_MAX : SOLO_PENANCE_MAX;}
function penanceOptionLabel(value){return value>0 ? `${value} 고행` : '없음';}
function syncPenanceOptions(){
  const el=$('penance');
  if(!el) return;
  const max=currentPenanceMax();
  const current=Math.max(0, Math.round(+el.value || 0));
  if(el.dataset.penanceMax!==String(max)){
    setSelectOptions(el, Array.from({length:max+1}, (_,value)=>({value,label:penanceOptionLabel(value)})));
    el.dataset.penanceMax=String(max);
  }
  el.value=String(Math.max(0, Math.min(max, current)));
}
function currentPowerBlessPlayerCount(){
  return isCoopActive() ? coopPlayerCount() : Number(normalizeTeamCountValue(v('team')));
}
function autoPowerBlessValue(master=vs('enhanceMaster')){
  const byCount=POWER_BLESS_AUTO_VALUES[master];
  return byCount ? String(byCount[currentPowerBlessPlayerCount()] || 0) : '0';
}
function syncPowerBlessOptions(options={}){
  const el=$('pbless');
  if(!el) return;
  const master=vs('enhanceMaster') || 'OFF';
  const values=powerBlessAllowedOptions(master);
  const active=values.length>0;
  const signature=active ? `${master}:${values.join(',')}` : 'master-required';
  const current=String(el.value || '');
  if(el.dataset.optionSignature!==signature){
    setSelectOptions(el, active
      ? values.map(value=>({value,label:value}))
      : [{value:'',label:POWER_BLESS_DISABLED_LABEL,selected:true}]
    );
    el.dataset.optionSignature=signature;
  }
  const allowed=new Set(values.map(value=>String(value)));
  el.disabled=!active;
  if(!active) el.value='';
  else if(options.auto) el.value=autoPowerBlessValue(master);
  else el.value=allowed.has(current) ? current : autoPowerBlessValue(master);
}
function normalizePowerBlessValueForMaster(master, value){
  const allowed=powerBlessAllowedOptions(master);
  const n=Math.max(0, Math.round(excelNumber(value) ?? (+value || 0)));
  return allowed.includes(n) ? String(n) : '';
}
function excelEnhanceMasterValue(value){
  return excelStateValue('enhanceMaster', value) || 'OFF';
}
function setCoopModeOptions(allowed, value='OFF'){
  const coop=$('coopMode');
  if(!coop) return;
  const normalized=normalizeOnOffValue(value,'OFF');
  const signature=allowed ? 'coop-mode-toggle' : 'coop-mode-solo-only';
  if(coop.dataset.optionSignature!==signature){
    setSelectOptions(coop, allowed
      ? [{value:'OFF',label:'OFF'},{value:'ON',label:'ON'}]
      : [{value:'OFF',label:SOLO_ONLY_LABEL}]
    );
    coop.dataset.optionSignature=signature;
  }
  coop.disabled=!allowed;
  coop.value=allowed ? normalized : 'OFF';
}
function setCoopPlayersOptions(active, value=COOP_PLAYERS_DEFAULT, disabledLabel=COOP_PLAYERS_DISABLED_LABEL){
  const players=$('coopPlayers');
  if(!players) return;
  const normalized=normalizeCoopPlayersValue(value);
  const signature=active ? 'coop-fixed-numeric' : `coop-disabled-label:${disabledLabel}`;
  if(players.dataset.optionSignature!==signature){
    setSelectOptions(players, active
      ? ['2','3'].map(playerCount=>({value:playerCount,label:playerCount}))
      : [{value:'',label:disabledLabel}]
    );
    players.dataset.optionSignature=signature;
  }
  players.disabled=!active;
  players.value=active ? normalized : '';
}
function syncBattleMode(sourceId=''){
  const solo=$('soloMode'), coop=$('coopMode'), players=$('coopPlayers');
  if(!solo || !coop) return;
  const coopAllowed=isCoopAllowedDifficulty();
  setCoopModeOptions(coopAllowed, coop.value);
  if(!coopAllowed){
    solo.value='ON';
    coop.value='OFF';
  }else{
    const sourceValue=sourceId==='soloMode' ? normalizeOnOffValue(solo.value,'ON') : normalizeOnOffValue(coop.value,'OFF');
    const coopOn=sourceId==='soloMode' ? sourceValue!=='ON' : sourceValue==='ON';
    solo.value=coopOn ? 'OFF' : 'ON';
    coop.value=coopOn ? 'ON' : 'OFF';
  }
  const coopActive=coopAllowed && coop.value==='ON';
  setCoopPlayersOptions(coopActive, players ? players.value : COOP_PLAYERS_DEFAULT, coopAllowed ? COOP_PLAYERS_DISABLED_LABEL : SOLO_ONLY_LABEL);
  syncPenanceOptions();
  syncTeamSelect();
}
function syncTeamSelect(){
  const el=$('team');
  if(!el) return;
  if(isCoopMode()){
    const players=normalizeCoopPlayersValue(vs('coopPlayers'));
    el.value=players;
    Array.from(el.options || []).forEach(option=>{ option.disabled=option.value!==players; });
    el.disabled=true;
    return;
  }
  const solo=isSoloStartDifficulty();
  el.value=solo ? '1' : normalizeTeamCountValue(el.value);
  Array.from(el.options || []).forEach(option=>{ option.disabled=solo && option.value!=='1'; });
  el.disabled=solo;
}
function normalizeErosionControlValue(id, value){
  const fallback=EROSION_CONTROL_DEFAULTS[id] || '0';
  const raw=String(value ?? '').replace(/,/g,'').trim();
  const numeric=parseFloat(raw);
  if(!Number.isFinite(numeric)) return fallback;
  const rounded=Math.max(0, Math.round(numeric));
  if(id==='jewelErosionRes') return String(Math.min(100, rounded));
  return String(rounded);
}
function erosionStoredValue(id){
  const el=$(id);
  if(!el) return EROSION_CONTROL_DEFAULTS[id] || '0';
  if(isAbyssDifficulty()) return normalizeErosionControlValue(id, el.value);
  return normalizeErosionControlValue(id, el.dataset.erosionValue || EROSION_CONTROL_DEFAULTS[id]);
}
function syncErosionControls(){
  const active=isAbyssDifficulty();
  EROSION_CONTROL_IDS.forEach(id=>{
    const el=$(id);
    if(!el) return;
    if(active){
      const stored=normalizeErosionControlValue(id, el.dataset.erosionValue || el.value || EROSION_CONTROL_DEFAULTS[id]);
      el.disabled=false;
      el.type='text';
      el.inputMode='numeric';
      el.value=stored;
      el.dataset.erosionValue=stored;
    }else{
      if(el.value && el.value!==ABYSS_DISABLED_LABEL){
        el.dataset.erosionValue=normalizeErosionControlValue(id, el.value);
      }else if(!el.dataset.erosionValue){
        el.dataset.erosionValue=EROSION_CONTROL_DEFAULTS[id];
      }
      el.type='text';
      el.value=ABYSS_DISABLED_LABEL;
      el.disabled=true;
    }
  });
}
function resetTeamOnDifficultyChange(){
  const el=$('team');
  if(isCoopMode() || !isCoopAllowedDifficulty()){
    syncBattleMode('coopPlayers');
    return;
  }
  if(!el) return;
  el.value='1';
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
function normalizeDecimalDisplayValue(value, digits=6){
  const text=String(value ?? '').replace(/,/g,'').trim();
  if(text==='') return '';
  const n=Number(text);
  if(!Number.isFinite(n)) return String(value ?? '');
  const fixed=n.toFixed(digits);
  return String(parseFloat(fixed));
}
function formatAllMoneyInputs(){
  qsa('.money-input').forEach(formatMoneyInput);
  DECIMAL_DISPLAY_INPUT_IDS.forEach(id=>{
    const el=$(id);
    if(el) el.value=normalizeDecimalDisplayValue(el.value);
  });
}
function on(id){const el=$(id); return !!(el && el.checked);}
function clampInt(n,min,max){return Math.max(min,Math.min(max,Math.round(+n||0)));}
const OVER_ENHANCE_ALLOWED=new Set([0,3,5,6]);
function normalizeOverEnhanceValue(value){
  const n=clampInt(value,0,6);
  return OVER_ENHANCE_ALLOWED.has(n) ? n : 0;
}
function monthRuneCount(prefix, kind='plus'){
  const el=$(prefix + (kind==='normal' ? 'RuneNormal' : 'RunePlus'));
  return clampInt(el ? el.value : 0, 0, 4);
}
const RUNE_OPTION_SELECT_IDS=['opt10','opt15','transOpt'];
const RUNE_OPTION_SELECT_ID_SET=new Set(RUNE_OPTION_SELECT_IDS);
function uniqueRuneOptionCodes(){
  return Array.from(new Set(
    RUNE_OPTION_SELECT_IDS.map(id=>vs(id)).filter(code=>code && code!=='none')
  ));
}
function syncExclusiveRuneOptions(){
  const selects=RUNE_OPTION_SELECT_IDS.map(id=>$(id)).filter(Boolean);
  if(!selects.length) return;
  const used=new Set();
  selects.forEach(select=>{
    const code=select.value;
    if(code && code!=='none'){
      if(used.has(code)) select.value='none';
      else used.add(code);
    }
  });
  const selected=new Set(selects.map(select=>select.value).filter(code=>code && code!=='none'));
  selects.forEach(select=>{
    Array.from(select.options || []).forEach(option=>{
      const code=option.value;
      const blocked=code && code!=='none' && code!==select.value && selected.has(code);
      option.disabled=blocked;
      option.hidden=blocked;
    });
  });
}
const STAT_KO={
  AD:'공격력', AS:'공격속도', AP:'마법공격력', CRI:'크리티컬 확률', CD:'크리티컬 데미지',
  MC:'다중 크리티컬', TD:'총 데미지', DR:'방어력 감소', PIERCE:'방어력 관통', UA:'유닛 가속',
  SR:'실드 감소', HR:'체력 감소', MD:'멀티 타겟', MP:'멀티 확률', MCP:'멀티 크리 확률',
  RA:'강화 관련', 특수:'상시 적용', 유틸:'편의/보조', 경험치:'경험치 보너스'
};
function statKo(type){return STAT_KO[type] || type;}
function traitEffectText(row,type,rate){return !rate ? statKo(type) : `${statKo(type)} +${rate}${T_UA.has(row)?'%':''}`;}
function reinforceSuccessChance(tries, isTheZero, upRev, upFRev){
  tries=clampInt(tries,0,999);
  if(tries<=0) return 0;
  const upP=105 + (isTheZero ? 20 : 0) + upRev * 2;
  const failStep=4 + 2 * upFRev;
  const streakChance=[];
  for(let i=0;i<=tries;i++) streakChance[i]=1 - 70 / (upP + i * failStep);
  const upOdds=[];
  for(let i=0;i<=tries;i++){
    let x;
    if(i===0) x=1;
    else if(i===1) x=streakChance[0];
    else{
      x=upOdds[i-1] * streakChance[0];
      for(let j=1;j<=i-1;j++){
        let inter=1;
        for(let f=0;f<=j-1;f++) inter *= 1 - streakChance[f];
        x += inter * streakChance[j] * upOdds[i-1-j];
      }
    }
    upOdds[i]=x;
  }
  let sum=0;
  for(let i=1;i<=tries;i++) sum += upOdds[i];
  return sum / tries;
}
function reinforceExpectedValue(successChance, count, masterRate, doubleReinf, repairAdd){
  return Math.floor(30 * successChance * count * (1 + doubleReinf / 200) + 10 * (1 - successChance) * count * masterRate + repairAdd * (1 - successChance) * count);
}
function unitEnhanceStats(){
  const over=normalizeOverEnhanceValue(v('overEnhance'));
  const repair=vs('repairEnhance');
  const master=vs('enhanceMaster');
  const masterRate=master==='ON+'?0.66:master==='ON'?0.5:0;
  const repairAdd=repair==='ON+'?7:repair==='ON'?5:0;
  const aprilNormal=monthRuneCount('apr','normal');
  const aprilPlus=monthRuneCount('apr','plus');
  const septemberPlus=monthRuneCount('sep','plus');
  const count=10 + (INV[58]||0) + over + aprilNormal + (hasRuneOption('reinf5')?5:0);
  const chance=reinforceSuccessChance(count, true, INV[64]||0, INV[65]||0);
  const value=reinforceExpectedValue(chance, count, masterRate, INV[96]||0, repairAdd) + aprilPlus * 10;
  return {count,chance,value,septemberPlus};
}
function upperOptionStats(){
  const flower1=on('flowerSkill1');
  const flower2=on('flowerSkill2');
  const flower3=on('flowerSkill3');
  const prod={
    nova:on('prodNova'), teratron:on('prodTeratron'), amon:on('prodAmon'), adun:on('prodAdun'),
    kerrigan:on('prodKerrigan'), overmind:on('prodOvermind'), narud:on('prodNarud'), artifact:on('prodArtifact')
  };
  const prodHiddenAD = (prod.nova?10:0) + (prod.teratron?10:0) + (prod.amon?10:0)
                     + (prod.adun?10:0) + (prod.kerrigan?10:0) + (prod.overmind?10:0);
  const prodAD = (prod.amon?30:0) + prodHiddenAD;
  const prodAS = (prod.nova?15:0) + (prod.narud?15:0);
  const prodCRI = (prod.teratron?10:0) + (prod.kerrigan?10:0) + (prod.artifact?20:0);
  const prodCD = (prod.adun?30:0) + (prod.overmind?30:0);
  return {
    ad: prodAD,
    as: prodAS,
    cri: prodCRI,
    cd: prodCD,
    td: 0,
    actualAd: flower1 ? 20 : 0,
    actualAs: flower2 ? 15 : 0,
    uaMul: 1,
    dps0Mul: flower3 ? 1.15 : 1
  };
}
const UNIT_GRADE_AD={D:-10,C:-5,B:0,A:5,S:10,SS:20,SSS:30,X:40,XD:50,SXD:50,RXD:100};
const UNIT_GRADE_AS={D:0,C:0,B:0,A:0,S:0,SS:0,SSS:0,X:0,XD:0,SXD:25,RXD:30};
function activeUnitGrade(){return vs('unitGrade') || 'S';}
function checkboxOn(id, fallback=false){
  const el=$(id);
  if(!el) return fallback;
  return el.type==='checkbox' ? !!el.checked : String(el.value||'ON')!=='OFF';
}
function xpInputStatBonus(){
  return effectiveXpValue() <= 10000 ? {ad:10, as:10, cri:5} : {ad:0, as:0, cri:0};
}
function unitADPrivateBonus(){
  const enh=unitEnhanceStats();
  const gradeAd=UNIT_GRADE_AD[activeUnitGrade()] ?? UNIT_GRADE_AD.S;
  const level=(v('unitLevel')||11)*5;
  const uniqueBuff=checkboxOn('unitUniqueBuff', true) ? 30 + 10*(enh.septemberPlus ?? 4) : 0;
  return gradeAd + level + uniqueBuff + (enh.value||0) - abyssAdPenalty();
}
function personalUaDtMultiplier(){
  return vs('dt')==='ON' ? 1.15 : 1;
}
function syncAutoEP(){
  const ep=Math.floor(effectiveXpValue()/100000) + Math.floor(Math.max(0, v('bxp'))/50000);
  const hidden=$('ep');
  if(hidden) hidden.value=String(ep);
  const view=$('autoEpView');
  if(view) view.textContent=big(ep);
  return ep;
}
function effectiveAdditionalStats(){
  // Excel spec sheet applies additional rune stats to Hyper/Penance, Tower, and Abyss sheets alike.
  return { ad:v('addAD'), as:v('addAS'), cd:v('addCD'), cri:v('addCRI'), ap:v('addAP'), td:v('addTD'), ua:v('addUA'), dr:0, sr:0, hr:0 };
}
function growthGraduationAttackBonus(){
  return effectiveXpValue()>=2000000 ? 20 : 0;
}

/* ===== 05. 스탯 / 버프 / DPS 계산 ===== */
function computeStatsRaw(){
  const autoEP=syncAutoEP();
  const diff=DIFF[vs('diff')]||DIFF['The Final'];
  const targetRound=v('round');
  const towerPenaltyLevel=isTowerDifficulty() ? (targetRound>=65 ? Math.floor((targetRound-63)/2) : 0) : v('penance');
  const penanceLevel=Math.max(0,Math.min(towerPenaltyLevel,currentPenanceMax()));
  const penCD=PEN_CD[penanceLevel];
  const penTD=PEN_TD[penanceLevel];
  const penDmg=PEN_DMG[penanceLevel];
  const penUA=PEN_UA[penanceLevel];
  const asc=ASC[vs('rAsc')]||ASC['없음'];
  const baseReinf=v('rReinf');
  const reinf=baseReinf + (hasRuneOption('reinf5')?5:0);
  const ascVlookup3=asc[1];
  const ascVlookup4=asc[2];
  const ascVlookup5=asc[3];
  const shareOn=checkboxOn('shareUserBuff');
  const shareAD=shareOn?10:0, shareAS=shareOn?10:0, shareCRI=shareOn?5:0;
  const dailyCouponCRI=checkboxOn('dailyCouponBuff')?10:0;
  const xpStat=xpInputStatBonus();
  let epUsedForBuff=0;
  TRAITS.forEach(t=>{ if(EP_ROWS.has(t[0])) epUsedForBuff+=cumCost(t[0]); });
  const epBuff=Math.floor(Math.max(0, autoEP-epUsedForBuff)/20);
  const gradeCri=enchantAt(1).cri;
  const unitADBonus=unitADPrivateBonus();
  const optionStats=getRuneOptionStats();
  const specialRune=getSpecialRuneStats(optionStats);
  const upperStats=upperOptionStats();
  const transcendDR=optionStats.dr;
  const gradeTD=enchantAt(3).td;
  const cd50opt=optionStats.cd;
  const additionalStats=effectiveAdditionalStats();
  const AP9 = BASE_DISPLAY_STATS.ad + sumStat('AD') + v('rAD') + optionStats.ad + upperStats.ad + ascVlookup3 + reinf + v('rModAD')
            + v('pbless') + shareAD + xpStat.ad + enchantAt(0).ad + epBuff
            + growthGraduationAttackBonus() + additionalStats.ad;
  const AP10 = -diff.ad;
  const M4 = AP9 + AP10 + unitADBonus + upperStats.actualAd;
  const M7_base = BASE_DISPLAY_STATS.as + sumStat('AS') + v('rAS') + upperStats.as + ascVlookup4 + reinf + shareAS + xpStat.as + v('rModAS') + additionalStats.as;
  const M7 = M7_base;
  const M8 = BASE_DISPLAY_STATS.cri + sumStat('CRI') + v('rCRI') + v('rModCRI') + reinf + dailyCouponCRI + shareCRI + xpStat.cri + gradeCri + optionStats.cri + upperStats.cri + additionalStats.cri;
  const cdReinf = reinf > 10 ? reinf - 10 : 0;
  const rawCD = 100 + sumStat('CD') + v('rCD') + cd50opt + cdReinf + upperStats.cd + ascVlookup5 + additionalStats.cd + v('rModCD');
  const M9 = rawCD * (1 - penCD/100);
  const criOver300 = M8>=300 ? (M8>=400?5:Math.floor((M8-300)/20)) : 0;
  const M10 = sumStat('MC') + (asc[5]||0) + criOver300 + optionStats.mc;
  const rawTD = sumStat('TD') + specialRune.td + gradeTD + upperStats.td + (asc[6]||0) + optionStats.td + v('titleTdBonus') + additionalStats.td;
  const tdReduce = penTD + abyssTdPenalty();
  const actualTD = isAbyssDifficulty() ? 100 + rawTD - tdReduce : rawTD - tdReduce;
  const M11 = isAbyssDifficulty() ? actualTD : 100 + actualTD;
  const M12_dr = sumStat('DR') + transcendDR + (asc[4]||0) + additionalStats.dr;
  const displayUA = uaProd() * optionStats.uaMul * upperStats.uaMul * enchantAt(2).ua * (1 + specialRune.ua/100) * (1 + additionalStats.ua/100);
  const M13 = displayUA * (1 - penUA/100) * abyssSlowMultiplier();
  const M16=sumStat('MD'), M17=20+(INV[101]||0)*0.2, M18=(INV[102]||0)*0.5;
  const enemyData=enemyRoundData(targetRound);
  const displaySR = sumStat('SR') + enchantAt(4).sr + additionalStats.sr;
  const displayHR = enchantAt(5).hr + additionalStats.hr;
  const excelPierce = (checkboxOn('basePierceBuff') ? 10 : 0) + rpPierceBonus();
  const ownTargetEffects={
    defenseReduce:M12_dr,
    pierce:excelPierce,
    hpReduce:displayHR,
    shieldReduce:displaySR
  };
  const ownDurability=targetDurabilityRemain(enemyData, ownTargetEffects);
  const passengerDurability=targetDurabilityRemain(enemyData, COOP_PASSENGER_TARGET_EFFECTS);
  const hpRatio = ownDurability.hpRatio;
  const shieldRatio = ownDurability.shieldRatio;
  const hpRemain = ownDurability.remain;
  const M12 = M12_dr;
  const actualM12 = actualDrWithPierce(M12_dr, excelPierce);
  const AB3=battleTargetDps0Average(
    {...ownTargetEffects, hpRemain},
    {...COOP_PASSENGER_TARGET_EFFECTS, hpRemain:passengerDurability.remain},
    enemyData.armor,
    diff.dmg*(1-penDmg/100)
  ) * upperStats.dps0Mul;
  const AB4=(1+M4/100)*(M11/100);
  const AB5=dps2(M8, M10, M9, M16, M17, M18, 0);
  const dt=personalUaDtMultiplier();
  const gradeAs=UNIT_GRADE_AS[activeUnitGrade()] ?? 0;
  const AB6=(1+(M7+upperStats.actualAs+gradeAs)/100)*(1-diff.as/100)*M13*dt;
  const M19=(AB3*AB4*AB5*AB6) * contentDpsDisplayMultiplier(vs('diff'), targetRound, displayHR, displaySR);
  let spU=0,spO=0,epU=0,rpU=0,soulU=0;
  TRAITS.forEach(t=>{
    const row=t[0];
    if(SP_ROWS.has(row)){const c=cumCost(row); if(['유틸','AP','RA','경험치','특수'].includes(t[3])) spU+=c; else spO+=c;}
    if(EP_ROWS.has(row)) epU+=cumCost(row);
    if(RP_ROWS.has(row)) rpU+=rpCost(row, INV[row]||0);
    if(SOUL_ROWS.has(row)) soulU+=cumCost(row);
  });
  const displayAD = Math.round(AP9 * (1 + rawTD/100));
  const rawDisplayAP = sumStat('AP') + (optionStats.ap||0) + specialRune.ap + additionalStats.ap;
  const displayAP = Math.min(535, rawDisplayAP);
  const displayAPS = displayAP;
  const displayAPU = displayAP;
  const actualAPU = rawDisplayAP + (unitEnhanceStats().value || 0) + (on('flowerSkill1') ? 40 : 0)
                  + (checkboxOn('unitUniqueBuff', true) ? 20 : 0) + (v('unitLevel') || 11) * 5;
  const actualSR = displaySR * shieldRatio;
  const actualHR = displayHR * hpRatio;
  return {M4,M7,M8,M9,M10,M11,M12,actualM12,M13,M16,M17,M18,M19,rawCD,rawTD,diff,
          displayAD,displayAPS,displayAPU,actualAPU,displayUA,displaySR,displayHR,actualSR,actualHR,
          spTotal:spU+spO,spU,spO,epU,rpU,soulU,spBank:spBankRawBonus(),spBankApplied:isSpBankApplied(),effectiveSP:effectiveSP(),excelPierce,enemyData};
}
function hasRuneOption(code){
  return uniqueRuneOptionCodes().includes(code);
}
function getRuneOptionStats(){
  const stats={ad:0,ap:0,cri:0,cd:0,dr:0,mc:0,td:0,tdRuneMul:1,uaMul:1};
  uniqueRuneOptionCodes().forEach(code=>{
    if(code==='ad15') stats.ad+=15;
    else if(code==='cri22') stats.cri+=22;
    else if(code==='cd50') stats.cd+=50;
    else if(code==='dr25') stats.dr+=25;
    else if(code==='mc3') stats.mc+=3;
    else if(code==='ua15') stats.uaMul*=1.15;
    else if(code==='td10') stats.td+=10;
    else if(code==='tdUa'){ stats.td+=10; stats.uaMul*=1.10; }
    else if(code==='ap30') stats.ap+=30;
    else if(code==='td2') stats.tdRuneMul*=2;
  });
  return stats;
}
function getSpecialRuneStats(optionStats={tdRuneMul:1}){
  const harmony=v('rHarmony');
  const tdRuneMul=optionStats.tdRuneMul || 1;
  return { ap:v('rAP'), td:(v('rTD') + harmony) * tdRuneMul, ua:v('rUA') + harmony };
}
function rpCost(row,n){
  n=Math.max(0,Math.min(TMAX[row]||999,Math.round(n||0)));
  if(row===125 || row===126 || row===127){
    if(n<=12) return n;
    if(n<=24) return 12+2*(n-12);
    if(n<=36) return 36+3*(n-24);
    return 72+4*(n-36);
  }
  if(row===128){
    if(n<=12) return n;
    if(n<=24) return 12+2*(n-12);
    return 36+3*(n-24);
  }
  if(row===129 || row===130){
    if(n<=9) return n*2;
    return 20+4*(n-10);
  }
  return n;
}
function nextRpCost(row){
  const n=INV[row]||0;
  if(n>=TMAX[row]) return Infinity;
  return rpCost(row,n+1)-rpCost(row,n);
}
function resourceUsed(kind){
  let total=0;
  TRAITS.forEach(t=>{
    const row=t[0];
    if(kind==='SP' && SP_ROWS.has(row)) total+=cumCost(row);
    if(kind==='EP' && EP_ROWS.has(row)) total+=cumCost(row);
    if(kind==='RP' && RP_ROWS.has(row)) total+=rpCost(row, INV[row]||0);
    if(kind==='SOUL' && SOUL_ROWS.has(row)) total+=cumCost(row);
  });
  return total;
}
function resourceKindForRow(row){return SP_ROWS.has(row)?'SP':EP_ROWS.has(row)?'EP':RP_ROWS.has(row)?'RP':SOUL_ROWS.has(row)?'SOUL':null;}
function resourceOwn(kind){return kind==='SP'?effectiveSP():kind==='EP'?v('ep'):kind==='RP'?v('rp'):kind==='SOUL'?v('soul'):Infinity;}
function canAffordNext(row){
  const kind=resourceKindForRow(row);
  if(!kind) return true;
  const cost=nextCost(row);
  if(!Number.isFinite(cost)) return false;
  return resourceUsed(kind)+cost <= resourceOwn(kind);
}
function setRowToAffordableValue(row,wanted){
  const old=INV[row]||0;
  const mx=TMAX[row]||999;
  let val=Math.max(0,Math.min(mx,Math.round(+wanted||0)));
  INV[row]=val;
  const kind=resourceKindForRow(row);
  if(kind){
    const own=resourceOwn(kind);
    while(INV[row]>old && resourceUsed(kind)>own) INV[row]--;
  }
  return INV[row];
}
function addOneIfAffordable(row){
  if(row===116) return false;
  if((INV[row]||0)>=(TMAX[row]||999)) return false;
  if(!canAffordNext(row)) return false;
  INV[row]=(INV[row]||0)+1;
  return true;
}
function fillRowToBudget(row){
  let changed=false;
  while(addOneIfAffordable(row)) changed=true;
  return changed;
}
function normalizeSpBankApplyValue(value){
  if(typeof value==='boolean') return value ? '반영' : '미반영';
  const raw=String(value ?? '').trim();
  const upper=raw.toUpperCase();
  return (raw==='반영' || raw==='적용' || upper==='ON' || upper==='TRUE' || upper==='1' || upper==='YES') ? '반영' : '미반영';
}
function isSpBankApplied(){
  const el=$('spBankApply');
  if(!el) return false;
  if(el.type==='checkbox') return !!el.checked;
  return normalizeSpBankApplyValue(el.value)==='반영';
}
function spBankApplyDisplayValue(value){
  return normalizeSpBankApplyValue(value)==='반영' ? 'ON' : 'OFF';
}
function syncSpBankDisplay(bankSP=null){
  const select=$('spBankApply');
  const state=normalizeSpBankApplyValue(select ? select.value : '미반영');
  const applied=state==='반영';
  if(select && select.value!==state) select.value=state;
  const n=bankSP==null ? spBankRawBonus() : bankSP;
  setText('spBankStatusView', applied ? fullNumber(n) : '미적용');
}
function spBankRawBonus(){
  const bankLevel=INV[89]||0;
  const appliedRound=Math.min(Math.max(0, v('round')), 290);
  const ticks=Math.floor(appliedRound/10);
  return bankLevel * 1000 * ticks;
}
function effectiveSP(){return v('sp') + (isSpBankApplied() ? spBankRawBonus() : 0);}
function rpPierceBonus(){return Math.max(0, Math.min(20, INV[130]||0));}
function enforceBudgets(){
  const budgets=[['SP',SP_ROWS,effectiveSP()],['EP',EP_ROWS,v('ep')],['RP',RP_ROWS,v('rp')],['SOUL',SOUL_ROWS,v('soul')]];
  budgets.forEach(([kind,set,own])=>{
    let guard=0;
    while(resourceUsed(kind)>own && guard++<20000){
      let changed=false;
      for(let i=TRAITS.length-1;i>=0;i--){
        const row=TRAITS[i][0];
        if(!set.has(row) || row===116 || (INV[row]||0)<=0) continue;
        INV[row]--; changed=true; break;
      }
      if(!changed) break;
    }
  });
}
function allowedRowsByTier(){
  const target=vs('optTier')||'루키';
  const idx=TIERS.indexOf(target);
  return new Set(TRAITS.filter(t=>TIERS.indexOf(t[2])>=0 && TIERS.indexOf(t[2])<=idx).map(t=>t[0]));
}
function fmt(n,d=1){return n==null||isNaN(n)?'—':parseFloat(n.toFixed(d)).toLocaleString('ko-KR');}
function big(n){
  n=Number(n);
  if(!Number.isFinite(n)) return '—';
  n=Math.round(n||0);
  return Math.abs(n)>=1e8 ? (n/1e8).toFixed(2)+'억' : Math.abs(n)>=1e4 ? (n/1e4).toFixed(1)+'만' : n.toLocaleString('ko-KR');
}
function fullNumber(n){
  n=Number(n);
  return Number.isFinite(n) ? Math.round(n||0).toLocaleString('ko-KR') : '—';
}
function shouldHideDpsForRound(){
  const raw=String($('round')?.value ?? '').replace(/,/g,'').trim();
  return raw==='0' || Number(raw)===0;
}
function normalizeRoundInput(id='round'){
  const el=$(id);
  if(!el) return false;
  const next=normalizedRoundString(el.value);
  if(String(el.value)!==next){
    el.value=next;
    return true;
  }
  return false;
}
function normalizeRoundInputs(){
  const a=normalizeRoundInput('round');
  const b=normalizeRoundInput('skillRound');
  return a || b;
}
function resetDifficultyDependentFields(){
  const pen=$('penance');
  const round=$('round');
  let changed=false;
  if(pen && pen.value!=='0'){ pen.value='0'; changed=true; }
  if(isTowerDifficulty() && round && String(round.value)!=='1'){ round.value='1'; changed=true; }
  return changed;
}
function selectedControlText(el){
  if(!el) return '—';
  if(el.tagName==='SELECT'){
    const option=el.selectedOptions && el.selectedOptions[0];
    return String((option?.textContent || el.value || '—')).trim() || '—';
  }
  return String(el.value ?? '—').trim() || '—';
}
function getDpsContextValues(){
  const diffEl=$('diff');
  const penEl=$('penance');
  const roundEl=$('round');
  const penValue=Math.max(0,Math.min(currentPenanceMax(),Math.round(Number(penEl?.value || 0))));
  const rawRound=String(roundEl?.value ?? '').replace(/,/g,'').trim();
  const roundValue=rawRound==='' ? NaN : Number(rawRound);
  const roundInt=Number.isFinite(roundValue) ? Math.round(roundValue) : null;
  const diff=selectedControlText(diffEl);
  const mode=isCoopMode() ? '협동' : '개인';
  const penance=penValue>0 ? `${penValue} 고행` : '고행 없음';
  const round=roundInt!==null ? `${roundInt} 라운드` : '라운드 —';
  const floor=roundInt!==null ? `${roundInt}층` : '층 —';
  const penanceShort=String(penValue);
  const roundShort=roundInt!==null ? String(roundInt) : '—';
  return {mode, diff, penValue, roundValue, penance, round, floor, penanceShort, roundShort};
}
function updateDpsContextSummary(){
  const ctx=getDpsContextValues();
  setText('dpsContextMode', ctx.mode);
  setText('dpsContextDiff', ctx.diff);
  setText('dpsContextPenance', ctx.penanceShort);
  setText('dpsContextRound', ctx.roundShort);
}

/* ===== 06. 메인 화면 렌더링 / 재계산 ===== */
function renderDpsSummary(s){
  updateDpsContextSummary();
  if(shouldHideDpsForRound()){
    setText('dpsVal', '—');
    syncDpsMinDpsInputs();
    updateDpsRiskViews(NaN);
    if(isDpsTableOpen()) renderDpsTablePanelContent();
    return;
  }
  setText('dpsVal', s.M19.toFixed(2));
  syncDpsMinDpsInputs();
  updateDpsRiskViews(s.M19);
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
  setText('spAttackView', fullNumber(s.spO));
  setText('spUtilityView', fullNumber(s.spU));
  setText('spRemainBasicView', fullNumber(spRemain));
  setText('epUsedBasicView', fullNumber(s.epU));
  setText('epRemainBasicView', fullNumber(epRemain));
  setText('rpUsedBasicView', fullNumber(s.rpU));
  setText('rpRemainBasicView', fullNumber(rpRemain));
  setText('soulUsedBasicView', fullNumber(s.soulU));
  setText('soulRemainBasicView', fullNumber(soulRemain));
  syncSpBankDisplay(bankSP);
}
function syncControlDisplays(){
  syncSelectButtons();
  syncBuffChoiceButtons();
  syncBattleMode();
  syncErosionControls();
  syncPowerBlessOptions();
  formatAllMoneyInputs();
}
function recalc(){
  try{
    normalizeRoundInputs();
    syncExclusiveRuneOptions();
    syncRuneChoice();
    syncEnchantInputs();
    syncControlDisplays();
    syncTraitLimitInputs();
    renderEnchantPreview(); renderXpCut(); renderEnhanceSummary();
    const s=computeStatsRaw();
    renderEnemyData(s.enemyData);
    renderSkillDamage(s);
    renderDpsSummary(s);
    renderStatSummary(s);
    renderResourceSummary(s);
    updateTraits();
    renderTraitEfficiencyTop5();
    saveState({silent:true});
  }catch(e){logAppError(e);}
}
function renderEnhanceSummary(){
  const e=unitEnhanceStats();
  const chance=$('enhanceChanceView');
  const count=$('enhanceCountView');
  const value=$('enhanceValueView');
  if(chance) chance.textContent=(e.chance*100).toFixed(2)+'%';
  if(count) count.textContent=`${fmt(e.count,0)}회`;
  if(value) value.textContent=fmt(e.value,0);
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
/* 버스보드: 렌더링 / 행 클릭 피드백 */
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
/* 성소스킬보드: 입력값 동기화 / 피해량 렌더링 */
function renderSkillDamage(s){
  const ap=s?.displayAPU ?? 535;
  const apView=$('skillAPView');
  if(apView) apView.textContent=fmt(ap,0);
  const doubleSpace=v('skillDouble');
  const round=v('skillRound');
  const isTower=vs('skillMode')==='tower';
  const baseRound=isTower ? 30 : 100;
  const perRound=isTower ? 0.016601 : 0.005;
  const penalty=Math.max(0, Math.min(0.99, (round-baseRound)*perRound));
  const pv=$('skillPenaltyView');
  if(pv) pv.textContent=`${(penalty*100).toFixed(1)}%`;
  const data=[
    ['어스퀘이크',0.0223,0.000066,10],
    ['포이즌미스트',0.0432,0.0001755,15],
    ['라이트닝스톰',0.517,0.0005,1],
    ['퓨리파이어',0.0198,0.000142,30],
    ['메테오 (1발)',0.259,0.00025,1]
  ];
  const el=$('skillRows'); if(!el) return;
  el.innerHTML=data.map(([name,base,add,tick])=>{
    const total=(base + add*ap*doubleSpace) * tick * (1-penalty) * 100;
    return `<tr><td>${name}</td><td>${fmt(total,1)}%</td><td>AP ${fmt(ap,0)} / 더블 ${fmt(doubleSpace,2)}</td></tr>`;
  }).join('');
}
let appUpdateTimer=0;
function requestAppUpdate(){
  if(appUpdateTimer) clearTimeout(appUpdateTimer);
  appUpdateTimer=setTimeout(()=>{appUpdateTimer=0; recalc();}, DPS_CONFIG.ui.updateDelay);
}
/* ===== 07. 비교·정보 패널 / DPS표 ===== */
const DPS_TABLE_DIFFICULTIES=DPS_CONFIG.dpsTable.difficulties;
const COOP_DPS_TABLE_DIFFICULTIES=DPS_TABLE_DIFFICULTIES.slice(0, DPS_TABLE_DIFFICULTIES.indexOf('Hall Of Fame') + 1);
const COOP_DPS_TABLE_PENANCE_MIN=0;
const COOP_DPS_TABLE_PENANCE_MAX=COOP_PENANCE_MAX;
const DPS_TABLE_PENANCE_MIN=DPS_CONFIG.dpsTable.penanceMin ?? 0;
const DPS_TABLE_PENANCE_MAX=DPS_CONFIG.dpsTable.penanceMax ?? 20;
const DPS_TABLE_DECIMALS=DPS_CONFIG.dpsTable.decimals ?? 1;
let activeDpsTableMode='solo';
let dpsTableMinDps='1.0';
function isDpsTableOpen(){
  if(document.body?.classList.contains('is-tabbed') && $('mobileDpsTableMount')) return true;
  const modal=$('monthRuneModal');
  const panel=modal?.querySelector('[data-month-rune-panel="dps"]');
  return !!(modal?.classList.contains('is-open') && panel && !panel.hidden);
}
function getDpsTableTowerGroupSize(){
  const body=document.body;
  if(body?.classList.contains('is-mobile') || window.innerWidth<=600) return 90;
  if(body?.classList.contains('is-tablet') || body?.classList.contains('is-pc-portrait') || window.innerWidth<=1024) return 45;
  return 30;
}
function chunkDpsTowerFloors(minFloor, maxFloor, groupSize){
  const chunks=[];
  for(let start=minFloor; start<=maxFloor; start+=groupSize){
    const end=Math.min(maxFloor, start+groupSize-1);
    const floors=[];
    for(let floor=start; floor<=end; floor++) floors.push(floor);
    chunks.push(floors);
  }
  return chunks;
}
function syncDpsMinDpsInputs(){
  ['dpsTableMinDps','dpsTableMinDpsMain'].forEach(id=>{
    const el=$(id);
    if(el && el.value!==dpsTableMinDps) el.value=dpsTableMinDps;
  });
}
function dpsTableMinDpsIntegerPart(value){
  const text=String(value ?? '').replace(/,/g,'').trim();
  if(text==='') return '';
  const cleaned=text.replace(/[^0-9.]/g,'');
  const integerPart=cleaned.split('.')[0].replace(/\D/g,'');
  return integerPart;
}
function normalizeDpsTableMinDpsValue(value){
  const integerPart=dpsTableMinDpsIntegerPart(value);
  if(integerPart==='') return '';
  const number=Number(integerPart);
  if(!Number.isFinite(number) || number<0) return '';
  return number.toFixed(DPS_TABLE_DECIMALS);
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
function dpsTableRiskCompareValue(value){
  if(!Number.isFinite(value)) return NaN;
  const factor=10**DPS_TABLE_DECIMALS;
  return Math.round(value*factor)/factor;
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
function computeDpsPreview(diffName, penanceLevel, round, options={}){
  const ids=['diff','penance','round','soloMode','coopMode','coopPlayers','team','pbless'];
  const saved=ids.map(id=>{
    const el=$(id);
    return [el, el ? el.value : null];
  });
  try{
    const diffEl=$('diff');
    const penEl=$('penance');
    const roundEl=$('round');
    const soloEl=$('soloMode');
    const coopEl=$('coopMode');
    const coopPlayersEl=$('coopPlayers');
    const teamEl=$('team');
    const pblessEl=$('pbless');
    if(diffEl) diffEl.value=diffName;
    if(penEl) penEl.value=String(penanceLevel);
    if(roundEl) roundEl.value=String(round);
    if(options.battleMode==='solo'){
      if(soloEl) soloEl.value='ON';
      if(coopEl) coopEl.value='OFF';
      if(coopPlayersEl) coopPlayersEl.value='';
    }else if(options.battleMode==='coop'){
      const players=normalizeCoopPlayersValue(options.coopPlayers);
      if(soloEl) soloEl.value='OFF';
      if(coopEl) coopEl.value='ON';
      if(coopPlayersEl) coopPlayersEl.value=players;
      if(teamEl) teamEl.value=players;
      if(pblessEl){
        const master=vs('enhanceMaster');
        const autoValue=autoPowerBlessValue(master);
        if(autoValue && autoValue!=='0') pblessEl.value=autoValue;
      }
    }
    const s=computeStatsRaw();
    return Number.isFinite(s.M19) ? s.M19 : 0;
  }catch(e){
    logAppError('[DPS table preview failed]', e);
    return 0;
  }finally{
    saved.forEach(([el,val])=>{ if(el) el.value=val; });
  }
}
function buildDpsTable(round){
  const minDps=parseDpsTableMinDps();
  const currentDiff=vs('diff');
  const currentPen=Math.max(DPS_TABLE_PENANCE_MIN, Math.min(DPS_TABLE_PENANCE_MAX, Math.round(v('penance'))));
  const head=DPS_TABLE_DIFFICULTIES.map(d=>`<th class="${d===currentDiff?'dps-current-column':''}">${d}</th>`).join('');
  const rows=[];
  for(let pen=DPS_TABLE_PENANCE_MIN; pen<=DPS_TABLE_PENANCE_MAX; pen++){
    const rowCurrent=pen===currentPen;
    const cells=DPS_TABLE_DIFFICULTIES.map(diff=>{
      const value=computeDpsPreview(diff, pen, round, {battleMode:'solo'});
      const danger=minDps!==null && dpsTableRiskCompareValue(value)<=minDps;
      const currentCell=rowCurrent && diff===currentDiff;
      const classes=[danger?'dps-risk-cell':'', currentCell?'dps-current-cell':''].filter(Boolean).join(' ');
      return `<td class="${classes}">${formatDpsTableValue(value)}</td>`;
    }).join('');
    rows.push(`<tr${rowCurrent?' class="dps-current-row"':''}><th>${pen}</th>${cells}</tr>`);
  }
  return `<table class="dps-matrix dps-round-matrix"><thead><tr><th>고행</th>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
function buildCoopDpsMatrix(players, round){
  const minDps=parseDpsTableMinDps();
  const currentDiff=vs('diff');
  const currentPen=Math.max(COOP_DPS_TABLE_PENANCE_MIN, Math.min(COOP_DPS_TABLE_PENANCE_MAX, Math.round(v('penance'))));
  const head=COOP_DPS_TABLE_DIFFICULTIES.map(diff=>`<th class="${diff===currentDiff?'dps-current-column':''}">${diff}</th>`).join('');
  const rows=[];
  for(let pen=COOP_DPS_TABLE_PENANCE_MIN; pen<=COOP_DPS_TABLE_PENANCE_MAX; pen++){
    const rowCurrent=pen===currentPen;
    const cells=COOP_DPS_TABLE_DIFFICULTIES.map(diff=>{
      const value=computeDpsPreview(diff, pen, round, {battleMode:'coop', coopPlayers:String(players)});
      const danger=minDps!==null && dpsTableRiskCompareValue(value)<=minDps;
      const currentCell=rowCurrent && diff===currentDiff;
      const classes=[danger?'dps-risk-cell':'', currentCell?'dps-current-cell':''].filter(Boolean).join(' ');
      return `<td class="${classes}">${formatDpsTableValue(value)}</td>`;
    }).join('');
    rows.push(`<tr${rowCurrent?' class="dps-current-row"':''}><th>${pen}</th>${cells}</tr>`);
  }
  return `<table class="dps-matrix dps-round-matrix dps-coop-matrix"><thead><tr><th>고행</th>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
function buildCoopDpsTable(round){
  return [2,3].map(players=>`
    <section class="dps-coop-block" aria-label="협동 ${players}인 DPS표">
      <header class="dps-coop-head"><b>협동 ${players}인</b><span>${round}라운드 · 0~13고행</span></header>
      <div class="dps-table-scroll dps-coop-scroll">${buildCoopDpsMatrix(players, round)}</div>
    </section>
  `).join('');
}
function towerEnemySummaryItems(floor){
  const r=Math.max(1, Math.min(90, Math.round(+floor||1)));
  const armorRow=lookupFloor(TOWER_ARMOR_TABLE, r);
  const unitRow=lookupFloor(TOWER_UNIT_TABLE, r);
  return [
    ['방어력', big(armorRow && armorRow[0]<=r ? armorRow[1] : 0)],
    ['체력', big(unitRow ? unitRow[2] : 0)],
    ['실드', big(unitRow ? unitRow[3] : 0)],
    ['물량', big(unitRow ? unitRow[1] : 0)]
  ];
}
function buildDpsTowerTable(){
  const minDps=parseDpsTableMinDps();
  const currentDiff=vs('diff');
  const currentFloor=Math.max(1, Math.round(v('round') || 1));
  const tower=DPS_CONFIG.dpsTable.tower || {};
  const range={ min:Math.max(1, Math.round(tower.minFloor || 1)), max:Math.max(1, Math.round(tower.maxFloor || 90)) };
  const groupSize=getDpsTableTowerGroupSize();
  const chunks=chunkDpsTowerFloors(range.min, range.max, groupSize);
  const blocks=chunks.map(floors=>{
    const rows=floors.map(floor=>{
      const value=computeDpsPreview('도전의 탑', 0, floor);
      const danger=minDps!==null && dpsTableRiskCompareValue(value)<=minDps;
      const currentCell=currentDiff==='도전의 탑' && currentFloor===floor;
      const classes=[danger?'dps-risk-cell':'', currentCell?'dps-current-cell':''].filter(Boolean).join(' ');
      const enemyItems=towerEnemySummaryItems(floor);
      const enemySummaryHtml=enemyItems.map(([label,value])=>`<span class="dps-tower-enemy-item"><em>${label}</em><b>${value}</b></span>`).join('');
      return `<tr${currentCell?' class="dps-current-row"':''}><th>${floor}층</th><td class="${classes}"><b class="dps-tower-value">${formatDpsTableValue(value)}</b><span class="dps-tower-enemy">${enemySummaryHtml}</span></td></tr>`;
    }).join('');
    const first=floors[0], last=floors[floors.length-1];
    return `<div class="dps-tower-block" aria-label="도전의탑 ${first}층부터 ${last}층까지"><table class="dps-matrix dps-tower-matrix"><thead><tr><th>층</th><th>DPS</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
  return `<div class="dps-tower-grid" data-tower-group-size="${groupSize}">${blocks}</div>`;
}
function renderDpsTableTabs(round, options={}){
  const compact=!!options.compact;
  return [
    {key:'solo',label:'개인',sub:`${round}라운드`},
    {key:'coop',label:'협동',sub:'2인 / 3인'},
    {key:'tower',label:'도전의탑',sub:'1~90층'}
  ].map(tab=>{
    const active=activeDpsTableMode===tab.key;
    return `
      <button type="button" class="ui-tab-btn dps-table-tab ${active?'is-active':''}" data-dps-table-mode="${tab.key}" role="tab" aria-selected="${active?'true':'false'}">
        <b>${tab.label}</b>${compact?'':`<span>${tab.sub}</span>`}
      </button>
    `;
  }).join('');
}
const MONTH_RUNE_MODAL_TITLES={
  compare:'프리셋 분석',
  runes:'이달의 룬',
  jewels:'쥬얼',
  dps:'DPS표'
};
const MONTH_RUNE_MODAL_CLASS_NAMES=['is-modal-compare','is-modal-runes','is-modal-jewels','is-modal-dps'];
function buildCompareHeaderControls(){
  return `<div class="excel-compare-controls excel-compare-header-controls">
    <label class="ui-action-btn excel-compare-file-btn">파일 선택<input id="excelCompareFile" type="file" accept=".xlsm,.xlsx,.json,.txt,application/json,text/plain,application/vnd.ms-excel.sheet.macroEnabled.12"></label>
    <select id="excelCompareSheet" aria-label="비교할 항목" disabled><option>항목 선택</option></select>
    <button id="excelCompareResetBtn" class="ui-action-btn excel-compare-reset-btn" type="button" data-excel-compare-reset="1" disabled>초기화</button>
    <button id="excelCompareApplyBtn" class="ui-action-btn excel-compare-apply-btn" type="button" data-excel-compare-apply="1" disabled>현재 입력값에 적용</button>
    <button id="excelCompareRestoreBtn" class="ui-action-btn excel-compare-restore-btn" type="button" data-excel-compare-restore="1" disabled>현재값 복원</button>
  </div>`;
}
function renderMonthRuneModalHeader(tabName){
  const modal=$('monthRuneModal');
  if(!modal) return;
  const next=MONTH_RUNE_MODAL_TITLES[tabName] ? tabName : 'compare';
  const title=MONTH_RUNE_MODAL_TITLES[next];
  const dialog=modal.querySelector('.month-rune-modal');
  const titleEl=$('monthRuneTitle');
  const actions=$('monthRuneHeaderActions');
  const closeBtn=modal.querySelector('.month-rune-close');
  if(dialog){
    dialog.classList.remove(...MONTH_RUNE_MODAL_CLASS_NAMES);
    dialog.classList.add(`is-modal-${next}`);
  }
  if(titleEl) titleEl.textContent=title;
  if(closeBtn) closeBtn.setAttribute('aria-label', `${title} 닫기`);
  if(actions){
    actions.innerHTML=next==='compare'
      ? buildCompareHeaderControls()
      : next==='dps'
        ? `<div class="dps-table-tabs month-rune-header-tabs" id="dpsTableTabsMount" data-dps-table-tabs-mount role="tablist" aria-label="DPS 기준 선택">${renderDpsTableTabs(dpsTableRound(), {compact:true})}</div>`
        : '';
  }
}
function buildCompareApplyPanel(){
  return `<section class="dps-table-panel excel-compare-panel">
    <div class="excel-compare-body" id="excelCompareBody">${EXCEL_COMPARE_EMPTY_HTML}</div>
  </section>`;
}
function dpsTableRound(){
  return Math.max(1, Math.min(300, Math.round(v('round') || 1)));
}
function renderDpsTablePanel(){
  return `<section class="month-rune-panel dps-table-inline-panel" data-month-rune-panel="dps" role="tabpanel" aria-labelledby="monthRuneTitle" hidden>
    <div class="dps-table-body" id="dpsTableMount" data-dps-table-mount></div>
  </section>`;
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
  return `<section class="dps-table-panel dps-table-mode-panel ${activeDpsTableMode==='coop'?'dps-coop-panel':''}">${tableHtml}</section>`;
}
function renderDpsTablePanelContent(){
  const round=dpsTableRound();
  qsa('[data-dps-table-tabs-mount]').forEach(tabs=>{
    tabs.innerHTML=renderDpsTableTabs(round, {compact:true});
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
function createModalShell(id, className, innerHtml){
  if($(id)) return;
  const modal=document.createElement('div');
  modal.id=id;
  modal.className=className;
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=innerHtml;
  document.body.appendChild(modal);
}
function setModalOpen(id, bodyClass, open){
  const modal=$(id);
  if(!modal) return null;
  modal.classList.toggle('is-open', open);
  modal.setAttribute('aria-hidden', open ? 'false' : 'true');
  document.body.classList.toggle(bodyClass, open);
  return modal;
}
function openDpsTable(mode='solo'){
  const normalizedMode=mode==='round' ? 'solo' : mode;
  activeDpsTableMode=['solo','coop','tower'].includes(normalizedMode) ? normalizedMode : 'solo';
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
window.dpsHandleJewelImageError=handleJewelImageError;
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
          <img src="${escapeCompareHtml(imageSources.src)}"${fallbackAttr} alt="" loading="lazy" onerror="window.dpsHandleJewelImageError(this)">
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
function renderMobileReferencePanels(){
  const runeMount=$('mobileMonthRuneMount');
  if(runeMount) runeMount.innerHTML=renderMonthRunePanelContent(MONTHLY_RUNE_INFO || {months:[]});
  const jewelMount=$('mobileJewelMount');
  if(jewelMount) jewelMount.innerHTML=renderJewelPanelContent(RAW_JEWEL_DATA || []);
  const dpsMount=$('mobileDpsTableMount');
  if(dpsMount){
    dpsMount.innerHTML=`<div class="dps-table-tabs mobile-dps-table-tabs" data-dps-table-tabs-mount role="tablist" aria-label="DPS 기준 선택"></div><div class="dps-table-body" data-dps-table-mount></div>`;
    renderDpsTablePanelContent();
  }
}
function syncComparePanelAfterRender(){
  hydrateCompareControls();
  if(compareState.lastResult) renderExcelComparison(compareState.lastResult,{preserveFilter:true});
  else if(compareState.sourceType==='json' && compareState.backupState) renderJsonComparison(compareState.backupState);
  else if(compareState.sourceType==='traitPreset' && compareState.traitPresetBundle) compareSelectedTraitPreset({preserveRestore:true});
  else if(compareState.workbook && compareState.sourceType==='excel') compareSelectedExcelSheet({preserveRestore:true});
  else updateCompareActionButtons();
}
function selectMonthRuneModalTab(tabName){
  const modal=$('monthRuneModal');
  if(!modal) return;
  const next=['compare','runes','jewels','dps'].includes(tabName) ? tabName : 'compare';
  modal.querySelectorAll('[data-month-rune-panel]').forEach(panel=>{
    const active=panel.dataset.monthRunePanel===next;
    setClassState(panel, 'is-active', active);
    panel.hidden=!active;
  });
  renderMonthRuneModalHeader(next);
  if(next==='compare') syncComparePanelAfterRender();
  if(next==='dps') renderDpsTablePanelContent();
}
function createMonthRuneModal(){
  const info=MONTHLY_RUNE_INFO || {months:[]};
  const jewels=RAW_JEWEL_DATA || [];
  createModalShell('monthRuneModal','month-rune-modal-shell',`
    <div class="month-rune-backdrop" data-month-rune-close="1"></div>
    <section class="month-rune-modal is-modal-compare" role="dialog" aria-modal="true" aria-labelledby="monthRuneTitle">
      <header class="month-rune-head">
        <h2 id="monthRuneTitle" class="month-rune-title">프리셋 분석</h2>
        <div class="month-rune-header-actions" id="monthRuneHeaderActions"></div>
        <button type="button" class="ui-icon-btn month-rune-close" data-month-rune-close="1" aria-label="프리셋 분석 닫기">×</button>
      </header>
      <div class="month-rune-body">
        <section class="month-rune-panel is-active" data-month-rune-panel="compare" role="tabpanel" aria-labelledby="monthRuneTitle">${buildCompareApplyPanel()}</section>
        ${renderMonthRunePanel(info)}
        ${renderJewelPanel(jewels)}
        ${renderDpsTablePanel()}
      </div>
    </section>`);
}
function openMonthRune(tabName='compare', options={}){
  if(typeof tabName!=='string'){
    options={};
    tabName='compare';
  }
  createMonthRuneModal();
  selectMonthRuneModalTab(tabName);
  setModalOpen('monthRuneModal','month-rune-modal-open',true);
  if(options.openFilePicker && tabName==='compare') requestCompareFileSelect();
}
function closeMonthRune(){setModalOpen('monthRuneModal','month-rune-modal-open',false);}
function bindMonthRuneEvents(){
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-month-rune-close]')) closeMonthRune();
  });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeMonthRune(); });
}
function bindDpsTableEvents(){
  document.addEventListener('click', function(e){
    const modeTarget=e.target.closest('[data-dps-table-mode]');
    if(!modeTarget) return;
    switchDpsTableMode(modeTarget.getAttribute('data-dps-table-mode'));
  });
  document.addEventListener('keydown', function(e){
    const minInput=e.target.closest('#dpsTableMinDps,#dpsTableMinDpsMain');
    if(!minInput) return;
    if(e.key==='.' || e.key===',' || e.key==='Decimal'){
      e.preventDefault();
      return;
    }
    if(e.key==='Enter'){
      e.preventDefault();
      setDpsTableMinDps(minInput.value,{format:true});
      minInput.blur();
    }
  }, true);
  document.addEventListener('input', function(e){
    const minInput=e.target.closest('#dpsTableMinDps,#dpsTableMinDpsMain');
    if(!minInput) return;
    const before=minInput.value;
    setDpsTableMinDps(before);
    const fresh=$(minInput.id);
    if(fresh){
      fresh.focus({preventScroll:true});
      const pos=fresh.value.length;
      try{ fresh.setSelectionRange(pos,pos); }catch(_e){}
    }
  });
  document.addEventListener('focusout', function(e){
    const minInput=e.target.closest('#dpsTableMinDps,#dpsTableMinDpsMain');
    if(!minInput) return;
    setDpsTableMinDps(minInput.value,{format:true});
  }, true);
}
/* ===== 08. 엑셀파일·저장파일 비교 / 현재 입력값 적용 ===== */
const compareState={workbook:null,backupState:null,traitPresetBundle:null,sourceType:null,lastResult:null,activeFilter:'all',restoreState:null,applied:false,selectedSheetName:''};
function resetCompareState(){Object.assign(compareState,{workbook:null,backupState:null,traitPresetBundle:null,sourceType:null,lastResult:null,activeFilter:'all',restoreState:null,applied:false,selectedSheetName:''});}
const EXCEL_COMPARE_STATS=[
  ['AD','공격력','L4','M4',s=>s.displayAD,s=>s.M4],
  ['APS','AP(성소)','L5','M5',s=>s.displayAPS,s=>s.displayAPS],
  ['APU','AP(유닛)','L6','M6',s=>s.displayAPU,s=>s.actualAPU],
  ['AS','공격속도','L7','M7',s=>s.M7,s=>s.M7],
  ['CRI','크리티컬 확률','L8','M8',s=>s.M8,s=>s.M8],
  ['CD','크리티컬 데미지','L9','M9',s=>s.rawCD,s=>s.M9],
  ['MC','다중 크리티컬','L10','M10',s=>s.M10,s=>s.M10],
  ['TD','총 데미지','L11','M11',s=>s.rawTD,s=>s.M11],
  ['DR','방어력 감소','L12','M12',s=>s.M12,s=>s.actualM12],
  ['UA','유닛 가속','L13','M13',s=>s.displayUA,s=>s.M13],
  ['SR','쉴드 감소','L14','M14',s=>s.displaySR,s=>s.actualSR],
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
function compareSelectDisplayText(value,id){
  const text=String(value??'').trim();
  if(id==='runeChoiceType'){
    const runeLabel=COMPARE_SPECIAL_RUNE_LABELS[compareNormalizedText(text)];
    if(runeLabel) return runeLabel;
  }
  const select=$(id);
  if(select?.tagName==='SELECT'){
    const normalized=compareNormalizedText(text);
    const option=[...select.options].find(item=>{
      const optionValue=String(item.value??'').trim();
      const optionText=String(item.textContent??'').trim();
      return optionValue===text || optionText===text ||
        compareNormalizedText(optionValue)===normalized ||
        compareNormalizedText(optionText)===normalized;
    });
    if(option) return String(option.textContent||option.value||'').trim() || '—';
  }
  return text || '—';
}
function compareDisplayText(value,id){
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
    if(v===0) return '없음';
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
function excelFlag(value){
  const text=excelText(value).toLowerCase();
  const number=excelNumber(value);
  return ['true','on','on+','yes','y'].includes(text) || (number!==null && number!==0);
}
function webControlDisplay(id){
  const el=$(id);
  if(!el) return '—';
  if(EROSION_CONTROL_IDS.has(id)) return erosionStoredValue(id);
  if(el.type==='checkbox') return el.checked?'ON':'OFF';
  return String(el.value??'');
}
const EXCEL_TITLE_BONUS_MAP={'패왕':'12','패왕+':'13','제왕':'14','제왕+':'15','신황':'16','신황+':'17'};
const EXCEL_RUNE_TYPE_MAP={'AP':'ap','UA':'ua','TD':'td','TD&UA':'harmony','TD＆UA':'harmony','마법공격력':'ap','마법 공격력':'ap','유닛가속':'ua','유닛 가속':'ua','총데미지':'td','총 데미지':'td','총데미지&유닛가속':'harmony','총 데미지 & 유닛 가속':'harmony','총뎀가속':'harmony'};
const FIELD_REGISTRY={
  sp:{kind:'기본정보',name:'총 SP',compare:true,save:true,excel:'number'},
  xp:{kind:'기본정보',name:'보유 XP',compare:true,save:true,excel:'number'},
  bxp:{kind:'기본정보',name:'보유 BXP',compare:true,save:true,excel:'number'},
  rp:{kind:'기본정보',name:'보유 RP',compare:true,save:true,excel:'number'},
  soul:{kind:'기본정보',name:'본인 심연의혼',compare:true,save:true,excel:'number'},
  diff:{kind:'기본정보',name:'난이도',compare:true,save:true,excel:'select'},
  round:{kind:'기본정보',name:'목표 라운드',compare:true,save:true,excel:'number'},
  soloMode:{kind:'기본정보',name:'개인',compare:true,save:true,excel:'select'},
  coopMode:{kind:'기본정보',name:'협동',compare:true,save:true,excel:'select'},
  coopPlayers:{kind:'기본정보',name:'협동 인원수',compare:true,save:true,excel:'select'},
  team:{kind:'기본정보',name:'출발 지원 인원수',compare:true,save:true,excel:'number'},
  pbless:{kind:'기본정보',name:'파워 블레스',compare:true,save:true,excel:'number'},
  spBankApply:{kind:'기본정보',name:'SP 은행',compare:true,save:true},
  penance:{kind:'기본정보',name:'고행 단계',compare:true,save:true,excel:'number'},
  titleTdBonus:{kind:'기본정보',name:'타이틀 총 데미지',compare:true,save:true,excel:'number'},
  dpsTableMinDps:{kind:'DPS',name:'도전할 최소 DPS',compare:true,save:true,excel:'number'},
  erosionStack:{kind:'기본정보',name:'침식 스텍',compare:true,save:true,excel:'number'},
  jewelErosionRes:{kind:'기본정보',name:'침식 내성',compare:true,save:true,excel:'number'},
  aprRuneNormal:{kind:'룬효과/버프',name:'4월 일반',compare:true,save:true},
  aprRunePlus:{kind:'룬효과/버프',name:'4월 강화(+)',compare:true,save:true},
  sepRuneNormal:{kind:'룬효과/버프',name:'9월 일반',compare:true,save:true},
  sepRunePlus:{kind:'룬효과/버프',name:'9월 강화(+)',compare:true,save:true},
  overEnhance:{kind:'룬효과/버프',name:'오버핸스',compare:true,save:true},
  repairEnhance:{kind:'룬효과/버프',name:'리페핸스',compare:true,save:true},
  enhanceMaster:{kind:'룬효과/버프',name:'강화의 달인',compare:true,save:true},
  dailyCouponBuff:{kind:'룬효과/버프',name:'일일쿠폰',compare:true,save:true},
  shareUserBuff:{kind:'룬효과/버프',name:'나눔유저',compare:true,save:true},
  unitUniqueBuff:{kind:'룬효과/버프',name:'단일유닛버프',compare:true,save:true},
  basePierceBuff:{kind:'룬효과/버프',name:'방어력관통 10%',compare:true,save:true},
  prodArtifact:{kind:'룬효과/버프',name:'유물',compare:true,save:true},
  prodNova:{kind:'룬효과/버프',name:'노바',compare:true,save:true},
  prodTeratron:{kind:'룬효과/버프',name:'테라트론',compare:true,save:true},
  prodAmon:{kind:'룬효과/버프',name:'아몬',compare:true,save:true},
  prodAdun:{kind:'룬효과/버프',name:'아둔의 창',compare:true,save:true},
  prodKerrigan:{kind:'룬효과/버프',name:'불새 케리건',compare:true,save:true},
  prodOvermind:{kind:'룬효과/버프',name:'초월체',compare:true,save:true},
  prodNarud:{kind:'룬효과/버프',name:'나루드',compare:true,save:true},
  flowerSkill1:{kind:'룬효과/버프',name:'근성의 꽃가루',compare:true,save:true},
  flowerSkill2:{kind:'룬효과/버프',name:'바람의 꽃가루',compare:true,save:true},
  flowerSkill3:{kind:'룬효과/버프',name:'안개의 꽃가루',compare:true,save:true},
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
  enchAD:{kind:'인첸트',name:'공격력',save:true,excel:'number'},
  enchCRI:{kind:'인첸트',name:'크리티컬 확률',save:true,excel:'number'},
  enchUA:{kind:'인첸트',name:'유닛 가속',save:true,excel:'number'},
  enchTD:{kind:'인첸트',name:'총 데미지',save:true,excel:'number'},
  enchSR:{kind:'인첸트',name:'실드 감소',save:true,excel:'number'},
  enchHR:{kind:'인첸트',name:'체력 감소',save:true,excel:'number'},
  enchantCode:{kind:'인첸트',name:'인첸트 코드',save:true},
  optTier:{kind:'특성보드',name:'특성 최적화 범위',compare:true,save:true},
  utilOptTier:{kind:'특성보드',name:'유틸 마스터 범위',compare:true,save:true},
  traitLimitAD:{kind:'특성보드 / 특성 투자 제한',name:'공격력',compare:true,save:true},
  traitLimitAS:{kind:'특성보드 / 특성 투자 제한',name:'공격속도',compare:true,save:true},
  traitLimitCRI:{kind:'특성보드 / 특성 투자 제한',name:'크리티컬 확률',compare:true,save:true},
  traitLimitCD:{kind:'특성보드 / 특성 투자 제한',name:'크리티컬 데미지',compare:true,save:true},
  traitLimitMC:{kind:'특성보드 / 특성 투자 제한',name:'다중 크리',compare:true,save:true},
  traitLimitDR:{kind:'특성보드 / 특성 투자 제한',name:'방어력 감소',compare:true,save:true},
  traitLimitTD:{kind:'특성보드 / 특성 투자 제한',name:'총 데미지',compare:true,save:true},
  traitLimitUA:{kind:'특성보드 / 특성 투자 제한',name:'유닛 가속',compare:true,save:true},
  traitLimitMultiTarget:{kind:'특성보드 / 특성 투자 제한',name:'멀티타겟',compare:true,save:true},
  traitLimitInfinite:{kind:'특성보드 / 특성 투자 제한',name:'무한특성',compare:true,save:true},
  skillDouble:{kind:'성소스킬보드',name:'더블스페',compare:true,save:true,excel:'number'},
  skillMode:{kind:'성소스킬보드',name:'모드',compare:true,save:true},
  skillRound:{kind:'성소스킬보드',name:'라운드',compare:true,save:true,excel:'number'},
  unitGrade:{kind:'유닛정보',name:'유닛 등급',compare:true},
  unitLevel:{kind:'유닛정보',name:'유닛 레벨',compare:true},
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
    buildCompareNumberRow('인첸트',name,change[index]||0,current[index]||0,0.0001)
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
  return buildCompareTextRow('룬효과/버프',name,changeValue,currentValue,{id});
}
function compareExcelInputValue(value,id){
  if(EXCEL_NUMERIC_INPUT_IDS.has(id)) return formatCompareNumber(value);
  if(EXCEL_SELECT_INPUT_IDS.has(id) && (value===undefined || value===null || String(value).trim()==='')){
    const el=$(id);
    return el?.tagName==='SELECT' ? String(el.options[0]?.value ?? '') : '';
  }
  return String(value??'').replace(/,/g,'').trim();
}
function buildExcelInputSpecs(cells,specCells){
  return [
    ['기본정보','총 SP',Math.round(Number(cells.B9)||0),'sp'],
    ['기본정보','보유 XP',specCells.R20,'xp'],
    ['기본정보','보유 BXP',specCells.R21,'bxp'],
    ['기본정보','보유 RP',cells.B16,'rp'],
    ['기본정보','본인 심연의혼',cells.B19,'soul'],
    ['기본정보','난이도',firstExcelValue(cells,['B4','N41']),'diff'],
    ['기본정보','고행',firstExcelValue(cells,['B6','N42','AD8']),'penance'],
    ['기본정보','라운드',firstExcelValue(cells,['B7','N43']),'round'],
    ['기본정보','출발 지원 인원수',cells.D5,'team'],
    ['기본정보','타이틀 총 데미지',EXCEL_TITLE_BONUS_MAP[excelText(specCells.S17)]??specCells.S17,'titleTdBonus'],
    ['기본정보','침식 스텍',cells.H10,'erosionStack'],
    ['기본정보','침식 내성',cells.H11,'jewelErosionRes'],
    ['기본정보','파워 블레스',normalizePowerBlessValueForMaster(excelEnhanceMasterValue(cells.H16),cells.D4),'pbless'],
    ['룬정보','공격력',cells.J5,'rAD'],
    ['룬정보','공격력 개조',specCells.C19,'rModAD'],
    ['룬정보','특수룬 종류',EXCEL_RUNE_TYPE_MAP[excelText(cells.I6)]??cells.I6,'runeChoiceType'],
    ['룬정보','특수룬 수치',cells.J6,'runeChoiceValue'],
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
function buildExcelInputRows(cells,specCells){
  const rows=[];
  buildExcelInputSpecs(cells,specCells).forEach(([kind,name,excel,id])=>{
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
    return {kind:'스탯',name,current:formatCompareNumber(webDisplay),change:formatCompareNumber(excelDisplay),
      difference:formatCompareDiff(displayCompare.diff),status:displayCompare.status,diffClass:compareNumberDiffClass(displayCompare.diff)};
  });
}
function buildExcelTraitRows(cells){
  return TRAITS.filter(t=>t[0]>=42&&t[0]<=138).map(t=>{
    const row=t[0], changeValue=excelCompareNumberValue(cells[`H${row}`]), currentValue=Number(INV[row]||0);
    return buildCompareNumberRow('특성',t[1],changeValue,currentValue,0.0001);
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
    buildExcelChoiceRow('노바',cells.F4,'prodNova',{boolean:true}),
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
  const inputRows=buildExcelInputRows(cells,specCells);
  const enchantRows=buildEnchantCompareRows(getSpecEnchantCode(specCells),webControlDisplay('enchantCode'));
  const statRows=buildExcelStatRows(cells,stats);
  const buffRows=buildExcelBuffRows(cells,specCells);
  const traitRows=buildExcelTraitRows(cells);
  const zeroRows=buildZeroScoreCompareRows(zeroCells);
  const dpsRow=buildCompareNumberRow('DPS','기본 DPS',cells.M19,stats.M19);
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
const COMPARE_FILTER_LABELS={all:'전체 보기',stat:'스탯 차이',input:'입력값 차이',buff:'룬/버프 차이',trait:'특성 차이',zero:'승단 차이'};
const COMPARE_FILTER_ORDER=['all','stat','input','buff','trait','zero'];
const COMPARE_SUMMARY_COUNT_KEYS={stat:'statDiffs',input:'inputDiffs',buff:'buffDiffs',trait:'traitDiffs',zero:'zeroDiffs'};
const EXCEL_COMPARE_COLGROUP='<colgroup><col class="compare-col-kind"><col class="compare-col-name"><col class="compare-col-current"><col class="compare-col-change"><col class="compare-col-diff"></colgroup>';
const EXCEL_COMPARE_EMPTY_HTML='<div class="excel-compare-empty">프리셋, 엑셀파일 또는 백업파일을 선택하세요.<small>엑셀파일은 시트 단위, 특성 프리셋 파일은 프리셋 제목 단위로 비교합니다.</small></div>';
function hydrateCompareControls(){
  const select=$('excelCompareSheet');
  if(!select) return;
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
    const fallbackId=ids.includes(bundle.defaultPresetId) ? bundle.defaultPresetId : (ids[0] || '');
    const selected=ids.includes(compareState.selectedSheetName) ? compareState.selectedSheetName : fallbackId;
    select.innerHTML=presets.map(preset=>`<option value="${escapeCompareHtml(preset.id)}">${escapeCompareHtml(preset.id===bundle.defaultPresetId ? `${preset.name} · 기본` : preset.name)}</option>`).join('') || '<option value="">프리셋 없음</option>';
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
    select.innerHTML='<option value="">항목 선택</option>';
    select.disabled=true;
    compareState.selectedSheetName='';
  }
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

const COMPARE_INPUT_EXCLUDE_KINDS=new Set(['DPS','스탯','룬효과/버프','특성','승단계산','승단계산 결과']);
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
  if(filter==='stat') return row.kind==='스탯';
  if(filter==='buff') return row.kind==='룬효과/버프';
  if(filter==='trait') return row.kind==='특성';
  if(filter==='zero') return row.kind==='승단계산' || row.kind==='승단계산 결과';
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
  const emptyMessage=active==='all' ? '현재값과 불러온 값이 모두 일치합니다.' : `${COMPARE_FILTER_LABELS[active] || '선택한 구분'} 항목에서 차이 난 값이 없습니다.`;
  body.innerHTML=`
    <div class="excel-compare-summary">${compareSummaryHtml(summary,active)}</div>
    <div class="excel-compare-table-wrap">
      <table class="excel-compare-table excel-compare-table-head">${EXCEL_COMPARE_COLGROUP}<thead><tr><th>구분</th><th>항목</th><th>현재값</th><th>변경값</th><th>차이</th></tr></thead></table>
      <div class="excel-compare-table-scroll">
        <table class="excel-compare-table excel-compare-table-body">${EXCEL_COMPARE_COLGROUP}<tbody>${compareRowsHtml(visibleRows,emptyMessage)}</tbody></table>
      </div>
    </div>`;
  updateCompareActionButtons();
}
function openCompareInfo(options={}){
  openMonthRune('compare', options);
}
function closeCompareInfo(){
  closeMonthRune();
}
function requestCompareFileSelect(){
  setTimeout(()=>{
    const input=$('excelCompareFile');
    if(input) input.click();
  },60);
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
  const file=$('excelCompareFile');
  const apply=$('excelCompareApplyBtn');
  const reset=$('excelCompareResetBtn');
  const restore=$('excelCompareRestoreBtn');
  const body=$('excelCompareBody');
  if(select){
    select.innerHTML='<option value="">항목 선택</option>';
    select.disabled=true;
  }
  if(file) file.value='';
  if(apply) apply.disabled=true;
  if(reset) reset.disabled=true;
  if(restore) restore.disabled=true;
  if(body) body.innerHTML=EXCEL_COMPARE_EMPTY_HTML;
  if(options.close) closeCompareInfo();
}
function excelText(value){ return String(value??'').trim(); }
function excelNumber(value){
  const number=Number(String(value??'').replace(/,/g,'').trim());
  return Number.isFinite(number) ? number : null;
}
function resolveExcelSelectValue(id, value){
  const select=$(id);
  const text=excelText(value);
  if(!select||!text) return null;
  const normalized=text.replace(/\s+/g,'').toLowerCase();
  const option=[...select.options].find(item=>{
    const optionValue=String(item.value).trim();
    const optionText=String(item.textContent||'').trim();
    return optionValue===text || optionText===text ||
      optionValue.replace(/\s+/g,'').toLowerCase()===normalized ||
      optionText.replace(/\s+/g,'').toLowerCase()===normalized;
  });
  return option ? option.value : null;
}
function firstExcelValue(cells, refs){
  for(const ref of refs){
    if(cells[ref]!==undefined && cells[ref]!==null && cells[ref]!=='') return cells[ref];
  }
  return null;
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
function buildExcelState(cells, specCells, zeroCells){
  const state=makeStateObject();
  const values={...state.values, soloMode:'ON', coopMode:'OFF', coopPlayers:''};
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
    ['round',firstExcelValue(cells,['B7','N43'])],
    ['team',cells.D5],
    ['unitGrade',cells.H4],['unitLevel',cells.H5],
    ['unitUniqueBuff',cells.H6],['basePierceBuff',cells.H8],
    ['erosionStack',cells.H10],['jewelErosionRes',cells.H11],
    ['overEnhance',cells.H14],['repairEnhance',cells.H15],['enhanceMaster',cells.H16],
    ['shareUserBuff',cells.H116],
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
    const masterValue=values.enhanceMaster || excelEnhanceMasterValue(cells.H16);
    values.pbless=normalizePowerBlessValueForMaster(masterValue, cells.D4);
    applied++;
  }
  applied+=assign('sp',cells.B9,{number:true,integer:true});
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
  inv[116]=1;
  const zeroScore=zeroScoreStateFromExcel(zeroCells) || state.zeroScore;
  if(zeroScore?.rows?.length) applied+=zeroScore.rows.reduce((sum,row)=>sum+(row.type==='penance'?5:(row.type==='towerCombo'?4:2)),0);
  return {state:makeStorageEnvelope({...state,values,inv,zeroScore}),applied};
}

function readFileAsText(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=()=>reject(new Error('파일을 읽지 못했습니다.'));
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
function buildSavedTraitCompareRows(changeState){
  return TRAITS.filter(t=>t[0]>=42&&t[0]<=138).map(t=>{
    const row=t[0], changeValue=Number(changeState.inv?.[row]||0), currentValue=Number(INV[row]||0);
    return buildCompareNumberRow('특성',t[1],changeValue,currentValue,0.0001);
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
    return {kind:'스탯',name,current:formatCompareNumber(currentDisplay),change:formatCompareNumber(changeDisplay),
      difference:formatCompareDiff(displayCompare.diff),status:displayCompare.status,diffClass:compareNumberDiffClass(displayCompare.diff)};
  });
}
function buildJsonComparison(changeState,options={}){
  const currentState=makeStateObject();
  const currentStats=computeStatsRaw();
  const changeSnapshot=snapshotComparisonState(changeState,currentState);
  const effectiveChangeState={...changeSnapshot.state,fileName:changeState.fileName || changeSnapshot.state.fileName,sheetName:changeState.sheetName || changeSnapshot.state.sheetName};
  const changeStats=changeSnapshot.stats;
  const dpsCompare=compareNumber(changeStats.M19,currentStats.M19);
  const dpsRow=buildCompareNumberRow('DPS','기본 DPS',changeStats.M19,currentStats.M19);
  const inputRows=buildSavedValueCompareRows(effectiveChangeState,currentState,{onlyDiffs:false});
  const enchantRows=buildEnchantCompareRows(enchantCompareCodeFromValues(effectiveChangeState.values),enchantCompareCodeFromValues(currentState.values));
  const statRows=buildStateStatRows(changeStats,currentStats);
  const traitRows=buildSavedTraitCompareRows(effectiveChangeState);
  const zeroRows=buildSavedZeroScoreCompareRows(effectiveChangeState.zeroScore,currentState.zeroScore,{onlyDiffs:true});
  const inputDiffs=inputRows.filter(r=>r.status!=='same' && r.kind!=='룬효과/버프').length + enchantRows.filter(r=>r.status!=='same').length;
  const buffDiffs=inputRows.filter(r=>r.status!=='same' && r.kind==='룬효과/버프').length;
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
function renderJsonComparison(changeState){
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
    const imported=buildExcelState(cells,specCells,zeroCells);
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
function compareSelectedExcelSheet(options={}){
  if(!compareState.workbook) return;
  hydrateCompareControls();
  const sheetName=selectedExcelSheetName();
  if(!sheetName) return;
  compareState.lastResult=null;
  const body=$('excelCompareBody');
  const apply=$('excelCompareApplyBtn');
  const reset=$('excelCompareResetBtn');
  if(!options.preserveRestore) clearCompareRestoreState();
  try{
    const cells=compareState.workbook.getCells(sheetName);
    const specCells=compareState.workbook.getCells('스펙');
    const zeroCells=getZeroScoreSheetCells(compareState.workbook);
    const additionalInfo=inspectSpecAdditionalStructure(specCells);
    if(!additionalInfo.valid){
      if(apply) apply.disabled=true;
      if(reset) reset.disabled=false;
      if(body) body.innerHTML=`<div class="excel-compare-error">${escapeCompareHtml(additionalInfo.message).replace('5.4392','<span class="excel-compare-version">5.4392</span>')}</div>`;
      updateCompareActionButtons();
      return;
    }
    compareState.sourceType='excel';
    compareState.selectedSheetName=sheetName;
    renderExcelComparison(buildExcelComparison(cells,specCells,zeroCells,compareState.workbook.fileName,sheetName));
    updateCompareActionButtons();
  }catch(e){
    logAppError('[Excel compare failed]',e);
    if(apply) apply.disabled=true;
    if(reset) reset.disabled=false;
    if(body) body.innerHTML=`<div class="excel-compare-error">${escapeCompareHtml(e?.message||String(e))}</div>`;
    updateCompareActionButtons();
  }
}
function isTraitPresetCompareBundle(parsed){
  return !!(parsed && typeof parsed==='object' && isTraitPresetFileType(parsed.type) && Array.isArray(parsed.presets));
}
async function readCompareJsonSource(file){
  const raw=await readFileAsText(file);
  const parsed=safeJsonParse(raw);
  if(!parsed) throw new Error('저장파일 형식이 아닙니다.');
  if(isTraitPresetCompareBundle(parsed)){
    const store=normalizeTraitPresetStore(parsed);
    if(!store.presets.length) throw new Error('비교할 특성 프리셋이 없습니다.');
    return {sourceType:'traitPreset',traitPresetBundle:{fileName:file.name,defaultPresetId:store.defaultPresetId,presets:store.presets}};
  }
  const state=normalizeSavedState(parsed);
  if(!state) throw new Error('계산기 저장값 형식이 아닙니다.');
  return {sourceType:'json',backupState:{...state,fileName:file.name}};
}
async function handleExcelCompareFile(file){
  resetCompareState();
  hydrateCompareControls();
  const body=$('excelCompareBody');
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
        renderJsonComparison(compareState.backupState);
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
    if(e.target.id==='excelCompareFile'&&e.target.files?.[0]){
      const selectedFile=e.target.files[0];
      handleExcelCompareFile(selectedFile).finally(()=>{ e.target.value=''; });
    }
    if(e.target.id==='excelCompareSheet' && compareState.sourceType==='excel'){ compareState.selectedSheetName=e.target.value; compareSelectedExcelSheet(); }
    if(e.target.id==='excelCompareSheet' && compareState.sourceType==='traitPreset'){ compareState.selectedSheetName=e.target.value; compareSelectedTraitPreset(); }
  });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeCompareInfo(); });
}
/* ===== 09. 특성보드 / V1 최적화 / 초기화 ===== */
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
    return `<div class="trait-group"><h4><span class="trait-title">${tier}</span><span class="trait-tools"><button type="button" class="ui-action-btn mini-btn master" data-action="masterTier" data-tier="${tier}">구간 마스터</button><button type="button" class="ui-action-btn mini-btn reset" data-action="resetTier" data-tier="${tier}">초기화</button></span></h4>${rows}</div>`;
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
function clearUtility(){
  const rows=utilityRowsOrNotify();
  if(!rows) return false;
  let changed=0;
  rows.forEach(row=>{
    if((INV[row]||0)>0){
      INV[row]=0;
      changed++;
    }
  });
  if(116 in INV) INV[116]=1;
  recalc();
  scheduleAutoSaveToast();
  try{showToast(changed ? '유틸 초기화 완료' : '초기화할 유틸 특성이 없습니다', changed ? 'ok' : 'err');}catch(e){}
  return changed>0;
}
const TRAIT_OPT_NORMAL_ROWS={
  SP:new Set([42,43,46,52,53,58,60,61,68,70,71,77,84,85,86,92,93,94,95,96,99,100,101,102,103,104,108,109,110,111,115,116,44,54,62,79]),
  EP:new Set([117,118,119,120,121,122]),
  RP:new Set([125,126,127,129,130]),
  SOUL:new Set([131,132,133,134,135,136,137])
};
function traitByRow(row){return TRAITS.find(t=>t[0]===+row) || null;}
function traitName(row){return traitByRow(row)?.[1] || `행 ${row}`;}
const TRAIT_LIMIT_CONFIG=[
  {id:'traitLimitAD',key:'AD',name:'공격력',value:s=>s.displayAD},
  {id:'traitLimitAS',key:'AS',name:'공격속도',value:s=>s.M7},
  {id:'traitLimitCRI',key:'CRI',name:'크리티컬 확률',value:s=>s.M8},
  {id:'traitLimitCD',key:'CD',name:'크리티컬 데미지',value:s=>s.rawCD},
  {id:'traitLimitMC',key:'MC',name:'다중 크리',value:s=>s.M10},
  {id:'traitLimitDR',key:'DR',name:'방어력 감소',value:s=>s.M12},
  {id:'traitLimitTD',key:'TD',name:'총 데미지',value:s=>s.rawTD},
  {id:'traitLimitUA',key:'UA',name:'유닛 가속',value:s=>s.displayUA}
];
const TRAIT_LIMIT_DEFAULTS={
  traitLimitAD:'0', traitLimitAS:'0', traitLimitCRI:'0', traitLimitCD:'0', traitLimitMC:'0', traitLimitDR:'0', traitLimitTD:'0', traitLimitUA:'0', traitLimitMultiTarget:'OFF', traitLimitInfinite:'OFF'
};
const TRAIT_LIMIT_INPUT_IDS=new Set(TRAIT_LIMIT_CONFIG.map(item=>item.id));
const TRAIT_LIMIT_MULTI_TYPES=new Set(['MD','MP','MCP']);
const TRAIT_LIMIT_UNLIMITED_TEXT='제한없음';
const TRAIT_RECOMMENDATION_MULTI_BUNDLE_ROWS=new Set([100,101,102]);
function normalizeTraitLimitStorageValue(value){
  const text=String(value ?? '').replace(/,/g,'').trim();
  if(text==='' || text==='0' || text===TRAIT_LIMIT_UNLIMITED_TEXT || text==='∞' || /^inf(inity)?$/i.test(text)) return '0';
  const n=Number(text);
  if(!Number.isFinite(n) || n<=0) return '0';
  return String(n);
}
function traitLimitDisplayText(value){
  const normalized=normalizeTraitLimitStorageValue(value);
  return normalized==='0' ? TRAIT_LIMIT_UNLIMITED_TEXT : normalized;
}
function syncTraitLimitInputDisplay(el){
  if(!el || !TRAIT_LIMIT_INPUT_IDS.has(el.id)) return;
  const display=traitLimitDisplayText(el.value);
  if(el.value!==display) el.value=display;
  el.classList.toggle('trait-limit-unlimited', display===TRAIT_LIMIT_UNLIMITED_TEXT);
}
function syncTraitLimitInputs(){
  TRAIT_LIMIT_INPUT_IDS.forEach(id=>syncTraitLimitInputDisplay($(id)));
}
function bindTraitLimitDisplayEvents(){
  document.addEventListener('focusin', e=>prepareTraitLimitInputForEdit(e.target), true);
  document.addEventListener('focusout', e=>{
    if(e.target && TRAIT_LIMIT_INPUT_IDS.has(e.target.id)){
      syncTraitLimitInputDisplay(e.target);
      requestAppUpdate();
    }
  }, true);
}
function prepareTraitLimitInputForEdit(el){
  if(!el || !TRAIT_LIMIT_INPUT_IDS.has(el.id)) return;
  if(String(el.value).trim()===TRAIT_LIMIT_UNLIMITED_TEXT){
    el.value='';
    el.classList.remove('trait-limit-unlimited');
  }
}
function traitLimitSwitchOn(id){
  const el=$(id);
  const fallback=Object.prototype.hasOwnProperty.call(TRAIT_LIMIT_DEFAULTS,id) ? TRAIT_LIMIT_DEFAULTS[id] : 'ON';
  const value=String((el ? el.value : fallback) ?? fallback).trim().toUpperCase();
  return value!=='OFF' && value!=='0' && value!=='FALSE' && value!=='비활성화';
}
function traitLimitAllowsTrait(t){
  if(!Array.isArray(t)) return true;
  const tier=String(t[2] ?? '');
  const type=String(t[3] ?? '');
  if(TRAIT_LIMIT_MULTI_TYPES.has(type) && !traitLimitSwitchOn('traitLimitMultiTarget')) return false;
  if(tier==='무한∞' && !traitLimitSwitchOn('traitLimitInfinite')) return false;
  return true;
}
function traitLimitStatsOk(stats){
  if(!stats) return true;
  for(const item of TRAIT_LIMIT_CONFIG){
    const limit=Number(normalizeTraitLimitStorageValue(vs(item.id)));
    if(!Number.isFinite(limit) || limit<=0) continue;
    const current=Number(item.value(stats));
    if(!Number.isFinite(current)) return false;
    if(current>limit+1e-9) return false;
  }
  return true;
}
function traitOptimizationResourceInfo(row){
  if(SP_ROWS.has(row)) return {kind:'SP'};
  if(EP_ROWS.has(row)) return {kind:'EP'};
  if(RP_ROWS.has(row)) return {kind:'RP'};
  if(SOUL_ROWS.has(row)) return {kind:'SOUL'};
  return null;
}
function traitOptimizationRemaining(kind){
  if(kind==='SP') return effectiveSP() - resourceUsed('SP');
  if(kind==='EP') return v('ep') - resourceUsed('EP');
  if(kind==='RP') return v('rp') - resourceUsed('RP');
  if(kind==='SOUL') return v('soul') - resourceUsed('SOUL');
  return 0;
}
function traitOptimizationDeltaCost(row, add){
  row=+row;
  add=Math.max(0, Math.round(+add||0));
  const n=INV[row]||0;
  if(add<=0) return 0;
  if(n+add>(TMAX[row]||999)) return Infinity;
  if(RP_ROWS.has(row)) return rpCost(row,n+add)-rpCost(row,n);
  const old=INV[row];
  let total=0;
  for(let i=0;i<add;i++){
    INV[row]=(old||0)+i;
    const c=nextCost(row);
    if(!Number.isFinite(c)){ total=Infinity; break; }
    total+=c;
  }
  INV[row]=old;
  return total;
}
function isTraitOptimizationTarget(t){
  const row=t?.[0];
  if(AUTO_INVEST_EXCLUDED_ROWS.has(row) || !traitLimitAllowsTrait(t)) return false;
  const info=traitOptimizationResourceInfo(row);
  if(!info) return false;
  const normalSet=TRAIT_OPT_NORMAL_ROWS[info.kind];
  if(!normalSet || !normalSet.has(row)) return false;
  if(info.kind==='SP') return allowedRowsByTier().has(row);
  return true;
}
function bestTraitOptimizationCandidateForRow(base, kind, rem, row){
  const mx=TMAX[row]||999;
  const maxAdd=Math.max(0, mx-(INV[row]||0));
  if(maxAdd<=0 || rem<=0) return null;
  let affordable=0;
  let lo=1, hi=maxAdd;
  while(lo<=hi){
    const mid=Math.floor((lo+hi)/2);
    const cost=traitOptimizationDeltaCost(row, mid);
    if(Number.isFinite(cost) && cost>0 && cost<=rem){
      affordable=mid;
      lo=mid+1;
    }else{
      hi=mid-1;
    }
  }
  for(let add=affordable; add>=1; add--){
    const cand=evaluateTraitOptimizationCandidate(base, kind, rem, [[row,add]], traitName(row));
    if(cand) return cand;
  }
  return null;
}
function evaluateTraitOptimizationCandidate(base, kind, rem, changes, label, options={}){
  let cost=0;
  for(const [row,add] of changes){
    const info=traitOptimizationResourceInfo(row);
    if(!info || info.kind!==kind) return null;
    const c=traitOptimizationDeltaCost(row,add);
    if(!Number.isFinite(c) || c<=0) return null;
    cost+=c;
  }
  if(cost>rem) return null;
  for(const [row,add] of changes) INV[row]=(INV[row]||0)+add;
  const ns=computeStatsRaw();
  const limitsOk=traitLimitStatsOk(ns);
  for(const [row,add] of changes) INV[row]=(INV[row]||0)-add;
  if(!limitsOk) return null;
  const gain=ns.M19-base.M19;
  if(gain<=0 || (options.visibleGain!==false && !traitRecommendationGainIsVisible(gain))) return null;
  const primaryRow=changes[0]?.[0];
  return {changes,primaryRow,kind,score:gain/cost,gain,cost,label:label||traitName(primaryRow)};
}
function critTraitOptimizationCandidate(base, kind, rem, row, rate, options={}){
  if((INV[row]||0)>=(TMAX[row]||999)) return null;
  const s=computeStatsRaw();
  if(s.M8<300) return null;
  const mod=((s.M8%20)+20)%20;
  const needStat=mod===0 ? 20 : 20-mod;
  const add=Math.ceil(needStat/rate);
  if(add<=0 || (INV[row]||0)+add>(TMAX[row]||999)) return null;
  return evaluateTraitOptimizationCandidate(base, kind, rem, [[row,add]], options.label || traitName(row), options);
}
function traitOptimizationMultiTargetBundleCandidate(base, rem, options={}){
  if(!traitLimitSwitchOn('traitLimitMultiTarget')) return null;
  const changes=[[100,100],[101,70],[102,80]];
  if(options.selectedTierOnly && changes.some(([row])=>!allowedRowsByTier().has(row))) return null;
  if(Number.isFinite(options.currentSumLimit) && changes.reduce((sum,[row])=>sum+(INV[row]||0),0)>options.currentSumLimit) return null;
  for(const [row,add] of changes){
    const t=traitByRow(row);
    if(options.requireTargetTrait!==false && (!t || !isTraitOptimizationTarget(t))) return null;
    if((INV[row]||0)+add>(TMAX[row]||999)) return null;
  }
  if(options.fullCost){
    let cost=0;
    for(const [row,add] of changes){
      const old=INV[row]||0, saved=INV[row];
      INV[row]=old+add;
      cost+=cumCost(row);
      INV[row]=saved;
    }
    if(!Number.isFinite(cost) || cost<=0 || cost>rem) return null;
    for(const [row,add] of changes) INV[row]=(INV[row]||0)+add;
    const ns=computeStatsRaw();
    const limitsOk=traitLimitStatsOk(ns);
    for(const [row,add] of changes) INV[row]=(INV[row]||0)-add;
    const gain=ns.M19-base.M19;
    if(!limitsOk || gain<=0 || (options.visibleGain!==false && !traitRecommendationGainIsVisible(gain))) return null;
    return {changes,kind:'SP',score:gain/cost,gain,cost,label:'멀티 타겟 분기점'};
  }
  return evaluateTraitOptimizationCandidate(base, 'SP', rem, changes, '멀티 타겟 분기점', options);
}
function buildTraitEfficiencyRecommendations(limit=5){
  const base=computeStatsRaw();
  const candidates=[];
  for(const kind of ['SP','EP','RP','SOUL']){
    const rem=traitOptimizationRemaining(kind);
    if(rem<=0) continue;
    for(const t of TRAITS){
      const row=t[0];
      const info=traitOptimizationResourceInfo(row);
      if(!info || info.kind!==kind || !isTraitOptimizationTarget(t)) continue;
      if(kind==='SP' && TRAIT_RECOMMENDATION_MULTI_BUNDLE_ROWS.has(row)) continue;
      if((INV[row]||0)>=(TMAX[row]||999)) continue;
      const cand=bestTraitOptimizationCandidateForRow(base, kind, rem, row);
      if(cand) candidates.push(cand);
    }
    if(kind==='SP'){
      const c=critTraitOptimizationCandidate(base, kind, rem, 95, 0.5);
      if(c) candidates.push(c);
      const mt=traitOptimizationMultiTargetBundleCandidate(base, rem);
      if(mt) candidates.push(mt);
    }
    if(kind==='EP'){
      const c=critTraitOptimizationCandidate(base, kind, rem, 119, 1);
      if(c) candidates.push(c);
    }
    if(kind==='RP'){
      const c=critTraitOptimizationCandidate(base, kind, rem, 127, 2);
      if(c) candidates.push(c);
    }
  }
  const unique=[];
  const seen=new Set();
  candidates.sort((a,b)=>b.score-a.score);
  for(const cand of candidates){
    const key=String(cand.primaryRow || cand.label);
    if(seen.has(key)) continue;
    seen.add(key);
    unique.push(cand);
    if(unique.length>=limit) break;
  }
  return unique;
}
function traitRecommendationInvestText(cand){
  if(!cand?.changes?.length) return '—';
  if(cand.changes.length===1) return `+${cand.changes[0][1]}`;
  return cand.changes.map(([row,add])=>`${traitName(row)} +${add}`).join(' / ');
}
function traitRecommendationResourceLabel(kind){
  if(kind==='SOUL') return '심연';
  return kind || '';
}
function traitRecommendationCostText(cand){
  const label=traitRecommendationResourceLabel(cand?.kind);
  const cost=cand?.kind==='SP' ? big(cand?.cost||0) : fullNumber(cand?.cost||0);
  return label ? `${label} ${cost}` : cost;
}
function traitRecommendationRoundedGainValue(gain){
  const n=Number(gain);
  if(!Number.isFinite(n)) return NaN;
  const decimals=Math.abs(n)>=10 ? 2 : 4;
  return parseFloat(n.toFixed(decimals));
}
function traitRecommendationGainIsVisible(gain){
  const n=traitRecommendationRoundedGainValue(gain);
  return Number.isFinite(n) && n>0;
}
function traitRecommendationGainText(gain){
  const n=traitRecommendationRoundedGainValue(gain);
  if(!Number.isFinite(n)) return '—';
  return `+${n.toLocaleString('ko-KR')}`;
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
function optimizeSP(){
  function normalAddCount(row, kind, rem){
    if(kind!=='SP') return 1;
    if(rem<=4000000) return 1;
    if(row===77 || row===104 || row===116) return 1;
    return 5;
  }
  function boundedChanges(row, add, rem){
    const mx=TMAX[row]||999;
    let n=Math.min(add, mx-(INV[row]||0));
    while(n>0 && traitOptimizationDeltaCost(row,n)>rem) n--;
    return n>0 ? [[row,n]] : null;
  }
  function optimizationCandidate(base, kind, rem, changes, label){
    return evaluateTraitOptimizationCandidate(base, kind, rem, changes, label, {visibleGain:false});
  }
  const kinds=['SP','EP','RP','SOUL'];
  for(const kind of kinds){
    let guard=0;
    while(guard++<100000){
      const base=computeStatsRaw();
      const rem=traitOptimizationRemaining(kind);
      if(rem<=0) break;
      const candidates=[];
      for(const t of TRAITS){
        const [row]=t;
        const info=traitOptimizationResourceInfo(row);
        if(!info || info.kind!==kind || !isTraitOptimizationTarget(t)) continue;
        const n=INV[row]||0;
        const mx=TMAX[row]||999;
        if(n>=mx) continue;
        const changes=boundedChanges(row, normalAddCount(row, kind, rem), rem);
        const cand=changes && optimizationCandidate(base, kind, rem, changes, String(row));
        if(cand) candidates.push(cand);
      }
      if(kind==='SP'){
        const c=critTraitOptimizationCandidate(base, kind, rem, 95, 0.5, {visibleGain:false,label:'CRI→MC 95'});
        if(c) candidates.push(c);
        const mt=traitOptimizationMultiTargetBundleCandidate(base, rem, {selectedTierOnly:true,currentSumLimit:50,requireTargetTrait:false,fullCost:true,visibleGain:false});
        if(mt) candidates.push(mt);
      }
      if(kind==='EP'){
        const c=critTraitOptimizationCandidate(base, kind, rem, 119, 1, {visibleGain:false,label:'CRI→MC 119'});
        if(c) candidates.push(c);
      }
      if(kind==='RP'){
        const c=critTraitOptimizationCandidate(base, kind, rem, 127, 2, {visibleGain:false,label:'CRI→MC 127'});
        if(c) candidates.push(c);
      }
      const best=candidates.sort((a,b)=>b.score-a.score)[0];
      if(!best) break;
      for(const [row,add] of best.changes){
        INV[row]=Math.min(TMAX[row]||999,(INV[row]||0)+add);
      }
    }
  }
  recalc();
  scheduleAutoSaveToast();
  try{showToast('특성 최적화 완료', 'ok');}catch(e){}
}
function clearAll(){
  try{
    TRAITS.forEach(t=>{
      const row=Array.isArray(t) ? t[0] : t.row;
      if(!Number.isFinite(+row)) return;
      if(isUtilityOptimizationTrait(t)) return;
      INV[+row]=0;
    });
    if(116 in INV) INV[116]=1;
    recalc();
    scheduleAutoSaveToast();
    try{showToast('특성 초기화 완료 · 유틸 특성 유지','ok');}catch(e){}
    return true;
  }catch(e){
    logAppError('[clearAll failed]', e);
    alertApp('특성 초기화 실패: '+(e && e.message ? e.message : e));
    return false;
  }
}
/* ===== 10. 저장 / 복구 / 저장파일 백업 ===== */
const STORAGE_VERSION=DPS_CONFIG.storage.version;
const STORAGE_SCOPE=DPS_CONFIG.storage.scope;
const STORAGE_KEY=DPS_CONFIG.storage.key;
const CLIENT_KEY=DPS_CONFIG.storage.clientKey;
const TRAIT_PRESET_STORAGE_KEY=DPS_CONFIG.storage.traitPresetKey || 'gbd_dps_calculator:trait_presets';
const TRAIT_PRESET_FILE_TYPE='sld_dps_trait_presets';
const TRAIT_PRESET_LEGACY_FILE_TYPES=new Set(['gbd_dps_trait_presets']);
const TRAIT_PRESET_FILE_VERSION=1;
const TRAIT_PRESET_NAME_PLACEHOLDER='예시) 더파300라버스';
function isTraitPresetFileType(type){
  return type===TRAIT_PRESET_FILE_TYPE || TRAIT_PRESET_LEGACY_FILE_TYPES.has(type);
}
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
  return el.value;
}
function writeElementValue(el, value){
  if(el.id==='spBankApply') value=normalizeSpBankApplyValue(value);
  if(DECIMAL_DISPLAY_INPUT_IDS.has(el.id)) value=normalizeDecimalDisplayValue(value);
  if(EROSION_CONTROL_IDS.has(el.id)){
    const stored=normalizeErosionControlValue(el.id, value);
    el.dataset.erosionValue=stored;
    value=isAbyssDifficulty() ? stored : ABYSS_DISABLED_LABEL;
  }
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
  if(!Object.prototype.hasOwnProperty.call(values,'optTier')) values.optTier='루키';
  if(!Object.prototype.hasOwnProperty.call(values,'utilOptTier')) values.utilOptTier='루키';
  Object.entries(TRAIT_LIMIT_DEFAULTS).forEach(([id,value])=>{ if(!Object.prototype.hasOwnProperty.call(values,id)) values[id]=value; });
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
      if(TRAIT_LIMIT_INPUT_IDS.has(id)) value=normalizeTraitLimitStorageValue(value);
      if(id==='spBankApply') value=normalizeSpBankApplyValue(value);
      values[id]=value;
    }
  });
  values.optTier=vs('optTier') || values.optTier || '루키';
  values.utilOptTier=vs('utilOptTier') || values.utilOptTier || '루키';
  Object.entries(TRAIT_LIMIT_DEFAULTS).forEach(([id,value])=>{ values[id]=vs(id) || values[id] || value; });
  if(Object.prototype.hasOwnProperty.call(values,'spBankApply')) values.spBankApply=normalizeSpBankApplyValue(values.spBankApply);
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
function sanitizeSavedValues(values){
  if(!values || typeof values!=='object') return {};
  const out=normalizeRuneChoiceValues(values);
  IGNORED_SAVED_VALUE_IDS.forEach(id=>delete out[id]);
  Object.keys(out).forEach(id=>{ if(!isUserStateValueId(id)) delete out[id]; });
  if(Object.prototype.hasOwnProperty.call(out,'overEnhance')) out.overEnhance=String(normalizeOverEnhanceValue(out.overEnhance));
  if(out.raceOpt==='해당 없음') out.raceOpt='없음';
  const coopMode=normalizeOnOffValue(out.coopMode,'OFF')==='ON';
  const coopAllowed=isCoopAllowedDifficulty(out.diff);
  if(coopMode && coopAllowed){
    out.soloMode='OFF';
    out.coopMode='ON';
    out.coopPlayers=normalizeCoopPlayersValue(out.coopPlayers || out.team);
    out.team=out.coopPlayers;
  }else{
    out.soloMode='ON';
    out.coopMode='OFF';
    out.coopPlayers='';
    if(Object.prototype.hasOwnProperty.call(out,'team')){
      const n=normalizeTeamCountValue(out.team);
      out.team=isSoloStartDifficulty(out.diff) ? '1' : n;
    }
  }
  if(Object.prototype.hasOwnProperty.call(out,'penance')){
    const penanceMax=(normalizeOnOffValue(out.coopMode,'OFF')==='ON' && isCoopAllowedDifficulty(out.diff)) ? COOP_PENANCE_MAX : SOLO_PENANCE_MAX;
    out.penance=String(Math.max(0, Math.min(penanceMax, Math.round(+out.penance || 0))));
  }
  ['round','skillRound'].forEach(id=>{
    if(Object.prototype.hasOwnProperty.call(out,id)) out[id]=normalizedRoundString(out[id]);
  });
  if(Object.prototype.hasOwnProperty.call(out,'pbless')){
    const master=String(out.enhanceMaster || 'OFF');
    out.pbless=normalizePowerBlessValueForMaster(master, out.pbless);
  }
  DECIMAL_DISPLAY_INPUT_IDS.forEach(id=>{
    if(Object.prototype.hasOwnProperty.call(out,id)) out[id]=normalizeDecimalDisplayValue(out[id]);
  });
  if(Object.prototype.hasOwnProperty.call(out,'spBankApply')) out.spBankApply=normalizeSpBankApplyValue(out.spBankApply);
  if(Object.prototype.hasOwnProperty.call(out,'runeChoiceType') || Object.prototype.hasOwnProperty.call(out,'runeChoiceValue')){
    const normalizedRune=normalizeRuneChoiceValues(out);
    out.runeChoiceType=normalizedRune.runeChoiceType;
    out.runeChoiceValue=normalizedRune.runeChoiceValue;
  }
  TRAIT_LIMIT_INPUT_IDS.forEach(id=>{
    if(!Object.prototype.hasOwnProperty.call(out,id)) return;
    out[id]=normalizeTraitLimitStorageValue(out[id]);
  });
  return out;
}

function normalizeSavedState(data){
  if(!data || typeof data!=='object') return null;
  const rawValues=(data.values && typeof data.values==='object') ? data.values : {};
  const values=sanitizeSavedValues(rawValues);
  const inv=(data.inv && typeof data.inv==='object') ? {...data.inv} : {};
  const hasZeroScore=!!(data.zeroScore && Array.isArray(data.zeroScore.rows));
  if(!Object.keys(values).length && !Object.keys(inv).length && !hasZeroScore) return null;
  return makeStorageEnvelope({
    values,
    inv,
    zeroScore:data.zeroScore,
    savedAt:data.savedAt,
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
  if(options.preserveSharedValues===false) return state;
  return mergeSharedValuesIntoPresetState(state, makeStateObject());
}
function syncTraitPresetStoreWithCurrentState(currentState, options={}){
  if(options.syncTraitPresets===false || isStorageLocked()) return;
  let store;
  try{ store=loadTraitPresetStore(); }catch(e){ return; }
  if(!store.presets.length) return;
  const state=normalizeSavedState(currentState);
  if(!state) return;
  const selectedId=String(options.selectedTraitPresetId || selectedTraitPresetId() || '');
  let changed=false;
  const now=Date.now();
  store.presets=store.presets.map(preset=>{
    const presetState=normalizeSavedState(preset.state);
    if(!presetState) return preset;
    const nextState=makeStorageEnvelope({
      values:{...presetState.values, ...state.values},
      inv:preset.id===selectedId ? state.inv : presetState.inv,
      zeroScore:state.zeroScore || presetState.zeroScore,
      savedAt:now,
      storageVersion:state.storageVersion,
      scope:presetState.scope,
      ui:presetState.ui,
      clientId:presetState.clientId
    });
    changed=true;
    return {...preset, updatedAt:preset.id===selectedId ? now : preset.updatedAt, meta:traitPresetMetaFromSavedState(nextState), state:nextState};
  });
  if(changed) saveTraitPresetStore(store);
}
let autoSaveToastTimer=0;
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
    if(Object.prototype.hasOwnProperty.call(sanitizedValues,'enhanceMaster')){
      const masterEl=$('enhanceMaster');
      if(masterEl){
        writeElementValue(masterEl, sanitizedValues.enhanceMaster);
        syncPowerBlessOptions();
      }
    }
    Object.entries(sanitizedValues).forEach(([id,val])=>{
      if(id==='dpsTableMinDps') return;
      const el=$(id);
      if(el) writeElementValue(el,val);
    });
    syncBattleMode();
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
    if(Object.prototype.hasOwnProperty.call(sanitizedValues,'runeChoiceType') || Object.prototype.hasOwnProperty.call(sanitizedValues,'runeChoiceValue')) syncRuneChoice();
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
const TRAIT_PRESET_STATUS_LABELS={save:'저장됨',load:'불러옴',delete:'삭제됨',import:'가져옴',export:'내보냄'};
function padStatusPart(value){return String(value).padStart(2,'0');}
function formatTraitPresetStatus(action, date=new Date()){
  const label=TRAIT_PRESET_STATUS_LABELS[action];
  if(!label) return '';
  return `${date.getMonth()+1}/${date.getDate()} ${padStatusPart(date.getHours())}:${padStatusPart(date.getMinutes())} ${label}`;
}
function normalizeTraitPresetStatusText(message){
  const text=String(message || '').replace(/^최근 상태\s+/, '').trim();
  if(!text) return '';
  const actionMatch=text.match(/\s+(저장됨|불러옴|삭제됨|가져옴|내보냄)$/);
  if(!actionMatch) return text;
  const action=actionMatch[1];
  const timeText=text.slice(0, actionMatch.index).trim();
  let match=timeText.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if(match) return `${Number(match[1])}/${Number(match[2])} ${padStatusPart(match[3])}:${match[4]} ${action}`;
  match=timeText.match(/^(?:\d{2}|\d{4})[-년\s]+(\d{1,2})[-월\s]+(\d{1,2})(?:일)?[-\s]+(\d{1,2}):(\d{2})$/);
  if(match) return `${Number(match[1])}/${Number(match[2])} ${padStatusPart(match[3])}:${match[4]} ${action}`;
  return text;
}
function renderTraitPresetStatusText(message){
  const text=normalizeTraitPresetStatusText(message);
  if(!text) return '상태 없음';
  const lastSpace=text.lastIndexOf(' ');
  if(lastSpace<=0) return escapeCompareHtml(text);
  const datePart=text.slice(0,lastSpace);
  const actionPart=text.slice(lastSpace+1);
  return `<span class="trait-preset-status-date">${escapeCompareHtml(datePart)}</span><span class="trait-preset-status-action">${escapeCompareHtml(actionPart)}</span>`;
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
function stateFileBaseName(fileName=''){
  return normalizeTraitPresetName(String(fileName || '').replace(/\.[^.]+$/,'')) || '가져온 프리셋';
}

/* ===== 10-1. 특성 프리셋 저장 / 로드 / 비교 ===== */
function normalizeTraitPresetName(value){
  return String(value ?? '').replace(/\s+/g,' ').trim().slice(0,40);
}
function makeTraitPresetId(){
  const seed=(typeof crypto!=='undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `trait_${String(seed).replace(/[^0-9A-Za-z_-]/g,'')}`;
}
function emptyTraitPresetStore(){
  return {type:TRAIT_PRESET_FILE_TYPE,fileVersion:TRAIT_PRESET_FILE_VERSION,storageVersion:STORAGE_VERSION,updatedAt:Date.now(),defaultPresetId:'',presets:[]};
}
function traitPresetMetaFromValues(values={}){
  const coopMode=normalizeOnOffValue(values.coopMode,'OFF')==='ON';
  const players=normalizeCoopPlayersValue(values.coopPlayers || values.team || COOP_PLAYERS_DEFAULT);
  return {
    diff:String(values.diff || ''),
    penance:String(values.penance || '0'),
    round:String(values.round || '1'),
    mode:coopMode ? `협동${players}인` : '개인'
  };
}
function traitPresetMetaFromState(){
  return traitPresetMetaFromValues({diff:vs('diff'),penance:vs('penance'),round:vs('round'),coopMode:vs('coopMode'),coopPlayers:vs('coopPlayers'),team:vs('team')});
}
function traitPresetMetaFromSavedState(state){
  const values=(state && typeof state==='object' && state.values && typeof state.values==='object') ? state.values : {};
  return traitPresetMetaFromValues(values);
}
function normalizeTraitPresetItem(item,index=0){
  if(!item || typeof item!=='object') return null;
  const stateSource=item.state || item.savedState || item.data || item;
  const state=normalizeSavedState(stateSource);
  if(!state) return null;
  const name=normalizeTraitPresetName(item.name || item.title || `가져온 프리셋 ${index+1}`);
  if(!name) return null;
  const now=Date.now();
  return {
    id:String(item.id || makeTraitPresetId()),
    name,
    createdAt:+item.createdAt || +item.savedAt || now,
    updatedAt:+item.updatedAt || +state.savedAt || now,
    meta:(item.meta && typeof item.meta==='object') ? item.meta : {},
    state
  };
}
function normalizeTraitPresetStore(data){
  const empty=emptyTraitPresetStore();
  const source=(data && typeof data==='object') ? data : {};
  const rawPresets=Array.isArray(source.presets) ? source.presets : (Array.isArray(data) ? data : []);
  const seen=new Set();
  const presets=[];
  rawPresets.forEach((item,index)=>{
    const preset=normalizeTraitPresetItem(item,index);
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
  return {...empty,storageVersion:source.storageVersion || STORAGE_VERSION,updatedAt:+source.updatedAt || Date.now(),defaultPresetId,presets};
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
function saveTraitPresetStore(store){
  const normalized=normalizeTraitPresetStore({...store,updatedAt:Date.now()});
  localStorage.setItem(TRAIT_PRESET_STORAGE_KEY, JSON.stringify(normalized));
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
function refreshTraitPresetControls(selectedId){
  const store=loadTraitPresetStore();
  const select=$('traitPresetSelect');
  const nameInput=$('traitPresetName');
  const defaultView=$('traitPresetDefaultView');
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
  const defaultPreset=store.presets.find(preset=>preset.id===store.defaultPresetId);
  if(defaultView){
    const presetName=defaultPreset ? defaultPreset.name : '없음';
    defaultView.innerHTML=`<span class="trait-preset-default-label">기본 프리셋</span><span class="trait-preset-default-name">${escapeCompareHtml(presetName)}</span>`;
  }
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
    applyTraitPresetState(preset,{persist:true,preserveSharedValues:options.preserveSharedValues!==false,syncTraitPresetId:id});
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
function resetToFirstVisitState(){
  try{
    try{
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TRAIT_PRESET_STORAGE_KEY);
      localStorage.removeItem(DPS_CONFIG.storage.fontKey);
    }catch(e){}
    resetToFactoryState();
    try{ localStorage.removeItem(DPS_CONFIG.storage.fontKey); }catch(e){}
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
    const defaultPreset=store.presets.find(item=>item.id===store.defaultPresetId);
    const exportStore=normalizeTraitPresetStore({...store,type:TRAIT_PRESET_FILE_TYPE});
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
    notifyStorageAction('특성 프리셋 내보내기 완료','ok',{statusAction:'export'});
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
function normalizeTraitPresetImportData(parsed,fileName=''){
  if(!parsed) throw new Error('특성 프리셋 파일 형식이 아닙니다.');
  const stateOnly=normalizeSavedState(parsed);
  if(stateOnly && !Array.isArray(parsed.presets)){
    const name=normalizeTraitPresetName(parsed.name || stateFileBaseName(fileName));
    return {defaultPresetId:'',defaultPresetName:'',presets:[{id:makeTraitPresetId(),name,state:stateOnly,createdAt:Date.now(),updatedAt:Date.now(),meta:traitPresetMetaFromSavedState(stateOnly)}]};
  }
  const source=Array.isArray(parsed) ? {presets:parsed} : parsed;
  const presets=Array.isArray(source.presets) ? source.presets.map((item,index)=>normalizeTraitPresetItem(item,index)).filter(Boolean) : [];
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
  store=saveTraitPresetStore(store);
  return {store,added,replaced,firstImportedPresetId,defaultImportedPresetId};
}
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
    const importedState=buildExcelState(cells,specCells,zeroCells).state;
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
/* 특성 프리셋: 비교 패널 연동 */
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
  const bundle=compareState.traitPresetBundle || {};
  return buildJsonComparison({...state,fileName:bundle.fileName || '특성 프리셋 파일',sheetName:preset.name},{fileName:bundle.fileName || '특성 프리셋 파일',sheetName:preset.name,sourceType:'traitPreset'});
}
function renderTraitPresetComparison(preset){
  renderExcelComparison(buildTraitPresetComparison(preset));
}
function applySelectedTraitPreset(){
  const preset=selectedCompareTraitPreset();
  if(!preset || compareState.applied) return;
  const previousState=makeStateObject();
  try{
    const state=buildTraitPresetApplyState(preset,{preserveSharedValues:true});
    if(!state) throw new Error('특성 프리셋 데이터가 올바르지 않습니다.');
    applyStateObject(state);
    const saved=saveState({silent:true});
    if(saved===false) throw new Error('변경값은 적용했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.');
    compareState.restoreState=previousState;
    compareState.applied=true;
    hydrateCompareControls();
    renderTraitPresetComparison(preset);
    updateCompareActionButtons();
    notifyStorageAction(`프리셋 적용 완료: ${preset.name}`,'ok',{statusAction:'load'});
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
    compareState.sourceType='traitPreset';
    compareState.traitPresetBundle={
      fileName:'저장된 특성 프리셋',
      defaultPresetId:store.defaultPresetId,
      presets:store.presets
    };
    compareState.selectedSheetName=id;
  }
  openCompareInfo();
  if(preset) showToast(`프리셋 분석에 연결: ${preset.name}`,'ok');
  return true;
}
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
/* ===== 11. 화면 제어 / 글자 크기 / 확인 작업 ===== */
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
/* ===== 12. 더제로 승단 계산기 ===== */
/* 더제로 승단: 엑셀/저장파일 비교 상태 변환 */
const ZERO_EXCEL_SHEET_NAME='더제로 승단';
const ZERO_EXCEL_PENANCE_ROWS=[
  'Practice','Very Easy','Easy','Normal','Hard','Very Hard','Hell','Inferno','Lunatic','Holic','Epic','Ultimate','Impossible','The Final'
].map((name,index)=>({name,row:13+index}));
/* 더제로 승단: 점수 계산 공통 */
function zeroScoreNumber(value, min, max){
  const n=Number(value);
  if(!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
function zeroRangeScore(value, start, maxValue, pointForStep){
  let sum=0;
  const max=zeroScoreNumber(value,0,maxValue);
  for(let i=start;i<=max;i++) sum+=pointForStep(i) || 0;
  return sum;
}
function zeroPenanceScore(level){
  return zeroRangeScore(level,1,20,i=>i<=13 ? 1 : (i<=16 ? 2 : (i===17 ? 3 : 7)));
}
const ZERO_HONOR_STAGES=[{key:'b', point:2},{key:'a', point:4},{key:'s', point:6},{key:'x', point:8}];
function zeroHonorScore(stage){
  const found=ZERO_HONOR_STAGES.find(item=>item.key===stage);
  return found ? found.point : 0;
}
function zeroTowerScore(floor){
  return zeroRangeScore(floor,41,90,i=>i<=60 ? 1 : (i<=70 ? 2 : 3));
}
function zeroHonorTowerScore(floor){
  return zeroRangeScore(floor,50,90,i=>i<=68 ? (i%2===0 ? 1 : 0) : (i<=79 ? 1 : 2));
}
function getZeroScoreSheetCells(workbook){
  try{
    return workbook?.sheets?.some(sheet=>sheet.name===ZERO_EXCEL_SHEET_NAME) ? workbook.getCells(ZERO_EXCEL_SHEET_NAME) : null;
  }catch(_e){ return null; }
}
function normalizeZeroHonorValue(value){
  const text=excelText(value).toLowerCase().replace(/명예/g,'').trim();
  const first=text.charAt(0);
  if(['b','a','s','x'].includes(first)) return first;
  if(['없음','none','off','n','0','-',''].includes(text)) return '';
  return '';
}
function zeroHonorDisplay(value){
  return value ? String(value).toUpperCase() : '없음';
}
function zeroScoreFieldValue(row, kind){
  if(!row || typeof row!=='object') return undefined;
  const keys=kind==='current'
    ? ['current','현재 일반']
    : ['target','목표 일반'];
  for(const key of keys){
    if(Object.prototype.hasOwnProperty.call(row,key)) return row[key];
  }
  return undefined;
}
function zeroScoreHonorValue(row, kind){
  if(!row || typeof row!=='object') return '';
  const keys=kind==='current'
    ? ['currentHonor','현재 명예']
    : ['targetHonor','목표 명예'];
  for(const key of keys){
    if(Object.prototype.hasOwnProperty.call(row,key)) return normalizeZeroHonorValue(row[key]);
  }
  return '';
}
function zeroScoreTowerHonorValue(row, kind){
  if(!row || typeof row!=='object') return undefined;
  const keys=kind==='current'
    ? ['honorCurrent','현재 명예탑']
    : ['honorTarget','목표 명예탑'];
  for(const key of keys){
    if(Object.prototype.hasOwnProperty.call(row,key)) return row[key];
  }
  return row.type==='honorTower' ? zeroScoreFieldValue(row,kind) : undefined;
}
function zeroScoreStateFromExcel(zeroCells){
  if(!zeroCells) return null;
  const rows=[];
  ZERO_EXCEL_PENANCE_ROWS.forEach(({row})=>{
    rows.push({
      type:'penance',
      current:String(Math.max(0,Math.min(20,Math.round(excelNumber(zeroCells[`B${row}`]) ?? 0)))),
      target:String(Math.max(0,Math.min(20,Math.round(excelNumber(zeroCells[`C${row}`]) ?? 0)))),
      star:excelFlag(zeroCells[`D${row}`]),
      currentHonor:normalizeZeroHonorValue(zeroCells[`E${row}`]),
      targetHonor:normalizeZeroHonorValue(zeroCells[`F${row}`])
    });
  });
  rows.push({
    type:'towerCombo',
    current:String(Math.max(0,Math.min(90,Math.round(excelNumber(zeroCells.B27) ?? 0)))),
    target:String(Math.max(0,Math.min(90,Math.round(excelNumber(zeroCells.C27) ?? 0)))),
    honorCurrent:String(Math.max(0,Math.min(90,Math.round(excelNumber(zeroCells.B28) ?? 0)))),
    honorTarget:String(Math.max(0,Math.min(90,Math.round(excelNumber(zeroCells.C28) ?? 0)))),
    star:false,currentHonor:'',targetHonor:''
  });
  return {rows};
}
function zeroScoreRowCalculation(row){
  const type=row?.type || 'penance';
  let currentScore=0, targetScore=0, score=0;
  if(type==='penance'){
    const cur=zeroScoreNumber(zeroScoreFieldValue(row,'current'),0,20);
    const tar=zeroScoreNumber(zeroScoreFieldValue(row,'target'),0,20);
    const currentPenanceScore=zeroPenanceScore(cur);
    const targetPenanceScore=zeroPenanceScore(tar);
    const currentHonorScore=zeroHonorScore(zeroScoreHonorValue(row,'current'));
    const targetHonorScore=zeroHonorScore(zeroScoreHonorValue(row,'target'));
    const star=row.star ? 2 : 0;
    currentScore=currentPenanceScore+currentHonorScore+star;
    targetScore=targetPenanceScore+targetHonorScore;
    score=Math.max(0,targetPenanceScore-currentPenanceScore)+Math.max(0,targetHonorScore-currentHonorScore);
  }else if(type==='tower'){
    currentScore=zeroTowerScore(zeroScoreFieldValue(row,'current'));
    targetScore=zeroTowerScore(zeroScoreFieldValue(row,'target'));
    score=Math.max(0,targetScore-currentScore);
  }else if(type==='honorTower'){
    currentScore=zeroHonorTowerScore(zeroScoreFieldValue(row,'current'));
    targetScore=zeroHonorTowerScore(zeroScoreFieldValue(row,'target'));
    score=Math.max(0,targetScore-currentScore);
  }else if(type==='towerCombo'){
    const towerCurrentScore=zeroTowerScore(zeroScoreFieldValue(row,'current'));
    const towerTargetScore=zeroTowerScore(zeroScoreFieldValue(row,'target'));
    const honorCurrentScore=zeroHonorTowerScore(zeroScoreTowerHonorValue(row,'current'));
    const honorTargetScore=zeroHonorTowerScore(zeroScoreTowerHonorValue(row,'target'));
    currentScore=towerCurrentScore+honorCurrentScore;
    targetScore=towerTargetScore+honorTargetScore;
    score=Math.max(0,towerTargetScore-towerCurrentScore)+Math.max(0,honorTargetScore-honorCurrentScore);
  }
  return {currentScore,targetScore,score};
}
function zeroScoreSummaryFromState(zeroScore){
  const rows=Array.isArray(zeroScore?.rows) ? zeroScore.rows : [];
  let currentTotal=0,total=0;
  rows.forEach(row=>{
    const calc=zeroScoreRowCalculation(row);
    currentTotal+=calc.currentScore;
    total+=calc.score;
  });
  return {currentTotal,total,targetScore:currentTotal+total};
}
function zeroTowerComboFromRows(rows, index=14){
  const list=Array.isArray(rows) ? rows : [];
  const base=list[index] || {};
  if(base.type==='towerCombo'){
    return {
      type:'towerCombo',
      current:zeroScoreFieldValue(base,'current') ?? '0',
      target:zeroScoreFieldValue(base,'target') ?? '0',
      honorCurrent:zeroScoreTowerHonorValue(base,'current') ?? '0',
      honorTarget:zeroScoreTowerHonorValue(base,'target') ?? '0',
      star:false,currentHonor:'',targetHonor:''
    };
  }
  const honor=base.type==='honorTower' ? base : (list[index+1] || {});
  return {
    type:'towerCombo',
    current:zeroScoreFieldValue(base,'current') ?? '0',
    target:zeroScoreFieldValue(base,'target') ?? '0',
    honorCurrent:zeroScoreTowerHonorValue(honor,'current') ?? '0',
    honorTarget:zeroScoreTowerHonorValue(honor,'target') ?? '0',
    star:false,currentHonor:'',targetHonor:''
  };
}
function normalizeZeroScoreState(zeroScore){
  const sourceRows=Array.isArray(zeroScore?.rows) ? zeroScore.rows : [];
  const rows=ZERO_EXCEL_PENANCE_ROWS.map((_,index)=>{
    const row=sourceRows[index] || {};
    return {
      type:'penance',
      current:String(zeroScoreNumber(zeroScoreFieldValue(row,'current'),0,20)),
      target:String(zeroScoreNumber(zeroScoreFieldValue(row,'target'),0,20)),
      star:!!row.star,
      currentHonor:zeroScoreHonorValue(row,'current'),
      targetHonor:zeroScoreHonorValue(row,'target')
    };
  });
  const towerCombo=zeroTowerComboFromRows(sourceRows);
  rows.push({
    type:'towerCombo',
    current:String(zeroScoreNumber(zeroScoreFieldValue(towerCombo,'current'),0,90)),
    target:String(zeroScoreNumber(zeroScoreFieldValue(towerCombo,'target'),0,90)),
    honorCurrent:String(zeroScoreNumber(zeroScoreTowerHonorValue(towerCombo,'current'),0,90)),
    honorTarget:String(zeroScoreNumber(zeroScoreTowerHonorValue(towerCombo,'target'),0,90)),
    star:false,currentHonor:'',targetHonor:''
  });
  return {rows};
}
function compareZeroTextRow(name, changeValue, currentValue){
  return buildCompareTextRow('승단계산',name,changeValue,currentValue);
}
function compareZeroNumberRow(kind,name,changeValue,currentValue){
  return buildCompareNumberRow(kind,name,changeValue,currentValue,0.0001);
}
/* 더제로 승단: 저장파일/프리셋 분석 행 생성 */
function addZeroPenanceCompareRows(rows,name,change={},current={}){
  const currentCalc=zeroScoreRowCalculation(current);
  const changeCalc=zeroScoreRowCalculation(change);
  rows.push(compareZeroNumberRow('승단계산',`${name} 현재 일반`,change.current ?? 0,current.current ?? 0));
  rows.push(compareZeroNumberRow('승단계산',`${name} 목표 일반`,change.target ?? 0,current.target ?? 0));
  rows.push(compareZeroTextRow(`${name} 24스타`,change.star?'ON':'OFF',current.star?'ON':'OFF'));
  rows.push(compareZeroTextRow(`${name} 현재 명예`,zeroHonorDisplay(change.currentHonor||''),zeroHonorDisplay(current.currentHonor||'')));
  rows.push(compareZeroTextRow(`${name} 목표 명예`,zeroHonorDisplay(change.targetHonor||''),zeroHonorDisplay(current.targetHonor||'')));
  rows.push(compareZeroNumberRow('승단계산 결과',`${name} 추가점수`,changeCalc.score,currentCalc.score));
}
function addZeroTowerComboCompareRows(rows,label,change={},current={}){
  rows.push(compareZeroNumberRow('승단계산',`${label} 현재 일반`,change.current ?? 0,current.current ?? 0));
  rows.push(compareZeroNumberRow('승단계산',`${label} 목표 일반`,change.target ?? 0,current.target ?? 0));
  rows.push(compareZeroTextRow(`${label} 24스타`,'비활성화','비활성화'));
  rows.push(compareZeroNumberRow('승단계산',`${label} 현재 명예`,change.honorCurrent ?? 0,current.honorCurrent ?? 0));
  rows.push(compareZeroNumberRow('승단계산',`${label} 목표 명예`,change.honorTarget ?? 0,current.honorTarget ?? 0));
  rows.push(compareZeroNumberRow('승단계산 결과',`${label} 목표 추가점수`,zeroScoreRowCalculation(change).score,zeroScoreRowCalculation(current).score));
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
  rows.push(compareZeroNumberRow('승단계산 결과','현재 승단점수',changeSummary.currentTotal,currentSummary.currentTotal));
  rows.push(compareZeroNumberRow('승단계산 결과','목표 완료 시',changeSummary.targetScore,currentSummary.targetScore));
  return onlyDiffs ? rows.filter(row=>row.status!=='same') : rows;
}
function buildZeroScoreCompareRows(zeroCells){
  if(!zeroCells) return [];
  const webState=collectZeroScoreState() || {rows:[]};
  const rows=[];
  ZERO_EXCEL_PENANCE_ROWS.forEach(({name,row},index)=>{
    const web=webState.rows[index] || {};
    const webCalc=zeroScoreRowCalculation(web);
    rows.push(compareZeroNumberRow('승단계산',`${name} 현재 일반`,zeroCells[`B${row}`],web.current ?? 0));
    rows.push(compareZeroNumberRow('승단계산',`${name} 목표 일반`,zeroCells[`C${row}`],web.target ?? 0));
    rows.push(compareZeroTextRow(`${name} 24스타`,excelFlag(zeroCells[`D${row}`])?'ON':'OFF',web.star?'ON':'OFF'));
    rows.push(compareZeroTextRow(`${name} 현재 명예`,zeroHonorDisplay(normalizeZeroHonorValue(zeroCells[`E${row}`])),zeroHonorDisplay(web.currentHonor||'')));
    rows.push(compareZeroTextRow(`${name} 목표 명예`,zeroHonorDisplay(normalizeZeroHonorValue(zeroCells[`F${row}`])),zeroHonorDisplay(web.targetHonor||'')));
    rows.push(compareZeroNumberRow('승단계산 결과',`${name} 추가점수`,zeroCells[`G${row}`],webCalc.score));
  });
  const comboExcel={
    type:'towerCombo',
    current:String(Math.max(0,Math.min(90,Math.round(excelNumber(zeroCells.B27) ?? 0)))),
    target:String(Math.max(0,Math.min(90,Math.round(excelNumber(zeroCells.C27) ?? 0)))),
    honorCurrent:String(Math.max(0,Math.min(90,Math.round(excelNumber(zeroCells.B28) ?? 0)))),
    honorTarget:String(Math.max(0,Math.min(90,Math.round(excelNumber(zeroCells.C28) ?? 0)))),
    star:false,currentHonor:'',targetHonor:''
  };
  const comboWeb=zeroTowerComboFromRows(webState.rows);
  addZeroTowerComboCompareRows(rows,'도전의탑',comboExcel,comboWeb);
  const webSummary=zeroScoreSummaryFromState(webState);
  rows.push(compareZeroNumberRow('승단계산 결과','현재 승단점수',zeroCells.H28,webSummary.currentTotal));
  rows.push(compareZeroNumberRow('승단계산 결과','목표 완료 시',zeroCells.I28,webSummary.targetScore));
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
  const normalized=normalizeZeroHonorValue(el.value);
  el.value=normalized ? normalized.toUpperCase() : '';
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
/* ===== 13. 공통 이벤트 바인딩 / 앱 초기화 ===== */
let appEventsBound=false;
const ACTION_HANDLERS={
  optimizeSP,
  optimizeUtility,
  clearUtility:()=>requestConfirmAction('clearUtility','한 번 더 누르면 유틸 초기화', clearUtility),
  applyTraitEfficiencyTop,
  clearAll:()=>requestConfirmAction('clearAll','한 번 더 누르면 유틸 제외 특성 초기화', clearAll),
  saveTraitPreset,
  loadTraitPreset,
  renameTraitPreset,
  deleteTraitPreset,
  setDefaultTraitPreset,
  resetAllTraitPresetState:requestTraitPresetFullReset,
  exportTraitPresets,
  importTraitPresets: openTraitPresetImportPicker,
  compareTraitPreset,
  openDpsTable,
  openMonthRuneTab:(trigger)=>openMonthRune(trigger?.dataset?.monthRuneOpenTab || 'compare'),
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
  'traitPresetName',
  'traitPresetSelect',
  'traitPresetImportFile',
  'traitPresetExportName',
  'dpsTableMinDps',
  'dpsTableMinDpsMain'
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
    if(target.id==='round' || target.id==='skillRound') normalizeRoundInput(target.id);
    if(target.id==='diff'){
      resetDifficultyDependentFields();
      resetTeamOnDifficultyChange();
      syncErosionControls();
      syncPowerBlessOptions({auto:true});
    }
    if(RUNE_CHOICE_SYNC_IDS.has(target.id)) syncRuneChoice();
    if(ENCHANT_INPUT_ID_SET.has(target.id)) syncEnchantInputs();
    if(RUNE_OPTION_SELECT_ID_SET.has(target.id)) syncExclusiveRuneOptions();
    if(target.id==='soloMode' || target.id==='coopMode'){
      syncBattleMode(target.id);
      syncPowerBlessOptions({auto:true});
    }
    if(target.id==='coopPlayers'){
      syncBattleMode('coopPlayers');
      syncPowerBlessOptions({auto:true});
    }
    if(target.id==='enhanceMaster') syncPowerBlessOptions({auto:true});
    if(target.id==='team'){
      syncTeamSelect();
      syncPowerBlessOptions({auto:true});
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
function bindAppEvents(){
  if(appEventsBound) return;
  appEventsBound=true;
  bindFontScaleViewportGuard();
  bindActionEvents();
  bindBusCutEvents();
  bindTraitHoldEvents();
  bindTraitInputEvents();
  bindDpsTableEvents();
  bindExcelCompareEvents();
  bindTraitPresetEvents();
  bindMonthRuneEvents();
  bindZeroScoreCalculator();
  bindTraitLimitDisplayEvents();
  bindReactiveInputs();
  bindButtonPressFeedback();
  bindAppTitleVersion();
}
function initApp(){
  loadFontScale();
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
  renderMobileReferencePanels();
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
