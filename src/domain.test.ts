import {describe,it,expect} from 'vitest';
import {assessmentNoticeCodeDefaults,blankProject,exampleProject,parseProject,serializeProject,stationCodeDefaults,validationErrors} from './domain';
describe('manual document projects',()=>{
  it('preserves deliberately inconsistent manual figures without computing anything',()=>{
    const p=exampleProject('note');if(p.template!=='note')throw new Error();
    p.data.declared=['100.00','','NIL'];p.data.additional=['200.00','0',''];
    p.data.gross=['777.77','NIL','0'];p.data.taxDue=['99','88','77'];
    p.data.taxPaid=['101','0',''];p.data.taxPayable=['123.45','NIL',''];
    expect(parseProject(serializeProject(p))).toEqual(p);
  });
  it('preserves textual payer IDs and leading zeros',()=>{
    const p=exampleProject('letter');p.data.payerId='000007';
    expect(parseProject(serializeProject(p)).data.payerId).toBe('000007');
  });
  it('rejects wrong versions, executable additions and oversized imports',()=>{
    const p=exampleProject('letter');
    expect(()=>parseProject(JSON.stringify({...p,version:9}))).toThrow();
    expect(()=>parseProject(JSON.stringify({...p,html:'<script>alert(1)</script>'}))).toThrow();
    expect(()=>parseProject('x'.repeat(1_000_001))).toThrow();
    expect(()=>parseProject('not json')).toThrow();
  });
  it('uses the editable Iganmu sample codes without supplying references or signatories',()=>{
    const p=blankProject('letter');if(p.template!=='letter')throw new Error();
    expect(p.data.agencyCode).toBe(stationCodeDefaults.agencyCode);
    expect(p.data.assessmentCode).toBe(stationCodeDefaults.assessmentCode);
    expect(p.data.levyCode).toBe(stationCodeDefaults.levyCode);
    expect(p.data.signatory).toBe('');expect(p.data.reference).toBe('');
    expect(validationErrors(p)).toContain('Reference is required.');
    expect(validationErrors(p)).not.toContain('Agency code is required.');
  });
  it('restores editable station code defaults on a cleared Demand Notice',()=>{
    const p=blankProject('demand');if(p.template!=='demand')throw new Error();
    expect(p.data.agencyCode).toBe(stationCodeDefaults.agencyCode);
    expect(p.data.assessmentCode).toBe(stationCodeDefaults.assessmentCode);
    expect(p.data.levyCode).toBe(stationCodeDefaults.levyCode);
    expect(p.data.managerName).toBe('');expect(p.data.principal).toBe('');
  });
  it('keeps the Assessment Notice amount manual and restores its own editable code defaults',()=>{
    const p=exampleProject('assessment');if(p.template!=='assessment')throw new Error();
    p.data.taxLiability='999.91';p.data.agencyCode='000004';
    expect(parseProject(serializeProject(p))).toEqual(p);
    expect(p.data.taxLiability).toBe('999.91');
    const blank=blankProject('assessment');if(blank.template!=='assessment')throw new Error();
    expect(blank.data.agencyCode).toBe(assessmentNoticeCodeDefaults.agencyCode);
    expect(blank.data.assessmentCode).toBe(assessmentNoticeCodeDefaults.assessmentCode);
    expect(blank.data.taxLiability).toBe('');expect(blank.data.managerName).toBe('');
    expect(validationErrors(blank)).toContain('Tax liability is required.');
  });
  it('rejects impossible letter dates and duplicate note years',()=>{
    const p=exampleProject('letter');if(p.template!=='letter')throw new Error();p.data.date='2026-02-31';
    expect(validationErrors(p)).toContain('Enter a valid letter date.');
    const n=exampleProject('note');if(n.template!=='note')throw new Error();n.data.years=['2025','2025','2025'];
    expect(validationErrors(n)).toContain('Each year column must be different.');
  });
  it('round-trips demand inputs and manager with an immutable calculation version',()=>{
    const p=exampleProject('demand');if(p.template!=='demand')throw new Error();
    p.data.principal='000001.01';p.data.managerName='SAMPLE REPLACEMENT MANAGER';
    expect(parseProject(serializeProject(p))).toEqual(p);
    expect(()=>parseProject(JSON.stringify({...p,calculationVersion:2}))).toThrow();
    expect(()=>parseProject(JSON.stringify({...p,data:{...p.data,total:'0.01'}}))).toThrow();
    expect(()=>parseProject(JSON.stringify({...p,penaltyRate:1}))).toThrow();
    p.data.principal='1.001';expect(validationErrors(p).join(' ')).toContain('two decimal places');
    p.data.principal='1.01';p.data.date='2026-02-31';expect(validationErrors(p)).toContain('Enter a valid letter date.');
    p.data.managerName='';expect(validationErrors(p)).toContain('Station manager name is required.');
    const blank=blankProject('demand');if(blank.template!=='demand')throw new Error();
    expect(blank.data.managerName).toBe('');expect(blank.data.agencyCode).toBe(stationCodeDefaults.agencyCode);expect(blank.data.principal).toBe('');
  });
});
