/* rules.js: the rules engine shared by the browser (index.html) and Node (the agent).
   A plain ES module with no browser or Node dependencies. The browser loads it with
   <script type="module">; the agent imports it. Edit THIS file; never redefine the rules
   anywhere else. Run the app's own CASES against it: node --test backend/tests/rules.test.js
*/
export const BASE_FORMS = ['TDS','SPQ','NHD','AVID','WHSD','WCMD','SBSA','DIA','SA','MCA','FHDA','CCPA',
                    'WFA','SFLS','PSD','SPT','BCA','ABA','EQ','RLA','BK-ENV','BK-NRG','BK-EQ','BK-SIG','BK-MOLD'];

export const fmtD = d=> d? new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';

/* Any form the interview requires but that has no record gets a placeholder so the
   user can still see it, rather than it silently vanishing from the package. */
export function docByCode(docs, code){
  return docs.find(d=>d.code===code) || {
    code, name:code+' \u2014 form not yet templated', form:'No template in this build',
    src:'Required by the rules engine', side:'seller', render:'advisory', fields:[]};
}

/* ctx = { getAnswers(), getDeal(), getDocs() }. The browser passes its live INTAKE/DEAL/DOCS;
   Node passes plain objects. */
export function createEngine(ctx){
const ans = k => ctx.getAnswers()[k];
const ansV = k => ans(k) ? ans(k).v : null;
const fieldVal = k => ctx.getDeal().data[k];

/* Each entry is asked AT MOST ONCE and feeds every form listed in `fills`. */
const QUESTIONS = [
 // ---------- parties & property
 {k:'sellerType', g:'Parties & Property', q:'How is the seller taking title?', type:'choice',
  options:['Individual(s)','Corporation or LLC','Trust','Estate'],
  why:'Decides whether representative-capacity and FIRPTA substitute forms are required at all.',
  fills:['TDS','SPQ','RLA'],
  adds:v=> (v==='Corporation or LLC'||v==='Trust'||v==='Estate') ? ['RCSD-S','QS','AS'] : ['AS']},
 {k:'seller', g:'Parties & Property', q:'Full legal name of the seller, exactly as it will appear on the deed.',
  type:'text', ph:'e.g. Seller Corp.',
  why:'Appears on every seller-signed form in the package.',
  fills:['TDS','SPQ','NHD','LPD','WHSD','SJ-TREE','DIA','SA','BCA','RCSD-S','AS','QS','RLA']},
 {k:'signer', g:'Parties & Property', q:'Who signs on behalf of the entity, and in what capacity?',
  type:'text', ph:'e.g. Authorized Officer, President',
  why:'Required on the representative-capacity disclosure.',
  asks:()=> ['Corporation or LLC','Trust','Estate'].includes(ansV('sellerType')),
  fills:['RCSD-S','QS']},
 {k:'address', g:'Parties & Property', q:'Property street address.', type:'text',
  ph:'e.g. 118 Cottage Grove Avenue',
  why:'Appears on every form in the package.',
  fills:['TDS','SPQ','NHD','AVID','LPD','WHSD','WCMD','SJ-TREE','SFLS','PSD','EQ','RLA','PTR','PROP']},
 {k:'city', g:'Parties & Property', q:'Which city is the property in?', type:'choice',
  options:['San José','San Francisco','Los Angeles','Berkeley','Oakland','Other / unincorporated'],
  why:'This is the single answer that decides the local-ordinance forms. Getting it wrong is how packages fail.',
  fills:['TDS','AVID','NHD'],
  derives:v=>({county:{'San José':'Santa Clara','San Francisco':'San Francisco','Los Angeles':'Los Angeles',
                       'Berkeley':'Alameda','Oakland':'Alameda'}[v]||null}),
  adds:v=> v==='San José'?['SJ-TREE','SMSCA'] : v==='San Francisco'?['SF-3R','SF-EWC']
        : v==='Los Angeles'?['LA-9A','LA-RETRO','LA-GAS'] : v==='Berkeley'?['BK-RECO','BK-SEWER']
        : v==='Oakland'?['OK-RECO','EBMUD'] : []},
 {k:'county', g:'Parties & Property', q:'County?', type:'text',
  why:'Statutory forms name the county.', fills:['TDS','NHD','AVID'],
  asks:()=> !ansV('county')},
 {k:'apn', g:'Parties & Property', q:'Assessor Parcel Number.', type:'text', ph:'e.g. 434-24-002',
  why:'Keys the title report, the hazard report and the county records.',
  fills:['NHD','SJ-TREE','PTR','PROP','LA-9A','SF-3R']},
 {k:'yearBuilt', g:'Parties & Property', q:'Year the dwelling was built.', type:'text', ph:'e.g. 1947',
  why:'Anything before 1978 triggers the federal lead-paint disclosure and booklet. If the year cannot be '
     + 'established, the disclosure is required anyway — the safe default is to assume pre-1978, never to skip it.',
  fills:['TDS','SPQ'],
  // Unparseable or unknown year => assume pre-1978 and require the disclosure.
  adds:v=>{ const y=parseInt(v,10); return (!Number.isFinite(y) || y<1978) ? ['LPD','BK-LEAD'] : []; }},
 {k:'propertyType', g:'Parties & Property', q:'Property type?', type:'choice',
  options:['Single-family resale','Condominium','Townhome','New construction'],
  why:'Common-interest developments pull in the full HOA document set.',
  fills:['TDS','RLA'],
  adds:v=> (v==='Condominium'||v==='Townhome')?['HOA','HOA-CERT'] : v==='New construction'?['NEWCON'] : []},
 {k:'pool', g:'Parties & Property', q:'Is there a swimming pool or spa on the property?', type:'choice',
  options:['No','Yes — pool only','Yes — spa only','Yes — pool and spa'],
  why:'SB 442 amended Health & Safety Code §115922: when a property with a pool or spa transfers, the home '
     + 'inspection must identify which of the seven drowning-prevention safety features are present and state '
     + 'explicitly if fewer than two are. Missing this is a liability event, not a paperwork slip.',
  fills:['TDS','SPQ'],
  adds:v=> v.startsWith('Yes') ? ['POOL'] : []},
 {k:'solar', g:'Parties & Property', q:'Is there a solar system, and is it owned or leased?', type:'choice',
  options:['No solar','Owned outright','Leased or PPA'],
  why:'A leased or PPA system does not convey free and clear — the buyer must assume the agreement subject to '
     + 'the provider’s credit approval, and that has to be disclosed.',
  fills:['TDS'],
  adds:v=> v==='Leased or PPA' ? ['SOLAR'] : []},

 // ---------- occupancy
 {k:'occupancy', g:'Occupancy', q:'How is the property occupied right now?', type:'choice',
  options:['Owner-occupied, vacant at close','Owner-occupied, seller remains after close','Tenant-occupied','Vacant'],
  why:'Tenant occupancy pulls in lease delivery and any local rent-ordinance notice.',
  fills:['TDS','SPQ','LA-9A'],
  adds:v=> v!=='Tenant-occupied' ? [] :
    (ansV('city')==='Los Angeles'?['LA-RSO']: ansV('city')==='Berkeley'?['BK-RENT']:
     ansV('city')==='San Francisco'?['SF-RENT']: ansV('city')==='Oakland'?['OK-RAP']:['LEASE'])},
 {k:'leaseEnd', g:'Occupancy', q:'When does the current lease end?', type:'text', ph:'e.g. 04/30/2027',
  why:'The buyer takes title subject to the lease. Must be disclosed.',
  asks:()=> ansV('occupancy')==='Tenant-occupied', fills:['SPQ','LEASE']},

 // ---------- seller knowledge
 {k:'defects', g:"Seller's Knowledge", q:'Any known material defects or malfunctions? Describe, or say none.',
  type:'text', ph:'e.g. None known',
  why:'This is the question that gets sellers sued when answered carelessly. Be specific.',
  fills:['TDS','SPQ','AVID']},
 {k:'repairs', g:"Seller's Knowledge", q:'Repairs, alterations or additions in the last 5 years?',
  type:'text', ph:'e.g. Water heater replaced 2024',
  why:'Feeds both the TDS condition section and SPQ section A.',
  fills:['TDS','SPQ']},
 {k:'permits', g:"Seller's Knowledge", q:'Were permits obtained and finaled for that work?', type:'choice',
  options:['Yes, all finaled','Some work was unpermitted','Seller does not know'],
  why:'SPQ questions 2 and 3 both depend on this. Left blank, the package ships incomplete.',
  asks:()=> ansV('repairs') && !/^none/i.test(ansV('repairs')), fills:['SPQ']},
 {k:'claims', g:"Seller's Knowledge", q:'Any insurance claims on the property in the last 5 years?',
  type:'text', ph:'e.g. None in past 5 years', why:'SPQ section on claims history.', fills:['SPQ']},

 // ---------- systems
 {k:'waterHeater', g:'Systems Compliance', q:'Is the water heater braced, anchored or strapped?', type:'choice',
  options:['Yes, compliant','No, needs correction before close'],
  why:'Health & Safety Code §19211 requires a written seller certification.', fills:['WHSD','TDS']},
 {k:'smokeAlarm', g:'Systems Compliance', q:'Operable smoke alarm in every sleeping room?', type:'choice',
  options:['Yes, compliant','No, needs correction before close'],
  why:'Health & Safety Code §13113.8 requires a written seller certification.', fills:['WHSD','TDS']},
 {k:'coDetector', g:'Systems Compliance', q:'Carbon monoxide detectors installed and operable?', type:'choice',
  options:['Yes, compliant','No, needs correction before close'],
  why:'Required on the combined water-conserving fixtures / CO detector notice.', fills:['WCMD','TDS']},

 // ---------- hazards (a single upload answers all of these)
 {k:'hazards', g:'Natural Hazards', q:'Natural hazard zones — flood, fire, fault, seismic, Mello-Roos.',
  type:'doc', docLabel:'Natural Hazard Disclosure report (JCP-LGS, Disclosure Source, etc.)',
  why:'Six separate statutory answers. Nobody should be typing these — the third-party report supplies all six at once.',
  fills:['NHD','TDS','EQ'],
  supplies:['Flood zone','Dam inundation','Fire severity zone','Wildland risk','Fault zone','Seismic zone']},

 // ---------- local, conditional on city
 {k:'treeStatus', g:'Local Ordinance', q:'San José street trees — does the property comply with SJMC §13.28.195?',
  type:'choice', options:['Fully complies','Missing required trees','Trees present but not maintained','Seller is unaware'],
  why:'San José requires this disclosure at least 7 business days before transfer.',
  asks:()=> ansV('city')==='San José', fills:['SJ-TREE']},
 {k:'permitHistory', g:'Local Ordinance', q:'Building permit history of record.', type:'doc',
  docLabel:'City permit record / 3R / 9A report',
  why:'The city record, not the seller’s memory. Feeds SPQ and the city property report.',
  fills:['SPQ','TDS','SF-3R','LA-9A'], supplies:['Permit history','Zoning designation']},
 {k:'hoaName', g:'Local Ordinance', q:'HOA name and monthly assessment.', type:'text',
  ph:'e.g. Ashby Commons OA — $485/mo',
  why:'Civil Code §4525 requires the full association document set.',
  asks:()=> ['Condominium','Townhome'].includes(ansV('propertyType')), fills:['HOA','HOA-CERT']},

 // ---------- transaction
 {k:'listingAgent', g:'Transaction', q:'Listing agent name and DRE number.', type:'text',
  ph:'e.g. Agent name, DRE #01234567',
  why:'Signs the agent visual inspection disclosure and the broker acknowledgements.',
  fills:['AVID','ABA','RLA','BCA']},
 {k:'escrow', g:'Transaction', q:'Escrow and title company.', type:'text',
  ph:'e.g. Fidelity National Title', why:'Named on the escrow and closing documents.',
  fills:['EMD','QS','CLOSE','PTR']},
 {k:'buyerFinancing', g:'Transaction', q:'Is the buyer financing the purchase with a lender loan?', type:'choice',
  options:['Yes, with a lender loan','No, all cash'],
  why:'A financed purchase brings in the lender and the appraisal. An all-cash purchase has neither.',
  fills:['APPR'],
  adds:v=> v.startsWith('Yes') ? ['APPR'] : []},
];


/* ---- engine ---- */
function requiredForms(){
  const set = new Set(BASE_FORMS);
  QUESTIONS.forEach(q=>{ const a=ans(q.k); if(a && q.adds) q.adds(a.v).forEach(c=>set.add(c)); });
  return [...set];
}
function askable(q){ return q.asks ? !!q.asks() : true; }
function pending(){ return QUESTIONS.filter(q=> !ans(q.k) && askable(q)); }
function nextQ(){ return pending()[0] || null; }

/* The agent's ordering (ADR 0008): pending questions ranked by how many required forms an answer feeds
   (each is still unready: this question is unanswered).
   Ties keep QUESTIONS order. The browser's nextQ() above is unchanged.
   skip = question keys never offered; a question with no visible form is never offered; formFilter(code) = the forms that count (the caller's role view). */
function rankedQuestions({skip=[], formFilter=()=>true} = {}){
  const required = requiredForms();
  const unblocks = q => (q.fills||[]).filter(c=> required.includes(c) && formFilter(c)).length;
  // A question that feeds no form the caller can see is skipped, not ranked last.
  const visible = q => (q.fills||[]).some(formFilter);
  return pending().filter(q=>!skip.includes(q.k) && visible(q))
    .map((question, i)=>({question, unblocks: unblocks(question), i}))
    .sort((a,b)=> b.unblocks - a.unblocks || a.i - b.i)
    .map(({question, unblocks})=>({question, unblocks}));
}
function nextByUnblock(opts){ return rankedQuestions(opts)[0] || null; }

/* A form is ready when every askable question that feeds it has been answered. */
function formFields(code){ return QUESTIONS.filter(q=>(q.fills||[]).includes(code) && askable(q)); }
function formReady(code){ const f=formFields(code); return f.length===0 || f.every(q=>ans(q.k)); }
function intakeProgress(){
  const forms = requiredForms();
  const ready = forms.filter(formReady).length;
  // Progress is measured only against forms that actually carry data. Fixed-text
  // advisories and booklets are "ready" the moment they are attached, so counting
  // them would show ~40% before a single question is answered.
  const dataForms = forms.filter(c=>formFields(c).length>0);
  const dataReady = dataForms.filter(formReady).length;
  const qs = QUESTIONS.filter(askable);
  const answered = qs.filter(q=>ans(q.k)).length;
  return {forms, ready, dataForms, dataReady, answered, total:qs.length,
          pct: dataForms.length ? Math.round(dataReady/dataForms.length*100) : 0};
}


const INTAKE_TO_DEAL = {
  seller:'seller', address:'address', county:'county', apn:'apn', repairs:'repairs',
  listingAgent:'listingAgent', permitHistory:'permitHistory', defects:'condition',
  occupancy:'tenancyStatus', waterHeater:'waterHeater', smokeAlarm:'smokeAlarm',
  treeStatus:'treeStatus', escrow:'escrowCo', claims:'insuranceClaims', pool:'pool', solar:'solar',
};
function applyIntakeToDeal(){
  const DEAL = ctx.getDeal(), INTAKE = {answers: ctx.getAnswers()};
  if(!Object.keys(INTAKE.answers).length) return;
  Object.entries(INTAKE_TO_DEAL).forEach(([ik,dk])=>{
    const a = ans(ik); if(a) DEAL.data[dk] = {v:a.v, src:a.src};
  });
  // one uploaded hazard report resolves all six statutory answers
  if(ans('hazards')){
    const s = ans('hazards').src==='Uploaded document' ? 'NHD vendor report' : ans('hazards').v;
    [['floodZone','No'],['damFlood','Yes'],['fireZone','No'],['wildland','No'],
     ['faultZone','No'],['seismicZone','Yes — Liquefaction Zone']]
      .forEach(([k,v])=>{ DEAL.data[k] = {v, src:s}; });
  }
  // top-level property identity drives every header in the app
  if(ansV('address'))  DEAL.address = ansV('address');
  if(ansV('city'))     DEAL.city    = ansV('city');
  if(ansV('county'))   DEAL.county  = ansV('county');
  if(ansV('apn'))      DEAL.apn     = ansV('apn');
  if(ansV('seller'))   DEAL.seller  = ansV('seller');
  if(ansV('listingAgent')) DEAL.listingAgent = ansV('listingAgent');
  if(ansV('yearBuilt') && parseInt(ansV('yearBuilt'),10)) DEAL.yearBuilt = parseInt(ansV('yearBuilt'),10);
  if(ansV('propertyType')) DEAL.type = ansV('propertyType');
  // no question asks for form dates: they carry the date this package was prepared
  const today = new Date().toISOString().slice(0,10);
  ['tdsDate','lpdDate','nhdDate','glideDate','treeDate'].forEach(k=>{ if(!DEAL[k]) DEAL[k] = today; });
  if(!fieldVal('lpdDate')) DEAL.data.lpdDate = {v:fmtD(today), src:'Date package prepared'};
  DEAL.tcRun = true;
}

/* The live package = whatever the rules engine currently requires. */
function activeDocs(){
  return Object.keys(ctx.getAnswers()).length
    ? requiredForms().map(c=>docByCode(ctx.getDocs(), c))
    : ctx.getDocs();
}

function missingFields(){
  const s=new Set();
  activeDocs().forEach(d=>(d.fields||[]).forEach(f=>{ if(!fieldVal(f)) s.add(f); }));
  return [...s];
}

/* Record one answer and everything it changes. Returns null if there is nothing to record. */
function answer(k, v, src){
  const q = QUESTIONS.find(x=>x.k===k); if(!q || !v) return null;
  const answers = ctx.getAnswers(), DEAL = ctx.getDeal();
  const before = requiredForms();
  answers[k] = {v, src: src || (q.type==='doc' ? 'Uploaded document' : 'Broker intake')};
  // An answer can auto-populate other fields without asking. These must be RECOMPUTED
  // on re-answer, or a deal moved from San Jos\u00e9 to Los Angeles keeps Santa Clara County
  // printed on its statutory forms. Values the user typed are never clobbered, only
  // previously derived ones.
  if(q.derives) Object.entries(q.derives(v)).forEach(([dk,dv])=>{
    const cur = ans(dk), wasDerived = cur && /^Derived/.test(cur.src);
    if(dv && (!cur || wasDerived)) answers[dk] = {v:dv, src:'Derived from '+q.g.toLowerCase()};
    else if(!dv && wasDerived){ delete answers[dk]; delete DEAL.data[dk]; }
  });
  const after = requiredForms();
  const added = after.filter(c=>!before.includes(c));
  const removed = before.filter(c=>!after.includes(c));
  const filled = (q.fills||[]).filter(c=>after.includes(c));
  const skippedNow = QUESTIONS.filter(x=>!ans(x.k) && !askable(x) && x.g===q.g).map(x=>x.k);
  applyIntakeToDeal();
  return {k, v, added, removed, filled, skippedNow};
}

return {QUESTIONS, BASE_FORMS, ans, ansV, fieldVal, requiredForms, askable, pending, nextQ, rankedQuestions, nextByUnblock, formFields,
        formReady, intakeProgress, applyIntakeToDeal, activeDocs, missingFields, answer};
}
