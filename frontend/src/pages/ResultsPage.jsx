import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import {
  Heart, Download, ArrowLeft, AlertTriangle, CheckCircle,
  Info, Brain, TrendingUp, Loader, LayoutDashboard,
  Stethoscope, Apple, Dumbbell, Pill, Moon, ClipboardList, ShieldCheck
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function RiskGauge({ probability }) {
  const pct = Math.round(probability * 100)
  const color = probability > 0.7 ? '#dc2626' : probability > 0.4 ? '#d97706' : '#16a34a'
  const label = probability > 0.7 ? 'HIGH RISK' : probability > 0.4 ? 'MODERATE RISK' : 'LOW RISK'
  const r = 48
  const circ = 2 * Math.PI * r

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
  const [result, setResult] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  const reportRef = useRef(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('xai_result')
    if (!raw) { navigate('/assess'); return }
    try { setResult(JSON.parse(raw)) } catch { navigate('/assess') }
  }, [])

  const downloadPdf = async () => {
    if (!reportRef.current || pdfLoading) return
    setPdfLoading(true)
    try {
      // Hide UI-only elements before capture
      const hiddenEls = reportRef.current.querySelectorAll('.no-print')
      hiddenEls.forEach(el => { el.dataset.prevDisplay = el.style.display; el.style.display = 'none' })

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const opts = { scale: 2, useCORS: true, logging: false, backgroundColor: '#f8fafc' }
      let currentY = 0
      let isFirstSection = true

      // Capture each section independently — no component ever splits across pages
      const sections = reportRef.current.querySelectorAll('[data-pdf-section]')

      for (const el of sections) {
        const forceBreak = el.dataset.pdfBreak === 'true'
        const canvas = await html2canvas(el, opts)
        const imgData = canvas.toDataURL('image/png')
        const sectionH = (canvas.height * pageW) / canvas.width

        // Start new page if: forced page break, or section won't fit remaining space
        if (forceBreak || (!isFirstSection && currentY > 0 && currentY + sectionH > pageH)) {
          pdf.addPage()
          currentY = 0
        }
        isFirstSection = false

        // Place section image on the PDF
        pdf.addImage(imgData, 'PNG', 0, currentY, pageW, sectionH)
        currentY += sectionH
      }

      // Restore hidden UI elements
      hiddenEls.forEach(el => { el.style.display = el.dataset.prevDisplay || ''; delete el.dataset.prevDisplay })

      pdf.save(`cardioxai-report-${Date.now()}.pdf`)
    } catch (e) {
      alert('PDF generation failed. Please try again.')
      console.error(e)
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
  const prob = probability ?? 0
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
      name: s.label,
      impact: parseFloat(Number(s.impact).toFixed(3)),
      isPositive: s.impact > 0,
    }))

  const riskBg = riskLevel === 'high' ? 'from-red-50 to-rose-50 border-red-100'
    : riskLevel === 'moderate' ? 'from-amber-50 to-orange-50 border-amber-100'
      : 'from-green-50 to-emerald-50 border-green-100'

  return (
    <div className="min-h-screen bg-slate-50 pt-16 pb-12 px-4">
      <div className="max-w-5xl mx-auto" ref={reportRef}>

        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 my-6 no-print">
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
        <div data-pdf-section className="text-center mb-6">
          <h1 className="font-bold text-2xl sm:text-3xl text-blue-950">Your Assessment Results</h1>
          <p className="text-slate-400 text-sm mt-1">AI-powered cardiovascular risk analysis with explainability</p>
        </div>

        {/* Risk summary card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          data-pdf-section
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
        <div data-pdf-section className={`grid gap-5 mb-6 ${shap_chart && shapChartData.length > 0 ? 'md:grid-cols-2' : ''}`}>

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
        <div data-pdf-section className="grid sm:grid-cols-2 gap-5 mb-6">

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

        {/* Healthcare Suggestions */}
        <motion.div data-pdf-section data-pdf-break="true" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mb-6">
          <div className="card overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-teal-600 to-teal-800">
              <div className="flex items-center gap-2">
                <Stethoscope size={18} className="text-white" />
                <h3 className="font-bold text-white">Healthcare Recommendations</h3>
              </div>
              <p className="text-teal-100 text-xs mt-1">Personalized guidance based on your cardiovascular risk profile</p>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-4">
              {(riskLevel === 'high' ? [
                { icon: Stethoscope, title: 'Urgent Medical Follow-up', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', text: 'Schedule an appointment with a cardiologist within 1–2 weeks. Request a comprehensive cardiac evaluation including coronary angiography, echocardiogram, and stress testing. Discuss referral for a coronary CT angiography (CCTA) to assess arterial blockages.' },
                { icon: Apple, title: 'Heart-Healthy Diet', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', text: 'Follow a strict DASH or Mediterranean diet. Limit sodium to under 1,500 mg/day. Eliminate trans fats and reduce saturated fats to less than 6% of daily calories. Increase omega-3 intake through fatty fish (salmon, mackerel) 2–3 times per week. Add fiber-rich foods like oats, legumes, and vegetables.' },
                { icon: Dumbbell, title: 'Supervised Physical Activity', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', text: 'Enroll in a supervised cardiac rehabilitation program. Begin with 10–15 minutes of light walking daily, gradually progressing to 150 minutes/week of moderate aerobic activity. Avoid high-intensity or strenuous exercise until cleared by your cardiologist. Monitor heart rate during all physical activity.' },
                { icon: Pill, title: 'Medication Review', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', text: 'Discuss with your physician about antiplatelet therapy (aspirin), high-intensity statin therapy to target LDL below 70 mg/dL, ACE inhibitors or ARBs for blood pressure control (target < 130/80 mmHg), and beta-blockers if indicated. Never self-medicate — all prescriptions must be supervised by your doctor.' },
                { icon: Moon, title: 'Lifestyle & Stress Management', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'Quit smoking immediately — seek nicotine replacement therapy or counseling if needed. Limit alcohol to 1 drink/day (women) or 2 drinks/day (men). Prioritize 7–9 hours of quality sleep nightly. Practice daily stress reduction techniques such as deep breathing, meditation, or yoga. Consider professional counseling for anxiety or depression.' },
                { icon: ClipboardList, title: 'Monitoring & Tracking', color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100', text: 'Monitor blood pressure at home twice daily (morning and evening) with a validated digital monitor. Track fasting blood glucose weekly if diabetic or pre-diabetic. Schedule lipid panel testing every 3 months. Maintain a symptom diary noting any chest pain, shortness of breath, dizziness, or unusual fatigue. Report any new symptoms to your doctor immediately.' },
              ] : riskLevel === 'moderate' ? [
                { icon: Stethoscope, title: 'Medical Follow-up', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', text: 'Schedule an outpatient cardiology consultation within 4–6 weeks for risk stratification. Request a stress ECG or echocardiogram to evaluate cardiac function. Discuss your complete cardiovascular risk profile with your primary care physician and consider additional diagnostic workup based on clinical findings.' },
                { icon: Apple, title: 'Dietary Improvements', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', text: 'Adopt a Mediterranean-style diet rich in fruits, vegetables, whole grains, nuts, and olive oil. Reduce sodium intake to under 2,300 mg/day. Limit processed foods, sugary beverages, and red meat. Increase consumption of fiber (aim for 25–30 grams/day) through legumes, oats, and vegetables. Include omega-3 rich foods like fish, walnuts, and flaxseeds.' },
                { icon: Dumbbell, title: 'Regular Exercise', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', text: 'Aim for at least 150 minutes per week of moderate-intensity aerobic exercise such as brisk walking, cycling, or swimming. Include 2 sessions of resistance/strength training per week. Start gradually if currently sedentary — even 10-minute walks after meals provide cardiovascular benefit. Consider a fitness tracker to monitor daily activity levels.' },
                { icon: Pill, title: 'Medication Awareness', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', text: 'Discuss with your physician whether statin therapy is appropriate for your lipid levels. If blood pressure is consistently above 130/80 mmHg, medication may be warranted. Review all current medications for interactions or side effects. Do not start or stop any medications without medical supervision. Ask about low-dose aspirin therapy based on your individual risk-benefit profile.' },
                { icon: Moon, title: 'Lifestyle Modifications', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'If you smoke, commit to a cessation plan — consult your doctor about available aids. Limit alcohol consumption to moderate levels. Manage stress through regular relaxation practices like mindfulness meditation, deep breathing exercises, or gentle yoga. Ensure consistent sleep of 7–8 hours per night. Maintain a healthy body weight (BMI 18.5–24.9).' },
                { icon: ClipboardList, title: 'Health Monitoring', color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100', text: 'Check blood pressure at home at least twice per week and log readings. Schedule a fasting lipid panel and glucose test every 6 months. Repeat cardiovascular risk assessment in 3–6 months to track progress. Know your numbers — target total cholesterol below 200 mg/dL, LDL below 100 mg/dL, and fasting glucose below 100 mg/dL.' },
              ] : [
                { icon: Stethoscope, title: 'Routine Health Checkups', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', text: 'Maintain annual cardiovascular health checkups with your primary care physician. A routine lipid panel and fasting blood glucose test once a year is sufficient. Continue to monitor blood pressure periodically. Your current risk profile is favorable — focus on prevention and maintaining your healthy baseline.' },
                { icon: Apple, title: 'Maintain Heart-Healthy Diet', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', text: 'Continue eating a balanced diet rich in fruits, vegetables, whole grains, lean proteins, and healthy fats. Limit processed foods, excess sugar, and excessive sodium. Stay well-hydrated with water as your primary beverage. A Mediterranean or plant-forward eating pattern is excellent for long-term heart health maintenance.' },
                { icon: Dumbbell, title: 'Stay Physically Active', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', text: 'Continue or begin a regular exercise routine — 150 minutes of moderate activity or 75 minutes of vigorous activity per week. Include a mix of cardiovascular exercise (walking, running, swimming) and strength training (2–3 sessions/week). Regular physical activity is one of the strongest protective factors against heart disease.' },
                { icon: Pill, title: 'Preventive Awareness', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', text: 'No specific cardiovascular medications are typically needed at low risk. However, continue taking any currently prescribed medications as directed. Discuss any family history of heart disease with your physician. Stay informed about your personal health metrics and maintain open communication with your healthcare team during annual visits.' },
                { icon: Moon, title: 'Healthy Lifestyle Habits', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'Avoid smoking and second-hand smoke exposure. Limit alcohol to moderate levels. Prioritize 7–9 hours of quality sleep per night. Manage daily stress through hobbies, social connections, and relaxation practices. Maintain a healthy body weight and stay mentally active — cognitive and emotional well-being contribute significantly to cardiovascular health.' },
                { icon: ClipboardList, title: 'Long-term Wellness', color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100', text: 'Track your blood pressure, cholesterol, and glucose levels annually. Keep a record of your health metrics over time to identify any gradual changes. Stay up to date with vaccinations (e.g., flu vaccine — infections can stress the cardiovascular system). Continue positive health behaviors — your current low-risk status is a valuable asset worth protecting.' },
              ]).map((item, i) => (
                <div key={i} className={`p-4 ${item.bg} rounded-xl border ${item.border}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <item.icon size={16} className={item.color} />
                    <h4 className={`font-bold text-sm ${item.color}`}>{item.title}</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* AI Disclaimer */}
        <div data-pdf-section className="p-4 bg-slate-100 rounded-2xl border border-slate-200 mb-5">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="text-slate-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs text-slate-700 mb-1">AI-Generated Report — Medical Disclaimer</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                This cardiovascular risk assessment report has been generated by CardioXAI, an artificial intelligence system
                using a logistic regression model trained on the Cleveland Heart Disease dataset (UCI). The predictions, SHAP-based
                explanations, and healthcare recommendations provided are for <strong>informational and educational purposes only</strong> and
                do <strong>not</strong> constitute a medical diagnosis, clinical advice, or a substitute for professional medical consultation.
                Individual health decisions should always be made in consultation with a qualified healthcare professional who can
                evaluate your complete medical history, perform physical examinations, and order appropriate diagnostic tests.
                The developers and operators of CardioXAI assume no liability for actions taken based on this report.
              </p>
            </div>
          </div>
        </div>

        {/* Save CTA */}
        {!user && (
          <div className="no-print p-5 bg-gradient-to-r from-blue-700 to-blue-900 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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