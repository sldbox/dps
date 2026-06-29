/* ===== trait-board.js | 특성보드 / 투자 입력 / 최적화 ===== */
/* 특성 투자 UI를 렌더링하고, 투자 증감·초기화·효율 Top 5 적용을 담당한다. */

/* ===== 00. 특성 티어 상수 ===== */
const INFINITE_TRAIT_TIER='무한∞';
const TIERS=['루키','비기너','아마추어','프로','엑스퍼트','마스터','디바인','더원1','더원2',INFINITE_TRAIT_TIER,'EP특성','RP특성','심연특성'];
/* ===== 01. 특성보드 렌더링 ===== */
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
    return `<div class="trait-group"><h4><span class="trait-title">${tier}</span><span class="trait-tools"><button type="button" class="ui-action-btn mini-btn master" data-action="masterTier" data-tier="${tier}">구간 마스터</button><button type="button" class="ui-action-btn mini-btn reset danger" data-action="resetTier" data-tier="${tier}">초기화</button></span></h4>${rows}</div>`;
  }).join('');
}
let traitKeyNavGuardUntil=0;
/* ===== 02. 특성 입력값 커밋 / 포커스 이동 ===== */
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
/* ===== 03. 특성 직접 입력 이벤트 ===== */
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
/* ===== 04. 특성 증감 / 버튼 홀드 ===== */
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
/* ===== 05. 티어 일괄 적용 / 초기화 ===== */
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
/* ===== 06. 유틸 특성 최적화 / 유틸 초기화 ===== */
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
/* 특성 효율 추천 데이터는 calc.js의 buildTraitEfficiencyRecommendations()를 사용한다. */
/* ===== 07. 투자효율 Top 5 렌더링 / 적용 ===== */
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
/* SP 최적화 계산은 calc.js의 optimizeSP()를 사용한다. */
/* ===== 08. 전체 특성 초기화 ===== */
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
