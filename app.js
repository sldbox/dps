/* ── 0. 반응형/모바일 부트스트랩 ── */
(() => {
  'use strict';

  const MODES = ['is-pc-landscape', 'is-pc-portrait', 'is-tablet', 'is-mobile', 'is-portrait-view', 'is-mobile-device', 'is-tablet-device', 'is-narrow-mobile', 'is-tabbed'];
  const MOBILE_PAGES = [
    { key: 'convenience', label: '편의기능', selectors: ['.sg.priority'] },
    { key: 'spec', label: '기본정보', selectors: ['.xp-sp-card'] },
    { key: 'rune-spec', label: '룬정보', selectors: ['.clean-rune-card'] },
    { key: 'rune-effect', label: '룬효과/버프', selectors: ['.unit-enhance-card'] },
    { key: 'trait', label: '특성보드', selectors: ['.col-right'] },
    { key: 'result', label: '스탯보드', selectors: ['.stat-dps-card'] },
    { key: 'zero-rank', label: '승단', selectors: ['.zero-rank-card'] },
    { key: 'save', label: '기타', selectors: ['.bus-cut-card', '.final-damage-card'] }
  ];

  const state = { tabs:null, pages:[], restore:new Map(), raf:0, arrangedMobile:false, layoutWidth:0, layoutPortrait:null };

  function getMode() {
    const w = window.innerWidth || document.documentElement.clientWidth || 0;
    const h = window.innerHeight || document.documentElement.clientHeight || 0;
    const shortSide = Math.min(w, h);
    const longSide = Math.max(w, h);
    const portrait = h > w;

    if (shortSide <= 600) return 'is-mobile';
    if (shortSide <= 1024 && longSide <= 1200) return 'is-tablet';
    if (portrait) return 'is-pc-portrait';
    return 'is-pc-landscape';
  }

  function updateMobileOffsets() {
    const header = document.querySelector('.hdr');
    const tabs = document.querySelector('.mobile-swipe-tabs');
    const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    const tabsHeight = tabs ? Math.ceil(tabs.getBoundingClientRect().height) : 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    document.documentElement.style.setProperty('--mobile-header-h', `${headerHeight}px`);
    document.documentElement.style.setProperty('--mobile-tabs-h', `${tabsHeight}px`);
    document.documentElement.style.setProperty('--mobile-vh', `${viewportHeight}px`);
  }

  function applyMode() {
    const mode = getMode();
    const w = window.innerWidth || document.documentElement.clientWidth || 0;
    const h = window.innerHeight || document.documentElement.clientHeight || 0;
    const shortSide = Math.min(w, h);
    const direction = h > w ? 'is-portrait-view' : '';
    const deviceClass = mode === 'is-mobile' ? 'is-mobile-device' : (mode === 'is-tablet' ? 'is-tablet-device' : '');
    const widthClass = mode === 'is-mobile' && shortSide <= 430 ? 'is-narrow-mobile' : '';

    document.body.classList.remove(...MODES);
    document.documentElement.classList.remove(...MODES);
    document.body.classList.add(mode);
    document.documentElement.classList.add(mode);
    if (mode === 'is-mobile') {
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
    syncMobileLayout();
    updateMobileOffsets();
  }

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
    return page;
  }

  function buildTabs(colWork, pages) {
    if (!state.tabs) {
      state.tabs = document.createElement('div');
      state.tabs.className = 'mobile-swipe-tabs';
      state.tabs.setAttribute('aria-label', '모바일 섹션 이동');
      colWork.parentNode.insertBefore(state.tabs, colWork);
    }

    state.tabs.textContent = '';
    pages.forEach((page, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mobile-swipe-tab';
      btn.textContent = page.label;
      btn.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');
      btn.addEventListener('click', () => {
        page.el.scrollTop = 0;
        colWork.scrollTo({ left: page.el.offsetLeft, top: 0, behavior: 'auto' });
        setActiveTab(idx);
        btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
      });
      state.tabs.appendChild(btn);
    });
  }

  function setActiveTab(activeIndex) {
    if (!state.tabs) return;
    state.tabs.querySelectorAll('.mobile-swipe-tab').forEach((btn, idx) => {
      const active = idx === activeIndex;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function arrangeMobile(colWork) {
    const pages = [];

    MOBILE_PAGES.forEach((config) => {
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
    setActiveTab(0);
    colWork.scrollTo({ left: 0, top: 0, behavior: 'auto' });
    state.arrangedMobile = true;
  }

  function restoreDesktop() {
    if (!state.arrangedMobile) return;

    state.restore.forEach((marker, el) => {
      if (marker.parentNode) marker.parentNode.insertBefore(el, marker.nextSibling);
    });

    document.querySelectorAll('.mobile-page').forEach(page => page.remove());
    if (state.tabs) state.tabs.remove();
    state.tabs = null;
    state.pages = [];
    state.arrangedMobile = false;
  }

  function syncMobileLayout() {
    const colWork = document.querySelector('.col-work');
    if (!colWork) return;

    if (document.body.classList.contains('is-tabbed')) {
      if (!state.arrangedMobile) arrangeMobile(colWork);
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
        try { el.select(); } catch (e) {}
      });
    });
  }

  function bindMobileScroll() {
    const colWork = document.querySelector('.col-work');
    if (!colWork || colWork.dataset.mobileScrollBound === '1') return;
    colWork.dataset.mobileScrollBound = '1';

    colWork.addEventListener('scroll', () => {
      if (!document.body.classList.contains('is-tabbed') || !state.pages.length) return;
      if (state.raf) return;
      state.raf = requestAnimationFrame(() => {
        state.raf = 0;
        let bestIndex = 0;
        let bestDistance = Infinity;
        state.pages.forEach((page, idx) => {
          const distance = Math.abs(page.el.offsetLeft - colWork.scrollLeft);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = idx;
          }
        });
        setActiveTab(bestIndex);
        const activeBtn = state.tabs && state.tabs.querySelectorAll('.mobile-swipe-tab')[bestIndex];
        if (activeBtn) activeBtn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
      });
    }, { passive: true });
  }

  function scheduleApply() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = requestAnimationFrame(() => {
      state.raf = 0;
      const w = window.innerWidth || document.documentElement.clientWidth || 0;
      const h = window.innerHeight || document.documentElement.clientHeight || 0;
      const portrait = h > w;
      const widthChanged = Math.abs(w - state.layoutWidth) > 1;
      const orientationChanged = state.layoutPortrait !== portrait;
      if (!widthChanged && !orientationChanged) {
        updateMobileOffsets();
        return;
      }
      applyMode();
    });
  }

  function init() {
    applyMode();
    bindMobileScroll();
    bindInputAutoSelect();
    updateMobileOffsets();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('resize', scheduleApply, { passive: true });
  window.addEventListener('orientationchange', scheduleApply, { passive: true });
  window.addEventListener('load', updateMobileOffsets, { once: true });
})();

/* ── 1. 설정 / 기준 데이터 ── */
var DPS_CONFIG={
  storage:{
    version:(window.DPS_BUILD_VERSION || 'dev'),
    scope:'browser_local',
    key:'gbd_dps_calculator:personal_state',
    fontKey:'gbd_dps_calculator:font_scale',
    clientKey:'gbd_dps_calculator:client_id'
  },

  state:{
    skipElementIds:['backupFileInput','dpsTableMinDpsMain','ep']
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
  const code=(document.getElementById('enchantCode')?.value||'999999').padEnd(6,'0');
  const lv=Math.max(0,Math.min(9,parseInt(code[pos]||'0',10)||0));
  return ENCHANT_TABLE[lv];
}

/* ── 2. 전역 상태 / 특성 투자 상태 ── */
const INV={};
TRAITS.forEach(t=>{INV[t[0]]=0;});
Object.assign(INV,{116:1});
const AUTO_INVEST_EXCLUDED_ROWS=new Set([45,87]);
const ENCHANT_INPUT_IDS=['enchAD','enchCRI','enchUA','enchTD','enchSR','enchHR'];
const FIXED_STEP_AFTER_150={93:76000,94:76000,95:114000};
function fixedStepAfter150(row){return FIXED_STEP_AFTER_150[row] || 0;}
function nextCost(row){
  const step=(typeof STEP_COST!=='undefined') ? STEP_COST[row] : null;
  const n=INV[row]||0;
  const mx=TMAX[row]||999;
  if(n>=mx) return Infinity;
  if(step) return Number.isFinite(step[n]) ? step[n] : Infinity;
  const p=COST[row];
  if(!p){
    if(typeof RP_ROWS!=='undefined' && RP_ROWS.has(row)) return nextRpCost(row);
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
  const step=(typeof STEP_COST!=='undefined') ? STEP_COST[row] : null;
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
/* ── 3. 공통 UI 유틸 / 입력값 유틸 ── */
function showToast(message, type='ok'){
  try{
    let root=document.getElementById('toastRoot');
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
function v(id){const el=document.getElementById(id); if(!el) return 0; const raw=String(el.value??'').replace(/,/g,'').trim(); return +raw||0;}
function vs(id){const el=document.getElementById(id); return el ? el.value : '';}
const BASE_DISPLAY_STATS={ad:5, as:5, cri:5};
function effectiveXpValue(){return Math.max(1, v('xp'));}
function normalizeXpInput(){
  const el=document.getElementById('xp');
  if(!el) return 1;
  const n=Math.max(1, v('xp'));
  if(v('xp')!==n) el.value=String(n.toLocaleString('ko-KR'));
  return n;
}
function setText(id,val){const el=document.getElementById(id); if(el) el.textContent=val;}
function setValue(id,val){const el=document.getElementById(id); if(el) el.value=String(val);}
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
function formatRuneChoiceDisplay(type, value){
  const v=normalizeRuneChoiceValue(value);
  if(v===0) return '없음';
  const t=normalizeRuneChoiceType(type);
  return `${RUNE_CHOICE_TYPE_LABELS[t] || RUNE_CHOICE_TYPE_LABELS.harmony} +${v.toLocaleString('ko-KR')}`;
}
function runeChoiceDisplayFromValues(values={}){
  return formatRuneChoiceDisplay(values.runeChoiceType, values.runeChoiceValue);
}
function normalizeRuneChoiceValues(values={}){
  const out={...values};
  out.runeChoiceType=normalizeRuneChoiceType(out.runeChoiceType || 'harmony');
  out.runeChoiceValue=String(normalizeRuneChoiceValue(out.runeChoiceValue));
  return out;
}

/* ── 4. 계산 보조 함수 / 난이도 / 룬 / 특성 효과 ── */
function isAbyssDifficulty(){const d=vs('diff'); return d==='Abyss road' || d==='Deep Abyss';}
function abyssEffectiveStack(){
  if(!isAbyssDifficulty()) return 0;
  const round=Math.max(0, v('round'));
  const abyssRes=(INV[131]||0) * 3;
  const deepExtra=vs('diff')==='Deep Abyss' ? Math.floor(round/10)*5 : 0;
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
  const base=vs('diff')==='Deep Abyss' ? 5 : 0.75;
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
    if(t[5]==='team' && !isTowerDifficulty()) val*=Math.max(1,v('team')||1);
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
function isTowerDifficulty(){return vs('diff')==='도전의 탑';}
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
function renderEnemyData(data){
  if(!data) return;
  setText('enemyQuickView', `방어 ${big(data.armor)} / 체력 ${big(data.hp)} / 실드 ${big(data.shield)}`);
  setText('enemyArmorQuick', big(data.armor));
  setText('enemyHpQuick', big(data.hp));
  setText('enemyShieldQuick', big(data.shield));
  setText('enemyCountQuick', big(data.count));
  setValue('enemyArmor', data.armor);
}
function syncRuneChoice(){
  const type=vs('runeChoiceType') || 'harmony';
  const value=v('runeChoiceValue');
  RUNE_CHOICE_TARGETS.forEach(([kind,id])=>setValue(id, kind===type ? value : 0));
}
function hydrateRuneChoiceFromHidden(){
  const typeEl=document.getElementById('runeChoiceType');
  const valueEl=document.getElementById('runeChoiceValue');
  if(!typeEl || !valueEl) return;
  const selected=RUNE_CHOICE_TARGETS.find(([,id])=>v(id)!==0);
  typeEl.value=selected ? selected[0] : 'harmony';
  valueEl.value=String(selected ? v(selected[1]) : 0);
  syncRuneChoice();
}
function setSelectButton(id,value){
  const el=document.getElementById(id);
  if(!el) return;
  el.value=value;
  if(id==='enhanceMaster') syncPowerBlessOptions();
  syncSelectButtons();
  requestAppUpdate();
}
function syncSelectButtons(){
  document.querySelectorAll('.seg-btns[data-target]').forEach(group=>{
    const id=group.dataset.target;
    const val=document.getElementById(id)?.value;
    group.querySelectorAll('button[data-value]').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.value===val);
    });
  });
}
function syncBuffChoiceButtons(){
  document.querySelectorAll('.buff-choice-item').forEach(item=>{
    const input=item.querySelector('input[type="checkbox"]');
    const active=!!(input && input.checked);
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}
const POWER_BLESS_OPTIONS={OFF:[0],ON:[0,20,40,60],'ON+':[0,30,60,90]};
function powerBlessOptionLabel(value){
  return +value===0 ? '없음' : String(value);
}
function syncPowerBlessOptions(){
  const el=document.getElementById('pbless');
  if(!el) return;
  const master=vs('enhanceMaster') || 'OFF';
  const options=POWER_BLESS_OPTIONS[master] || POWER_BLESS_OPTIONS.OFF;
  const current=String(v('pbless') || 0);
  const signature=options.join(',');
  if(el.dataset.optionSignature!==signature){
    el.innerHTML='';
    options.forEach(value=>{
      const option=document.createElement('option');
      option.value=String(value);
      option.textContent=powerBlessOptionLabel(value);
      el.appendChild(option);
    });
    el.dataset.optionSignature=signature;
  }
  const allowed=new Set(options.map(value=>String(value)));
  el.disabled=master==='OFF';
  el.value=allowed.has(current) ? current : '0';
}
function normalizePowerBlessValueForMaster(master, value){
  const options=POWER_BLESS_OPTIONS[master] || POWER_BLESS_OPTIONS.OFF;
  const n=Math.max(0, Math.round(excelNumber(value) ?? (+value || 0)));
  return options.includes(n) ? String(n) : '0';
}
function excelEnhanceMasterValue(value){
  return excelStateValue('enhanceMaster', value) || 'OFF';
}
function excelPowerBlessStateValue(masterValue, powerBlessValue){
  return normalizePowerBlessValueForMaster(excelEnhanceMasterValue(masterValue), powerBlessValue);
}
function syncTeamSelect(){
  const el=document.getElementById('team');
  if(!el) return;
  if(!['1','2','3'].includes(String(el.value))) el.value='1';
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
    const el=document.getElementById(id);
    return el ? clampEnchantInput(el) : 0;
  }).join('');
  const hidden=document.getElementById('enchantCode');
  if(hidden) hidden.value=code;
}
function syncEnchantCodeFromInputs(updateInputs=true){
  const hidden=document.getElementById('enchantCode');
  const hasInputs=ENCHANT_INPUT_IDS.some(id=>document.getElementById(id));
  if(!hasInputs) return;
  if(updateInputs && hidden){
    const code=String(hidden.value||'999999').padEnd(6,'0');
    ENCHANT_INPUT_IDS.forEach((id,i)=>{
      const el=document.getElementById(id);
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
function formatDecimalDisplayInputs(){
  DECIMAL_DISPLAY_INPUT_IDS.forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value=normalizeDecimalDisplayValue(el.value);
  });
}
function formatAllMoneyInputs(){
  document.querySelectorAll('.money-input').forEach(formatMoneyInput);
  formatDecimalDisplayInputs();
}
function on(id){const el=document.getElementById(id); return !!(el && el.checked);}
function clampInt(n,min,max){return Math.max(min,Math.min(max,Math.round(+n||0)));}
const OVER_ENHANCE_ALLOWED=new Set([0,3,5,6]);
function normalizeOverEnhanceValue(value){
  const n=clampInt(value,0,6);
  return OVER_ENHANCE_ALLOWED.has(n) ? n : 0;
}
function monthRuneCount(prefix, kind='plus'){
  const el=document.getElementById(prefix + (kind==='normal' ? 'RuneNormal' : 'RunePlus'));
  return clampInt(el ? el.value : 0, 0, 4);
}
const RUNE_OPTION_SELECT_IDS=['opt10','opt15','transOpt'];
function uniqueRuneOptionCodes(){
  return Array.from(new Set(
    RUNE_OPTION_SELECT_IDS.map(id=>vs(id)).filter(code=>code && code!=='none')
  ));
}
function syncExclusiveRuneOptions(){
  const selects=RUNE_OPTION_SELECT_IDS.map(id=>document.getElementById(id)).filter(Boolean);
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
  const active=true; // 유닛강화는 웹 기준 상시 ON
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
  const value=active ? reinforceExpectedValue(chance, count, masterRate, INV[96]||0, repairAdd) + aprilPlus * 10 : 0;
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
function unitGradeADBonus(grade){
  const table={D:-10,C:-5,B:0,A:5,S:10,SS:20,SSS:30,X:40,XD:50,SXD:50,RXD:100};
  return table[grade] ?? table.S;
}
function unitGradeASBonus(grade){
  const table={D:0,C:0,B:0,A:0,S:0,SS:0,SSS:0,X:0,XD:0,SXD:25,RXD:30};
  return table[grade] ?? 0;
}
function currentUnitGrade(){return vs('unitGrade') || 'S';}
function isPersonalUnit(){return (vs('currentUnit') || 'M2') === (vs('personalUnit') || '유물');}
function isUnitUniqueBuffOn(){
  const el=document.getElementById('unitUniqueBuff');
  if(!el) return true;
  return el.type==='checkbox' ? !!el.checked : String(el.value||'ON')!=='OFF';
}
function isBasePierceBuffOn(){
  const el=document.getElementById('basePierceBuff');
  if(!el) return false;
  return el.type==='checkbox' ? !!el.checked : String(el.value||'ON')!=='OFF';
}
function isDailyCouponBuffOn(){
  const el=document.getElementById('dailyCouponBuff');
  if(!el) return false;
  return el.type==='checkbox' ? !!el.checked : String(el.value||'ON')!=='OFF';
}
function isShareUserBuffOn(){
  const el=document.getElementById('shareUserBuff');
  if(!el) return false;
  return el.type==='checkbox' ? !!el.checked : String(el.value||'ON')!=='OFF';
}
function xpInputStatBonus(){
  return effectiveXpValue() <= 10000 ? {ad:10, as:10, cri:5} : {ad:0, as:0, cri:0};
}
function unitADPrivateBonus(){
  const enh=unitEnhanceStats();
  const gradeAd=unitGradeADBonus(currentUnitGrade());
  const level=(v('unitLevel')||11)*5;
  const uniqueBuff=isUnitUniqueBuffOn() ? 30 + 10*(enh.septemberPlus ?? 4) : 0;
  const duplicatePenalty=(v('unitDuplicatePenalty')||0)*10;
  const manualAbyssPenalty=(v('unitAbyssPenalty')||0);
  return gradeAd + level + uniqueBuff + (enh.value||0) - duplicatePenalty - manualAbyssPenalty - abyssAdPenalty();
}
function personalAsBonus(){
  if(isPersonalUnit()) return 0;
  return (vs('personalASBuff') || 'OFF')==='ON' ? 15 : 0;
}
function gradeAsBonus(){
  return isPersonalUnit() ? 0 : unitGradeASBonus(currentUnitGrade());
}
function personalUaDtMultiplier(){
  const dt=(vs('dt')==='ON'?1.15:1);
  const limitBreak=isPersonalUnit() ? (v('personalLimitBreak') || 50) : 0;
  const jewel=isPersonalUnit() ? (v('personalJewel') || 0) : 0;
  return dt * (1+limitBreak/100) * (1+jewel);
}
function calcAutoEP(){
  const xp=effectiveXpValue();
  const bxp=Math.max(0, v('bxp'));
  return Math.floor(xp/100000) + Math.floor(bxp/50000);
}
function syncAutoEP(){
  const ep=calcAutoEP();
  const hidden=document.getElementById('ep');
  if(hidden) hidden.value=String(ep);
  const view=document.getElementById('autoEpView');
  if(view) view.textContent=big(ep);
  return ep;
}
function effectiveAdditionalStats(){
  // Excel spec sheet applies additional rune stats to Hyper/Penance, Tower, and Abyss sheets alike.
  return { ad:v('addAD'), as:v('addAS'), cd:v('addCD'), cri:v('addCRI'), ap:v('addAP'), td:v('addTD'), ua:v('addUA'), dr:v('addDR'), sr:v('addSR'), hr:v('addHR') };
}
function growthGraduationAttackBonus(){
  const manual=v('sysAD');
  if(manual) return manual;
  return effectiveXpValue()>=2000000 ? 20 : 0;
}

/* ── 5. 스탯 / 버프 / DPS 계산 ── */
function computeStatsRaw(){
  const autoEP=syncAutoEP();
  const diff=DIFF[vs('diff')]||DIFF['The Final'];
  const targetRound=v('round');
  const towerPenaltyLevel=isTowerDifficulty() ? (targetRound>=65 ? Math.floor((targetRound-63)/2) : 0) : v('penance');
  const penanceLevel=Math.max(0,Math.min(towerPenaltyLevel,20));
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
  const shareOn=isShareUserBuffOn();
  const shareAD=shareOn?10:0, shareAS=shareOn?10:0, shareCRI=shareOn?5:0;
  const dailyCouponCRI=isDailyCouponBuffOn()?10:0;
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
            + v('pbless') + shareAD + xpStat.ad + (v('powerBunkerAD')||0) + (v('postMasterAD')||0)
            + enchantAt(0).ad + epBuff
            + ((vs('additionalADBuff')==='ON') ? (v('additionalADValue')||0) : 0)
            + ((vs('rushADBuff')==='ON') ? 50 : 0)
            + growthGraduationAttackBonus() + additionalStats.ad;
  const AP10 = -diff.ad;
  const M4 = AP9 + AP10 + unitADBonus + upperStats.actualAd;
  const M7_base = BASE_DISPLAY_STATS.as + sumStat('AS') + v('rAS') + upperStats.as + ascVlookup4 + reinf + shareAS + xpStat.as + v('rModAS') + additionalStats.as;
  const M7 = isPersonalUnit() ? 0 : M7_base;
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
  const durabilityTotal = Math.max(0, (enemyData.hp||0) + (enemyData.shield||0));
  const hpRatio = durabilityTotal > 0 ? (enemyData.hp||0) / durabilityTotal : 1;
  const shieldRatio = durabilityTotal > 0 ? (enemyData.shield||0) / durabilityTotal : 0;
  const hpRemain = Math.max(0.01, hpRatio * (1 - displayHR / 100) + shieldRatio * (1 - displaySR / 100));
  const excelPierce = (isBasePierceBuffOn() ? 10 : 0) + rpPierceBonus();
  const M12 = M12_dr;
  const actualM12 = M12_dr + (100-M12_dr) * (excelPierce / 100);
  const AB3=dps0(hpRemain, enemyData.armor, M12_dr, excelPierce, diff.dmg*(1-penDmg/100)) * upperStats.dps0Mul;
  const AB4=(1+M4/100)*(M11/100);
  const AB5=dps2(M8, M10, M9, M16, M17, M18, isPersonalUnit()?1:0);
  const dt=personalUaDtMultiplier();
  const personalAs=personalAsBonus();
  const gradeAs=gradeAsBonus();
  const AB6=(1+(M7+upperStats.actualAs+personalAs+gradeAs)/100)*(1-diff.as/100)*M13*dt;
  const M19=AB3*AB4*AB5*AB6;
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
                  + (isUnitUniqueBuffOn() ? 20 : 0) + (v('unitLevel') || 11) * 5
                  - (v('unitDuplicatePenalty') || 0) * 10;
  const actualSR = displaySR * shieldRatio;
  const actualHR = displayHR * hpRatio;
  return {M4,M7,M8,M9,M10,M11,M12,M12_dr,actualM12,M13,M16,M17,M18,AB3,AB4,AB5,AB6,M19,
          rawCD,rawTD,actualTD,penTD,penCD,penDmg,penUA,abyssStack:abyssEffectiveStack(),abyssTd:abyssTdPenalty(),abyssSlow:abyssSlowMultiplier(),abyssAd:abyssAdPenalty(),diff,dt,personalAs,gradeAs,asc,reinf,displayAD,displayAPS,displayAPU,actualAPU,displayUA,displaySR,displayHR,actualSR,actualHR,
          spTotal:spU+spO,spU,spO,epU,rpU,soulU,spBank:spBankRawBonus(),spBankApplied:isSpBankApplied(),effectiveSP:effectiveSP(),rpPierce:rpPierceBonus(),excelPierce,enemyData};
}
function computeStats(){
  return computeStatsRaw();
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
  const el=document.getElementById('spBankApply');
  if(!el) return false;
  if(el.type==='checkbox') return !!el.checked;
  return normalizeSpBankApplyValue(el.value)==='반영';
}
function syncSpBankButtonDisplay(bankSP=null){
  const hidden=document.getElementById('spBankApply');
  const state=normalizeSpBankApplyValue(hidden ? hidden.value : '미반영');
  const applied=state==='반영';
  if(hidden && hidden.value!==state) hidden.value=state;
  const n=bankSP==null ? spBankRawBonus() : bankSP;
  const btn=document.getElementById('spBankApplyButton');
  if(btn){
    btn.textContent=applied ? `반영 · ${fullNumber(n)}` : '미반영';
    btn.value=state;
    btn.classList.toggle('is-applied', applied);
    btn.setAttribute('aria-pressed', applied ? 'true' : 'false');
    btn.title=applied ? `SP 은행 보너스 SP ${fullNumber(n)}을 총 SP에 반영 중입니다` : 'SP 은행 보너스 SP를 총 SP에 반영하지 않습니다. 눌러서 반영할 수 있습니다';
  }
  const row=document.querySelector('.sp-bank-basic-row');
  if(row) row.classList.toggle('is-bank-applied', applied);
}
function toggleSpBankApply(){
  const el=document.getElementById('spBankApply');
  if(!el) return false;
  el.value=isSpBankApplied() ? '미반영' : '반영';
  syncSpBankButtonDisplay();
  try{el.dispatchEvent(new Event('change',{bubbles:true}));}catch(_e){}
  requestAppUpdate();
  return true;
}
function spBankRawBonus(){
  const bankLevel=INV[89]||0;
  const appliedRound=Math.min(Math.max(0, v('round')), 290);
  const ticks=Math.floor(appliedRound/10);
  return bankLevel * 1000 * ticks;
}
function spBankBonus(){return isSpBankApplied() ? spBankRawBonus() : 0;}
function effectiveSP(){return v('sp') + spBankBonus();}
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
  const target=vs('optTier')||'무한∞';
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
  const raw=String(document.getElementById('round')?.value ?? '').replace(/,/g,'').trim();
  return raw==='0' || Number(raw)===0;
}
function normalizeRoundInput(){
  const el=document.getElementById('round');
  if(!el) return false;
  const raw=String(el.value ?? '').replace(/,/g,'').trim();
  const num=Number(raw);
  if(raw==='' || !Number.isFinite(num) || num<1){
    el.value='1';
    return true;
  }
  return false;
}
function resetDifficultyDependentFields(){
  const pen=document.getElementById('penance');
  const round=document.getElementById('round');
  let changed=false;
  if(pen && pen.value!=='0'){ pen.value='0'; changed=true; }
  if(round && String(round.value)!=='1'){ round.value='1'; changed=true; }
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
  const diffEl=document.getElementById('diff');
  const penEl=document.getElementById('penance');
  const roundEl=document.getElementById('round');
  const penValue=Math.max(0,Math.min(20,Math.round(Number(penEl?.value || 0))));
  const rawRound=String(roundEl?.value ?? '').replace(/,/g,'').trim();
  const roundValue=rawRound==='' ? NaN : Number(rawRound);
  const roundInt=Number.isFinite(roundValue) ? Math.round(roundValue) : null;
  const diff=selectedControlText(diffEl);
  const penance=penValue>0 ? `${penValue} 고행` : '고행 없음';
  const round=roundInt!==null ? `${roundInt} 라운드` : '라운드 —';
  const floor=roundInt!==null ? `${roundInt}층` : '층 —';
  const penanceShort=String(penValue);
  const roundShort=roundInt!==null ? String(roundInt) : '—';
  return {diff, penValue, roundValue, penance, round, floor, penanceShort, roundShort};
}
function updateDpsContextSummary(){
  const ctx=getDpsContextValues();
  setText('dpsContextDiff', ctx.diff);
  setText('dpsContextPenance', ctx.penanceShort);
  setText('dpsContextRound', ctx.roundShort);
}

/* ── 6. 메인 화면 렌더링 / 재계산 ── */
function renderDpsSummary(s){
  updateDpsContextSummary();
  if(shouldHideDpsForRound()){
    setText('dpsVal', '—');
    syncDpsMinDpsInputs();
    updateDpsRiskViews(NaN);
    if(isDpsTableOpen()) renderDpsTableModal();
    return;
  }
  setText('dpsVal', s.M19.toFixed(2));
  syncDpsMinDpsInputs();
  updateDpsRiskViews(s.M19);
  if(isDpsTableOpen()) renderDpsTableModal();
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
  syncSpBankButtonDisplay(bankSP);
}
function recalc(){
  try{
    syncExclusiveRuneOptions();
    syncRuneChoice();
    syncEnchantInputs();
    syncSelectButtons();
    syncBuffChoiceButtons();
    syncPowerBlessOptions();
    syncTeamSelect();
    formatAllMoneyInputs();
    syncTraitLimitInputs();
    renderEnchantPreview(); renderXpCut(); renderEnhanceSummary();
    const s=computeStats();
    renderEnemyData(s.enemyData);
    renderSkillDamage(s);
    renderDpsSummary(s);
    renderStatSummary(s);
    renderResourceSummary(s);
    updateTraits();
    renderTraitEfficiencyTop5();
    saveState({silent:true});
  }catch(e){console.error(e);}
}
function renderEnhanceSummary(){
  const e=unitEnhanceStats();
  const chance=document.getElementById('enhanceChanceView');
  const count=document.getElementById('enhanceCountView');
  const value=document.getElementById('enhanceValueView');
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
    const out=document.getElementById(outIds[i]);
    if(out) out.textContent=val;
  });
}
function renderXpCut(){
  const base=Math.max(0, v('sp'));
  const rows=[['1단계',base/10,base/6],['2단계',base/20,base/12],['3단계',base/30,base/22],['4단계',base/40,base/30]];
  const el=document.getElementById('xpCutRows'); if(!el) return;
  el.innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td>${big(r[1])}</td><td>${big(r[2])}</td></tr>`).join('');
}
function renderSkillDamage(s){
  const ap=s?.displayAPU ?? 535;
  const apView=document.getElementById('skillAPView');
  if(apView) apView.textContent=`AP : ${fmt(ap,0)}`;
  const doubleSpace=v('skillDouble');
  const round=Math.max(1,v('skillRound'));
  const isTower=vs('skillMode')==='tower';
  const baseRound=isTower ? 30 : 100;
  const perRound=isTower ? 0.016601 : 0.005;
  const penalty=Math.max(0, Math.min(0.99, (round-baseRound)*perRound));
  const pv=document.getElementById('skillPenaltyView');
  if(pv){
    pv.replaceChildren(
      document.createTextNode('라운드별 데미지 감소: '),
      Object.assign(document.createElement('strong'),{textContent:`${(penalty*100).toFixed(1)}%`}),
      document.createTextNode(` (${isTower?'도전의 탑':'일반모드'} `),
      Object.assign(document.createElement('strong'),{textContent:`${round}R`}),
      document.createTextNode(')')
    );
  }
  const data=[
    ['어스퀘이크',0.0223,0.000066,10],
    ['포이즌미스트',0.0432,0.0001755,15],
    ['라이트닝스톰',0.517,0.0005,1],
    ['퓨리파이어',0.0198,0.000142,30],
    ['메테오 (1발)',0.259,0.00025,1]
  ];
  const el=document.getElementById('skillRows'); if(!el) return;
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
/* ── 7. DPS표 / 이달룬 모달 ── */
const DPS_TABLE_DIFFICULTIES=DPS_CONFIG.dpsTable.difficulties;
const DPS_TABLE_PENANCE_MIN=DPS_CONFIG.dpsTable.penanceMin ?? 0;
const DPS_TABLE_PENANCE_MAX=DPS_CONFIG.dpsTable.penanceMax ?? 20;
const DPS_TABLE_DECIMALS=DPS_CONFIG.dpsTable.decimals ?? 1;
let activeDpsTableMode='round';
let dpsTableMinDps='';
function isDpsTableOpen(){
  return document.getElementById('dpsTableModal')?.classList.contains('is-open') || false;
}
function getDpsTableCurrentRound(){
  return Math.max(1, Math.min(300, Math.round(v('round') || 1)));
}
function getDpsTableTowerRange(){
  const tower=DPS_CONFIG.dpsTable.tower || {};
  return { min:Math.max(1, Math.round(tower.minFloor || 1)), max:Math.max(1, Math.round(tower.maxFloor || 90)) };
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
    const el=document.getElementById(id);
    if(el && el.value!==dpsTableMinDps) el.value=dpsTableMinDps;
  });
}
function setDpsTableMinDps(value){
  dpsTableMinDps=String(value ?? '');
  syncDpsMinDpsInputs();
  updateDpsRiskViews();
  if(isDpsTableOpen()) renderDpsTableModal();
  if(!isLoadingState) saveState({silent:true});
}
function parseDpsTableMinDps(){
  const n=Number(String(dpsTableMinDps||'').replace(/,/g,'').trim());
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
  const card=document.querySelector('.dps-card');
  const dpsEl=document.getElementById('dpsVal');
  if(!card) return;
  const minDps=parseDpsTableMinDps();
  const raw=Number.isFinite(currentDps) ? currentDps : Number(String(dpsEl?.textContent||'').replace(/,/g,'').trim());
  const isRisk=minDps!==null && Number.isFinite(raw) && raw<=minDps;
  card.classList.toggle('is-dps-risk', !!isRisk);
  let badge=document.getElementById('dpsRiskBadge');
  if(!badge){
    badge=document.createElement('div');
    badge.id='dpsRiskBadge';
    badge.className='dps-risk-badge';
    card.appendChild(badge);
  }
  badge.style.display=isRisk ? 'inline-flex' : 'none';
  if(isRisk) badge.textContent=`위험구간`;
}
function computeDpsPreview(diffName, penanceLevel, round){
  const ids=['diff','penance','round'];
  const saved=ids.map(id=>{
    const el=document.getElementById(id);
    return [el, el ? el.value : null];
  });
  try{
    const diffEl=document.getElementById('diff');
    const penEl=document.getElementById('penance');
    const roundEl=document.getElementById('round');
    if(diffEl) diffEl.value=diffName;
    if(penEl) penEl.value=String(penanceLevel);
    if(roundEl) roundEl.value=String(round);
    const s=computeStats();
    return Number.isFinite(s.M19) ? s.M19 : 0;
  }catch(e){
    console.error('[DPS table preview failed]', e);
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
      const value=computeDpsPreview(diff, pen, round);
      const danger=minDps!==null && dpsTableRiskCompareValue(value)<=minDps;
      const currentCell=rowCurrent && diff===currentDiff;
      const classes=[danger?'dps-risk-cell':'', currentCell?'dps-current-cell':''].filter(Boolean).join(' ');
      const title=currentCell ? `현재 선택: ${diff} ${pen}고행 / ${round}라운드` : '';
      return `<td class="${classes}"${title?` title="${title}"`:''}>${formatDpsTableValue(value)}</td>`;
    }).join('');
    rows.push(`<tr${rowCurrent?' class="dps-current-row"':''}><th>${pen}</th>${cells}</tr>`);
  }
  return `<table class="dps-matrix dps-round-matrix"><thead><tr><th>고행</th>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
function towerEnemyData(floor){
  const r=Math.max(1, Math.min(90, Math.round(+floor||1)));
  const armorRow=lookupFloor(TOWER_ARMOR_TABLE, r);
  const unitRow=lookupFloor(TOWER_UNIT_TABLE, r);
  return {
    round:r,
    armor:armorRow && armorRow[0]<=r ? armorRow[1] : 0,
    count:unitRow ? unitRow[1] : 0,
    hp:unitRow ? unitRow[2] : 0,
    shield:unitRow ? unitRow[3] : 0
  };
}
function towerEnemySummaryItems(floor){
  const enemy=towerEnemyData(floor);
  return [
    ['방어력', big(enemy.armor)],
    ['체력', big(enemy.hp)],
    ['실드', big(enemy.shield)],
    ['물량', big(enemy.count)]
  ];
}
function formatTowerEnemySummary(floor){
  return towerEnemySummaryItems(floor).map(([label,value])=>`${label} ${value}`).join('   ');
}
function formatTowerEnemySummaryHtml(floor){
  return towerEnemySummaryItems(floor)
    .map(([label,value])=>`<span class="dps-tower-enemy-item"><em>${label}</em><b>${value}</b></span>`)
    .join('');
}
function buildDpsTowerTable(){
  const minDps=parseDpsTableMinDps();
  const currentDiff=vs('diff');
  const currentFloor=Math.max(1, Math.round(v('round') || 1));
  const range=getDpsTableTowerRange();
  const groupSize=getDpsTableTowerGroupSize();
  const chunks=chunkDpsTowerFloors(range.min, range.max, groupSize);
  const blocks=chunks.map(floors=>{
    const rows=floors.map(floor=>{
      const value=computeDpsPreview('도전의 탑', 0, floor);
      const danger=minDps!==null && dpsTableRiskCompareValue(value)<=minDps;
      const currentCell=currentDiff==='도전의 탑' && currentFloor===floor;
      const classes=[danger?'dps-risk-cell':'', currentCell?'dps-current-cell':''].filter(Boolean).join(' ');
      const enemySummary=formatTowerEnemySummary(floor);
      const enemySummaryHtml=formatTowerEnemySummaryHtml(floor);
      return `<tr${currentCell?' class="dps-current-row"':''}><th>${floor}층</th><td class="${classes}" title="${enemySummary}"><b class="dps-tower-value">${formatDpsTableValue(value)}</b><span class="dps-tower-enemy">${enemySummaryHtml}</span></td></tr>`;
    }).join('');
    const first=floors[0], last=floors[floors.length-1];
    return `<div class="dps-tower-block" aria-label="도전의탑 ${first}층부터 ${last}층까지"><table class="dps-matrix dps-tower-matrix"><thead><tr><th>층</th><th>필요 DPS</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
  return `<div class="dps-tower-grid" data-tower-group-size="${groupSize}">${blocks}</div>`;
}
function renderDpsTableModal(){
  const mount=document.getElementById('dpsTableMount');
  const tabs=document.getElementById('dpsTableTabsMount');
  if(!mount) return;
  const round=getDpsTableCurrentRound();
  if(tabs){
    tabs.innerHTML=[
      {key:'round',label:'라운드 기준',sub:`${round}라운드`},
      {key:'tower',label:'도전의탑',sub:'1~90층'}
    ].map(tab=>`
      <button type="button" class="dps-table-tab ${activeDpsTableMode===tab.key?'is-active':''}" data-dps-table-mode="${tab.key}" role="tab" aria-selected="${activeDpsTableMode===tab.key?'true':'false'}">
        <b>${tab.label}</b><span>${tab.sub}</span>
      </button>
    `).join('');
  }
  syncDpsMinDpsInputs();
  const tableHtml=activeDpsTableMode==='tower' ? buildDpsTowerTable() : buildDpsTable(round);
  mount.innerHTML=`<section class="dps-table-panel dps-table-panel-animated"><div class="dps-table-scroll">${tableHtml}</div></section>`;
}
function switchDpsTableMode(mode){
  if(!['round','tower'].includes(mode) || activeDpsTableMode===mode) return;
  activeDpsTableMode=mode;
  renderDpsTableModal();
}
let dpsTowerResizeTimer=0;
window.addEventListener('resize', ()=>{
  if(!isDpsTableOpen() || activeDpsTableMode!=='tower') return;
  clearTimeout(dpsTowerResizeTimer);
  dpsTowerResizeTimer=setTimeout(renderDpsTableModal, 120);
}, {passive:true});
function createDpsTableModal(){
  if(document.getElementById('dpsTableModal')) return;
  const modal=document.createElement('div');
  modal.id='dpsTableModal';
  modal.className='dps-table-modal-shell';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`
    <div class="dps-table-backdrop" data-dps-table-close="1"></div>
    <section class="dps-table-modal" role="dialog" aria-modal="true" aria-labelledby="dpsTableTitle">
      <header class="dps-table-modal-head">
        <div class="dps-table-titlebox">
          <p class="dps-table-kicker">현재 입력값 기준</p>
          <h2 id="dpsTableTitle">DPS표</h2>
        </div>
        <div class="dps-table-tabs" id="dpsTableTabsMount" role="tablist" aria-label="DPS표 기준 선택"></div>
        <label class="dps-table-min-box" for="dpsTableMinDps">
          <span>도전할 최소 DPS</span>
          <input id="dpsTableMinDps" type="text" inputmode="decimal" autocomplete="off" placeholder="예시) 3.0">
        </label>
        <button type="button" class="dps-table-close-btn" data-dps-table-close="1" aria-label="DPS표 닫기">×</button>
      </header>
      <div class="dps-table-modal-body" id="dpsTableMount"></div>
    </section>`;
  document.body.appendChild(modal);
}
function openDpsTable(){
  createDpsTableModal();
  activeDpsTableMode=isTowerDifficulty() ? 'tower' : 'round';
  renderDpsTableModal();
  const modal=document.getElementById('dpsTableModal');
  if(!modal) return;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('dps-table-modal-open');
}
function closeDpsTable(){
  const modal=document.getElementById('dpsTableModal');
  if(!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden','true');
  document.body.classList.remove('dps-table-modal-open');
}
function installDpsTableButton(){
  const target=document.querySelector('.hdr-meta') || document.querySelector('.app-header') || document.body;
  if(!target || document.getElementById('dpsTableOpenBtn')) return;
  const btn=document.createElement('button');
  btn.type='button';
  btn.id='dpsTableOpenBtn';
  btn.className='dps-table-open-btn';
  btn.dataset.action='openDpsTable';
  btn.textContent='DPS표';
  target.insertBefore(btn, target.firstChild);
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
        <b>${item.month}월</b>
        <span>${escapeCompareHtml(item.title)}</span>
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
  return `image/jw/${String(name||'').trim()}.png`;
}
function getJewelImageSrc(name){
  const safeName=encodeURIComponent(String(name||'').trim());
  const key=getJewelImageKey(name);
  const assetUrl=typeof window.dpsAssetUrl==='function' ? window.dpsAssetUrl : null;
  if(assetUrl) return assetUrl(`./image/jw/${safeName}.png`, key);
  const version=encodeURIComponent(window.DPS_BUILD_VERSION || 'dev');
  return `./image/jw/${safeName}.png?v=${version}`;
}
function getJewelImageFallbackSrc(name){
  const key=getJewelImageKey(name);
  if(typeof window.dpsRemoteAssetUrl==='function') return window.dpsRemoteAssetUrl(key, key);
  const safeName=encodeURIComponent(String(name||'').trim());
  const version=encodeURIComponent(window.DPS_BUILD_VERSION || 'dev');
  return `https://sldbox.github.io/dps/image/jw/${safeName}.png?v=${version}`;
}
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
  const imageSrc=getJewelImageSrc(name);
  const fallbackSrc=getJewelImageFallbackSrc(name);
  const fallbackAttr=fallbackSrc && fallbackSrc!==imageSrc ? ` data-fallback-src="${escapeCompareHtml(fallbackSrc)}"` : '';
  return `
    <article class="jewel-card">
      <header class="jewel-card-head">
        <div class="jewel-card-visual" aria-hidden="true">
          <img src="${escapeCompareHtml(imageSrc)}"${fallbackAttr} alt="" loading="lazy" onerror="var f=this.dataset.fallbackSrc;if(f){this.dataset.fallbackSrc='';this.src=f;return;}this.closest('.jewel-card-visual').classList.add('is-missing');this.remove();">
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
function renderMonthRunePanel(info){
  const months=(info.months||[]);
  const content=months.length ? months.map(renderMonthRuneCard).join('') : '<div class="month-rune-empty">이달룬 데이터가 없습니다.</div>';
  return `
    <section class="month-rune-panel is-active" data-month-rune-panel="runes" role="tabpanel" aria-labelledby="monthRuneTabRunes">
      <div class="month-rune-note">${escapeCompareHtml(info.note||'')}</div>
      <div class="month-rune-grid">${content}</div>
    </section>
  `;
}
function renderJewelPanel(items){
  const list=Array.isArray(items)?items:[];
  const content=list.length ? list.map(renderJewelCard).join('') : '<div class="month-rune-empty">쥬얼 데이터가 없습니다.</div>';
  return `
    <section class="month-rune-panel" data-month-rune-panel="jewels" role="tabpanel" aria-labelledby="monthRuneTabJewels" hidden>
      <div class="jewel-grid">${content}</div>
    </section>
  `;
}
function selectMonthRuneModalTab(tabName){
  const modal=document.getElementById('monthRuneModal');
  if(!modal) return;
  const next=tabName==='jewels'?'jewels':'runes';
  modal.querySelectorAll('[data-month-rune-tab]').forEach(btn=>{
    const active=btn.dataset.monthRuneTab===next;
    btn.classList.toggle('is-active',active);
    btn.setAttribute('aria-selected',active?'true':'false');
    btn.tabIndex=active?0:-1;
  });
  modal.querySelectorAll('[data-month-rune-panel]').forEach(panel=>{
    const active=panel.dataset.monthRunePanel===next;
    panel.classList.toggle('is-active',active);
    panel.hidden=!active;
  });
}
function createMonthRuneModal(){
  if(document.getElementById('monthRuneModal')) return;
  const info=(typeof MONTHLY_RUNE_INFO!=='undefined' && MONTHLY_RUNE_INFO) || window.MONTHLY_RUNE_INFO || {months:[]};
  const jewels=(typeof RAW_JEWEL_DATA!=='undefined' && RAW_JEWEL_DATA) || window.RAW_JEWEL_DATA || [];
  const modal=document.createElement('div');
  modal.id='monthRuneModal';
  modal.className='month-rune-modal-shell';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`
    <div class="month-rune-backdrop" data-month-rune-close="1"></div>
    <section class="month-rune-modal" role="dialog" aria-modal="true" aria-labelledby="monthRuneTitle">
      <header class="month-rune-head">
        <h2 id="monthRuneTitle" class="month-rune-sr-title">이달룬 / 쥬얼</h2>
        <div class="month-rune-tabs" role="tablist" aria-label="이달룬과 쥬얼 정보 선택">
          <button type="button" id="monthRuneTabRunes" class="month-rune-tab is-active" data-month-rune-tab="runes" role="tab" aria-selected="true">이달의룬</button>
          <button type="button" id="monthRuneTabJewels" class="month-rune-tab" data-month-rune-tab="jewels" role="tab" aria-selected="false" tabindex="-1">쥬얼</button>
        </div>
        <button type="button" class="month-rune-close" data-month-rune-close="1" aria-label="이달룬/쥬얼 닫기">×</button>
      </header>
      <div class="month-rune-body">
        ${renderMonthRunePanel(info)}
        ${renderJewelPanel(jewels)}
      </div>
    </section>`;
  document.body.appendChild(modal);
}
function openMonthRune(){
  createMonthRuneModal();
  const modal=document.getElementById('monthRuneModal');
  if(!modal) return;
  selectMonthRuneModalTab('runes');
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('month-rune-modal-open');
}
function closeMonthRune(){
  const modal=document.getElementById('monthRuneModal');
  if(!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden','true');
  document.body.classList.remove('month-rune-modal-open');
}
function installMonthRuneButton(){
  const target=document.querySelector('.hdr-meta');
  if(!target || document.getElementById('monthRuneOpenBtn')) return;
  const btn=document.createElement('button');
  btn.type='button';
  btn.id='monthRuneOpenBtn';
  btn.className='month-rune-open-btn';
  btn.dataset.action='openMonthRune';
  btn.textContent='이달룬/쥬얼';
  btn.title='이달룬/쥬얼 정보 보기';
  const excelButton=document.getElementById('excelCompareOpenBtn');
  const nexusLink=target.querySelector('.global-site-link');
  if(excelButton) excelButton.insertAdjacentElement('afterend',btn);
  else if(nexusLink) target.insertBefore(btn,nexusLink);
  else target.appendChild(btn);
}
function bindMonthRuneEvents(){
  document.addEventListener('click',e=>{
    const tab=e.target.closest('[data-month-rune-tab]');
    if(tab){
      selectMonthRuneModalTab(tab.dataset.monthRuneTab);
      return;
    }
    if(e.target.closest('[data-month-rune-close]')) closeMonthRune();
  });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeMonthRune(); });
}
/* ── 8. 비교하기 / 변경값 적용 ── */
let excelCompareWorkbook=null;
let compareBackupState=null;
let compareSourceType=null;
let compareLastResult=null;
let compareActiveFilter='all';
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
  if(eocd<0) throw new Error('올바른 Excel 파일이 아닙니다.');
  const count=readU16(view,eocd+10);
  let pos=readU32(view,eocd+16);
  const decoder=new TextDecoder();
  const entries=new Map();
  for(let i=0;i<count;i++){
    if(readU32(view,pos)!==0x02014b50) throw new Error('Excel ZIP 목록을 읽을 수 없습니다.');
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
    else throw new Error(`지원하지 않는 Excel 압축 방식입니다. (${method})`);
    entries.set(name,data);
    pos+=46+nameLength+extraLength+commentLength;
  }
  return entries;
}
function parseXml(bytes){
  const xml=new TextDecoder('utf-8').decode(bytes);
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror')) throw new Error('Excel XML을 해석하지 못했습니다.');
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
  if(!sheets.length) throw new Error('비교할 Excel 시트를 찾을 수 없습니다.');
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
  const select=document.getElementById(id);
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
  return buildCompareTextRow(kind, '룬 특수 옵션', runeChoiceDisplayFromValues(changeValues), runeChoiceDisplayFromValues(currentValues));
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
function excelDisplayFlag(value){ return excelFlag(value)?'ON':'OFF'; }
function webControlDisplay(id){
  const el=document.getElementById(id);
  if(!el) return '—';
  if(el.type==='checkbox') return el.checked?'ON':'OFF';
  return String(el.value??'');
}
const EXCEL_TITLE_BONUS_MAP={'패왕':'12','패왕+':'13','제왕':'14','제왕+':'15','신황':'16','신황+':'17'};
const EXCEL_RUNE_TYPE_MAP={'AP':'ap','UA':'ua','TD':'td','TD&UA':'harmony','TD＆UA':'harmony','마법공격력':'ap','마법 공격력':'ap','유닛가속':'ua','유닛 가속':'ua','총데미지':'td','총 데미지':'td','총데미지&유닛가속':'harmony','총 데미지 & 유닛 가속':'harmony','총뎀가속':'harmony'};
const EXCEL_NUMERIC_INPUT_IDS=new Set(['sp','xp','bxp','rp','soul','penance','round','titleTdBonus','erosionStack','jewelErosionRes','pbless','team','rAD','rModAD','runeChoiceValue','rAS','rModAS','rCD','rModCD','rCRI','rModCRI','rReinf','addAD','addAS','addCD','addCRI','addAP','addTD','addUA','addDR','addSR','addHR','dpsTableMinDps','enchAD','enchCRI','enchUA','enchTD','enchSR','enchHR','skillDouble','skillRound']);
const EXCEL_SELECT_INPUT_IDS=new Set(['diff','runeChoiceType','rAsc','raceOpt','opt10','opt15','transOpt']);
const COMPARE_VALUE_META={
  sp:{kind:'기본정보',name:'총 SP'},xp:{kind:'기본정보',name:'보유 XP'},bxp:{kind:'기본정보',name:'보유 BXP'},rp:{kind:'기본정보',name:'보유 RP'},soul:{kind:'기본정보',name:'본인 심연의혼'},
  diff:{kind:'기본정보',name:'난이도'},penance:{kind:'기본정보',name:'고행 단계'},round:{kind:'기본정보',name:'목표 라운드'},titleTdBonus:{kind:'기본정보',name:'타이틀 총 데미지'},
  erosionStack:{kind:'기본정보',name:'침식 스텍'},jewelErosionRes:{kind:'기본정보',name:'침식 내성'},pbless:{kind:'기본정보',name:'파워 블레스'},team:{kind:'기본정보',name:'출발지원 인원수'},spBankApply:{kind:'기본정보',name:'SP 은행'},
  rAD:{kind:'룬정보',name:'공격력'},rModAD:{kind:'룬정보',name:'공격력 개조'},runeChoiceType:{kind:'룬정보',name:'룬 특수 옵션'},runeChoiceValue:{kind:'룬정보',name:'룬 특수 옵션'},
  rAS:{kind:'룬정보',name:'공격속도'},rModAS:{kind:'룬정보',name:'공격속도 개조'},rCD:{kind:'룬정보',name:'크리티컬 데미지'},rModCD:{kind:'룬정보',name:'크리티컬 데미지 개조'},rCRI:{kind:'룬정보',name:'크리티컬 확률'},rModCRI:{kind:'룬정보',name:'크리티컬 확률 개조'},
  rReinf:{kind:'룬정보',name:'룬 강화 수'},rAsc:{kind:'룬정보',name:'룬 각성'},raceOpt:{kind:'룬정보',name:'종족 업그레이드'},opt10:{kind:'룬정보',name:'10강 옵션'},opt15:{kind:'룬정보',name:'15강 옵션'},transOpt:{kind:'룬정보',name:'초월 옵션'},
  addAD:{kind:'에디셔널',name:'공격력'},addAS:{kind:'에디셔널',name:'공격속도'},addCD:{kind:'에디셔널',name:'크리티컬 데미지'},addCRI:{kind:'에디셔널',name:'크리티컬 확률'},addAP:{kind:'에디셔널',name:'마법공격력'},addTD:{kind:'에디셔널',name:'총 데미지'},addUA:{kind:'에디셔널',name:'유닛 가속'},addDR:{kind:'에디셔널',name:'방어력 감소'},addSR:{kind:'에디셔널',name:'실드 감소'},addHR:{kind:'에디셔널',name:'체력 감소'},
  currentUnit:{kind:'유닛정보',name:'현재 유닛'},personalUnit:{kind:'유닛정보',name:'개인 유닛'},unitGrade:{kind:'유닛정보',name:'유닛 등급'},unitLevel:{kind:'유닛정보',name:'유닛 레벨'},
  unitUniqueBuff:{kind:'룬효과/버프',name:'단일유닛버프'},basePierceBuff:{kind:'룬효과/버프',name:'방어력관통 10%'},overEnhance:{kind:'룬효과/버프',name:'오버핸스'},repairEnhance:{kind:'룬효과/버프',name:'리페핸스'},enhanceMaster:{kind:'룬효과/버프',name:'강화의 달인'},
  shareUserBuff:{kind:'룬효과/버프',name:'나눔유저'},dailyCouponBuff:{kind:'룬효과/버프',name:'일일쿠폰'},aprRuneNormal:{kind:'룬효과/버프',name:'4월 일반'},aprRunePlus:{kind:'룬효과/버프',name:'4월 강화(+)'},sepRuneNormal:{kind:'룬효과/버프',name:'9월 일반'},sepRunePlus:{kind:'룬효과/버프',name:'9월 강화(+)'},
  prodNova:{kind:'룬효과/버프',name:'노바'},prodTeratron:{kind:'룬효과/버프',name:'테라트론'},prodAmon:{kind:'룬효과/버프',name:'아몬'},prodAdun:{kind:'룬효과/버프',name:'아둔의 창'},prodKerrigan:{kind:'룬효과/버프',name:'불새 케리건'},prodOvermind:{kind:'룬효과/버프',name:'초월체'},prodNarud:{kind:'룬효과/버프',name:'나루드'},prodArtifact:{kind:'룬효과/버프',name:'유물'},
  flowerSkill1:{kind:'룬효과/버프',name:'근성의 꽃가루'},flowerSkill2:{kind:'룬효과/버프',name:'바람의 꽃가루'},flowerSkill3:{kind:'룬효과/버프',name:'안개의 꽃가루'},
  optTier:{kind:'특성보드',name:'특성 최적화 범위'},utilOptTier:{kind:'특성보드',name:'유틸 최적화 범위'},
  skillDouble:{kind:'성소스킬보드',name:'더블스페'},skillMode:{kind:'성소스킬보드',name:'모드'},skillRound:{kind:'성소스킬보드',name:'라운드'},
  traitLimitAD:{kind:'특성보드 / 특성 투자 제한',name:'공격력'},traitLimitAS:{kind:'특성보드 / 특성 투자 제한',name:'공격속도'},traitLimitCRI:{kind:'특성보드 / 특성 투자 제한',name:'크리티컬 확률'},traitLimitCD:{kind:'특성보드 / 특성 투자 제한',name:'크리티컬 데미지'},
  traitLimitMC:{kind:'특성보드 / 특성 투자 제한',name:'다중 크리'},traitLimitDR:{kind:'특성보드 / 특성 투자 제한',name:'방어력 감소'},traitLimitTD:{kind:'특성보드 / 특성 투자 제한',name:'총 데미지'},traitLimitUA:{kind:'특성보드 / 특성 투자 제한',name:'유닛 가속'},
  traitLimitMultiTarget:{kind:'특성보드 / 특성 투자 제한',name:'멀티타겟'},traitLimitInfinite:{kind:'특성보드 / 특성 투자 제한',name:'무한특성'},
  dpsTableMinDps:{kind:'DPS표',name:'도전할 최소 DPS'}
};
const ENCHANT_COMPARE_ITEMS=[['enchAD','공격력'],['enchCRI','크리티컬 확률'],['enchUA','유닛 가속'],['enchTD','총 데미지'],['enchSR','실드 감소'],['enchHR','체력 감소']];
const LATEST_SPEC_ADDITIONAL_LABELS=[['Q36','AD'],['Q37','AS'],['Q38','CD'],['Q39','CRI'],['Q40','AP'],['Q41','TD'],['Q42','UA']];
const SPEC_ADDITIONAL_CELLS={addAD:'R36',addAS:'R37',addCD:'R38',addCRI:'R39',addAP:'R40',addTD:'R41',addUA:'R42'};
function normalizeStructureText(value){
  return excelText(value).replace(/\s+/g,'').toLowerCase();
}
function inspectSpecAdditionalStructure(specCells){
  const mismatches=LATEST_SPEC_ADDITIONAL_LABELS.filter(([ref,expected])=>
    normalizeStructureText(specCells[ref])!==normalizeStructureText(expected)
  ).map(([ref,expected])=>({ref,expected,actual:excelText(specCells[ref])||'값 없음'}));
  return { valid:mismatches.length===0, mismatches, message:'불러온 Excel 파일은 5.4392 버전과 구조가 달라 비교하기 기능을 사용할 수 없습니다.' };
}
function getSpecAdditionalValue(specCells, id){
  const ref=SPEC_ADDITIONAL_CELLS[id];
  const value=ref ? specCells[ref] : id.startsWith('add') ? 0 : undefined;
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
function buildExcelEnchantRows(specCells){
  return buildEnchantCompareRows(getSpecEnchantCode(specCells),webControlDisplay('enchantCode'));
}
function applyRuneChoiceState(values, cells){
  const type=excelStateValue('runeChoiceType', cells.I6, {valueMap:EXCEL_RUNE_TYPE_MAP}) || 'harmony';
  const value=excelNumber(cells.J6) ?? 0;
  values.runeChoiceType=type;
  values.runeChoiceValue=String(value);
  RUNE_CHOICE_TARGETS.forEach(([kind,id])=>{ values[id]=String(kind===type ? value : 0); });
}
function buildExcelChoiceRow(name, excel, id, options={}){
  const changeValue=options.boolean ? excelDisplayFlag(excel) : String(excel??'');
  const currentValue=options.boolean ? webControlDisplay(id) : webControlDisplay(id);
  return buildCompareTextRow('룬효과/버프',name,changeValue,currentValue,{id});
}
function compareExcelInputValue(value,id){
  if(EXCEL_NUMERIC_INPUT_IDS.has(id)) return formatCompareNumber(value);
  if(EXCEL_SELECT_INPUT_IDS.has(id) && (value===undefined || value===null || String(value).trim()==='')){
    const el=document.getElementById(id);
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
    ['기본정보','타이틀 총 데미지',EXCEL_TITLE_BONUS_MAP[excelText(specCells.S17)]??specCells.S17,'titleTdBonus'],
    ['기본정보','침식 스텍',cells.H10,'erosionStack'],
    ['기본정보','침식 내성',cells.H11,'jewelErosionRes'],
    ['기본정보','파워 블레스',excelPowerBlessStateValue(cells.H16,cells.D4),'pbless'],
    ['기본정보','출발지원 인원수',cells.D5,'team'],
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
const ZERO_EXCEL_SHEET_NAME='더제로 승단';
const ZERO_EXCEL_PENANCE_ROWS=[
  'Practice','Very Easy','Easy','Normal','Hard','Very Hard','Hell','Inferno','Lunatic','Holic','Epic','Ultimate','Impossible','The Final'
].map((name,index)=>({name,row:13+index}));
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
    type:'tower',
    current:String(Math.max(0,Math.min(90,Math.round(excelNumber(zeroCells.B27) ?? 0)))),
    target:String(Math.max(0,Math.min(90,Math.round(excelNumber(zeroCells.C27) ?? 0)))),
    star:false,currentHonor:'',targetHonor:''
  });
  rows.push({
    type:'honorTower',
    current:String(Math.max(0,Math.min(90,Math.round(excelNumber(zeroCells.B28) ?? 0)))),
    target:String(Math.max(0,Math.min(90,Math.round(excelNumber(zeroCells.C28) ?? 0)))),
    star:false,currentHonor:'',targetHonor:''
  });
  return {rows};
}
function zeroScoreRowCalculation(row){
  const type=row?.type || 'penance';
  let currentScore=0, targetScore=0, score=0;
  if(type==='penance'){
    const cur=zeroScoreNumber(row.current,0,20);
    const tar=zeroScoreNumber(row.target,0,20);
    const currentPenanceScore=zeroPenanceScore(cur);
    const targetPenanceScore=zeroPenanceScore(tar);
    const currentHonorScore=zeroHonorScore(row.currentHonor||'');
    const targetHonorScore=zeroHonorScore(row.targetHonor||'');
    const star=row.star ? 2 : 0;
    currentScore=currentPenanceScore+currentHonorScore+star;
    targetScore=targetPenanceScore+targetHonorScore;
    score=Math.max(0,targetPenanceScore-currentPenanceScore)+Math.max(0,targetHonorScore-currentHonorScore);
  }else if(type==='tower'){
    currentScore=zeroTowerScore(row.current);
    targetScore=zeroTowerScore(row.target);
    score=Math.max(0,targetScore-currentScore);
  }else if(type==='honorTower'){
    currentScore=zeroHonorTowerScore(row.current);
    targetScore=zeroHonorTowerScore(row.target);
    score=Math.max(0,targetScore-currentScore);
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
function compareZeroTextRow(name, changeValue, currentValue){
  return buildCompareTextRow('승단계산',name,changeValue,currentValue);
}
function compareZeroNumberRow(kind,name,changeValue,currentValue){
  return buildCompareNumberRow(kind,name,changeValue,currentValue,0.0001);
}
function buildZeroScoreCompareRows(zeroCells){
  if(!zeroCells) return [];
  const webState=collectZeroScoreState() || {rows:[]};
  const rows=[];
  ZERO_EXCEL_PENANCE_ROWS.forEach(({name,row},index)=>{
    const web=webState.rows[index] || {};
    const webCalc=zeroScoreRowCalculation(web);
    rows.push(compareZeroNumberRow('승단계산',`${name} 현재 고행`,zeroCells[`B${row}`],web.current ?? 0));
    rows.push(compareZeroNumberRow('승단계산',`${name} 목표 고행`,zeroCells[`C${row}`],web.target ?? 0));
    rows.push(compareZeroTextRow(`${name} 24스타`,excelFlag(zeroCells[`D${row}`])?'ON':'OFF',web.star?'ON':'OFF'));
    rows.push(compareZeroTextRow(`${name} 현재 명예`,zeroHonorDisplay(normalizeZeroHonorValue(zeroCells[`E${row}`])),zeroHonorDisplay(web.currentHonor||'')));
    rows.push(compareZeroTextRow(`${name} 목표 명예`,zeroHonorDisplay(normalizeZeroHonorValue(zeroCells[`F${row}`])),zeroHonorDisplay(web.targetHonor||'')));
    rows.push(compareZeroNumberRow('승단계산 결과',`${name} 추가점수`,zeroCells[`G${row}`],webCalc.score));
  });
  const towerWeb=webState.rows[14] || {};
  const honorTowerWeb=webState.rows[15] || {};
  rows.push(compareZeroNumberRow('승단계산','도전의 탑 현재층',zeroCells.B27,towerWeb.current ?? 0));
  rows.push(compareZeroNumberRow('승단계산','도전의 탑 목표층',zeroCells.C27,towerWeb.target ?? 0));
  rows.push(compareZeroNumberRow('승단계산 결과','도전의 탑 추가점수',zeroCells.G27,zeroScoreRowCalculation(towerWeb).score));
  rows.push(compareZeroNumberRow('승단계산','명예 도탑 현재층',zeroCells.B28,honorTowerWeb.current ?? 0));
  rows.push(compareZeroNumberRow('승단계산','명예 도탑 목표층',zeroCells.C28,honorTowerWeb.target ?? 0));
  rows.push(compareZeroNumberRow('승단계산 결과','명예 도탑 추가점수',zeroCells.G28,zeroScoreRowCalculation(honorTowerWeb).score));
  const webSummary=zeroScoreSummaryFromState(webState);
  rows.push(compareZeroNumberRow('승단계산 결과','현재 승단점수',zeroCells.H28,webSummary.currentTotal));
  rows.push(compareZeroNumberRow('승단계산 결과','목표 완료 시',zeroCells.I28,webSummary.targetScore));
  return rows;
}
function validateExcelCompareSheet(cells,sheetName){
  if(!Number.isFinite(Number(cells.M19))||!Number.isFinite(Number(cells.L4))){
    throw new Error(`"${sheetName}" 시트는 현재 계산기와 비교할 수 있는 셀 구조가 아닙니다.`);
  }
}
function buildExcelStatRows(cells,stats){
  return EXCEL_COMPARE_STATS.map(([code,name,displayCell,actualCell,getDisplay])=>{
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
  const stats=computeStats();
  const dpsCompare=compareNumber(cells.M19,stats.M19);
  const inputRows=buildExcelInputRows(cells,specCells);
  const enchantRows=buildExcelEnchantRows(specCells);
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
function createExcelCompareModal(){
  if(document.getElementById('excelCompareModal')) return;
  const modal=document.createElement('div');
  modal.id='excelCompareModal';
  modal.className='excel-compare-shell';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`
    <div class="excel-compare-backdrop" data-excel-compare-close="1"></div>
    <section class="excel-compare-modal" role="dialog" aria-modal="true" aria-labelledby="excelCompareTitle">
      <header class="excel-compare-head">
        <div><p>불러온 파일의 저장값 기준</p><h2 id="excelCompareTitle">비교하기</h2></div>
        <div class="excel-compare-controls">
          <select id="excelCompareSheet" aria-label="비교할 시트 또는 백업 데이터" disabled><option>시트 선택</option></select>
          <label class="excel-compare-file-btn">파일 선택<input id="excelCompareFile" type="file" accept=".xlsm,.xlsx,.json,.txt,application/json,text/plain,application/vnd.ms-excel.sheet.macroEnabled.12"></label>
          <button id="excelCompareApplyBtn" class="excel-compare-apply-btn" type="button" data-excel-compare-apply="1" disabled>변경값 적용</button>
          <button id="excelCompareResetBtn" class="excel-compare-reset-btn" type="button" data-excel-compare-reset="1" disabled>초기화</button>
        </div>
        <button type="button" class="excel-compare-close" data-excel-compare-close="1" aria-label="비교하기 닫기">×</button>
      </header>
      <div class="excel-compare-body" id="excelCompareBody">
        <div class="excel-compare-empty">비교할 Excel 또는 웹백업 파일을 선택하세요.<small>Excel 파일은 시트를 선택할 수 있고, 웹백업 파일은 백업 데이터를 바로 비교합니다.</small></div>
      </div>
    </section>`;
  document.body.appendChild(modal);
}
function renderExcelWarning(item){
  return escapeCompareHtml(item).replace('5.4392','<span class="excel-compare-version">5.4392</span>');
}
const COMPARE_FILTER_LABELS={all:'전체 보기',stat:'스탯 차이',input:'입력값 차이',buff:'룬/버프 차이',trait:'특성 차이',zero:'승단 차이'};
const COMPARE_INPUT_EXCLUDE_KINDS=new Set(['DPS','스탯','룬효과/버프','특성','승단계산','승단계산 결과']);
function compareSummaryCard(filter,label,count,active){
  const isAll=filter==='all';
  const stateClass=isAll ? 'same is-all' : count ? 'diff' : 'same';
  const selectedClass=active===filter ? 'is-active' : '';
  const valueText=`${count}개`;
  const content=isAll
    ? `<span>${label}</span>`
    : `<span>${label}</span><b>${valueText}</b>`;
  return `<button type="button" class="excel-compare-summary-card ${stateClass} ${selectedClass}" data-excel-compare-filter="${filter}" aria-pressed="${active===filter?'true':'false'}">${content}</button>`;
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
function compareFilterEmptyMessage(filter){
  if(filter==='all') return '현재값과 불러온 값이 모두 일치합니다.';
  return `${COMPARE_FILTER_LABELS[filter] || '선택한 구분'} 항목에서 차이 난 값이 없습니다.`;
}
function renderExcelComparison(result,options={}){
  const body=document.getElementById('excelCompareBody');
  if(!body) return;
  compareLastResult=result;
  if(!options.preserveFilter) compareActiveFilter='all';
  const active=COMPARE_FILTER_LABELS[compareActiveFilter] ? compareActiveFilter : 'all';
  compareActiveFilter=active;
  const {summary}=result;
  const compareColgroup='<colgroup><col class="compare-col-kind"><col class="compare-col-name"><col class="compare-col-current"><col class="compare-col-change"><col class="compare-col-diff"></colgroup>';
  const visibleRows=(result.rows||[]).filter(row=>compareRowMatchesFilter(row,active));
  const tableRows=visibleRows.map(row=>`<tr class="${row.status}"><td>${escapeCompareHtml(row.kind)}</td><th>${escapeCompareHtml(row.name)}</th><td>${row.current}</td><td>${row.change}</td><td class="compare-diff ${row.diffClass||''}">${row.difference}</td></tr>`).join('') || `<tr class="same"><td colspan="5" class="excel-compare-no-diff">${escapeCompareHtml(compareFilterEmptyMessage(active))}</td></tr>`;
  body.innerHTML=`
    <div class="excel-compare-summary">
      ${compareSummaryCard('all','전체 보기',0,active)}
      ${compareSummaryCard('stat','스탯 차이',summary.statDiffs||0,active)}
      ${compareSummaryCard('input','입력값 차이',summary.inputDiffs||0,active)}
      ${compareSummaryCard('buff','룬/버프 차이',summary.buffDiffs||0,active)}
      ${compareSummaryCard('trait','특성 차이',summary.traitDiffs||0,active)}
      ${compareSummaryCard('zero','승단 차이',summary.zeroDiffs||0,active)}
    </div>
    <div class="excel-compare-table-wrap">
      <table class="excel-compare-table excel-compare-table-head">${compareColgroup}<thead><tr><th>구분</th><th>항목</th><th>현재값</th><th>변경값</th><th>차이</th></tr></thead></table>
      <div class="excel-compare-table-scroll">
        <table class="excel-compare-table excel-compare-table-body">${compareColgroup}<tbody>${tableRows}</tbody></table>
      </div>
    </div>`;
}
function openExcelCompare(){
  createExcelCompareModal();
  const modal=document.getElementById('excelCompareModal');
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('excel-compare-open');
  const select=document.getElementById('excelCompareSheet');
  if(compareSourceType==='json' && compareBackupState) renderJsonComparison(compareBackupState);
  else if(excelCompareWorkbook && select && !select.disabled && select.value) compareSelectedExcelSheet();
}
function closeExcelCompare(){
  const modal=document.getElementById('excelCompareModal');
  if(!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden','true');
  document.body.classList.remove('excel-compare-open');
}
function resetExcelComparison(options={}){
  excelCompareWorkbook=null;
  compareBackupState=null;
  compareSourceType=null;
  compareLastResult=null;
  compareActiveFilter='all';
  const select=document.getElementById('excelCompareSheet');
  const file=document.getElementById('excelCompareFile');
  const apply=document.getElementById('excelCompareApplyBtn');
  const reset=document.getElementById('excelCompareResetBtn');
  const body=document.getElementById('excelCompareBody');
  if(select){
    select.innerHTML='<option>시트 선택</option>';
    select.disabled=true;
  }
  if(file) file.value='';
  if(apply) apply.disabled=true;
  if(reset) reset.disabled=true;
  if(body) body.innerHTML='<div class="excel-compare-empty">비교할 Excel 또는 웹백업 파일을 선택하세요.<small>Excel 파일은 시트를 선택할 수 있고, 웹백업 파일은 백업 데이터를 바로 비교합니다.</small></div>';
  if(options.close) closeExcelCompare();
}
function excelText(value){ return String(value??'').trim(); }
function excelNumber(value){
  const number=Number(String(value??'').replace(/,/g,'').trim());
  return Number.isFinite(number) ? number : null;
}
function resolveExcelSelectValue(id, value){
  const select=document.getElementById(id);
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
  const el=document.getElementById(id);
  if(!el || value===undefined || value===null || value==='') return undefined;
  if(typeof TRAIT_LIMIT_INPUT_IDS!=='undefined' && TRAIT_LIMIT_INPUT_IDS.has(id)){
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
  const values={...state.values};
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
    ['currentUnit',cells.F37],['personalUnit',cells.E11],
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
    ['addUA',getSpecAdditionalValue(specCells,'addUA')],['addDR',getSpecAdditionalValue(specCells,'addDR')],
    ['addSR',getSpecAdditionalValue(specCells,'addSR')],['addHR',getSpecAdditionalValue(specCells,'addHR')]
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
  if(zeroScore?.rows?.length) applied+=zeroScore.rows.reduce((sum,row)=>sum+(row.type==='penance'?5:2),0);
  return {state:makeStorageEnvelope({...state,values,inv,zeroScore}),applied};
}

function isCompareBackupFile(file){
  const name=String(file?.name||'').toLowerCase();
  const type=String(file?.type||'').toLowerCase();
  return name.endsWith('.json') || name.endsWith('.txt') || type.includes('json') || type.startsWith('text/');
}
function readFileAsText(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=()=>reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsText(file,'utf-8');
  });
}
async function readCompareBackupState(file){
  const raw=await readFileAsText(file);
  const parsed=safeJsonParse(raw);
  if(!parsed) throw new Error('웹백업 파일 형식이 아닙니다.');
  const state=normalizeSavedState(parsed);
  if(!state) throw new Error('계산기 저장값 형식이 아닙니다.');
  return {...state,fileName:file.name};
}
function compareValueMeta(id){
  return COMPARE_VALUE_META[id] || {kind:'입력값',name:id};
}
function isCompareNumericValueId(id){
  if(EXCEL_NUMERIC_INPUT_IDS.has(id)) return true;
  const el=document.getElementById(id);
  return el?.tagName==='INPUT' && String(el.type||'').toLowerCase()==='number';
}
function compareSavedValueDisplay(value,id){
  if(typeof TRAIT_LIMIT_INPUT_IDS!=='undefined' && TRAIT_LIMIT_INPUT_IDS.has(id)) return traitLimitDisplayText(value);
  if(id==='spBankApply') return normalizeSpBankApplyValue(value);
  if(isCompareNumericValueId(id)) return formatCompareNumber(value);
  return compareDisplayText(value,id);
}
function buildSavedValueCompareRows(changeState,currentState,options={}){
  const onlyDiffs=options.onlyDiffs!==false;
  const ordered=userStateElementIds();
  const skipped=new Set(['backupFileInput','excelCompareFile','excelCompareSheet','enchantCode','runeChoiceType','runeChoiceValue',...ENCHANT_INPUT_IDS]);
  const ids=[...new Set([...ordered,'dpsTableMinDps',...Object.keys(currentState.values||{}),...Object.keys(changeState.values||{})])]
    .filter(id=>id && !skipped.has(id) && isUserStateValueId(id));
  const rows=[];
  const runeRow=buildRuneChoiceCompareRow('룬정보', changeState.values||{}, currentState.values||{});
  if(!onlyDiffs || runeRow.status!=='same') rows.push(runeRow);
  ids.forEach(id=>{
    const meta=compareValueMeta(id);
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
function buildSavedZeroScoreCompareRows(changeZeroScore,currentZeroScore,options={}){
  const onlyDiffs=options.onlyDiffs!==false;
  const changeRows=Array.isArray(changeZeroScore?.rows) ? changeZeroScore.rows : [];
  const currentRows=Array.isArray(currentZeroScore?.rows) ? currentZeroScore.rows : [];
  const rows=[];
  ZERO_EXCEL_PENANCE_ROWS.forEach(({name},index)=>{
    const change=changeRows[index] || {};
    const current=currentRows[index] || {};
    const currentCalc=zeroScoreRowCalculation(current);
    const changeCalc=zeroScoreRowCalculation(change);
    rows.push(compareZeroNumberRow('승단계산',`${name} 현재 고행`,change.current ?? 0,current.current ?? 0));
    rows.push(compareZeroNumberRow('승단계산',`${name} 목표 고행`,change.target ?? 0,current.target ?? 0));
    rows.push(compareZeroTextRow(`${name} 24스타`,change.star?'ON':'OFF',current.star?'ON':'OFF'));
    rows.push(compareZeroTextRow(`${name} 현재 명예`,zeroHonorDisplay(change.currentHonor||''),zeroHonorDisplay(current.currentHonor||'')));
    rows.push(compareZeroTextRow(`${name} 목표 명예`,zeroHonorDisplay(change.targetHonor||''),zeroHonorDisplay(current.targetHonor||'')));
    rows.push(compareZeroNumberRow('승단계산 결과',`${name} 추가점수`,changeCalc.score,currentCalc.score));
  });
  const changeTower=changeRows[14] || {}, currentTower=currentRows[14] || {};
  const changeHonorTower=changeRows[15] || {}, currentHonorTower=currentRows[15] || {};
  rows.push(compareZeroNumberRow('승단계산','도전의 탑 현재층',changeTower.current ?? 0,currentTower.current ?? 0));
  rows.push(compareZeroNumberRow('승단계산','도전의 탑 목표층',changeTower.target ?? 0,currentTower.target ?? 0));
  rows.push(compareZeroNumberRow('승단계산 결과','도전의 탑 추가점수',zeroScoreRowCalculation(changeTower).score,zeroScoreRowCalculation(currentTower).score));
  rows.push(compareZeroNumberRow('승단계산','명예 도탑 현재층',changeHonorTower.current ?? 0,currentHonorTower.current ?? 0));
  rows.push(compareZeroNumberRow('승단계산','명예 도탑 목표층',changeHonorTower.target ?? 0,currentHonorTower.target ?? 0));
  rows.push(compareZeroNumberRow('승단계산 결과','명예 도탑 추가점수',zeroScoreRowCalculation(changeHonorTower).score,zeroScoreRowCalculation(currentHonorTower).score));
  const changeSummary=zeroScoreSummaryFromState({rows:changeRows});
  const currentSummary=zeroScoreSummaryFromState({rows:currentRows});
  rows.push(compareZeroNumberRow('승단계산 결과','현재 승단점수',changeSummary.currentTotal,currentSummary.currentTotal));
  rows.push(compareZeroNumberRow('승단계산 결과','목표 완료 시',changeSummary.targetScore,currentSummary.targetScore));
  return onlyDiffs ? rows.filter(row=>row.status!=='same') : rows;
}
function snapshotComparisonState(changeState,currentState){
  const restoreState=currentState || makeStateObject();
  applyStateObject(changeState);
  try{
    return {state:makeStateObject(),stats:computeStats()};
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
function buildJsonComparison(changeState){
  const currentState=makeStateObject();
  const currentStats=computeStats();
  const changeSnapshot=snapshotComparisonState(changeState,currentState);
  const effectiveChangeState={...changeSnapshot.state,fileName:changeState.fileName || changeSnapshot.state.fileName};
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
    fileName:effectiveChangeState.fileName || '웹백업',
    sheetName:'웹백업',
    sourceType:'json',
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
  if(compareSourceType==='json') return applySelectedJsonBackup();
  return applySelectedExcelSheet();
}
function applySelectedJsonBackup(){
  if(!compareBackupState) return;
  try{
    applyStateObject(compareBackupState);
    const saved=saveState({silent:true});
    if(saved===false) throw new Error('변경값은 적용했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.');
    renderJsonComparison(compareBackupState);
    showToast('변경값 적용 완료','ok');
  }catch(e){
    console.error('[backup apply failed]',e);
    showToast(e?.message||String(e),'err');
  }
}
function applySelectedExcelSheet(){
  const select=document.getElementById('excelCompareSheet');
  if(!excelCompareWorkbook||!select?.value) return;
  try{
    const cells=excelCompareWorkbook.getCells(select.value);
    validateExcelCompareSheet(cells,select.value);
    const specCells=excelCompareWorkbook.getCells('스펙');
    const zeroCells=getZeroScoreSheetCells(excelCompareWorkbook);
    const additionalInfo=inspectSpecAdditionalStructure(specCells);
    if(!additionalInfo.valid) throw new Error(additionalInfo.message);
    const imported=buildExcelState(cells,specCells,zeroCells);
    applyStateObject(imported.state);
    saveState({silent:true});
    compareSelectedExcelSheet();
    showToast(`변경값 ${imported.applied}개 적용 완료`,'ok');
  }catch(e){
    console.error('[Excel apply failed]',e);
    showToast(e?.message||String(e),'err');
  }
}
function compareSelectedExcelSheet(){
  const select=document.getElementById('excelCompareSheet');
  if(!excelCompareWorkbook||!select?.value) return;
  const body=document.getElementById('excelCompareBody');
  const apply=document.getElementById('excelCompareApplyBtn');
  const reset=document.getElementById('excelCompareResetBtn');
  try{
    const cells=excelCompareWorkbook.getCells(select.value);
    const specCells=excelCompareWorkbook.getCells('스펙');
    const zeroCells=getZeroScoreSheetCells(excelCompareWorkbook);
    const additionalInfo=inspectSpecAdditionalStructure(specCells);
    if(!additionalInfo.valid){
      if(apply) apply.disabled=true;
      if(reset) reset.disabled=false;
      if(body) body.innerHTML=`<div class="excel-compare-error">${renderExcelWarning(additionalInfo.message)}</div>`;
      return;
    }
    compareSourceType='excel';
    renderExcelComparison(buildExcelComparison(cells,specCells,zeroCells,excelCompareWorkbook.fileName,select.value));
    if(apply) apply.disabled=false;
    if(reset) reset.disabled=false;
  }catch(e){
    console.error('[Excel compare failed]',e);
    if(apply) apply.disabled=true;
    if(reset) reset.disabled=false;
    if(body) body.innerHTML=`<div class="excel-compare-error">${escapeCompareHtml(e?.message||String(e))}</div>`;
  }
}
async function handleExcelCompareFile(file){
  const body=document.getElementById('excelCompareBody');
  if(body) body.innerHTML='<div class="excel-compare-empty">파일을 분석하고 있습니다.</div>';
  try{
    const select=document.getElementById('excelCompareSheet');
    const apply=document.getElementById('excelCompareApplyBtn');
    const reset=document.getElementById('excelCompareResetBtn');
    if(isCompareBackupFile(file)){
      compareBackupState=await readCompareBackupState(file);
      compareSourceType='json';
      excelCompareWorkbook=null;
      if(select){
        select.innerHTML='<option value="webBackup">웹백업</option>';
        select.value='webBackup';
        select.disabled=true;
      }
      renderJsonComparison(compareBackupState);
      if(apply) apply.disabled=false;
      if(reset) reset.disabled=false;
      return;
    }
    excelCompareWorkbook=await readExcelWorkbook(file);
    compareBackupState=null;
    compareSourceType='excel';
    const preferred=excelCompareWorkbook.sheets.some(sheet=>sheet.name==='고행')?'고행':excelCompareWorkbook.sheets[0].name;
    select.innerHTML=excelCompareWorkbook.sheets.map(sheet=>`<option value="${escapeCompareHtml(sheet.name)}">${escapeCompareHtml(sheet.name)}</option>`).join('');
    select.disabled=false;
    select.value=preferred;
    if(reset) reset.disabled=false;
    compareSelectedExcelSheet();
  }catch(e){
    console.error('[compare file failed]',e);
    const apply=document.getElementById('excelCompareApplyBtn');
    const reset=document.getElementById('excelCompareResetBtn');
    if(apply) apply.disabled=true;
    if(reset) reset.disabled=true;
    if(body) body.innerHTML=`<div class="excel-compare-error">${escapeCompareHtml(e?.message||String(e))}</div>`;
  }
}
function installExcelCompareButton(){
  const target=document.querySelector('.hdr-meta');
  if(!target||document.getElementById('excelCompareOpenBtn')) return;
  const btn=document.createElement('button');
  btn.type='button';
  btn.id='excelCompareOpenBtn';
  btn.className='excel-compare-open-btn';
  btn.dataset.action='openExcelCompare';
  btn.textContent='비교하기';
  const dpsButton=document.getElementById('dpsTableOpenBtn');
  if(dpsButton) dpsButton.insertAdjacentElement('afterend',btn);
  else target.insertBefore(btn,target.firstChild);
}
function bindExcelCompareEvents(){
  document.addEventListener('click',e=>{
    const filterTarget=e.target.closest('[data-excel-compare-filter]');
    if(filterTarget){
      compareActiveFilter=filterTarget.getAttribute('data-excel-compare-filter') || 'all';
      if(compareLastResult) renderExcelComparison(compareLastResult,{preserveFilter:true});
      return;
    }
    if(e.target.closest('[data-excel-compare-close]')) closeExcelCompare();
    if(e.target.closest('[data-excel-compare-apply]')) applySelectedComparison();
    if(e.target.closest('[data-excel-compare-reset]')) resetExcelComparison();
  });
  document.addEventListener('change',e=>{
    if(e.target.id==='excelCompareFile'&&e.target.files?.[0]){
      const selectedFile=e.target.files[0];
      handleExcelCompareFile(selectedFile).finally(()=>{ e.target.value=''; });
    }
    if(e.target.id==='excelCompareSheet' && compareSourceType==='excel') compareSelectedExcelSheet();
  });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeExcelCompare(); });
}
function bindDpsTableEvents(){
  document.addEventListener('click', function(e){
    const modeTarget=e.target.closest('[data-dps-table-mode]');
    if(modeTarget){
      switchDpsTableMode(modeTarget.getAttribute('data-dps-table-mode'));
      return;
    }
    if(e.target.closest('[data-dps-table-close]')) closeDpsTable();
  });
  document.addEventListener('input', function(e){
    const minInput=e.target.closest('#dpsTableMinDps,#dpsTableMinDpsMain');
    if(!minInput) return;
    setDpsTableMinDps(minInput.value);
    const fresh=document.getElementById(minInput.id);
    if(fresh){
      fresh.focus({preventScroll:true});
      const pos=fresh.value.length;
      try{ fresh.setSelectionRange(pos,pos); }catch(_e){}
    }
  });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeDpsTable(); });
}
/* ── 9. 특성보드 / 최적화 / 초기화 ── */
const INFINITE_TRAIT_TIER='무한∞';
const TIERS=['루키','비기너','아마추어','프로','엑스퍼트','마스터','디바인','더원1','더원2',INFINITE_TRAIT_TIER,'EP특성','RP특성','심연특성'];
function updateTraits(){
  const body=document.getElementById('traitBody');
  if(!body) return;
  body.innerHTML=TIERS.map(tier=>{
    const rows=TRAITS.filter(t=>t[2]===tier && t[0]!==116).map(t=>{
      const [row,name,,type,rate]=t;
      const n=INV[row]||0, mx=TMAX[row]||999;
      const isMax=n>=mx;
      const cost=nextCost(row);
      const rStr=traitEffectText(row,type,rate);
      return `<div class="tr ${isMax?'maxed':''}">
        <div><div class="tr-name">${name}</div><div class="tr-type">${rStr}${isMax?' · 최대 투자됨':` · 다음비용 ${fullNumber(cost)}`}</div></div>
        <div class="tr-ctrl">
          <button type="button" data-action="traitAdjust" data-row="${row}" data-delta="-1" ${n<=0?'disabled':''} title="길게 누르면 연속 감소">−</button>
          <div class="trait-value-pair">
            <input class="tv-input" type="number" value="${n}" min="0" max="${mx}" data-row="${row}">
            <span class="trait-max-sep">/</span>
            <span class="trait-max-val" title="최대 투자치">${mx}</span>
          </div>
          <button type="button" data-action="traitAdjust" data-row="${row}" data-delta="1" ${isMax?'disabled':''} title="길게 누르면 연속 증가">+</button>
          <button type="button" class="trait-master-btn" data-action="traitMax" data-row="${row}" ${isMax?'disabled':''} title="이 항목을 최대치로 투자">MAX</button>
        </div>
      </div>`;
    }).join('');
    return `<div class="trait-group"><h4><span class="trait-title">${tier}</span><span class="trait-tools"><button type="button" class="mini-btn master" data-action="masterTier" data-tier="${tier}">구간 마스터</button><button type="button" class="mini-btn reset" data-action="resetTier" data-tier="${tier}">초기화</button></span></h4>${rows}</div>`;
  }).join('');
}
let traitKeyNavGuardUntil=0;
function commitTraitInput(el){
  const row=+(el && el.dataset ? el.dataset.row : NaN);
  if(!Number.isFinite(row)) return;
  setInv(row,+el.value);
}
function getTraitScrollHost(){
  return document.querySelector('.col-right') || document.scrollingElement || document.documentElement;
}
function getNextTraitInputRow(el,dir){
  const inputs=Array.from(document.querySelectorAll('.tv-input[data-row]'));
  const idx=inputs.indexOf(el);
  const nextIndex=Math.max(0,Math.min(inputs.length-1,idx+dir));
  return +(inputs[nextIndex]?.dataset?.row ?? el?.dataset?.row);
}
function focusTraitInputRow(row,hostScroll,pageX,pageY){
  const host=getTraitScrollHost();
  const focusNow=()=>{
    const next=document.querySelector(`.tv-input[data-row="${row}"]`);
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
    return true;
  }
  return false;
}
function setInv(row,val){
  if(row===116) return;
  if(isNaN(val)||val<0) val=0;
  const wanted=Math.round(val);
  const applied=setRowToAffordableValue(row,wanted);
  if(applied<wanted) try{showToast('보유 재화 한도까지만 입력되었습니다','err');}catch(e){}
  recalc();
}
function adjMax(row){
  try{
    if(row===116) return false;
    const before=INV[row]||0;
    fillRowToBudget(row);
    recalc();
    try{showToast((INV[row]||0)>before?'가능한 만큼 MAX 적용':'보유 재화가 부족합니다',(INV[row]||0)>before?'ok':'err');}catch(e){}
    return (INV[row]||0)>before;
  }catch(e){
    console.error('[adjMax failed]', e);
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
  try{showToast('구간 초기화 완료','ok');}catch(e){}
}
const UTILITY_OPT_TYPES=new Set(['유틸','경험치','AP','RA']);
const UTILITY_OPT_TIERS=['루키','비기너','아마추어','프로','엑스퍼트','마스터','디바인','더원1','더원2'];
function selectedUtilityOptimizationTierIndex(){
  const target=vs('utilOptTier')||'더원2';
  const idx=UTILITY_OPT_TIERS.indexOf(target);
  return idx>=0 ? idx : UTILITY_OPT_TIERS.indexOf('더원2');
}
function isUtilityOptimizationTrait(t, maxTierIndex=null){
  if(!Array.isArray(t)) return false;
  const row=t[0], tier=t[2], type=t[3];
  if(row===116) return false;
  const tierIdx=UTILITY_OPT_TIERS.indexOf(tier);
  if(tierIdx<0) return false;
  if(maxTierIndex!==null && tierIdx>maxTierIndex) return false;
  return UTILITY_OPT_TYPES.has(type);
}
function utilityRowsBySelectedScope(){
  const idx=selectedUtilityOptimizationTierIndex();
  return TRAITS
    .filter(t=>isUtilityOptimizationTrait(t, idx))
    .map(t=>t[0]);
}
function optimizeUtility(){
  const rows=utilityRowsBySelectedScope();
  if(!rows.length){
    try{showToast('선택 범위에 유틸 특성이 없습니다','err');}catch(e){}
    return false;
  }
  let changed=0;
  rows.forEach(row=>{
    const before=INV[row]||0;
    fillRowToBudget(row);
    if((INV[row]||0)!==before) changed++;
  });
  recalc();
  try{showToast(changed ? '유틸 최적화 완료' : '보유 재화가 부족하거나 이미 최대입니다', changed ? 'ok' : 'err');}catch(e){}
  return changed>0;
}
function clearUtility(){
  const rows=utilityRowsBySelectedScope();
  if(!rows.length){
    try{showToast('선택 범위에 유틸 특성이 없습니다','err');}catch(e){}
    return false;
  }
  let changed=0;
  rows.forEach(row=>{
    if((INV[row]||0)>0){
      INV[row]=0;
      changed++;
    }
  });
  if(116 in INV) INV[116]=1;
  recalc();
  try{showToast(changed ? '유틸 초기화 완료' : '초기화할 유틸 특성이 없습니다', changed ? 'ok' : 'err');}catch(e){}
  return changed>0;
}
function toggleOptimizerGuide(trigger){
  const guide=document.getElementById('optimizerGuide');
  if(!guide) return false;
  const willOpen=guide.hasAttribute('hidden');
  if(willOpen) guide.removeAttribute('hidden');
  else guide.setAttribute('hidden','');
  if(trigger){
    trigger.textContent=willOpen ? '안내 닫기' : '최적화 안내';
    trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }
  return willOpen;
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
  traitLimitAD:'0', traitLimitAS:'0', traitLimitCRI:'0', traitLimitCD:'0', traitLimitMC:'0', traitLimitDR:'0', traitLimitTD:'0', traitLimitUA:'0', traitLimitMultiTarget:'ON', traitLimitInfinite:'ON'
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
  TRAIT_LIMIT_INPUT_IDS.forEach(id=>syncTraitLimitInputDisplay(document.getElementById(id)));
}
function prepareTraitLimitInputForEdit(el){
  if(!el || !TRAIT_LIMIT_INPUT_IDS.has(el.id)) return;
  if(String(el.value).trim()===TRAIT_LIMIT_UNLIMITED_TEXT){
    el.value='';
    el.classList.remove('trait-limit-unlimited');
  }
}
function traitLimitSwitchOn(id){
  const el=document.getElementById(id);
  const fallback=Object.prototype.hasOwnProperty.call(TRAIT_LIMIT_DEFAULTS,id) ? TRAIT_LIMIT_DEFAULTS[id] : 'ON';
  const value=String((el ? el.value : fallback) ?? fallback).trim().toUpperCase();
  return value!=='OFF' && value!=='0' && value!=='FALSE' && value!=='비활성화';
}
function traitLimitAllowsTrait(t){
  if(!Array.isArray(t)) return true;
  const row=+t[0];
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
function evaluateTraitOptimizationCandidate(base, kind, rem, changes, label){
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
  const ns=computeStats();
  const limitsOk=traitLimitStatsOk(ns);
  for(const [row,add] of changes) INV[row]=(INV[row]||0)-add;
  if(!limitsOk) return null;
  const gain=ns.M19-base.M19;
  if(gain<=0 || !traitRecommendationGainIsVisible(gain)) return null;
  const primaryRow=changes[0]?.[0];
  return {changes,primaryRow,kind,score:gain/cost,gain,cost,label:label||traitName(primaryRow)};
}
function critTraitOptimizationCandidate(base, kind, rem, row, rate){
  if((INV[row]||0)>=(TMAX[row]||999)) return null;
  const s=computeStats();
  if(s.M8<300) return null;
  const mod=((s.M8%20)+20)%20;
  const needStat=mod===0 ? 20 : 20-mod;
  const add=Math.ceil(needStat/rate);
  if(add<=0 || (INV[row]||0)+add>(TMAX[row]||999)) return null;
  return evaluateTraitOptimizationCandidate(base, kind, rem, [[row,add]], traitName(row));
}
function traitOptimizationMultiTargetBundleCandidate(base, rem){
  if(!traitLimitSwitchOn('traitLimitMultiTarget')) return null;
  const changes=[[100,100],[101,70],[102,80]];
  for(const [row,add] of changes){
    const t=traitByRow(row);
    if(!t || !isTraitOptimizationTarget(t)) return null;
    if((INV[row]||0)+add>(TMAX[row]||999)) return null;
  }
  return evaluateTraitOptimizationCandidate(base, 'SP', rem, changes, '멀티 타겟 분기점');
}
function buildTraitEfficiencyRecommendations(limit=5){
  const base=computeStats();
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
function traitRecommendationCostText(cand){
  const label=cand?.kind==='SOUL' ? '심연' : (cand?.kind || '재화');
  return `${label} ${fullNumber(cand?.cost||0)}`;
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
function renderTraitEfficiencyTop5(){
  const body=document.getElementById('traitEfficiencyTop5Body');
  if(!body) return;
  let list=[];
  try{ list=buildTraitEfficiencyRecommendations(5); }catch(e){
    console.error('[trait top5 failed]', e);
    body.innerHTML='<div class="trait-efficiency-empty">추천 항목 계산 실패</div>';
    return;
  }
  if(!list.length){
    body.innerHTML='<div class="trait-efficiency-empty">현재 적용 가능한 추천 항목이 없습니다.</div>';
    return;
  }
  body.innerHTML=list.map((cand,idx)=>`
    <div class="trait-efficiency-grid trait-efficiency-row">
      <span class="trait-eff-name" title="${escapeCompareHtml(cand.label)}">${escapeCompareHtml(cand.label)}</span>
      <span>${escapeCompareHtml(traitRecommendationInvestText(cand))}</span>
      <span>${escapeCompareHtml(traitRecommendationGainText(cand.gain))}</span>
      <span>${escapeCompareHtml(traitRecommendationCostText(cand))}</span>
      <button type="button" class="mini-btn master trait-eff-apply" data-action="applyTraitEfficiencyTop" data-rank="${idx}">적용</button>
    </div>`).join('');
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
  try{showToast(`${cand.label} ${traitRecommendationInvestText(cand)} 적용 완료`,'ok');}catch(e){}
  return true;
}
function optimizeSP(){
  const OPT_NORMAL_ROWS={
    SP:new Set([42,43,46,52,53,58,60,61,68,70,71,77,84,85,86,92,93,94,95,96,99,100,101,102,103,104,108,109,110,111,115,116,44,54,62,79]),
    EP:new Set([117,118,119,120,121,122]),
    RP:new Set([125,126,127,129,130]),
    SOUL:new Set([131,132,133,134,135,136,137])
  };
  function resourceInfo(row){
    if(SP_ROWS.has(row)) return {kind:'SP', set:SP_ROWS, own:()=>effectiveSP()};
    if(EP_ROWS.has(row)) return {kind:'EP', set:EP_ROWS, own:()=>v('ep')};
    if(RP_ROWS.has(row)) return {kind:'RP', set:RP_ROWS, own:()=>v('rp')};
    if(SOUL_ROWS.has(row)) return {kind:'SOUL', set:SOUL_ROWS, own:()=>v('soul')};
    return null;
  }
  function isOptimizationTarget(t){
    const [row]=t;
    if(AUTO_INVEST_EXCLUDED_ROWS.has(row) || !traitLimitAllowsTrait(t)) return false;
    const info=resourceInfo(row);
    if(!info) return false;
    const normalSet=OPT_NORMAL_ROWS[info.kind];
    if(!normalSet || !normalSet.has(row)) return false;
    if(info.kind==='SP') return allowedRowsByTier().has(row);
    return true;
  }
  function remaining(kind){
    if(kind==='SP') return effectiveSP() - resourceUsed('SP');
    if(kind==='EP') return v('ep') - resourceUsed('EP');
    if(kind==='RP') return v('rp') - resourceUsed('RP');
    if(kind==='SOUL') return v('soul') - resourceUsed('SOUL');
    return 0;
  }
  function deltaCost(row, add){
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
  function evaluateCandidate(base, kind, rem, changes, label){
    let cost=0;
    for(const [row,add] of changes){
      const info=resourceInfo(row);
      if(!info || info.kind!==kind) return null;
      const c=deltaCost(row,add);
      if(!Number.isFinite(c) || c<=0) return null;
      cost+=c;
    }
    if(cost>rem) return null;
    for(const [row,add] of changes) INV[row]=(INV[row]||0)+add;
    const ns=computeStats();
    const limitsOk=traitLimitStatsOk(ns);
    for(const [row,add] of changes) INV[row]=(INV[row]||0)-add;
    if(!limitsOk) return null;
    const gain=ns.M19-base.M19;
    if(gain<=0) return null;
    return {changes,score:gain/cost,gain,cost,label:label||String(changes[0]?.[0]||'')};
  }
  function addBest(list, cand){
    if(cand) list.push(cand);
  }
  function normalAddCount(row, kind, rem){
    if(kind!=='SP') return 1;
    if(rem<=4000000) return 1;
    if(row===77 || row===104 || row===116) return 1;
    return 5;
  }
  function boundedChanges(row, add, rem){
    const mx=TMAX[row]||999;
    let n=Math.min(add, mx-(INV[row]||0));
    while(n>0 && deltaCost(row,n)>rem) n--;
    return n>0 ? [[row,n]] : null;
  }
  function critBreakpointCandidate(base, kind, rem, row, rate){
    if((INV[row]||0)>=(TMAX[row]||999)) return null;
    const s=computeStats();
    if(s.M8<300) return null;
    const mod=((s.M8%20)+20)%20;
    const needStat=mod===0 ? 20 : 20-mod;
    const add=Math.ceil(needStat/rate);
    if(add<=0) return null;
    if((INV[row]||0)+add>(TMAX[row]||999)) return null;
    return evaluateCandidate(base, kind, rem, [[row,add]], `CRI→MC ${row}`);
  }
  function multiTargetBundleCandidate(base, rem){
    if(!traitLimitSwitchOn('traitLimitMultiTarget')) return null;
    if(!allowedRowsByTier().has(100) || !allowedRowsByTier().has(101) || !allowedRowsByTier().has(102)) return null;
    if(((INV[100]||0)+(INV[101]||0)+(INV[102]||0))>50) return null;
    const changes=[[100,100],[101,70],[102,80]];
    for(const [row,add] of changes){
      if((INV[row]||0)+add>(TMAX[row]||999)) return null;
    }
    let cost=0;
    for(const [row,add] of changes){
      const old=INV[row]||0;
      const target=old+add;
      const saved=INV[row];
      INV[row]=target;
      cost+=cumCost(row);
      INV[row]=saved;
    }
    if(!Number.isFinite(cost) || cost<=0 || cost>rem) return null;
    for(const [row,add] of changes) INV[row]=(INV[row]||0)+add;
    const ns=computeStats();
    const limitsOk=traitLimitStatsOk(ns);
    for(const [row,add] of changes) INV[row]=(INV[row]||0)-add;
    if(!limitsOk) return null;
    const gain=ns.M19-base.M19;
    if(gain<=0) return null;
    return {changes,score:gain/cost,gain,cost,label:'멀티 타겟 분기점'};
  }
  const kinds=['SP','EP','RP','SOUL'];
  let totalApplied=0;
  for(const kind of kinds){
    let guard=0;
    while(guard++<100000){
      const base=computeStats();
      const rem=remaining(kind);
      if(rem<=0) break;
      const candidates=[];
      for(const t of TRAITS){
        const [row]=t;
        const info=resourceInfo(row);
        if(!info || info.kind!==kind) continue;
        if(!isOptimizationTarget(t)) continue;
        const n=INV[row]||0;
        const mx=TMAX[row]||999;
        if(n>=mx) continue;
        const add=normalAddCount(row, kind, rem);
        const changes=boundedChanges(row, add, rem);
        if(!changes) continue;
        addBest(candidates, evaluateCandidate(base, kind, rem, changes, String(row)));
      }
      if(kind==='SP') addBest(candidates, critBreakpointCandidate(base, kind, rem, 95, 0.5));
      if(kind==='EP') addBest(candidates, critBreakpointCandidate(base, kind, rem, 119, 1));
      if(kind==='RP') addBest(candidates, critBreakpointCandidate(base, kind, rem, 127, 2));
      if(kind==='SP') addBest(candidates, multiTargetBundleCandidate(base, rem));
      const best=candidates.sort((a,b)=>b.score-a.score)[0];
      if(!best) break;
      for(const [row,add] of best.changes){
        INV[row]=Math.min(TMAX[row]||999,(INV[row]||0)+add);
        totalApplied+=add;
      }
    }
  }
  recalc();
  try{
    showToast('특성 최적화 완료', 'ok');
  }catch(e){}
}
function clearAll(){
  try{
    if(typeof INV === 'undefined' || typeof TRAITS === 'undefined'){
      alert('특성 데이터가 아직 준비되지 않았습니다.');
      return false;
    }
    TRAITS.forEach(t=>{
      const row=Array.isArray(t) ? t[0] : t.row;
      if(!Number.isFinite(+row)) return;
      if(isUtilityOptimizationTrait(t)) return;
      INV[+row]=0;
    });
    if(116 in INV) INV[116]=1;
    recalc();
    try{showToast('특성 초기화 완료 · 유틸 특성 유지','ok');}catch(e){}
    return true;
  }catch(e){
    console.error('[clearAll failed]', e);
    alert('특성 초기화 실패: '+(e && e.message ? e.message : e));
    return false;
  }
}
/* ── 10. 저장 / 복구 / JSON 백업 ── */
const STORAGE_VERSION=DPS_CONFIG.storage.version;
const STORAGE_SCOPE=DPS_CONFIG.storage.scope;
const STORAGE_KEY=DPS_CONFIG.storage.key;
const CLIENT_KEY=DPS_CONFIG.storage.clientKey;
const USER_STATE_VALUE_IDS=new Set([
  'sp','xp','bxp','rp','soul','diff','penance','round','titleTdBonus','dpsTableMinDps','erosionStack','jewelErosionRes','pbless','team','spBankApply',
  'aprRuneNormal','aprRunePlus','sepRuneNormal','sepRunePlus','overEnhance','repairEnhance','enhanceMaster',
  'dailyCouponBuff','shareUserBuff','unitUniqueBuff','basePierceBuff','prodArtifact','prodNova','prodTeratron','prodAmon','prodAdun','prodKerrigan','prodOvermind','prodNarud','flowerSkill1','flowerSkill2','flowerSkill3',
  'rAD','rModAD','runeChoiceType','runeChoiceValue','rAS','rModAS','rCD','rModCD','rCRI','rModCRI','rReinf','rAsc','raceOpt','opt10','opt15','transOpt',
  'addAD','addAS','addCD','addCRI','addAP','addTD','addUA',
  'enchAD','enchCRI','enchUA','enchTD','enchSR','enchHR','enchantCode',
  'optTier','utilOptTier','traitLimitAD','traitLimitAS','traitLimitCRI','traitLimitCD','traitLimitMC','traitLimitDR','traitLimitTD','traitLimitUA','traitLimitMultiTarget','traitLimitInfinite',
  'skillDouble','skillMode','skillRound'
]);
const INTERNAL_VALUE_IDS=new Set([
  'enemyArmor','dt','ep','personalASBuff','personalLimitBreak','personalJewel','powerBunkerAD','postMasterAD','additionalADBuff','additionalADValue','rushADBuff',
  'rAP','rTD','rUA','rHarmony','sysAD','addDR','addSR','addHR','basicExtraSlot1','basicExtraSlot2','basicExtraSlot3','basicExtraSlot4','basicExtraSlot5'
]);
const IGNORED_SAVED_VALUE_IDS=[...(DPS_CONFIG.state.skipElementIds || []),...INTERNAL_VALUE_IDS];
function isUserStateValueId(id){ return USER_STATE_VALUE_IDS.has(id); }
function userStateElementIds(){ return storageElementIds().filter(isUserStateValueId); }
let isLoadingState=false;
let suppressSave=false;
let FACTORY_STATE=null;
let storageSaveFailCount=0;
function storageElementIds(){
  const skip=new Set(DPS_CONFIG.state.skipElementIds || []);
  return Array.from(document.querySelectorAll('input[id],select[id],textarea[id]'))
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
  return el.value;
}
function writeElementValue(el, value){
  if(el.id==='spBankApply') value=normalizeSpBankApplyValue(value);
  if(DECIMAL_DISPLAY_INPUT_IDS.has(el.id)) value=normalizeDecimalDisplayValue(value);
  if(el.type==='checkbox') el.checked=!!value;
  else el.value=value;
  if(typeof TRAIT_LIMIT_INPUT_IDS!=='undefined' && TRAIT_LIMIT_INPUT_IDS.has(el.id)) syncTraitLimitInputDisplay(el);
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
    const el=document.getElementById(id);
    if(el) values[id]=elementDefaultValue(el);
  });
  if(!Object.prototype.hasOwnProperty.call(values,'optTier')) values.optTier='무한∞';
  if(!Object.prototype.hasOwnProperty.call(values,'utilOptTier')) values.utilOptTier='더원2';
  Object.entries(TRAIT_LIMIT_DEFAULTS).forEach(([id,value])=>{ if(!Object.prototype.hasOwnProperty.call(values,id)) values[id]=value; });
  values.dpsTableMinDps='';
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
function captureFactoryState(){ FACTORY_STATE=makePublicDefaultState(); }
function makeStorageEnvelope(partial){
  return {
    values:partial.values || {},
    inv:partial.inv || {},
    zeroScore:partial.zeroScore || undefined,
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
    const el=document.getElementById(id);
    if(!el) return;
    let value=readElementValue(el);
    if(value!==undefined){
      if(typeof TRAIT_LIMIT_INPUT_IDS!=='undefined' && TRAIT_LIMIT_INPUT_IDS.has(id)) value=normalizeTraitLimitStorageValue(value);
      if(id==='spBankApply') value=normalizeSpBankApplyValue(value);
      values[id]=value;
    }
  });
  values.optTier=vs('optTier') || values.optTier || '무한∞';
  values.utilOptTier=vs('utilOptTier') || values.utilOptTier || '더원2';
  Object.entries(TRAIT_LIMIT_DEFAULTS).forEach(([id,value])=>{ values[id]=vs(id) || values[id] || value; });
  if(Object.prototype.hasOwnProperty.call(values,'spBankApply')) values.spBankApply=normalizeSpBankApplyValue(values.spBankApply);
  if(typeof TRAIT_LIMIT_INPUT_IDS!=='undefined') TRAIT_LIMIT_INPUT_IDS.forEach(id=>{ values[id]=normalizeTraitLimitStorageValue(values[id] ?? TRAIT_LIMIT_DEFAULTS[id] ?? '0'); });
  const normalizedRune=normalizeRuneChoiceValues(values);
  values.runeChoiceType=normalizedRune.runeChoiceType;
  values.runeChoiceValue=normalizedRune.runeChoiceValue;
  values.dpsTableMinDps=dpsTableMinDps;
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
  if(Object.prototype.hasOwnProperty.call(out,'team')){
    const n=Math.max(1,Math.min(3,Math.round(+out.team||1)));
    out.team=String(n);
  }
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
  if(typeof TRAIT_LIMIT_INPUT_IDS!=='undefined'){
    TRAIT_LIMIT_INPUT_IDS.forEach(id=>{
      if(!Object.prototype.hasOwnProperty.call(out,id)) return;
      out[id]=normalizeTraitLimitStorageValue(out[id]);
    });
  }
  return out;
}

function normalizeSavedState(data){
  if(!data || typeof data!=='object') return null;
  const rawValues=(data.values && typeof data.values==='object') ? data.values : {};
  const values=sanitizeSavedValues(rawValues);
  const inv=(data.inv && typeof data.inv==='object') ? {...data.inv} : {};
  if(!Object.keys(values).length && !Object.keys(inv).length) return null;
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
function applyStateObject(data){
  if(!data) return;
  isLoadingState=true;
  try{
    if(data.ui && Number.isFinite(+data.ui.fontScale)) applyFontScale(+data.ui.fontScale, {silent:true});
    dpsTableMinDps=String(data.values?.dpsTableMinDps ?? data.dpsTableMinDps ?? '');
    syncDpsMinDpsInputs();
    const sanitizedValues=sanitizeSavedValues(data.values || {});
    if(Object.prototype.hasOwnProperty.call(sanitizedValues,'enhanceMaster')){
      const masterEl=document.getElementById('enhanceMaster');
      if(masterEl){
        writeElementValue(masterEl, sanitizedValues.enhanceMaster);
        syncPowerBlessOptions();
      }
    }
    Object.entries(sanitizedValues).forEach(([id,val])=>{
      if(id==='dpsTableMinDps') return;
      const el=document.getElementById(id);
      if(el) writeElementValue(el,val);
    });
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
    applyZeroScoreState(data.zeroScore);
    syncEnchantCodeFromInputs(true);
    syncSelectButtons();
    syncBuffChoiceButtons();
    syncPowerBlessOptions();
    syncTeamSelect();
    formatAllMoneyInputs();
    recalc();
  }finally{ isLoadingState=false; }
}
function resetToFactoryState(){
  if(!FACTORY_STATE) captureFactoryState();
  applyStateObject(FACTORY_STATE);
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
function readCurrentSavedState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeSavedState(JSON.parse(raw)) : null;
  }catch(e){ return null; }
}
function clearCurrentCalculatorStorage(){
  try{ localStorage.removeItem(STORAGE_KEY); }
  catch(e){ console.warn('clearCurrentCalculatorStorage failed', e); }
}
function formatStorageTime(ts=Date.now()){
  const d=new Date(ts), pad=n=>String(n).padStart(2,'0');
  return `${pad(d.getFullYear()%100)}년${pad(d.getMonth()+1)}월${pad(d.getDate())}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function setStorageStatus(message, type='ok', options={}){
  const el=document.getElementById('storageStatusView');
  if(!el) return;
  const time=options.time || Date.now();
  el.textContent=`${formatStorageTime(time)} ${message}`;
  el.className='storage-status '+type;
  el.title='입력값은 서버/GitHub가 아니라 현재 브라우저에만 저장됩니다.';
}
function saveState(options={}){
  const silent=!!options.silent;
  if(isLoadingState || suppressSave) return false;
  try{
    const state=makeStateObject();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageSaveFailCount=0;
    setStorageStatus('저장됨', 'ok', {time:state.savedAt});
    if(!silent){
      try{showToast('입력값 저장 완료','ok');}catch(e){}
    }
    return true;
  }catch(e){
    console.error(e);
    storageSaveFailCount++;
    const msg='저장 실패 · 브라우저 저장공간/권한 확인';
    setStorageStatus(msg, 'err', {time:Date.now()});
    if(!silent || storageSaveFailCount===1) try{showToast(msg,'err');}catch(_){}
    if(!silent) alert('저장 실패: '+(e?.message || e));
    return false;
  }
}
function loadState(){
  if(!FACTORY_STATE) captureFactoryState();
  try{
    const saved=readCurrentSavedState();
    if(!saved){
      resetToFactoryState();
      setStorageStatus('저장값 없음', 'idle', {time:Date.now()});
      return;
    }
    applyStateObject(saved);
    setStorageStatus('불러옴', 'ok', {time:Date.now()});
  }catch(e){
    console.warn('loadState failed', e);
    resetToFactoryState();
  }
}
function clearSavedState(){
  clearCurrentCalculatorStorage();
  setStorageStatus('삭제됨', 'warn', {time:Date.now()});
}
function exportStateBackup(){
  try{
    const payload=JSON.stringify(makeStateObject(), null, 2);
    const blob=new Blob([payload], {type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    const now=new Date(), pad=n=>String(n).padStart(2,'0');
    const stamp=String(now.getFullYear()).slice(2)+pad(now.getMonth()+1)+pad(now.getDate())+'_'+pad(now.getHours())+pad(now.getMinutes());
    a.href=url;
    a.download=stamp+'-DPS.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStorageStatus('백업 파일 생성됨', 'ok', {time:Date.now()});
  }catch(e){
    console.error(e);
    alert('백업 실패: '+(e?.message || e));
  }
}
function applyImportedState(data){
  const norm=normalizeSavedState(data);
  if(!norm) throw new Error('계산기 저장값 형식이 아닙니다.');
  resetExcelComparison({close:true});
  applyStateObject(norm);
  saveState({silent:false});
  setStorageStatus('백업 복원 완료', 'ok', {time:Date.now()});
}
function handleImportError(e){
  console.error(e);
  alert('복원 실패: '+(e?.message || e));
}
function importStateBackup(){
  const importRaw=raw=>{
    const data=safeJsonParse(String(raw||''));
    if(!data){alert('복원 실패: 백업 형식이 아닙니다.'); return;}
    try{ applyImportedState(data); }catch(e){ handleImportError(e); }
  };
  const fileInput=document.getElementById('backupFileInput');
  if(!fileInput){
    const raw=prompt('백업 TXT/JSON 내용을 붙여넣으세요.');
    if(raw) importRaw(raw);
    return;
  }
  fileInput.onchange=function(){
    const file=fileInput.files && fileInput.files[0];
    fileInput.value='';
    if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>importRaw(reader.result);
    reader.onerror=()=>alert('복원 실패: 파일을 읽지 못했습니다.');
    reader.readAsText(file, 'utf-8');
  };
  fileInput.click();
}
/* ── 11. 화면 제어 / 글자 크기 / 위험 작업 확인 ── */
function isMobileViewport(){
  const max=DPS_CONFIG.ui.mobileMaxWidth || 600;
  if(window.matchMedia) return window.matchMedia(`(max-width:${max}px)`).matches;
  return window.innerWidth<=max;
}
function isFontScaleLockedViewport(){
  const w=window.innerWidth || document.documentElement.clientWidth || 0;
  const h=window.innerHeight || document.documentElement.clientHeight || 0;
  return isMobileViewport() || (w>=768 && w<=1368 && h>w);
}
function getFontScale(){
  if(isFontScaleLockedViewport()) return DPS_CONFIG.ui.fontScaleDefault;
  const root=document.documentElement;
  const raw=root.style.getPropertyValue('--app-font-scale') || String(DPS_CONFIG.ui.fontScaleDefault);
  const n=parseFloat(raw);
  return Number.isFinite(n) ? n : DPS_CONFIG.ui.fontScaleDefault;
}
function applyFontScale(scale, options={}){
  const label=document.getElementById('fontScaleLabel');
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
  if(!options.silent) setStorageStatus('글씨 크기 '+Math.round(next*100)+'% 저장됨', 'ok', {time:Date.now()});
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
function resetFontScale(){
  return applyFontScale(DPS_CONFIG.ui.fontScaleDefault);
}
function bindFontScaleViewportGuard(){
  window.addEventListener('resize', ()=>{
    if(isFontScaleLockedViewport()) applyFontScale(DPS_CONFIG.ui.fontScaleDefault, {silent:true});
  });
}
function renderAppVersion(){
  const version=(window.DPS_APP_VERSION || 'V1.02');
  const el=document.getElementById('appVersionView');
  if(el) el.textContent=version;
}
let pendingDangerAction=null;
function requestDangerAction(key,message,run){
  const now=Date.now();
  const delay=DPS_CONFIG.ui.confirmDelayMs || 1600;
  if(pendingDangerAction && pendingDangerAction.key===key && now<pendingDangerAction.until){
    const timer=pendingDangerAction.timer;
    pendingDangerAction=null;
    if(timer) clearTimeout(timer);
    return run();
  }
  if(pendingDangerAction && pendingDangerAction.timer) clearTimeout(pendingDangerAction.timer);
  try{showToast(message,'err');}catch(e){}
  pendingDangerAction={
    key,
    until:now+delay,
    timer:setTimeout(()=>{
      if(pendingDangerAction && pendingDangerAction.key===key) pendingDangerAction=null;
    }, delay)
  };
  return false;
}
function requestClearAll(){
  return requestDangerAction('clearAll','한 번 더 누르면 유틸 제외 특성 초기화', clearAll);
}
function requestClearSavedState(){
  return requestDangerAction('clearSavedState','한 번 더 누르면 입력값 삭제', clearSavedState);
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
/* ── 12. 더제로 승단 계산기 ── */
function zeroScoreNumber(value, min, max){
  const n=Number(value);
  if(!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
function zeroPenanceScore(level){
  let sum=0;
  const max=zeroScoreNumber(level,0,20);
  for(let i=1;i<=max;i++){
    if(i<=13) sum+=1;
    else if(i<=16) sum+=2;
    else if(i===17) sum+=3;
    else sum+=7;
  }
  return sum;
}
const ZERO_HONOR_STAGES=[{key:'b', point:2},{key:'a', point:4},{key:'s', point:6},{key:'x', point:8}];
function zeroHonorScore(stage){
  const found=ZERO_HONOR_STAGES.find(item=>item.key===stage);
  return found ? found.point : 0;
}
function zeroTowerScore(floor){
  let sum=0;
  const max=zeroScoreNumber(floor,0,90);
  for(let i=41;i<=max;i++){
    if(i<=60) sum+=1;
    else if(i<=70) sum+=2;
    else sum+=3;
  }
  return sum;
}
function zeroHonorTowerScore(floor){
  let sum=0;
  const max=zeroScoreNumber(floor,0,90);
  for(let i=50;i<=max;i++){
    if(i<=68){
      if(i%2===0) sum+=1;
    }else if(i>=70 && i<=79){
      sum+=1;
    }else if(i>=80){
      sum+=2;
    }
  }
  return sum;
}
const ZERO_RANK_FALLBACK_TABLE=[
  {name:'입문',score:0},{name:'견습',score:100},{name:'숙련',score:150},{name:'전문',score:200},
  {name:'장인',score:250},{name:'명장',score:300},{name:'명장+',score:350},{name:'도인',score:400},
  {name:'도인+',score:450},{name:'지존',score:500},{name:'지존+',score:550},{name:'패왕',score:600},
  {name:'패왕+',score:650},{name:'제왕',score:700},{name:'제왕+',score:750},{name:'신황',score:800},{name:'신황+',score:850}
];
function getZeroRankTable(){
  const rows=[...document.querySelectorAll('.zero-rank-table tbody tr')].map(row=>{
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
  document.querySelectorAll('.zero-rank-table tbody tr').forEach(row=>{
    const name=excelText(row.querySelector('td')?.textContent);
    row.classList.toggle('zero-rank-current', !!current && name===current);
    row.classList.toggle('zero-rank-target', !!target && name===target);
    row.classList.toggle('zero-rank-same', !!current && current===target && name===current);
  });
  document.querySelectorAll('.zero-benefit-rank').forEach(article=>{
    const name=zeroBenefitRankName(article);
    article.classList.toggle('zero-rank-current', !!current && name===current);
    article.classList.toggle('zero-rank-target', !!target && name===target);
    article.classList.toggle('zero-rank-same', !!current && current===target && name===current);
  });
  const card=document.querySelector('.zero-rank-result-card');
  if(card){
    card.classList.toggle('zero-rank-same', !!current && current===target);
    card.classList.toggle('zero-rank-upgrade', !!current && !!target && current!==target);
  }
  updateMobileZeroRankSummary(current,target);
}
function updateMobileZeroRankSummary(currentRank, targetRank){
  const card=document.querySelector('.zero-rank-card');
  if(!card) return;
  const rankPanel=card.querySelector('[data-zero-rank-panel="rank"]');
  const benefitPanel=card.querySelector('[data-zero-rank-panel="benefit"]');
  const rows=[...card.querySelectorAll('.zero-rank-table tbody tr')];
  const benefits=[...card.querySelectorAll('.zero-benefit-rank')];
  const currentIndex=Math.max(0,rows.findIndex(row=>excelText(row.querySelector('td')?.textContent)===currentRank));
  const start=Math.max(0,Math.min(currentIndex-2,rows.length-6));
  const visibleRanks=new Set(rows.slice(start,start+6).map(row=>excelText(row.querySelector('td')?.textContent)));
  const rankExpanded=rankPanel?.classList.contains('zero-mobile-expanded');
  const benefitExpanded=benefitPanel?.classList.contains('zero-mobile-expanded');
  rows.forEach(row=>{
    const name=excelText(row.querySelector('td')?.textContent);
    row.classList.toggle('zero-mobile-summary-hidden', !rankExpanded && !visibleRanks.has(name));
  });
  benefits.forEach(article=>{
    const name=zeroBenefitRankName(article);
    const highlighted=name===currentRank || name===targetRank;
    article.classList.toggle('zero-mobile-summary-hidden', !benefitExpanded && !highlighted);
  });
  ensureMobileZeroToggle(rankPanel,'승단표',rows.length,rankExpanded);
  ensureMobileZeroToggle(benefitPanel,'혜택',benefits.length,benefitExpanded);
}
function ensureMobileZeroToggle(panel,label,total,expanded){
  if(!panel) return;
  let button=panel.querySelector('.zero-mobile-expand-btn');
  if(!button){
    button=document.createElement('button');
    button.type='button';
    button.className='zero-mobile-expand-btn';
    button.dataset.action='toggleZeroMobileSummary';
    panel.appendChild(button);
  }
  button.textContent=expanded ? `${label} 요약 보기` : `전체 ${label} 보기 (${total})`;
  button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}
function toggleZeroMobileSummary(trigger){
  const panel=trigger?.closest('.zero-rank-panel');
  if(!panel) return;
  panel.classList.toggle('zero-mobile-expanded');
  const calc=document.querySelector('.zero-score-calc');
  const current=excelText(calc?.querySelector('.zero-current-rank')?.textContent) || '입문';
  const target=excelText(calc?.querySelector('.zero-target-rank')?.textContent) || current;
  updateMobileZeroRankSummary(current,target);
}
function updateZeroScoreCalculator(){
  const calc=document.querySelector('.zero-score-calc');
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
  const calc=document.querySelector('.zero-score-calc');
  if(!calc) return null;
  return {
    rows:Array.from(calc.querySelectorAll('.zero-calc-row')).map(row=>({
      type:row.dataset.rowType || 'penance',
      current:row.querySelector('.zero-calc-current')?.value ?? '0',
      target:row.querySelector('.zero-calc-target')?.value ?? '0',
      star:!!row.querySelector('.zero-star-toggle.active'),
      currentHonor:normalizeZeroHonorValue(row.querySelector('.zero-current-honor')?.value ?? ''),
      targetHonor:normalizeZeroHonorValue(row.querySelector('.zero-target-honor')?.value ?? '')
    }))
  };
}
function applyZeroScoreState(zeroScore){
  const calc=document.querySelector('.zero-score-calc');
  if(!calc) return;
  const rows=Array.isArray(zeroScore?.rows) ? zeroScore.rows : [];
  calc.querySelectorAll('.zero-calc-row').forEach((row,idx)=>{
    const saved=rows[idx] || {};
    const current=row.querySelector('.zero-calc-current');
    const target=row.querySelector('.zero-calc-target');
    const currentHonor=row.querySelector('.zero-current-honor');
    const targetHonor=row.querySelector('.zero-target-honor');
    const starBtn=row.querySelector('.zero-star-toggle');
    if(current) current.value=String(saved.current ?? '0');
    if(target) target.value=String(saved.target ?? '0');
    if(currentHonor) currentHonor.value=normalizeZeroHonorValue(saved.currentHonor ?? '').toUpperCase();
    if(targetHonor) targetHonor.value=normalizeZeroHonorValue(saved.targetHonor ?? '').toUpperCase();
    if(starBtn){
      const active=!!saved.star;
      starBtn.classList.toggle('active', active);
      starBtn.classList.toggle('is-active', active);
      starBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
      starBtn.textContent=active ? 'ON +2' : '+2';
    }
  });
  updateZeroScoreCalculator();
}
function toggleZeroScoreStar(trigger){
  if(!trigger) return;
  const active=!trigger.classList.contains('active');
  trigger.classList.toggle('active', active);
  trigger.classList.toggle('is-active', active);
  trigger.setAttribute('aria-pressed', active ? 'true' : 'false');
  trigger.textContent=active ? 'ON +2' : '+2';
  updateZeroScoreCalculator();
  if(!isLoadingState && !suppressSave) saveState({silent:true});
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
    updateZeroScoreCalculator();
    if(!isLoadingState && !suppressSave) saveState({silent:true});
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
    btn.classList.toggle('active', active);
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  card.querySelectorAll('.zero-rank-panel').forEach(panel=>{
    panel.classList.toggle('active', panel.dataset.zeroRankPanel===key);
  });
}
/* ── 13. 이벤트 바인딩 / 앱 초기화 ── */
let appEventsBound=false;
const ACTION_HANDLERS={
  optimizeSP:()=>optimizeSP(),
  optimizeUtility:()=>optimizeUtility(),
  clearUtility:()=>clearUtility(),
  applyTraitEfficiencyTop:(trigger)=>applyTraitEfficiencyTop(trigger),
  toggleOptimizerGuide:(trigger)=>toggleOptimizerGuide(trigger),
  clearAll:()=>requestClearAll(),
  saveState:()=>saveState({silent:false}),
  clearSavedState:()=>requestClearSavedState(),
  exportStateBackup:()=>exportStateBackup(),
  importStateBackup:()=>importStateBackup(),
  toggleSpBankApply:()=>toggleSpBankApply(),
  openDpsTable:()=>openDpsTable(),
  openExcelCompare:()=>openExcelCompare(),
  openMonthRune:()=>openMonthRune(),
  zeroRankTab:(trigger)=>setZeroRankTab(trigger),
  zeroScoreStar:(trigger)=>toggleZeroScoreStar(trigger),
  toggleZeroMobileSummary:(trigger)=>toggleZeroMobileSummary(trigger),
  decreaseFont:()=>changeFontScale(-DPS_CONFIG.ui.fontScaleStep),
  increaseFont:()=>changeFontScale(DPS_CONFIG.ui.fontScaleStep),
  resetFont:()=>resetFontScale(),
  selectButton:(trigger)=>setSelectButton(trigger.closest('.seg-btns')?.dataset.target, trigger.dataset.value),
  traitAdjust:(trigger)=>{
    if(Date.now()<traitHoldSuppressClickUntil) return false;
    return adjustTraitBy(+trigger.dataset.row,+trigger.dataset.delta,1);
  },
  traitMax:(trigger)=>adjMax(+trigger.dataset.row),
  masterTier:(trigger)=>masterTier(trigger.dataset.tier||''),
  resetTier:(trigger)=>resetTier(trigger.dataset.tier||'')
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
  'dpsTableMinDps',
  'dpsTableMinDpsMain'
]);
const RUNE_CHOICE_SYNC_IDS=new Set(['runeChoiceType','runeChoiceValue']);
function shouldHandleReactiveInput(target){
  if(isLoadingState || suppressSave) return false;
  if(!target || !target.id) return false;
  if(REACTIVE_INPUT_EXCLUDED_IDS.has(target.id)) return false;
  if(target.classList && target.classList.contains('tv-input')) return false;
  return target.matches && target.matches('input, select, textarea');
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
function bindReactiveInputs(){
  let raf=0;
  const schedule=(target)=>{
    if(!shouldHandleReactiveInput(target)) return;
    if(target.matches('.money-input')) formatMoneyInput(target);
    if(target.id==='xp') normalizeXpInput();
    if(target.id==='round') normalizeRoundInput();
    if(target.id==='diff') resetDifficultyDependentFields();
    if(RUNE_CHOICE_SYNC_IDS.has(target.id)) syncRuneChoice();
    if(ENCHANT_INPUT_IDS.includes(target.id)) syncEnchantInputs();
    if(RUNE_OPTION_SELECT_IDS.includes(target.id)) syncExclusiveRuneOptions();
    if(target.id==='enhanceMaster') syncPowerBlessOptions();
    if(target.id==='team') syncTeamSelect();
    if(TRAIT_LIMIT_INPUT_IDS.has(target.id) && String(target.value).replace(/,/g,'').trim()==='0') syncTraitLimitInputDisplay(target);
    if(target.matches('select')) syncSelectButtons();
    if(target.matches('.buff-choice-input')) syncBuffChoiceButtons();
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>requestAppUpdate());
  };
  document.addEventListener('input', e=>schedule(e.target), true);
  document.addEventListener('change', e=>schedule(e.target), true);
}
function bindButtonPressFeedback(){
  const selector='button,.btn,.mini-btn,.trait-master-btn,.seg-btns button';
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
  bindTraitHoldEvents();
  bindTraitInputEvents();
  bindDpsTableEvents();
  bindExcelCompareEvents();
  bindMonthRuneEvents();
  bindZeroScoreCalculator();
  bindTraitLimitDisplayEvents();
  bindReactiveInputs();
  bindButtonPressFeedback();
}
function initApp(){
  loadFontScale();
  bindAppEvents();
  installDpsTableButton();
  installExcelCompareButton();
  installMonthRuneButton();
  renderAppVersion();
  syncEnchantCodeFromInputs(true);
  syncSelectButtons();
  syncBuffChoiceButtons();
  syncExclusiveRuneOptions();
  updateZeroScoreCalculator();
  formatAllMoneyInputs();
  syncTraitLimitInputs();
  loadState();
}
function markAppReady(){
  try{document.documentElement.classList.remove('dps-booting');}catch(e){}
  try{
    const boot=document.getElementById('dpsBootScreen');
    if(boot) boot.setAttribute('aria-hidden','true');
  }catch(e){}
}
try{
  initApp();
}finally{
  markAppReady();
}
