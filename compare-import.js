/* ===== compare-import.js | 엑셀·저장파일·프리셋 비교 / 현재값 적용 ===== */
/* 외부 파일을 읽어 현재 입력 상태와 비교하고, 사용자가 선택한 변경값을 현재 계산기에 적용한다. */

/* ===== 00. 비교 상태 / 비교 대상 정의 ===== */
const compareState={workbook:null,backupState:null,traitPresetBundle:null,baseTraitPresetBundle:null,sourceType:null,lastResult:null,activeFilter:'all',restoreState:null,applied:false,selectedSheetName:'',baseTraitPresetId:''};
function resetCompareState(){Object.assign(compareState,{workbook:null,backupState:null,traitPresetBundle:null,baseTraitPresetBundle:null,sourceType:null,lastResult:null,activeFilter:'all',restoreState:null,applied:false,selectedSheetName:'',baseTraitPresetId:''});}
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
/* ===== 01. XLSX ZIP / XML 파서 ===== */
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
  if(eocd<0) throw new Error('올바른 엑셀파일이 아닙니다.');
  const count=readU16(view,eocd+10);
  let pos=readU32(view,eocd+16);
  const decoder=new TextDecoder();
  const entries=new Map();
  for(let i=0;i<count;i++){
    if(readU32(view,pos)!==0x02014b50) throw new Error('엑셀파일 ZIP 목록을 읽을 수 없습니다.');
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
    else throw new Error(`지원하지 않는 엑셀파일 압축 방식입니다. (${method})`);
    entries.set(name,data);
    pos+=46+nameLength+extraLength+commentLength;
  }
  return entries;
}
function parseXml(bytes){
  const xml=new TextDecoder('utf-8').decode(bytes);
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror')) throw new Error('엑셀파일 XML을 해석하지 못했습니다.');
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
  if(!sheets.length) throw new Error('비교할 엑셀 시트를 찾을 수 없습니다.');
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
/* ===== 02. 비교값 정규화 / 행 생성 유틸 ===== */
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
  const select=$(id);
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
  if(id==='pbless') return powerBlessDisplayText(value);
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
  const display=values=>{
    const v=normalizeRuneChoiceValue(values?.runeChoiceValue);
    if(v===0) return '없음';
    const t=normalizeRuneChoiceType(values?.runeChoiceType);
    return `${RUNE_CHOICE_TYPE_LABELS[t] || RUNE_CHOICE_TYPE_LABELS.harmony} +${v.toLocaleString('ko-KR')}`;
  };
  return buildCompareTextRow(kind, '룬 특수 옵션', display(changeValues), display(currentValues));
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
function webControlDisplay(id){
  const el=$(id);
  if(!el) return '—';
  if(EROSION_CONTROL_IDS.has(id)) return erosionStoredValue(id);
  if(id==='round') return targetRoundStoredValue();
  if(id==='challengeTowerFloor') return challengeTowerFloorStoredValue();
  if(el.type==='checkbox') return el.checked?'ON':'OFF';
  return String(el.value??'');
}
/* ===== 03. 입력 필드 레지스트리 / 엑셀 값 매핑 ===== */
const EXCEL_TITLE_BONUS_MAP={'패왕':'12','패왕+':'13','제왕':'14','제왕+':'15','신황':'16','신황+':'17'};
const EXCEL_RUNE_TYPE_MAP={'AP':'ap','UA':'ua','TD':'td','TD&UA':'harmony','TD＆UA':'harmony','마법공격력':'ap','마법 공격력':'ap','유닛가속':'ua','유닛 가속':'ua','총데미지':'td','총 데미지':'td','총데미지&유닛가속':'harmony','총 데미지 & 유닛 가속':'harmony','총뎀가속':'harmony'};
const FIELD_REGISTRY={
  sp:{kind:'기본정보',name:'총 SP',compare:true,save:true,excel:'number'},
  xp:{kind:'기본정보',name:'보유 XP',compare:true,save:true,excel:'number'},
  bxp:{kind:'기본정보',name:'보유 BXP',compare:true,save:true,excel:'number'},
  rp:{kind:'기본정보',name:'보유 RP',compare:true,save:true,excel:'number'},
  soul:{kind:'기본정보',name:'본인 심연의혼',compare:true,save:true,excel:'number'},
  diff:{kind:'기본정보',name:'난이도',compare:true,save:true,excel:'select'},
  round:{kind:'기본정보',name:'목표 라운드',compare:true,save:true,excel:'number'},
  challengeTowerFloor:{kind:'기본정보',name:'도전의탑 층',compare:true,save:true,excel:'number'},
  soloMode:{kind:'기본정보',name:'개인',compare:true,save:true,excel:'select'},
  coopMode:{kind:'기본정보',name:'협동',compare:true,save:true,excel:'select'},
  coopPlayers:{kind:'기본정보',name:'협동 인원수',compare:true,save:true,excel:'select'},
  team:{kind:'기본정보',name:'출발 지원 인원수',compare:true,save:true,excel:'number'},
  pbless:{kind:'기본정보',name:'파워 블레스',compare:true,save:true,excel:'select'},
  spBankApply:{kind:'기본정보',name:'SP 은행',compare:true,save:true},
  penance:{kind:'기본정보',name:'고행 단계',compare:true,save:true,excel:'number'},
  titleTdBonus:{kind:'기본정보',name:'타이틀 총 데미지',compare:true,save:true,excel:'number'},
  dpsTableMinDps:{kind:'DPS',name:'도전할 최소 DPS',compare:true,save:true,excel:'number'},
  erosionStack:{kind:'기본정보',name:'침식 스텍',compare:true,save:true,excel:'number'},
  jewelErosionRes:{kind:'기본정보',name:'침식 내성',compare:true,save:true,excel:'number'},
  aprRuneNormal:{kind:'룬효과/버프',name:'4월 일반',compare:true,save:true},
  aprRunePlus:{kind:'룬효과/버프',name:'4월 강화(+)',compare:true,save:true},
  sepRuneNormal:{kind:'룬효과/버프',name:'9월 일반',compare:true,save:true},
  sepRunePlus:{kind:'룬효과/버프',name:'9월 강화(+)',compare:true,save:true},
  overEnhance:{kind:'룬효과/버프',name:'오버핸스',compare:true,save:true},
  repairEnhance:{kind:'룬효과/버프',name:'리페핸스',compare:true,save:true},
  enhanceMaster:{kind:'룬효과/버프',name:'강화의 달인',compare:true,save:true},
  dailyCouponBuff:{kind:'룬효과/버프',name:'일일쿠폰',compare:true,save:true},
  shareUserBuff:{kind:'룬효과/버프',name:'나눔유저',compare:true,save:true},
  unitUniqueBuff:{kind:'룬효과/버프',name:'단일유닛버프',compare:true,save:true},
  basePierceBuff:{kind:'룬효과/버프',name:'방어력관통 10%',compare:true,save:true},
  prodArtifact:{kind:'룬효과/버프',name:'유물',compare:true,save:true},
  prodNova:{kind:'룬효과/버프',name:'노바',compare:true,save:true},
  prodTeratron:{kind:'룬효과/버프',name:'테라트론',compare:true,save:true},
  prodAmon:{kind:'룬효과/버프',name:'아몬',compare:true,save:true},
  prodAdun:{kind:'룬효과/버프',name:'아둔의 창',compare:true,save:true},
  prodKerrigan:{kind:'룬효과/버프',name:'불새 케리건',compare:true,save:true},
  prodOvermind:{kind:'룬효과/버프',name:'초월체',compare:true,save:true},
  prodNarud:{kind:'룬효과/버프',name:'나루드',compare:true,save:true},
  flowerSkill1:{kind:'룬효과/버프',name:'근성의 꽃가루',compare:true,save:true},
  flowerSkill2:{kind:'룬효과/버프',name:'바람의 꽃가루',compare:true,save:true},
  flowerSkill3:{kind:'룬효과/버프',name:'안개의 꽃가루',compare:true,save:true},
  rAD:{kind:'룬정보',name:'공격력',compare:true,save:true,excel:'number'},
  rModAD:{kind:'룬정보',name:'공격력 개조',compare:true,save:true,excel:'number'},
  runeChoiceType:{kind:'룬정보',name:'룬 특수 옵션',compare:true,save:true,excel:'select'},
  runeChoiceValue:{kind:'룬정보',name:'룬 특수 옵션',compare:true,save:true,excel:'number'},
  rAS:{kind:'룬정보',name:'공격속도',compare:true,save:true,excel:'number'},
  rModAS:{kind:'룬정보',name:'공격속도 개조',compare:true,save:true,excel:'number'},
  rCD:{kind:'룬정보',name:'크리티컬 데미지',compare:true,save:true,excel:'number'},
  rModCD:{kind:'룬정보',name:'크리티컬 데미지 개조',compare:true,save:true,excel:'number'},
  rCRI:{kind:'룬정보',name:'크리티컬 확률',compare:true,save:true,excel:'number'},
  rModCRI:{kind:'룬정보',name:'크리티컬 확률 개조',compare:true,save:true,excel:'number'},
  rReinf:{kind:'룬정보',name:'룬 강화 수',compare:true,save:true,excel:'number'},
  rAsc:{kind:'룬정보',name:'룬 각성',compare:true,save:true,excel:'select'},
  raceOpt:{kind:'룬정보',name:'종족 업그레이드',compare:true,save:true,excel:'select'},
  opt10:{kind:'룬정보',name:'10강 옵션',compare:true,save:true,excel:'select'},
  opt15:{kind:'룬정보',name:'15강 옵션',compare:true,save:true,excel:'select'},
  transOpt:{kind:'룬정보',name:'초월 옵션',compare:true,save:true,excel:'select'},
  addAD:{kind:'에디셔널',name:'공격력',compare:true,save:true,excel:'number'},
  addAS:{kind:'에디셔널',name:'공격속도',compare:true,save:true,excel:'number'},
  addCD:{kind:'에디셔널',name:'크리티컬 데미지',compare:true,save:true,excel:'number'},
  addCRI:{kind:'에디셔널',name:'크리티컬 확률',compare:true,save:true,excel:'number'},
  addAP:{kind:'에디셔널',name:'마법공격력',compare:true,save:true,excel:'number'},
  addTD:{kind:'에디셔널',name:'총 데미지',compare:true,save:true,excel:'number'},
  addUA:{kind:'에디셔널',name:'유닛 가속',compare:true,save:true,excel:'number'},
  enchAD:{kind:'인첸트',name:'공격력',save:true,excel:'number'},
  enchCRI:{kind:'인첸트',name:'크리티컬 확률',save:true,excel:'number'},
  enchUA:{kind:'인첸트',name:'유닛 가속',save:true,excel:'number'},
  enchTD:{kind:'인첸트',name:'총 데미지',save:true,excel:'number'},
  enchSR:{kind:'인첸트',name:'실드 감소',save:true,excel:'number'},
  enchHR:{kind:'인첸트',name:'체력 감소',save:true,excel:'number'},
  enchantCode:{kind:'인첸트',name:'인첸트 코드',save:true},
  optTier:{kind:'특성보드',name:'특성 최적화 범위',compare:true,save:true},
  utilOptTier:{kind:'특성보드',name:'유틸 마스터 범위',compare:true,save:true},
  traitLimitAD:{kind:'특성보드 / 특성 투자 제한',name:'공격력',compare:true,save:true},
  traitLimitAS:{kind:'특성보드 / 특성 투자 제한',name:'공격속도',compare:true,save:true},
  traitLimitCRI:{kind:'특성보드 / 특성 투자 제한',name:'크리티컬 확률',compare:true,save:true},
  traitLimitCD:{kind:'특성보드 / 특성 투자 제한',name:'크리티컬 데미지',compare:true,save:true},
  traitLimitMC:{kind:'특성보드 / 특성 투자 제한',name:'다중 크리',compare:true,save:true},
  traitLimitDR:{kind:'특성보드 / 특성 투자 제한',name:'방어력 감소',compare:true,save:true},
  traitLimitTD:{kind:'특성보드 / 특성 투자 제한',name:'총 데미지',compare:true,save:true},
  traitLimitUA:{kind:'특성보드 / 특성 투자 제한',name:'유닛 가속',compare:true,save:true},
  traitLimitMultiTarget:{kind:'특성보드 / 특성 투자 제한',name:'멀티타겟',compare:true,save:true},
  traitLimitInfinite:{kind:'특성보드 / 특성 투자 제한',name:'무한특성',compare:true,save:true},
  skillDouble:{kind:'성소스킬보드',name:'더블스페',compare:true,save:true,excel:'number'},
  skillMode:{kind:'성소스킬보드',name:'모드',compare:true,save:true},
  skillRound:{kind:'성소스킬보드',name:'라운드',compare:true,save:true,excel:'number'},
  unitGrade:{kind:'유닛정보',name:'유닛 등급',compare:true},
  unitLevel:{kind:'유닛정보',name:'유닛 레벨',compare:true},
};
const fieldEntriesByFlag=flag=>Object.entries(FIELD_REGISTRY).filter(([,field])=>field[flag]).map(([id])=>id);
const EXCEL_NUMERIC_INPUT_IDS=new Set(Object.entries(FIELD_REGISTRY).filter(([,field])=>field.excel==='number').map(([id])=>id));
const EXCEL_SELECT_INPUT_IDS=new Set(Object.entries(FIELD_REGISTRY).filter(([,field])=>field.excel==='select').map(([id])=>id));
const COMPARE_VALUE_META=Object.fromEntries(Object.entries(FIELD_REGISTRY).filter(([,field])=>field.compare).map(([id,field])=>[id,{kind:field.kind,name:field.name}]));
const USER_STATE_VALUE_IDS=new Set(fieldEntriesByFlag('save'));
const ENCHANT_COMPARE_ITEMS=[['enchAD','공격력'],['enchCRI','크리티컬 확률'],['enchUA','유닛 가속'],['enchTD','총 데미지'],['enchSR','실드 감소'],['enchHR','체력 감소']];
const LATEST_SPEC_ADDITIONAL_STRUCTURE_MESSAGE='불러온 엑셀파일은 5.4392 버전과 구조가 달라 프리셋 분석 기능을 사용할 수 없습니다.';
const LATEST_SPEC_ADDITIONAL_LABELS=[['Q36','AD'],['Q37','AS'],['Q38','CD'],['Q39','CRI'],['Q40','AP'],['Q41','TD'],['Q42','UA']];
const SPEC_ADDITIONAL_CELLS={addAD:'R36',addAS:'R37',addCD:'R38',addCRI:'R39',addAP:'R40',addTD:'R41',addUA:'R42'};
/* ===== 04. 엑셀 스펙 구조 검사 / 인첸트·룬 비교 ===== */
function normalizeStructureText(value){
  return excelText(value).replace(/\s+/g,'').toLowerCase();
}
function inspectSpecAdditionalStructure(specCells){
  const mismatches=LATEST_SPEC_ADDITIONAL_LABELS.filter(([ref,expected])=>
    normalizeStructureText(specCells[ref])!==normalizeStructureText(expected)
  ).map(([ref,expected])=>({ref,expected,actual:excelText(specCells[ref])||'값 없음'}));
  return { valid:mismatches.length===0, mismatches, message:LATEST_SPEC_ADDITIONAL_STRUCTURE_MESSAGE };
}
function validateTraitPresetExcelSpecAdditionalStructure(workbook){
  try{
    const specCells=workbook?.getCells?.('스펙');
    const additionalInfo=inspectSpecAdditionalStructure(specCells || {});
    if(!additionalInfo.valid) throw new Error(additionalInfo.message);
  }catch(e){
    throw new Error(LATEST_SPEC_ADDITIONAL_STRUCTURE_MESSAGE);
  }
}
function getSpecAdditionalValue(specCells, id){
  const ref=SPEC_ADDITIONAL_CELLS[id];
  const value=ref ? specCells[ref] : undefined;
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
function applyRuneChoiceState(values, cells){
  const type=excelStateValue('runeChoiceType', cells.I6, {valueMap:EXCEL_RUNE_TYPE_MAP}) || 'harmony';
  const value=excelNumber(cells.J6) ?? 0;
  values.runeChoiceType=type;
  values.runeChoiceValue=String(value);
  RUNE_CHOICE_TARGETS.forEach(([kind,id])=>{ values[id]=String(kind===type ? value : 0); });
}
function buildExcelChoiceRow(name, excel, id, options={}){
  const changeValue=options.boolean ? (excelFlag(excel)?'ON':'OFF') : String(excel??'');
  const currentValue=webControlDisplay(id);
  return buildCompareTextRow('룬효과/버프',name,changeValue,currentValue,{id});
}
function compareExcelInputValue(value,id){
  if(EXCEL_NUMERIC_INPUT_IDS.has(id)) return formatCompareNumber(value);
  if(EXCEL_SELECT_INPUT_IDS.has(id) && (value===undefined || value===null || String(value).trim()==='')){
    const el=$(id);
    return el?.tagName==='SELECT' ? String(el.options[0]?.value ?? '') : '';
  }
  return String(value??'').replace(/,/g,'').trim();
}
function isExcelTowerContext(cells={}, sheetName=''){
  const name=String(sheetName || '').replace(/\s+/g,'').toLowerCase();
  if(name.includes('도전의탑') || name.includes('도전의타워')) return true;
  return difficultyName(firstExcelValue(cells,['B4','N41']))===TOWER_DIFFICULTY_NAME;
}
function excelRoundFieldId(cells={}, sheetName=''){
  return isExcelTowerContext(cells, sheetName) ? 'challengeTowerFloor' : 'round';
}
function excelRoundFieldName(cells={}, sheetName=''){
  return isExcelTowerContext(cells, sheetName) ? '도전의탑 층' : '라운드';
}
/* ===== 05. 엑셀 입력·스탯·특성·버프 비교 데이터 생성 ===== */
function buildExcelInputSpecs(cells,specCells,sheetName=''){
  const roundFieldId=excelRoundFieldId(cells,sheetName);
  const roundFieldName=excelRoundFieldName(cells,sheetName);
  return [
    ['기본정보','총 SP',Math.round(Number(cells.B9)||0),'sp'],
    ['기본정보','보유 XP',specCells.R20,'xp'],
    ['기본정보','보유 BXP',specCells.R21,'bxp'],
    ['기본정보','보유 RP',cells.B16,'rp'],
    ['기본정보','본인 심연의혼',cells.B19,'soul'],
    ['기본정보','난이도',firstExcelValue(cells,['B4','N41']),'diff'],
    ['기본정보','고행',firstExcelValue(cells,['B6','N42','AD8']),'penance'],
    ['기본정보',roundFieldName,firstExcelValue(cells,['B7','N43']),roundFieldId],
    ['기본정보','출발 지원 인원수',cells.D5,'team'],
    ['기본정보','타이틀 총 데미지',EXCEL_TITLE_BONUS_MAP[excelText(specCells.S17)]??specCells.S17,'titleTdBonus'],
    ['기본정보','침식 스텍',cells.H10,'erosionStack'],
    ['기본정보','침식 내성',cells.H11,'jewelErosionRes'],
    ['기본정보','파워 블레스',normalizePowerBlessRawValue(cells.D4),'pbless'],
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
function buildExcelInputRows(cells,specCells,sheetName=''){
  const rows=[];
  buildExcelInputSpecs(cells,specCells,sheetName).forEach(([kind,name,excel,id])=>{
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
function validateExcelCompareSheet(cells,sheetName){
  if(!Number.isFinite(Number(cells.M19))||!Number.isFinite(Number(cells.L4))){
    throw new Error(`"${sheetName}" 시트는 현재 계산기와 비교할 수 있는 셀 구조가 아닙니다.`);
  }
}
function buildExcelStatRows(cells,stats){
  return EXCEL_COMPARE_STATS.map(([,name,displayCell,,getDisplay])=>{
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
  const stats=computeStatsRaw();
  const dpsCompare=compareNumber(cells.M19,stats.M19);
  const inputRows=buildExcelInputRows(cells,specCells,sheetName);
  const enchantRows=buildEnchantCompareRows(getSpecEnchantCode(specCells),webControlDisplay('enchantCode'));
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
/* ===== 06. 비교 모달 필터 / 표 렌더링 ===== */
const COMPARE_FILTER_LABELS={all:'전체 보기',stat:'스탯 차이',input:'입력값 차이',buff:'룬/버프 차이',trait:'특성 차이',zero:'승단 차이'};
const COMPARE_FILTER_ORDER=['all','stat','input','buff','trait','zero'];
const COMPARE_SUMMARY_COUNT_KEYS={stat:'statDiffs',input:'inputDiffs',buff:'buffDiffs',trait:'traitDiffs',zero:'zeroDiffs'};
const EXCEL_COMPARE_COLGROUP='<colgroup><col class="compare-col-kind"><col class="compare-col-name"><col class="compare-col-current"><col class="compare-col-change"><col class="compare-col-diff"></colgroup>';
const EXCEL_COMPARE_EMPTY_HTML='<div class="excel-compare-empty">기준 프리셋과 비교 프리셋을 선택하세요.<small>엑셀파일은 시트 단위, 특성 프리셋 파일은 프리셋 제목 단위로 비교합니다.</small></div>';
function hydrateCompareControls(){
  const select=$('excelCompareSheet');
  const baseSelect=$('excelCompareBasePreset');
  if(baseSelect){
    const bundle=compareState.baseTraitPresetBundle;
    const store=bundle || loadTraitPresetStore();
    const presets=Array.isArray(store.presets) ? store.presets : [];
    const ids=presets.map(preset=>preset.id);
    const defaultId=String(store.defaultPresetId || '');
    const localSelected=!bundle ? selectedTraitPresetId() : '';
    const fallback=ids.includes(compareState.baseTraitPresetId) ? compareState.baseTraitPresetId : (ids.includes(defaultId) ? defaultId : (ids.includes(localSelected) ? localSelected : (ids[0] || '')));
    baseSelect.innerHTML=presets.map(preset=>`<option value="${escapeCompareHtml(preset.id)}">${escapeCompareHtml(preset.id===defaultId ? `${preset.name} · 기본` : preset.name)}</option>`).join('') || '<option value="">기준 프리셋 없음</option>';
    baseSelect.disabled=!presets.length;
    baseSelect.value=fallback;
    compareState.baseTraitPresetId=fallback;
  }
  if(!select) return;
  if(compareState.sourceType==='excel' && compareState.workbook){
    const sheets=compareState.workbook.sheets || [];
    const names=sheets.map(sheet=>sheet.name);
    const selected=names.includes(compareState.selectedSheetName) ? compareState.selectedSheetName : (names[0] || '');
    select.innerHTML=sheets.map(sheet=>`<option value="${escapeCompareHtml(sheet.name)}">${escapeCompareHtml(sheet.name)}</option>`).join('');
    select.disabled=!sheets.length;
    if(selected){
      select.value=selected;
      compareState.selectedSheetName=selected;
    }
  }else if(compareState.sourceType==='traitPreset' && compareState.traitPresetBundle){
    const bundle=compareState.traitPresetBundle;
    const presets=Array.isArray(bundle.presets) ? bundle.presets : [];
    const ids=presets.map(preset=>preset.id);
    const fallbackId=ids.includes(bundle.defaultPresetId) ? bundle.defaultPresetId : (ids[0] || '');
    const selected=ids.includes(compareState.selectedSheetName) ? compareState.selectedSheetName : fallbackId;
    select.innerHTML=presets.map(preset=>`<option value="${escapeCompareHtml(preset.id)}">${escapeCompareHtml(preset.id===bundle.defaultPresetId ? `${preset.name} · 기본` : preset.name)}</option>`).join('') || '<option value="">프리셋 없음</option>';
    select.disabled=!presets.length;
    if(selected){
      select.value=selected;
      compareState.selectedSheetName=selected;
    }
  }else if(compareState.sourceType==='json' && compareState.backupState){
    select.innerHTML='<option value="savedFile">저장파일</option>';
    select.value='savedFile';
    select.disabled=true;
    compareState.selectedSheetName='savedFile';
  }else{
    select.innerHTML='<option value="">비교파일을 불러오세요</option>';
    select.disabled=true;
    compareState.selectedSheetName='';
  }
}
function selectedExcelSheetName(){
  if(compareState.sourceType!=='excel' || !compareState.workbook) return '';
  const select=$('excelCompareSheet');
  const candidate=String((select && !select.disabled && select.value) || compareState.selectedSheetName || '').trim();
  const names=(compareState.workbook.sheets||[]).map(sheet=>sheet.name);
  const sheetName=names.includes(candidate) ? candidate : '';
  if(sheetName){
    compareState.selectedSheetName=sheetName;
    if(select && select.value!==sheetName) select.value=sheetName;
  }
  return sheetName;
}

const COMPARE_INPUT_EXCLUDE_KINDS=new Set(['DPS','스탯','룬효과/버프','특성','승단계산','승단계산 결과']);
function compareSummaryCard(filter,label,count,active){
  const isAll=filter==='all';
  const stateClass=isAll ? 'same is-all' : count ? 'diff' : 'same';
  const selectedClass=active===filter ? 'is-active' : '';
  const valueText=`${count}개`;
  const content=isAll
    ? `<span>${label}</span>`
    : `<span>${label}</span><b>${valueText}</b>`;
  return `<button type="button" class="ui-choice-card excel-compare-summary-card ${stateClass} ${selectedClass}" data-excel-compare-filter="${filter}" aria-pressed="${active===filter?'true':'false'}">${content}</button>`;
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
function compareSummaryHtml(summary,active){
  return COMPARE_FILTER_ORDER.map(filter=>compareSummaryCard(
    filter,
    COMPARE_FILTER_LABELS[filter],
    filter==='all' ? 0 : (summary[COMPARE_SUMMARY_COUNT_KEYS[filter]] || 0),
    active
  )).join('');
}
function compareRowsHtml(rows,emptyMessage){
  return rows.map(row=>`<tr class="${row.status}"><td>${escapeCompareHtml(row.kind)}</td><th>${escapeCompareHtml(row.name)}</th><td>${row.current}</td><td>${row.change}</td><td class="compare-diff ${row.diffClass||''}">${row.difference}</td></tr>`).join('') ||
    `<tr class="same"><td colspan="5" class="excel-compare-no-diff">${escapeCompareHtml(emptyMessage)}</td></tr>`;
}
function renderExcelComparison(result,options={}){
  const body=$('excelCompareBody');
  if(!body) return;
  compareState.lastResult=result;
  if(!options.preserveFilter) compareState.activeFilter='all';
  const active=COMPARE_FILTER_LABELS[compareState.activeFilter] ? compareState.activeFilter : 'all';
  compareState.activeFilter=active;
  const {summary}=result;
  const visibleRows=(result.rows||[]).filter(row=>compareRowMatchesFilter(row,active));
  const emptyMessage=active==='all' ? '기준 프리셋과 비교 프리셋이 모두 일치합니다.' : `${COMPARE_FILTER_LABELS[active] || '선택한 구분'} 항목에서 차이 난 값이 없습니다.`;
  body.innerHTML=`
    <div class="excel-compare-summary">${compareSummaryHtml(summary,active)}</div>
    <div class="excel-compare-table-wrap">
      <table class="excel-compare-table excel-compare-table-head">${EXCEL_COMPARE_COLGROUP}<thead><tr><th>구분</th><th>항목</th><th>기준 프리셋</th><th>비교 프리셋</th><th>차이</th></tr></thead></table>
      <div class="excel-compare-table-scroll">
        <table class="excel-compare-table excel-compare-table-body">${EXCEL_COMPARE_COLGROUP}<tbody>${compareRowsHtml(visibleRows,emptyMessage)}</tbody></table>
      </div>
    </div>`;
  updateCompareActionButtons();
}
/* ===== 07. 비교 모달 액션 / 현재값 복원 ===== */
function openCompareInfo(options={}){
  openMonthRune('compare', options);
}
function closeCompareInfo(){
  closeMonthRune();
}
function requestCompareFileSelect(){
  setTimeout(()=>{
    const input=$('excelCompareFile');
    if(input) input.click();
  },60);
}
function compareCanApply(){
  if(compareState.applied) return false;
  if(compareState.sourceType==='json') return !!compareState.backupState;
  if(compareState.sourceType==='traitPreset') return !!selectedCompareTraitPreset();
  if(compareState.sourceType==='excel'){
    return !!(compareState.workbook && selectedExcelSheetName() && compareState.lastResult);
  }
  return false;
}
function updateCompareActionButtons(){
  const apply=$('excelCompareApplyBtn');
  const reset=$('excelCompareResetBtn');
  const restore=$('excelCompareRestoreBtn');
  if(apply) apply.disabled=!compareCanApply();
  if(reset) reset.disabled=!(compareState.sourceType || compareState.lastResult || compareState.workbook || compareState.backupState || compareState.traitPresetBundle);
  if(restore) restore.disabled=!compareState.restoreState;
}
function clearCompareRestoreState(){
  compareState.restoreState=null;
  compareState.applied=false;
  updateCompareActionButtons();
}
function restoreComparisonCurrentState(){
  if(!compareState.restoreState) return;
  try{
    const restoreState=compareState.restoreState;
    applyStateObject(restoreState);
    const saved=saveState({silent:true});
    if(saved===false) throw new Error('현재값은 복원했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.');
    compareState.restoreState=null;
    compareState.applied=false;
    if(compareState.sourceType==='json' && compareState.backupState) renderJsonComparison(compareState.backupState);
    else if(compareState.sourceType==='traitPreset'){ hydrateCompareControls(); compareSelectedTraitPreset({preserveRestore:true}); }
    else if(compareState.sourceType==='excel'){ hydrateCompareControls(); compareSelectedExcelSheet({preserveRestore:true}); }
    updateCompareActionButtons();
    notifyStorageAction('현재값 복원 완료','ok',{statusAction:'load'});
  }catch(e){
    logAppError('[compare restore failed]',e);
    showToast(e?.message||String(e),'err');
  }
}
function resetExcelComparison(options={}){
  resetCompareState();
  const select=$('excelCompareSheet');
  const baseSelect=$('excelCompareBasePreset');
  const file=$('excelCompareFile');
  const baseFile=$('excelCompareBaseFile');
  const apply=$('excelCompareApplyBtn');
  const reset=$('excelCompareResetBtn');
  const restore=$('excelCompareRestoreBtn');
  const body=$('excelCompareBody');
  if(select){
    select.innerHTML='<option value="">비교파일을 불러오세요</option>';
    select.disabled=true;
  }
  if(baseSelect){ baseSelect.innerHTML='<option value="">기준 프리셋 없음</option>'; baseSelect.disabled=true; baseSelect.value=''; }
  if(file) file.value='';
  if(baseFile) baseFile.value='';
  hydrateCompareControls();
  if(apply) apply.disabled=true;
  if(reset) reset.disabled=true;
  if(restore) restore.disabled=true;
  if(body) body.innerHTML=EXCEL_COMPARE_EMPTY_HTML;
  if(options.close) closeCompareInfo();
}
/* ===== 08. 엑셀 시트 값을 현재 상태 객체로 변환 ===== */
function excelText(value){ return String(value??'').trim(); }
function excelNumber(value){
  const number=Number(String(value??'').replace(/,/g,'').trim());
  return Number.isFinite(number) ? number : null;
}
function resolveExcelSelectValue(id, value){
  const select=$(id);
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
  const el=$(id);
  if(!el || value===undefined || value===null || value==='') return undefined;
  if(TRAIT_LIMIT_INPUT_IDS.has(id)){
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
function buildExcelState(cells, specCells, zeroCells, sheetName=''){
  const state=makeStateObject();
  const values={...state.values, soloMode:'ON', coopMode:'OFF', coopPlayers:''};
  const roundFieldId=excelRoundFieldId(cells,sheetName);
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
    [roundFieldId,firstExcelValue(cells,['B7','N43'])],
    ['team',cells.D5],
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
    ['addUA',getSpecAdditionalValue(specCells,'addUA')]
  ].forEach(([id,value])=>{ applied+=assign(id,value); });
  if(cells.D4!==undefined && cells.D4!==null && cells.D4!==''){
    values.pbless=normalizePowerBlessRawValue(cells.D4);
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
  if(zeroScore?.rows?.length) applied+=zeroScore.rows.reduce((sum,row)=>sum+(row.type==='penance'?5:(row.type==='towerCombo'?4:2)),0);
  return {state:makeStorageEnvelope({...state,values,inv,zeroScore}),applied};
}

/* ===== 09. 저장 JSON 비교 / 적용 ===== */
function readFileAsText(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.addEventListener('load',()=>resolve(String(reader.result||'')),{once:true});
    reader.addEventListener('error',()=>reject(new Error('파일을 읽지 못했습니다.')),{once:true});
    reader.readAsText(file,'utf-8');
  });
}
function isCompareNumericValueId(id){
  return EXCEL_NUMERIC_INPUT_IDS.has(id);
}
function compareSavedValueDisplay(value,id){
  if(TRAIT_LIMIT_INPUT_IDS.has(id)) return traitLimitDisplayText(value);
  if(id==='spBankApply') return spBankApplyDisplayValue(value);
  if(isCompareNumericValueId(id)) return formatCompareNumber(value);
  return compareDisplayText(value,id);
}
function buildSavedValueCompareRows(changeState,currentState,options={}){
  const onlyDiffs=options.onlyDiffs!==false;
  const ordered=userStateElementIds();
  const skipped=new Set(['excelCompareFile','excelCompareSheet','enchantCode','runeChoiceType','runeChoiceValue',...ENCHANT_INPUT_IDS]);
  const ids=[...new Set([...ordered,'dpsTableMinDps',...Object.keys(currentState.values||{}),...Object.keys(changeState.values||{})])]
    .filter(id=>id && !skipped.has(id) && isUserStateValueId(id));
  const rows=[];
  const runeRow=buildRuneChoiceCompareRow('룬정보', changeState.values||{}, currentState.values||{});
  if(!onlyDiffs || runeRow.status!=='same') rows.push(runeRow);
  ids.forEach(id=>{
    const meta=COMPARE_VALUE_META[id] || {kind:'입력값',name:id};
    const numeric=isCompareNumericValueId(id);
    const changeValue=compareSavedValueDisplay(changeState.values?.[id],id);
    const currentValue=compareSavedValueDisplay(currentState.values?.[id],id);
    rows.push(numeric ? buildCompareNumberRow(meta.kind,meta.name,changeValue,currentValue) : buildCompareTextRow(meta.kind,meta.name,changeValue,currentValue,{id}));
  });
  return onlyDiffs ? rows.filter(row=>row.status!=='same') : rows;
}
function buildSavedTraitCompareRows(changeState,currentState){
  const currentInv=currentState?.inv || INV;
  return TRAITS.filter(t=>t[0]>=42&&t[0]<=138).map(t=>{
    const row=t[0], changeValue=Number(changeState.inv?.[row]||0), currentValue=Number(currentInv?.[row]||0);
    return buildCompareNumberRow('특성',t[1],changeValue,currentValue,0.0001);
  }).filter(row=>row.status!=='same');
}
function snapshotComparisonState(changeState,currentState){
  const restoreState=currentState || makeStateObject();
  applyStateObject(changeState);
  try{
    return {state:makeStateObject(),stats:computeStatsRaw()};
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
function buildJsonComparison(changeState,options={}){
  const liveState=makeStateObject();
  const baseState=options.baseState ? normalizeSavedState(options.baseState) : liveState;
  const currentSnapshot=options.baseState ? snapshotComparisonState(baseState,liveState) : {state:liveState,stats:computeStatsRaw()};
  const currentState={...currentSnapshot.state,fileName:options.baseFileName || currentSnapshot.state.fileName,sheetName:options.baseSheetName || currentSnapshot.state.sheetName};
  const currentStats=currentSnapshot.stats;
  const changeSnapshot=snapshotComparisonState(changeState,liveState);
  const effectiveChangeState={...changeSnapshot.state,fileName:changeState.fileName || changeSnapshot.state.fileName,sheetName:changeState.sheetName || changeSnapshot.state.sheetName};
  const changeStats=changeSnapshot.stats;
  const dpsCompare=compareNumber(changeStats.M19,currentStats.M19);
  const dpsRow=buildCompareNumberRow('DPS','기본 DPS',changeStats.M19,currentStats.M19);
  const inputRows=buildSavedValueCompareRows(effectiveChangeState,currentState,{onlyDiffs:false});
  const enchantRows=buildEnchantCompareRows(enchantCompareCodeFromValues(effectiveChangeState.values),enchantCompareCodeFromValues(currentState.values));
  const statRows=buildStateStatRows(changeStats,currentStats);
  const traitRows=buildSavedTraitCompareRows(effectiveChangeState,currentState);
  const zeroRows=buildSavedZeroScoreCompareRows(effectiveChangeState.zeroScore,currentState.zeroScore,{onlyDiffs:true});
  const inputDiffs=inputRows.filter(r=>r.status!=='same' && r.kind!=='룬효과/버프').length + enchantRows.filter(r=>r.status!=='same').length;
  const buffDiffs=inputRows.filter(r=>r.status!=='same' && r.kind==='룬효과/버프').length;
  return {
    fileName:options.fileName || effectiveChangeState.fileName || '저장파일',
    sheetName:options.sheetName || effectiveChangeState.sheetName || '저장파일',
    sourceType:options.sourceType || 'json',
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
  if(compareState.sourceType==='json') return applySelectedJsonBackup();
  if(compareState.sourceType==='traitPreset') return applySelectedTraitPreset();
  return applySelectedExcelSheet();
}
function applySelectedJsonBackup(){
  if(!compareState.backupState || compareState.applied) return;
  const previousState=makeStateObject();
  try{
    applyStateObject(compareState.backupState);
    const saved=saveState({silent:true});
    if(saved===false) throw new Error('변경값은 적용했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.');
    compareState.restoreState=previousState;
    compareState.applied=true;
    renderJsonComparison(compareState.backupState);
    updateCompareActionButtons();
    notifyStorageAction('현재 입력값에 적용 완료','ok',{statusAction:'load'});
  }catch(e){
    try{ applyStateObject(previousState); }catch(rollbackError){ logAppError('[backup apply rollback failed]', rollbackError); }
    compareState.restoreState=null;
    compareState.applied=false;
    logAppError('[backup apply failed]',e);
    showToast(e?.message||String(e),'err');
    updateCompareActionButtons();
  }
}
function applySelectedExcelSheet(){
  if(!compareState.workbook || compareState.applied) return;
  const sheetName=selectedExcelSheetName();
  if(!sheetName){ showToast('선택한 시트를 찾을 수 없습니다.','err'); return; }
  const previousState=makeStateObject();
  try{
    const cells=compareState.workbook.getCells(sheetName);
    validateExcelCompareSheet(cells,sheetName);
    const specCells=compareState.workbook.getCells('스펙');
    const zeroCells=getZeroScoreSheetCells(compareState.workbook);
    const additionalInfo=inspectSpecAdditionalStructure(specCells);
    if(!additionalInfo.valid) throw new Error(additionalInfo.message);
    const imported=buildExcelState(cells,specCells,zeroCells,sheetName);
    compareState.selectedSheetName=sheetName;
    applyStateObject(imported.state);
    const saved=saveState({silent:true});
    if(saved===false) throw new Error('변경값은 적용했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.');
    compareState.selectedSheetName=sheetName;
    compareState.restoreState=previousState;
    compareState.applied=true;
    hydrateCompareControls();
    compareSelectedExcelSheet({preserveRestore:true});
    updateCompareActionButtons();
    notifyStorageAction(`변경값 ${imported.applied}개 적용 완료`,'ok',{statusAction:'import'});
  }catch(e){
    try{ applyStateObject(previousState); }catch(rollbackError){ logAppError('[Excel apply rollback failed]', rollbackError); }
    compareState.restoreState=null;
    compareState.applied=false;
    logAppError('[Excel apply failed]',e);
    showToast(e?.message||String(e),'err');
    updateCompareActionButtons();
  }
}
function compareSelectedExcelSheet(options={}){
  if(!compareState.workbook) return;
  hydrateCompareControls();
  const sheetName=selectedExcelSheetName();
  if(!sheetName) return;
  compareState.lastResult=null;
  const body=$('excelCompareBody');
  const apply=$('excelCompareApplyBtn');
  const reset=$('excelCompareResetBtn');
  if(!options.preserveRestore) clearCompareRestoreState();
  try{
    const cells=compareState.workbook.getCells(sheetName);
    const specCells=compareState.workbook.getCells('스펙');
    const zeroCells=getZeroScoreSheetCells(compareState.workbook);
    const additionalInfo=inspectSpecAdditionalStructure(specCells);
    if(!additionalInfo.valid){
      if(apply) apply.disabled=true;
      if(reset) reset.disabled=false;
      if(body) body.innerHTML=`<div class="excel-compare-error">${escapeCompareHtml(additionalInfo.message).replace('5.4392','<span class="excel-compare-version">5.4392</span>')}</div>`;
      updateCompareActionButtons();
      return;
    }
    compareState.sourceType='excel';
    compareState.selectedSheetName=sheetName;
    renderExcelComparison(buildExcelComparison(cells,specCells,zeroCells,compareState.workbook.fileName,sheetName));
    updateCompareActionButtons();
  }catch(e){
    logAppError('[Excel compare failed]',e);
    if(apply) apply.disabled=true;
    if(reset) reset.disabled=false;
    if(body) body.innerHTML=`<div class="excel-compare-error">${escapeCompareHtml(e?.message||String(e))}</div>`;
    updateCompareActionButtons();
  }
}
/* ===== 10. 파일 로드 핸들러 / 소스 판별 ===== */
function isTraitPresetCompareBundle(parsed){
  return !!(parsed && typeof parsed==='object' && isTraitPresetFileType(parsed.type) && Array.isArray(parsed.presets));
}
async function readCompareJsonSource(file){
  const raw=await readFileAsText(file);
  const parsed=safeJsonParse(raw);
  if(!parsed) throw new Error('저장파일 형식이 아닙니다.');
  if(isTraitPresetCompareBundle(parsed)){
    const store=normalizeTraitPresetStore(parsed);
    if(!store.presets.length) throw new Error('비교할 특성 프리셋이 없습니다.');
    return {sourceType:'traitPreset',traitPresetBundle:{fileName:file.name,defaultPresetId:store.defaultPresetId,presets:store.presets}};
  }
  const state=normalizeSavedState(parsed);
  if(!state) throw new Error('계산기 저장값 형식이 아닙니다.');
  return {sourceType:'json',backupState:{...state,fileName:file.name}};
}
async function handleBaseCompareFile(file){
  const body=$('excelCompareBody');
  try{
    const source=await readCompareJsonSource(file);
    const now=Date.now();
    if(source.sourceType==='traitPreset'){
      compareState.baseTraitPresetBundle=source.traitPresetBundle;
    }else if(source.sourceType==='json' && source.backupState){
      const id='base_saved_file';
      const name=normalizeTraitPresetName(stateFileBaseName(file?.name || '') || '기준 저장값');
      compareState.baseTraitPresetBundle={fileName:file?.name || '기준 파일',defaultPresetId:id,presets:[{id,name,schemaVersion:TRAIT_PRESET_SCHEMA_VERSION,createdAt:now,updatedAt:now,meta:traitPresetMetaFromSavedState(source.backupState),state:source.backupState}]};
    }else{
      throw new Error('기준 파일은 특성 프리셋 또는 저장값 파일만 사용할 수 있습니다.');
    }
    const presets=compareState.baseTraitPresetBundle.presets || [];
    const preferred=presets.find(preset=>preset.id===compareState.baseTraitPresetBundle.defaultPresetId) || presets[0];
    compareState.baseTraitPresetId=preferred?.id || '';
    compareState.applied=false;
    hydrateCompareControls();
    if(compareState.sourceType==='traitPreset' && compareState.traitPresetBundle) compareSelectedTraitPreset();
    else updateCompareActionButtons();
    showToast(`기준 파일 로드 완료: ${file?.name || '프리셋 파일'}`,'ok');
  }catch(e){
    logAppError('[compare base file failed]',e);
    if(body) body.innerHTML=`<div class="excel-compare-error">${escapeCompareHtml(e?.message||String(e))}</div>`;
    updateCompareActionButtons();
  }
}
async function handleExcelCompareFile(file){
  const preservedBaseBundle=compareState.baseTraitPresetBundle;
  const preservedBaseId=compareState.baseTraitPresetId;
  resetCompareState();
  compareState.baseTraitPresetBundle=preservedBaseBundle;
  compareState.baseTraitPresetId=preservedBaseId;
  hydrateCompareControls();
  const body=$('excelCompareBody');
  if(body) body.innerHTML='<div class="excel-compare-empty">파일을 분석하고 있습니다.</div>';
  try{
    const name=String(file?.name||'').toLowerCase();
    const type=String(file?.type||'').toLowerCase();
    if(name.endsWith('.json') || name.endsWith('.txt') || type.includes('json') || type.startsWith('text/')){
      const jsonSource=await readCompareJsonSource(file);
      compareState.sourceType=jsonSource.sourceType;
      compareState.workbook=null;
      compareState.backupState=jsonSource.backupState || null;
      compareState.traitPresetBundle=jsonSource.traitPresetBundle || null;
      if(jsonSource.sourceType==='traitPreset'){
        const bundle=jsonSource.traitPresetBundle;
        const preferred=(bundle.presets || []).find(preset=>preset.id===bundle.defaultPresetId) || (bundle.presets || [])[0];
        compareState.selectedSheetName=preferred?.id || '';
        hydrateCompareControls();
        compareSelectedTraitPreset();
      }else{
        compareState.selectedSheetName='savedFile';
        hydrateCompareControls();
        renderJsonComparison(compareState.backupState);
      }
      updateCompareActionButtons();
      return;
    }
    compareState.workbook=await readExcelWorkbook(file);
    compareState.backupState=null;
    compareState.traitPresetBundle=null;
    compareState.sourceType='excel';
    if(!compareState.workbook.sheets?.length) throw new Error('엑셀 시트를 찾을 수 없습니다.');
    const preferred=compareState.workbook.sheets.some(sheet=>sheet.name==='고행')?'고행':compareState.workbook.sheets[0].name;
    compareState.selectedSheetName=preferred;
    hydrateCompareControls();
    compareSelectedExcelSheet();
  }catch(e){
    resetCompareState();
    hydrateCompareControls();
    logAppError('[compare file failed]',e);
    const apply=$('excelCompareApplyBtn');
    const reset=$('excelCompareResetBtn');
    if(apply) apply.disabled=true;
    if(reset) reset.disabled=true;
    if(body) body.innerHTML=`<div class="excel-compare-error">${escapeCompareHtml(e?.message||String(e))}</div>`;
    updateCompareActionButtons();
  }
}
/* ===== 11. 비교 모달 이벤트 바인딩 ===== */
function bindExcelCompareEvents(){
  document.addEventListener('click',e=>{
    const filterTarget=e.target.closest('[data-excel-compare-filter]');
    if(filterTarget){
      compareState.activeFilter=filterTarget.getAttribute('data-excel-compare-filter') || 'all';
      if(compareState.lastResult) renderExcelComparison(compareState.lastResult,{preserveFilter:true});
      return;
    }
    if(e.target.closest('[data-excel-compare-apply]')) applySelectedComparison();
    if(e.target.closest('[data-excel-compare-restore]')) restoreComparisonCurrentState();
    if(e.target.closest('[data-excel-compare-reset]')) requestConfirmAction('excelCompareReset','한 번 더 누르면 프리셋 분석 초기화', resetExcelComparison);
  });
  document.addEventListener('change',e=>{
    if(e.target.id==='excelCompareBaseFile'&&e.target.files?.[0]){
      const selectedFile=e.target.files[0];
      handleBaseCompareFile(selectedFile).finally(()=>{ e.target.value=''; });
    }
    if(e.target.id==='excelCompareFile'&&e.target.files?.[0]){
      const selectedFile=e.target.files[0];
      handleExcelCompareFile(selectedFile).finally(()=>{ e.target.value=''; });
    }
    if(e.target.id==='excelCompareSheet' && compareState.sourceType==='excel'){ compareState.selectedSheetName=e.target.value; compareSelectedExcelSheet(); }
    if(e.target.id==='excelCompareBasePreset'){ compareState.baseTraitPresetId=e.target.value; if(compareState.sourceType==='traitPreset') compareSelectedTraitPreset(); else updateCompareActionButtons(); }
    if(e.target.id==='excelCompareSheet' && compareState.sourceType==='traitPreset'){ compareState.selectedSheetName=e.target.value; compareSelectedTraitPreset(); }
  });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeCompareInfo(); });
}
