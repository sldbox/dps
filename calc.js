/* ===== calc.js | 계산식·계산 보조·DOM 어댑터·엑셀 파싱 헬퍼 ===== */
/* 계산식은 보존하고, 현재 구조상 필요한 DOM 기반 preview/입력 어댑터와 엑셀 파싱 헬퍼를 함께 둔다. */


/* ===== 00. 공통 객체/엑셀 값 헬퍼 / 계산 입력 정규화 ===== */
function hasOwn(obj,key){
  return !!obj && Object.prototype.hasOwnProperty.call(obj,key);
}
function excelText(value){
  return String(value??'').trim();
}
function excelNumber(value){
  const number=Number(String(value??'').replace(/,/g,'').trim());
  return Number.isFinite(number) ? number : null;
}
function excelFlag(value){
  const text=excelText(value).toLowerCase();
  const number=excelNumber(value);
  return ['true','on','on+','yes','y'].includes(text) || (number!==null && number!==0);
}

const ROUND_INPUT_MIN=1;
const ROUND_INPUT_MAX=300;
const TOWER_FLOOR_INPUT_MIN=1;
const TOWER_FLOOR_INPUT_MAX=90;
function normalizedIntegerRange(value, min, max, fallback=min){
  const raw=String(value ?? '').replace(/,/g,'').trim();
  const num=raw==='' ? NaN : Number(raw);
  const base=Number.isFinite(num) ? num : fallback;
  return Math.max(min, Math.min(max, Math.round(base)));
}
function normalizedRoundNumber(value, fallback=ROUND_INPUT_MIN){
  return normalizedIntegerRange(value, ROUND_INPUT_MIN, ROUND_INPUT_MAX, fallback);
}
function normalizedRoundString(value){ return String(normalizedRoundNumber(value)); }
function normalizedTowerFloorNumber(value, fallback=TOWER_FLOOR_INPUT_MIN){
  return normalizedIntegerRange(value, TOWER_FLOOR_INPUT_MIN, TOWER_FLOOR_INPUT_MAX, fallback);
}
function normalizedTowerFloorString(value){ return String(normalizedTowerFloorNumber(value)); }
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

const POWER_BLESS_ALL_OPTIONS=[0,20,30,40,60,90];
const COOP_PLAYERS_DEFAULT='3';
const EROSION_CONTROL_DEFAULTS={erosionStack:'500',jewelErosionRes:'30'};
const EROSION_CONTROL_IDS=new Set(Object.keys(EROSION_CONTROL_DEFAULTS));
const SOLO_PENANCE_MAX=20;
const COOP_PENANCE_MAX=13;
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
function normalizePenanceValue(value, max=SOLO_PENANCE_MAX){
  return String(Math.max(0, Math.min(max, Math.round(+value || 0))));
}
function normalizePowerBlessRawValue(value){
  const raw=String(value ?? '').replace(/,/g,'').trim();
  if(raw==='' || raw==='없음') return '0';
  const n=Math.max(0, Math.round(excelNumber(value) ?? (+raw || 0)));
  return POWER_BLESS_ALL_OPTIONS.includes(n) ? String(n) : '0';
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
function normalizeDecimalDisplayValue(value, digits=6){
  const text=String(value ?? '').replace(/,/g,'').trim();
  if(text==='') return '';
  const n=Number(text);
  if(!Number.isFinite(n)) return String(value ?? '');
  const fixed=n.toFixed(digits);
  return String(parseFloat(fixed));
}


/* ===== 01. 계산 입력 상태 어댑터 / DOM 값 조회 ===== */
function targetRoundStoredValue(){
  const el=$('round');
  if(!el) return String(ROUND_INPUT_MIN);
  return normalizedRoundString(el.value || el.dataset.roundValue || ROUND_INPUT_MIN);
}
function challengeTowerFloorStoredValue(){
  const el=$('challengeTowerFloor');
  if(!el) return String(TOWER_FLOOR_INPUT_MIN);
  return normalizedTowerFloorString(el.value || el.dataset.challengeTowerFloorValue || TOWER_FLOOR_INPUT_MIN);
}
function effectiveTargetRound(){
  return isTowerDifficulty() ? normalizedTowerFloorNumber(challengeTowerFloorStoredValue()) : normalizedRoundNumber(targetRoundStoredValue());
}
const BASE_DISPLAY_STATS={ad:5, as:5, cri:5};
function effectiveXpValue(){return Math.max(1, v('xp'));}
function isCoopMode(){return normalizeOnOffValue(vs('coopMode'),'OFF')==='ON';}
function isCoopActive(diffName=vs('diff')){return isCoopMode() && isCoopAllowedDifficulty(diffName);}
function coopPlayerCount(){return Number(normalizeCoopPlayersValue(vs('coopPlayers')));}
function battleEnemyCountMultiplier(){return isCoopActive() ? coopPlayerCount() : 1;}
function currentPenanceMax(){return isCoopActive() ? COOP_PENANCE_MAX : SOLO_PENANCE_MAX;}
function shouldIgnorePenanceForDifficulty(diffName=vs('diff')){
  const name=difficultyName(diffName);
  return name===TOWER_DIFFICULTY_NAME || name==='Deep Abyss';
}
function penanceStoredValue(){
  const el=$('penance');
  if(!el) return '0';
  return normalizePenanceValue(el.value || el.dataset.penanceValue || '0', SOLO_PENANCE_MAX);
}
function effectivePenanceValue(){
  return shouldIgnorePenanceForDifficulty() ? 0 : Number(normalizePenanceValue(penanceStoredValue(), currentPenanceMax()));
}
function effectivePowerBlessValue(value=vs('pbless')){
  return Number(normalizePowerBlessRawValue(value));
}
function erosionStoredValue(id){
  const el=$(id);
  if(!el) return EROSION_CONTROL_DEFAULTS[id] || '0';
  return normalizeErosionControlValue(id, el.value || el.dataset.erosionValue || EROSION_CONTROL_DEFAULTS[id]);
}


function calculateSkillDamageRows({ap=535,doubleSpace=1,round=1,mode='normal'}={}){
  const skillAp=Number.isFinite(Number(ap)) ? Number(ap) : 535;
  const doubleValue=Number.isFinite(Number(doubleSpace)) ? Number(doubleSpace) : 1;
  const roundValue=normalizedRoundNumber(round);
  const isTower=String(mode)==='tower';
  const baseRound=isTower ? 30 : 100;
  const perRound=isTower ? 0.016601 : 0.005;
  const penalty=Math.max(0, Math.min(0.99, (roundValue-baseRound)*perRound));
  const data=[
    ['어스퀘이크',0.0223,0.000066,10],
    ['포이즌미스트',0.0432,0.0001755,15],
    ['라이트닝스톰',0.517,0.0005,1],
    ['퓨리파이어',0.0198,0.000142,30],
    ['메테오 (1발)',0.259,0.00025,1]
  ];
  return {
    ap:skillAp,
    doubleSpace:doubleValue,
    round:roundValue,
    penalty,
    items:data.map(([name,base,add,tick])=>({name,total:(base + add*skillAp*doubleValue) * tick * (1-penalty) * 100}))
  };
}

/* ===== 02. DPS표 계산 보조 / 도전의탑 표시값 ===== */
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
function dpsTableRiskCompareValue(value){
  if(!Number.isFinite(value)) return NaN;
  const factor=10**DPS_TABLE_DECIMALS;
  return Math.round(value*factor)/factor;
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

/* ===== 03. 인첸트 조회 ===== */
function enchantAt(pos){
  syncEnchantCodeFromInputs(false);
  const code=($('enchantCode')?.value||'999999').padEnd(6,'0');
  const lv=Math.max(0,Math.min(9,parseInt(code[pos]||'0',10)||0));
  return ENCHANT_TABLE[lv];
}

/* ===== 04. 특성 비용 ===== */
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

/* ===== 05. 난이도 / 적 데이터 / 콘텐츠 DPS 배율 ===== */
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
  const armor=Math.max(0, Number.isFinite(enemyArmor)?enemyArmor:enemyRoundData(effectiveTargetRound()).armor);
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
function isTowerDifficulty(value=vs('diff')){return difficultyName(value)===TOWER_DIFFICULTY_NAME;}
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

/* ===== 06. 룬 / 강화 / 상단 옵션 계산 ===== */
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
  // 엑셀 스펙 시트는 하이퍼/고행, 도전의탑, 심연 시트에 추가 룬 스탯을 동일하게 적용한다.
  return { ad:v('addAD'), as:v('addAS'), cd:v('addCD'), cri:v('addCRI'), ap:v('addAP'), td:v('addTD'), ua:v('addUA'), dr:0, sr:0, hr:0 };
}
function growthGraduationAttackBonus(){
  return effectiveXpValue()>=2000000 ? 20 : 0;
}


/* ===== 07. 메인 스탯 / 버프 / DPS 계산 ===== */
function computeStatsRaw(){
  const autoEP=syncAutoEP();
  const diff=DIFF[vs('diff')]||DIFF['The Final'];
  const targetRound=effectiveTargetRound();
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

/* ===== 08. 유물 DPS 계산 / 미리보기 상태 보존 ===== */
function currentPenaltyContext(){
  const diff=DIFF[vs('diff')]||DIFF['The Final'];
  const targetRound=effectiveTargetRound();
  const towerPenaltyLevel=isTowerDifficulty() ? (targetRound>=65 ? Math.floor((targetRound-63)/2) : 0) : v('penance');
  const penanceLevel=Math.max(0,Math.min(towerPenaltyLevel,currentPenanceMax()));
  return {diff,targetRound,penanceLevel,penDmg:PEN_DMG[penanceLevel]||0};
}
function artifactEnergyRegenMultiplier(){
  const config=window.DPS_DATA?.ARTIFACT_DPS_CONFIG || {};
  const row=Number(config.energyRegenTraitRow || 79);
  const rate=Number(config.energyRegenRate || 2.5);
  return 1 + ((INV[row]||0) * rate) / 100;
}
function calculateArtifactDpsRaw(stats=computeStatsRaw()){
  const ctx=currentPenaltyContext();
  const enemyData=stats.enemyData || enemyRoundData(ctx.targetRound);
  const ownTarget={defenseReduce:stats.M12||0,pierce:0,hpReduce:stats.displayHR||0,shieldReduce:stats.displaySR||0};
  const ownDurability=targetDurabilityRemain(enemyData, ownTarget);
  const passengerDurability=targetDurabilityRemain(enemyData, COOP_PASSENGER_TARGET_EFFECTS);
  const dmgReduce=ctx.diff.dmg * (1 - ctx.penDmg / 100);
  const ownDps0=dps0(ownDurability.remain, enemyData.armor, ownTarget.defenseReduce, 0, dmgReduce);
  const passengerDps0=dps0(passengerDurability.remain, enemyData.armor, 0, 0, dmgReduce);
  const playerCount=battleEnemyCountMultiplier();
  const dps0Part=playerCount>1 ? (ownDps0 + passengerDps0 * (playerCount - 1)) / playerCount : ownDps0;
  const flowerMultiplier=on('flowerSkill3') ? 1.15 : 1;
  const adTdMultiplier=(1 + (stats.M4||0) / 100) * ((stats.M11||0) / 100);
  const critMultiplier=dps2(stats.M8||0, stats.M10||0, stats.M9||0, stats.M16||0, stats.M17||0, stats.M18||0, 1);
  const uaMultiplier=(1 - (stats.diff?.as||0) / 100) * (stats.M13||0) * artifactEnergyRegenMultiplier() * personalUaDtMultiplier();
  const displayMultiplier=contentDpsDisplayMultiplier(vs('diff'), ctx.targetRound, stats.displayHR||0, stats.displaySR||0);
  const artifactDps=dps0Part * flowerMultiplier * adTdMultiplier * critMultiplier * uaMultiplier * displayMultiplier;
  return {
    dps:Number.isFinite(artifactDps) ? artifactDps : 0,
    dps0:dps0Part,
    flowerMultiplier,
    adTdMultiplier,
    critMultiplier,
    uaMultiplier,
    displayMultiplier,
    playerCount,
    enemyData,
    penanceLevel:ctx.penanceLevel,
    round:ctx.targetRound
  };
}
const ARTIFACT_DPS_PREVIEW_IDS=['diff','penance','round','challengeTowerFloor','soloMode','coopMode','coopPlayers','team','prodArtifact','pbless',...EROSION_CONTROL_IDS];
function capturePreviewElementStates(ids){
  return ids.map(id=>{
    const el=$(id);
    return {
      el,
      checked:el && el.type==='checkbox' ? el.checked : null,
      value:el ? el.value : null,
      innerHTML:el && el.tagName==='SELECT' ? el.innerHTML : null,
      dataset:el ? {...el.dataset} : null
    };
  });
}
function restorePreviewElementStates(saved){
  saved.forEach(state=>{
    const el=state.el;
    if(!el) return;
    if(state.innerHTML!==null) el.innerHTML=state.innerHTML;
    if(state.checked!==null) el.checked=state.checked;
    else el.value=state.value;
    Object.keys(el.dataset).forEach(key=>{ delete el.dataset[key]; });
    Object.entries(state.dataset || {}).forEach(([key,value])=>{ el.dataset[key]=value; });
  });
}
function calculateArtifactDpsPreview(diffName, penanceLevel, round, options={}){
  const saved=capturePreviewElementStates(ARTIFACT_DPS_PREVIEW_IDS);
  try{
    const diffEl=$('diff');
    const penEl=$('penance');
    const roundEl=$('round');
    const towerFloorEl=$('challengeTowerFloor');
    const soloEl=$('soloMode');
    const coopEl=$('coopMode');
    const coopPlayersEl=$('coopPlayers');
    const teamEl=$('team');
    const artifactEl=$('prodArtifact');
    const battleMode=options.battleMode==='coop' ? 'coop' : 'solo';
    if(diffEl) diffEl.value=diffName;
    if(penEl){
      const maxForPreview=battleMode==='coop' ? COOP_DPS_TABLE_PENANCE_MAX : DPS_TABLE_PENANCE_MAX;
      const normalizedPenance=normalizePenanceValue(penanceLevel, maxForPreview);
      setSelectOptions(penEl, Array.from({length:SOLO_PENANCE_MAX+1}, (_,value)=>({value,label:penanceOptionLabel(value),selected:String(value)===normalizedPenance})));
      penEl.dataset.penanceMax=`artifact:${SOLO_PENANCE_MAX}`;
      penEl.value=normalizedPenance;
      penEl.dataset.penanceValue=normalizedPenance;
    }
    if(roundEl){
      const normalizedRound=normalizedRoundString(round);
      roundEl.value=normalizedRound;
      roundEl.dataset.roundValue=normalizedRound;
    }
    if(towerFloorEl){
      const normalizedTowerFloor=normalizedTowerFloorString(round);
      towerFloorEl.value=normalizedTowerFloor;
      towerFloorEl.dataset.challengeTowerFloorValue=normalizedTowerFloor;
    }
    if(battleMode==='solo'){
      if(soloEl) soloEl.value='ON';
      if(coopEl){
        setSelectOptions(coopEl, [{value:'OFF',label:'OFF',selected:true},{value:'ON',label:'ON'}]);
        coopEl.dataset.optionSignature='artifact:coop-mode-toggle';
        coopEl.value='OFF';
      }
      if(coopPlayersEl){
        setSelectOptions(coopPlayersEl, ['2','3'].map(playerCount=>({value:playerCount,label:playerCount})));
        coopPlayersEl.dataset.optionSignature='artifact:coop-players';
        coopPlayersEl.value=normalizeCoopPlayersValue(coopPlayersEl.value);
      }
    }else{
      const players=normalizeCoopPlayersValue(options.coopPlayers);
      if(soloEl) soloEl.value='OFF';
      if(coopEl){
        setSelectOptions(coopEl, [{value:'OFF',label:'OFF'},{value:'ON',label:'ON',selected:true}]);
        coopEl.dataset.optionSignature='artifact:coop-mode-toggle';
        coopEl.value='ON';
      }
      if(coopPlayersEl){
        setSelectOptions(coopPlayersEl, ['2','3'].map(playerCount=>({value:playerCount,label:playerCount,selected:playerCount===players})));
        coopPlayersEl.dataset.optionSignature='artifact:coop-players';
        coopPlayersEl.value=players;
      }
      if(teamEl) teamEl.value=players;
    }
    if(artifactEl) artifactEl.checked=true;
    EROSION_CONTROL_IDS.forEach(id=>{
      const el=$(id);
      if(!el) return;
      const stored=normalizeErosionControlValue(id, el.value || el.dataset.erosionValue || EROSION_CONTROL_DEFAULTS[id]);
      el.type='text';
      el.inputMode='numeric';
      el.value=stored;
      el.dataset.erosionValue=stored;
    });
    const stats=computeStatsRaw();
    return {...calculateArtifactDpsRaw(stats), baseDps:Number.isFinite(stats.M19) ? stats.M19 : 0};
  }catch(e){
    logAppError('[artifact DPS preview failed]', e);
    return {dps:0,baseDps:0,error:e};
  }finally{
    restorePreviewElementStates(saved);
  }
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
let spBankBudgetMode='manual';
function normalizeSpBankBudgetModeCalc(value){
  return String(value ?? '').trim()==='included' ? 'included' : 'manual';
}
function setSpBankBudgetMode(value){
  spBankBudgetMode=normalizeSpBankBudgetModeCalc(value);
}
function getSpBankBudgetMode(){
  return spBankBudgetMode;
}
function isSpBankBonusAlreadyInTotalSP(){
  return spBankBudgetMode==='included';
}
function normalizeSpBankApplyValue(value){
  if(typeof value==='boolean') return value ? '반영' : '미반영';
  const raw=String(value ?? '').trim();
  const upper=raw.toUpperCase();
  return (raw==='반영' || raw==='적용' || upper==='ON' || upper==='TRUE' || upper==='1' || upper==='YES') ? '반영' : '미반영';
}
function isSpBankApplied(){
  const select=(typeof $==='function' ? $('spBankApply') : (typeof document!=='undefined' ? document.getElementById('spBankApply') : null));
  if(select) return normalizeSpBankApplyValue(select.value)==='반영';
  return Math.max(0, Math.round(+(INV[SP_BANK_TRAIT_ROW]||0)))>=1;
}
function spBankApplyDisplayValue(value){
  return normalizeSpBankApplyValue(value)==='반영' ? 'ON' : 'OFF';
}
function syncSpBankDisplay(bankSP=null){
  const select=$('spBankApply');
  const applied=isSpBankApplied();
  const state=applied ? '반영' : '미반영';
  if(select && select.value!==state) select.value=state;
  const n=bankSP==null ? spBankRawBonus() : bankSP;
  setText('spBankStatusView', applied ? fullNumber(n) : '미적용');
}
function spBankRawBonus(){
  const bankLevel=INV[SP_BANK_TRAIT_ROW]||0;
  const appliedRound=Math.min(Math.max(0, effectiveTargetRound()), 290);
  const ticks=Math.floor(appliedRound/10);
  return bankLevel * 1000 * ticks;
}
function effectiveSP(){
  const bonus=(isSpBankApplied() && !isSpBankBonusAlreadyInTotalSP()) ? spBankRawBonus() : 0;
  return Math.max(0, v('sp') + bonus);
}
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
  if(id==='round'){
    const next=normalizedRoundString(el.value || el.dataset.roundValue || ROUND_INPUT_MIN);
    el.dataset.roundValue=next;
    if(String(el.value)!==next){ el.value=next; return true; }
    return false;
  }
  if(id==='challengeTowerFloor'){
    const next=normalizedTowerFloorString(el.value || el.dataset.challengeTowerFloorValue || TOWER_FLOOR_INPUT_MIN);
    el.dataset.challengeTowerFloorValue=next;
    if(String(el.value)!==next){ el.value=next; return true; }
    return false;
  }
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
  const c=normalizeRoundInput('challengeTowerFloor');
  return a || b || c;
}
function syncDifficultyTargetControls(){
  const roundEl=$('round');
  const towerEl=$('challengeTowerFloor');
  if(roundEl){
    const stored=normalizedRoundString(roundEl.value || roundEl.dataset.roundValue || ROUND_INPUT_MIN);
    roundEl.value=stored;
    roundEl.dataset.roundValue=stored;
  }
  if(towerEl){
    const stored=normalizedTowerFloorString(towerEl.value || towerEl.dataset.challengeTowerFloorValue || TOWER_FLOOR_INPUT_MIN);
    towerEl.value=stored;
    towerEl.dataset.challengeTowerFloorValue=stored;
  }
}
function resetDifficultyDependentFields(){
  syncPenanceOptions();
  syncDifficultyTargetControls();
  return false;
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
  const penValue=effectivePenanceValue();
  const roundInt=normalizedRoundNumber(targetRoundStoredValue());
  const floorInt=normalizedTowerFloorNumber(challengeTowerFloorStoredValue());
  const towerActive=isTowerDifficulty();
  const diff=selectedControlText(diffEl);
  const mode=isCoopMode() ? '협동' : '개인';
  const penance=penValue>0 ? `${penValue} 고행` : '고행 없음';
  const roundValue=towerActive ? floorInt : roundInt;
  const round=towerActive ? `${floorInt}층` : `${roundInt} 라운드`;
  const floor=`${floorInt}층`;
  const penanceShort=String(penValue);
  const roundShort=towerActive ? `${floorInt}층` : String(roundInt);
  return {mode, diff, penValue, roundValue, penance, round, floor, penanceShort, roundShort};
}
function updateDpsContextSummary(){
  const ctx=getDpsContextValues();
  setTextMap({
    dpsContextMode:ctx.mode,
    dpsContextDiff:ctx.diff,
    dpsContextPenance:ctx.penanceShort,
    dpsContextRound:ctx.roundShort
  });
}


/* ===== 09. DPS표 미리보기 계산 ===== */
const DPS_PREVIEW_IDS=['diff','penance','round','challengeTowerFloor','soloMode','coopMode','coopPlayers','team','pbless',...EROSION_CONTROL_IDS];
function computeDpsPreview(diffName, penanceLevel, round, options={}){
  const saved=capturePreviewElementStates(DPS_PREVIEW_IDS);
  try{
    const diffEl=$('diff');
    const penEl=$('penance');
    const roundEl=$('round');
    const towerFloorEl=$('challengeTowerFloor');
    const soloEl=$('soloMode');
    const coopEl=$('coopMode');
    const coopPlayersEl=$('coopPlayers');
    const teamEl=$('team');
    const battleMode=options.battleMode==='coop' ? 'coop' : 'solo';
    if(diffEl) diffEl.value=diffName;
    if(penEl){
      const maxForPreview=battleMode==='coop' ? COOP_DPS_TABLE_PENANCE_MAX : DPS_TABLE_PENANCE_MAX;
      const normalizedPenance=normalizePenanceValue(penanceLevel, maxForPreview);
      setSelectOptions(penEl, Array.from({length:SOLO_PENANCE_MAX+1}, (_,value)=>({value,label:penanceOptionLabel(value),selected:String(value)===normalizedPenance})));
      penEl.dataset.penanceMax=`preview:${SOLO_PENANCE_MAX}`;
      penEl.value=normalizedPenance;
      penEl.dataset.penanceValue=normalizedPenance;
    }
    if(roundEl){
      const normalizedRound=normalizedRoundString(round);
      roundEl.value=normalizedRound;
      roundEl.dataset.roundValue=normalizedRound;
    }
    if(towerFloorEl){
      const normalizedTowerFloor=normalizedTowerFloorString(round);
      towerFloorEl.value=normalizedTowerFloor;
      towerFloorEl.dataset.challengeTowerFloorValue=normalizedTowerFloor;
    }
    EROSION_CONTROL_IDS.forEach(id=>{
      const el=$(id);
      if(!el) return;
      const stored=normalizeErosionControlValue(id, el.value || el.dataset.erosionValue || EROSION_CONTROL_DEFAULTS[id]);
      el.type='text';
      el.inputMode='numeric';
      el.value=stored;
      el.dataset.erosionValue=stored;
    });
    if(battleMode==='solo'){
      if(soloEl) soloEl.value='ON';
      if(coopEl){
        setSelectOptions(coopEl, [{value:'OFF',label:'OFF',selected:true},{value:'ON',label:'ON'}]);
        coopEl.dataset.optionSignature='preview:coop-mode-toggle';
        coopEl.value='OFF';
      }
      if(coopPlayersEl){
        setSelectOptions(coopPlayersEl, ['2','3'].map(playerCount=>({value:playerCount,label:playerCount})));
        coopPlayersEl.dataset.optionSignature='preview:coop-players';
        coopPlayersEl.value=normalizeCoopPlayersValue(coopPlayersEl.value);
      }
    }else{
      const players=normalizeCoopPlayersValue(options.coopPlayers);
      if(soloEl) soloEl.value='OFF';
      if(coopEl){
        setSelectOptions(coopEl, [{value:'OFF',label:'OFF'},{value:'ON',label:'ON',selected:true}]);
        coopEl.dataset.optionSignature='preview:coop-mode-toggle';
        coopEl.value='ON';
      }
      if(coopPlayersEl){
        setSelectOptions(coopPlayersEl, ['2','3'].map(playerCount=>({value:playerCount,label:playerCount,selected:playerCount===players})));
        coopPlayersEl.dataset.optionSignature='preview:coop-players';
        coopPlayersEl.value=players;
      }
      if(teamEl) teamEl.value=players;
    }
    const s=computeStatsRaw();
    return Number.isFinite(s.M19) ? s.M19 : 0;
  }catch(e){
    logAppError('[DPS table preview failed]', e);
    return 0;
  }finally{
    restorePreviewElementStates(saved);
  }
}

/* ===== 10. 특성 효율 계산 / 한도 입력 표시 어댑터 ===== */
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
  const fallback=hasOwn(TRAIT_LIMIT_DEFAULTS,id) ? TRAIT_LIMIT_DEFAULTS[id] : 'ON';
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

/* ===== 11. 특성 자동 최적화 / UI 갱신 트리거 ===== */
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

/* ===== 12. 더제로 승단 점수 계산 / 엑셀 시트 파싱 ===== */
const ZERO_EXCEL_SHEET_NAME='더제로 승단';
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
  const f=Math.max(0,Math.min(90,Math.floor(Number(floor)||0)));
  let score=0;
  if(f>=50) score+=Math.floor((Math.min(f,68)-48)/2);
  if(f>=70) score+=Math.min(f,79)-69;
  if(f>=80) score+=(Math.min(f,90)-79)*2;
  return score;
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
function firstOwnedValue(row, keys, fallback, mapper=value=>value){
  if(!row || typeof row!=='object') return fallback;
  for(const key of keys){
    if(hasOwn(row,key)) return mapper(row[key]);
  }
  return fallback;
}
function zeroScoreFieldValue(row, kind){
  return firstOwnedValue(row, kind==='current' ? ['current','현재 일반'] : ['target','목표 일반'], undefined);
}
function zeroScoreHonorValue(row, kind){
  return firstOwnedValue(row, kind==='current' ? ['currentHonor','현재 명예'] : ['targetHonor','목표 명예'], '', normalizeZeroHonorValue);
}
function zeroScoreTowerHonorValue(row, kind){
  return firstOwnedValue(row, kind==='current' ? ['honorCurrent','현재 명예탑'] : ['honorTarget','목표 명예탑'],
    row?.type==='honorTower' ? zeroScoreFieldValue(row,kind) : undefined);
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

/* ===== 13. 계산·어댑터 공개 API ===== */
window.DPS_CALC=Object.freeze({
  normalizedIntegerRange,
  normalizedRoundNumber,
  normalizedRoundString,
  normalizedTowerFloorNumber,
  normalizedTowerFloorString,
  normalizeRuneChoiceType,
  normalizeRuneChoiceValue,
  normalizeRuneChoiceValues,
  normalizeOnOffValue,
  normalizeCoopPlayersValue,
  normalizeTeamCountValue,
  normalizePenanceValue,
  normalizePowerBlessRawValue,
  normalizeErosionControlValue,
  normalizeDecimalDisplayValue,
  calculateSkillDamageRows,
  calculateArtifactDpsRaw,
  calculateArtifactDpsPreview,
  chunkDpsTowerFloors,
  dpsTableMinDpsIntegerPart,
  normalizeDpsTableMinDpsValue,
  dpsTableRiskCompareValue,
  towerEnemySummaryItems,
  targetRoundStoredValue,
  challengeTowerFloorStoredValue,
  effectiveTargetRound,
  effectiveXpValue,
  isCoopMode,
  isCoopActive,
  coopPlayerCount,
  battleEnemyCountMultiplier,
  currentPenanceMax,
  shouldIgnorePenanceForDifficulty,
  penanceStoredValue,
  effectivePenanceValue,
  effectivePowerBlessValue,
  erosionStoredValue,
  computeStatsRaw,
  computeDpsPreview,
  nextCost,
  cumCost,
  rpCost,
  nextRpCost,
  resourceUsed,
  resourceKindForRow,
  resourceOwn,
  canAffordNext,
  setRowToAffordableValue,
  addOneIfAffordable,
  fillRowToBudget,
  enforceBudgets,
  buildTraitEfficiencyRecommendations,
  optimizeSP,
  zeroScoreRowCalculation,
  zeroScoreSummaryFromState,
  normalizeZeroScoreState,
  zeroScoreStateFromExcel
});
