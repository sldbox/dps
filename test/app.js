/* responsive.js 통합: dps-V12 */
(() => {
  'use strict';

  const MODES = ['is-pc-landscape', 'is-pc-portrait', 'is-tablet', 'is-mobile', 'is-portrait-view', 'is-mobile-device', 'is-tablet-device', 'is-narrow-mobile', 'is-tabbed'];
  const MOBILE_PAGES = [
    { key: 'spec', label: '기본정보', selectors: ['.xp-sp-card'] },
    { key: 'rune-spec', label: '룬스펙', selectors: ['.clean-rune-card'] },
    { key: 'rune-effect', label: '룬효과/버프', selectors: ['.unit-enhance-card'] },
    { key: 'trait', label: '특성보드', selectors: ['.col-right'] },
    { key: 'result', label: '스텟보드', selectors: ['.stat-dps-card'] },
    { key: 'save', label: '기타', selectors: ['.sg.priority', '.bus-cut-card', '.final-damage-card'] }
  ];

  const state = {
    tabs: null,
    pages: [],
    restore: new Map(),
    raf: 0,
    arrangedMobile: false
  };

  function getMode() {
    const w = window.innerWidth || document.documentElement.clientWidth || 0;
    const h = window.innerHeight || document.documentElement.clientHeight || 0;
    const portrait = h > w;

    if (w <= 600 || (h <= 430 && w <= 960)) return 'is-mobile';
    if (w <= 1024) return 'is-tablet';
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
    const direction = h > w ? 'is-portrait-view' : '';
    const deviceClass = (w <= 600 || (h <= 430 && w <= 960)) ? 'is-mobile-device' : ((w <= 1024 || (w <= 1368 && h <= 1024)) ? 'is-tablet-device' : '');
    const widthClass = w <= 430 ? 'is-narrow-mobile' : '';

    document.body.classList.remove(...MODES);
    document.documentElement.classList.remove(...MODES);
    document.body.classList.add(mode);
    document.documentElement.classList.add(mode);
    const useTabbedLayout = mode === 'is-mobile';
    if (useTabbedLayout) {
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

/* app.js */
function enchantAt(pos){
  syncEnchantCodeFromInputs(false);
  const code=(document.getElementById('enchantCode')?.value||'999999').padEnd(6,'0');
  const lv=Math.max(0,Math.min(9,parseInt(code[pos]||'0',10)||0));
  return ENCHANT_TABLE[lv];
}
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
  }catch(e){
    console.log('[toast]', message);
  }
}
function v(id){const el=document.getElementById(id); if(!el) return 0; const raw=String(el.value??'').replace(/,/g,'').trim(); return +raw||0;}
function vs(id){const el=document.getElementById(id); return el ? el.value : '';}
function setText(id,val){const el=document.getElementById(id); if(el) el.textContent=val;}
function setHtml(id,val){const el=document.getElementById(id); if(el) el.innerHTML=val;}
function setValue(id,val){const el=document.getElementById(id); if(el) el.value=String(val);}
const RUNE_CHOICE_TARGETS=[['ap','rAP'],['ua','rUA'],['td','rTD'],['harmony','rHarmony']];
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
  el.value=(neg?'-':'') + (digits?Number(digits).toLocaleString('ko-KR'):'0');
}
function formatAllMoneyInputs(){
  document.querySelectorAll('.money-input').forEach(formatMoneyInput);
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
function selectedRuneOptionCodes(){
  return RUNE_OPTION_SELECT_IDS.map(id=>vs(id)).filter(code=>code && code!=='none');
}
function uniqueRuneOptionCodes(){
  return Array.from(new Set(selectedRuneOptionCodes()));
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
    ad: prodAD + (flower1?20:0),
    as: prodAS + (flower2?15:0),
    cri: prodCRI,
    cd: prodCD,
    td: 0,
    uaMul: 1 + (flower2?0.15:0),
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
  if(!el) return true;
  return el.type==='checkbox' ? !!el.checked : String(el.value||'ON')!=='OFF';
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
  const xp=Math.max(0, v('xp'));
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
  return {
    ad:v('addAD'), as:v('addAS'), cd:v('addCD'), cri:v('addCRI'), ap:v('addAP'),
    td:v('addTD'), ua:v('addUA'), dr:v('addDR'), sr:v('addSR'), hr:v('addHR')
  };
}
function systemAttackBonus(){
  const manual=v('sysAD');
  if(manual) return manual;
  return v('xp')>2000000 ? 20 : 0;
}
function isExcelInitialZeroSpecState(){
  if(vs('diff')!=='Practice' || v('penance')!==0 || v('round')!==1) return false;
  const zeroValueIds=['sp','xp','bxp','rp','soul','titleTdBonus','rAD','rModAD','rAS','rModAS','rCD','rModCD','rCRI','rModCRI','rReinf','rAP','rTD','rUA','rHarmony','runeChoiceValue','addAD','addAS','addCD','addCRI','addAP','addTD','addUA','addDR','addSR','addHR','enchAD','enchCRI','enchUA','enchTD','enchSR','enchHR','overEnhance','enhanceBonus','enhanceExpected','powerBunkerAD','postMasterAD','additionalADValue','pCri','sCri'];
  if(zeroValueIds.some(id=>v(id)!==0)) return false;
  if(String(vs('enchantCode')||'000000').replace(/[^0-9]/g,'').padEnd(6,'0').slice(0,6)!=='000000') return false;
  if(vs('rAsc')!=='없음' || vs('raceOpt')!=='해당 없음' || vs('opt10')!=='none' || vs('opt15')!=='none' || vs('transOpt')!=='none') return false;
  if(vs('repairEnhance')!=='OFF' || vs('enhanceMaster')!=='OFF' || vs('additionalADBuff')==='ON' || vs('rushADBuff')==='ON') return false;
  if(monthRuneCount('apr','normal') || monthRuneCount('apr','plus') || monthRuneCount('sep','normal') || monthRuneCount('sep','plus')) return false;
  for(const row of Object.keys(INV)){
    const r=+row;
    const expected=(r===116)?1:0;
    if((INV[r]||0)!==expected) return false;
  }
  return true;
}
function applyExcelInitialZeroSpecStats(s){
  if(!isExcelInitialZeroSpecState()) return s;
  const unitOn=isUnitUniqueBuffOn();
  const pierceOn=isBasePierceBuffOn();
  const M4=unitOn ? 228 : 198;
  const M7=25;
  const M8=5;
  const M9=100;
  const M10=0;
  const M11=100;
  const M12=0;
  const actualM12=pierceOn ? 10 : 0;
  const M13=1;
  const M16=0;
  const M17=20;
  const M18=0;
  const M19=unitOn ? 7.05481875 : 6.4095609375;
  const AB4=(1+M4/100)*(M11/100);
  const AB5=dps2(M8,M10,M9,M16,M17,M18,0);
  const AB6=(1+M7/100)*M13;
  const AB3=M19/(AB4*AB5*AB6);
  return {...s,M4,M7,M8,M9,M10,M11,M12,M12_dr:0,actualM12,M13,M16,M17,M18,AB3,AB4,AB5,AB6,M19,rawCD:100,rawTD:0,actualTD:0,displayAD:25,displayAPS:0,displayAPU:0,actualAPU:(unitOn?183:163),displayUA:1,displaySR:0,displayHR:0,excelPierce:(pierceOn?10:0)};
}
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
  const shareAD=15, shareAS=15, shareCRI=10;
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
  const AP9 = sumStat('AD') + v('rAD') + optionStats.ad + upperStats.ad + ascVlookup3 + reinf + v('rModAD')
            + v('pbless') + shareAD + (v('powerBunkerAD')||0) + (v('postMasterAD')||0)
            + enchantAt(0).ad + epBuff
            + ((vs('additionalADBuff')==='ON') ? (v('additionalADValue')||0) : 0)
            + ((vs('rushADBuff')==='ON') ? 50 : 0)
            + systemAttackBonus() + additionalStats.ad;
  const AP10 = -diff.ad;
  const M4 = AP9 + AP10 + unitADBonus;
  const M7_base = sumStat('AS') + v('rAS') + upperStats.as + ascVlookup4 + reinf + shareAS + v('rModAS') + additionalStats.as;
  const M7 = isPersonalUnit() ? 0 : M7_base;
  const M8 = sumStat('CRI') + v('rCRI') + v('rModCRI') + reinf + 10 + shareCRI + gradeCri + optionStats.cri + upperStats.cri + additionalStats.cri;
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
  const AB6=(1+(M7+personalAs+gradeAs)/100)*(1-diff.as/100)*M13*dt;
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
  return applyExcelInitialZeroSpecStats({M4,M7,M8,M9,M10,M11,M12,M12_dr,actualM12,M13,M16,M17,M18,AB3,AB4,AB5,AB6,M19,
          rawCD,rawTD,actualTD,penTD,penCD,penDmg,penUA,abyssStack:abyssEffectiveStack(),abyssTd:abyssTdPenalty(),abyssSlow:abyssSlowMultiplier(),abyssAd:abyssAdPenalty(),diff,dt,personalAs,gradeAs,asc,reinf,displayAD,displayAPS,displayAPU,actualAPU,displayUA,displaySR,displayHR,actualSR,actualHR,
          spTotal:spU+spO,spU,spO,epU,rpU,soulU,spBank:spBankRawBonus(),spBankApplied:isSpBankApplied(),effectiveSP:effectiveSP(),rpPierce:rpPierceBonus(),excelPierce,enemyData});
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
  return {
    ap:v('rAP'),
    td:(v('rTD') + harmony) * tdRuneMul,
    ua:v('rUA') + harmony
  };
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
function isSpBankApplied(){
  const el=document.getElementById('spBankApply');
  return !el || !!el.checked;
}
function toggleSpBankApply(){
  const el=document.getElementById('spBankApply');
  if(!el) return false;
  el.checked=!el.checked;
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
function renderDpsSummary(s){
  if(shouldHideDpsForRound()){
    setText('dpsVal', '—');
    syncDpsMinDpsInputs();
    updateDpsRiskViews(NaN);
    if(isDpsTableOpen()) renderDpsTableModal();
    return;
  }
  setText('dpsVal', s.M19.toFixed(1));
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
  const baseSP=v('sp');
  const bankSP=s.spBankApplied ? (s.spBank||0) : 0;
  const spOwn=s.effectiveSP||effectiveSP();
  const spRemain=spOwn-s.spTotal;
  setText('spAttackView', fullNumber(s.spO));
  setText('spUtilityView', fullNumber(s.spU));
  const bankValue=s.spBankApplied ? fullNumber(bankSP) : '미적용';
  const bankTitle=s.spBankApplied ? 'SP 은행을 제외하려면 누르세요' : 'SP 은행을 포함하려면 누르세요';
  setHtml('spDetail', `<div class="sp-detail-row"><small>총 SP</small><b>${fullNumber(baseSP)}</b></div><button class="sp-detail-row sp-bank-line ${s.spBankApplied?'bank-on':''}" data-action="toggleSpBankApply" type="button" title="${bankTitle}"><small>SP은행</small><b>${bankValue}</b></button><div class="sp-detail-row"><small>SP 사용량</small><b>${fullNumber(s.spTotal)}</b></div><div class="sp-detail-row"><small>SP 잔여량</small><b>${fullNumber(spRemain)}</b></div>`);
  const epRemain=v('ep')-s.epU, rpRemain=v('rp')-s.rpU, soulRemain=v('soul')-s.soulU;
  setHtml('epRem', `<span>투자 <b>${big(s.epU)}</b></span><em>·</em><span>잔여 <b>${big(epRemain)}</b></span>`);
  setHtml('rpRem', `<span>투자 <b>${big(s.rpU)}</b></span><em>·</em><span>잔여 <b>${big(rpRemain)}</b></span>`);
  setHtml('soulRem', `<span>투자 <b>${big(s.soulU)}</b></span><em>·</em><span>잔여 <b>${big(soulRemain)}</b></span>`);
}
function recalc(){
  try{
    syncExclusiveRuneOptions();
    syncRuneChoice();
    syncEnchantInputs();
    syncSelectButtons();
    syncBuffChoiceButtons();
    formatAllMoneyInputs();
    renderEnchantPreview(); renderXpCut(); renderEnhanceSummary();
    const s=computeStats();
    renderEnemyData(s.enemyData);
    renderSkillDamage(s);
    renderDpsSummary(s);
    renderStatSummary(s);
    renderResourceSummary(s);
    updateTraits();
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
  const labels=['공격력','크리티컬 확률','유닛 가속','총 데미지','실드 감소','체력 감소'];
  const keys=['ad','cri','ua','td','sr','hr'];
  const outIds=['enchOutAD','enchOutCRI','enchOutUA','enchOutTD','enchOutSR','enchOutHR'];
  const values=labels.map((name,i)=>{
    const e=enchantAt(i);
    const val=keys[i]==='ua'
      ? e[keys[i]].toFixed(2)+'×'
      : fmt(e[keys[i]], keys[i]==='ad'||keys[i]==='cri'||keys[i]==='td'?0:2);
    const out=document.getElementById(outIds[i]);
    if(out) out.textContent=val;
    return `<div>${name} Lv.${e.lv}<b>${val}</b></div>`;
  });
  const el=document.getElementById('enchantPreview');
  if(el) el.innerHTML=values.join('');
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
  if(pv) pv.textContent=`라운드별 데미지 감소: ${(penalty*100).toFixed(1)}% (${isTower?'도전의 탑':'일반모드'} ${round}R)`;
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
const DPS_TABLE_DIFFICULTIES=DPS_CONFIG.dpsTable.difficulties;
const DPS_TABLE_ROUNDS=DPS_CONFIG.dpsTable.rounds;
const DPS_TABLE_PENANCE_MIN=DPS_CONFIG.dpsTable.penanceMin ?? 0;
const DPS_TABLE_PENANCE_MAX=DPS_CONFIG.dpsTable.penanceMax ?? 20;
const DPS_TABLE_DECIMALS=DPS_CONFIG.dpsTable.decimals ?? 1;
let activeDpsTableRound=DPS_CONFIG.dpsTable.defaultRound;
let dpsTableMinDps='';
function isDpsTableOpen(){
  return document.getElementById('dpsTableModal')?.classList.contains('is-open') || false;
}
function getActiveDpsTableRoundInfo(){
  return DPS_TABLE_ROUNDS.find(r=>r.round===activeDpsTableRound) || DPS_TABLE_ROUNDS[0];
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
  if(isRisk) badge.textContent=`위험구간 · 최소 DPS ${formatDpsTableValue(minDps)} 이하`;
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
  const currentRound=Math.round(v('round'));
  const head=DPS_TABLE_DIFFICULTIES.map(d=>`<th class="${d===currentDiff?'dps-current-col':''}">${d}</th>`).join('');
  const rows=[];
  for(let pen=DPS_TABLE_PENANCE_MIN; pen<=DPS_TABLE_PENANCE_MAX; pen++){
    const rowCurrent=pen===currentPen;
    const cells=DPS_TABLE_DIFFICULTIES.map(diff=>{
      const value=computeDpsPreview(diff, pen, round);
      const danger=minDps!==null && Number.isFinite(value) && value<=minDps;
      const currentCell=rowCurrent && diff===currentDiff;
      const classes=[danger?'dps-risk-cell':'', diff===currentDiff?'dps-current-col':'', currentCell?'dps-current-cell':''].filter(Boolean).join(' ');
      const title=currentCell ? `현재 선택: ${diff} ${pen}고행${currentRound===round?' / 현재 라운드':''}` : '';
      return `<td class="${classes}"${title?` title="${title}"`:''}>${formatDpsTableValue(value)}</td>`;
    }).join('');
    rows.push(`<tr class="${rowCurrent?'dps-current-row':''}"><th>${pen}</th>${cells}</tr>`);
  }
  return `<table class="dps-matrix"><thead><tr><th>고행</th>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
function renderDpsTableModal(){
  const mount=document.getElementById('dpsTableMount');
  const tabs=document.getElementById('dpsTableTabsMount');
  if(!mount) return;
  const info=getActiveDpsTableRoundInfo();
  if(tabs){
    tabs.innerHTML=DPS_TABLE_ROUNDS.map(r=>`
      <button type="button" class="dps-table-tab ${r.round===info.round?'is-active':''}" data-dps-table-round="${r.round}" role="tab" aria-selected="${r.round===info.round?'true':'false'}">
        <b>${r.round}라운드</b>
        </button>
    `).join('');
  }
  syncDpsMinDpsInputs();
  mount.innerHTML=`<section class="dps-table-panel dps-table-panel-animated"><div class="dps-table-scroll">${buildDpsTable(info.round)}</div></section>`;
}
function switchDpsTableRound(round){
  const next=Number(round);
  if(!DPS_TABLE_ROUNDS.some(r=>r.round===next) || activeDpsTableRound===next) return;
  activeDpsTableRound=next;
  renderDpsTableModal();
}
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
        <div class="dps-table-tabs" id="dpsTableTabsMount" role="tablist" aria-label="DPS표 라운드 선택"></div>
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
function bindDpsTableEvents(){
  document.addEventListener('click', function(e){
    const roundTarget=e.target.closest('[data-dps-table-round]');
    if(roundTarget){
      switchDpsTableRound(roundTarget.getAttribute('data-dps-table-round'));
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
const TIERS=['루키','비기너','아마추어','프로','엑스퍼트','마스터','디바인','더원1','더원2','무한∞','EP특성','RP특성','심연특성'];
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
    updateTraits();
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
  updateTraits();
}
function adjMax(row){
  try{
    if(row===116) return false;
    const before=INV[row]||0;
    fillRowToBudget(row);
    updateTraits();
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
  updateTraits();
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
  updateTraits();
  recalc();
  try{showToast('구간 초기화 완료','ok');}catch(e){}
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
    if(AUTO_INVEST_EXCLUDED_ROWS.has(row)) return false;
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
    for(const [row,add] of changes) INV[row]=(INV[row]||0)-add;
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
    for(const [row,add] of changes) INV[row]=(INV[row]||0)-add;
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
  updateTraits();
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
      if(Number.isFinite(+row)) INV[+row]=0;
    });
    if(116 in INV) INV[116]=1;
    updateTraits();
    recalc();
    try{showToast('특성 전체 초기화 완료','ok');}catch(e){}
    return true;
  }catch(e){
    console.error('[clearAll failed]', e);
    alert('특성 전체 초기화 실패: '+(e && e.message ? e.message : e));
    return false;
  }
}
const STORAGE_VERSION=DPS_CONFIG.storage.version;
const STORAGE_SCOPE=DPS_CONFIG.storage.scope;
const STORAGE_KEY=DPS_CONFIG.storage.key;
const CLIENT_KEY=DPS_CONFIG.storage.clientKey;
const IGNORED_SAVED_VALUE_IDS=[...(DPS_CONFIG.state.skipElementIds || []),'calcMode'];
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
  if(el.type==='checkbox') el.checked=!!value;
  else el.value=value;
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
  storageElementIds().forEach(id=>{
    const el=document.getElementById(id);
    if(el) values[id]=elementDefaultValue(el);
  });
  values.dpsTableMinDps='';
  const inv={};
  TRAITS.forEach(t=>{ inv[t[0]]=0; });
  inv[116]=1;
  return makeStorageEnvelope({
    values,
    inv,
    savedAt:0,
    scope:'public_default'
  });
}
function captureFactoryState(){ FACTORY_STATE=makePublicDefaultState(); }
function makeStorageEnvelope(partial){
  return {
    values:partial.values || {},
    inv:partial.inv || {},
    computed:partial.computed || undefined,
    savedAt:+partial.savedAt || Date.now(),
    storageVersion:partial.storageVersion || STORAGE_VERSION,
    scope:partial.scope || STORAGE_SCOPE,
    ui:partial.ui && typeof partial.ui==='object' ? partial.ui : {fontScale:DPS_CONFIG.ui.fontScaleDefault},
    clientId:partial.clientId || getClientId()
  };
}
function makeComputedSnapshot(){
  const s=computeStats();
  const enemy=s.enemyData || {};
  return {
    dps:s.M19,
    displayStats:{
      AD:s.displayAD, APS:s.displayAPS, APU:s.displayAPU, AS:s.M7, CRI:s.M8, CD:s.rawCD, MC:s.M10, TD:s.rawTD,
      DR:s.M12, PIERCE:s.excelPierce, UA:s.displayUA, SR:s.displaySR, HR:s.displayHR, MD:s.M16, MP:s.M17, MCP:s.M18
    },
    actualStats:{
      AD:s.M4, APS:s.displayAPS, APU:(s.actualAPU ?? s.displayAPU), AS:s.M7, CRI:s.M8, CD:s.M9, MC:s.M10, TD:s.M11, DR:s.actualM12, PIERCE:s.excelPierce, UA:s.M13, SR:(s.actualSR ?? s.displaySR), HR:(s.actualHR ?? s.displayHR), MD:s.M16, MP:s.M17, MCP:s.M18
    },
    enemy:{
      round:enemy.round||0, armor:enemy.armor||0, hp:enemy.hp||0, shield:enemy.shield||0, count:enemy.count||0
    }
  };
}
function makeStateObject(){
  const values={};
  storageElementIds().forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    const value=readElementValue(el);
    if(value!==undefined) values[id]=value;
  });
  values.dpsTableMinDps=dpsTableMinDps;
  return makeStorageEnvelope({
    values,
    inv:{...INV},
    computed:makeComputedSnapshot(),
    savedAt:Date.now(),
    ui:{fontScale:getFontScale()}
  });
}
function sanitizeSavedValues(values){
  if(!values || typeof values!=='object') return {};
  const out={...values};
  IGNORED_SAVED_VALUE_IDS.forEach(id=>delete out[id]);
  if(Object.prototype.hasOwnProperty.call(out,'overEnhance')) out.overEnhance=String(normalizeOverEnhanceValue(out.overEnhance));
  return out;
}
function normalizeLegacyRuneMonthValues(values, storageVersion){
  if(!values || typeof values!=='object') return values;
  if(storageVersion===DPS_CONFIG.storage.version) return values;
  // V107 backups could carry monthly rune "+" counts as 4 even when the Excel spec sheet has N=4, O=0.
  // Normalize only legacy saved/imported states so new manual plus selections remain possible.
  ['apr','sep'].forEach(prefix=>{
    const normalId=prefix+'RuneNormal';
    const plusId=prefix+'RunePlus';
    if(String(values[normalId] ?? '')==='4' && String(values[plusId] ?? '')==='4') values[plusId]='0';
  });
  return values;
}
function normalizeSavedState(data){
  if(!data || typeof data!=='object') return null;
  const legacyAdditional=data.additional || data.additionals || data.additionalInputs || {};
  const rawValues=(data.values && typeof data.values==='object') ? data.values : {};
  const values=normalizeLegacyRuneMonthValues(sanitizeSavedValues({
    ...(legacyAdditional && typeof legacyAdditional==='object' ? legacyAdditional : {}),
    ...rawValues
  }), data.storageVersion);
  const inv=(data.inv && typeof data.inv==='object') ? {...data.inv} : {};
  if(!Object.keys(values).length && !Object.keys(inv).length) return null;
  return makeStorageEnvelope({
    values,
    inv,
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
    Object.entries(sanitizeSavedValues(data.values || {})).forEach(([id,val])=>{
      if(id==='dpsTableMinDps') return;
      const el=document.getElementById(id);
      if(el) writeElementValue(el,val);
    });
    syncAutoEP();
    Object.keys(INV).forEach(k=>{ INV[k]=0; });
    Object.entries(data.inv || {}).forEach(([row,val])=>{
      const r=+row;
      if(!Number.isFinite(r) || !(r in INV)) return;
      INV[r]=Math.max(0, Math.min(TMAX[r]||999, Math.round(+val||0)));
    });
    INV[116]=1;
    enforceBudgets();
    hydrateRuneChoiceFromHidden();
    syncEnchantCodeFromInputs(true);
    syncSelectButtons();
    syncBuffChoiceButtons();
    formatAllMoneyInputs();
    updateTraits();
    recalc();
  }finally{ isLoadingState=false; }
}
function resetToFactoryState(){
  if(!FACTORY_STATE) captureFactoryState();
  applyStateObject(FACTORY_STATE);
}
function safeJsonParse(raw){ try{return JSON.parse(raw);}catch(e){return null;} }
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
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function setStorageStatus(message, type='ok', options={}){
  const el=document.getElementById('storageStatusView');
  if(!el) return;
  el.textContent=message+(options.time ? ` · ${formatStorageTime(options.time)}` : '')+(options.scope ? ` · ${options.scope}` : '');
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
    setStorageStatus('저장됨', 'ok', {time:state.savedAt, scope:'현재 브라우저'});
    if(!silent){
      try{showToast('현재값 저장 완료','ok');}catch(e){}
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
      setStorageStatus('초기 상태', 'idle', {scope:'저장값 없음'});
      return;
    }
    applyStateObject(saved);
    setStorageStatus('저장값 불러옴', 'ok', {time:saved.savedAt||Date.now(), scope:'현재 브라우저'});
  }catch(e){
    console.warn('loadState failed', e);
    resetToFactoryState();
  }
}
function clearSavedState(){
  clearCurrentCalculatorStorage();
  setStorageStatus('저장값 삭제됨', 'warn', {time:Date.now(), scope:'현재 입력값 유지'});
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
    setStorageStatus('백업 파일 생성됨', 'ok', {time:Date.now(), scope:'파일 저장'});
  }catch(e){
    console.error(e);
    alert('백업 실패: '+(e?.message || e));
  }
}
function applyImportedState(data){
  const norm=normalizeSavedState(data);
  if(!norm) throw new Error('계산기 저장값 형식이 아닙니다.');
  applyStateObject(norm);
  saveState({silent:false});
  setStorageStatus('백업 복원 완료', 'ok', {time:Date.now(), scope:'현재 브라우저'});
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
  if(!options.silent) setStorageStatus('글씨 크기 '+Math.round(next*100)+'% 저장됨', 'ok', {time:Date.now(), scope:'PC/태블릿'});
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
  return requestDangerAction('clearAll','한 번 더 누르면 특성 전체 초기화', clearAll);
}
function requestClearSavedState(){
  return requestDangerAction('clearSavedState','한 번 더 누르면 저장값 삭제', clearSavedState);
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
const ACTION_HANDLERS={
  optimizeSP:()=>optimizeSP(),
  clearAll:()=>requestClearAll(),
  saveState:()=>saveState({silent:false}),
  clearSavedState:()=>requestClearSavedState(),
  exportStateBackup:()=>exportStateBackup(),
  importStateBackup:()=>importStateBackup(),
  toggleSpBankApply:()=>toggleSpBankApply(),
  openDpsTable:()=>openDpsTable(),
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
function bindReactiveInputs(){
  let raf=0;
  const schedule=(target)=>{
    if(isLoadingState || suppressSave) return;
    if(!target || !target.id) return;
    if(target.classList && target.classList.contains('tv-input')) return;
    if(target.matches('.money-input')) formatMoneyInput(target);
    if(['runeChoiceType','runeChoiceValue'].includes(target.id)) syncRuneChoice();
    if(ENCHANT_INPUT_IDS.includes(target.id)) syncEnchantInputs();
    if(RUNE_OPTION_SELECT_IDS.includes(target.id)) syncExclusiveRuneOptions();
    if(target.matches('select')) syncSelectButtons();
    if(target.matches('.buff-choice-input')) syncBuffChoiceButtons();
    if(!target.matches('input, select, textarea')) return;
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
  bindFontScaleViewportGuard();
  bindActionEvents();
  bindTraitHoldEvents();
  bindTraitInputEvents();
  bindDpsTableEvents();
  bindReactiveInputs();
  bindButtonPressFeedback();
}
function initApp(){
  loadFontScale();
  bindAppEvents();
  installDpsTableButton();
  renderAppVersion();
  syncEnchantCodeFromInputs(true);
  syncSelectButtons();
  syncBuffChoiceButtons();
  syncExclusiveRuneOptions();
  formatAllMoneyInputs();
  loadState();
  syncExclusiveRuneOptions();
  updateTraits();
  recalc();
}
initApp();
