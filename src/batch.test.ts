import {describe,it,expect} from 'vitest';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {exampleProject} from './domain';
import type {Project} from './domain';
import {batchColumns,createBatchWorkbook,parseBatchWorkbook} from './batch';

function rowFrom(project:Project):Record<string,string>{
  const data=project.data as unknown as Record<string,string|string[]>;
  return Object.fromEntries(batchColumns.note.map(({key})=>{
    const [base,index]=key.split('.');const value=data[base!];
    return [key,Array.isArray(value)?value[Number(index)??0]??'':value??''];
  }));
}

describe('prescribed Excel batch workbooks',()=>{
  it('creates and reads the Note to Assessment workbook without changing manual figures',()=>{
    for(const template of ['note'] as const){
      const example=exampleProject(template);const parsed=parseBatchWorkbook(createBatchWorkbook(template,[rowFrom(example)]));
      expect(parsed.template).toBe(template);expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0]!.excelRow).toBe(2);expect(parsed.rows[0]!.errors).toEqual([]);
      expect(parsed.rows[0]!.project.data).toEqual(example.data);
    }
    const note=exampleProject('note');if(note.template!=='note')throw new Error();
    note.data.gross=['9','NIL',''];note.data.taxPayable=['100','88.10','NIL'];
    const parsed=parseBatchWorkbook(createBatchWorkbook('note',[rowFrom(note)]));
    if(parsed.rows[0]!.project.template!=='note')throw new Error();
    expect(parsed.rows[0]!.project.data.gross).toEqual(['9','NIL','']);
    expect(parsed.rows[0]!.project.data.taxPayable).toEqual(['100','88.10','NIL']);
  });

  it('reports real spreadsheet row numbers and does not mistake a partly filled row for a blank row',()=>{
    const example=exampleProject('note');if(example.template!=='note')throw new Error();
    const missing={...rowFrom(example),name:''};
    const blank=Object.fromEntries(batchColumns.note.map(column=>[column.key,'']));
    const parsed=parseBatchWorkbook(createBatchWorkbook('note',[missing,blank,rowFrom(example)]));
    expect(parsed.rows.map(row=>row.excelRow)).toEqual([2,4]);
    expect(parsed.rows[0]!.errors).toContain('Taxpayer name is required.');
    expect(parsed.rows[1]!.errors).toEqual([]);
  });

  it('rejects missing or unknown template headings instead of silently dropping columns',()=>{
    const workbook=unzipSync(createBatchWorkbook('note'));
    const file=workbook['xl/worksheets/sheet2.xml']!;
    let xml=strFromU8(file).replace('Taxpayer name','Unknown amount');
    workbook['xl/worksheets/sheet2.xml']=strToU8(xml);
    expect(()=>parseBatchWorkbook(zipSync(workbook))).toThrow(/does not match the Note to Assessment template/);
  });

  it('rejects formulas and identifies the affected spreadsheet row',()=>{
    const project=exampleProject('note');const workbook=unzipSync(createBatchWorkbook('note',[rowFrom(project)]));
    let xml=strFromU8(workbook['xl/worksheets/sheet2.xml']!);
    const cell=xml.match(/<c r="A2"[^>]*>.*?<\/c>/)?.[0];expect(cell).toBeTruthy();
    xml=xml.replace(cell!, '<c r="A2"><f>"DO NOT RUN"</f><v>forged</v></c>');
    workbook['xl/worksheets/sheet2.xml']=strToU8(xml);
    const parsed=parseBatchWorkbook(zipSync(workbook));
    expect(parsed.rows[0]!.excelRow).toBe(2);
    expect(parsed.rows[0]!.errors.some(message=>message.includes('Taxpayer name contains an Excel formula'))).toBe(true);
  });

  it('rejects legacy letter workbook markers and unsupported template versions',()=>{
    for(const marker of ['IGANMU_BATCH|1|letter','IGANMU_BATCH|1|demand','IGANMU_BATCH|1|assessment','IGANMU_BATCH|2|note']){
      const workbook=unzipSync(createBatchWorkbook('note'));
      workbook['xl/worksheets/sheet1.xml']=strToU8(strFromU8(workbook['xl/worksheets/sheet1.xml']!).replace('IGANMU_BATCH|1|note',marker));
      expect(()=>parseBatchWorkbook(zipSync(workbook))).toThrow(/Note to Assessment/);
    }
  });
});
