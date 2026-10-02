import {it,expect} from 'vitest';
import {PDFDocument} from 'pdf-lib';
import {unzipSync} from 'fflate';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {exampleProject} from './domain';
import type {Project} from './domain';
import {batchColumns,createBatchZip,createCombinedBatchPdf,createBatchWorkbook,parseBatchWorkbook,prepareBatch} from './batch';

function rowFrom(project:Project):Record<string,string>{
  const data=project.data as unknown as Record<string,string|string[]>;
  return Object.fromEntries(batchColumns.note.map(({key})=>{
    const [base,index]=key.split('.');const value=data[base!];
    return [key,Array.isArray(value)?value[Number(index)]??'':value??''];
  }));
}
async function textFrom(bytes:Uint8Array) {
  const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:true});const doc=await loading.promise;
  try{return (await (await doc.getPage(1)).getTextContent()).items.flatMap(item=>'str' in item?[item.str]:[]).join(' ');}
  finally{await loading.destroy();}
}

it('prepares Notes to Assessment, then exports every A4 page in row order to PDF and ZIP',async()=>{
  for(const template of ['note'] as const){
    const first=exampleProject(template);const second=exampleProject(template);
    if(first.template==='note'&&second.template==='note'){first.data.name='FIRST SAMPLE';second.data.name='SECOND SAMPLE';}
    if(first.template==='note'){first.data.gross=['001.10','NIL',''];first.data.taxPayable=['999.99','0',''];}
    const parsed=parseBatchWorkbook(createBatchWorkbook(template,[rowFrom(first),rowFrom(second)]));
    const batch=await prepareBatch(parsed);
    expect(batch.ready).toBe(true);expect(batch.rows.map(row=>row.excelRow)).toEqual([2,3]);
    expect(batch.rows.every(row=>row.errors.length===0&&row.pdf)).toBe(true);
    const bytes=await createCombinedBatchPdf(batch);const pdf=await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    for(const page of pdf.getPages()){
      expect(page.getWidth()).toBeCloseTo(595.28,1);expect(page.getHeight()).toBeCloseTo(841.89,1);
    }
    const zip=unzipSync(createBatchZip(batch));
    expect(Object.keys(zip).sort()).toEqual([`iganmu-${template}-row-0002.pdf`,`iganmu-${template}-row-0003.pdf`].sort());
    for(const file of Object.values(zip))expect((await PDFDocument.load(file)).getPageCount()).toBe(1);
    const text=await textFrom(zip['iganmu-note-row-0002.pdf']!);
    for(const value of ['FIRST SAMPLE','001.10','NIL','999.99'])expect(text).toContain(value);
  }
},60000);

it('blocks the combined PDF and ZIP if any row is invalid or overflows',async()=>{
  const fitting=exampleProject('note');if(fitting.template!=='note')throw new Error();
  const overflowing=exampleProject('note');if(overflowing.template!=='note')throw new Error();
  overflowing.data.brief='Overflow test content. '.repeat(250);
  const incomplete=Object.fromEntries(batchColumns.note.map(column=>[column.key,'']));incomplete.payerId='000001';
  const parsed=parseBatchWorkbook(createBatchWorkbook('note',[rowFrom(fitting),rowFrom(overflowing),incomplete]));
  const batch=await prepareBatch(parsed);
  expect(batch.ready).toBe(false);expect(batch.rows.map(row=>row.excelRow)).toEqual([2,3,4]);
  expect(batch.rows[0]!.errors).toEqual([]);
  expect(batch.rows[1]!.errors.some(message=>message.includes('pages'))).toBe(true);
  expect(batch.rows[2]!.errors).toContain('Taxpayer name is required.');
  expect(batch.rows.some(row=>row.pdf)).toBe(false);
  await expect(createCombinedBatchPdf(batch)).rejects.toThrow('every spreadsheet row');
  expect(()=>createBatchZip(batch)).toThrow('every spreadsheet row');
},60000);
