import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { Heart, ChevronRight, ChevronLeft, Loader, AlertCircle, Activity, Info } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const STEPS = [
  { title: 'Basic Information', desc: 'Your fundamental health metrics',  fields: ['age','sex','trestbps','chol'] },
  { title: 'Heart Function',    desc: 'Cardiac performance indicators',   fields: ['thalach','exang','oldpeak','slope'] },
  { title: 'Diagnostics',       desc: 'Clinical test results',            fields: ['cp','fbs','restecg','ca','thal'] },
]

const FIELDS = {
  age:      { label: 'Age',                         type: 'range',  unit: 'years',  min: 20, max: 100, step: 1,   def: 55,  help: 'Your current age' },
  sex:      { label: 'Biological Sex',              type: 'select', options: [{v:0,l:'Female'},{v:1,l:'Male'}], help: 'Biological sex affects cardiovascular risk' },
  cp:       { label: 'Chest Pain Type',             type: 'select', options: [{v:0,l:'Typical Angina'},{v:1,l:'Atypical Angina'},{v:2,l:'Non-anginal Pain'},{v:3,l:'Asymptomatic'}], help: 'Type of chest discomfort experienced' },
  trestbps: { label: 'Resting Blood Pressure',      type: 'range',  unit: 'mm Hg', min: 80, max: 220, step: 1,   def: 130, help: 'Resting blood pressure measurement' },
  chol:     { label: 'Serum Cholesterol',           type: 'range',  unit: 'mg/dL', min: 100,max: 600, step: 1,   def: 240, help: 'Total cholesterol level' },
  fbs:      { label: 'Fasting Blood Sugar >120',    type: 'select', options: [{v:0,l:'No (≤120 mg/dL)'},{v:1,l:'Yes (>120 mg/dL)'}], help: 'Is fasting blood sugar elevated?' },
  restecg:  { label: 'Resting ECG',                 type: 'select', options: [{v:0,l:'Normal'},{v:1,l:'ST-T Wave Abnormality'},{v:2,l:'Left Ventricular Hypertrophy'}], help: 'Resting electrocardiographic results' },
  thalach:  { label: 'Maximum Heart Rate',          type: 'range',  unit: 'bpm',   min: 60, max: 220, step: 1,   def: 150, help: 'Maximum heart rate during exercise' },
  exang:    { label: 'Exercise-Induced Angina',     type: 'select', options: [{v:0,l:'No'},{v:1,l:'Yes'}], help: 'Chest pain triggered by exercise' },
  oldpeak:  { label: 'ST Depression (Oldpeak)',     type: 'range',  unit: '',      min: 0,  max: 8,   step: 0.1, def: 1.0, help: 'ST depression induced by exercise vs rest' },
  slope:    { label: 'ST Segment Slope',            type: 'select', options: [{v:1,l:'Upsloping'},{v:2,l:'Flat'},{v:3,l:'Downsloping'}], help: 'Slope of peak exercise ST segment' },
  ca:       { label: 'Major Vessels Coloured',      type: 'select', options: [{v:0,l:'0 Vessels'},{v:1,l:'1 Vessel'},{v:2,l:'2 Vessels'},{v:3,l:'3 Vessels'}], help: 'Number of major vessels coloured by fluoroscopy' },
  thal:     { label: 'Thalassemia',                 type: 'select', options: [{v:3,l:'Normal'},{v:6,l:'Fixed Defect'},{v:7,l:'Reversible Defect'}], help: 'Thalassemia type from nuclear stress test' },
}

const DEFAULTS = { age:55, sex:1, cp:0, trestbps:130, chol:240, fbs:0, restecg:0, thalach:150, exang:0, oldpeak:1.0, slope:2, ca:0, thal:3 }

export default function AssessmentPage() {
  const [step,  setStep]  = useState(0)
  const [form,  setForm]  = useState(DEFAULTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [note,  setNote]  = useState('')
  const navigate          = useNavigate()
  const { user }          = useAuth()

  const set = (k, v) => setForm(f => ({ ...f, [k]: parseFloat(v) }))

  const submit = async () => {
    setLoading(true)
    setError('')
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

        {/* Header */}
        <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} className="text-center mb-8 pt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-4">
            <Activity size={13} /> Cardiovascular Risk Assessment
          </div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl text-blue-950 mb-2">
            AI-Powered Heart Risk Analysis
          </h1>
          <p className="text-slate-500 text-sm">Enter your clinical measurements for a personalised risk prediction with full AI explanations</p>
        </motion.div>

        {/* Progress */}
        <div className="flex items-start gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all duration-500 ${i <= step ? 'bg-blue-600' : 'bg-blue-100'}`} />
              <p className={`text-xs mt-1.5 font-medium transition-colors hidden sm:block ${i <= step ? 'text-blue-600' : 'text-slate-400'}`}>{s.title}</p>
            </div>
          ))}
        </div>

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="card overflow-hidden"
          >
            {/* Card header */}
            <div className="px-6 py-5 bg-gradient-to-r from-blue-700 to-blue-900">
              <h2 className="font-bold text-white text-lg">{cur.title}</h2>
              <p className="text-blue-200 text-sm mt-0.5">{cur.desc} · Step {step + 1} of {STEPS.length}</p>
            </div>

            {/* Fields */}
            <div className="p-6 space-y-6">
              {cur.fields.map(key => {
                const cfg = FIELDS[key]
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-semibold text-slate-800">{cfg.label}</label>
                      {cfg.unit && <span className="text-xs text-slate-400 font-mono">{cfg.unit}</span>}
                    </div>
                    <p className="text-xs text-slate-400 mb-2.5 flex items-center gap-1">
                      <Info size={11} /> {cfg.help}
                    </p>

                    {cfg.type === 'range' ? (
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={cfg.min} max={cfg.max} step={cfg.step}
                          value={form[key]}
                          onChange={e => set(key, e.target.value)}
                          className="flex-1"
                          style={{ accentColor: '#2563eb' }}
                        />
                        <input
                          type="number"
                          min={cfg.min} max={cfg.max} step={cfg.step}
                          value={form[key]}
                          onChange={e => set(key, e.target.value)}
                          className="w-20 field text-center font-mono font-bold text-blue-900 flex-shrink-0"
                        />
                      </div>
                    ) : (
                      <select
                        value={form[key]}
                        onChange={e => set(key, e.target.value)}
                        className="field"
                      >
                        {cfg.options.map(o => (
                          <option key={o.v} value={o.v}>{o.l}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}

              {/* Note on last step */}
              {step === STEPS.length - 1 && (
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">Note <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="e.g. Annual checkup, follow-up..."
                    className="field"
                  />
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3">
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)} className="btn btn-outline">
                  <ChevronLeft size={16} /> Back
                </button>
              )}
              <button
                onClick={step < STEPS.length - 1 ? () => setStep(s => s + 1) : submit}
                disabled={loading}
                className="btn btn-primary flex-1"
              >
                {loading
                  ? <><Loader size={16} className="animate-spin" /> Analysing…</>
                  : step < STEPS.length - 1
                    ? <>Next <ChevronRight size={16} /></>
                    : <><Heart size={16} /> Get My Risk Score</>
                }
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Save prompt */}
        {!user && (
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