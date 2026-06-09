(function(){
  'use strict';
  const PC_MIN_WIDTH=960;
  const GUIDE_ID='dpsGuideModal';
  const GUIDE_BUTTON_ID='dpsGuideOpenBtn';
  const GUIDE_STYLE_ID='dpsGuideInlineStyle';
  const GUIDE_STYLE=`.guide-open-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;order:-1!important;height:28px!important;padding:0 12px!important;border:1px solid #bfdbfe!important;border-radius:999px!important;background:#eff6ff!important;color:#1d4ed8!important;font-size:12px!important;font-weight:900!important;cursor:pointer!important;box-shadow:0 1px 3px rgba(15,23,42,.08)!important}.guide-open-btn:hover{background:#dbeafe!important;border-color:#93c5fd!important}.guide-modal-shell{display:none;position:fixed;inset:0;z-index:9999}.guide-modal-shell.is-open{display:block}.guide-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.48);backdrop-filter:blur(3px)}.guide-modal{position:relative;width:min(920px,calc(100vw - 40px))!important;max-height:calc(100vh - 34px)!important;margin:17px auto!important;background:#fff;border:1px solid #cbd8ea;border-radius:16px!important;box-shadow:0 24px 80px rgba(15,23,42,.24);overflow:hidden;color:#172033}.guide-modal-head{display:grid!important;grid-template-columns:130px minmax(0,1fr) 38px!important;align-items:center!important;gap:10px!important;padding:10px 14px!important;background:#f8fbff!important;border-bottom:1px solid var(--ui-line)!important}.guide-titlebox{min-width:0!important}.guide-kicker{font-size:10.5px!important;margin:0 0 1px!important;color:#3157d5!important;font-weight:900!important;letter-spacing:.08em!important}.guide-modal-head h2{font-size:19px!important;margin:0!important;line-height:1.15!important;color:#0f172a!important;font-weight:900!important}.guide-tabs{display:flex!important;justify-content:center!important;align-items:center!important;gap:8px!important;min-width:0!important;overflow:auto!important}.guide-tab-btn{height:32px!important;min-width:78px!important;padding:0 14px!important;border:1px solid #cbd5e1;border-radius:999px!important;background:#fff;color:#334155;font-size:12.5px!important;font-weight:900;cursor:pointer}.guide-tab-btn.is-active{background:#3157d5;border-color:#3157d5;color:#fff;box-shadow:0 6px 14px rgba(49,87,213,.16)}.guide-close-btn{justify-self:end!important;width:34px!important;height:34px!important;border:1px solid #cbd8ea;border-radius:10px!important;background:#fff;color:#334155;font-size:24px;line-height:1;cursor:pointer;font-weight:700}.guide-modal-body{max-height:calc(100vh - 102px)!important;padding:10px 12px 12px!important;overflow:auto!important;background:#fff!important}.guide-panel{animation:guideTabFadeIn .16s ease both}@keyframes guideTabFadeIn{from{opacity:.45;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}.guide-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:8px}.guide-summary-card{border:1px solid #dbe7f5;border-radius:12px;background:#f8fbff;padding:9px 11px}.guide-summary-card.warn{background:#fff7ed;border-color:#fed7aa}.guide-summary-card b{display:block;font-size:12px;color:#1e3a8a;font-weight:900;margin-bottom:5px}.guide-summary-card.warn b{color:#b45309}.guide-summary-card span{display:block;font-size:12px;line-height:1.4;color:#334155;font-weight:800}.guide-steps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.guide-step-card{display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px;padding:9px;border:1px solid #dbe7f5;border-radius:12px;background:#fff}.guide-step-no{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:10px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:900}.guide-step-copy b{display:block;font-size:12px;color:#0f172a;font-weight:900;margin-bottom:3px}.guide-step-copy span{display:block;font-size:11.5px;line-height:1.4;color:#526174;font-weight:700}.guide-note-box{display:grid;grid-template-columns:86px minmax(0,1fr);gap:10px;align-items:center;padding:9px 11px;border:1px solid #fed7aa;border-radius:12px;background:#fff7ed;margin-top:10px}.guide-note-box b,.guide-note-box span{font-size:11.5px;line-height:1.35}.guide-note-box b{color:#b45309;font-weight:900}.guide-note-box span{color:#334155;font-weight:800}body.guide-modal-open{overflow:hidden!important}@media (max-width:1100px){.guide-modal-head{grid-template-columns:120px minmax(260px,1fr) 38px!important}.guide-summary,.guide-steps{grid-template-columns:1fr!important}}@media (max-width:960px){.guide-open-btn,.guide-modal-shell{display:none!important}}`;
  const errorText='엑셀과 웹버전이 다르다면 엑셀 파일과 웹 특성저장파일을 같이 보내주시면 오류해결에 큰 도움이 됩니다.';
  const GUIDE_TABS=[
    {id:'start',label:'시작',summary:[['화면 기준','파란 배경은 직접 입력/선택, 흰 배경은 자동계산/읽기전용 값입니다.'],['기본정보','총 SP, XP/BXP, RP, 심연의 혼과 난이도, 고행 단계, 목표 라운드를 먼저 맞춥니다.'],['자동 계산','XP/BXP를 입력하면 EP가 자동 계산되고, EP/RP/심연의 혼 사용·잔여값은 흰색 영역에 표시됩니다.']],steps:[['01','기본정보 입력','파란 입력칸에 총 SP, 보유 XP/BXP, RP, 심연의 혼을 입력합니다.'],['02','전투 조건 선택','난이도, 고행 단계, 목표 라운드, 승단 타이틀 총데미지, 침식/인원 조건을 선택합니다.'],['03','룬/강화/버프 입력','룬 스펙, 에디셔널, 인첸트 레벨, 유닛 강화, 꽃가루와 생산 버프를 인게임 상태와 맞춥니다.'],['04','특성 투자','직접 투자하거나 최적화 범위를 선택한 뒤 특성 최적화를 실행합니다.'],['05','결과 확인','특성보드, 인게임 표기 스탯, 버스 승객 컷, 필살기 데미지를 확인합니다.']]},
    {id:'stats',label:'스탯',summary:[['인게임 표기 스탯','상단에는 DPS가 표시되고, 아래 상세표에는 인게임 표기 기준 스탯이 정리됩니다.'],['버스 승객 컷','총 SP 기준으로 2인/3인 컷을 리스트형으로 보여줍니다.'],['필살기 데미지','왼쪽은 더블스페/모드/라운드 설정, 오른쪽은 스킬별 피해량입니다. AP 값은 필살기 헤더 우측 배지에 표시됩니다.']],steps:[['01','DPS 확인','인게임 표기 스탯 영역의 DPS 값을 먼저 확인합니다.'],['02','상세 스탯 확인','공격력, 공격속도, 크리티컬, 총 데미지 등 상세 스탯을 확인합니다.'],['03','버스컷 확인','버스 승객 컷에서 2인/3인 기준값을 확인합니다.'],['04','필살기 확인','필살기 설정을 조정하고 스킬별 피해량 변화를 확인합니다.']]},
    {id:'rune-buff',label:'룬/버프',summary:[['룬스펙','기본 스탯/개조, 강화/옵션, 에디셔널, 인첸트 레벨/결과가 한 영역에 정리됩니다.'],['인첸트','인첸트는 레벨 입력과 결과값이 3열 구조로 표시됩니다.'],['버프 스위치','버프는 ON/OFF 토글로 적용 여부를 선택합니다.']],steps:[['01','기본 룬 입력','룬 기본 스탯과 개조 값을 인게임 상태와 맞춥니다.'],['02','강화/옵션 선택','룬 강화 수, 룬 각성, 종족/10강/15강 옵션을 선택합니다.'],['03','에디셔널 입력','에디셔널 평균값이 있으면 해당 입력칸에 입력합니다.'],['04','인첸트 레벨 입력','각 인첸트 슬롯에 0~9 레벨을 입력하고 결과값을 확인합니다.'],['05','버프 적용','꽃가루, 생산 버프 등 필요한 스위치를 ON/OFF로 맞춥니다.']]},
    {id:'traits',label:'특성보드',summary:[['투자 방식','숫자 직접 입력, +/- 버튼, MAX, 구간 마스터를 사용할 수 있습니다.'],['특성보드','총 SP, SP 사용량, SP 잔여량, SP은행 적용 상태를 한 번에 확인합니다.'],['초기화','구간별 초기화와 전체 초기화는 되돌리기 어려우니 실행 전에 확인합니다.']],steps:[['01','범위 선택','최적화 범위를 먼저 선택합니다.'],['02','최적화 실행','특성 최적화를 누르면 선택 범위 기준으로 자동 투자됩니다.'],['03','직접 조정','필요한 특성은 숫자 입력, +/- 버튼, MAX로 직접 조정합니다.'],['04','구간 관리','구간 마스터 또는 초기화를 사용할 때는 적용 대상 구간을 확인합니다.'],['05','재화 확인','SP 사용량과 잔여량, EP/RP/심연의 혼 사용·잔여값을 확인합니다.']]},
    {id:'backup',label:'저장',summary:[['현재값 저장','현재 브라우저에 계속 쓸 값을 저장합니다.'],['입력값 백업','다른 기기에서 쓰거나 제보할 때 사용할 파일을 저장합니다.'],['글씨 크기','PC/태블릿은 A-/100%/A+로 90~200%까지 조절할 수 있습니다. 모바일에서는 숨깁니다.'],['오류 제보',errorText]],steps:[['01','현재값 저장','현재 입력 상태를 브라우저에 저장합니다.'],['02','백업 파일 생성','입력값 백업을 눌러 파일로 저장합니다.'],['03','백업 복원','입력값 복원으로 저장했던 파일을 불러옵니다.'],['04','제보 준비','수치가 다르면 엑셀 파일과 특성저장파일을 함께 전달하면 확인이 빠릅니다.']]}
  ];
  let activeGuideTab='start';
  function isPcView(){return document.body.classList.contains('is-pc-portrait') || document.body.classList.contains('is-pc-landscape') || (window.matchMedia && window.matchMedia(`(min-width:${PC_MIN_WIDTH}px)`).matches);}
  function installGuideStyles(){
    if(document.getElementById(GUIDE_STYLE_ID)) return;
    const styleEl=document.createElement('style');
    styleEl.id=GUIDE_STYLE_ID;
    styleEl.textContent=GUIDE_STYLE;
    document.head.appendChild(styleEl);
  }
  function renderGuideTab(){
    const tab=GUIDE_TABS.find(t=>t.id===activeGuideTab) || GUIDE_TABS[0];
    const nav=document.getElementById('guideTabsMount');
    const content=document.getElementById('guideTabContent');
    if(!nav || !content) return;
    nav.innerHTML=GUIDE_TABS.map(t=>`<button type="button" class="guide-tab-btn ${t.id===tab.id?'is-active':''}" data-guide-tab="${t.id}" aria-selected="${t.id===tab.id?'true':'false'}">${t.label}</button>`).join('');
    content.innerHTML=`<div class="guide-panel"><div class="guide-summary">${tab.summary.map(([title,body])=>`<div class="guide-summary-card ${title==='오류 제보'?'warn':''}"><b>${title}</b><span>${body}</span></div>`).join('')}</div><div class="guide-steps">${tab.steps.map(([no,title,body])=>`<div class="guide-step-card"><div class="guide-step-no">${no}</div><div class="guide-step-copy"><b>${title}</b><span>${body}</span></div></div>`).join('')}</div></div>`;
  }
  function createModal(){
    installGuideStyles();
    if(document.getElementById(GUIDE_ID)) return;
    const modal=document.createElement('div');
    modal.id=GUIDE_ID;
    modal.className='guide-modal-shell';
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML=`<div class="guide-backdrop" data-guide-close="1"></div><section class="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guideTitle"><header class="guide-modal-head"><div class="guide-titlebox"><p class="guide-kicker">특성 계산기</p><h2 id="guideTitle">가이드</h2></div><div class="guide-tabs" id="guideTabsMount" role="tablist" aria-label="가이드 항목 선택"></div><button type="button" class="guide-close-btn" data-guide-close="1" aria-label="가이드 닫기">×</button></header><div class="guide-modal-body"><div id="guideTabContent"></div><div class="guide-note-box"><b>오류 제보</b><span>${errorText}</span></div></div></section>`;
    document.body.appendChild(modal);
    renderGuideTab();
  }
  function openGuide(){
    if(!isPcView()) return;
    createModal();
    renderGuideTab();
    const modal=document.getElementById(GUIDE_ID);
    if(!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('guide-modal-open');
    modal.querySelector('.guide-close-btn')?.focus({preventScroll:true});
  }
  function closeGuide(){
    const modal=document.getElementById(GUIDE_ID);
    if(!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('guide-modal-open');
  }
  function installButton(){
    const target=document.querySelector('.hdr-meta') || document.querySelector('.app-header') || document.body;
    if(!target || !isPcView()) return;
    if(document.getElementById(GUIDE_BUTTON_ID)) return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.id=GUIDE_BUTTON_ID;
    btn.className='guide-open-btn';
    btn.textContent='가이드';
    btn.addEventListener('click', openGuide);
    const dpsBtn=document.getElementById('dpsTableOpenBtn');
    if(dpsBtn && dpsBtn.parentElement===target) dpsBtn.insertAdjacentElement('afterend', btn);
    else target.prepend(btn);
  }
  function bindGlobalEvents(){
    document.addEventListener('click', function(e){
      const tabTarget=e.target.closest('[data-guide-tab]');
      if(tabTarget){activeGuideTab=tabTarget.getAttribute('data-guide-tab') || 'start';renderGuideTab();return;}
      if(e.target.closest('[data-guide-close]')) closeGuide();
    });
    document.addEventListener('keydown', function(e){if(e.key==='Escape') closeGuide();});
    window.addEventListener('dps:open-guide', openGuide);
    window.addEventListener('resize', function(){
      const btn=document.getElementById(GUIDE_BUTTON_ID);
      if(isPcView()) installButton();
      else {btn?.remove();closeGuide();}
    });
    window.addEventListener('load', function(){
      if(isPcView()) installButton();
    });
  }
  function initGuide(){installGuideStyles();installButton();bindGlobalEvents();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', initGuide);
  else initGuide();
})();
