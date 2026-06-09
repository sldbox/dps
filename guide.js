(function(){
  'use strict';
  const PC_MIN_WIDTH=960;
  const GUIDE_ID='dpsGuideModal';
  const GUIDE_BUTTON_ID='dpsGuideOpenBtn';
  const GUIDE_STYLE_ID='dpsGuideInlineStyle';
  const GUIDE_STYLE=`.guide-open-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;order:-1!important;height:28px!important;padding:0 12px!important;border:1px solid #bfdbfe!important;border-radius:999px!important;background:#eff6ff!important;color:#1d4ed8!important;font-size:12px!important;font-weight:900!important;cursor:pointer!important;box-shadow:0 1px 3px rgba(15,23,42,.08)!important}.guide-open-btn:hover{background:#dbeafe!important;border-color:#93c5fd!important}.guide-modal-shell{display:none;position:fixed;inset:0;z-index:9999}.guide-modal-shell.is-open{display:block}.guide-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.48);backdrop-filter:blur(3px)}.guide-modal{position:relative;width:min(920px,calc(100vw - 40px))!important;max-height:calc(100vh - 34px)!important;margin:17px auto!important;background:#fff;border:1px solid #cbd8ea;border-radius:16px!important;box-shadow:0 24px 80px rgba(15,23,42,.24);overflow:hidden;color:#172033}.guide-modal-head{display:grid!important;grid-template-columns:130px minmax(0,1fr) 38px!important;align-items:center!important;gap:10px!important;padding:10px 14px!important;background:#f8fbff!important;border-bottom:1px solid var(--ui-line)!important}.guide-titlebox{min-width:0!important}.guide-kicker{font-size:10.5px!important;margin:0 0 1px!important;color:#3157d5!important;font-weight:900!important;letter-spacing:.08em!important}.guide-modal-head h2{font-size:19px!important;margin:0!important;line-height:1.15!important;color:#0f172a!important;font-weight:900!important}.guide-tabs{display:flex!important;justify-content:center!important;align-items:center!important;gap:8px!important;min-width:0!important;overflow:auto!important}.guide-tab-btn{height:32px!important;min-width:78px!important;padding:0 14px!important;border:1px solid #cbd5e1;border-radius:999px!important;background:#fff;color:#334155;font-size:12.5px!important;font-weight:900;cursor:pointer}.guide-tab-btn.is-active{background:#3157d5;border-color:#3157d5;color:#fff;box-shadow:0 6px 14px rgba(49,87,213,.16)}.guide-close-btn{justify-self:end!important;width:34px!important;height:34px!important;border:1px solid #cbd8ea;border-radius:10px!important;background:#fff;color:#334155;font-size:24px;line-height:1;cursor:pointer;font-weight:700}.guide-modal-body{max-height:calc(100vh - 102px)!important;padding:10px 12px 12px!important;overflow:auto!important;background:#fff!important}.guide-panel{animation:guideTabFadeIn .16s ease both}@keyframes guideTabFadeIn{from{opacity:.45;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}.guide-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:8px}.guide-summary-card{border:1px solid #dbe7f5;border-radius:12px;background:#f8fbff;padding:9px 11px}.guide-summary-card.warn{background:#fff7ed;border-color:#fed7aa}.guide-summary-card b{display:block;font-size:12px;color:#1e3a8a;font-weight:900;margin-bottom:5px}.guide-summary-card.warn b{color:#b45309}.guide-summary-card span{display:block;font-size:12px;line-height:1.4;color:#334155;font-weight:800}.guide-steps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.guide-step-card{display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px;padding:9px;border:1px solid #dbe7f5;border-radius:12px;background:#fff}.guide-step-no{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:10px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:900}.guide-step-copy b{display:block;font-size:12px;color:#0f172a;font-weight:900;margin-bottom:3px}.guide-step-copy span{display:block;font-size:11.5px;line-height:1.4;color:#526174;font-weight:700}.guide-note-box{display:grid;grid-template-columns:86px minmax(0,1fr);gap:10px;align-items:center;padding:9px 11px;border:1px solid #fed7aa;border-radius:12px;background:#fff7ed;margin-top:10px}.guide-note-box b,.guide-note-box span{font-size:11.5px;line-height:1.35}.guide-note-box b{color:#b45309;font-weight:900}.guide-note-box span{color:#334155;font-weight:800}body.guide-modal-open{overflow:hidden!important}@media (max-width:1100px){.guide-modal-head{grid-template-columns:120px minmax(260px,1fr) 38px!important}.guide-summary,.guide-steps{grid-template-columns:1fr!important}}@media (max-width:960px){.guide-open-btn,.guide-modal-shell{display:none!important}}`;
  const errorText='엑셀과 웹 계산값이 다르면 엑셀 파일과 입력값 백업 파일을 함께 보내주세요. 어떤 입력에서 차이가 나는지 빠르게 확인할 수 있습니다.';
  const cacheVersion=window.DPS_VERSION || 'dev';
  const GUIDE_TABS=[
    {id:'start',label:'처음쓰기',summary:[['기본 순서','기본정보 → 룬스펙 → 룬효과/버프 → 특성보드 → 스텟보드 순서로 맞추면 됩니다.'],['입력 색상','파란 칸은 직접 입력/선택, 흰 칸은 자동 계산 또는 스텟보드 표시입니다.'],['자동 계산','XP/BXP를 입력하면 EP가 자동 계산되고, EP/RP/심연의 혼 사용량과 잔여량도 함께 표시됩니다.']],steps:[['01','기본정보 입력','총 SP, XP/BXP, RP, 심연의 혼을 입력하고 난이도·고행·라운드를 선택합니다.'],['02','룬스펙 입력','룬 스탯, 옵션, 에디셔널 평균값, 인챈트 레벨을 입력합니다.'],['03','룬효과/버프 선택','4월/9월, 오버핸스, 리페핸스, 강화의 달인과 필요한 버프를 한 화면에서 맞춥니다.'],['04','특성보드 조정','특성 투자값, 최적화 범위, SP은행 적용 여부를 확인합니다.'],['05','스텟보드 확인','DPS와 표기/실질 스탯을 확인합니다. 목표 라운드가 0이면 DPS는 표시되지 않습니다.']]},
    {id:'basic',label:'기본정보',summary:[['재화 입력','총 SP, XP/BXP, RP, 심연의 혼은 계산의 시작값입니다.'],['전투 조건','난이도, 고행 단계, 목표 라운드가 DPS와 컷 계산에 영향을 줍니다.'],['라운드 0 제한','목표 라운드가 정확히 0이면 잘못된 기준 계산을 막기 위해 DPS가 —로 표시됩니다.']],steps:[['01','총 SP 입력','현재 사용할 수 있는 총 SP를 입력합니다.'],['02','XP/BXP 입력','보유 XP와 BXP를 넣으면 EP가 자동으로 계산됩니다.'],['03','RP/심연의 혼 입력','보유 RP와 심연의 혼을 입력해 특성 투자 가능량을 맞춥니다.'],['04','난이도 선택','난이도, 고행 단계, 목표 라운드, 승단 총데미지를 선택합니다.'],['05','잔여값 확인','EP/RP/심연의 혼 잔여값이 부족하면 관련 특성 투자를 줄입니다.']]},
    {id:'rune',label:'룬/버프',summary:[['룬효과/버프','룬효과와 버프는 한 영역으로 통합되어 있으며 선택된 항목은 파란 박스로 표시됩니다.'],['기본 적용 옵션','단일유닛버프와 방어력관통 10%는 신규 유저 초기값에서 OFF입니다. 필요한 경우 직접 켜서 비교합니다.'],['룬스펙','룬 기본 스탯, 강화수, 각성, 종족/10강/15강/초월 옵션과 에디셔널 평균값을 입력합니다.']],steps:[['01','룬스펙 입력','룬 스탯, 강화수, 각성, 종족 옵션을 입력합니다.'],['02','룬효과 선택','4월/9월, 오버핸스, 리페핸스, 강화의 달인을 맞춥니다.'],['03','버프 선택','단일유닛버프, 방어력관통 10%, 꽃 버프, 유닛생산 버프를 실제 적용 상태와 맞춥니다.'],['04','10강/15강/초월 선택','같은 옵션은 중복 선택되지 않으며, 선택한 옵션은 다른 목록에서 자동 제외됩니다.'],['05','인챈트 입력','인챈트는 0~9 레벨로 입력하고 증가 스탯을 확인합니다.']]},
    {id:'traits',label:'특성보드',summary:[['투자 방식','숫자 입력, +/- 버튼, MAX로 직접 조정할 수 있고, 자동 투자에는 구간 마스터와 특성 최적화를 사용할 수 있습니다.'],['SP은행','SP은행 표시칸을 누르면 포함/미적용이 바뀝니다. 별도 버프 토글이 아닙니다.'],['초기화 주의','특성 전체 초기화는 특성 투자값만 초기화합니다. 앱 전체 초기화가 아니므로 저장값 삭제/입력값 복원과 구분하세요.']],steps:[['01','상단 기능 확인','특성보드 바로 아래에서 특성 최적화, 특성 전체 초기화, 최적화 범위를 먼저 확인합니다.'],['02','특성 최적화','개인전 기준으로 루키 교환횟수 증가, 디바인 팀 교환횟수 증가는 자동 투자에서 제외됩니다. 협동전용으로 필요하면 직접 투자하세요.'],['03','직접 조정','원하는 특성은 숫자 입력, +/- 버튼, MAX로 세부 조정합니다.'],['04','SP은행 설정','SP은행 값 칸을 눌러 포함/미적용을 전환하고 SP 사용량을 확인합니다.'],['05','재화 부족 확인','SP, EP, RP, 심연의 혼 잔여값이 음수가 되지 않는지 확인합니다.']]},
    {id:'result',label:'스텟보드',summary:[['DPS','상단 DPS와 스텟보드 영역의 표기 스탯을 기준으로 최종 상태를 확인합니다.'],['라운드 확인','목표 라운드가 0이면 DPS가 표시되지 않으므로 1 이상의 라운드를 입력하세요.'],['모바일 사용','모바일은 상단 탭을 눌러 이동하고, 각 탭 안에서만 세로로 스크롤합니다.']],steps:[['01','DPS 확인','목표 라운드와 고행 단계가 맞는지 확인한 뒤 DPS를 봅니다.'],['02','표기 스탯 확인','공격력, 공격속도, 크리티컬, 총데미지 등 인게임 표기 기준 스탯을 확인합니다.'],['03','컷 확인','버스 승객 컷에서 2인/3인 기준값을 확인합니다.'],['04','필살기 확인','더블스페/모드/라운드를 맞춘 뒤 스킬별 피해량을 확인합니다.']]},
    {id:'backup',label:'저장복구',summary:[['현재값 저장','현재 브라우저에 입력 상태를 저장합니다. 같은 기기에서 다시 열 때 사용합니다.'],['입력값 백업','다른 기기에서 쓰거나 오류 제보할 때 백업 파일을 만듭니다.'],['최신 버전 확인',`이번 배포 캐시 버전은 v=${cacheVersion}입니다. 화면이 이상하면 새로고침 후 이 버전으로 접속합니다.`],['오류 제보',errorText]],steps:[['01','현재값 저장','현재 입력 상태를 브라우저에 저장합니다.'],['02','백업 생성','입력값 백업을 눌러 파일로 저장합니다.'],['03','백업 복원','입력값 복원으로 저장했던 파일을 불러옵니다.'],['04','최신 파일 확인','화면이 이상하면 새 버전 주소로 접속하거나 브라우저 새로고침을 합니다.'],['05','제보 준비','계산이 다르면 엑셀 파일과 입력값 백업 파일을 함께 전달합니다.']]}
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
