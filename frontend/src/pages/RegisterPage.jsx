import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Mail, Lock, Eye, EyeOff, User, ArrowRight, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const STEPS = ['Account', 'Personal', 'Medical']

const slideVariants = {
  enter: d => ({ x: d > 0 ? 30 : -30, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  d => ({ x: d > 0 ? -30 : 30, opacity: 0 }),
}

export default function RegisterPage() {
  const [step,    setStep]    = useState(0)
  const [dir,     setDir]     = useState(1)
  const [showPw,  setShowPw]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [form,    setForm]    = useState({
    firstName: '', lastName: '', email: '', password: '',
    dateOfBirth: '', gender: '', phone: '', bloodGroup: '', medicalHistory: ''
  })
  const { register } = useAuth()
  const navigate     = useNavigate()

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  const next   = () => { setDir(1); setStep(s => s + 1) }
  const back   = () => { setDir(-1); setStep(s => s - 1) }

  const submit = async e => {
    e.preventDefault()
    if (step < 2) { next(); return }
    setLoading(true); setError('')
    try { await register(form); navigate('/dashboard') }
    catch (err) { setError(err.response?.data?.error || 'Registration failed. Please try again.'); setLoading(false) }
  }

  const field = (name, label, type = 'text', placeholder = '', props = {}) => (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
      <input name={name} type={type} value={form[name]} onChange={handle}
        placeholder={placeholder} className="field" {...props} />
    </div>
  )

  const select = (name, label, options, required = false) => (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
      <select name={name} value={form[name]} onChange={handle} className="field">
        <option value="">Not specified</option>
        {options.map(o => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}
      </select>
    </div>
  )

  return (
    <div className="min-h-screen flex bg-white">

      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.2)_0%,transparent_60%)]" />

        <Link to="/" className="flex items-center gap-2.5 relative z-10">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Heart size={18} className="text-white fill-white" />
          </div>
          <span className="font-bold text-white text-base">CardioXAI</span>
        </Link>

        <div className="relative z-10">
          <div className="flex gap-3 mb-8">
            {STEPS.map((s, i) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-blue-400' : 'bg-white/10'}`} />
            ))}
          </div>
          <h2 className="font-serif font-bold text-4xl text-white mb-4 leading-tight italic">
            Start your heart<br />health journey.
          </h2>
          <p className="text-blue-200 text-sm leading-relaxed max-w-xs">
            Create a free account to save assessments, track risk trends over time, and download professional PDF reports.
          </p>
        </div>

        <p className="text-blue-400 text-xs relative z-10">
          © {new Date().getFullYear()} CardioXAI
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-12">

        {/* Mobile logo */}
        <div className="lg:hidden mb-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
              <Heart size={18} className="text-white fill-white" />
            </div>
            <span className="font-bold text-blue-950 text-base">CardioXAI</span>
          </Link>
        </div>

        <div className="max-w-sm w-full mx-auto lg:mx-0">
          {/* Step pills */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-blue-700' : 'text-slate-400'}`}>{s}</span>
                {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? 'bg-green-300' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>

          <h1 className="font-bold text-2xl sm:text-3xl text-blue-950 mb-1">
            {step === 0 ? 'Create your account' : step === 1 ? 'Personal details' : 'Medical profile'}
          </h1>
          <p className="text-slate-500 text-sm mb-8">
            {step === 0 ? 'Set up your login credentials' : step === 1 ? 'Help us personalise your experience' : 'Optional — for more accurate insights'}
          </p>

          <form onSubmit={submit}>
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                variants={slideVariants}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="space-y-4"
              >
                {step === 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      {field('firstName', 'First Name', 'text', 'Jane', { required: true })}
                      {field('lastName',  'Last Name',  'text', 'Doe',  { required: true })}
                    </div>
                    {field('email', 'Email', 'email', 'you@example.com', { required: true, autoComplete: 'email' })}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                      <div className="relative">
                        <input name="password" type={showPw ? 'text' : 'password'} required autoComplete="new-password"
                          value={form.password} onChange={handle} placeholder="Min. 8 characters" className="field pr-10" />
                        <button type="button" onClick={() => setShowPw(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {step === 1 && (
                  <>
                    {field('phone', 'Phone Number', 'tel', '+1 (555) 000-0000')}
                    {field('dateOfBirth', 'Date of Birth', 'date')}
                    {select('gender', 'Gender', [{ v: 'male', l: 'Male' }, { v: 'female', l: 'Female' }, { v: 'other', l: 'Other / Prefer not to say' }])}
                  </>
                )}

                {step === 2 && (
                  <>
                    {select('bloodGroup', 'Blood Group', ['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => ({ v: g, l: g })))}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Medical History <span className="text-slate-400 font-normal">(optional)</span>
                      </label>
                      <textarea name="medicalHistory" value={form.medicalHistory} onChange={handle}
                        placeholder="Any relevant conditions, medications, or family history…"
                        rows={4} className="field resize-none" />
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm mt-5">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> {error}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              {step > 0 && (
                <button type="button" onClick={back} className="btn btn-outline">
                  <ChevronLeft size={16} /> Back
                </button>
              )}
              <button type="submit" disabled={loading} className="btn btn-primary flex-1 btn-lg">
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : step < 2
                    ? <>Continue <ChevronRight size={16} /></>
                    : <>Create Account <ArrowRight size={16} /></>
                }
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-semibold hover:text-blue-800 transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}