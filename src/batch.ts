import { PDFDocument } from 'pdf-lib';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { blankProject, projectSchema, validationErrors } from './domain';
import type { Project } from './domain';

export type BatchTemplate = 'note';
export type BatchColumn = { key:string; label:string };
export type BatchRow = { excelRow:number; project:Project; errors:string[]; pdf?:Uint8Array };
export type ParsedBatch = { template:BatchTemplate; rows:BatchRow[] };
export type PreparedBatch = ParsedBatch & { ready:boolean };

const MAX_XLSX_BYTES=10*1024*1024;
const MAX_UNCOMPRESSED_BYTES=40*1024*1024;
const MAX_ZIP_ENTRIES=250;
const A4_WIDTH=595.28;
const A4_HEIGHT=841.89;
const MIME_XLSX='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const templateLabels={note:'Note to Assessment'};
const NOTE_ONLY_MESSAGE='Excel batches support Note to Assessment only. Use Single document for Best of Judgement letters, Demand Notices and Assessment Notices.';
function assertNoteTemplate(template:string):asserts template is BatchTemplate {
  if(template!=='note')throw new Error(NOTE_ONLY_MESSAGE);
}

const noteColumns:BatchColumn[]=[
  ['name','Taxpayer name'],['payerId','Payer ID'],['age','Age'],['company','Company name'],['employerAddress','Employer address'],
  ['designation','Designation'],['business','Nature of business'],['address','Taxpayer address'],['otherIncome','Other sources of income'],
  ['brief','Brief'],['companyDetails','Company details'],['averageRemittance','Company average remittance'],['conclusion','Conclusion'],['assessmentType','Type of assessment'],
  ...(['years','declared','additional','gross','taxDue','taxPaid','taxPayable'] as const).flatMap((key,index)=>{
    const labels=['Income year','Income declared on Form A','Applied income from other sources / benefits of office','Proposed gross income','Tax due','Tax paid on account','Tax payable'];
    const label=labels[index]!;
    return [0,1,2].map(i=>[`${key}.${i}`,`${label} — Year ${i+1}`] as [string,string]);
  }),
  ['preparedBy','Prepared by'],['approvedBy','Approved by'],
].map(([key,label])=>({key:key!,label:label!}));
export const batchColumns:Record<BatchTemplate,BatchColumn[]>={note:noteColumns};

function xmlEscape(value:string) {
  return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function xmlUnescape(value:string) {
  return value.replace(/&#x([\da-f]+);/gi,(_,hex:string)=>String.fromCodePoint(parseInt(hex,16)))
    .replace(/&#(\d+);/g,(_,decimal:string)=>String.fromCodePoint(Number(decimal)))
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
}
function attr(tag:string,name:string):string|undefined {
  const escaped=name.replace(':','\\:');
  const match=tag.match(new RegExp(`(?:^|\\s)${escaped}="([^"]*)"`));
  return match?xmlUnescape(match[1]!):undefined;
}
function columnName(index:number) {
  let n=index+1;let name='';
  while(n){const remainder=(n-1)%26;name=String.fromCharCode(65+remainder)+name;n=Math.floor((n-1)/26);}
  return name;
}
function columnIndex(reference:string):number {
  const letters=reference.replace(/\d/g,'').toUpperCase();
  let value=0;for(const letter of letters){const code=letter.charCodeAt(0);if(code<65||code>90)throw new Error('The workbook contains an invalid cell address.');value=value*26+code-64;}
  return value-1;
}
function inlineCell(reference:string,value:string,style?:number) {
  return `<c r="${reference}"${style===undefined?'':` s="${style}"`} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}
function worksheetXml(rows:string[][],options:{header?:boolean;freeze?:boolean;widths?:number[]}={}) {
  const sheetRows=rows.map((values,rowIndex)=>`<row r="${rowIndex+1}">${values.map((value,colIndex)=>inlineCell(`${columnName(colIndex)}${rowIndex+1}`,value,options.header&&rowIndex===0?1:options.header?3:undefined)).join('')}</row>`).join('');
  const columns=options.widths?.length?`<cols>${options.widths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"${options.header?` style="${i<rows[0]!.length?3:0}"`:''}/>`).join('')}</cols>`:'';
  const freeze=options.freeze?'<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>':'';
  const filter=options.header&&rows[0]!.length?`<autoFilter ref="A1:${columnName(rows[0]!.length-1)}1"/>`:'';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetFormatPr defaultRowHeight="18"/>${freeze}${columns}<sheetData>${sheetRows}</sheetData>${filter}<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}
function instructionRows(template:BatchTemplate) {
  return [
    [`IGANMU_BATCH|1|${template}`],
    [`AssessmentDesk — Iganmu — ${templateLabels[template]}`],
    ['This workbook is for Notes to Assessment only. Keep the Documents sheet headers unchanged.'],
    ['Each non-empty row from row 2 onward is one document. Leave unused rows completely blank.'],
    ['Enter identifiers, years and amounts as text to preserve leading zeros, punctuation, blanks, NIL and zero.'],
    ['Enter every figure exactly as it should print. Amounts are preserved as text and are not calculated. Do not enter formulas.'],
    ['After completing the sheet, save it as .xlsx and choose it in AssessmentDesk.'],
    ['Batch checks report every affected spreadsheet row. Both exports stay blocked until every document is valid and renders as one portrait A4 page.'],
    ['No data is uploaded. The workbook is processed locally in the browser.'],
  ];
}

/** Creates the prescribed, local-only XLSX input workbook for Notes to Assessment. */
export function createBatchWorkbook(template:BatchTemplate,rows:Record<string,string>[]=[]):Uint8Array {
  assertNoteTemplate(template);
  const columns=batchColumns[template];
  const instruction=instructionRows(template).map(row=>row[0]!);
  const documentRows=[columns.map(c=>c.label),...rows.map(row=>columns.map(c=>row[c.key]??''))];
  const widths=columns.map(c=>Math.min(36,Math.max(18,c.label.length+2)));
  const instructionsXml=worksheetXml(instruction.map(v=>[v]),{widths:[110]});
  const documentsXml=worksheetXml(documentRows,{header:true,freeze:true,widths});
  const files:Record<string,Uint8Array>={
    '[Content_Types].xml':strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'),
    '_rels/.rels':strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml':strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Instructions" sheetId="1" r:id="rId1"/><sheet name="Documents" sheetId="2" r:id="rId2"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels':strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml':strToU8(instructionsXml),
    'xl/worksheets/sheet2.xml':strToU8(documentsXml),
    'xl/styles.xml':strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="@"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF255344"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'),
  };
  return zipSync(files,{level:6});
}

function zipLimits(data:Uint8Array) {
  if(data.length>MAX_XLSX_BYTES) throw new Error('This workbook is larger than 10 MB. Save a smaller .xlsx workbook and try again.');
  const min=Math.max(0,data.length-22-65535);let end=-1;
  for(let i=data.length-22;i>=min;i--)if(data[i]===0x50&&data[i+1]===0x4b&&data[i+2]===0x05&&data[i+3]===0x06){end=i;break;}
  if(end<0)throw new Error('This file is not a valid .xlsx workbook. Download a prescribed Iganmu workbook and try again.');
  const v=new DataView(data.buffer,data.byteOffset,data.byteLength);
  const disk=v.getUint16(end+4,true),centralDisk=v.getUint16(end+6,true),diskEntries=v.getUint16(end+8,true),count=v.getUint16(end+10,true),size=v.getUint32(end+12,true),offset=v.getUint32(end+16,true);
  if(disk||centralDisk||diskEntries!==count||count>MAX_ZIP_ENTRIES||size===0xffffffff||offset===0xffffffff||offset+size>end)throw new Error('This workbook has an unsupported or invalid ZIP structure.');
  let cursor=offset;let total=0;
  for(let i=0;i<count;i++){
    if(cursor+46>offset+size||v.getUint32(cursor,true)!==0x02014b50)throw new Error('This workbook has an invalid ZIP directory.');
    const flags=v.getUint16(cursor+8,true),expanded=v.getUint32(cursor+24,true),nameLength=v.getUint16(cursor+28,true),extraLength=v.getUint16(cursor+30,true),commentLength=v.getUint16(cursor+32,true);
    if(flags&1||expanded===0xffffffff)throw new Error('Encrypted or oversized workbook entries are not supported.');
    total+=expanded;if(total>MAX_UNCOMPRESSED_BYTES)throw new Error('This workbook expands beyond the 40 MB safety limit.');
    cursor+=46+nameLength+extraLength+commentLength;
  }
  if(cursor!==offset+size)throw new Error('This workbook has an invalid ZIP directory.');
}
function xmlDecodeText(xml:string) {
  return xml.replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&').replace(/&#x([\da-f]+);/gi,(_,hex:string)=>String.fromCodePoint(parseInt(hex,16))).replace(/&#(\d+);/g,(_,dec:string)=>String.fromCodePoint(Number(dec)));
}
function sharedStringValues(xml:string|undefined):string[] {
  if(!xml)return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>[...m[1]!.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t=>xmlDecodeText(t[1]!)).join(''));
}
type CellValue={value:string;formula:boolean};
type SheetRows=Map<number,Map<number,CellValue>>;
function readSheet(xml:string,shared:string[]):SheetRows {
  const rows:SheetRows=new Map();
  for(const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)){
    const rowNo=Number(attr(rowMatch[1]!, 'r'));if(!Number.isInteger(rowNo)||rowNo<1)continue;
    const cells=new Map<number,CellValue>();
    for(const cellMatch of rowMatch[2]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
      const reference=attr(cellMatch[1]!, 'r');if(!reference)continue;
      const index=columnIndex(reference);const body=cellMatch[2]??'';const type=attr(cellMatch[1]!, 't');
      const formula=/<f(?:\s[^>]*)?>[\s\S]*?<\/f>|<f(?:\s[^>]*)?\s*\/>/.test(body);
      const v=body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
      let value='';
      if(type==='inlineStr') value=[...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m=>xmlDecodeText(m[1]!)).join('');
      else if(type==='s'&&v!==undefined)value=shared[Number(v)]??'';
      else if(v!==undefined)value=xmlDecodeText(v);
      cells.set(index,{value,formula});
    }
    rows.set(rowNo,cells);
  }
  return rows;
}
function findWorksheetPath(workbookXml:string,relsXml:string,name:string) {
  const sheet=[...workbookXml.matchAll(/<sheet\b[^>]*\/?\s*>/g)].find(m=>attr(m[0],'name')===name)?.[0];
  if(!sheet)throw new Error(`The workbook is missing the ${name} sheet.`);
  const relationshipId=attr(sheet,'r:id');if(!relationshipId)throw new Error(`The ${name} sheet has no workbook relationship.`);
  const relation=[...relsXml.matchAll(/<Relationship\b[^>]*\/?\s*>/g)].find(m=>attr(m[0],'Id')===relationshipId)?.[0];
  const target=relation&&attr(relation,'Target');if(!target)throw new Error(`The ${name} sheet path is missing.`);
  const path=target.startsWith('/')?target.slice(1):`xl/${target}`;
  if(!path.startsWith('xl/worksheets/')||path.includes('..'))throw new Error(`The ${name} sheet path is not supported.`);
  return path;
}
function keyLabel(key:string) {
  return batchColumns.note.find(column=>column.key===key)?.label??key;
}
function schemaIssues(project:Project):string[] {
  const result=projectSchema.safeParse(project);if(result.success)return [];
  return result.error.issues.map(issue=>{
    const rawKey=String(issue.path[issue.path.length-1]??'');
    const key=issue.path.includes('data')?rawKey:'';
    const label=key?keyLabel(key):'Document';
    if(issue.code==='too_big'&&'maximum' in issue)return `${label} is too long (maximum ${issue.maximum} characters).`;
    return `${label}: ${issue.message}`;
  });
}
function setProjectField(project:Project,key:string,value:string) {
  if(key.includes('.')){
    const [array,indexText]=key.split('.');const index=Number(indexText);
    const data=project.data as unknown as Record<string,string|string[]>;const values=[...(data[array!] as string[])];values[index]=value;data[array!]=values;
  }else (project.data as unknown as Record<string,string>)[key]=value;
}
function getCellValue(cell:CellValue|undefined) {return cell?.value??'';}

/** Reads a prescribed template workbook. Formula cells are rejected as data. */
export function parseBatchWorkbook(data:Uint8Array):ParsedBatch {
  zipLimits(data);
  let files:Record<string,Uint8Array>;
  try{files=unzipSync(data) as Record<string,Uint8Array>;}catch{throw new Error('This workbook could not be opened. Save it again as a standard .xlsx file.');}
  if(Object.keys(files).some(path=>path.includes('vbaProject')||path.startsWith('xl/externalLinks/')))throw new Error('Macro-enabled and externally linked workbooks are not supported.');
  const xml=(path:string)=>{const content=files[path];if(!content)throw new Error(`This workbook is missing ${path}.`);return strFromU8(content);};
  const workbook=xml('xl/workbook.xml');const rels=xml('xl/_rels/workbook.xml.rels');
  const strings=sharedStringValues(files['xl/sharedStrings.xml']?strFromU8(files['xl/sharedStrings.xml']):undefined);
  const instructionPath=findWorksheetPath(workbook,rels,'Instructions');
  const dataPath=findWorksheetPath(workbook,rels,'Documents');
  const instructions=readSheet(xml(instructionPath),strings);
  const marker=getCellValue(instructions.get(1)?.get(0));
  const match=marker.match(/^IGANMU_BATCH\|1\|(letter|note|demand|assessment)$/);
  if(!match)throw new Error('This is not a supported Iganmu batch template. Download the prescribed Note to Assessment workbook.');
  const template=match[1]!;assertNoteTemplate(template);
  const expected=batchColumns[template];
  const sheet=readSheet(xml(dataPath),strings);const headerRow=sheet.get(1);
  if(!headerRow)throw new Error('The Documents sheet is missing its column headers.');
  const headerMap=new Map<string,number>();
  for(const [index,cell] of headerRow){
    if(cell.formula)throw new Error('Formula cells are not allowed in the Documents sheet headers.');
    const label=cell.value.trim();if(!label)continue;
    if(headerMap.has(label))throw new Error(`The Documents sheet has a duplicate column header: ${label}.`);
    headerMap.set(label,index);
  }
  const missing=expected.filter(column=>!headerMap.has(column.label));
  const extra=[...headerMap.keys()].filter(label=>!expected.some(column=>column.label===label));
  if(missing.length||extra.length){
    const parts=[...(missing.length?[`Missing columns: ${missing.map(c=>c.label).join(', ')}.`]:[]),...(extra.length?[`Unrecognized columns: ${extra.join(', ')}.`]:[])];
    throw new Error(`The Documents sheet does not match the ${templateLabels[template]} template. ${parts.join(' ')}`);
  }
  const labelKeys=new Map(expected.map(column=>[column.label,column.key]));
  const rows:BatchRow[]=[];
  for(const [rowNo,cells] of sheet){
    if(rowNo===1)continue;
    let nonBlank=false;const rowValues:Record<string,CellValue>={};const formulaErrors:string[]=[];const dataColumnIndexes=new Set(headerMap.values());
    for(const [label,index] of headerMap){
      const cell=cells.get(index)??{value:'',formula:false};
      if(cell.value.trim()||cell.formula)nonBlank=true;
      const key=labelKeys.get(label)!;rowValues[key]=cell;
      if(cell.formula)formulaErrors.push(`${label} contains an Excel formula. Replace it with a fixed value; formulas are not imported.`);
    }
    for(const [index,cell] of cells){
      if(!dataColumnIndexes.has(index)&&(cell.value.trim()||cell.formula)){
        nonBlank=true;formulaErrors.push(`Column ${columnName(index)} contains data but has no prescribed heading. Move the value under a template heading.`);
      }
    }
    if(!nonBlank)continue;
    const project=blankProject(template);
    for(const [key,cell] of Object.entries(rowValues))setProjectField(project,key,cell.value);
    const errors=[...formulaErrors,...schemaIssues(project),...validationErrors(project)];
    rows.push({excelRow:rowNo,project,errors:[...new Set(errors)]});
  }
  if(!rows.length)throw new Error('The Documents sheet has no non-empty document rows. Enter at least one document starting on row 2.');
  return {template,rows};
}

/** Renders every input row in order, then only marks the batch ready when all rows pass. */
export async function prepareBatch(parsed:ParsedBatch,onProgress?:(done:number,total:number,row:number)=>void):Promise<PreparedBatch> {
  assertNoteTemplate(parsed.template);
  const {generatePdf}=await import('./pdf');
  const results:BatchRow[]=[];let completed=0;
  for(const row of parsed.rows){
    const errors=[...row.errors];
    if(row.project.template!=='note')errors.push(NOTE_ONLY_MESSAGE);
    let bytes:Uint8Array|undefined;
    if(!errors.length){
      try{
        const result=await generatePdf(row.project);bytes=new Uint8Array(result.bytes);
        if(result.pages!==1)errors.push(`Document renders as ${result.pages} pages; export requires exactly one page.`);
        if(Math.abs(result.pageSize.width-A4_WIDTH)>=0.1||Math.abs(result.pageSize.height-A4_HEIGHT)>=0.1)errors.push('Document is not portrait A4; export requires one portrait A4 page.');
      }catch{errors.push('PDF generation failed for this row. Correct its data and retry the batch.');}
    }
    completed++;onProgress?.(completed,parsed.rows.length,row.excelRow);
    results.push({excelRow:row.excelRow,project:row.project,errors,...(!errors.length&&bytes?{pdf:bytes}:{})});
  }
  const ready=results.length>0&&results.every(row=>row.errors.length===0&&!!row.pdf);
  return {template:parsed.template,rows:ready?results:results.map(({pdf:_,...row})=>row),ready};
}

function assertReady(batch:PreparedBatch) {
  assertNoteTemplate(batch.template);
  for(const row of batch.rows)assertNoteTemplate(row.project.template);
  if(!batch.ready||!batch.rows.length||batch.rows.some(row=>row.errors.length||!row.pdf))throw new Error('Both batch exports require every spreadsheet row to pass validation and render as one portrait A4 page.');
}
export async function createCombinedBatchPdf(batch:PreparedBatch):Promise<Uint8Array> {
  assertReady(batch);const combined=await PDFDocument.create();
  for(const row of batch.rows){
    const source=await PDFDocument.load(row.pdf!);
    if(source.getPageCount()!==1)throw new Error(`Excel row ${row.excelRow} no longer has exactly one PDF page.`);
    const [page]=await combined.copyPages(source,[0]);combined.addPage(page!);
  }
  return combined.save();
}
export function createBatchZip(batch:PreparedBatch):Uint8Array {
  assertReady(batch);const files:Record<string,Uint8Array>={};
  for(const row of batch.rows){
    const kind=row.project.template;
    files[`iganmu-${kind}-row-${String(row.excelRow).padStart(4,'0')}.pdf`]=row.pdf!;
  }
  return zipSync(files,{level:6});
}
export function batchTemplateName(template:BatchTemplate) {return `iganmu-${template}-batch-template.xlsx`;}
export function batchPdfName(template:BatchTemplate) {return `iganmu-${template}-batch.pdf`;}
export function batchZipName(template:BatchTemplate) {return `iganmu-${template}-individual-pdfs.zip`;}
export function batchMimeType() {return MIME_XLSX;}
