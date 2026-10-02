import {it,expect} from 'vitest';
import {writeFile,mkdir} from 'node:fs/promises';
import {exampleProject} from './domain';
import {generatePdf} from './pdf';
it('renders every example as exactly one A4 page',async()=>{
  for(const template of ['letter','note','demand','assessment'] as const){
    const result=await generatePdf(exampleProject(template));
    if(process.env.PDF_QA_DIR){await mkdir(process.env.PDF_QA_DIR,{recursive:true});await writeFile(`${process.env.PDF_QA_DIR}/${template}.pdf`,new Uint8Array(result.bytes));}
    expect(result.pages).toBe(1);
    expect(result.pageSize.width).toBeCloseTo(595.28,1);expect(result.pageSize.height).toBeCloseTo(841.89,1);
  }
},30000);
it('reports a demand notice overflowing with long fields, without reducing font size',async()=>{
  const p=exampleProject('demand');if(p.template!=='demand')throw new Error();
  p.data.name='Long sample name '.repeat(17);p.data.company='Long company name '.repeat(16);
  p.data.address1='Long address content '.repeat(14);p.data.address2='More address content '.repeat(14);
  p.data.assessmentDates='A long list of sample assessment dates '.repeat(7);
  p.data.incomeYears='2020, 2021, 2022, 2023 and 2024 '.repeat(9);
  p.data.managerName='Long sample manager name '.repeat(11);
  expect((await generatePdf(p)).pages).toBeGreaterThan(1);
},30000);
it('reports overflow instead of forcing long notes into a clipped page',async()=>{
  const p=exampleProject('note');if(p.template!=='note')throw new Error();
  p.data.brief='Long narrative for an overflow test. '.repeat(150);
  expect((await generatePdf(p)).pages).toBeGreaterThan(1);
},30000);
it('reports a letter overflowing after unusually long entered fields',async()=>{
  const p=exampleProject('letter');if(p.template!=='letter')throw new Error();
  p.data.name='Long sample name '.repeat(17);p.data.company='Long company name '.repeat(16);
  p.data.address1='Long address content '.repeat(14);p.data.address2='More address content '.repeat(14);
  p.data.signatory='Long signatory name '.repeat(14);
  expect((await generatePdf(p)).pages).toBeGreaterThan(1);
},30000);
it('blocks an Assessment Notice when entered fields overflow',async()=>{
  const p=exampleProject('assessment');if(p.template!=='assessment')throw new Error();
  p.data.name='Long sample name '.repeat(55);p.data.address1='Long address content '.repeat(45);
  p.data.managerName='Long sample manager name '.repeat(45);
  expect((await generatePdf(p)).pages).toBeGreaterThan(1);
},30000);
