import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { createClient } from "@supabase/supabase-js";
import { confrontaCanali, calcolaRata, DURATE_DISPONIBILI } from './bibanca_rates.js';
import { confrontaPrestitoPersonale, DURATE_PRESTITO } from './prestitopersonale.js';

// ============================================================
//  FINPRATICA CRM — Mediazione Creditizia
//  Brand: #1C3F6E (navy) · #4A90D9 (azzurro) · #F5F3EE (crema)
//  ✨ NUOVO: Motore di Richiamo IA — pratiche in scadenza
// ============================================================

const GROQ_API_KEY = "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";
const GROQ_MODEL   = "llama-3.3-70b-versatile";

const SUPABASE_URL = "https://taxhjdmnchjbdinzqstd.supabase.co";
const SUPABASE_KEY = "sb_publishable_zy8OMf0OPQabS8Kp_6jPkA_ewyxtYZo";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const C = {
  navy:"#1C3F6E", blue:"#4A90D9", cream:"#F5F3EE", white:"#FFFFFF",
  border:"#E4E1D9", border2:"#D0CECC", text:"#1A1E2C", muted:"#7A8094",
  light:"#F8F7F3", navyBg:"#EEF2F8", navyTint:"#DDEAF8",
  gold:"#D97706", green:"#16A34A", red:"#DC2626",
};

// ── Regole di scadenza per servizio ──────────────────────────
const SCADENZE_SERVIZIO = {
  cessione_quinto:    { anni: 4,  label: "Cessione del Quinto", rinnovabile: true  },
  mutuo:              { anni: 20, label: "Mutuo",               rinnovabile: false },
  prestito_personale: { anni: 3,  label: "Prestito Personale",  rinnovabile: true  },
};

const uid   = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const eur   = (n) => new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(n||0);
const eur0  = (n) => new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n||0);
const pct   = (n) => `${(+n||0).toFixed(2)}%`;
const fdate = (d) => d ? new Date(d).toLocaleDateString("it-IT") : "—";
const today = () => new Date().toISOString().slice(0,10);
const addYears = (dateStr, years) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d;
};
const daysDiff = (d1, d2) => Math.round((d2 - d1) / (1000*60*60*24));

function profilo(score){
  if(score>=75) return {label:"Gold",  dot:"#D97706",bg:"#FFFBEB",border:"#FDE68A",text:"#92400E"};
  if(score>=45) return {label:"Buono", dot:"#16A34A",bg:"#F0FDF4",border:"#BBF7D0",text:"#14532D"};
  return              {label:"Basso", dot:"#DC2626",bg:"#FFF1F2",border:"#FECACA",text:"#7F1D1D"};
}

async function groq(system, user, apiKey){
  try{
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey||GROQ_API_KEY}`},
      body:JSON.stringify({model:GROQ_MODEL,messages:[{role:"system",content:system},{role:"user",content:user}],temperature:0.7,max_tokens:1200}),
    });
    const d = await r.json();
    if(d.error) return `Errore: ${d.error.message}`;
    return d.choices?.[0]?.message?.content||"Nessuna risposta.";
  }catch(e){return `Errore: ${e.message}`;}
}

async function callGemini(system, user, apiKey){
  try{
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        system_instruction:{parts:[{text:system}]},
        contents:[{role:"user",parts:[{text:user}]}],
        generationConfig:{temperature:0.7,maxOutputTokens:1200},
      }),
    });
    const d = await r.json();
    if(d.error) return `Errore: ${d.error.message}`;
    return d.candidates?.[0]?.content?.parts?.[0]?.text||"Nessuna risposta.";
  }catch(e){return `Errore: ${e.message}`;}
}

const SVC = {
  cessione_quinto:   {label:"Cessione Quinto",  color:C.navy,   bg:C.navyBg, border:C.navyTint},
  mutuo:             {label:"Mutuo",             color:"#6D28D9",bg:"#F5F3FF",border:"#DDD6FE"},
  prestito_personale:{label:"Prestito Personale",color:"#0891B2",bg:"#ECFEFF",border:"#A5F3FC"},
};
const CRIF_SOGLIE = {
  cessione_quinto:    { ottimo: 600, medio: 300 },
  prestito_personale: { ottimo: 700, medio: 400 },
  mutuo:              { ottimo: 750, medio: 500 },
};
const STATI = {
  attivo:    {label:"Attivo",     color:"#15803D",bg:"#F0FDF4",border:"#BBF7D0"},
  trattativa:{label:"Trattativa", color:"#B45309",bg:"#FFFBEB",border:"#FDE68A"},
  archiviato:{label:"Archiviato", color:"#6B7280",bg:"#F9FAFB",border:"#E5E7EB"},
  lead:      {label:"Lead",       color:C.navy,   bg:C.navyBg, border:C.navyTint},
};

const emptyProv = () => ({
  id:"",clienteId:"",clienteNome:"",servizio:"cessione_quinto",
  dataCalcolo:today(),importoFinanziato:"",durataMesi:"",
  tanPerc:"",taegPerc:"",
  provvigionePercBanca:"",provvigionePercMediatore:"",
  note:"",stato:"da_liquidare",
});

// ── SEED con dataInizio pratica per calcolo scadenze ─────────
const SEED = [
  {id:"c1",nome:"Mario Rossi",email:"mario.rossi@email.it",tel:"333-1234567",
   servizio:"cessione_quinto",importo:28000,stato:"attivo",score:84,
   reddito:2800,datore:"Comune di Palermo",eta:48,canale:"passaparola",
   note:"Cliente storico, puntuale.",
   ultimoContatto:"2025-02-20",dataIns:"2024-01-15",
   dataInizioPratica:"2022-01-15",  // pratica iniziata 4 anni fa → SCADUTA
   nonFinanziabile:false, lead:false,
   promemoria:[{id:"r1",testo:"Rinnovo pratica cessione",data:"2026-03-15",fatto:false}],
   docs:["CTC_Rossi.pdf","BustaPaga.pdf"]},

  {id:"c2",nome:"Lucia Bianchi",email:"lucia.b@gmail.com",tel:"347-9876543",
   servizio:"mutuo",importo:165000,stato:"trattativa",score:63,
   reddito:3400,datore:"Telecom Italia",eta:35,canale:"facebook",
   note:"Mutuo prima casa, marito co-intestatario.",
   ultimoContatto:"2025-03-01",dataIns:"2024-06-10",
   dataInizioPratica:"2024-06-10",
   nonFinanziabile:false, lead:false,
   promemoria:[{id:"r2",testo:"Inviare preventivo mutuo",data:"2026-03-10",fatto:false}],
   docs:[]},

  {id:"c3",nome:"Giuseppe Verdi",email:"g.verdi@libero.it",tel:"320-5554433",
   servizio:"prestito_personale",importo:7500,stato:"archiviato",score:24,
   reddito:1100,datore:"Freelance",eta:52,canale:"google",
   note:"CRIF negativa. Protestato 2022.",
   ultimoContatto:"2024-11-01",dataIns:"2023-11-20",
   dataInizioPratica:"2023-01-10",  // 3 anni → in scadenza
   nonFinanziabile:true,  // segnato come non finanziabile
   lead:false,promemoria:[],docs:[]},

  {id:"c4",nome:"Carmela Esposito",email:"carmela.e@virgilio.it",tel:"389-2233441",
   servizio:"cessione_quinto",importo:32000,stato:"attivo",score:91,
   reddito:3100,datore:"INPS Pensione",eta:67,canale:"passaparola",
   note:"Pensionata INPS. Figlia già cliente.",
   ultimoContatto:"2026-02-10",dataIns:"2023-08-05",
   dataInizioPratica:"2022-03-01",  // oltre 4 anni → SCADUTA
   nonFinanziabile:false, lead:false,
   promemoria:[],docs:["INPS_Carmela.pdf"]},

  {id:"c5",nome:"Salvatore Greco",email:"s.greco@tin.it",tel:"347-5566778",
   servizio:"cessione_quinto",importo:22000,stato:"attivo",score:77,
   reddito:2600,datore:"ASL Palermo",eta:55,canale:"passaparola",
   note:"Dipendente ASL, vuole rinnovare tra poco.",
   ultimoContatto:"2025-12-01",dataIns:"2022-06-01",
   dataInizioPratica:"2024-10-01",  // scade tra ~6 mesi → in avvicinamento
   nonFinanziabile:false, lead:false,
   promemoria:[],docs:[]},

  {id:"l1",nome:"Antonino Gallo",email:"",tel:"380-9988776",
   servizio:"cessione_quinto",importo:0,stato:"lead",score:57,
   reddito:2200,datore:"Polizia di Stato",eta:41,canale:"linkedin",
   note:"Lead LinkedIn – forze dell'ordine.",
   ultimoContatto:"2026-03-05",dataIns:"2026-03-01",
   dataInizioPratica:null, nonFinanziabile:false, lead:true,
   promemoria:[{id:"r3",testo:"Primo contatto telefonico",data:"2026-03-08",fatto:false}],
   docs:[]},
];

const SEED_PROV = [
  {id:"p1",clienteId:"c1",clienteNome:"Mario Rossi",servizio:"cessione_quinto",dataCalcolo:"2025-02-01",importoFinanziato:28000,durataMesi:120,tanPerc:8.5,taegPerc:9.2,provvigionePercBanca:2.5,provvigionePercMediatore:1.8,provvigioneBanca:700,provvigioneMediatore:504,provvigioneTotale:1204,note:"Banca X",stato:"liquidata"},
  {id:"p2",clienteId:"c4",clienteNome:"Carmela Esposito",servizio:"cessione_quinto",dataCalcolo:"2025-10-15",importoFinanziato:32000,durataMesi:108,tanPerc:7.8,taegPerc:8.4,provvigionePercBanca:2.5,provvigionePercMediatore:1.8,provvigioneBanca:800,provvigioneMediatore:576,provvigioneTotale:1376,note:"",stato:"da_liquidare"},
];

const emptyCl = (lead=false) => ({
  id:"",nome:"",email:"",tel:"",servizio:"cessione_quinto",importo:"",
  stato:lead?"lead":"attivo",score:60,reddito:"",datore:"",eta:"",
  canale:"passaparola",note:"",ultimoContatto:today(),dataIns:today(),
  dataInizioPratica:"",nonFinanziabile:false,lead,promemoria:[],docs:[],
});

// ── Calcola stato scadenza pratica ────────────────────────────
function calcolaScadenza(client) {
  const reg = SCADENZE_SERVIZIO[client.servizio];
  if (!reg || !client.dataInizioPratica || client.lead) return null;
  const scadenza = addYears(client.dataInizioPratica, reg.anni);
  const now = new Date();
  const giorniMancanti = daysDiff(now, scadenza);
  const giorniDaScadenza = daysDiff(scadenza, now);

  let stato;
  if (client.nonFinanziabile) stato = "non_finanziabile";
  else if (giorniMancanti < 0) stato = "scaduta";           // già scaduta
  else if (giorniMancanti <= 180) stato = "in_scadenza";    // entro 6 mesi
  else stato = "attiva";

  return {
    scadenza,
    giorniMancanti,
    giorniDaScadenza: giorniMancanti < 0 ? giorniDaScadenza : 0,
    stato,
    rinnovabile: reg.rinnovabile,
    label: reg.label,
  };
}

// ── UI ATOMS (module-level — stable identities across renders) ──
const Chip=({label,color,bg,border,style:s={}})=>(<span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:600,color,background:bg,border:`1px solid ${border}`,...s}}>{label}</span>);
const ScoreDot=({score,size=10})=>{const p=profilo(score);return <span style={{display:"inline-block",width:size,height:size,borderRadius:"50%",background:p.dot,flexShrink:0,boxShadow:`0 0 0 2px ${p.dot}30`}} title={p.label}/>;};
const ScoreChip=({score})=>{const p=profilo(score);return <span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:700,color:p.text,background:p.bg,border:`1px solid ${p.border}`}}><ScoreDot score={score} size={7}/>{p.label}·{score}</span>;};
const Avatar=({name,score,size=36})=>{const p=profilo(score);return <div style={{width:size,height:size,borderRadius:"50%",background:p.bg,border:`2px solid ${p.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:p.dot,fontSize:size*0.35,flexShrink:0}}>{name?.charAt(0)?.toUpperCase()}</div>;};
const Inp=({label,full,...p})=>(<div style={{display:"flex",flexDirection:"column",gap:5,...(full?{gridColumn:"1/-1"}:{})}}>{label&&<label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</label>}<input style={{background:C.light,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",fontSize:14,color:C.text,outline:"none",width:"100%",fontFamily:"inherit"}} {...p}/></div>);
const Sel=({label,children,...p})=>(<div style={{display:"flex",flexDirection:"column",gap:5}}>{label&&<label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</label>}<select style={{background:C.light,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",fontSize:14,color:C.text,outline:"none",width:"100%",cursor:"pointer",fontFamily:"inherit"}} {...p}>{children}</select></div>);
const Btn=({variant="primary",children,style:s={},...p})=>{
  const v={primary:{background:C.navy,color:"#fff",border:"none"},blue:{background:C.blue,color:"#fff",border:"none"},ghost:{background:C.white,color:C.text,border:`1px solid ${C.border}`},success:{background:"#16A34A",color:"#fff",border:"none"},danger:{background:"#DC2626",color:"#fff",border:"none"},orange:{background:"#EA580C",color:"#fff",border:"none"}};
  return <button style={{...v[variant],padding:"9px 18px",borderRadius:9,fontWeight:700,fontSize:14,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:7,fontFamily:"inherit",transition:"opacity 0.15s",...s}} onMouseOver={e=>e.currentTarget.style.opacity="0.85"} onMouseOut={e=>e.currentTarget.style.opacity="1"} {...p}>{children}</button>;
};
const Card=({children,style:s={}})=>(<div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,boxShadow:"0 1px 4px rgba(28,63,110,0.06)",...s}}>{children}</div>);
const SecTitle=({children})=>(<div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",paddingBottom:10,borderBottom:`1px solid ${C.border}`,marginBottom:14}}>{children}</div>);

function ScadenzaBadge({scad}) {
  if (!scad) return null;
  const cfg = {
    scaduta:        {label:`Scaduta da ${scad.giorniDaScadenza}gg`, color:"#DC2626", bg:"#FFF1F2", border:"#FECACA"},
    in_scadenza:    {label:`Scade in ${scad.giorniMancanti}gg`,     color:"#B45309", bg:"#FFFBEB", border:"#FDE68A"},
    non_finanziabile:{label:"Non finanziabile",                     color:"#6B7280", bg:"#F9FAFB", border:"#E5E7EB"},
    attiva:         {label:`Attiva fino al ${fdate(scad.scadenza)}`, color:"#15803D", bg:"#F0FDF4", border:"#BBF7D0"},
  };
  const c = cfg[scad.stato] || cfg.attiva;
  return <Chip {...c} label={c.label}/>;
}

const Overlay=({children,onClose})=>(<div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"rgba(28,63,110,0.35)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"}}>{children}</div>);

// ── StableWrapper — fixes focus loss on every keystroke ───────
// Inner views are defined inside App() → new function reference on every
// App re-render → React sees a "new" component → unmount+remount → focus lost.
// StableWrapper has a STABLE reference (module-level) so React never unmounts
// it just because the parent re-rendered; it simply calls the renderFn normally.
function StableWrapper({ renderFn, ...props }) { return renderFn(props); }

// Context for ImpostazioniView — gives stable identities to TInput/TSelect/Toggle
const ImpostazioniCtx = createContext(null);
const Field = ({label, hint, children}) => (
  <div style={{marginBottom:20}}>
    <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>{label}</div>
    {children}
    {hint&&<div style={{fontSize:11,color:C.muted,marginTop:5}}>{hint}</div>}
  </div>
);
const TInput = ({field, ...p}) => {
  const ctx = useContext(ImpostazioniCtx);
  return (
    <input value={ctx.local[field]||""} onChange={e=>ctx.upd(field,e.target.value)}
      style={{width:"100%",padding:"10px 13px",border:`1.5px solid ${C.border}`,borderRadius:9,fontSize:14,outline:"none",fontFamily:"inherit",color:C.text,background:C.light,transition:"border-color 0.2s"}}
      onFocus={e=>e.target.style.borderColor=C.blue} onBlur={e=>e.target.style.borderColor=C.border} {...p}/>
  );
};
const TSelect = ({field, children}) => {
  const ctx = useContext(ImpostazioniCtx);
  return (
    <select value={ctx.local[field]||""} onChange={e=>ctx.upd(field,e.target.value)}
      style={{width:"100%",padding:"10px 13px",border:`1.5px solid ${C.border}`,borderRadius:9,fontSize:14,outline:"none",fontFamily:"inherit",color:C.text,background:C.light,cursor:"pointer"}}>
      {children}
    </select>
  );
};
const Toggle = ({field, label}) => {
  const ctx = useContext(ImpostazioniCtx);
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${C.cream}`}}>
      <span style={{fontSize:14,fontWeight:500}}>{label}</span>
      <button onClick={()=>ctx.upd(field,!ctx.local[field])} style={{width:44,height:24,borderRadius:12,border:"none",background:ctx.local[field]?"#16A34A":"#D1D5DB",cursor:"pointer",position:"relative",transition:"background 0.2s",padding:0,flexShrink:0}}>
        <span style={{position:"absolute",top:2,left:ctx.local[field]?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)",display:"block"}}/>
      </button>
    </div>
  );
};
const InfoBox = ({color="#1C3F6E",bg="#EEF2F8",border="#DDEAF8",children}) => (
  <div style={{background:bg,border:`1px solid ${border}`,borderRadius:10,padding:"12px 15px",marginBottom:18,fontSize:12,color,lineHeight:1.7}}>{children}</div>
);

// ══════════════════════════════════════════════════════════════
export default function App() {
  // ── AUTH ─────────────────────────────────────────────────
  const [sbLoaded, setSbLoaded] = useState(false);
  const [authed,    setAuthed]    = useState(()=>sessionStorage.getItem("fp_auth")==="1");
  const [authUser,  setAuthUser]  = useState(()=>sessionStorage.getItem("fp_user")||"");
  const [authRole,  setAuthRole]  = useState(()=>sessionStorage.getItem("fp_role")||"admin");
  const [authUserId,setAuthUserId]= useState(()=>sessionStorage.getItem("fp_uid")||"");
  const [loginErr,  setLoginErr]  = useState("");
  const [loginLoad, setLoginLoad] = useState(false);
  const [showPass,  setShowPass]  = useState(false);
  const [loginForm, setLoginForm] = useState({user:"",pass:""});
  const [shakeErr,  setShakeErr]  = useState(false);

  // Credenziali — cambia qui username/password
  const USERS = [
    { user: "admin",      pass: "finpratica2026", nome: "Amministratore", role: "admin" },
    { user: "finpratica", pass: "crm2026!",        nome: "finpratica",     role: "user"  },
  ];

  async function loadProfileAndSetAuth(user) {
    try {
      const {data:prof} = await sb.from("profili").select("*").eq("id",user.id).single();
      const ruolo = prof?.ruolo||"admin";
      const nome  = prof?.nome||user.email;
      sessionStorage.setItem("fp_auth","1");
      sessionStorage.setItem("fp_user",nome);
      sessionStorage.setItem("fp_role",ruolo);
      sessionStorage.setItem("fp_uid",user.id);
      setAuthUser(nome);
      setAuthRole(ruolo);
      setAuthUserId(user.id);
      setAuthed(true);
    } catch {
      sessionStorage.setItem("fp_auth","1");
      sessionStorage.setItem("fp_role","admin");
      setAuthRole("admin");
      setAuthed(true);
    }
  }

  async function doLogin(e) {
    e && e.preventDefault && e.preventDefault();
    setLoginLoad(true); setLoginErr("");
    // 1) Try Supabase Auth
    try {
      const {data,error} = await sb.auth.signInWithPassword({email:loginForm.user, password:loginForm.pass});
      if (!error && data.user) {
        await loadProfileAndSetAuth(data.user);
        setLoginLoad(false);
        return;
      }
    } catch {}
    // 2) Local fallback (master credentials)
    await new Promise(r=>setTimeout(r,600));
    const found = USERS.find(u => u.user === loginForm.user && u.pass === loginForm.pass);
    if (found) {
      sessionStorage.setItem("fp_auth","1");
      sessionStorage.setItem("fp_user",found.nome);
      sessionStorage.setItem("fp_role","admin");
      sessionStorage.setItem("fp_uid","local_"+found.user);
      setAuthUser(found.nome); setAuthRole("admin");
      setAuthUserId("local_"+found.user);
      setAuthed(true);
    } else {
      setLoginErr("Credenziali non valide. Riprova.");
      setShakeErr(true);
      setTimeout(()=>setShakeErr(false),600);
    }
    setLoginLoad(false);
  }

  function doLogout() {
    sb.auth.signOut().catch(()=>{});
    sessionStorage.removeItem("fp_auth");
    sessionStorage.removeItem("fp_user");
    sessionStorage.removeItem("fp_role");
    sessionStorage.removeItem("fp_uid");
    setAuthed(false); setAuthUser(""); setAuthRole("admin"); setAuthUserId("");
    setLoginForm({user:"",pass:""});
  }

  // ── CRM STATE ─────────────────────────────────────────────
  const [clients,  setClients]  = useState(()=>{ try{ const s=localStorage.getItem("fp_clients"); return s?JSON.parse(s):SEED; }catch{ return SEED; } });
  const [provs,    setProvs]    = useState(()=>{ try{ const s=localStorage.getItem("fp_provs"); return s?JSON.parse(s):SEED_PROV; }catch{ return SEED_PROV; } });
  const [tab,      setTab]      = useState("dashboard");
  const [selId,    setSelId]    = useState(null);
  const [modal,    setModal]    = useState(null);
  const [form,     setForm]     = useState(emptyCl());
  const [provForm, setProvForm] = useState(emptyProv());
  const [selProv,  setSelProv]  = useState(null);
  const [search,   setSearch]   = useState("");
  const [fSvc,     setFSvc]     = useState("tutti");
  const [fProf,    setFProf]    = useState("tutti");
  const [aiMsgs,   setAiMsgs]   = useState([{r:"ai",t:"👋 Sono **FinpraticaAI**. Monitoro automaticamente le tue pratiche in scadenza e posso richiamare i clienti con messaggi personalizzati.\n\nCome posso aiutarti oggi?"}]);
  const [aiInput,  setAiInput]  = useState("");
  const [aiLoad,   setAiLoad]   = useState(false);
  const [leadQ,    setLeadQ]    = useState("pensionati INPS dipendenti pubblici Palermo cessione quinto");
  const [leadRes,  setLeadRes]  = useState([]);
  const [leadLoad, setLeadLoad] = useState(false);
  const [crifRes,  setCrifRes]  = useState(null);
  const [crifLoad, setCrifLoad] = useState(false);
  const [crifText,       setCrifText]       = useState("");
  const [crifAnalyzing,  setCrifAnalyzing]  = useState(false);
  const [crifFormResult, setCrifFormResult] = useState(null);
  const [cqDurata,    setCqDurata]    = useState(120);
  const [cqCategoria, setCqCategoria] = useState("STATALI_PUBBLICI");
  const [cqRisultati, setCqRisultati] = useState([]);
  const [cqSel,       setCqSel]       = useState(null);
  const [prevServizio, setPrevServizio] = useState("cessione_quinto");
  const [prevForm, setPrevForm] = useState({nome:"",importo:"",eta:"",categoria:"STATALI_PUBBLICI",durata:120});
  const [prevRisultati, setPrevRisultati] = useState([]);
  const [prevSel, setPrevSel] = useState(null);
  const [ppImporto, setPpImporto] = useState("");
  const [ppDurata, setPpDurata] = useState(36);
  const [ppReddito, setPpReddito] = useState("");
  const [ppRisultati, setPpRisultati] = useState([]);
  const [rText,    setRText]    = useState("");
  const [rDate,    setRDate]    = useState("");
  const [addR,     setAddR]     = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCid,  setPromoCid]  = useState("");
  const [provSearch,    setProvSearch]     = useState("");

  // ── LEAD FUNNEL ───────────────────────────────────────────
  const FUNNEL_STATI = ["nuovo","contattato","trattativa","chiuso_vinto","chiuso_perso"];
  const FUNNEL_CFG = {
    nuovo:        {label:"Nuovo",       color:"#6366F1",bg:"#EEF2FF",border:"#C7D2FE",i:"⭐"},
    contattato:   {label:"Contattato",  color:"#0891B2",bg:"#ECFEFF",border:"#A5F3FC",i:"📞"},
    trattativa:   {label:"Trattativa",  color:"#B45309",bg:"#FFFBEB",border:"#FDE68A",i:"🤝"},
    chiuso_vinto: {label:"Chiuso ✅",   color:"#16A34A",bg:"#F0FDF4",border:"#BBF7D0",i:"🏆"},
    chiuso_perso: {label:"Chiuso ❌",   color:"#DC2626",bg:"#FFF1F2",border:"#FECACA",i:"💔"},
  };
  const [funnelDrag,    setFunnelDrag]     = useState(null);
  const [funnelOver,    setFunnelOver]     = useState(null);

  // ── CSV IMPORT ────────────────────────────────────────────
  const [csvModal,      setCsvModal]       = useState(false);
  const [csvParsed,     setCsvParsed]      = useState([]);
  const [csvStep,       setCsvStep]        = useState("upload");
  const [csvSel,        setCsvSel]         = useState({});
  const csvRef = useRef(null);

  // ── CAMPAGNA LEAD FREDDI ──────────────────────────────────
  const [campagna,      setCampagna]       = useState(false);
  const [campagnaLoad,  setCampagnaLoad]   = useState(false);
  const [campagnaMsgs,  setCampagnaMsgs]   = useState({});
  const [campagnaSent,  setCampagnaSent]   = useState({});
  const [fileImportRows, setFileImportRows] = useState([]);
  const [fileImportOpen, setFileImportOpen] = useState(false);
  const [fileImportLoad, setFileImportLoad] = useState(false);
  const [fileImportScartati, setFileImportScartati] = useState([]);
  const fileImportRef = useRef(null);

  // ── YOUTUBE LEAD GEN ─────────────────────────────────────
  const [ytApiKey,      setYtApiKey]      = useState(()=>localStorage.getItem("fp_yt_key")||"");
  const [ytVideoUrl,    setYtVideoUrl]    = useState("");
  const [ytComments,    setYtComments]    = useState([]);
  const [ytLeads,       setYtLeads]       = useState([]);
  const [ytLoad,        setYtLoad]        = useState(false);
  const [ytLoadMsg,     setYtLoadMsg]     = useState("");
  const [ytStep,        setYtStep]        = useState("config"); // config|scanning|results
  const [ytMsgLoad,     setYtMsgLoad]     = useState({});
  const [ytMsgs,        setYtMsgs]        = useState({});
  const [ytImported,    setYtImported]    = useState({});
  const [ytKeywords,    setYtKeywords]    = useState("cessione del quinto,prestito pensionati,finanziamento dipendenti");

  function extractVideoId(url) {
    const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  async function scanYouTubeComments() {
    const videoId = extractVideoId(ytVideoUrl);
    if (!videoId) { alert("URL video non valido"); return; }
    if (!ytApiKey) { alert("Inserisci prima la YouTube Data API Key nella tab Impostazioni → YouTube"); return; }
    setYtLoad(true); setYtStep("scanning"); setYtComments([]); setYtLeads([]);
    try {
      setYtLoadMsg("📡 Recupero commenti dal video…");
      // Fetch comments from YouTube Data API v3
      const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&key=${ytApiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const comments = (data.items||[]).map(item => ({
        id: item.id,
        testo: item.snippet.topLevelComment.snippet.textDisplay,
        autore: item.snippet.topLevelComment.snippet.authorDisplayName,
        channelId: item.snippet.topLevelComment.snippet.authorChannelId?.value || "",
        likes: item.snippet.topLevelComment.snippet.likeCount,
        data: item.snippet.topLevelComment.snippet.publishedAt,
      }));
      setYtComments(comments);
      setYtLoadMsg(`✅ ${comments.length} commenti trovati — analisi IA in corso…`);

      // Use Groq to filter hot leads from comments
      const keywords = ytKeywords.split(",").map(k=>k.trim());
      const sys = `Sei un esperto lead generation per mediazione creditizia italiana (cessione del quinto, prestiti pensionati, dipendenti pubblici). Analizza questi commenti YouTube e identifica le persone che mostrano interesse reale per prestiti o finanziamenti. SOLO JSON array: [{"commentId":"...","autore":"...","testo":"...","interesse":"alto|medio|basso","motivo":"...","categoria":"pensionato|dipendente_pubblico|dipendente_privato|sconosciuto","messaggio_contatto":"..."}]`;
      const usr = `Parole chiave target: ${keywords.join(", ")}\n\nCommenti (max 50):\n${comments.slice(0,50).map((c,i)=>`[${i}] ${c.autore}: ${c.testo.slice(0,200)}`).join("\n")}`;
      const aiRes = await callAI(sys, usr);
      let leads = [];
      try { leads = JSON.parse(aiRes.replace(/```json|```/g,"").trim()); } catch { leads = []; }
      // Merge with original comment data for channelId
      leads = leads.map(l => {
        const orig = comments.find(c => c.id === l.commentId || c.autore === l.autore);
        return { ...l, channelId: orig?.channelId||"", likes: orig?.likes||0, data: orig?.data||"" };
      }).filter(l => l.interesse === "alto" || l.interesse === "medio");
      setYtLeads(leads);
      setYtStep("results");
    } catch(e) {
      setYtLoadMsg("❌ Errore: " + e.message);
      setYtStep("config");
    }
    setYtLoad(false);
  }

  async function generaMsgYT(lead) {
    setYtMsgLoad(p=>({...p,[lead.commentId]:true}));
    const sys = `Sei un consulente finpratica. Scrivi un messaggio YouTube (risposta al commento) professionale, cordiale, breve (max 3 righe). Invita la persona a contattarti privatamente per una consulenza gratuita. Non fare promesse di importi. Firma "Il team finpratica".`;
    const usr = `Utente: ${lead.autore}\nCategoria: ${lead.categoria}\nCommento: ${lead.testo}\nMotivo interesse: ${lead.motivo}`;
    const msg = await callAI(sys, usr);
    setYtMsgs(p=>({...p,[lead.commentId]:msg}));
    setYtMsgLoad(p=>({...p,[lead.commentId]:false}));
  }

  function importaLeadYT(lead) {
    const c = {
      ...emptyCl(true), id: uid(),
      nome: lead.autore,
      note: `Lead YouTube · Commento: "${lead.testo.slice(0,120)}" · Interesse: ${lead.interesse} · ${lead.motivo}`,
      canale: "youtube",
      fonte: "youtube_commenti",
      score: lead.interesse==="alto"?72:55,
      funnelStato: "nuovo",
      servizio: lead.categoria==="pensionato"?"cessione_quinto":lead.categoria==="dipendente_pubblico"?"cessione_quinto":"prestito_personale",
      ytChannelId: lead.channelId,
    };
    setClients(p=>[...p,c]);
    setYtImported(p=>({...p,[lead.commentId]:true}));
  }

  // ── WEBHOOK SYNC ──────────────────────────────────────────
  const [webhookUrl,    setWebhookUrl]     = useState(()=>localStorage.getItem("fp_webhook")||"");
  const [webhookModal,  setWebhookModal]   = useState(false);
  const [webhookSync,   setWebhookSync]    = useState(false);
  const [webhookLast,   setWebhookLast]    = useState(()=>localStorage.getItem("fp_webhook_last")||"");
  const [webhookCount,  setWebhookCount]   = useState(0);

  // ── IMPOSTAZIONI ──────────────────────────────────────────
  const loadCfg = (k,def) => { try{ return JSON.parse(localStorage.getItem("fp_cfg_"+k))||def; }catch{ return def; } };
  const saveCfg = (k,v)   => localStorage.setItem("fp_cfg_"+k, JSON.stringify(v));

  const [cfg, setCfg] = useState(() => loadCfg("main", {
    // Azienda
    ragioneSociale: "finpratica",
    partitaIva: "",
    oamNumero: "",
    indirizzo: "",
    citta: "Palermo",
    cap: "",
    sito: "",
    // Contatti
    telefono: "",
    whatsapp: "",
    whatsappTemplate: "Ciao {nome}, ti contatto da finpratica per aggiornarti sulla tua pratica.",
    email: "",
    // Email SMTP (Aruba / Gmail)
    emailProvider: "aruba",   // aruba | gmail | smtp
    smtpHost: "smtp.aruba.it",
    smtpPort: "465",
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
    gmailClientId: "",
    gmailClientSecret: "",
    gmailRefreshToken: "",
    // Notifiche
    notifNuovoLead: true,
    notifScadenza: true,
    notifProvvigione: false,
    notifEmail: "",
    notifWhatsapp: "",
    // CRM
    groqApiKey: "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",
    webhookServer: "",
    metaVerifyToken: "finpratica2026",
    firmaEmail: "",
    // YouTube
    youtubeApiKey: "",
    youtubeChannelId: "",
    youtubeLandingUrl: "",
    youtubeKeywords: "cessione del quinto,prestito pensionati,finanziamento dipendenti pubblici",
    // IA Provider
    iaProvider: "groq",
    geminiKey: "",
  }));
  const [cfgTab,   setCfgTab]   = useState("azienda");
  const [cfgSaved, setCfgSaved] = useState(false);
  const [cfgTest,  setCfgTest]  = useState({email:null, wa:null});
  const [socialLinks, setSocialLinks] = useState({facebook:"",instagram:"",tiktok:"",linkedin:"",youtube:""});
  const [socialSaved, setSocialSaved] = useState(false);

  function saveCfgAll(updates) {
    const next = {...cfg, ...updates};
    setCfg(next);
    saveCfg("main", next);
    setCfgSaved(true);
    setTimeout(()=>setCfgSaved(false), 2500);
  }
  async function loadSocialLinks(){
    try{
      const {data,error}=await sb.from("fp_impostazioni").select("value").eq("key","social_links").single();
      if(!error && data?.value) setSocialLinks(prev=>({...prev,...data.value}));
    }catch(e){console.warn("Social links load:",e.message);}
  }
  async function saveSocialLinks(){
    try{
      const {error}=await sb.from("fp_impostazioni").upsert({key:"social_links",value:socialLinks,updated_at:new Date().toISOString()},{onConflict:"key"});
      if(error) throw error;
      setSocialSaved(true); setTimeout(()=>setSocialSaved(false),2500);
    }catch(e){alert("Errore salvataggio social: "+e.message+"\n\nAssicurati che la tabella fp_impostazioni esista su Supabase.");}
  }
  async function testEmail() {
    setCfgTest(p=>({...p,email:"testing"}));
    await new Promise(r=>setTimeout(r,1500));
    setCfgTest(p=>({...p,email: cfg.smtpUser ? "ok" : "error"}));
  }
  async function callAI(system, user) {
    if ((cfg.iaProvider||"groq") === "gemini") {
      const key = cfg.geminiKey||"";
      if (!key) return "Errore: inserisci la Gemini API Key in Impostazioni → IA Provider.";
      return callGemini(system, user, key);
    }
    return groq(system, user, cfg.groqApiKey||GROQ_API_KEY);
  }

  async function testWhatsApp() {
    if(!cfg.whatsapp){ setCfgTest(p=>({...p,wa:"error"})); return; }
    const num = cfg.whatsapp.replace(/\D/g,"");
    window.open(`https://wa.me/${num}?text=Test+finpratica+CRM+✅`, "_blank");
    setCfgTest(p=>({...p,wa:"ok"}));
  }

  async function syncLeadDaServer() {
    if (!webhookUrl) { setWebhookModal(true); return; }
    setWebhookSync(true);
    try {
      const since = webhookLast || "2020-01-01";
      const url = webhookUrl.replace(/\/$/, "") + `/api/leads?since=${since}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.leads && data.leads.length > 0) {
        const nuovi = data.leads.filter(l => !clients.find(c => c.id === l.id));
        if (nuovi.length > 0) {
          setClients(prev => [...prev, ...nuovi.map(l => ({
            ...emptyCl(true),
            ...l,
            lead: true,
            funnelStato: l.funnel_stato || "nuovo",
            promemoria: l.promemoria || [],
          }))]);
          setWebhookCount(nuovi.length);
        }
        const now = new Date().toISOString();
        setWebhookLast(now);
        localStorage.setItem("fp_webhook_last", now);
      }
    } catch(e) { console.error("Sync error:", e); }
    setWebhookSync(false);
  }
  const [richiamoPopup,  setRichiamoPopup]  = useState(false);   // popup iniziale
  const [richiamoClient, setRichiamoClient] = useState(null);    // cliente selezionato per richiamo
  const [richiamoMsg,    setRichiamoMsg]    = useState("");       // messaggio generato
  const [richiamoLoad,   setRichiamoLoad]   = useState(false);
  const [richiamoSent,   setRichiamoSent]   = useState({});      // { clienteId: true }
  const [showRichiamoDetail, setShowRichiamoDetail] = useState(false);
  const popupShownRef = useRef(false);

  const chatRef = useRef(null);

  const notifs = clients.flatMap(c=>(c.promemoria||[]).filter(p=>!p.fatto&&new Date(p.data)<=new Date()).map(p=>({...p,cn:c.nome,cid:c.id})));
  const selCl  = clients.find(c=>c.id===selId);

  // ── Pratiche in scadenza / scadute (escluse non finanziabili) ─
  const praticheDaRichiamare = clients
    .filter(c => !c.lead && !c.nonFinanziabile)
    .map(c => ({ client: c, scad: calcolaScadenza(c) }))
    .filter(({scad}) => scad && (scad.stato === "scaduta" || scad.stato === "in_scadenza"))
    .sort((a,b) => a.scad.giorniMancanti - b.scad.giorniMancanti);

  useEffect(()=>{
    if(!sbLoaded) return;
    localStorage.setItem("fp_clients",JSON.stringify(clients));
    sb.from("fp_clienti").upsert(clients.map(c=>({id:c.id,data:c,updated_at:new Date().toISOString()})))
      .then(({error})=>{ if(error) console.warn("Supabase sync clients:",error.message); });
  },[clients,sbLoaded]);

  useEffect(()=>{
    if(!sbLoaded) return;
    localStorage.setItem("fp_provs",JSON.stringify(provs));
    if(provs.length>0)
      sb.from("fp_provvigioni").upsert(provs.map(p=>({id:p.id,data:p,updated_at:new Date().toISOString()})))
        .then(({error})=>{ if(error) console.warn("Supabase sync provs:",error.message); });
  },[provs,sbLoaded]);

  // ── UTENTI (admin only) ────────────────────────────────────
  const [utenti,        setUtenti]        = useState([]);
  const [utenteForm,    setUtenteForm]    = useState({nome:"",email:"",password:"",ruolo:"consulente"});
  const [utenteFormOpen,setUtenteFormOpen]= useState(false);
  const [utenteLoad,    setUtenteLoad]    = useState(false);

  async function loadUtenti() {
    setUtenteLoad(true);
    const {data} = await sb.from("profili").select("*").order("created_at",{ascending:true});
    if (data) setUtenti(data);
    setUtenteLoad(false);
  }
  async function saveUtente() {
    if (!utenteForm.nome||!utenteForm.email) return;
    setUtenteLoad(true);
    if (utenteForm.id) {
      await sb.from("profili").update({nome:utenteForm.nome,ruolo:utenteForm.ruolo}).eq("id",utenteForm.id);
    } else {
      const {data:au,error} = await sb.auth.signUp({email:utenteForm.email,password:utenteForm.password||"FinpraticaTmp1!"});
      if (error) { alert("Errore creazione: "+error.message); setUtenteLoad(false); return; }
      const uid_ = au.user?.id;
      if (uid_) await sb.from("profili").upsert({id:uid_,nome:utenteForm.nome,email:utenteForm.email,ruolo:utenteForm.ruolo});
    }
    await loadUtenti();
    setUtenteFormOpen(false);
    setUtenteForm({nome:"",email:"",password:"",ruolo:"consulente"});
    setUtenteLoad(false);
  }
  async function deleteUtente(id) {
    if (!window.confirm("Eliminare questo utente dal CRM?")) return;
    await sb.from("profili").delete().eq("id",id);
    setUtenti(prev=>prev.filter(u=>u.id!==id));
  }

  // Auth session check — restore Supabase session on page reload
  useEffect(()=>{
    sb.auth.getSession().then(({data:{session}})=>{
      if (session?.user && !authed) loadProfileAndSetAuth(session.user);
    });
    const {data:{subscription}} = sb.auth.onAuthStateChange((_ev,session)=>{
      if (!session) {
        sessionStorage.removeItem("fp_auth"); sessionStorage.removeItem("fp_role");
        sessionStorage.removeItem("fp_uid"); sessionStorage.removeItem("fp_user");
      }
    });
    return ()=>subscription.unsubscribe();
  },[]);

  // Supabase initial load
  useEffect(()=>{
    async function initSupabase(){
      try{
        const [{data:cr},{data:pr}]=await Promise.all([
          sb.from("fp_clienti").select("data").order("updated_at",{ascending:true}),
          sb.from("fp_provvigioni").select("data").order("updated_at",{ascending:true}),
        ]);
        if(cr?.length){
          const arr=cr.map(r=>r.data);
          setClients(arr);
          localStorage.setItem("fp_clients",JSON.stringify(arr));
        }
        if(pr?.length){
          const arr=pr.map(r=>r.data);
          setProvs(arr);
          localStorage.setItem("fp_provs",JSON.stringify(arr));
        }
      }catch(e){
        console.warn("Supabase non disponibile, uso localStorage:",e.message);
      }
      setSbLoaded(true);
    }
    initSupabase();
    loadSocialLinks();
  },[]);

  // Mostra popup all'avvio solo una volta
  useEffect(() => {
    if (!popupShownRef.current && praticheDaRichiamare.length > 0) {
      setTimeout(() => {
        setRichiamoPopup(true);
        popupShownRef.current = true;
      }, 1000);
    }
  }, []);

  useEffect(() => { chatRef.current?.scrollIntoView({behavior:"smooth"}); }, [aiMsgs]);

  // ── LOGIN SCREEN (dopo tutti gli hook per rispettare le Rules of Hooks) ──
  if (!authed) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#0B1829;font-family:'DM Sans',sans-serif}
        @keyframes floatUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
        @keyframes pulse{0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:0.7;transform:scale(1.05)}}
        @keyframes drift{0%{transform:translate(0,0) rotate(0deg)}33%{transform:translate(20px,-15px) rotate(120deg)}66%{transform:translate(-10px,20px) rotate(240deg)}100%{transform:translate(0,0) rotate(360deg)}}
        @keyframes gradShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        .fp-login-card{animation:floatUp 0.7s cubic-bezier(0.22,1,0.36,1) both}
        .fp-login-input:focus{border-color:#4A90D9!important;box-shadow:0 0 0 3px rgba(74,144,217,0.2)!important;outline:none}
        .fp-login-btn:hover{transform:translateY(-1px);box-shadow:0 8px 30px rgba(74,144,217,0.4)!important}
        .fp-login-btn:active{transform:translateY(0)}
        .fp-shake{animation:shake 0.5s cubic-bezier(0.36,0.07,0.19,0.97)}
      `}</style>

      {/* Background */}
      <div style={{position:"fixed",inset:0,background:"linear-gradient(135deg,#0B1829 0%,#1C3F6E 50%,#0D2340 100%)",backgroundSize:"200% 200%",animation:"gradShift 8s ease infinite"}}>
        {/* Decorative orbs */}
        {[
          {w:500,h:500,t:"-150px",l:"-150px",c:"rgba(74,144,217,0.08)",d:"12s"},
          {w:400,h:400,b:"-100px",r:"-100px",c:"rgba(28,63,110,0.15)",d:"16s"},
          {w:300,h:300,t:"40%",l:"60%",c:"rgba(74,144,217,0.06)",d:"20s"},
        ].map((o,i)=>(
          <div key={i} style={{position:"absolute",width:o.w,height:o.h,top:o.t,left:o.l,bottom:o.b,right:o.r,borderRadius:"50%",background:o.c,animation:`drift ${o.d} ease-in-out infinite`,filter:"blur(40px)"}}/>
        ))}
        {/* Grid pattern */}
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(74,144,217,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(74,144,217,0.04) 1px,transparent 1px)",backgroundSize:"60px 60px"}}/>
      </div>

      {/* Login card */}
      <div style={{position:"relative",zIndex:10,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div className="fp-login-card" style={{width:"100%",maxWidth:420}}>

          {/* Logo area */}
          <div style={{textAlign:"center",marginBottom:36}}>
            <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:80,height:80,marginBottom:20}}>
              <img src="/logo.png" alt="finpratica" style={{width:"100%",height:"100%",objectFit:"contain",mixBlendMode:"lighten",background:"transparent"}}/>
            </div>
            <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:28,fontWeight:900,color:"#fff",letterSpacing:"-0.03em",marginBottom:6}}>
              fin<span style={{color:"#4A90D9"}}>pratica</span>
            </div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",letterSpacing:"0.12em",textTransform:"uppercase",fontWeight:500}}>
              Gestionale Mediazione Creditizia
            </div>
          </div>

          {/* Card */}
          <div style={{background:"rgba(255,255,255,0.04)",backdropFilter:"blur(20px)",borderRadius:24,border:"1px solid rgba(255,255,255,0.08)",padding:"36px 36px 32px",boxShadow:"0 32px 80px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.06)"}}>
            <div style={{fontSize:20,fontWeight:700,color:"#fff",marginBottom:4,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Accedi al CRM</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:28}}>Inserisci le tue credenziali per continuare</div>

            <div className={shakeErr?"fp-shake":""}>
              {/* Username */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Username</div>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,opacity:0.4}}>👤</span>
                  <input
                    className="fp-login-input"
                    value={loginForm.user}
                    onChange={e=>setLoginForm(p=>({...p,user:e.target.value}))}
                    onKeyDown={e=>e.key==="Enter"&&doLogin()}
                    placeholder="Il tuo username"
                    autoComplete="username"
                    style={{width:"100%",padding:"13px 14px 13px 42px",background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:12,fontSize:15,color:"#fff",fontFamily:"inherit",transition:"all 0.2s"}}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{marginBottom:24}}>
                <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Password</div>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,opacity:0.4}}>🔒</span>
                  <input
                    className="fp-login-input"
                    type={showPass?"text":"password"}
                    value={loginForm.pass}
                    onChange={e=>setLoginForm(p=>({...p,pass:e.target.value}))}
                    onKeyDown={e=>e.key==="Enter"&&doLogin()}
                    placeholder="La tua password"
                    autoComplete="current-password"
                    style={{width:"100%",padding:"13px 46px 13px 42px",background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:12,fontSize:15,color:"#fff",fontFamily:"inherit",transition:"all 0.2s"}}
                  />
                  <button onClick={()=>setShowPass(p=>!p)} style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,opacity:0.4,padding:4,color:"#fff"}}>
                    {showPass?"🙈":"👁️"}
                  </button>
                </div>
              </div>

              {/* Error */}
              {loginErr&&(
                <div style={{background:"rgba(220,38,38,0.15)",border:"1px solid rgba(220,38,38,0.3)",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#FCA5A5",display:"flex",alignItems:"center",gap:8}}>
                  <span>⚠️</span>{loginErr}
                </div>
              )}

              {/* Submit */}
              <button
                className="fp-login-btn"
                onClick={doLogin}
                disabled={loginLoad||!loginForm.user||!loginForm.pass}
                style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:loginLoad||!loginForm.user||!loginForm.pass?"rgba(74,144,217,0.3)":"linear-gradient(135deg,#4A90D9,#2B6CB0)",color:"#fff",fontWeight:800,fontSize:15,cursor:loginLoad||!loginForm.user||!loginForm.pass?"not-allowed":"pointer",fontFamily:"'Plus Jakarta Sans',sans-serif",transition:"all 0.2s",letterSpacing:"0.01em",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
              >
                {loginLoad
                  ? <><div style={{width:18,height:18,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/> Accesso in corso…</>
                  : "→ Accedi al CRM"
                }
              </button>
            </div>
          </div>

          {/* Footer */}
          <div style={{textAlign:"center",marginTop:24,fontSize:12,color:"rgba(255,255,255,0.2)"}}>
            finpratica © {new Date().getFullYear()} · Mediazione Creditizia · OAM
          </div>
        </div>
      </div>
    </>
  );

  const stats = {
    tot:      clients.filter(c=>!c.lead).length,
    leads:    clients.filter(c=>c.lead).length,
    portfolio:clients.filter(c=>!c.lead).reduce((s,c)=>s+(+c.importo||0),0),
    gold:     clients.filter(c=>c.score>=75).length,
    buoni:    clients.filter(c=>c.score>=45&&c.score<75).length,
    bassi:    clients.filter(c=>c.score<45).length,
    trat:     clients.filter(c=>c.stato==="trattativa").length,
    totProv:  provs.reduce((s,p)=>s+(p.provvigioneTotale||0),0),
    daLiquid: provs.filter(p=>p.stato==="da_liquidare").reduce((s,p)=>s+(p.provvigioneTotale||0),0),
    liquidate:provs.filter(p=>p.stato==="liquidata").reduce((s,p)=>s+(p.provvigioneTotale||0),0),
    scadute:  praticheDaRichiamare.filter(x=>x.scad.stato==="scaduta").length,
    inScad:   praticheDaRichiamare.filter(x=>x.scad.stato==="in_scadenza").length,
  };

  // ── Lista clienti filtrata per TableView ──────────────────
  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || [c.nome,c.email,c.tel,c.datore].some(v=>(v||"").toLowerCase().includes(q));
    const matchSvc   = fSvc==="tutti"  || c.servizio===fSvc;
    const matchProf  = fProf==="tutti" || profilo(c.score).label.toLowerCase()===fProf;
    const matchOwner = authRole==="admin" || !c.consulente_id || c.consulente_id===authUserId;
    return matchSearch && matchSvc && matchProf && matchOwner;
  });

  // ── Provvigioni visibili per ruolo ─────────────────────────
  const visibleProvs = authRole==="segretaria" ? [] :
    authRole==="consulente" ? provs.filter(p=>{
      const cl=clients.find(c=>c.id===p.clienteId);
      return !cl?.consulente_id || cl.consulente_id===authUserId;
    }) : provs;

  // ── Genera messaggio di richiamo IA ───────────────────────
  async function generaRichiamo(client, scad) {
    setRichiamoLoad(true);
    setRichiamoMsg("");
    const sys = `Sei un consulente finanziario di finpratica, società di mediazione creditizia italiana. Scrivi un messaggio di richiamo professionale e cordiale per un cliente, da inviare via WhatsApp o SMS. Deve essere breve (max 5 righe), personalizzato, con tono caldo ma professionale. Non usare markdown. Non mettere oggetto email. Firma sempre "Il team finpratica".`;
    const usr = `Cliente: ${client.nome}
Servizio: ${scad.label}
Data inizio pratica: ${fdate(client.dataInizioPratica)}
Data scadenza: ${fdate(scad.scadenza)}
Stato: ${scad.stato === "scaduta" ? `Scaduta da ${scad.giorniDaScadenza} giorni` : `In scadenza tra ${scad.giorniMancanti} giorni`}
Reddito mensile: €${client.reddito}
Datore: ${client.datore}
Note: ${client.note || "nessuna"}
Obiettivo: invitarlo a rinnovare la pratica ${scad.label} con condizioni aggiornate e vantaggiose.`;
    const res = await callAI(sys, usr);
    setRichiamoMsg(res);
    setRichiamoLoad(false);
  }

  function apriRichiamo(client, scad) {
    setRichiamoClient({client, scad});
    setRichiamoMsg("");
    setShowRichiamoDetail(true);
    setRichiamoPopup(false);
    generaRichiamo(client, scad);
  }

  function segnaRichiamoInviato(clientId) {
    setRichiamoSent(p => ({...p, [clientId]: true}));
    // aggiunge promemoria automatico di follow-up
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 7);
    setClients(prev => prev.map(c => c.id !== clientId ? c : {
      ...c,
      promemoria: [...(c.promemoria||[]), {
        id: uid(),
        testo: "Follow-up richiamo pratica — verifica risposta cliente",
        data: followUpDate.toISOString().slice(0,10),
        fatto: false,
      }]
    }));
    setShowRichiamoDetail(false);
  }

  function segnaClienteNonFinanziabile(clientId) {
    setClients(prev => prev.map(c => c.id === clientId ? {...c, nonFinanziabile: true} : c));
    setShowRichiamoDetail(false);
    setRichiamoPopup(false);
  }

  // ── CRUD ──────────────────────────────────────────────────
  function saveCl(){
    if(!form.nome.trim())return;
    const c={...form,id:form.id||uid(),score:+form.score||50,importo:+form.importo||0,reddito:+form.reddito||0,eta:+form.eta||0};
    if(!form.id && authUserId) c.consulente_id=authUserId;
    setClients(prev=>form.id?prev.map(x=>x.id===c.id?c:x):[...prev,c]);
    setModal(null); setSelId(c.id);
  }
  function delCl(id){
    if(authRole==="segretaria"){alert("La segretaria non può eliminare clienti.");return;}
    if(authRole==="consulente"){
      const cl=clients.find(c=>c.id===id);
      if(cl?.consulente_id && cl.consulente_id!==authUserId){alert("Puoi eliminare solo i tuoi clienti.");return;}
    }
    if(!window.confirm("Eliminare questo cliente?"))return;
    setClients(prev=>prev.filter(c=>c.id!==id));
    setSelId(null); setModal(null);
    sb.from("fp_clienti").delete().eq("id",id)
      .then(({error})=>{ if(error) console.warn("Supabase delete client:",error.message); });
  }
  function calcProv(pf){
    const imp=+pf.importoFinanziato||0,b=+pf.provvigionePercBanca||0,m=+pf.provvigionePercMediatore||0;
    const pb=+(imp*(b/100)).toFixed(2),pm=+(imp*(m/100)).toFixed(2);
    return {provvigioneBanca:pb,provvigioneMediatore:pm,provvigioneTotale:+(pb+pm).toFixed(2)};
  }
  function saveProv(){
    const calc=calcProv(provForm);
    const p={...provForm,...calc,id:provForm.id||uid(),importoFinanziato:+provForm.importoFinanziato||0,durataMesi:+provForm.durataMesi||0,tanPerc:+provForm.tanPerc||0,taegPerc:+provForm.taegPerc||0,provvigionePercBanca:+provForm.provvigionePercBanca||0,provvigionePercMediatore:+provForm.provvigionePercMediatore||0};
    setProvs(prev=>provForm.id?prev.map(x=>x.id===p.id?p:x):[...prev,p]);
    setModal(null);
  }
  async function analizzaCRIFForm(){
    if(!crifText.trim())return;
    setCrifAnalyzing(true); setCrifFormResult(null);
    const soglie=CRIF_SOGLIE[form.servizio]||{ottimo:700,medio:400};
    const svcLabel=SVC[form.servizio]?.label||form.servizio;
    const sys=`Sei un analista creditizio italiano esperto di CRIF e CTC. Analizza il report fornito e restituisci SOLO JSON valido senza markdown: {"punteggio":NUMBER_tra_0_e_999,"livello":"ottimo"|"medio"|"basso","motivazione":"stringa massimo 80 caratteri"}. Soglie per ${svcLabel}: ottimo>=${soglie.ottimo}, medio>=${soglie.medio}, basso<${soglie.medio}.`;
    const res=await callAI(sys,`Report CRIF/CTC da analizzare:\n${crifText}`);
    try{
      const parsed=JSON.parse(res.replace(/```json|```/g,"").trim());
      const punteggio=Math.min(999,Math.max(0,Math.round(+parsed.punteggio||0)));
      const livello=["ottimo","medio","basso"].includes(parsed.livello)?parsed.livello:(punteggio>=soglie.ottimo?"ottimo":punteggio>=soglie.medio?"medio":"basso");
      const result={punteggio,livello,motivazione:parsed.motivazione||""};
      setCrifFormResult(result);
      const score100=Math.round(punteggio/9.99);
      setForm(p=>({...p,score:score100,crifScore:punteggio}));
    }catch{
      setCrifFormResult({punteggio:0,livello:"basso",motivazione:"Impossibile analizzare il report. Riprova."});
    }
    setCrifAnalyzing(false);
  }

  function calcolaBibanca(){
    const importo=+form.importo||10000;
    const eta=+form.eta||50;
    console.log("[Bibanca Form] Params:", {categoria:cqCategoria, durata:cqDurata, eta, importo});
    const risultati=confrontaCanali(cqCategoria,cqDurata,eta,importo);
    console.log("[Bibanca Form] Raw results:", risultati);
    // DIGITAL usa tan_max invece di tan_0_15 → normalizziamo e filtriamo invalidi
    const normalized=risultati.map(r=>({...r,tan_applicato:r.tan_applicato??r.tan_max??0})).filter(r=>r.tan_applicato>0);
    const withRata=normalized.map(r=>({...r,rata:calcolaRata(importo,r.tan_applicato,cqDurata)}));
    console.log("[Bibanca Form] Final results:", withRata);
    setCqRisultati(withRata);
    if(withRata.length>0) setCqSel(withRata[0].codice);
  }
  function calcolaPrevBibanca(){
    const importo=+prevForm.importo||0;
    const eta=+prevForm.eta||0;
    if(!importo||!eta){alert("Inserisci importo ed età per calcolare il preventivo.");return;}
    console.log("[Bibanca Prev] Params:", {categoria:prevForm.categoria, durata:prevForm.durata, eta, importo});
    const risultati=confrontaCanali(prevForm.categoria,prevForm.durata,eta,importo);
    console.log("[Bibanca Prev] Raw results:", risultati);
    // DIGITAL usa tan_max invece di tan_0_15 → normalizziamo e filtriamo invalidi
    const normalized=risultati.map(r=>({...r,tan_applicato:r.tan_applicato??r.tan_max??0})).filter(r=>r.tan_applicato>0);
    const withRata=normalized.map(r=>({...r,rata:calcolaRata(importo,r.tan_applicato,prevForm.durata)}));
    console.log("[Bibanca Prev] Final results:", withRata);
    setPrevRisultati(withRata);
    if(withRata.length>0) setPrevSel(withRata[0].codice);
  }
  function calcolaPP(){
    const importo=+ppImporto||0;
    if(!importo){alert("Inserisci l'importo richiesto.");return;}
    console.log("[PP] Params:",{importo,durata:ppDurata,reddito:+ppReddito||0});
    const risultati=confrontaPrestitoPersonale(importo,ppDurata);
    console.log("[PP] Results:",risultati);
    setPpRisultati(risultati);
  }

  async function runCRIF(c){
    setCrifLoad(true);setCrifRes(null);setModal("crif");
    const sys=`Sei un analista creditizio italiano. Restituisci SOLO JSON: {"score":NUMBER,"giudizio":"POSITIVO|NEGATIVO|DA VALUTARE","motivazione":"...","rischi":["..."],"opportunita":["..."],"raccomandazione":"..."}`;
    const usr=`Cliente:${c.nome}, Età:${c.eta}, Reddito:€${c.reddito}/mese, Datore:${c.datore}, Servizio:${SVC[c.servizio]?.label}, Importo:€${c.importo}, Note:${c.note||"nessuna"}`;
    const res=await callAI(sys,usr);
    let parsed;
    try{parsed=JSON.parse(res.replace(/```json|```/g,"").trim());}
    catch{parsed={score:50,giudizio:"DA VALUTARE",motivazione:res,rischi:[],opportunita:[],raccomandazione:"Valutazione manuale."}}
    setCrifRes(parsed);
    setClients(prev=>prev.map(x=>x.id===c.id?{...x,score:parsed.score}:x));
    setCrifLoad(false);
  }
  async function searchLeads(){
    setLeadLoad(true);setLeadRes([]);
    const sys=`Sei esperto lead generation mediazione creditizia italiana. SOLO JSON array: [{"nome":"...","fonte":"LinkedIn|Facebook|Instagram|Google","professione":"...","eta":NUMBER,"interesse":"...","probabilita":NUMBER,"telefono":"3XX-XXXXXXX","email":"...","note":"..."}]`;
    const usr=`Zona:Sicilia/Palermo. Target:${leadQ}. Priorità:dipendenti pubblici,pensionati INPS,forze ordine.`;
    const res=await callAI(sys,usr);
    try{setLeadRes(JSON.parse(res.replace(/```json|```/g,"").trim()));}catch{setLeadRes([]);}
    setLeadLoad(false);
  }
  async function sendAI(msg){
    const m=msg||aiInput;if(!m.trim())return;
    setAiInput("");
    setAiMsgs(p=>[...p,{r:"user",t:m}]);
    setAiLoad(true);
    const crmCtx=JSON.stringify({
      clienti:clients.map(c=>({id:c.id,nome:c.nome,tel:c.tel,email:c.email,stato:c.stato,servizio:c.servizio,eta:c.eta,datore:c.datore,note:c.note,importo:c.importo,lead:c.lead,ultimoContatto:c.ultimoContatto,dataIns:c.dataIns,promemoria:c.promemoria})),
      stats:{clienti:stats.tot,lead:stats.leads,scadute:stats.scadute,portfolio:stats.portfolio}
    });
    const sys=`Sei FinpraticaAI Super Agente di finpratica (mediazione creditizia italiana). Analizza il messaggio e rispondi SEMPRE con JSON valido:\n{"intent":"<intent>","action":{...},"response":"<risposta in italiano>"}\nIntent possibili:\n- "chat": domanda generica senza azione CRM\n- "add_client": aggiunge cliente/lead. action:{nome,tel,email,datore,eta,servizio,note_extra}\n- "update_status": cambia stato cliente. action:{nome,stato} stato=attivo|trattativa|archiviato|lead\n- "filter_leads": lead senza risposta. action:{giorni}\n- "add_note": aggiunge nota a cliente. action:{nome,nota}\n- "create_quote": preventivo precompilato. action:{eta,importo,durata,servizio,categoria}\n- "generate_whatsapp": genera testo WhatsApp. action:{nome,motivo} — metti il testo nel campo response\n- "generate_email": genera email. action:{tipo,motivo} — metti il testo nel campo response\n- "generate_post": genera post social. action:{piattaforma,target} — metti il testo+hashtag nel campo response\n- "generate_story": genera story. action:{target} — metti il testo nel campo response\n- "add_reminder": aggiunge promemoria. action:{nome_cliente,testo,data_iso,ora}\n- "show_reminders": appuntamenti settimana. action:{}\nCRM attuale: ${crmCtx}\nRispondi SOLO con JSON valido, niente testo extra.`;
    const raw=await callAI(sys,m);
    let parsed;
    try{parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());}catch{
      setAiMsgs(p=>[...p,{r:"ai",t:raw}]);setAiLoad(false);return;
    }
    const {intent,action,response}=parsed;
    let actionDone=false;let actionMsg="";
    if(intent==="add_client"&&action?.nome){
      const nc={...emptyCl(true),id:uid(),nome:action.nome,tel:action.tel||"",email:action.email||"",datore:action.datore||"",eta:action.eta||"",servizio:["cessione_quinto","mutuo","prestito_personale"].includes(action.servizio)?action.servizio:"cessione_quinto",note:action.note_extra||"",stato:"lead",lead:true,canale:"chat_ai",ultimoContatto:today(),dataIns:today()};
      setClients(p=>[...p,nc]);
      actionDone=true;actionMsg=`✅ Fatto! Cliente "${action.nome}" aggiunto come lead nel CRM.`;
    } else if(intent==="update_status"&&action?.nome&&action?.stato){
      const nomeL=action.nome.toLowerCase();
      setClients(prev=>prev.map(c=>c.nome.toLowerCase().includes(nomeL)?{...c,stato:action.stato,lead:action.stato==="lead"}:c));
      actionDone=true;actionMsg=`✅ Fatto! "${action.nome}" → stato aggiornato: ${STATI[action.stato]?.label||action.stato}.`;
    } else if(intent==="filter_leads"&&action){
      const giorni=action.giorni||3;const cutoff=new Date();cutoff.setDate(cutoff.getDate()-giorni);
      const filtrati=clients.filter(c=>c.lead&&new Date(c.ultimoContatto)<cutoff);
      actionDone=true;actionMsg=`✅ Lead senza risposta da ${giorni}+ giorni (${filtrati.length} trovati):\n${filtrati.length>0?filtrati.map(c=>`• ${c.nome} — tel: ${c.tel||"n.d."} — ultimo contatto: ${fdate(c.ultimoContatto)}`).join("\n"):"Nessun lead trovato con questi criteri."}`;
    } else if(intent==="add_note"&&action?.nome&&action?.nota){
      const nomeL=action.nome.toLowerCase();
      setClients(prev=>prev.map(c=>c.nome.toLowerCase().includes(nomeL)?{...c,note:(c.note?c.note+"\n":"")+action.nota}:c));
      actionDone=true;actionMsg=`✅ Fatto! Nota salvata per "${action.nome}": ${action.nota}`;
    } else if(intent==="create_quote"&&action){
      setPrevForm({nome:action.nome||"",importo:action.importo||"",eta:action.eta||"",categoria:action.categoria||"PENSIONATI",durata:action.durata||96});
      if(action.servizio&&["cessione_quinto","mutuo","prestito_personale"].includes(action.servizio))setPrevServizio(action.servizio);
      setTab("preventivi");
      actionDone=true;actionMsg=`✅ Fatto! Preventivo precompilato aperto nella sezione Preventivi.`;
    } else if(intent==="add_reminder"&&action?.testo){
      const dataR=action.data_iso||(()=>{const d=new Date();d.setDate(d.getDate()+1);return d.toISOString().slice(0,10);})();
      const testoR=action.testo+(action.ora?` alle ${action.ora}`:"");
      if(action.nome_cliente){
        const nomeL=action.nome_cliente.toLowerCase();
        setClients(prev=>prev.map(c=>c.nome.toLowerCase().includes(nomeL)?{...c,promemoria:[...(c.promemoria||[]),{id:uid(),testo:testoR,data:dataR,fatto:false}]}:c));
        actionDone=true;actionMsg=`✅ Fatto! Promemoria aggiunto per "${action.nome_cliente}": "${testoR}" il ${fdate(dataR)}.`;
      } else {
        actionDone=true;actionMsg=`✅ Promemoria creato: "${testoR}" per il ${fdate(dataR)}.`;
      }
    } else if(intent==="show_reminders"){
      const oggi=new Date();const fineSett=new Date();fineSett.setDate(oggi.getDate()+7);
      const lista=clients.flatMap(c=>(c.promemoria||[]).filter(p=>!p.fatto&&new Date(p.data)>=oggi&&new Date(p.data)<=fineSett).map(p=>({...p,cliente:c.nome})));
      lista.sort((a,b)=>new Date(a.data)-new Date(b.data));
      actionDone=true;actionMsg=`✅ Appuntamenti questa settimana (${lista.length}):\n${lista.length>0?lista.map(p=>`• ${fdate(p.data)} — ${p.testo} [${p.cliente}]`).join("\n"):"Nessun appuntamento per questa settimana."}`;
    }
    const finalT=actionDone?actionMsg+(response?`\n\n💬 ${response}`:""):response;
    setAiMsgs(p=>[...p,{r:"ai",t:finalT,actionDone}]);
    setAiLoad(false);
  }
  function addLeadFromSearch(l){
    const c={...emptyCl(true),id:uid(),nome:l.nome,email:l.email||"",tel:l.telefono||"",note:`Lead da ${l.fonte} – ${l.interesse}`,canale:(l.fonte||"web").toLowerCase(),score:l.probabilita||55,eta:l.eta||0,funnelStato:"nuovo"};
    setClients(p=>[...p,c]);
  }
  function moveFunnel(leadId, nuovoStato){
    setClients(prev=>prev.map(c=>c.id===leadId?{...c,funnelStato:nuovoStato,stato:nuovoStato==="chiuso_vinto"?"attivo":nuovoStato==="chiuso_perso"?"archiviato":"lead",lead:nuovoStato!=="chiuso_vinto"}:c));
  }
  function converti(leadId){
    setClients(prev=>prev.map(c=>c.id===leadId?{...c,lead:false,stato:"attivo",funnelStato:"chiuso_vinto"}:c));
  }

  // ── CSV parse ─────────────────────────────────────────────
  function parseCSV(text){
    const rows = text.trim().split("\n").map(r=>r.split(/[,;]\s*/));
    if(rows.length < 2) return [];
    const headers = rows[0].map(h=>h.toLowerCase().trim().replace(/['"]/g,""));
    const find = (keys) => { for(const k of keys){ const i=headers.findIndex(h=>h.includes(k)); if(i>=0) return i; } return -1; };
    const iNome=find(["nome","name","cognome"]); const iTel=find(["tel","phone","cellulare","numero"]);
    const iEmail=find(["email","mail"]); const iServ=find(["servizio","prodotto","service"]);
    const iNote=find(["note","notes","commento"]); const iCanale=find(["canale","source","fonte"]);
    return rows.slice(1).filter(r=>r.length>1).map((r,i)=>({
      _idx:i, nome:r[iNome]?.trim()||`Lead CSV ${i+1}`,
      tel:r[iTel]?.trim()||"", email:r[iEmail]?.trim()||"",
      servizio:r[iServ]?.trim()||"cessione_quinto",
      note:r[iNote]?.trim()||"", canale:r[iCanale]?.trim()||"csv",
    }));
  }
  function handleCSVFile(file){
    if(!file) return;
    const reader=new FileReader();
    reader.onload=e=>{
      const rows=parseCSV(e.target.result);
      setCsvParsed(rows);
      setCsvSel(Object.fromEntries(rows.map(r=>[r._idx,true])));
      setCsvStep("preview");
    };
    reader.readAsText(file);
  }
  function importCSVSelected(){
    const toImport=csvParsed.filter(r=>csvSel[r._idx]);
    const newLeads=toImport.map(r=>({
      ...emptyCl(true),id:uid(),nome:r.nome,tel:r.tel,email:r.email,
      servizio:["cessione_quinto","mutuo","prestito_personale"].includes(r.servizio)?r.servizio:"cessione_quinto",
      note:r.note, canale:r.canale||"csv", score:55, funnelStato:"nuovo",
    }));
    setClients(p=>[...p,...newLeads]);
    setCsvStep("done");
  }

  // ── Campagna lead freddi ──────────────────────────────────
  async function generaCampagna(leadiFreddi){
    setCampagnaLoad(true);
    const sys=`Sei un consulente finpratica. Genera messaggi WhatsApp di riattivazione per lead freddi, brevi, personalizzati, tono caldo. SOLO JSON: {"messaggi":[{"id":"...","msg":"..."}]}`;
    const usr=`Lead da riattivare:\n${leadiFreddi.map(l=>`- ${l.nome}, ${l.datore||"lavoratore"}, interessato a ${SVC[l.servizio]?.label}`).join("\n")}`;
    const res=await callAI(sys,usr);
    try{
      const parsed=JSON.parse(res.replace(/```json|```/g,"").trim());
      const map={};
      parsed.messaggi?.forEach((m,i)=>{ if(leadiFreddi[i]) map[leadiFreddi[i].id]=m.msg; });
      setCampagnaMsgs(map);
    }catch{ const map={}; leadiFreddi.forEach(l=>{map[l.id]=`Ciao ${l.nome}, ti contatto per proporti condizioni aggiornate per la tua pratica. Il team finpratica è a tua disposizione.`;}); setCampagnaMsgs(map); }
    setCampagnaLoad(false);
  }

  // ── IMPORT DA FILE (Excel / Word) ─────────────────────────
  async function parseExcelImport(file){
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf,{type:"array"});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
    if(!raw.length) return [];
    const hdr = raw[0].map(h=>String(h).toLowerCase().trim());
    const find=(...keys)=>{for(const k of keys){const i=hdr.findIndex(h=>h.includes(k));if(i>=0)return i;}return -1;};
    const nI=find("nome","nominativo","cognome","name","cliente","intestatario");
    const tI=find("tel","telefono","phone","cellulare","mobile","cel");
    const eI=find("email","mail","e-mail");
    const hasHdr=nI>=0;
    const start=hasHdr?1:0;
    const ni=hasHdr?nI:0, ti=hasHdr?(tI>=0?tI:1):1, ei=hasHdr?eI:-1;
    return raw.slice(start).map(r=>({
      nome:String(r[ni]||"").trim(),
      tel:ti>=0?String(r[ti]||"").trim():"",
      email:ei>=0?String(r[ei]||"").trim():"",
    })).filter(r=>r.nome.length>1);
  }
  async function parseDocxImport(file){
    const mammoth = await import("mammoth");
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({arrayBuffer:buf});
    const EMAIL_RE=/[\w.+%-]+@[\w-]+\.[a-zA-Z]{2,}/g;
    const TEL_RE=/(\+39\s?)?[0-9]{3}[\s\-.−]?[0-9]{3,4}[\s\-.−]?[0-9]{3,4}/g;
    const lines=result.value.split(/\n|\r/).map(l=>l.trim()).filter(Boolean);
    return lines.map(line=>{
      const emails=line.match(EMAIL_RE)||[];
      const tels=line.match(TEL_RE)||[];
      const nome=line.replace(EMAIL_RE,"").replace(TEL_RE,"").replace(/[;,|]/g," ").replace(/\s+/g," ").trim();
      return{nome,tel:tels[0]||"",email:emails[0]||""};
    }).filter(r=>r.nome.length>2);
  }
  async function handleFileImport(file){
    setFileImportLoad(true);
    try{
      const ext=file.name.split(".").pop().toLowerCase();
      let rows=[];
      if(ext==="xlsx"||ext==="xls") rows=await parseExcelImport(file);
      else if(ext==="docx")          rows=await parseDocxImport(file);
      else{alert("Formato non supportato. Usa .xlsx, .xls o .docx");setFileImportLoad(false);return;}
      if(!rows.length){alert("Nessun nominativo trovato nel file.");setFileImportLoad(false);return;}
      // ── Filtro IA Groq ─────────────────────────────────────
      let validi=rows, scartati=[];
      try{
        const sys=`Sei un assistente CRM. Analizza i nominativi e restituisci SOLO JSON valido, nessun testo extra.\nFormato: {"risultati":[{"idx":0,"valido":true},{"idx":1,"valido":false,"motivo":"Motivo breve"}]}\nCriteri:\n- valido=true: nome E cognome presenti (almeno 2 parole reali, non generiche come "N/A","Cliente","Utente") + telefono con almeno 9 cifre\n- valido=false: nome incompleto/generico/mancante OPPURE telefono mancante/invalido/troppo corto\n- motivo: massimo 5 parole in italiano (es. "Telefono mancante", "Solo nome", "Numero troppo corto", "Nome non valido")`;
        const usr=`Valida questi nominativi (idx è l'indice originale, usalo nel risultato):\n${JSON.stringify(rows.map((r,i)=>({idx:i,nome:r.nome,tel:r.tel||""})))}`;
        const res=await callAI(sys,usr);
        const match=res.match(/\{[\s\S]*\}/);
        if(match){
          const parsed=JSON.parse(match[0]);
          if(Array.isArray(parsed.risultati)){
            const vArr=[],sArr=[],handled=new Set();
            for(const item of parsed.risultati){
              const r=rows[item.idx];
              if(!r||handled.has(item.idx))continue;
              handled.add(item.idx);
              if(item.valido) vArr.push(r);
              else sArr.push({...r,motivo:item.motivo||"Dati non validi"});
            }
            rows.forEach((_,i)=>{if(!handled.has(i))vArr.push(rows[i]);});
            validi=vArr; scartati=sArr;
          }
        }
      }catch(e){console.warn("Filtro IA non disponibile, importo tutti:",e.message);}
      setFileImportRows(validi);
      setFileImportScartati(scartati);
      setFileImportOpen(true);
    }catch(e){alert("Errore nella lettura del file: "+e.message);}
    setFileImportLoad(false);
  }
  function confirmFileImport(){
    const newLeads=fileImportRows.map(r=>({
      ...emptyCl(true),id:uid(),
      nome:r.nome,tel:r.tel||"",email:r.email||"",
      canale:"import",funnelStato:"nuovo",score:50,
    }));
    setClients(prev=>[...prev,...newLeads]);
    setFileImportOpen(false);
    setFileImportRows([]);
    setFileImportScartati([]);
  }

  function toggleR(cid,rid){setClients(p=>p.map(c=>c.id!==cid?c:{...c,promemoria:c.promemoria.map(r=>r.id===rid?{...r,fatto:!r.fatto}:r)}));}
  function addReminder(cid){if(!rText||!rDate)return;setClients(p=>p.map(c=>c.id!==cid?c:{...c,promemoria:[...c.promemoria,{id:uid(),testo:rText,data:rDate,fatto:false}]}));setRText("");setRDate("");setAddR(false);}

  // (UI atoms are defined at module level for stable identities)

  // ══════════════════════════════════════════════════════════
  // POPUP RICHIAMO ALL'AVVIO
  // ══════════════════════════════════════════════════════════
  const RichiamoPopup = () => (
    <div style={{position:"fixed",inset:0,background:"rgba(28,63,110,0.45)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"}}>
      <div style={{background:C.white,borderRadius:20,width:"100%",maxWidth:640,maxHeight:"88vh",overflow:"auto",boxShadow:"0 24px 60px rgba(28,63,110,0.25)",animation:"fadeIn 0.3s ease"}}>
        {/* Header */}
        <div style={{padding:"22px 26px 18px",background:`linear-gradient(135deg,${C.navy},${C.blue})`,borderRadius:"20px 20px 0 0",color:"#fff"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
            <div style={{width:48,height:48,borderRadius:14,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>🔔</div>
            <div>
              <div style={{fontSize:18,fontWeight:800,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Pratiche da Richiamare</div>
              <div style={{fontSize:13,opacity:0.85,marginTop:2}}>Il motore IA ha rilevato {praticheDaRichiamare.length} clienti da ricontattare</div>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:4}}>
            {stats.scadute>0&&<div style={{background:"rgba(220,38,38,0.25)",border:"1px solid rgba(220,38,38,0.4)",borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700}}>🔴 {stats.scadute} scadute</div>}
            {stats.inScad>0&&<div style={{background:"rgba(234,88,12,0.25)",border:"1px solid rgba(234,88,12,0.4)",borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700}}>🟡 {stats.inScad} in scadenza</div>}
          </div>
        </div>

        <div style={{padding:"18px 26px"}}>
          {praticheDaRichiamare.map(({client:cl,scad},i)=>(
            <div key={cl.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderBottom:i<praticheDaRichiamare.length-1?`1px solid ${C.border}`:"none"}}>
              <Avatar name={cl.nome} score={cl.score} size={44}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                  <div style={{fontWeight:800,fontSize:15,color:C.text}}>{cl.nome}</div>
                  {richiamoSent[cl.id]&&<span style={{fontSize:11,background:"#F0FDF4",color:"#15803D",border:"1px solid #BBF7D0",borderRadius:20,padding:"2px 8px",fontWeight:700}}>✅ Richiamato</span>}
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  <Chip {...SVC[cl.servizio]} label={SVC[cl.servizio].label} style={{fontSize:11}}/>
                  <ScadenzaBadge scad={scad}/>
                  <ScoreChip score={cl.score}/>
                </div>
                <div style={{fontSize:12,color:C.muted,marginTop:4}}>
                  {cl.datore} · Reddito €{cl.reddito}/mese · {fdate(cl.dataInizioPratica)} → {fdate(scad.scadenza)}
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                <Btn variant="blue" style={{fontSize:12,padding:"7px 14px",whiteSpace:"nowrap"}} onClick={()=>apriRichiamo(cl,scad)}>
                  🤖 Genera Richiamo IA
                </Btn>
                <Btn variant="ghost" style={{fontSize:12,padding:"7px 14px",whiteSpace:"nowrap"}} onClick={()=>{setSelId(cl.id);setTab("clienti");setRichiamoPopup(false);}}>
                  Apri scheda →
                </Btn>
              </div>
            </div>
          ))}
        </div>

        <div style={{padding:"14px 26px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <button onClick={()=>{setTab("richiami");setRichiamoPopup(false);}} style={{fontSize:13,fontWeight:700,color:C.navy,background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit"}}>
            Vai alla sezione Richiami →
          </button>
          <Btn variant="ghost" onClick={()=>setRichiamoPopup(false)}>Chiudi per ora</Btn>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // MODAL DETTAGLIO RICHIAMO IA
  // ══════════════════════════════════════════════════════════
  const RichiamoDetailModal = () => {
    if (!richiamoClient) return null;
    const {client:cl, scad} = richiamoClient;
    return (
      <div onClick={e=>e.target===e.currentTarget&&setShowRichiamoDetail(false)} style={{position:"fixed",inset:0,background:"rgba(28,63,110,0.45)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"}}>
        <div style={{background:C.white,borderRadius:20,width:"100%",maxWidth:580,maxHeight:"92vh",overflow:"auto",boxShadow:"0 24px 60px rgba(28,63,110,0.25)",animation:"fadeIn 0.25s ease"}}>
          {/* header */}
          <div style={{padding:"20px 24px 16px",background:`linear-gradient(135deg,${C.navy},${C.blue})`,borderRadius:"20px 20px 0 0",color:"#fff"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,opacity:0.75,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Richiamo IA — {scad.label}</div>
                <div style={{fontSize:20,fontWeight:800,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{cl.nome}</div>
                <div style={{fontSize:13,opacity:0.8,marginTop:4}}>
                  {scad.stato==="scaduta" ? `⚠️ Pratica scaduta da ${scad.giorniDaScadenza} giorni` : `🕐 Scade in ${scad.giorniMancanti} giorni`}
                </div>
              </div>
              <button onClick={()=>setShowRichiamoDetail(false)} style={{width:32,height:32,borderRadius:8,border:"1px solid rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.1)",cursor:"pointer",fontSize:16,color:"#fff",flexShrink:0}}>×</button>
            </div>
          </div>

          <div style={{padding:"20px 24px"}}>
            {/* Info cliente */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
              {[["Servizio",scad.label],["Reddito",`€${cl.reddito}/mese`],["Datore",cl.datore],["Data inizio",fdate(cl.dataInizioPratica)],["Scadenza",fdate(scad.scadenza)],["Score",cl.score]].map(([l,v])=>(
                <div key={l} style={{background:C.light,borderRadius:9,padding:"10px 12px",border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3}}>{l}</div>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>{v}</div>
                </div>
              ))}
            </div>

            {/* Messaggio IA */}
            <div style={{marginBottom:18}}>
              <div style={{fontSize:11,fontWeight:700,color:C.navy,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                🤖 Messaggio generato dall'IA
                <button onClick={()=>generaRichiamo(cl,scad)} style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.navyTint}`,background:C.navyBg,cursor:"pointer",color:C.navy,fontWeight:700,fontFamily:"inherit"}}>
                  🔄 Rigenera
                </button>
              </div>
              {richiamoLoad ? (
                <div style={{background:C.light,borderRadius:12,padding:"24px",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:36,height:36,border:`3px solid ${C.border}`,borderTopColor:C.navy,borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}}/>
                  <div>
                    <div style={{fontWeight:700,color:C.navy,fontSize:14}}>FinpraticaAI sta scrivendo…</div>
                    <div style={{fontSize:12,color:C.muted,marginTop:2}}>Personalizzando il messaggio per {cl.nome}</div>
                  </div>
                </div>
              ) : (
                <div style={{position:"relative"}}>
                  <textarea
                    value={richiamoMsg}
                    onChange={e=>setRichiamoMsg(e.target.value)}
                    style={{width:"100%",background:C.navyBg,border:`1.5px solid ${C.navyTint}`,borderRadius:12,padding:"16px",fontSize:14,color:C.text,resize:"vertical",minHeight:160,outline:"none",fontFamily:"inherit",lineHeight:1.7,boxSizing:"border-box"}}
                  />
                  {richiamoMsg && (
                    <button onClick={()=>navigator.clipboard?.writeText(richiamoMsg)} style={{position:"absolute",top:10,right:10,fontSize:11,padding:"5px 10px",borderRadius:6,border:`1px solid ${C.navyTint}`,background:C.white,cursor:"pointer",color:C.navy,fontWeight:700,fontFamily:"inherit"}}>
                      📋 Copia
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Azioni */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#15803D",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Invia su WhatsApp</div>
                <a href={`https://wa.me/${cl.tel?.replace(/\D/g,"")}?text=${encodeURIComponent(richiamoMsg)}`} target="_blank" rel="noreferrer" style={{fontSize:13,fontWeight:700,color:"#15803D",textDecoration:"none"}}>📱 Apri WhatsApp →</a>
              </div>
              <div style={{background:"#EFF6FF",border:`1px solid ${C.navyTint}`,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:700,color:C.navy,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Email diretta</div>
                <a href={`mailto:${cl.email}?subject=Rinnovo pratica ${scad.label}&body=${encodeURIComponent(richiamoMsg)}`} style={{fontSize:13,fontWeight:700,color:C.navy,textDecoration:"none"}}>📧 Apri Email →</a>
              </div>
            </div>
          </div>

          <div style={{padding:"14px 24px",borderTop:`1px solid ${C.border}`,display:"flex",gap:8,flexWrap:"wrap",justifyContent:"space-between",alignItems:"center"}}>
            <Btn variant="danger" style={{fontSize:13,padding:"8px 14px"}} onClick={()=>segnaClienteNonFinanziabile(cl.id)}>
              🚫 Segna Non Finanziabile
            </Btn>
            <div style={{display:"flex",gap:8}}>
              <Btn variant="ghost" style={{fontSize:13,padding:"8px 14px"}} onClick={()=>setShowRichiamoDetail(false)}>Annulla</Btn>
              <Btn variant="success" style={{fontSize:13,padding:"8px 14px"}} onClick={()=>segnaRichiamoInviato(cl.id)} disabled={!richiamoMsg||richiamoLoad}>
                ✅ Segna come Inviato
              </Btn>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  // SEZIONE RICHIAMI
  // ══════════════════════════════════════════════════════════
  const RichiamiView = () => {
    const tutti = clients
      .filter(c => !c.lead)
      .map(c => ({client:c, scad:calcolaScadenza(c)}))
      .filter(({scad}) => scad);

    const scadute    = tutti.filter(({scad}) => scad.stato==="scaduta");
    const inScad     = tutti.filter(({scad}) => scad.stato==="in_scadenza");
    const attive     = tutti.filter(({scad}) => scad.stato==="attiva");
    const nonFin     = tutti.filter(({scad}) => scad.stato==="non_finanziabile");

    const Section = ({title, items, color, emptyMsg}) => (
      <div style={{marginBottom:24}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:color,flexShrink:0}}/>
          <div style={{fontWeight:800,fontSize:15,color:C.text}}>{title}</div>
          <div style={{background:`${color}18`,color,border:`1px solid ${color}44`,borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700}}>{items.length}</div>
        </div>
        {!items.length && <div style={{fontSize:13,color:C.muted,padding:"14px 0"}}>{emptyMsg}</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:12}}>
          {items.map(({client:cl,scad})=>(
            <Card key={cl.id} style={{padding:18,borderLeft:`3px solid ${color}`}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
                <Avatar name={cl.nome} score={cl.score} size={40}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:14,color:C.text,marginBottom:4}}>{cl.nome}</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    <Chip {...SVC[cl.servizio]} label={SVC[cl.servizio].label} style={{fontSize:11}}/>
                    <ScadenzaBadge scad={scad}/>
                  </div>
                </div>
                {richiamoSent[cl.id]&&<span style={{fontSize:11,background:"#F0FDF4",color:"#15803D",border:"1px solid #BBF7D0",borderRadius:20,padding:"2px 8px",fontWeight:700,whiteSpace:"nowrap"}}>✅ Inviato</span>}
              </div>
              <div style={{fontSize:12,color:C.muted,marginBottom:12,lineHeight:1.6}}>
                <span>📅 Inizio: {fdate(cl.dataInizioPratica)}</span>
                <span style={{margin:"0 8px"}}>→</span>
                <span>Scadenza: {fdate(scad.scadenza)}</span>
                <br/>
                <span>🏢 {cl.datore}</span>
                <span style={{margin:"0 8px"}}>·</span>
                <span>💶 €{cl.reddito}/mese</span>
              </div>
              {scad.stato!=="non_finanziabile" && (
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <Btn variant="blue" style={{fontSize:12,padding:"7px 12px",flex:1,justifyContent:"center"}} onClick={()=>apriRichiamo(cl,scad)}>
                    🤖 Richiama con IA
                  </Btn>
                  <Btn variant="ghost" style={{fontSize:12,padding:"7px 12px"}} onClick={()=>{setSelId(cl.id);setTab("clienti");}}>
                    Scheda
                  </Btn>
                  <Btn variant="danger" style={{fontSize:12,padding:"7px 12px"}} onClick={()=>segnaClienteNonFinanziabile(cl.id)} title="Segna come non finanziabile">
                    🚫
                  </Btn>
                  <Btn variant="danger" style={{fontSize:12,padding:"7px 12px"}} onClick={()=>delCl(cl.id)}>🗑 Elimina</Btn>
                </div>
              )}
              {scad.stato==="non_finanziabile" && (
                <div style={{display:"flex",gap:8}}>
                  <Btn variant="ghost" style={{fontSize:12,padding:"7px 12px"}} onClick={()=>{setSelId(cl.id);setTab("clienti");}}>Apri scheda</Btn>
                  <Btn variant="ghost" style={{fontSize:12,padding:"7px 12px"}} onClick={()=>setClients(prev=>prev.map(c=>c.id===cl.id?{...c,nonFinanziabile:false}:c))}>
                    ↩ Riabilita
                  </Btn>
                  <Btn variant="danger" style={{fontSize:12,padding:"7px 12px"}} onClick={()=>delCl(cl.id)}>🗑 Elimina</Btn>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    );

    return (
      <div>
        {/* KPI */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
          {[
            {l:"Pratiche Scadute",    v:scadute.length,  c:"#DC2626", i:"🔴", s:"Da richiamare subito"},
            {l:"In Scadenza (<6 mesi)",v:inScad.length,  c:"#B45309", i:"🟡", s:"Da pianificare"},
            {l:"Attive",              v:attive.length,   c:"#16A34A", i:"🟢", s:"Nella norma"},
            {l:"Non Finanziabili",    v:nonFin.length,   c:"#6B7280", i:"⛔", s:"Escluse dal richiamo"},
          ].map(k=>(
            <Card key={k.l} style={{padding:"18px 20px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>{k.l}</div>
                  <div style={{fontSize:28,fontWeight:800,color:k.c,lineHeight:1}}>{k.v}</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:5}}>{k.s}</div>
                </div>
                <div style={{width:42,height:42,borderRadius:12,background:`${k.c}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{k.i}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* info box */}
        <div style={{background:C.navyBg,border:`1px solid ${C.navyTint}`,borderRadius:12,padding:"14px 18px",marginBottom:24,display:"flex",alignItems:"flex-start",gap:12}}>
          <span style={{fontSize:20,flexShrink:0}}>ℹ️</span>
          <div style={{fontSize:13,color:C.navy,lineHeight:1.7}}>
            <strong>Regole di scadenza automatiche:</strong> Cessione del Quinto → rinnovabile ogni <strong>4 anni</strong> · Prestito Personale → ogni <strong>3 anni</strong> · Mutuo → ogni <strong>20 anni</strong>.
            I clienti con flag <strong>Non Finanziabile</strong> vengono esclusi dal richiamo automatico. Puoi riattivarli in qualsiasi momento.
          </div>
        </div>

        <Section title="🔴 Pratiche Scadute — Richiamare subito" items={scadute} color="#DC2626" emptyMsg="Nessuna pratica scaduta. ✅"/>
        <Section title="🟡 In Scadenza nei prossimi 6 mesi"       items={inScad}  color="#B45309" emptyMsg="Nessuna pratica in scadenza a breve."/>
        <Section title="🟢 Pratiche Attive"                        items={attive}  color="#16A34A" emptyMsg="Nessuna pratica attiva registrata."/>
        <Section title="⛔ Non Finanziabili"                       items={nonFin}  color="#6B7280" emptyMsg="Nessun cliente escluso."/>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════════
  const Dashboard = () => {
    const byCanale=Object.entries(clients.reduce((a,c)=>{a[c.canale]=(a[c.canale]||0)+1;return a;},{})).sort((a,b)=>b[1]-a[1]).slice(0,5);
    return (
      <div>
        {/* Alert pratiche scadute */}
        {praticheDaRichiamare.length > 0 && (
          <div style={{background:"linear-gradient(135deg,#FFF1F2,#FFF7ED)",border:"1px solid #FECACA",borderRadius:14,padding:"16px 20px",marginBottom:20,display:"flex",alignItems:"center",gap:14,cursor:"pointer"}} onClick={()=>setRichiamoPopup(true)}>
            <div style={{width:46,height:46,borderRadius:12,background:"#FEF2F2",border:"1px solid #FECACA",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🔔</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,color:"#B91C1C",fontSize:15,marginBottom:3}}>
                {stats.scadute>0&&`${stats.scadute} pratiche scadute`}{stats.scadute>0&&stats.inScad>0&&" · "}{stats.inScad>0&&`${stats.inScad} in scadenza`}
              </div>
              <div style={{fontSize:13,color:"#9A3412"}}>
                {praticheDaRichiamare.slice(0,2).map(x=>x.client.nome).join(", ")}
                {praticheDaRichiamare.length>2&&` e altri ${praticheDaRichiamare.length-2}`} — Clicca per richiamare con IA
              </div>
            </div>
            <Btn variant="orange" style={{fontSize:13,padding:"9px 18px",flexShrink:0}}>🤖 Richiama ora</Btn>
          </div>
        )}

        {notifs.length>0&&(
          <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:12,padding:"13px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:18}}>🔔</span>
            <div style={{flex:1}}><span style={{fontWeight:700,color:"#C2410C",fontSize:14}}>{notifs.length} promemoria in scadenza</span><span style={{fontSize:13,color:"#9A3412",marginLeft:10}}>{notifs.slice(0,2).map(n=>`${n.cn}: ${n.testo}`).join(" · ")}{notifs.length>2?` +${notifs.length-2}`:""}</span></div>
            <Btn variant="ghost" style={{fontSize:13,padding:"6px 14px"}} onClick={()=>setTab("promemoria")}>Vedi tutti</Btn>
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
          {[
            {l:"Clienti Totali",       v:stats.tot,             i:"👥",c:C.navy,   s:`${stats.trat} in trattativa`},
            {l:"Lead Attivi",          v:stats.leads,           i:"🎯",c:C.blue,   s:"Da convertire"},
            {l:"Pratiche da Richiamare",v:praticheDaRichiamare.length,i:"🔔",c:stats.scadute>0?"#DC2626":"#B45309",s:`${stats.scadute} scadute · ${stats.inScad} vicine`},
            {l:"Provvigioni Maturate", v:eur(stats.totProv),    i:"💰",c:"#16A34A",s:"Totale registrate",sm:true},
          ].map(k=>(
            <Card key={k.l} style={{padding:"20px 22px",cursor:k.l.includes("Richiam")?"pointer":"default",borderLeft:k.l.includes("Richiam")&&stats.scadute>0?`3px solid #DC2626`:"none"}} onClick={k.l.includes("Richiam")?()=>setTab("richiami"):undefined}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>{k.l}</div>
                  <div style={{fontSize:k.sm?18:28,fontWeight:800,color:k.c,lineHeight:1}}>{k.v}</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:5}}>{k.s}</div>
                </div>
                <div style={{width:42,height:42,borderRadius:12,background:`${k.c}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{k.i}</div>
              </div>
            </Card>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14,marginBottom:20}}>
          <Card style={{overflow:"hidden"}}>
            <div style={{padding:"15px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontWeight:700,fontSize:15}}>Clienti Recenti</span>
              <Btn variant="ghost" style={{fontSize:13,padding:"6px 14px"}} onClick={()=>setTab("clienti")}>Vedi tutti →</Btn>
            </div>
            {clients.filter(c=>!c.lead).slice(0,5).map((c,i)=>{
              const scad=calcolaScadenza(c);
              return(
                <div key={c.id} onClick={()=>{setSelId(c.id);setTab("clienti");}} style={{display:"grid",gridTemplateColumns:"40px 1fr 130px 100px 90px",alignItems:"center",gap:12,padding:"12px 20px",borderBottom:i<4?`1px solid ${C.cream}`:"none",cursor:"pointer",transition:"background 0.12s"}} onMouseOver={e=>e.currentTarget.style.background=C.light} onMouseOut={e=>e.currentTarget.style.background=""}>
                  <Avatar name={c.nome} score={c.score}/>
                  <div><div style={{fontWeight:700,fontSize:14}}>{c.nome}</div><div style={{fontSize:12,color:C.muted}}>{c.email||c.tel}</div></div>
                  <Chip {...SVC[c.servizio]} label={SVC[c.servizio].label}/>
                  <ScoreChip score={c.score}/>
                  {scad&&<ScadenzaBadge scad={scad}/>}
                </div>
              );
            })}
          </Card>

          <Card style={{padding:22}}>
            <SecTitle>🔔 Richiami IA</SecTitle>
            {praticheDaRichiamare.length===0&&<div style={{fontSize:13,color:C.muted,padding:"10px 0"}}>✅ Nessuna pratica da richiamare</div>}
            {praticheDaRichiamare.slice(0,5).map(({client:cl,scad},i)=>(
              <div key={cl.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<Math.min(praticheDaRichiamare.length,5)-1?`1px solid ${C.cream}`:"none"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:scad.stato==="scaduta"?C.red:"#B45309",flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cl.nome}</div>
                  <div style={{fontSize:11,color:C.muted}}>{scad.stato==="scaduta"?`Scaduta da ${scad.giorniDaScadenza}gg`:`Scade in ${scad.giorniMancanti}gg`}</div>
                </div>
                <button onClick={()=>apriRichiamo(cl,scad)} style={{fontSize:11,padding:"5px 9px",borderRadius:7,border:`1px solid ${C.navyTint}`,background:C.navyBg,cursor:"pointer",color:C.navy,fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap"}}>🤖 IA</button>
              </div>
            ))}
            <button onClick={()=>setTab("richiami")} style={{marginTop:12,width:"100%",padding:"8px",borderRadius:8,border:`1px dashed ${C.border}`,background:"transparent",cursor:"pointer",fontSize:13,fontWeight:600,color:C.navy,fontFamily:"inherit"}}>Vedi sezione Richiami →</button>
          </Card>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
          <Card style={{padding:22}}>
            <SecTitle>Profili Clienti</SecTitle>
            {[{l:"Gold",score:100,n:stats.gold},{l:"Buono",score:60,n:stats.buoni},{l:"Basso Profilo",score:20,n:stats.bassi}].map(x=>(
              <div key={x.l} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13}}>
                  <span style={{display:"flex",alignItems:"center",gap:7,fontWeight:600}}><ScoreDot score={x.score}/>{x.l}</span><strong>{x.n}</strong>
                </div>
                <div style={{height:6,background:C.cream,borderRadius:4,overflow:"hidden"}}>
                  <div style={{width:`${(x.n/Math.max(1,stats.tot+stats.leads))*100}%`,height:"100%",background:profilo(x.score).dot,borderRadius:4,transition:"width 0.6s"}}/>
                </div>
              </div>
            ))}
          </Card>
          <Card style={{padding:22}}>
            <SecTitle>Distribuzione Servizi</SecTitle>
            {Object.entries(SVC).map(([k,v])=>{const n=clients.filter(c=>c.servizio===k).length;return(
              <div key={k} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13}}><span style={{fontWeight:600,color:v.color}}>{v.label}</span><strong>{n}</strong></div>
                <div style={{height:6,background:C.cream,borderRadius:4,overflow:"hidden"}}><div style={{width:`${(n/Math.max(1,clients.length))*100}%`,height:"100%",background:v.color,borderRadius:4}}/></div>
              </div>
            );})}
          </Card>
          <Card style={{padding:22}}>
            <SecTitle>Canali Acquisizione</SecTitle>
            {byCanale.map(([ch,n])=>(
              <div key={ch} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.cream}`,fontSize:13}}>
                <span style={{fontWeight:600,textTransform:"capitalize"}}>{ch}</span>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:54,height:5,background:C.cream,borderRadius:3,overflow:"hidden"}}><div style={{width:`${(n/clients.length)*100}%`,height:"100%",background:C.blue,borderRadius:3}}/></div>
                  <span style={{fontWeight:700,color:C.navy,minWidth:14}}>{n}</span>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    );
  };

  // ── TABLE VIEW ────────────────────────────────────────────
  const TableView=({leadOnly=false})=>{
    const list=filtered.filter(c=>leadOnly?c.lead:!c.lead);
    if(selCl&&!leadOnly)return(<div><Btn variant="ghost" style={{marginBottom:18,fontSize:13}} onClick={()=>setSelId(null)}>← Torna alla lista</Btn><Detail/></div>);
    return(
      <div>
        <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap",alignItems:"flex-end"}}>
          <Inp style={{minWidth:220}} placeholder="🔍 Cerca…" value={search} onChange={e=>setSearch(e.target.value)}/>
          <Sel value={fSvc} onChange={e=>setFSvc(e.target.value)} style={{minWidth:180}}>
            <option value="tutti">Tutti i servizi</option>
            <option value="cessione_quinto">Cessione del Quinto</option>
            <option value="mutuo">Mutuo</option>
            <option value="prestito_personale">Prestito Personale</option>
          </Sel>
          <Sel value={fProf} onChange={e=>setFProf(e.target.value)} style={{minWidth:140}}>
            <option value="tutti">Tutti i profili</option>
            <option value="gold">🥇 Gold</option>
            <option value="buono">✅ Buono</option>
            <option value="basso">⚠️ Basso</option>
          </Sel>
          <Btn onClick={()=>{setForm(emptyCl(leadOnly));setModal("form");}}>+ {leadOnly?"Nuovo Lead":"Nuovo Cliente"}</Btn>
        </div>
        <Card style={{overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:leadOnly?"40px 1fr 140px 110px 110px 110px 120px 200px":"40px 1fr 140px 110px 110px 110px 120px",gap:12,padding:"11px 20px",background:C.light,borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>
            <div/><div>Cliente</div><div>Servizio</div><div>Importo</div><div>Profilo</div><div>Stato Pratica</div><div>Pratica</div>{leadOnly&&<div>Azioni</div>}
          </div>
          {list.length===0&&<div style={{textAlign:"center",padding:48,color:C.muted,fontSize:14}}>Nessun risultato.</div>}
          {list.map((c,i)=>{
            const scad=calcolaScadenza(c);
            return(
              <div key={c.id} onClick={()=>{setSelId(c.id);if(!leadOnly)setTab("clienti");}} style={{display:"grid",gridTemplateColumns:leadOnly?"40px 1fr 140px 110px 110px 110px 120px 200px":"40px 1fr 140px 110px 110px 110px 120px",alignItems:"center",gap:12,padding:"13px 20px",borderBottom:i<list.length-1?`1px solid ${C.cream}`:"none",cursor:"pointer",background:selId===c.id?C.navyBg:"white",transition:"background 0.12s"}} onMouseOver={e=>{if(selId!==c.id)e.currentTarget.style.background=C.light;}} onMouseOut={e=>{if(selId!==c.id)e.currentTarget.style.background="white";}}>
                <Avatar name={c.nome} score={c.score}/>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontWeight:700,fontSize:14}}>{c.nome}</span>
                    {c.nonFinanziabile&&<span style={{fontSize:10,background:"#F9FAFB",color:"#6B7280",border:"1px solid #E5E7EB",borderRadius:20,padding:"1px 6px",fontWeight:700}}>⛔ NF</span>}
                  </div>
                  <div style={{fontSize:12,color:C.muted}}>{c.email||c.tel||"—"}</div>
                </div>
                <Chip {...SVC[c.servizio]} label={SVC[c.servizio].label}/>
                <div style={{fontWeight:700,fontSize:13}}>{c.importo>0?eur0(c.importo):"—"}</div>
                <ScoreChip score={c.score}/>
                <Chip {...(STATI[c.stato]||{})} label={STATI[c.stato]?.label||c.stato}/>
                {scad?<ScadenzaBadge scad={scad}/>:<div style={{fontSize:12,color:C.muted}}>—</div>}
                {leadOnly&&<div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}><Btn variant="ghost" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>{setForm({...c});setModal("form");}}>✏️ Modifica</Btn><Btn variant="danger" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>delCl(c.id)}>🗑 Elimina</Btn></div>}
              </div>
            );
          })}
        </Card>
      </div>
    );
  };

  // ── DETAIL ────────────────────────────────────────────────
  const Detail=()=>{
    const c=clients.find(x=>x.id===selId);
    if(!c)return null;
    const p=profilo(c.score);
    const scad=calcolaScadenza(c);
    const clProvs=provs.filter(pr=>pr.clienteId===c.id);
    return(
      <div style={{display:"grid",gridTemplateColumns:"1fr 310px",gap:18}}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card style={{padding:24}}>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:22}}>
              <Avatar name={c.nome} score={c.score} size={56}/>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <div style={{fontSize:21,fontWeight:800,color:C.text}}>{c.nome}</div>
                  {c.nonFinanziabile&&<span style={{fontSize:11,background:"#F9FAFB",color:"#6B7280",border:"1px solid #E5E7EB",borderRadius:20,padding:"2px 8px",fontWeight:700}}>⛔ Non Finanziabile</span>}
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <Chip {...SVC[c.servizio]} label={SVC[c.servizio].label}/>
                  <Chip {...(STATI[c.stato]||{})} label={STATI[c.stato]?.label||c.stato}/>
                  <ScoreChip score={c.score}/>
                  {scad&&<ScadenzaBadge scad={scad}/>}
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
                <Btn variant="ghost" style={{fontSize:13,padding:"8px 12px"}} onClick={()=>{setForm({...c});setModal("form");}}>✏️</Btn>
                <Btn style={{fontSize:13,padding:"8px 12px"}} onClick={()=>runCRIF(c)}>📊 CRIF</Btn>
                <Btn variant="blue" style={{fontSize:13,padding:"8px 12px"}} onClick={()=>{setProvForm({...emptyProv(),clienteId:c.id,clienteNome:c.nome,servizio:c.servizio});setModal("prov");}}>💰 Prov.</Btn>
                {c.tel&&<a href={`https://wa.me/${c.tel.replace(/\D/g,"")}?text=${encodeURIComponent((cfg.whatsappTemplate||"Ciao {nome}, ti contatto da finpratica per aggiornarti sulla tua pratica.").replace("{nome}",c.nome).replace("{servizio}",SVC[c.servizio]?.label||"").replace("{consulente}",cfg.ragioneSociale||"finpratica"))}`} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:9,background:"#25D366",color:"#fff",fontWeight:700,fontSize:13,textDecoration:"none",border:"none"}}>📱 WhatsApp</a>}
                {scad&&scad.stato!=="non_finanziabile"&&(scad.stato==="scaduta"||scad.stato==="in_scadenza")&&(
                  <Btn variant="orange" style={{fontSize:13,padding:"8px 12px"}} onClick={()=>apriRichiamo(c,scad)}>🤖 Richiama</Btn>
                )}
              </div>
            </div>

            {/* Sezione Pratica */}
            {scad&&(
              <div style={{marginBottom:16,padding:"14px 16px",background:scad.stato==="scaduta"?"#FFF1F2":scad.stato==="in_scadenza"?"#FFFBEB":C.navyBg,borderRadius:10,border:`1px solid ${scad.stato==="scaduta"?"#FECACA":scad.stato==="in_scadenza"?"#FDE68A":C.navyTint}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.navy,textTransform:"uppercase",letterSpacing:"0.06em"}}>📋 Stato Pratica {scad.label}</div>
                  <ScadenzaBadge scad={scad}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,fontSize:13}}>
                  <div><span style={{color:C.muted}}>Data Inizio: </span><strong>{fdate(c.dataInizioPratica)}</strong></div>
                  <div><span style={{color:C.muted}}>Scadenza: </span><strong>{fdate(scad.scadenza)}</strong></div>
                  <div><span style={{color:C.muted}}>Rinnovabile: </span><strong>{scad.rinnovabile?"✅ Sì":"❌ No"}</strong></div>
                </div>
                {(scad.stato==="scaduta"||scad.stato==="in_scadenza")&&!c.nonFinanziabile&&(
                  <div style={{marginTop:10,display:"flex",gap:8}}>
                    <Btn variant="blue" style={{fontSize:12,padding:"7px 14px"}} onClick={()=>apriRichiamo(c,scad)}>🤖 Genera Messaggio di Richiamo IA</Btn>
                    <Btn variant="danger" style={{fontSize:12,padding:"7px 14px"}} onClick={()=>segnaClienteNonFinanziabile(c.id)}>🚫 Non Finanziabile</Btn>
                  </div>
                )}
                {c.nonFinanziabile&&(
                  <div style={{marginTop:10}}>
                    <Btn variant="ghost" style={{fontSize:12,padding:"7px 14px"}} onClick={()=>setClients(prev=>prev.map(x=>x.id===c.id?{...x,nonFinanziabile:false}:x))}>↩ Riabilita cliente</Btn>
                  </div>
                )}
              </div>
            )}

            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
              {[["Telefono",c.tel||"—"],["Email",c.email||"—"],["Reddito Netto",eur0(c.reddito)],["Datore di Lavoro",c.datore||"—"],["Età",c.eta?`${c.eta} anni`:"—"],["Importo Richiesto",c.importo>0?eur0(c.importo):"—"],["Canale",c.canale],["Ultimo Contatto",fdate(c.ultimoContatto)],["Inserimento",fdate(c.dataIns)]].map(([l,v])=>(
                <div key={l}><div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3}}>{l}</div><div style={{fontSize:14,fontWeight:600,color:C.text}}>{v}</div></div>
              ))}
            </div>
            {c.note&&<div style={{marginTop:16,padding:"12px 16px",background:C.light,borderRadius:10,border:`1px solid ${C.border}`,fontSize:14,color:"#374151",lineHeight:1.65}}><b style={{color:C.muted}}>Note: </b>{c.note}</div>}
          </Card>

          {clProvs.length>0&&(
            <Card style={{padding:22}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <SecTitle>💰 Provvigioni ({clProvs.length})</SecTitle>
                <Btn variant="blue" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>{setProvForm({...emptyProv(),clienteId:c.id,clienteNome:c.nome,servizio:c.servizio});setModal("prov");}}>+ Nuova</Btn>
              </div>
              {clProvs.map((pr,i)=>(
                <div key={pr.id} onClick={()=>{setSelProv(pr);setModal("prov_detail");}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<clProvs.length-1?`1px solid ${C.cream}`:"none",cursor:"pointer"}} onMouseOver={e=>e.currentTarget.style.opacity="0.75"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
                  <div><div style={{fontSize:13,fontWeight:700}}>{SVC[pr.servizio]?.label} · {fdate(pr.dataCalcolo)}</div><div style={{fontSize:12,color:C.muted}}>TAN {pct(pr.tanPerc)} · {pr.durataMesi} mesi</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontWeight:800,color:C.navy}}>{eur(pr.provvigioneTotale)}</div><Chip label={pr.stato==="liquidata"?"✅ Liquidata":"⏳ Da liquid."} color={pr.stato==="liquidata"?"#15803D":"#B45309"} bg={pr.stato==="liquidata"?"#F0FDF4":"#FFFBEB"} border="transparent" style={{fontSize:11}}/></div>
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* sidebar */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card style={{padding:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingBottom:10,borderBottom:`1px solid ${C.border}`,marginBottom:14}}>
              <span style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>🔔 Promemoria</span>
              <button onClick={()=>setAddR(!addR)} style={{fontSize:12,fontWeight:700,color:C.navy,background:"transparent",border:`1px solid ${C.navyTint}`,borderRadius:7,padding:"5px 10px",cursor:"pointer",fontFamily:"inherit"}}>+ Nuovo</button>
            </div>
            {addR&&(<div style={{background:C.light,borderRadius:10,padding:14,marginBottom:14,border:`1px solid ${C.border}`,display:"flex",flexDirection:"column",gap:8}}><Inp label="Testo" value={rText} onChange={e=>setRText(e.target.value)} placeholder="Descrizione…"/><Inp label="Data" type="date" value={rDate} onChange={e=>setRDate(e.target.value)}/><Btn style={{width:"100%",justifyContent:"center"}} onClick={()=>addReminder(c.id)}>Salva</Btn></div>)}
            {!c.promemoria?.length&&<div style={{fontSize:13,color:C.muted}}>Nessun promemoria.</div>}
            {c.promemoria?.map(r=>(<div key={r.id} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.cream}`,alignItems:"flex-start"}}><input type="checkbox" checked={r.fatto} onChange={()=>toggleR(c.id,r.id)} style={{marginTop:3,width:15,height:15,accentColor:C.navy,cursor:"pointer"}}/><div><div style={{fontSize:13,fontWeight:600,color:r.fatto?C.muted:C.text,textDecoration:r.fatto?"line-through":"none"}}>{r.testo}</div><div style={{fontSize:12,color:r.fatto?"#CBD5E1":new Date(r.data)<=new Date()?"#DC2626":C.muted,marginTop:2}}>{fdate(r.data)}</div></div></div>))}
          </Card>
          <Card style={{padding:22}}>
            <SecTitle>⚡ Azioni IA</SecTitle>
            {[
              {e:"📋",l:"Scheda cliente",  q:`Genera scheda professionale per ${c.nome}, ${SVC[c.servizio]?.label}, reddito €${c.reddito}/mese, score ${c.score}.`},
              {e:"💬",l:"Script contatto", q:`Script telefonico per ${SVC[c.servizio]?.label} a ${c.nome} (score ${c.score}, datore ${c.datore}).`},
              {e:"🔄",l:"Script rinnovo",  q:`Script per proporre il rinnovo della pratica ${SVC[c.servizio]?.label} a ${c.nome}. Pratica attiva dal ${fdate(c.dataInizioPratica)}.`},
            ].map(a=>(<button key={a.l} onClick={()=>{setTab("ai");setTimeout(()=>sendAI(a.q),50);}} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px 12px",marginBottom:7,borderRadius:8,border:`1px solid ${C.border}`,background:C.light,cursor:"pointer",fontSize:13,fontWeight:600,color:C.text,fontFamily:"inherit",transition:"all 0.15s",textAlign:"left"}} onMouseOver={e=>{e.currentTarget.style.background=C.navyBg;e.currentTarget.style.borderColor=C.navyTint;e.currentTarget.style.color=C.navy;}} onMouseOut={e=>{e.currentTarget.style.background=C.light;e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.text;}}><span>{a.e}</span>{a.l}</button>))}
          </Card>
        </div>
      </div>
    );
  };

  // ── LEAD IA, PROMEMORIA, AI CHAT, FORM/CRIF/PROV MODALS (compatti) ──
  const LeadIA=()=>(<div><Card style={{padding:24,marginBottom:20}}><div style={{marginBottom:16}}><div style={{fontSize:18,fontWeight:800,marginBottom:4}}>🔍 Lead Intelligence IA</div><div style={{fontSize:14,color:C.muted}}>Trova potenziali clienti su social e web tramite IA</div></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Inp style={{flex:1,minWidth:280}} value={leadQ} onChange={e=>setLeadQ(e.target.value)} placeholder="Es: pensionati INPS Palermo…"/><Btn variant="blue" onClick={searchLeads} disabled={leadLoad}>{leadLoad?"⏳ Ricerca…":"🚀 Avvia Ricerca"}</Btn></div><div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>{["Pensionati INPS Palermo","Dipendenti comunali Sicilia","Insegnanti statali","Forze dell'ordine"].map(q=>(<button key={q} onClick={()=>setLeadQ(q)} style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${C.border}`,background:C.light,cursor:"pointer",fontSize:12,fontWeight:600,color:C.muted,fontFamily:"inherit"}}>{q}</button>))}</div></Card>{leadLoad&&<div style={{textAlign:"center",padding:60}}><div style={{width:42,height:42,border:`3px solid ${C.border}`,borderTopColor:C.navy,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 16px"}}/><div style={{fontWeight:700,color:C.navy}}>Ricerca in corso…</div></div>}{leadRes.length>0&&(<div><div style={{fontWeight:700,fontSize:15,marginBottom:14}}>{leadRes.length} profili identificati</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:14}}>{leadRes.map((l,i)=>(<Card key={i} style={{padding:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}><div><div style={{fontWeight:800,fontSize:15}}>{l.nome}</div><div style={{fontSize:13,color:C.muted}}>{l.professione}{l.eta?`, ${l.eta} anni`:""}</div></div><ScoreChip score={l.probabilita||50}/></div><Chip label={l.fonte} color={C.navy} bg={C.navyBg} border={C.navyTint} style={{marginBottom:10,fontSize:12}}/><div style={{fontSize:13,color:"#374151",lineHeight:1.6,marginBottom:12}}>{l.interesse}</div><Btn style={{width:"100%",justifyContent:"center"}} onClick={()=>addLeadFromSearch(l)}>+ Aggiungi al CRM</Btn></Card>))}</div></div>)}</div>);

  const PromemoriaView=()=>{const all=clients.flatMap(c=>(c.promemoria||[]).map(r=>({...r,cn:c.nome,cid:c.id})));const pend=all.filter(r=>!r.fatto).sort((a,b)=>new Date(a.data)-new Date(b.data));const done=all.filter(r=>r.fatto);return(<div><div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><Btn onClick={()=>{setPromoOpen(p=>!p);setPromoCid("");setRText("");setRDate("");}}>+ Nuovo Promemoria</Btn></div>{promoOpen&&(<Card style={{padding:20,marginBottom:18}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:12,alignItems:"flex-end"}}><Sel label="Cliente" value={promoCid} onChange={e=>setPromoCid(e.target.value)}><option value="">— Seleziona cliente —</option>{clients.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</Sel><Inp label="Testo" value={rText} onChange={e=>setRText(e.target.value)} placeholder="Descrizione…"/><Inp label="Data" type="date" value={rDate} onChange={e=>setRDate(e.target.value)}/><Btn onClick={()=>{if(!promoCid||!rText||!rDate)return;addReminder(promoCid);setPromoOpen(false);setPromoCid("");}}>Salva</Btn></div></Card>)}<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}><Card style={{padding:22}}><SecTitle>In Sospeso ({pend.length})</SecTitle>{!pend.length&&<div style={{fontSize:14,color:C.muted,padding:"14px 0"}}>✅ Nessun promemoria in sospeso!</div>}{pend.map(r=>{const scad=new Date(r.data)<=new Date();return(<div key={r.id} style={{display:"flex",gap:12,padding:"12px 0",borderBottom:`1px solid ${C.cream}`,alignItems:"flex-start"}}><input type="checkbox" onChange={()=>toggleR(r.cid,r.id)} style={{marginTop:3,width:15,height:15,accentColor:C.navy,cursor:"pointer"}}/><div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{r.testo}</div><div style={{fontSize:12,color:C.muted}}>{r.cn}</div><div style={{fontSize:12,color:scad?"#DC2626":C.muted,fontWeight:scad?700:400,marginTop:2}}>{scad?"⚠️ Scaduto — ":""}{fdate(r.data)}</div></div><button onClick={()=>{setSelId(r.cid);setTab("clienti");}} style={{fontSize:12,padding:"5px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:C.white,cursor:"pointer",fontWeight:600,color:C.text,fontFamily:"inherit"}}>Apri</button></div>);})}</Card><Card style={{padding:22}}><SecTitle>Completati ({done.length})</SecTitle>{!done.length&&<div style={{fontSize:14,color:C.muted,padding:"14px 0"}}>Nessun completato.</div>}{done.map(r=>(<div key={r.id} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.cream}`,alignItems:"flex-start"}}><input type="checkbox" checked onChange={()=>toggleR(r.cid,r.id)} style={{marginTop:3,width:15,height:15,accentColor:"#16A34A",cursor:"pointer"}}/><div><div style={{fontSize:13,color:C.muted,textDecoration:"line-through"}}>{r.testo}</div><div style={{fontSize:12,color:"#CBD5E1"}}>{r.cn} · {fdate(r.data)}</div></div></div>))}</Card></div></div>);};

  const AIView=()=>(<div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:18,height:"calc(100vh - 178px)"}}><Card style={{display:"flex",flexDirection:"column",overflow:"hidden"}}><div style={{padding:"18px 22px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12}}><div style={{width:40,height:40,borderRadius:12,background:C.navyBg,border:`1px solid ${C.navyTint}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🤖</div><div><div style={{fontWeight:800,fontSize:15}}>FinpraticaAI</div><div style={{fontSize:12,color:C.muted}}>🚀 Super Agente CRM · Groq llama3-70b</div></div></div><div style={{flex:1,overflow:"auto",padding:"20px 22px",display:"flex",flexDirection:"column",gap:14}}>{aiMsgs.map((m,i)=>(<div key={i} style={{display:"flex",justifyContent:m.r==="user"?"flex-end":"flex-start"}}><div style={{maxWidth:"82%",background:m.r==="user"?C.navy:m.actionDone?"#F0FDF4":C.light,color:m.r==="user"?"#fff":C.text,borderRadius:m.r==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",padding:"12px 16px",fontSize:14,lineHeight:1.65,border:m.r==="ai"?m.actionDone?"1px solid #BBF7D0":`1px solid ${C.border}`:"none",whiteSpace:"pre-wrap"}}>{m.r==="ai"&&<div style={{fontSize:10,fontWeight:700,color:m.actionDone?"#16A34A":C.navy,marginBottom:5,textTransform:"uppercase",letterSpacing:"0.08em"}}>{m.actionDone?"✅ AZIONE ESEGUITA":"FinpraticaAI"}</div>}{m.t}</div></div>))}{aiLoad&&<div style={{display:"flex"}}><div style={{background:C.light,border:`1px solid ${C.border}`,borderRadius:"16px 16px 16px 4px",padding:"14px 18px",display:"flex",gap:5,alignItems:"center"}}>{[0,1,2].map(j=><div key={j} style={{width:7,height:7,borderRadius:"50%",background:C.navy,animation:`dot${j} 1.2s ease-in-out infinite`}}/>)}</div></div>}<div ref={chatRef}/></div><div style={{padding:"14px 22px",borderTop:`1px solid ${C.border}`,display:"flex",gap:10}}><input style={{flex:1,background:C.light,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 16px",fontSize:14,outline:"none",color:C.text,fontFamily:"inherit"}} placeholder="Scrivi un messaggio…" value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendAI()}/><Btn onClick={()=>sendAI()} disabled={aiLoad}>Invia</Btn></div></Card><div style={{display:"flex",flexDirection:"column",gap:14,overflow:"auto"}}><Card style={{padding:20}}><SecTitle>⚡ Azioni Rapide</SecTitle>{[{e:"📊",l:"Analisi portfolio",q:`Analisi portfolio: ${stats.tot} clienti, ${eur0(stats.portfolio)}, ${stats.scadute} pratiche scadute da richiamare.`},{e:"🔄",l:"Strategia richiami",q:`Ho ${stats.scadute} pratiche cessione quinto scadute da richiamare. Dammi una strategia commerciale efficace.`},{e:"📝",l:"Script cessione quinto",q:"Script professionale per proporre la cessione del quinto a un dipendente pubblico."},{e:"💡",l:"Normativa CQ",q:"Punti chiave normativa cessione del quinto (L.180/1950), TAN massimi, categorie ammesse, rinnovo."},{e:"💰",l:"Ottimizza provvigioni",q:`Come strutturare al meglio le provvigioni? Ho ${eur(stats.totProv)} maturate, ${eur(stats.daLiquid)} da liquidare.`},{e:"📈",l:"Report mensile",q:`Report mensile finpratica: ${stats.tot} clienti, ${stats.leads} lead, ${stats.scadute} pratiche scadute, provvigioni ${eur(stats.totProv)}.`}].map(a=>(<button key={a.l} onClick={()=>sendAI(a.q)} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px 12px",marginBottom:7,borderRadius:8,border:`1px solid ${C.border}`,background:C.light,cursor:"pointer",fontSize:13,fontWeight:600,color:C.text,fontFamily:"inherit",transition:"all 0.15s",textAlign:"left"}} onMouseOver={e=>{e.currentTarget.style.background=C.navyBg;e.currentTarget.style.color=C.navy;e.currentTarget.style.borderColor=C.navyTint;}} onMouseOut={e=>{e.currentTarget.style.background=C.light;e.currentTarget.style.color=C.text;e.currentTarget.style.borderColor=C.border;}}><span>{a.e}</span>{a.l}</button>))}</Card><Card style={{padding:20}}><SecTitle>🤖 Agente CRM</SecTitle>{[{e:"➕",l:"Aggiungi lead",q:"Aggiungi cliente Mario Rossi pensionato INPS telefono 3331234567"},{e:"🔄",l:"Sposta in trattativa",q:"Sposta Mario Rossi in trattativa"},{e:"📋",l:"Lead freddi 3 giorni",q:"Mostrami i lead senza risposta da 3 giorni"},{e:"📝",l:"Aggiungi nota",q:"Aggiungi nota al cliente Rossi: interessato a 15000€"},{e:"💰",l:"Crea preventivo",q:"Crea preventivo pensionato 68 anni 20000€ 96 mesi"},{e:"💬",l:"Scrivi WhatsApp",q:"Scrivi WhatsApp per Mario Rossi aggiornamento pratica"},{e:"📧",l:"Email follow-up",q:"Crea email follow up lead freddi questa settimana"},{e:"📸",l:"Post Instagram",q:"Scrivi post Instagram per pensionati con hashtag"},{e:"🎬",l:"Crea Story",q:"Crea story per dipendenti pubblici"},{e:"📅",l:"Promemoria chiamata",q:"Aggiungi promemoria chiamata Mario Rossi domani alle 10"},{e:"🗓",l:"Appuntamenti settimana",q:"Mostrami appuntamenti questa settimana"}].map(a=>(<button key={a.l} onClick={()=>sendAI(a.q)} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px 12px",marginBottom:7,borderRadius:8,border:`1px solid ${C.border}`,background:C.light,cursor:"pointer",fontSize:13,fontWeight:600,color:C.text,fontFamily:"inherit",transition:"all 0.15s",textAlign:"left"}} onMouseOver={e=>{e.currentTarget.style.background="#F0FDF4";e.currentTarget.style.color="#16A34A";e.currentTarget.style.borderColor="#BBF7D0";}} onMouseOut={e=>{e.currentTarget.style.background=C.light;e.currentTarget.style.color=C.text;e.currentTarget.style.borderColor=C.border;}}><span>{a.e}</span>{a.l}</button>))}</Card><Card style={{padding:20}}><SecTitle>Snapshot</SecTitle>{[["Clienti",stats.tot],["Lead",stats.leads],["Scadute 🔴",stats.scadute],["In scadenza 🟡",stats.inScad],["Provvigioni",eur(stats.totProv)],["Da liquid.",eur(stats.daLiquid)]].map(([l,v])=>(<div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.cream}`,fontSize:13}}><span style={{color:C.muted}}>{l}</span><strong>{v}</strong></div>))}</Card></div></div>);

  // ── MODALS compatti ───────────────────────────────────────
  const FormModal=()=>(<Overlay onClose={()=>setModal(null)}><div style={{background:C.white,borderRadius:20,padding:32,width:"100%",maxWidth:680,maxHeight:"92vh",overflow:"auto",boxShadow:"0 24px 60px rgba(28,63,110,0.18)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:26}}><div style={{fontSize:18,fontWeight:800}}>{form.id?"✏️ Modifica":form.lead?"+ Nuovo Lead":"+ Nuovo Cliente"}</div><button onClick={()=>setModal(null)} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.light,cursor:"pointer",fontSize:16}}>×</button></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>{[["nome","Nome Completo","text"],["tel","Telefono","tel"],["email","Email","email"],["reddito","Reddito Netto €/mese","number"],["datore","Datore di Lavoro","text"],["eta","Età","number"],["importo","Importo Richiesto €","number"],["ultimoContatto","Ultimo Contatto","date"],["dataInizioPratica","Data Inizio Pratica","date"]].map(([k,l,t])=>(<Inp key={k} label={l} type={t} value={form[k]||""} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}/>))}<Sel label="Servizio" value={form.servizio} onChange={e=>setForm(p=>({...p,servizio:e.target.value}))}><option value="cessione_quinto">Cessione del Quinto</option><option value="mutuo">Mutuo</option><option value="prestito_personale">Prestito Personale</option></Sel><Sel label="Stato" value={form.stato} onChange={e=>setForm(p=>({...p,stato:e.target.value}))}><option value="attivo">Attivo</option><option value="trattativa">In Trattativa</option><option value="archiviato">Archiviato</option><option value="lead">Lead</option></Sel><Sel label="Canale" value={form.canale} onChange={e=>setForm(p=>({...p,canale:e.target.value}))}><option value="passaparola">Passaparola</option><option value="facebook">Facebook</option><option value="linkedin">LinkedIn</option><option value="instagram">Instagram</option><option value="google">Google/Web</option><option value="telefono">Telefono Freddo</option></Sel><div style={{display:"flex",flexDirection:"column",gap:5}}><label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Score (0–100)</label><div style={{display:"flex",alignItems:"center",gap:10}}><input type="range" min="0" max="100" value={form.score} onChange={e=>setForm(p=>({...p,score:+e.target.value}))} style={{flex:1,accentColor:profilo(+form.score||50).dot}}/><ScoreChip score={+form.score||50}/></div></div><div style={{display:"flex",alignItems:"center",gap:10,padding:"12px",background:C.light,borderRadius:8,border:`1px solid ${C.border}`,gridColumn:"1/-1"}}><input type="checkbox" id="nfcheck" checked={form.nonFinanziabile||false} onChange={e=>setForm(p=>({...p,nonFinanziabile:e.target.checked}))} style={{width:16,height:16,accentColor:C.red,cursor:"pointer"}}/><label htmlFor="nfcheck" style={{fontSize:14,fontWeight:600,color:C.text,cursor:"pointer"}}>⛔ Segna come Non Finanziabile (escluso dai richiami automatici)</label></div></div><div style={{marginTop:14}}><label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:5}}>Note</label><textarea value={form.note||""} onChange={e=>setForm(p=>({...p,note:e.target.value}))} placeholder="Note sul cliente…" style={{width:"100%",background:C.light,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",fontSize:14,color:C.text,resize:"vertical",minHeight:80,outline:"none",fontFamily:"inherit"}}/></div><div style={{marginTop:18,borderTop:`1px solid ${C.border}`,paddingTop:18}}><div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>📊 Analisi CRIF / CTC</div><textarea value={crifText} onChange={e=>setCrifText(e.target.value)} placeholder="Incolla qui il testo del report CRIF o CTC…" style={{width:"100%",background:C.light,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",fontSize:13,color:C.text,resize:"vertical",minHeight:90,outline:"none",fontFamily:"inherit",marginBottom:10,boxSizing:"border-box"}}/><div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}><Btn variant="blue" onClick={analizzaCRIFForm} disabled={crifAnalyzing||!crifText.trim()}>{crifAnalyzing?"⏳ Analisi in corso…":"🔍 Analizza con IA"}</Btn>{crifFormResult&&(()=>{const {punteggio,livello,motivazione}=crifFormResult;const col=livello==="ottimo"?"#16A34A":livello==="medio"?"#B45309":"#DC2626";const bg=livello==="ottimo"?"#F0FDF4":livello==="medio"?"#FFFBEB":"#FFF1F2";const brd=livello==="ottimo"?"#BBF7D0":livello==="medio"?"#FDE68A":"#FECACA";return(<div style={{display:"flex",alignItems:"center",gap:12,flex:1,background:bg,border:`1px solid ${brd}`,borderRadius:10,padding:"10px 14px"}}><div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:900,color:col,lineHeight:1}}>{punteggio}</div><div style={{fontSize:9,fontWeight:700,color:col,textTransform:"uppercase",letterSpacing:"0.06em"}}>/999</div></div><div style={{width:1,height:32,background:brd}}/><div><div style={{fontWeight:800,fontSize:13,color:col,textTransform:"capitalize",marginBottom:2}}>{livello==="ottimo"?"✅ Ottimo":livello==="medio"?"⚠️ Medio":"🔴 Basso"}</div><div style={{fontSize:12,color:"#374151",lineHeight:1.4}}>{motivazione}</div></div></div>);})()}</div></div>{form.servizio==="cessione_quinto"&&(<div style={{marginTop:18,borderTop:`1px solid ${C.border}`,paddingTop:18}}><div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>📊 Comparatore Bibanca — Cessione del Quinto</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}><div><label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:5}}>Categoria</label><select value={cqCategoria} onChange={e=>setCqCategoria(e.target.value)} style={{width:"100%",padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,color:C.text,background:C.white,outline:"none",fontFamily:"inherit"}}><option value="STATALI_PUBBLICI">Statali / Pubblici</option><option value="PARAPUBBLICI">Parapubblici</option><option value="PRIVATI">Privati</option><option value="PENSIONATI">Pensionati INPS</option></select></div><div><label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:5}}>Durata (mesi)</label><select value={cqDurata} onChange={e=>setCqDurata(+e.target.value)} style={{width:"100%",padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,color:C.text,background:C.white,outline:"none",fontFamily:"inherit"}}>{DURATE_DISPONIBILI.map(d=><option key={d} value={d}>{d} mesi ({(d/12).toFixed(0)} anni)</option>)}</select></div></div><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:cqRisultati.length?12:0}}><Btn variant="blue" onClick={calcolaBibanca}>🔄 Ricalcola</Btn><span style={{fontSize:12,color:C.muted}}>Importo: {form.importo?`€${(+form.importo).toLocaleString("it-IT")}`:"-"} · Età: {form.eta||"-"} anni</span></div>{cqRisultati.length>0&&(<div><div style={{display:"grid",gridTemplateColumns:"1fr 72px 80px 96px 110px",gap:8,padding:"8px 12px",background:C.light,borderRadius:8,marginBottom:6,fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}><div>Canale</div><div>TAN</div><div>Prov.Max</div><div>Rata/mese</div><div>Selezione</div></div>{cqRisultati.map((r,i)=>{const isBest=i===0;const isSel=cqSel===r.codice;return(<div key={r.codice} style={{display:"grid",gridTemplateColumns:"1fr 72px 80px 96px 110px",gap:8,padding:"10px 12px",borderRadius:8,border:isBest?`2px solid #16A34A`:isSel?`1px solid ${C.navyTint}`:`1px solid ${C.border}`,background:isBest?"#F0FDF4":isSel?C.navyBg:C.white,marginBottom:6,alignItems:"center",transition:"all 0.15s"}}><div><span style={{fontWeight:800,fontSize:13,color:r.colore}}>{r.canale}</span>{isBest&&<span style={{fontSize:10,background:"#16A34A",color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:700,marginLeft:6}}>🏆 Miglior TAN</span>}</div><div style={{fontWeight:800,fontSize:13,color:isBest?"#16A34A":C.text}}>{r.tan_applicato.toFixed(2)}%</div><div style={{fontSize:12,color:C.muted}}>{r.provMax!==undefined?r.provMax.toFixed(2)+"%":"—"}</div><div style={{fontWeight:700,fontSize:13,color:C.navy}}>€{r.rata.toFixed(2)}</div><button onClick={()=>setCqSel(r.codice)} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${isSel?"#16A34A":C.border}`,background:isSel?"#F0FDF4":C.white,cursor:"pointer",fontSize:11,fontWeight:700,color:isSel?"#15803D":C.navy,fontFamily:"inherit",whiteSpace:"nowrap"}}>{isSel?"✅ Selezionato":"Seleziona"}</button></div>);})} {cqSel&&(<div style={{marginTop:8,padding:"10px 14px",background:C.navyBg,border:`1px solid ${C.navyTint}`,borderRadius:8,fontSize:13,color:C.navy,fontWeight:600}}>{(()=>{const r=cqRisultati.find(x=>x.codice===cqSel);return r?<>✅ <strong>{r.canale}</strong> · TAN <strong>{r.tan_applicato.toFixed(2)}%</strong> · Rata <strong>€{r.rata.toFixed(2)}/mese</strong></>:null;})()}</div>)}</div>)}</div>)}<div style={{display:"flex",gap:10,marginTop:22,justifyContent:"flex-end"}}><Btn variant="ghost" onClick={()=>setModal(null)}>Annulla</Btn>{form.id&&<Btn variant="danger" style={{marginRight:"auto"}} onClick={()=>delCl(form.id)}>🗑 Elimina</Btn>}<Btn onClick={saveCl}>💾 Salva</Btn></div></div></Overlay>);

  const CrifModal=()=>{if(!selCl)return null;const p=crifRes?profilo(crifRes.score):null;return(<Overlay onClose={()=>setModal(null)}><div style={{background:C.white,borderRadius:20,padding:32,width:"100%",maxWidth:540,maxHeight:"90vh",overflow:"auto",boxShadow:"0 24px 60px rgba(28,63,110,0.18)"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:22}}><div style={{fontSize:18,fontWeight:800}}>📊 CRIF/CTC — {selCl.nome}</div><button onClick={()=>setModal(null)} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.light,cursor:"pointer",fontSize:16}}>×</button></div>{crifLoad&&<div style={{textAlign:"center",padding:52}}><div style={{width:44,height:44,border:`3px solid ${C.border}`,borderTopColor:C.navy,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 16px"}}/><div style={{fontWeight:700,color:C.navy}}>Analisi IA in corso…</div></div>}{crifRes&&!crifLoad&&(<div><div style={{background:p.bg,border:`1px solid ${p.border}`,borderRadius:12,padding:"18px 20px",marginBottom:18,display:"flex",alignItems:"center",gap:18}}><div style={{textAlign:"center",minWidth:70}}><div style={{fontSize:44,fontWeight:900,color:p.dot,lineHeight:1}}>{crifRes.score}</div><div style={{fontSize:10,fontWeight:700,color:p.text,textTransform:"uppercase",letterSpacing:"0.08em"}}>/100</div></div><div style={{flex:1}}><div style={{height:10,background:C.border,borderRadius:6,overflow:"hidden",marginBottom:10}}><div style={{width:`${crifRes.score}%`,height:"100%",background:p.dot,borderRadius:6}}/></div><div style={{fontWeight:800,fontSize:16,color:p.text,marginBottom:6}}>{crifRes.giudizio}</div><ScoreChip score={crifRes.score}/></div></div><div style={{fontSize:14,color:"#374151",lineHeight:1.7,marginBottom:16,padding:"14px 16px",background:C.light,borderRadius:10,border:`1px solid ${C.border}`}}>{crifRes.motivazione}</div>{crifRes.rischi?.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:11,fontWeight:700,color:"#DC2626",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>⚠️ Rischi</div>{crifRes.rischi.map((r,i)=><div key={i} style={{fontSize:13,padding:"5px 0",borderBottom:"1px solid #FEF2F2"}}>• {r}</div>)}</div>}{crifRes.opportunita?.length>0&&<div style={{marginBottom:16}}><div style={{fontSize:11,fontWeight:700,color:"#16A34A",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>✅ Opportunità</div>{crifRes.opportunita.map((o,i)=><div key={i} style={{fontSize:13,padding:"5px 0",borderBottom:"1px solid #F0FDF4"}}>• {o}</div>)}</div>}<div style={{background:C.navyBg,border:`1px solid ${C.navyTint}`,borderRadius:10,padding:"14px 16px"}}><div style={{fontSize:11,fontWeight:700,color:C.navy,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>Raccomandazione</div><div style={{fontSize:14,fontWeight:600,color:C.navy}}>{crifRes.raccomandazione}</div></div></div>)}</div></Overlay>);};

  const ProvModal=()=>{const pf=provForm;const live=calcProv(pf);const cliOpts=clients.filter(c=>!c.lead);const rata=()=>{const P=+pf.importoFinanziato||0,n=+pf.durataMesi||1,r=(+pf.tanPerc||0)/100/12;if(!r||!P)return P/n;return P*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);};return(<Overlay onClose={()=>setModal(null)}><div style={{background:C.white,borderRadius:20,width:"100%",maxWidth:720,maxHeight:"94vh",overflow:"auto",boxShadow:"0 24px 60px rgba(28,63,110,0.18)"}}><div style={{padding:"22px 28px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:C.white,zIndex:10}}><div><div style={{fontSize:18,fontWeight:800}}>💰 {pf.id?"Modifica":"Nuova"} Provvigione</div><div style={{fontSize:13,color:C.muted,marginTop:2}}>Calcolo automatico in tempo reale</div></div><button onClick={()=>setModal(null)} style={{width:34,height:34,borderRadius:9,border:`1px solid ${C.border}`,background:C.light,cursor:"pointer",fontSize:16}}>×</button></div><div style={{padding:"22px 28px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><div style={{gridColumn:"1/-1"}}><Sel label="Cliente" value={pf.clienteId} onChange={e=>{const cl=cliOpts.find(c=>c.id===e.target.value);setProvForm(p=>({...p,clienteId:e.target.value,clienteNome:cl?.nome||"",servizio:cl?.servizio||p.servizio}));}}><option value="">— Seleziona cliente —</option>{cliOpts.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</Sel></div><Sel label="Servizio" value={pf.servizio} onChange={e=>setProvForm(p=>({...p,servizio:e.target.value}))}><option value="cessione_quinto">Cessione del Quinto</option><option value="mutuo">Mutuo</option><option value="prestito_personale">Prestito Personale</option></Sel><Inp label="Data Pratica" type="date" value={pf.dataCalcolo} onChange={e=>setProvForm(p=>({...p,dataCalcolo:e.target.value}))}/><Inp label="Importo Finanziato €" type="number" placeholder="Es: 20000" value={pf.importoFinanziato} onChange={e=>setProvForm(p=>({...p,importoFinanziato:e.target.value}))}/><Inp label="Durata (mesi)" type="number" placeholder="Es: 120" value={pf.durataMesi} onChange={e=>setProvForm(p=>({...p,durataMesi:e.target.value}))}/><Inp label="TAN (%)" type="number" step="0.01" placeholder="Es: 8.50" value={pf.tanPerc} onChange={e=>setProvForm(p=>({...p,tanPerc:e.target.value}))}/><Inp label="TAEG (%)" type="number" step="0.01" placeholder="Es: 9.20" value={pf.taegPerc} onChange={e=>setProvForm(p=>({...p,taegPerc:e.target.value}))}/><Inp label="% Provv. Banca" type="number" step="0.01" placeholder="Es: 2.50" value={pf.provvigionePercBanca} onChange={e=>setProvForm(p=>({...p,provvigionePercBanca:e.target.value}))}/><Inp label="% Provv. Mediatore" type="number" step="0.01" placeholder="Es: 1.80" value={pf.provvigionePercMediatore} onChange={e=>setProvForm(p=>({...p,provvigionePercMediatore:e.target.value}))}/>{(+pf.importoFinanziato>0)&&(<div style={{gridColumn:"1/-1"}}><div style={{background:`linear-gradient(135deg,${C.navyBg},${C.navyTint})`,border:`1px solid ${C.navyTint}`,borderRadius:14,padding:"18px 22px"}}><div style={{fontSize:12,fontWeight:700,color:C.navy,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:14}}>⚡ Calcolo Automatico</div><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>{[["Importo",eur0(+pf.importoFinanziato||0),C.text],["Rata/mese",eur(rata()),C.navy],["Prov.Banca",eur(live.provvigioneBanca),"#7C3AED"],["Prov.Med.",eur(live.provvigioneMediatore),"#16A34A"]].map(([l,v,c])=>(<div key={l} style={{background:C.white,borderRadius:10,padding:"12px 14px",border:`1px solid ${C.border}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5}}>{l}</div><div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div></div>))}</div><div style={{padding:"14px 18px",background:C.white,borderRadius:12,border:`2px solid ${C.navy}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Provvigione Totale</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Banca + Mediatore</div></div><div style={{fontSize:28,fontWeight:900,color:C.navy}}>{eur(live.provvigioneTotale)}</div></div></div></div>)}<Sel label="Stato" value={pf.stato} onChange={e=>setProvForm(p=>({...p,stato:e.target.value}))}><option value="da_liquidare">Da Liquidare</option><option value="liquidata">Liquidata</option></Sel><div style={{display:"flex",flexDirection:"column",gap:5}}><label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Note</label><textarea value={pf.note} onChange={e=>setProvForm(p=>({...p,note:e.target.value}))} placeholder="Note pratica…" style={{background:C.light,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",fontSize:14,color:C.text,resize:"none",height:80,outline:"none",fontFamily:"inherit"}}/></div></div><div style={{padding:"16px 28px",borderTop:`1px solid ${C.border}`,display:"flex",gap:10,justifyContent:"flex-end",background:C.white,position:"sticky",bottom:0}}><Btn variant="ghost" onClick={()=>setModal(null)}>Annulla</Btn><Btn onClick={saveProv}>💾 Salva Provvigione</Btn></div></div></Overlay>);};

  const ProvDetailModal=()=>{if(!selProv)return null;const p=selProv;return(<Overlay onClose={()=>setModal(null)}><div style={{background:C.white,borderRadius:20,width:"100%",maxWidth:520,boxShadow:"0 24px 60px rgba(28,63,110,0.18)"}}><div style={{padding:"22px 26px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:17,fontWeight:800}}>💰 Dettaglio Provvigione</div><button onClick={()=>setModal(null)} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.light,cursor:"pointer",fontSize:15}}>×</button></div><div style={{padding:"20px 26px"}}><div style={{background:C.navyBg,border:`1px solid ${C.navyTint}`,borderRadius:14,padding:"18px 20px",marginBottom:18}}><div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>{p.clienteNome}</div><div style={{fontSize:11,color:C.muted,marginBottom:14}}>{SVC[p.servizio]?.label} · {fdate(p.dataCalcolo)}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{[["Importo Finanziato",eur0(p.importoFinanziato)],["Durata",`${p.durataMesi} mesi`],["TAN",pct(p.tanPerc)],["TAEG",pct(p.taegPerc)],["% Prov. Banca",pct(p.provvigionePercBanca)],["% Prov. Mediatore",pct(p.provvigionePercMediatore)]].map(([l,v])=>(<div key={l}><div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3}}>{l}</div><div style={{fontSize:14,fontWeight:700}}>{v}</div></div>))}</div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>{[["Prov. Banca",eur(p.provvigioneBanca),"#7C3AED"],["Prov. Mediatore",eur(p.provvigioneMediatore),"#16A34A"],["Totale",eur(p.provvigioneTotale),C.navy]].map(([l,v,c])=>(<div key={l} style={{background:C.light,borderRadius:10,padding:"12px 14px",border:`1px solid ${C.border}`,textAlign:"center"}}><div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>{l}</div><div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div></div>))}</div><Chip label={p.stato==="liquidata"?"✅ Liquidata":"⏳ Da Liquidare"} color={p.stato==="liquidata"?"#15803D":"#B45309"} bg={p.stato==="liquidata"?"#F0FDF4":"#FFFBEB"} border={p.stato==="liquidata"?"#BBF7D0":"#FDE68A"} style={{fontSize:13,padding:"6px 14px"}}/>{p.note&&<div style={{marginTop:12,fontSize:13,color:C.muted,padding:"10px 14px",background:C.light,borderRadius:8,border:`1px solid ${C.border}`}}>{p.note}</div>}</div><div style={{padding:"14px 26px",borderTop:`1px solid ${C.border}`,display:"flex",gap:8,justifyContent:"flex-end"}}><Btn variant="ghost" style={{fontSize:13,padding:"8px 14px"}} onClick={()=>{setProvForm({...p});setModal("prov");}}>✏️ Modifica</Btn><Btn variant="danger" style={{fontSize:13,padding:"8px 14px"}} onClick={()=>{setProvs(prev=>prev.filter(x=>x.id!==p.id));sb.from("fp_provvigioni").delete().eq("id",p.id).then(({error})=>{ if(error) console.warn("Supabase delete prov:",error.message); });setModal(null);}}>🗑 Elimina</Btn>{p.stato==="da_liquidare"&&<Btn variant="success" style={{fontSize:13,padding:"8px 14px"}} onClick={()=>{setProvs(prev=>prev.map(x=>x.id===p.id?{...x,stato:"liquidata"}:x));setModal(null);}}>✅ Liquidata</Btn>}<Btn variant="ghost" onClick={()=>setModal(null)}>Chiudi</Btn></div></div></Overlay>);};

  // ══════════════════════════════════════════════════════════
  // LEAD FUNNEL VIEW (Kanban drag & drop)
  // ══════════════════════════════════════════════════════════
  const LeadFunnelView = () => {
    const leads = clients.filter(c=>c.lead||c.funnelStato==="chiuso_vinto"||c.funnelStato==="chiuso_perso");
    const byStato = (s) => leads.filter(c=>(c.funnelStato||"nuovo")===s);
    const tot=leads.filter(c=>c.funnelStato==="chiuso_vinto"||c.funnelStato==="chiuso_perso").length;
    const vinti=leads.filter(c=>c.funnelStato==="chiuso_vinto").length;
    const convRate=tot>0?Math.round((vinti/tot)*100):0;
    return (
      <div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:16}}>
          {FUNNEL_STATI.map(s=>{const n=byStato(s).length;const cfg=FUNNEL_CFG[s];return(<div key={s} style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:"14px 16px",borderTop:`3px solid ${cfg.color}`}}><div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>{cfg.i} {cfg.label}</div><div style={{fontSize:26,fontWeight:800,color:cfg.color}}>{n}</div></div>);})}
        </div>
        <div style={{background:C.navyBg,border:`1px solid ${C.navyTint}`,borderRadius:10,padding:"10px 16px",marginBottom:18,display:"flex",alignItems:"center",gap:20,fontSize:13}}>
          <span>📊 <b>Conversione:</b> <span style={{color:convRate>=30?"#16A34A":"#B45309",fontWeight:700}}>{convRate}%</span></span>
          <span>🎯 <b>Lead totali:</b> {leads.length}</span><span>🏆 <b>Vinti:</b> {vinti}</span>
          <span>💔 <b>Persi:</b> {leads.filter(c=>c.funnelStato==="chiuso_perso").length}</span>
          <div style={{marginLeft:"auto"}}><Btn variant="blue" style={{fontSize:12,padding:"7px 14px"}} onClick={()=>setCsvModal(true)}>📥 Importa CSV</Btn></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,alignItems:"start"}}>
          {FUNNEL_STATI.map(stato=>{
            const cfg=FUNNEL_CFG[stato]; const col=byStato(stato); const isOver=funnelOver===stato;
            return(<div key={stato} onDragOver={e=>{e.preventDefault();setFunnelOver(stato);}} onDragLeave={()=>setFunnelOver(null)} onDrop={e=>{e.preventDefault();if(funnelDrag){moveFunnel(funnelDrag,stato);setFunnelDrag(null);setFunnelOver(null);}}} style={{background:isOver?cfg.bg:C.light,borderRadius:12,border:`2px dashed ${isOver?cfg.color:C.border}`,padding:10,minHeight:120,transition:"all 0.15s"}}>
              <div style={{fontSize:11,fontWeight:800,color:cfg.color,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10,display:"flex",alignItems:"center",gap:6,padding:"4px"}}>{cfg.i} {cfg.label} <span style={{background:cfg.bg,border:`1px solid ${cfg.border}`,borderRadius:20,padding:"1px 7px",fontSize:11}}>{col.length}</span></div>
              {col.map(lead=>(<div key={lead.id} draggable onDragStart={()=>setFunnelDrag(lead.id)} onDragEnd={()=>{setFunnelDrag(null);setFunnelOver(null);}} style={{background:C.white,borderRadius:10,border:`1px solid ${C.border}`,padding:"11px 12px",marginBottom:8,cursor:"grab",opacity:funnelDrag===lead.id?0.5:1,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><Avatar name={lead.nome} score={lead.score} size={28}/><div style={{minWidth:0}}><div style={{fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lead.nome}</div><div style={{fontSize:11,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lead.datore||lead.canale}</div></div></div>
                <Chip {...SVC[lead.servizio]} label={SVC[lead.servizio]?.label} style={{fontSize:10,padding:"2px 7px",marginBottom:6,display:"block"}}/>
                {stato!=="chiuso_vinto"&&stato!=="chiuso_perso"&&(<div style={{display:"flex",gap:4}}><select value={stato} onChange={e=>moveFunnel(lead.id,e.target.value)} onClick={e=>e.stopPropagation()} style={{fontSize:10,padding:"3px 6px",borderRadius:6,border:`1px solid ${C.border}`,background:C.light,cursor:"pointer",flex:1,fontFamily:"inherit",color:C.navy,fontWeight:600}}>{FUNNEL_STATI.map(s=><option key={s} value={s}>{FUNNEL_CFG[s].label}</option>)}</select>{stato==="trattativa"&&<button onClick={()=>converti(lead.id)} style={{fontSize:10,padding:"3px 8px",borderRadius:6,border:"none",background:"#16A34A",color:"#fff",cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>→ Cliente</button>}</div>)}
                <Btn variant="danger" style={{fontSize:10,padding:"4px 8px",marginTop:6,width:"100%",justifyContent:"center"}} onClick={e=>{e.stopPropagation();delCl(lead.id);}}>🗑 Elimina</Btn>
              </div>))}
              {col.length===0&&<div style={{fontSize:11,color:C.muted,textAlign:"center",padding:"12px 0",fontStyle:"italic"}}>Trascina qui</div>}
            </div>);
          })}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  // STATISTICHE CONVERSIONE
  // ══════════════════════════════════════════════════════════
  const StatLeadView = () => {
    const allLeads=clients.filter(c=>c.lead||c.funnelStato);
    const canali=[...new Set(allLeads.map(c=>c.canale).filter(Boolean))];
    const statCanale=canali.map(ch=>{
      const tot=allLeads.filter(c=>c.canale===ch).length;
      const vinti=allLeads.filter(c=>c.canale===ch&&c.funnelStato==="chiuso_vinto").length;
      const persi=allLeads.filter(c=>c.canale===ch&&c.funnelStato==="chiuso_perso").length;
      const inTrat=allLeads.filter(c=>c.canale===ch&&c.funnelStato==="trattativa").length;
      const rate=vinti+persi>0?Math.round((vinti/(vinti+persi))*100):0;
      return {ch,tot,vinti,persi,inTrat,rate};
    }).sort((a,b)=>b.vinti-a.vinti);
    const statSvc=Object.keys(SVC).map(sv=>{const tot=allLeads.filter(c=>c.servizio===sv).length;const vinti=allLeads.filter(c=>c.servizio===sv&&c.funnelStato==="chiuso_vinto").length;return{sv,tot,vinti,rate:tot>0?Math.round((vinti/tot)*100):0};});
    const funnelCounts=FUNNEL_STATI.map(s=>({s,n:allLeads.filter(c=>(c.funnelStato||"nuovo")===s).length,cfg:FUNNEL_CFG[s]}));
    const maxF=Math.max(...funnelCounts.map(f=>f.n),1);
    const totClosed=allLeads.filter(c=>c.funnelStato==="chiuso_vinto"||c.funnelStato==="chiuso_perso").length;
    const globalRate=totClosed>0?Math.round((allLeads.filter(c=>c.funnelStato==="chiuso_vinto").length/totClosed)*100):0;
    return(<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
        {[{l:"Lead Totali",v:allLeads.length,c:C.navy,i:"🎯"},{l:"Tasso Conversione",v:`${globalRate}%`,c:"#16A34A",i:"📈"},{l:"In Trattativa",v:allLeads.filter(c=>c.funnelStato==="trattativa").length,c:"#B45309",i:"🤝"},{l:"Canale Top",v:statCanale[0]?.ch||"—",c:C.blue,i:"🏆",sm:true}].map(k=>(<div key={k.l} style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:"18px 20px",boxShadow:"0 1px 4px rgba(28,63,110,0.06)"}}><div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>{k.l}</div><div style={{fontSize:k.sm?16:26,fontWeight:800,color:k.c}}>{k.v}</div></div><div style={{width:40,height:40,borderRadius:10,background:`${k.c}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{k.i}</div></div></div>))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:18}}>
        <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,padding:22}}>
          <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:16}}>📊 Funnel di Conversione</div>
          {funnelCounts.map(({s,n,cfg})=>(<div key={s} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{fontWeight:700,color:cfg.color}}>{cfg.i} {cfg.label}</span><span style={{fontWeight:800}}>{n}</span></div><div style={{height:8,background:C.cream,borderRadius:4,overflow:"hidden"}}><div style={{width:`${(n/maxF)*100}%`,height:"100%",background:cfg.color,borderRadius:4,transition:"width 0.6s"}}/></div></div>))}
        </div>
        <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,padding:22}}>
          <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:16}}>🎯 Conversione per Servizio</div>
          {statSvc.map(({sv,tot,vinti,rate})=>(<div key={sv} style={{marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}><span style={{fontWeight:700,color:SVC[sv]?.color}}>{SVC[sv]?.label}</span><div style={{display:"flex",gap:8}}><span style={{color:C.muted,fontSize:11}}>{vinti}/{tot}</span><span style={{fontWeight:800,color:rate>=30?"#16A34A":rate>=15?"#B45309":"#DC2626"}}>{rate}%</span></div></div><div style={{height:7,background:C.cream,borderRadius:4,overflow:"hidden"}}><div style={{width:`${rate}%`,height:"100%",background:SVC[sv]?.color,borderRadius:4}}/></div></div>))}
        </div>
      </div>
      <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,padding:22}}>
        <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:16}}>📡 Performance per Canale</div>
        <div style={{display:"grid",gridTemplateColumns:"140px 70px 70px 70px 70px 1fr",gap:10,padding:"8px 12px",background:C.light,borderRadius:8,marginBottom:10,fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}><div>Canale</div><div>Totale</div><div>Vinti</div><div>Persi</div><div>Tratt.</div><div>Conv.%</div></div>
        {statCanale.map(({ch,tot,vinti,persi,inTrat,rate})=>(<div key={ch} style={{display:"grid",gridTemplateColumns:"140px 70px 70px 70px 70px 1fr",gap:10,padding:"10px 12px",borderBottom:`1px solid ${C.cream}`,alignItems:"center",fontSize:13}}><div style={{fontWeight:700,textTransform:"capitalize"}}>{ch}</div><div>{tot}</div><div style={{fontWeight:700,color:"#16A34A"}}>{vinti}</div><div style={{fontWeight:700,color:"#DC2626"}}>{persi}</div><div style={{fontWeight:700,color:"#B45309"}}>{inTrat}</div><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,height:6,background:C.cream,borderRadius:3,overflow:"hidden"}}><div style={{width:`${rate}%`,height:"100%",background:rate>=50?"#16A34A":rate>=25?"#B45309":"#DC2626",borderRadius:3}}/></div><span style={{fontWeight:800,color:rate>=50?"#16A34A":rate>=25?"#B45309":"#DC2626",minWidth:32}}>{rate}%</span></div></div>))}
      </div>
    </div>);
  };

  // ══════════════════════════════════════════════════════════
  // MODAL IMPORT CSV
  // ══════════════════════════════════════════════════════════
  const CSVModal = () => (<div onClick={e=>e.target===e.currentTarget&&setCsvModal(false)} style={{position:"fixed",inset:0,background:"rgba(28,63,110,0.4)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"}}>
    <div style={{background:C.white,borderRadius:20,width:"100%",maxWidth:680,maxHeight:"88vh",overflow:"auto",boxShadow:"0 24px 60px rgba(28,63,110,0.2)"}}>
      <div style={{padding:"20px 26px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:17,fontWeight:800}}>📥 Importa Lead da CSV</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>Colonne: nome, telefono, email, servizio, note, canale</div></div>
        <button onClick={()=>{setCsvModal(false);setCsvStep("upload");setCsvParsed([]);}} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.light,cursor:"pointer",fontSize:16}}>×</button>
      </div>
      {csvStep==="upload"&&(<div style={{padding:"32px 26px",textAlign:"center"}}>
        <div style={{width:72,height:72,borderRadius:20,background:C.navyBg,border:`2px dashed ${C.blue}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 18px",cursor:"pointer"}} onClick={()=>csvRef.current?.click()}>📂</div>
        <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Carica il tuo file CSV</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Formati supportati: .csv, .txt</div>
        <input ref={csvRef} type="file" accept=".csv,.txt" style={{display:"none"}} onChange={e=>handleCSVFile(e.target.files[0])}/>
        <Btn onClick={()=>csvRef.current?.click()}>📂 Seleziona File</Btn>
        <div style={{marginTop:22,padding:"14px 18px",background:C.light,borderRadius:10,border:`1px solid ${C.border}`,textAlign:"left"}}>
          <div style={{fontSize:12,fontWeight:700,color:C.navy,marginBottom:8}}>📋 Formato esempio:</div>
          <div style={{fontFamily:"monospace",fontSize:11,color:C.muted,lineHeight:1.9}}>nome,telefono,email,servizio,canale,note<br/>Mario Rossi,333-1234567,m.rossi@email.it,cessione_quinto,facebook,interessato</div>
        </div>
      </div>)}
      {csvStep==="preview"&&(<div style={{padding:"18px 26px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:14}}>{csvParsed.length} righe trovate</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setCsvSel(Object.fromEntries(csvParsed.map(r=>[r._idx,true])))} style={{fontSize:12,padding:"5px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:C.light,cursor:"pointer",fontWeight:600,color:C.navy,fontFamily:"inherit"}}>Tutti</button>
            <button onClick={()=>setCsvSel({})} style={{fontSize:12,padding:"5px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:C.light,cursor:"pointer",fontWeight:600,color:C.muted,fontFamily:"inherit"}}>Nessuno</button>
          </div>
        </div>
        <div style={{maxHeight:300,overflow:"auto",border:`1px solid ${C.border}`,borderRadius:10,marginBottom:14}}>
          {csvParsed.map((r,i)=>(<div key={r._idx} style={{display:"grid",gridTemplateColumns:"32px 1fr 130px 120px",gap:10,padding:"10px 14px",borderBottom:i<csvParsed.length-1?`1px solid ${C.cream}`:"none",alignItems:"center",background:csvSel[r._idx]?C.navyBg:C.white}}>
            <input type="checkbox" checked={!!csvSel[r._idx]} onChange={e=>setCsvSel(p=>({...p,[r._idx]:e.target.checked}))} style={{width:15,height:15,accentColor:C.navy,cursor:"pointer"}}/>
            <div><div style={{fontWeight:700,fontSize:13}}>{r.nome}</div><div style={{fontSize:11,color:C.muted}}>{r.email||r.tel}</div></div>
            <div style={{fontSize:12,color:C.muted}}>{r.tel}</div>
            <Chip {...(SVC[r.servizio]||SVC.cessione_quinto)} label={(SVC[r.servizio]||SVC.cessione_quinto).label} style={{fontSize:11}}/>
          </div>))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:13,color:C.muted}}>{Object.values(csvSel).filter(Boolean).length} selezionati</span>
          <div style={{display:"flex",gap:8}}><Btn variant="ghost" onClick={()=>setCsvStep("upload")}>← Indietro</Btn><Btn onClick={importCSVSelected} disabled={!Object.values(csvSel).some(Boolean)}>📥 Importa {Object.values(csvSel).filter(Boolean).length} Lead</Btn></div>
        </div>
      </div>)}
      {csvStep==="done"&&(<div style={{padding:"40px 26px",textAlign:"center"}}><div style={{fontSize:48,marginBottom:16}}>✅</div><div style={{fontSize:18,fontWeight:800,color:"#15803D",marginBottom:8}}>Importazione completata!</div><div style={{fontSize:14,color:C.muted,marginBottom:24}}>{Object.values(csvSel).filter(Boolean).length} lead importati</div><div style={{display:"flex",gap:10,justifyContent:"center"}}><Btn variant="ghost" onClick={()=>{setCsvStep("upload");setCsvParsed([]); }}>Importa altri</Btn><Btn onClick={()=>{setCsvModal(false);setCsvStep("upload");setTab("funnel");}}>Vedi nel Funnel →</Btn></div></div>)}
    </div>
  </div>);

  // ══════════════════════════════════════════════════════════
  // CAMPAGNA LEAD FREDDI
  // ══════════════════════════════════════════════════════════
  const CampagnaView = () => {
    const [selFreddi, setSelFreddi] = useState(new Set());
    const leadFreddi=clients.filter(c=>c.lead&&(c.funnelStato==="nuovo"||c.funnelStato==="contattato"||!c.funnelStato));
    const giorni30=new Date(); giorni30.setDate(giorni30.getDate()-30);
    const freddissimi=leadFreddi.filter(c=>new Date(c.ultimoContatto)<giorni30);

    function bulkDelete(ids){
      if(authRole==="segretaria"){alert("La segretaria non può eliminare clienti.");return;}
      const arr=[...ids];
      if(!arr.length)return;
      if(!window.confirm(`Eliminare ${arr.length} lead selezionati?`))return;
      setClients(prev=>prev.filter(c=>!ids.has(c.id)));
      setSelFreddi(new Set());
      sb.from("fp_clienti").delete().in("id",arr).then(({error})=>{if(error)console.warn("Supabase bulk delete:",error.message);});
    }
    function deleteAll(){
      if(authRole==="segretaria"){alert("La segretaria non può eliminare clienti.");return;}
      if(!leadFreddi.length)return;
      if(!window.confirm(`Eliminare tutti i ${leadFreddi.length} lead freddi?`))return;
      const ids=leadFreddi.map(l=>l.id);
      setClients(prev=>prev.filter(c=>!ids.includes(c.id)));
      setSelFreddi(new Set());
      sb.from("fp_clienti").delete().in("id",ids).then(({error})=>{if(error)console.warn("Supabase bulk delete:",error.message);});
    }
    function toggleSel(id){setSelFreddi(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});}

    return(<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
        {[{l:"Lead Freddi",v:leadFreddi.length,c:"#6366F1",i:"❄️",s:"Nuovo o solo contattato"},{l:"Non contattati >30gg",v:freddissimi.length,c:"#DC2626",i:"🥶",s:"Riattivare urgente"},{l:"Messaggi Inviati",v:Object.keys(campagnaSent).length,c:"#16A34A",i:"✅",s:"Questa sessione"}].map(k=>(<div key={k.l} style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:"18px 20px",boxShadow:"0 1px 4px rgba(28,63,110,0.06)"}}><div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>{k.l}</div><div style={{fontSize:26,fontWeight:800,color:k.c}}>{k.v}</div><div style={{fontSize:11,color:C.muted,marginTop:4}}>{k.s}</div></div><div style={{width:40,height:40,borderRadius:10,background:`${k.c}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{k.i}</div></div></div>))}
      </div>
      <div style={{background:`linear-gradient(135deg,${C.navyBg},${C.navyTint})`,border:`1px solid ${C.navyTint}`,borderRadius:14,padding:"18px 22px",marginBottom:20,display:"flex",alignItems:"center",gap:16}}>
        <div style={{flex:1}}><div style={{fontWeight:800,fontSize:15,color:C.navy,marginBottom:4}}>🤖 Genera Campagna IA</div><div style={{fontSize:13,color:C.muted}}>L'IA crea messaggi WhatsApp personalizzati per ogni lead freddo, pronti in un click</div></div>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="ghost" onClick={()=>fileImportRef.current?.click()} disabled={fileImportLoad} style={{whiteSpace:"nowrap"}}>{fileImportLoad?"⏳ Analisi IA…":"📂 Importa da file"}</Btn>
          <Btn variant="blue" onClick={()=>generaCampagna(leadFreddi)} disabled={campagnaLoad||leadFreddi.length===0}>{campagnaLoad?"⏳ Generando…":"🚀 Genera Messaggi IA"}</Btn>
        </div>
        <input ref={fileImportRef} type="file" accept=".xlsx,.xls,.docx" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){handleFileImport(e.target.files[0]);e.target.value="";}}}/>
      </div>
      {campagnaLoad&&<div style={{textAlign:"center",padding:40}}><div style={{width:44,height:44,border:`3px solid ${C.border}`,borderTopColor:C.navy,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 16px"}}/><div style={{fontWeight:700,color:C.navy}}>FinpraticaAI sta scrivendo…</div></div>}
      {leadFreddi.length===0&&<div style={{textAlign:"center",padding:48,color:C.muted,fontSize:14}}>✅ Nessun lead freddo al momento!</div>}
      {leadFreddi.length>0&&(
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
          <button onClick={()=>setSelFreddi(new Set(leadFreddi.map(l=>l.id)))} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${C.border}`,background:C.white,cursor:"pointer",fontSize:13,fontWeight:600,color:C.navy,fontFamily:"inherit"}}>☑️ Seleziona tutti</button>
          <button disabled={selFreddi.size===0} onClick={()=>bulkDelete(selFreddi)} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${selFreddi.size>0?"#FECACA":C.border}`,background:selFreddi.size>0?"#FFF1F2":C.light,cursor:selFreddi.size>0?"pointer":"default",fontSize:13,fontWeight:600,color:selFreddi.size>0?"#DC2626":C.muted,fontFamily:"inherit",opacity:selFreddi.size===0?0.5:1}}>🗑 Elimina selezionati{selFreddi.size>0?` (${selFreddi.size})`:""}</button>
          <button onClick={deleteAll} style={{padding:"7px 14px",borderRadius:8,border:"1px solid #FECACA",background:"#FFF1F2",cursor:"pointer",fontSize:13,fontWeight:600,color:"#DC2626",fontFamily:"inherit"}}>🗑 Cancella tutto</button>
          {selFreddi.size>0&&<span style={{fontSize:12,color:C.muted,marginLeft:4}}>{selFreddi.size} selezionati</span>}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:14}}>
        {leadFreddi.map(lead=>{
          const isFreddissimo=new Date(lead.ultimoContatto)<giorni30; const msg=campagnaMsgs[lead.id]; const isSel=selFreddi.has(lead.id);
          return(<div key={lead.id} style={{background:isSel?C.navyBg:C.white,borderRadius:14,border:`1px solid ${isSel?C.navyTint:C.border}`,padding:18,borderLeft:`3px solid ${isFreddissimo?"#DC2626":"#B45309"}`,boxShadow:"0 1px 4px rgba(28,63,110,0.06)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <input type="checkbox" checked={isSel} onChange={()=>toggleSel(lead.id)} style={{width:16,height:16,accentColor:C.navy,cursor:"pointer",flexShrink:0}}/>
              <Avatar name={lead.nome} score={lead.score} size={38}/>
              <div style={{flex:1,minWidth:0}}><div style={{fontWeight:800,fontSize:14}}>{lead.nome}</div><div style={{fontSize:12,color:C.muted}}>{lead.datore||"—"} · Ultimo: {fdate(lead.ultimoContatto)}</div></div>
              <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}><Chip {...SVC[lead.servizio]} label={SVC[lead.servizio]?.label} style={{fontSize:10,padding:"2px 7px"}}/>{campagnaSent[lead.id]&&<span style={{fontSize:10,background:"#F0FDF4",color:"#15803D",border:"1px solid #BBF7D0",borderRadius:20,padding:"2px 7px",fontWeight:700}}>✅ Inviato</span>}</div>
            </div>
            {msg?(<div>
              <textarea value={msg} onChange={e=>setCampagnaMsgs(p=>({...p,[lead.id]:e.target.value}))} style={{width:"100%",background:C.navyBg,border:`1px solid ${C.navyTint}`,borderRadius:8,padding:"10px 12px",fontSize:12,color:C.text,resize:"none",height:90,outline:"none",fontFamily:"inherit",lineHeight:1.6,boxSizing:"border-box"}}/>
              <div style={{display:"flex",gap:6,marginTop:6}}>
                <a href={`https://wa.me/${lead.tel?.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"7px",borderRadius:7,background:"#F0FDF4",border:"1px solid #BBF7D0",color:"#15803D",fontSize:12,fontWeight:700,textDecoration:"none"}}>📱 WhatsApp</a>
                <button onClick={()=>navigator.clipboard?.writeText(msg)} style={{padding:"7px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:C.light,cursor:"pointer",fontSize:12,fontWeight:600,color:C.muted,fontFamily:"inherit"}}>📋</button>
                <button onClick={()=>setCampagnaSent(p=>({...p,[lead.id]:true}))} style={{flex:1,padding:"7px",borderRadius:7,border:"none",background:C.navy,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>✅ Inviato</button>
              </div>
            </div>):(<div style={{fontSize:12,color:C.muted,padding:"10px 0",fontStyle:"italic"}}>Clicca "Genera Messaggi IA" per creare il messaggio personalizzato</div>)}
            <div style={{display:"flex",gap:6,marginTop:10}}><Btn variant="ghost" style={{fontSize:12,padding:"6px 12px",flex:1,justifyContent:"center"}} onClick={()=>{setForm({...lead});setModal("form");}}>✏️ Modifica</Btn><Btn variant="danger" style={{fontSize:12,padding:"6px 12px",flex:1,justifyContent:"center"}} onClick={()=>delCl(lead.id)}>🗑 Elimina</Btn></div>
          </div>);
        })}
      </div>
    </div>);
  };

  // ══════════════════════════════════════════════════════════
  // PREVENTIVO (CQ + Prestito Personale)
  // ══════════════════════════════════════════════════════════
  const PreventivoView = () => {
    // ── CQ locals ──
    const importo = +prevForm.importo||0;
    const fascia = importo<=0?"—":importo<=15000?"0 – 15.000 €":importo<=30000?"15.000 – 30.000 €":"Oltre 30.000 €";
    const fasciaCol = importo<=0?C.muted:importo<=15000?"#16A34A":importo<=30000?"#B45309":"#DC2626";
    // ── PP locals ──
    const ppImp = +ppImporto||0;
    const ppRedd = +ppReddito||0;
    const ppBestRata = ppRisultati[0]?.rata||0;
    const ppRataPct = ppRedd>0 ? ppBestRata/ppRedd : 0;
    const ppCoobWarn = ppRataPct>0.20 && ppRedd>0;
    const ppRataColor = ppRataPct>0.30?"#DC2626":ppRataPct>0.20?"#B45309":"#15803D";
    const ppCompass = ppRisultati.find(r=>r.codice==="COMPASS");

    return(
      <div style={{maxWidth:780}}>

        {/* ── SELETTORE PRODOTTO ── */}
        <div style={{display:"flex",gap:4,marginBottom:20,background:C.white,border:`1px solid ${C.border}`,borderRadius:13,padding:4,boxShadow:"0 1px 4px rgba(28,63,110,0.06)"}}>
          {[{id:"cessione_quinto",l:"📑 Cessione del Quinto"},{id:"prestito_personale",l:"💳 Prestito Personale"}].map(p=>(
            <button key={p.id} onClick={()=>{setPrevServizio(p.id);setPpRisultati([]);setPrevRisultati([]);}}
              style={{flex:1,padding:"11px 14px",borderRadius:10,border:"none",background:prevServizio===p.id?C.navy:"transparent",color:prevServizio===p.id?"#fff":C.muted,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>
              {p.l}
            </button>
          ))}
        </div>

        {/* ════════ CESSIONE DEL QUINTO — Comparatore Bibanca ════════ */}
        {prevServizio==="cessione_quinto"&&(<>
          <Card style={{padding:28,marginBottom:18}}>
            <div style={{fontSize:16,fontWeight:800,color:C.navy,marginBottom:4}}>📋 Crea Preventivo — Cessione del Quinto</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:22}}>Inserisci i parametri del cliente e confronta tutti i canali Bibanca disponibili</div>
            {/* IMPORTO prominente */}
            <div style={{padding:"18px 20px",background:`linear-gradient(135deg,${C.navyBg},${C.navyTint})`,border:`2px solid ${C.navy}`,borderRadius:14,marginBottom:20}}>
              <label style={{fontSize:11,fontWeight:800,color:C.navy,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:8}}>💰 Importo Richiesto € <span style={{color:C.red}}>*</span></label>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <input type="number" min="0" step="500" value={prevForm.importo} onChange={e=>setPrevForm(p=>({...p,importo:e.target.value}))} placeholder="Es: 20000" required
                  style={{flex:1,padding:"12px 14px",border:`1.5px solid ${C.navy}`,borderRadius:10,fontSize:18,fontWeight:700,color:C.navy,background:C.white,outline:"none",fontFamily:"inherit"}}/>
                {importo>0&&<div style={{background:C.white,border:`1.5px solid ${fasciaCol}`,borderRadius:10,padding:"8px 14px",textAlign:"center",minWidth:130}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Fascia TAN</div>
                  <div style={{fontSize:13,fontWeight:800,color:fasciaCol}}>{fascia}</div>
                </div>}
              </div>
            </div>
            {/* Altri parametri */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18}}>
              <Inp label="Nome Cliente (opzionale)" value={prevForm.nome} onChange={e=>setPrevForm(p=>({...p,nome:e.target.value}))} placeholder="Mario Rossi"/>
              <Inp label="Età *" type="number" min="18" max="90" value={prevForm.eta} onChange={e=>setPrevForm(p=>({...p,eta:e.target.value}))} placeholder="Es: 52"/>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Categoria</label>
                <select value={prevForm.categoria} onChange={e=>setPrevForm(p=>({...p,categoria:e.target.value}))} style={{padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,color:C.text,background:C.white,outline:"none",fontFamily:"inherit"}}>
                  <option value="STATALI_PUBBLICI">Statali / Pubblici</option>
                  <option value="PARAPUBBLICI">Parapubblici</option>
                  <option value="PRIVATI">Privati</option>
                  <option value="PENSIONATI">Pensionati INPS</option>
                </select>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Durata</label>
                <select value={prevForm.durata} onChange={e=>setPrevForm(p=>({...p,durata:+e.target.value}))} style={{padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,color:C.text,background:C.white,outline:"none",fontFamily:"inherit"}}>
                  {DURATE_DISPONIBILI.map(d=><option key={d} value={d}>{d} mesi ({(d/12).toFixed(0)} anni)</option>)}
                </select>
              </div>
            </div>
            <Btn variant="blue" disabled={!prevForm.importo||!prevForm.eta} onClick={calcolaPrevBibanca}>🔄 Calcola e confronta canali Bibanca</Btn>
          </Card>
          {prevRisultati.length>0&&(
            <Card style={{padding:24}}>
              <div style={{fontSize:14,fontWeight:800,color:C.navy,marginBottom:4}}>📊 Confronto Canali Bibanca — {prevForm.categoria.replace("_"," ")} · {prevForm.durata} mesi · €{importo.toLocaleString("it-IT")}</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Ordinati per TAN crescente — il canale con TAN più basso è il più conveniente per il cliente</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 72px 80px 96px 110px",gap:8,padding:"8px 12px",background:C.light,borderRadius:8,marginBottom:8,fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>
                <div>Canale</div><div>TAN</div><div>Prov.Max</div><div>Rata/mese</div><div>Selezione</div>
              </div>
              {prevRisultati.map((r,i)=>{
                const isBest=i===0; const isSel=prevSel===r.codice;
                return(<div key={r.codice} style={{display:"grid",gridTemplateColumns:"1fr 72px 80px 96px 110px",gap:8,padding:"12px",borderRadius:10,border:isBest?`2px solid #16A34A`:isSel?`1px solid ${C.navyTint}`:`1px solid ${C.border}`,background:isBest?"#F0FDF4":isSel?C.navyBg:C.white,marginBottom:8,alignItems:"center",transition:"all 0.15s"}}>
                  <div><span style={{fontWeight:800,fontSize:13,color:r.colore}}>{r.canale}</span>{isBest&&<span style={{fontSize:10,background:"#16A34A",color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:700,marginLeft:6}}>🏆 Miglior TAN</span>}</div>
                  <div style={{fontWeight:800,fontSize:14,color:isBest?"#16A34A":C.text}}>{r.tan_applicato.toFixed(2)}%</div>
                  <div style={{fontSize:12,color:C.muted}}>{r.provMax!==undefined?r.provMax.toFixed(2)+"%":"—"}</div>
                  <div style={{fontWeight:700,fontSize:14,color:C.navy}}>€{r.rata.toFixed(2)}</div>
                  <button onClick={()=>setPrevSel(r.codice)} style={{padding:"6px 10px",borderRadius:7,border:`1px solid ${isSel?"#16A34A":C.border}`,background:isSel?"#F0FDF4":C.white,cursor:"pointer",fontSize:11,fontWeight:700,color:isSel?"#15803D":C.navy,fontFamily:"inherit",whiteSpace:"nowrap"}}>{isSel?"✅ Selezionato":"Seleziona"}</button>
                </div>);
              })}
              {prevSel&&(()=>{const r=prevRisultati.find(x=>x.codice===prevSel);return r?(<div style={{marginTop:8,padding:"14px 16px",background:C.navyBg,border:`1px solid ${C.navyTint}`,borderRadius:10,fontSize:14,color:C.navy,fontWeight:600}}>✅ Preventivo selezionato: <strong>{r.canale}</strong> · TAN <strong>{r.tan_applicato.toFixed(2)}%</strong> · Rata mensile <strong>€{r.rata.toFixed(2)}</strong> · {prevForm.durata} mesi{prevForm.nome?` · Cliente: ${prevForm.nome}`:""}</div>):null;})()}
            </Card>
          )}
          {prevRisultati.length===0&&<div style={{textAlign:"center",padding:48,color:C.muted,fontSize:14,background:C.white,borderRadius:14,border:`1px solid ${C.border}`}}>Inserisci i parametri e clicca "Calcola e confronta" per vedere il comparatore</div>}
        </>)}

        {/* ════════ PRESTITO PERSONALE — Agos · Compass · Findomestic ════════ */}
        {prevServizio==="prestito_personale"&&(<>

          {/* Form input */}
          <Card style={{padding:28,marginBottom:18}}>
            <div style={{fontSize:16,fontWeight:800,color:C.navy,marginBottom:4}}>💳 Comparatore Prestito Personale</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:22}}>Confronta Agos, Compass e Findomestic — ordinati per rata mensile crescente</div>

            {/* Importo prominente */}
            <div style={{padding:"18px 20px",background:`linear-gradient(135deg,${C.navyBg},${C.navyTint})`,border:`2px solid ${C.navy}`,borderRadius:14,marginBottom:16}}>
              <label style={{fontSize:11,fontWeight:800,color:C.navy,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:8}}>💰 Importo Richiesto € <span style={{color:C.red}}>*</span></label>
              <input type="number" min="500" step="500" value={ppImporto} onChange={e=>setPpImporto(e.target.value)} placeholder="Es: 15000" required
                style={{width:"100%",padding:"12px 14px",border:`1.5px solid ${C.navy}`,borderRadius:10,fontSize:18,fontWeight:700,color:C.navy,background:C.white,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18}}>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Durata</label>
                <select value={ppDurata} onChange={e=>setPpDurata(+e.target.value)} style={{padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,color:C.text,background:C.white,outline:"none",fontFamily:"inherit"}}>
                  {DURATE_PRESTITO.map(d=><option key={d} value={d}>{d} mesi ({(d/12).toFixed(d%12===0?0:1)} anni)</option>)}
                </select>
              </div>
              <Inp label="Reddito netto mensile € (opzionale — per analisi coobligato)" type="number" min="0" value={ppReddito} onChange={e=>setPpReddito(e.target.value)} placeholder="Es: 1800"/>
            </div>

            <Btn variant="blue" disabled={!ppImporto} onClick={calcolaPP}>🔄 Ricalcola</Btn>
          </Card>

          {/* Placeholder prima del calcolo */}
          {ppRisultati.length===0&&<div style={{textAlign:"center",padding:48,color:C.muted,fontSize:14,background:C.white,borderRadius:14,border:`1px solid ${C.border}`}}>Inserisci l'importo e clicca "Ricalcola" per confrontare Agos, Compass e Findomestic</div>}

          {/* Tabella comparativa */}
          {ppRisultati.length>0&&(
            <Card style={{padding:24,marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:800,color:C.navy,marginBottom:4}}>📊 Comparatore Prestito Personale — {ppDurata} mesi · €{ppImp.toLocaleString("it-IT")}</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Ordinati per rata mensile crescente — il miglior istituto è quello con rata più bassa</div>

              {/* Header */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 70px 74px 96px 110px 110px",gap:8,padding:"8px 12px",background:C.light,borderRadius:8,marginBottom:8,fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>
                <div>Istituto</div><div>TAN</div><div>TAEG</div><div>Rata/mese</div><div>Interessi tot.</div><div>Costo totale</div>
              </div>

              {ppRisultati.map((r,i)=>{
                const isBest=i===0;
                return(
                  <div key={r.codice} style={{display:"grid",gridTemplateColumns:"1fr 70px 74px 96px 110px 110px",gap:8,padding:"14px 12px",borderRadius:10,border:isBest?`2px solid #16A34A`:`1px solid ${C.border}`,background:isBest?"#F0FDF4":C.white,marginBottom:8,alignItems:"center",transition:"all 0.15s"}}>
                    {/* Istituto + badge */}
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:r.badge?4:0}}>
                        <span style={{fontWeight:800,fontSize:14,color:r.colore}}>{r.label}</span>
                        {isBest&&<span style={{fontSize:10,background:"#16A34A",color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:700}}>🏆 Migliore</span>}
                      </div>
                      {r.badge&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:r.badgeBg,border:`1px solid ${r.badgeBorder}`,color:r.badgeColor,fontWeight:700}}>{r.badge}</span>}
                      {r.spese_istruttoria>0&&<div style={{fontSize:11,color:C.muted,marginTop:3}}>Istruttoria €{r.spese_istruttoria.toFixed(0)} · Incasso €{r.spese_rata.toFixed(2)}/rata</div>}
                    </div>
                    <div style={{fontWeight:800,fontSize:13,color:isBest?"#16A34A":C.text}}>{r.tan.toFixed(2)}%</div>
                    <div style={{fontSize:12,color:C.muted,fontWeight:600}}>{r.taeg.toFixed(2)}%</div>
                    <div style={{fontWeight:800,fontSize:15,color:isBest?"#16A34A":C.navy}}>€{r.rata.toFixed(2)}</div>
                    <div style={{fontSize:12,color:C.muted}}>€{r.interessiTotali.toFixed(0)}</div>
                    <div style={{fontSize:12,color:C.muted,fontWeight:600}}>€{r.costoTotale.toFixed(0)}</div>
                  </div>
                );
              })}

              {/* Riepilogo miglior offerta */}
              {(()=>{const r=ppRisultati[0];return r?(<div style={{marginTop:8,padding:"14px 16px",background:C.navyBg,border:`1px solid ${C.navyTint}`,borderRadius:10,fontSize:14,color:C.navy,fontWeight:600}}>✅ Migliore offerta: <strong style={{color:r.colore}}>{r.label}</strong> · TAN <strong>{r.tan.toFixed(2)}%</strong> · TAEG <strong>{r.taeg.toFixed(2)}%</strong> · Rata <strong>€{r.rata.toFixed(2)}/mese</strong> · Interessi totali <strong>€{r.interessiTotali.toFixed(0)}</strong></div>):null;})()}
            </Card>
          )}

          {/* ── VALUTAZIONE COOBLIGATO ── appare se rata/reddito > 20% */}
          {ppCoobWarn&&ppRisultati.length>0&&(
            <Card style={{padding:22,marginBottom:16,border:`1.5px solid ${ppRataPct>0.30?"#FECACA":"#FDE68A"}`}}>
              <div style={{fontSize:14,fontWeight:800,color:ppRataPct>0.30?"#DC2626":"#B45309",marginBottom:12}}>
                {ppRataPct>0.30?"⚠️ Attenzione — Rapporto rata/reddito elevato":"⚡ Valutazione Coobligato"}
              </div>
              {/* Indicatore visivo */}
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <div style={{flex:1,background:C.light,borderRadius:6,height:10,overflow:"hidden"}}>
                  <div style={{width:`${Math.min(ppRataPct*100,100).toFixed(0)}%`,height:"100%",background:ppRataColor,borderRadius:6,transition:"width 0.4s"}}/>
                </div>
                <span style={{fontSize:15,fontWeight:800,color:ppRataColor,minWidth:50}}>{(ppRataPct*100).toFixed(1)}%</span>
                <span style={{fontSize:12,color:C.muted}}>di €{ppRedd.toLocaleString("it-IT")}</span>
              </div>
              {/* Spiegazione */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
                {[
                  {soglia:"< 20%",label:"Ideale",desc:"Nessun coobligato necessario",color:"#15803D",bg:"#F0FDF4",border:"#BBF7D0"},
                  {soglia:"20–30%",label:"Attenzione",desc:"Valutare coobligato per sicurezza",color:"#B45309",bg:"#FFFBEB",border:"#FDE68A"},
                  {soglia:"> 30%",label:"Critico",desc:"Coobligato fortemente consigliato",color:"#DC2626",bg:"#FFF1F2",border:"#FECACA"},
                ].map(s=>(
                  <div key={s.soglia} style={{padding:"10px 12px",borderRadius:9,background:s.bg,border:`1px solid ${s.border}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:s.color,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.soglia}</div>
                    <div style={{fontSize:12,fontWeight:800,color:s.color,marginTop:2}}>{s.label}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:3,lineHeight:1.4}}>{s.desc}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:13,color:ppRataPct>0.30?"#991B1B":"#92400E",lineHeight:1.6}}>
                {ppRataPct>0.30
                  ?"Con un rapporto rata/reddito superiore al 30%, molti istituti potrebbero rifiutare la pratica senza coobligato. Compass è l'unico che accetta coobligato senza reddito dimostrabile."
                  :"Il rapporto rata/reddito supera il 20%. Valuta l'uso di un coobligato per migliorare il profilo creditizio e aumentare le probabilità di approvazione."}
              </div>
            </Card>
          )}

          {/* ── BOX SPECIALE COMPASS — coobligato senza reddito ── */}
          {ppCompass&&ppRisultati.length>0&&(
            <Card style={{padding:22,border:"1.5px solid #DDD6FE",background:"#FAF5FF"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <div style={{width:36,height:36,borderRadius:10,background:"#EDE9FE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🤝</div>
                <div>
                  <div style={{fontSize:14,fontWeight:800,color:"#7C3AED"}}>Compass — Coobligato senza reddito</div>
                  <div style={{fontSize:12,color:"#6D28D9",marginTop:1}}>Vantaggio esclusivo rispetto agli altri istituti</div>
                </div>
              </div>
              <div style={{fontSize:13,color:"#4C1D95",lineHeight:1.7,marginBottom:14}}>{ppCompass.coobligato_note}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                {[
                  {i:"👨‍👩‍👧",t:"Coniuge/Convivente","d":"Anche senza reddito proprio"},
                  {i:"👨‍👩‍👦","t":"Familiare","d":"Genitore, fratello, figlio adulto"},
                  {i:"✅","t":"Reddito informale","d":"Libero professionista, lavoratore nero"},
                  {i:"📈","t":"Migliora il profilo","d":"Aumenta le probabilità di approvazione"},
                ].map(v=>(
                  <div key={v.t} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"10px 12px",background:C.white,borderRadius:9,border:"1px solid #DDD6FE"}}>
                    <span style={{fontSize:18,flexShrink:0}}>{v.i}</span>
                    <div><div style={{fontSize:12,fontWeight:700,color:"#7C3AED"}}>{v.t}</div><div style={{fontSize:11,color:C.muted,marginTop:1}}>{v.d}</div></div>
                  </div>
                ))}
              </div>
              <div style={{background:"#EDE9FE",borderRadius:9,padding:"10px 14px",fontSize:12,color:"#4C1D95",lineHeight:1.6}}>
                💡 <strong>Quando conviene Compass:</strong> cliente con reddito basso o nella fascia 20–30% rata/reddito, con un familiare disponibile come coobligato. Tasso leggermente più alto, ma pratica approvata vs. rifiuto altrove.
              </div>
            </Card>
          )}

        </>)}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  // LAYOUT
  // ══════════════════════════════════════════════════════════
  const TABS=[
    {id:"dashboard",  i:"📊",l:"Dashboard"},
    {id:"preventivo", i:"📋",l:"Crea Preventivo"},
    {id:"clienti",    i:"👥",l:"Clienti",        n:stats.tot},
    {id:"lead",       i:"🎯",l:"Lead",            n:stats.leads},
    {id:"funnel",     i:"🔀",l:"Funnel Lead"},
    {id:"campagna",   i:"❄️",l:"Lead Freddi",     n:clients.filter(c=>c.lead&&(!c.funnelStato||c.funnelStato==="nuovo")).length,alert:clients.filter(c=>c.lead&&(!c.funnelStato||c.funnelStato==="nuovo")).length>0},
    {id:"stat_lead",  i:"📈",l:"Statistiche"},
    {id:"youtube",    i:"▶️", l:"YouTube Leads",  n:ytLeads.length,alert:ytLeads.length>0},
    {id:"richiami",   i:"🔔",l:"Richiami IA",     n:praticheDaRichiamare.length,alert:true},
    {id:"lead_ia",    i:"🔍",l:"Lead IA"},
    {id:"provvigioni",i:"💰",l:"Provvigioni",     n:provs.filter(p=>p.stato==="da_liquidare").length},
    {id:"promemoria", i:"📅",l:"Promemoria",      n:notifs.length,alert:notifs.length>0},
    {id:"ai",         i:"🤖",l:"FinpraticaAI"},
    {id:"impostazioni",i:"⚙️",l:"Impostazioni"},
  ];
  const PAGE={
    dashboard:    {t:"Dashboard",           s:new Date().toLocaleDateString("it-IT",{weekday:"long",year:"numeric",month:"long",day:"numeric"})},
    preventivo:   {t:"Crea Preventivo",     s:"Comparatore Bibanca CQ · confronta canali per TAN e rata mensile"},
    clienti:      {t:selCl?clients.find(c=>c.id===selId)?.nome||"Cliente":"Clienti", s:`${stats.tot} clienti · ${stats.trat} in trattativa`},
    lead:         {t:"Lead Pipeline",        s:`${stats.leads} lead attivi`},
    funnel:       {t:"Funnel Lead",          s:"Kanban · trascina per cambiare stato"},
    campagna:     {t:"Campagna Lead Freddi", s:"Riattiva i lead inattivi con messaggi IA personalizzati"},
    stat_lead:    {t:"Statistiche Lead",     s:"Conversione per canale, servizio e funnel"},
    youtube:      {t:"YouTube Lead Scanner", s:`Analisi commenti IA · ${ytLeads.length} lead trovati · importa nel Funnel`},
    richiami:     {t:"Richiami IA",          s:`${stats.scadute} scadute · ${stats.inScad} in scadenza`},
    lead_ia:      {t:"Lead Intelligence IA", s:"Ricerca automatica su social e web"},
    provvigioni:  {t:"Provvigioni",          s:`${eur(stats.totProv)} maturate · ${eur(stats.daLiquid)} da liquidare`},
    promemoria:   {t:"Promemoria",           s:`${notifs.length} scadenze oggi`},
    ai:           {t:"FinpraticaAI",         s:"Assistente mediazione creditizia"},
    impostazioni: {t:"Impostazioni",         s:"Email, WhatsApp, YouTube, API, notifiche e dati azienda"},
  };

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#EDEAE3;font-family:'DM Sans','Plus Jakarta Sans',sans-serif;color:#1A1E2C}
        ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:#EDEAE3}::-webkit-scrollbar-thumb{background:#C8C5BC;border-radius:4px}
        input,select,textarea,button{font-family:inherit}
        input[type=date]::-webkit-calendar-picker-indicator{opacity:0.5;cursor:pointer}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes dot0{0%,80%,100%{transform:scale(0);opacity:0.3}40%{transform:scale(1);opacity:1}}
        @keyframes dot1{0%,80%,100%{transform:scale(0);opacity:0.3}40%{transform:scale(1);opacity:1};animation-delay:0.16s}
        @keyframes dot2{0%,80%,100%{transform:scale(0);opacity:0.3}40%{transform:scale(1);opacity:1};animation-delay:0.32s}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.3)}50%{box-shadow:0 0 0 6px rgba(220,38,38,0)}}
      `}</style>
      <div style={{display:"flex",minHeight:"100vh"}}>
        {/* SIDEBAR */}
        <aside style={{width:222,background:"linear-gradient(180deg,#2B5F9E 0%,#1C3F6E 45%,#142D52 100%)",borderRight:`1px solid #0F2849`,display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,height:"100vh",zIndex:50,boxShadow:"2px 0 12px rgba(28,63,110,0.10)"}}>
          <div style={{padding:"20px 18px 16px",borderBottom:`1px solid rgba(255,255,255,0.12)`}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:40,height:40,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <img src="/logo.png" alt="finpratica" style={{width:"100%",height:"100%",objectFit:"contain",mixBlendMode:"lighten",background:"transparent"}}/>
              </div>
              <div>
                <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:15,letterSpacing:"-0.02em"}}>
                  <span style={{color:"#7EC8F0"}}>fin</span><span style={{color:"#fff"}}>pratica</span>
                </div>
                <div style={{fontSize:10,color:"#93C5E8",fontWeight:700,marginTop:1,letterSpacing:"0.04em"}}>CRM · IA Attiva</div>
              </div>
            </div>
          </div>
          <nav style={{flex:1,padding:"12px 10px",display:"flex",flexDirection:"column",gap:2,overflowY:"auto"}}>
            {TABS.filter(t=>{
            if(t.id==="impostazioni"&&authRole!=="admin")return false;
            if(t.id==="provvigioni"&&authRole==="segretaria")return false;
            return true;
          }).map(t=>{
              const active=tab===t.id;
              const isAlert=t.alert&&t.n>0;
              return(
                <button key={t.id} onClick={()=>{setTab(t.id);if(t.id!=="clienti")setSelId(null);}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",background:active?"rgba(255,255,255,0.15)":"transparent",color:active?"#fff":"rgba(255,255,255,0.75)",cursor:"pointer",fontWeight:active?800:500,fontSize:13.5,width:"100%",textAlign:"left",transition:"all 0.12s",position:"relative",boxShadow:active?"inset 0 0 0 1px rgba(255,255,255,0.2)":"none"}} onMouseOver={e=>{if(!active){e.currentTarget.style.background="rgba(255,255,255,0.10)";e.currentTarget.style.color="#fff";}}} onMouseOut={e=>{if(!active){e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,0.75)";}}}> 
                  <span style={{fontSize:16,width:20,textAlign:"center"}}>{t.i}</span>
                  <span style={{flex:1}}>{t.l}</span>
                  {t.n>0&&<span style={{background:isAlert?"rgba(220,38,38,0.85)":"rgba(255,255,255,0.2)",color:"#fff",border:`1px solid ${isAlert?"rgba(220,38,38,0.5)":"rgba(255,255,255,0.3)"}`,borderRadius:20,padding:"1px 7px",fontSize:11,fontWeight:700,animation:isAlert&&t.id==="richiami"?"pulse 2s infinite":""}}>{t.n}</span>}
                </button>
              );
            })}
          </nav>
          <div style={{padding:"10px 14px",borderTop:`1px solid rgba(255,255,255,0.08)`}}>
            <button onClick={syncLeadDaServer} disabled={webhookSync} style={{width:"100%",padding:"9px 12px",borderRadius:9,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(74,144,217,0.2)",color:"#A5D4F5",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"all 0.15s"}} onMouseOver={e=>e.currentTarget.style.background="rgba(74,144,217,0.35)"} onMouseOut={e=>e.currentTarget.style.background="rgba(74,144,217,0.2)"}>
              {webhookSync?"⏳ Sincronizzando…":"🔗 Sync Lead (Meta/Zapier)"}
            </button>
            {webhookCount>0&&<div style={{textAlign:"center",fontSize:11,color:"#7EC8F0",marginTop:6,fontWeight:700}}>✅ {webhookCount} nuovi lead ricevuti!</div>}
            {!webhookUrl&&<div onClick={()=>setWebhookModal(true)} style={{textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:5,cursor:"pointer",textDecoration:"underline"}}>Configura webhook</div>}
          </div>
          <div style={{padding:"14px 18px",borderTop:`1px solid rgba(255,255,255,0.12)`,background:"rgba(0,0,0,0.15)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#2B5F9E)",border:`1.5px solid rgba(255,255,255,0.3)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:13,flexShrink:0}}>
                {(authUser||"A")[0].toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:13,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{authUser||"Admin"}</div>
                <div style={{fontSize:11,color:"#93C5E8",fontWeight:600}}>{authRole==="admin"?"Amministratore":authRole==="consulente"?"Consulente":"Segretaria"}</div>
              </div>
              <button onClick={doLogout} title="Esci" style={{width:30,height:30,borderRadius:8,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(220,38,38,0.15)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,transition:"all 0.15s"}} onMouseOver={e=>e.currentTarget.style.background="rgba(220,38,38,0.35)"} onMouseOut={e=>e.currentTarget.style.background="rgba(220,38,38,0.15)"}>
                🚪
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{marginLeft:222,flex:1,padding:"28px 28px 40px",minHeight:"100vh",animation:"fadeIn 0.25s ease"}}>
          <div style={{marginBottom:24}}>
            <h1 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:23,fontWeight:800,color:C.text,letterSpacing:"-0.02em"}}>{PAGE[tab]?.t}</h1>
            <div style={{fontSize:13,color:C.muted,marginTop:3}}>{PAGE[tab]?.s}</div>
          </div>
          {tab==="dashboard"    && <StableWrapper renderFn={Dashboard}/>}
          {tab==="preventivo"   && <StableWrapper renderFn={PreventivoView}/>}
          {tab==="clienti"      && <StableWrapper renderFn={TableView}/>}
          {tab==="lead"         && <StableWrapper renderFn={TableView} leadOnly/>}
          {tab==="funnel"       && <StableWrapper renderFn={LeadFunnelView}/>}
          {tab==="campagna"     && <StableWrapper renderFn={CampagnaView}/>}
          {tab==="stat_lead"    && <StableWrapper renderFn={StatLeadView}/>}
          {tab==="youtube"      && <StableWrapper renderFn={YouTubeView}/>}
          {tab==="richiami"     && <StableWrapper renderFn={RichiamiView}/>}
          {tab==="lead_ia"      && <StableWrapper renderFn={LeadIA}/>}
          {tab==="provvigioni"  && <StableWrapper renderFn={ProvvigioniView}/>}
          {tab==="promemoria"   && <StableWrapper renderFn={PromemoriaView}/>}
          {tab==="ai"           && <StableWrapper renderFn={AIView}/>}
          {tab==="impostazioni" && <StableWrapper renderFn={ImpostazioniView}/>}
        </main>
      </div>

      {csvModal && <StableWrapper renderFn={CSVModal}/>}
      {webhookModal && (
        <div onClick={e=>e.target===e.currentTarget&&setWebhookModal(false)} style={{position:"fixed",inset:0,background:"rgba(28,63,110,0.4)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"}}>
          <div style={{background:C.white,borderRadius:20,width:"100%",maxWidth:520,padding:"28px 30px",boxShadow:"0 24px 60px rgba(28,63,110,0.2)"}}>
            <div style={{fontSize:17,fontWeight:800,marginBottom:4}}>🔗 Configura Webhook Server</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:22}}>Inserisci l'URL del tuo server Node.js (webhook-server.js) per ricevere lead in automatico da Meta Ads, Zapier, Make</div>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>URL Server</div>
            <input value={webhookUrl} onChange={e=>setWebhookUrl(e.target.value)} placeholder="https://tuo-server.railway.app" style={{width:"100%",padding:"11px 14px",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:14,outline:"none",fontFamily:"inherit",marginBottom:8}}/>
            <div style={{fontSize:12,color:C.muted,marginBottom:20}}>Es: <code style={{background:C.light,padding:"2px 6px",borderRadius:4,fontSize:11}}>https://finpratica-api.railway.app</code></div>
            <div style={{background:C.navyBg,border:`1px solid ${C.navyTint}`,borderRadius:10,padding:"12px 14px",marginBottom:20,fontSize:12,color:C.navy}}>
              💡 <b>Come avviare il server:</b><br/>
              1. Carica <code>webhook-server.js</code> su Railway.app (gratis)<br/>
              2. Il server risponde su <code>/api/leads</code><br/>
              3. Collega Zapier: Meta Lead Ads → POST webhook
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <Btn variant="ghost" onClick={()=>setWebhookModal(false)}>Annulla</Btn>
              <Btn onClick={()=>{localStorage.setItem("fp_webhook",webhookUrl);setWebhookModal(false);syncLeadDaServer();}}>💾 Salva e Sincronizza</Btn>
            </div>
          </div>
        </div>
      )}

      {richiamoPopup && <StableWrapper renderFn={RichiamoPopup}/>}

      {/* MODAL RICHIAMO DETTAGLIO */}
      {showRichiamoDetail && <StableWrapper renderFn={RichiamoDetailModal}/>}

      {/* MODALS STANDARD */}
      {modal==="form"        && <StableWrapper renderFn={FormModal}/>}
      {modal==="crif"        && <StableWrapper renderFn={CrifModal}/>}
      {modal==="prov"        && <StableWrapper renderFn={ProvModal}/>}
      {modal==="prov_detail" && <StableWrapper renderFn={ProvDetailModal}/>}

      {/* MODAL IMPORT FILE LEAD FREDDI */}
      {fileImportOpen&&(
        <div style={{position:"fixed",inset:0,background:"rgba(28,63,110,0.45)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"}}>
          <div style={{background:C.white,borderRadius:20,padding:32,width:"100%",maxWidth:660,maxHeight:"90vh",overflow:"auto",boxShadow:"0 24px 60px rgba(28,63,110,0.18)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div>
                <div style={{fontSize:18,fontWeight:800}}>📂 Anteprima import · Filtro IA</div>
                <div style={{fontSize:13,color:C.muted,marginTop:3}}>Analisi completata — {fileImportRows.length+fileImportScartati.length} righe elaborate</div>
              </div>
              <button onClick={()=>setFileImportOpen(false)} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.light,cursor:"pointer",fontSize:16}}>×</button>
            </div>
            {/* Riepilogo */}
            <div style={{display:"flex",gap:10,marginBottom:18}}>
              <div style={{flex:1,background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,padding:"12px 16px",textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:900,color:"#16A34A"}}>{fileImportRows.length}</div>
                <div style={{fontSize:12,fontWeight:700,color:"#166534",marginTop:2}}>✅ Validi — da importare</div>
              </div>
              <div style={{flex:1,background:"#FFF1F2",border:"1px solid #FECACA",borderRadius:10,padding:"12px 16px",textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:900,color:"#DC2626"}}>{fileImportScartati.length}</div>
                <div style={{fontSize:12,fontWeight:700,color:"#7F1D1D",marginTop:2}}>🗑 Scartati dall'IA</div>
              </div>
            </div>
            {/* Nominativi validi */}
            {fileImportRows.length>0&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:"#166534",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>✅ Nominativi validi</div>
                <div style={{maxHeight:"26vh",overflow:"auto",border:"1px solid #BBF7D0",borderRadius:10}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 130px 180px",gap:8,padding:"8px 12px",background:"#F0FDF4",fontSize:11,fontWeight:700,color:"#166534",textTransform:"uppercase",letterSpacing:"0.06em",position:"sticky",top:0}}>
                    <div>Nome</div><div>Telefono</div><div>Email</div>
                  </div>
                  {fileImportRows.map((r,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 130px 180px",gap:8,padding:"9px 12px",borderBottom:`1px solid ${C.cream}`,fontSize:13,alignItems:"center"}}>
                      <div style={{fontWeight:600,color:C.text}}>{r.nome}</div>
                      <div style={{color:C.muted}}>{r.tel||"—"}</div>
                      <div style={{color:C.muted,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.email||"—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Nominativi scartati */}
            {fileImportScartati.length>0&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:"#7F1D1D",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>🗑 Scartati — non verranno importati</div>
                <div style={{maxHeight:"20vh",overflow:"auto",border:"1px solid #FECACA",borderRadius:10}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 120px 1fr",gap:8,padding:"8px 12px",background:"#FFF1F2",fontSize:11,fontWeight:700,color:"#7F1D1D",textTransform:"uppercase",letterSpacing:"0.06em",position:"sticky",top:0}}>
                    <div>Nome</div><div>Telefono</div><div>Motivo</div>
                  </div>
                  {fileImportScartati.map((r,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 120px 1fr",gap:8,padding:"9px 12px",borderBottom:`1px solid #FEE2E2`,fontSize:13,alignItems:"center",opacity:0.75}}>
                      <div style={{fontWeight:600,color:C.text}}>{r.nome||"—"}</div>
                      <div style={{color:C.muted}}>{r.tel||"—"}</div>
                      <div style={{fontSize:12,color:"#DC2626",fontWeight:600}}>{r.motivo||"—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:13,color:"#166534"}}>
              ✅ Solo i <strong>{fileImportRows.length} nominativi validi</strong> verranno aggiunti come <strong>lead freddi</strong> con stato <strong>Nuovo</strong>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <Btn variant="ghost" onClick={()=>setFileImportOpen(false)}>Annulla</Btn>
              <Btn variant="success" disabled={!fileImportRows.length} onClick={confirmFileImport}>✅ Importa {fileImportRows.length} lead validi</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ── Provvigioni View (inline per brevità) ──────────────────
  function YouTubeView(){
    const hasKey = !!ytApiKey;
    const interestColor = {alto:"#16A34A", medio:"#B45309", basso:"#6B7280"};
    const interestBg    = {alto:"#F0FDF4", medio:"#FFFBEB", basso:"#F9FAFB"};
    const interestBrd   = {alto:"#BBF7D0", medio:"#FDE68A", basso:"#E5E7EB"};

    return(
      <div>
        {/* Header card */}
        <div style={{background:"linear-gradient(135deg,#FF0000,#CC0000)",borderRadius:16,padding:"22px 26px",marginBottom:22,display:"flex",alignItems:"center",gap:20,boxShadow:"0 4px 20px rgba(220,0,0,0.2)"}}>
          <div style={{fontSize:48}}>▶️</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:20,fontWeight:900,color:"#fff",letterSpacing:"-0.02em"}}>YouTube Lead Scanner</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.8)",marginTop:4}}>Analizza i commenti di qualsiasi video YouTube con l'IA · Trova chi è interessato a prestiti e cessione del quinto · Importa nel Funnel con un click</div>
          </div>
          {!hasKey&&(
            <button onClick={()=>{setTab("impostazioni");setCfgTab("youtube");}} style={{padding:"10px 18px",borderRadius:10,border:"2px solid rgba(255,255,255,0.5)",background:"rgba(255,255,255,0.15)",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",backdropFilter:"blur(4px)"}}>
              ⚙️ Configura API Key
            </button>
          )}
        </div>

        {!hasKey&&(
          <div style={{background:"#FFF1F2",border:"1px solid #FECACA",borderRadius:12,padding:"16px 20px",marginBottom:22,display:"flex",gap:14,alignItems:"center"}}>
            <span style={{fontSize:24}}>🔑</span>
            <div>
              <div style={{fontWeight:700,color:"#991B1B",marginBottom:4}}>YouTube Data API Key non configurata</div>
              <div style={{fontSize:13,color:"#B91C1C"}}>Vai su <b>Impostazioni → YouTube</b> e inserisci la tua API Key gratuita di Google Cloud. Ci vogliono 5 minuti.</div>
            </div>
            <button onClick={()=>{setTab("impostazioni");setCfgTab("youtube");}} style={{marginLeft:"auto",padding:"9px 16px",borderRadius:9,border:"none",background:"#DC2626",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Configura ora →</button>
          </div>
        )}

        {/* Input video */}
        <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,padding:"22px 24px",marginBottom:20,boxShadow:"0 1px 4px rgba(28,63,110,0.06)"}}>
          <div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:14}}>🎬 Inserisci URL video da analizzare</div>
          <div style={{display:"flex",gap:10,marginBottom:12}}>
            <input value={ytVideoUrl} onChange={e=>setYtVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=xxxxx — incolla l'URL del video"
              style={{flex:1,padding:"11px 14px",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:14,outline:"none",fontFamily:"inherit",color:C.text,background:C.light}}
              onFocus={e=>e.target.style.borderColor="#FF0000"} onBlur={e=>e.target.style.borderColor=C.border}/>
            <button onClick={scanYouTubeComments} disabled={ytLoad||!ytVideoUrl} style={{padding:"11px 22px",borderRadius:10,border:"none",background:ytLoad?"#9CA3AF":"#FF0000",color:"#fff",fontWeight:800,fontSize:14,cursor:ytLoad?"not-allowed":"pointer",fontFamily:"inherit",flexShrink:0,transition:"opacity 0.15s"}}>
              {ytLoad?"⏳ Analisi…":"🔍 Scansiona"}
            </button>
          </div>
          <div style={{fontSize:12,color:C.muted}}>
            💡 <b>Suggerimenti video:</b> cerca su YouTube "cessione del quinto", "prestito pensionati INPS", "finanziamento dipendenti pubblici" — i video con più commenti sono i migliori
          </div>
          {ytLoad&&(
            <div style={{marginTop:14,background:"#FFF7F7",border:"1px solid #FECACA",borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:28,height:28,border:"3px solid #FCA5A5",borderTopColor:"#DC2626",borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}}/>
              <div style={{fontSize:13,color:"#991B1B",fontWeight:600}}>{ytLoadMsg}</div>
            </div>
          )}
        </div>

        {/* Stats bar */}
        {ytComments.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
            {[
              {l:"Commenti analizzati", v:ytComments.length, c:"#6366F1", i:"💬"},
              {l:"Lead trovati",        v:ytLeads.length,    c:"#DC2626", i:"🎯"},
              {l:"Interesse alto",      v:ytLeads.filter(l=>l.interesse==="alto").length, c:"#16A34A", i:"🔥"},
              {l:"Già importati",       v:Object.keys(ytImported).length, c:C.navy, i:"✅"},
            ].map(k=>(
              <div key={k.l} style={{background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:"16px 18px",boxShadow:"0 1px 4px rgba(28,63,110,0.06)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>{k.l}</div><div style={{fontSize:26,fontWeight:800,color:k.c}}>{k.v}</div></div>
                  <div style={{width:38,height:38,borderRadius:10,background:`${k.c}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{k.i}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {ytLeads.length>0&&(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div style={{fontSize:14,fontWeight:800,color:C.text}}>🎯 Lead identificati dall'IA ({ytLeads.length})</div>
              <div style={{display:"flex",gap:8}}>
                <Btn variant="ghost" style={{fontSize:12,padding:"7px 14px"}} onClick={async()=>{for(const l of ytLeads){if(!ytMsgs[l.commentId])await generaMsgYT(l);}}}>🤖 Genera tutti i messaggi</Btn>
                <Btn style={{fontSize:12,padding:"7px 14px",background:"#FF0000",border:"none",color:"#fff"}} onClick={()=>ytLeads.filter(l=>!ytImported[l.commentId]).forEach(importaLeadYT)}>📥 Importa tutti nel CRM</Btn>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(380px,1fr))",gap:14}}>
              {ytLeads.map(lead=>(
                <div key={lead.commentId} style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,padding:18,borderLeft:`3px solid ${interestColor[lead.interesse]||"#6B7280"}`,boxShadow:"0 1px 4px rgba(28,63,110,0.06)"}}>
                  {/* Header */}
                  <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:12}}>
                    <div style={{width:40,height:40,borderRadius:10,background:"#FF000015",border:"1px solid #FECACA",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>▶️</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:14,marginBottom:2}}>{lead.autore}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:interestBg[lead.interesse],border:`1px solid ${interestBrd[lead.interesse]}`,color:interestColor[lead.interesse],fontWeight:700}}>
                          {lead.interesse==="alto"?"🔥 Interesse Alto":lead.interesse==="medio"?"⚡ Interesse Medio":"💤 Interesse Basso"}
                        </span>
                        <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:C.navyBg,border:`1px solid ${C.navyTint}`,color:C.navy,fontWeight:600,textTransform:"capitalize"}}>{lead.categoria?.replace(/_/g," ")}</span>
                      </div>
                    </div>
                    {ytImported[lead.commentId]&&<span style={{fontSize:11,background:"#F0FDF4",color:"#15803D",border:"1px solid #BBF7D0",borderRadius:20,padding:"3px 9px",fontWeight:700,flexShrink:0}}>✅ Importato</span>}
                  </div>

                  {/* Commento */}
                  <div style={{background:C.light,borderRadius:9,padding:"10px 12px",fontSize:12,color:C.text,lineHeight:1.6,marginBottom:10,border:`1px solid ${C.border}`,fontStyle:"italic"}}>
                    "{lead.testo?.slice(0,200)}{lead.testo?.length>200?"…":""}"
                  </div>
                  <div style={{fontSize:11,color:C.muted,marginBottom:12}}>💡 {lead.motivo}</div>

                  {/* Messaggio risposta */}
                  {ytMsgs[lead.commentId]?(
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>💬 Risposta da pubblicare su YouTube:</div>
                      <textarea value={ytMsgs[lead.commentId]} onChange={e=>setYtMsgs(p=>({...p,[lead.commentId]:e.target.value}))}
                        style={{width:"100%",background:"#FFF7F7",border:"1px solid #FECACA",borderRadius:8,padding:"10px 12px",fontSize:12,color:C.text,resize:"none",height:80,outline:"none",fontFamily:"inherit",lineHeight:1.6,boxSizing:"border-box"}}/>
                      <button onClick={()=>navigator.clipboard?.writeText(ytMsgs[lead.commentId])} style={{marginTop:6,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.border}`,background:C.light,cursor:"pointer",fontSize:11,fontWeight:600,color:C.muted,fontFamily:"inherit"}}>📋 Copia risposta</button>
                    </div>
                  ):(
                    <button onClick={()=>generaMsgYT(lead)} disabled={ytMsgLoad[lead.commentId]} style={{width:"100%",padding:"8px",borderRadius:8,border:"1px solid #FECACA",background:"#FFF7F7",color:"#DC2626",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",marginBottom:10}}>
                      {ytMsgLoad[lead.commentId]?"⏳ Generando…":"🤖 Genera messaggio risposta IA"}
                    </button>
                  )}

                  {/* Azioni */}
                  <div style={{display:"flex",gap:6}}>
                    {lead.channelId&&(
                      <a href={`https://www.youtube.com/channel/${lead.channelId}/about`} target="_blank" rel="noreferrer" style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"7px",borderRadius:7,background:"#FF000015",border:"1px solid #FECACA",color:"#DC2626",fontSize:12,fontWeight:700,textDecoration:"none"}}>▶️ Profilo</a>
                    )}
                    <button onClick={()=>importaLeadYT(lead)} disabled={ytImported[lead.commentId]} style={{flex:2,padding:"7px",borderRadius:7,border:"none",background:ytImported[lead.commentId]?"#D1FAE5":C.navy,color:ytImported[lead.commentId]?"#15803D":"#fff",fontWeight:700,fontSize:12,cursor:ytImported[lead.commentId]?"default":"pointer",fontFamily:"inherit"}}>
                      {ytImported[lead.commentId]?"✅ Nel CRM":"📥 Importa nel Funnel"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {ytStep==="results"&&ytLeads.length===0&&(
          <div style={{textAlign:"center",padding:52,color:C.muted}}>
            <div style={{fontSize:48,marginBottom:16}}>🔍</div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Nessun lead trovato in questo video</div>
            <div style={{fontSize:13}}>Prova con un video più specifico su prestiti, pensioni o cessione del quinto</div>
          </div>
        )}

        {ytStep==="config"&&ytLeads.length===0&&!ytLoad&&(
          <div>
            <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,padding:"28px 32px",textAlign:"center",boxShadow:"0 1px 4px rgba(28,63,110,0.06)",marginBottom:16}}>
              <div style={{fontSize:52,marginBottom:16}}>🎬</div>
              <div style={{fontSize:16,fontWeight:800,color:C.text,marginBottom:8}}>Dove trovare i video giusti</div>
              <div style={{fontSize:13,color:C.muted,maxWidth:520,margin:"0 auto 24px",lineHeight:1.7}}>Cerca su YouTube le parole chiave che usa il tuo target. I commenti sotto questi video contengono spesso persone che cercano attivamente un finanziamento.</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center",marginBottom:20}}>
                {["cessione del quinto 2025","prestito pensionati INPS","finanziamento dipendenti pubblici","prestito forze ordine","come ottenere liquidità pensione"].map(q=>(
                  <button key={q} onClick={()=>window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,"_blank")} style={{padding:"8px 14px",borderRadius:20,border:`1px solid ${C.border}`,background:C.light,cursor:"pointer",fontSize:12,fontWeight:600,color:C.navy,fontFamily:"inherit"}}>🔍 {q}</button>
                ))}
              </div>
            </div>

            {/* Auto-reply guide */}
            <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,padding:"22px 26px",boxShadow:"0 1px 4px rgba(28,63,110,0.06)"}}>
              <div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:4}}>💬 Gestione automatica commenti del TUO canale</div>
              <div style={{fontSize:13,color:C.muted,marginBottom:18,lineHeight:1.6}}>Per rispondere ai commenti del tuo canale, usa lo scanner qui sopra con i tuoi stessi video. L'IA genera la risposta personalizzata — tu la copi e la incolli su YouTube in 5 secondi.</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:18}}>
                {[
                  {i:"1",t:"Copia URL del tuo video",d:"Il link del video pubblicato sul tuo canale finpratica",c:"#EEF2F8",bc:C.navy},
                  {i:"2",t:"Clicca 'Scansiona'",d:"L'IA legge tutti i commenti e trova chi è interessato a un preventivo",c:"#FFFBEB",bc:"#B45309"},
                  {i:"3",t:"Copia la risposta",d:"Clicca '📋 Copia risposta' e incollala direttamente sotto il commento su YouTube",c:"#F0FDF4",bc:"#16A34A"},
                ].map(s=>(
                  <div key={s.i} style={{background:s.c,borderRadius:10,padding:"16px",border:`1px solid ${s.bc}20`}}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:s.bc,color:"#fff",fontWeight:900,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:10}}>{s.i}</div>
                    <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>{s.t}</div>
                    <div style={{fontSize:11,color:C.muted,lineHeight:1.5}}>{s.d}</div>
                  </div>
                ))}
              </div>
              <div style={{background:"#FFF7F7",border:"1px solid #FECACA",borderRadius:10,padding:"12px 16px",display:"flex",gap:12,alignItems:"center"}}>
                <span style={{fontSize:20}}>📌</span>
                <div style={{fontSize:12,color:"#991B1B",lineHeight:1.6}}>
                  <b>Commento fissato consigliato da aggiungere su ogni video:</b><br/>
                  "👉 Vuoi sapere quanto puoi ottenere con la tua situazione specifica? Preventivo GRATUITO entro 2 ore → {cfg.youtubeLandingUrl||"[inserisci link landing page in Impostazioni → YouTube]"} — Rispondo a tutti! 🙏"
                </div>
                <button onClick={()=>navigator.clipboard?.writeText(`👉 Vuoi sapere quanto puoi ottenere con la tua situazione specifica? Preventivo GRATUITO entro 2 ore → ${cfg.youtubeLandingUrl||"https://finpratica.it/preventivo"} — Rispondo a tutti! 🙏`)} style={{padding:"8px 12px",borderRadius:8,border:"1px solid #FECACA",background:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,color:"#DC2626",fontFamily:"inherit",flexShrink:0}}>📋 Copia</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function ImpostazioniView(){
    const [local, setLocal] = useState({...cfg});
    const upd = useCallback((k,v) => setLocal(p=>({...p,[k]:v})), []);

    const CFG_TABS=[
      {id:"azienda",      i:"🏢", l:"Azienda"},
      {id:"whatsapp",     i:"📱", l:"WhatsApp"},
      {id:"email",        i:"📧", l:"Email & SMTP"},
      {id:"notifiche",    i:"🔔", l:"Notifiche"},
      {id:"youtube",      i:"▶️",  l:"YouTube"},
      {id:"integrazioni", i:"🔗", l:"Integrazioni & API"},
      {id:"ia_provider",  i:"🧠", l:"IA Provider"},
      {id:"crm",          i:"🤖", l:"CRM & IA"},
      ...(authRole==="admin"?[{id:"gestione_utenti",i:"👥",l:"Gestione Utenti"}]:[]),
    ];

    return(
      <ImpostazioniCtx.Provider value={{local, upd}}>
      <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:20,alignItems:"start"}}>
        {/* Sidebar tabs */}
        <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 1px 4px rgba(28,63,110,0.06)",position:"sticky",top:20}}>
          {CFG_TABS.map(t=>(
            <button key={t.id} onClick={()=>{setCfgTab(t.id);if(t.id==="gestione_utenti")loadUtenti();}}
              style={{width:"100%",padding:"12px 16px",border:"none",borderLeft:`3px solid ${cfgTab===t.id?C.navy:"transparent"}`,background:cfgTab===t.id?C.navyBg:"transparent",cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontSize:13,fontWeight:cfgTab===t.id?700:500,color:cfgTab===t.id?C.navy:C.text,fontFamily:"inherit",transition:"all 0.15s",textAlign:"left"}}>
              <span style={{fontSize:16}}>{t.i}</span>{t.l}
            </button>
          ))}
          <div style={{padding:"14px 16px",borderTop:`1px solid ${C.border}`,marginTop:4}}>
            <button onClick={()=>saveCfgAll(local)} style={{width:"100%",padding:"10px",borderRadius:9,border:"none",background:C.navy,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",transition:"opacity 0.15s"}} onMouseOver={e=>e.currentTarget.style.opacity="0.85"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
              💾 Salva tutto
            </button>
            {cfgSaved&&<div style={{textAlign:"center",fontSize:11,color:"#16A34A",marginTop:8,fontWeight:700}}>✅ Salvato!</div>}
          </div>
        </div>

        {/* Content */}
        <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,padding:"28px 30px",boxShadow:"0 1px 4px rgba(28,63,110,0.06)"}}>

          {/* ── AZIENDA ── */}
          {cfgTab==="azienda"&&(<div>
            <div style={{fontSize:16,fontWeight:800,color:C.navy,marginBottom:6}}>🏢 Dati Azienda</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:24}}>Informazioni che appaiono nelle comunicazioni e nei documenti</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div style={{gridColumn:"1/-1"}}><Field label="Ragione Sociale"><TInput field="ragioneSociale" placeholder="finpratica s.r.l."/></Field></div>
              <Field label="Partita IVA"><TInput field="partitaIva" placeholder="01234567890"/></Field>
              <Field label="Numero OAM"><TInput field="oamNumero" placeholder="A12345"/></Field>
              <div style={{gridColumn:"1/-1"}}><Field label="Indirizzo"><TInput field="indirizzo" placeholder="Via Roma 1"/></Field></div>
              <Field label="Città"><TInput field="citta" placeholder="Palermo"/></Field>
              <Field label="CAP"><TInput field="cap" placeholder="90100"/></Field>
              <div style={{gridColumn:"1/-1"}}><Field label="Sito Web"><TInput field="sito" placeholder="https://finpratica.it"/></Field></div>
              <Field label="Telefono Ufficio"><TInput field="telefono" placeholder="+39 091 1234567"/></Field>
              <Field label="Email Ufficio"><TInput field="email" placeholder="info@finpratica.it" type="email"/></Field>
            </div>
            <Field label="Firma Email" hint="Apparirà in fondo a tutte le email automatiche">
              <textarea value={local.firmaEmail||""} onChange={e=>upd("firmaEmail",e.target.value)} rows={4}
                placeholder={"Il team finpratica\nTel: +39 091 1234567\nwww.finpratica.it"}
                style={{width:"100%",padding:"10px 13px",border:`1.5px solid ${C.border}`,borderRadius:9,fontSize:13,outline:"none",fontFamily:"inherit",color:C.text,background:C.light,resize:"vertical",lineHeight:1.6}}/>
            </Field>
          </div>)}

          {/* ── WHATSAPP ── */}
          {cfgTab==="whatsapp"&&(<div>
            <div style={{fontSize:16,fontWeight:800,color:C.navy,marginBottom:6}}>📱 WhatsApp Business</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Numero e template per messaggi automatici ai clienti</div>
            <InfoBox>
              💡 <b>Come funziona:</b> il CRM usa link <code>wa.me</code> per aprire WhatsApp con il messaggio pre-compilato. Per invio automatico senza click serve <b>WhatsApp Business API</b> (Twilio o 360dialog).
            </InfoBox>
            <Field label="Numero WhatsApp Business" hint="Formato internazionale senza + es: 393401234567">
              <TInput field="whatsapp" placeholder="393401234567" type="tel"/>
            </Field>
            <div style={{display:"flex",gap:10,marginBottom:24}}>
              <Btn variant="success" onClick={testWhatsApp}>📱 Testa WhatsApp</Btn>
              {cfgTest.wa==="ok"&&<span style={{display:"flex",alignItems:"center",fontSize:13,color:"#16A34A",fontWeight:700}}>✅ Aperto!</span>}
              {cfgTest.wa==="error"&&<span style={{display:"flex",alignItems:"center",fontSize:13,color:"#DC2626",fontWeight:700}}>❌ Inserisci il numero</span>}
            </div>
            <Field label="Template Richiamo" hint="Variabili: {nome}, {servizio}, {data_scadenza}, {consulente}">
              <textarea value={local.whatsappTemplate||""} onChange={e=>upd("whatsappTemplate",e.target.value)} rows={4}
                style={{width:"100%",padding:"10px 13px",border:`1.5px solid ${C.border}`,borderRadius:9,fontSize:13,outline:"none",fontFamily:"inherit",color:C.text,background:C.light,resize:"vertical",lineHeight:1.6}}/>
            </Field>
            <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,padding:"14px 16px",marginTop:8}}>
              <div style={{fontSize:12,fontWeight:700,color:"#15803D",marginBottom:8}}>📋 Anteprima template:</div>
              <div style={{fontSize:13,color:"#166534",lineHeight:1.7,whiteSpace:"pre-wrap"}}>
                {(local.whatsappTemplate||"").replace("{nome}","Mario Rossi").replace("{servizio}","Cessione del Quinto").replace("{data_scadenza}","15/03/2026").replace("{consulente}",local.ragioneSociale||"finpratica")}
              </div>
            </div>
            <div style={{marginTop:24,padding:"18px 20px",background:C.navyBg,border:`1px solid ${C.navyTint}`,borderRadius:12}}>
              <div style={{fontWeight:700,color:C.navy,marginBottom:10}}>🚀 WhatsApp Business API (invio automatico)</div>
              <Field label="Twilio Account SID" hint="Da console.twilio.com"><TInput field="twilioSid" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"/></Field>
              <Field label="Twilio Auth Token"><TInput field="twilioToken" type="password" placeholder="••••••••••••••••"/></Field>
              <Field label="Twilio WhatsApp Number" hint="Es: whatsapp:+14155238886"><TInput field="twilioWaNum" placeholder="whatsapp:+14155238886"/></Field>
            </div>
          </div>)}

          {/* ── EMAIL ── */}
          {cfgTab==="email"&&(<div>
            <div style={{fontSize:16,fontWeight:800,color:C.navy,marginBottom:6}}>📧 Configurazione Email</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Scegli il provider per l'invio email automatico dal CRM</div>

            <Field label="Provider Email">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                {[{v:"aruba",l:"📮 Aruba",d:"smtp.aruba.it:465"},{v:"gmail",l:"📬 Gmail",d:"OAuth2 API"},{v:"smtp",l:"⚙️ SMTP Custom",d:"Qualsiasi provider"}].map(p=>(
                  <button key={p.v} onClick={()=>{upd("emailProvider",p.v); if(p.v==="aruba"){upd("smtpHost","smtp.aruba.it");upd("smtpPort","465");}else if(p.v==="gmail"){upd("smtpHost","smtp.gmail.com");upd("smtpPort","587");}}}
                    style={{padding:"14px 12px",borderRadius:10,border:`2px solid ${local.emailProvider===p.v?C.navy:C.border}`,background:local.emailProvider===p.v?C.navyBg:C.white,cursor:"pointer",textAlign:"center",transition:"all 0.15s",fontFamily:"inherit"}}>
                    <div style={{fontSize:20,marginBottom:6}}>{p.l.split(" ")[0]}</div>
                    <div style={{fontSize:13,fontWeight:700,color:C.text}}>{p.l.split(" ").slice(1).join(" ")}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:3}}>{p.d}</div>
                  </button>
                ))}
              </div>
            </Field>

            {(local.emailProvider==="aruba"||local.emailProvider==="smtp")&&(<>
              <InfoBox bg={local.emailProvider==="aruba"?"#FFF7ED":"#EEF2F8"} border={local.emailProvider==="aruba"?"#FED7AA":"#DDEAF8"} color={local.emailProvider==="aruba"?"#9A3412":C.navy}>
                {local.emailProvider==="aruba"?"📮 <b>Aruba Webmail:</b> Vai su Aruba → Pannello → Email → Gestione Account → Dati SMTP. Host: smtp.aruba.it, Porta: 465, SSL: sì.":"⚙️ Inserisci i dati SMTP del tuo provider."}
              </InfoBox>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14}}>
                <Field label="Host SMTP"><TInput field="smtpHost" placeholder="smtp.aruba.it"/></Field>
                <Field label="Porta"><TInput field="smtpPort" placeholder="465"/></Field>
              </div>
              <Field label="Email Mittente (username)"><TInput field="smtpUser" placeholder="info@finpratica.it" type="email"/></Field>
              <Field label="Password Email"><TInput field="smtpPass" type="password" placeholder="••••••••••••••••"/></Field>
              <Field label="Nome Mittente"><TInput field="smtpFrom" placeholder="finpratica"/></Field>
            </>)}

            {local.emailProvider==="gmail"&&(<>
              <InfoBox>
                📬 <b>Gmail OAuth2:</b> Vai su <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{color:C.blue}}>console.cloud.google.com</a> → Crea Progetto → Abilita Gmail API → Crea credenziali OAuth2 → Copia Client ID e Secret qui sotto.
              </InfoBox>
              <Field label="Gmail Client ID" hint="Da Google Cloud Console → Credenziali OAuth2"><TInput field="gmailClientId" placeholder="xxxxxxxxxx.apps.googleusercontent.com"/></Field>
              <Field label="Gmail Client Secret"><TInput field="gmailClientSecret" type="password" placeholder="GOCSPX-xxxxxxxxxx"/></Field>
              <Field label="Refresh Token" hint="Generato dopo la prima autenticazione OAuth"><TInput field="gmailRefreshToken" type="password" placeholder="1//xxxxxxxxxx"/></Field>
              <Field label="Email Gmail"><TInput field="smtpUser" type="email" placeholder="tuo@gmail.com"/></Field>
            </>)}

            <div style={{display:"flex",gap:10,marginTop:8,marginBottom:20}}>
              <Btn variant="blue" onClick={testEmail} disabled={cfgTest.email==="testing"}>
                {cfgTest.email==="testing"?"⏳ Test in corso…":"📧 Testa connessione"}
              </Btn>
              {cfgTest.email==="ok"&&<span style={{display:"flex",alignItems:"center",fontSize:13,color:"#16A34A",fontWeight:700}}>✅ Connessione OK!</span>}
              {cfgTest.email==="error"&&<span style={{display:"flex",alignItems:"center",fontSize:13,color:"#DC2626",fontWeight:700}}>❌ Credenziali errate</span>}
            </div>
          </div>)}

          {/* ── NOTIFICHE ── */}
          {cfgTab==="notifiche"&&(<div>
            <div style={{fontSize:16,fontWeight:800,color:C.navy,marginBottom:6}}>🔔 Notifiche Automatiche</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:24}}>Scegli quando e come ricevere notifiche dal CRM</div>
            <Toggle field="notifNuovoLead"    label="Notifica quando arriva un nuovo lead"/>
            <Toggle field="notifScadenza"     label="Notifica pratiche in scadenza (7 giorni prima)"/>
            <Toggle field="notifProvvigione"  label="Notifica quando una provvigione viene liquidata"/>
            <div style={{marginTop:22}}>
              <Field label="Email per notifiche" hint="Dove ricevere gli avvisi dal CRM">
                <TInput field="notifEmail" type="email" placeholder="tuo@email.it"/>
              </Field>
              <Field label="WhatsApp per notifiche" hint="Numero per ricevere avvisi WhatsApp (formato: 393401234567)">
                <TInput field="notifWhatsapp" placeholder="393401234567"/>
              </Field>
            </div>
            <InfoBox>
              ℹ️ Le notifiche WhatsApp e Email richiedono il <b>webhook-server.js</b> attivo oppure un'integrazione Zapier/Make.
            </InfoBox>
          </div>)}

          {/* ── INTEGRAZIONI ── */}
          {cfgTab==="youtube"&&(<div>
            <div style={{fontSize:16,fontWeight:800,color:C.navy,marginBottom:4}}>▶️ YouTube — Lead Generation</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>3 modalità per trovare e importare lead da YouTube nel CRM</div>

            {/* SEZIONE 1: API Key */}
            <div style={{background:"linear-gradient(135deg,#FF000008,#FF000003)",border:"1px solid #FECACA",borderRadius:14,padding:"20px 22px",marginBottom:22}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <div style={{width:40,height:40,borderRadius:10,background:"#FF0000",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>▶️</div>
                <div><div style={{fontWeight:800,fontSize:15,color:"#991B1B"}}>YouTube Data API v3</div><div style={{fontSize:12,color:C.muted}}>Necessaria per leggere i commenti dei video</div></div>
              </div>
              <Field label="YouTube Data API Key" hint={<span>Vai su <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{color:C.blue}}>console.cloud.google.com</a> → Libreria → YouTube Data API v3 → Attiva → Credenziali → Crea Chiave API</span>}>
                <div style={{display:"flex",gap:8}}>
                  <TInput field="youtubeApiKey" placeholder="AIzaSy…" type="password"/>
                  <Btn style={{flexShrink:0,background:"#FF0000",color:"#fff",border:"none"}} onClick={()=>{saveCfgAll(local);setYtApiKey(local.youtubeApiKey||"");localStorage.setItem("fp_yt_key",local.youtubeApiKey||"");}}>💾 Salva</Btn>
                </div>
              </Field>
              <Field label="Parole chiave interesse" hint="Commenti con queste parole vengono analizzati come potenziali lead">
                <TInput field="youtubeKeywords" placeholder="cessione del quinto,prestito pensionati,finanziamento"/>
              </Field>
            </div>

            {/* SEZIONE 2: Lead Form Ads */}
            <div style={{background:C.navyBg,border:`1px solid ${C.navyTint}`,borderRadius:14,padding:"20px 22px",marginBottom:22}}>
              <div style={{fontWeight:800,fontSize:15,color:C.navy,marginBottom:10}}>📋 YouTube Lead Form Ads (Google Ads)</div>
              <div style={{fontSize:13,color:C.muted,marginBottom:14,lineHeight:1.7}}>
                I Lead Form Ads su YouTube funzionano come Meta Ads: il form appare sopra il video, l'utente lo compila senza uscire da YouTube, il lead arriva via webhook.
              </div>
              <div style={{fontSize:12,color:C.navy,fontWeight:700,marginBottom:10}}>🔗 Flusso di integrazione:</div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                {["Google Ads → Crea campagna Video → Obiettivo: Contatti → Aggiungi modulo lead","Il form raccoglie: nome, telefono, email, tipo di lavoro","Google Ads → Risorse dati → Moduli lead → scarica CSV lead","Carica CSV nel CRM (sezione Lead → Importa CSV) → lead nel Funnel"].map((s,i)=>(
                  <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",fontSize:12,color:C.text}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:C.navy,color:"#fff",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                    <span style={{lineHeight:1.6}}>{s}</span>
                  </div>
                ))}
              </div>
              <Field label="URL Webhook Google Ads → Zapier" hint="Stesso webhook del server, supporta Google Ads via Zapier">
                <div style={{display:"flex",gap:8}}>
                  <input value={(local.webhookServer||"https://tuo-server")+"/api/lead"} readOnly style={{flex:1,padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,background:C.light,color:C.navy,fontFamily:"monospace"}}/>
                  <button onClick={()=>navigator.clipboard?.writeText((local.webhookServer||"")+"/api/lead")} style={{padding:"9px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:"#fff",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>📋</button>
                </div>
              </Field>
            </div>

            {/* SEZIONE 3: Landing page nei video */}
            <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:14,padding:"20px 22px",marginBottom:22}}>
              <div style={{fontWeight:800,fontSize:15,color:"#92400E",marginBottom:10}}>🔗 Link Landing Page nei Video</div>
              <div style={{fontSize:13,color:C.muted,marginBottom:16,lineHeight:1.7}}>
                Inserisci il link della landing page finpratica nella descrizione dei video e nei commenti fissati. I lead compilano il form e arrivano automaticamente nel CRM tramite il webhook.
              </div>
              <Field label="URL Landing Page finpratica" hint="Il link da inserire nelle descrizioni YouTube">
                <TInput field="youtubeLandingUrl" placeholder="https://finpratica.it/preventivo"/>
              </Field>
              <div style={{background:"#fff",borderRadius:10,border:"1px solid #FDE68A",padding:"14px 16px"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#92400E",marginBottom:8}}>📝 Testo da incollare nella descrizione YouTube:</div>
                <div style={{fontSize:12,color:"#78350F",lineHeight:1.8,whiteSpace:"pre-wrap",fontFamily:"monospace"}}>
{`💰 Sei pensionato INPS o dipendente pubblico?
Scopri quanto puoi ottenere con la Cessione del Quinto!

✅ Consulenza GRATUITA e senza impegno
✅ Risposta in meno di 2 ore
✅ Nessuna garanzia aggiuntiva

👉 ${local.youtubeLandingUrl||"https://finpratica.it/preventivo"}

📞 Oppure chiamaci: ${local.telefono||"+39 091 XXXXXXX"}
`}
                </div>
                <button onClick={()=>navigator.clipboard?.writeText(`💰 Sei pensionato INPS o dipendente pubblico?\nScopri quanto puoi ottenere con la Cessione del Quinto!\n\n✅ Consulenza GRATUITA e senza impegno\n✅ Risposta in meno di 2 ore\n✅ Nessuna garanzia aggiuntiva\n\n👉 ${local.youtubeLandingUrl||"https://finpratica.it/preventivo"}\n\n📞 Oppure chiamaci: ${local.telefono||"+39 091 XXXXXXX"}`)} style={{marginTop:10,padding:"7px 14px",borderRadius:8,border:"1px solid #FDE68A",background:"#FFFBEB",cursor:"pointer",fontSize:12,fontWeight:700,color:"#92400E",fontFamily:"inherit"}}>📋 Copia testo descrizione</button>
              </div>
            </div>

            {/* SEZIONE 4: ID canale per notifiche */}
            <Field label="ID Canale YouTube (opzionale)" hint="Es: UCxxxxxxxxxxxxxxxx — per future integrazioni automatiche">
              <TInput field="youtubeChannelId" placeholder="UCxxxxxxxxxxxxxxxx"/>
            </Field>

            <div style={{marginTop:8}}>
              <Btn onClick={()=>{saveCfgAll(local);setYtApiKey(local.youtubeApiKey||"");localStorage.setItem("fp_yt_key",local.youtubeApiKey||"");setYtKeywords(local.youtubeKeywords||ytKeywords);}}>💾 Salva impostazioni YouTube</Btn>
            </div>
          </div>)}

          {cfgTab==="integrazioni"&&(<div>
            <div style={{fontSize:16,fontWeight:800,color:C.navy,marginBottom:6}}>🔗 Integrazioni & Webhook</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Collega fonti esterne di lead al CRM</div>

            <Field label="URL Webhook Server" hint="Es: https://finpratica-api.railway.app — riceve lead da Meta Ads, Zapier, Make">
              <div style={{display:"flex",gap:8}}>
                <TInput field="webhookServer" placeholder="https://tuo-server.railway.app"/>
                <Btn variant="blue" style={{flexShrink:0}} onClick={()=>{upd("webhookServer",local.webhookServer);setWebhookUrl(local.webhookServer);syncLeadDaServer();}}>🔗 Sync</Btn>
              </div>
            </Field>
            <Field label="Meta Verify Token" hint="Token da inserire in Meta Business Suite → Webhook → Verify Token">
              <TInput field="metaVerifyToken" placeholder="finpratica2026"/>
            </Field>

            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:22,marginTop:8}}>
              <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:14}}>📋 URL Webhook da usare su Zapier/Make/Meta</div>
              {[
                {l:"🌐 Webhook generico (Zapier/Make/Landing)", v:(local.webhookServer||"https://tuo-server")+"/api/lead"},
                {l:"📘 Meta Ads (Facebook/Instagram)", v:(local.webhookServer||"https://tuo-server")+"/api/meta-lead"},
                {l:"📥 Import CSV Meta", v:(local.webhookServer||"https://tuo-server")+"/api/import-csv-meta"},
              ].map(({l,v})=>(
                <div key={l} style={{background:C.light,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:3}}>{l}</div>
                    <code style={{fontSize:12,color:C.navy}}>{v}</code>
                  </div>
                  <button onClick={()=>navigator.clipboard?.writeText(v)} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:"#fff",cursor:"pointer",fontSize:12,fontWeight:600,color:C.muted,fontFamily:"inherit",flexShrink:0}}>📋</button>
                </div>
              ))}
            </div>

            {/* ── SOCIAL MEDIA ── */}
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:22,marginTop:8}}>
              <div style={{fontSize:15,fontWeight:800,color:C.navy,marginBottom:4}}>📱 Social Media</div>
              <div style={{fontSize:13,color:C.muted,marginBottom:18}}>Link alle pagine social aziendali — salvati su Supabase</div>
              {[
                {key:"facebook",  label:"Facebook",  icon:"📘", placeholder:"https://facebook.com/finpratica"},
                {key:"instagram", label:"Instagram",  icon:"📸", placeholder:"https://instagram.com/finpratica"},
                {key:"tiktok",    label:"TikTok",     icon:"🎵", placeholder:"https://tiktok.com/@finpratica"},
                {key:"linkedin",  label:"LinkedIn",   icon:"💼", placeholder:"https://linkedin.com/company/finpratica"},
                {key:"youtube",   label:"YouTube",    icon:"▶️",  placeholder:"https://youtube.com/@finpratica"},
              ].map(({key,label,icon,placeholder})=>(
                <div key={key} style={{marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>{icon} {label}</div>
                  <div style={{display:"flex",gap:8}}>
                    <input
                      value={socialLinks[key]||""}
                      onChange={e=>setSocialLinks(p=>({...p,[key]:e.target.value}))}
                      placeholder={placeholder}
                      style={{flex:1,padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,color:C.text,background:C.white,outline:"none",fontFamily:"inherit"}}
                    />
                    <button
                      disabled={!socialLinks[key]}
                      onClick={()=>window.open(socialLinks[key],"_blank","noopener,noreferrer")}
                      style={{padding:"9px 16px",borderRadius:8,border:`1px solid ${C.border}`,background:socialLinks[key]?C.navyBg:C.light,cursor:socialLinks[key]?"pointer":"default",fontSize:13,fontWeight:600,color:socialLinks[key]?C.navy:C.muted,fontFamily:"inherit",flexShrink:0,opacity:socialLinks[key]?1:0.5}}
                    >Apri</button>
                  </div>
                </div>
              ))}
              <div style={{display:"flex",alignItems:"center",gap:12,marginTop:6}}>
                <Btn onClick={saveSocialLinks}>💾 Salva link social</Btn>
                {socialSaved&&<span style={{fontSize:13,color:"#16A34A",fontWeight:700}}>✅ Salvati!</span>}
              </div>
            </div>
          </div>)}

          {/* ── IA PROVIDER ── */}
          {cfgTab==="ia_provider"&&(<div>
            <div style={{fontSize:16,fontWeight:800,color:C.navy,marginBottom:6}}>🧠 IA Provider</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:24}}>Scegli il motore IA per richiami, CRIF, chat, campagne e YouTube leads</div>

            <Field label="Provider">
              <div style={{display:"flex",gap:10,marginBottom:4}}>
                {[{v:"groq",l:"Groq — llama3-70b",i:"⚡"},{v:"gemini",l:"Google Gemini",i:"✨"}].map(opt=>(
                  <button key={opt.v} onClick={()=>upd("iaProvider",opt.v)} style={{flex:1,padding:"14px 16px",borderRadius:10,border:`2px solid ${local.iaProvider===opt.v?C.navy:C.border}`,background:local.iaProvider===opt.v?C.navyBg:C.white,cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14,color:local.iaProvider===opt.v?C.navy:C.text,display:"flex",alignItems:"center",gap:8,justifyContent:"center",transition:"all 0.15s"}}>
                    <span style={{fontSize:20}}>{opt.i}</span>{opt.l}
                  </button>
                ))}
              </div>
            </Field>

            {(local.iaProvider==="groq"||!local.iaProvider)&&(
              <Field label="Groq API Key" hint="llama-3.3-70b-versatile — veloce, gratuito, ottimale per italiano">
                <div style={{display:"flex",gap:8}}>
                  <TInput field="groqApiKey" type="password" placeholder="gsk_xxxxxxxxxxxx"/>
                  <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",padding:"10px 14px",borderRadius:9,background:C.navyBg,border:`1px solid ${C.navyTint}`,fontSize:12,fontWeight:700,color:C.navy,textDecoration:"none",flexShrink:0,whiteSpace:"nowrap"}}>Ottieni chiave →</a>
                </div>
              </Field>
            )}

            {local.iaProvider==="gemini"&&(
              <Field label="Gemini API Key" hint="Modello: gemini-1.5-flash — Google DeepMind, multimodale">
                <div style={{display:"flex",gap:8}}>
                  <TInput field="geminiKey" type="password" placeholder="AIzaSy…"/>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",padding:"10px 14px",borderRadius:9,background:"#F0FDF4",border:"1px solid #BBF7D0",fontSize:12,fontWeight:700,color:"#15803D",textDecoration:"none",flexShrink:0,whiteSpace:"nowrap"}}>Google AI Studio →</a>
                </div>
              </Field>
            )}

            <div style={{background:C.light,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",fontSize:13,marginTop:8}}>
              <div style={{fontWeight:700,color:C.text,marginBottom:8}}>Funzionalità che usano il provider selezionato</div>
              <div style={{color:C.muted,lineHeight:1.9,fontSize:12}}>
                🤖 Richiami IA (messaggi personalizzati per pratiche in scadenza)<br/>
                📊 Analisi CRIF / CTC (score e motivazione)<br/>
                💬 Chat FinpraticaAI (assistente mediazione creditizia)<br/>
                📣 Campagne lead freddi (messaggi WhatsApp riattivazione)<br/>
                🎬 YouTube Leads (analisi commenti e messaggi di risposta)<br/>
                🔍 Lead Intelligence IA (ricerca profili)
              </div>
            </div>
          </div>)}

          {/* ── CRM & IA ── */}
          {cfgTab==="crm"&&(<div>
            <div style={{fontSize:16,fontWeight:800,color:C.navy,marginBottom:6}}>🤖 CRM & Intelligenza Artificiale</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Chiavi API per le funzionalità IA del CRM</div>

            <Field label="Groq API Key" hint="Usata per: richiami IA, lead intelligence, campagne, chat FinpraticaAI">
              <div style={{display:"flex",gap:8}}>
                <TInput field="groqApiKey" type="password" placeholder="gsk_xxxxxxxxxxxx"/>
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",padding:"10px 14px",borderRadius:9,background:C.navyBg,border:`1px solid ${C.navyTint}`,fontSize:12,fontWeight:700,color:C.navy,textDecoration:"none",flexShrink:0}}>Ottieni chiave →</a>
              </div>
            </Field>

            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:20,marginTop:8}}>
              <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:14}}>🗄️ Dati CRM</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[
                  {l:"Clienti totali", v:clients.filter(c=>!c.lead).length},
                  {l:"Lead totali", v:clients.filter(c=>c.lead).length},
                  {l:"Provvigioni", v:provs.length},
                  {l:"Pratiche scadute", v:praticheDaRichiamare.filter(x=>x.scad.stato==="scaduta").length},
                ].map(({l,v})=>(
                  <div key={l} style={{background:C.light,borderRadius:10,padding:"14px 16px",border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>{l}</div>
                    <div style={{fontSize:24,fontWeight:800,color:C.navy}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:10,marginTop:18,flexWrap:"wrap"}}>
                <Btn variant="ghost" onClick={()=>{const d={clients,provs,cfg:local,export_date:new Date().toISOString()};const blob=new Blob([JSON.stringify(d,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`finpratica_backup_${today()}.json`;a.click();}}>
                  📥 Esporta backup JSON
                </Btn>
                <Btn variant="ghost" style={{color:"#DC2626",borderColor:"#FECACA"}} onClick={()=>{if(window.confirm("Confermi il reset di tutti i dati? Questa azione è irreversibile.")){localStorage.clear();window.location.reload();}}}>
                  🗑️ Reset dati CRM
                </Btn>
              </div>
            </div>
          </div>)}

          {/* ── GESTIONE UTENTI (admin only) ── */}
          {cfgTab==="gestione_utenti"&&authRole==="admin"&&(<div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div>
                <div style={{fontSize:16,fontWeight:800,color:C.navy}}>👥 Gestione Utenti</div>
                <div style={{fontSize:13,color:C.muted,marginTop:3}}>Aggiungi e gestisci gli utenti del CRM</div>
              </div>
              <Btn onClick={()=>{setUtenteForm({nome:"",email:"",password:"",ruolo:"consulente"});setUtenteFormOpen(true);loadUtenti();}}>+ Nuovo Utente</Btn>
            </div>

            {utenteFormOpen&&(
              <div style={{background:C.light,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginTop:16,marginBottom:18}}>
                <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>{utenteForm.id?"✏️ Modifica Utente":"➕ Nuovo Utente"}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Nome</label>
                    <input value={utenteForm.nome} onChange={e=>setUtenteForm(p=>({...p,nome:e.target.value}))} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",fontSize:14,color:C.text,outline:"none",width:"100%",fontFamily:"inherit"}} placeholder="Nome Cognome"/>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Email</label>
                    <input value={utenteForm.email} onChange={e=>setUtenteForm(p=>({...p,email:e.target.value}))} disabled={!!utenteForm.id} style={{background:utenteForm.id?C.light:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",fontSize:14,color:C.text,outline:"none",width:"100%",fontFamily:"inherit"}} placeholder="utente@email.it" type="email"/>
                  </div>
                  {!utenteForm.id&&(<div style={{display:"flex",flexDirection:"column",gap:5}}>
                    <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Password</label>
                    <input value={utenteForm.password} onChange={e=>setUtenteForm(p=>({...p,password:e.target.value}))} type="password" style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",fontSize:14,color:C.text,outline:"none",width:"100%",fontFamily:"inherit"}} placeholder="Min 6 caratteri"/>
                  </div>)}
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    <label style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Ruolo</label>
                    <select value={utenteForm.ruolo} onChange={e=>setUtenteForm(p=>({...p,ruolo:e.target.value}))} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",fontSize:14,color:C.text,outline:"none",width:"100%",cursor:"pointer",fontFamily:"inherit"}}>
                      <option value="admin">Admin — accesso completo</option>
                      <option value="consulente">Consulente — vede solo i suoi clienti</option>
                      <option value="segretaria">Segretaria — aggiunge/modifica, no provvigioni</option>
                    </select>
                  </div>
                </div>
                <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                  <Btn variant="ghost" onClick={()=>setUtenteFormOpen(false)}>Annulla</Btn>
                  <Btn variant="success" onClick={saveUtente} disabled={utenteLoad}>{utenteLoad?"⏳ Salvataggio…":"💾 Salva Utente"}</Btn>
                </div>
                {!utenteForm.id&&<div style={{fontSize:11,color:C.muted,marginTop:10}}>💡 Il nuovo utente riceverà un'email di conferma da Supabase prima di poter accedere.</div>}
              </div>
            )}

            <div style={{marginTop:16}}>
              {utenteLoad&&!utenti.length?<div style={{textAlign:"center",padding:24,color:C.muted}}>⏳ Caricamento…</div>:(
                utenti.length===0?<div style={{textAlign:"center",padding:24,color:C.muted}}>Nessun utente nel database. Aggiungi il primo utente.</div>:(
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 200px 120px 100px",gap:10,padding:"8px 12px",background:C.light,borderRadius:8,marginBottom:8,fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>
                      <div>Nome / Email</div><div>Email</div><div>Ruolo</div><div>Azioni</div>
                    </div>
                    {utenti.map(u=>(
                      <div key={u.id} style={{display:"grid",gridTemplateColumns:"1fr 200px 120px 100px",gap:10,padding:"10px 12px",borderBottom:`1px solid ${C.cream}`,alignItems:"center",fontSize:13}}>
                        <div style={{fontWeight:700}}>{u.nome}</div>
                        <div style={{color:C.muted,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.email}</div>
                        <div>
                          <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:u.ruolo==="admin"?C.navyBg:u.ruolo==="consulente"?"#F0FDF4":"#FFFBEB",color:u.ruolo==="admin"?C.navy:u.ruolo==="consulente"?"#15803D":"#B45309",border:`1px solid ${u.ruolo==="admin"?C.navyTint:u.ruolo==="consulente"?"#BBF7D0":"#FDE68A"}`}}>
                            {u.ruolo==="admin"?"👑 Admin":u.ruolo==="consulente"?"💼 Consulente":"📋 Segretaria"}
                          </span>
                        </div>
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>{setUtenteForm({...u,password:""});setUtenteFormOpen(true);}} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:C.white,cursor:"pointer",fontSize:12,fontWeight:600,color:C.text,fontFamily:"inherit"}}>✏️</button>
                          <button onClick={()=>deleteUtente(u.id)} style={{padding:"5px 10px",borderRadius:7,border:"1px solid #FECACA",background:"#FFF1F2",cursor:"pointer",fontSize:12,fontWeight:700,color:"#DC2626",fontFamily:"inherit"}}>🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>)}

        </div>
      </div>
      </ImpostazioniCtx.Provider>
    );
  }

  function ProvvigioniView(){
    const list=visibleProvs.filter(p=>{const q=provSearch.toLowerCase();return !q||(p.clienteNome||"").toLowerCase().includes(q);});
    return(
      <div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
          {[{l:"Provvigioni Totali",v:eur(stats.totProv),i:"💰",c:C.navy,s:`${visibleProvs.length} pratiche`},{l:"Da Liquidare",v:eur(stats.daLiquid),i:"⏳",c:"#B45309",s:`${visibleProvs.filter(p=>p.stato==="da_liquidare").length} pratiche`},{l:"Liquidate",v:eur(stats.liquidate),i:"✅",c:"#16A34A",s:`${visibleProvs.filter(p=>p.stato==="liquidata").length} pratiche`}].map(k=>(<Card key={k.l} style={{padding:"20px 22px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>{k.l}</div><div style={{fontSize:20,fontWeight:800,color:k.c,lineHeight:1}}>{k.v}</div><div style={{fontSize:12,color:C.muted,marginTop:5}}>{k.s}</div></div><div style={{width:42,height:42,borderRadius:12,background:`${k.c}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{k.i}</div></div></Card>))}
        </div>
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"flex-end"}}>
          <Inp style={{minWidth:220}} placeholder="🔍 Cerca cliente…" value={provSearch} onChange={e=>setProvSearch(e.target.value)}/>
          <Btn variant="blue" onClick={()=>{setProvForm(emptyProv());setModal("prov");}}>+ Nuova Provvigione</Btn>
        </div>
        <Card style={{overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 140px 110px 100px 110px 110px 110px 90px 90px",gap:12,padding:"11px 20px",background:C.light,borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>
            <div>Cliente</div><div>Servizio</div><div>Finanziato</div><div>TAN</div><div>Pr.Banca</div><div>Pr.Med.</div><div>Totale</div><div>Stato</div><div>Azioni</div>
          </div>
          {list.length===0&&<div style={{textAlign:"center",padding:40,color:C.muted,fontSize:14}}>Nessuna provvigione registrata.</div>}
          {list.map((p,i)=>(<div key={p.id} style={{display:"grid",gridTemplateColumns:"1fr 140px 110px 100px 110px 110px 110px 90px 90px",alignItems:"center",gap:12,padding:"13px 20px",borderBottom:i<list.length-1?`1px solid ${C.cream}`:"none",cursor:"pointer",transition:"background 0.12s"}} onMouseOver={e=>e.currentTarget.style.background=C.light} onMouseOut={e=>e.currentTarget.style.background=""} onClick={()=>{setSelProv(p);setModal("prov_detail");}}><div><div style={{fontWeight:700,fontSize:14}}>{p.clienteNome}</div><div style={{fontSize:12,color:C.muted}}>{fdate(p.dataCalcolo)}</div></div><Chip {...SVC[p.servizio]} label={SVC[p.servizio]?.label||p.servizio}/><div style={{fontWeight:700,fontSize:13}}>{eur0(p.importoFinanziato)}</div><div style={{fontSize:13,color:C.muted}}>{pct(p.tanPerc)}</div><div style={{fontSize:13,color:C.navy,fontWeight:600}}>{eur(p.provvigioneBanca)}</div><div style={{fontSize:13,color:"#16A34A",fontWeight:600}}>{eur(p.provvigioneMediatore)}</div><div style={{fontSize:14,fontWeight:800,color:C.navy}}>{eur(p.provvigioneTotale)}</div><Chip label={p.stato==="liquidata"?"Liquidata":"Da liquid."} color={p.stato==="liquidata"?"#15803D":"#B45309"} bg={p.stato==="liquidata"?"#F0FDF4":"#FFFBEB"} border={p.stato==="liquidata"?"#BBF7D0":"#FDE68A"}/><Btn variant="danger" style={{fontSize:11,padding:"5px 10px"}} onClick={e=>{e.stopPropagation();if(window.confirm("Eliminare questa provvigione?")){setProvs(prev=>prev.filter(x=>x.id!==p.id));sb.from("fp_provvigioni").delete().eq("id",p.id).then(({error})=>{ if(error) console.warn("Supabase delete prov:",error.message); });}}}>🗑 Elimina</Btn></div>))}
        </Card>
      </div>
    );
  }
}
