(function(){
  'use strict';

  const BATTLE_STYLE_ID='dps-battle-style';
  const BATTLE_STYLE=String.raw`
.battle-stage{
  position:relative;display:block;width:100%;min-width:0;overflow:hidden;
  isolation:isolate;contain:layout paint;background:transparent;
}
.battle-stage[hidden]{display:none;}
.battle-stage-unit{height:232px;min-height:232px;margin:0 0 6px;}
.battle-canvas-shell{
  position:relative;display:block;width:100%;height:100%;overflow:hidden;box-sizing:border-box;
  border:1px solid rgba(83,72,78,.62);border-radius:2px;background:#08070a;
  box-shadow:inset 0 0 0 1px rgba(139,102,93,.08),inset 0 14px 28px rgba(0,0,0,.28),inset 0 -12px 24px rgba(0,0,0,.34);
}
.battle-canvas-shell.has-enemy-status.show-enemy-status{display:grid;grid-template-rows:38px minmax(0,1fr);}
.battle-canvas-viewport{position:relative;display:block;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;}
.battle-canvas{display:block;width:100%;height:100%;touch-action:pan-y;}
.battle-enemy-status{
  display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:center;min-width:0;
  padding:5px 12px;border-bottom:1px solid rgba(139,108,82,.52);
  background:linear-gradient(180deg,rgba(43,34,30,.98),rgba(19,14,14,.97));box-sizing:border-box;
}
.battle-enemy-status[hidden]{display:none;}
.battle-enemy-status-title{color:#fff0d8;font-size:10.5px;font-weight:1000;line-height:1;white-space:nowrap;}
.battle-enemy-status-metric{display:grid;grid-template-columns:auto minmax(66px,auto) minmax(70px,1fr);gap:7px;align-items:center;min-width:0;}
.battle-enemy-status-label{font-size:9px;font-weight:1000;line-height:1;white-space:nowrap;}
.battle-enemy-status-metric[data-battle-durability="hp"] .battle-enemy-status-label{color:var(--battle-enemy-hp,#f24f70);}
.battle-enemy-status-metric[data-battle-durability="shield"] .battle-enemy-status-label{color:var(--battle-enemy-shield,#58d7ff);}
.battle-enemy-status-value{min-width:0;color:#f4f8ff;font:900 9.5px/1 Consolas,monospace;text-align:right;white-space:nowrap;}
.battle-enemy-status-track{display:block;height:7px;min-width:0;overflow:hidden;border:1px solid rgba(132,104,82,.58);border-radius:999px;background:rgba(8,5,5,.92);box-sizing:border-box;}
.battle-enemy-status-fill{display:block;width:100%;height:100%;border-radius:inherit;transition:width .14s linear;}
.battle-enemy-status-metric[data-battle-durability="hp"] .battle-enemy-status-fill{background:var(--battle-enemy-hp,#f24f70);box-shadow:0 0 8px color-mix(in srgb,var(--battle-enemy-hp,#f24f70) 70%,transparent);}
.battle-enemy-status-metric[data-battle-durability="shield"] .battle-enemy-status-fill{background:var(--battle-enemy-shield,#58d7ff);box-shadow:0 0 8px color-mix(in srgb,var(--battle-enemy-shield,#58d7ff) 70%,transparent);}
.battle-enemy-status-metric.is-depleted{opacity:.5;}
.battle-enemy-status-metric.is-depleted .battle-enemy-status-fill{box-shadow:none;}
@media (max-width:1024px){.battle-stage-unit{height:214px;min-height:214px;}}
body:is(.is-mobile,.is-narrow-mobile) .battle-stage-unit{height:212px;min-height:212px;margin:0 0 4px;}
body:is(.is-mobile,.is-narrow-mobile) .battle-canvas-shell.has-enemy-status.show-enemy-status{grid-template-rows:54px minmax(0,1fr);}
body:is(.is-mobile,.is-narrow-mobile) .battle-enemy-status{grid-template-columns:auto minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,1fr));gap:2px 8px;padding:4px 8px;}
body:is(.is-mobile,.is-narrow-mobile) .battle-enemy-status-title{grid-row:1/3;font-size:9.5px;}
body:is(.is-mobile,.is-narrow-mobile) .battle-enemy-status-metric{grid-column:2;grid-template-columns:24px minmax(60px,auto) minmax(50px,1fr);gap:5px;}
body:is(.is-mobile,.is-narrow-mobile) .battle-enemy-status-label{font-size:8.5px;}
body:is(.is-mobile,.is-narrow-mobile) .battle-enemy-status-value{font-size:8.8px;}
body:is(.is-mobile,.is-narrow-mobile) .battle-enemy-status-track{height:6px;}
@media (prefers-reduced-motion:reduce){.battle-enemy-status-fill{transition:none;}}

/* 특성 프리셋 알림 */
body .trait-preset-heading,body.is-tabbed .mobile-page .trait-preset-heading{overflow:visible;}
.preset-notice-bubble{
  position:absolute;
  z-index:80;
  top:50%;
  left:calc(100% + 9px);
  width:max-content;
  max-width:min(300px,45vw);
  padding:8px 10px;
  transform:translateY(-50%);
  pointer-events:none;
  border:1px solid #8ba7c7;
  border-radius:11px;
  background:#f8fbff;
  color:#17324f;
  box-shadow:0 5px 14px rgba(20,43,70,.18);
  font-size:11px;
  font-weight:900;
  line-height:1.4;
  text-align:left;
  white-space:normal;
  overflow-wrap:anywhere;
  animation:presetNoticeIn .2s ease-out both;
}
.preset-notice-bubble[hidden]{display:none;}
.preset-notice-bubble::after{
  content:"";
  position:absolute;
  left:-7px;
  top:50%;
  width:12px;
  height:12px;
  transform:translateY(-50%) rotate(45deg);
  border-left:1px solid #8ba7c7;
  border-bottom:1px solid #8ba7c7;
  background:#f8fbff;
}
.preset-notice-bubble.is-attention{border-color:#d58b2d;background:#fff7e7;color:#6c3c08;}
.preset-notice-bubble.is-attention::after{border-color:#d58b2d;background:#fff7e7;}
.preset-notice-bubble.is-error{border-color:#d34b62;background:#fff0f3;color:#751f32;}
.preset-notice-bubble.is-error::after{border-color:#d34b62;background:#fff0f3;}

@keyframes presetNoticeIn{from{opacity:0;transform:translate(-4px,-50%) scale(.97);}to{opacity:1;transform:translate(0,-50%) scale(1);}}

@media (max-width:600px){
  .preset-notice-bubble{max-width:42vw;padding:7px 8px;font-size:9.5px;line-height:1.35;}
}
@media (prefers-reduced-motion:reduce){
  .preset-notice-bubble{animation:none;transition:none;}
}
`;
  function ensureBattleStyle(){
    if(document.getElementById(BATTLE_STYLE_ID)) return;
    const style=document.createElement('style');
    style.id=BATTLE_STYLE_ID;
    style.textContent=BATTLE_STYLE;
    document.head.appendChild(style);
  }

  const SOLO_REST_DIALOGUES=Object.freeze([
    Object.freeze({speaker:'hero',text:'장비 점검 완료. 성문까지 단숨에 돌파한다.'}),
    Object.freeze({speaker:'artifact',text:'에너지 회오리 충전률 {charge}%.'}),
    Object.freeze({speaker:'hero',text:'횃불이 꺼지기 전에 출발하자.'}),
    Object.freeze({speaker:'artifact',text:'마력 코어 안정화 중. 공명 출력 정상.'})
  ]);
  const COOP_REST_DIALOGUES=Object.freeze([
    Object.freeze({speaker:'hero',text:'빨강이, 하얀이. 준비됐지?'}),
    Object.freeze({speaker:'p2',text:'준비됐습니다, 보스. 언제든 출발하시죠.'}),
    Object.freeze({speaker:'p3',text:'저도 준비됐어요, 보스. 신호만 주세요.'}),
    Object.freeze({speaker:'artifact',text:'에너지 회오리 충전률 {charge}%.'}),
    Object.freeze({speaker:'hero',text:'좋아. 성문이 열리면 한 번에 돌파한다.'}),
    Object.freeze({speaker:'artifact',text:'공명 출력 안정화 완료. 돌격 보조 준비 완료.'})
  ]);
  const RESULT_MESSAGES=Object.freeze({
    critical:'현재 구성으로는 공략이 어려워 보여.',
    reinforce:'주력 유닛을 조금 더 보강해 봐.',
    near:'조금만 더 보강하면 공략할 수 있겠어.',
    clear:'현재 구성으로 공략이 가능해 보여.',
    surplus:'공략에 필요한 화력을 충분히 넘겼어.'
  });
  const PLAYER_COLORS={
    p1:{main:'#2f8cff',light:'#bce8ff',glow:'rgba(47,140,255,.78)'},
    p2:{main:'#f4f7ff',light:'#ffffff',glow:'rgba(255,255,255,.66)'},
    p3:{main:'#ff4b55',light:'#ffd0d3',glow:'rgba(255,75,85,.68)'}
  };
  const THEMES={
    classic:{
      skyTop:'#17151d',skyBottom:'#09080d',ground:'#100c10',route:'#b99a68',
      bossLight:'#ff6f91',shield:'#58d7ff',hp:'#f24f70',text:'#f2f7ff',castleEdge:'#544b59'
    },
    eternal:{
      skyTop:'#1b1320',skyBottom:'#09060d',ground:'#130a13',route:'#b98aa9',
      bossLight:'#ff7ed4',shield:'#a57cff',hp:'#ef4e9f',text:'#fff5fd',castleEdge:'#654b64'
    }
  };

  const BATTLE_DURATION=5;
  const RESULT_START_PHASE=.76;
  const RESULT_FADE_OUT_PHASE=.94;
  const RESULT_END_PHASE=.985;
  const SOLO_ARMY_ROUTE=Object.freeze([[.11,.20],[.89,.20],[.89,.83],[.11,.83]]);
  const COOP_ARMY_ROUTE=Object.freeze([[.12,.14],[.12,.82],[.86,.82]]);
  let battleScene=null;
  let initialized=false;
  let paused=false;
  let refreshQueued=false;

  const SVG_SOURCES=Object.freeze({
    hero:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 210">
  <defs>
    <linearGradient id="armor" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#dff7ff"/><stop offset=".28" stop-color="#68d5ff"/><stop offset=".68" stop-color="#2563eb"/><stop offset="1" stop-color="#102a66"/></linearGradient>
    <linearGradient id="dark" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#243c69"/><stop offset="1" stop-color="#081329"/></linearGradient>
    <linearGradient id="weapon" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#effcff"/><stop offset=".45" stop-color="#67e8f9"/><stop offset="1" stop-color="#2563eb"/></linearGradient>
    <radialGradient id="core"><stop stop-color="#fff"/><stop offset=".3" stop-color="#a5f3fc"/><stop offset="1" stop-color="#0284c7"/></radialGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <ellipse cx="88" cy="193" rx="48" ry="10" fill="#000" opacity=".35"/>
  <path d="M51 83L25 149l38-17 20-48z" fill="#163466" opacity=".9"/>
  <path d="M55 84l18-19 32-2 22 24-12 67H63z" fill="url(#armor)" stroke="#9cecff" stroke-width="3"/>
  <path d="M67 144l22 1-6 48H55zM100 145l20-1 16 49h-29z" fill="url(#dark)" stroke="#54c7ff" stroke-width="3"/>
  <path d="M53 86L28 98l11 30 27-17zM126 87l27 14-13 29-27-18z" fill="url(#armor)" stroke="#9cecff" stroke-width="3"/>
  <path d="M66 48c1-25 42-29 50-4l-4 30-41 2z" fill="url(#armor)" stroke="#a8efff" stroke-width="3"/>
  <path d="M69 52q21-15 45 0l-5 15H74z" fill="#071628" stroke="#70dcff" stroke-width="2"/>
  <path d="M77 56h12l-3 6H76zm19 0h12l1 6H99z" fill="#a5f3fc" filter="url(#glow)"/>
  <path d="M67 45L54 31l4 25zm47-1l15-16-7 29z" fill="#2570c8" stroke="#7ddcff" stroke-width="2"/>
  <circle cx="91" cy="103" r="16" fill="#08223c" stroke="#7ddcff" stroke-width="3"/>
  <circle cx="91" cy="103" r="10" fill="url(#core)" filter="url(#glow)"/>
  <path d="M53 112l-24 22 9 14 31-23zm69 1l26 8-5 17-34-12z" fill="url(#dark)" stroke="#5dd4ff" stroke-width="3"/>
  <g transform="translate(127 98) rotate(-22)">
    <path d="M0 15L42 4l41 8-42 18L3 28z" fill="url(#weapon)" stroke="#c8f6ff" stroke-width="3"/>
    <path d="M56 9l24-18 9 8-13 20z" fill="#76e8ff" stroke="#effcff" stroke-width="2"/>
    <rect x="20" y="23" width="16" height="23" rx="5" fill="#102a66" stroke="#74dfff" stroke-width="2"/>
    <circle cx="47" cy="17" r="7" fill="url(#core)" filter="url(#glow)"/>
  </g>
  <path d="M57 169h28v23H47l3-15zm49 0h27l10 23h-38z" fill="#0b1a37" stroke="#58cfff" stroke-width="3"/>
</svg>`,
    boss:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 240">
  <defs>
    <linearGradient id="carapace" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffb4c1"/><stop offset=".26" stop-color="#ef476f"/><stop offset=".66" stop-color="#8b1538"/><stop offset="1" stop-color="#2a0715"/></linearGradient>
    <linearGradient id="black" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#4b1530"/><stop offset="1" stop-color="#10040b"/></linearGradient>
    <radialGradient id="core"><stop stop-color="#fff4c2"/><stop offset=".25" stop-color="#ffb54f"/><stop offset=".58" stop-color="#fb3f6c"/><stop offset="1" stop-color="#6f0e34"/></radialGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <ellipse cx="110" cy="218" rx="72" ry="13" fill="#000" opacity=".45"/>
  <path d="M78 74L18 40l27 63-30 35 69-21zM142 74l60-34-27 63 30 35-69-21z" fill="#4c0b24" stroke="#d22d59" stroke-width="4"/>
  <path d="M74 76l25-25h27l28 27-13 103H77z" fill="url(#carapace)" stroke="#ff8da9" stroke-width="4"/>
  <path d="M78 52L47 10l12 58zm65 0l31-42-12 58z" fill="#761033" stroke="#ff6f94" stroke-width="4"/>
  <path d="M76 45q34-38 68 0l-6 47q-28 27-57 0z" fill="url(#black)" stroke="#f15a7f" stroke-width="4"/>
  <path d="M86 62l17 4-7 10-14-6zm48 0l-17 4 7 10 14-6z" fill="#fff0a6" filter="url(#glow)"/>
  <path d="M88 84q22 21 44 0-5 30-22 31-17-1-22-31z" fill="#320817" stroke="#f04973" stroke-width="3"/>
  <path d="M96 91l8 7 6-10 7 10 8-7-5 17h-20z" fill="#fff3d0"/>
  <circle cx="110" cy="127" r="23" fill="#270818" stroke="#ff7295" stroke-width="4"/>
  <circle cx="110" cy="127" r="14" fill="url(#core)" filter="url(#glow)"/>
  <path d="M74 102L35 121l6 30 43-18zm72 0l39 19-6 30-43-18z" fill="url(#black)" stroke="#ee4e75" stroke-width="4"/>
  <path d="M41 128L5 143l28 11-18 20 39-18zm138 0l36 15-28 11 18 20-39-18z" fill="#8d153a" stroke="#ff7092" stroke-width="3"/>
  <path d="M83 174l23 2-10 43H64zm31 2l23-2 19 45h-32z" fill="#210817" stroke="#dd3b67" stroke-width="4"/>
  <path d="M74 190l-38 24 28 7 27-22zm72 0l38 24-28 7-27-22z" fill="#5f0c2d" stroke="#e64d77" stroke-width="3"/>
</svg>`,
    minion:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90">
  <defs>
    <linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ff8da5"/><stop offset=".42" stop-color="#bd244c"/><stop offset="1" stop-color="#310816"/></linearGradient>
    <filter id="g"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <ellipse cx="45" cy="79" rx="25" ry="6" fill="#000" opacity=".4"/>
  <path d="M26 33L5 20l12 27-11 17 27-11zm38 0l21-13-12 27 11 17-27-11z" fill="#65102e" stroke="#e7436b" stroke-width="3"/>
  <path d="M27 31l12-13h13l13 14-6 35H32z" fill="url(#m)" stroke="#ff7897" stroke-width="3"/>
  <path d="M31 22q14-15 28 0l-3 17q-12 10-23 0z" fill="#230711" stroke="#f15b7e" stroke-width="2"/>
  <path d="M35 29l7 2-3 5-6-3zm20 0l-7 2 3 5 6-3z" fill="#fff3b0" filter="url(#g)"/>
  <circle cx="45" cy="50" r="8" fill="#ffb84d" stroke="#ff6386" stroke-width="3" filter="url(#g)"/>
  <path d="M35 65h10l-4 15H28zm11 0h10l7 15H50z" fill="#220711" stroke="#c52a52" stroke-width="2"/>
</svg>`
  });
  const HERO_TINTS=Object.freeze({
    p2:Object.freeze({
      '#dff7ff':'#ffffff','#68d5ff':'#e8edf5','#2563eb':'#aeb8c8','#102a66':'#485267',
      '#243c69':'#6c7688','#081329':'#202631','#effcff':'#ffffff','#67e8f9':'#e3e9f3',
      '#0284c7':'#9aa6b8','#a5f3fc':'#ffffff','#071628':'#181d26','#70dcff':'#eef2f8',
      '#2570c8':'#aab4c4','#7ddcff':'#ffffff','#08223c':'#333b49','#54c7ff':'#d9e0ea',
      '#5dd4ff':'#eef2f8','#76e8ff':'#ffffff','#c8f6ff':'#ffffff','#74dfff':'#e7edf5',
      '#0b1a37':'#222936','#58cfff':'#dce3ed','#9cecff':'#ffffff','#a8efff':'#ffffff',
      '#163466':'#566173'
    }),
    p3:Object.freeze({
      '#dff7ff':'#ffe6e8','#68d5ff':'#ff6b72','#2563eb':'#e52f40','#102a66':'#6f0e18',
      '#243c69':'#7e1722','#081329':'#25060a','#effcff':'#fff1f2','#67e8f9':'#ff9ba0',
      '#0284c7':'#b91528','#a5f3fc':'#ffd0d3','#071628':'#210507','#70dcff':'#ff7d84',
      '#2570c8':'#c72134','#7ddcff':'#ff9298','#08223c':'#3a0910','#54c7ff':'#f44957',
      '#5dd4ff':'#ff5c65','#76e8ff':'#ff8f95','#c8f6ff':'#ffe0e2','#74dfff':'#ff6b72',
      '#0b1a37':'#2c070b','#58cfff':'#ec3848','#9cecff':'#ffb0b4','#a8efff':'#ffc0c4',
      '#163466':'#5e0d16'
    })
  });
  const restSvg=createRestHeroSvg(SVG_SOURCES.hero);
  const art=Object.freeze({
    heroP1:createSvgImage(SVG_SOURCES.hero),
    heroAimP1:createSvgImage(createAimHeroSvg(SVG_SOURCES.hero)),
    heroP2:createSvgImage(recolorSvg(SVG_SOURCES.hero,HERO_TINTS.p2)),
    heroP3:createSvgImage(recolorSvg(SVG_SOURCES.hero,HERO_TINTS.p3)),
    heroRestP1:createSvgImage(restSvg),
    heroRestP2:createSvgImage(recolorSvg(restSvg,HERO_TINTS.p2)),
    heroRestP3:createSvgImage(recolorSvg(restSvg,HERO_TINTS.p3)),
    boss:createSvgImage(SVG_SOURCES.boss),
    minion:createSvgImage(SVG_SOURCES.minion)
  });
  function clamp(value,min,max){return Math.min(max,Math.max(min,value));}
  function lerp(a,b,t){return a+(b-a)*t;}
  function frac(value){return value-Math.floor(value);}
  function smooth(t){const x=clamp(t,0,1);return x*x*(3-2*x);}
  function number(value){const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;}
  function themeFor(type){return type==='eternal'?THEMES.eternal:THEMES.classic;}
  function hash(seed){return frac(Math.sin(seed*127.1+311.7)*43758.5453123);}
  function rgba(hex,alpha){
    const clean=String(hex||'#ffffff').replace('#','');
    const full=clean.length===3?clean.split('').map(char=>char+char).join(''):clean;
    const value=parseInt(full,16);
    return `rgba(${(value>>16)&255},${(value>>8)&255},${value&255},${alpha})`;
  }

  function gradientStops(gradient,stops){for(const [offset,color] of stops) gradient.addColorStop(offset,color);return gradient;}
  function linearGradient(ctx,x0,y0,x1,y1,stops){return gradientStops(ctx.createLinearGradient(x0,y0,x1,y1),stops);}
  function radialGradient(ctx,x0,y0,r0,x1,y1,r1,stops){return gradientStops(ctx.createRadialGradient(x0,y0,r0,x1,y1,r1),stops);}
  function fillPolygon(ctx,points,fill,stroke='',lineWidth=1){
    ctx.beginPath();points.forEach(([x,y],index)=>index?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();}
  }
  function drawStoneCourses(ctx,x,y,w,h,rowH,colW,color,jitter=0,seed=0,startRow=0){
    ctx.save();ctx.strokeStyle=color;ctx.lineWidth=.75;
    const rows=Math.ceil(h/rowH);
    for(let row=startRow;row<=rows;row++){
      const yy=y+row*rowH+(hash(seed+row)-.5)*jitter,offset=row%2?colW*.48:0;
      ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+w,yy+(hash(seed+row+31)-.5)*jitter);ctx.stroke();
      for(let xx=x-colW+offset;xx<x+w+colW;xx+=colW){
        const noise=(hash(seed+row*29+Math.round(xx))-.5)*jitter*1.5;
        ctx.beginPath();ctx.moveTo(xx,yy-rowH);ctx.lineTo(xx+noise,yy);ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawHangingDecor(ctx,kind,x,y,a,b,c,d,e){
    ctx.save();
    if(kind==='chain'){
      ctx.strokeStyle=c;ctx.lineWidth=1;
      for(let i=0;i<a;i++){ctx.beginPath();ctx.ellipse(x,y+i*b,2.1,4.1,0,0,Math.PI*2);ctx.stroke();}
    }else{
      const sway=Math.sin(d*.78+c)*a*.07;ctx.fillStyle=e;ctx.beginPath();ctx.moveTo(x,y);
      ctx.quadraticCurveTo(x+sway+a*.34,y+b*.34,x+sway,y+b);ctx.lineTo(x-a*.43+sway,y+b*.80);ctx.quadraticCurveTo(x-a*.24,y+b*.30,x,y);ctx.fill();
      ctx.strokeStyle='rgba(207,116,105,.20)';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x,y+b*.18);ctx.lineTo(x+sway,y+b*.70);ctx.stroke();
    }
    ctx.restore();
  }
  function roundRect(ctx,x,y,width,height,radius){const r=Math.max(0,Math.min(radius,Math.min(width,height)/2));ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+width,y,x+width,y+height,r);ctx.arcTo(x+width,y+height,x,y+height,r);ctx.arcTo(x,y+height,x,y,r);ctx.arcTo(x,y,x+width,y,r);ctx.closePath();}

  function battleNumber(value){
    return Math.max(0,Math.round(number(value))).toLocaleString('ko-KR');
  }
  function activeDialogue(time,lines,options={}){
    const items=(Array.isArray(lines)?lines:[]).filter(Boolean);
    if(!items.length) return null;
    const lineInterval=Math.max(.5,number(options.lineInterval)||3.05);
    const visibleDuration=Math.min(lineInterval,Math.max(.3,number(options.visibleDuration)||2.65));
    const pauseDuration=Math.max(0,number(options.pauseDuration)||3.1);
    const speakingDuration=items.length*lineInterval;
    const cycleDuration=speakingDuration+pauseDuration;
    const cursor=((time%cycleDuration)+cycleDuration)%cycleDuration;
    if(cursor>=speakingDuration) return null;
    const lineIndex=Math.min(items.length-1,Math.floor(cursor/lineInterval));
    const local=cursor-lineIndex*lineInterval;
    if(local>visibleDuration) return null;
    const fadeIn=smooth(clamp(local/.22,0,1));
    const fadeOut=1-smooth(clamp((local-visibleDuration+.30)/.30,0,1));
    return {item:items[lineIndex],alpha:fadeIn*fadeOut};
  }
  function wrapDialogueLines(ctx,text,maxWidth,maxLines=2){
    const words=String(text||'').trim().split(/\s+/).filter(Boolean);
    const lines=[];
    let line='';
    words.forEach(word=>{
      const candidate=line?`${line} ${word}`:word;
      if(line&&ctx.measureText(candidate).width>maxWidth){lines.push(line);line=word;}
      else line=candidate;
    });
    if(line) lines.push(line);
    if(lines.length<=maxLines) return lines;
    const kept=lines.slice(0,maxLines);
    let last=kept[maxLines-1];
    while(last.length>1&&ctx.measureText(`${last}…`).width>maxWidth) last=last.slice(0,-1);
    kept[maxLines-1]=`${last}…`;
    return kept;
  }
  function drawDialogueBubble(ctx,width,height,text,anchor,theme,options={}){
    const alpha=clamp(options.alpha===undefined?1:number(options.alpha),0,1);
    if(alpha<=.01||!anchor) return;
    const fontSize=width<480?9.2:10.5;
    const maxTextWidth=Math.min(width*(width<480?.42:.34),options.maxWidth||190);
    ctx.save();
    ctx.font=`900 ${fontSize}px Pretendard, sans-serif`;
    const lines=wrapDialogueLines(ctx,text,maxTextWidth,2);
    const textWidth=Math.max(...lines.map(line=>ctx.measureText(line).width),64);
    const boxWidth=Math.min(width-16,textWidth+22);
    const boxHeight=lines.length>1?39:29;
    const desiredX=anchor.x+number(options.offsetX);
    const desiredY=anchor.y+number(options.offsetY||-40);
    const x=clamp(desiredX,boxWidth/2+8,width-boxWidth/2-8);
    const y=clamp(desiredY,boxHeight/2+7,height-boxHeight/2-7);
    const accent=options.accent||theme.shield;
    ctx.globalAlpha=alpha;
    roundRect(ctx,x-boxWidth/2,y-boxHeight/2,boxWidth,boxHeight,9);
    ctx.fillStyle=options.artifact?'rgba(4,18,31,.94)':'rgba(5,9,17,.94)';
    ctx.fill();
    ctx.strokeStyle=accent;ctx.lineWidth=1.15;ctx.stroke();
    const tailX=clamp(anchor.x,x-boxWidth*.32,x+boxWidth*.32);
    const tailTop=y+boxHeight/2-1;
    ctx.beginPath();ctx.moveTo(tailX-6,tailTop);ctx.lineTo(anchor.x,anchor.y);ctx.lineTo(tailX+6,tailTop);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle=theme.text;ctx.textAlign='center';ctx.textBaseline='middle';
    const lineGap=12;
    const startY=y-(lines.length-1)*lineGap/2;
    lines.forEach((line,index)=>ctx.fillText(line,x,startY+index*lineGap));
    ctx.restore();
  }
  function drawArtAnchored(ctx,image,x,y,width,height,options={}){if(!isImageReady(image))return false;ctx.save();ctx.globalAlpha=options.alpha??1;ctx.translate(x,y);if(options.rotation)ctx.rotate(options.rotation);if(options.flip)ctx.scale(-1,1);ctx.scale(options.scaleX??1,options.scaleY??1);ctx.drawImage(image,-width/2,-height,width,height);ctx.restore();return true;}
  function drawGroundGlow(ctx,x,y,radius,color,alpha){
    ctx.save();const glow=ctx.createRadialGradient(x,y,2,x,y,radius);glow.addColorStop(0,color);glow.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=alpha;ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(x,y,radius,radius*.20,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function drawRelic(ctx,x,y,scale,options={}){
    const time=number(options.time),active=options.active!==false,alpha=clamp(options.alpha??1,0,1);
    const charge=clamp(options.charge??(active?.82:.46),0,1);
    const bob=Math.sin(time*1.55)*2.1*scale;
    const baseY=y-bob;
    drawGroundGlow(ctx,x,y+5,46*scale,'rgba(72,190,255,.72)',active?.24:.14*alpha);
    ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,baseY);ctx.scale(scale,scale);
    ctx.globalCompositeOperation='source-over';
    const base=ctx.createLinearGradient(-45,0,45,0);
    base.addColorStop(0,'#151d27');base.addColorStop(.22,'#556375');base.addColorStop(.52,'#171f29');base.addColorStop(.78,'#697487');base.addColorStop(1,'#101720');
    ctx.fillStyle=base;ctx.strokeStyle='#87a0b8';ctx.lineWidth=1.4;
    ctx.beginPath();ctx.ellipse(0,0,44,15,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#242d39';ctx.beginPath();ctx.ellipse(0,-4,34,11,0,0,Math.PI*2);ctx.fill();
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4+time*.05,px=Math.cos(a)*36,py=Math.sin(a)*10;
      ctx.save();ctx.translate(px,py);ctx.rotate(a);
      ctx.fillStyle=i%2?'#9e3041':'#c13c4b';ctx.strokeStyle='#ff7c88';ctx.lineWidth=.8;
      roundRect(ctx,-5,-4,10,8,2);ctx.fill();ctx.stroke();ctx.restore();
    }
    ctx.globalCompositeOperation='lighter';
    const core=ctx.createRadialGradient(0,-12,1,0,-12,23);
    core.addColorStop(0,'#ffffff');core.addColorStop(.18,'#a9f3ff');core.addColorStop(.52,'rgba(42,174,255,.72)');core.addColorStop(1,'rgba(0,79,145,0)');
    ctx.fillStyle=core;ctx.globalAlpha=.72+.18*Math.sin(time*2.2);ctx.beginPath();ctx.ellipse(0,-11,25,16,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#69dbff';ctx.lineWidth=1.3;ctx.globalAlpha=.62;ctx.beginPath();ctx.ellipse(0,-10,23,8,0,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<3;i++){
      const a=time*(.34+(i*.035))+i*Math.PI*2/3;
      const px=Math.cos(a)*18,py=-44-Math.sin(a)*5;
      ctx.save();ctx.translate(px,py);ctx.rotate(-.45+Math.sin(a)*.24);
      const panel=ctx.createLinearGradient(-8,-12,8,12);panel.addColorStop(0,'#68d9ff');panel.addColorStop(.38,'#0e72c9');panel.addColorStop(1,'#15366e');
      ctx.fillStyle=panel;ctx.strokeStyle='#8ee9ff';ctx.lineWidth=1.1;
      ctx.beginPath();ctx.moveTo(-7,-13);ctx.lineTo(7,-10);ctx.lineTo(9,10);ctx.lineTo(-5,14);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.restore();
    }
    if(active){
      const pulse=frac(time*.58);
      ctx.strokeStyle='#83e5ff';ctx.lineWidth=1.2;ctx.globalAlpha=(1-pulse)*(.28+.34*charge);
      ctx.beginPath();ctx.ellipse(0,-10,22+pulse*32,8+pulse*13,0,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
    if(options.label) drawActorLabels(ctx,x,baseY-64*scale,options.label,PLAYER_COLORS.p1,Math.max(.72,scale*.88),alpha,options.defenseReduce);
    return {x,y:baseY,core:{x,y:baseY-12*scale},muzzle:{x,y:baseY-12*scale},scale};
  }

  function createDurabilityStatus(){
    const element=document.createElement('div');
    element.className='battle-enemy-status';
    element.setAttribute('role','group');
    element.setAttribute('aria-label','마왕군단 체력 및 실드');
    element.innerHTML='<strong class="battle-enemy-status-title">마왕군단</strong><div class="battle-enemy-status-metric" data-battle-durability="hp"><span class="battle-enemy-status-label">체력</span><b class="battle-enemy-status-value">0</b><span class="battle-enemy-status-track" aria-hidden="true"><span class="battle-enemy-status-fill"></span></span></div><div class="battle-enemy-status-metric" data-battle-durability="shield"><span class="battle-enemy-status-label">실드</span><b class="battle-enemy-status-value">0</b><span class="battle-enemy-status-track" aria-hidden="true"><span class="battle-enemy-status-fill"></span></span></div>';
    const metric=kind=>{
      const node=element.querySelector(`[data-battle-durability="${kind}"]`);
      return {node,value:node.querySelector('.battle-enemy-status-value'),fill:node.querySelector('.battle-enemy-status-fill')};
    };
    return {element,hp:metric('hp'),shield:metric('shield'),signature:''};
  }
  function updateDurabilityStatus(view,state,theme){
    if(!view||!state) return;
    const hpMax=Math.max(0,number(state.maxHp));
    const shieldMax=Math.max(0,number(state.maxShield));
    const hp=Math.min(hpMax,Math.max(0,number(state.hp)));
    const shield=Math.min(shieldMax,Math.max(0,number(state.shield)));
    const signature=[Math.round(hp),Math.round(hpMax),Math.round(shield),Math.round(shieldMax),theme.hp,theme.shield].join('|');
    if(view.signature===signature) return;
    view.signature=signature;
    view.element.style.setProperty('--battle-enemy-hp',theme.hp);
    view.element.style.setProperty('--battle-enemy-shield',theme.shield);
    const update=(metric,label,value,max)=>{
      const ratio=max>0?clamp(value/max,0,1):0;
      metric.value.textContent=battleNumber(value);
      metric.fill.style.width=`${(ratio*100).toFixed(2)}%`;
      metric.node.classList.toggle('is-depleted',value<=0);
      metric.node.setAttribute('aria-label',`${label} ${battleNumber(value)} / ${battleNumber(max)}`);
    };
    update(view.hp,'체력',hp,hpMax);
    update(view.shield,'실드',shield,shieldMax);
  }

  function recolorSvg(svg,replacements){
    let result=svg;
    Object.entries(replacements).forEach(([source,target])=>{result=result.split(source).join(target);});
    return result;
  }
  function heroSvgWithoutPose(svg){
    const parts=[
      '<path d="M53 112l-24 22 9 14 31-23zm69 1l26 8-5 17-34-12z" fill="url(#dark)" stroke="#5dd4ff" stroke-width="3"/>',
      '<path d="M67 144l22 1-6 48H55zM100 145l20-1 16 49h-29z" fill="url(#dark)" stroke="#54c7ff" stroke-width="3"/>',
      '<path d="M57 169h28v23H47l3-15zm49 0h27l10 23h-38z" fill="#0b1a37" stroke="#58cfff" stroke-width="3"/>'
    ];
    let result=svg;
    parts.forEach(part=>{result=result.replace(part,'');});
    return result.replace(/ {2}<g transform="translate\(127 98\) rotate\(-22\)">[\s\S]*? {2}<\/g>/,'');
  }
  function createAimHeroSvg(svg){
    const base=heroSvgWithoutPose(svg);
    const pose=`
  <path d="M54 106l37 7 12 15-12 14-43-19z" fill="url(#dark)" stroke="#5dd4ff" stroke-width="3"/>
  <path d="M126 105l22 17-10 17-38-17 8-16z" fill="url(#dark)" stroke="#5dd4ff" stroke-width="3"/>
  <g transform="translate(69 96)">
    <path d="M-12 20L7 8l79-3 29 12-29 16H9z" fill="url(#weapon)" stroke="#c8f6ff" stroke-width="3"/>
    <path d="M82 7l28-14 11 8-15 18z" fill="#76e8ff" stroke="#effcff" stroke-width="2"/>
    <path d="M2 12l-24 6 3 15 29-5z" fill="#102a66" stroke="#74dfff" stroke-width="2"/>
    <rect x="31" y="25" width="13" height="22" rx="4" fill="#102a66" stroke="#74dfff" stroke-width="2"/>
    <circle cx="58" cy="18" r="7" fill="url(#core)" filter="url(#glow)"/>
    <circle cx="35" cy="23" r="7" fill="#173b73" stroke="#8be7ff" stroke-width="2"/>
    <circle cx="67" cy="20" r="7" fill="#173b73" stroke="#8be7ff" stroke-width="2"/>
  </g>
  <path d="M66 144l22 2-7 47H55zM101 145l19-1 14 49h-28z" fill="url(#dark)" stroke="#54c7ff" stroke-width="3"/>
  <path d="M58 170h26v22H47l3-14zm49 0h25l10 22h-36z" fill="#0b1a37" stroke="#58cfff" stroke-width="3"/>`;
    return base.replace('</svg>',`${pose}\n</svg>`);
  }
  function createRestHeroSvg(svg){
    const base=heroSvgWithoutPose(svg);
    const pose=`
  <path d="M55 108l30 12 11 11-10 12-38-17z" fill="url(#dark)" stroke="#5dd4ff" stroke-width="3"/>
  <path d="M123 108l18 14-10 16-33-16 9-14z" fill="url(#dark)" stroke="#5dd4ff" stroke-width="3"/>
  <g transform="translate(56 118) rotate(3)">
    <path d="M0 16l19-8 62 1 24 11-25 13H16z" fill="url(#weapon)" stroke="#c8f6ff" stroke-width="3"/>
    <path d="M20 28l13 8 13-8" fill="none" stroke="#74dfff" stroke-width="2"/>
    <circle cx="55" cy="19" r="6" fill="url(#core)" filter="url(#glow)"/>
  </g>
  <path d="M68 143l20 3-9 17-27 12-15-9 26-19z" fill="url(#dark)" stroke="#54c7ff" stroke-width="3"/>
  <path d="M101 145l19-1 18 17-13 14-26-12z" fill="url(#dark)" stroke="#54c7ff" stroke-width="3"/>
  <path d="M45 166l29-9 11 12-31 17-20-5zM126 164l18-3 16 13-10 13-29-8z" fill="#0b1a37" stroke="#58cfff" stroke-width="3"/>
  <path d="M53 181h29l5 10H43zM121 179h30l8 11h-39z" fill="#081329" stroke="#58cfff" stroke-width="3"/>`;
    return base.replace('</svg>',`${pose}\n</svg>`);
  }
  function createSvgImage(svg){
    const image=new Image();
    image.decoding='async';
    image.onload=()=>{if(initialized) queueRefresh();};
    image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return image;
  }
  function isImageReady(image){return Boolean(image&&image.complete&&image.naturalWidth>0);}
  function normalizedData(data={}){
    return {
      dps:number(data.dps),requiredDps:number(data.requiredDps),achievementRate:Math.max(0,number(data.achievementRate)),
      coop:Boolean(data.coop),battleType:data.battleType==='eternal'?'eternal':'classic',unitHidden:Boolean(data.unitHidden),
      selectedUnitCount:Math.max(0,Math.round(number(data.selectedUnitCount))),enemyCount:Math.max(0,number(data.enemyCount)),
      enemyHp:Math.max(0,number(data.enemyHp)),enemyShield:Math.max(0,number(data.enemyShield)),enemyArmor:Math.max(0,number(data.enemyArmor)),
      defenseReduce1:Math.max(0,number(data.defenseReduce1)),defenseReduce2:Math.max(0,number(data.defenseReduce2)),
      defenseReduce3:Math.max(0,number(data.defenseReduce3)),
      artifactUnitSelected:Boolean(data.artifactUnitSelected),artifactPrimarySelected:Boolean(data.artifactPrimarySelected),
      artifactAttackRate:Math.max(0,number(data.artifactAttackRate)),
      artifactWaveInterval:Math.max(0,number(data.artifactWaveInterval))
    };
  }
  function prefersReducedMotion(){return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);}
  function qualityFor(width,height){
    if(prefersReducedMotion()) return .42;
    const pixels=width*height*(window.devicePixelRatio||1);
    if(width<480||pixels>1500000) return .58;
    if(width<800||pixels>850000) return .76;
    return 1;
  }
  function isActuallyVisible(element){
    if(!element||!element.isConnected||element.hidden) return false;
    let node=element;
    while(node&&node.nodeType===1){
      if(node.hidden) return false;
      const style=getComputedStyle(node);
      if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0) return false;
      node=node.parentElement;
    }
    const rect=element.getBoundingClientRect();
    if(rect.width<2||rect.height<2) return false;
    return rect.bottom>=-120&&rect.top<=window.innerHeight+120&&rect.right>=-120&&rect.left<=window.innerWidth+120;
  }

  function unitFlowState(data,now,selectionStartedAt){
    if(data.selectedUnitCount<=0) return {mode:'rest',battleTime:0,showStatus:false,sequenceIndex:0};
    const totalElapsed=Math.max(0,(now-selectionStartedAt)/1000);
    const sequenceIndex=Math.floor(totalElapsed/BATTLE_DURATION);
    const battleTime=totalElapsed-sequenceIndex*BATTLE_DURATION;
    return {mode:'battle',battleTime,showStatus:true,sequenceIndex};
  }

  class BattleScene{
    constructor(stage){
      this.stage=stage;
      this.data=normalizedData();
      this.canvas=document.createElement('canvas');
      this.canvas.className='battle-canvas';
      this.canvas.setAttribute('aria-hidden','true');
      this.viewport=document.createElement('div');
      this.viewport.className='battle-canvas-viewport';
      this.viewport.appendChild(this.canvas);
      this.shell=document.createElement('div');
      this.shell.className='battle-canvas-shell has-enemy-status';
      this.status=createDurabilityStatus();
      this.status.element.hidden=true;
      this.shell.append(this.status.element,this.viewport);
      this.runtime={signature:'',cycleIndex:null,maxHp:0,maxShield:0,hp:0,shield:0,appliedDamage:0,defeatedAt:Array(10).fill(-1)};
      this.selectionSignature='';
      this.selectionStartedAt=performance.now();
      this.dialogueSignature='';
      this.dialogueStartedAt=performance.now();
      this.statusVisible=false;
      stage.replaceChildren(this.shell);
      this.ctx=this.canvas.getContext('2d',{alpha:true,desynchronized:true});
      this.width=0;
      this.height=0;
      this.dpr=1;
      this.resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(()=>this.resize(true)):null;
      this.resizeObserver?.observe(stage);
      this.resize(true);
    }
    setData(data){
      const selected=data.selectedUnitCount>0;
      const signature=selected
        ?[data.coop?'coop':'solo',data.battleType,data.selectedUnitCount,data.artifactPrimarySelected?1:0,data.artifactUnitSelected?1:0].join('|')
        :'';
      if(signature!==this.selectionSignature){
        this.selectionSignature=signature;
        this.selectionStartedAt=performance.now();
        resetCombatRuntime(this.runtime,data,null);
      }
      this.data=data;
      const dialogueSignature=`${selected?'active':'idle'}|${data.coop?'coop':'solo'}|${data.battleType}`;
      if(dialogueSignature!==this.dialogueSignature){
        this.dialogueSignature=dialogueSignature;
        this.dialogueStartedAt=performance.now();
      }
    }
    setStatusVisible(visible){
      if(visible===this.statusVisible) return;
      this.statusVisible=visible;
      this.status.element.hidden=!visible;
      this.shell.classList.toggle('show-enemy-status',visible);
    }
    resize(force=false){
      const rect=this.viewport.getBoundingClientRect();
      const width=Math.max(1,Math.round(rect.width||this.stage.clientWidth||1));
      const height=Math.max(1,Math.round(rect.height||this.stage.clientHeight||1));
      const maxDpr=width<600?1.55:2;
      const dpr=clamp(window.devicePixelRatio||1,1,maxDpr);
      if(!force&&width===this.width&&height===this.height&&dpr===this.dpr) return;
      this.width=width;this.height=height;this.dpr=dpr;
      this.canvas.width=Math.round(width*dpr);
      this.canvas.height=Math.round(height*dpr);
      this.canvas.style.width=`${width}px`;
      this.canvas.style.height=`${height}px`;
      this.ctx.setTransform(dpr,0,0,dpr,0,0);
      this.ctx.imageSmoothingEnabled=true;
      this.ctx.imageSmoothingQuality='high';
    }
    draw(now){
      if(paused||!isActuallyVisible(this.stage)) return;
      const flow=unitFlowState(this.data,now,this.selectionStartedAt);
      this.setStatusVisible(flow.showStatus);
      this.resize();
      this.ctx.clearRect(0,0,this.width,this.height);
      const dialogueTime=Math.max(0,(now-this.dialogueStartedAt)/1000);
      const durability=drawUnitBoardScene(this.ctx,this.width,this.height,this.data,now,dialogueTime,this.runtime,flow);
      if(flow.showStatus) updateDurabilityStatus(this.status,durability,themeFor(this.data.battleType));
    }
  }

  /* 유닛 보드 장면 */

  function drawUnitBoardScene(ctx,width,height,data,now,dialogueTime,runtime,flow){
    const quality=qualityFor(width,height);
    if(flow.mode==='rest'){
      const durability=resetCombatRuntime(runtime,data,null);
      drawRestScene(ctx,width,height,data,themeFor(data.battleType),now/1000,quality,dialogueTime);
      return durability;
    }
    return drawCombatScene(ctx,width,height,data,flow.battleTime,quality,runtime,flow.sequenceIndex);
  }

  function drawRestScene(ctx,width,height,data,theme,time,quality,dialogueTime){
    drawRestSky(ctx,width,height,theme,time,quality);
    const ground=ctx.createLinearGradient(0,height*.54,0,height);
    ground.addColorStop(0,'rgba(25,20,18,.24)');
    ground.addColorStop(1,'rgba(5,4,5,.98)');
    ctx.fillStyle=ground;
    ctx.fillRect(0,height*.52,width,height*.48);
    drawDistantCastleSilhouette(ctx,width,height,time);
    drawCampSupplies(ctx,width,height,theme,time);
    const fire={x:width*.51,y:height*.84};
    const base=Math.min(width/430,height/150);
    const heroes=data.coop?[
      {key:'hero',x:width*.28,y:height*.89,scale:base*.82,color:PLAYER_COLORS.p1,label:'나',main:true,phase:.1},
      {key:'p2',x:width*.13,y:height*.91,scale:base*.50,color:PLAYER_COLORS.p2,label:'2P',phase:1.7},
      {key:'p3',x:width*.43,y:height*.92,scale:base*.52,color:PLAYER_COLORS.p3,label:'3P',phase:3.0}
    ]:[
      {key:'hero',x:width*.27,y:height*.90,scale:base*.90,color:PLAYER_COLORS.p1,label:'나',main:true,phase:.1}
    ];
    const anchors={};
    const charge=35+Math.round(frac(dialogueTime/21)*65);
    heroes.slice().sort((a,b)=>a.y-b.y).forEach(hero=>{
      drawRestingHero(ctx,hero.x,hero.y,hero.scale,hero.color,{time:time+hero.phase,label:hero.label,main:hero.main,fireX:fire.x});
      anchors[hero.key]={x:hero.x,y:hero.y-88*hero.scale};
    });
    const relic=drawRelic(ctx,width*.76,height*.88,base*.66,{time:time*.82,label:'유물',active:true,charge:charge/100});
    anchors.artifact={x:relic.core.x,y:relic.core.y-8*base};
    drawCampfire(ctx,fire.x,fire.y,Math.max(12,20*base),time,quality);
    drawCampEnergy(ctx,fire.x,fire.y,Math.max(12,20*base),theme,time,quality,data.coop);
    const dialogue=activeDialogue(dialogueTime,data.coop?COOP_REST_DIALOGUES:SOLO_REST_DIALOGUES,{lineInterval:3.45,visibleDuration:2.8,pauseDuration:3.4});
    if(dialogue){
      const item=dialogue.item;
      const anchor=anchors[item.speaker];
      if(anchor){
        const text=item.text.replace('{charge}',String(charge));
        const color=item.speaker==='p2'?PLAYER_COLORS.p2:item.speaker==='p3'?PLAYER_COLORS.p3:PLAYER_COLORS.p1;
        drawDialogueBubble(ctx,width,height,text,anchor,theme,{alpha:dialogue.alpha,accent:item.speaker==='artifact'?theme.shield:color.main,artifact:item.speaker==='artifact',offsetX:anchor.x<width*.5?width*.10:-width*.10,offsetY:-24});
      }
    }
    drawSceneVignette(ctx,width,height);
  }
  function drawDistantCastleSilhouette(ctx,width,height,time){
    const x=width*.82,y=height*.34,w=width*.17,h=height*.40;
    ctx.save();
    ctx.globalAlpha=.36;
    ctx.fillStyle='rgba(5,4,7,.98)';
    ctx.fillRect(x-w*.50,y,w,h);
    for(const offset of [-.38,0,.38]){
      ctx.beginPath();
      ctx.moveTo(x+w*offset-w*.12,y);
      ctx.lineTo(x+w*offset,y-h*.17);
      ctx.lineTo(x+w*offset+w*.12,y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle='rgba(183,65,64,.28)';
    roundRect(ctx,x-w*.055,y+h*.57,w*.11,h*.27,w*.04);
    ctx.globalAlpha=.72+.10*Math.sin(time*1.1);
    ctx.fill();
    ctx.restore();
  }
  function drawCampSupplies(ctx,width,height,theme,time){
    ctx.save();
    ctx.fillStyle='rgba(12,18,29,.92)';ctx.strokeStyle=rgba(theme.castleEdge,.44);ctx.lineWidth=1;
    roundRect(ctx,width*.05,height*.72,width*.12,height*.15,5);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(width*.80,height*.86);ctx.lineTo(width*.88,height*.57);ctx.lineTo(width*.96,height*.86);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle=rgba(theme.route,.22);ctx.beginPath();ctx.moveTo(width*.82,height*.82);ctx.lineTo(width*.94,height*.82);ctx.stroke();
    ctx.globalAlpha=.20+.06*Math.sin(time*1.4);ctx.fillStyle=theme.bossLight;ctx.fillRect(width*.865,height*.64,width*.012,height*.15);ctx.restore();
  }
  function drawCampfire(ctx,x,y,size,time,quality){
    ctx.save();ctx.lineCap='round';ctx.strokeStyle='#4d2b20';ctx.lineWidth=Math.max(3,size*.20);ctx.beginPath();ctx.moveTo(x-size*.62,y+size*.18);ctx.lineTo(x+size*.62,y+size*.35);ctx.moveTo(x+size*.62,y+size*.18);ctx.lineTo(x-size*.62,y+size*.35);ctx.stroke();
    const glow=ctx.createRadialGradient(x,y-size*.35,1,x,y-size*.35,size*3.2);glow.addColorStop(0,'rgba(255,220,120,.36)');glow.addColorStop(.35,'rgba(255,112,54,.16)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(x-size*3.2,y-size*3.2,size*6.4,size*4.2);
    const flames=Math.max(4,Math.round(7*quality));ctx.globalCompositeOperation='lighter';
    for(let i=0;i<flames;i++){const phase=time*(2.2+i*.17)+i*1.3,fx=x+(i-(flames-1)/2)*size*.13+Math.sin(phase)*size*.08,fy=y-size*(.18+.18*Math.sin(phase*.73+i)),r=size*(.20+.05*(i%3));const g=ctx.createRadialGradient(fx,fy,1,fx,fy,r*2.4);g.addColorStop(0,'#fff7c7');g.addColorStop(.34,i%2?'#ffbd4a':'#ff7a3d');g.addColorStop(1,'rgba(255,57,46,0)');ctx.fillStyle=g;ctx.globalAlpha=.62+.20*Math.sin(phase);ctx.beginPath();ctx.ellipse(fx,fy,r,r*1.8,Math.sin(phase)*.12,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
  function drawCampEnergy(ctx,x,y,size,theme,time,quality,coop){
    const count=Math.max(5,Math.round(10*quality));ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=0;i<count;i++){const life=frac(time*.11+i/count),a=hash(i+3)*Math.PI*2,r=size*(.9+life*2.1),px=x+Math.cos(a)*r,py=y-size*.45-life*size*2.2;ctx.globalAlpha=(1-life)*.28;ctx.fillStyle=i%3===0&&coop?PLAYER_COLORS.p2.main:i%3===1&&coop?PLAYER_COLORS.p3.main:theme.shield;ctx.beginPath();ctx.arc(px,py,.7+hash(i)*1.1,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle=theme.shield;ctx.globalAlpha=.12+.04*Math.sin(time*1.6);ctx.beginPath();ctx.ellipse(x,y-size*.10,size*2.3,size*.56,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  function drawRestingHero(ctx,x,y,scale,color,options){
    const breathe=1+Math.sin(options.time*.92)*.006;
    const image=color===PLAYER_COLORS.p2?art.heroRestP2:color===PLAYER_COLORS.p3?art.heroRestP3:art.heroRestP1;
    const width=104*scale*(options.main?1.08:1),height=108*scale*(options.main?1.08:1);
    drawCampSeat(ctx,x,y,scale,color,options.main);
    drawGroundGlow(ctx,x,y+2,35*scale,color.glow,options.main?.18:.11);
    ctx.save();
    const fireSide=options.fireX===undefined?1:(options.fireX>x?1:-1);
    ctx.translate(x,y-2);
    ctx.scale(fireSide,breathe);
    ctx.globalAlpha=1;
    if(isImageReady(image)) ctx.drawImage(image,-width/2,-height,width,height);
    ctx.restore();
    const coreY=y-height*.54;
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    const coreGlow=ctx.createRadialGradient(x,coreY,1,x,coreY,16*scale);
    coreGlow.addColorStop(0,rgba(color.light,.24+.08*Math.sin(options.time*1.3)));
    coreGlow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=coreGlow;
    ctx.fillRect(x-18*scale,coreY-18*scale,36*scale,36*scale);
    ctx.restore();
    drawPlayerLabel(ctx,x,y-height-8,options.label,color,scale,1);
  }
  function drawCampSeat(ctx,x,y,scale,color,main){
    ctx.save();
    ctx.fillStyle='rgba(13,18,28,.96)';
    ctx.strokeStyle=rgba(color.main,main?.28:.18);
    ctx.lineWidth=1;
    roundRect(ctx,x-27*scale,y-13*scale,54*scale,14*scale,6*scale);
    ctx.fill();ctx.stroke();
    ctx.fillStyle='rgba(5,8,13,.92)';
    ctx.fillRect(x-20*scale,y-1*scale,7*scale,8*scale);
    ctx.fillRect(x+13*scale,y-1*scale,7*scale,8*scale);
    ctx.restore();
  }

  function drawRestSky(ctx,width,height,theme,time,quality){
    ctx.fillStyle=linearGradient(ctx,0,0,0,height,[[0,theme.skyTop],[.48,theme.skyBottom],[.78,theme.ground],[1,'#050406']]);
    ctx.fillRect(0,0,width,height);
    const celestialX=width*.22,celestialY=height*.22,celestialR=clamp(Math.min(width,height)*.095,12,38);
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.fillStyle=radialGradient(ctx,celestialX,celestialY,1,celestialX,celestialY,celestialR*2.8,[[0,rgba(theme.bossLight,.18)],[.36,rgba(theme.bossLight,.08)],[1,'rgba(0,0,0,0)']]);
    ctx.fillRect(celestialX-celestialR*2.8,celestialY-celestialR*2.8,celestialR*5.6,celestialR*5.6);
    ctx.globalCompositeOperation='source-over';
    ctx.fillStyle=linearGradient(ctx,celestialX-celestialR,celestialY-celestialR,celestialX+celestialR,celestialY+celestialR,[[0,'#4c3043'],[.48,'#1b101d'],[1,'#07060a']]);
    ctx.beginPath();ctx.arc(celestialX,celestialY,celestialR,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=rgba(theme.bossLight,.46);ctx.lineWidth=Math.max(1,celestialR*.07);ctx.globalAlpha=.72+.12*Math.sin(time*.55);
    ctx.beginPath();ctx.arc(celestialX,celestialY,celestialR*1.04,Math.PI*.14,Math.PI*1.86);ctx.stroke();
    ctx.restore();

    ctx.save();
    const cloudCount=Math.max(5,Math.round(9*quality));
    for(let i=0;i<cloudCount;i++){
      const x=(frac(hash(i+14)+time*(.0022+.0006*(i%3)))-.20)*width;
      const y=height*(.07+hash(i+44)*.42);
      const rx=width*(.11+hash(i+71)*.13),ry=height*(.045+hash(i+92)*.065);
      ctx.fillStyle=radialGradient(ctx,x,y,1,x,y,rx,[[0,i%3===0?rgba(theme.bossLight,.075):'rgba(86,75,91,.13)'],[.58,'rgba(31,27,36,.10)'],[1,'rgba(0,0,0,0)']]);
      ctx.globalAlpha=.76;ctx.beginPath();ctx.ellipse(x,y,rx,ry,-.08,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    for(let i=0;i<4;i++){
      const x=width*(.48+i*.11),beamW=width*(.045+i*.006);
      const beam=ctx.createLinearGradient(x,height*.05,x+beamW,height*.66);
      beam.addColorStop(0,'rgba(0,0,0,0)');beam.addColorStop(.45,rgba(theme.bossLight,.026));beam.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=beam;fillPolygon(ctx,[[x,height*.02],[x+beamW,height*.02],[x+beamW*.35,height*.70],[x-beamW*.16,height*.70]],beam);
    }
    ctx.restore();

    ctx.save();
    const layers=[
      {count:12,base:.70,peak:.42,spread:.11,fill:'rgba(7,6,10,.84)',seed:12},
      {count:10,base:.735,peak:.50,spread:.085,fill:rgba(theme.castleEdge,.19),seed:66},
      {count:8,base:.76,peak:.59,spread:.055,fill:'rgba(30,23,30,.28)',seed:104}
    ];
    for(const layer of layers){
      ctx.fillStyle=layer.fill;ctx.beginPath();ctx.moveTo(0,height*layer.base);
      for(let i=0;i<=layer.count;i++) ctx.lineTo(width*i/layer.count,height*(layer.peak-layer.spread*hash(i+layer.seed)));
      ctx.lineTo(width,height*.81);ctx.lineTo(0,height*.81);ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }

  function drawSceneVignette(ctx,width,height){
    const vignette=ctx.createRadialGradient(width*.50,height*.56,height*.16,width*.50,height*.56,width*.70);
    vignette.addColorStop(0,'rgba(0,0,0,0)');
    vignette.addColorStop(.70,'rgba(0,0,0,.11)');
    vignette.addColorStop(1,'rgba(0,0,0,.48)');
    ctx.fillStyle=vignette;
    ctx.fillRect(0,0,width,height);
    const lower=ctx.createLinearGradient(0,height*.72,0,height);
    lower.addColorStop(0,'rgba(0,0,0,0)');
    lower.addColorStop(1,'rgba(0,0,0,.30)');
    ctx.fillStyle=lower;
    ctx.fillRect(0,height*.70,width,height*.30);
  }

  /* 성 내부 전투 */
  function combatRuntimeSignature(data){
    return [data.enemyHp,data.enemyShield,data.dps,data.requiredDps,data.achievementRate,data.selectedUnitCount,data.coop?1:0,data.artifactPrimarySelected?1:0,data.artifactUnitSelected?1:0].join('|');
  }
  function resetCombatRuntime(runtime,data,cycleIndex=null){
    runtime.signature=combatRuntimeSignature(data);
    runtime.cycleIndex=cycleIndex;
    runtime.maxHp=Math.max(0,number(data.enemyHp));
    runtime.maxShield=Math.max(0,number(data.enemyShield));
    runtime.hp=runtime.maxHp;
    runtime.shield=runtime.maxShield;
    runtime.appliedDamage=0;
    runtime.defeatedAt=Array(10).fill(-1);
    return runtime;
  }
  function applyCombatDamage(runtime,damage){
    let remaining=Math.max(0,number(damage));
    if(remaining<=0) return;
    const shieldDamage=Math.min(runtime.shield,remaining);
    runtime.shield=Math.max(0,runtime.shield-shieldDamage);
    remaining-=shieldDamage;
    if(remaining>0) runtime.hp=Math.max(0,runtime.hp-remaining);
  }
  function battleDamageUnits(runtime){
    if(runtime.maxHp<=0) return runtime.shield<=0?10:0;
    return clamp((1-clamp(runtime.hp/runtime.maxHp,0,1))*10,0,10);
  }
  function updateDefeatTimestamps(runtime,time){
    const damageUnits=battleDamageUnits(runtime);
    const defeatedCount=runtime.hp<=0?10:Math.min(9,Math.floor(damageUnits+1e-7));
    for(let index=0;index<defeatedCount;index++){
      if(runtime.defeatedAt[index]<0) runtime.defeatedAt[index]=time;
    }
  }
  function syncCombatRuntime(runtime,data,model,time){
    const signature=combatRuntimeSignature(data);
    if(runtime.signature!==signature||runtime.cycleIndex!==model.cycleIndex) resetCombatRuntime(runtime,data,model.cycleIndex);
    const total=runtime.maxHp+runtime.maxShield;
    if(total<=0){
      runtime.hp=0;
      runtime.shield=0;
      updateDefeatTimestamps(runtime,time);
      return runtime;
    }
    const targetDamage=total*clamp(model.rate/100,0,1);
    const desiredDamage=targetDamage*model.attackProgress;
    const pendingDamage=Math.max(0,desiredDamage-runtime.appliedDamage);
    if(pendingDamage>0){
      applyCombatDamage(runtime,pendingDamage);
      runtime.appliedDamage=desiredDamage;
      updateDefeatTimestamps(runtime,time);
    }
    return runtime;
  }

  function drawCombatScene(ctx,width,height,data,time,quality,runtime,sequenceIndex=0){
    const theme=themeFor(data.battleType);
    const model=buildBattleModel(data,time,sequenceIndex);
    const durability=syncCombatRuntime(runtime,data,model,time);
    syncBattleEntities(model,data,durability,time);
    drawCastleInterior(ctx,width,height,data,theme,time,quality);
    drawWave(ctx,width,height,data,theme,model,time,quality);
    if(data.coop) drawCoopSupport(ctx,width,height,data,time);
    if(data.artifactPrimarySelected){
      const relic=drawDefenseRelic(ctx,width,height,data,model,time);
      drawArtifactAttack(ctx,width,height,data,theme,model,relic,time,quality);
    }else{
      const hero=drawDefenseHero(ctx,width,height,data,model,time);
      drawHeroAttack(ctx,width,height,theme,model,hero,quality);
      if(data.artifactUnitSelected){
        const base=Math.min(width/440,height/210);
        drawArtifactAttack(ctx,width,height,data,theme,model,{core:{x:hero.x,y:hero.y-48*base}},time,quality);
      }
    }
    drawInteriorForeground(ctx,width,height);
    if(model.resultVisible) drawBattleResult(ctx,width,height,theme,model,time);
    return durability;
  }

  function buildBattleModel(data,time,sequenceIndex=0){
    const minionCount=9;
    const rate=Math.max(0,data.achievementRate);
    const cycleDuration=BATTLE_DURATION;
    const cycleIndex=Math.max(0,Math.floor(sequenceIndex));
    const phase=clamp(time/cycleDuration,0,1);
    const attackStart=.12+clamp(data.enemyArmor/700,0,.06);
    const attackEnd=.72;
    const attackProgress=smooth(clamp((phase-attackStart)/Math.max(.24,attackEnd-attackStart),0,1));
    const fireRate=1.6+clamp(rate,0,180)/92;
    const artifactTempo=buildArtifactTempo(data,rate);
    const resultKind=rate>=100?'clear':rate<50?'fail':'reinforce';
    return {
      minionCount,entries:[],bossState:null,target:null,rate,phase,attackProgress,spawnCorner:cycleIndex%4,
      fireCycle:frac(time*fireRate),fireRate,cycleDuration,cycleIndex,artifactTempo,
      resultVisible:false,resultKind,resultMessage:battleResultMessage(resultKind,data),resultAlpha:0
    };
  }
  function syncBattleEntities(model,data,runtime,time){
    const totalEntities=model.minionCount+1;
    const damageUnits=battleDamageUnits(runtime);
    const shieldRatio=runtime.maxShield>0?clamp(runtime.shield/runtime.maxShield,0,1):0;
    const spawnGap=data.coop?.025:.046;
    const entities=[];
    for(let index=0;index<totalEntities;index++){
      const spawnTime=index*spawnGap;
      const defeatedAt=runtime.defeatedAt[index]??-1;
      const durability=battleEntityDurability(index,damageUnits,shieldRatio,defeatedAt,time);
      const spawned=model.phase>=spawnTime||durability.dead;
      const motion=spawned?clamp((model.phase-spawnTime)/Math.max(.01,.90-spawnTime),0,1):0;
      const route=armyPathState(motion,data.coop,model.spawnCorner);
      entities.push({...durability,spawned,index,point:route.point,angle:route.angle});
    }
    model.entries=entities.slice(0,model.minionCount);
    model.bossState=entities[model.minionCount];
    const target=entities.find(item=>item.spawned&&!item.dead)||null;
    model.target=target?{kind:target.index===model.minionCount?'boss':'minion',state:target,point:target.point,index:target.index}:null;
    model.resultVisible=model.phase>=RESULT_START_PHASE&&model.phase<=RESULT_END_PHASE&&(model.resultKind!=='clear'||model.bossState.dead);
    model.resultAlpha=smooth(clamp((model.phase-RESULT_START_PHASE)/.04,0,1))*(1-smooth(clamp((model.phase-RESULT_FADE_OUT_PHASE)/(RESULT_END_PHASE-RESULT_FADE_OUT_PHASE),0,1)));
    return model;
  }
  function battleEntityDurability(index,damageUnits,shieldRatio,defeatedAt,time){
    if(shieldRatio>0) return {dead:false,shield:shieldRatio,hp:1,deathAge:-1};
    const local=damageUnits-index;
    if(local>=1-1e-7){
      const deathAge=defeatedAt>=0?Math.max(0,time-defeatedAt):1;
      return {dead:true,shield:0,hp:0,deathAge};
    }
    if(local<=0) return {dead:false,shield:0,hp:1,deathAge:-1};
    return {dead:false,shield:0,hp:clamp(1-local,0,1),deathAge:-1};
  }

  function buildArtifactTempo(data,rate){
    const actualRate=Math.max(0,number(data.artifactAttackRate));
    const actualInterval=Math.max(.001,number(data.artifactWaveInterval)||0);
    const dps=Math.max(0,number(data.dps));
    const required=Math.max(1,number(data.requiredDps)||dps||1);
    const efficiency=clamp(dps/required,.35,6);
    const rateFactor=clamp(rate/100,0,3);
    const castFactor=actualRate>0 ? clamp(actualRate,.15,8) : (actualInterval>0 ? clamp(1/actualInterval,.15,8) : .6+rateFactor*.45);
    const interval=actualInterval>0 ? actualInterval : 1/castFactor;
    return {
      interval,
      sustain:clamp(.72+Math.log1p(castFactor)*.38+efficiency*.06,.72,2.0),
      ringCount:castFactor>=3?3:castFactor>=1.45?2:1,
      impactRadius:18+Math.min(18,castFactor*5.5),
      intensity:clamp(.68+Math.log1p(castFactor)*.22+efficiency*.05,.68,1.35)
    };
  }
  function battleResultMessage(kind,data){
    const rate=Math.max(0,number(data.achievementRate));
    if(kind==='reinforce'&&data.coop){
      if(data.defenseReduce2<=0&&data.defenseReduce3<=0) return '승객의 방어력 감소를 추가해야 할지도 몰라.';
      if(data.defenseReduce2<=0) return '빨강이의 방어력 감소 지원을 보강해보자.';
      if(data.defenseReduce3<=0) return '하얀이의 방어력 감소 지원을 보강해보자.';
    }
    return rate<50?RESULT_MESSAGES.critical:rate<85?RESULT_MESSAGES.reinforce:rate<100?RESULT_MESSAGES.near:rate<150?RESULT_MESSAGES.clear:RESULT_MESSAGES.surplus;
  }
  function armyPathState(progress,coop,cornerIndex=0){
    const points=coop?COOP_ARMY_ROUTE:SOLO_ARMY_ROUTE;
    const segmentCount=coop?points.length-1:points.length;
    const scaled=coop?clamp(progress,0,1)*segmentCount:frac(progress+cornerIndex/segmentCount)*segmentCount;
    const segment=Math.min(segmentCount-1,Math.floor(scaled));
    const local=scaled-segment;
    const [fromX,fromY]=points[segment];
    const [toX,toY]=points[(segment+1)%points.length];
    return {point:{x:lerp(fromX,toX,local),y:lerp(fromY,toY,local)},angle:Math.atan2(toY-fromY,toX-fromX)};
  }
  function drawArmyRoute(ctx,width,height,coop,theme){
    const points=coop?COOP_ARMY_ROUTE:SOLO_ARMY_ROUTE;
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
    points.forEach(([x,y],index)=>index?ctx.lineTo(x*width,y*height):ctx.moveTo(x*width,y*height));
    if(!coop) ctx.closePath();
    for(const [stroke,lineWidth] of [['rgba(14,10,9,.72)',Math.max(4,Math.min(width,height)*.018)],[rgba(theme.route,.34),Math.max(1.2,Math.min(width,height)*.0055)]]){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();}
    ctx.restore();
  }

  function drawCastleInterior(ctx,width,height,data,theme,time,quality){
    ctx.fillStyle=linearGradient(ctx,0,0,0,height,[[0,'#211c1b'],[.52,'#100d0d'],[1,'#050404']]);ctx.fillRect(0,0,width,height);
    drawInteriorRearArch(ctx,width,height);
    drawStoneCourses(ctx,0,0,width,height*.61,Math.max(22,height/8),Math.max(58,width/12),'rgba(151,129,109,.13)',2,8,0);
    drawInteriorBannersAndChains(ctx,width,height,time);
    drawInteriorFloor(ctx,width,height);
    drawArmyRoute(ctx,width,height,data.coop,theme);
    drawInteriorColumns(ctx,width,height);
    for(const side of [-1,1]){
      const x=width*.5+side*width*.39,y=height*.60;
      ctx.save();
      fillPolygon(ctx,[[x-10,y],[x+10,y],[x+7,y+16],[x-7,y+16]],'#4a3c32','#8c715d',.8);
      ctx.fillStyle=radialGradient(ctx,x,y-7,1,x,y-7,46,[[0,'rgba(255,190,92,.40)'],[.48,'rgba(188,72,42,.15)'],[1,'rgba(0,0,0,0)']]);ctx.fillRect(x-46,y-52,92,92);
      const flames=Math.max(3,Math.round(5*quality));
      for(let i=0;i<flames;i++){
        const pulse=time*(2+i*.18)+i,fx=x+(i-(flames-1)/2)*2.1,fy=y-6-Math.abs(Math.sin(pulse))*8;
        ctx.fillStyle=i%2?'#ffc061':'#d85b37';ctx.globalAlpha=.52+.20*Math.sin(pulse);ctx.beginPath();ctx.ellipse(fx,fy,2.5,7,Math.sin(pulse)*.13,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
    drawWallCracks(ctx,width,height,time,quality);
    drawFloatingAsh(ctx,width,height,theme,time,quality);
  }

  function drawInteriorRearArch(ctx,width,height){
    const cx=width*.52,top=height*.055,outerW=Math.min(width*.36,310),outerH=height*.56;
    ctx.save();
    ctx.fillStyle=radialGradient(ctx,cx,top+outerH*.58,4,cx,top+outerH*.58,outerW*.86,[[0,'rgba(85,36,29,.16)'],[.62,'rgba(20,14,13,.09)'],[1,'rgba(0,0,0,0)']]);ctx.fillRect(cx-outerW,0,outerW*2,outerH*1.36);
    ctx.fillStyle='#4a4038';ctx.strokeStyle='rgba(161,137,114,.48)';ctx.lineWidth=2.2;
    ctx.beginPath();ctx.moveTo(cx-outerW/2,top+outerH);ctx.lineTo(cx-outerW/2,top+outerH*.40);ctx.quadraticCurveTo(cx,top-outerH*.20,cx+outerW/2,top+outerH*.40);ctx.lineTo(cx+outerW/2,top+outerH);ctx.closePath();ctx.fill();ctx.stroke();
    const innerW=outerW*.67,innerTop=top+outerH*.12;
    ctx.fillStyle=linearGradient(ctx,0,innerTop,0,top+outerH,[[0,'#271619'],[.52,'#130b0c'],[1,'#050303']]);
    ctx.beginPath();ctx.moveTo(cx-innerW/2,top+outerH*.90);ctx.lineTo(cx-innerW/2,innerTop+outerH*.30);ctx.quadraticCurveTo(cx,innerTop-outerH*.18,cx+innerW/2,innerTop+outerH*.30);ctx.lineTo(cx+innerW/2,top+outerH*.90);ctx.closePath();ctx.fill();
    const throneY=top+outerH*.66;
    for(let step=0;step<3;step++){
      const stepW=innerW*(.72-step*.12),stepH=outerH*.045;
      ctx.fillStyle=step%2?'#342a25':'#41352d';ctx.fillRect(cx-stepW/2,throneY+step*stepH,stepW,stepH);
    }
    const seatW=innerW*.32,seatH=outerH*.24;
    fillPolygon(ctx,[[cx-seatW*.50,throneY-seatH*.48],[cx-seatW*.30,throneY-seatH],[cx,throneY-seatH*.72],[cx+seatW*.30,throneY-seatH],[cx+seatW*.50,throneY-seatH*.48],[cx+seatW*.42,throneY],[cx-seatW*.42,throneY]],'#3d2625','rgba(151,83,67,.48)',1.2);
    ctx.fillStyle=radialGradient(ctx,cx,throneY-seatH*.50,2,cx,throneY-seatH*.50,seatW*.82,[[0,'rgba(137,43,48,.22)'],[1,'rgba(0,0,0,0)']]);ctx.fillRect(cx-seatW,throneY-seatH*1.25,seatW*2,seatH*1.5);
    ctx.restore();
  }
  function drawInteriorBannersAndChains(ctx,width,height,time){
    for(const x of [width*.15,width*.85]) drawHangingDecor(ctx,'chain',x,height*.02,7,height*.066,'rgba(104,91,91,.48)');
    for(const side of [-1,1]) drawHangingDecor(ctx,'banner',width*.5+side*width*.31,height*.10,width*.060,height*.31,side,time,side<0?'rgba(92,21,42,.82)':'rgba(113,24,43,.82)');
  }

  function drawInteriorFloor(ctx,width,height){
    const horizon=height*.56;
    ctx.fillStyle=linearGradient(ctx,0,horizon,0,height,[[0,'#282220'],[.45,'#171313'],[1,'#080606']]);ctx.fillRect(0,height*.52,width,height*.48);
    ctx.save();ctx.strokeStyle='rgba(132,112,94,.22)';ctx.lineWidth=1;
    const rows=6;
    for(let row=0;row<rows;row++){
      const t0=row/rows,t1=(row+1)/rows,y0=lerp(horizon,height,Math.pow(t0,1.22)),y1=lerp(horizon,height,Math.pow(t1,1.22));
      ctx.beginPath();ctx.moveTo(0,y0+(hash(row+201)-.5)*3);ctx.lineTo(width,y0+(hash(row+217)-.5)*3);ctx.stroke();
      const blocks=5+row*2,offset=row%2?.5:0;
      for(let col=0;col<=blocks;col++){
        const ratio=(col+offset)/blocks,x=ratio*width+(hash(row*31+col+250)-.5)*9;
        ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x+(hash(row*43+col+300)-.5)*14,y1);ctx.stroke();
      }
    }
    ctx.strokeStyle='rgba(119,54,42,.24)';
    for(let i=0;i<7;i++){
      let x=width*(.10+hash(i+330)*.80),y=height*(.62+hash(i+360)*.28);ctx.beginPath();ctx.moveTo(x,y);
      for(let k=0;k<3;k++){x+=(hash(i*9+k+390)-.5)*24;y+=6+hash(i*7+k+420)*9;ctx.lineTo(x,y);}ctx.stroke();
    }
    ctx.restore();
  }

  function drawInteriorColumns(ctx,width,height){
    const columns=[.06,.235,.765,.94];
    ctx.save();
    columns.forEach((ratio,index)=>{
      const x=width*ratio,near=index===0||index===3,shaftW=Math.max(18,width*(near?.040:.033));
      const top=height*(near?.015:.075),floorY=height*.78,baseW=shaftW*(near?2.2:1.95),baseH=height*(near?.075:.064);
      ctx.fillStyle=radialGradient(ctx,x,floorY+baseH*.18,2,x,floorY+baseH*.18,baseW*.95,[[0,'rgba(0,0,0,.66)'],[1,'rgba(0,0,0,0)']]);ctx.beginPath();ctx.ellipse(x,floorY+baseH*.23,baseW*.95,baseH*.40,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=linearGradient(ctx,x-shaftW,0,x+shaftW,0,[[0,'#171311'],[.22,'#5b5045'],[.52,'#332d28'],[.8,'#4a4038'],[1,'#120f0e']]);ctx.fillRect(x-shaftW/2,top,shaftW,floorY-top);
      ctx.fillStyle='#615448';ctx.fillRect(x-shaftW*.78,top,shaftW*1.56,height*.038);ctx.fillRect(x-shaftW*.66,top+height*.04,shaftW*1.32,height*.025);
      ctx.fillStyle=linearGradient(ctx,x-baseW/2,0,x+baseW/2,0,[[0,'#15110f'],[.34,'#66574a'],[.58,'#39312b'],[1,'#120e0d']]);
      for(const [scale,yOffset,hScale] of [[.84,-.25,.32],[1.04,.02,.30],[1.24,.28,.22]]) ctx.fillRect(x-baseW*scale/2,floorY+baseH*yOffset,baseW*scale,baseH*hScale);
      ctx.strokeStyle='rgba(151,129,107,.18)';ctx.lineWidth=1;
      for(let y=top+height*.10;y<floorY-height*.04;y+=height*.11){ctx.beginPath();ctx.moveTo(x-shaftW*.46,y);ctx.lineTo(x+shaftW*.46,y+(hash(index*17+y)-.5)*2);ctx.stroke();}
    });
    ctx.restore();
  }

  function drawWallCracks(ctx,width,height,time,quality){
    const count=Math.max(4,Math.round(8*quality));ctx.save();ctx.strokeStyle='rgba(119,67,52,.34)';ctx.lineWidth=1;
    for(let i=0;i<count;i++){
      let x=width*(.06+hash(i+11)*.88),y=height*(.10+hash(i+29)*.43);ctx.globalAlpha=.18+.05*Math.sin(time*.6+i);ctx.beginPath();ctx.moveTo(x,y);
      for(let step=0;step<4;step++){x+=(hash(i*10+step)-.5)*18;y+=7+hash(i*13+step)*9;ctx.lineTo(x,y);}ctx.stroke();
    }
    ctx.restore();
  }
  function drawFloatingAsh(ctx,width,height,theme,time,quality){
    const count=Math.round(22*quality);ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=0;i<count;i++){
      const x=frac(hash(i+80)+time*(.004+.003*(i%4)))*width,y=height*(.95-frac(hash(i+33)+time*(.025+.009*(i%3)))*.85);
      ctx.globalAlpha=.08+.18*hash(i+121);ctx.fillStyle=i%3?theme.bossLight:'#f3a65a';ctx.beginPath();ctx.arc(x,y,.5+hash(i)*1.1,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  function drawInteriorForeground(ctx,width,height){
    ctx.fillStyle=linearGradient(ctx,0,height*.78,0,height,[[0,'rgba(0,0,0,0)'],[1,'rgba(0,0,0,.50)']]);ctx.fillRect(0,height*.76,width,height*.24);
    ctx.fillStyle=radialGradient(ctx,width*.52,height*.55,height*.14,width*.52,height*.55,width*.70,[[0,'rgba(0,0,0,0)'],[.74,'rgba(0,0,0,.10)'],[1,'rgba(0,0,0,.43)']]);ctx.fillRect(0,0,width,height);
  }
  function drawWave(ctx,width,height,data,theme,model,time,quality){
    const visible=[...model.entries,model.bossState]
      .filter(entry=>entry.spawned)
      .sort((a,b)=>a.point.y-b.point.y||a.index-b.index);
    for(const entry of visible){
      const x=entry.point.x*width,y=entry.point.y*height;
      const isBoss=entry.index===model.minionCount;
      if(entry.dead){
        if(isBoss){if(entry.deathAge<.42) drawBossDeath(ctx,x,y,theme,1-entry.deathAge/.42,quality);}
        else if(entry.deathAge<.28) drawExplosion(ctx,x,y,theme,1-entry.deathAge/.28,quality,entry.index);
        continue;
      }
      if(isBoss){
        const depth=.84+entry.point.y*.22;
        const bossScale=(width<480?(data.coop?.29:.33):(data.coop?.34:.39))*depth;
        drawBoss(ctx,x,y,Math.min(width,height)*bossScale,theme,time,entry,entry.angle,quality);
      }else{
        const depth=.82+entry.point.y*.28;
        const narrowScale=width<480?.78:1;
        drawMinion(ctx,x,y,(data.coop?12.6:15)*depth*narrowScale,theme,time+entry.index*.37,entry.shield,entry.hp,entry.angle,entry.index,quality);
      }
    }
  }
  function drawDefenseHero(ctx,width,height,data,model,time){
    const x=width*.52;
    const y=height*.73;
    const targetX=model.target?model.target.point.x*width:x+1;
    const base=Math.min(width/440,height/210);
    const cycle=model.fireCycle;
    const recoil=cycle>.30&&cycle<.47?Math.sin((cycle-.30)/.17*Math.PI)*3.2*base:0;
    return drawHero(ctx,x,y,base*(data.coop?.78:.86),PLAYER_COLORS.p1,{
      facing:targetX<x?-1:1,time,label:'나',main:true,aim:true,recoil,bodyRotation:0,labelPosition:'above',defenseReduce:data.defenseReduce1
    });
  }

  function drawDefenseRelic(ctx,width,height,data,model,time){
    const x=width*.52;
    const y=height*.76;
    const base=Math.min(width/440,height/210);
    return drawRelic(ctx,x,y,base*(data.coop?.82:.92),{
      time:time*1.1,label:'유물',active:true,charge:clamp(model.rate/120,.45,1),defenseReduce:data.defenseReduce1
    });
  }

  function drawArtifactAttack(ctx,width,height,data,theme,model,relic,time,quality){
    const tempo=model.artifactTempo||buildArtifactTempo(data,model.rate);
    const cycle=frac(time/Math.max(.001,tempo.interval));
    const charge=smooth(clamp((cycle-.03)/.30,0,1))*(1-smooth(clamp((cycle-.52)/.16,0,1)));
    const wave=smooth(clamp((cycle-.18)/.56,0,1));
    const fade=1-smooth(clamp((cycle-.88)/.10,0,1));
    const origin=relic.core;
    ctx.save();ctx.globalCompositeOperation='lighter';
    const halo=ctx.createRadialGradient(origin.x,origin.y,2,origin.x,origin.y,26+tempo.sustain*18);
    halo.addColorStop(0,'rgba(255,255,255,.22)');halo.addColorStop(.35,'rgba(139,231,255,.14)');halo.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=halo;ctx.globalAlpha=.36;ctx.beginPath();ctx.arc(origin.x,origin.y,26+tempo.sustain*18,0,Math.PI*2);ctx.fill();
    if(charge>0){
      const glow=ctx.createRadialGradient(origin.x,origin.y,1,origin.x,origin.y,12+charge*(24+tempo.sustain*8));
      glow.addColorStop(0,'rgba(255,255,255,.90)');
      glow.addColorStop(.25,'rgba(139,231,255,.78)');
      glow.addColorStop(1,'rgba(47,140,255,0)');
      ctx.fillStyle=glow;ctx.globalAlpha=.46+.28*charge;
      ctx.beginPath();ctx.arc(origin.x,origin.y,12+charge*(24+tempo.sustain*8),0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#baf5ff';ctx.lineWidth=1.15;ctx.globalAlpha=.28+.26*charge;
      for(let i=0;i<3;i++){
        ctx.beginPath();ctx.ellipse(origin.x,origin.y,16+charge*(16+i*8),6+charge*(5+i*2),0,time*(i%2?.26:-.22),Math.PI*2+time*(i%2?.26:-.22));ctx.stroke();
      }
    }
    if(wave>0&&fade>0){
      const maxRadius=Math.hypot(width*.65,height*.72);
      const radius=wave*maxRadius;
      const trailGap=18+tempo.sustain*7;
      const hitWindow=tempo.impactRadius;
      const trails=Math.max(1,tempo.ringCount);
      ctx.shadowColor='#2f8cff';ctx.shadowBlur=8;
      for(let ring=0;ring<trails;ring++){
        const trailRadius=radius-ring*trailGap;
        if(trailRadius<=4) continue;
        const ringAlpha=(.42-ring*.12)*fade*Math.min(1.08,tempo.intensity);
        ctx.strokeStyle=ring===0?'#70dcff':'rgba(112,220,255,.92)';
        ctx.lineWidth=(ring===0?1.8:1.1)+Math.min(1.4,tempo.sustain*.32);ctx.globalAlpha=ringAlpha;
        ctx.beginPath();ctx.ellipse(origin.x,origin.y,trailRadius,trailRadius*.38,0,0,Math.PI*2);ctx.stroke();
      }
      ctx.shadowBlur=0;
      const all=[...model.entries,model.bossState].filter(entry=>entry.spawned&&!entry.dead);
      all.forEach((entry,index)=>{
        const tx=entry.point.x*width,ty=entry.point.y*height-(entry.index===model.minionCount?30:6);
        const dx=tx-origin.x,dy=(ty-origin.y)*2.4;
        const distance=Math.hypot(dx,dy);
        const proximity=Math.abs(distance-radius);
        if(proximity<hitWindow){
          const shieldHit=entry.shield>0;
          const color=shieldHit?theme.shield:theme.hp;
          const impact=clamp(1-proximity/hitWindow,0,1);
          ctx.strokeStyle=color;ctx.globalAlpha=.42*impact*fade;ctx.lineWidth=1.1+impact*1.4;
          ctx.beginPath();ctx.arc(tx,ty,5+impact*(14+tempo.sustain*3),0,Math.PI*2);ctx.stroke();
          if(shieldHit) drawMagicWardBurst(ctx,tx,ty,color,impact,quality);
          else drawArmorImpact(ctx,tx,ty,color,impact,quality);
          const sparks=Math.max(2,Math.round(4*quality));
          for(let i=0;i<sparks;i++){
            const a=hash(index*17+i)*Math.PI*2;
            ctx.globalAlpha=.24*impact*fade;ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(tx+Math.cos(a)*(7+impact*12),ty+Math.sin(a)*(7+impact*12));ctx.stroke();
          }
        }
      });
    }
    ctx.restore();
  }

  function drawCoopSupport(ctx,width,height,data,time){
    const narrow=width<480;
    const size=Math.min(width/440,height/210)*(narrow?.43:.50);
    const p2={x:width*(narrow?.29:.34),y:height*(narrow?.69:.74)};
    const p3={x:width*(narrow?.71:.69),y:height*(narrow?.69:.74)};
    drawHero(ctx,p2.x,p2.y,size,PLAYER_COLORS.p2,{facing:1,time:time+.6,label:'2P',labelPosition:'above',defenseReduce:data.defenseReduce2});
    drawHero(ctx,p3.x,p3.y,size,PLAYER_COLORS.p3,{facing:-1,time:time+1.1,label:'3P',labelPosition:'above',defenseReduce:data.defenseReduce3});
  }

  function drawHeroAttack(ctx,width,height,theme,model,hero,quality){
    if(!model.target) return;
    const targetX=model.target.point.x*width;
    const targetY=model.target.point.y*height-(model.target.kind==='boss'?32:7);
    const cycle=model.fireCycle;
    const charge=smooth(clamp((cycle-.10)/.18,0,1))*(1-smooth(clamp((cycle-.32)/.07,0,1)));
    const flight=smooth(clamp((cycle-.32)/.34,0,1));
    const flying=cycle>=.32&&cycle<=.71;
    const impact=smooth(clamp((cycle-.68)/.10,0,1))*(1-smooth(clamp((cycle-.88)/.10,0,1)));
    ctx.save();ctx.globalCompositeOperation='lighter';
    if(charge>0){
      ctx.fillStyle='#fff1ba';ctx.shadowColor='#77cfff';ctx.shadowBlur=13;ctx.globalAlpha=.30+.52*charge;
      ctx.beginPath();ctx.arc(hero.muzzle.x,hero.muzzle.y,2+charge*4,0,Math.PI*2);ctx.fill();
    }
    if(flying){
      const bend=-Math.min(34,height*.16);
      const one=1-flight;
      const x=one*one*hero.muzzle.x+2*one*flight*((hero.muzzle.x+targetX)/2)+flight*flight*targetX;
      const y=one*one*hero.muzzle.y+2*one*flight*((hero.muzzle.y+targetY)/2+bend)+flight*flight*targetY;
      ctx.shadowColor='#66c8ff';ctx.shadowBlur=12;ctx.fillStyle='#fff4c4';ctx.globalAlpha=.92;
      ctx.beginPath();ctx.arc(x,y,2.5+clamp(model.rate/120,0,1.5),0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      for(let i=1;i<=3;i++){
        const t=clamp(flight-i*.045,0,1),r=1.9-i*.35,back=1-t;
        const px=back*back*hero.muzzle.x+2*back*t*((hero.muzzle.x+targetX)/2)+t*t*targetX;
        const py=back*back*hero.muzzle.y+2*back*t*((hero.muzzle.y+targetY)/2+bend)+t*t*targetY;
        ctx.globalAlpha=.34-i*.07;ctx.fillStyle=i%2?'#70cfff':'#f3df9b';ctx.beginPath();ctx.arc(px,py,Math.max(.7,r),0,Math.PI*2);ctx.fill();
      }
    }
    if(impact>0){
      const shieldHit=model.target.state.shield>0,color=shieldHit?theme.shield:theme.hp;
      ctx.strokeStyle=color;ctx.globalAlpha=.74*(1-impact*.42);ctx.lineWidth=1.4+impact*1.7;
      for(let i=0;i<2;i++){ctx.beginPath();ctx.arc(targetX,targetY,7+i*5+impact*(16+i*5),Math.PI*.12,Math.PI*1.82);ctx.stroke();}
      if(shieldHit) drawMagicWardBurst(ctx,targetX,targetY,color,impact,quality);
      else drawArmorImpact(ctx,targetX,targetY,color,impact,quality);
    }
    ctx.restore();
  }
  function drawBattleResult(ctx,width,height,theme,model,time){
    const kind=model.resultKind;
    const title=kind==='clear'?'클리어!':kind==='fail'?'실패!':'공략 보강 필요';
    const color=kind==='clear'?'#8fe7ff':kind==='fail'?'#ff6171':'#ffbf57';
    const accent=kind==='clear'?'#ffe89a':kind==='fail'?theme.hp:theme.route;
    const alpha=clamp(model.resultAlpha,0,1);
    const centerX=width*.5,centerY=height*(width<480?.40:.42);
    ctx.save();ctx.globalAlpha=alpha;
    const glow=ctx.createRadialGradient(centerX,centerY,4,centerX,centerY,Math.min(width*.25,120));glow.addColorStop(0,rgba(color,.22));glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    const boxWidth=Math.min(width*.64,300),boxHeight=width<480?54:58;
    roundRect(ctx,centerX-boxWidth/2,centerY-boxHeight/2,boxWidth,boxHeight,10);ctx.fillStyle='rgba(3,7,14,.90)';ctx.fill();ctx.strokeStyle=rgba(accent,.72);ctx.lineWidth=1.2;ctx.stroke();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.shadowColor=rgba(color,.68);ctx.shadowBlur=8;ctx.font=`1000 ${width<480?13:15}px Pretendard, sans-serif`;ctx.fillText(title,centerX,centerY-12);ctx.shadowBlur=0;
    ctx.fillStyle='#eaf2ff';ctx.font=`800 ${width<480?8:9}px Pretendard, sans-serif`;
    const lines=wrapDialogueLines(ctx,model.resultMessage,boxWidth-22,2);
    const startY=centerY+(lines.length>1?6:9);
    lines.forEach((line,index)=>ctx.fillText(line,centerX,startY+index*10));
    if(kind==='clear'){
      ctx.globalCompositeOperation='lighter';ctx.strokeStyle=accent;ctx.globalAlpha=alpha*.56;for(let i=0;i<6;i++){const a=i*Math.PI/3+time*.15,r=boxWidth*.40;ctx.beginPath();ctx.moveTo(centerX+Math.cos(a)*r*.74,centerY+Math.sin(a)*15);ctx.lineTo(centerX+Math.cos(a)*r,centerY+Math.sin(a)*21);ctx.stroke();}
    }
    ctx.restore();
  }

  function drawMagicWardBurst(ctx,x,y,color,impact,quality){
    const count=Math.max(4,Math.round(7*quality));
    ctx.strokeStyle=color;ctx.lineWidth=1;
    for(let i=0;i<count;i++){
      const a=i*Math.PI*2/count+.28,inner=7+impact*8,outer=13+impact*(19+hash(i+8)*7);
      ctx.globalAlpha=(1-impact)*.38;
      ctx.beginPath();ctx.moveTo(x+Math.cos(a)*inner,y+Math.sin(a)*inner);ctx.quadraticCurveTo(x+Math.cos(a+.18)*outer*.82,y+Math.sin(a+.18)*outer*.82,x+Math.cos(a)*outer,y+Math.sin(a)*outer);ctx.stroke();
    }
  }
  function drawArmorImpact(ctx,x,y,color,impact,quality){
    const count=Math.round(7*quality);ctx.strokeStyle=color;ctx.lineWidth=1.4;
    for(let i=0;i<count;i++){const a=i*Math.PI*2/count+hash(i)*.3;const r=7+impact*(18+hash(i+7)*15);ctx.globalAlpha=(1-impact)*.55;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);ctx.stroke();}
  }

  function heroArtFor(color){if(color===PLAYER_COLORS.p2)return art.heroP2;if(color===PLAYER_COLORS.p3)return art.heroP3;return art.heroP1;}
  function drawHero(ctx,x,y,scale,color,options={}){
    const facing=options.facing===-1?-1:1,time=number(options.time),bob=options.aim?Math.sin(time*1.8)*.18*scale:Math.sin(time*2.6)*1.15*scale,mainScale=options.main?1.08:1,width=104*scale*mainScale,height=122*scale*mainScale,image=options.aim&&color===PLAYER_COLORS.p1?art.heroAimP1:heroArtFor(color),recoil=number(options.recoil),rotation=options.aim?0:number(options.bodyRotation),anchorX=x-facing*recoil,anchorY=y-bob;
    drawGroundGlow(ctx,x,y+2,34*scale*mainScale,color.glow,options.main?.36:.22);if(options.aim)drawBracedStance(ctx,x,y,scale,color,facing,recoil);drawArtAnchored(ctx,image,anchorX,anchorY,width,height,{flip:facing<0,rotation});
    const labelY=options.labelPosition==='side'?anchorY-height*.54:anchorY-height-8;drawActorLabels(ctx,x,labelY,options.label,color,scale,1,options.defenseReduce);
    const localX=facing*width*.57,localY=-height*.54,cos=Math.cos(rotation),sin=Math.sin(rotation);return{x:anchorX,y:anchorY,muzzle:{x:anchorX+localX*cos-localY*sin,y:anchorY+localX*sin+localY*cos}};
  }
  function drawBracedStance(ctx,x,y,scale,color,facing,recoil){ctx.save();ctx.strokeStyle=color.main;ctx.globalAlpha=.22;ctx.lineWidth=Math.max(1,1.15*scale);ctx.beginPath();ctx.moveTo(x-facing*(13+recoil)*scale,y-5*scale);ctx.lineTo(x-facing*22*scale,y+2*scale);ctx.moveTo(x+facing*7*scale,y-5*scale);ctx.lineTo(x+facing*17*scale,y+2*scale);ctx.stroke();ctx.fillStyle=rgba(color.main,.20);ctx.beginPath();ctx.ellipse(x-facing*19*scale,y+3*scale,7*scale,2*scale,0,0,Math.PI*2);ctx.ellipse(x+facing*15*scale,y+3*scale,7*scale,2*scale,0,0,Math.PI*2);ctx.fill();ctx.restore();}
  function compactPercent(value){
    const amount=Math.max(0,number(value));
    return Number.isInteger(amount)?String(amount):amount.toFixed(1).replace(/\.0$/,'');
  }
  function drawCanvasBadge(ctx,x,y,text,style={}){
    if(!text) return null;
    const alpha=clamp(style.alpha??1,0,1);
    const scale=Math.max(.55,number(style.scale)||1);
    const fontSize=Math.max(style.minFontSize||8,(style.fontSize||9.2)*scale);
    ctx.save();
    ctx.font=`${style.fontWeight||1000} ${fontSize}px Pretendard, sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    const padX=Math.max(4,(style.padX||5)*scale);
    const width=Math.max(style.minWidth||18,ctx.measureText(text).width+padX*2);
    const height=Math.max(style.minHeight||13,(style.height||14)*scale);
    const canvasWidth=ctx.canvas.clientWidth||ctx.canvas.width;
    const canvasHeight=ctx.canvas.clientHeight||ctx.canvas.height;
    const safeX=clamp(x,width/2+3,canvasWidth-width/2-3);
    const safeY=clamp(y,height/2+3,canvasHeight-height/2-3);
    roundRect(ctx,safeX-width/2,safeY-height/2,width,height,style.radius??height/2);
    ctx.fillStyle=style.fill||'rgba(2,6,12,.86)';ctx.globalAlpha=(style.fillAlpha??.88)*alpha;ctx.fill();
    ctx.strokeStyle=style.stroke||'#ffffff';ctx.lineWidth=style.lineWidth||1;ctx.globalAlpha=(style.strokeAlpha??.92)*alpha;ctx.stroke();
    ctx.fillStyle=style.text||'#ffffff';ctx.shadowColor=style.glow||'transparent';ctx.shadowBlur=style.shadowBlur??5;ctx.globalAlpha=alpha;
    ctx.fillText(text,safeX,safeY+(style.textOffsetY??.3));ctx.restore();
    return {x:safeX,y:safeY,width,height};
  }
  function drawPlayerLabel(ctx,x,y,label,color,scale,alpha){
    return drawCanvasBadge(ctx,x,y,label,{scale,alpha,stroke:color.main,text:color.light,glow:color.glow});
  }
  function drawDefenseReductionLabel(ctx,x,y,value,scale,alpha){
    if(number(value)<=0) return null;
    return drawCanvasBadge(ctx,x,y,`방감-${compactPercent(value)}%`,{
      scale:Math.max(.72,scale*.92),alpha,fontSize:8.7,minFontSize:7.6,minWidth:42,height:13.5,
      padX:5.5,fill:'rgba(24,7,10,.91)',fillAlpha:.94,stroke:'#ff7a6f',strokeAlpha:.92,
      text:'#ffd7c8',glow:'rgba(255,88,76,.74)',shadowBlur:4,lineWidth:1
    });
  }
  function drawActorLabels(ctx,x,y,label,color,scale,alpha,defenseReduce){
    const player=drawPlayerLabel(ctx,x,y,label,color,scale,alpha);
    if(number(defenseReduce)<=0) return player;
    const playerHeight=player?.height||Math.max(13,14*scale);
    const defenseHeight=Math.max(13,13.5*Math.max(.72,scale*.92));
    const defenseY=(player?.y??y)-playerHeight/2-defenseHeight/2-3;
    drawDefenseReductionLabel(ctx,x,defenseY,defenseReduce,scale,alpha);
    return player;
  }
  function drawMinion(ctx,x,y,size,theme,time,shield,hp,angle,index,quality){
    const stride=time*3.6+index*.65;const bob=Math.abs(Math.sin(stride))*1.6;const height=size*2.35,width=height;const facing=Math.cos(angle)<-.05?-1:1;const lean=Math.sin(stride)*.025*facing;
    drawGroundGlow(ctx,x,y+5,size*1.55,'rgba(246,69,101,.45)',.18);
    drawArtAnchored(ctx,art.minion,x,y+bob,width,height,{flip:facing<0,rotation:lean});
    if(shield>0){ctx.save();ctx.strokeStyle=theme.shield;ctx.globalAlpha=.12+.30*shield;ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(x,y+bob-height*.49,height*.44,0,Math.PI*2);ctx.stroke();ctx.restore();}
    if(hp<.78) drawDamageCracks(ctx,x,y-height*.55,size,theme.hp,1-hp,quality,index);
  }
  function drawBoss(ctx,x,y,size,theme,time,state,angle,quality){
    const stride=time*2.25+state.index*.41;
    const step=Math.sin(stride);
    const bob=Math.abs(step)*2.1;
    const height=size*1.48,width=height*(220/240);
    const facing=Math.cos(angle)<-.05?-1:1;
    const lean=step*.012*facing;
    drawGroundGlow(ctx,x,y+8,width*.48,'rgba(255,50,93,.6)',.31);
    if(state.shield>0){ctx.save();ctx.strokeStyle=theme.shield;ctx.globalAlpha=.14+.28*state.shield;ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(x,y+bob-height*.52,height*.45,0,Math.PI*2);ctx.stroke();ctx.restore();}
    drawArtAnchored(ctx,art.boss,x,y+bob,width,height,{flip:facing<0,rotation:lean});
    ctx.save();ctx.strokeStyle=theme.bossLight;ctx.globalAlpha=.20+.17*Math.sin(time*2);ctx.lineWidth=1.15;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(x,y+bob-height*.49,height*(.24+i*.07),0,Math.PI*2);ctx.stroke();}ctx.restore();
    if(state.hp<.82) drawDamageCracks(ctx,x,y-height*.53,size*.72,theme.hp,1-state.hp,quality,44);
  }
  function drawDamageCracks(ctx,x,y,size,color,damage,quality,seed){
    const count=Math.max(2,Math.round((2+damage*5)*quality));ctx.save();ctx.strokeStyle=color;ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.18+.32*damage;ctx.lineWidth=1;
    for(let i=0;i<count;i++){const a=hash(seed+i)*Math.PI*2;const sx=x+Math.cos(a)*size*.18,sy=y+Math.sin(a)*size*.20;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+Math.cos(a+.8)*(5+damage*10),sy+Math.sin(a+.8)*(5+damage*10));ctx.lineTo(sx+Math.cos(a-.4)*(8+damage*9),sy+Math.sin(a-.4)*(8+damage*9));ctx.stroke();}ctx.restore();
  }

  function drawExplosion(ctx,x,y,theme,intensity,quality,seed){
    const power=clamp(intensity,0,1);ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=power;
    const glow=ctx.createRadialGradient(x,y,1,x,y,27);glow.addColorStop(0,'#fff');glow.addColorStop(.25,theme.shield);glow.addColorStop(.60,theme.hp);glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,27,0,Math.PI*2);ctx.fill();
    const count=Math.max(4,Math.round(10*quality));ctx.strokeStyle=theme.bossLight;ctx.lineWidth=1;
    for(let i=0;i<count;i++){const a=hash(seed*31+i)*Math.PI*2;const r=(8+hash(i+seed)*30)*(1-power*.25);ctx.globalAlpha=power*(.22+.34*hash(i));ctx.beginPath();ctx.moveTo(x+Math.cos(a)*4,y+Math.sin(a)*4);ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);ctx.stroke();}
    ctx.restore();
  }
  function drawBossDeath(ctx,x,y,theme,intensity,quality){
    drawExplosion(ctx,x,y-30,theme,intensity,quality,99);ctx.save();ctx.strokeStyle=theme.bossLight;ctx.globalAlpha=intensity;ctx.lineWidth=2;
    const count=Math.max(6,Math.round(12*quality));for(let i=0;i<count;i++){const angle=i*Math.PI*2/count;ctx.beginPath();ctx.moveTo(x,y-30);ctx.lineTo(x+Math.cos(angle)*(26+42*(1-intensity)),y-30+Math.sin(angle)*(26+42*(1-intensity)));ctx.stroke();}ctx.restore();
  }

  /* 특성 프리셋 알림 */
  const PRESET_ALERT_ACTIONS=Object.freeze({
    select:Object.freeze({message:'이 프리셋을 선택했어!',duration:2300,priority:20}),
    load:Object.freeze({message:'프리셋을 불러왔어!',duration:3000,priority:45}),
    save:Object.freeze({message:'새 프리셋을 저장했어!',duration:3200,priority:48}),
    rename:Object.freeze({message:'프리셋 이름을 바꿨어!',duration:3000,priority:42}),
    update:Object.freeze({message:'프리셋이 업데이트됐어. 내보내기 해줘!',duration:3300,priority:55}),
    import:Object.freeze({message:'프리셋을 가져왔어!',duration:3300,priority:52}),
    export:Object.freeze({message:'안전하게 내보냈어!',duration:3300,priority:52}),
    'list-change':Object.freeze({message:'프리셋 목록을 정리했어!',duration:2700,priority:28}),
    'need-update':Object.freeze({message:'변경사항이 있어. 업데이트가 필요해!',duration:4300,priority:90,attention:true}),
    'need-export':Object.freeze({message:'변경한 프리셋을 내보내야 해!',duration:4100,priority:82,attention:true}),
    'need-import':Object.freeze({message:'저장된 프리셋이 없어. 가져오기 해줘!',duration:4300,priority:76,attention:true}),
    error:Object.freeze({message:'처리하지 못했어. 내용을 확인해줘!',duration:4300,priority:100,error:true})
  });
  const PRESET_ATTENTION_ACTIONS=Object.freeze([
    Object.freeze({key:'needsUpdate',action:'need-update'}),
    Object.freeze({key:'needsExport',action:'need-export'}),
    Object.freeze({key:'needsImport',action:'need-import'})
  ]);
  const presetAlertState={
    bubble:null,message:null,queue:[],current:null,
    timer:0,reminderTimer:0,attention:{needsUpdate:false,needsExport:false,needsImport:false},paused:false
  };
  function ensurePresetAlert(){
    if(presetAlertState.bubble&&presetAlertState.message) return true;
    const bubble=document.getElementById('presetNoticeBubble');
    const message=bubble?.querySelector('[data-preset-notice-message]');
    if(!bubble||!message) return false;
    presetAlertState.bubble=bubble;
    presetAlertState.message=message;
    return true;
  }
  function clearPresetAlertTimer(name){
    if(presetAlertState[name]) window.clearTimeout(presetAlertState[name]);
    presetAlertState[name]=0;
  }
  function renderPresetAlert(scene,options={}){
    if(!ensurePresetAlert()) return;
    const bubble=presetAlertState.bubble;
    bubble.classList.toggle('is-attention',Boolean(scene.attention));
    bubble.classList.toggle('is-error',Boolean(scene.error||options.action==='error'));
    if(options.notification){
      presetAlertState.message.textContent=String(options.message||scene.message||'').trim();
      bubble.hidden=false;
    }else{
      bubble.hidden=true;
      presetAlertState.message.textContent='';
    }
  }
  function showPresetAlertIdle(){
    if(presetAlertState.paused||!ensurePresetAlert()) return;
    presetAlertState.current=null;
    renderPresetAlert({});
  }
  function runPresetAlert(entry){
    presetAlertState.current=entry;
    renderPresetAlert(entry.scene,{notification:true,action:entry.action,message:entry.message});
    clearPresetAlertTimer('timer');
    presetAlertState.timer=window.setTimeout(()=>{
      presetAlertState.timer=0;
      presetAlertState.current=null;
      advancePresetAlert();
    },entry.scene.duration);
  }
  function advancePresetAlert(){
    if(presetAlertState.paused) return;
    presetAlertState.queue.sort((a,b)=>b.scene.priority-a.scene.priority||a.createdAt-b.createdAt);
    const next=presetAlertState.queue.shift();
    if(next) runPresetAlert(next);
    else showPresetAlertIdle();
  }
  function queuePresetAlert(action,options={}){
    const scene=PRESET_ALERT_ACTIONS[action];
    if(!scene||!ensurePresetAlert()) return false;
    const entry={action,scene,message:String(options.message||scene.message||'').trim(),createdAt:Date.now()};
    presetAlertState.queue=presetAlertState.queue.filter(item=>item.action!==action);
    const current=presetAlertState.current;
    if(!current||scene.priority>current.scene.priority||options.replace===true){
      clearPresetAlertTimer('timer');
      runPresetAlert(entry);
    }else{
      presetAlertState.queue.push(entry);
    }
    return true;
  }
  function activePresetAttentionActions(){
    return PRESET_ATTENTION_ACTIONS
      .filter(item=>presetAlertState.attention[item.key])
      .map(item=>item.action);
  }
  function schedulePresetAttentionReminder(){
    clearPresetAlertTimer('reminderTimer');
    const actions=activePresetAttentionActions();
    if(!actions.length) return;
    presetAlertState.reminderTimer=window.setTimeout(()=>{
      presetAlertState.reminderTimer=0;
      activePresetAttentionActions().forEach((action,index)=>queuePresetAlert(action,{replace:index===0}));
      schedulePresetAttentionReminder();
    },22000);
  }
  function setPresetAttention(partial={}){
    const previous={...presetAlertState.attention};
    PRESET_ATTENTION_ACTIONS.forEach(({key})=>{
      if(Object.prototype.hasOwnProperty.call(partial,key)) presetAlertState.attention[key]=Boolean(partial[key]);
    });
    PRESET_ATTENTION_ACTIONS.forEach(({key,action})=>{
      if(presetAlertState.attention[key]) return;
      presetAlertState.queue=presetAlertState.queue.filter(item=>item.action!==action);
      if(presetAlertState.current?.action===action){
        clearPresetAlertTimer('timer');
        presetAlertState.current=null;
      }
    });
    PRESET_ATTENTION_ACTIONS
      .filter(({key})=>!previous[key]&&presetAlertState.attention[key])
      .map(item=>item.action)
      .forEach((action,index)=>queuePresetAlert(action,{replace:index===0}));
    if(!presetAlertState.current) advancePresetAlert();
    schedulePresetAttentionReminder();
  }
  function notifyPreset(action,options={}){
    const safeAction=PRESET_ALERT_ACTIONS[action]?action:'error';
    const message=safeAction==='error'&&options.message
      ?String(options.message).replace(/\s+/g,' ').slice(0,72)
      :options.message;
    return queuePresetAlert(safeAction,{...options,message});
  }
  function setPresetAlertPaused(value){
    presetAlertState.paused=Boolean(value);
    if(!presetAlertState.paused&&!presetAlertState.timer) advancePresetAlert();
  }
  function initPresetAlert(){
    if(!ensurePresetAlert()) return;
    setPresetAlertPaused(document.hidden);
    if(!presetAlertState.current&&!presetAlertState.timer) showPresetAlertIdle();
  }

  /* 초기화·공개 API */
  function ensureScene(){
    const stage=document.getElementById('battleUnitStage');
    if(stage&&!battleScene) battleScene=new BattleScene(stage);
    return battleScene;
  }
  function tick(now){
    battleScene?.draw(now);
    requestAnimationFrame(tick);
  }
  function queueRefresh(){
    if(refreshQueued) return;
    refreshQueued=true;
    requestAnimationFrame(()=>{refreshQueued=false;refresh();});
  }
  function refresh(){
    const scene=ensureScene();
    ensurePresetAlert();
    if(scene){
      scene.resize(true);
      scene.draw(performance.now());
    }
  }
  function onVisibilityChange(){paused=document.hidden;setPresetAlertPaused(paused);if(!paused) queueRefresh();}
  function onDocumentClick(event){
    if(event.target?.closest?.('.mobile-section-tab')){
      requestAnimationFrame(queueRefresh);
      setTimeout(queueRefresh,70);
      setTimeout(queueRefresh,180);
    }
  }
  function init(){
    ensureBattleStyle();
    ensureScene();
    if(initialized) return;
    initialized=true;
    initPresetAlert();
    paused=document.hidden;
    document.addEventListener('visibilitychange',onVisibilityChange);
    document.addEventListener('click',onDocumentClick,true);
    window.addEventListener('resize',queueRefresh,{passive:true});
    window.addEventListener('orientationchange',queueRefresh,{passive:true});
    window.addEventListener('pageshow',queueRefresh,{passive:true});
    window.addEventListener('focus',queueRefresh,{passive:true});
    requestAnimationFrame(tick);
  }
  function updateBattle(data={}){
    init();
    const normalized=normalizedData(data);
    const scene=ensureScene();
    if(!scene) return;
    const selected=normalized.selectedUnitCount>0;
    scene.stage.hidden=normalized.unitHidden;
    scene.stage.setAttribute('aria-label',selected
      ?'선택한 유닛이 5초 동안 마왕성 내부에서 전투하는 반복 장면'
      :'용사와 동료, 유물이 모닥불 앞에서 출발을 준비하는 휴식 장면');
    scene.setData(normalized);
    queueRefresh();
  }

  window.DpsAnimation=Object.freeze({init,updateBattle,notifyPreset,setPresetAttention});
})();
