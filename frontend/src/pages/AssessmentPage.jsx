import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import {
  Heart, ChevronRight, ChevronLeft, Loader, AlertCircle,
  Activity, Info, Upload, FileText, CheckCircle2, Sparkles,
  ClipboardList, X, Eye, RotateCcw, Shield, Plus, Trash2,
  FilePlus, Layers, ChevronDown, ChevronUp
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// ─── Report type definitions ─────────────────────────────────────────────────
const REPORT_TYPES = [
  { id:'demographic', label:'Patient Demographic / Clinical History', attrs:'age, sex, cp',        color:'#3b82f6', fields:['age','sex','cp'] },
  { id:'vitals',      label:'Vital Signs / Physical Examination',     attrs:'trestbps',             color:'#10b981', fields:['trestbps'] },
  { id:'blood',       label:'Blood Laboratory Report',                attrs:'chol, fbs',            color:'#f59e0b', fields:['chol','fbs'] },
  { id:'ecg',         label:'Resting ECG Report',                     attrs:'restecg',              color:'#8b5cf6', fields:['restecg'] },
  { id:'stress',      label:'Exercise Stress Test (TMT)',             attrs:'thalach, exang, oldpeak, slope', color:'#ef4444', fields:['thalach','exang','oldpeak','slope'] },
  { id:'angio',       label:'Coronary Angiography Report',            attrs:'ca',                   color:'#06b6d4', fields:['ca'] },
  { id:'mpi',         label:'Myocardial Perfusion Imaging (MPI)',     attrs:'thal',                 color:'#ec4899', fields:['thal'] },
]

// ─── Field config ──────────────────────────────────────────────────────────
const STEPS = [
  { title:'Basic Information', desc:'Your fundamental health metrics',  fields:['age','sex','trestbps','chol'] },
  { title:'Heart Function',    desc:'Cardiac performance indicators',   fields:['thalach','exang','oldpeak','slope'] },
  { title:'Diagnostics',       desc:'Clinical test results',            fields:['cp','fbs','restecg','ca','thal'] },
]
const FIELDS = {
  age:      { label:'Age',                      type:'range',  unit:'years', min:20,  max:100, step:1,   def:55,  help:'Your current age' },
  sex:      { label:'Biological Sex',           type:'select', options:[{v:0,l:'Female'},{v:1,l:'Male'}], help:'Biological sex' },
  cp:       { label:'Chest Pain Type',          type:'select', options:[{v:0,l:'Typical Angina'},{v:1,l:'Atypical Angina'},{v:2,l:'Non-anginal Pain'},{v:3,l:'Asymptomatic'}], help:'Type of chest discomfort' },
  trestbps: { label:'Resting Blood Pressure',   type:'range',  unit:'mm Hg', min:80,  max:220, step:1,   def:130, help:'Resting blood pressure' },
  chol:     { label:'Serum Cholesterol',        type:'range',  unit:'mg/dL', min:100, max:600, step:1,   def:240, help:'Total cholesterol level' },
  fbs:      { label:'Fasting Blood Sugar >120', type:'select', options:[{v:0,l:'No (≤120 mg/dL)'},{v:1,l:'Yes (>120 mg/dL)'}], help:'Elevated fasting glucose?' },
  restecg:  { label:'Resting ECG',              type:'select', options:[{v:0,l:'Normal'},{v:1,l:'ST-T Wave Abnormality'},{v:2,l:'Left Ventricular Hypertrophy'}], help:'Resting ECG result' },
  thalach:  { label:'Maximum Heart Rate',       type:'range',  unit:'bpm',   min:60,  max:220, step:1,   def:150, help:'Max heart rate during exercise' },
  exang:    { label:'Exercise-Induced Angina',  type:'select', options:[{v:0,l:'No'},{v:1,l:'Yes'}], help:'Chest pain triggered by exercise' },
  oldpeak:  { label:'ST Depression (Oldpeak)',  type:'range',  unit:'',      min:0,   max:8,   step:0.1, def:1.0, help:'ST depression vs rest' },
  slope:    { label:'ST Segment Slope',         type:'select', options:[{v:1,l:'Upsloping'},{v:2,l:'Flat'},{v:3,l:'Downsloping'}], help:'Peak exercise ST slope' },
  ca:       { label:'Major Vessels Coloured',   type:'select', options:[{v:0,l:'0 Vessels'},{v:1,l:'1 Vessel'},{v:2,l:'2 Vessels'},{v:3,l:'3 Vessels'}], help:'Vessels coloured by fluoroscopy' },
  thal:     { label:'Thalassemia',              type:'select', options:[{v:3,l:'Normal'},{v:6,l:'Fixed Defect'},{v:7,l:'Reversible Defect'}], help:'Nuclear stress test result' },
}
const DEFAULTS = { age:55,sex:1,cp:0,trestbps:130,chol:240,fbs:0,restecg:0,thalach:150,exang:0,oldpeak:1.0,slope:2,ca:0,thal:3 }

const ALL_FIELDS = Object.keys(FIELDS)
const confColor = v => v===undefined?'bg-slate-200':v>=0.8?'bg-green-400':v>=0.5?'bg-yellow-400':'bg-red-300'
const confLabel = v => v===undefined?'Unknown':v>=0.8?'High':v>=0.5?'Medium':'Default'

// ─── Multi-Report Upload Panel ────────────────────────────────────────────
function MultiReportPanel({ onExtracted, onBack }) {
  const [files,    setFiles]   = useState([])   // [{file, id, status, result, error}]
  const [loading,  setLoading] = useState(false)
  const [error,    setError]   = useState('')
  const [preview,  setPreview] = useState(null)
  const [expanded, setExpanded]= useState({})
  const fileRef = useRef()
  const nextId  = useRef(1)

  const ALLOWED = ['pdf','docx','doc']

  const addFiles = (newFiles) => {
    const valid = []
    for (const f of newFiles) {
      // Check extension — on mobile filenames sometimes have no extension
      const nameParts = f.name.toLowerCase().split('.')
      const ext = nameParts.length > 1 ? nameParts.pop() : ''
      // Also accept by MIME type — iOS Safari sends application/pdf even without .pdf extension
      const ALLOWED_MIME = ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword']
      const validByExt  = ALLOWED.includes(ext)
      const validByMime = ALLOWED_MIME.includes(f.type)
      if (!validByExt && !validByMime) {
        setError(`"${f.name}" is not a PDF or DOCX file.`)
        continue
      }
      if (f.size > 20*1024*1024) { setError(`"${f.name}" exceeds 20 MB.`); continue }
      // Ensure file always has a proper name with extension for the backend
      const safeName = (ext && ALLOWED.includes(ext))
        ? f.name
        : f.name + (f.type === 'application/pdf' ? '.pdf' : '.docx')
      valid.push({ file:f, safeName, id:nextId.current++, status:'pending', result:null, error:null })
    }
    setFiles(prev => [...prev, ...valid])
    setError('')
    setPreview(null)
  }

  const removeFile = id => {
    setFiles(prev => prev.filter(f => f.id !== id))
    setPreview(null)
  }

  const getReportType = filename => {
    const n = filename.toLowerCase()
    if (n.includes('demographic') || n.includes('clinical') || n.includes('history') || n.includes('01_')) return REPORT_TYPES[0]
    if (n.includes('vital')       || n.includes('physical')  || n.includes('02_'))                         return REPORT_TYPES[1]
    if (n.includes('blood')       || n.includes('lab')       || n.includes('03_'))                         return REPORT_TYPES[2]
    if (n.includes('ecg')         || n.includes('04_'))                                                     return REPORT_TYPES[3]
    if (n.includes('stress')      || n.includes('tmt')        || n.includes('exercise') || n.includes('05_')) return REPORT_TYPES[4]
    if (n.includes('angio')       || n.includes('coronary')  || n.includes('06_'))                         return REPORT_TYPES[5]
    if (n.includes('perfusion')   || n.includes('mpi')        || n.includes('nuclear') || n.includes('07_')) return REPORT_TYPES[6]
    return null
  }

  const extract = async () => {
    if (files.length === 0) return
    setLoading(true); setError(''); setPreview(null)
    try {
      const fd = new FormData()
      // Always pass explicit filename as 3rd arg — critical for mobile browsers
      // that send files without proper names or extensions
      files.forEach(f => fd.append('files', f.file, f.safeName || f.file.name || 'report.pdf'))
      // Do NOT set Content-Type manually — axios sets it with the correct
      // multipart boundary automatically when FormData is the body
      const res = await axios.post(`${API}/api/rag/extract`, fd, {
        timeout: 120000,
      })
      setPreview(res.data)
      // Mark all files as done
      setFiles(prev => prev.map(f => ({ ...f, status:'done' })))
    } catch (e) {
      setError(e?.response?.data?.error || 'Extraction failed. Try again or use manual input.')
    }
    setLoading(false)
  }

  const coveredFields = preview
    ? ALL_FIELDS.filter(f => preview.confidence?.[f] >= 0.5)
    : []
  const missingFields = preview
    ? ALL_FIELDS.filter(f => !preview.confidence?.[f] || preview.confidence[f] < 0.5)
    : []

  return (
    <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} className="space-y-5">

      {/* Report type guide */}
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
        <p className="text-xs font-bold text-violet-800 mb-3 flex items-center gap-1.5">
          <Layers size={13}/> Supported Report Types & Attributes
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {REPORT_TYPES.map(rt => (
            <div key={rt.id} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:rt.color}} />
              <span className="text-slate-600 flex-1">{rt.label}</span>
              <span className="font-mono text-violet-600 font-semibold">{rt.attrs}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      {!preview && (
        <div
          onDragOver={e=>{e.preventDefault()}}
          onDrop={e=>{e.preventDefault();addFiles([...e.dataTransfer.files])}}
          onClick={()=>fileRef.current?.click()}
          className="border-2 border-dashed border-violet-200 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 transition-all"
        >
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" multiple className="hidden"
            onChange={e=>addFiles([...e.target.files])} />
          <FilePlus size={38} className="text-violet-400 mb-3"/>
          <p className="font-semibold text-slate-700">Drop medical reports here</p>
          <p className="text-sm text-slate-400 mt-1">PDF or DOCX — multiple files supported — max 20 MB each</p>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && !preview && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">{files.length} Report{files.length>1?'s':''} Selected</p>
          {files.map(entry => {
            const rt = getReportType(entry.file.name)
            return (
              <div key={entry.id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{background: rt ? rt.color+'22' : '#f1f5f9'}}>
                  <FileText size={15} style={{color: rt ? rt.color : '#94a3b8'}}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{entry.file.name}</p>
                  <p className="text-xs text-slate-400">{(entry.file.size/1024).toFixed(1)} KB
                    {rt && <> · <span className="font-medium" style={{color:rt.color}}>{rt.attrs}</span></>}
                  </p>
                </div>
                <button onClick={()=>removeFile(entry.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 size={15}/>
                </button>
              </div>
            )
          })}
          <button onClick={()=>fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 p-2.5 border border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-violet-300 hover:text-violet-500 transition-all">
            <Plus size={14}/> Add more reports
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5"/> {error}
        </div>
      )}

      {/* Extraction result */}
      {preview && (
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="space-y-4">
          {/* Summary header */}
          <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle2 size={20} className="text-green-500 flex-shrink-0"/>
            <div className="flex-1">
              <p className="font-bold text-green-800">Extraction Complete</p>
              <p className="text-xs text-green-600 mt-0.5">
                {preview.report_count} report{preview.report_count>1?'s':''} processed
                {preview.patient_name && ` · Patient: ${preview.patient_name}`}
                {` · ${coveredFields.length}/13 fields with high/medium confidence`}
              </p>
            </div>
          </div>

          {/* Coverage bar */}
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Field coverage</span>
              <span>{coveredFields.length} / 13</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-700"
                style={{width:`${(coveredFields.length/13)*100}%`}}/>
            </div>
            {missingFields.length > 0 && (
              <p className="text-xs text-amber-600 mt-1.5">
                ⚠ Defaulted: <span className="font-mono">{missingFields.join(', ')}</span> — not found in uploaded reports
              </p>
            )}
          </div>

          {/* Per-report breakdown */}
          {preview.per_report?.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Per-Report Results</p>
              {preview.per_report.map((rpt, i) => {
                const rt = getReportType(rpt.filename)
                const isOpen = expanded[i]
                const rptFields = Object.entries(rpt.extracted_values)
                  .filter(([k]) => rpt.confidence?.[k] >= 0.5)
                  .map(([k,v]) => `${k}=${v}`)
                return (
                  <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
                    <button onClick={()=>setExpanded(e=>({...e,[i]:!e[i]}))}
                      className="w-full flex items-center gap-3 p-3 bg-white hover:bg-slate-50 transition-colors text-left">
                      <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                        style={{background: rt ? rt.color+'22' : '#f1f5f9'}}>
                        <FileText size={12} style={{color: rt ? rt.color : '#94a3b8'}}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{rpt.filename}</p>
                        <p className="text-xs text-slate-400 truncate">{rptFields.join(' · ') || 'No high-confidence fields'}</p>
                      </div>
                      {isOpen ? <ChevronUp size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-100 p-3 bg-slate-50">
                        <div className="grid grid-cols-3 gap-1.5">
                          {Object.entries(rpt.extracted_values).map(([k,v]) => {
                            const c = rpt.confidence?.[k]
                            return (
                              <div key={k} className="bg-white rounded-lg p-2 border border-slate-100">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[10px] text-slate-400 font-mono">{k}</span>
                                  <span className={`w-1.5 h-1.5 rounded-full ${confColor(c)}`}/>
                                </div>
                                <span className="text-sm font-bold text-slate-700">{v}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Merged values grid */}
          <div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
              Merged Values (best confidence wins per field)
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {ALL_FIELDS.map(k => {
                const v    = preview.extracted_values?.[k]
                const conf = preview.confidence?.[k]
                const rt   = REPORT_TYPES.find(r => r.fields.includes(k))
                return (
                  <div key={k} className="bg-white border border-slate-100 rounded-xl p-2.5 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-400 font-mono">{k}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${confColor(conf)}`}
                        title={confLabel(conf)}/>
                    </div>
                    <span className="font-bold text-slate-800 text-sm block">{v ?? '—'}</span>
                    {rt && <span className="text-[9px] font-medium mt-0.5 block" style={{color:rt.color}}>
                      {rt.id}
                    </span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/> High — found in report</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"/> Medium — inferred</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-300 inline-block"/> Default used</span>
          </div>

          <button onClick={()=>{setPreview(null);setFiles([])}}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <RotateCcw size={12}/> Upload different reports
          </button>
        </motion.div>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={onBack} className="btn btn-outline"><ChevronLeft size={16}/> Back</button>
        {!preview ? (
          <button onClick={extract} disabled={files.length===0||loading} className="btn btn-primary flex-1"
            style={{background:loading?undefined:'linear-gradient(135deg,#7c3aed,#a855f7)'}}>
            {loading
              ? <><Loader size={16} className="animate-spin"/> Extracting {files.length} report{files.length>1?'s':''}…</>
              : <><Sparkles size={16}/> Extract from {files.length||'...'} Report{files.length!==1?'s':''}</>}
          </button>
        ) : (
          <button onClick={()=>onExtracted(preview)} className="btn btn-primary flex-1">
            <CheckCircle2 size={16}/> Use These Values →
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function AssessmentPage() {
  const [mode,      setMode]      = useState('select')
  const [step,      setStep]      = useState(0)
  const [form,      setForm]      = useState(DEFAULTS)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [note,      setNote]      = useState('')
  const [ragFilled, setRagFilled] = useState(false)
  const [ragMeta,   setRagMeta]   = useState(null)
  const navigate = useNavigate()
  const { user }  = useAuth()

  const set = (k, v) => setForm(f => ({ ...f, [k]: parseFloat(v) }))

  const handleRAGExtracted = (data) => {
    setForm({ ...DEFAULTS, ...data.extracted_values })
    setRagFilled(true)
    setRagMeta(data)
    setStep(0)
    setMode('manual')
  }

  const submit = async () => {
    setLoading(true); setError('')
    try {
      const res = await axios.post(`${API}/api/predict`, { ...form, patientNote: note }, { timeout: 20000 })
      sessionStorage.setItem('xai_result', JSON.stringify({ ...res.data, inputData: form }))
      navigate('/results')
    } catch (e) {
      setError(e?.response?.data?.error || 'Prediction failed. Please check the backend is running.')
    }
    setLoading(false)
  }

  const cur = STEPS[step]

  return (
    <div className="min-h-screen hero-mesh pt-16 pb-12 px-4">
      <div className="max-w-2xl mx-auto">

        <motion.div initial={{opacity:0,y:-16}} animate={{opacity:1,y:0}} className="text-center mb-8 pt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-4">
            <Activity size={13}/> Cardiovascular Risk Assessment
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-blue-950 mb-2">AI-Powered Heart Risk Analysis</h1>
          <p className="text-slate-500 text-sm">Enter values manually <strong>or</strong> upload one or more medical reports for automatic AI extraction</p>
        </motion.div>

        {/* Progress */}
        {mode === 'manual' && (
          <div className="flex items-start gap-2 mb-6">
            {STEPS.map((s,i) => (
              <div key={i} className="flex-1">
                <div className={`h-1.5 rounded-full transition-all duration-500 ${i<=step?'bg-blue-600':'bg-blue-100'}`}/>
                <p className={`text-xs mt-1.5 font-medium hidden sm:block ${i<=step?'text-blue-600':'text-slate-400'}`}>{s.title}</p>
              </div>
            ))}
          </div>
        )}

        {/* Mode selector */}
        {mode === 'select' && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}}>
            <div className="card p-6">
              <h2 className="font-bold text-slate-900 text-lg mb-1">How would you like to provide your data?</h2>
              <p className="text-slate-500 text-sm mb-5">Choose manual entry or upload medical reports for automatic extraction.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-2">
                <button onClick={()=>setMode('manual')}
                  className="group flex flex-col items-start p-6 rounded-2xl border-2 border-blue-100 bg-white hover:border-blue-500 hover:shadow-lg transition-all text-left">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 group-hover:bg-blue-600 flex items-center justify-center mb-4 transition-colors">
                    <ClipboardList size={22} className="text-blue-600 group-hover:text-white transition-colors"/>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mb-1">Manual Input</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">Enter clinical values step-by-step. Best if you have individual lab results ready.</p>
                  <div className="mt-4 flex items-center gap-1.5 text-blue-600 text-sm font-semibold">Start manually <ChevronRight size={15}/></div>
                </button>

                <button onClick={()=>setMode('rag')}
                  className="group relative flex flex-col items-start p-6 rounded-2xl border-2 border-violet-100 bg-white hover:border-violet-500 hover:shadow-lg transition-all text-left">
                  <div className="w-12 h-12 rounded-xl bg-violet-100 group-hover:bg-violet-600 flex items-center justify-center mb-4 transition-colors">
                    <Sparkles size={22} className="text-violet-600 group-hover:text-white transition-colors"/>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mb-1">Upload Medical Reports</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">Upload up to 7 separate reports. AI extracts the right attributes from each one automatically.</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {REPORT_TYPES.map(rt=>(
                      <span key={rt.id} className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold"
                        style={{background:rt.color+'18',color:rt.color}}>{rt.attrs}</span>
                    ))}
                  </div>
                  <span className="absolute top-3 right-3 text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">AI · Multi-report</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* RAG multi-upload */}
        {mode === 'rag' && (
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <Layers size={16} className="text-violet-600"/>
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base">Upload Medical Reports</h2>
                <p className="text-xs text-slate-400">Upload 1–7 reports · AI extracts the right fields from each</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1 flex-wrap mb-5 p-3 bg-violet-50 rounded-xl border border-violet-100 text-[11px]">
              {['Reports','→','TF-IDF Index','→','Retrieval','→','Groq Qwen','→','Merge','→','13 Values'].map((t,i)=>(
                <span key={i} className={t==='→'?'text-violet-300 font-bold':'bg-white text-violet-700 font-semibold px-2 py-0.5 rounded-md border border-violet-100'}>{t}</span>
              ))}
            </div>
            <MultiReportPanel onExtracted={handleRAGExtracted} onBack={()=>setMode('select')}/>
          </div>
        )}

        {/* Manual form */}
        {mode === 'manual' && (
          <>
            {ragFilled && (
              <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}
                className="mb-4 p-3 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-700">
                <div className="flex items-center gap-2">
                  <Sparkles size={15}/>
                  <span>
                    <strong>Values pre-filled from {ragMeta?.report_count||1} report{ragMeta?.report_count>1?'s':''}.</strong>
                    {' '}Review and adjust before submitting.
                  </span>
                  <button onClick={()=>{setForm(DEFAULTS);setRagFilled(false);setRagMeta(null)}}
                    className="ml-auto text-xs text-violet-400 hover:text-violet-700 flex items-center gap-1">
                    <RotateCcw size={12}/> Reset
                  </button>
                </div>
                {ragMeta?.filenames?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {ragMeta.filenames.map((fn,i)=>(
                      <span key={i} className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded font-mono truncate max-w-[180px]">{fn}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{opacity:0,x:20}} animate={{opacity:1,x:0}}
                exit={{opacity:0,x:-20}} transition={{duration:0.22}} className="card overflow-hidden">
                <div className="px-6 py-5 bg-gradient-to-r from-blue-700 to-blue-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-white text-lg">{cur.title}</h2>
                      <p className="text-blue-200 text-sm mt-0.5">{cur.desc} · Step {step+1} of {STEPS.length}</p>
                    </div>
                    {ragFilled && (
                      <span className="text-[10px] bg-violet-400/30 text-violet-100 px-2 py-1 rounded-full font-semibold flex items-center gap-1">
                        <Sparkles size={10}/> AI pre-filled
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {cur.fields.map(key => {
                    const cfg = FIELDS[key]
                    const rt  = REPORT_TYPES.find(r => r.fields.includes(key))
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                            {cfg.label}
                            {rt && <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold" style={{background:rt.color+'18',color:rt.color}}>{rt.id}</span>}
                          </label>
                          {cfg.unit && <span className="text-xs text-slate-400 font-mono">{cfg.unit}</span>}
                        </div>
                        <p className="text-xs text-slate-400 mb-2.5 flex items-center gap-1"><Info size={11}/> {cfg.help}</p>
                        {cfg.type==='range' ? (
                          <div className="flex items-center gap-3">
                            <input type="range" min={cfg.min} max={cfg.max} step={cfg.step} value={form[key]}
                              onChange={e=>set(key,e.target.value)} className="flex-1" style={{accentColor:'#2563eb'}}/>
                            <input type="number" min={cfg.min} max={cfg.max} step={cfg.step} value={form[key]}
                              onChange={e=>set(key,e.target.value)}
                              className="w-20 field text-center font-mono font-bold text-blue-900 flex-shrink-0"/>
                          </div>
                        ) : (
                          <select value={form[key]} onChange={e=>set(key,e.target.value)} className="field">
                            {cfg.options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                        )}
                      </div>
                    )
                  })}
                  {step===STEPS.length-1 && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">Note <span className="text-slate-400 font-normal">(optional)</span></label>
                      <input type="text" value={note} onChange={e=>setNote(e.target.value)}
                        placeholder="e.g. Annual checkup, follow-up…" className="field"/>
                    </div>
                  )}
                  {error && (
                    <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                      <AlertCircle size={16} className="flex-shrink-0 mt-0.5"/> {error}
                    </div>
                  )}
                </div>

                <div className="px-6 pb-6 flex gap-3">
                  {step===0
                    ? <button onClick={()=>{setMode('select');setStep(0);setRagFilled(false);setRagMeta(null)}} className="btn btn-outline"><ChevronLeft size={16}/> Mode</button>
                    : <button onClick={()=>setStep(s=>s-1)} className="btn btn-outline"><ChevronLeft size={16}/> Back</button>
                  }
                  <button onClick={step<STEPS.length-1?()=>setStep(s=>s+1):submit}
                    disabled={loading} className="btn btn-primary flex-1">
                    {loading?<><Loader size={16} className="animate-spin"/> Analysing…</>
                      :step<STEPS.length-1?<>Next <ChevronRight size={16}/></>
                        :<><Heart size={16}/> Get My Risk Score</>}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </>
        )}

        {!user && mode!=='select' && (
          <div className="mt-4 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-900">Want to save your results?</p>
              <p className="text-xs text-blue-600 mt-0.5">Create a free account to track your health history</p>
            </div>
            <a href="/register" className="btn btn-primary btn-sm flex-shrink-0">Sign Up Free</a>
          </div>
        )}
      </div>
    </div>
  )
}
