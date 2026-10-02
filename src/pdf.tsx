import { Document,Page,Text,View,StyleSheet,pdf,Font } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import type { AssessmentNoticeData,DemandData,LetterData,NoteData,Project } from './domain';
import { formattedDate,tableRows } from './domain';
import {calculateDemand} from './demand';
import nairaFontUrl from './assets/NotoSans-Regular.ttf?url';

// Helvetica has no naira glyph. Only this symbol uses the bundled, OFL-licensed font.
Font.register({family:'Naira',src:typeof window==='undefined'?new URL('./assets/NotoSans-Regular.ttf',import.meta.url).pathname:nairaFontUrl});

const mm=(value:number)=>value*72/25.4;
const styles=StyleSheet.create({
  page:{fontFamily:'Helvetica',fontSize:9,lineHeight:1.15,color:'#000'},
  letterTop:{flexDirection:'row',justifyContent:'space-between',gap:12,marginBottom:5,fontFamily:'Helvetica-Bold'},
  address:{fontFamily:'Helvetica-Bold',marginBottom:4,lineHeight:1.2},
  heading:{fontFamily:'Helvetica-Bold',textDecoration:'underline',marginTop:5,marginBottom:5,lineHeight:1.2},
  para:{marginBottom:3},bold:{fontFamily:'Helvetica-Bold'},
  codes:{marginBottom:5},codeRow:{flexDirection:'row',gap:8,marginBottom:2},codeLabel:{width:85},
  signoff:{marginTop:3},signatory:{marginTop:9,fontFamily:'Helvetica-Bold',lineHeight:1.25},
  title:{fontFamily:'Helvetica-Bold',fontSize:12,textAlign:'center',marginBottom:14},
  identityRow:{flexDirection:'row',gap:8,marginBottom:4},identityLabel:{width:'35%',fontFamily:'Helvetica-Bold'},identityValue:{width:'65%'},
  section:{marginTop:9},sectionLabel:{fontFamily:'Helvetica-Bold',textDecoration:'underline',marginBottom:4},
  noteText:{lineHeight:1.35},table:{marginTop:11},
  row:{flexDirection:'row',borderBottomWidth:0.4,borderBottomColor:'#777',minHeight:23},
  cellLabel:{width:'40%',padding:5,fontFamily:'Helvetica-Bold'},cell:{width:'20%',padding:5,textAlign:'right'},
  yearRow:{fontFamily:'Helvetica-Bold',borderTopWidth:1,borderBottomWidth:1},totalRow:{borderBottomWidth:1.4,fontFamily:'Helvetica-Bold'},
  signatures:{marginTop:24,flexDirection:'row',justifyContent:'space-between',gap:24},signature:{width:'46%'},
  signatureLine:{marginTop:24,borderBottomWidth:0.5,marginBottom:4},small:{fontSize:8},
});
function Letter({d}:{d:LetterData}) {
  return <>
    <View style={styles.letterTop}><Text style={{maxWidth:'64%'}}>{d.reference}</Text><Text>{formattedDate(d.date)}.</Text></View>
    <View style={styles.address}><Text>{d.name}</Text>{d.company && <Text>{d.company}</Text>}<Text>{d.address1}</Text>{d.address2 && <Text>{d.address2}</Text>}</View>
    <Text style={styles.bold}>TAX PAYER ID: {d.payerId}</Text>
    <View style={styles.heading}><Text>FAILURE TO RENDER ANNUAL RETURNS</Text><Text>BEST OF JUDGEMENT (INCOME YEAR {d.year})</Text></View>
    <Text style={styles.para}>Our records revealed that you have failed to render Annual Tax Returns and have not made appropriate tax payments for income year {d.year}, which violates the provisions of;</Text>
    <Text style={styles.para}><Text style={styles.bold}>Section 41(1), Personal Income Tax Act (PITA), (as amended by Act No. 20 of 2011)</Text> – requiring every taxable person to file annual returns;</Text>
    <Text style={styles.para}><Text style={styles.bold}>Section 13(1)(a&amp;b) of the Nigeria Tax Administration Act, 2025</Text> – requiring every taxable person whether or not liable to pay tax and non-resident persons liable to pay tax in Nigeria</Text>
    <Text style={styles.para}>It is also instructive to note that the grace period within which to discharge your statutory obligations as noted in the above referenced Act has since expired which in turn has prompted the application of <Text style={styles.bold}>Section 35(1) of the Nigeria Tax Administration Act, 2025</Text>, which states that; <Text style={styles.bold}>Where a taxable person has not delivered a tax return as provided under this Act, and the relevant tax authority is of the opinion that such taxable person is liable to pay tax, it may, to the best of its judgement, determine the amount of the tax due from the taxable person and make an assessment accordingly.</Text></Text>
    <Text style={styles.para}>In light of the above, a review of your socio-economic indicators based on our classification has informed our decision to issue you with the attached Best of Judgement Assessment Notice in the sum of <Text style={styles.bold}>=N={d.assessedTax} as tax due for {d.year} income year and N{d.developmentLevy} annual Development Levy</Text> for the relevant year.</Text>
    <Text style={styles.para}>You are thus enjoined to pay the total liability contained therein within <Text style={styles.bold}>Thirty (30) days immediately upon receipt of this letter</Text> via the e-tax online payment platform of the LIRS on http://etax.lirs.net or at any of the designated collecting banks using the generated bill reference on the following codes;</Text>
    <View style={[styles.codes,styles.bold]} wrap={false}>
      <View style={styles.codeRow}><Text style={styles.codeLabel}>Agency code:</Text><Text style={{flex:1}}>{d.agencyCode} (Iganmu Tax Office)</Text></View>
      <View style={styles.codeRow}><Text style={styles.codeLabel}>Revenue code:</Text><Text style={{flex:1}}>{d.assessmentCode} (Direct Assessment)</Text></View>
      <View style={styles.codeRow}><Text style={styles.codeLabel}>Revenue code:</Text><Text style={{flex:1}}>{d.levyCode} (Development Levy)</Text></View>
    </View>
    <Text style={styles.para}>Failure to comply, the Agency may issue demand notice for the payment of the tax plus the penalty and interest as provided for by <Text style={styles.bold}>Section 67(1)(2)(3), Section 65(1)(a)(b)(c) and Sections 34(5) &amp; (6)</Text> of the above referenced Act. This is without prejudice to the strict liability for failure to file tax returns within the statutory period in line with <Text style={styles.bold}>Section 101 of the above referenced Act.</Text></Text>
    <Text style={styles.para}>Also be informed that you have the right to object to the assessed liability within <Text style={styles.bold}>thirty (30) days from the date of service</Text> of the disputed notice of assessment stating precisely the grounds of objection to the assessment as stipulated under <Text style={styles.bold}>Section 41(1)(2)(a)(b)(i-v) of the Nigeria Tax Administration Act, 2025.</Text></Text>
    <Text style={styles.para}>Further clarification if required may be sought from the office of the Director, PIT on any issue relating to the content of this letter as your compliance will be greatly appreciated.</Text>
    <View style={styles.signoff} wrap={false}><Text>Yours faithfully,</Text><View style={styles.signatory}><Text>{d.signatory}</Text><Text>{d.signatoryTitle}</Text><Text>For: Executive Chairman</Text></View></View>
  </>;
}
function Note({d}:{d:NoteData}) {
  const identity=[['NAME OF TAXPAYER',d.name],['PAYER ID',d.payerId],['AGE',d.age],['NAME OF COMPANY',d.company],["EMPLOYER'S ADDRESS",d.employerAddress],['ORIGINATING STATION','IGANMU'],['DESIGNATION',d.designation],['NATURE OF BUSINESS',d.business],["TAXPAYER'S ADDRESS",d.address],['OTHER SOURCES OF INCOME',d.otherIncome]];
  return <>
    <Text style={styles.title}>NOTE TO ASSESSMENT</Text>
    {identity.map(([label,value])=><View style={styles.identityRow} key={label} wrap={false}><Text style={styles.identityLabel}>{label}:</Text><Text style={styles.identityValue}>{value||' '}</Text></View>)}
    {[['BRIEF',d.brief],['COMPANY DETAILS',d.companyDetails],['COMPANY AVERAGE REMITTANCE',d.averageRemittance],['CONCLUSION',d.conclusion]].map(([label,value])=><View style={styles.section} key={label}><Text style={styles.sectionLabel} minPresenceAhead={14}>{label}</Text><Text style={styles.noteText}>{value||' '}</Text></View>)}
    <View style={[styles.identityRow,{marginTop:12}]} wrap={false}><Text style={styles.identityLabel}>TYPE OF ASSESSMENT:</Text><Text style={styles.identityValue}>{d.assessmentType}</Text></View>
    <View style={styles.table}>
      <View style={[styles.row,styles.yearRow]} wrap={false}><Text style={styles.cellLabel}>YEARS</Text>{d.years.map((v,i)=><Text style={styles.cell} key={i}>{v}</Text>)}</View>
      {tableRows.map(row=><View key={row.key} style={[styles.row,...(row.key==='taxPayable'?[styles.totalRow]:[])]} wrap={false}><Text style={styles.cellLabel}>{row.label.toUpperCase()}</Text>{d[row.key].map((value,i)=><Text key={i} style={styles.cell}>{value||' '}</Text>)}</View>)}
    </View>
    <View style={styles.signatures} wrap={false}>{[['PREPARED BY',d.preparedBy],['APPROVED BY',d.approvedBy]].map(([label,value])=><View key={label} style={styles.signature}><Text style={styles.bold}>{label}: {value}</Text><View style={styles.signatureLine}/><Text style={styles.small}>DATE &amp; SIGNATURE</Text></View>)}</View>
  </>;
}
function Naira(){return <Text style={{fontFamily:'Naira'}}>₦</Text>;}
function AssessmentNotice({d}:{d:AssessmentNoticeData}) {
  return <>
    <View style={styles.letterTop}><Text style={{maxWidth:'64%'}}>{d.reference}</Text><Text>{formattedDate(d.date)}.</Text></View>
    <View style={styles.address}><Text>{d.name}</Text><Text>{d.address1}</Text>{d.address2&&<Text>{d.address2}</Text>}</View>
    <Text style={styles.bold}>TAX PAYER ID: {d.payerId}</Text>
    <View style={styles.heading}><Text>PERSONAL INCOME TAX MATTERS</Text><Text>ASSESSMENT NOTICE FOR {d.year} INCOME YEAR</Text></View>
    <Text style={styles.para}>Further to the Declaration of Income and Claims for Reliefs submitted via the LIRS e-Tax platform for {d.year} Income Year and following a review of your annual returns together with additional information available to the Service, please be informed that you have been duly assessed in accordance with the provisions of <Text style={styles.bold}>Section 54 of the Personal Income Tax Act, LFN Cap. P8 of 2004 as amended and Section 34(4) of the Nigeria Tax Administration Act (NTAA) 2025.</Text> This assessment results in a total tax liability of <Text style={styles.bold}>N{d.taxLiability}</Text> for the relevant income year as detailed in the enclosed Notices of Assessment.</Text>
    <Text style={styles.para}>You are thus enjoined to remit the sum of <Text style={styles.bold}>N{d.taxLiability}</Text> to the Lagos State Government coffers via the LIRS e-tax platform at http://etax.lirs.net, or through any designated revenue collecting banks using the generated bill reference within thirty (30) days of receipt of this notice, using the following codes stated below:</Text>
    <View style={styles.codes} wrap={false}>
      <View style={styles.codeRow}><Text style={styles.codeLabel}>Agency Code:</Text><Text style={{flex:1}}>{d.agencyCode} (Iganmu Tax Office)</Text></View>
      <View style={styles.codeRow}><Text style={styles.codeLabel}>Revenue Code:</Text><Text style={{flex:1}}>{d.assessmentCode} (Direct Assessment)</Text></View>
    </View>
    <Text style={styles.para}>Failure to comply with the above directives within the specified period shall constitute a debt due, which will attract a penalty in the total sum equal to 10% of the amount of the tax payable and interest at the prevailing monetary policy rate of the Central Bank of Nigeria pursuant to <Text style={styles.bold}>Section 65(1)(a)(b)(c) of the Nigeria Tax Administration Act 2025.</Text></Text>
    <Text style={styles.para}>Please note that you reserve the statutory right to object to this assessment as provided under <Text style={styles.bold}>Section 41(1)(2)(a&amp;b) of the NTAA 2025,</Text> stating clearly the grounds of your objection, provided such objection is lodged within thirty (30) days from the date of receipt of this notice.</Text>
    <Text style={styles.para}>Furthermore, you are reminded that under <Text style={styles.bold}>Section 36(1) of the NTAA 2025,</Text> the Relevant Tax Authority is empowered to issue additional assessments within the year of assessment or within six (6) years thereafter, where it becomes evident that a taxpayer has not been adequately assessed.</Text>
    <Text style={styles.para}>Please note that, <Text style={styles.bold}>false declarations, misstatements, or deliberate concealment of income</Text> is an offence punishable under <Text style={styles.bold}>Section 124(1)(a)(b)&amp;(2) of the NTAA 2025,</Text> which may attract an administrative penalty of N1,000,000 and on conviction to a fine of N1,000,000 or to imprisonment not exceeding three years or both.</Text>
    <Text style={styles.para}>Kindly treat this notice with the utmost priority.</Text>
    <View style={styles.signoff} wrap={false}><Text>Yours faithfully,</Text><View style={styles.signatory}><Text>{d.managerName}</Text><Text>STATION MANAGER</Text></View></View>
  </>;
}
function Demand({d}:{d:DemandData}) {
  const amounts=calculateDemand(d.principal);
  const yearLabel=/^\d{4}$/.test(d.incomeYears.trim())?'Income Year':'Income Years';
  return <>
    <View style={styles.letterTop}><Text style={{maxWidth:'64%'}}>{d.reference}</Text><Text>{formattedDate(d.date)}.</Text></View>
    <View style={styles.address}><Text>{d.name}</Text>{d.company&&<Text>{d.company}</Text>}<Text>{d.address1}</Text>{d.address2&&<Text>{d.address2}</Text>}</View>
    <Text style={styles.bold}>TAX PAYER ID: {d.payerId}</Text>
    <Text style={styles.heading}>DEMAND NOTICE ON {d.incomeYears} {yearLabel.toUpperCase()}</Text>
    <Text style={styles.para}>Please refer to the Assessment Notices issued to you on {d.assessmentDates}. Your failure to file an objection within the statutory period prescribed under Section 68, PITA, and Section 49(2), NTAA 2025 has rendered the assessment final and conclusive.</Text>
    <Text style={styles.para}>Consequently, you are hereby required to pay the outstanding tax liability as stated below:</Text>
    <View style={styles.codes} wrap={false}>
      <Text style={styles.para}>• Principal Tax: <Naira/>{amounts.principal}</Text>
      <Text style={styles.para}>• Penalty (10%) – : <Naira/>{amounts.penalty} (Section 76 of PITA &amp; Section 65 of NTAA)</Text>
      <Text style={styles.para}>• Interest (21%) – : <Naira/>{amounts.interest} (Section 77 of PITA &amp; Section 67 of NTAA)</Text>
      <Text style={[styles.para,styles.bold]}>• Total amount now payable: <Naira/>{amounts.total}</Text>
    </View>
    <Text style={styles.para}>Please note that payment must be made within 30 days via the LIRS E-Tax platform (etax.lirs.net) or any designated collection bank, using the following details:</Text>
    <View style={styles.codes} wrap={false}>
      <Text style={styles.para}>• Agency Code: {d.agencyCode} (Iganmu Tax station)</Text>
      <Text style={styles.para}>• Revenue Code: {d.assessmentCode} (Direct Assessment)</Text>
      <Text style={styles.para}>• Revenue Code: {d.levyCode} (Development Levy)</Text>
    </View>
    <Text style={styles.para}>This Demand Notice should be treated as a final correspondence from this office before commencement of full recovery proceedings and enforcement actions under Sections 67(3) of NTAA 2025.</Text>
    <Text style={styles.para}>Following a review of the returns submitted via the LIRS e-Tax platform for the {d.incomeYears} {yearLabel} together with additional information available to the Service, please be informed that you have been duly assessed in accordance with the provisions of Section 54 of the Personal Income Tax Act, LFN Cap. P8 of 2004 as amended and Section 34(4) of the Nigeria Tax Administration Act (NTAA) 2025. This assessment results in a tax liability of <Naira/>{amounts.principal} for the relevant income year as detailed in the enclosed Notice of Assessment. This brings your total outstanding tax liability to <Naira/>{amounts.total} for {d.incomeYears} {yearLabel} which should be paid to the Lagos State Government coffers via the e-tax platform of the LIRS on http://etax.lirs.net or at any of the designated revenue collecting banks using the generated bill reference within thirty (30) days of receipt of this notice.</Text>
    <Text style={styles.para}>Failure to comply with the above directives within the specified period shall constitute a debt due, which will attract a penalty in the total sum equal to 10% of the amount of the tax payable and interest at the prevailing monetary policy rate of the Central Bank of Nigeria pursuant to Section 65(1)(a)(b)(c) of the Nigeria Tax Administration Act 2025.</Text>
    <Text style={styles.para}>Please note that you reserve the statutory right to object to this assessment as provided under Section 41(1)(2)(a&amp;b) of the NTAA 2025, stating clearly the grounds of your objection, provided such objection is lodged within thirty (30) days from the date of receipt of this notice.</Text>
    <Text style={styles.para}>Kindly treat this notice with the utmost priority.</Text>
    <View style={styles.signoff} wrap={false}><Text>Yours faithfully,</Text><View style={styles.signatory}><Text>{d.managerName}</Text><Text>STATION MANAGER</Text><Text>IGANMU TAX STATION</Text></View></View>
  </>;
}
export function DocumentPdf({project}:{project:Project}) {
  return <Document title={project.template==='letter'?'Best of Judgement letter':project.template==='demand'?'Demand Notice':project.template==='assessment'?'Assessment Notice':'Note to Assessment'} author="" subject="" creator="Iganmu Documents">
    <Page size="A4" wrap style={[styles.page,{paddingTop:mm(project.print.topMm),paddingBottom:mm(project.print.bottomMm),paddingHorizontal:mm(project.print.sideMm)}]}>
      {project.template==='letter'?<Letter d={project.data}/>:project.template==='demand'?<Demand d={project.data}/>:project.template==='assessment'?<AssessmentNotice d={project.data}/>:<Note d={project.data}/>}
    </Page>
  </Document>;
}
export async function generatePdf(project:Project) {
  const blob=await pdf(<DocumentPdf project={project}/>).toBlob();
  const bytes=await blob.arrayBuffer();
  const doc=await PDFDocument.load(bytes);
  return {blob,bytes,pages:doc.getPageCount(),pageSize:doc.getPage(0).getSize()};
}
