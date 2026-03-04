import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import axios from 'axios'
import {
  Heart, Download, ArrowLeft, AlertTriangle, CheckCircle,
  Info, Brain, TrendingUp, Loader, LayoutDashboard
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function RiskGauge({ probability }) {
  const pct   = Math.round(probability * 100)
  const color = probability > 0.7 ? '#dc2626' : probability > 0.4 ? '#d97706' : '#16a34a'
  const label = probability > 0.7 ? 'HIGH RISK' : probability > 0.4 ? 'MODERATE RISK' : 'LOW RISK'
  const r     = 48
  const circ  = 2 * Math.PI * r

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="9" />
          <motion.circle
            cx="60" cy="60" r={r}
            fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ * (1 - probability) }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="font-bold text-3xl leading-none" style={{ color }}
          >
            {pct}%
          </motion.span>
          <span className="text-[10px] font-bold text-slate-400 mt-1 tracking-wide">{label}</span>
        </div>
      </div>
    </div>
  )
}

export default function ResultsPage() {
  const [result,     setResult]     = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const { user }                    = useAuth()
  const navigate                    = useNavigate()

  useEffect(() => {
    const raw = sessionStorage.getItem('xai_result')
    if (!raw) { navigate('/assess'); return }
    try { setResult(JSON.parse(raw)) } catch { navigate('/assess') }
  }, [])

  const downloadPdf = async () => {
    if (!result || pdfLoading) return
    setPdfLoading(true)
    try {
      const res = await axios.post(
        `${API}/api/report/pdf`,
        { ...result.inputData, patientInfo: { name: user ? `${user.firstName} ${user.lastName}` : 'Anonymous' } },
        { timeout: 30000 }
      )
      // Proper base64 → Blob → download
      const raw   = atob(res.data.pdf)
      const bytes = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
      const blob  = new Blob([bytes], { type: 'application/pdf' })
      const url   = URL.createObjectURL(blob)
      const a     = document.createElement('a')
      a.href      = url
      a.download  = res.data.filename || 'cardioxai-report.pdf'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e?.response?.data?.error || 'PDF generation failed. Ensure the backend is running.')
    } finally {
      setPdfLoading(false)
    }
  }

  if (!result) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="spinner" />
    </div>
  )

  const { probability, shap_values, explanation, shap_chart, model_info } = result
  const prob      = probability ?? 0
  const riskLevel = prob > 0.7 ? 'high' : prob > 0.4 ? 'moderate' : 'low'

  // Normalise shap_values into array format
  const shapArr = Array.isArray(shap_values)
    ? shap_values
    : shap_values
      ? Object.entries(shap_values).map(([label, impact]) => ({ label, impact: Number(impact) }))
      : []

  const shapChartData = [...shapArr]
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 10)
    .map(s => ({
      name:       s.label,
      impact:     parseFloat(Number(s.impact).toFixed(3)),
      isPositive: s.impact > 0,
    }))

  const riskBg    = riskLevel === 'high'     ? 'from-red-50 to-rose-50 border-red-100'
                  : riskLevel === 'moderate' ? 'from-amber-50 to-orange-50 border-amber-100'
                  :                            'from-green-50 to-emerald-50 border-green-100'

  return (
    <div className="min-h-screen bg-slate-50 pt-16 pb-12 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 my-6">
          <Link to="/assess" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-semibold transition-colors">
            <ArrowLeft size={16} /> New Assessment
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            {user && (
              <Link to="/dashboard" className="btn btn-outline btn-sm">
                <LayoutDashboard size={14} /> Dashboard
              </Link>
            )}
            <button onClick={downloadPdf} disabled={pdfLoading} className="btn btn-primary btn-sm">
              {pdfLoading ? <><Loader size={14} className="animate-spin" /> Generating…</> : <><Download size={14} /> Download PDF</>}
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="font-bold text-2xl sm:text-3xl text-blue-950">Your Assessment Results</h1>
          <p className="text-slate-400 text-sm mt-1">AI-powered cardiovascular risk analysis with explainability</p>
        </div>

        {/* Risk summary card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={`card bg-gradient-to-br ${riskBg} border p-6 sm:p-8 mb-6`}
        >
          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
            <RiskGauge probability={prob} />
            <div className="flex-1 text-center sm:text-left">
              <span className={`badge mb-3 badge-${riskLevel}`}>
                {riskLevel === 'high' ? '⚠ ' : riskLevel === 'moderate' ? '● ' : '✓ '}
                {riskLevel} risk
              </span>
              <h2 className="font-bold text-2xl sm:text-3xl text-blue-950 mb-3">
                {Math.round(prob * 100)}% Cardiovascular Risk
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed">
                {explanation?.overall_assessment || 'Analysis complete. Review the factor breakdown below for full clinical insights.'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* SHAP charts grid */}
        <div className={`grid gap-5 mb-6 ${shap_chart && shapChartData.length > 0 ? 'md:grid-cols-2' : ''}`}>

          {/* Backend-generated SHAP chart image */}
          {shap_chart && (
            <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              className="card p-5">
              <div className="flex items-center gap-2 mb-1">
                <Brain size={15} className="text-blue-600" />
                <h3 className="font-bold text-sm text-blue-950">SHAP Feature Analysis</h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">Gradient-based attribution from actual model weights</p>
              <img src={`data:image/png;base64,${shap_chart}`} alt="SHAP Feature Impact" className="w-full rounded-xl border border-slate-100 object-contain" />
            </motion.div>
          )}

          {/* Interactive recharts bars */}
          {shapChartData.length > 0 && (
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
              className="card p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={15} className="text-blue-600" />
                <h3 className="font-bold text-sm text-blue-950">Impact Breakdown</h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">Top 10 features ranked by contribution magnitude</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={shapChartData} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={v => v.toFixed(2)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#475569', fontFamily: 'Poppins' }} width={108} />
                  <Tooltip
                    formatter={v => [v.toFixed(4), 'SHAP value']}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11, fontFamily: 'Poppins' }}
                  />
                  <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                    {shapChartData.map((e, i) => <Cell key={i} fill={e.isPositive ? '#ef4444' : '#22c55e'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-5 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-400 inline-block" /> Increases Risk</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-green-400 inline-block" /> Decreases Risk</span>
              </div>
            </motion.div>
          )}

          {/* Fallback – no SHAP data */}
          {!shap_chart && shapChartData.length === 0 && (
            <div className="card p-8 text-center col-span-full">
              <Brain size={32} className="text-blue-300 mx-auto mb-3" />
              <p className="font-semibold text-blue-900 text-sm">XAI Analysis Unavailable</p>
              <p className="text-slate-400 text-xs mt-1">Connect to the backend to receive real SHAP explainability data.</p>
            </div>
          )}
        </div>

        {/* Risk & Protective factor cards */}
        <div className="grid sm:grid-cols-2 gap-5 mb-6">

          {/* Risk factors */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
              <h3 className="font-bold text-sm text-red-800">Risk-Elevating Factors</h3>
            </div>
            {explanation?.risk_factors?.length > 0 ? (
              <div className="space-y-3">
                {explanation.risk_factors.map((f, i) => (
                  <motion.div key={f.feature || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.06 }}
                    className="p-3 bg-red-50 rounded-xl border border-red-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-red-800">▲ {f.label}</span>
                      <span className="font-mono text-xs text-red-600 font-bold">+{Math.abs(f.impact * 100).toFixed(1)}%</span>
                    </div>
                    <p className="text-xs text-slate-500">Value: <strong>{f.value}</strong></p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{f.explanation}</p>
                  </motion.div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">No significant risk-elevating factors identified.</p>}
          </motion.div>

          {/* Protective factors */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={15} className="text-green-500 flex-shrink-0" />
              <h3 className="font-bold text-sm text-green-800">Protective Factors</h3>
            </div>
            {explanation?.protective_factors?.length > 0 ? (
              <div className="space-y-3">
                {explanation.protective_factors.map((f, i) => (
                  <motion.div key={f.feature || i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.06 }}
                    className="p-3 bg-green-50 rounded-xl border border-green-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-green-800">▼ {f.label}</span>
                      <span className="font-mono text-xs text-green-600 font-bold">-{Math.abs(f.impact * 100).toFixed(1)}%</span>
                    </div>
                    <p className="text-xs text-slate-500">Value: <strong>{f.value}</strong></p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{f.explanation}</p>
                  </motion.div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">No significant protective factors identified.</p>}
          </motion.div>
        </div>

        {/* Disclaimer */}
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3 mb-5">
          <Info size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>Medical Disclaimer:</strong> This analysis is for informational and educational purposes only.
            It does not constitute a clinical diagnosis. Always consult a qualified healthcare professional.
          </p>
        </div>

        {/* Save CTA */}
        {!user && (
          <div className="p-5 bg-gradient-to-r from-blue-700 to-blue-900 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-bold text-white">Save this report to your account</p>
              <p className="text-blue-200 text-sm mt-0.5">Track trends, compare history, download anytime</p>
            </div>
            <Link to="/register" className="btn bg-white text-blue-700 hover:bg-blue-50 flex-shrink-0">
              Create Free Account
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}