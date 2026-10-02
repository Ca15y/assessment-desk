import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {downloadName,exampleProject,tableRows,type Project} from '../src/domain';

const pdfButton=(page:Page)=>page.getByRole('button',{name:'Download PDF',exact:true});
async function save(page:Page,testInfo:TestInfo,name:string) {
  const event=page.waitForEvent('download');
  await page.getByRole('button',{name:'Save project',exact:true}).click();
  const download=await event;
  expect(await download.failure()).toBeNull();
  const path=testInfo.outputPath(name);
  await download.saveAs(path);
  return {path,project:JSON.parse(await readFile(path,'utf8')),filename:download.suggestedFilename()};
}
async function open(page:Page,path:string) {
  const event=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'Open project',exact:true}).click();
  await (await event).setFiles(path);
}
async function verifyPdf(page:Page,testInfo:TestInfo,project:Project) {
  await expect(pdfButton(page)).toBeEnabled({timeout:30000});
  const event=page.waitForEvent('download');await pdfButton(page).click();
  const download=await event;expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toBe(downloadName(project,'pdf'));
  const path=testInfo.outputPath(`${project.template}-reopened.pdf`);
  await download.saveAs(path);
  const bytes=await readFile(path);const pdf=await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28,1);
  expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89,1);
  const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:true});
  const document=await loading.promise;
  try {
    const content=await (await document.getPage(1)).getTextContent();
    const text=content.items.flatMap(item=>'str' in item?[item.str]:[]).join(' ');
    expect(text).toContain(project.data.payerId);
    if(project.template==='letter') {
      expect(text).toContain(project.data.assessedTax);
      expect(text).toContain(project.data.developmentLevy);
      expect(text).toContain(project.data.signatory);
    } else if(project.template==='note') {
      for(const row of tableRows)for(const amount of project.data[row.key])if(amount)expect(text).toContain(amount);
      expect(text).toContain(project.data.preparedBy);
      expect(text).toContain(project.data.approvedBy);
    } else if(project.template==='assessment') {
      expect(text.match(new RegExp(project.data.taxLiability.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))).toHaveLength(2);
      expect(text).toContain(project.data.agencyCode);expect(text).toContain(project.data.assessmentCode);
      expect(text).toContain(project.data.managerName);expect(text).toContain('STATION MANAGER');
    }
  } finally {await loading.destroy();}
}

test('Assessment Notice: manual amount, editable codes and manager survive save, reopen and PDF download',async({page,context},testInfo)=>{
  const errors:string[]=[];const unexpectedRequests:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  context.on('request',r=>{const url=new URL(r.url());if(['http:','https:'].includes(url.protocol)&&(url.origin!=='http://127.0.0.1:5173'||r.method()!=='GET'))unexpectedRequests.push(r.url());});
  await page.goto('/');await page.getByRole('button',{name:'Assessment Notice Preprinted letterhead',exact:true}).click();
  await expect(pdfButton(page)).toBeEnabled({timeout:30000});
  const expected=exampleProject('assessment');if(expected.template!=='assessment')throw new Error();
  Object.assign(expected.data,{payerId:'000007',taxLiability:'987,654.32',agencyCode:'000042',assessmentCode:'32102 / 0401',managerName:'SAMPLE NEW MANAGER'});
  await page.getByRole('textbox',{name:'Payer ID',exact:true}).fill(expected.data.payerId);
  await page.getByRole('textbox',{name:'Tax liability (NGN)',exact:false}).fill(expected.data.taxLiability);
  await page.getByRole('textbox',{name:'Iganmu agency code',exact:false}).fill(expected.data.agencyCode);
  await page.getByRole('textbox',{name:'Direct assessment revenue code',exact:false}).fill(expected.data.assessmentCode);
  await page.getByRole('textbox',{name:'Station manager name',exact:false}).fill(expected.data.managerName);
  const saved=await save(page,testInfo,'assessment-saved.json');
  expect(saved.filename).toBe(downloadName(expected,'json'));expect(saved.project).toEqual(expected);
  await page.close();const reopened=await context.newPage();reopened.on('pageerror',e=>errors.push(e.message));await reopened.goto('/');
  await open(reopened,saved.path);
  for(const [name,value] of [['Payer ID',expected.data.payerId],['Tax liability (NGN)',expected.data.taxLiability],['Iganmu agency code',expected.data.agencyCode],['Direct assessment revenue code',expected.data.assessmentCode],['Station manager name',expected.data.managerName]]) {
    await expect(reopened.getByRole('textbox',{name,exact:false})).toHaveValue(value);
  }
  const resaved=await save(reopened,testInfo,'assessment-resaved.json');expect(resaved.project).toEqual(expected);
  await verifyPdf(reopened,testInfo,expected);
  await reopened.getByRole('button',{name:'Clear form',exact:true}).click();
  await expect(reopened.getByRole('textbox',{name:'Tax liability (NGN)',exact:false})).toHaveValue('');
  await expect(reopened.getByRole('textbox',{name:'Iganmu agency code',exact:false})).toHaveValue('4250196 / 13054');
  await expect(reopened.getByRole('textbox',{name:'Direct assessment revenue code',exact:false})).toHaveValue('4010002 / 32102');
  await expect(reopened.getByRole('textbox',{name:'Station manager name',exact:false})).toHaveValue('');
  await reopened.setViewportSize({width:390,height:844});
  await reopened.getByRole('button',{name:'Load example',exact:true}).click();
  await reopened.getByRole('button',{name:'View PDF',exact:true}).click();
  await expect(pdfButton(reopened)).toBeEnabled({timeout:30000});
  await expect(reopened.getByRole('img',{name:'First page of the generated A4 PDF'})).toHaveAttribute('aria-busy','false',{timeout:30000});
  expect(await reopened.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);expect(unexpectedRequests).toEqual([]);
});

for(const template of ['letter','note'] as const) {
  test(`${template}: downloaded project reopens in a fresh page with every value preserved`,async({page,context},testInfo)=>{
    const errors:string[]=[];const unexpectedRequests:string[]=[];
    context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
    page.on('pageerror',e=>errors.push(e.message));
    context.on('request',r=>{
      if(!['http:','https:'].includes(new URL(r.url()).protocol))return;
      if(new URL(r.url()).origin!=='http://127.0.0.1:5173'||r.method()!=='GET')unexpectedRequests.push(`${r.method()} ${r.url()}`);
    });
    await page.goto('/');
    if(template==='note')await page.getByRole('button',{name:'Note to Assessment Plain A4 paper'}).click();
    await expect(pdfButton(page)).toBeEnabled({timeout:30000});
    const expected=exampleProject(template);expected.data.payerId='000007';
    await page.getByRole('textbox',{name:'Payer ID',exact:true}).fill(expected.data.payerId);
    if(expected.template==='letter') {
      expected.data.assessedTax='000,777.77';expected.data.developmentLevy='0';
      await page.getByRole('textbox',{name:'Assessed tax (NGN)',exact:true}).fill(expected.data.assessedTax);
      await page.getByRole('textbox',{name:'Development levy (NGN)',exact:true}).fill(expected.data.developmentLevy);
    } else if(expected.template==='note') {
      expected.data.declared=['100.00','','NIL'];expected.data.additional=['200.00','0',''];
      expected.data.gross=['777.77','NIL','0'];expected.data.taxDue=['99','88','77'];
      expected.data.taxPaid=['101','0',''];expected.data.taxPayable=['123.45','NIL','987,654.32'];
      for(const row of tableRows)for(let i=0;i<3;i++)await page.getByRole('textbox',{name:`${row.label} ${expected.data.years[i]}`,exact:true}).fill(expected.data[row.key][i]);
    }
    await page.getByText('Print spacing',{exact:true}).click();
    expected.print.sideMm+=0.5;
    await page.getByRole('spinbutton',{name:'Side margins (mm)',exact:true}).fill(String(expected.print.sideMm));
    await expect(pdfButton(page)).toBeDisabled();
    const saved=await save(page,testInfo,`${template}-saved.json`);
    expect(saved.filename).toBe(downloadName(expected,'json'));expect(saved.project).toEqual(expected);
    expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
    await page.close();
    const reopened=await context.newPage();await reopened.goto('/');
    await expect(reopened.getByRole('textbox',{name:'Payer ID',exact:true})).toHaveValue('SAMPLE-0001');
    await open(reopened,saved.path);
    await expect(reopened.getByRole('textbox',{name:'Payer ID',exact:true})).toHaveValue('000007');
    const resaved=await save(reopened,testInfo,`${template}-resaved.json`);expect(resaved.project).toEqual(expected);
    await verifyPdf(reopened,testInfo,expected);
    expect(errors).toEqual([]);expect(unexpectedRequests).toEqual([]);
  });

  test(`${template}: overflowing content blocks download and recovers after correction`,async({page})=>{
    await page.goto('/');
    if(template==='note')await page.getByRole('button',{name:'Note to Assessment Plain A4 paper'}).click();
    await expect(pdfButton(page)).toBeEnabled({timeout:30000});
    if(template==='letter')for(const name of ['Taxpayer name','Company or business','Address line 1','Address line 2','Signatory name'])await page.getByRole('textbox',{name,exact:true}).fill('Long fictional sample content '.repeat(10));
    else await page.getByRole('textbox',{name:'Brief',exact:true}).fill('Long fictional narrative to test overflow. '.repeat(140));
    await expect(pdfButton(page)).toBeDisabled();
    await page.getByRole('button',{name:'Update preview',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('PDF download is blocked',{timeout:30000});
    await expect(pdfButton(page)).toBeDisabled();
    page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Load example',exact:true}).click();
    await expect(pdfButton(page)).toBeEnabled({timeout:30000});
  });
}

test('invalid and untrusted imports preserve current work; text is never executed',async({page},testInfo)=>{
  await page.goto('/');await expect(pdfButton(page)).toBeEnabled({timeout:30000});
  await page.getByRole('textbox',{name:'Payer ID',exact:true}).fill('SAMPLE-KEEP-000');
  const original=await save(page,testInfo,'before-invalid.json');
  const example=exampleProject('letter');
  for(const raw of ['not json',JSON.stringify({...example,version:99}),JSON.stringify({...example,html:'<script>alert(1)</script>'}),JSON.stringify({...example,print:{...example.print,topMm:0}}),'x'.repeat(1_000_001)]) {
    await page.locator('input[type=file]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(raw)});
    await expect(page.getByRole('alert')).toBeVisible();
    expect((await save(page,testInfo,'after-invalid.json')).project).toEqual(original.project);
  }
  const literal='<img src="https://example.invalid/pixel" onerror="alert(1)">';
  example.data.company=literal;
  const dialogs:string[]=[];page.on('dialog',dialog=>{dialogs.push(dialog.message());void dialog.dismiss();});
  await page.locator('input[type=file]').setInputFiles({name:'literal.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(example))});
  await expect(page.getByRole('textbox',{name:'Company or business',exact:true})).toHaveValue(literal);
  await expect(pdfButton(page)).toBeEnabled({timeout:30000});
  expect((await save(page,testInfo,'literal-saved.json')).project).toEqual(example);
  expect(await page.locator('img[src="https://example.invalid/pixel"]').count()).toBe(0);expect(dialogs).toEqual([]);
});

test('cancelled project replacement and invalid required fields cannot discard work or export stale PDFs',async({page},testInfo)=>{
  await page.goto('/');await expect(pdfButton(page)).toBeEnabled({timeout:30000});
  const original=await save(page,testInfo,'original.json');
  await page.getByRole('textbox',{name:'Taxpayer name',exact:true}).fill('SAMPLE UNSAVED');
  const dismissed=new Promise<void>(resolve=>page.once('dialog',async dialog=>{await dialog.dismiss();resolve();}));
  await open(page,original.path);await dismissed;
  await expect(page.getByRole('textbox',{name:'Taxpayer name',exact:true})).toHaveValue('SAMPLE UNSAVED');
  await expect(pdfButton(page)).toBeDisabled();
  page.once('dialog',dialog=>dialog.accept());await open(page,original.path);
  await expect(page.getByRole('textbox',{name:'Taxpayer name',exact:true})).toHaveValue('SAMPLE TAXPAYER');
  await expect(pdfButton(page)).toBeEnabled({timeout:30000});
  await page.getByRole('textbox',{name:'Iganmu agency code',exact:false}).fill('');
  await page.getByRole('button',{name:'Update preview',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Agency code is required.');await expect(pdfButton(page)).toBeDisabled();
});
