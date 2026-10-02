import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {batchColumns,createBatchWorkbook} from '../src/batch';
import {exampleProject} from '../src/domain';
import type {Project} from '../src/domain';

function rowFrom(project:Project):Record<string,string>{
  const data=project.data as unknown as Record<string,string|string[]>;
  return Object.fromEntries(batchColumns.note.map(({key})=>{
    const [base,index]=key.split('.');const value=data[base!];
    return [key,Array.isArray(value)?value[Number(index)]??'':value??''];
  }));
}
async function pageText(bytes:Uint8Array,pageNumber=1) {
  const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:true});const pdf=await loading.promise;
  try{return (await (await pdf.getPage(pageNumber)).getTextContent()).items.flatMap(item=>'str' in item?[item.str]:[]).join(' ');}
  finally{await loading.destroy();}
}

test('batch template download is a prescribed editable Excel workbook',async({page},testInfo)=>{
  await page.goto('/');await page.getByRole('button',{name:'Excel batch',exact:true}).click();
  await expect(page.getByRole('button',{name:/\(\.xlsx\)$/})).toHaveCount(1);
  await expect(page).toHaveTitle('AssessmentDesk — Iganmu');
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'Note to Assessment (.xlsx)',exact:true}).click();
  const download=await event;expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toBe('iganmu-note-batch-template.xlsx');
  const path=testInfo.outputPath('note-template.xlsx');await download.saveAs(path);
  const files=unzipSync(new Uint8Array(await readFile(path)));
  expect(strFromU8(files['xl/worksheets/sheet1.xml']!)).toContain('IGANMU_BATCH|1|note');
  const documents=strFromU8(files['xl/worksheets/sheet2.xml']!);
  for(const column of batchColumns.note)expect(documents).toContain(column.label);
  await expect(page.getByText(/Excel batches are for Notes to Assessment only/)).toBeVisible();
});

test('valid Note to Assessment batch exports all rows in order as combined A4 PDF and individual PDFs in ZIP',async({page},testInfo)=>{
  const first=exampleProject('note');const second=exampleProject('note');
  if(first.template!=='note'||second.template!=='note')throw new Error();
  Object.assign(first.data,{name:'FIRST SAMPLE',payerId:'000007',gross:['001.10','NIL',''],taxPayable:['999.99','0',''],preparedBy:'FIRST PREPARER'});
  Object.assign(second.data,{name:'SECOND SAMPLE',payerId:'000008',gross:['002.20','0',''],taxPayable:['88.10','NIL',''],preparedBy:'SECOND PREPARER'});
  const workbook=createBatchWorkbook('note',[rowFrom(first),rowFrom(second)]);
  await page.goto('/');await page.getByRole('button',{name:'Excel batch',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'batch.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(workbook)});
  await page.getByRole('button',{name:'Validate and prepare batch',exact:true}).click();
  await expect(page.getByText('2 documents passed validation',{exact:false})).toBeVisible({timeout:30000});
  await expect(page.getByRole('button',{name:'Download combined PDF (2 pages)',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Download individual PDFs (ZIP)',exact:true})).toBeEnabled();
  const pdfEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download combined PDF (2 pages)',exact:true}).click();
  const pdfDownload=await pdfEvent;expect(await pdfDownload.failure()).toBeNull();
  const pdfPath=testInfo.outputPath('note-batch.pdf');await pdfDownload.saveAs(pdfPath);
  const bytes=await readFile(pdfPath);const pdf=await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(2);
  for(const current of pdf.getPages()){expect(current.getWidth()).toBeCloseTo(595.28,1);expect(current.getHeight()).toBeCloseTo(841.89,1);}
  const firstPage=await pageText(bytes,1);const secondPage=await pageText(bytes,2);
  expect(firstPage).toContain('FIRST SAMPLE');for(const value of ['001.10','NIL','999.99','FIRST PREPARER'])expect(firstPage).toContain(value);
  expect(secondPage).toContain('SECOND SAMPLE');for(const value of ['002.20','88.10','SECOND PREPARER'])expect(secondPage).toContain(value);
  const zipEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download individual PDFs (ZIP)',exact:true}).click();
  const zipDownload=await zipEvent;expect(await zipDownload.failure()).toBeNull();
  expect(zipDownload.suggestedFilename()).toBe('iganmu-note-individual-pdfs.zip');
  const zipPath=testInfo.outputPath('note-individual-pdfs.zip');await zipDownload.saveAs(zipPath);
  const archive=unzipSync(new Uint8Array(await readFile(zipPath)));
  expect(Object.keys(archive).sort()).toEqual(['iganmu-note-row-0002.pdf','iganmu-note-row-0003.pdf']);
  for(const file of Object.values(archive))expect((await PDFDocument.load(file)).getPageCount()).toBe(1);
});

test('one invalid row identifies its Excel row and blocks both complete-batch exports',async({page})=>{
  const first=exampleProject('note');const second=exampleProject('note');
  if(first.template!=='note'||second.template!=='note')throw new Error();
  second.data.name='';
  const workbook=createBatchWorkbook('note',[rowFrom(first),rowFrom(second)]);
  await page.goto('/');await page.getByRole('button',{name:'Excel batch',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'partial.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(workbook)});
  await page.getByRole('button',{name:'Validate and prepare batch',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('1 of 2 rows need correction',{timeout:30000});
  await expect(page.getByText('Excel row 3',{exact:false})).toBeVisible();
  await expect(page.getByText('Taxpayer name is required.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Download combined PDF (2 pages)',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Download individual PDFs (ZIP)',exact:true})).toBeDisabled();
});

test('legacy letter workbooks cannot enable exports after a valid note batch',async({page})=>{
  const workbook=createBatchWorkbook('note',[rowFrom(exampleProject('note'))]);
  await page.goto('/');await page.getByRole('button',{name:'Excel batch',exact:true}).click();
  const upload=async(bytes:Uint8Array)=>{
    await page.locator('input[type=file]').setInputFiles({name:'batch.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(bytes)});
    await page.getByRole('button',{name:'Validate and prepare batch',exact:true}).click();
  };
  await upload(workbook);
  await expect(page.getByRole('button',{name:'Download combined PDF (1 pages)',exact:true})).toBeEnabled();
  for(const template of ['letter','demand','assessment']){
    const files=unzipSync(workbook);
    files['xl/worksheets/sheet1.xml']=strToU8(strFromU8(files['xl/worksheets/sheet1.xml']!).replace('IGANMU_BATCH|1|note',`IGANMU_BATCH|1|${template}`));
    await upload(zipSync(files));
    await expect(page.getByRole('alert')).toContainText('Excel batches support Note to Assessment only.');
    await expect(page.getByRole('button',{name:/Download combined PDF|Download individual PDFs/})).toHaveCount(0);
  }
});
