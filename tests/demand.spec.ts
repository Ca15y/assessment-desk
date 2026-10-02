import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

const downloadButton=(page:Page)=>page.getByRole('button',{name:'Download PDF',exact:true});
async function chooseDemand(page:Page) {
  await page.goto('/');await page.getByRole('button',{name:'Demand Notice Preprinted letterhead',exact:true}).click();
  await expect(downloadButton(page)).toBeEnabled({timeout:30000});
}
async function saveProject(page:Page,testInfo:TestInfo,name:string) {
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();
  const file=await event;expect(await file.failure()).toBeNull();expect(file.suggestedFilename()).toBe('iganmu-demand-notice.json');
  const path=testInfo.outputPath(name);await file.saveAs(path);return {path,raw:await readFile(path,'utf8')};
}
test('demand charges, editable manager and saved rule survive a fresh page and PDF download',async({page,context},testInfo)=>{
  const errors:string[]=[];const unexpectedRequests:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  context.on('request',r=>{const url=new URL(r.url());if(['http:','https:'].includes(url.protocol)&&(url.origin!=='http://127.0.0.1:5173'||r.method()!=='GET'))unexpectedRequests.push(r.url());});
  await chooseDemand(page);
  await page.getByRole('textbox',{name:'Outstanding principal (NGN)',exact:false}).fill('000001.01');
  await page.getByRole('textbox',{name:'Station manager name',exact:false}).fill('SAMPLE NEW MANAGER');
  await expect(page.getByLabel('Penalty (10%)',{exact:true})).toHaveText('₦0.11');
  await expect(page.getByLabel('Interest (21%)',{exact:true})).toHaveText('₦0.24');
  await expect(page.getByLabel('Total payable',{exact:true})).toHaveText('₦1.36');
  await expect(downloadButton(page)).toBeDisabled();
  const saved=await saveProject(page,testInfo,'demand-saved.json');const expected=JSON.parse(saved.raw);
  expect(expected.calculationVersion).toBe(1);expect(expected.data.principal).toBe('000001.01');
  expect(expected.data.managerName).toBe('SAMPLE NEW MANAGER');expect(expected.data.total).toBeUndefined();
  await page.close();const reopened=await context.newPage();await reopened.goto('/');
  const chooser=reopened.waitForEvent('filechooser');await reopened.getByRole('button',{name:'Open project',exact:true}).click();await (await chooser).setFiles(saved.path);
  await expect(reopened.getByRole('textbox',{name:'Station manager name',exact:false})).toHaveValue('SAMPLE NEW MANAGER');
  await expect(reopened.getByRole('textbox',{name:'Outstanding principal (NGN)',exact:false})).toHaveValue('000001.01');
  await expect(reopened.getByLabel('Total payable',{exact:true})).toHaveText('₦1.36');
  expect(JSON.parse((await saveProject(reopened,testInfo,'demand-resaved.json')).raw)).toEqual(expected);
  await expect(downloadButton(reopened)).toBeEnabled({timeout:30000});
  const event=reopened.waitForEvent('download');await downloadButton(reopened).click();const file=await event;
  expect(await file.failure()).toBeNull();expect(file.suggestedFilename()).toBe('iganmu-demand-notice.pdf');
  const pdfPath=testInfo.outputPath('demand-browser.pdf');await file.saveAs(pdfPath);
  const bytes=await readFile(pdfPath);const pdf=await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(1);expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28,1);expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89,1);
  const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:true});
  try {
    const document=await loading.promise;const content=await (await document.getPage(1)).getTextContent();
    const text=content.items.flatMap(item=>'str' in item?[item.str]:[]).join(' ').replace(/\s+/g,' ');
    for(const expectedText of ['DEMAND NOTICE','0.11','0.24','SAMPLE NEW MANAGER','STATION MANAGER','IGANMU TAX STATION','Development Levy','Section 41(1)(2)(a&b)'])expect(text).toContain(expectedText);
    expect(text.match(/1\.36/g)).toHaveLength(2);expect(text.match(/1\.01/g)).toHaveLength(2);expect(text.match(/₦/g)).toHaveLength(6);
    expect(text).not.toContain('SAMPLE STATION MANAGER');
  }finally{await loading.destroy();}
  await expect(reopened.getByRole('img',{name:'First page of the generated A4 PDF'})).toHaveAttribute('aria-busy','false');
  await reopened.screenshot({path:testInfo.outputPath('demand-desktop.png'),fullPage:true});
  expect(await reopened.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
  expect(errors).toEqual([]);expect(unexpectedRequests).toEqual([]);
});
test('demand invalid amounts and manager edits block stale downloads; overflow blocks export',async({page})=>{
  await chooseDemand(page);
  const principal=page.getByRole('textbox',{name:'Outstanding principal (NGN)',exact:false});
  for(const invalid of ['','-1','1.001','12,34','NIL']) {
    await principal.fill(invalid);await page.getByRole('button',{name:'Update preview',exact:true}).click();
    await expect(page.getByRole('alert')).toBeVisible();await expect(downloadButton(page)).toBeDisabled();
  }
  await principal.fill('1.01');await page.getByRole('button',{name:'Update preview',exact:true}).click();await expect(downloadButton(page)).toBeEnabled({timeout:30000});
  await page.getByRole('textbox',{name:'Station manager name',exact:false}).fill('');
  await expect(downloadButton(page)).toBeDisabled();await page.getByRole('button',{name:'Update preview',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Station manager name is required.');
  await page.getByRole('textbox',{name:'Station manager name',exact:false}).fill('Long sample manager name '.repeat(11));
  for(const name of ['Taxpayer name','Company or business','Address line 1','Address line 2'])await page.getByRole('textbox',{name,exact:true}).fill('Long fictional sample content '.repeat(10));
  await page.getByRole('textbox',{name:'Income years',exact:false}).fill('2020, 2021, 2022, 2023 and 2024 '.repeat(9));
  await page.getByRole('button',{name:'Update preview',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('PDF download is blocked',{timeout:30000});await expect(downloadButton(page)).toBeDisabled();
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Load example',exact:true}).click();await expect(downloadButton(page)).toBeEnabled({timeout:30000});
});
test('demand imports reject unsupported rules and injected calculated values without changing current work',async({page},testInfo)=>{
  await chooseDemand(page);const saved=await saveProject(page,testInfo,'before.json');const original=JSON.parse(saved.raw);
  for(const project of [{...original,calculationVersion:2},{...original,penaltyRate:9},{...original,data:{...original.data,total:'1.00'}}]) {
    await page.locator('input[type=file]').setInputFiles({name:'tampered.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
    await expect(page.getByRole('alert')).toContainText('does not match');
    expect(JSON.parse((await saveProject(page,testInfo,'after.json')).raw)).toEqual(original);
  }
});
test('demand is usable on a phone with all three template choices',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.getByRole('button',{name:'Demand Notice Preprinted letterhead',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Outstanding principal (NGN)',exact:false})).toBeVisible();
  await page.getByRole('button',{name:'View PDF',exact:true}).click();
  await expect(downloadButton(page)).toBeEnabled({timeout:30000});
  await expect(page.getByRole('button',{name:'View PDF',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('img',{name:'First page of the generated A4 PDF'})).toHaveAttribute('aria-busy','false',{timeout:30000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('demand-mobile.png'),fullPage:true});
});
