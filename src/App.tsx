import {useEffect,useRef,useState} from 'react';
import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist';
import type {RenderTask} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {blankProject,downloadName,exampleProject,parseProject,projectSchema,serializeProject,tableRows,validationErrors} from './domain';
import type {NoteData,Project,Template} from './domain';
import {generatePdf} from './pdf';
import {calculateDemand} from './demand';
import BatchWorkspace from './BatchWorkspace';
GlobalWorkerOptions.workerSrc=workerUrl;

type FieldSpec={key:string;label:string;type?:string;wide?:boolean;multiline?:boolean;hint?:string};
const letterGroups:{title:string;fields:FieldSpec[]}[]=[
  {title:'Document details',fields:[{key:'reference',label:'Document reference',wide:true},{key:'date',label:'Letter date',type:'date'},{key:'year',label:'Income year'}]},
  {title:'Taxpayer',fields:[{key:'name',label:'Taxpayer name',wide:true},{key:'company',label:'Company or business',wide:true},{key:'payerId',label:'Payer ID',wide:true},{key:'address1',label:'Address line 1',wide:true},{key:'address2',label:'Address line 2',wide:true}]},
  {title:'Amounts',fields:[{key:'assessedTax',label:'Assessed tax (NGN)'},{key:'developmentLevy',label:'Development levy (NGN)'}]},
  {title:'Station and payment codes',fields:[{key:'agencyCode',label:'Iganmu agency code',wide:true},{key:'assessmentCode',label:'Direct assessment revenue code',wide:true},{key:'levyCode',label:'Development levy revenue code',wide:true}]},
  {title:'Signatory',fields:[{key:'signatory',label:'Signatory name',wide:true},{key:'signatoryTitle',label:'Signatory title',wide:true}]},
];
const noteGroups:{title:string;fields:FieldSpec[]}[]=[
  {title:'Taxpayer',fields:[{key:'name',label:'Taxpayer name',wide:true},{key:'payerId',label:'Payer ID'},{key:'age',label:'Age'},{key:'address',label:'Taxpayer address',wide:true}]},
  {title:'Business',fields:[{key:'company',label:'Company name',wide:true},{key:'employerAddress',label:'Employer address',wide:true},{key:'designation',label:'Designation'},{key:'business',label:'Nature of business'},{key:'otherIncome',label:'Other sources of income',wide:true}]},
  {title:'Assessment narrative',fields:[{key:'brief',label:'Brief',multiline:true,wide:true},{key:'companyDetails',label:'Company details',multiline:true,wide:true},{key:'averageRemittance',label:'Company average remittance',wide:true},{key:'conclusion',label:'Conclusion',multiline:true,wide:true},{key:'assessmentType',label:'Type of assessment',wide:true}]},
];
const demandGroups:{title:string;fields:FieldSpec[]}[]=[
  {title:'Document details',fields:[{key:'reference',label:'Document reference',wide:true},{key:'date',label:'Letter date' ,type:'date'},{key:'incomeYears',label:'Income years',wide:true,hint:'For example 2025, 2023–2025, or 2021, 2023 and 2025.'},{key:'assessmentDates',label:'Assessment notice dates',wide:true,hint:'Enter the issue date or dates as they should appear in the letter.'}]},
  letterGroups[1],
  {title:'Outstanding tax',fields:[{key:'principal',label:'Outstanding principal (NGN)',wide:true,hint:'Enter the outstanding tax after payments, excluding development levy. Use up to two decimal places.'}]},
  {title:'Station and payment codes',fields:letterGroups[3]!.fields.map(field=>({...field,hint:'Sample station value. Editable for this document.'}))},
  {title:'Station manager',fields:[{key:'managerName',label:'Station manager name',wide:true,hint:'Enter the current manager’s name. This name prints above STATION MANAGER.'}]},
];
const assessmentGroups:{title:string;fields:FieldSpec[]}[]=[
  {title:'Document details',fields:[{key:'reference',label:'Document reference',wide:true},{key:'date',label:'Letter date',type:'date'},{key:'year',label:'Income year'}]},
  {title:'Taxpayer',fields:[{key:'name',label:'Taxpayer name',wide:true},{key:'address1',label:'Address line 1',wide:true},{key:'address2',label:'Address line 2',wide:true},{key:'payerId',label:'Payer ID',wide:true}]},
  {title:'Assessed tax liability',fields:[{key:'taxLiability',label:'Tax liability (NGN)',wide:true,hint:'Enter the amount manually. It appears twice in the notice; no calculations are performed.'}]},
  {title:'Station and payment codes',fields:[{key:'agencyCode',label:'Iganmu agency code',wide:true,hint:'Sample value. Editable; Clear form restores it.'},{key:'assessmentCode',label:'Direct assessment revenue code',wide:true,hint:'Sample value. Editable; Clear form restores it.'}]},
  {title:'Station manager',fields:[{key:'managerName',label:'Station manager name',wide:true}]},
];
function DemandBreakdown({principal}:{principal:string}) {
  let amounts:ReturnType<typeof calculateDemand>;
  try {amounts=calculateDemand(principal);}catch{return <p className="field-help">Enter a valid outstanding principal to see the calculation.</p>;}
  return <div className="calculation" aria-label="Demand calculation" aria-live="polite">
    <dl>{([['Principal',amounts.principal],['Penalty (10%)',amounts.penalty],['Interest (21%)',amounts.interest],['Total payable',amounts.total]] as const).map(([label,value])=><div key={label}><dt>{label}</dt><dd><output aria-label={label}>₦{value}</output></dd></div>)}</dl>
    <p className="field-help">Penalty is 10% of principal. Interest is 21% of principal plus penalty, applied once. Each charge is rounded upward to the next kobo. Development levy is excluded.</p>
  </div>;
}
function saveBlob(blob:Blob,name:string) {
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function PdfCanvas({bytes}:{bytes:ArrayBuffer}) {
  const canvas=useRef<HTMLCanvasElement>(null);const [error,setError]=useState('');const [ready,setReady]=useState(false);
  useEffect(()=>{
    let disposed=false;let renderTask:RenderTask|undefined;
    const loading=getDocument({data:new Uint8Array(bytes.slice(0)),useSystemFonts:true});
    setError('');setReady(false);
    void (async()=>{
      const pdf=await loading.promise;const page=await pdf.getPage(1);if(disposed||!canvas.current)return;
      const viewport=page.getViewport({scale:1.6});canvas.current.width=viewport.width;canvas.current.height=viewport.height;
      renderTask=page.render({canvas:canvas.current,viewport});await renderTask.promise;if(!disposed)setReady(true);
    })().catch(()=>{if(!disposed)setError('The preview could not be displayed. Please generate it again.');});
    return ()=>{disposed=true;renderTask?.cancel();void loading.destroy();};
  },[bytes]);
  return error?<p role="alert">{error}</p>:<>{!ready&&<p className="preview-loading" role="status">Rendering preview…</p>}<canvas ref={canvas} aria-label="First page of the generated A4 PDF" aria-busy={!ready} role="img"/></>;
}
export default function App() {
  const [mode,setMode]=useState<'single'|'batch'>('single');
  const [template,setTemplate]=useState<Template>('letter');
  const [projects,setProjects]=useState<Record<Template,Project>>({letter:exampleProject('letter'),note:exampleProject('note'),demand:exampleProject('demand'),assessment:exampleProject('assessment')});
  const project=projects[template];const snapshot=JSON.stringify(project);
  const [generated,setGenerated]=useState<(Awaited<ReturnType<typeof generatePdf>>&{snapshot:string})|null>(null);
  const [busy,setBusy]=useState(false);const [errors,setErrors]=useState<string[]>([]);const [message,setMessage]=useState('');
  const [mobileTab,setMobileTab]=useState<'form'|'preview'>('form');
  const [dirtyByTemplate,setDirtyByTemplate]=useState<Record<Template,boolean>>({letter:false,note:false,demand:false,assessment:false});
  const dirty=Object.values(dirtyByTemplate).some(Boolean);const dirtyRef=useRef(false);dirtyRef.current=dirty;
  const input=useRef<HTMLInputElement>(null);const sequence=useRef(0);
  const current=generated?.snapshot===snapshot;
  const isA4=!!generated&&Math.abs(generated.pageSize.width-595.28)<0.1&&Math.abs(generated.pageSize.height-841.89)<0.1;
  const canDownload=!!generated&&current&&generated.pages===1&&isA4&&!busy;
  function replace(next:Project,edited=true) {setProjects(p=>({...p,[next.template]:next}));setDirtyByTemplate(p=>({...p,[next.template]:edited}));setErrors([]);setMessage('');}
  function update(key:string,value:string) {replace({...project,data:{...project.data,[key]:value}} as Project);}
  function updateTriple(key:string,index:number,value:string) {
    if(project.template!=='note')return;
    const list=[...project.data[key as keyof NoteData] as string[]];list[index]=value;
    replace({...project,data:{...project.data,[key]:list}} as Project);
  }
  async function preview(p=project) {
    const id=++sequence.current;setMessage('');setErrors([]);
    if(!projectSchema.safeParse(p).success) {setErrors(['Check the field lengths and print spacing values.']);setBusy(false);return;}
    const issues=validationErrors(p);if(issues.length){setErrors(issues);setBusy(false);return;}
    setBusy(true);
    try {
      const result=await generatePdf(p);if(id!==sequence.current)return;
      setGenerated({...result,snapshot:JSON.stringify(p)});
      if(result.pages!==1)setErrors([`This document needs ${result.pages} pages. Shorten the entered text or review the print spacing. PDF download is blocked until it fits one A4 page.`]);
      else if(Math.abs(result.pageSize.width-595.28)>=0.1||Math.abs(result.pageSize.height-841.89)>=0.1)setErrors(['This PDF is not portrait A4. PDF download is blocked.']);
    } catch {if(id===sequence.current)setErrors(['The PDF could not be generated. Check the entered text and try again.']);}
    finally {if(id===sequence.current)setBusy(false);}
  }
  useEffect(()=>{void preview(projects[template]);},[template]); // Render on template selection, not on each keystroke.
  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{if(dirtyRef.current){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[]);
  async function openProject(file:File|undefined) {
    if(!file)return;
    try {
      if(file.size>1_000_000)throw new Error('Choose a project file smaller than 1 MB.');
      const next=parseProject(await file.text());
      if(dirtyByTemplate[next.template]&&!window.confirm('Open this project and replace the existing work for this document type? Save that project first if you need to keep it.'))return;
      replace(next,false);setTemplate(next.template);setMessage(next.template==='demand'?'Project opened. Entered details are preserved; charges use the saved calculation rule.':'Project opened. All entered figures are preserved.');void preview(next);
    } catch(error){setErrors([error instanceof Error?error.message:'This project could not be opened.']);}
    finally {if(input.current)input.current.value='';}
  }
  function saveProject() {
    try {saveBlob(new Blob([serializeProject(project)],{type:'application/json'}),downloadName(project,'json'));setDirtyByTemplate(p=>({...p,[template]:false}));setMessage('Project downloaded. Keep this file to reopen your work.');}
    catch {setErrors(['Check the field lengths and print settings before saving.']);}
  }
  function reset(example:boolean) {
    if(dirtyByTemplate[template]&&!window.confirm('Replace this form? Save your project first if you need to keep it.'))return;
    const next=example?exampleProject(template):blankProject(template);replace(next,false);setGenerated(null);++sequence.current;setBusy(false);if(example)void preview(next);
  }
  function renderField(field:FieldSpec) {
    const value=(project.data as unknown as Record<string,string>)[field.key];
    return <label key={field.key} className={field.wide?'field wide':'field'}><span>{field.label}</span>
      {field.multiline?<textarea name={field.key} value={value} maxLength={6000} rows={4} onChange={e=>update(field.key,e.target.value)}/>:<input name={field.key} type={field.type||'text'} maxLength={300} value={value} onChange={e=>update(field.key,e.target.value)} autoComplete="off"/>}
      {field.hint&&<small>{field.hint}</small>}</label>;
  }
  return <div className="app">
    <header className="header"><div className="brand"><span className="brand-mark" aria-hidden="true">A</span><div><strong>AssessmentDesk</strong><span>Iganmu</span></div></div>
      {mode==='single'&&<div className="project-actions"><input ref={input} type="file" accept=".json,application/json" hidden onChange={e=>void openProject(e.target.files?.[0])}/><button className="button secondary" onClick={()=>input.current?.click()}>Open project</button><button className="button secondary" onClick={saveProject}>Save project</button></div>}
    </header>
    <main>
      <div className="workspace-heading"><div><p className="eyebrow">IGANMU TAX OFFICE</p><h1>Prepare a document</h1></div><p className="intro">Enter the details, check the page, then download your PDF.</p></div>
      <nav className="mode-tabs" aria-label="Preparation mode"><button aria-pressed={mode==='single'} onClick={()=>setMode('single')}>Single document</button><button aria-pressed={mode==='batch'} onClick={()=>setMode('batch')}>Excel batch</button></nav>
      {mode==='batch'?<BatchWorkspace/>:<>
      <nav className="template-tabs" aria-label="Document type">{([['letter','Best of Judgement letter','Preprinted letterhead'],['note','Note to Assessment','Plain A4 paper'],['demand','Demand Notice','Preprinted letterhead'],['assessment','Assessment Notice','Preprinted letterhead']] as const).map(([key,label,subtitle])=><button key={key} className={template===key?'template active':'template'} aria-pressed={template===key} onClick={()=>{setTemplate(key);setErrors([]);setMessage('');setMobileTab('form');}}><span>{label}</span><small>{subtitle}</small></button>)}</nav>
      <div className="notice"><span className="notice-label">Print-test prototype</span><span>{template==='demand'?'Enter outstanding principal; penalty, interest and total are calculated.':'All figures are entered manually.'} The example details are fictional.</span><button onClick={()=>reset(true)}>Load example</button></div>
      {message&&<div className="success" role="status">{message}</div>}
      {errors.length>0&&<div className="error" role="alert"><strong>Check before continuing</strong><ul>{errors.map(e=><li key={e}>{e}</li>)}</ul></div>}
      <div className="mobile-tabs"><button aria-pressed={mobileTab==='form'} onClick={()=>setMobileTab('form')}>Enter details</button><button aria-pressed={mobileTab==='preview'} onClick={()=>setMobileTab('preview')}>View PDF</button></div>
      <div className="workspace">
        <section className={'form-panel '+(mobileTab==='form'?'mobile-active':'')} aria-label="Document fields">
          <div className="panel-heading"><div><h2>Document details</h2><p>{template!=='note'?'The letter wording stays consistent.':'Enter the figures exactly as they should appear.'}</p></div><button className="text-button" onClick={()=>reset(false)}>Clear form</button></div>
          <form onSubmit={e=>{e.preventDefault();void preview();}}>
            {(template==='letter'?letterGroups:template==='demand'?demandGroups:template==='assessment'?assessmentGroups:noteGroups).map(group=><fieldset key={group.title}><legend>{group.title}</legend><div className="fields">{group.fields.map(renderField)}</div>{project.template==='demand'&&group.title==='Outstanding tax'&&<DemandBreakdown principal={project.data.principal}/>}</fieldset>)}
            {project.template==='note'&&<>
              <fieldset><legend>Yearly figures</legend><p className="field-help">Enter every amount, including gross income and tax payable. Unused cells stay blank; NIL and zero stay distinct.</p>
                <div className="year-inputs">{project.data.years.map((v,i)=><label className="field" key={i}><span>Year {i+1}</span><input aria-label={`Year ${i+1}`} value={v} maxLength={4} inputMode="numeric" onChange={e=>updateTriple('years',i,e.target.value)}/></label>)}</div>
                {tableRows.map(row=><div className="metric" key={row.key}><div className="metric-label">{row.label}</div><div className="year-inputs">{project.data[row.key].map((v,i)=><label key={i} className="field"><span className="sr-only">{row.label} {project.data.years[i]||`year ${i+1}`}</span><input value={v} aria-label={`${row.label} ${project.data.years[i]||`year ${i+1}`}`} maxLength={40} onChange={e=>updateTriple(row.key,i,e.target.value)}/></label>)}</div></div>)}
              </fieldset>
              <fieldset><legend>Prepared and approved by</legend><div className="fields">{[{key:'preparedBy',label:'Prepared by',wide:true},{key:'approvedBy',label:'Approved by',wide:true}].map(renderField)}</div><p className="field-help">The PDF leaves space for dates and signatures.</p></fieldset>
            </>}
            <details className="print-settings"><summary>Print spacing</summary><p className="field-help">Starting settings for your first print test. Check alignment on the station printer before using real documents.</p><div className="settings-grid">{([['topMm','Top space'],['bottomMm','Bottom space'],['sideMm','Side margins']] as const).map(([key,label])=><label className="field" key={key}><span>{label} (mm)</span><input type="number" min={10} max={key==='topMm'?80:key==='bottomMm'?40:30} step="0.5" value={project.print[key]} onChange={e=>replace({...project,print:{...project.print,[key]:Number(e.target.value)}})}/></label>)}</div><p className="field-help">Font: Helvetica, 9 pt. Text is never automatically shrunk.</p></details>
            <div className="form-bottom"><button className="button primary" type="submit" disabled={busy}>{busy?'Preparing PDF…':'Update preview'}</button><span>{dirtyByTemplate[template]?'Unsaved changes':'Save a project to keep your work'}</span></div>
          </form>
        </section>
        <section className={'preview-panel '+(mobileTab==='preview'?'mobile-active':'')} aria-label="Print preview">
          <div className="preview-heading"><div><h2>Print preview</h2><span>A4 · 210 × 297 mm</span></div><span className={'page-status '+(current&&generated?.pages!==1?'invalid':'')}>{busy?'Preparing…':!current?'Needs update':generated?.pages===1?'1 page':`${generated?.pages} pages`}</span></div>
          <div className="paper-area" aria-busy={busy}>
            {generated?<><div className={'paper '+(!current?'stale':'')}><PdfCanvas bytes={generated.bytes}/></div>{!current&&<div className="stale-note">Your details have changed. Update the preview before downloading.</div>}</>:<div className="empty-preview"><strong>Your A4 document appears here</strong><p>Complete the fields, then update the preview.</p></div>}
          </div>
          <div className="download-panel"><button className="button primary download" disabled={!canDownload} onClick={()=>{if(canDownload&&generated)saveBlob(generated.blob,downloadName(project,'pdf'));}}>Download PDF</button><p>{template!=='note'?'Use preprinted letterhead. The PDF prints the letter content only.':'Use plain A4 paper.'} Select <strong>Actual size / 100%</strong> when printing.</p></div>
        </section>
      </div>
      </>}
    </main>
    <footer>Work stays on this device until you download it. Close this tab when finished on a shared computer.</footer>
  </div>;
}
