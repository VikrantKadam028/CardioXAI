import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import axios from 'axios'
import { ArrowLeft, Download, Calendar, AlertTriangle, CheckCircle, Activity, Brain, Loader } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const LABELS = {
  age: 'Age', sex: 'Sex', cp: 'Chest Pain Type', trestbps: 'Resting BP (mm Hg)',
  chol: 'Cholesterol (mg/dL)', fbs: 'Fasting Blood Sugar >120', restecg: 'Resting ECG',
  thalach: 'Max Heart Rate (bpm)', exang: 'Exercise Angina', oldpeak: 'ST Depression',
  slope: 'ST Slope', ca: 'Major Vessels', thal: 'Thalassemia',
}

export default function ReportDetailPage() {
  const { id } = useParams()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  const reportRef = useRef(null)

  useEffect(() => {
    axios.get(`${API}/api/user/reports/${id}`)
      .then(r => setReport(r.data))
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false))
  }, [id])

  const downloadPdf = async () => {
    if (!reportRef.current || pdfLoading) return
    setPdfLoading(true)
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8fafc',
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgH = (canvas.height * pageW) / canvas.width

      let y = 0
      while (y < imgH) {
        if (y > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, -y, pageW, imgH)
        y += pageH
      }
      pdf.save(`cardioxai-report-${Date.now()}.pdf`)
    } catch (e) {
      alert('PDF generation failed. Please try again.')
      console.error(e)
    }
    setPdfLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="spinner" />
    </div>
  )
  if (!report) return null

  const pct = Math.round(report.probability * 100)
  const level = report.riskLevel

  const bannerBg = level === 'high'
    ? 'from-red-500 to-rose-700'
    : level === 'moderate'
      ? 'from-amber-400 to-orange-600'
      : 'from-emerald-500 to-green-700'

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 pt-20">
      <div className="max-w-4xl mx-auto" ref={reportRef}>

        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-semibold transition-colors">
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          <button onClick={downloadPdf} disabled={pdfLoading} className="btn btn-primary btn-sm">
            {pdfLoading ? <><Loader size={14} className="animate-spin" /> Generating…</> : <><Download size={14} /> Download PDF</>}
          </button>
        </div>

        {/* Risk banner */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className={`bg-gradient-to-r ${bannerBg} rounded-2xl p-6 mb-6 text-white`}
        >
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Activity size={26} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-3xl">{pct}% Risk Score</p>
              <p className="text-white/80 text-sm capitalize mt-0.5">{level} cardiovascular risk</p>
            </div>
            <p className="text-white/70 text-xs flex items-center gap-1.5 flex-shrink-0">
              <Calendar size={13} />
              {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5">

          {/* Clinical parameters */}
          <div className="card p-5">
            <h3 className="font-bold text-sm text-blue-950 mb-4">Clinical Parameters</h3>
            <div className="space-y-2">
              {report.inputData && Object.entries(report.inputData)
                .filter(([k]) => k !== 'patientNote')
                .map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <span className="text-xs text-slate-500">{LABELS[k] || k}</span>
                    <span className="text-xs font-semibold text-blue-950 font-mono">{v}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* XAI insights */}
          <div className="space-y-4">

            {report.shap_chart && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={15} className="text-blue-600" />
                  <h3 className="font-bold text-sm text-blue-950">SHAP Feature Importance</h3>
                </div>
                <img src={`data:image/png;base64,${report.shap_chart}`} alt="SHAP Chart" className="w-full rounded-xl border border-slate-100" />
              </div>
            )}

            {report.explanation?.overall_assessment && (
              <div className="card p-5 bg-blue-50/50 border-blue-100">
                <h3 className="font-bold text-sm text-blue-950 mb-2">Clinical Assessment</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{report.explanation.overall_assessment}</p>
              </div>
            )}

            {report.explanation?.risk_factors?.length > 0 && (
              <div className="card p-5 border-red-100">
                <h3 className="font-bold text-sm text-red-700 mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Risk Factors
                </h3>
                <div className="space-y-2.5">
                  {report.explanation.risk_factors.slice(0, 4).map(f => (
                    <div key={f.feature} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-red-700">{f.label}</span>
                        {f.value !== undefined && <span className="text-xs text-slate-400 ml-1">({f.value})</span>}
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{f.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.explanation?.protective_factors?.length > 0 && (
              <div className="card p-5 border-green-100">
                <h3 className="font-bold text-sm text-green-700 mb-3 flex items-center gap-1.5">
                  <CheckCircle size={14} /> Protective Factors
                </h3>
                <div className="space-y-2.5">
                  {report.explanation.protective_factors.slice(0, 4).map(f => (
                    <div key={f.feature} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-green-700">{f.label}</span>
                        {f.value !== undefined && <span className="text-xs text-slate-400 ml-1">({f.value})</span>}
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{f.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}