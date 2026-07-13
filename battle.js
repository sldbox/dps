/* ===== battle.js | 스펙·유닛 보드 2D 전투 연출 ===== */
(function(){
  'use strict';

  const CAMP_DIALOGUE_SEQUENCES=Object.freeze({
    solo:Object.freeze([
      Object.freeze([
        {speaker:'p1',text:'불이 따뜻하네. 잠깐 쉬어가자.'},
        {speaker:'p1',text:'장비 상태를 확인하고 출발해야겠어.'}
      ]),
      Object.freeze([
        {speaker:'p1',text:'다음 전투도 침착하게 가자.'},
        {speaker:'p1',text:'좋아, 조금만 더 쉬고 움직이자.'}
      ])
    ]),
    coop:Object.freeze([
      Object.freeze([
        {speaker:'p2',text:'다음 전투도 바로 갈 거야?'},
        {speaker:'p1',text:'장비만 확인하고 출발하자.'},
        {speaker:'p3',text:'좋아, 불 꺼지기 전에 준비할게.'}
      ]),
      Object.freeze([
        {speaker:'p3',text:'현재 화력은 충분해 보여.'},
        {speaker:'p2',text:'그래도 관통 수치는 다시 확인하자.'},
        {speaker:'p1',text:'점검이 끝나면 바로 움직이자.'}
      ]),
      Object.freeze([
        {speaker:'p1',text:'둘 다 장비 상태는 괜찮아?'},
        {speaker:'p2',text:'나는 준비됐어.'},
        {speaker:'p3',text:'나도 끝났어. 출발하자.'}
      ])
    ])
  });
  const SANCTUARY_DIALOGUE_SEQUENCES=Object.freeze({
    solo:Object.freeze([
      Object.freeze([
        {speaker:'artifact',text:'공명 상태를 확인합니다.'},
        {speaker:'artifact',text:'전투 지원 출력을 준비합니다.'}
      ]),
      Object.freeze([
        {speaker:'artifact',text:'에너지 흐름은 안정적입니다.'},
        {speaker:'artifact',text:'지원 준비가 완료되었습니다.'}
      ])
    ]),
    coop:Object.freeze([
      Object.freeze([
        {speaker:'p2',text:'유물의 출력이 올라가고 있어.'},
        {speaker:'artifact',text:'공명률이 안정 범위에 진입했습니다.'},
        {speaker:'p3',text:'그럼 이대로 전투에 투입해도 되겠네.'}
      ]),
      Object.freeze([
        {speaker:'p3',text:'에너지 흐름이 조금 빨라졌어.'},
        {speaker:'artifact',text:'출력 변동을 보정하고 있습니다.'},
        {speaker:'p2',text:'좋아, 안정되면 바로 움직이자.'}
      ]),
      Object.freeze([
        {speaker:'artifact',text:'전투 지원 준비를 시작합니다.'},
        {speaker:'p2',text:'보호막 상태도 확인해 줘.'},
        {speaker:'artifact',text:'보호막 출력은 정상입니다.'},
        {speaker:'p3',text:'준비 끝났네. 출발하자.'}
      ])
    ])
  });
  const WAITING_DIALOGUE_SEQUENCES=Object.freeze([
    Object.freeze([
      {speaker:'boss',text:'용사들은 아직인가?'},
      {speaker:'minion',minionIndex:0,text:'마왕님, 아직 아무도 오지 않았습니다.'},
      {speaker:'boss',text:'흥, 올 때까지 진형을 유지해라.'}
    ]),
    Object.freeze([
      {speaker:'minion',minionIndex:1,text:'오늘도 저희가 앞장섭니까?'},
      {speaker:'boss',text:'충성을 증명할 기회다.'},
      {speaker:'minion',minionIndex:1,text:'역시 그럴 줄 알았습니다...'}
    ]),
    Object.freeze([
      {speaker:'boss',text:'모두 전투 준비!'},
      {speaker:'minion',minionIndex:2,text:'무기는 챙겼습니다!'},
      {speaker:'minion',minionIndex:3,text:'방패는 누가 가져갔지?'}
    ]),
    Object.freeze([
      {speaker:'minion',minionIndex:3,text:'오늘은 성문 밖이 조용합니다.'},
      {speaker:'boss',text:'폭풍 전의 고요함이다.'},
      {speaker:'minion',minionIndex:0,text:'그냥 아무도 안 오는 건 아닐까요?'}
    ]),
    Object.freeze([
      {speaker:'boss',text:'덤벼라, 용사!'},
      {speaker:'minion',minionIndex:2,text:'마왕님, 용사는 아직 안 보입니다.'},
      {speaker:'boss',text:'곧 나타날 것이다. 긴장 풀지 마라.'}
    ])
  ]);
  const RESULT_MESSAGES=Object.freeze({
    critical:Object.freeze([
      '현재 구성으로는 공략이 어려워 보여.',
      '유닛 구성부터 다시 정비하는 편이 좋겠어.',
      '공격력과 방어력 관통이 모두 부족할 수 있어.',
      '주력 유닛의 수량을 늘리는 방법을 검토해 봐.',
      '강화와 쥬얼 구성을 먼저 보강해야겠어.',
      '지금은 전체 화력 보강이 우선이야.'
    ]),
    reinforce:Object.freeze([
      '승객의 방어력 감소를 추가해야 할지도 몰라.',
      '유닛을 더 추가해야 할지도 몰라.',
      '현재 구성으로는 화력이 조금 부족해 보여.',
      '유닛 수량이나 강화 상태를 다시 확인해 봐.',
      '방어력 관통을 조금 더 확보하는 편이 좋겠어.',
      '핵심 유닛을 보강하면 가능성이 올라갈 거야.',
      '주력 유닛 한두 곳을 집중적으로 보강해 봐.'
    ]),
    near:Object.freeze([
      '조금만 더 보강하면 공략할 수 있겠어.',
      '화력을 약간만 높이면 기준에 도달할 것 같아.',
      '주력 유닛 한두 곳만 보완하면 충분해 보여.',
      '현재 구성은 공략 기준에 거의 도달했어.',
      '방어력 관통이나 유닛 수량을 조금만 확인해 봐.',
      '마지막 보강만 끝내면 충분할 것 같아.'
    ]),
    clear:Object.freeze([
      '현재 구성으로 공략이 가능해 보여.',
      '필요한 화력은 충분히 확보됐어.',
      '지금 구성이라면 안정적으로 진행할 수 있겠어.',
      '공략 기준을 충족했어.',
      '현재 유닛 조합의 균형이 좋아 보여.',
      '이 구성이라면 바로 도전해도 되겠어.'
    ]),
    surplus:Object.freeze([
      '공략에 필요한 화력을 충분히 넘겼어.',
      '현재 구성은 상당히 안정적이야.',
      '일부 투자를 줄여도 공략에는 문제가 없겠어.',
      '화력이 충분하니 다른 능력치를 보완해도 되겠어.',
      '현재 기준에서는 여유 있는 구성이야.',
      '화력이 넉넉하니 구성 조정의 여지도 있어.'
    ])
  });
  const PLAYER_COLORS={
    p1:{main:'#2f8cff',light:'#bce8ff',glow:'rgba(47,140,255,.78)'},
    p2:{main:'#f4f7ff',light:'#ffffff',glow:'rgba(255,255,255,.66)'},
    p3:{main:'#ff4b55',light:'#ffd0d3',glow:'rgba(255,75,85,.68)'}
  };
  const THEMES={
    classic:{
      skyTop:'#17151d',skyBottom:'#09080d',ground:'#100c10',route:'#b99a68',routeGlow:'rgba(185,154,104,.16)',
      bossLight:'#ff6f91',shield:'#58d7ff',hp:'#f24f70',text:'#f2f7ff',muted:'#9c94a1',castle:'#26222b',castleEdge:'#544b59'
    },
    eternal:{
      skyTop:'#1b1320',skyBottom:'#09060d',ground:'#130a13',route:'#b98aa9',routeGlow:'rgba(185,138,169,.16)',
      bossLight:'#ff7ed4',shield:'#a57cff',hp:'#ef4e9f',text:'#fff5fd',muted:'#b1a0b2',castle:'#2b202c',castleEdge:'#654b64'
    }
  };

  const scenes=new Map();
  let initialized=false;
  let rafId=0;
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
  const runSvgA=createRunHeroSvg(SVG_SOURCES.hero,0);
  const runSvgB=createRunHeroSvg(SVG_SOURCES.hero,1);
  const restSvg=createRestHeroSvg(SVG_SOURCES.hero);
  const art=Object.freeze({
    heroP1:createSvgImage(SVG_SOURCES.hero),
    heroAimP1:createSvgImage(createAimHeroSvg(SVG_SOURCES.hero)),
    heroP2:createSvgImage(recolorSvg(SVG_SOURCES.hero,HERO_TINTS.p2)),
    heroP3:createSvgImage(recolorSvg(SVG_SOURCES.hero,HERO_TINTS.p3)),
    heroRunP1:[createSvgImage(runSvgA),createSvgImage(runSvgB)],
    heroRunP2:[createSvgImage(recolorSvg(runSvgA,HERO_TINTS.p2)),createSvgImage(recolorSvg(runSvgB,HERO_TINTS.p2))],
    heroRunP3:[createSvgImage(recolorSvg(runSvgA,HERO_TINTS.p3)),createSvgImage(recolorSvg(runSvgB,HERO_TINTS.p3))],
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
  function easeInCubic(t){const x=clamp(t,0,1);return x*x*x;}
  function number(value){const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;}
  function themeFor(type){return type==='eternal'?THEMES.eternal:THEMES.classic;}
  function hash(seed){return frac(Math.sin(seed*127.1+311.7)*43758.5453123);}
  function rgba(hex,alpha){
    const clean=String(hex||'#ffffff').replace('#','');
    const full=clean.length===3?clean.split('').map(char=>char+char).join(''):clean;
    const value=parseInt(full,16);
    return `rgba(${(value>>16)&255},${(value>>8)&255},${value&255},${alpha})`;
  }

  function battleNumber(value){
    return Math.max(0,Math.round(number(value))).toLocaleString('ko-KR');
  }
  function activeDialogueSequence(time,sequences,options={}){
    const groups=(Array.isArray(sequences)?sequences:[]).filter(group=>Array.isArray(group)&&group.length);
    if(!groups.length) return null;
    const lineInterval=Math.max(.5,number(options.lineInterval)||3.05);
    const visibleDuration=Math.min(lineInterval,Math.max(.3,number(options.visibleDuration)||2.65));
    const pauseDuration=Math.max(0,number(options.pauseDuration)||3.1);
    const durations=groups.map(group=>group.length*lineInterval+pauseDuration);
    const totalDuration=durations.reduce((sum,value)=>sum+value,0);
    let cursor=((time%totalDuration)+totalDuration)%totalDuration;
    let groupIndex=0;
    while(groupIndex<groups.length-1&&cursor>=durations[groupIndex]){
      cursor-=durations[groupIndex];
      groupIndex++;
    }
    const group=groups[groupIndex];
    const speakingDuration=group.length*lineInterval;
    if(cursor>=speakingDuration) return null;
    const lineIndex=Math.min(group.length-1,Math.floor(cursor/lineInterval));
    const local=cursor-lineIndex*lineInterval;
    if(local>visibleDuration) return null;
    const fadeIn=smooth(clamp(local/.22,0,1));
    const fadeOut=1-smooth(clamp((local-visibleDuration+.30)/.30,0,1));
    return {item:group[lineIndex],alpha:fadeIn*fadeOut};
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
    return result.replace(/  <g transform="translate\(127 98\) rotate\(-22\)">[\s\S]*?  <\/g>/,'');
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
  function createRunHeroSvg(svg,frame){
    const base=heroSvgWithoutPose(svg);
    const forward=frame===0;
    const legs=forward?`
  <path d="M67 143l21 3-11 31-29 22-12-13 25-26z" fill="url(#dark)" stroke="#54c7ff" stroke-width="3"/>
  <path d="M100 144l20-1 29 35-16 18-28-27z" fill="url(#dark)" stroke="#54c7ff" stroke-width="3"/>
  <path d="M42 184l29-11 9 15-34 16zM132 181l18-3 14 16-29 6z" fill="#0b1a37" stroke="#58cfff" stroke-width="3"/>`:`
  <path d="M68 144l20-1 29 35-16 18-28-27z" fill="url(#dark)" stroke="#54c7ff" stroke-width="3"/>
  <path d="M100 143l21 3-11 31-29 22-12-13 25-26z" fill="url(#dark)" stroke="#54c7ff" stroke-width="3"/>
  <path d="M100 181l18-3 14 16-29 6zM75 184l29-11 9 15-34 16z" fill="#0b1a37" stroke="#58cfff" stroke-width="3"/>`;
    const pose=`
  <path d="M52 105l34 13 11 13-10 12-42-20z" fill="url(#dark)" stroke="#5dd4ff" stroke-width="3"/>
  <path d="M126 104l22 15-9 17-39-17 8-15z" fill="url(#dark)" stroke="#5dd4ff" stroke-width="3"/>
  <g transform="translate(72 100) rotate(3)">
    <path d="M-9 20L8 8l73-2 29 11-27 15H9z" fill="url(#weapon)" stroke="#c8f6ff" stroke-width="3"/>
    <path d="M80 8l26-13 10 8-14 17z" fill="#76e8ff" stroke="#effcff" stroke-width="2"/>
    <path d="M1 12l-21 5 3 14 26-4z" fill="#102a66" stroke="#74dfff" stroke-width="2"/>
    <circle cx="55" cy="18" r="6" fill="url(#core)" filter="url(#glow)"/>
  </g>${legs}`;
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
      defenseReduce2:Math.max(0,number(data.defenseReduce2)),defenseReduce3:Math.max(0,number(data.defenseReduce3)),
      artifactDpsEnabled:Boolean(data.artifactDpsEnabled),artifactUnitSelected:Boolean(data.artifactUnitSelected),
      artifactPrimarySelected:Boolean(data.artifactPrimarySelected),artifactAttackRate:Math.max(0,number(data.artifactAttackRate)),
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

  class BattleScene{
    constructor(stage,type){
      this.stage=stage;
      this.type=type;
      this.data=normalizedData();
      this.canvas=document.createElement('canvas');
      this.canvas.className='battle-canvas';
      this.canvas.setAttribute('aria-hidden','true');
      this.viewport=document.createElement('div');
      this.viewport.className='battle-canvas-viewport';
      this.viewport.appendChild(this.canvas);
      this.shell=document.createElement('div');
      this.shell.className='battle-canvas-shell';
      this.status=type==='unit'?createDurabilityStatus():null;
      this.dialogueSignature='';
      this.dialogueStartedAt=performance.now();
      if(this.status){
        this.shell.classList.add('has-enemy-status');
        this.shell.append(this.status.element,this.viewport);
      }else this.shell.appendChild(this.viewport);
      stage.replaceChildren(this.shell);
      this.ctx=this.canvas.getContext('2d',{alpha:true,desynchronized:true});
      this.runtime={signature:'',cycleIndex:null,maxHp:0,maxShield:0,hp:0,shield:0,lastHeroHit:-1,lastArtifactHit:-1};
      this.width=0;
      this.height=0;
      this.dpr=1;
      this.resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(()=>this.resize(true)):null;
      this.resizeObserver?.observe(stage);
      this.resize(true);
    }
    setData(data){
      this.data=normalizedData(data);
      const selected=this.data.selectedUnitCount>0;
      const signature=this.type==='spec'
        ?`${selected?'active':'idle'}|${this.data.artifactDpsEnabled?'artifact':'hero'}|${this.data.coop?'coop':'solo'}`
        :`${selected?'battle':'waiting'}|${this.data.coop?'coop':'solo'}|${!this.data.unitHidden&&this.data.requiredDps>0?'visible':'hidden'}`;
      if(signature!==this.dialogueSignature){
        this.dialogueSignature=signature;
        this.dialogueStartedAt=performance.now();
      }
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
      this.resize();
      this.ctx.clearRect(0,0,this.width,this.height);
      const dialogueTime=Math.max(0,(now-this.dialogueStartedAt)/1000);
      if(this.type==='spec') drawSpecScene(this.ctx,this.width,this.height,this.data,now,dialogueTime);
      else{
        const durability=drawUnitScene(this.ctx,this.width,this.height,this.data,now,this.runtime,dialogueTime);
        updateDurabilityStatus(this.status,durability,themeFor(this.data.battleType));
      }
    }
    destroy(){this.resizeObserver?.disconnect();this.stage.replaceChildren();}
  }

  function ensureScenes(){
    const spec=document.getElementById('battleSpecStage');
    const unit=document.getElementById('battleUnitStage');
    if(spec&&!scenes.has('spec')) scenes.set('spec',new BattleScene(spec,'spec'));
    if(unit&&!scenes.has('unit')) scenes.set('unit',new BattleScene(unit,'unit'));
  }
  function tick(now){scenes.forEach(scene=>scene.draw(now));rafId=requestAnimationFrame(tick);}
  function queueRefresh(){
    if(refreshQueued) return;
    refreshQueued=true;
    requestAnimationFrame(()=>{refreshQueued=false;refresh();});
  }
  function refresh(){
    ensureScenes();
    scenes.forEach(scene=>{scene.resize(true);scene.draw(performance.now());});
  }
  function onVisibilityChange(){paused=document.hidden;if(!paused) queueRefresh();}
  function onDocumentClick(event){
    if(event.target?.closest?.('.mobile-section-tab')){
      requestAnimationFrame(queueRefresh);
      setTimeout(queueRefresh,70);
      setTimeout(queueRefresh,180);
    }
  }
  function init(){
    if(initialized) return;
    initialized=true;
    ensureScenes();
    paused=document.hidden;
    document.addEventListener('visibilitychange',onVisibilityChange);
    document.addEventListener('click',onDocumentClick,true);
    window.addEventListener('resize',queueRefresh,{passive:true});
    window.addEventListener('orientationchange',queueRefresh,{passive:true});
    window.addEventListener('pageshow',queueRefresh,{passive:true});
    window.addEventListener('focus',queueRefresh,{passive:true});
    rafId=requestAnimationFrame(tick);
  }
  function update(data={}){
    init();
    ensureScenes();
    const normalized=normalizedData(data);
    const spec=scenes.get('spec');
    const unit=scenes.get('unit');
    const selected=normalized.selectedUnitCount>0;
    if(spec){
      spec.stage.hidden=false;
      let label='';
      if(selected&&normalized.artifactDpsEnabled){
        label=normalized.coop?'유물과 흰색 2P, 빨간 3P가 보호막을 유지하며 마왕성으로 진입하는 장면':'유물이 보호막을 유지하며 마왕성으로 진입하는 장면';
      }else if(selected){
        label=normalized.coop?'파란 나와 흰색 2P, 빨간 3P 용사가 마왕의 공격을 보호막으로 막으며 성문으로 진입하는 장면':'파란 나 용사가 마왕의 공격을 보호막으로 막으며 성문으로 진입하는 장면';
      }else if(normalized.artifactDpsEnabled){
        label=normalized.coop?'성소에서 유물이 충전되고 2P와 3P가 주변을 지키는 장면':'성소에서 유물이 충전되는 장면';
      }else{
        label=normalized.coop?'나와 2P, 3P가 캠프파이어에서 전의를 충전하는 장면':'나 용사가 캠프파이어에서 휴식하는 장면';
      }
      spec.stage.setAttribute('aria-label',label);
      spec.setData(normalized);
    }
    if(unit){
      const visible=!normalized.unitHidden&&normalized.requiredDps>0;
      unit.stage.hidden=!visible;
      const label=selected
        ?(normalized.artifactPrimarySelected
          ?(normalized.coop?'유물이 광역 파장으로 공격하고 흰색 2P와 빨간 3P가 약화 오라를 지원하는 마왕 군단 전투':'유물이 광역 파장으로 마왕 군단을 공격하는 개인 전투')
          :(normalized.artifactUnitSelected
            ?(normalized.coop?'나 용사가 공격하고 유물 파장과 흰색 2P, 빨간 3P의 약화 오라가 지원하는 마왕 군단 전투':'나 용사가 공격하고 유물 파장이 지원하는 개인 전투')
            :(normalized.coop?'나 용사가 공격하고 흰색 2P와 빨간 3P가 약화 오라를 지원하는 마왕 군단 전투':'나 용사가 마왕 군단과 싸우는 개인 전투')))
        :'성 내부에서 정지한 채 용사를 기다리며 도발하는 마왕 군단';
      unit.stage.setAttribute('aria-label',label);
      unit.setData(normalized);
    }
    queueRefresh();
  }
  function destroy(){
    if(rafId) cancelAnimationFrame(rafId);
    document.removeEventListener('visibilitychange',onVisibilityChange);
    document.removeEventListener('click',onDocumentClick,true);
    window.removeEventListener('resize',queueRefresh);
    window.removeEventListener('orientationchange',queueRefresh);
    window.removeEventListener('pageshow',queueRefresh);
    window.removeEventListener('focus',queueRefresh);
    scenes.forEach(scene=>scene.destroy());
    scenes.clear();initialized=false;rafId=0;
  }

  /* ===== 스펙 보드: 휴식 또는 마왕성 돌입 ===== */
  function drawSpecScene(ctx,width,height,data,now,dialogueTime){
    const theme=themeFor(data.battleType);
    const time=now/1000;
    const quality=qualityFor(width,height);
    const power=clamp(data.dps/Math.max(1,data.requiredDps||data.dps||1),.35,2.5);
    if(data.selectedUnitCount<=0){
      if(data.artifactDpsEnabled) drawSanctuaryScene(ctx,width,height,data,theme,time,quality,dialogueTime);
      else drawCampScene(ctx,width,height,data,theme,time,quality,dialogueTime);
      return;
    }
    const duration=prefersReducedMotion()?14:10.8;
    const phase=frac(time/duration);
    const castle=castleGeometry(width,height);

    drawSpecSky(ctx,width,height,theme,time,quality);
    drawPerspectiveRoad(ctx,width,height,castle,theme);
    drawCastleBack(ctx,castle,theme,power);
    drawSpecEmbers(ctx,width,height,theme,time,quality);
    drawCastleBossWatcher(ctx,castle,theme,time);
    drawCastleFacade(ctx,castle,theme,time);

    const mainRunner={
      kind:data.artifactDpsEnabled?'artifact':'hero',
      color:PLAYER_COLORS.p1,
      label:data.artifactDpsEnabled?'유물':'나',
      main:true,start:.04,approachEnd:.59,entryEnd:.73,startX:.18,startY:.88,
      scale:data.artifactDpsEnabled?.88:1
    };
    const runners=data.coop?[
      mainRunner,
      {kind:'hero',color:PLAYER_COLORS.p2,label:'2P',start:.10,approachEnd:.68,entryEnd:.82,startX:.06,startY:.84,scale:.64},
      {kind:'hero',color:PLAYER_COLORS.p3,label:'3P',start:.16,approachEnd:.77,entryEnd:.91,startX:.11,startY:.94,scale:.66}
    ]:[{...mainRunner,approachEnd:.66,entryEnd:.82,startX:.16,startY:.89}];

    const states=runners.map((runner,index)=>specRunnerState(runner,index,phase,width,height,castle,time,power));
    const active=states.filter(state=>state.alpha>.02&&state.progress>.01&&state.entry<.98);
    const barriers=buildSpecBarriers(active);
    drawCastleAssault(ctx,castle,barriers,theme,time,phase,power,quality);

    states.sort((a,b)=>a.y-b.y).forEach(state=>{
      if(state.alpha<=0||state.progress<=0) return;
      const render=()=>{
        if(state.runner.kind==='artifact'){
          drawMovingRelic(ctx,state.x,state.y,state.scale*.98,{
            time:state.stride*.16,label:state.showLabel?state.runner.label:'',alpha:state.alpha,
            progress:state.progress,quality,power
          });
          return;
        }
        drawRunningHero(ctx,state.x,state.y,state.scale,state.runner.color,{
          facing:1,time:state.stride,label:state.showLabel?state.runner.label:'',main:state.runner.main,
          alpha:state.alpha,progress:state.progress,quality,power,labelPosition:'above'
        });
      };
      if(state.entry>0){
        ctx.save();
        roundRect(ctx,castle.gateCx-castle.gateW*.46,castle.gateTop+1,castle.gateW*.92,castle.gateH-1,castle.gateW*.40);
        ctx.clip();render();ctx.restore();
      }else render();
    });

    if(barriers.length) drawTeamBarrier(ctx,barriers,theme,time,power,data.coop,quality);
    drawSpecVignette(ctx,width,height);
  }
  function drawCampScene(ctx,width,height,data,theme,time,quality,dialogueTime){
    drawSpecSky(ctx,width,height,theme,time,quality);
    const ground=ctx.createLinearGradient(0,height*.54,0,height);
    ground.addColorStop(0,'rgba(10,15,24,.20)');ground.addColorStop(1,'rgba(2,5,10,.98)');
    ctx.fillStyle=ground;ctx.fillRect(0,height*.52,width,height*.48);
    drawDistantCastleSilhouette(ctx,width,height,time);
    drawCampSupplies(ctx,width,height,theme,time);
    const fire={x:width*.52,y:height*.84};
    const base=Math.min(width/430,height/150);
    const heroes=data.coop?[
      {key:'p1',x:width*.34,y:height*.89,scale:base*.86,color:PLAYER_COLORS.p1,label:'나',main:true,phase:.1},
      {key:'p2',x:width*.20,y:height*.90,scale:base*.56,color:PLAYER_COLORS.p2,label:'2P',phase:1.7},
      {key:'p3',x:width*.72,y:height*.91,scale:base*.58,color:PLAYER_COLORS.p3,label:'3P',phase:3.0}
    ]:[{key:'p1',x:width*.35,y:height*.90,scale:base*.92,color:PLAYER_COLORS.p1,label:'나',main:true,phase:.1}];
    heroes.slice().sort((a,b)=>a.y-b.y).forEach(hero=>drawRestingHero(ctx,hero.x,hero.y,hero.scale,hero.color,{
      time:time+hero.phase,label:hero.label,main:hero.main,fireX:fire.x
    }));
    drawCampfire(ctx,fire.x,fire.y,Math.max(12,20*base),theme,time,quality);
    drawCampEnergy(ctx,fire.x,fire.y,Math.max(12,20*base),theme,time,quality,data.coop);
    drawSpecVignette(ctx,width,height);
    const dialogue=activeDialogueSequence(dialogueTime,data.coop?CAMP_DIALOGUE_SEQUENCES.coop:CAMP_DIALOGUE_SEQUENCES.solo,{lineInterval:3.05,visibleDuration:2.66,pauseDuration:3.2});
    if(dialogue){
      const speaker=heroes.find(hero=>hero.key===dialogue.item.speaker)||heroes[0];
      const offsetX=speaker.x<width*.36?width*.10:-width*.09;
      drawDialogueBubble(ctx,width,height,dialogue.item.text,{x:speaker.x,y:speaker.y-88*speaker.scale},theme,{
        alpha:dialogue.alpha,accent:speaker.color.main,offsetX,offsetY:-24
      });
    }
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
  function drawCampfire(ctx,x,y,size,theme,time,quality){
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

  function drawSanctuaryScene(ctx,width,height,data,theme,time,quality,dialogueTime){
    drawSpecSky(ctx,width,height,theme,time,quality);
    const floor=ctx.createLinearGradient(0,height*.48,0,height);
    floor.addColorStop(0,'rgba(15,22,34,.30)');
    floor.addColorStop(1,'rgba(2,5,10,.98)');
    ctx.fillStyle=floor;ctx.fillRect(0,height*.48,width,height*.52);
    const cx=width*.52,cy=height*.78,base=Math.min(width/430,height/150);
    drawSanctuaryArchitecture(ctx,width,height,theme,time,quality);
    drawSanctuaryRunes(ctx,cx,cy,Math.max(34,62*base),theme,time,quality);
    const speakers={artifact:{x:cx,y:cy-66*base,accent:theme.shield,artifact:true}};
    if(data.coop){
      const p2={x:width*.25,y:height*.88,scale:base*.57};
      const p3={x:width*.78,y:height*.89,scale:base*.59};
      drawRestingHero(ctx,p2.x,p2.y,p2.scale,PLAYER_COLORS.p2,{time:time+.7,label:'2P',fireX:cx});
      drawRestingHero(ctx,p3.x,p3.y,p3.scale,PLAYER_COLORS.p3,{time:time+1.6,label:'3P',fireX:cx});
      speakers.p2={x:p2.x,y:p2.y-88*p2.scale,accent:PLAYER_COLORS.p2.main};
      speakers.p3={x:p3.x,y:p3.y-88*p3.scale,accent:PLAYER_COLORS.p3.main};
    }
    drawRelic(ctx,cx,cy-5,base*.95,{time,label:'유물',active:false,charge:.58});
    drawSanctuaryParticles(ctx,cx,cy,Math.max(42,74*base),theme,time,quality,data.coop);
    drawSpecVignette(ctx,width,height);
    const dialogue=activeDialogueSequence(dialogueTime,data.coop?SANCTUARY_DIALOGUE_SEQUENCES.coop:SANCTUARY_DIALOGUE_SEQUENCES.solo,{lineInterval:3.08,visibleDuration:2.68,pauseDuration:3.25});
    if(dialogue){
      const speaker=speakers[dialogue.item.speaker]||speakers.artifact;
      const offsetX=speaker.x<width*.4?width*.11:speaker.x>width*.64?-width*.11:0;
      drawDialogueBubble(ctx,width,height,dialogue.item.text,{x:speaker.x,y:speaker.y},theme,{
        alpha:dialogue.alpha,accent:speaker.accent,artifact:speaker.artifact,offsetX,offsetY:-22
      });
    }
  }

  function drawSanctuaryArchitecture(ctx,width,height,theme,time,quality){
    const cx=width*.52,top=height*.18,bottom=height*.83,spread=width*.24;
    ctx.save();
    const aura=ctx.createRadialGradient(cx,height*.56,4,cx,height*.56,width*.34);
    aura.addColorStop(0,rgba(theme.shield,.13));
    aura.addColorStop(.55,rgba(theme.shield,.035));
    aura.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=aura;ctx.fillRect(0,0,width,height);
    for(const side of [-1,1]){
      const x=cx+side*spread;
      const grad=ctx.createLinearGradient(x-14,0,x+14,0);
      grad.addColorStop(0,'rgba(2,5,10,.95)');
      grad.addColorStop(.48,rgba(theme.castleEdge,.68));
      grad.addColorStop(1,'rgba(1,3,7,.95)');
      ctx.fillStyle=grad;ctx.fillRect(x-12,top,24,bottom-top);
      ctx.fillStyle=rgba(theme.castleEdge,.82);ctx.fillRect(x-18,top-5,36,8);ctx.fillRect(x-20,bottom-7,40,9);
      ctx.strokeStyle=rgba(theme.shield,.25+.08*Math.sin(time*1.2+side));ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x,top+12);ctx.lineTo(x,bottom-14);ctx.stroke();
    }
    ctx.strokeStyle=rgba(theme.castleEdge,.55);ctx.lineWidth=4;
    ctx.beginPath();ctx.arc(cx,top+26,spread,Math.PI,Math.PI*2);ctx.stroke();
    ctx.strokeStyle=rgba(theme.shield,.19);ctx.lineWidth=1;
    for(let i=0;i<Math.max(5,Math.round(8*quality));i++){
      const a=Math.PI+i*Math.PI/7;
      ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*spread*.72,top+26+Math.sin(a)*spread*.25);
      ctx.lineTo(cx+Math.cos(a)*spread,top+26+Math.sin(a)*spread*.34);ctx.stroke();
    }
    ctx.restore();
  }

  function drawSanctuaryRunes(ctx,x,y,radius,theme,time,quality){
    ctx.save();ctx.globalCompositeOperation='lighter';
    const glow=ctx.createRadialGradient(x,y,2,x,y,radius*1.8);
    glow.addColorStop(0,rgba(theme.shield,.22));
    glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glow;ctx.fillRect(x-radius*2,y-radius,radius*4,radius*2);
    ctx.strokeStyle=theme.shield;ctx.lineWidth=1.1;ctx.globalAlpha=.30+.08*Math.sin(time*1.1);
    ctx.beginPath();ctx.ellipse(x,y,radius,radius*.28,0,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([5,7]);ctx.lineDashOffset=-time*10;
    ctx.beginPath();ctx.ellipse(x,y,radius*.72,radius*.20,0,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);
    const count=Math.max(6,Math.round(10*quality));
    for(let i=0;i<count;i++){
      const a=i*Math.PI*2/count+time*.05,px=x+Math.cos(a)*radius*.84,py=y+Math.sin(a)*radius*.24;
      drawHexagon(ctx,px,py,2.2);ctx.stroke();
    }
    ctx.restore();
  }

  function drawSanctuaryParticles(ctx,x,y,radius,theme,time,quality,coop){
    const count=Math.max(8,Math.round(18*quality));
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=0;i<count;i++){
      const life=frac(time*(.055+.008*(i%3))+i/count);
      const a=hash(i+17)*Math.PI*2+time*.08;
      const r=radius*(1.2-life*.9);
      const px=x+Math.cos(a)*r,py=y-12-Math.sin(a)*r*.32-life*34;
      const color=coop&&i%4===1?PLAYER_COLORS.p2.main:coop&&i%4===2?PLAYER_COLORS.p3.main:theme.shield;
      ctx.fillStyle=color;ctx.globalAlpha=(1-life)*.28;
      ctx.beginPath();ctx.arc(px,py,.6+hash(i)*1.2,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
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
    if(options.label) drawPlayerLabel(ctx,x,baseY-64*scale,options.label,PLAYER_COLORS.p1,Math.max(.72,scale*.88),alpha);
    return {x,y:baseY,core:{x,y:baseY-12*scale},muzzle:{x,y:baseY-12*scale},scale};
  }

  function drawMovingRelic(ctx,x,y,scale,options){
    const alpha=options.alpha??1;
    ctx.save();ctx.globalAlpha=alpha;
    const relic=drawRelic(ctx,x,y,scale,{time:options.time,label:options.label,active:true,charge:options.power/2.5,alpha});
    const count=Math.max(3,Math.round(6*(options.quality||1)));
    ctx.globalCompositeOperation='lighter';
    for(let i=0;i<count;i++){
      const life=frac(options.time*.08+i/count);
      ctx.strokeStyle=i%2?'#8be7ff':'#2f8cff';
      ctx.globalAlpha=(1-life)*.18*alpha;
      ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x-(10+life*34)*scale,y-8*scale+i*.8);ctx.lineTo(x-(28+life*56)*scale,y-8*scale+i*.8);ctx.stroke();
    }
    ctx.restore();
    return relic;
  }
  function specRunnerState(runner,index,phase,width,height,castle,time,power){
    const approach=smooth(clamp((phase-runner.start)/Math.max(.01,runner.approachEnd-runner.start),0,1));
    const entry=smooth(clamp((phase-runner.approachEnd)/Math.max(.01,runner.entryEnd-runner.approachEnd),0,1));
    const finished=smooth(clamp((phase-runner.entryEnd)/.045,0,1));
    const startX=width*runner.startX,startY=height*runner.startY;
    const laneOffset=runner.main?0:(index===1?-castle.gateW*.09:castle.gateW*.09);
    const thresholdX=castle.gateCx+laneOffset,thresholdY=castle.gateBottom+height*.022;
    const insideX=castle.gateCx+laneOffset*.12,insideY=castle.gateTop+castle.gateH*.47;
    const x=entry>0?lerp(thresholdX,insideX,entry):lerp(startX,thresholdX,approach);
    const y=entry>0?lerp(thresholdY,insideY,entry):lerp(startY,thresholdY,approach);
    const perspective=entry>0?lerp(.36,.12,entry):lerp(1,.36,easeInCubic(approach));
    const base=Math.min(width/430,height/146),scale=base*runner.scale*perspective;
    const stride=time*(7.2+power*.62)+index*1.72;
    return {runner,x,y,scale,stride,entry,progress:Math.max(approach,entry),alpha:1-finished,showLabel:entry<.02&&approach<.88};
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
  function drawPerspectiveSlabs(ctx,{topY,bottomY,topLeft,topRight,bottomLeft,bottomRight,rows=6,stroke='rgba(112,97,95,.20)',seed=0}){
    ctx.save();ctx.strokeStyle=stroke;ctx.lineWidth=.85;
    for(let row=0;row<rows;row++){
      const t0=row/rows,t1=(row+1)/rows,y0=lerp(topY,bottomY,Math.pow(t0,1.3)),y1=lerp(topY,bottomY,Math.pow(t1,1.3));
      const left0=lerp(topLeft,bottomLeft,t0),right0=lerp(topRight,bottomRight,t0);
      const left1=lerp(topLeft,bottomLeft,t1),right1=lerp(topRight,bottomRight,t1);
      ctx.beginPath();ctx.moveTo(left0,y0);ctx.lineTo(right0,y0+(hash(seed+row)-.5)*2);ctx.stroke();
      const slabs=6+row,offset=row%2?.5:0;
      for(let col=-1;col<=slabs;col++){
        const p=(col+offset)/slabs;
        ctx.beginPath();ctx.moveTo(lerp(left0,right0,p),y0);
        ctx.lineTo(lerp(left1,right1,p)+(hash(seed+row*37+col)-.5)*4,y1);ctx.stroke();
      }
    }
    ctx.restore();
  }
  function castleGeometry(width,height){
    const w=clamp(width*.41,142,330),h=height*.94,x=width-w+width*.012,y=height*.018,gateW=w*.34,gateH=h*.48;
    return {x,y,w,h,gateW,gateH,gateCx:x+w*.49,gateTop:y+h*.45,gateBottom:y+h*.93,bossX:x+w*.49,bossY:y+h*.29,balconyW:w*.35,balconyH:h*.25};
  }
  function drawSpecSky(ctx,width,height,theme,time,quality){
    ctx.fillStyle=linearGradient(ctx,0,0,0,height,[[0,theme.skyTop],[.58,theme.skyBottom],[1,theme.ground]]);ctx.fillRect(0,0,width,height);
    ctx.save();
    const cloudCount=Math.max(4,Math.round(7*quality));
    for(let i=0;i<cloudCount;i++){
      const x=(frac(hash(i+14)+time*(.0025+.0007*(i%3)))-.18)*width,y=height*(.08+hash(i+44)*.38);
      const rx=width*(.12+hash(i+71)*.11),ry=height*(.06+hash(i+92)*.06);
      ctx.fillStyle=radialGradient(ctx,x,y,1,x,y,rx,[[0,'rgba(70,61,72,.12)'],[.55,'rgba(31,27,36,.09)'],[1,'rgba(0,0,0,0)']]);
      ctx.globalAlpha=.7;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;ctx.fillStyle=linearGradient(ctx,0,height*.4,0,height*.76,[[0,'rgba(0,0,0,0)'],[.72,rgba(theme.bossLight,.045)],[1,'rgba(0,0,0,0)']]);
    ctx.fillRect(0,height*.35,width,height*.45);ctx.restore();
    ctx.save();
    const layers=[{count:10,base:.70,peak:.43,spread:.10,fill:'rgba(8,7,11,.78)',seed:12},{count:8,base:.74,peak:.54,spread:.07,fill:rgba(theme.castleEdge,.18),seed:66}];
    for(const layer of layers){
      ctx.fillStyle=layer.fill;ctx.beginPath();ctx.moveTo(0,height*layer.base);
      for(let i=0;i<=layer.count;i++) ctx.lineTo(width*i/layer.count,height*(layer.peak-layer.spread*hash(i+layer.seed)));
      ctx.lineTo(width,height*.80);ctx.lineTo(0,height*.80);ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
  function drawPerspectiveRoad(ctx,width,height,castle,theme){
    const topY=castle.gateBottom+2,topLeft=castle.gateCx-castle.gateW*.30,topRight=castle.gateCx+castle.gateW*.30;
    const bottomLeft=width*.02,bottomRight=width*.73;
    ctx.save();ctx.fillStyle=linearGradient(ctx,0,height*.56,0,height,[[0,'rgba(22,18,22,.38)'],[1,'rgba(5,4,7,.98)']]);ctx.fillRect(0,height*.54,width,height*.46);
    fillPolygon(ctx,[[topLeft,topY],[topRight,topY],[bottomRight,height],[bottomLeft,height]],linearGradient(ctx,0,topY,0,height,[[0,'rgba(54,48,51,.74)'],[.55,'rgba(35,30,33,.92)'],[1,'rgba(15,12,15,.99)']]));
    drawPerspectiveSlabs(ctx,{topY,bottomY:height,topLeft,topRight,bottomLeft,bottomRight,rows:5,stroke:'rgba(117,104,102,.24)',seed:120});
    ctx.strokeStyle=rgba(theme.castleEdge,.34);ctx.lineWidth=2;
    for(const [x0,x1] of [[topLeft,bottomLeft],[topRight,bottomRight]]){ctx.beginPath();ctx.moveTo(x0,topY);ctx.lineTo(x1,height);ctx.stroke();}
    ctx.restore();
  }
  function drawCastleBack(ctx,c,theme,power){
    const {x,y,w,h,gateW,gateH,gateCx,gateTop}=c;ctx.save();
    ctx.fillStyle=radialGradient(ctx,x+w*.5,y+h*.88,2,x+w*.5,y+h*.88,w*.66,[[0,'rgba(0,0,0,.58)'],[1,'rgba(0,0,0,0)']]);
    ctx.beginPath();ctx.ellipse(x+w*.5,y+h*.89,w*.67,h*.13,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=linearGradient(ctx,x,y,x+w,y+h,[[0,rgba(theme.castleEdge,.90)],[.28,theme.castle],[.70,'#17131a'],[1,'#08070b']]);ctx.fillRect(x,y+h*.22,w,h*.70);
    const towers=[[0,.25,.10,.11],[.29,.42,.15,.07],[.75,.25,.05,.14]];
    towers.forEach(([px,pw,pt,peak],index)=>{
      const tx=x+w*px,tw=w*pw,top=y+h*pt;
      ctx.fillStyle=linearGradient(ctx,tx,top,tx+tw,top+h*.7,[[0,rgba(theme.castleEdge,index===1?.82:.72)],[.48,theme.castle],[1,'#0a080d']]);
      ctx.fillRect(tx,top,tw,y+h*.80-top);
      const merlonW=tw/5;ctx.fillStyle=rgba(theme.castleEdge,.88);for(let i=0;i<5;i++) ctx.fillRect(tx+i*merlonW,top-h*.05,merlonW*.58,h*.05);
      ctx.fillStyle='rgba(8,7,10,.72)';ctx.fillRect(tx,top-1,tw,3);
      fillPolygon(ctx,[[tx-3,top],[tx+tw*.5,top-h*peak],[tx+tw+3,top]],'rgba(18,14,20,.98)');
    });
    const outerW=gateW*1.34,outerH=gateH*1.08;
    roundRect(ctx,gateCx-outerW/2,gateTop-gateH*.07,outerW,outerH,outerW*.30);ctx.fillStyle='rgba(17,14,19,.98)';ctx.fill();ctx.strokeStyle=rgba(theme.castleEdge,.68);ctx.lineWidth=2.2;ctx.stroke();
    roundRect(ctx,gateCx-gateW/2,gateTop,gateW,gateH,gateW*.40);ctx.fillStyle=linearGradient(ctx,0,gateTop,0,gateTop+gateH,[[0,'rgba(53,19,29,.90)'],[.4,'rgba(26,12,20,.98)'],[1,'rgba(4,3,7,1)']]);ctx.fill();ctx.strokeStyle=rgba(theme.bossLight,.30+.08*clamp(power/2.5,0,1));ctx.lineWidth=1.15;ctx.stroke();
    ctx.strokeStyle='rgba(122,108,106,.36)';ctx.lineWidth=.85;
    for(let i=1;i<5;i++){const gx=gateCx-gateW/2+i*gateW/5;ctx.beginPath();ctx.moveTo(gx,gateTop+gateH*.12);ctx.lineTo(gx,gateTop+gateH*.96);ctx.stroke();}
    drawStoneCourses(ctx,x,y+h*.216,w,h*.70,h*.072,w*.13,rgba(theme.castleEdge,.18),1.5,17,0);ctx.restore();
  }
  function drawCastleBossWatcher(ctx,c,theme,time){
    const {bossX,bossY,balconyW,balconyH}=c,top=bossY-balconyH*.68,alcoveW=balconyW*1.04,alcoveH=balconyH*1.10;
    ctx.save();roundRect(ctx,bossX-alcoveW/2,top,alcoveW,alcoveH,alcoveW*.30);
    ctx.fillStyle=linearGradient(ctx,0,top,0,top+alcoveH,[[0,'rgba(28,20,27,.98)'],[.55,'rgba(8,6,10,.99)'],[1,'rgba(2,2,4,1)']]);ctx.fill();ctx.strokeStyle=rgba(theme.castleEdge,.62);ctx.lineWidth=1.8;ctx.stroke();
    ctx.fillStyle=radialGradient(ctx,bossX,bossY,2,bossX,bossY,balconyW*.72,[[0,rgba(theme.bossLight,.20+.04*Math.sin(time*1.4))],[1,'rgba(0,0,0,0)']]);ctx.fillRect(bossX-balconyW,bossY-balconyH,balconyW*2,balconyH*2);
    ctx.save();roundRect(ctx,bossX-alcoveW*.43,top+3,alcoveW*.86,alcoveH*.82,alcoveW*.24);ctx.clip();
    const size=balconyH*(1.34+.04*Math.sin(time*1.5));drawArtAnchored(ctx,art.boss,bossX,bossY+balconyH*.64,size*(220/240),size,{rotation:Math.sin(time*.9)*.008});ctx.restore();
    ctx.fillStyle=rgba(theme.castleEdge,.92);ctx.fillRect(bossX-balconyW*.64,bossY+balconyH*.34,balconyW*1.28,balconyH*.17);ctx.fillStyle='rgba(9,7,10,.92)';
    for(let i=-2;i<=2;i++) ctx.fillRect(bossX+i*balconyW*.13-balconyW*.035,bossY+balconyH*.19,balconyW*.07,balconyH*.25);
    ctx.restore();
  }
  function drawCastleFacade(ctx,c,theme,time){
    const {gateW,gateH,gateCx,gateTop}=c,archW=gateW*1.38,archH=gateH*1.10;ctx.save();
    roundRect(ctx,gateCx-archW/2,gateTop-gateH*.08,archW,archH,archW*.31);ctx.strokeStyle=rgba(theme.castleEdge,.64);ctx.lineWidth=1.7;ctx.stroke();
    ctx.strokeStyle='rgba(116,98,96,.30)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(gateCx,gateTop+gateH*.06,gateW*.43,Math.PI,Math.PI*2);ctx.stroke();
    for(const side of [-1,1]){
      drawHangingDecor(ctx,'chain',gateCx+side*gateW*.66,gateTop+5,7,gateH*.11,'rgba(104,92,91,.58)');
      drawHangingDecor(ctx,'banner',gateCx+side*gateW*.99,gateTop-c.h*.08,c.w*.078,c.h*.28,side,time,side<0?'rgba(91,22,42,.86)':'rgba(112,24,43,.86)');
    }
    const windows=[[.12,.33],[.87,.28],[.13,.58],[.86,.56],[.50,.20]];
    windows.forEach(([px,py],index)=>{
      const x=c.x+c.w*px,y=c.y+c.h*py,w=c.w*(index===4?.052:.030),h=c.h*(index===4?.075:.065);
      ctx.fillStyle=radialGradient(ctx,x,y+h*.45,1,x,y+h*.45,w*3.2,[[0,'rgba(255,155,86,.20)'],[1,'rgba(0,0,0,0)']]);ctx.fillRect(x-w*3,y-h,w*6,h*3);
      roundRect(ctx,x-w/2,y,w,h,w*.45);ctx.fillStyle=index%2?'rgba(133,42,47,.72)':'rgba(92,30,40,.72)';ctx.globalAlpha=.64+.14*Math.sin(time*1.4+index);ctx.fill();ctx.globalAlpha=1;
    });
    for(const side of [-1,1]){
      const x=gateCx+side*gateW*.90,y=gateTop+gateH*.18;
      fillPolygon(ctx,[[x,y],[x+side*gateW*.22,y+gateH*.11],[x+side*gateW*.10,y+gateH*.25],[x-side*gateW*.04,y+gateH*.17]],rgba(theme.castleEdge,.78),'rgba(15,12,16,.85)',.8);
      ctx.fillStyle=rgba(theme.bossLight,.28+.06*Math.sin(time*1.7+side));ctx.beginPath();ctx.arc(x+side*gateW*.08,y+gateH*.12,1.1,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  function buildSpecBarriers(states){
    return states.map(specBarrierGeometry).filter(Boolean);
  }
  function specBarrierGeometry(state){
    if(!state||state.alpha<=0) return null;
    const scale=state.scale||1;
    const mainBoost=state.runner?.main?1.1:1;
    const isArtifact=state.runner?.kind==='artifact';
    const rx=Math.max(28,scale*(isArtifact?48:54)*mainBoost);
    const ry=Math.max(40,scale*(isArtifact?70:82)*mainBoost);
    const centerY=state.y-scale*(isArtifact?46:60)*mainBoost;
    return {
      x:state.x,
      y:centerY,
      rx,
      ry,
      alpha:state.alpha,
      color:state.runner?.color||PLAYER_COLORS.p1,
      main:Boolean(state.runner?.main)
    };
  }

  function ellipseSurfacePoint(ellipse,source){
    const dx=source.x-ellipse.x,dy=source.y-ellipse.y;
    const denom=Math.sqrt((dx*dx)/(ellipse.rx*ellipse.rx)+(dy*dy)/(ellipse.ry*ellipse.ry))||1;
    return {x:ellipse.x+dx/denom,y:ellipse.y+dy/denom};
  }
  function drawCastleAssault(ctx,castle,barriers,theme,time,phase,power,quality){
    if(!barriers||!barriers.length||phase<.09||phase>.93) return;
    const source={x:castle.bossX,y:castle.bossY-castle.balconyH*.06};
    ctx.save();ctx.globalCompositeOperation='lighter';
    barriers.forEach((barrier,index)=>{
      const target=ellipseSurfacePoint(barrier,source);
      const beamCount=Math.max(1,Math.round((barrier.main?2:1)*Math.max(.9,quality)));
      for(let i=0;i<beamCount;i++){
        const travel=frac(time*(.34+.04*i)+i/Math.max(1,beamCount)+index*.21);
        const eased=smooth(travel);
        const bend=(index-(barriers.length-1)/2)*7+(i-(beamCount-1)/2)*4;
        const midX=lerp(source.x,target.x,.55),midY=lerp(source.y,target.y,.55)+bend;
        const x=travel<.5?lerp(source.x,midX,smooth(travel*2)):lerp(midX,target.x,smooth((travel-.5)*2));
        const y=travel<.5?lerp(source.y,midY,smooth(travel*2)):lerp(midY,target.y,smooth((travel-.5)*2));
        ctx.strokeStyle=rgba(theme.bossLight,.20);ctx.lineWidth=1.05+i*.26;ctx.globalAlpha=.28*(1-travel*.36);
        ctx.beginPath();ctx.moveTo(source.x,source.y);ctx.quadraticCurveTo(midX,midY,x,y);ctx.stroke();
        const radius=2.3+power*.45+i*.25;
        const glow=ctx.createRadialGradient(x,y,1,x,y,radius*3.3);
        glow.addColorStop(0,'#fff4ca');glow.addColorStop(.22,theme.bossLight);glow.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=glow;ctx.globalAlpha=.70;ctx.beginPath();ctx.arc(x,y,radius*3.3,0,Math.PI*2);ctx.fill();
        if(travel>.84) drawBarrierImpact(ctx,target.x,target.y,barrier.color,time+i*.33,power,travel);
      }
    });
    ctx.restore();
  }
  function drawBarrierImpact(ctx,x,y,color,time,power,travel){
    const hit=clamp((travel-.84)/.16,0,1),fade=1-hit;
    ctx.save();ctx.globalCompositeOperation='lighter';
    ctx.strokeStyle=color.main;ctx.lineWidth=1.45+power*.48;ctx.globalAlpha=fade*.66;
    for(let i=0;i<3;i++){
      ctx.beginPath();ctx.arc(x,y,6+i*5+hit*(16+power*5+i*4),0,Math.PI*2);ctx.stroke();
    }
    ctx.strokeStyle=color.light;ctx.lineWidth=.95;
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4+time*.16;
      ctx.globalAlpha=fade*(.22+.24*(i%2));
      ctx.beginPath();ctx.moveTo(x+Math.cos(a)*5,y+Math.sin(a)*5);ctx.lineTo(x+Math.cos(a)*(12+hit*20),y+Math.sin(a)*(12+hit*20));ctx.stroke();
    }
    const flash=ctx.createRadialGradient(x,y,1,x,y,18+power*6);
    flash.addColorStop(0,'rgba(255,255,255,.82)');flash.addColorStop(.24,rgba(color.light,.52));flash.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=flash;ctx.globalAlpha=fade*.88;ctx.beginPath();ctx.arc(x,y,18+power*6,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  function drawTeamBarrier(ctx,barriers,theme,time,power,coop,quality){
    ctx.save();ctx.globalCompositeOperation='lighter';
    barriers.forEach((barrier,index)=>{
      const pulse=.5+.5*Math.sin(time*1.7+index*.9);
      const supportBoost=barrier.main?1:1.22;
      const fill=ctx.createRadialGradient(barrier.x-barrier.rx*.18,barrier.y-barrier.ry*.12,3,barrier.x,barrier.y,barrier.rx*1.18);
      fill.addColorStop(0,rgba(barrier.color.light,.16+.04*pulse));
      fill.addColorStop(.55,rgba(barrier.color.main,.08+.03*pulse));
      fill.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=fill;ctx.globalAlpha=Math.min(1,.56*supportBoost*barrier.alpha);ctx.beginPath();ctx.ellipse(barrier.x,barrier.y,barrier.rx,barrier.ry,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=rgba(barrier.color.main,.34);ctx.lineWidth=barrier.main?.95:1.15;ctx.globalAlpha=Math.min(1,.58*supportBoost*barrier.alpha);
      for(let i=1;i<=2;i++){
        ctx.beginPath();ctx.ellipse(barrier.x,barrier.y,Math.max(4,barrier.rx-i*4),Math.max(4,barrier.ry-i*5),0,0,Math.PI*2);ctx.stroke();
      }
      ctx.strokeStyle=barrier.color.main;ctx.lineWidth=(1.65+power*.28+(barrier.main?.25:0))*supportBoost;ctx.globalAlpha=Math.min(1,(.68+.12*pulse)*supportBoost*barrier.alpha);ctx.shadowColor=barrier.color.main;ctx.shadowBlur=12;
      ctx.beginPath();ctx.ellipse(barrier.x,barrier.y,barrier.rx,barrier.ry,0,0,Math.PI*2);ctx.stroke();
      ctx.shadowBlur=0;ctx.strokeStyle=barrier.color.light;ctx.lineWidth=.9;ctx.globalAlpha=(.24+.09*pulse)*barrier.alpha;
      ctx.beginPath();ctx.ellipse(barrier.x,barrier.y-barrier.ry*.08,barrier.rx*.72,barrier.ry*.40,0,Math.PI*.92,Math.PI*2.08);ctx.stroke();
      if(barrier.main){
        ctx.strokeStyle=rgba(barrier.color.main,.28);ctx.lineWidth=.95;ctx.globalAlpha=.34*barrier.alpha;
        ctx.beginPath();ctx.moveTo(barrier.x-barrier.rx*.52,barrier.y-barrier.ry*.22);ctx.quadraticCurveTo(barrier.x,barrier.y-barrier.ry*.42,barrier.x+barrier.rx*.50,barrier.y-barrier.ry*.16);ctx.stroke();
      }
    });
    ctx.restore();
  }
  function drawSpecEmbers(ctx,width,height,theme,time,quality){const count=Math.round(15*quality);ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<count;i++){const x=width*(.55+hash(i+95)*.44),y=height*(.90-frac(time*.08+hash(i+44))*.68);ctx.globalAlpha=.08+.26*hash(i+71);ctx.fillStyle=i%2?theme.bossLight:'#ffb86a';ctx.beginPath();ctx.arc(x,y,.6+hash(i)*1.2,0,Math.PI*2);ctx.fill();}ctx.restore();}
  function drawSpecVignette(ctx,width,height){
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
  function runArtFor(color,frame){const set=color===PLAYER_COLORS.p2?art.heroRunP2:color===PLAYER_COLORS.p3?art.heroRunP3:art.heroRunP1;return set[frame%2];}
  function drawRunningHero(ctx,x,y,scale,color,options){const stride=number(options.time),step=Math.sin(stride),frame=step>=0?0:1,bob=Math.abs(step)*1.7*scale,alpha=options.alpha??1;drawRunDust(ctx,x,y,scale,color,stride,options.quality,options.progress);if(options.main)drawHeroEnergyMantle(ctx,x,y-bob-45*scale,scale,color,stride,options.power,alpha);ctx.save();ctx.globalAlpha=alpha;const image=runArtFor(color,frame),width=108*scale*(options.main?1.10:1),height=122*scale*(options.main?1.10:1);drawGroundGlow(ctx,x,y+2,34*scale,color.glow,options.main?.32:.20);drawArtAnchored(ctx,image,x,y-bob,width,height,{flip:options.facing<0,alpha});drawPlayerLabel(ctx,x,y-bob-height-7,options.label,color,scale,alpha);ctx.restore();}
  function drawRunDust(ctx,x,y,scale,color,stride,quality,progress){if(progress<=.02)return;const count=Math.max(2,Math.round(5*quality));ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<count;i++){const life=frac(stride*.11+i/count),px=x-(8+life*30)*scale,py=y+(hash(i+17)-.5)*5*scale;ctx.globalAlpha=(1-life)*.18;ctx.fillStyle=i%2?color.main:'#d7d2c5';ctx.beginPath();ctx.ellipse(px,py,(2+life*5)*scale,(1+life*1.5)*scale,0,0,Math.PI*2);ctx.fill();}ctx.restore();}
  function drawHeroEnergyMantle(ctx,x,y,scale,color,time,power,alpha){ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=color.main;for(let i=0;i<3;i++){const pulse=frac(time*.07+i/3);ctx.globalAlpha=alpha*(1-pulse)*(.10+power*.035);ctx.lineWidth=Math.max(.7,1.2*scale);ctx.beginPath();ctx.ellipse(x,y,scale*(27+pulse*22),scale*(42+pulse*16),0,Math.PI*.82,Math.PI*2.18);ctx.stroke();}ctx.restore();}

  /* ===== 유닛 보드: 마왕성 내부 전투 ===== */
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
    runtime.lastHeroHit=-1;
    runtime.lastArtifactHit=-1;
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
  function syncCombatRuntime(runtime,data,model,time){
    const signature=combatRuntimeSignature(data);
    if(runtime.signature!==signature||runtime.cycleIndex!==model.cycleIndex) resetCombatRuntime(runtime,data,model.cycleIndex);
    const total=runtime.maxHp+runtime.maxShield;
    if(total<=0) return runtime;
    const targetDamage=total*clamp(model.rate/100,0,1);
    const heroActive=!data.artifactPrimarySelected;
    const artifactActive=data.artifactPrimarySelected||data.artifactUnitSelected;
    const heroHits=heroActive?Math.max(1,Math.round(model.cycleDuration*model.fireRate)):0;
    const artifactHits=artifactActive?Math.max(1,Math.round(model.cycleDuration/Math.max(.12,model.artifactTempo.interval))):0;
    const totalWeight=Math.max(1,heroHits+artifactHits*1.15);
    const unitDamage=targetDamage/totalWeight;
    const heroOrdinal=Math.floor(time*model.fireRate);
    if(heroActive&&model.fireCycle>=.68&&model.fireCycle<=.91&&runtime.lastHeroHit!==heroOrdinal){
      runtime.lastHeroHit=heroOrdinal;
      applyCombatDamage(runtime,unitDamage);
    }
    if(artifactActive){
      const artifactCycle=frac(time/Math.max(.001,model.artifactTempo.interval));
      const artifactOrdinal=Math.floor(time/Math.max(.001,model.artifactTempo.interval));
      if(artifactCycle>=.66&&artifactCycle<=.92&&runtime.lastArtifactHit!==artifactOrdinal){
        runtime.lastArtifactHit=artifactOrdinal;
        applyCombatDamage(runtime,unitDamage*1.15);
      }
    }
    return runtime;
  }
  function fullDurabilityState(data){
    const maxHp=Math.max(0,number(data.enemyHp));
    const maxShield=Math.max(0,number(data.enemyShield));
    return {maxHp,maxShield,hp:maxHp,shield:maxShield};
  }
  function drawUnitScene(ctx,width,height,data,now,runtime,dialogueTime){
    const theme=themeFor(data.battleType);
    const time=now/1000;
    const hasAttacker=data.selectedUnitCount>0;
    const quality=qualityFor(width,height);
    drawCastleInterior(ctx,width,height,theme,time,quality);
    if(!hasAttacker){
      resetCombatRuntime(runtime,data,null);
      drawInteriorForeground(ctx,width,height);
      drawWaitingArmy(ctx,width,height,data,theme,time,quality,dialogueTime);
      return fullDurabilityState(data);
    }
    const model=buildBattleModel(data,time);
    const durability=syncCombatRuntime(runtime,data,model,time);
    drawRoute(ctx,width,height,data.coop,theme,model.spawnCorner);
    drawWave(ctx,width,height,data,theme,model,time,quality);
    if(data.coop) drawCoopSupport(ctx,width,height,data,model,time);
    if(data.artifactPrimarySelected){
      const relic=drawDefenseRelic(ctx,width,height,data,model,time);
      drawArtifactAttack(ctx,width,height,data,theme,model,relic,time,quality);
    }else{
      const hero=drawDefenseHero(ctx,width,height,data,model,time);
      drawHeroAttack(ctx,width,height,data,theme,model,hero,time,quality);
      if(data.artifactUnitSelected){
        const base=Math.min(width/440,height/210);
        drawArtifactAttack(ctx,width,height,data,theme,model,{core:{x:hero.x,y:hero.y-48*base}},time,quality);
      }
    }
    drawInteriorForeground(ctx,width,height);
    if(model.resultVisible) drawBattleResult(ctx,width,height,theme,model,time);
    return durability;
  }
  function waitingGuardPositions(coop){
    return coop?[
      [.13,.57],[.34,.56],[.23,.79],[.50,.80]
    ]:[
      [.14,.58],[.36,.57],[.24,.80],[.52,.81]
    ];
  }
  function drawWaitingArmy(ctx,width,height,data,theme,time,quality,dialogueTime){
    const bossPoint={x:data.coop?.82:.79,y:.79};
    const guardPositions=waitingGuardPositions(data.coop);
    const bossState={shield:1,hp:1,index:guardPositions.length};
    ctx.save();
    ctx.fillStyle='rgba(31,7,19,.32)';
    ctx.beginPath();ctx.ellipse(bossPoint.x*width,bossPoint.y*height+7,width*.13,height*.055,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
    guardPositions.forEach((point,index)=>{
      const size=(data.coop?11.2:12.8)*(width<480?.78:1);
      drawMinion(ctx,point[0]*width,point[1]*height,size,theme,0,1,1,0,index,quality);
    });
    const bossScale=width<480?(data.coop?.27:.31):(data.coop?.32:.37);
    drawBoss(ctx,bossPoint.x*width,bossPoint.y*height,Math.min(width,height)*bossScale,theme,0,bossState,Math.PI,quality);
    const dialogue=activeDialogueSequence(dialogueTime,WAITING_DIALOGUE_SEQUENCES,{lineInterval:3.0,visibleDuration:2.62,pauseDuration:3.4});
    if(dialogue){
      if(dialogue.item.speaker==='boss'){
        drawDialogueBubble(ctx,width,height,dialogue.item.text,{x:bossPoint.x*width,y:bossPoint.y*height-Math.min(width,height)*bossScale*.72},theme,{
          alpha:dialogue.alpha,accent:theme.bossLight,offsetX:-width*.10,offsetY:-22
        });
      }else{
        const index=Math.abs(Math.round(number(dialogue.item.minionIndex)))%guardPositions.length;
        const point=guardPositions[index];
        const anchor={x:point[0]*width,y:point[1]*height-18};
        drawDialogueBubble(ctx,width,height,dialogue.item.text,anchor,theme,{
          alpha:dialogue.alpha,accent:theme.hp,offsetX:point[0]<.4?width*.12:-width*.10,offsetY:-24
        });
      }
    }
  }

  function buildBattleModel(data,time){
    const minionCount=data.coop?16:8;
    const totalEntities=minionCount+1;
    const density=clamp(Math.log10(Math.max(1,data.enemyCount)+1)/6,0,1);
    const rate=Math.max(0,data.achievementRate);
    const speedBoost=1+clamp((rate-100)/220,0,.85);
    const cycleDuration=(data.coop?12.3:11.4)*(1-density*.08)/speedBoost;
    const cycleIndex=Math.floor(time/cycleDuration);
    const rawPhase=frac(time/cycleDuration);
    const phase=rawPhase;
    const spawnCorner=cycleIndex%4;
    const finalFraction=clamp(rate/100,0,1);
    const durabilityTotal=data.enemyHp+data.enemyShield;
    const shieldEnabled=data.enemyShield>0;
    const hpEnabled=data.enemyHp>0||!shieldEnabled;
    const shieldPhase=durabilityTotal>0?clamp(data.enemyShield/durabilityTotal,0,1):.5;
    const attackStart=.08+clamp(data.enemyArmor/700,0,.06);
    const attackEnd=.72;
    const attackProgress=smooth(clamp((phase-attackStart)/Math.max(.24,attackEnd-attackStart),0,1));
    const entityProgress=finalFraction*totalEntities*attackProgress;
    const spawnGap=data.coop?.025:.046;
    const entities=[];
    for(let i=0;i<totalEntities;i++){
      const spawnTime=i*spawnGap;
      const spawned=phase>=spawnTime;
      const motion=spawned?clamp((phase-spawnTime)/Math.max(.01,.90-spawnTime),0,1):0;
      const path=data.coop?coopPathState(motion):soloPathState(motion,spawnCorner);
      const durability=entityDurability(i,entityProgress,shieldPhase,shieldEnabled,hpEnabled);
      entities.push({...durability,spawned,index:i,point:path.point,angle:path.angle});
    }
    const entries=entities.slice(0,minionCount);
    const bossState=entities[minionCount];
    const bossPoint=bossState.point;
    const target=entities.find(item=>item.spawned&&!item.dead)||null;
    const normalizedTarget=target?{kind:target.index===minionCount?'boss':'minion',state:target,point:target.point,index:target.index}:null;
    const fireRate=1.6+clamp(rate,0,180)/92;
    const artifactTempo=buildArtifactTempo(data,rate);
    const resultVisible=phase>=.76&&phase<=.985;
    const resultKind=rate>=100?'clear':rate<50?'fail':'reinforce';
    const resultMessage=battleResultMessage(resultKind,data,cycleIndex);
    const resultAlpha=smooth(clamp((phase-.76)/.055,0,1))*(1-smooth(clamp((phase-.965)/.02,0,1)));
    return {
      spawnCorner,minionCount,entries,bossState,bossPoint,target:normalizedTarget,rate,
      fireCycle:frac(time*fireRate),fireRate,cycleDuration,cycleIndex,phase,artifactTempo,
      resultVisible:resultVisible&&(resultKind!=='clear'||bossState.dead),resultKind,resultMessage,resultAlpha
    };
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
      actualRate:castFactor,
      interval,
      sustain:clamp(.72+Math.log1p(castFactor)*.38+efficiency*.06,.72,2.0),
      ringCount:castFactor>=3?3:castFactor>=1.45?2:1,
      impactRadius:18+Math.min(18,castFactor*5.5),
      intensity:clamp(.68+Math.log1p(castFactor)*.22+efficiency*.05,.68,1.35)
    };
  }
  function battleResultMessage(kind,data,cycleIndex){
    const rate=Math.max(0,number(data.achievementRate));
    if(kind==='reinforce'&&data.coop){
      if(data.defenseReduce2<=0&&data.defenseReduce3<=0) return '승객의 방어력 감소를 추가해야 할지도 몰라.';
      if(data.defenseReduce2<=0) return '2P의 방어력 감소 지원을 보강해보자.';
      if(data.defenseReduce3<=0) return '3P의 방어력 감소 지원을 보강해보자.';
    }
    const messages=rate<50?RESULT_MESSAGES.critical:rate<85?RESULT_MESSAGES.reinforce:rate<100?RESULT_MESSAGES.near:rate<150?RESULT_MESSAGES.clear:RESULT_MESSAGES.surplus;
    return messages[cycleIndex%messages.length];
  }
  function entityDurability(index,progress,shieldPhase,shieldEnabled,hpEnabled){
    const local=progress-index;
    if(local>=1) return {dead:true,shield:0,hp:0,deathAge:local-1};
    if(local<=0) return {dead:false,shield:shieldEnabled?1:0,hp:hpEnabled?1:0,deathAge:-1};
    if(!shieldEnabled) return {dead:false,shield:0,hp:clamp(1-local,0,1),deathAge:-1};
    if(!hpEnabled) return {dead:false,shield:clamp(1-local,0,1),hp:0,deathAge:-1};
    const split=clamp(shieldPhase,.02,.98);
    if(local<split) return {dead:false,shield:1-local/split,hp:1,deathAge:-1};
    return {dead:false,shield:0,hp:1-(local-split)/(1-split),deathAge:-1};
  }
  function soloPathState(progress,cornerIndex){
    const corners=[{x:.11,y:.20},{x:.89,y:.20},{x:.89,y:.83},{x:.11,y:.83}];
    const t=frac(progress+cornerIndex*.25)*4;
    const segment=Math.floor(t)%4;const local=t-segment;
    const from=corners[segment],to=corners[(segment+1)%4];
    return {point:{x:lerp(from.x,to.x,local),y:lerp(from.y,to.y,local)},angle:Math.atan2(to.y-from.y,to.x-from.x)};
  }
  function coopPathState(progress){
    const t=clamp(progress,0,1);
    if(t<.5) return {point:{x:.12,y:lerp(.14,.82,t*2)},angle:Math.PI/2};
    return {point:{x:lerp(.12,.86,(t-.5)*2),y:.82},angle:0};
  }
  function drawCastleInterior(ctx,width,height,theme,time,quality){
    ctx.fillStyle=linearGradient(ctx,0,0,0,height,[[0,'#17141b'],[.52,'#0d0b10'],[1,'#050407']]);ctx.fillRect(0,0,width,height);
    drawInteriorRearArch(ctx,width,height,theme,time);
    drawStoneCourses(ctx,0,0,width,height*.59,Math.max(20,height/9),Math.max(54,width/13),rgba(theme.castleEdge,.17),2,8,0);
    drawInteriorBannersAndChains(ctx,width,height,time);
    drawInteriorFloor(ctx,width,height);
    drawInteriorColumns(ctx,width,height,theme,time);
    for(const side of [-1,1]){
      const x=width*.5+side*width*.39,y=height*.60;ctx.save();fillPolygon(ctx,[[x-10,y],[x+10,y],[x+6,y+14],[x-6,y+14]],'rgba(65,56,57,.92)','rgba(132,108,101,.35)',.8);
      ctx.fillStyle=radialGradient(ctx,x,y-6,1,x,y-6,38,[[0,'rgba(255,181,91,.32)'],[.46,'rgba(178,62,48,.14)'],[1,'rgba(0,0,0,0)']]);ctx.fillRect(x-38,y-44,76,76);ctx.globalCompositeOperation='lighter';
      const flames=Math.max(3,Math.round(5*quality));for(let i=0;i<flames;i++){const phase=time*(2+i*.18)+i,fx=x+(i-(flames-1)/2)*2.1,fy=y-5-Math.abs(Math.sin(phase))*7;ctx.fillStyle=i%2?'#ffb057':'#d94d3d';ctx.globalAlpha=.42+.23*Math.sin(phase);ctx.beginPath();ctx.ellipse(fx,fy,2.3,6,Math.sin(phase)*.13,0,Math.PI*2);ctx.fill();}ctx.restore();
    }
    drawWallCracks(ctx,width,height,theme,time,quality);drawFloatingAsh(ctx,width,height,theme,time,quality);
  }
  function drawInteriorRearArch(ctx,width,height,theme,time){
    const cx=width*.52,top=height*.045,outerW=Math.min(width*.34,292),outerH=height*.57,innerW=outerW*.62,innerH=outerH*.86;
    ctx.save();ctx.fillStyle=radialGradient(ctx,cx,top+outerH*.58,4,cx,top+outerH*.58,outerW*.78,[[0,'rgba(55,24,32,.16)'],[.58,'rgba(20,14,20,.08)'],[1,'rgba(0,0,0,0)']]);ctx.fillRect(cx-outerW,0,outerW*2,outerH*1.35);
    roundRect(ctx,cx-outerW/2,top,outerW,outerH,outerW*.26);ctx.fillStyle=linearGradient(ctx,cx-outerW/2,top,cx+outerW/2,top+outerH,[[0,'rgba(75,66,72,.96)'],[.24,rgba(theme.castleEdge,.88)],[.64,theme.castle],[1,'rgba(15,12,17,.99)']]);ctx.fill();ctx.strokeStyle='rgba(116,101,103,.50)';ctx.lineWidth=2.2;ctx.stroke();
    roundRect(ctx,cx-innerW/2,top+outerH*.08,innerW,innerH,innerW*.23);ctx.fillStyle=linearGradient(ctx,0,top,0,top+outerH,[[0,'rgba(39,19,26,.98)'],[.5,'rgba(19,11,16,.99)'],[1,'rgba(5,4,7,1)']]);ctx.fill();ctx.strokeStyle='rgba(126,87,87,.35)';ctx.lineWidth=1.1;ctx.stroke();
    ctx.strokeStyle='rgba(104,87,89,.28)';ctx.lineWidth=.9;
    for(const offset of [0,-.24,.24]){const x=cx+innerW*offset;ctx.beginPath();ctx.moveTo(x,top+outerH*(offset? .21:.18));ctx.lineTo(x,top+outerH*(offset? .88:.91));ctx.stroke();}
    const crestY=top+outerH*.34,crestW=innerW*.22,crestH=innerH*.19;
    fillPolygon(ctx,[[cx,crestY-crestH*.45],[cx+crestW*.5,crestY-crestH*.16],[cx+crestW*.38,crestY+crestH*.38],[cx,crestY+crestH*.6],[cx-crestW*.38,crestY+crestH*.38],[cx-crestW*.5,crestY-crestH*.16]],'rgba(89,30,42,.70)',rgba(theme.bossLight,.28+.05*Math.sin(time*1.1)),1);
    ctx.strokeStyle='rgba(226,134,120,.22)';ctx.beginPath();ctx.moveTo(cx-crestW*.23,crestY-crestH*.05);ctx.lineTo(cx,crestY+crestH*.30);ctx.lineTo(cx+crestW*.23,crestY-crestH*.05);ctx.stroke();
    ctx.fillStyle=linearGradient(ctx,0,top+outerH*.82,0,top+outerH,[[0,'rgba(94,50,44,.08)'],[1,'rgba(221,116,70,.18)']]);ctx.fillRect(cx-innerW*.42,top+outerH*.73,innerW*.84,outerH*.20);ctx.restore();
  }
  function drawInteriorBannersAndChains(ctx,width,height,time){
    for(const x of [width*.15,width*.85]) drawHangingDecor(ctx,'chain',x,height*.02,7,height*.066,'rgba(104,91,91,.48)');
    for(const side of [-1,1]) drawHangingDecor(ctx,'banner',width*.5+side*width*.31,height*.10,width*.060,height*.31,side,time,side<0?'rgba(92,21,42,.82)':'rgba(113,24,43,.82)');
  }
  function drawInteriorFloor(ctx,width,height){
    const horizon=height*.56;ctx.fillStyle=linearGradient(ctx,0,horizon,0,height,[[0,'rgba(31,25,29,.55)'],[.4,'rgba(22,18,21,.94)'],[1,'rgba(7,6,8,1)']]);ctx.fillRect(0,height*.52,width,height*.48);
    drawPerspectiveSlabs(ctx,{topY:horizon,bottomY:height,topLeft:width*.44,topRight:width*.56,bottomLeft:0,bottomRight:width,rows:6,stroke:'rgba(112,97,95,.20)',seed:9});
    ctx.save();fillPolygon(ctx,[[width*.465,horizon],[width*.575,horizon],[width*.69,height],[width*.31,height]],linearGradient(ctx,0,horizon,0,height,[[0,'rgba(74,23,37,.25)'],[.52,'rgba(58,17,30,.40)'],[1,'rgba(34,10,18,.62)']]),'rgba(155,74,75,.20)',1);
    ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(width*.52,height*.78,width*.19,height*.055,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function drawInteriorColumns(ctx,width,height,theme,time){
    const columns=[.06,.235,.765,.94];ctx.save();
    columns.forEach((ratio,index)=>{
      const x=width*ratio,near=index===0||index===3,shaftW=Math.max(18,width*(near?.040:.033));
      const top=height*(near?.015:.075),floorY=height*.78,baseW=shaftW*(near?2.2:1.95),baseH=height*(near?.075:.064);
      ctx.fillStyle=radialGradient(ctx,x,floorY+baseH*.18,2,x,floorY+baseH*.18,baseW*.95,[[0,'rgba(0,0,0,.66)'],[1,'rgba(0,0,0,0)']]);ctx.beginPath();ctx.ellipse(x,floorY+baseH*.23,baseW*.95,baseH*.40,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=linearGradient(ctx,x-shaftW,0,x+shaftW,0,[[0,'rgba(6,5,8,.98)'],[.22,rgba(theme.castleEdge,.58)],[.52,theme.castle],[.8,rgba(theme.castleEdge,.46)],[1,'rgba(5,4,7,.98)']]);ctx.fillRect(x-shaftW/2,top,shaftW,floorY-top);
      ctx.fillStyle=rgba(theme.castleEdge,.82);ctx.fillRect(x-shaftW*.78,top,shaftW*1.56,height*.038);ctx.fillRect(x-shaftW*.66,top+height*.04,shaftW*1.32,height*.025);
      ctx.fillStyle=linearGradient(ctx,x-baseW/2,0,x+baseW/2,0,[[0,'rgba(8,6,9,.98)'],[.34,rgba(theme.castleEdge,.76)],[.58,theme.castle],[1,'rgba(7,5,8,.98)']]);
      for(const [scale,yOffset,hScale] of [[.84,-.25,.32],[1.04,.02,.30],[1.24,.28,.22]]) ctx.fillRect(x-baseW*scale/2,floorY+baseH*yOffset,baseW*scale,baseH*hScale);
      ctx.strokeStyle='rgba(138,109,105,.16)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,top+height*.07);ctx.lineTo(x,floorY-baseH*.30);ctx.stroke();
      ctx.fillStyle=rgba(theme.bossLight,.18+.05*Math.sin(time*1.6+index));ctx.beginPath();ctx.arc(x,top+height*.18,1.8,0,Math.PI*2);ctx.fill();
    });ctx.restore();
  }
  function drawWallCracks(ctx,width,height,theme,time,quality){
    const count=Math.max(4,Math.round(9*quality));ctx.save();ctx.strokeStyle=rgba(theme.bossLight,.38);ctx.lineWidth=1;ctx.globalCompositeOperation='lighter';
    for(let i=0;i<count;i++){
      let x=width*(.06+hash(i+11)*.88),y=height*(.10+hash(i+29)*.43);ctx.globalAlpha=.13+.12*Math.sin(time*.8+i);ctx.beginPath();ctx.moveTo(x,y);
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
  function drawRoute(ctx,width,height,coop,theme,corner){
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=theme.routeGlow;ctx.lineWidth=7;
    ctx.beginPath();if(coop){ctx.moveTo(width*.12,height*.14);ctx.lineTo(width*.12,height*.82);ctx.lineTo(width*.86,height*.82);}else{ctx.rect(width*.11,height*.20,width*.78,height*.63);}ctx.stroke();
    ctx.strokeStyle=theme.route;ctx.lineWidth=1.8;ctx.setLineDash([6,9]);ctx.lineDashOffset=-corner*7;ctx.stroke();ctx.setLineDash([]);ctx.restore();
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
      facing:targetX<x?-1:1,time,label:'나',main:true,aim:true,recoil,bodyRotation:0,labelPosition:'above'
    });
  }

  function drawDefenseRelic(ctx,width,height,data,model,time){
    const x=width*.52;
    const y=height*.76;
    const base=Math.min(width/440,height/210);
    return drawRelic(ctx,x,y,base*(data.coop?.82:.92),{
      time:time*1.1,label:'유물',active:true,charge:clamp(model.rate/120,.45,1)
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
          if(shieldHit) drawShieldHexBurst(ctx,tx,ty,color,impact,quality);
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
  function drawCoopSupport(ctx,width,height,data,model,time){
    const narrow=width<480;
    const size=Math.min(width/440,height/210)*(narrow?.43:.50);
    const p2={x:width*(narrow?.29:.34),y:height*(narrow?.69:.74)};
    const p3={x:width*(narrow?.71:.69),y:height*(narrow?.69:.74)};
    const target=model.target?{x:model.target.point.x*width,y:model.target.point.y*height-(model.target.kind==='boss'?28:8)}:null;
    drawDefenseReductionEffect(ctx,p2,target,PLAYER_COLORS.p2,data.defenseReduce2,time,0,'triangle');
    drawDefenseReductionEffect(ctx,p3,target,PLAYER_COLORS.p3,data.defenseReduce3,time,1.37,'diamond');
    drawHero(ctx,p2.x,p2.y,size,PLAYER_COLORS.p2,{facing:1,time:time+.6,label:'2P',supportPose:true,labelPosition:'above'});
    drawHero(ctx,p3.x,p3.y,size,PLAYER_COLORS.p3,{facing:-1,time:time+1.1,label:'3P',supportPose:true,labelPosition:'above'});
    const badgeY=p2.y-132*size-23;
    if(defenseReductionLevel(data.defenseReduce2)>0) drawDefenseReductionBadge(ctx,p2.x,badgeY,PLAYER_COLORS.p2,data.defenseReduce2,'triangle','2P');
    if(defenseReductionLevel(data.defenseReduce3)>0) drawDefenseReductionBadge(ctx,p3.x,badgeY,PLAYER_COLORS.p3,data.defenseReduce3,'diamond','3P');
  }
  function defenseReductionLevel(value){const v=number(value);if(v>=60)return 4;if(v>=50)return 3;if(v>=25)return 2;if(v>=15)return 1;return 0;}
  function drawDefenseReductionEffect(ctx,source,target,color,value,time,offset,shape){
    const level=defenseReductionLevel(value);if(level<=0) return;
    const direction=shape==='triangle'?1:-1;
    const pulse=frac(time*(.24+level*.025)*direction+offset);
    const sourceRadius=16+level*2.2;
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.strokeStyle=color.main;
    ctx.lineWidth=1+level*.16;
    ctx.globalAlpha=.14+level*.025;
    ctx.beginPath();ctx.ellipse(source.x,source.y,sourceRadius,5.5+level*.55,0,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=(1-pulse)*(.10+level*.018);
    ctx.beginPath();ctx.ellipse(source.x,source.y,sourceRadius+8*pulse,6+(4+level)*pulse,0,0,Math.PI*2);ctx.stroke();
    drawSupportSigil(ctx,source.x,source.y-20,7.5+level*.75,color,shape,.48+level*.035);
    if(target){
      const dx=target.x-source.x,dy=target.y-source.y;
      ctx.save();
      ctx.setLineDash([4,8]);
      ctx.lineDashOffset=-time*(10+level*2.5)*direction;
      ctx.lineWidth=.8+level*.10;
      ctx.globalAlpha=.10+level*.018;
      ctx.beginPath();ctx.moveTo(source.x,source.y-15);ctx.quadraticCurveTo(source.x+dx*.48,source.y+dy*.30-10,target.x,target.y);ctx.stroke();
      ctx.restore();
      const targetRadius=11+level*1.8;
      ctx.globalAlpha=.09+level*.018;
      ctx.lineWidth=.9+level*.10;
      ctx.beginPath();ctx.ellipse(target.x,target.y,targetRadius,targetRadius*.72,0,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=.18+level*.02;
      drawSupportSigil(ctx,target.x,target.y-targetRadius-6,4.2+level*.35,color,shape,.36+level*.025);
    }
    ctx.restore();
  }
  function drawSupportSigil(ctx,x,y,radius,color,shape,alpha){
    ctx.save();ctx.strokeStyle=color.light;ctx.fillStyle=rgba(color.main,.16);ctx.globalAlpha=alpha;ctx.lineWidth=1.6;
    ctx.beginPath();
    if(shape==='triangle'){ctx.moveTo(x,y-radius);ctx.lineTo(x+radius*.9,y+radius*.65);ctx.lineTo(x-radius*.9,y+radius*.65);ctx.closePath();}
    else{ctx.moveTo(x,y-radius);ctx.lineTo(x+radius,y);ctx.lineTo(x,y+radius);ctx.lineTo(x-radius,y);ctx.closePath();}
    ctx.fill();ctx.stroke();ctx.restore();
  }
  function drawDefenseReductionBadge(ctx,x,y,color,value,shape,label){
    const text=`${label} -${Math.round(number(value))}`;
    ctx.save();
    ctx.font='900 9px Pretendard, sans-serif';
    const width=Math.max(34,ctx.measureText(text).width+21);
    roundRect(ctx,x-width/2,y-9,width,18,9);
    ctx.fillStyle='rgba(4,8,15,.88)';ctx.fill();
    ctx.strokeStyle=color.main;ctx.globalAlpha=.92;ctx.lineWidth=1.1;ctx.stroke();
    drawSupportSigil(ctx,x-width/2+9,y,4.3,color,shape,.95);
    ctx.fillStyle=color.light;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x+4,y+.5);
    ctx.restore();
  }
  function drawHeroAttack(ctx,width,height,data,theme,model,hero,time,quality){
    if(!model.target) return;
    const targetX=model.target.point.x*width;
    const targetY=model.target.point.y*height-(model.target.kind==='boss'?32:7);
    const cycle=model.fireCycle;
    const charge=smooth(clamp((cycle-.10)/.18,0,1))*(1-smooth(clamp((cycle-.32)/.07,0,1)));
    const projectile=smooth(clamp((cycle-.32)/.34,0,1));
    const projectileVisible=cycle>=.32&&cycle<=.71;
    const impact=smooth(clamp((cycle-.68)/.10,0,1))*(1-smooth(clamp((cycle-.88)/.10,0,1)));
    ctx.save();ctx.globalCompositeOperation='lighter';
    if(charge>0){
      ctx.fillStyle=PLAYER_COLORS.p1.light;ctx.shadowColor=PLAYER_COLORS.p1.main;ctx.shadowBlur=18;ctx.globalAlpha=.35+.55*charge;ctx.beginPath();ctx.arc(hero.muzzle.x,hero.muzzle.y,2+charge*5,0,Math.PI*2);ctx.fill();
    }
    if(projectileVisible){
      const x=lerp(hero.muzzle.x,targetX,projectile),y=lerp(hero.muzzle.y,targetY,projectile);
      const trailStart=Math.max(0,projectile-.18);
      const tx=lerp(hero.muzzle.x,targetX,trailStart),ty=lerp(hero.muzzle.y,targetY,trailStart);
      const gradient=ctx.createLinearGradient(tx,ty,x,y);gradient.addColorStop(0,'rgba(47,140,255,0)');gradient.addColorStop(.48,PLAYER_COLORS.p1.glow);gradient.addColorStop(1,PLAYER_COLORS.p1.light);
      ctx.strokeStyle=gradient;ctx.lineWidth=1.6+clamp(model.rate/85,0,2.2);ctx.globalAlpha=.82;ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(x,y);ctx.stroke();
      ctx.fillStyle='#eaffff';ctx.shadowColor=PLAYER_COLORS.p1.main;ctx.shadowBlur=15;ctx.beginPath();ctx.arc(x,y,2.4+clamp(model.rate/110,0,1.8),0,Math.PI*2);ctx.fill();
    }
    if(impact>0){
      const shieldHit=model.target.state.shield>0;const color=shieldHit?theme.shield:theme.hp;
      ctx.strokeStyle=color;ctx.globalAlpha=.85*(1-impact*.45);ctx.lineWidth=1.7+impact*2.1;
      ctx.beginPath();ctx.arc(targetX,targetY,6+impact*25,0,Math.PI*2);ctx.stroke();
      if(shieldHit){drawShieldHexBurst(ctx,targetX,targetY,color,impact,quality);}
      else{drawArmorImpact(ctx,targetX,targetY,color,impact,quality);}
      if(data.enemyArmor>0&&model.rate<100){ctx.globalAlpha=(1-impact)*.31;ctx.strokeStyle=theme.route;drawHexagon(ctx,targetX,targetY,12+impact*10);ctx.stroke();}
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
    const glow=ctx.createRadialGradient(centerX,centerY,4,centerX,centerY,Math.min(width*.34,170));glow.addColorStop(0,rgba(color,.24));glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    const boxWidth=Math.min(width*.82,410),boxHeight=width<480?72:78;
    roundRect(ctx,centerX-boxWidth/2,centerY-boxHeight/2,boxWidth,boxHeight,13);ctx.fillStyle='rgba(3,7,14,.90)';ctx.fill();ctx.strokeStyle=rgba(accent,.72);ctx.lineWidth=1.4;ctx.stroke();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.shadowColor=rgba(color,.72);ctx.shadowBlur=12;ctx.font=`1000 ${width<480?17:21}px Pretendard, sans-serif`;ctx.fillText(title,centerX,centerY-18);ctx.shadowBlur=0;
    ctx.fillStyle='#eaf2ff';ctx.font=`800 ${width<480?9.2:10.7}px Pretendard, sans-serif`;
    const lines=wrapDialogueLines(ctx,model.resultMessage,boxWidth-28,2);
    const startY=centerY+(lines.length>1?8:13);
    lines.forEach((line,index)=>ctx.fillText(line,centerX,startY+index*12));
    if(kind==='clear'){
      ctx.globalCompositeOperation='lighter';ctx.strokeStyle=accent;ctx.globalAlpha=alpha*.62;for(let i=0;i<8;i++){const a=i*Math.PI/4+time*.15,r=boxWidth*.42;ctx.beginPath();ctx.moveTo(centerX+Math.cos(a)*r*.72,centerY+Math.sin(a)*20);ctx.lineTo(centerX+Math.cos(a)*r,centerY+Math.sin(a)*28);ctx.stroke();}
    }
    ctx.restore();
  }
  function drawShieldHexBurst(ctx,x,y,color,impact,quality){
    const count=Math.round(6*quality);ctx.strokeStyle=color;ctx.lineWidth=1;
    for(let i=0;i<count;i++){const a=i*Math.PI*2/count;const r=10+impact*23;ctx.globalAlpha=(1-impact)*.38;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*r*.55,y+Math.sin(a)*r*.55);ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);ctx.stroke();}
    ctx.globalAlpha=.28*(1-impact);drawHexagon(ctx,x,y,14+impact*18);ctx.stroke();
  }
  function drawArmorImpact(ctx,x,y,color,impact,quality){
    const count=Math.round(7*quality);ctx.strokeStyle=color;ctx.lineWidth=1.4;
    for(let i=0;i<count;i++){const a=i*Math.PI*2/count+hash(i)*.3;const r=7+impact*(18+hash(i+7)*15);ctx.globalAlpha=(1-impact)*.55;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);ctx.stroke();}
  }

  function heroArtFor(color){if(color===PLAYER_COLORS.p2)return art.heroP2;if(color===PLAYER_COLORS.p3)return art.heroP3;return art.heroP1;}
  function drawArtAnchored(ctx,image,x,y,width,height,options={}){if(!isImageReady(image))return false;ctx.save();ctx.globalAlpha=options.alpha??1;ctx.translate(x,y);if(options.rotation)ctx.rotate(options.rotation);if(options.flip)ctx.scale(-1,1);ctx.scale(options.scaleX??1,options.scaleY??1);ctx.drawImage(image,-width/2,-height,width,height);ctx.restore();return true;}
  function drawHero(ctx,x,y,scale,color,options={}){
    const facing=options.facing===-1?-1:1,time=number(options.time),bob=options.aim?Math.sin(time*1.8)*.18*scale:Math.sin(time*2.6)*1.15*scale,mainScale=options.main?1.08:1,width=104*scale*mainScale,height=122*scale*mainScale,image=options.aim&&color===PLAYER_COLORS.p1?art.heroAimP1:heroArtFor(color),recoil=number(options.recoil),rotation=options.aim?0:number(options.bodyRotation),anchorX=x-facing*recoil,anchorY=y-bob;
    drawGroundGlow(ctx,x,y+2,34*scale*mainScale,color.glow,options.main?.36:.22);if(options.main)drawHeroEnergyMantle(ctx,x,y-bob-height*.48,scale,color,time,1.25,1);if(options.supportPose)drawSupportReadyLines(ctx,x,y-height*.48,scale,color,time);if(options.aim)drawBracedStance(ctx,x,y,scale,color,facing,recoil);drawArtAnchored(ctx,image,anchorX,anchorY,width,height,{flip:facing<0,rotation});
    const labelY=options.labelPosition==='side'?anchorY-height*.54:anchorY-height-8;drawPlayerLabel(ctx,x,labelY,options.label,color,scale,1);
    const localX=facing*width*.57,localY=-height*.54,cos=Math.cos(rotation),sin=Math.sin(rotation);return{x:anchorX,y:anchorY,muzzle:{x:anchorX+localX*cos-localY*sin,y:anchorY+localX*sin+localY*cos}};
  }
  function drawBracedStance(ctx,x,y,scale,color,facing,recoil){ctx.save();ctx.strokeStyle=color.main;ctx.globalAlpha=.22;ctx.lineWidth=Math.max(1,1.15*scale);ctx.beginPath();ctx.moveTo(x-facing*(13+recoil)*scale,y-5*scale);ctx.lineTo(x-facing*22*scale,y+2*scale);ctx.moveTo(x+facing*7*scale,y-5*scale);ctx.lineTo(x+facing*17*scale,y+2*scale);ctx.stroke();ctx.fillStyle=rgba(color.main,.20);ctx.beginPath();ctx.ellipse(x-facing*19*scale,y+3*scale,7*scale,2*scale,0,0,Math.PI*2);ctx.ellipse(x+facing*15*scale,y+3*scale,7*scale,2*scale,0,0,Math.PI*2);ctx.fill();ctx.restore();}
  function drawSupportReadyLines(ctx,x,y,scale,color,time){ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=color.main;ctx.globalAlpha=.18+.08*Math.sin(time*2);ctx.lineWidth=1;for(let i=0;i<2;i++){ctx.beginPath();ctx.arc(x,y,(19+i*8)*scale,Math.PI*.15,Math.PI*.85);ctx.stroke();}ctx.restore();}
  function drawPlayerLabel(ctx,x,y,label,color,scale,alpha){
    if(!label) return;
    ctx.save();
    ctx.font=`1000 ${Math.max(8,9.2*scale)}px Pretendard, sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    const width=Math.max(18,ctx.measureText(label).width+10),height=Math.max(13,14*scale);
    const canvasWidth=ctx.canvas.clientWidth||ctx.canvas.width;
    const canvasHeight=ctx.canvas.clientHeight||ctx.canvas.height;
    const safeX=clamp(x,width/2+3,canvasWidth-width/2-3);
    const safeY=clamp(y,height/2+3,canvasHeight-height/2-3);
    roundRect(ctx,safeX-width/2,safeY-height/2,width,height,height/2);
    ctx.fillStyle='rgba(2,6,12,.86)';ctx.globalAlpha=.88*alpha;ctx.fill();
    ctx.strokeStyle=color.main;ctx.lineWidth=1;ctx.globalAlpha=.92*alpha;ctx.stroke();
    ctx.fillStyle=color.light;ctx.shadowColor=color.glow;ctx.shadowBlur=5;ctx.globalAlpha=alpha;
    ctx.fillText(label,safeX,safeY+.3);ctx.restore();
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

  function drawGroundGlow(ctx,x,y,radius,color,alpha){
    ctx.save();const glow=ctx.createRadialGradient(x,y,2,x,y,radius);glow.addColorStop(0,color);glow.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=alpha;ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(x,y,radius,radius*.20,0,0,Math.PI*2);ctx.fill();ctx.restore();
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
  function drawHexagon(ctx,x,y,radius){ctx.beginPath();for(let i=0;i<6;i++){const angle=-Math.PI/2+i*Math.PI/3;const px=x+Math.cos(angle)*radius,py=y+Math.sin(angle)*radius;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();}
  function roundRect(ctx,x,y,width,height,radius){const r=Math.max(0,Math.min(radius,Math.min(width,height)/2));ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+width,y,x+width,y+height,r);ctx.arcTo(x+width,y+height,x,y+height,r);ctx.arcTo(x,y+height,x,y,r);ctx.arcTo(x,y,x+width,y,r);ctx.closePath();}

  window.Battle=Object.freeze({init,update,refresh,destroy});
})();
