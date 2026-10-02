import { z } from 'zod';
import {DEMAND_CALCULATION_VERSION,principalKobo} from './demand';

const text = z.string().max(6000);
const short = z.string().max(300);
const triple = z.tuple([short, short, short]);
export const letterSchema = z.object({
  reference: short, date: short, name: short, company: short,
  address1: short, address2: short, payerId: short, year: short,
  assessedTax: short, developmentLevy: short, agencyCode: short,
  assessmentCode: short, levyCode: short, signatory: short, signatoryTitle: short,
}).strict();
export const noteSchema = z.object({
  name: short, payerId: short, age: short, company: short, employerAddress: short,
  designation: short, business: short, address: short, otherIncome: short,
  brief: text, companyDetails: text, averageRemittance: short, conclusion: text,
  assessmentType: short, years: triple, declared: triple, additional: triple,
  gross: triple, taxDue: triple, taxPaid: triple, taxPayable: triple,
  preparedBy: short, approvedBy: short,
}).strict();
export const demandSchema=z.object({
  reference:short,date:short,name:short,company:short,address1:short,address2:short,
  payerId:short,incomeYears:short,assessmentDates:short,principal:short,
  agencyCode:short,assessmentCode:short,levyCode:short,managerName:short,
}).strict();
export const assessmentNoticeSchema=z.object({
  reference:short,date:short,name:short,address1:short,address2:short,
  payerId:short,year:short,taxLiability:short,agencyCode:short,assessmentCode:short,managerName:short,
}).strict();
export const printSchema = z.object({
  topMm: z.number().min(10).max(80), bottomMm: z.number().min(10).max(40),
  sideMm: z.number().min(10).max(30),
}).strict();
const common = {format:z.literal('iganmu-document-project'), version:z.literal(1), templateVersion:z.literal(1), print:printSchema};
export const projectSchema = z.discriminatedUnion('template', [
  z.object({...common,template:z.literal('letter'),data:letterSchema}).strict(),
  z.object({...common,template:z.literal('note'),data:noteSchema}).strict(),
  z.object({...common,template:z.literal('demand'),calculationVersion:z.literal(DEMAND_CALCULATION_VERSION),data:demandSchema}).strict(),
  z.object({...common,template:z.literal('assessment'),data:assessmentNoticeSchema}).strict(),
]);
export type LetterData = z.infer<typeof letterSchema>;
export type NoteData = z.infer<typeof noteSchema>;
export type DemandData = z.infer<typeof demandSchema>;
export type AssessmentNoticeData = z.infer<typeof assessmentNoticeSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Template = Project['template'];
export type PrintSettings = z.infer<typeof printSchema>;
export type TableKey = 'declared'|'additional'|'gross'|'taxDue'|'taxPaid'|'taxPayable';
export const stationCodeDefaults={agencyCode:'13054',assessmentCode:'4010002 / 32102',levyCode:'4010014 / 32114'} as const;
export const assessmentNoticeCodeDefaults={agencyCode:'4250196 / 13054',assessmentCode:'4010002 / 32102'} as const;
export const tableRows: {key:TableKey;label:string}[] = [
  {key:'declared',label:'Income declared on Form A'},
  {key:'additional',label:'Applied income from other sources / benefits of office'},
  {key:'gross',label:'Proposed gross income'},
  {key:'taxDue',label:'Tax due'},
  {key:'taxPaid',label:'Tax paid on account'},
  {key:'taxPayable',label:'Tax payable'},
];
export function blankProject(template:Template): Project {
  const base = {format:'iganmu-document-project' as const,version:1 as const,templateVersion:1 as const};
  if(template==='letter') return {...base,template,print:{topMm:48,bottomMm:24,sideMm:14},data:{...Object.fromEntries(Object.keys(letterSchema.shape).map(k=>[k,''])),...stationCodeDefaults} as LetterData};
  if(template==='demand')return {...base,template,calculationVersion:DEMAND_CALCULATION_VERSION,print:{topMm:48,bottomMm:24,sideMm:14},data:{...Object.fromEntries(Object.keys(demandSchema.shape).map(k=>[k,''])),...stationCodeDefaults} as DemandData};
  if(template==='assessment')return {...base,template,print:{topMm:48,bottomMm:24,sideMm:14},data:{...Object.fromEntries(Object.keys(assessmentNoticeSchema.shape).map(k=>[k,''])),...assessmentNoticeCodeDefaults} as AssessmentNoticeData};
  const data = Object.fromEntries(Object.keys(noteSchema.shape).map(k=>[k,(['years',...tableRows.map(r=>r.key)] as string[]).includes(k)?['','','']: ''])) as NoteData;
  return {...base,template,print:{topMm:14,bottomMm:14,sideMm:16},data};
}
export function exampleProject(template:Template):Project {
  const project=blankProject(template);
  if(project.template==='letter') project.data={
    reference:'SAMPLE/IGANMU/BOJ/001',date:'2026-09-28',name:'SAMPLE TAXPAYER',company:'SAMPLE BUSINESS',
    address1:'12 Example Street',address2:'Iganmu, Lagos.',payerId:'SAMPLE-0001',year:'2025',
    assessedTax:'250,000.00',developmentLevy:'100.00',...stationCodeDefaults,
    signatory:'SAMPLE SIGNATORY',signatoryTitle:'Director Personal Income Tax',
  };
  else if(project.template==='demand')project.data={
    reference:'SAMPLE/IGANMU/DEMAND/001',date:'2026-09-28',name:'SAMPLE TAXPAYER',company:'SAMPLE BUSINESS',
    address1:'12 Example Street',address2:'Iganmu, Lagos.',payerId:'SAMPLE-0001',incomeYears:'2024 and 2025',
    assessmentDates:'15 April 2026 and 20 May 2026',principal:'1,000.00',...stationCodeDefaults,
    managerName:'SAMPLE STATION MANAGER',
  };
  else if(project.template==='assessment')project.data={
    reference:'SAMPLE/IGANMU/ASSESSMENT/001',date:'2026-09-28',name:'SAMPLE TAXPAYER',
    address1:'12 Example Street',address2:'Iganmu, Lagos.',payerId:'SAMPLE-0001',year:'2025',taxLiability:'125,000.00',
    ...assessmentNoticeCodeDefaults,managerName:'SAMPLE STATION MANAGER',
  };
  else project.data={
    name:'SAMPLE TAXPAYER',payerId:'SAMPLE-0001',age:'35 YEARS OLD',company:'SAMPLE BUSINESS',
    employerAddress:'12 Example Street, Iganmu, Lagos',designation:'Business owner',business:'Retail',
    address:'12 Example Street, Iganmu, Lagos',otherIncome:'NIL',
    brief:'This fictional example is provided to test the document layout. The taxpayer operates a retail business in Iganmu.',
    companyDetails:'A small retail business.',averageRemittance:'NIL',
    conclusion:'The figures below have been entered manually for this sample. They are provided solely to check the printed layout.',
    assessmentType:'Direct assessment',years:['2023','2024','2025'],
    declared:['1,000,000.00','1,200,000.00','1,400,000.00'],additional:['NIL','NIL','NIL'],
    gross:['1,000,000.00','1,200,000.00','1,400,000.00'],taxDue:['50,000.00','60,000.00','70,000.00'],
    taxPaid:['0.00','0.00','0.00'],taxPayable:['50,000.00','60,000.00','70,000.00'],
    preparedBy:'SAMPLE PREPARER',approvedBy:'SAMPLE APPROVER',
  };
  return project;
}
export function parseProject(raw:string):Project {
  if(raw.length>1_000_000) throw new Error('This project is too large. Choose a project file smaller than 1 MB.');
  let value:unknown;
  try {value=JSON.parse(raw);} catch {throw new Error('This is not a readable project file. Choose a saved .json project.');}
  const result=projectSchema.safeParse(value);
  if(!result.success) throw new Error('This file does not match a supported Iganmu project version. Your current work has not changed.');
  return result.data;
}
export function serializeProject(project:Project):string {return JSON.stringify(projectSchema.parse(project),null,2);}
export function formattedDate(date:string):string {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const [year,month,day]=date.split('-').map(Number);
  const d=new Date(Date.UTC(year,month-1,day));
  return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'}).format(d);
}
export function validationErrors(project:Project):string[] {
  const errors:string[]=[];
  const required: [string,string][] = project.template==='assessment' ? [
    ['Reference',project.data.reference],['Letter date',project.data.date],['Taxpayer name',project.data.name],
    ['Address line 1',project.data.address1],['Payer ID',project.data.payerId],['Income year',project.data.year],
    ['Tax liability',project.data.taxLiability],['Agency code',project.data.agencyCode],
    ['Direct assessment revenue code',project.data.assessmentCode],['Station manager name',project.data.managerName],
  ] : project.template==='letter' ? [
    ['Reference',project.data.reference],['Letter date',project.data.date],['Taxpayer name',project.data.name],
    ['Address line 1',project.data.address1],['Payer ID',project.data.payerId],['Income year',project.data.year],
    ['Assessed tax',project.data.assessedTax],['Development levy',project.data.developmentLevy],
    ['Agency code',project.data.agencyCode],['Direct assessment revenue code',project.data.assessmentCode],
    ['Development levy revenue code',project.data.levyCode],['Signatory name',project.data.signatory],['Signatory title',project.data.signatoryTitle],
  ] : project.template==='demand'?[
    ['Reference',project.data.reference],['Letter date',project.data.date],['Taxpayer name',project.data.name],
    ['Address line 1',project.data.address1],['Payer ID',project.data.payerId],['Income years',project.data.incomeYears],
    ['Assessment notice dates',project.data.assessmentDates],['Outstanding principal',project.data.principal],
    ['Agency code',project.data.agencyCode],['Direct assessment revenue code',project.data.assessmentCode],
    ['Development levy revenue code',project.data.levyCode],['Station manager name',project.data.managerName],
  ]:[['Taxpayer name',project.data.name],['Payer ID',project.data.payerId],['Prepared by',project.data.preparedBy]];
  for(const [label,value] of required) if(!value.trim()) errors.push(`${label} is required.`);
  if(project.template!=='note') {
    if((project.template==='letter'||project.template==='assessment')&&project.data.year && !/^\d{4}$/.test(project.data.year)) errors.push('Income year must have four digits.');
    if(project.template==='demand'&&project.data.principal.trim()) {
      try {principalKobo(project.data.principal);}catch(error){errors.push((error as Error).message);}
    }
    if(project.data.date) {
      const d=new Date(project.data.date+'T00:00:00Z');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(project.data.date)||Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==project.data.date) errors.push('Enter a valid letter date.');
    }
  } else {
    if(project.data.years.some(y=>!/^\d{4}$/.test(y))) errors.push('Enter all three years using four digits.');
    if(new Set(project.data.years).size!==3) errors.push('Each year column must be different.');
  }
  return errors;
}
export function downloadName(project:Project,extension:string):string {
  return `iganmu-${project.template==='letter'?'boj-letter':project.template==='demand'?'demand-notice':project.template==='assessment'?'assessment-notice':'assessment-note'}.${extension}`;
}
