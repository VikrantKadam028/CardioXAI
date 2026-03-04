import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [form,    setForm]    = useState({ email: '', password: '' })
  const [showPw,  setShowPw]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const { login }             = useAuth()
  const navigate              = useNavigate()

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex bg-white">

      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.2)_0%,transparent_65%)]" />

        <Link to="/" className="flex items-center gap-2.5 relative z-10">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <Heart size={18} className="text-white fill-white" />
          </div>
          <span className="font-bold text-white text-base tracking-tight">CardioXAI</span>
        </Link>

        <div className="relative z-10">
          <motion.div animate={{ y: [0,-10,0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-24 h-24 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center mb-8 shadow-2xl">
            <Heart size={44} className="text-white fill-white/60 animate-pulse-slow" />
          </motion.div>
          <h2 className="font-serif font-bold text-4xl text-white mb-4 leading-tight italic">
            Your health data,<br />always secure.
          </h2>
          <p className="text-blue-200 text-sm leading-relaxed max-w-xs">
            Sign in to access your cardiovascular risk history, download reports, and track your heart health over time.
          </p>
        </div>

        <p className="text-blue-400 text-xs relative z-10">
          © {new Date().getFullYear()} CardioXAI — For educational purposes only.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
              <Heart size={18} className="text-white fill-white" />
            </div>
            <span className="font-bold text-blue-950 text-base">CardioXAI</span>
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm w-full mx-auto lg:mx-0">
          <h1 className="font-bold text-2xl sm:text-3xl text-blue-950 mb-1">Welcome back</h1>
          <p className="text-slate-500 text-sm mb-8">Sign in to your account to continue.</p>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  name="email" type="email" required autoComplete="email"
                  value={form.email} onChange={handle}
                  placeholder="you@example.com"
                  className="field pl-9"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  name="password" type={showPw ? 'text' : 'password'} required autoComplete="current-password"
                  value={form.password} onChange={handle}
                  placeholder="••••••••"
                  className="field pl-9 pr-10"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full btn-lg">
              {loading
                ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</span>
                : <>Sign In <ArrowRight size={17} /></>
              }
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 font-semibold hover:text-blue-800 transition-colors">Create one free</Link>
          </p>

          <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
            <p className="text-xs text-blue-700 font-medium">Want to try first?</p>
            <Link to="/assess" className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors">
              Use assessment without an account →
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}