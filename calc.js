/* ===== calc.js | 계산식·DOM 어댑터·엑셀 파싱 헬퍼 ===== */


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
const DPS_BATTLE_BASE_ROUND=300;
const DPS_TOWER_BASE_FLOOR=81;
const DPS_BURDEN_MULTIPLIER_MIN=0.000001;
const TOWER_ROUND_TIME_BONUS_MAX=8;
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
function normalizedShardNumber(value){
  return normalizedIntegerRange(value, 0, 9999, 0);
}
function shardValue(id){
  const el=$(id);
  return normalizedShardNumber(el ? el.value : 0);
}
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
const COOP_PASSENGER_DEFENSE_REDUCE_OPTIONS=[0,15,25,50,60];
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
function normalizeCoopPassengerDefenseReduceValue(value){
  const n=Math.round(Number(String(value ?? '').replace(/,/g,'').trim()));
  return COOP_PASSENGER_DEFENSE_REDUCE_OPTIONS.includes(n) ? String(n) : '0';
}
function coopPassengerDefenseReduceValue(id){
  return Number(normalizeCoopPassengerDefenseReduceValue(vs(id)));
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
function battleEnemyCountMultiplier(diffName=vs('diff')){return isCoopActive(diffName) ? coopPlayerCount() : 1;}
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



/* ===== 02. DPS표 / 스킬 데미지 / 도전의탑 표시값 ===== */
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
const BATTLE_DATA_MODES=Object.freeze({
  classic:{label:'클래식',unitTable:ENEMY_UNIT_TABLE,armorTable:ENEMY_ARMOR_TABLE,roundTimeTable:CLASSIC_ROUND_TIME_TABLE,maxRound:300,totalMode:'sum'},
  eternal:{label:'이터널',unitTable:ETERNAL_ENEMY_UNIT_TABLE,armorTable:ENEMY_ARMOR_TABLE,roundTimeTable:ETERNAL_ROUND_TIME_TABLE,maxRound:300,totalMode:'sum'},
  tower:{label:'클래식',unitTable:TOWER_UNIT_TABLE,armorTable:TOWER_ARMOR_TABLE,roundTimeTable:TOWER_TIME_TABLE,maxRound:90,totalMode:'current'}
});
const ROUND_FRUIT_PROFILES=Object.freeze([
  Object.freeze({key:'watermelon',label:'수박',enemyType:'거대',armorMultiplier:1,damageMultiplier:1}),
  Object.freeze({key:'pineapple',label:'파인애플',enemyType:'무속성',armorMultiplier:1,damageMultiplier:0.95}),
  Object.freeze({key:'pear',label:'배',enemyType:'중장갑',armorMultiplier:1,damageMultiplier:1}),
  Object.freeze({key:'strawberry',label:'딸기',enemyType:'경장갑',armorMultiplier:1,damageMultiplier:1}),
  Object.freeze({key:'grape',label:'포도',enemyType:'사이오닉',armorMultiplier:1.1,damageMultiplier:1})
]);
function enemyRoundFruitProfile(round){
  const index=((Math.round(Number(round)||0)%5)+5)%5;
  return ROUND_FRUIT_PROFILES[index] || ROUND_FRUIT_PROFILES[0];
}
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
function abyssAdPenalty(jewelResistance){
  if(!isAbyssDifficulty()) return 0;
  const base=difficultyName()==='Deep Abyss' ? 5 : 0.75;
  const stack=Math.max(0, v('erosionStack'));
  const override=Number(jewelResistance);
  const jewelRes=Math.max(0, Math.min(100, Number.isFinite(override) ? override : v('jewelErosionRes')));
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
function coopPassengerTargetEffects(player){
  return {
    defenseReduce:player===3 ? coopPassengerDefenseReduceValue('coopPassenger3Dr') : coopPassengerDefenseReduceValue('coopPassenger2Dr'),
    pierce:0,
    hpReduce:0,
    shieldReduce:0
  };
}
function coopPassengerTargetEffectsList(){
  const playerCount=battleEnemyCountMultiplier();
  if(playerCount<=1) return [];
  const targets=[coopPassengerTargetEffects(2)];
  if(playerCount>=3) targets.push(coopPassengerTargetEffects(3));
  return targets;
}
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
function battleTargetDps0Average(ownTarget,passengerTargets,enemyArmor,dmgReduce){
  const playerCount=battleEnemyCountMultiplier();
  const ownDps0=dps0(ownTarget.hpRemain, enemyArmor, ownTarget.defenseReduce, ownTarget.pierce, dmgReduce);
  if(playerCount<=1) return ownDps0;

  const targets=Array.isArray(passengerTargets) ? passengerTargets : [passengerTargets];
  let totalDps0=ownDps0;
  for(let i=0;i<playerCount-1;i++){
    const target=targets[i] || COOP_PASSENGER_TARGET_EFFECTS;
    totalDps0+=dps0(target.hpRemain, enemyArmor, target.defenseReduce, target.pierce, dmgReduce);
  }
  return totalDps0 / playerCount;
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
function battleDataModeKeyForDifficulty(diffName=vs('diff')){
  if(isTowerDifficulty(diffName)) return 'tower';
  return isAbyssDifficulty(diffName) ? 'eternal' : 'classic';
}
function battleDataModeForDifficulty(diffName=vs('diff')){
  return BATTLE_DATA_MODES[battleDataModeKeyForDifficulty(diffName)] || BATTLE_DATA_MODES.classic;
}
function enemyDisplayModeLabel(diffName=vs('diff')){return battleDataModeForDifficulty(diffName).label;}
function normalizedBattleRound(round, mode, fallback=1, min=1){
  const max=Number.isFinite(mode?.maxRound) ? mode.maxRound : 300;
  return Math.max(min, Math.min(max, Math.round(+round || fallback)));
}
function tableRoundTime(table, round, fallback=60){
  const row=lookupFloor(table, round);
  const value=row ? Number(row[1]) : fallback;
  return Number.isFinite(value) && value>0 ? value : fallback;
}
function towerRoundTimeBonus(){
  const tdRp=Math.max(0, +INV[129] || 0);
  const pierceRp=Math.max(0, +INV[130] || 0);
  const bonus=Math.floor((tdRp + pierceRp) * 0.2);
  return Math.max(0, Math.min(TOWER_ROUND_TIME_BONUS_MAX, bonus));
}
function enemyRoundTimeBonus(diffName=vs('diff')){
  return isTowerDifficulty(diffName) ? towerRoundTimeBonus() : 0;
}
function enemyRoundTime(round, diffName=vs('diff')){
  const modeKey=battleDataModeKeyForDifficulty(diffName);
  const mode=battleDataModeForDifficulty(diffName);
  const r=normalizedBattleRound(round, mode);
  const base=tableRoundTime(mode.roundTimeTable, r);
  const eternalExtra=modeKey==='eternal' && r<=250 ? 13 : 0;
  const finalTime=base + eternalExtra + enemyRoundTimeBonus(diffName);
  return Math.max(1,Math.round(finalTime*10)/10);
}
function battleModeLabel(){return isCoopMode() ? '협동' : '개인';}
function dpsContextModeLabel(diffName=vs('diff')){return `${battleModeLabel()}/${enemyDisplayModeLabel(diffName)}`;}
function enemyDataFromTables(mode, round, options={}){
  const r=Number(round) || 0;
  const armorRow=lookupFloor(mode.armorTable, r);
  const unitRow=lookupFloor(mode.unitTable, r);
  const fruit=enemyRoundFruitProfile(r);
  const baseArmor=armorRow && armorRow[0] <= r ? Number(armorRow[1]) || 0 : 0;
  const data={
    round:r,
    fruitKey:fruit.key,
    fruitLabel:fruit.label,
    enemyType:fruit.enemyType,
    armorBase:baseArmor,
    armor:baseArmor*fruit.armorMultiplier,
    damageMultiplier:fruit.damageMultiplier,
    count: unitRow ? unitRow[1] : 0,
    hp: unitRow ? unitRow[2] : 0,
    shield: unitRow ? unitRow[3] : 0
  };
  if(options.includeUnitRound) data.unitRound=unitRow ? unitRow[0] : r;
  return data;
}
function enemyRoundData(round, diffName=vs('diff')){
  const mode=battleDataModeForDifficulty(diffName);
  const r=normalizedBattleRound(round, mode, 0, 0);
  if(r<=0) return {round:0,fruitKey:'watermelon',fruitLabel:'수박',enemyType:'거대',armorBase:0,armor:0,damageMultiplier:1,unitRound:0,count:0,hp:0,shield:0};
  return enemyDataFromTables(mode, r, {includeUnitRound:true});
}
function enemyRoundCountTotal(round, diffName=vs('diff')){
  const mode=battleDataModeForDifficulty(diffName);
  if(mode.totalMode==='current') return enemyRoundData(round, diffName).count;
  const r=normalizedBattleRound(round, mode, 0, 0);
  if(r<=0) return 0;
  return mode.unitTable.reduce((total,row)=>total+(row[0]<=r ? (+row[1]||0) : 0),0);
}
function enemyRoundDisplayCount(round, diffName=vs('diff')){
  return enemyRoundData(round, diffName).count * battleEnemyCountMultiplier(diffName);
}
function enemyTotalDisplayCount(round, diffName=vs('diff')){
  return enemyRoundCountTotal(round, diffName) * battleEnemyCountMultiplier(diffName);
}
function enemyDisplayCountText(round){
  if(isTowerDifficulty()) return fullNumber(enemyRoundData(round).count);
  return `${fullNumber(enemyRoundDisplayCount(round))} / ${fullNumber(enemyTotalDisplayCount(round))}`;
}

function enemyBurdenDurability(enemyData, displayHR, displaySR){
  const hpReduce=Math.max(0, Number(displayHR)||0) / 100;
  const shieldReduce=Math.max(0, Number(displaySR)||0) / 100;
  const hpRemain=Math.max(0, (enemyData?.hp || 0) * (1 - hpReduce));
  const shieldRemain=Math.max(0, (enemyData?.shield || 0) * (1 - shieldReduce));
  return Math.max(1, hpRemain + shieldRemain);
}
function burdenMultiplier(base, current){
  if(!Number.isFinite(base) || !Number.isFinite(current) || current<=0) return 1;
  return Math.min(1, Math.max(DPS_BURDEN_MULTIPLIER_MIN, base / current));
}
function battleBurdenScore(round, displayHR, displaySR, diffName=vs('diff'), countMultiplier=battleEnemyCountMultiplier(diffName)){
  const enemy=enemyRoundData(round, diffName);
  if(!enemy.count) return 1;
  const count=Math.max(1, (enemy.count || 0) * Math.max(1, Number(countMultiplier)||1));
  const time=Math.max(1, enemyRoundTime(enemy.round, diffName));
  return Math.max(1, count * enemyBurdenDurability(enemy, displayHR, displaySR) / time);
}
function battleDpsDisplayMultiplier(diffName, round, displayHR, displaySR){
  const base=battleBurdenScore(DPS_BATTLE_BASE_ROUND, displayHR, displaySR, diffName, 1);
  const current=battleBurdenScore(round, displayHR, displaySR, diffName, battleEnemyCountMultiplier(diffName));
  return burdenMultiplier(base, current);
}
function towerFloorEnemyData(floor){
  const r=Math.max(1, Math.min(90, Math.round(+floor||1)));
  return enemyDataFromTables({armorTable:TOWER_ARMOR_TABLE,unitTable:TOWER_UNIT_TABLE}, r);
}
function towerBurdenScore(floor, displayHR, displaySR){
  const enemy=towerFloorEnemyData(floor);
  if(!enemy.count) return 1;
  const time=Math.max(1, enemyRoundTime(enemy.round, TOWER_DIFFICULTY_NAME));
  return Math.max(1, enemy.count * enemyBurdenDurability(enemy, displayHR, displaySR) / time);
}
function towerDpsDisplayMultiplier(floor, displayHR, displaySR){
  const r=Math.max(1, Math.min(90, Math.round(+floor||1)));
  if(r<=80) return 1;
  const base=towerBurdenScore(DPS_TOWER_BASE_FLOOR, displayHR, displaySR);
  const current=towerBurdenScore(r, displayHR, displaySR);
  return burdenMultiplier(base, current);
}
function contentDpsDisplayMultiplier(diffName, round, displayHR, displaySR){
  return difficultyName(diffName)===TOWER_DIFFICULTY_NAME
    ? towerDpsDisplayMultiplier(round, displayHR, displaySR)
    : battleDpsDisplayMultiplier(diffName, round, displayHR, displaySR);
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
  const septemberNormal=monthRuneCount('sep','normal');
  const septemberPlus=monthRuneCount('sep','plus');
  const count=10 + (INV[58]||0) + over + aprilNormal + (hasRuneOption('reinf5')?5:0);
  const chance=reinforceSuccessChance(count, true, INV[64]||0, INV[65]||0);
  const value=reinforceExpectedValue(chance, count, masterRate, INV[96]||0, repairAdd) + aprilPlus * 10;
  return {count,chance,value,septemberNormal,septemberPlus};
}
function upperOptionStats(){
  const flower1=on('flowerSkill1');
  const flower2=on('flowerSkill2');
  const flower3=on('flowerSkill3');
  const prod={
    nova:on('prodNova'), teratron:on('prodTeratron'), amon:on('prodAmon'), adun:on('prodAdun'),
    kerrigan:on('prodKerrigan'), overmind:on('prodOvermind'), narud:on('prodNarud'), artifact:on('prodArtifact')
  };
  const coralShard=shardValue('coralShard');
  const aiurShard=shardValue('aiurShard');
  const xerusShard=shardValue('xerusShard');
  const prodHiddenAD = (prod.nova && coralShard>=250 ? 10 : 0) + (prod.teratron && coralShard>=400 ? 10 : 0)
                     + (prod.amon && aiurShard>=250 ? 10 : 0) + (prod.adun && aiurShard>=400 ? 10 : 0)
                     + (prod.kerrigan && xerusShard>=250 ? 10 : 0) + (prod.overmind && xerusShard>=400 ? 10 : 0);
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

/* ----- 07-1. 유닛 보드 선택·저장·쥬얼 상태 ----- */
const DPS_BASE_UNIT_STORAGE_SEPARATOR=',';
function dpsBaseUnitList(){
  return Array.isArray(window.DPS_DATA?.DPS_BASE_UNITS) ? window.DPS_DATA.DPS_BASE_UNITS : [];
}
function dpsBaseUnitById(id){
  return dpsBaseUnitList().find(unit=>unit.id===id) || null;
}
function dpsBaseUnitAllId(){
  return window.DPS_DATA?.DPS_BASE_UNIT_ALL_ID || 'all';
}
function dpsBaseUnitSelectionLimit(){
  return 10;
}
function dpsBaseUnitLabel(unitOrId){
  const unit=typeof unitOrId==='string' ? dpsBaseUnitById(unitOrId) : unitOrId;
  return unit?.label || String(unitOrId || '');
}
function dpsBaseUnitGradeOrder(){
  return Array.isArray(window.DPS_DATA?.DPS_BASE_UNIT_GRADE_ORDER) ? window.DPS_DATA.DPS_BASE_UNIT_GRADE_ORDER : ['슈퍼히든','히든','레전드'];
}
function dpsBaseUnitRaceOrder(){
  return Array.isArray(window.DPS_DATA?.DPS_BASE_UNIT_RACE_ORDER) ? window.DPS_DATA.DPS_BASE_UNIT_RACE_ORDER : ['테바','테메','프바','프메','저그','중립','혼종'];
}
function dpsBaseUnitSettingSuffix(unitOrId){
  const unit=typeof unitOrId==='string' ? dpsBaseUnitById(unitOrId) : unitOrId;
  return String(unit?.id || unitOrId || '').replace(/^prod/,'').replace(/[^A-Za-z0-9_-]/g,'');
}
function dpsBaseUnitQuantityInputId(unitOrId){
  const unit=typeof unitOrId==='string' ? dpsBaseUnitById(unitOrId) : unitOrId;
  return unit?.quantityId || `dpsQty${dpsBaseUnitSettingSuffix(unit || unitOrId)}`;
}
function dpsBaseUnitEnhanceInputId(unitOrId){return `dpsEnhance${dpsBaseUnitSettingSuffix(unitOrId)}`;}
function dpsBaseUnitLimitBreakInputId(unitOrId){return `dpsLimitBreak${dpsBaseUnitSettingSuffix(unitOrId)}`;}
function dpsBaseUnitJewelInputId(unitOrId){return `dpsJewel${dpsBaseUnitSettingSuffix(unitOrId)}`;}
function dpsBaseUnitVoidPowerInputId(unitOrId){return `dpsVoidPower${dpsBaseUnitSettingSuffix(unitOrId)}`;}
function dpsBaseUnitHasQuantity(unitOrId){
  const unit=typeof unitOrId==='string' ? dpsBaseUnitById(unitOrId) : unitOrId;
  return !!unit?.quantityEnabled;
}
function dpsBaseUnitQuantityIds(){
  return dpsBaseUnitList().filter(dpsBaseUnitHasQuantity).map(unit=>dpsBaseUnitQuantityInputId(unit));
}
function dpsBaseUnitSettingIds(){
  return dpsBaseUnitList().flatMap(unit=>[
    dpsBaseUnitEnhanceInputId(unit),dpsBaseUnitLimitBreakInputId(unit),dpsBaseUnitJewelInputId(unit),dpsBaseUnitVoidPowerInputId(unit)
  ]);
}
function dpsJewelNames(){
  return Array.isArray(window.DPS_DATA?.DPS_JEWEL_NAMES) ? window.DPS_DATA.DPS_JEWEL_NAMES : [];
}
function normalizeDpsJewelName(value){
  const name=String(value ?? '').trim();
  return dpsJewelNames().includes(name) ? name : '';
}
function normalizeDpsJewelOption(key,value){
  const options=window.DPS_DATA?.DPS_JEWEL_INPUT_OPTIONS?.[key];
  if(!Array.isArray(options) || !options.length) return key==='mythic' ? 'N' : 0;
  if(key==='mythic') return options.includes(String(value)) ? String(value) : 'N';
  const number=Number(value);
  return options.includes(number) ? number : Number(options[0]) || 0;
}
function normalizeDpsJewelSetting(value){
  const source=value && typeof value==='object' ? value : {};
  return {
    ad:normalizeDpsJewelOption('ad',source.ad),
    as:normalizeDpsJewelOption('as',source.as),
    td:normalizeDpsJewelOption('td',source.td),
    ua:normalizeDpsJewelOption('ua',source.ua),
    enhance:normalizeDpsJewelOption('enhance',source.enhance),
    mythic:normalizeDpsJewelOption('mythic',source.mythic)
  };
}
function normalizeDpsJewelSettings(value){
  let source=value;
  if(typeof source==='string'){
    try{source=JSON.parse(source || '{}');}catch(_error){source={};}
  }
  if(!source || typeof source!=='object' || Array.isArray(source)) source={};
  return Object.fromEntries(dpsJewelNames().map(name=>[name,normalizeDpsJewelSetting(source[name])]));
}
function serializeDpsJewelSettings(value){
  return JSON.stringify(normalizeDpsJewelSettings(value));
}
function dpsJewelSettingsObject(){
  const el=typeof $==='function' ? $('dpsJewelSettings') : null;
  return normalizeDpsJewelSettings(el?.value || '{}');
}
function dpsJewelFinalStats(name,settings=dpsJewelSettingsObject()){
  const jewelName=normalizeDpsJewelName(name);
  if(!jewelName) return {name:'',ad:0,as:0,td:0,ua:0,resist:0,enhance:0,mythic:'N'};
  const input=normalizeDpsJewelSetting(settings?.[jewelName]);
  const effectKey=input.mythic==='Y' ? 'mythic' : 'legendary';
  const effect=window.DPS_DATA?.DPS_JEWEL_EFFECTS?.[jewelName]?.[effectKey] || {};
  const ignoresBase=jewelName==='크리소베릴';
  const enhanceTd=input.enhance*(jewelName==='올리빈' ? 6 : 2);
  return {
    name:jewelName,
    ad:(ignoresBase ? 0 : input.ad)+(Number(effect.ad)||0),
    as:(ignoresBase ? 0 : input.as)+(Number(effect.as)||0),
    td:(ignoresBase ? 0 : input.td)+(Number(effect.td)||0)+enhanceTd,
    ua:(ignoresBase ? 0 : input.ua)+(Number(effect.ua)||0),
    resist:30,
    enhance:input.enhance,
    mythic:input.mythic
  };
}
function dpsNormalJewelNames(){
  const names=window.DPS_DATA?.DPS_NORMAL_JEWEL_NAMES;
  return Array.isArray(names) ? names : Array.from({length:4},(_,index)=>`일반 쥬얼 ${index+1}`);
}
function normalizeDpsNormalJewelName(value){
  const name=String(value ?? '').trim();
  return dpsNormalJewelNames().includes(name) ? name : '';
}
function normalizeDpsNormalJewelSetting(value){
  const source=value && typeof value==='object' ? value : {};
  return {
    ad:normalizeDpsJewelOption('ad',source.ad),
    as:normalizeDpsJewelOption('as',source.as),
    td:normalizeDpsJewelOption('td',source.td),
    ua:normalizeDpsJewelOption('ua',source.ua)
  };
}
function normalizeDpsNormalJewelSettings(value){
  let source=value;
  if(typeof source==='string'){
    try{source=JSON.parse(source || '{}');}catch(_error){source={};}
  }
  if(!source || typeof source!=='object' || Array.isArray(source)) source={};
  return Object.fromEntries(dpsNormalJewelNames().map(name=>[name,normalizeDpsNormalJewelSetting(source[name])]));
}
function serializeDpsNormalJewelSettings(value){return JSON.stringify(normalizeDpsNormalJewelSettings(value));}
function dpsNormalJewelSettingsObject(){
  const el=typeof $==='function' ? $('dpsNormalJewelSettings') : null;
  return normalizeDpsNormalJewelSettings(el?.value || '{}');
}
function dpsNormalJewelFinalStats(name,settings=dpsNormalJewelSettingsObject()){
  const jewelName=normalizeDpsNormalJewelName(name);
  if(!jewelName) return {name:'',ad:0,as:0,td:0,ua:0,resist:0,mythic:'N',normal:true};
  const input=normalizeDpsNormalJewelSetting(settings?.[jewelName]);
  return {name:jewelName,ad:input.ad,as:input.as,td:input.td,ua:input.ua,resist:30,mythic:'N',normal:true};
}
function dpsBaseUnitAllowsNormalJewels(unitOrId){
  const unit=typeof unitOrId==='string' ? dpsBaseUnitById(unitOrId) : unitOrId;
  return !!unit && unit.grade!=='슈퍼히든';
}
function normalizeDpsNormalJewelAssignments(value){
  let source=value;
  if(typeof source==='string'){
    try{source=JSON.parse(source || '{}');}catch(_error){source={};}
  }
  if(!source || typeof source!=='object' || Array.isArray(source)) source={};
  const validUnits=new Set(dpsBaseUnitList().filter(dpsBaseUnitAllowsNormalJewels).map(unit=>unit.id));
  const used=new Set();
  const out={};
  Object.entries(source).forEach(([unitId,items])=>{
    if(!validUnits.has(unitId) || !Array.isArray(items)) return;
    const normalized=items.slice(0,4).map(value=>{
      const name=normalizeDpsNormalJewelName(value);
      if(!name || used.has(name)) return '';
      used.add(name);
      return name;
    });
    while(normalized.length && !normalized[normalized.length-1]) normalized.pop();
    if(normalized.length) out[unitId]=normalized;
  });
  return out;
}
function serializeDpsNormalJewelAssignments(value){return JSON.stringify(normalizeDpsNormalJewelAssignments(value));}
function dpsNormalJewelAssignmentsObject(){
  const el=typeof $==='function' ? $('dpsNormalJewelAssignments') : null;
  return normalizeDpsNormalJewelAssignments(el?.value || '{}');
}
function dpsBaseUnitNormalJewelSlotCount(unitOrId){
  const unit=typeof unitOrId==='string' ? dpsBaseUnitById(unitOrId) : unitOrId;
  if(!dpsBaseUnitAllowsNormalJewels(unit)) return 0;
  return 4;
}
function dpsBaseUnitNormalJewelCapacity(unitOrId){
  const unit=typeof unitOrId==='string' ? dpsBaseUnitById(unitOrId) : unitOrId;
  if(!dpsBaseUnitAllowsNormalJewels(unit)) return 0;
  const quantity=dpsBaseUnitHasQuantity(unit) ? Math.max(0,dpsBaseUnitQuantity(unit)) : 1;
  return Math.max(0,quantity-(dpsBaseUnitJewelName(unit) ? 1 : 0));
}
function dpsBaseUnitNormalJewelNames(unitOrId){
  const unit=typeof unitOrId==='string' ? dpsBaseUnitById(unitOrId) : unitOrId;
  if(!dpsBaseUnitAllowsNormalJewels(unit)) return [];
  const assignments=dpsNormalJewelAssignmentsObject();
  return (assignments[unit.id] || []).slice(0,dpsBaseUnitNormalJewelSlotCount(unit)).map(normalizeDpsNormalJewelName);
}
function dpsBaseUnitJewelName(unitOrId){
  const el=typeof $==='function' ? $(dpsBaseUnitJewelInputId(unitOrId)) : null;
  return normalizeDpsJewelName(el?.value || '');
}
function dpsBaseUnitJewelGroups(unitOrId,quantityOverride){
  const unit=typeof unitOrId==='string' ? dpsBaseUnitById(unitOrId) : unitOrId;
  if(!unit) return [];
  const quantity=Math.max(1,Number(quantityOverride)||dpsBaseUnitQuantity(unit)||1);
  const namedJewelName=dpsBaseUnitJewelName(unit);
  const groups=[];
  if(namedJewelName) groups.push({count:1,name:namedJewelName,stats:dpsJewelFinalStats(namedJewelName),type:'named'});
  const normalSettings=dpsNormalJewelSettingsObject();
  dpsBaseUnitNormalJewelNames(unit).filter(Boolean).slice(0,Math.max(0,quantity-groups.length)).forEach(name=>{
    groups.push({count:1,name,stats:dpsNormalJewelFinalStats(name,normalSettings),type:'normal'});
  });
  const bareCount=Math.max(0,quantity-groups.length);
  if(bareCount>0) groups.push({count:bareCount,name:'',stats:dpsJewelFinalStats(''),type:'none'});
  return groups;
}
function dpsBaseUnitJewelStats(unitOrId){
  return dpsJewelFinalStats(dpsBaseUnitJewelName(unitOrId));
}
function dpsBaseUnitQuantityLimit(){
  return vs('coopMode')==='ON' ? 16 : 8;
}
function normalizeDpsBaseUnitQuantityValue(value){
  const limit=dpsBaseUnitQuantityLimit();
  return String(Math.max(0, Math.min(limit, Math.round(Number(value) || 0))));
}
function normalizeDpsBaseUnitEnhanceValue(value, fallback=0){
  const raw=String(value ?? '').replace(/,/g,'').trim();
  const parsed=raw==='' ? Number(fallback) : Number(raw);
  const clamped=Math.max(0, Math.min(1000, Number.isFinite(parsed) ? parsed : Number(fallback)||0));
  return String(Math.round(clamped*100)/100);
}
function normalizeDpsBaseUnitLimitBreakValue(value){return String(normalizedIntegerRange(value,0,6,0));}
function normalizeDpsBaseUnitVoidPowerValue(value){return normalizeOnOffValue(value,'OFF');}
function dpsBaseUnitQuantity(unitOrId){
  const unit=typeof unitOrId==='string' ? dpsBaseUnitById(unitOrId) : unitOrId;
  if(!dpsBaseUnitHasQuantity(unit)) return 1;
  const el=typeof $==='function' ? $(dpsBaseUnitQuantityInputId(unit)) : null;
  return Number(normalizeDpsBaseUnitQuantityValue(el?.value ?? 0));
}
function dpsBaseUnitEnhanceValue(unitOrId){
  const el=typeof $==='function' ? $(dpsBaseUnitEnhanceInputId(unitOrId)) : null;
  return Number(normalizeDpsBaseUnitEnhanceValue(el?.value, 0));
}
function dpsBaseUnitLimitBreakValue(unitOrId){
  const el=typeof $==='function' ? $(dpsBaseUnitLimitBreakInputId(unitOrId)) : null;
  return Number(normalizeDpsBaseUnitLimitBreakValue(el?.value));
}
function dpsBaseUnitVoidPowerOn(unitOrId){
  const el=typeof $==='function' ? $(dpsBaseUnitVoidPowerInputId(unitOrId)) : null;
  return normalizeDpsBaseUnitVoidPowerValue(el?.value)==='ON';
}
function dpsBaseUnitIdSet(){
  return new Set(dpsBaseUnitList().map(unit=>unit.id));
}
function normalizeDpsBaseUnitsValue(value){
  const allId=dpsBaseUnitAllId();
  const validIds=dpsBaseUnitIdSet();
  const limit=dpsBaseUnitSelectionLimit();
  const source=Array.isArray(value) ? value : String(value ?? '').split(DPS_BASE_UNIT_STORAGE_SEPARATOR);
  const ids=[];
  source.forEach(item=>{
    const id=String(item ?? '').trim();
    if(!id || ids.includes(id) || ids.length>=limit) return;
    if(id===allId){
      dpsBaseUnitList().slice(0,limit).forEach(unit=>{
        if(!ids.includes(unit.id)) ids.push(unit.id);
      });
      return;
    }
    if(validIds.has(id)) ids.push(id);
  });
  return ids.join(DPS_BASE_UNIT_STORAGE_SEPARATOR);
}
function dpsBaseUnitSelectionIds(value){
  const normalized=normalizeDpsBaseUnitsValue(value);
  return normalized ? normalized.split(DPS_BASE_UNIT_STORAGE_SEPARATOR).filter(Boolean) : [];
}
function dpsBaseUnitStorageValue(){
  const el=typeof $==='function' ? $('dpsBaseUnits') : null;
  return normalizeDpsBaseUnitsValue(el ? el.value : '');
}
function selectedDpsBaseUnits(value=dpsBaseUnitStorageValue()){
  const ids=dpsBaseUnitSelectionIds(value);
  const units=dpsBaseUnitList();
  if(ids.includes(dpsBaseUnitAllId())) return units.slice();
  const idSet=new Set(ids);
  return units.filter(unit=>idSet.has(unit.id));
}

/* ----- 07-2. 종족 업그레이드·방관·필요 DPS ----- */
function nonNegativeNumber(value){
  return Math.max(0, Number(value) || 0);
}
function totalDpsPierce(...values){
  return values.reduce((sum,value)=>sum + nonNegativeNumber(value), 0);
}
function dpsBaseUnitPierceBonus(unit){
  return nonNegativeNumber(unit?.armorPierceBonus);
}
const DPS_BASE_UNIT_RACE_SHARD_RULES=Object.freeze({
  '테란 바이오닉':Object.freeze({inputId:'coralShard',minimum:2500}),
  '테란 메카닉':Object.freeze({inputId:'coralShard',minimum:3000}),
  '플토 바이오닉':Object.freeze({inputId:'aiurShard',minimum:2500}),
  '플토 메카닉':Object.freeze({inputId:'aiurShard',minimum:3000}),
  '저그':Object.freeze({inputId:'xerusShard',minimum:2500}),
  '중립':Object.freeze({inputId:'xerusShard',minimum:3000})
});
function dpsBaseUnitSingleRaceUpgradeLevel(race){
  const normalizedRace=String(race||'').trim();
  const optionLevel=hasRuneOption('raceAll1') ? 1 : (vs('raceOpt')===normalizedRace ? 1 : 0);
  const shardRule=DPS_BASE_UNIT_RACE_SHARD_RULES[normalizedRace];
  const shardLevel=shardRule && shardValue(shardRule.inputId)>=shardRule.minimum ? 1 : 0;
  return optionLevel+shardLevel;
}
function dpsBaseUnitUpgradeLevel(unit){
  const races=String(unit?.upgradeRace||'').split('&').map(value=>value.trim()).filter(Boolean);
  return races.reduce((sum,race)=>sum+dpsBaseUnitSingleRaceUpgradeLevel(race),0);
}
function dpsBaseUnitWeaponAttack(unit){
  const tiers=Array.isArray(unit?.weaponAttackTiers) && unit.weaponAttackTiers.length
    ? unit.weaponAttackTiers
    : [nonNegativeNumber(unit?.weaponAttack)];
  const tierIndex=Math.max(0,Math.min(dpsBaseUnitUpgradeLevel(unit),tiers.length-1));
  let attack=nonNegativeNumber(tiers[tierIndex]);
  return attack;
}
const DPS_BASE_UNIT_ENEMY_BUFF_DIFFICULTIES=new Set(['Hell','Inferno','Lunatic','Holic','Epic','Ultimate','Impossible','The Final','Hall Of Fame','Abyss road','Deep Abyss','도전의 탑']);
function dpsBaseUnitEnemyProtectionFactor(diffName=vs('diff')){
  if(!DPS_BASE_UNIT_ENEMY_BUFF_DIFFICULTIES.has(difficultyName(diffName))) return 1;
  const rawSuperShieldFactor=1-0.667*30/(30+35);
  const superShieldFactor=hasRuneOption('shieldImmune') ? 1 : Math.round(rawSuperShieldFactor*1000)/1000;
  const stealthFactor=0.999;
  return Math.max(0.000001,Math.min(superShieldFactor,stealthFactor));
}
function dpsBaseUnitExpectationMultiplier(diffName=vs('diff')){
  const fogMultiplier=on('flowerSkill3') ? 1.075 : 1;
  const modeMultiplier=battleDataModeKeyForDifficulty(diffName)==='eternal' ? 0.8 : 1;
  const contentMultiplier=isTowerDifficulty(diffName) ? 0.9 : 0.8;
  return fogMultiplier*modeMultiplier*contentMultiplier;
}
function dpsBaseUnitRequiredDurability(enemyData,displayHR,displaySR){
  const hp=Math.max(0,Number(enemyData?.hp)||0);
  const shield=Math.max(0,Number(enemyData?.shield)||0);
  const total=hp+shield;
  if(total<=0) return 1;
  const hpRatio=hp/total;
  const shieldRatio=shield/total;
  const weightedHpReduce=Math.max(0,Number(displayHR)||0)*hpRatio;
  const weightedShieldReduce=Math.max(0,Number(displaySR)||0)*shieldRatio;
  return Math.max(1,total*(1-(weightedHpReduce+weightedShieldReduce)/100));
}
function dpsBaseUnitPlayerCount(diffName=vs('diff')){
  return isCoopActive(diffName) ? 3 : 1;
}
function dpsBaseUnitAverageDefenseMultiplier(enemyArmor,ownDefenseReduce,dmgReduce,diffName=vs('diff')){
  const ownDefenseReduceValue=Number(ownDefenseReduce);
  const ownMultiplier=dps0(
    1,
    enemyArmor,
    Number.isFinite(ownDefenseReduceValue) ? ownDefenseReduceValue : 0,
    0,
    dmgReduce
  );
  const playerCount=dpsBaseUnitPlayerCount(diffName);
  if(playerCount===1) return ownMultiplier;
  const passengerTotal=[2,3].reduce((sum,player)=>{
    const target=coopPassengerTargetEffects(player);
    return sum+dps0(1,enemyArmor,target.defenseReduce,0,dmgReduce);
  },0);
  return (ownMultiplier+passengerTotal)/playerCount;
}
function dpsBaseUnitRequiredDps({enemyData,defenseReduce,dmgReduce,round,displayHR,displaySR,diffName=vs('diff')}){
  const playerCount=dpsBaseUnitPlayerCount(diffName);
  const count=Math.max(0,Number(enemyData?.count)||0)*playerCount;
  const durability=dpsBaseUnitRequiredDurability(enemyData,displayHR,displaySR);
  const defenseMultiplier=dpsBaseUnitAverageDefenseMultiplier(
    Number(enemyData?.armor)||0,
    defenseReduce,
    dmgReduce,
    diffName
  );
  const clearTime=enemyRoundTime(round,diffName);
  const protectionFactor=dpsBaseUnitEnemyProtectionFactor(diffName);
  if(count<=0 || defenseMultiplier<=0 || clearTime<=0) return 0;
  return count*durability/defenseMultiplier/clearTime/protectionFactor;
}
/* ----- 07-3. 유닛별 강화·공속·최종 DPS ----- */
const DPS_BASE_UNIT_LIMIT_BREAK_STATS=Object.freeze([
  Object.freeze({ad:0,ua:0,td:0}),Object.freeze({ad:50,ua:0,td:0}),Object.freeze({ad:100,ua:0,td:0}),
  Object.freeze({ad:175,ua:10,td:0}),Object.freeze({ad:300,ua:20,td:0}),Object.freeze({ad:500,ua:30,td:0}),
  Object.freeze({ad:500,ua:30,td:20})
]);
function dpsBaseUnitLimitBreakStats(unitOrId){
  return DPS_BASE_UNIT_LIMIT_BREAK_STATS[dpsBaseUnitLimitBreakValue(unitOrId)] || DPS_BASE_UNIT_LIMIT_BREAK_STATS[0];
}
function dpsBaseUnitRaceCritBonus(unit, round){
  const table=window.DPS_DATA?.DPS_BASE_UNIT_RACE_CRIT_BONUS || {};
  const key=unit?.raceCritKey || unit?.raceGroup || '';
  const values=table[key];
  if(!Array.isArray(values) || !values.length) return 0;
  const index=((Math.round(Number(round)||0)%5)+5)%5;
  return Number(values[index]) || 0;
}
function dpsBaseUnitUniqueAdBonus(unit,totalQuantity){
  if(!checkboxOn('unitUniqueBuff', true) || unit?.productionUnit) return 0;
  const enhanceStats=unitEnhanceStats();
  const quantityLimit=1+(enhanceStats.septemberNormal ?? 0);
  if(Math.max(1,Number(totalQuantity)||1)>quantityLimit) return 0;
  return 30+10*(enhanceStats.septemberPlus ?? 0);
}
function dpsBaseUnitPrivateAd(unit, quantity, jewelStats=dpsBaseUnitJewelStats(unit), jewelName=dpsBaseUnitJewelName(unit)){
  const limitBreak=dpsBaseUnitLimitBreakStats(unit);
  const enhance=dpsBaseUnitEnhanceValue(unit);
  const uniqueBuff=dpsBaseUnitUniqueAdBonus(unit,quantity);
  const duplicatePenalty=Math.max(Math.max(1,Number(quantity)||1)-8,0)*10;
  const jewelStackAd=jewelName==='라피스' ? 200 : (jewelName==='헬리오도르' ? -200 : 0);
  return UNIT_GRADE_AD.S + 11*5 + uniqueBuff + limitBreak.ad + enhance + (Number(jewelStats?.ad)||0) + jewelStackAd
    + nonNegativeNumber(unit?.killCountAdBonus) - duplicatePenalty - abyssAdPenalty(jewelStats?.resist);
}
function dpsBaseUnitAttackRate(unit, context){
  const weaponSpeed=Number(unit?.weaponSpeed) || 0;
  const targetCount=Number(unit?.targetCount) || 0;
  const attackCount=Number(unit?.attackCount) || 0;
  if(weaponSpeed<=0 || targetCount<=0 || attackCount<=0) return {rate:0,cooldown:0};
  const limitBreak=dpsBaseUnitLimitBreakStats(unit);
  const difficultySlow=Math.max(0.000001,1-(Number(context?.difficultyAs)||0)/100);
  const ua=Math.max(0.000001,Number(context?.ua)||1);
  const dt=Math.max(0.000001,Number(context?.dt)||1);
  const jewelStats=context?.jewelStats || dpsBaseUnitJewelStats(unit);
  const privateUa=(1+limitBreak.ua/100)*(1+(Number(jewelStats?.ua)||0)/100);
  const voidPowerAs=dpsBaseUnitVoidPowerOn(unit) ? 50 : 0;
  const speedStat=(Number(context?.attackSpeed)||0)+(Number(jewelStats?.as)||0);
  const flowerAs=Number(context?.flowerAttackSpeed)||0;
  const uniqueSpeed=Math.max(0.000001,1+(Number(unit?.attackSpeedMultiplier)||0));
  const speedMultiplier=Math.max(0.000001,(1+(speedStat+flowerAs+voidPowerAs)/100)*difficultySlow*ua*dt*privateUa*uniqueSpeed);
  const adjustedCooldown=Math.round((weaponSpeed/speedMultiplier)*10000)/10000;
  const asLimit=Math.max(0,Number(unit?.asLimit)||0);
  const limitMultiplier=Math.max(0.000001,difficultySlow*ua*dt*privateUa);
  const limitCooldown=asLimit>0 ? asLimit/limitMultiplier : 0;
  const cooldown=Math.max(0.0625,adjustedCooldown,limitCooldown);
  return {rate:targetCount*attackCount/Math.max(0.000001,cooldown),cooldown};
}
function dpsBaseUnitSingleDpsParts(unit,context,jewelStats,jewelName=''){
  const limitBreak=dpsBaseUnitLimitBreakStats(unit);
  const unitExcelPierce=totalDpsPierce(context.basePierceBonus,context.rpPierce,context.unitPierceBonus);
  const privateAd=dpsBaseUnitPrivateAd(unit,context.totalQuantity,jewelStats,jewelName);
  const adTdMultiplier=(1+(context.globalAd+privateAd)/100)*((context.M11+limitBreak.td+(Number(jewelStats?.td)||0))/100);
  const raceCritBonus=dpsBaseUnitRaceCritBonus(unit,context.targetRound);
  const unitCd=context.M9*(1+raceCritBonus);
  const critMultiplier=dps2(context.M8,context.M10,unitCd,context.M16,context.M17,context.M18,unit?.critFormula==='방사' ? 1 : 0);
  const attackRate=dpsBaseUnitAttackRate(unit,{attackSpeed:context.M7,flowerAttackSpeed:context.flowerAttackSpeed,difficultyAs:context.difficultyAs,ua:context.M13,dt:context.dt,jewelStats});
  const noPierceDps0=dps0(1,context.enemyArmor,context.M12,0,100);
  const pierceDps0=dps0(1,context.enemyArmor,context.M12,unitExcelPierce,100);
  const armorPierceMultiplier=noPierceDps0>0 ? pierceDps0/noPierceDps0 : 1;
  const uniqueDpsMultiplier=1+(Number(unit?.dpsMultiplier)||0);
  const rawM19=context.weaponAttack*adTdMultiplier*critMultiplier*attackRate.rate*armorPierceMultiplier*uniqueDpsMultiplier;
  return {rawM19,AB3:armorPierceMultiplier,AB4:adTdMultiplier,AB5:critMultiplier,AB6:attackRate.rate,excelPierce:unitExcelPierce,raceCritBonus,finalCooldown:attackRate.cooldown,jewelName,jewelStats};
}
/* ----- 07-4. 메인 스탯 및 DPS 산출 ----- */
function computeStatsRaw(){
  const autoEP=syncAutoEP();
  const penaltyContext=currentPenaltyContext();
  const {diff,targetRound,penanceLevel}=penaltyContext;
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
  const specEnemyDamageRate=diff.dmg*(1-penDmg/100);
  const requiredEnemyDamageRate=specEnemyDamageRate*(Number(enemyData.damageMultiplier)||1);
  const displaySR = sumStat('SR') + enchantAt(4).sr + additionalStats.sr;
  const displayHR = enchantAt(5).hr + additionalStats.hr;
  const basePierceBonus = checkboxOn('basePierceBuff') ? 10 : 0;
  const rpPierce = rpPierceBonus();
  const excelPierce=totalDpsPierce(basePierceBonus,rpPierce);
  const ownTargetEffects={
    defenseReduce:M12_dr,
    pierce:excelPierce,
    hpReduce:displayHR,
    shieldReduce:displaySR
  };
  const ownDurability=targetDurabilityRemain(enemyData,ownTargetEffects);
  const passengerTargets=coopPassengerTargetEffectsList().map(target=>{
    const durability=targetDurabilityRemain(enemyData,target);
    return {...target,hpRemain:durability.remain};
  });
  const hpRatio=ownDurability.hpRatio;
  const shieldRatio=ownDurability.shieldRatio;
  const hpRemain=ownDurability.remain;
  const M12=M12_dr;
  const actualM12=actualDrWithPierce(M12_dr,excelPierce);
  const specEnemyArmor=Number(enemyData.armorBase)||0;
  const AB3=battleTargetDps0Average(
    {...ownTargetEffects,hpRemain},
    passengerTargets,
    specEnemyArmor,
    specEnemyDamageRate
  )*upperStats.dps0Mul;
  const AB4=(1+M4/100)*(M11/100);
  const AB5=dps2(M8,M10,M9,M16,M17,M18,0);
  const dt=personalUaDtMultiplier();
  const gradeAs=UNIT_GRADE_AS[activeUnitGrade()] ?? 0;
  const AB6=(1+(M7+upperStats.actualAs+gradeAs)/100)*(1-diff.as/100)*M13*dt;
  const rawM19=AB3*AB4*AB5*AB6;
  const displayMultiplier=contentDpsDisplayMultiplier(vs('diff'),targetRound,displayHR,displaySR);
  const roundTime=enemyRoundTime(targetRound);
  const M19=rawM19*displayMultiplier;

  const dpsBaseUnitSelection=dpsBaseUnitStorageValue();
  const dpsBaseUnits=selectedDpsBaseUnits(dpsBaseUnitSelection);
  const dpsBaseUnitResults=dpsBaseUnits.map(unit=>{
    const baseWeaponAttack=nonNegativeNumber(unit.weaponAttack);
    const weaponAttack=dpsBaseUnitWeaponAttack(unit);
    const unitPierceBonus=dpsBaseUnitPierceBonus(unit);
    const quantity=Math.max(1,dpsBaseUnitQuantity(unit));
    const quantityMultiplier=dpsBaseUnitHasQuantity(unit) ? quantity : 1;
    const unitMeta={
      unitId:unit.id,
      quantity:quantityMultiplier,
      baseWeaponAttack,
      weaponAttack,
      weaponUpgradeLevel:dpsBaseUnitUpgradeLevel(unit),
      weaponSpeed:Number(unit.weaponSpeed)||0,
      asLimit:Number(unit.asLimit)||0,
      targetCount:Number(unit.targetCount)||0,
      attackCount:Number(unit.attackCount)||0
    };
    const jewelName=dpsBaseUnitJewelName(unit);
    const jewelStats=dpsJewelFinalStats(jewelName);
    const groups=dpsBaseUnitJewelGroups(unit,quantityMultiplier);
    const normalJewelNames=groups.filter(group=>group.type==='normal').map(group=>group.name);
    const context={basePierceBonus,rpPierce,unitPierceBonus,totalQuantity:quantityMultiplier,globalAd:M4-unitADBonus,M11,M8,M10,M9,M16,M17,M18,M7,M13,dt,flowerAttackSpeed:upperStats.actualAs,difficultyAs:diff.as,enemyArmor:enemyData.armor,M12:M12_dr,targetRound,weaponAttack};
    const groupResults=groups.map(group=>({...group,...dpsBaseUnitSingleDpsParts(unit,context,group.stats,group.type==='named' ? group.name : '')}));
    const unitRawM19=groupResults.reduce((sum,group)=>sum+group.rawM19*group.count,0);
    const baseParts=dpsBaseUnitSingleDpsParts(unit,context,dpsJewelFinalStats(''),'');
    const displayParts=groupResults[0] || baseParts;
    const unitTargetEffects={defenseReduce:M12_dr,pierce:baseParts.excelPierce,hpReduce:displayHR,shieldReduce:displaySR};
    return {
      AB3:displayParts.AB3,
      AB4:displayParts.AB4,
      AB5:displayParts.AB5,
      AB6:displayParts.AB6,
      rawM19:unitRawM19,
      M19:Math.round(unitRawM19),
      baseRawM19:baseParts.rawM19,
      baseM19:Math.round(baseParts.rawM19),
      excelPierce:baseParts.excelPierce,
      unitPierceBonus,
      ownDurability:targetDurabilityRemain(enemyData,unitTargetEffects),
      actualM12:actualDrWithPierce(M12_dr,baseParts.excelPierce),
      enhance:dpsBaseUnitEnhanceValue(unit),
      limitBreak:dpsBaseUnitLimitBreakValue(unit),
      jewelName,
      jewelStats,
      normalJewelNames,
      jewelGroups:groupResults.map(group=>({name:group.name,type:group.type,count:group.count,dps:Math.round(group.rawM19*group.count)})),
      voidPower:dpsBaseUnitVoidPowerOn(unit),
      raceCritBonus:displayParts.raceCritBonus,
      finalCooldown:displayParts.finalCooldown,
      ...unitMeta
    };
  });
  const unitTotalDps=dpsBaseUnitResults.reduce((sum,item)=>sum+(Number(item?.M19)||0),0);
  const expectationMultiplier=dpsBaseUnitExpectationMultiplier(vs('diff'));
  const expectedDps=unitTotalDps*expectationMultiplier;
  const requiredDps=dpsBaseUnitRequiredDps({
    enemyData,
    defenseReduce:M12_dr,
    dmgReduce:requiredEnemyDamageRate,
    round:targetRound,
    displayHR,
    displaySR,
    diffName:vs('diff')
  });
  const achievementRate=requiredDps>0 ? expectedDps/requiredDps*100 : 0;
  const differenceDps=expectedDps-requiredDps;
  const dpsBaseUnit={
    selection:dpsBaseUnitSelection,
    selectedIds:dpsBaseUnitSelectionIds(dpsBaseUnitSelection),
    basePierceBonus,
    rpPierce,
    isActive:dpsBaseUnitResults.length>0,
    isAll:dpsBaseUnitSelectionIds(dpsBaseUnitSelection).includes(dpsBaseUnitAllId()),
    totalDps:unitTotalDps,
    expectationMultiplier,
    expectedDps,
    requiredDps,
    achievementRate,
    differenceDps,
    results:dpsBaseUnitResults
  };
  let spU=0,spO=0,epU=0,rpU=0,soulU=0;
  TRAITS.forEach(t=>{
    const row=t[0];
    if(SP_ROWS.has(row)){
      const c=cumCost(row);
      if(isUtilitySpTrait(t)) spU+=c; else spO+=c;
    }
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
  return {M4,M7,M8,M9,M10,M11,M12,actualM12,M13,M16,M17,M18,M19,rawM19,roundTime,displayMultiplier,rawCD,rawTD,diff,
          displayAD,displayAPS,displayAPU,actualAPU,displayUA,displaySR,displayHR,actualSR,actualHR,
          spUsedTotal:spU+spO,spU,spO,epU,rpU,soulU,spBank:effectiveSpBankBonus(),spBankApplied:isSpBankApplied(),effectiveSP:effectiveSP(),excelPierce,enemyData,dpsBaseUnit};
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
  const passengerTargets=coopPassengerTargetEffectsList().map(target=>{
    const durability=targetDurabilityRemain(enemyData, target);
    return {...target, hpRemain:durability.remain};
  });
  const dmgReduce=ctx.diff.dmg * (1 - ctx.penDmg / 100) * (Number(enemyData.damageMultiplier)||1);
  const dps0Part=battleTargetDps0Average(
    {...ownTarget, hpRemain:ownDurability.remain},
    passengerTargets,
    enemyData.armor,
    dmgReduce
  );
  const playerCount=battleEnemyCountMultiplier();
  const flowerMultiplier=on('flowerSkill3') ? 1.15 : 1;
  const artifactAttackBonus=nonNegativeNumber(window.DPS_DATA?.ARTIFACT_DPS_CONFIG?.baseWeaponAttack);
  const adTdMultiplier=(1 + ((stats.M4||0) + artifactAttackBonus) / 100) * ((stats.M11||0) / 100);
  const critMultiplier=dps2(stats.M8||0, stats.M10||0, stats.M9||0, stats.M16||0, stats.M17||0, stats.M18||0, 1);
  const uaMultiplier=(1 - (stats.diff?.as||0) / 100) * (stats.M13||0) * artifactEnergyRegenMultiplier() * personalUaDtMultiplier();
  const displayMultiplier=contentDpsDisplayMultiplier(vs('diff'), ctx.targetRound, stats.displayHR||0, stats.displaySR||0);
  const rawArtifactDps=dps0Part * flowerMultiplier * adTdMultiplier * critMultiplier * uaMultiplier;
  const roundTime=enemyRoundTime(ctx.targetRound);
  const artifactDps=rawArtifactDps * displayMultiplier;
  return {
    dps:Number.isFinite(artifactDps) ? artifactDps : 0,
    rawDps:Number.isFinite(rawArtifactDps) ? rawArtifactDps : 0,
    roundTime,
    dps0:dps0Part,
    flowerMultiplier,
    adTdMultiplier,
    critMultiplier,
    uaMultiplier,
    displayMultiplier,
    artifactAttackBonus,
    playerCount,
    enemyData,
    penanceLevel:ctx.penanceLevel,
    round:ctx.targetRound
  };
}
const ARTIFACT_DPS_PREVIEW_IDS=['diff','penance','round','challengeTowerFloor','soloMode','coopMode','coopPlayers','coopPassenger2Dr','coopPassenger3Dr','team','prodArtifact','pbless',...EROSION_CONTROL_IDS];
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
function applyPreviewPenanceState(penEl, penanceLevel, battleMode, signaturePrefix){
  if(!penEl) return;
  const maxForPreview=battleMode==='coop' ? COOP_DPS_TABLE_PENANCE_MAX : DPS_TABLE_PENANCE_MAX;
  const normalizedPenance=normalizePenanceValue(penanceLevel, maxForPreview);
  setSelectOptions(penEl, Array.from({length:SOLO_PENANCE_MAX+1}, (_,value)=>({
    value,
    label:penanceOptionLabel(value),
    selected:String(value)===normalizedPenance
  })));
  penEl.dataset.penanceMax=`${signaturePrefix}:${SOLO_PENANCE_MAX}`;
  penEl.value=normalizedPenance;
  penEl.dataset.penanceValue=normalizedPenance;
}
function applyPreviewRoundState(round, roundEl, towerFloorEl){
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
}
function applyPreviewBattleModeState({battleMode, coopPlayers, soloEl, coopEl, coopPlayersEl, teamEl, signaturePrefix}){
  const coopActive=battleMode==='coop';
  const players=normalizeCoopPlayersValue(coopPlayers);
  if(soloEl) soloEl.value=coopActive ? 'OFF' : 'ON';
  if(coopEl){
    setSelectOptions(coopEl, [{value:'OFF',label:'OFF',selected:!coopActive},{value:'ON',label:'ON',selected:coopActive}]);
    coopEl.dataset.optionSignature=`${signaturePrefix}:coop-mode-toggle`;
    coopEl.value=coopActive ? 'ON' : 'OFF';
  }
  if(coopPlayersEl){
    setSelectOptions(coopPlayersEl, ['2','3'].map(playerCount=>({
      value:playerCount,
      label:playerCount,
      selected:coopActive && playerCount===players
    })));
    coopPlayersEl.dataset.optionSignature=`${signaturePrefix}:coop-players`;
    coopPlayersEl.value=coopActive ? players : normalizeCoopPlayersValue(coopPlayersEl.value);
  }
  if(coopActive && teamEl) teamEl.value=players;
}
function syncErosionControlElements(){
  EROSION_CONTROL_IDS.forEach(id=>{
    const el=$(id);
    if(!el) return;
    const stored=normalizeErosionControlValue(id, el.value || el.dataset.erosionValue || EROSION_CONTROL_DEFAULTS[id]);
    el.type='text';
    el.inputMode='numeric';
    el.value=stored;
    el.dataset.erosionValue=stored;
  });
}
function previewControlElements(){
  return {
    diffEl:$('diff'),
    penEl:$('penance'),
    roundEl:$('round'),
    towerFloorEl:$('challengeTowerFloor'),
    soloEl:$('soloMode'),
    coopEl:$('coopMode'),
    coopPlayersEl:$('coopPlayers'),
    teamEl:$('team')
  };
}
function prepareDpsPreviewControls(diffName, penanceLevel, round, options={}, signaturePrefix='preview'){
  const controls=previewControlElements();
  const battleMode=options.battleMode==='coop' ? 'coop' : 'solo';
  if(controls.diffEl) controls.diffEl.value=diffName;
  applyPreviewPenanceState(controls.penEl, penanceLevel, battleMode, signaturePrefix);
  applyPreviewRoundState(round, controls.roundEl, controls.towerFloorEl);
  syncErosionControlElements();
  applyPreviewBattleModeState({
    battleMode,
    coopPlayers:options.coopPlayers,
    soloEl:controls.soloEl,
    coopEl:controls.coopEl,
    coopPlayersEl:controls.coopPlayersEl,
    teamEl:controls.teamEl,
    signaturePrefix
  });
  return controls;
}
function calculateArtifactDpsPreview(diffName, penanceLevel, round, options={}){
  const saved=capturePreviewElementStates(ARTIFACT_DPS_PREVIEW_IDS);
  try{
    prepareDpsPreviewControls(diffName, penanceLevel, round, options, 'artifact');
    const artifactEl=$('prodArtifact');
    if(artifactEl) artifactEl.checked=true;
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
function isUtilitySpTrait(trait){
  return trait[3]==='유틸' || trait[3]==='경험치';
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
  const select=(typeof $==='function' ? $('spBankApply') : (typeof document!=='undefined' ? document.getElementById('spBankApply') : null));
  return select ? normalizeSpBankApplyValue(select.value)==='반영' : false;
}
function spBankApplyDisplayValue(value){
  return normalizeSpBankApplyValue(value)==='반영' ? 'ON' : 'OFF';
}
function spBankRawBonus(){
  const bankLevel=Math.max(0, Math.round(+(INV[SP_BANK_TRAIT_ROW]||0)));
  const appliedRound=Math.min(Math.max(0, effectiveTargetRound()), 290);
  const ticks=Math.floor(appliedRound/10);
  return bankLevel * 1000 * ticks;
}
function effectiveSpBankBonus(){
  return isSpBankApplied() ? spBankRawBonus() : 0;
}
function syncSpBankDisplay(){
  const select=$('spBankApply');
  if(!select) return;
  const state=isSpBankApplied() ? '반영' : '미반영';
  if(select.value!==state) select.value=state;
}
function effectiveSP(){
  return Math.max(0, v('sp') + effectiveSpBankBonus());
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
  const penValue=effectivePenanceValue();
  const roundInt=normalizedRoundNumber(targetRoundStoredValue());
  const floorInt=normalizedTowerFloorNumber(challengeTowerFloorStoredValue());
  const towerActive=isTowerDifficulty();
  const diff=selectedControlText(diffEl);
  const mode=dpsContextModeLabel();
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
    dpsContextRound:ctx.roundShort,
    dpsBaseUnitMode:`모드 : ${ctx.mode}${isCoopActive() ? ' · 3인' : ''}`
  });
}


/* ===== 09. DPS표 미리보기 계산 ===== */
const DPS_PREVIEW_IDS=['diff','penance','round','challengeTowerFloor','soloMode','coopMode','coopPlayers','team','pbless',...EROSION_CONTROL_IDS];
function computeDpsPreview(diffName, penanceLevel, round, options={}){
  const saved=capturePreviewElementStates(DPS_PREVIEW_IDS);
  try{
    prepareDpsPreviewControls(diffName, penanceLevel, round, options, 'preview');
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
const STAT_KO={
  AD:'공격력', AS:'공격속도', AP:'마법공격력', CRI:'크리티컬 확률', CD:'크리티컬 데미지',
  MC:'다중 크리티컬', TD:'총 데미지', DR:'방어력 감소', PIERCE:'방어력 관통', UA:'유닛 가속',
  SR:'실드 감소', HR:'체력 감소', MD:'멀티 타겟', MP:'멀티 확률', MCP:'멀티 크리 확률',
  RA:'강화 관련', 특수:'상시 적용', 유틸:'편의/보조', 경험치:'경험치 보너스'
};
function statKo(type){return STAT_KO[type] || type;}
function traitEffectText(row,type,rate){return !rate ? statKo(type) : `${statKo(type)} +${rate}${T_UA.has(row)?'%':''}`;}
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
  showToast('특성 최적화 완료', 'ok');
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
  if(['없음','none','off','n','0','-',''].includes(text)) return '0';
  return '0';
}
function zeroHonorDisplay(value){
  return normalizeZeroHonorValue(value).toUpperCase();
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
  return firstOwnedValue(row, kind==='current' ? ['currentHonor','현재 명예'] : ['targetHonor','목표 명예'], '0', normalizeZeroHonorValue);
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
    star:false,currentHonor:'0',targetHonor:'0'
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
      star:false,currentHonor:'0',targetHonor:'0'
    };
  }
  const honor=base.type==='honorTower' ? base : (list[index+1] || {});
  return {
    type:'towerCombo',
    current:zeroScoreFieldValue(base,'current') ?? '0',
    target:zeroScoreFieldValue(base,'target') ?? '0',
    honorCurrent:zeroScoreTowerHonorValue(honor,'current') ?? '0',
    honorTarget:zeroScoreTowerHonorValue(honor,'target') ?? '0',
    star:false,currentHonor:'0',targetHonor:'0'
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
    star:false,currentHonor:'0',targetHonor:'0'
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
  dpsBaseUnitList,
  dpsBaseUnitById,
  dpsBaseUnitAllId,
  dpsBaseUnitSelectionLimit,
  dpsBaseUnitLabel,
  dpsBaseUnitGradeOrder,
  dpsBaseUnitRaceOrder,
  dpsBaseUnitQuantityInputId,
  dpsBaseUnitEnhanceInputId,
  dpsBaseUnitLimitBreakInputId,
  dpsBaseUnitJewelInputId,
  dpsBaseUnitVoidPowerInputId,
  dpsBaseUnitHasQuantity,
  dpsBaseUnitQuantityIds,
  dpsBaseUnitSettingIds,
  dpsBaseUnitQuantityLimit,
  normalizeDpsBaseUnitQuantityValue,
  normalizeDpsBaseUnitEnhanceValue,
  normalizeDpsBaseUnitLimitBreakValue,
  normalizeDpsBaseUnitVoidPowerValue,
  dpsJewelNames,
  normalizeDpsJewelName,
  normalizeDpsJewelSetting,
  normalizeDpsJewelSettings,
  serializeDpsJewelSettings,
  dpsJewelFinalStats,
  dpsBaseUnitJewelName,
  dpsBaseUnitJewelStats,
  dpsBaseUnitQuantity,
  dpsBaseUnitEnhanceValue,
  dpsBaseUnitLimitBreakValue,
  dpsBaseUnitVoidPowerOn,
  dpsBaseUnitPierceBonus,
  normalizeDpsBaseUnitsValue,
  dpsBaseUnitSelectionIds,
  selectedDpsBaseUnits,
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
  battleDataModeKeyForDifficulty,
  battleDataModeForDifficulty,
  enemyRoundFruitProfile,
  enemyDisplayModeLabel,
  enemyRoundTime,
  enemyRoundTimeBonus,
  enemyBurdenDurability,
  battleBurdenScore,
  towerBurdenScore,
  contentDpsDisplayMultiplier,
  battleModeLabel,
  dpsContextModeLabel,
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
