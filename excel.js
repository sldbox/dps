/* 파일 해석·비교 상태 */

const compareState={workbook:null,backupState:null,traitPresetBundle:null,baseTraitPresetBundle:null,baseFileRejected:false,sourceType:null,lastResult:null,activeFilter:'all',restoreState:null,restoreJewelSettings:null,restoreTraitPresetStatus:null,applied:false,selectedSheetName:'',baseTraitPresetId:''};
function resetCompareState(){Object.assign(compareState,{workbook:null,backupState:null,traitPresetBundle:null,baseFileRejected:false,sourceType:null,lastResult:null,activeFilter:'all',restoreState:null,restoreJewelSettings:null,restoreTraitPresetStatus:null,applied:false,selectedSheetName:'',baseTraitPresetId:''});}
const EXCEL_COMPARE_STATS=[
  ['AD','공격력','L4','M4',s=>s.displayAD,s=>s.M4],
  ['APS','성소 마법공격력','L5','M5',s=>s.displayAPS,s=>s.displayAPS],
  ['APU','유닛 마법공격력','L6','M6',s=>s.displayAPU,s=>s.actualAPU],
  ['AS','공격속도','L7','M7',s=>s.M7,s=>s.M7],
  ['CRI','크리티컬 확률','L8','M8',s=>s.M8,s=>s.M8],
  ['CD','크리티컬 데미지','L9','M9',s=>s.rawCD,s=>s.M9],
  ['MC','다중 크리티컬','L10','M10',s=>s.M10,s=>s.M10],
  ['TD','총 데미지','L11','M11',s=>s.rawTD,s=>s.M11],
  ['DR','방어력 감소','L12','M12',s=>s.M12,s=>s.actualM12],
  ['UA','유닛 가속','L13','M13',s=>s.displayUA,s=>s.M13],
  ['SR','실드 감소','L14','M14',s=>s.displaySR,s=>s.actualSR],
  ['HR','체력 감소','L15','M15',s=>s.displayHR,s=>s.actualHR],
  ['MD','멀티 타겟','L16','M16',s=>s.M16,s=>s.M16],
  ['MP','멀티 확률','L17','M17',s=>s.M17,s=>s.M17],
  ['MCP','멀티 크리 확률','L18','M18',s=>s.M18,s=>s.M18]
];
const EXCEL_ZIP_LIMITS=Object.freeze({maxEntries:4096,maxEntryBytes:64*1024*1024,maxDecodedBytes:128*1024*1024});
function readU16(view, offset){ return view.getUint16(offset,true); }
function readU32(view, offset){ return view.getUint32(offset,true); }
function ensureZipRange(length,offset,size,message){
  if(!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset<0 || size<0 || offset+size>length) throw new Error(message);
}
function normalizeExcelZipPath(target){
  const raw=String(target || '').replace(/\\/g,'/').trim();
  if(!raw) return '';
  const source=raw.startsWith('/') ? raw.slice(1) : `xl/${raw}`;
  const parts=[];
  for(const part of source.split('/')){
    if(!part || part==='.') continue;
    if(part==='..'){
      if(!parts.length) return '';
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join('/');
}
async function inflateZipEntry(bytes,expectedSize=0){
  if(typeof DecompressionStream!=='function') throw new Error('이 브라우저는 XLSM 압축 해제를 지원하지 않습니다.');
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const data=new Uint8Array(await new Response(stream).arrayBuffer());
  if(expectedSize>0 && data.length!==expectedSize) throw new Error('엑셀파일 압축 데이터 크기가 올바르지 않습니다.');
  return data;
}
async function readZipDirectory(file){
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes.length<22) throw new Error('올바른 엑셀파일이 아닙니다.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let eocd=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
    if(readU32(view,i)!==0x06054b50) continue;
    const commentLength=readU16(view,i+20);
    if(i+22+commentLength===bytes.length){ eocd=i; break; }
  }
  if(eocd<0) throw new Error('올바른 엑셀파일이 아닙니다.');
  ensureZipRange(bytes.length,eocd,22,'엑셀파일 ZIP 끝 정보를 읽을 수 없습니다.');
  const diskNumber=readU16(view,eocd+4);
  const centralDisk=readU16(view,eocd+6);
  const diskEntryCount=readU16(view,eocd+8);
  const count=readU16(view,eocd+10);
  const centralSize=readU32(view,eocd+12);
  let pos=readU32(view,eocd+16);
  if(diskNumber!==0 || centralDisk!==0 || diskEntryCount!==count) throw new Error('분할 ZIP 형식의 엑셀파일은 지원하지 않습니다.');
  if(count===0xffff || centralSize===0xffffffff || pos===0xffffffff) throw new Error('ZIP64 형식의 엑셀파일은 지원하지 않습니다.');
  if(count>EXCEL_ZIP_LIMITS.maxEntries) throw new Error('엑셀파일의 내부 항목 수가 너무 많습니다.');
  ensureZipRange(bytes.length,pos,centralSize,'엑셀파일 ZIP 목록 위치가 올바르지 않습니다.');
  if(pos+centralSize>eocd) throw new Error('엑셀파일 ZIP 목록 크기가 올바르지 않습니다.');
  const decoder=new TextDecoder('utf-8');
  const entries=new Map();
  for(let i=0;i<count;i++){
    ensureZipRange(bytes.length,pos,46,'엑셀파일 ZIP 목록을 읽을 수 없습니다.');
    if(readU32(view,pos)!==0x02014b50) throw new Error('엑셀파일 ZIP 목록을 읽을 수 없습니다.');
    const flags=readU16(view,pos+8);
    const method=readU16(view,pos+10);
    const compressedSize=readU32(view,pos+20);
    const uncompressedSize=readU32(view,pos+24);
    const nameLength=readU16(view,pos+28);
    const extraLength=readU16(view,pos+30);
    const commentLength=readU16(view,pos+32);
    const localOffset=readU32(view,pos+42);
    const recordSize=46+nameLength+extraLength+commentLength;
    ensureZipRange(bytes.length,pos,recordSize,'엑셀파일 ZIP 항목 정보가 손상되었습니다.');
    if(flags&1) throw new Error('암호화된 엑셀파일은 지원하지 않습니다.');
    if(compressedSize>EXCEL_ZIP_LIMITS.maxEntryBytes || uncompressedSize>EXCEL_ZIP_LIMITS.maxEntryBytes) throw new Error('엑셀파일 내부 항목이 너무 큽니다.');
    const name=decoder.decode(bytes.slice(pos+46,pos+46+nameLength)).replace(/\\/g,'/').replace(/^\/+/, '');
    ensureZipRange(bytes.length,localOffset,30,'엑셀파일 ZIP 항목 위치가 올바르지 않습니다.');
    if(readU32(view,localOffset)!==0x04034b50) throw new Error('엑셀파일 ZIP 항목을 읽을 수 없습니다.');
    const localNameLength=readU16(view,localOffset+26);
    const localExtraLength=readU16(view,localOffset+28);
    ensureZipRange(bytes.length,localOffset+30,localNameLength+localExtraLength,'엑셀파일 ZIP 항목 정보가 손상되었습니다.');
    const localName=decoder.decode(bytes.slice(localOffset+30,localOffset+30+localNameLength)).replace(/\\/g,'/').replace(/^\/+/, '');
    if(localName!==name) throw new Error('엑셀파일 ZIP 항목 이름이 일치하지 않습니다.');
    const dataOffset=localOffset+30+localNameLength+localExtraLength;
    ensureZipRange(bytes.length,dataOffset,compressedSize,'엑셀파일 ZIP 압축 데이터가 손상되었습니다.');
    if(name && !name.endsWith('/')){
      if(entries.has(name)) throw new Error('엑셀파일 ZIP 항목 이름이 중복되었습니다.');
      entries.set(name,{method,compressedSize,uncompressedSize,dataOffset});
    }
    pos+=recordSize;
  }
  if(pos>eocd) throw new Error('엑셀파일 ZIP 목록이 손상되었습니다.');
  return {bytes,entries,cache:new Map(),decodedBytes:0};
}
async function readZipEntry(zip,name,{required=true}={}){
  if(zip.cache.has(name)) return zip.cache.get(name);
  const entry=zip.entries.get(name);
  if(!entry){
    if(required) throw new Error(`엑셀파일 내부 항목을 찾을 수 없습니다. (${name})`);
    return null;
  }
  const compressed=zip.bytes.slice(entry.dataOffset,entry.dataOffset+entry.compressedSize);
  let data;
  if(entry.method===0){
    data=compressed;
    if(data.length!==entry.uncompressedSize) throw new Error('엑셀파일 저장 데이터 크기가 올바르지 않습니다.');
  }else if(entry.method===8) data=await inflateZipEntry(compressed,entry.uncompressedSize);
  else throw new Error(`지원하지 않는 엑셀파일 압축 방식입니다. (${entry.method})`);
  if(data.length>EXCEL_ZIP_LIMITS.maxEntryBytes) throw new Error('엑셀파일 내부 항목이 너무 큽니다.');
  zip.decodedBytes+=data.length;
  if(zip.decodedBytes>EXCEL_ZIP_LIMITS.maxDecodedBytes) throw new Error('엑셀파일 압축 해제 크기가 너무 큽니다.');
  zip.cache.set(name,data);
  return data;
}
function parseXml(bytes){
  if(!bytes) throw new Error('엑셀파일 XML을 찾을 수 없습니다.');
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
    const inlineText=xmlLocalAll(cell,'t').map(node=>node.textContent || '').join('');
    cells[ref]=type==='s' ? (sharedStrings[Number(value)] ?? '') : (type==='inlineStr' ? inlineText : value);
  });
  return cells;
}
async function readExcelWorkbook(file){
  const zip=await readZipDirectory(file);
  const [workbookBytes,relsBytes,sharedBytes]=await Promise.all([
    readZipEntry(zip,'xl/workbook.xml'),
    readZipEntry(zip,'xl/_rels/workbook.xml.rels'),
    readZipEntry(zip,'xl/sharedStrings.xml',{required:false})
  ]);
  const workbook=parseXml(workbookBytes);
  const rels=parseXml(relsBytes);
  const relMap={};
  xmlLocalAll(rels,'Relationship').forEach(rel=>{ relMap[rel.getAttribute('Id')]=rel.getAttribute('Target'); });
  const shared=[];
  if(sharedBytes){
    const sharedDoc=parseXml(sharedBytes);
    xmlLocalAll(sharedDoc,'si').forEach(si=>shared.push(xmlLocalAll(si,'t').map(t=>t.textContent||'').join('')));
  }
  const sheets=xmlLocalAll(workbook,'sheet').map(node=>{
    const name=node.getAttribute('name');
    const relId=node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id') || node.getAttribute('r:id');
    const path=normalizeExcelZipPath(relMap[relId]);
    return {name,path};
  }).filter(sheet=>sheet.name&&sheet.path&&zip.entries.has(sheet.path));
  if(!sheets.length) throw new Error('비교할 엑셀 시트를 찾을 수 없습니다.');
  const sheetBytes=new Map();
  await Promise.all([...new Set(sheets.map(sheet=>sheet.path))].map(async path=>{
    sheetBytes.set(path,await readZipEntry(zip,path));
  }));
  const cellCache=new Map();
  return {
    fileName:file.name,
    sheets,
    getCells(sheetName){
      if(cellCache.has(sheetName)) return cellCache.get(sheetName);
      const sheet=sheets.find(item=>item.name===sheetName);
      if(!sheet) throw new Error('선택한 시트를 찾을 수 없습니다.');
      const cells=excelCellMap(parseXml(sheetBytes.get(sheet.path)),shared);
      cellCache.set(sheetName,cells);
      return cells;
    }
  };
}
const EXCEL_JEWEL_SHEET_NAME='쥬얼';
function excelJewelNumber(value){
  const number=excelCompareNumberValue(value);
  return number===null ? 0 : number;
}
function excelJewelPercent(value){
  const number=excelJewelNumber(value);
  if(number===0) return 0;
  return Math.abs(number)<=1 ? number*100 : number;
}
function emptyExcelJewelSettings(){
  return {legendaryMythicJewels:normalizeDpsJewelSettings({})};
}
function readExcelJewelSettings(workbook){
  const sheetNames=(workbook?.sheets || []).map(sheet=>sheet.name);
  if(!sheetNames.includes(EXCEL_JEWEL_SHEET_NAME)){
    return {present:false,settings:null,recognizedLegendary:0};
  }
  const cells=workbook.getCells(EXCEL_JEWEL_SHEET_NAME);
  const settings=emptyExcelJewelSettings();
  const rowNumbers=Object.keys(cells).map(ref=>Number(String(ref).match(/\d+$/)?.[0])).filter(row=>Number.isFinite(row) && row>=3);
  const maxRow=Math.max(2,...rowNumbers);
  let recognizedLegendary=0;
  for(let row=3;row<=maxRow;row++){
    const raw={
      ad:cells[`B${row}`],as:cells[`C${row}`],td:cells[`D${row}`],ua:cells[`E${row}`],
      name:cells[`F${row}`],enhance:cells[`G${row}`],mythic:cells[`H${row}`]
    };
    const legendaryName=normalizeDpsJewelName(String(raw.name ?? '').trim());
    if(!legendaryName) continue;
    settings.legendaryMythicJewels[legendaryName]=normalizeDpsJewelSetting({
      ad:excelJewelNumber(raw.ad),
      as:excelJewelNumber(raw.as),
      td:excelJewelNumber(raw.td),
      ua:excelJewelPercent(raw.ua),
      enhance:excelJewelNumber(raw.enhance),
      mythic:String(raw.mythic ?? '').trim().toUpperCase()==='Y' ? 'Y' : 'N'
    });
    recognizedLegendary++;
  }
  return {present:true,settings,recognizedLegendary};
}
function applyExcelJewelSettings(jewelImport){
  if(!jewelImport?.present || !jewelImport.settings) return false;
  applyTraitPresetJewelSettings(jewelImport.settings);
  sanitizeDpsJewelSelections();
  syncDpsBaseUnitControl();
  return true;
}
function applyExcelJewelImport(workbook,saveError,rollbackLabel){
  const previousJewelSettings=captureTraitPresetJewelSettings();
  try{
    const jewelImport=readExcelJewelSettings(workbook);
    if(!jewelImport.present || !jewelImport.settings) throw new Error('선택한 엑셀파일에 쥬얼 시트가 없습니다.');
    applyExcelJewelSettings(jewelImport);
    if(saveState({silent:true})===false) throw new Error(saveError);
    return {jewelImport,previousJewelSettings,staged:stageTraitPresetJewelSettings(jewelImport.settings)};
  }catch(error){
    try{
      applyTraitPresetJewelSettings(previousJewelSettings);
      sanitizeDpsJewelSelections();
      syncDpsBaseUnitControl();
    }catch(rollbackError){ rememberAppIssue('error',rollbackLabel,rollbackError); }
    throw error;
  }
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
function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
}
const COMPARE_SPECIAL_RUNE_LABELS={ap:'마법공격력',ua:'유닛 가속',td:'총 데미지',harmony:'총 데미지 & 유닛 가속','td&ua':'총 데미지 & 유닛 가속','td＆ua':'총 데미지 & 유닛 가속'};
function compareNormalizedText(value){
  return String(value??'').trim().replace(/\s+/g,'').toLowerCase();
}
function findSelectOptionByText(select, value){
  const text=String(value??'').trim();
  const normalized=compareNormalizedText(text);
  return [...select.options].find(item=>{
    const optionValue=String(item.value??'').trim();
    const optionText=String(item.textContent??'').trim();
    return optionValue===text || optionText===text ||
      compareNormalizedText(optionValue)===normalized ||
      compareNormalizedText(optionText)===normalized;
  }) || null;
}
function compareSelectDisplayText(value,id){
  const text=String(value??'').trim();
  if(id==='runeChoiceType'){
    const runeLabel=COMPARE_SPECIAL_RUNE_LABELS[compareNormalizedText(text)];
    if(runeLabel) return runeLabel;
  }
  const select=$(id);
  if(select?.tagName==='SELECT'){
    const option=findSelectOptionByText(select, text);
    if(option) return String(option.textContent||option.value||'').trim() || '—';
  }
  return text || '—';
}
function compareDisplayText(value,id){
  if(id==='pbless') return powerBlessOptionLabel(normalizePowerBlessRawValue(value));
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
  return {kind,name,current:escapeHtml(currentText),change:escapeHtml(changeText),
    difference:same?'일치':escapeHtml(changeText),status:same?'same':'diff',diffClass:same?'diff-same':'diff-text'};
}
function normalizeCompareDetailItems(items){
  return (Array.isArray(items) ? items : []).map(item=>{
    const pair=Array.isArray(item) ? item : [item?.label,item?.value];
    return {label:String(pair[0]??'').trim(),value:String(pair[1]??'—').trim() || '—'};
  }).filter(item=>item.label);
}
function compareDetailHtml(items){
  const normalized=normalizeCompareDetailItems(items);
  return `<dl class="compare-detail-list">${normalized.map(item=>`<div class="compare-detail-item"><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join('')}</dl>`;
}
function compareDetailItemsKey(items){
  return JSON.stringify(normalizeCompareDetailItems(items).map(item=>[compareNormalizedText(item.label),compareNormalizedText(item.value)]));
}
function compareChangedDetailItems(changeItems,currentItems){
  const change=normalizeCompareDetailItems(changeItems);
  const current=normalizeCompareDetailItems(currentItems);
  const currentByLabel=new Map(current.map(item=>[compareNormalizedText(item.label),compareNormalizedText(item.value)]));
  const changeLabels=new Set(change.map(item=>compareNormalizedText(item.label)));
  const changed=change.filter(item=>currentByLabel.get(compareNormalizedText(item.label))!==compareNormalizedText(item.value));
  current.forEach(item=>{
    if(!changeLabels.has(compareNormalizedText(item.label))) changed.push({label:item.label,value:'없음'});
  });
  return changed;
}
function buildCompareDetailRow(kind,name,changeItems,currentItems){
  const same=compareDetailItemsKey(changeItems)===compareDetailItemsKey(currentItems);
  const changedItems=same ? [] : compareChangedDetailItems(changeItems,currentItems);
  return {
    kind,
    name,
    current:compareDetailHtml(currentItems),
    change:compareDetailHtml(changeItems),
    difference:same?'일치':compareDetailHtml(changedItems.length ? changedItems : changeItems),
    status:same?'same':'diff',
    diffClass:same?'diff-same':'diff-text',
    rowClass:'is-detail-row'
  };
}
function buildRuneChoiceCompareRow(kind, changeValues, currentValues){
  const display=values=>{
    const v=normalizeRuneChoiceValue(values?.runeChoiceValue);
    if(v===0) return '선택 안함';
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
function webControlDisplay(id){
  const el=$(id);
  if(!el) return '—';
  if(EROSION_CONTROL_IDS.has(id)) return erosionStoredValue(id);
  if(id==='round') return targetRoundStoredValue();
  if(id==='challengeTowerFloor') return challengeTowerFloorStoredValue();
  if(el.type==='checkbox') return el.checked?'ON':'OFF';
  return String(el.value??'');
}

const EXCEL_TITLE_BONUS_MAP={'패왕':'12','패왕+':'13','제왕':'14','제왕+':'15','신황':'16','신황+':'17'};
const EXCEL_RUNE_TYPE_MAP={'AP':'ap','UA':'ua','TD':'td','TD&UA':'harmony','TD＆UA':'harmony','마법공격력':'ap','마법 공격력':'ap','유닛가속':'ua','유닛 가속':'ua','총데미지':'td','총 데미지':'td','총데미지&유닛가속':'harmony','총 데미지 & 유닛 가속':'harmony','총뎀가속':'harmony'};

const ENCHANT_COMPARE_ITEMS=[['enchAD','공격력'],['enchCRI','크리티컬 확률'],['enchUA','유닛 가속'],['enchTD','총 데미지'],['enchSR','실드 감소'],['enchHR','체력 감소']];
const LATEST_SPEC_ADDITIONAL_STRUCTURE_MESSAGE='불러온 엑셀파일은 5.4392 버전과 구조가 달라 프리셋 분석 기능을 사용할 수 없습니다.';
const LATEST_SPEC_ADDITIONAL_LABELS=[['Q36','AD'],['Q37','AS'],['Q38','CD'],['Q39','CRI'],['Q40','AP'],['Q41','TD'],['Q42','UA']];
const SPEC_ADDITIONAL_CELLS={addAD:'R36',addAS:'R37',addCD:'R38',addCRI:'R39',addAP:'R40',addTD:'R41',addUA:'R42'};
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
  }catch{
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
    buildCompareNumberRow('인챈트 레벨 / 결과',name,change[index]||0,current[index]||0,0.0001)
  );
}
function applyRuneChoiceState(values, cells){
  const type=excelStateValue('runeChoiceType', cells.I6, {valueMap:EXCEL_RUNE_TYPE_MAP}) || 'harmony';
  const value=excelNumber(cells.J6) ?? 0;
  values.runeChoiceType=type;
  values.runeChoiceValue=String(value);
  RUNE_CHOICE_TARGETS.forEach(([kind,id])=>{ values[id]=String(kind===type ? value : 0); });
}
/* 엑셀 가져오기·선택 룬 */
const EXCEL_RUNE_MODIFICATION_COLUMNS=Object.freeze(['C','F','I','L','O']);
const EXCEL_RUNE_MODIFICATION_ROWS=Object.freeze({
  upper:Object.freeze({rModAD:19,rModAS:21,rModCD:22,rModCRI:23}),
  lower:Object.freeze({rModAD:34,rModAS:36,rModCD:37,rModCRI:38})
});
function excelSelectedRuneNumber(cells={}){
  return normalizedIntegerRange(excelNumber(cells.J3),1,10,1);
}
function excelSelectedRuneModificationValues(cells,specCells={}){
  const runeNumber=excelSelectedRuneNumber(cells);
  const column=EXCEL_RUNE_MODIFICATION_COLUMNS[(runeNumber-1)%5];
  const rows=runeNumber<=5 ? EXCEL_RUNE_MODIFICATION_ROWS.upper : EXCEL_RUNE_MODIFICATION_ROWS.lower;
  return Object.fromEntries(Object.entries(rows).map(([id,row])=>[id,specCells[`${column}${row}`]]));
}
function isExcelPenanceSheet(sheetName=''){
  return String(sheetName || '').replace(/\s+/g,'')==='고행';
}
function excelUnitBoardSpeedModeValue(cells={},sheetName=''){
  if(!isExcelPenanceSheet(sheetName)) return undefined;
  const value=excelText(cells.N76).trim().toUpperCase();
  if(value==='O' || value==='ON') return 'ON';
  if(value==='X' || value==='OFF') return 'OFF';
  return undefined;
}
function buildExcelChoiceRow(name, excel, id, options={}){
  const changeValue=options.boolean ? (excelFlag(excel)?'ON':'OFF') : String(excel??'');
  const currentValue=webControlDisplay(id);
  return buildCompareTextRow('룬효과 버프',name,changeValue,currentValue,{id});
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
  return isExcelTowerContext(cells, sheetName) ? '도전의탑 층' : '목표 라운드';
}
function buildExcelInputSpecs(cells,specCells,sheetName=''){
  const roundFieldId=excelRoundFieldId(cells,sheetName);
  const roundFieldName=excelRoundFieldName(cells,sheetName);
  const runeMods=excelSelectedRuneModificationValues(cells,specCells);
  const unitBoardSpeedMode=excelUnitBoardSpeedModeValue(cells,sheetName);
  return [
    ['기본 정보','시작 SP',Math.round(Number(normalizedExcelTotalSpValue(cells))||0),'sp'],
    ['기본 정보','보유 XP',specCells.R20,'xp'],
    ['기본 정보','보유 BXP',specCells.R21,'bxp'],
    ['기본 정보','보유 RP',cells.B16,'rp'],
    ['기본 정보','본인 심연의혼',cells.B19,'soul'],
    ['기본 정보','코랄의 파편',specCells.R26,'coralShard'],
    ['기본 정보','아이어의 파편',specCells.R27,'aiurShard'],
    ['기본 정보','제루스의 파편',specCells.R28,'xerusShard'],
    ['기본 정보','난이도',firstExcelValue(cells,['B4','N41']),'diff'],
    ['기본 정보','고행 단계',firstExcelValue(cells,['B6','N42','AD8']),'penance'],
    ['기본 정보',roundFieldName,firstExcelValue(cells,['B7','N43']),roundFieldId],
    ['기본 정보','출발 지원 인원수',cells.D5,'team'],
    ['기본 정보','타이틀 총 데미지',EXCEL_TITLE_BONUS_MAP[excelText(specCells.S17)]??specCells.S17,'titleTdBonus'],
    ['기본 정보','침식 스텍',cells.H10,'erosionStack'],
    ['기본 정보','심연 내성',cells.H11,'jewelErosionRes'],
    ['기본 정보','파워 블레스',normalizePowerBlessRawValue(cells.D4),'pbless'],
    ...(unitBoardSpeedMode===undefined ? [] : [['유닛 보드','스피드 모드',unitBoardSpeedMode,'dpsBaseUnitSpeedMode']]),
    ['룬정보','공격력',cells.J5,'rAD'],
    ['룬정보','공격력 개조',runeMods.rModAD,'rModAD'],
    ['룬정보','룬 특수 옵션',EXCEL_RUNE_TYPE_MAP[excelText(cells.I6)]??cells.I6,'runeChoiceType'],
    ['룬정보','룬 특수 옵션',cells.J6,'runeChoiceValue'],
    ['룬정보','공격속도',cells.J7,'rAS'],
    ['룬정보','공격속도 개조',runeMods.rModAS,'rModAS'],
    ['룬정보','크리티컬 데미지',cells.J8,'rCD'],
    ['룬정보','크리티컬 데미지 개조',runeMods.rModCD,'rModCD'],
    ['룬정보','크리티컬 확률',cells.J9,'rCRI'],
    ['룬정보','크리티컬 확률 개조',runeMods.rModCRI,'rModCRI'],
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
function readExcelSheetSource(workbook,sheetName){
  const cells=workbook.getCells(sheetName);
  validateExcelCompareSheet(cells,sheetName);
  const specCells=workbook.getCells('스펙');
  const zeroCells=getZeroScoreSheetCells(workbook);
  const additionalInfo=inspectSpecAdditionalStructure(specCells);
  return {cells,specCells,zeroCells,additionalInfo};
}
function buildExcelStatRows(cells,stats){
  return EXCEL_COMPARE_STATS.map(([,name,displayCell,,getDisplay])=>{
    const excelDisplay=excelCompareNumberValue(cells[displayCell]);
    const webDisplay=excelCompareRound(getDisplay(stats),6);
    const displayCompare=compareNumber(excelDisplay,webDisplay);
    return {kind:'스펙 보드',name,current:formatCompareNumber(webDisplay),change:formatCompareNumber(excelDisplay),
      difference:formatCompareDiff(displayCompare.diff),status:displayCompare.status,diffClass:compareNumberDiffClass(displayCompare.diff)};
  });
}
function buildExcelTraitRows(cells){
  return TRAITS.filter(t=>t[0]>=42&&t[0]<=138).map(t=>{
    const row=t[0], changeValue=excelCompareNumberValue(cells[`H${row}`]), currentValue=Number(INV[row]||0);
    return buildCompareNumberRow('특성 보드',t[1],changeValue,currentValue,0.0001);
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
    buildExcelChoiceRow('유물',cells.F11,'prodArtifact',{boolean:true}),
    buildExcelChoiceRow('비밀 작전 노바',cells.F4,'prodNova',{boolean:true}),
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
function normalizedCompareJewelSettings(value){
  const source=value && typeof value==='object' && !Array.isArray(value) ? value : {};
  return {legendaryMythicJewels:normalizeDpsJewelSettings(source.legendaryMythicJewels || source.legendaryMythic || source.jewelSettings || {})};
}
function jewelCompareItems(value){
  const setting=normalizeDpsJewelSetting(value);
  return [['공격력',setting.ad],['공격속도',setting.as],['총데미지',setting.td],['가속',`${setting.ua}%`],['강화',setting.enhance],['신화',setting.mythic]];
}
function buildExcelJewelRows(jewelImport,currentValue){
  if(!jewelImport?.present){
    return [buildCompareTextRow('쥬얼 설정','쥬얼 시트','없음','기준 프리셋 공용 설정')];
  }
  const change=normalizedCompareJewelSettings(jewelImport.settings);
  const current=normalizedCompareJewelSettings(currentValue);
  return dpsJewelNames().map(name=>buildCompareDetailRow(
    '쥬얼 설정',name,
    jewelCompareItems(change.legendaryMythicJewels[name]),
    jewelCompareItems(current.legendaryMythicJewels[name])
  ));
}
function buildTraitPresetJewelCompareRows(changeValue,currentValue){
  const changePresent=!!normalizeTraitPresetJewelSettings(changeValue);
  const currentPresent=!!normalizeTraitPresetJewelSettings(currentValue);
  const change=normalizedCompareJewelSettings(changeValue);
  const current=normalizedCompareJewelSettings(currentValue);
  const rows=[buildCompareTextRow(
    '쥬얼 설정','공용 쥬얼 데이터',
    changePresent?'포함':'없음',
    currentPresent?'포함':'없음'
  )];
  dpsJewelNames().forEach(name=>rows.push(buildCompareDetailRow(
    '쥬얼 설정',`전설·신화 쥬얼 · ${name}`,
    jewelCompareItems(change.legendaryMythicJewels[name]),
    jewelCompareItems(current.legendaryMythicJewels[name])
  )));
  return rows;
}

function buildExcelJewelOnlyComparison(fileName,sheetName,jewelImport,currentJewelSettings){
  if(!jewelImport?.present || !jewelImport.settings) throw new Error('선택한 엑셀파일에 쥬얼 시트가 없습니다.');
  const jewelRows=buildExcelJewelRows(jewelImport,currentJewelSettings);
  return {
    fileName,
    sheetName,
    sourceType:'excel',
    summary:{
      dps:{change:0,current:0,diff:0,status:'same'},
      statDiffs:0,
      inputDiffs:0,
      traitDiffs:0,
      buffDiffs:0,
      jewelDiffs:jewelRows.filter(row=>row.status!=='same').length,
      unitBoardDiffs:0,
      zeroDiffs:0
    },
    rows:jewelRows
  };
}

function buildExcelComparison(cells, specCells, zeroCells, fileName, sheetName, jewelImport=null, currentJewelSettings=null){
  validateExcelCompareSheet(cells,sheetName);
  const stats=computeStatsRaw();
  const dpsCompare=compareNumber(cells.M19,stats.M19);
  const inputRows=buildExcelInputRows(cells,specCells,sheetName);
  const enchantRows=buildEnchantCompareRows(getSpecEnchantCode(specCells),webControlDisplay('enchantCode'));
  const statRows=buildExcelStatRows(cells,stats);
  const buffRows=buildExcelBuffRows(cells,specCells);
  const traitRows=buildExcelTraitRows(cells);
  const zeroRows=buildZeroScoreCompareRows(zeroCells);
  const jewelRows=buildExcelJewelRows(jewelImport,currentJewelSettings);
  const dpsRow=buildCompareNumberRow('스펙 보드','DPS',cells.M19,stats.M19);
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
      jewelDiffs:jewelRows.filter(r=>r.status!=='same').length,
      zeroDiffs:zeroRows.filter(r=>r.status!=='same').length
    },
    rows:[
      dpsRow,
      ...inputRows,
      ...enchantRows,
      ...statRows,
      ...buffRows,
      ...jewelRows,
      ...zeroRows,
      ...traitRows
    ]
  };
}
const COMPARE_FILTERS={
  all:{label:'전체 보기',summaryKeys:[]},
  specInput:{label:'스펙·입력',summaryKeys:['statDiffs','inputDiffs']},
  runeBuff:{label:'룬·버프',summaryKeys:['buffDiffs']},
  traitZero:{label:'특성·승단',summaryKeys:['traitDiffs','zeroDiffs']},
  unit:{label:'유닛 보드',summaryKeys:['unitBoardDiffs']},
  jewel:{label:'쥬얼 설정',summaryKeys:['jewelDiffs']}
};
const COMPARE_FILTER_ORDER=['all','specInput','runeBuff','traitZero','unit','jewel'];
const EXCEL_COMPARE_COLGROUP='<colgroup><col class="compare-col-kind"><col class="compare-col-name"><col class="compare-col-current"><col class="compare-col-change"><col class="compare-col-diff"></colgroup>';
const EXCEL_COMPARE_EMPTY_HTML='<div class="excel-compare-empty">기준 프리셋과 비교 프리셋을 선택하세요.<small>엑셀파일은 시트 단위, 특성 프리셋 파일은 프리셋 제목 단위로 비교합니다.</small></div>';
function renderExcelCompareHeaderControls(){
  return `<div class="excel-compare-controls excel-compare-header-controls">
    <label class="ui-action-btn excel-compare-file-btn excel-compare-base-file-btn">기준 파일<input id="excelCompareBaseFile" type="file" accept=".json,.txt,application/json,text/plain"></label>
    <select id="excelCompareBasePreset" aria-label="기준 프리셋 목록" disabled><option value="">기준 프리셋 목록</option></select>
    <label class="ui-action-btn excel-compare-file-btn excel-compare-target-file-btn">비교 파일<input id="excelCompareFile" type="file" accept=".xlsm,.xlsx,.json,.txt,application/json,text/plain,application/vnd.ms-excel.sheet.macroEnabled.12"></label>
    <select id="excelCompareSheet" aria-label="비교 프리셋 목록" disabled><option value="">비교파일을 불러오세요</option></select>
    <button id="excelCompareApplyBtn" class="ui-action-btn excel-compare-apply-btn" type="button" data-excel-compare-apply="1" disabled>비교 프리셋값 적용</button>
    <button id="excelCompareJewelOnlyBtn" class="ui-action-btn excel-compare-jewel-only-btn" type="button" data-excel-compare-jewel-only="1" disabled>쥬얼 데이터만 적용</button>
    <button id="excelCompareRestoreBtn" class="ui-action-btn excel-compare-restore-btn" type="button" data-excel-compare-restore="1" disabled>기준 프리셋 복원</button>
    <button id="excelCompareResetBtn" class="ui-action-btn excel-compare-reset-btn" type="button" data-excel-compare-reset="1" disabled>초기화</button>
  </div>`;
}
function renderExcelComparePanel(){
  return `<section class="dps-table-panel excel-compare-panel"><div class="excel-compare-body" id="excelCompareBody">${EXCEL_COMPARE_EMPTY_HTML}</div></section>`;
}
function hydrateCompareControls(){
  const select=$('excelCompareSheet');
  const baseSelect=$('excelCompareBasePreset');
  const baseRejected=!!compareState.baseFileRejected;
  if(baseSelect){
    const bundle=compareState.baseTraitPresetBundle;
    const store=baseRejected ? {presets:[]} : (bundle || loadTraitPresetStore());
    const presets=Array.isArray(store.presets) ? store.presets : [];
    const ids=presets.map(preset=>preset.id);
    const localSelected=!bundle ? selectedTraitPresetId() : '';
    const fallback=ids.includes(compareState.baseTraitPresetId) ? compareState.baseTraitPresetId : (ids.includes(localSelected) ? localSelected : (ids[0] || ''));
    baseSelect.innerHTML=presets.map(preset=>`<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</option>`).join('') || '<option value="">기준 프리셋 없음</option>';
    baseSelect.disabled=!presets.length;
    baseSelect.value=fallback;
    compareState.baseTraitPresetId=fallback;
  }
  if(!select){ updateCompareTargetFileAccess(); return; }
  if(compareState.sourceType==='excel' && compareState.workbook){
    const sheets=compareState.workbook.sheets || [];
    const names=sheets.map(sheet=>sheet.name);
    const selected=names.includes(compareState.selectedSheetName) ? compareState.selectedSheetName : (names[0] || '');
    select.innerHTML=sheets.map(sheet=>`<option value="${escapeHtml(sheet.name)}">${escapeHtml(sheet.name)}</option>`).join('');
    select.disabled=!sheets.length;
    if(selected){
      select.value=selected;
      compareState.selectedSheetName=selected;
    }
  }else if(compareState.sourceType==='traitPreset' && compareState.traitPresetBundle){
    const bundle=compareState.traitPresetBundle;
    const presets=Array.isArray(bundle.presets) ? bundle.presets : [];
    const ids=presets.map(preset=>preset.id);
    const selected=ids.includes(compareState.selectedSheetName) ? compareState.selectedSheetName : (ids[0] || '');
    select.innerHTML=presets.map(preset=>`<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</option>`).join('') || '<option value="">프리셋 없음</option>';
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
  updateCompareTargetFileAccess();
}
function compareHasValidBase(){
  return !!selectedTraitPresetForComparison('base');
}
function selectedComparisonBasePresetState(){
  const preset=selectedTraitPresetForComparison('base');
  if(!preset) throw new Error('기준 프리셋을 선택하세요.');
  const state=normalizeSavedState(preset.state);
  if(!state) throw new Error('기준 프리셋 데이터가 올바르지 않습니다.');
  return {preset,state};
}
function updateCompareTargetFileAccess(){
  const input=$('excelCompareFile');
  const label=document.querySelector('.excel-compare-target-file-btn');
  const enabled=compareHasValidBase();
  if(input) input.disabled=!enabled;
  if(label){
    label.classList.toggle('is-disabled',!enabled);
    label.setAttribute('aria-disabled',enabled?'false':'true');
  }
}
function clearCompareTargetSelection(){
  compareState.workbook=null;
  compareState.backupState=null;
  compareState.traitPresetBundle=null;
  compareState.sourceType=null;
  compareState.lastResult=null;
  compareState.activeFilter='all';
  clearCompareRestoreState(false);
  compareState.selectedSheetName='';
  const targetFile=$('excelCompareFile');
  const targetSelect=$('excelCompareSheet');
  if(targetFile) targetFile.value='';
  if(targetSelect){
    targetSelect.innerHTML='<option value="">비교파일을 불러오세요</option>';
    targetSelect.disabled=true;
    targetSelect.value='';
  }
}
function rejectCompareBaseFile(message){
  compareState.baseTraitPresetBundle=null;
  compareState.baseTraitPresetId='';
  compareState.baseFileRejected=true;
  clearCompareTargetSelection();
  hydrateCompareControls();
  const body=$('excelCompareBody');
  if(body) body.innerHTML=`<div class="excel-compare-error">${escapeHtml(message || '분석 기준 파일을 불러올 수 없습니다.')}</div>`;
  updateCompareActionButtons();
}
function selectedExcelSheetName(){
  if(isExcelSupportBlocked()) return '';
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

const COMPARE_INPUT_EXCLUDE_KINDS=new Set(['스펙 보드','룬효과 버프','쥬얼 설정','유닛 보드','특성 보드','더제로 승단 정보']);
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
  if(filter==='specInput') return row.kind==='스펙 보드' || !COMPARE_INPUT_EXCLUDE_KINDS.has(row.kind);
  if(filter==='runeBuff') return row.kind==='룬효과 버프';
  if(filter==='traitZero') return row.kind==='특성 보드' || row.kind==='더제로 승단 정보';
  if(filter==='unit') return row.kind==='유닛 보드';
  if(filter==='jewel') return row.kind==='쥬얼 설정';
  return true;
}
function compareFilterCount(summary,filter){
  const config=COMPARE_FILTERS[filter];
  return config ? config.summaryKeys.reduce((total,key)=>total+(Number(summary[key]) || 0),0) : 0;
}
function compareSummaryHtml(summary,active){
  return COMPARE_FILTER_ORDER.map(filter=>compareSummaryCard(
    filter,
    COMPARE_FILTERS[filter].label,
    filter==='all' ? 0 : compareFilterCount(summary,filter),
    active
  )).join('');
}
function setCompareError(message, options={}){
  const body=$('excelCompareBody');
  const apply=$('excelCompareApplyBtn');
  const reset=$('excelCompareResetBtn');
  if(apply) apply.disabled=true;
  if(reset) reset.disabled=false;
  if(body){
    const html=escapeHtml(message ?? '비교 실패');
    body.innerHTML=`<div class="excel-compare-error">${options.keepVersionMarkup ? html.replace('5.4392','<span class="excel-compare-version">5.4392</span>') : html}</div>`;
  }
  updateCompareActionButtons();
}
function compareRowsHtml(rows,emptyMessage){
  return rows.map(row=>`<tr class="${row.status}${row.rowClass?` ${row.rowClass}`:''}"><td>${escapeHtml(row.kind)}</td><th>${escapeHtml(row.name)}</th><td>${row.current}</td><td>${row.change}</td><td class="compare-diff ${row.diffClass||''}">${row.difference}</td></tr>`).join('') ||
    `<tr class="same"><td colspan="5" class="excel-compare-no-diff">${escapeHtml(emptyMessage)}</td></tr>`;
}
function renderExcelComparison(result,options={}){
  const body=$('excelCompareBody');
  if(!body) return;
  compareState.lastResult=result;
  if(!options.preserveFilter) compareState.activeFilter='all';
  const active=COMPARE_FILTERS[compareState.activeFilter] ? compareState.activeFilter : 'all';
  compareState.activeFilter=active;
  const {summary}=result;
  const visibleRows=(result.rows||[]).filter(row=>compareRowMatchesFilter(row,active));
  const emptyMessage=active==='all' ? '기준 프리셋과 비교 프리셋이 모두 일치합니다.' : `${COMPARE_FILTERS[active]?.label || '선택한 구분'} 항목에서 차이 난 값이 없습니다.`;
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
function openCompareInfo(){
  window.DpsModal.openMonthRune('compare');
}
function closeCompareInfo(){
  window.DpsModal.closeMonthRune();
}
function compareCanApply(){
  if(compareState.applied) return false;
  if(compareState.sourceType==='json') return !!compareState.backupState;
  if(compareState.sourceType==='traitPreset') return !!selectedTraitPresetForComparison('change');
  if(compareState.sourceType==='excel'){
    const sheetName=selectedExcelSheetName();
    return !!(compareState.workbook && sheetName && sheetName!==EXCEL_JEWEL_SHEET_NAME && compareState.lastResult);
  }
  return false;
}
function updateCompareActionButtons(){
  const apply=$('excelCompareApplyBtn');
  const jewelOnly=$('excelCompareJewelOnlyBtn');
  const reset=$('excelCompareResetBtn');
  const restore=$('excelCompareRestoreBtn');
  if(apply) apply.disabled=!compareCanApply();
  if(jewelOnly){
    const canApplyJewels=!compareState.applied && compareState.sourceType==='excel' && !!compareState.workbook && readExcelJewelSettings(compareState.workbook).present;
    jewelOnly.disabled=!canApplyJewels;
  }
  if(reset) reset.disabled=!(compareState.sourceType || compareState.lastResult || compareState.workbook || compareState.backupState || compareState.traitPresetBundle);
  if(restore) restore.disabled=!(compareState.restoreState || compareState.restoreJewelSettings);
  updateCompareTargetFileAccess();
}
function clearCompareRestoreState(updateButtons=true){
  compareState.restoreState=null;
  compareState.restoreJewelSettings=null;
  compareState.restoreTraitPresetStatus=null;
  compareState.applied=false;
  if(updateButtons) updateCompareActionButtons();
}
function restoreComparisonCurrentState(){
  if(!compareState.restoreState && !compareState.restoreJewelSettings) return;
  try{
    const restoreState=compareState.restoreState;
    const restoreJewelSettings=compareState.restoreJewelSettings;
    const restoreTraitPresetStatus=compareState.restoreTraitPresetStatus;
    if(restoreState) applyStateObject(restoreState);
    if(restoreJewelSettings){
      applyTraitPresetJewelSettings(restoreJewelSettings);
      sanitizeDpsJewelSelections();
      syncDpsBaseUnitControl();
    }
    const saved=saveState({silent:true});
    if(saved===false) throw new Error('현재값은 복원했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.');
    if(restoreTraitPresetStatus) saveTraitPresetStatusData(restoreTraitPresetStatus);
    clearCompareRestoreState(false);
    if(compareState.sourceType==='json' && compareState.backupState) renderJsonComparison(compareState.backupState);
    else if(compareState.sourceType==='traitPreset'){ hydrateCompareControls(); compareSelectedTraitPreset({preserveRestore:true}); }
    else if(compareState.sourceType==='excel'){ hydrateCompareControls(); compareSelectedExcelSheet({preserveRestore:true}); }
    updateCompareActionButtons();
    renderTraitPresetUpdateStatus();
    notifyStorageAction('현재값 복원 완료','ok',{statusAction:'load'});
  }catch(e){
    rememberAppIssue('error','[compare restore failed]',e);
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
function resolveExcelSelectValue(id, value){
  const select=$(id);
  const text=excelText(value);
  if(!select||!text) return null;
  const option=findSelectOptionByText(select, text);
  return option ? option.value : null;
}
function firstExcelValue(cells, refs){
  for(const ref of refs){
    if(cells[ref]!==undefined && cells[ref]!==null && cells[ref]!=='') return cells[ref];
  }
  return null;
}
function hasExcelCellValue(cells={}, ref=''){
  return cells[ref]!==undefined && cells[ref]!==null && String(cells[ref]).trim()!=='';
}
function excelSpBankBonusValue(cells={}){
  const direct=hasExcelCellValue(cells,'AM9') ? excelNumber(cells.AM9) : null;
  if(direct!==null) return Math.max(0,direct);
  const ticks=hasExcelCellValue(cells,'AL9') ? excelNumber(cells.AL9) : null;
  if(ticks===null || ticks<=0) return 0;
  const unitBonus=hasExcelCellValue(cells,'D89') ? excelNumber(cells.D89) : null;
  if(unitBonus!==null && unitBonus>0) return unitBonus*ticks;
  const bankLevel=hasExcelCellValue(cells,'H89') ? excelNumber(cells.H89) : null;
  return bankLevel!==null && bankLevel>0 ? bankLevel*1000*ticks : 0;
}
function excelSpBankApplyValue(cells={}){
  return excelSpBankBonusValue(cells)>0 ? '반영' : '미반영';
}
function normalizedExcelTotalSpValue(cells={}){
  const total=hasExcelCellValue(cells,'B9') ? excelNumber(cells.B9) : null;
  if(total===null) return cells.B9;
  const spBankBonus=excelSpBankBonusValue(cells);
  return spBankBonus>0 && total>=spBankBonus ? total-spBankBonus : total;
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
  const runeMods=excelSelectedRuneModificationValues(cells,specCells);
  const values={...state.values, soloMode:'ON', coopMode:'OFF', coopPassenger2Dr:'0', coopPassenger3Dr:'0'};
  const roundFieldId=excelRoundFieldId(cells,sheetName);
  const unitBoardSpeedMode=excelUnitBoardSpeedModeValue(cells,sheetName);
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
    ['erosionStack',cells.H10],['jewelErosionRes',cells.H11],
    ['overEnhance',cells.H14],['repairEnhance',cells.H15],['enhanceMaster',cells.H16],
    ['coralShard',specCells.R26],['aiurShard',specCells.R27],['xerusShard',specCells.R28],
    ['prodNova',cells.F4],['prodTeratron',cells.F5],['prodAmon',cells.F6],['prodAdun',cells.F7],
    ['prodKerrigan',cells.F8],['prodOvermind',cells.F9],['prodNarud',cells.F10],['prodArtifact',cells.F11],
    ['flowerSkill1',cells.F13],['flowerSkill2',cells.F14],['flowerSkill3',cells.F15],
    ['rAD',cells.J5],['rAS',cells.J7],['rCD',cells.J8],['rCRI',cells.J9],
    ['rModAD',runeMods.rModAD],['rModAS',runeMods.rModAS],['rModCD',runeMods.rModCD],['rModCRI',runeMods.rModCRI],
    ['rReinf',cells.J11],['rAsc',cells.J12],['raceOpt',cells.J13],
    ['opt10',cells.J14],['opt15',cells.J15],['transOpt',cells.J16],
    ['addAD',getSpecAdditionalValue(specCells,'addAD')],['addAS',getSpecAdditionalValue(specCells,'addAS')],
    ['addCD',getSpecAdditionalValue(specCells,'addCD')],['addCRI',getSpecAdditionalValue(specCells,'addCRI')],
    ['addAP',getSpecAdditionalValue(specCells,'addAP')],['addTD',getSpecAdditionalValue(specCells,'addTD')],
    ['addUA',getSpecAdditionalValue(specCells,'addUA')]
  ].forEach(([id,value])=>{ applied+=assign(id,value); });
  if(unitBoardSpeedMode!==undefined) applied+=assign('dpsBaseUnitSpeedMode',unitBoardSpeedMode);
  if(cells.D4!==undefined && cells.D4!==null && cells.D4!==''){
    values.pbless=normalizePowerBlessRawValue(cells.D4);
    applied++;
  }
  applied+=assign('sp',normalizedExcelTotalSpValue(cells),{number:true,integer:true});
  applied+=assign('xp',specCells.R20,{number:true,integer:true});
  applied+=assign('bxp',specCells.R21,{number:true,integer:true});
  applied+=assign('rp',cells.B16,{number:true,integer:true});
  applied+=assign('soul',cells.B19,{number:true,integer:true});
  applied+=assign('aprRuneNormal',specCells.N52);
  applied+=assign('aprRunePlus',specCells.O52);
  applied+=assign('sepRuneNormal',specCells.N53);
  applied+=assign('sepRunePlus',specCells.O53);
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
  values.spBankApply=excelSpBankApplyValue(cells);
  syncSpBankPresetState(values, inv);
  if(hasExcelCellValue(cells,'H89')) applied++;
  inv[116]=1;
  const zeroScore=zeroScoreStateFromExcel(zeroCells) || state.zeroScore;
  if(zeroScore?.rows?.length) applied+=zeroScore.rows.reduce((sum,row)=>sum+(row.type==='penance'?5:(row.type==='towerCombo'?4:2)),0);
  return {state:makeStorageEnvelope({...state,values,inv,zeroScore}),applied};
}

/* JSON·프리셋 비교 */
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
const NEW_PRESET_ON_OFF_VALUE_IDS=new Set(['specDpsSpeedMode','dpsBaseUnitSpeedMode','dpsBaseUnitShieldOff','dpsBaseUnitShieldMaster']);
function compareSavedValueDisplay(value,id){
  if(NEW_PRESET_ON_OFF_VALUE_IDS.has(id) && (value===undefined || value===null || String(value).trim()==='')) return '미저장';
  if(TRAIT_LIMIT_INPUT_IDS.has(id)) return traitLimitDisplayText(value);
  if(id==='spBankApply') return spBankApplyDisplayValue(value);
  if(isCompareNumericValueId(id)) return formatCompareNumber(value);
  return compareDisplayText(value,id);
}
function buildSavedValueCompareRows(changeState,currentState,options={}){
  const onlyDiffs=options.onlyDiffs!==false;
  const excludedKinds=new Set(Array.isArray(options.excludeKinds) ? options.excludeKinds : []);
  const includedIds=Array.isArray(options.includeIds) ? options.includeIds : null;
  const ordered=includedIds || userStateElementIds();
  const skipped=new Set(['excelCompareFile','excelCompareSheet','enchantCode','runeChoiceType','runeChoiceValue',...ENCHANT_INPUT_IDS]);
  const sourceIds=includedIds ? ordered : [...ordered,'dpsTableMinDps',...Object.keys(currentState.values||{}),...Object.keys(changeState.values||{})];
  const ids=[...new Set(sourceIds)]
    .filter(id=>id && !skipped.has(id) && isUserStateValueId(id) && !!COMPARE_VALUE_META[id] && !excludedKinds.has(COMPARE_VALUE_META[id].kind));
  const rows=[];
  if(options.includeRuneChoice!==false){
    const runeRow=buildRuneChoiceCompareRow('룬정보', changeState.values||{}, currentState.values||{});
    if(!onlyDiffs || runeRow.status!=='same') rows.push(runeRow);
  }
  ids.forEach(id=>{
    const meta=COMPARE_VALUE_META[id];
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
    return buildCompareNumberRow('특성 보드',t[1],changeValue,currentValue,0.0001);
  }).filter(row=>row.status!=='same');
}
function traitPresetUnitBoardResultMap(stats){
  return new Map((stats?.dpsBaseUnit?.results || []).map(result=>[String(result?.unitId || ''),result]));
}
function traitPresetUnitBoardUnitItems(unitState,boardState,result,expandedIds){
  if(!unitState) return [['상태','선택 안 함']];
  const unit=dpsBaseUnitById(unitState.unitId);
  const quantity=Math.max(1,Number(unitState.quantity)||1);
  const legendary=normalizeDpsJewelName(unitState.legendaryMythicJewel);
  const extras=(boardState?.additionalUnitSettings?.[unitState.unitId] || []).slice(0,Math.min(DPS_BASE_UNIT_EXTRA_SLOT_COUNT,Math.max(0,quantity-1)));
  const equippedCount=(legendary?1:0)+extras.filter(setting=>normalizeDpsJewelName(setting?.legendaryMythicJewel)).length;
  const unequipped=Math.max(0,quantity-equippedCount);
  const supportsAdvancedOptions=dpsBaseUnitSupportsAdvancedOptions(unit);
  const items=[
    ['유닛명',dpsBaseUnitLabel(unit || unitState.unitId)],
    ['방어력 관통',result ? dpsBaseUnitPercentText(result.excelPierce) : '—'],
    [dpsBaseUnitIsArtifact(unit)?'파장 총 DPS':'총 DPS',result ? dpsBaseUnitDpsText(result) : '—'],
    ['수량',quantity],
    ['강화 기대값',Number(unitState.enhanceExpected)||0]
  ];
  if(supportsAdvancedOptions){
    items.push(['1기 한계 돌파',Number(unitState.limitBreak)||0],['1기 전설·신화 쥬얼',legendary || '없음']);
    (boardState?.additionalUnitSettings?.[unitState.unitId] || []).slice(0,DPS_BASE_UNIT_EXTRA_SLOT_COUNT).forEach((setting,index)=>{
      const normalized=normalizeDpsBaseUnitExtraSlotSetting(setting);
      items.push([`${index+2}기 한계 돌파`,normalized.limitBreak],[`${index+2}기 전설·신화 쥬얼`,normalized.legendaryMythicJewel || '없음']);
    });
    items.push(['공허의 힘',normalizeDpsBaseUnitVoidPowerValue(unitState.voidPower)]);
  }
  if(dpsBaseUnitAllowsSlotExpansion(unit)) items.push(['슬롯 확장',expandedIds.has(unitState.unitId)?'ON':'OFF']);
  if(!dpsBaseUnitIsArtifact(unit)) items.push(['미장착 수량',unequipped]);
  return items;
}
function traitPresetUnitBoardVoidPowerUsage(value){
  const state=normalizeTraitPresetUnitBoardState(value);
  const used=state.units.reduce((sum,item)=>{
    const unit=dpsBaseUnitById(item.unitId);
    if(!dpsBaseUnitSupportsAdvancedOptions(unit) || item.unitId==='prodNarud' || normalizeDpsBaseUnitVoidPowerValue(item.voidPower)!=='ON') return sum;
    return sum+Math.max(1,Number(item.quantity)||1);
  },0);
  return Math.min(dpsBaseUnitVoidPowerLimit(),used);
}
function buildTraitPresetUnitBoardSummaryRows(changeStats,currentStats,changeBoard,currentBoard){
  const changeInfo=changeStats?.dpsBaseUnit || {};
  const currentInfo=currentStats?.dpsBaseUnit || {};
  const changeAchievement=dpsBaseUnitAchievementState(changeInfo.achievementRate);
  const currentAchievement=dpsBaseUnitAchievementState(currentInfo.achievementRate);
  return [
    buildCompareTextRow('유닛 보드','클리어 기준',dpsBaseUnitNumberText(changeInfo.requiredDps,DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS),dpsBaseUnitNumberText(currentInfo.requiredDps,DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS)),
    buildCompareTextRow('유닛 보드','클리어 기대값',dpsBaseUnitNumberText(changeInfo.expectedDps,DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS),dpsBaseUnitNumberText(currentInfo.expectedDps,DPS_BASE_UNIT_SUMMARY_NUMBER_OPTIONS)),
    buildCompareTextRow('유닛 보드','달성률 상태',changeAchievement.label,currentAchievement.label),
    buildCompareTextRow('유닛 보드','달성률',dpsBaseUnitAchievementText(changeInfo.achievementRate),dpsBaseUnitAchievementText(currentInfo.achievementRate)),
    buildCompareTextRow('유닛 보드','공허의 힘 사용량',`${traitPresetUnitBoardVoidPowerUsage(changeBoard)} / ${dpsBaseUnitVoidPowerLimit()}`,`${traitPresetUnitBoardVoidPowerUsage(currentBoard)} / ${dpsBaseUnitVoidPowerLimit()}`)
  ];
}

function buildTraitPresetUnitBoardCompareRows(changeValue,currentValue,options={}){
  const changeIncluded=options.changeIncluded===true;
  const currentIncluded=options.currentIncluded===true;
  const change=normalizeTraitPresetUnitBoardState(changeIncluded ? changeValue : null);
  const current=normalizeTraitPresetUnitBoardState(currentIncluded ? currentValue : null);
  const changeResults=traitPresetUnitBoardResultMap(options.changeStats);
  const currentResults=traitPresetUnitBoardResultMap(options.currentStats);
  const changeExpanded=new Set(normalizeDpsBaseUnitSlotExpansions(change.slotExpansions));
  const currentExpanded=new Set(normalizeDpsBaseUnitSlotExpansions(current.slotExpansions));
  const rows=[buildCompareTextRow('유닛 보드','유닛 구성',changeIncluded?'포함':'없음 · 선택 안 함',currentIncluded?'포함':'없음 · 선택 안 함')];
  rows.push(buildCompareNumberRow('유닛 보드','선택 유닛 수',change.units.length,current.units.length,0.0001));
  const changeBySlot=new Map(change.units.map(item=>[item.slot,item]));
  const currentBySlot=new Map(current.units.map(item=>[item.slot,item]));
  const slots=[...new Set([...changeBySlot.keys(),...currentBySlot.keys()])].sort((a,b)=>a-b);
  slots.forEach(slot=>{
    const changeUnit=changeBySlot.get(slot);
    const currentUnit=currentBySlot.get(slot);
    rows.push(buildCompareDetailRow(
      '유닛 보드',
      `${slot+1}번 유닛`,
      traitPresetUnitBoardUnitItems(changeUnit,change,changeResults.get(changeUnit?.unitId),changeExpanded),
      traitPresetUnitBoardUnitItems(currentUnit,current,currentResults.get(currentUnit?.unitId),currentExpanded)
    ));
  });
  return rows;
}
function captureDamageBoardCompareData(stats){
  const enemy=stats?.enemyData || {};
  const round=Math.max(0,Number(enemy.round)||0);
  const diffName=vs('diff');
  const rpBonus=enemyRoundTimeBonus(diffName);
  return {
    pierce:`${fmt(stats?.excelPierce,0)}%`,
    armor:fullNumber(enemy.armor),
    count:enemyDisplayCountText(round),
    hp:fullNumber(enemy.hp),
    shield:fullNumber(enemy.shield),
    roundTime:Number.isFinite(Number(stats?.roundTime)) ? `${fmt(stats.roundTime,1)}초` : '—',
    rpTime:rpBonus>0 || isTowerDifficulty(diffName) ? `RP ${fmt(rpBonus,0)}초 / 최대 8초` : '-'
  };
}
function snapshotComparisonState(changeState,currentState,options={}){
  const restoreState=currentState || makeStateObject();
  const includeUnitBoard=options.includeUnitBoard===true;
  const includeJewelSettings=options.includeJewelSettings===true;
  const restoreUnitBoard=includeUnitBoard ? captureTraitPresetUnitBoardState() : null;
  const restoreJewelSettings=includeJewelSettings ? captureTraitPresetJewelSettings() : null;
  applyStateObject(changeState);
  try{
    if(includeJewelSettings){
      applyTraitPresetJewelSettings(options.jewelSettings || {legendaryMythicJewels:{}});
    }
    if(includeUnitBoard){
      applyTraitPresetUnitBoardState(options.unitBoardIncluded ? options.unitBoard : null,{recalculate:false,resetArtifactView:false});
    }
    const stats=computeStatsRaw();
    return {state:makeStateObject(),stats,damageBoard:captureDamageBoardCompareData(stats)};
  }finally{
    applyStateObject(restoreState);
    if(includeJewelSettings && restoreJewelSettings) applyTraitPresetJewelSettings(restoreJewelSettings);
    if(includeUnitBoard && restoreUnitBoard) applyTraitPresetUnitBoardState(restoreUnitBoard,{recalculate:false,resetArtifactView:false});
    if(includeUnitBoard || includeJewelSettings) recalc();
  }
}
function buildStateStatRows(changeStats,currentStats){
  return EXCEL_COMPARE_STATS.map(([,name,,,getDisplay])=>{
    const changeDisplay=excelCompareRound(getDisplay(changeStats),6);
    const currentDisplay=excelCompareRound(getDisplay(currentStats),6);
    const displayCompare=compareNumber(changeDisplay,currentDisplay);
    return {kind:'스펙 보드',name,current:formatCompareNumber(currentDisplay),change:formatCompareNumber(changeDisplay),
      difference:formatCompareDiff(displayCompare.diff),status:displayCompare.status,diffClass:compareNumberDiffClass(displayCompare.diff)};
  });
}
function buildStateDamageBoardContextRows(changeSnapshot,currentSnapshot){
  const change=changeSnapshot?.damageBoard || {};
  const current=currentSnapshot?.damageBoard || {};
  return [
    buildCompareTextRow('스펙 보드','방어력 관통',change.pierce,current.pierce),
    buildCompareTextRow('스펙 보드','적 방어력',change.armor,current.armor),
    buildCompareTextRow('스펙 보드','물량 / 총물량',change.count,current.count),
    buildCompareTextRow('스펙 보드','적 체력',change.hp,current.hp),
    buildCompareTextRow('스펙 보드','실드',change.shield,current.shield),
    buildCompareTextRow('스펙 보드','라운드 시간',change.roundTime,current.roundTime),
    buildCompareTextRow('스펙 보드','RP 시간',change.rpTime,current.rpTime)
  ];
}
function buildJsonComparison(changeState,options={}){
  const liveState=makeStateObject();
  const baseState=options.baseState ? normalizeSavedState(options.baseState) : liveState;
  const traitPresetMode=options.sourceType==='traitPreset';
  const currentSnapshot=options.baseState ? snapshotComparisonState(baseState,liveState,{
    includeUnitBoard:traitPresetMode,
    unitBoardIncluded:options.currentUnitBoardIncluded,
    unitBoard:options.currentUnitBoard,
    includeJewelSettings:traitPresetMode,
    jewelSettings:options.currentJewelSettings
  }) : (()=>{
    const stats=computeStatsRaw();
    return {state:liveState,stats,damageBoard:captureDamageBoardCompareData(stats)};
  })();
  const currentState={...currentSnapshot.state,fileName:options.baseFileName || currentSnapshot.state.fileName,sheetName:options.baseSheetName || currentSnapshot.state.sheetName};
  const currentStats=currentSnapshot.stats;
  const changeSnapshot=snapshotComparisonState(changeState,liveState,{
    includeUnitBoard:traitPresetMode,
    unitBoardIncluded:options.changeUnitBoardIncluded,
    unitBoard:options.changeUnitBoard,
    includeJewelSettings:traitPresetMode,
    jewelSettings:options.changeJewelSettings
  });
  const effectiveChangeState={...changeSnapshot.state,fileName:changeState.fileName || changeSnapshot.state.fileName,sheetName:changeState.sheetName || changeSnapshot.state.sheetName};
  const changeStats=changeSnapshot.stats;
  const compareChangeState=traitPresetMode ? (normalizeTraitPresetState(changeState) || effectiveChangeState) : effectiveChangeState;
  const compareCurrentState=traitPresetMode ? (normalizeTraitPresetState(baseState) || currentState) : currentState;
  const dpsCompare=compareNumber(changeStats.M19,currentStats.M19);
  const dpsRow=buildCompareNumberRow('스펙 보드','DPS',changeStats.M19,currentStats.M19);
  const inputRows=buildSavedValueCompareRows(compareChangeState,compareCurrentState,{
    onlyDiffs:false,
    excludeKinds:traitPresetMode ? ['유닛 보드','쥬얼 설정'] : []
  });
  const unitConditionRows=traitPresetMode ? buildSavedValueCompareRows(compareChangeState,compareCurrentState,{onlyDiffs:false,includeIds:DPS_BASE_UNIT_MODE_VALUE_IDS,includeRuneChoice:false}) : [];
  const enchantRows=buildEnchantCompareRows(enchantCompareCodeFromValues(compareChangeState.values),enchantCompareCodeFromValues(compareCurrentState.values));
  const statRows=[...buildStateStatRows(changeStats,currentStats),...buildStateDamageBoardContextRows(changeSnapshot,currentSnapshot)];
  const traitRows=buildSavedTraitCompareRows(compareChangeState,compareCurrentState);
  const zeroRows=buildSavedZeroScoreCompareRows(compareChangeState.zeroScore,compareCurrentState.zeroScore,{onlyDiffs:true});
  const jewelRows=traitPresetMode ? buildTraitPresetJewelCompareRows(options.changeJewelSettings,options.currentJewelSettings) : [];
  const unitBoardRows=traitPresetMode ? [
    ...unitConditionRows,
    ...buildTraitPresetUnitBoardSummaryRows(changeStats,currentStats,options.changeUnitBoard,options.currentUnitBoard),
    ...buildTraitPresetUnitBoardCompareRows(options.changeUnitBoard,options.currentUnitBoard,{
      changeIncluded:options.changeUnitBoardIncluded,
      currentIncluded:options.currentUnitBoardIncluded,
      changeStats,
      currentStats
    })
  ] : [];
  const inputDiffs=inputRows.filter(r=>r.status!=='same' && r.kind!=='룬효과 버프').length + enchantRows.filter(r=>r.status!=='same').length;
  const buffDiffs=inputRows.filter(r=>r.status!=='same' && r.kind==='룬효과 버프').length;
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
      jewelDiffs:jewelRows.filter(r=>r.status!=='same').length,
      unitBoardDiffs:unitBoardRows.filter(r=>r.status!=='same').length,
      zeroDiffs:zeroRows.length
    },
    rows:[dpsRow,...inputRows,...enchantRows,...statRows,...jewelRows,...unitBoardRows,...zeroRows,...traitRows]
  };
}
function renderJsonComparison(changeState,options={}){
  if(options.useSelectedBase){
    const {preset:basePreset,state:baseState}=selectedComparisonBasePresetState();
    return renderExcelComparison(buildJsonComparison(changeState,{
      baseState,
      sourceType:'json',
      baseFileName:(compareState.baseTraitPresetBundle || {}).fileName || '기준 프리셋',
      baseSheetName:basePreset.name
    }));
  }
  renderExcelComparison(buildJsonComparison(changeState));
}
function applySelectedComparison(){
  if(compareState.sourceType==='json') return applySelectedJsonBackup();
  if(compareState.sourceType==='traitPreset') return applySelectedTraitPreset();
  return applySelectedExcelSheet();
}
function applySelectedExcelJewelsOnly(){
  if(!guardExcelSupport()) return false;
  if(!compareState.workbook || compareState.applied || compareState.sourceType!=='excel') return false;
  const previousTraitPresetStatus=loadTraitPresetStatusData();
  try{
    const {jewelImport,previousJewelSettings,staged}=applyExcelJewelImport(
      compareState.workbook,
      '쥬얼값은 적용했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.',
      '[Excel jewel-only rollback failed]'
    );
    compareState.restoreState=null;
    compareState.restoreJewelSettings=previousJewelSettings;
    compareState.restoreTraitPresetStatus=previousTraitPresetStatus;
    compareState.applied=true;
    compareSelectedExcelSheet({preserveRestore:true});
    updateCompareActionButtons();
    renderTraitPresetUpdateStatus();
    const suffix=staged.needsUpdate ? ' · 프리셋 업데이트 필요' : ' · 기존 데이터와 동일';
    notifyStorageAction(`쥬얼 데이터 적용 완료 · 전설/신화 ${jewelImport.recognizedLegendary}개${suffix}`,'ok',{statusAction:'import'});
    return true;
  }catch(e){
    clearCompareRestoreState(false);
    rememberAppIssue('error','[Excel jewel-only apply failed]',e);
    showToast(e?.message || String(e),'err');
    updateCompareActionButtons();
    return false;
  }
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
    try{ applyStateObject(previousState); }catch(rollbackError){ rememberAppIssue('error','[backup apply rollback failed]', rollbackError); }
    clearCompareRestoreState(false);
    rememberAppIssue('error','[backup apply failed]',e);
    showToast(e?.message||String(e),'err');
    updateCompareActionButtons();
  }
}
function applySelectedExcelSheet(){
  if(!guardExcelSupport()) return false;
  if(!compareState.workbook || compareState.applied) return;
  const sheetName=selectedExcelSheetName();
  if(!sheetName){ showToast('선택한 시트를 찾을 수 없습니다.','err'); return; }
  if(sheetName===EXCEL_JEWEL_SHEET_NAME) return applySelectedExcelJewelsOnly();
  const previousState=makeStateObject();
  const previousJewelSettings=captureTraitPresetJewelSettings();
  const previousTraitPresetStatus=loadTraitPresetStatusData();
  try{
    const {cells,specCells,zeroCells,additionalInfo}=readExcelSheetSource(compareState.workbook,sheetName);
    if(!additionalInfo.valid) throw new Error(additionalInfo.message);
    const imported=buildExcelState(cells,specCells,zeroCells,sheetName);
    const jewelImport=readExcelJewelSettings(compareState.workbook);
    compareState.selectedSheetName=sheetName;
    applyStateObject(imported.state);
    if(jewelImport.present) applyExcelJewelSettings(jewelImport);
    const saved=saveState({silent:true});
    if(saved===false) throw new Error('변경값은 적용했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.');
    compareState.selectedSheetName=sheetName;
    compareState.restoreState=previousState;
    compareState.restoreJewelSettings=jewelImport.present ? previousJewelSettings : null;
    compareState.restoreTraitPresetStatus=jewelImport.present ? previousTraitPresetStatus : null;
    compareState.applied=true;
    if(jewelImport.present) stageTraitPresetJewelSettings(jewelImport.settings);
    hydrateCompareControls();
    compareSelectedExcelSheet({preserveRestore:true});
    updateCompareActionButtons();
    renderTraitPresetUpdateStatus();
    notifyStorageAction(`변경값 ${imported.applied}개 적용 완료`,'ok',{statusAction:'import'});
  }catch(e){
    try{
      applyStateObject(previousState);
      applyTraitPresetJewelSettings(previousJewelSettings);
      sanitizeDpsJewelSelections();
      syncDpsBaseUnitControl();
    }catch(rollbackError){ rememberAppIssue('error','[Excel apply rollback failed]', rollbackError); }
    clearCompareRestoreState(false);
    rememberAppIssue('error','[Excel apply failed]',e);
    showToast(e?.message||String(e),'err');
    updateCompareActionButtons();
  }
}
function buildExcelComparisonForSelectedBase(cells,specCells,zeroCells,fileName,sheetName,jewelImport){
  const {state:baseState}=selectedComparisonBasePresetState();
  const liveState=makeStateObject();
  applyStateObject(baseState);
  try{
    const baseBundle=compareState.baseTraitPresetBundle || loadTraitPresetStore();
    return buildExcelComparison(cells,specCells,zeroCells,fileName,sheetName,jewelImport,baseBundle?.jewelSettings);
  }finally{
    applyStateObject(liveState);
  }
}
function compareSelectedExcelSheet(options={}){
  if(!guardExcelSupport()) return;
  if(!compareState.workbook) return;
  hydrateCompareControls();
  const sheetName=selectedExcelSheetName();
  if(!sheetName) return;
  compareState.lastResult=null;
  if(!options.preserveRestore) clearCompareRestoreState();
  try{
    const jewelImport=readExcelJewelSettings(compareState.workbook);
    compareState.sourceType='excel';
    compareState.selectedSheetName=sheetName;
    if(sheetName===EXCEL_JEWEL_SHEET_NAME){
      const baseBundle=compareState.baseTraitPresetBundle || loadTraitPresetStore();
      renderExcelComparison(buildExcelJewelOnlyComparison(
        compareState.workbook.fileName,
        sheetName,
        jewelImport,
        baseBundle?.jewelSettings
      ));
      updateCompareActionButtons();
      return;
    }
    const {cells,specCells,zeroCells,additionalInfo}=readExcelSheetSource(compareState.workbook,sheetName);
    if(!additionalInfo.valid){
      setCompareError(additionalInfo.message, {keepVersionMarkup:true});
      return;
    }
    renderExcelComparison(buildExcelComparisonForSelectedBase(cells,specCells,zeroCells,compareState.workbook.fileName,sheetName,jewelImport));
    updateCompareActionButtons();
  }catch(e){
    rememberAppIssue('error','[Excel compare failed]',e);
    setCompareError(e?.message||String(e));
  }
}
function isTraitPresetCompareBundle(parsed){
  return !!(parsed && typeof parsed==='object' && (!parsed.type || isTraitPresetFileType(parsed.type)) && Array.isArray(parsed.presets));
}
function isCurrentTraitPresetBundlePayload(parsed){
  if(!isTraitPresetCompareBundle(parsed)) return false;
  return parsed.presets.every(item=>{
    if(!item || typeof item!=='object' || hasOwn(item,'savedState') || hasOwn(item,'data')) return false;
    if(!item.state || typeof item.state!=='object') return false;
    return hasTraitPresetTowerFloorField(item.state);
  });
}
function isUnsupportedOldSavedStatePayload(parsed){
  if(!parsed || typeof parsed!=='object' || Array.isArray(parsed)) return false;
  if(isTraitPresetCompareBundle(parsed)) return false;
  const hasSavedShape=hasOwn(parsed,'values') || hasOwn(parsed,'inv') || hasOwn(parsed,'zeroScore') || hasOwn(parsed,'computed') || hasOwn(parsed,'storageVersion') || hasOwn(parsed,'savedAt');
  if(!hasSavedShape) return false;
  if(hasOwn(parsed,'computed')) return true;
  const version=String(parsed.storageVersion || '').trim();
  if(!version && (hasOwn(parsed,'values') || hasOwn(parsed,'inv'))) return true;
  if(version && version!==STORAGE_VERSION) return true;
  const schema=+parsed.schemaVersion || 0;
  if(schema && schema<APP_STATE_SCHEMA_VERSION) return true;
  return false;
}
function isUnsupportedOldTraitPresetPayload(parsed){
  if(!parsed || typeof parsed!=='object') return false;
  if(Array.isArray(parsed)) return true;
  if(parsed.type && !isTraitPresetFileType(parsed.type)) return true;
  if(hasOwn(parsed,'presets') && (!isCurrentTraitPresetBundlePayload(parsed))) return true;
  if(isUnsupportedOldSavedStatePayload(parsed)) return true;
  if(hasOwn(parsed,'savedState') || hasOwn(parsed,'data')) return true;
  if(hasOwn(parsed,'state') && (hasOwn(parsed,'id') || hasOwn(parsed,'name'))) return true;
  return false;
}
async function readCompareJsonSource(file){
  const raw=await readFileAsText(file);
  const parsed=safeJsonParse(raw);
  if(!parsed) throw new Error('저장파일 형식이 아닙니다.');
  if(isUnsupportedOldTraitPresetPayload(parsed)) throw new Error(TRAIT_PRESET_UNSUPPORTED_OLD_MESSAGE);
  if(isTraitPresetCompareBundle(parsed)){
    const store=normalizeTraitPresetStore(parsed);
    if(!store.presets.length) throw new Error(parsed.presets.length ? TRAIT_PRESET_UNSUPPORTED_OLD_MESSAGE : '비교할 특성 프리셋이 없습니다.');
    return {sourceType:'traitPreset',traitPresetBundle:{...store,fileName:file.name}};
  }
  const state=normalizeSavedState(parsed);
  if(!state) throw new Error('계산기 저장값 형식이 아닙니다.');
  return {sourceType:'json',backupState:{...state,fileName:file.name}};
}
async function handleBaseCompareFile(file){
  if(!guardExcelSupport()) return;
  try{
    compareState.baseFileRejected=false;
    if(isExcelPresetImportFile(file)){
      throw new Error('기준 파일은 특성 프리셋 파일만 사용할 수 있습니다. 엑셀 파일은 비교 파일에서 불러오세요.');
    }
    const source=await readCompareJsonSource(file);
    if(source.sourceType!=='traitPreset'){
      throw new Error('기준 파일은 특성 프리셋 파일만 사용할 수 있습니다. 저장값 파일은 비교 파일에서 불러오세요.');
    }
    compareState.baseTraitPresetBundle=source.traitPresetBundle;
    const presets=compareState.baseTraitPresetBundle.presets || [];
    const preferred=presets[0];
    compareState.baseTraitPresetId=preferred?.id || '';
    compareState.baseFileRejected=false;
    compareState.applied=false;
    hydrateCompareControls();
    if(compareState.sourceType==='traitPreset' && compareState.traitPresetBundle) compareSelectedTraitPreset();
    else updateCompareActionButtons();
    showToast(`기준 파일 로드 완료: ${file?.name || '기준 파일'}`,'ok');
  }catch(e){
    rememberAppIssue('error','[compare base file failed]',e);
    if(isUnsupportedOldTraitPresetError(e)) showUnsupportedOldTraitPresetToast();
    rejectCompareBaseFile(e?.message||String(e));
  }
}
async function handleExcelCompareFile(file){
  if(!guardExcelSupport()) return;
  const basePreset=selectedTraitPresetForComparison('base');
  const body=$('excelCompareBody');
  if(!basePreset){
    clearCompareTargetSelection();
    hydrateCompareControls();
    if(body) body.innerHTML='<div class="excel-compare-error">기준 파일을 먼저 불러오세요.</div>';
    updateCompareActionButtons();
    return;
  }
  const preservedBaseBundle=compareState.baseTraitPresetBundle;
  const preservedBaseId=compareState.baseTraitPresetId;
  resetCompareState();
  compareState.baseTraitPresetBundle=preservedBaseBundle;
  compareState.baseTraitPresetId=preservedBaseId;
  compareState.baseFileRejected=false;
  hydrateCompareControls();
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
        const preferred=(bundle.presets || [])[0];
        compareState.selectedSheetName=preferred?.id || '';
        hydrateCompareControls();
        compareSelectedTraitPreset();
      }else{
        compareState.selectedSheetName='savedFile';
        hydrateCompareControls();
        renderJsonComparison(compareState.backupState,{useSelectedBase:true});
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
    rememberAppIssue('error','[compare file failed]',e);
    if(isUnsupportedOldTraitPresetError(e)) showUnsupportedOldTraitPresetToast();
    const apply=$('excelCompareApplyBtn');
    const reset=$('excelCompareResetBtn');
    if(apply) apply.disabled=true;
    if(reset) reset.disabled=true;
    if(body) body.innerHTML=`<div class="excel-compare-error">${escapeHtml(e?.message||String(e))}</div>`;
    updateCompareActionButtons();
  }
}
function bindExcelCompareEvents(){
  if(excelFeatureEventsBound) return;
  excelFeatureEventsBound=true;
  initExcelFeature();
  document.addEventListener('click',e=>{
    const excelTarget=e.target.closest('[data-excel-compare-filter],[data-excel-compare-apply],[data-excel-compare-jewel-only],[data-excel-compare-restore],[data-excel-compare-reset]');
    if(excelTarget && !guardExcelSupport()) return;
    const filterTarget=e.target.closest('[data-excel-compare-filter]');
    if(filterTarget){
      compareState.activeFilter=filterTarget.getAttribute('data-excel-compare-filter') || 'all';
      if(compareState.lastResult) renderExcelComparison(compareState.lastResult,{preserveFilter:true});
      return;
    }
    if(e.target.closest('[data-excel-compare-apply]')) applySelectedComparison();
    if(e.target.closest('[data-excel-compare-jewel-only]')) applySelectedExcelJewelsOnly();
    if(e.target.closest('[data-excel-compare-restore]')) restoreComparisonCurrentState();
    if(e.target.closest('[data-excel-compare-reset]')) requestConfirmAction('excelCompareReset','한 번 더 누르면 프리셋 분석 초기화', resetExcelComparison);
  });
  document.addEventListener('change',e=>{
    if(['excelCompareBaseFile','excelCompareFile','excelCompareSheet','excelCompareBasePreset'].includes(e.target.id) && !guardExcelSupport()){
      if(e.target.type==='file') e.target.value='';
      return;
    }
    if(e.target.id==='excelCompareBaseFile'&&e.target.files?.[0]){
      const selectedFile=e.target.files[0];
      handleBaseCompareFile(selectedFile).finally(()=>{ e.target.value=''; });
    }
    if(e.target.id==='excelCompareFile'&&e.target.files?.[0]){
      const selectedFile=e.target.files[0];
      handleExcelCompareFile(selectedFile).finally(()=>{ e.target.value=''; });
    }
    if(e.target.id==='excelCompareSheet' && compareState.sourceType==='excel'){ compareState.selectedSheetName=e.target.value; compareSelectedExcelSheet(); }
    if(e.target.id==='excelCompareBasePreset'){
      compareState.baseTraitPresetId=e.target.value;
      if(compareState.sourceType==='traitPreset') compareSelectedTraitPreset();
      else if(compareState.sourceType==='excel') compareSelectedExcelSheet();
      else if(compareState.sourceType==='json' && compareState.backupState){
        try{ renderJsonComparison(compareState.backupState,{useSelectedBase:true}); updateCompareActionButtons(); }
        catch(err){
          rememberAppIssue('error','[JSON compare base change failed]',err);
          const body=$('excelCompareBody');
          if(body) body.innerHTML=`<div class="excel-compare-error">${escapeHtml(err?.message||String(err))}</div>`;
          updateCompareActionButtons();
        }
      }else updateCompareActionButtons();
    }
    if(e.target.id==='excelCompareSheet' && compareState.sourceType==='traitPreset'){ compareState.selectedSheetName=e.target.value; compareSelectedTraitPreset(); }
  });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeCompareInfo(); });
}


/* 특성 프리셋 엑셀 가져오기·프리셋 비교 */
function isExcelPresetImportFile(file){
  const name=String(file?.name||'').toLowerCase();
  const type=String(file?.type||'').toLowerCase();
  return name.endsWith('.xlsx') || name.endsWith('.xlsm') || type.includes('spreadsheet') || type.includes('excel.sheet.macroenabled');
}
const traitPresetExcelImportState={workbook:null,fileName:''};
function createTraitPresetExcelImportModal(){
  window.DpsModal.createShell('traitPresetExcelImportModal','trait-preset-excel-modal-shell',`
    <div class="trait-preset-excel-backdrop" data-trait-preset-excel-close="1"></div>
    <section class="trait-preset-excel-modal" role="dialog" aria-modal="true" aria-labelledby="traitPresetExcelTitle">
      <header class="trait-preset-excel-head">
        <h2 id="traitPresetExcelTitle">엑셀 프리셋 가져오기</h2>
        <button type="button" class="ui-icon-btn trait-preset-excel-close" data-trait-preset-excel-close="1" aria-label="엑셀 프리셋 가져오기 닫기">×</button>
      </header>
      <div class="trait-preset-excel-body">
        <div class="trait-preset-excel-file" id="traitPresetExcelFileView">엑셀 파일</div>
        <label class="trait-preset-excel-field"><span>시트 선택</span><select id="traitPresetExcelSheet"></select></label>
        <label class="trait-preset-excel-field"><span>프리셋 이름 지정</span><input id="traitPresetExcelName" type="text" maxlength="40" autocomplete="off"/></label>
        <div class="trait-preset-excel-field"><span>적용 상태</span><output class="trait-preset-excel-value" id="traitPresetExcelApplyStatus">-</output></div>
        <button class="btn pri ui-action-btn trait-preset-excel-save" type="button" data-trait-preset-excel-save="1">선택 시트 프리셋 저장</button>
      </div>
    </section>`);
}
function openTraitPresetExcelImportModal(workbook,fileName){
  if(!guardExcelSupport()) return;
  traitPresetExcelImportState.workbook=workbook;
  traitPresetExcelImportState.fileName=fileName || workbook?.fileName || '엑셀파일';
  createTraitPresetExcelImportModal();
  const fileView=$('traitPresetExcelFileView');
  const sheetSelect=$('traitPresetExcelSheet');
  const nameInput=$('traitPresetExcelName');
  const sheets=Array.isArray(workbook?.sheets) ? workbook.sheets : [];
  if(fileView) fileView.textContent=`파일: ${traitPresetExcelImportState.fileName}`;
  if(sheetSelect){
    sheetSelect.innerHTML=sheets.map(sheet=>`<option value="${escapeHtml(sheet.name)}">${escapeHtml(sheet.name)}</option>`).join('');
    const preferred=sheets.some(sheet=>sheet.name==='고행') ? '고행' : (sheets[0]?.name || '');
    sheetSelect.value=preferred;
  }
  if(nameInput){
    nameInput.dataset.autofill='1';
    nameInput.value=sheetSelect?.value || stateFileBaseName(fileName);
  }
  syncTraitPresetExcelImportMode();
  window.DpsModal.setOpen('traitPresetExcelImportModal','trait-preset-excel-modal-open',true);
}
function closeTraitPresetExcelImportModal(){
  window.DpsModal.setOpen('traitPresetExcelImportModal','trait-preset-excel-modal-open',false);
}
function selectedTraitPresetExcelSheetName(){
  const workbook=traitPresetExcelImportState.workbook;
  const select=$('traitPresetExcelSheet');
  const candidate=String(select?.value || '').trim();
  const names=(workbook?.sheets || []).map(sheet=>sheet.name);
  return names.includes(candidate) ? candidate : '';
}
function syncTraitPresetExcelImportMode(){
  const sheetName=selectedTraitPresetExcelSheetName();
  const jewelMode=sheetName===EXCEL_JEWEL_SHEET_NAME;
  const nameInput=$('traitPresetExcelName');
  const applyStatus=$('traitPresetExcelApplyStatus');
  const saveButton=document.querySelector('[data-trait-preset-excel-save]');
  if(nameInput){
    nameInput.disabled=jewelMode;
    if(jewelMode){
      nameInput.value='-';
      nameInput.dataset.autofill='1';
    }else if(nameInput.dataset.autofill==='1' || !nameInput.value.trim() || nameInput.value==='-'){
      nameInput.value=sheetName;
      nameInput.dataset.autofill='1';
    }
  }
  if(applyStatus) applyStatus.textContent=jewelMode ? '공용 쥬얼 데이터' : `${sheetName} 시트 데이터 & 공용 쥬얼 데이터`;
  if(saveButton) saveButton.textContent=jewelMode ? '쥬얼 데이터만 가져오기' : '선택 시트 프리셋 저장';
}
function importExcelJewelsToCurrentPreset(workbook){
  if(!guardExcelSupport()) return false;
  try{
    const {jewelImport,staged}=applyExcelJewelImport(
      workbook,
      '쥬얼값은 적용했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.',
      '[trait preset Excel jewel rollback failed]'
    );
    renderTraitPresetUpdateStatus();
    closeTraitPresetExcelImportModal();
    const suffix=staged.needsUpdate ? ' · 프리셋 업데이트 필요' : ' · 기존 데이터와 동일';
    notifyStorageAction(`쥬얼 데이터 가져오기 완료 · 전설/신화 ${jewelImport.recognizedLegendary}개${suffix}`,'ok',{statusAction:'import'});
    return true;
  }catch(e){
    rememberAppIssue('error','[trait preset Excel jewel import failed]',e);
    notifyStorageAction(e?.message || '쥬얼 데이터 가져오기 실패','err');
    return false;
  }
}
function saveSelectedExcelSheetAsTraitPreset(){
  if(!guardExcelSupport()) return false;
  const workbook=traitPresetExcelImportState.workbook;
  const sheetName=selectedTraitPresetExcelSheetName();
  if(!workbook || !sheetName){ notifyStorageAction('가져올 엑셀 시트를 선택하세요.','err'); return false; }
  if(sheetName===EXCEL_JEWEL_SHEET_NAME) return importExcelJewelsToCurrentPreset(workbook);
  const name=normalizeTraitPresetName($('traitPresetExcelName')?.value || sheetName);
  if(!name){ notifyStorageAction('프리셋 이름을 입력하세요.','err'); return false; }
  try{
    const {cells,specCells,zeroCells,additionalInfo}=readExcelSheetSource(workbook,sheetName);
    if(!additionalInfo.valid) throw new Error(additionalInfo.message);
    const importedState=buildExcelState(cells,specCells,zeroCells,sheetName).state;
    const jewelImport=readExcelJewelSettings(workbook);
    const now=Date.now();
    const presetId=makeTraitPresetId();
    const imported={presets:[{
      id:presetId,
      name,
      createdAt:now,
      updatedAt:now,
      meta:traitPresetMetaFromSavedState(importedState),
      state:importedState
    }],jewelSettings:jewelImport.present ? jewelImport.settings : null,unitBoard:{
      presets:{[presetId]:normalizeTraitPresetUnitBoardState(null)}
    }};
    const result=mergeTraitPresetImport(imported,{preserveExistingUnitBoardOnReplace:true});
    const savedPresetId=result.firstImportedPresetId || result.store.presets.find(item=>item.name===name)?.id || '';
    if(savedPresetId) markTraitPresetUpdated([savedPresetId],'importExcel');
    if(savedPresetId) loadTraitPresetById(savedPresetId,{notifySuccess:false,preserveSharedValues:false});
    else refreshTraitPresetControls('');
    closeTraitPresetExcelImportModal();
    notifyStorageAction(result.replaced ? `엑셀 프리셋 갱신 및 로드 완료: ${name}` : `엑셀 프리셋 저장 및 로드 완료: ${name}`,'ok',{statusAction:'import'});
    return true;
  }catch(e){
    rememberAppIssue('error','[trait preset excel import failed]',e);
    notifyStorageAction(e?.message || '엑셀 프리셋 저장 실패','err');
    return false;
  }
}
async function importTraitPresetFile(file){
  try{
    if(isExcelPresetImportFile(file)){
      if(!guardExcelSupport()) return false;
      const workbook=await readExcelWorkbook(file);
      if(!workbook.sheets?.length) throw new Error('엑셀 시트를 찾을 수 없습니다.');
      validateTraitPresetExcelSpecAdditionalStructure(workbook);
      openTraitPresetExcelImportModal(workbook,file?.name || '엑셀파일');
      return true;
    }
    const raw=await readFileAsText(file);
    const parsed=safeJsonParse(raw);
    const imported=normalizeTraitPresetImportData(parsed);
    const result=mergeTraitPresetImport(imported);
    const loadId=result.firstImportedPresetId || '';
    if(loadId) loadTraitPresetById(loadId,{notifySuccess:false,preserveSharedValues:false});
    else refreshTraitPresetControls('');
    notifyStorageAction(`프리셋 가져오기 및 로드 완료 · 추가 ${result.added} / 갱신 ${result.replaced}`,'ok',{statusAction:'import'});
    return true;
  }catch(e){
    rememberAppIssue('error','[trait preset import failed]',e);
    if(isUnsupportedOldTraitPresetError(e)) showUnsupportedOldTraitPresetToast();
    else notifyStorageAction(e?.message || '특성 프리셋 가져오기 실패','err');
    return false;
  }
}

/* 프리셋 비교·분석 */
function selectedTraitPresetForComparison(role){
  const base=role==='base';
  if(base && compareState.baseFileRejected) return null;
  if(!base && (compareState.sourceType!=='traitPreset' || !compareState.traitPresetBundle)) return null;
  const store=base ? (compareState.baseTraitPresetBundle || loadTraitPresetStore()) : compareState.traitPresetBundle;
  const presets=Array.isArray(store?.presets) ? store.presets : [];
  if(!presets.length) return null;
  const select=$(base ? 'excelCompareBasePreset' : 'excelCompareSheet');
  const stateKey=base ? 'baseTraitPresetId' : 'selectedSheetName';
  const candidate=String((select && !select.disabled && select.value) || compareState[stateKey] || '').trim();
  const preset=presets.find(item=>item.id===candidate) || (base ? null : presets[0]) || null;
  if(preset){
    compareState[stateKey]=preset.id;
    if(select && select.value!==preset.id) select.value=preset.id;
  }
  return preset;
}
function buildTraitPresetComparison(preset){
  if(!preset) throw new Error('비교할 특성 프리셋을 선택하세요.');
  const state=normalizeSavedState(preset.state);
  if(!state) throw new Error('특성 프리셋 데이터가 올바르지 않습니다.');
  const {preset:basePreset,state:baseState}=selectedComparisonBasePresetState();
  const bundle=compareState.traitPresetBundle || {};
  const baseBundle=compareState.baseTraitPresetBundle || loadTraitPresetStore();
  return buildJsonComparison(
    {...state,fileName:bundle.fileName || '특성 프리셋 파일',sheetName:preset.name},
    {
      fileName:bundle.fileName || '특성 프리셋 파일',
      sheetName:preset.name,
      sourceType:'traitPreset',
      baseState,
      baseFileName:baseBundle.fileName || '기준 프리셋',
      baseSheetName:basePreset.name,
      changeJewelSettings:bundle.jewelSettings,
      currentJewelSettings:baseBundle.jewelSettings,
      changeUnitBoardIncluded:traitPresetHasUnitBoard(bundle,preset.id),
      changeUnitBoard:traitPresetUnitBoardState(bundle,preset.id),
      currentUnitBoardIncluded:traitPresetHasUnitBoard(baseBundle,basePreset.id),
      currentUnitBoard:traitPresetUnitBoardState(baseBundle,basePreset.id)
    }
  );
}
function applySelectedTraitPreset(){
  if(!guardExcelSupport()) return false;
  const preset=selectedTraitPresetForComparison('change');
  if(!preset || compareState.applied) return;
  const previousState=makeStateObject();
  const basePreset=selectedTraitPresetForComparison('base');
  const targetBundle=compareState.traitPresetBundle || {};
  const targetHasUnitBoard=traitPresetHasUnitBoard(targetBundle,preset.id);
  const targetUnitBoard=traitPresetUnitBoardState(targetBundle,preset.id);
  try{
    const state=buildTraitPresetApplyState(preset,{preserveSharedValues:false});
    if(!state) throw new Error('특성 프리셋 데이터가 올바르지 않습니다.');
    if(!basePreset) throw new Error('기준 프리셋을 선택하세요.');
    let store=loadTraitPresetStore();
    let index=store.presets.findIndex(item=>item.id===basePreset.id);
    if(index<0) index=store.presets.findIndex(item=>item.name===basePreset.name);
    const now=Date.now();
    const prev=index>=0 ? store.presets[index] : {
      id:String(basePreset.id || makeTraitPresetId()),
      name:normalizeTraitPresetName(basePreset.name || '기준 프리셋'),
      createdAt:+basePreset.createdAt || now,
      updatedAt:now
    };
    const nextState=markPresetStateCurrentVersion({...state,savedAt:now});
    const nextPreset={...prev,id:prev.id,name:prev.name,createdAt:prev.createdAt,updatedAt:now,meta:traitPresetMetaFromSavedState(nextState),state:nextState};
    if(index>=0) store.presets[index]=nextPreset;
    else store.presets.push(nextPreset);
    if(targetHasUnitBoard) setTraitPresetUnitBoardState(store,nextPreset.id,targetUnitBoard);
    else deleteTraitPresetUnitBoardState(store,nextPreset.id);
    if(compareState.baseTraitPresetBundle && Array.isArray(compareState.baseTraitPresetBundle.presets)){
      const bundleIndex=compareState.baseTraitPresetBundle.presets.findIndex(item=>item.id===basePreset.id || item.name===basePreset.name);
      if(bundleIndex>=0){
        const bundlePrev=compareState.baseTraitPresetBundle.presets[bundleIndex];
        const nextBundlePreset={...bundlePrev,id:bundlePrev.id,name:bundlePrev.name,createdAt:bundlePrev.createdAt,updatedAt:now,meta:traitPresetMetaFromSavedState(nextState),state:nextState};
        compareState.baseTraitPresetBundle.presets[bundleIndex]=nextBundlePreset;
        if(targetHasUnitBoard) setTraitPresetUnitBoardState(compareState.baseTraitPresetBundle,nextBundlePreset.id,targetUnitBoard);
        else deleteTraitPresetUnitBoardState(compareState.baseTraitPresetBundle,nextBundlePreset.id);
      }
    }
    saveTraitPresetStore(store,{source:'compareApply'});
    markTraitPresetUpdated([nextPreset.id],'compareApply');
    compareState.baseTraitPresetId=compareState.baseTraitPresetBundle ? basePreset.id : nextPreset.id;
    applyStateObject(nextState);
    applyTraitPresetUnitBoardState(targetHasUnitBoard ? targetUnitBoard : null);
    const saved=saveState({silent:true});
    if(saved===false) throw new Error('비교 프리셋 값은 적용했지만 브라우저 저장에 실패했습니다. 저장공간/권한을 확인하세요.');
    compareState.restoreState=previousState;
    compareState.applied=true;
    hydrateCompareControls();
    renderExcelComparison(buildTraitPresetComparison(preset));
    updateCompareActionButtons();
    notifyStorageAction(`비교 프리셋 값 적용 완료: ${nextPreset.name}`,'ok',{statusAction:'load'});
  }catch(e){
    try{ applyStateObject(previousState); }catch(rollbackError){ rememberAppIssue('error','[trait preset compare rollback failed]', rollbackError); }
    clearCompareRestoreState(false);
    rememberAppIssue('error','[trait preset compare apply failed]',e);
    showToast(e?.message||String(e),'err');
    updateCompareActionButtons();
  }
}
function compareSelectedTraitPreset(options={}){
  if(!guardExcelSupport()) return;
  if(!compareState.traitPresetBundle) return;
  hydrateCompareControls();
  const preset=selectedTraitPresetForComparison('change');
  if(!preset) return;
  compareState.lastResult=null;
  if(!options.preserveRestore) clearCompareRestoreState();
  try{
    compareState.sourceType='traitPreset';
    compareState.selectedSheetName=preset.id;
    renderExcelComparison(buildTraitPresetComparison(preset));
    updateCompareActionButtons();
  }catch(e){
    rememberAppIssue('error','[trait preset compare failed]',e);
    setCompareError(e?.message||String(e));
  }
}
function compareTraitPreset(){
  if(!guardExcelSupport()) return false;
  const id=selectedTraitPresetId();
  const store=loadTraitPresetStore();
  const preset=store.presets.find(item=>item.id===id);
  if(!preset){
    notifyStorageAction('특성 프리셋을 먼저 가져오거나 로드해야 프리셋 분석을 사용할 수 있습니다.','err');
    refreshTraitPresetControls('');
    return false;
  }
  resetCompareState();
  compareState.baseTraitPresetId=id;
  openCompareInfo();
  hydrateCompareControls();
  const body=$('excelCompareBody');
  if(body) body.innerHTML=EXCEL_COMPARE_EMPTY_HTML;
  updateCompareActionButtons();
  return true;
}


/* 엑셀 지원 종료 안내·전용 스타일 */
const EXCEL_SUPPORT_END_AT=new Date('2026-07-24T23:00:00+09:00');
const EXCEL_SUPPORT_BLOCK_AT=new Date('2026-07-24T23:01:00+09:00');
const EXCEL_SUPPORT_NOTICE_HIDE_KEY='excelSupportNoticeHiddenUntil';
const EXCEL_NOTICE_STYLE_ID='excelFeatureStyle';
const EXCEL_NOTICE_ID='excelSupportNotice';
const EXCEL_ENDED_NOTICE_ID='excelSupportEndedNotice';
let excelNoticeTimer=null;
let excelFeatureEventsBound=false;

const EXCEL_NOTICE_ASSETS=Object.freeze({
  bowingMascot:`
    <svg class="excel-notice-mascot-svg" viewBox="0 0 220 190" role="img" aria-label="감사 인사를 하는 마스코트">
      <defs>
        <linearGradient id="excelMascotBody" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#6ee7f9"/>
          <stop offset=".52" stop-color="#60a5fa"/>
          <stop offset="1" stop-color="#6366f1"/>
        </linearGradient>
        <linearGradient id="excelMascotCape" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#fef3c7"/>
          <stop offset="1" stop-color="#f59e0b"/>
        </linearGradient>
        <filter id="excelMascotShadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#0f172a" flood-opacity=".28"/>
        </filter>
      </defs>
      <ellipse cx="110" cy="170" rx="74" ry="14" fill="#0f172a" opacity=".16"/>
      <g class="excel-notice-mascot-bow" filter="url(#excelMascotShadow)">
        <path d="M72 98c-15 14-23 32-22 50 1 15 15 21 29 16 10-4 14-14 14-25l-1-25z" fill="#1e293b" opacity=".22"/>
        <path d="M148 98c15 14 23 32 22 50-1 15-15 21-29 16-10-4-14-14-14-25l1-25z" fill="#1e293b" opacity=".22"/>
        <path d="M68 92c10-26 27-39 42-39s32 13 42 39c8 20 9 54-1 69-8 12-28 17-41 17s-33-5-41-17c-10-15-9-49-1-69z" fill="url(#excelMascotBody)"/>
        <path d="M82 121c11 13 46 13 57 0l8 42c-12 10-59 10-73 0z" fill="url(#excelMascotCape)" opacity=".96"/>
        <path d="M70 94c-8 7-12 23-9 39 8-10 17-17 31-22l-4-23z" fill="#0f766e" opacity=".38"/>
        <path d="M150 94c8 7 12 23 9 39-8-10-17-17-31-22l4-23z" fill="#0f766e" opacity=".38"/>
        <g class="excel-notice-mascot-head">
          <path d="M68 62c0-29 19-50 42-50s42 21 42 50c0 28-19 47-42 47S68 90 68 62z" fill="#f8fafc"/>
          <path d="M75 43c8-22 28-34 48-28 15 5 25 18 27 34-10-11-24-17-42-16-14 1-25 4-33 10z" fill="#1e293b"/>
          <path d="M79 42c9-11 24-17 42-14 13 2 22 8 28 18-9-6-20-9-34-9-15 0-27 2-36 5z" fill="#334155" opacity=".9"/>
          <circle cx="94" cy="66" r="5.5" fill="#0f172a"/>
          <circle cx="126" cy="66" r="5.5" fill="#0f172a"/>
          <circle cx="96" cy="64" r="1.6" fill="#fff"/>
          <circle cx="128" cy="64" r="1.6" fill="#fff"/>
          <path d="M101 82c5 5 13 5 18 0" fill="none" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>
          <path d="M83 78c6 4 11 4 17 0" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" opacity=".32"/>
          <path d="M120 78c6 4 11 4 17 0" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" opacity=".32"/>
        </g>
        <path class="excel-notice-mascot-arm-left" d="M72 124c15-10 33-14 47-13" fill="none" stroke="#f8fafc" stroke-width="14" stroke-linecap="round"/>
        <path class="excel-notice-mascot-arm-right" d="M148 124c-15-10-33-14-47-13" fill="none" stroke="#f8fafc" stroke-width="14" stroke-linecap="round"/>
        <path d="M79 126c14-8 27-11 39-10" fill="none" stroke="#bae6fd" stroke-width="4" stroke-linecap="round" opacity=".8"/>
        <path d="M141 126c-14-8-27-11-39-10" fill="none" stroke="#bae6fd" stroke-width="4" stroke-linecap="round" opacity=".8"/>
      </g>
      <g class="excel-notice-mascot-bubble">
        <path d="M147 22h48c10 0 17 7 17 16v18c0 9-7 16-17 16h-19l-14 13 4-13h-19c-10 0-17-7-17-16V38c0-9 7-16 17-16z" fill="#fff7ed" stroke="#f59e0b" stroke-width="3"/>
        <text x="171" y="52" text-anchor="middle" font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif" font-size="16" font-weight="900" fill="#92400e">감사합니다!</text>
      </g>
    </svg>`
});

function isExcelSupportBlocked(){return Date.now()>=EXCEL_SUPPORT_BLOCK_AT.getTime();}
function excelSupportRemainingParts(){
  const remaining=Math.max(0,EXCEL_SUPPORT_END_AT.getTime()-Date.now());
  const totalSeconds=Math.floor(remaining/1000);
  const days=Math.floor(totalSeconds/86400);
  const hours=Math.floor((totalSeconds%86400)/3600);
  const minutes=Math.floor((totalSeconds%3600)/60);
  const seconds=totalSeconds%60;
  return {days,hours,minutes,seconds};
}
function formatExcelSupportRemaining(){
  const p=excelSupportRemainingParts();
  const pad=n=>String(n).padStart(2,'0');
  return `${p.days}일 ${pad(p.hours)}시간 ${pad(p.minutes)}분 ${pad(p.seconds)}초`;
}
function shouldShowExcelSupportNotice(){
  if(isExcelSupportBlocked()) return false;
  const hiddenUntil=Number(localStorage.getItem(EXCEL_SUPPORT_NOTICE_HIDE_KEY)||0);
  return !Number.isFinite(hiddenUntil) || Date.now()>=hiddenUntil;
}
function hideExcelSupportNotice(){
  document.getElementById(EXCEL_NOTICE_ID)?.remove();
  if(excelNoticeTimer){clearInterval(excelNoticeTimer);excelNoticeTimer=null;}
}
function hideExcelSupportNoticeForOneDay(){
  localStorage.setItem(EXCEL_SUPPORT_NOTICE_HIDE_KEY,String(Date.now()+24*60*60*1000));
  hideExcelSupportNotice();
}
function injectExcelFeatureStyle(){
  if(document.getElementById(EXCEL_NOTICE_STYLE_ID)) return;
  const style=document.createElement('style');
  style.id=EXCEL_NOTICE_STYLE_ID;
  style.textContent=`
    .excel-compare-controls{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;}
    .excel-compare-header-controls{justify-content:center;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;}
    .excel-compare-header-controls>*{flex:0 0 auto;}
    .excel-compare-controls select{height:34px;min-width:130px;padding:0 30px 0 10px;border:1px solid var(--role-interactive-bd);border-radius:9px;background:var(--role-interactive-bg);color:#cfe0ff;font-weight:900;text-align:center;text-align-last:center;}
    .excel-compare-controls select:disabled{border-color:#344966;background:var(--color-slate-50);color:var(--color-slate-400);}
    .excel-compare-file-btn{display:inline-flex;align-items:center;justify-content:center;height:34px;padding:0 14px;border:1px solid var(--btn-action-border);border-radius:9px;background:var(--btn-action-bg);color:var(--btn-action-text);font-weight:900;cursor:pointer;}
    .excel-compare-file-btn.is-disabled{border-color:#344966;background:var(--color-slate-50);color:var(--color-slate-400);box-shadow:none;cursor:not-allowed;opacity:.55;}
    .excel-compare-file-btn input{display:none;}
    .excel-compare-apply-btn{display:inline-flex;align-items:center;justify-content:center;height:34px;padding:0 14px;border:1px solid #1f7a4a;border-radius:9px;background:#1f7a4a;color:var(--on-dark);font-weight:900;cursor:pointer;white-space:nowrap;}
    .excel-compare-apply-btn:hover:not(:disabled){background:#73d696;border-color:#73d696;}
    .excel-compare-reset-btn{display:inline-flex;align-items:center;justify-content:center;height:34px;padding:0 14px;border:1px solid #3a4d67;border-radius:9px;background:var(--color-white);color:var(--color-slate-700);font-weight:900;cursor:pointer;white-space:nowrap;}
    .excel-compare-restore-btn{display:inline-flex;align-items:center;justify-content:center;height:34px;padding:0 14px;border:1px solid #d99030;border-radius:9px;background:#241b0a;color:#d99a55;font-weight:900;cursor:pointer;white-space:nowrap;}
    .excel-compare-reset-btn:hover:not(:disabled){border-color:var(--color-blue-300);background:var(--color-blue-50);color:var(--color-blue-700);}
    .excel-compare-restore-btn:hover:not(:disabled){border-color:#b46916;background:#33260e;color:#f6c77a;}
    .excel-compare-apply-btn:disabled,.excel-compare-reset-btn:disabled,.excel-compare-restore-btn:disabled{border-color:#344966;background:var(--color-slate-50);color:var(--color-slate-400);box-shadow:none;cursor:not-allowed;}
    .excel-compare-panel{display:flex;flex-direction:column;min-height:0;height:100%;max-height:100%;overflow:hidden;background:#080d15;border:1px solid #26364d;border-radius:12px;}
    .excel-compare-panel .excel-compare-body{flex:1;min-height:0;}
    .excel-compare-body{display:flex;flex:1;flex-direction:column;min-height:220px;overflow:hidden;padding:10px;background:#080d15;}
    .excel-compare-empty,.excel-compare-error{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:200px;padding:24px;border:1px dashed #3a4d67;border-radius:12px;background:var(--color-white);color:var(--color-slate-600);font-weight:900;text-align:center;}
    .excel-compare-empty small{margin-top:8px;color:var(--color-slate-500);font-weight:700;line-height:1.45;}
    .excel-compare-error{color:#ffb4b4;border-color:#7f1d2d;background:#1a0b0f;}
    .excel-compare-summary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;margin-bottom:9px;}
    .excel-compare-summary-card{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0;padding:7px 9px;border:1px solid #26364d;border-radius:10px;background:var(--color-white);color:var(--color-slate-500);font-weight:900;cursor:pointer;}
    .excel-compare-summary-card b{color:var(--color-text-main);font-size:calc(13px * var(--app-font-scale));}
    .excel-compare-summary-card span{color:var(--color-text-main);font-size:calc(12px * var(--app-font-scale));font-weight:900;}
    .excel-compare-summary .same,.excel-compare-summary .near,.excel-compare-summary .diff{border-color:#26364d;background:var(--color-white);}
    .excel-compare-summary .same b{color:var(--color-slate-600);}
    .excel-compare-summary .near b{color:#f0b66b;}
    .excel-compare-summary .diff b{color:#ff9aaa;}
    .excel-compare-summary-card:hover{border-color:#9bb5e6;background:#111a28;}
    .excel-compare-summary-card:focus-visible{outline:2px solid rgba(49,87,213,.45);outline-offset:2px;}
    .excel-compare-summary-card.is-active{border-color:var(--color-accent);background:#10233d;box-shadow:inset 0 0 0 1px rgba(49,87,213,.35);}
    .excel-compare-summary-card.is-active span{color:#b8d2ff;}
    .excel-compare-summary-card.is-active b{color:#cfe0ff;}
    .excel-compare-table-wrap{display:flex;flex:1;flex-direction:column;min-height:0;overflow-x:auto;overflow-y:hidden;border:1px solid #26364d;border-radius:10px;background:var(--color-white);}
    .excel-compare-table-scroll{flex:1;min-height:0;overflow-x:visible;overflow-y:auto;}
    .excel-compare-table{width:100%;min-width:760px;table-layout:fixed;border-collapse:separate;border-spacing:0;font-size:calc(11.5px * var(--app-font-scale));font-variant-numeric:tabular-nums;}
    .excel-compare-table col.compare-col-kind{width:13%;}
    .excel-compare-table col.compare-col-name{width:24%;}
    .excel-compare-table col.compare-col-current,.excel-compare-table col.compare-col-change{width:18%;}
    .excel-compare-table col.compare-col-diff{width:27%;}
    .excel-compare-table th,.excel-compare-table td{height:31px;padding:5px 8px;border-right:1px solid var(--color-slate-200);border-bottom:1px solid var(--color-slate-200);background:var(--color-white);text-align:center;white-space:nowrap;}
    .excel-compare-table tr.is-detail-row th,.excel-compare-table tr.is-detail-row td{height:auto;min-height:31px;vertical-align:top;white-space:normal;overflow-wrap:anywhere;word-break:keep-all;}
    .compare-detail-list{display:grid;grid-template-columns:minmax(0,1fr);gap:4px;width:100%;min-width:0;margin:0;text-align:left;}
    .compare-detail-item{display:grid;grid-template-columns:minmax(74px,.8fr) minmax(0,1.2fr);gap:8px;align-items:start;min-width:0;padding:2px 0;border-bottom:1px solid rgba(58,77,103,.5);line-height:1.35;}
    .compare-detail-item:last-child{border-bottom:0;}
    .compare-detail-item dt{min-width:0;color:var(--color-slate-500);font-weight:800;white-space:normal;word-break:keep-all;}
    .compare-detail-item dd{min-width:0;margin:0;color:var(--color-text-main);font-weight:900;text-align:right;white-space:normal;overflow-wrap:anywhere;word-break:keep-all;}
    .excel-compare-table .compare-diff .compare-detail-item dd{color:inherit;}
    .excel-compare-table-head{flex:0 0 auto;}
    .excel-compare-table-head th{background:#172438;color:#b8d2ff;font-weight:900;text-align:center;}
    .excel-compare-table-head th:last-child,.excel-compare-table-body td:last-child{border-right:0;}
    .excel-compare-table-body tr:last-child th,.excel-compare-table-body tr:last-child td{border-bottom:1px solid var(--color-slate-200);}
    .excel-compare-table tbody th{text-align:center;}
    .excel-compare-table tbody td:first-child{text-align:center;font-weight:900;}
    .excel-compare-table .compare-diff{font-weight:900;}
    .excel-compare-table .diff-same{color:var(--color-slate-600);}
    .excel-compare-table .diff-positive{color:#ff9aaa;}
    .excel-compare-table .diff-negative{color:var(--color-blue-700);}
    .excel-compare-table .diff-text{color:#f0b66b;}
    .excel-compare-table .diff-warn{color:var(--color-slate-500);}
    .excel-compare-table .excel-compare-no-diff{height:72px;color:var(--color-slate-500);font-weight:900;text-align:center;}
    .month-rune-modal.is-modal-compare .month-rune-head{display:grid;grid-template-columns:minmax(0,1fr) 34px;grid-template-rows:auto auto;align-items:center;gap:8px 10px;min-height:0;padding:10px 12px;}
    .month-rune-modal.is-modal-compare .month-rune-title{grid-column:1;grid-row:1;min-width:0;line-height:1.15;}
    .month-rune-modal.is-modal-compare .month-rune-close{position:static;grid-column:2;grid-row:1;justify-self:end;align-self:center;flex:0 0 auto;}
    .month-rune-modal.is-modal-compare .month-rune-header-actions{grid-column:1 / -1;grid-row:2;display:block;width:100%;min-width:0;overflow:visible;}
    .month-rune-modal.is-modal-compare .excel-compare-header-controls{display:grid;grid-template-columns:.82fr 1.55fr .82fr 1.55fr;gap:7px;width:100%;min-width:0;align-items:stretch;overflow:visible;}
    .month-rune-modal.is-modal-compare .excel-compare-header-controls>*{width:100%;min-width:0;}
    .month-rune-modal.is-modal-compare .excel-compare-header-controls>.excel-compare-base-file-btn{grid-column:1;grid-row:1;}
    .month-rune-modal.is-modal-compare .excel-compare-header-controls>#excelCompareBasePreset{grid-column:2;grid-row:1;}
    .month-rune-modal.is-modal-compare .excel-compare-header-controls>.excel-compare-target-file-btn{grid-column:3;grid-row:1;}
    .month-rune-modal.is-modal-compare .excel-compare-header-controls>#excelCompareSheet{grid-column:4;grid-row:1;}
    .month-rune-modal.is-modal-compare .excel-compare-header-controls>#excelCompareApplyBtn{grid-column:1 / 3;grid-row:2;}
    .month-rune-modal.is-modal-compare .excel-compare-header-controls>#excelCompareJewelOnlyBtn{grid-column:3;grid-row:2;}
    .month-rune-modal.is-modal-compare .excel-compare-header-controls>#excelCompareRestoreBtn{grid-column:4;grid-row:2;}
    .month-rune-modal.is-modal-compare .excel-compare-header-controls>#excelCompareResetBtn{grid-column:1 / 5;grid-row:3;}
    .month-rune-modal.is-modal-compare .excel-compare-file-btn,.month-rune-modal.is-modal-compare .excel-compare-apply-btn,.month-rune-modal.is-modal-compare .excel-compare-jewel-only-btn,.month-rune-modal.is-modal-compare .excel-compare-restore-btn,.month-rune-modal.is-modal-compare .excel-compare-reset-btn,.month-rune-modal.is-modal-compare .excel-compare-controls select{height:36px;min-height:36px;font-size:calc(11.2px * var(--app-font-scale));}
    body.is-mobile .month-rune-modal.is-modal-compare{width:calc(100vw - 8px);height:calc(var(--mobile-vh, 100vh) - 8px);max-height:calc(var(--mobile-vh, 100vh) - 8px);margin:4px auto;}
    body.is-tablet .month-rune-modal.is-modal-compare .excel-compare-header-controls,body.is-pc-portrait .month-rune-modal.is-modal-compare .excel-compare-header-controls{grid-template-columns:.9fr 1.5fr .9fr 1.5fr;gap:6px;}
    body.is-tablet .month-rune-modal.is-modal-compare .excel-compare-file-btn,body.is-tablet .month-rune-modal.is-modal-compare .excel-compare-apply-btn,body.is-tablet .month-rune-modal.is-modal-compare .excel-compare-jewel-only-btn,body.is-tablet .month-rune-modal.is-modal-compare .excel-compare-restore-btn,body.is-tablet .month-rune-modal.is-modal-compare .excel-compare-reset-btn,body.is-tablet .month-rune-modal.is-modal-compare .excel-compare-controls select{height:34px;min-height:34px;padding-left:8px;padding-right:8px;font-size:calc(10px * var(--app-font-scale));}
    body.is-mobile .month-rune-modal.is-modal-compare .month-rune-head{grid-template-columns:minmax(0,1fr) 32px;gap:7px;padding:8px 9px 9px 10px;}
    body.is-mobile .month-rune-modal.is-modal-compare .excel-compare-header-controls{grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;}
    body.is-mobile .month-rune-modal.is-modal-compare .excel-compare-header-controls>.excel-compare-base-file-btn{grid-column:1 / 4;grid-row:1;}
    body.is-mobile .month-rune-modal.is-modal-compare .excel-compare-header-controls>#excelCompareBasePreset{grid-column:4 / 7;grid-row:1;}
    body.is-mobile .month-rune-modal.is-modal-compare .excel-compare-header-controls>.excel-compare-target-file-btn{grid-column:1 / 4;grid-row:2;}
    body.is-mobile .month-rune-modal.is-modal-compare .excel-compare-header-controls>#excelCompareSheet{grid-column:4 / 7;grid-row:2;}
    body.is-mobile .month-rune-modal.is-modal-compare .excel-compare-header-controls>#excelCompareApplyBtn{grid-column:1 / 4;grid-row:3;}
    body.is-mobile .month-rune-modal.is-modal-compare .excel-compare-header-controls>#excelCompareJewelOnlyBtn{grid-column:4 / 7;grid-row:3;}
    body.is-mobile .month-rune-modal.is-modal-compare .excel-compare-header-controls>#excelCompareRestoreBtn{grid-column:1 / 4;grid-row:4;}
    body.is-mobile .month-rune-modal.is-modal-compare .excel-compare-header-controls>#excelCompareResetBtn{grid-column:4 / 7;grid-row:4;}
    body.is-mobile .month-rune-modal.is-modal-compare .excel-compare-file-btn,body.is-mobile .month-rune-modal.is-modal-compare .excel-compare-apply-btn,body.is-mobile .month-rune-modal.is-modal-compare .excel-compare-jewel-only-btn,body.is-mobile .month-rune-modal.is-modal-compare .excel-compare-restore-btn,body.is-mobile .month-rune-modal.is-modal-compare .excel-compare-reset-btn,body.is-mobile .month-rune-modal.is-modal-compare .excel-compare-controls select{height:30px;min-height:30px;font-size:calc(8.5px * var(--app-font-scale));}
    body.is-tablet .month-rune-modal.is-modal-compare{width:min(980px,calc(100vw - 20px));height:calc(100vh - 20px);max-height:calc(100vh - 20px);margin:10px auto;}
    .excel-support-notice{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(6,12,24,.68);backdrop-filter:blur(6px);animation:excelNoticeFadeIn .22s ease-out both;}
    .excel-support-notice-card{position:relative;width:min(640px,calc(100vw - 28px));max-height:calc(100vh - 28px);overflow:auto;border:1px solid rgba(251,191,36,.55);border-radius:22px;background:linear-gradient(180deg,#fffaf0 0%,#ffffff 42%,#f8fbff 100%);box-shadow:0 24px 76px rgba(2,6,23,.34);color:#172033;animation:excelNoticeCardIn .34s cubic-bezier(.16,1,.3,1) both;}
    .excel-support-notice-card::before{content:"";position:absolute;inset:-100px -72px auto auto;width:220px;height:220px;border-radius:999px;background:radial-gradient(circle,rgba(251,191,36,.32),rgba(96,165,250,.08) 60%,transparent 72%);pointer-events:none;}
    .excel-support-notice-hero{position:relative;display:grid;grid-template-columns:104px minmax(0,1fr) 104px;gap:8px;align-items:center;padding:14px 18px 10px;border-bottom:1px solid rgba(148,163,184,.22);background:linear-gradient(135deg,rgba(255,237,213,.94),rgba(219,234,254,.72));text-align:center;}
    .excel-notice-mascot{grid-column:1;display:flex;align-items:center;justify-content:center;min-height:94px;}
    .excel-notice-mascot-svg{width:112px;height:auto;overflow:visible;}
    .excel-notice-mascot-bow{transform-origin:110px 150px;animation:excelMascotBow 3s cubic-bezier(.16,1,.3,1) .2s infinite both;}
    .excel-notice-mascot-bubble{transform-origin:170px 78px;animation:excelMascotBubble .5s ease-out 1.42s both;}
    .excel-support-notice-heading{grid-column:2;justify-self:center;text-align:center;}
    .excel-support-notice-title{margin:0 0 4px;font-size:24px;font-weight:1000;line-height:1.12;color:#111827;letter-spacing:-.04em;text-align:center;}
    .excel-support-notice-subtitle{margin:0;color:#475569;font-size:13px;font-weight:850;line-height:1.35;}
    .excel-support-countdown{display:grid;gap:3px;margin:10px 18px 0;padding:10px 14px;border-radius:15px;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#eff6ff;box-shadow:inset 0 0 0 1px rgba(147,197,253,.22);text-align:center;}
    .excel-support-countdown span{font-size:12px;font-weight:900;color:#bfdbfe;}
    .excel-support-countdown b{font-size:25px;font-weight:1000;line-height:1.05;letter-spacing:-.02em;animation:excelCountdownGlow 2.4s ease-in-out infinite;}
    .excel-support-countdown small{font-size:11px;color:#dbeafe;font-weight:800;}
    .excel-support-notice-body{display:grid;gap:10px;padding:14px 18px 8px;font-size:13px;line-height:1.52;color:#334155;font-weight:750;}
    .excel-support-notice-body p{margin:0;}
    .excel-support-notice-body strong{color:#0f172a;font-weight:1000;}
    .excel-support-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:0 18px 10px;}
    .excel-support-info-card{border:1px solid rgba(148,163,184,.35);border-radius:14px;background:#fff;padding:9px 12px;box-shadow:0 8px 20px rgba(15,23,42,.05);}
    .excel-support-info-card h3{margin:0 0 6px;font-size:13px;font-weight:1000;color:#0f172a;text-align:left;}
    .excel-support-info-card ul{display:grid;grid-template-columns:1fr;gap:3px;margin:0;padding:0;list-style:none;color:#475569;font-size:12px;font-weight:850;line-height:1.32;}
    .excel-support-info-card li::before{content:"•";margin-right:4px;color:#2563eb;font-weight:1000;}
    .excel-support-info-card.is-ended li::before{color:#dc2626;}
    .excel-support-notice-actions{position:sticky;bottom:0;display:flex;justify-content:flex-end;gap:8px;padding:10px 18px 14px;background:linear-gradient(180deg,rgba(255,255,255,.76),#fff 42%);}
    .excel-support-notice-btn{height:36px;padding:0 14px;border-radius:11px;border:1px solid #cbd5e1;background:#fff;color:#334155;font-weight:1000;cursor:pointer;}
    .excel-support-notice-btn:hover{border-color:#93c5fd;background:#eff6ff;color:#1d4ed8;}
    .excel-support-notice-btn.is-primary{border-color:#2563eb;background:#2563eb;color:#fff;box-shadow:0 8px 18px rgba(37,99,235,.2);}
    .excel-support-ended-card{width:min(440px,calc(100vw - 32px));border-radius:20px;background:#fff;padding:22px;border:1px solid rgba(220,38,38,.25);box-shadow:0 22px 72px rgba(2,6,23,.32);text-align:center;color:#1f2937;animation:excelNoticeCardIn .32s ease-out both;}
    .excel-support-ended-card h2{margin:0 0 10px;color:#991b1b;font-size:22px;font-weight:1000;}
    .excel-support-ended-card p{margin:0 0 16px;line-height:1.55;color:#4b5563;font-weight:800;}
    @keyframes excelNoticeFadeIn{from{opacity:0}to{opacity:1}}
    @keyframes excelNoticeCardIn{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes excelMascotBow{0%,20%{transform:rotate(0deg) translate(0,0)}48%,68%{transform:rotate(88deg) translate(28px,72px)}100%{transform:rotate(0deg) translate(0,0)}}
    @keyframes excelMascotBubble{from{opacity:0;transform:scale(.6) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes excelCountdownGlow{0%,100%{text-shadow:0 0 0 rgba(191,219,254,0)}50%{text-shadow:0 0 14px rgba(191,219,254,.5)}}
    @media (max-width:640px){.excel-support-notice{padding:10px}.excel-support-notice-card{width:calc(100vw - 14px);max-height:calc(100vh - 14px);border-radius:20px}.excel-support-notice-hero{grid-template-columns:1fr;padding:14px 15px 10px;text-align:center}.excel-notice-mascot{grid-column:1;min-height:96px}.excel-notice-mascot-svg{width:118px}.excel-support-notice-heading{grid-column:1}.excel-support-notice-title{font-size:21px}.excel-support-notice-subtitle{font-size:12.5px}.excel-support-countdown{margin:9px 14px 0;padding:9px 12px}.excel-support-countdown b{font-size:21px}.excel-support-notice-body{padding:12px 14px 7px;font-size:12.5px}.excel-support-card-grid{grid-template-columns:1fr;padding:0 14px 10px}.excel-support-notice-actions{padding:10px 14px 14px;flex-direction:column}.excel-support-notice-btn{width:100%;}}
  `;

  style.textContent+=`
    .month-rune-modal.is-modal-compare{width:min(1180px,calc(100vw - 64px));height:min(760px,calc(100vh - 72px));max-height:calc(100vh - 72px);}
    .month-rune-modal.is-modal-compare .month-rune-header-actions{justify-content:center;}
    .month-rune-modal.is-modal-compare .month-rune-body{max-height:none;overflow:hidden;}
    .month-rune-modal.is-modal-compare .month-rune-panel[data-month-rune-panel="compare"]{height:100%;min-height:0;}
    .excel-compare-version{display:inline-flex;align-items:center;justify-content:center;margin:0 2px;padding:1px 7px;border:1px solid #d99030;border-radius:999px;background:var(--color-white);color:var(--color-orange-800);font-weight:900;line-height:1.2;}
    body.is-tablet .excel-compare-controls{gap:5px;}
    body.is-tablet .excel-compare-header-controls{overflow-x:auto;overflow-y:hidden;}
    body.is-tablet .excel-compare-controls select{height:31px;min-width:112px;padding:0 24px 0 8px;font-size:calc(10.5px * var(--app-font-scale));}
    body.is-tablet .excel-compare-file-btn,body.is-tablet .excel-compare-apply-btn,body.is-tablet .excel-compare-reset-btn,body.is-tablet .excel-compare-restore-btn{height:31px;padding:0 9px;font-size:calc(10px * var(--app-font-scale));}
    body.is-tablet .excel-compare-body{padding:8px;}
    body.is-tablet .excel-compare-summary{grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-bottom:8px;}
    body.is-tablet .excel-compare-summary-card{min-height:50px;padding:6px 5px;}
    body.is-tablet .excel-compare-summary span{font-size:calc(8.75px * var(--app-font-scale));}
    body.is-tablet .excel-compare-summary b{font-size:calc(10px * var(--app-font-scale));}
    body.is-tablet .excel-compare-table{min-width:800px;font-size:calc(10px * var(--app-font-scale));}
    body.is-tablet .excel-compare-table th,body.is-tablet .excel-compare-table td{height:27px;padding:3px 6px;}
    body.is-mobile .excel-compare-controls{gap:5px;width:100%;}
    body.is-mobile .excel-compare-header-controls{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));overflow:visible;}
    body.is-mobile .excel-compare-header-controls>*{min-width:0;width:100%;}
    body.is-mobile .excel-compare-header-controls>.excel-compare-base-file-btn{grid-column:1 / 4;}
    body.is-mobile .excel-compare-header-controls>#excelCompareBasePreset{grid-column:4 / 7;}
    body.is-mobile .excel-compare-header-controls>.excel-compare-target-file-btn{grid-column:1 / 4;}
    body.is-mobile .excel-compare-header-controls>#excelCompareSheet{grid-column:4 / 7;}
    body.is-mobile .excel-compare-header-controls>#excelCompareApplyBtn{grid-column:1 / 4;}
    body.is-mobile .excel-compare-header-controls>#excelCompareJewelOnlyBtn{grid-column:4 / 7;}
    body.is-mobile .excel-compare-header-controls>#excelCompareRestoreBtn{grid-column:1 / 4;}
    body.is-mobile .excel-compare-header-controls>#excelCompareResetBtn{grid-column:4 / 7;}
    body.is-mobile .excel-compare-controls select{height:30px;min-width:0;width:100%;padding:0 20px 0 5px;font-size:calc(9px * var(--app-font-scale));}
    body.is-mobile .excel-compare-file-btn,body.is-mobile .excel-compare-apply-btn,body.is-mobile .excel-compare-jewel-only-btn,body.is-mobile .excel-compare-reset-btn,body.is-mobile .excel-compare-restore-btn{height:30px;min-width:0;padding:0 6px;font-size:calc(8.5px * var(--app-font-scale));letter-spacing:-.45px;}
    body.is-mobile .excel-compare-body{padding:7px;}
    body.is-mobile .excel-compare-empty,body.is-mobile .excel-compare-error{min-height:180px;padding:18px;font-size:calc(11px * var(--app-font-scale));}
    body.is-mobile .excel-compare-empty small{margin-top:6px;font-size:calc(9.5px * var(--app-font-scale));}
    body.is-mobile .excel-compare-summary{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-bottom:7px;}
    body.is-mobile .excel-compare-summary-card{min-height:40px;padding:4px 3px;border-radius:7px;}
    body.is-mobile .excel-compare-summary-card:first-child{grid-column:auto;min-height:40px;}
    body.is-mobile .excel-compare-summary span{font-size:calc(8px * var(--app-font-scale));line-height:1.15;white-space:nowrap;}
    body.is-mobile .excel-compare-summary b{max-width:100%;font-size:calc(9px * var(--app-font-scale));line-height:1.15;}
    body.is-mobile .excel-compare-table{min-width:760px;font-size:calc(9px * var(--app-font-scale));}
    body.is-mobile .excel-compare-table th,body.is-mobile .excel-compare-table td{height:26px;padding:3px 5px;}
  `;
  document.head.appendChild(style);
}
function renderExcelSupportNotice(){
  if(!shouldShowExcelSupportNotice() || document.getElementById(EXCEL_NOTICE_ID)) return;
  injectExcelFeatureStyle();
  const root=document.createElement('div');
  root.id=EXCEL_NOTICE_ID;
  root.className='excel-support-notice';
  root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');
  root.setAttribute('aria-labelledby','excelSupportNoticeTitle');
  root.innerHTML=`
    <section class="excel-support-notice-card">
      <div class="excel-support-notice-hero">
        <div class="excel-notice-mascot">${EXCEL_NOTICE_ASSETS.bowingMascot}</div>
        <div class="excel-support-notice-heading">
          <h2 id="excelSupportNoticeTitle" class="excel-support-notice-title">엑셀 기능 지원 종료 안내</h2>
        </div>
      </div>
      <div class="excel-support-countdown" aria-live="polite">
        <span>지원 종료까지 남은 시간</span>
        <b data-excel-support-countdown>${escapeHtml(formatExcelSupportRemaining())}</b>
        <small>종료 일시: 2026년 7월 24일 23:00</small>
      </div>
      <div class="excel-support-notice-body">
        <p>안녕하세요. <strong>제작자 회장</strong>입니다.</p>
        <p>엑셀에서 웹으로 데이터를 간편하게 가져오실 수 있도록 지원해 드린 지도 어느덧 두 달이 넘었습니다.</p>
        <p>이제 많은 분들이 웹 계산기와 통합프리셋 기능을 충분히 사용해 보셨다고 판단하여, <strong>2026년 7월 24일 23:00</strong>을 기준으로 엑셀 가져오기 및 엑셀 프리셋 비교 기능 지원을 종료합니다.</p>
        <p>지원 종료 후에도 웹 계산기와 통합프리셋 기능은 계속 이용하실 수 있으며, 앞으로는 웹 자체 기능 개선과 최적화, 유저 친화적인 시스템 개발에 더 집중하겠습니다.</p>
      </div>
      <div class="excel-support-card-grid">
        <section class="excel-support-info-card"><h3>✅ 계속 이용 가능</h3><ul><li>웹 계산기</li><li>통합프리셋</li><li>프리셋 백업</li><li>기존 저장된 설정 사용</li></ul></section>
        <section class="excel-support-info-card is-ended"><h3>⛔ 지원 종료 예정</h3><ul><li>엑셀 가져오기</li><li>엑셀 프리셋 비교</li></ul></section>
      </div>
      <div class="excel-support-notice-actions">
        <button type="button" class="excel-support-notice-btn is-primary" data-excel-support-hide-day>하루 보지 않음</button>
        <button type="button" class="excel-support-notice-btn" data-excel-support-close>닫기</button>
      </div>
    </section>`;
  document.body.appendChild(root);
  updateExcelSupportCountdown();
  excelNoticeTimer=setInterval(updateExcelSupportCountdown,1000);
}
function updateExcelSupportCountdown(){
  const el=document.querySelector('[data-excel-support-countdown]');
  if(el) el.textContent=formatExcelSupportRemaining();
  if(isExcelSupportBlocked()){
    hideExcelSupportNotice();
    updateExcelFeatureAvailability();
  }
}
function showExcelSupportEndedMessage(){
  injectExcelFeatureStyle();
  document.getElementById(EXCEL_ENDED_NOTICE_ID)?.remove();
  const root=document.createElement('div');
  root.id=EXCEL_ENDED_NOTICE_ID;
  root.className='excel-support-notice';
  root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');
  root.innerHTML=`
    <section class="excel-support-ended-card">
      <h2>엑셀 기능 지원이 종료되었습니다</h2>
      <p>엑셀 가져오기 및 엑셀 프리셋 비교 기능 지원이 종료되어 더 이상 해당 기능을 사용할 수 없습니다.<br>웹 계산기와 통합프리셋 기능은 계속 이용하실 수 있습니다.<br>필요한 설정은 프리셋 백업 기능을 이용해 관리해 주세요.</p>
      <button type="button" class="excel-support-notice-btn is-primary" data-excel-support-ended-close>확인</button>
    </section>`;
  document.body.appendChild(root);
}
function guardExcelSupport(){
  if(!isExcelSupportBlocked()) return true;
  showExcelSupportEndedMessage();
  updateExcelFeatureAvailability();
  return false;
}
function updateExcelFeatureAvailability(){
  const blocked=isExcelSupportBlocked();
  document.querySelectorAll('#excelCompareBaseFile,#excelCompareFile,#excelCompareSheet,#excelCompareBasePreset,#excelCompareApplyBtn,#excelCompareJewelOnlyBtn,#excelCompareRestoreBtn,#excelCompareResetBtn').forEach(el=>{
    el.disabled=blocked || el.disabled;
    el.classList.toggle('excel-feature-disabled',blocked);
  });
  if(blocked){
    const body=$('excelCompareBody');
    if(body) body.innerHTML='<div class="excel-compare-error">엑셀 가져오기 및 엑셀 프리셋 비교 기능 지원이 종료되었습니다.</div>';
  }
}
function bindExcelSupportNoticeEvents(){
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-excel-support-hide-day]')){ hideExcelSupportNoticeForOneDay(); return; }
    if(event.target.closest('[data-excel-support-close]')){ hideExcelSupportNotice(); return; }
    if(event.target.closest('[data-excel-support-ended-close]')){ document.getElementById(EXCEL_ENDED_NOTICE_ID)?.remove(); }
  });
}
function initExcelFeature(){
  injectExcelFeatureStyle();
  bindExcelSupportNoticeEvents();
  renderExcelSupportNotice();
  updateExcelFeatureAvailability();
}
window.ExcelFeature=Object.freeze({init:initExcelFeature,guard:guardExcelSupport,isBlocked:isExcelSupportBlocked,showNotice:renderExcelSupportNotice,showEnded:showExcelSupportEndedMessage,renderCompareHeaderControls:renderExcelCompareHeaderControls,renderComparePanel:renderExcelComparePanel});
