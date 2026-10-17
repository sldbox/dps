/* 공통 모달
 * - 포커스/닫기 처리
 * - DPS표와 프리셋 등 공용 모달 동작
 */
(() => {
  'use strict';

  /* 공통 모달 상태·쉘 */
  const DPS_TABLE_MODAL_ID='dpsTableModal';
  const BOARD_MODAL_IDS=Object.freeze(['sanctuarySkillModal','busPassengerModal','zeroRankInfoModal']);
  let eventsBound=false;

  function createShell(id,className,innerHtml){
    const existing=document.getElementById(id);
    if(existing) return existing;
    const modal=document.createElement('div');
    modal.id=id;
    modal.className=className;
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML=innerHtml;
    document.body.appendChild(modal);
    return modal;
  }

  function setOpen(id,bodyClass,open,options={}){
    const modal=document.getElementById(id);
    if(!modal) return null;
    const active=!!open;
    modal.classList.toggle('is-open',active);
    modal.setAttribute('aria-hidden',active?'false':'true');
    if(bodyClass){
      document.body?.classList.toggle(bodyClass,active);
      if(options.rootClass) document.documentElement?.classList.toggle(bodyClass,active);
    }
    return modal;
  }

  function isOpen(id){
    return document.getElementById(id)?.classList.contains('is-open')===true;
  }

  function syncModeClasses(dialog,modes,activeMode=''){
    const variants=Array.isArray(modes)?modes:[];
    variants.forEach(mode=>{
      dialog?.classList.remove(`is-dps-mode-${mode}`);
      document.body?.classList.remove(`is-dps-mode-${mode}`);
    });
    if(!variants.includes(activeMode)) return;
    dialog?.classList.add(`is-dps-mode-${activeMode}`);
    document.body?.classList.add(`is-dps-mode-${activeMode}`);
  }

  /* 보드 분리 모달 */
  function closeBoardModal(id=''){
    const ids=BOARD_MODAL_IDS.includes(id) ? [id] : BOARD_MODAL_IDS;
    ids.forEach(modalId=>setOpen(modalId,'board-modal-open',false,{rootClass:true}));
    if(!BOARD_MODAL_IDS.some(isOpen)){
      document.body?.classList.remove('board-modal-open');
      document.documentElement?.classList.remove('board-modal-open');
    }
  }
  function openBoardModal(id){
    if(!BOARD_MODAL_IDS.includes(id)) return;
    closeBoardModal();
    const modal=setOpen(id,'board-modal-open',true,{rootClass:true});
    requestAnimationFrame(()=>{
      const closeButton=modal?.querySelector('.board-modal-close');
      if(closeButton && typeof closeButton.focus==='function') closeButton.focus({preventScroll:true});
    });
  }
  function getOpenBoardModalId(){
    return BOARD_MODAL_IDS.find(isOpen) || '';
  }

  /* DPS표 */
  function renderDpsTableModalHeader(){
    const modal=document.getElementById(DPS_TABLE_MODAL_ID);
    if(!modal) return;
    const title=dpsTableDisplayTitle();
    const titleEl=document.getElementById('dpsTableTitle');
    const actions=document.getElementById('dpsTableHeaderActions');
    const closeButton=modal.querySelector('.dps-table-modal-close');
    if(titleEl) titleEl.textContent=title;
    if(closeButton) closeButton.setAttribute('aria-label',`${title} 닫기`);
    if(actions){
      actions.innerHTML=`<div class="dps-table-tabs dps-table-header-tabs" id="dpsTableTabsMount" data-dps-table-tabs-mount role="tablist" aria-label="DPS 기준 선택">${renderDpsTableTabs()}</div>`;
    }
  }

  function renderDpsTablePanel(){
    return `<section class="dps-table-modal-panel dps-table-inline-panel" role="tabpanel" aria-labelledby="dpsTableTitle">
      <div class="dps-table-body" id="dpsTableMount" data-dps-table-mount></div>
    </section>`;
  }

  function createDpsTableModal(){
    return createShell(DPS_TABLE_MODAL_ID,'dps-table-modal-shell',`
      <div class="dps-table-modal-backdrop" data-dps-table-close="1"></div>
      <section class="dps-table-modal" role="dialog" aria-modal="true" aria-labelledby="dpsTableTitle">
        <header class="dps-table-modal-head">
          <div class="dps-table-modal-brand"><span class="dps-table-modal-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"><rect x="2.5" y="3" width="19" height="18" rx="4"/><path d="m6 16 4-4 3 2 5-6m-3 0h3v3"/></svg></span><div><h2 id="dpsTableTitle" class="dps-table-modal-title">DPS표</h2><small>DAMAGE ANALYTICS</small></div></div>
          <div class="dps-table-modal-actions" id="dpsTableHeaderActions"></div>
          <button type="button" class="ui-icon-btn dps-table-modal-close" data-dps-table-close="1" aria-label="DPS표 닫기">×</button>
        </header>
        <div class="dps-table-modal-body">
          ${renderDpsTablePanel()}
        </div>
      </section>`);
  }

  function openDpsTableModal(){
    createDpsTableModal();
    renderDpsTableModalHeader();
    renderDpsTablePanelContent();
    setOpen(DPS_TABLE_MODAL_ID,'dps-table-modal-open',true);
  }

  function closeDpsTableModal(){
    if(!isOpen(DPS_TABLE_MODAL_ID)) return;
    const modal=document.getElementById(DPS_TABLE_MODAL_ID);
    setOpen(DPS_TABLE_MODAL_ID,'dps-table-modal-open',false);
    syncModeClasses(modal?.querySelector('.dps-table-modal'),DPS_MODAL_MODES);
  }

  /* 통합 이벤트·공개 API */
  function handleDocumentClick(event){
    const target=event.target instanceof Element?event.target:null;
    if(!target) return;
    const boardModalClose=target.closest('[data-board-modal-close]');
    if(boardModalClose){
      closeBoardModal(boardModalClose.closest('.board-modal-shell')?.id || '');
      return;
    }
    if(target.closest('[data-dps-table-close]')){
      closeDpsTableModal();
      return;
    }
    const modeTarget=target.closest('[data-dps-table-mode]');
    if(modeTarget) switchDpsTableMode(modeTarget.getAttribute('data-dps-table-mode'));
  }

  function handleDocumentKeydown(event){
    if(event.key==='Escape'){
      const openBoardId=getOpenBoardModalId();
      if(openBoardId){
        closeBoardModal(openBoardId);
        event.preventDefault();
        return;
      }
      if(isOpen(DPS_TABLE_MODAL_ID)) closeDpsTableModal();
      return;
    }
  }

  function bindEvents(){
    if(eventsBound) return;
    eventsBound=true;
    document.addEventListener('click',handleDocumentClick);
    document.addEventListener('change',event=>{if(event.target?.matches?.('[data-dps-view-diff]')) changeDpsVisualDifficulty(event.target.value);});
    document.addEventListener('keydown',handleDocumentKeydown,true);
  }

  window.DpsModal=Object.freeze({
    createShell,
    setOpen,
    isOpen,
    syncModeClasses,
    openDpsTableModal,
    closeDpsTableModal,
    openBoardModal,
    closeBoardModal,
    bindEvents
  });
})();


/* 이용 가이드 · modal.js 내부 통합 모듈 (기존 프리셋 데이터 및 UI 동작 유지) */
(()=>{
'use strict';
const GUIDE_STYLES = `body .trait-preset-guide-trigger{display:inline-flex;align-items:center;justify-content:center;gap:6px;flex:0 0 auto;min-height:32px;margin:0;padding:0 10px;border:1px solid #6ba9da;border-radius:9px;background:linear-gradient(135deg,#2b608f,#1c456d);color:#ebf7ff;font-size:calc(12px * var(--app-font-scale));font-weight:900;line-height:1.3;box-shadow:inset 0 1px rgba(255,255,255,.14),0 3px 9px rgba(4,19,42,.22);cursor:pointer;transition:background .18s,border-color .18s,transform .18s;}
body .trait-preset-guide-trigger svg{width:19px;height:19px;flex:none;filter:drop-shadow(0 0 4px rgba(122,198,255,.20));}

body .trait-preset-guide-trigger:focus-visible, .trait-preset-guide-close:focus-visible, .trait-preset-guide-confirm:focus-visible{outline:2px solid #b7dbff;outline-offset:3px;}
/* PRESET GUIDE · 2단계 안내 및 독립형 프리셋 시뮬레이터 */
.trait-preset-guide-shell{position:fixed;inset:0;z-index:10040;display:none;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;}
.trait-preset-guide-shell.is-open{display:flex;}
.trait-preset-guide-backdrop{position:absolute;inset:0;background:rgba(2,9,20,.83);backdrop-filter:blur(11px);-webkit-backdrop-filter:blur(11px);}
.trait-preset-guide-dialog{position:relative;z-index:1;display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:min(680px,100%);max-height:calc(100dvh - 36px);border:1px solid #4e729c;border-radius:21px;background:var(--ui-panel-body-bg);color:#e8f1ff;box-shadow:0 32px 94px rgba(0,0,0,.72),0 0 0 1px rgba(159,198,244,.09),inset 0 1px rgba(255,255,255,.07);overflow:hidden;transition:width .3s ease;border-color:var(--ui-panel-border);}
.trait-preset-guide-dialog.is-practice{width:min(920px,100%);}
.trait-preset-guide-dialog::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#5fafff,#8a93f8,#4ad3bc);z-index:2;}
.trait-preset-guide-top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 21px 6px;height:auto;min-height:var(--ui-integrated-head-height);max-height:none;background:var(--ui-integrated-head-bg);border-bottom:1px solid var(--ui-integrated-head-line);color:var(--ui-integrated-head-text);}
.trait-preset-guide-overline{display:flex;align-items:center;gap:9px;color:#94b9e3;font-size:10px;letter-spacing:1.5px;font-weight:950;white-space:nowrap;}
.trait-preset-guide-overline-dot{width:7px;height:7px;border-radius:50%;background:#6dd8bd;box-shadow:0 0 0 4px rgba(109,216,189,.1);}
.trait-preset-guide-top-tag{margin-left:3px;padding:4px 7px;border:1px solid rgba(137,187,239,.25);border-radius:5px;background:rgba(105,159,222,.08);color:#c5defd;letter-spacing:.65px;font-size:9px;}
.trait-preset-guide-page-label{margin-left:auto;color:#aac8e7;font-size:10px;font-weight:900;letter-spacing:.35px;white-space:nowrap;}
.trait-preset-guide-page-label i{color:#567ba2;font-style:normal;}
.trait-preset-guide-close{display:grid;place-items:center;flex:0 0 31px;width:31px;height:31px;padding:0;border:1px solid #3c597c;border-radius:9px;background:#14283f;color:#acc8e7;font-size:22px;line-height:1;cursor:pointer;}

.trait-preset-guide-content{min-height:0;background:var(--ui-panel-body-bg);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-color:#3c638d transparent;}
.trait-preset-guide-page{min-width:0;padding:14px 27px 21px;animation:traitGuideEnter .38s cubic-bezier(.22,1,.36,1) both;}
.trait-preset-guide-shell .trait-preset-guide-page[hidden],.trait-preset-guide-shell .trait-preset-guide-explain-step[hidden],.trait-preset-guide-shell .trait-preset-guide-footer-actions button[hidden]{display:none;}
.trait-preset-guide-hero{display:flex;align-items:center;gap:17px;margin:5px 0 13px;min-width:0;}
.trait-preset-guide-hero-copy{min-width:0;}
.trait-preset-guide-hero-mark{display:grid;place-items:center;flex:0 0 69px;width:69px;height:69px;border:1px solid rgba(123,182,252,.48);border-radius:19px;background:radial-gradient(circle at 28% 12%,rgba(102,184,252,.28),transparent 70%),linear-gradient(145deg,#193958,#0c1d32);box-shadow:0 10px 28px rgba(23,82,158,.29),inset 0 1px rgba(255,255,255,.13),0 0 0 5px rgba(79,137,205,.08);}
.trait-preset-guide-hero-mark svg{width:48px;height:48px;filter:drop-shadow(0 3px 8px rgba(43,157,241,.26));}
.trait-preset-guide-kicker{color:#78d6ce;font-size:10.5px;font-weight:900;letter-spacing:.5px;}
.trait-preset-guide-content h2{margin:5px 0 0;color:#f5f9ff;font-size:clamp(23px,3.5vw,28px);font-weight:950;line-height:1.32;letter-spacing:-.9px;word-break:keep-all;}
.trait-preset-guide-content h2 em{font-style:normal;color:#8cc3ff;}
.trait-preset-guide-intro>p:not(.trait-preset-guide-note){margin:0;color:#afc4de;font-size:12px;line-height:1.7;word-break:keep-all;}
.trait-preset-guide-timeline{display:grid;gap:9px;margin-top:16px;}
.trait-preset-guide-item{display:flex;align-items:center;gap:11px;min-width:0;padding:12px 13px;border:1px solid #334e6e;border-radius:13px;background:linear-gradient(115deg,rgba(37,63,92,.83),rgba(19,36,58,.85));box-shadow:inset 0 1px rgba(255,255,255,.04);}
.trait-preset-guide-index{display:grid;place-items:center;flex:0 0 32px;height:32px;border:1px solid #4f759e;border-radius:10px;background:#203c59;color:#add0f7;font-size:11px;font-weight:950;}
.trait-preset-guide-item-copy{flex:1 1 auto;min-width:0;}
.trait-preset-guide-item-copy strong{display:block;color:#eff6ff;font-size:12.5px;font-weight:900;}
.trait-preset-guide-item-copy p{margin:4px 0 0;color:#abc2de;font-size:10.5px;line-height:1.55;word-break:keep-all;}
.trait-preset-guide-mini{display:grid;align-content:center;justify-items:stretch;gap:6px;flex:0 0 151px;width:151px;min-width:0;min-height:51px;padding:8px 9px;border:1px solid #365a7f;border-radius:10px;background:linear-gradient(150deg,#102037,#0b182b);box-shadow:inset 0 1px rgba(255,255,255,.05),0 3px 11px rgba(0,0,0,.12);box-sizing:border-box;}
.trait-preset-guide-mini-label{color:#91b2d6;font-size:9px;font-weight:800;}
.trait-preset-guide-mini-values{display:flex;align-items:center;justify-content:space-between;gap:7px;color:#e2f0ff;font-size:11px;font-weight:850;}
.trait-preset-guide-mini-values s{color:#8ea7c2;text-decoration-color:#d38a87;}
.trait-preset-guide-mini-values b{color:#72b7f8;}
.trait-preset-guide-mini-input{display:block;flex:1;max-width:77px;padding:6px 8px;border:1px solid #5286bd;border-radius:6px;background:#dceafd;color:#183453;text-align:center;box-shadow:0 0 0 2px rgba(93,168,247,.12);}
.trait-preset-guide-mini-button.btn{display:grid;place-items:center;height:27px;min-height:27px;width:100%;margin:0;padding:0 4px;border:1px solid #557aab;border-radius:6px;background:linear-gradient(180deg,#25456b,#152e4a);color:#e5f1ff;font-size:9.5px;font-weight:900;line-height:1;box-shadow:inset 0 1px rgba(255,255,255,.1);white-space:nowrap;}
.trait-preset-guide-mini-button.btn.is-backup-needed{border-color:#82bcff;background:linear-gradient(120deg,#dbeafe,#93c5fd);color:#18375a;box-shadow:0 0 10px rgba(96,165,250,.2);}
.trait-preset-guide-mini-status{display:block;text-align:center;font-size:9px;font-weight:900;}
.trait-preset-guide-mini-status.is-pending{color:#ffd99d;}
.trait-preset-guide-mini-status.is-done{color:#81dec7;}
.trait-preset-guide-note{display:flex;gap:9px;align-items:flex-start;margin:12px 0 0;padding:10px 12px;border:1px solid #31546a;border-radius:10px;background:#102d39;color:#b8e5ea;font-size:10.5px;line-height:1.55;word-break:keep-all;}
.trait-preset-guide-note span{color:#78e0d2;font-size:13px;}
.trait-preset-guide-footer{display:flex;align-items:center;justify-content:center;gap:12px;min-height:66px;padding:12px 25px;border-top:1px solid #294460;background:var(--ui-panel-body-bg);}
.trait-preset-guide-footer-actions{display:flex;align-items:center;justify-content:center;gap:12px;flex:1 1 280px;min-width:0;width:auto;}
.trait-preset-guide-secondary{min-height:48px;padding:0 20px;border:1px solid #3e5d80;border-radius:9px;background:#142840;color:#c2d8f1;font-size:11px;font-weight:900;cursor:pointer;}

.trait-preset-guide-confirm{display:flex;align-items:center;gap:12px;justify-content:center;min-height:48px;padding:0 20px;border:1px solid #70b9ff;border-radius:10px;background:linear-gradient(110deg,#3d94f3,#2871c7);color:#fff;font-size:12px;font-weight:950;box-shadow:0 6px 19px rgba(40,113,199,.3);cursor:pointer;transition:filter .15s,transform .15s;}

.trait-preset-guide-dialog button:focus-visible,.trait-preset-guide-dialog input:focus-visible,.trait-preset-guide-dialog select:focus-visible{outline:2px solid #95c9ff;outline-offset:2px;}
body.trait-preset-guide-open{overflow:hidden;}
/* 실습 페이지 */
.trait-preset-guide-practice{padding:17px 22px 22px;}
.trait-preset-guide-practice-header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:2px 1px 17px;}
.trait-preset-guide-practice-header h2{font-size:22px;letter-spacing:-.6px;}
.trait-preset-guide-practice-header p{margin:7px 0 0;color:#a8bfdb;font-size:11px;line-height:1.5;}
.trait-preset-guide-sandbox-label{flex:0 0 auto;padding:7px 9px;border:1px solid #317b76;border-radius:7px;background:#123b3c;color:#a0e5d7;font-size:10px;font-weight:900;white-space:nowrap;}
.trait-preset-guide-progress{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-bottom:14px;}
.trait-preset-guide-progress>span{display:flex;align-items:center;justify-content:center;gap:7px;min-width:0;padding:8px 4px;border:1px solid #2d4261;border-radius:8px;background:#132237;color:#788faa;font-size:10px;font-weight:850;white-space:nowrap;}
.trait-preset-guide-progress b{font-size:9px;color:#869fb8;}
.trait-preset-guide-progress .is-current{border-color:#6aaafa;background:#1f4269;color:#ecf5ff;box-shadow:0 0 0 1px rgba(68,145,239,.12);}
.trait-preset-guide-progress .is-current b{color:#a4d2ff;}
.trait-preset-guide-progress .is-done{border-color:#286b68;background:#15353d;color:#9fe1d2;}
.trait-preset-guide-progress .is-done b{color:#74d9cb;}
.trait-preset-guide-practice-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1fr);gap:14px;align-items:start;}
.trait-preset-guide-workspace{min-width:0;border:1px solid #4a6687;border-radius:12px;background:linear-gradient(160deg,#1b2e46,#0e192a);box-shadow:0 10px 23px rgba(0,0,0,.2);overflow:hidden;}
.trait-preset-guide-workspace-title{display:flex;align-items:center;gap:8px;min-height:41px;padding:8px 13px;border-bottom:1px solid #385474;background:linear-gradient(110deg,#1e3d61,#152b46);}
.trait-preset-guide-workspace-title strong{color:#e7f3ff;font-size:12px;font-weight:950;}
.trait-preset-guide-workspace-title>span:last-child{margin-left:auto;color:#87add4;font-size:9px;font-weight:900;letter-spacing:.9px;}
.trait-preset-guide-workspace-icon{display:grid;place-items:center;width:23px;height:23px;border:1px solid #648fc6;border-radius:7px;color:#86c7ff;}
.trait-preset-guide-workspace-body{display:grid;gap:12px;padding:13px;}
.trait-preset-guide-field{display:grid;grid-template-columns:105px minmax(0,1fr);gap:9px;align-items:center;min-width:0;color:#c7d9ef;font-size:10.5px;font-weight:900;}
.trait-preset-guide-field>span{display:grid;justify-items:start;gap:5px;}
.trait-preset-guide-field small{padding:3px 6px;border:1px solid #3c6c91;border-radius:5px;background:#1b3b55;color:#a5d4f9;font-size:9px;font-weight:850;}
.trait-preset-guide-field small.is-single{border-color:#725b98;background:#30284c;color:#d8b8ff;}
.trait-preset-guide-field input,.trait-preset-guide-field select{display:block;width:100%;min-width:0;height:35px;padding:0 10px;border:1px solid #6187b9;border-radius:7px;background:#dceafd;color:#18314e;font-size:11px;font-weight:900;box-sizing:border-box;}
.trait-preset-guide-field select{background:#152b48;color:#e2f1ff;cursor:pointer;}
.trait-preset-guide-field input:disabled,.trait-preset-guide-field select:disabled{opacity:.57;cursor:not-allowed;}
.trait-preset-guide-data-fields{display:grid;gap:9px;padding-top:3px;}
.trait-preset-guide-demo-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;align-items:stretch;}
.trait-preset-guide-demo-actions .preset-command{--guide-accent:#84c4ff;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:space-between;min-width:0;min-height:121px;height:auto;margin:0;padding:9px 7px;border:1px solid #50769e;border-radius:11px;background:radial-gradient(circle at 16% 0%,rgba(81,150,237,.2),transparent 70%),linear-gradient(145deg,#23405f,#102139);color:#eef7ff;cursor:pointer;box-shadow:inset 0 1px rgba(255,255,255,.12);transition:transform .18s,border-color .18s,box-shadow .18s;white-space:normal;}
.trait-preset-guide-demo-actions .preset-command::before{content:"";position:absolute;left:12px;right:12px;top:0;height:2px;background:linear-gradient(90deg,transparent,var(--guide-accent),transparent);}
.trait-preset-guide-demo-actions .preset-command.is-update{--guide-accent:#80d8da;}
.trait-preset-guide-demo-actions .preset-command.is-import{--guide-accent:#a6beff;}

.trait-preset-guide-demo-actions .preset-command:disabled{cursor:not-allowed;opacity:.63;}
.trait-preset-guide-demo-actions .preset-command-top{display:flex;align-items:center;justify-content:space-between;width:100%;gap:3px;}
.trait-preset-guide-demo-actions .preset-command-icon{display:grid;place-items:center;flex:0 0 27px;width:27px;height:27px;border:1px solid #4778ab;border-radius:8px;background:#254b70;color:var(--guide-accent);}
.trait-preset-guide-demo-actions .preset-command-icon svg{width:16px;height:16px;}
.trait-preset-guide-demo-actions .preset-command-count{font-size:9px;color:#80a5ca;font-weight:900;}
.trait-preset-guide-demo-actions .preset-command-main{display:grid;justify-items:center;align-content:center;gap:5px;min-width:0;width:100%;margin:7px 0;}
.trait-preset-guide-demo-actions .preset-command-main strong{color:#f3f8ff;font-size:10px;font-weight:950;line-height:1.24;word-break:keep-all;}
.trait-preset-guide-demo-actions .preset-command-main small{color:#a6c4e5;font-size:8.4px;line-height:1.3;font-weight:700;word-break:keep-all;}
.trait-preset-guide-demo-actions .preset-command-pill{display:inline-flex;justify-content:center;align-items:center;min-height:20px;max-width:100%;padding:4px 6px;border:1px solid #557699;border-radius:999px;background:#25435f;color:#c8e2ff;font-size:8px;font-weight:950;line-height:1;white-space:nowrap;}
.trait-preset-guide-demo-actions .preset-command[data-state="done"] .preset-command-pill{background:#16433f;border-color:#328a80;color:#b2f4db;}
.trait-preset-guide-demo-actions .preset-command.is-update[data-state="pending"]{--guide-accent:#ffce82;background:linear-gradient(140deg,#423327,#1f2935);border-color:#b38449;box-shadow:0 0 15px rgba(230,164,75,.22);}
.trait-preset-guide-demo-actions .preset-command.is-update[data-state="pending"] .preset-command-pill{background:#543e24;border-color:#bc8b49;color:#ffe5b0;}
.trait-preset-guide-demo-actions .preset-command.is-backup.is-backup-needed{border-color:#a2d2ff;background:linear-gradient(135deg,#315d8c,#173956);box-shadow:0 0 16px rgba(76,156,250,.28);}
.trait-preset-guide-demo-actions .preset-command.is-backup.is-backup-needed .preset-command-pill{background:#c4e2ff;color:#153a65;border-color:#c4e2ff;}
.trait-preset-guide-snapshot{display:grid;gap:8px;padding:11px 13px;border-top:1px solid #304c6b;background:#17324b;}
.trait-preset-guide-snapshot>span{color:#8cacd0;font-size:9.5px;font-weight:900;}
.trait-preset-guide-snapshot-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;}
.trait-preset-guide-snapshot-grid>div{display:flex;align-items:center;gap:6px;min-width:0;padding:7px 8px;border:1px solid #2b4969;border-radius:7px;background:#172c43;}
.trait-preset-guide-snapshot-grid b{display:grid;place-items:center;flex:0 0 19px;height:19px;border-radius:5px;background:#2a5180;color:#cbe6ff;font-size:10px;}
.trait-preset-guide-snapshot-grid span{color:#a9c3e3;font-size:9px;font-weight:850;white-space:nowrap;}
.trait-preset-guide-explain{min-width:0;min-height:315px;padding:19px;border:1px solid #344f73;border-radius:12px;background:radial-gradient(ellipse at 90% -18%,rgba(62,125,207,.23),transparent 65%),linear-gradient(145deg,#172940,#101c2e);box-shadow:inset 0 1px rgba(255,255,255,.035);}
.trait-preset-guide-step-tag{display:inline-flex;align-items:center;min-height:24px;padding:0 9px;border:1px solid #4678ad;border-radius:6px;background:#1d4166;color:#a8d5ff;font-size:10px;font-weight:950;letter-spacing:.7px;}
.trait-preset-guide-step-tag.is-success{border-color:#36948b;background:#16403d;color:#a2e9d9;}
.trait-preset-guide-explain h3{margin:16px 0 11px;color:#eef7ff;font-size:19px;font-weight:950;letter-spacing:-.5px;line-height:1.32;word-break:keep-all;}
.trait-preset-guide-explain p{margin:0;color:#aec5e0;font-size:11.5px;line-height:1.8;word-break:keep-all;}
.trait-preset-guide-explain p strong{color:#e3f1ff;}
.trait-preset-guide-tip{margin-top:23px;padding:12px;border:1px solid #3d719c;border-radius:8px;background:#1a3552;color:#b3dcff;font-size:11px;font-weight:850;line-height:1.6;}
.trait-preset-guide-tip.is-action{border-color:#8f773f;background:#3b3022;color:#ffe1a6;}
.trait-preset-guide-tip.is-success{margin:18px 0;border-color:#317d70;background:#153c3d;color:#a8e5da;}
.trait-preset-guide-edit-checks{display:grid;gap:9px;margin-top:17px;}
.trait-preset-guide-edit-checks span{padding:11px;border:1px solid #395475;border-radius:8px;background:#182e47;color:#a2b7d0;font-size:11px;font-weight:900;}
.trait-preset-guide-edit-checks span.is-done{border-color:#39897d;background:#153e43;color:#a6ecdd;}
.trait-preset-guide-backup-preview{display:grid;gap:10px;margin-top:13px;}
.trait-preset-guide-backup-preview-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:2px;color:#ebf5ff;font-size:11px;}
.trait-preset-guide-backup-preview-heading>span{padding:5px 8px;border:1px solid #45638c;border-radius:20px;background:#1b3554;color:#c5dbf6;font-size:10px;font-weight:850;}
.trait-preset-guide-backup-preview-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;}
.trait-preset-guide-preview-card{display:grid;gap:7px;min-width:0;padding:9px;border:1px solid #3a608c;border-radius:8px;background:#182e46;}
.trait-preset-guide-preview-card>strong{padding-bottom:6px;border-bottom:1px solid #345170;color:#f0f7ff;font-size:10px;}
.trait-preset-guide-preview-card>div{display:grid;gap:3px;min-width:0;}
.trait-preset-guide-preview-card>div span{color:#9bcafa;font-size:9px;font-weight:900;}
.trait-preset-guide-preview-card>div.is-single span{color:#d8bafa;}
.trait-preset-guide-preview-card>div b{color:#dce9f7;font-size:9.5px;font-weight:750;word-break:keep-all;}
.trait-preset-guide-backup-included{color:#95b0d3;font-size:9.5px;}
.trait-preset-guide-backup-filename{display:grid;gap:6px;padding:10px;border:1px solid #446892;border-radius:8px;background:#162e49;color:#cbdff5;font-size:10px;font-weight:900;}
.trait-preset-guide-backup-filename input{width:100%;height:32px;padding:0 9px;border:1px solid #5888be;border-radius:6px;background:#dceafd;color:#18314e;font-size:11px;font-weight:850;box-sizing:border-box;}
.trait-preset-guide-download.btn{min-height:37px;margin:0;border:1px solid #8ec4ff;border-radius:7px;background:linear-gradient(110deg,#2568d6,#3a8cf5);color:#fff;font-size:11px;font-weight:950;cursor:pointer;}
.trait-preset-guide-backup-disclaimer{color:#819cba;text-align:center;font-size:9px;font-weight:750;}
.trait-preset-guide-success-icon{display:grid;place-items:center;width:56px;height:56px;margin-top:19px;border:1px solid #56b5a4;border-radius:50%;background:#174743;color:#8bedd5;font-size:29px;box-shadow:0 0 0 7px rgba(65,186,158,.075);}
.trait-preset-guide-retry{margin-top:4px;padding:10px 13px;border:1px solid #579ad6;border-radius:8px;background:#1c4770;color:#c9e4ff;font-size:11px;font-weight:900;cursor:pointer;}
@keyframes traitGuideEnter{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:720px){
  .trait-preset-guide-dialog.is-practice{width:min(680px,100%);}
  .trait-preset-guide-practice-grid{grid-template-columns:minmax(0,1fr);}
  .trait-preset-guide-explain{order:-1;min-height:0;padding:13px 15px;}
  .trait-preset-guide-explain h3{margin:9px 0 6px;font-size:16px;}
  .trait-preset-guide-explain p{font-size:10.5px;line-height:1.55;}
  .trait-preset-guide-tip{margin-top:10px;padding:9px 10px;}
  .trait-preset-guide-edit-checks{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px;}
  .trait-preset-guide-edit-checks span{padding:8px;font-size:10px;}
  .trait-preset-guide-practice-header{align-items:flex-start;}
  .trait-preset-guide-sandbox-label{white-space:normal;max-width:128px;line-height:1.3;text-align:center;}
}
@media(max-width:600px){
  body .trait-preset-guide-trigger{width:auto;min-width:80px;min-height:44px;padding:0 5px;font-size:calc(11.8px * var(--app-font-scale));}
  body .trait-preset-guide-trigger svg{width:15px;height:15px;}
  .trait-preset-guide-shell{padding:9px;}
  .trait-preset-guide-dialog{max-height:calc(100dvh - 18px);border-radius:15px;border-color:var(--ui-panel-border);}
  .trait-preset-guide-top{padding:8px 13px;height:auto;min-height:var(--ui-integrated-head-height);max-height:none;background:var(--ui-integrated-head-bg);border-bottom:1px solid var(--ui-integrated-head-line);color:var(--ui-integrated-head-text);}
  .trait-preset-guide-overline{font-size:9px;letter-spacing:.65px;gap:6px;}
  .trait-preset-guide-top-tag{display:none;}
  .trait-preset-guide-page-label{font-size:9px;}
  .trait-preset-guide-page{padding:13px 14px 17px;}
  .trait-preset-guide-hero{gap:12px;margin:3px 0 11px;}
  .trait-preset-guide-hero-mark{flex-basis:52px;width:52px;height:52px;border-radius:15px;}
  .trait-preset-guide-hero-mark svg{width:37px;height:37px;}
  .trait-preset-guide-content h2{font-size:clamp(20px,5.2vw,25px);}
  .trait-preset-guide-item{gap:8px;padding:9px;}
  .trait-preset-guide-index{flex-basis:26px;height:26px;font-size:10px;}
  .trait-preset-guide-item-copy strong{font-size:11px;}
  .trait-preset-guide-item-copy p{font-size:10px;}
  .trait-preset-guide-mini{flex-basis:125px;width:125px;padding:7px;}
  .trait-preset-guide-mini-button.btn{font-size:9px;}
  .trait-preset-guide-footer{flex-wrap:wrap;min-height:57px;padding:10px 13px;gap:8px;}
  .trait-preset-guide-confirm{gap:7px;padding:0 11px;font-size:10.5px;}
  .trait-preset-guide-secondary{padding:0 9px;font-size:10px;}
  .trait-preset-guide-practice-header{margin-bottom:12px;}
  .trait-preset-guide-practice-header h2{font-size:21px;}
}
@media(max-width:390px){
  .trait-preset-guide-mini{flex-basis:101px;width:101px;}
  .trait-preset-guide-mini-values{gap:3px;}
  .trait-preset-guide-mini-button.btn{font-size:8px;white-space:normal;text-align:center;}
  .trait-preset-guide-mini-status{font-size:8.5px;}
  .trait-preset-guide-item-copy p{font-size:9.5px;}
  .trait-preset-guide-progress>span{gap:3px;font-size:9px;}
  .trait-preset-guide-field{grid-template-columns:96px minmax(0,1fr);gap:7px;}
  .trait-preset-guide-sandbox-label{display:none;}
}

/* PREMIUM GUIDE · independent styles (no cross-module selectors) */
.trait-preset-guide-shell{isolation:isolate}
.trait-preset-guide-dialog{box-shadow:0 40px 110px rgba(0,0,0,.8),0 0 0 1px rgba(100,167,240,.16);border-color:var(--ui-panel-border);}
.trait-preset-guide-top{height:auto;min-height:var(--ui-integrated-head-height);max-height:none;background:var(--ui-integrated-head-bg);border-bottom:1px solid var(--ui-integrated-head-line);color:var(--ui-integrated-head-text);}
.trait-preset-guide-intro{background:radial-gradient(ellipse at 95% -18%,rgba(49,115,191,.13),transparent 68%)}
/* 제작자 환영 화면 · 기존 이용 가이드 앞 단계 */
.trait-preset-guide-welcome{background:radial-gradient(ellipse at 12% 0%,rgba(57,144,226,.17),transparent 55%),radial-gradient(ellipse at 100% 65%,rgba(37,119,149,.10),transparent 55%),var(--ui-panel-body-bg);}
.guide-welcome-hero{position:relative;overflow:hidden;display:flex;align-items:center;gap:17px;padding:19px;border:1px solid #466e92;border-radius:15px;background:linear-gradient(130deg,#204c70 0%,#162f4b 54%,#102339 100%);box-shadow:0 9px 25px rgba(3,15,30,.22),inset 0 1px rgba(255,255,255,.08);}
.guide-welcome-hero::after{content:"";position:absolute;right:-38px;top:-63px;width:180px;height:180px;border:1px solid rgba(166,211,255,.12);border-radius:50%;box-shadow:0 0 0 21px rgba(137,194,244,.035),0 0 0 47px rgba(137,194,244,.025);pointer-events:none;}
.guide-welcome-emblem{position:relative;z-index:1;display:grid;place-items:center;flex:0 0 69px;width:69px;height:69px;border:1px solid #78b6e4;border-radius:17px;background:linear-gradient(145deg,#3478a4,#142e51);box-shadow:inset 0 1px rgba(255,255,255,.20),0 7px 24px rgba(9,21,38,.30);}
.guide-welcome-emblem svg{width:48px;height:48px;filter:drop-shadow(0 2px 8px rgba(116,195,254,.25));}
.guide-welcome-heading{z-index:1;min-width:0;position:relative;}
.guide-welcome-eyebrow{color:#9fd3f4;font-size:10px;font-weight:900;letter-spacing:1.35px;}
.trait-preset-guide-content .guide-welcome-heading h2{font-size:clamp(19px,3.8vw,26px);line-height:1.3;margin:7px 0 0;letter-spacing:-.6px;word-break:keep-all;}
.guide-welcome-heading h2 span{color:#98d6ff;}
.guide-welcome-message{padding:15px 6px 9px;}
.guide-welcome-message strong{display:block;margin-bottom:10px;color:#f0f7ff;font-size:13px;line-height:1.55;word-break:keep-all;}
.guide-welcome-message p{margin:0;color:#c3d6e9;font-size:12px;line-height:1.86;word-break:keep-all;}
.guide-welcome-signature{margin-top:12px;color:#92cff4;font-size:11px;font-weight:900;text-align:right;letter-spacing:.2px;}
.guide-welcome-contact-heading{display:flex;align-items:center;gap:10px;margin:5px 0 10px;color:#ecf5ff;font-weight:900;font-size:12px;}
.guide-welcome-contact-heading::after{content:"";height:1px;flex:1;background:linear-gradient(90deg,#436787,transparent);}
.guide-welcome-contacts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
.guide-welcome-contact{display:flex;flex-direction:column;align-items:center;gap:7px;min-width:0;min-height:146px;box-sizing:border-box;padding:13px 11px;border:1px solid #3c6487;border-radius:12px;background:linear-gradient(155deg,#1d405d,#142a42);text-align:center;box-shadow:inset 0 1px rgba(255,255,255,.065);}
.guide-welcome-contact-icon{display:grid;place-items:center;width:31px;height:31px;border-radius:10px;background:rgba(100,177,242,.12);color:#9fd8ff;}
.guide-welcome-contact-icon svg{width:18px;height:18px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round;}
.guide-welcome-contact strong{color:#f4f9ff;font-size:12px;line-height:1.2;}
.guide-welcome-contact small{color:#bfd5e8;font-size:10px;line-height:1.3;min-height:13px;}
.guide-welcome-contact button,.guide-welcome-contact a{display:flex;align-items:center;justify-content:center;gap:5px;width:100%;min-height:32px;box-sizing:border-box;margin-top:auto;padding:5px 6px;border:1px solid #5d9ccd;border-radius:8px;background:#244f75;color:#ecf8ff;font-size:10.5px;font-weight:900;line-height:1.3;text-decoration:none;cursor:pointer;}
.guide-welcome-contact a{border-color:#707ad1;background:linear-gradient(120deg,#475ca7,#3c4c91);}
.guide-welcome-contact button:hover,.guide-welcome-contact a:hover{filter:brightness(1.12);}
.guide-welcome-copy-status{min-height:14px;margin:8px 0 0;color:#9addcd;font-size:10px;font-weight:800;text-align:center;}
.trait-preset-guide-welcome .guide-welcome-copy-status:empty{visibility:hidden;}
@media(max-width:600px){
  .guide-welcome-hero{gap:12px;padding:13px;}
  .guide-welcome-emblem{flex-basis:50px;width:50px;height:50px;border-radius:13px;}
  .guide-welcome-emblem svg{width:37px;height:37px;}
  .guide-welcome-eyebrow{font-size:9px;letter-spacing:.8px;}
  .trait-preset-guide-content .guide-welcome-heading h2{font-size:clamp(17px,4.8vw,22px);}
  .guide-welcome-message{padding:12px 2px 8px;}
  .guide-welcome-message strong{font-size:12px;margin-bottom:7px;}
  .guide-welcome-message p{font-size:11px;line-height:1.7;}
  .guide-welcome-contact{min-height:135px;padding:10px 7px;gap:6px;}
  .guide-welcome-contact strong{font-size:11px;}
  .guide-welcome-contact small{font-size:9.5px;}
  .guide-welcome-contact button,.guide-welcome-contact a{font-size:10px;}
}
@media(prefers-reduced-motion:reduce){.trait-preset-guide-page{animation:none;}}
.guide-intro-section-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:15px;color:#9dc9fd;font-size:10px;font-weight:950;letter-spacing:1.1px;}
.guide-intro-section-head small{color:#7097c1;letter-spacing:.2px;font-size:9px}
.trait-preset-guide-timeline{position:relative;margin-top:9px;gap:11px}
.trait-preset-guide-timeline:before{content:"";position:absolute;left:28px;top:24px;bottom:24px;width:2px;background:linear-gradient(#5aabef,#777fed,#4ed9bd);opacity:.55}
.trait-preset-guide-item{position:relative;transition:border-color .2s ease,transform .2s ease,box-shadow .2s ease}
.trait-preset-guide-item:hover{border-color:#668fbc;transform:translateY(-1px);box-shadow:0 7px 23px rgba(0,0,0,.2)}
.trait-preset-guide-index{position:relative;z-index:1;box-shadow:0 0 0 4px #172940}
.trait-preset-guide-mini{position:relative;overflow:hidden}
.trait-preset-guide-mini:before{content:"";position:absolute;inset:0 0 auto;height:2px;background:linear-gradient(90deg,transparent,#75b7f8,transparent);opacity:.65}
.guide-invite{display:flex;align-items:center;gap:12px;margin-top:14px;padding:12px 14px;border:1px solid #335f87;border-radius:11px;background:linear-gradient(112deg,#143c57,#14283e);}
.guide-invite-glyph{font-size:24px;color:#71ddd3;filter:drop-shadow(0 0 9px rgba(113,221,211,.45))}
.guide-invite strong{display:block;color:#e0f5ff;font-size:11.5px}
.guide-invite p{margin:4px 0 0;color:#a4c2dc;font-size:10px;line-height:1.55}
.guide-invite-arrow{margin-left:auto;color:#83c6ff;font-size:25px;font-weight:900}
.trait-preset-guide-practice-grid{position:relative;isolation:isolate}
.trait-preset-guide-workspace,.trait-preset-guide-explain{position:relative;z-index:1}
.trait-preset-guide-explain{border-color:#517cae;background:radial-gradient(ellipse at 90% -18%,rgba(69,138,228,.25),transparent 70%),linear-gradient(155deg,#192e48,#0c1a2d);box-shadow:0 13px 34px rgba(0,0,0,.21),inset 0 1px rgba(255,255,255,.04)}
.guide-navigation{display:flex;gap:10px;align-items:center;padding:9px 10px;border:1px solid #34618d;border-radius:10px;background:linear-gradient(110deg,#153c5d,#132e4a);margin-bottom:12px;}
.guide-navigation-pulse{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:10px;background:#276fba;border:1px solid #7cc5ff;color:#fff;font-size:19px;box-shadow:0 0 0 4px rgba(68,152,241,.1),0 0 18px rgba(72,155,250,.25);animation:guidePulse 1.8s ease-in-out infinite}
.guide-navigation>div{display:grid;gap:4px;min-width:0;flex:1}
.guide-navigation b{color:#def0ff;font-size:11px;white-space:normal}
.guide-navigation small{color:#a8c8e8;font-size:9px;line-height:1.4}
.guide-navigation-index{color:#83b8eb;font-size:10px;font-weight:900;white-space:nowrap}
.guide-connector{position:absolute;left:0;top:0;pointer-events:none;z-index:3;overflow:visible;transition:opacity .18s ease;filter:drop-shadow(0 1px 5px rgba(75,161,255,.6))}
.guide-connector-path{fill:none;stroke:url(#traitGuideGradient);stroke-width:3;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:6 7;animation:guideMarch 1.6s linear infinite}
.guide-connector-glow{fill:none;stroke:rgba(88,180,255,.15);stroke-width:13;stroke-linecap:round}
#traitGuideConnectorDot{fill:#b9ebff;stroke:#368cdb;stroke-width:3}
.trait-preset-guide-shell .guide-is-target{position:relative;z-index:4;outline:2px solid #92d4ff;outline-offset:3px;box-shadow:0 0 0 6px rgba(60,146,247,.19),0 0 20px rgba(72,168,255,.37);animation:guideTarget 2.1s ease-in-out infinite}
.trait-preset-guide-shell .guide-is-alternate{position:relative;z-index:4;outline:2px dashed #7cc0ff;outline-offset:2px}
.trait-preset-guide-shell .trait-preset-guide-field:has(.guide-is-target){color:#fff}
.trait-preset-guide-progress>span.is-current{box-shadow:0 0 0 1px rgba(92,167,252,.25),inset 0 1px rgba(255,255,255,.06)}
.guide-dismiss{border-color:#496481;background:#20354e;color:#eef6ff;min-width:155px;justify-content:center;text-align:center;font-size:12px;}
.trait-preset-guide-confirm{min-width:155px;}
.trait-preset-guide-shell .trait-preset-guide-secondary[hidden]{display:none}
.trait-preset-guide-footer-actions{flex-wrap:wrap;justify-content:center}
@keyframes guidePulse{0%,100%{box-shadow:0 0 0 4px rgba(68,152,241,.10),0 0 13px rgba(72,155,250,.23)}50%{box-shadow:0 0 0 7px rgba(68,152,241,.18),0 0 24px rgba(72,155,250,.46)}}
@keyframes guideMarch{to{stroke-dashoffset:-26}}
@keyframes guideTarget{0%,100%{filter:brightness(1)}50%{filter:brightness(1.08)}}
@media(max-width:720px){
  .guide-connector{opacity:.8}
  .trait-preset-guide-explain{order:-1}
  .guide-navigation{margin-bottom:9px}
  .trait-preset-guide-explain h3{margin-top:8px}
}
@media(max-width:600px){
  .trait-preset-guide-timeline:before{left:22px}
  .guide-invite{padding:9px 10px;gap:8px}
  .guide-invite-glyph{font-size:20px}
  .guide-invite strong{font-size:10px}
  .guide-invite p{font-size:9px}
  .guide-navigation{padding:7px 9px}
  .guide-navigation-pulse{width:28px;height:28px;font-size:16px}
  .guide-dismiss,.trait-preset-guide-confirm{min-height:45px;min-width:0;flex:1 1 0;padding:0 10px;}
  .trait-preset-guide-footer-actions{gap:6px}
  .trait-preset-guide-demo-actions{gap:5px;}
  .trait-preset-guide-demo-actions .preset-command{min-height:122px;padding:8px 4px;border-radius:9px;}
  .trait-preset-guide-demo-actions .preset-command-icon{flex-basis:23px;width:23px;height:23px;}
  .trait-preset-guide-demo-actions .preset-command-icon svg{width:14px;height:14px;}
  .trait-preset-guide-demo-actions .preset-command-main strong{font-size:9px;}
  .trait-preset-guide-demo-actions .preset-command-main small{font-size:7.5px;}
  .trait-preset-guide-demo-actions .preset-command-pill{font-size:7.5px;padding:4px 5px;}
}
@media(prefers-reduced-motion:reduce){.guide-navigation-pulse,.trait-preset-guide-shell .guide-is-target,.guide-connector-path{animation:none}}
`;
/* 이용 안내 · 실제 프리셋 규칙을 재현한 독립형 연습 가이드 */
let traitPresetGuideReturnFocus=null;
let traitPresetGuideDemo=null;
const $=id=>document.getElementById(id);
const TRAIT_PRESET_GUIDE_STORAGE_KEY='gbd_dps_calculator:trait_preset_guide';
const TRAIT_PRESET_GUIDE_COOLDOWN_MS=7*24*60*60*1000;
function traitPresetGuideConfirmedAt(){
  try{
    const saved=JSON.parse(localStorage.getItem(TRAIT_PRESET_GUIDE_STORAGE_KEY)||'null');
    return Number.isFinite(saved?.confirmedAt) ? saved.confirmedAt : 0;
  }catch(error){ return 0; }
}
function saveTraitPresetGuideConfirmedAt(){
  try{ localStorage.setItem(TRAIT_PRESET_GUIDE_STORAGE_KEY,JSON.stringify({confirmedAt:Date.now()})); }
  catch(error){ /* Storage can be unavailable in private/restricted contexts. */ }
}
function maybeShowTraitPresetGuide(){
  const confirmedAt=traitPresetGuideConfirmedAt();
  const elapsed=Date.now()-confirmedAt;
  if(confirmedAt>0 && elapsed>=0 && elapsed<TRAIT_PRESET_GUIDE_COOLDOWN_MS) return;
  if(document.querySelector('.trait-preset-modal-shell.is-open,.board-modal-shell.is-open,.trait-preset-unit-jewel-modal-shell.is-open,.dps-table-modal-shell.is-open')) return;
  openTraitPresetGuideModal();
}
function createTraitPresetGuideModal(){
  return window.DpsModal.createShell('traitPresetGuideModal','trait-preset-guide-shell',`
    <div class="trait-preset-guide-backdrop" data-trait-preset-guide-close></div>
    <section class="trait-preset-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="traitPresetGuideTitle" aria-describedby="traitPresetGuideDescription" tabindex="-1">
      <header class="trait-preset-guide-top">
        <span class="trait-preset-guide-overline"><span class="trait-preset-guide-overline-dot"></span> DPS / BUILD STUDIO <span class="trait-preset-guide-top-tag">OFFICIAL GUIDE</span></span>
        <span class="trait-preset-guide-page-label" id="traitPresetGuidePageLabel">01 <i>/</i> 03 · 제작자 인사</span>
        <button type="button" class="trait-preset-guide-close" data-trait-preset-guide-close aria-label="안내 닫기">×</button>
      </header>
      <div class="trait-preset-guide-content">
        <section class="trait-preset-guide-page trait-preset-guide-welcome" data-trait-preset-guide-page="welcome">
          <div class="guide-welcome-hero">
            <span class="guide-welcome-emblem" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><use href="#dpsHeaderBrandGlyph"/></svg></span>
            <div class="guide-welcome-heading">
              <span class="guide-welcome-eyebrow">A MESSAGE FROM THE CREATOR</span>
              <h2 id="traitPresetGuideWelcomeTitle">개복디 특성 계산기에<br/><span>오신 것을 환영합니다!</span></h2>
            </div>
          </div>
          <div class="guide-welcome-message" id="traitPresetGuideWelcomeDescription">
            <strong>안녕하세요. 제작자 회장입니다.</strong>
            <p>특성 투자와 DPS 분석을 더욱 편리하게 이용하실 수 있도록 이 계산기를 만들었습니다.<br/>사용하시면서 느끼신 점과 건의 사항을 바탕으로 계속 다듬어 나가겠습니다.<br/>이용해 주셔서 감사합니다.</p>
            <div class="guide-welcome-signature">— 제작자 회장 드림</div>
          </div>
          <div class="guide-welcome-contact-heading">연락 및 피드백</div>
          <div class="guide-welcome-contacts">
            <div class="guide-welcome-contact">
              <span class="guide-welcome-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 8h12a3 3 0 0 1 3 3l1 6a2 2 0 0 1-3 2l-3-2H8l-3 2a2 2 0 0 1-3-2l1-6a3 3 0 0 1 3-3zM7 12v5m-2.5-2.5h5M16 13h.01M19 16h.01"/></svg></span>
              <strong>블리자드 배틀태그</strong><small>회장#31977</small>
              <button type="button" data-trait-preset-guide-copy-tag>배틀태그 복사</button>
            </div>
            <div class="guide-welcome-contact">
              <span class="guide-welcome-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 5.8a18 18 0 0 1 14 0L22 18a15 15 0 0 1-5 2l-1-2a16 16 0 0 0 3-1.4 19 19 0 0 1-14 0A16 16 0 0 0 8 18l-1 2a15 15 0 0 1-5-2L5 5.8zM8.3 12.7h.01m7.4 0h.01"/></svg></span>
              <strong>디스코드</strong><small>피드백 및 건의</small>
              <a href="https://discord.gg/z7DwqvGeB5" target="_blank" rel="noopener noreferrer">참여하기 ↗</a>
            </div>
          </div>
          <div class="guide-welcome-copy-status" id="traitPresetGuideCopyStatus" role="status" aria-live="polite"></div>
        </section>
        <section class="trait-preset-guide-page trait-preset-guide-intro" data-trait-preset-guide-page="intro" hidden>
          <div class="trait-preset-guide-hero">
            <span class="trait-preset-guide-hero-mark" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><use href="#dpsHeaderBrandGlyph"/></svg></span>
            <div class="trait-preset-guide-hero-copy"><span class="trait-preset-guide-kicker">변경사항을 안전하게 관리하세요</span>
              <h2 id="traitPresetGuideTitle">프리셋을 바꿨다면,<br/><em>업데이트와 백업</em>까지</h2>
            </div>
          </div>
          <p id="traitPresetGuideDescription">화면에서 값을 바꾸는 것과 프리셋 파일에 보관하는 것은 서로 다른 단계예요.</p>
          <div class="guide-intro-section-head"><span>HOW IT WORKS</span><small>3 STEPS · 사용 흐름</small></div>
          <div class="trait-preset-guide-timeline">
            <article class="trait-preset-guide-item"><span class="trait-preset-guide-index">01</span><div class="trait-preset-guide-item-copy"><strong>값 수정</strong><p>현재 화면의 항목을 원하는 값으로 변경합니다.</p></div><div class="trait-preset-guide-mini is-edit" aria-hidden="true"><span class="trait-preset-guide-mini-label">시작 SP</span><span class="trait-preset-guide-mini-values"><s>300</s><b>→</b><span class="trait-preset-guide-mini-input">350</span></span></div></article>
            <article class="trait-preset-guide-item"><span class="trait-preset-guide-index">02</span><div class="trait-preset-guide-item-copy"><strong>프리셋 업데이트</strong><p>수정값을 선택한 프리셋에 반영합니다. 공통 항목은 다른 프리셋에도 적용됩니다.</p></div><div class="trait-preset-guide-mini" aria-hidden="true"><span class="trait-preset-guide-mini-button btn subtle ui-action-btn">프리셋 업데이트</span><span class="trait-preset-guide-mini-status is-pending">● 변경 감지</span></div></article>
            <article class="trait-preset-guide-item"><span class="trait-preset-guide-index">03</span><div class="trait-preset-guide-item-copy"><strong>통합 프리셋 백업</strong><p>최신 내용을 새 백업 파일로 다운로드해 보관합니다.</p></div><div class="trait-preset-guide-mini" aria-hidden="true"><span class="trait-preset-guide-mini-button btn subtle ui-action-btn is-backup-needed">프리셋 백업 필요</span><span class="trait-preset-guide-mini-status is-done">✓ 백업 최신</span></div></article>
          </div>
          <p class="trait-preset-guide-note"><span aria-hidden="true">✦</span> 백업 버튼은 아직 업데이트하지 않은 변경사항도 먼저 반영한 뒤 파일을 생성합니다.</p>
          <div class="guide-invite" aria-label="선택형 실습 안내">
            <span class="guide-invite-glyph" aria-hidden="true">✦</span>
            <div><strong>설명을 확인했다면 직접 연습해 보세요.</strong><p>실제 데이터는 변경되지 않아요. 준비되었을 때 버튼을 눌러 시작합니다.</p></div>
            <span class="guide-invite-arrow" aria-hidden="true">↗</span>
          </div>
        </section>
        <section class="trait-preset-guide-page trait-preset-guide-practice" data-trait-preset-guide-page="practice" hidden>
          <div class="trait-preset-guide-practice-header">
            <div><span class="trait-preset-guide-kicker">INTERACTIVE · SAFE PRACTICE</span><h2 id="traitPresetGuidePracticeTitle">직접 눌러보는 프리셋 관리</h2><p id="traitPresetGuidePracticeDescription">실제 앱의 공통·개별 설정과 업데이트·백업 흐름을 연습해 보세요.</p></div>
            <span class="trait-preset-guide-sandbox-label">연습 전용 · 실제 데이터 변경 없음</span>
          </div>
          <div class="trait-preset-guide-progress" aria-label="체험 진행 단계">
            <span data-trait-preset-guide-progress="0"><b>01</b> 선택</span><span data-trait-preset-guide-progress="1"><b>02</b> 값 수정</span><span data-trait-preset-guide-progress="2"><b>03</b> 업데이트</span><span data-trait-preset-guide-progress="3"><b>04</b> 백업</span>
          </div>
          <div class="trait-preset-guide-practice-grid">
            <div class="trait-preset-guide-workspace">
              <div class="trait-preset-guide-workspace-title"><span class="trait-preset-guide-workspace-icon">✦</span><strong>특성 프리셋</strong><span>SIMULATOR</span></div>
              <div class="trait-preset-guide-workspace-body">
                <label class="trait-preset-guide-field"><span>프리셋 목록</span><select id="traitPresetGuideDemoSelect" data-trait-preset-guide-select><option value="">연습할 프리셋 선택</option><option value="a">연습 프리셋 A</option><option value="b">연습 프리셋 B</option></select></label>
                <div class="trait-preset-guide-data-fields">
                  <label class="trait-preset-guide-field"><span>시작 SP <small>공통 설정</small></span><input id="traitPresetGuideDemoSp" data-trait-preset-guide-input="sp" type="number" inputmode="numeric" min="0" max="999999" step="50" disabled value="300"/></label>
                  <label class="trait-preset-guide-field"><span>특성 투자 제한 AD <small class="is-single">개별 설정</small></span><input id="traitPresetGuideDemoLimit" data-trait-preset-guide-input="limit" type="number" inputmode="numeric" min="0" max="999999" step="10" disabled value="100"/></label>
                </div>
                <div class="trait-preset-guide-demo-actions" aria-label="연습용 프리셋 관리 버튼">
                  <button class="btn subtle ui-action-btn preset-command is-import" data-trait-preset-guide-import data-state="idle" type="button"><span class="preset-command-top"><span class="preset-command-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m-4 4 4-4 4 4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg></span><span class="preset-command-count" aria-hidden="true">01</span></span><span class="preset-command-main"><strong>프리셋 가져오기</strong><small id="traitPresetGuideImportHint">연습 프리셋 A를 불러옵니다.</small></span><span class="preset-command-pill" id="traitPresetGuideImportBadge">샘플 불러오기</span></button>
                  <button class="btn subtle ui-action-btn preset-command is-update" data-trait-preset-guide-update data-state="idle" type="button" disabled><span class="preset-command-top"><span class="preset-command-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 0 0-14-5L4 8m0-5v5h5M4 13a8 8 0 0 0 14 5l2-2m0 5v-5h-5"/></svg></span><span class="preset-command-count" aria-hidden="true">02</span></span><span class="preset-command-main"><strong>프리셋 업데이트</strong><small id="traitPresetGuideUpdateHint">프리셋을 선택하세요.</small></span><span class="preset-command-pill" id="traitPresetGuideUpdateBadge">대기</span></button>
                  <button class="btn subtle ui-action-btn preset-command is-backup" data-trait-preset-guide-backup data-state="idle" type="button" disabled><span class="preset-command-top"><span class="preset-command-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12m-4-4 4 4 4-4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg></span><span class="preset-command-count" aria-hidden="true">03</span></span><span class="preset-command-main"><strong>통합 프리셋 백업</strong><small id="traitPresetGuideBackupHint">백업할 프리셋이 없습니다.</small></span><span class="preset-command-pill" id="traitPresetGuideBackupBadge">대기</span></button>
                </div>
              </div>
              <div class="trait-preset-guide-snapshot"><span>연습 프리셋 비교</span><div class="trait-preset-guide-snapshot-grid"><div><b>A</b><span id="traitPresetGuideSavedA">SP 300 / AD 100</span></div><div><b>B</b><span id="traitPresetGuideSavedB">SP 300 / AD 80</span></div></div></div>
            </div>
            <div class="trait-preset-guide-explain" aria-live="polite">
              <div class="guide-navigation"><span class="guide-navigation-pulse" id="traitGuideAnchor" aria-hidden="true">➜</span><div><b id="traitGuideRouteTitle">01 / 프리셋 선택</b><small id="traitGuideRouteHint">빛나는 입력칸을 따라 진행하세요</small></div><span class="guide-navigation-index" id="traitGuideStepNumber">1 / 5</span></div>
              <div class="trait-preset-guide-explain-step" data-trait-preset-guide-step="0"><span class="trait-preset-guide-step-tag">STEP 01 · SELECT</span><h3>연습 프리셋을 선택하세요</h3><p>왼쪽 <strong>프리셋 목록</strong>에서 A 또는 B를 선택합니다. 실제 앱처럼 선택한 프리셋의 저장값이 입력창에 나타납니다.</p><div class="trait-preset-guide-tip">↖ 목록을 펼쳐 프리셋을 선택해 보세요.</div></div>
              <div class="trait-preset-guide-explain-step" data-trait-preset-guide-step="1" hidden><span class="trait-preset-guide-step-tag">STEP 02 · EDIT</span><h3>두 가지 값을 모두 바꿔보세요</h3><p><strong>시작 SP</strong>는 모든 프리셋과 동기화되는 공통값, <strong>특성 투자 제한 AD</strong>는 선택한 프리셋만 바뀌는 개별값입니다.</p><div class="trait-preset-guide-edit-checks"><span id="traitPresetGuideSpCheck">○ 공통 시작 SP 수정</span><span id="traitPresetGuideLimitCheck">○ 개별 특성 제한 수정</span></div></div>
              <div class="trait-preset-guide-explain-step" data-trait-preset-guide-step="2" hidden><span class="trait-preset-guide-step-tag">STEP 03 · UPDATE</span><h3>변경 감지! 이제 반영할 차례</h3><p><strong>프리셋 업데이트</strong>를 눌러 변경값을 저장해 보세요. 또는 <strong>프리셋 백업</strong>을 먼저 눌러 자동 반영 과정도 체험할 수 있습니다.</p><div class="trait-preset-guide-tip is-action">← 실제 버튼과 같은 위치에서 클릭하세요.</div></div>
              <div class="trait-preset-guide-explain-step" data-trait-preset-guide-step="3" hidden><span class="trait-preset-guide-step-tag">STEP 04 · BACKUP</span><h3 id="traitPresetGuideBackupTitle">통합 백업 미리보기</h3><p id="traitPresetGuideBackupDescription">변경 내역과 백업 파일명을 확인하세요.</p><div class="trait-preset-guide-backup-preview"><div class="trait-preset-guide-backup-preview-heading"><strong>업데이트된 프리셋</strong><span id="traitPresetGuideBackupCount">2 / 전체 2</span></div><div class="trait-preset-guide-backup-preview-cards" id="traitPresetGuideBackupCards"></div><p class="trait-preset-guide-backup-included">변경되지 않은 프리셋도 통합 백업에 포함됩니다.</p><label class="trait-preset-guide-backup-filename">백업 파일명<input type="text" id="traitPresetGuideBackupFilename" autocomplete="off" maxlength="60" value="통합프리셋_연습"/></label><button type="button" class="btn pri ui-action-btn trait-preset-guide-download" data-trait-preset-guide-finish>백업하기 · 체험 완료</button><span class="trait-preset-guide-backup-disclaimer">연습용 화면입니다. 실제 파일은 생성하지 않습니다.</span></div></div>
              <div class="trait-preset-guide-explain-step" data-trait-preset-guide-step="4" hidden><span class="trait-preset-guide-step-tag is-success">✓ PRACTICE COMPLETE</span><div class="trait-preset-guide-success-icon">✓</div><h3>업데이트와 백업을 마쳤어요!</h3><p id="traitPresetGuideSuccessSummary">선택한 프리셋의 변경값을 반영했습니다.</p><div class="trait-preset-guide-tip is-success">실제 앱에서는 백업 후 다운로드된 .txt 파일을 안전하게 보관하세요.</div><button type="button" class="trait-preset-guide-retry" data-trait-preset-guide-restart>↻ 다시 체험하기</button></div>
            </div>
            <svg class="guide-connector" id="traitGuideConnector" aria-hidden="true" focusable="false"><defs><linearGradient id="traitGuideGradient"><stop offset="0" stop-color="#6fd3ee"/><stop offset="1" stop-color="#66aaff"/></linearGradient></defs><path id="traitGuideConnectorGlow" class="guide-connector-glow"/><path id="traitGuideConnectorPath" class="guide-connector-path"/><circle id="traitGuideConnectorDot" r="5"/></svg>
          </div>
        </section>
      </div>
      <footer class="trait-preset-guide-footer">
        <div class="trait-preset-guide-footer-actions"><button type="button" class="trait-preset-guide-secondary" data-trait-preset-guide-back hidden>← 처음으로</button><button type="button" class="trait-preset-guide-secondary guide-dismiss" data-trait-preset-guide-dismiss>이제 확인했어요</button><button type="button" class="trait-preset-guide-confirm" data-trait-preset-guide-next>체험 하러가기 <span aria-hidden="true">→</span></button></div>
      </footer>
    </section>`);
}
function newTraitPresetGuideDemo(){
  return {stage:0,selected:'',presets:{a:{sp:300,limit:100},b:{sp:300,limit:80}},current:null,updated:false,automatic:false,complete:false};
}
function traitPresetGuideDirty(){
  const demo=traitPresetGuideDemo;
  if(!demo?.selected || !demo.current) return {sp:false,limit:false};
  const saved=demo.presets[demo.selected];
  return {sp:demo.current.sp!==saved.sp,limit:demo.current.limit!==saved.limit};
}
function setTraitPresetGuideDemoProgress(prefix,state,badge,hint){
  const type=prefix.toLowerCase();
  const btn=document.querySelector(`[data-trait-preset-guide-${type}]`);
  if(!btn) return;
  btn.dataset.state=state;
  const badgeEl=btn.querySelector('.preset-command-pill');
  if(badgeEl && badgeEl.textContent!==badge) badgeEl.textContent=badge;
  const hintEl=btn.querySelector('.preset-command-main small');
  if(hintEl && hintEl.textContent!==hint) hintEl.textContent=hint;
}
function traitPresetGuideBackupCards(){
  const demo=traitPresetGuideDemo;
  const dirty=traitPresetGuideDirty();
  const common=demo.automatic ? dirty.sp : demo.savedCommon;
  const single=demo.automatic ? dirty.limit : demo.savedSingle;
  const changedCount=common ? 2 : 1;
  $('traitPresetGuideBackupCount').textContent=`${changedCount} / 전체 2`;
  $('traitPresetGuideBackupTitle').textContent=demo.automatic ? '백업 시 자동 업데이트' : '통합 백업 미리보기';
  $('traitPresetGuideBackupDescription').textContent=demo.automatic ? '현재 입력값이 아직 미반영 상태입니다. 실제 백업은 이 변경을 먼저 업데이트하고 파일을 만듭니다.' : '공통값은 두 프리셋에, 개별값은 선택한 프리셋에만 반영된 것을 확인하세요.';
  const cards=['a','b'].filter(id=>common || id===demo.selected).map(id=>{
    const currentSelected=id===demo.selected;
    const singleName=currentSelected && single ? '특성 투자 제한 AD' : '업데이트 없음';
    return `<article class="trait-preset-guide-preview-card"><strong>연습 프리셋 ${id.toUpperCase()}</strong><div><span>공통</span><b>${common ? '시작 SP' : '업데이트 없음'}</b></div><div class="is-single"><span>개별</span><b>${singleName}</b></div></article>`;
  });
  $('traitPresetGuideBackupCards').innerHTML=cards.join('');
}
function renderTraitPresetGuideDemo(){
  const demo=traitPresetGuideDemo;
  if(!demo) return;
  const dirty=traitPresetGuideDirty();
  const bothDirty=dirty.sp && dirty.limit;
  const selected=!!demo.selected;
  const stage=demo.stage;
  const select=$('traitPresetGuideDemoSelect');
  if(select){ select.value=demo.selected; select.disabled=stage>=3; }
  [['sp','traitPresetGuideDemoSp'],['limit','traitPresetGuideDemoLimit']].forEach(([key,id])=>{
    const input=$(id);
    if(!input) return;
    input.disabled=!selected || stage>=3;
    input.value=selected ? demo.current[key] : (key==='sp' ? 300 : 100);
  });
  $('traitPresetGuideSpCheck').textContent=`${dirty.sp?'✓':'○'} 공통 시작 SP 수정`;
  $('traitPresetGuideLimitCheck').textContent=`${dirty.limit?'✓':'○'} 개별 특성 제한 수정`;
  $('traitPresetGuideSpCheck').classList.toggle('is-done',dirty.sp);
  $('traitPresetGuideLimitCheck').classList.toggle('is-done',dirty.limit);
  $('traitPresetGuideSavedA').textContent=`SP ${demo.presets.a.sp} / AD ${demo.presets.a.limit}`;
  $('traitPresetGuideSavedB').textContent=`SP ${demo.presets.b.sp} / AD ${demo.presets.b.limit}`;
  const editPending=selected && (dirty.sp || dirty.limit) && (stage<3 || (demo.automatic && stage===3));
  setTraitPresetGuideDemoProgress('Update',!selected?'idle':editPending?'pending':'done',!selected?'대기':editPending?'업데이트 필요':'반영 완료',!selected?'프리셋을 선택하세요':editPending?'현재 입력값이 저장된 프리셋과 달라요.':'현재 입력값이 선택한 프리셋과 일치합니다.');
  const backupNeeded=(demo.updated || (demo.automatic && stage===3)) && !demo.complete;
  setTraitPresetGuideDemoProgress('Backup',!selected?'idle':backupNeeded?'pending':'done',!selected?'대기':backupNeeded?'백업 필요':'백업 최신',backupNeeded?'변경 내용이 아직 백업 파일에 담기지 않았어요.':selected?'백업이 최신 상태입니다.':'백업할 프리셋이 없습니다.');
  const updateButton=document.querySelector('[data-trait-preset-guide-update]');
  if(updateButton) updateButton.disabled=stage!==2 || !bothDirty;
  const importButton=document.querySelector('[data-trait-preset-guide-import]');
  if(importButton){
    importButton.disabled=stage>=2;
    setTraitPresetGuideDemoProgress('Import',selected?'done':'idle',selected?'불러오기 완료':'샘플 불러오기',selected?'연습용 샘플을 선택했습니다.':'연습 프리셋 A를 불러옵니다.');
  }
  const backupButton=document.querySelector('[data-trait-preset-guide-backup]');
  if(backupButton){
    backupButton.disabled=stage!==2 && stage!==3;
    backupButton.classList.toggle('is-backup-needed',backupNeeded);

  }
  document.querySelectorAll('[data-trait-preset-guide-progress]').forEach(node=>{
    const n=Number(node.dataset.traitPresetGuideProgress);
    node.classList.toggle('is-current',Math.min(stage,3)===n && stage<4);
    node.classList.toggle('is-done',stage>n);
  });
  document.querySelectorAll('[data-trait-preset-guide-step]').forEach(node=>{node.hidden=Number(node.dataset.traitPresetGuideStep)!==stage;});
  const focusScroll=document.querySelector('.trait-preset-guide-content');
  if(stage>=3){
    if(stage===3) traitPresetGuideBackupCards();
    if(stage===4){
      $('traitPresetGuideSuccessSummary').textContent=demo.automatic ? '프리셋 업데이트를 누르지 않아도 백업 과정에서 미반영 변경값이 자동으로 적용되었습니다.' : '공통 시작 SP는 A와 B 모두에, 개별 특성 제한값은 선택한 프리셋에만 반영되었습니다.';
    }
    if(focusScroll) focusScroll.scrollTop=0;
  }
  const next=document.querySelector('[data-trait-preset-guide-next]');
  if(next) next.innerHTML=stage===4 ? '가이드 닫기 <span aria-hidden="true">✓</span>' : '가이드 닫기 <span aria-hidden="true">×</span>';
  updateTraitGuideTarget();
}
function showTraitPresetGuidePage(page){
  const modal=$('traitPresetGuideModal');
  if(!modal?.classList.contains('is-open')) return;
  const welcome=page==='welcome';
  const practice=page==='practice';
  const intro=page==='intro';
  if(!welcome && !practice && !intro) return;
  modal.querySelectorAll('[data-trait-preset-guide-page]').forEach(node=>{node.hidden=node.dataset.traitPresetGuidePage!==page;});
  const label=$('traitPresetGuidePageLabel');
  if(label) label.innerHTML=welcome?'01 <i>/</i> 03 · 제작자 인사':intro?'02 <i>/</i> 03 · 이용 가이드':'03 <i>/</i> 03 · 체험 모드';
  const dialog=modal.querySelector('.trait-preset-guide-dialog');
  if(dialog){
    dialog.classList.toggle('is-practice',practice);
    dialog.setAttribute('aria-labelledby',welcome?'traitPresetGuideWelcomeTitle':practice?'traitPresetGuidePracticeTitle':'traitPresetGuideTitle');
    dialog.setAttribute('aria-describedby',welcome?'traitPresetGuideWelcomeDescription':practice?'traitPresetGuidePracticeDescription':'traitPresetGuideDescription');
  }
  const back=modal.querySelector('[data-trait-preset-guide-back]');
  if(back){back.hidden=welcome;back.textContent=practice?'← 이용 가이드로':'← 제작자 인사로';}
  const next=modal.querySelector('[data-trait-preset-guide-next]');
  if(next) next.innerHTML=welcome?'이용 가이드 보기 <span aria-hidden="true">→</span>':intro?'체험 하러가기 <span aria-hidden="true">→</span>':'가이드 닫기 <span aria-hidden="true">×</span>';
  const dismiss=modal.querySelector('[data-trait-preset-guide-dismiss]');
  if(dismiss) dismiss.hidden=welcome || practice;
  if(practice){
    traitPresetGuideDemo=newTraitPresetGuideDemo();
    renderTraitPresetGuideDemo();
  }else{
    traitPresetGuideDemo=null;
  }
  const content=modal.querySelector('.trait-preset-guide-content');
  if(content) content.scrollTop=0;
  const firstControl=practice ? $('traitPresetGuideDemoSelect') : welcome ? modal.querySelector('[data-trait-preset-guide-copy-tag]') : modal.querySelector('[data-trait-preset-guide-next]');
  firstControl?.focus({preventScroll:true});
  updateTraitGuideTarget();
}

function chooseTraitPresetGuideDemo(value){
  const demo=traitPresetGuideDemo;
  if(!demo || demo.stage>=3) return;
  demo.selected=(value==='a'||value==='b')?value:'';
  demo.current=demo.selected ? {...demo.presets[demo.selected]} : null;
  demo.stage=demo.selected ? 1 : 0;
  renderTraitPresetGuideDemo();
}
function editTraitPresetGuideDemo(key,raw){
  const demo=traitPresetGuideDemo;
  if(!demo?.selected || demo.stage>=3) return;
  const next=Number(raw);
  if(!Number.isFinite(next) || raw==='' || next<0 || next>999999) return;
  demo.current[key]=Math.round(next);
  const dirty=traitPresetGuideDirty();
  demo.stage=dirty.sp && dirty.limit ? 2 : 1;
  renderTraitPresetGuideDemo();
}
function applyTraitPresetGuideDemoUpdate(){
  const demo=traitPresetGuideDemo;
  if(!demo?.selected || demo.stage!==2) return;
  const dirty=traitPresetGuideDirty();
  demo.savedCommon=dirty.sp;
  demo.savedSingle=dirty.limit;
  if(dirty.sp){ demo.presets.a.sp=demo.current.sp; demo.presets.b.sp=demo.current.sp; }
  if(dirty.limit) demo.presets[demo.selected].limit=demo.current.limit;
  demo.updated=true;
  demo.stage=3;
  renderTraitPresetGuideDemo();
}
function startTraitPresetGuideBackup(){
  const demo=traitPresetGuideDemo;
  if(!demo) return;
  if(demo.stage===3){
    $('traitPresetGuideBackupFilename')?.focus({preventScroll:false});
    return;
  }
  if(demo.stage!==2) return;
  demo.automatic=true;
  demo.stage=3;
  renderTraitPresetGuideDemo();
}
function finishTraitPresetGuideDemo(){
  const demo=traitPresetGuideDemo;
  if(!demo || demo.stage!==3) return;
  if(demo.automatic){
    const dirty=traitPresetGuideDirty();
    if(dirty.sp){ demo.presets.a.sp=demo.current.sp; demo.presets.b.sp=demo.current.sp; }
    if(dirty.limit) demo.presets[demo.selected].limit=demo.current.limit;
  }
  demo.updated=false;
  demo.complete=true;
  demo.stage=4;
  renderTraitPresetGuideDemo();
}
function closeTraitPresetGuideModal(){
  const modal=$('traitPresetGuideModal');
  if(!modal?.classList.contains('is-open')) return;
  traitPresetGuideDemo=null;
  window.DpsModal.setOpen('traitPresetGuideModal','trait-preset-guide-open',false);
  traitPresetGuideReturnFocus?.focus?.({preventScroll:true});
  traitPresetGuideReturnFocus=null;
}
function openTraitPresetGuideModal(options={}){
  const modal=createTraitPresetGuideModal();
  traitPresetGuideReturnFocus=options.trigger || document.activeElement;
  window.DpsModal.setOpen('traitPresetGuideModal','trait-preset-guide-open',true);
  showTraitPresetGuidePage('welcome');
  modal.querySelector('.trait-preset-guide-close')?.focus({preventScroll:true});
}
/* 단계별 목표 지정 · 실제 요소의 위치를 기준으로 화살표 경로 계산 */
let guideFrame=0;
const GUIDE_ROUTE=[
  ['프리셋 선택','목록에서 A 또는 B를 선택하세요'],
  ['값 수정','강조된 입력칸의 값을 변경하세요'],
  ['업데이트 또는 백업','두 버튼 중 원하는 방법을 선택하세요'],
  ['통합 백업','파일명을 확인하고 체험 백업을 완료하세요'],
  ['체험 완료','공통값과 개별값 반영 결과를 확인하세요']
];
function guideTargetNodes(){
  const state=traitPresetGuideDemo;
  if(!state || state.stage===4) return [];
  if(state.stage===0) return [$('traitPresetGuideDemoSelect')];
  if(state.stage===1){
    const changed=traitPresetGuideDirty();
    return [$(changed.sp?'traitPresetGuideDemoLimit':'traitPresetGuideDemoSp')];
  }
  if(state.stage===2) return [document.querySelector('[data-trait-preset-guide-update]'),document.querySelector('[data-trait-preset-guide-backup]')];
  return [document.querySelector('[data-trait-preset-guide-finish]')];
}
function updateTraitGuideTarget(){
  const dialog=$('traitPresetGuideModal');
  if(!dialog?.classList.contains('is-open')) return;
  const active=!!dialog.querySelector('[data-trait-preset-guide-page="practice"]:not([hidden])');
  const stage=traitPresetGuideDemo?.stage ?? 0;
  const route=GUIDE_ROUTE[stage] || GUIDE_ROUTE[0];
  const title=$('traitGuideRouteTitle'),hint=$('traitGuideRouteHint'),num=$('traitGuideStepNumber');
  if(title) title.textContent=`${String(stage+1).padStart(2,'0')} / ${route[0]}`;
  if(hint) hint.textContent=route[1];
  if(num) num.textContent=`${stage+1} / 5`;
  dialog.querySelectorAll('.guide-is-target,.guide-is-alternate').forEach(el=>el.classList.remove('guide-is-target','guide-is-alternate'));
  const targets=active ? guideTargetNodes().filter(Boolean) : [];
  targets.forEach((el,index)=>el.classList.add(index===0?'guide-is-target':'guide-is-alternate'));
  if(guideFrame) cancelAnimationFrame(guideFrame);
  if(active && targets.length) guideFrame=requestAnimationFrame(()=>{guideFrame=0;positionTraitGuideArrow(targets[0]);});
  else {
    const line=$('traitGuideConnector');
    if(line) line.style.opacity='0';
  }
}
function positionTraitGuideArrow(target){
  const svg=$('traitGuideConnector');
  const grid=svg?.parentElement;
  const anchor=$('traitGuideAnchor');
  if(!svg || !grid || !anchor || !target || !target.getClientRects().length || !anchor.getClientRects().length) return;
  const base=grid.getBoundingClientRect();
  const a=anchor.getBoundingClientRect(),b=target.getBoundingClientRect();
  const card=grid.querySelector('.trait-preset-guide-explain')?.getBoundingClientRect();
  const stage=traitPresetGuideDemo?.stage;
  const filename=stage===3 ? $('traitPresetGuideBackupFilename')?.getBoundingClientRect() : null;
  const mobile=card && b.top>=card.bottom;
  // Mobile paths enter from below the explanation, not through its text.
  // At the backup step, connect the filename field straight to its action button.
  const x1=(filename?filename.left+filename.width/2:mobile?card.left+card.width*.72:a.left)-base.left;
  const y1=(filename?filename.bottom:mobile?card.bottom:a.top+a.height/2)-base.top;
  const x2=(filename?b.left+b.width/2:mobile?b.left+b.width/2:b.right)-base.left;
  const y2=(filename?b.top:mobile?b.top:b.top+b.height/2)-base.top;
  const dx=x2-x1,dy=y2-y1;
  const horizontal=Math.abs(dx)>Math.abs(dy)*.65;
  const curve=horizontal?`M ${x1} ${y1} C ${x1+dx*.44} ${y1}, ${x2-dx*.45} ${y2}, ${x2} ${y2}`:`M ${x1} ${y1} C ${x1} ${y1+dy*.4}, ${x2} ${y2-dy*.4}, ${x2} ${y2}`;
  const width=Math.max(1,grid.clientWidth),height=Math.max(1,grid.clientHeight);
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));
  $('traitGuideConnectorPath').setAttribute('d',curve);
  $('traitGuideConnectorGlow').setAttribute('d',curve);
  const dot=$('traitGuideConnectorDot');
  dot.setAttribute('cx',String(x2));dot.setAttribute('cy',String(y2));
  svg.style.opacity='1';
}
function bindTraitGuideEvents(){
  document.addEventListener('click',event=>{
    const opener=event.target.closest?.('[data-trait-preset-guide-open]');
    if(opener){event.preventDefault();openTraitPresetGuideModal({trigger:opener});return;}
    if(!event.target.closest?.('#traitPresetGuideModal')) return;
    const action=event.target.closest('[data-trait-preset-guide-close],[data-trait-preset-guide-dismiss],[data-trait-preset-guide-next],[data-trait-preset-guide-back],[data-trait-preset-guide-copy-tag],[data-trait-preset-guide-import],[data-trait-preset-guide-update],[data-trait-preset-guide-backup],[data-trait-preset-guide-finish],[data-trait-preset-guide-restart]');
    if(!action) return;
    event.preventDefault();
    if(action.matches('[data-trait-preset-guide-copy-tag]')){
      const status=$('traitPresetGuideCopyStatus');
      const value='회장#31977';
      const legacyCopy=()=>{
        const field=document.createElement('textarea');
        field.value=value;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';
        document.body.appendChild(field);field.select();
        let copied=false;
        try{copied=document.execCommand('copy');}catch(error){copied=false;}
        field.remove();return copied;
      };
      const showResult=ok=>{if(status) status.textContent=ok?'배틀태그가 복사되었습니다.':'복사할 수 없습니다. 회장#31977을 직접 복사해 주세요.';};
      if(navigator.clipboard?.writeText){navigator.clipboard.writeText(value).then(()=>showResult(true),()=>showResult(legacyCopy()));}
      else showResult(legacyCopy());
      return;
    }
    if(action.matches('[data-trait-preset-guide-dismiss]')){saveTraitPresetGuideConfirmedAt();closeTraitPresetGuideModal();}
    else if(action.matches('[data-trait-preset-guide-close]')) closeTraitPresetGuideModal();
    else if(action.matches('[data-trait-preset-guide-next]')){
      if(document.querySelector('[data-trait-preset-guide-page="welcome"]:not([hidden])')) showTraitPresetGuidePage('intro');
      else if(document.querySelector('[data-trait-preset-guide-page="intro"]:not([hidden])')) showTraitPresetGuidePage('practice');
      else closeTraitPresetGuideModal();
    }else if(action.matches('[data-trait-preset-guide-back]')) showTraitPresetGuidePage(document.querySelector('[data-trait-preset-guide-page="practice"]:not([hidden])')?'intro':'welcome');
    else if(action.matches('[data-trait-preset-guide-import]')) chooseTraitPresetGuideDemo('a');
    else if(action.matches('[data-trait-preset-guide-update]')) applyTraitPresetGuideDemoUpdate();
    else if(action.matches('[data-trait-preset-guide-backup]')) startTraitPresetGuideBackup();
    else if(action.matches('[data-trait-preset-guide-finish]')) finishTraitPresetGuideDemo();
    else if(action.matches('[data-trait-preset-guide-restart]')){traitPresetGuideDemo=newTraitPresetGuideDemo();renderTraitPresetGuideDemo();}
  });
  document.addEventListener('change',event=>{
    if(event.target.matches?.('[data-trait-preset-guide-select]')) chooseTraitPresetGuideDemo(event.target.value);
  });
  document.addEventListener('input',event=>{
    const input=event.target;
    if(input.matches?.('[data-trait-preset-guide-input]')) editTraitPresetGuideDemo(input.dataset.traitPresetGuideInput,input.value);
  });
  document.addEventListener('keydown',event=>{
    const modal=$('traitPresetGuideModal');
    if(!modal?.classList.contains('is-open')) return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeTraitPresetGuideModal();return;}
    if(event.key!=='Tab') return;
    const controls=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(el=>el.getClientRects().length&&!el.closest('[hidden]'));
    if(!controls.length) return;
    if(event.shiftKey && document.activeElement===controls[0]){event.preventDefault();controls[controls.length-1].focus();}
    else if(!event.shiftKey && document.activeElement===controls[controls.length-1]){event.preventDefault();controls[0].focus();}
  },true);
  window.addEventListener('resize',updateTraitGuideTarget,{passive:true});
  document.addEventListener('scroll',event=>{
    if(event.target?.closest?.('#traitPresetGuideModal')) updateTraitGuideTarget();
  },true);
}
function injectTraitGuideStyle(){
  if(document.getElementById('dpsGuideStyles')) return;
  const style=document.createElement('style');
  style.id='dpsGuideStyles';
  style.textContent=GUIDE_STYLES;
  document.head.appendChild(style);
}
function insertTraitGuideEntry(){
  const toolbar=document.querySelector('.trait-preset-title');
  if(!toolbar || toolbar.querySelector('[data-trait-preset-guide-open]')) return;
  const button=document.createElement('button');
  button.type='button';button.className='trait-preset-guide-trigger';
  button.dataset.traitPresetGuideOpen='';
  button.setAttribute('aria-label','제작자 인사 및 이용 가이드 보기');
  button.title='프리셋 이용 가이드';
  button.innerHTML='<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><use href="#dpsHeaderBrandGlyph"></use></svg><span>이용 가이드</span>';
  const actions=toolbar.querySelector('.trait-preset-title-actions');
  if(actions) actions.appendChild(button);
  else toolbar.appendChild(button);
}
let guideInitialized=false;
function initTraitGuide(){
  if(guideInitialized) return;
  guideInitialized=true;
  injectTraitGuideStyle();
  insertTraitGuideEntry();
  bindTraitGuideEvents();
  setTimeout(maybeShowTraitPresetGuide,850);
}
window.DpsGuide=Object.freeze({init:initTraitGuide,open:openTraitPresetGuideModal,close:closeTraitPresetGuideModal});

})();
