import { useRef,useState } from 'react';
import type { ChangeEvent } from 'react';
import { batchMimeType,batchPdfName,batchTemplateName,batchZipName,createBatchWorkbook,createBatchZip,createCombinedBatchPdf,parseBatchWorkbook,prepareBatch } from './batch';
import type { PreparedBatch } from './batch';
function saveBlob(blob:Blob,name:string) {
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function blobBytes(bytes:Uint8Array) {
  const copy=new Uint8Array(bytes.byteLength);copy.set(bytes);return copy.buffer;
}
function downloadWorkbook() {
  const template='note';
  const bytes=createBatchWorkbook(template);saveBlob(new Blob([blobBytes(bytes)],{type:batchMimeType()}),batchTemplateName(template));
}
export default function BatchWorkspace() {
  const picker=useRef<HTMLInputElement>(null);
  const [file,setFile]=useState<File|null>(null);
  const [prepared,setPrepared]=useState<PreparedBatch|null>(null);
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState('');
  const [error,setError]=useState('');
  async function prepare() {
    if(!file)return;
    setBusy(true);setError('');setPrepared(null);setProgress('Opening the workbook…');
    try{
      const parsed=parseBatchWorkbook(new Uint8Array(await file.arrayBuffer()));
      const result=await prepareBatch(parsed,(done,total,row)=>setProgress(`Checking spreadsheet row ${row} (${done} of ${total})…`));
      setPrepared(result);
      if(result.ready)setProgress(`${result.rows.length} documents passed validation and rendered as one portrait A4 page each.`);
      else setProgress('Review the spreadsheet row errors below, correct the workbook, then upload it again. Neither export is available for an incomplete batch.');
    }catch(reason){setError(reason instanceof Error?reason.message:'This workbook could not be checked.');setProgress('');}
    finally{setBusy(false);}
  }
  async function downloadCombined() {
    if(!prepared?.ready)return;
    setBusy(true);setError('');
    try{const bytes=await createCombinedBatchPdf(prepared);saveBlob(new Blob([blobBytes(bytes)],{type:'application/pdf'}),batchPdfName(prepared.template));}
    catch(reason){setError(reason instanceof Error?reason.message:'The full batch PDF could not be assembled. No partial PDF was downloaded.');}
    finally{setBusy(false);}
  }
  function downloadZip() {
    if(!prepared?.ready)return;
    setError('');
    try{const bytes=createBatchZip(prepared);saveBlob(new Blob([blobBytes(bytes)],{type:'application/zip'}),batchZipName(prepared.template));}
    catch(reason){setError(reason instanceof Error?reason.message:'The complete batch ZIP could not be created. No partial ZIP was downloaded.');}
  }
  function chooseFile(event:ChangeEvent<HTMLInputElement>) {
    const next=event.target.files?.[0]??null;setFile(next);setPrepared(null);setError('');setProgress('');
  }
  return <section className="batch-workspace" aria-label="Excel batch generation">
    <div className="batch-intro">
      <p className="eyebrow">LOCAL EXCEL BATCH</p>
      <h2>Prepare Notes to Assessment</h2>
      <p>Download the Note to Assessment workbook, enter one note per row, then upload it here. The workbook is processed in this browser only.</p>
    </div>
    <section className="batch-step" aria-labelledby="batch-template-heading">
      <div className="batch-step-heading"><span>1</span><div><h3 id="batch-template-heading">Download a prescribed Excel workbook</h3><p>Excel batches are for Notes to Assessment only. Keep the column headings unchanged.</p></div></div>
      <div className="batch-templates"><button className="button secondary" onClick={downloadWorkbook}>Note to Assessment (.xlsx)</button></div>
      <ul className="batch-guidance">
        <li>Each non-empty row is one document. Leave unused rows completely blank.</li>
        <li>Text-formatted amounts keep punctuation, leading zeros, blank, NIL and zero as entered.</li>
        <li>All note figures stay manually entered, including gross income, tax and totals. Do not add formulas.</li>
        <li>Use Single document to prepare Best of Judgement letters, Demand Notices and Assessment Notices.</li>
      </ul>
    </section>
    <section className="batch-step" aria-labelledby="batch-upload-heading">
      <div className="batch-step-heading"><span>2</span><div><h3 id="batch-upload-heading">Upload and check every row</h3><p>Both exports stay blocked unless every document is valid and renders as one portrait A4 page.</p></div></div>
      <input ref={picker} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={chooseFile}/>
      <div className="batch-upload"><button className="button secondary" onClick={()=>picker.current?.click()}>Choose Excel workbook</button><span>{file?.name??'No workbook selected'}</span></div>
      <div className="batch-actions"><button className="button primary" disabled={!file||busy} onClick={()=>void prepare()}>{busy?'Checking batch…':'Validate and prepare batch'}</button>{progress&&<p role="status" aria-live="polite">{progress}</p>}</div>
      {error&&<div className="error batch-global-error" role="alert">{error}</div>}
      {prepared&&<>
        {prepared.ready&&<div className="success" role="status">All {prepared.rows.length} rows passed. Both complete-batch exports are ready.</div>}
        {!prepared.ready&&<div className="error batch-row-errors" role="alert"><strong>{prepared.rows.filter(row=>row.errors.length).length} of {prepared.rows.length} rows need correction. No documents were omitted; neither export is available.</strong></div>}
        <ol className="batch-results" aria-label="Spreadsheet row results">{prepared.rows.map(row=><li key={row.excelRow} className={row.errors.length?'batch-result invalid':'batch-result valid'}><strong>Excel row {row.excelRow}</strong>{row.errors.length?<ul>{row.errors.map((message,i)=><li key={`${i}-${message}`}>{message}</li>)}</ul>:<span>Ready — exactly one portrait A4 page</span>}</li>)}</ol>
        <div className="batch-downloads"><button className="button primary" disabled={!prepared.ready||busy} onClick={()=>void downloadCombined()}>Download combined PDF ({prepared.rows.length} pages)</button><button className="button secondary" disabled={!prepared.ready||busy} onClick={downloadZip}>Download individual PDFs (ZIP)</button></div>
      </>}
    </section>
    <aside className="batch-reminder"><strong>All or nothing:</strong> one missing/invalid row, failed render, overflow, or non-A4 page blocks both export buttons. Correct the workbook and validate it again; the app never exports only the valid subset.</aside>
  </section>;
}
