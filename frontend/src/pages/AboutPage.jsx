import { motion } from 'framer-motion'
import { Brain, Shield, Activity, Heart, FileText, CheckCircle } from 'lucide-react'

const cards = [
  {
    icon: Brain,
    title: 'Explainable AI',
    accent: 'from-blue-500 to-blue-700',
    content: 'Every risk prediction is accompanied by real SHAP-based feature attribution. You see not just your score, but exactly which clinical factors drive it — computed from your individual data, not population averages.'
  },
  {
    icon: Activity,
    title: 'Clinically Grounded',
    accent: 'from-blue-600 to-indigo-700',
    content: 'Our model is trained on real patient records from a major cardiology research dataset, covering 13 standard cardiovascular biomarkers. The underlying logic mirrors the clinical reasoning used in real assessments.'
  },
  {
    icon: FileText,
    title: 'Professional Reports',
    accent: 'from-sky-500 to-blue-600',
    content: 'Download detailed PDF reports featuring your risk score, a visual SHAP breakdown, identified risk factors, protective factors, and clinical insights — formatted for easy sharing with your physician.'
  },
  {
    icon: Shield,
    title: 'Security & Privacy',
    accent: 'from-blue-700 to-slate-700',
    content: 'All data is protected with JWT-authenticated sessions and encrypted storage. We do not share, sell, or use your health data for any purpose beyond providing your assessment results.'
  },
]

const principles = [
  'Real SHAP values computed from your actual inputs — never placeholders',
  'Per-patient attribution, not averaged feature importance',
  'Risk and protective factors clearly separated and explained',
  'Plain-language explanations alongside technical values',
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white pt-16 pb-20 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-12 mb-14">
          <span className="inline-block px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-5">
            About CardioXAI
          </span>
          <h1 className="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl text-blue-950 mb-5 leading-tight italic">
            Transparency at the Core
          </h1>
          <p className="text-slate-500 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            CardioXAI is a cardiovascular risk assessment tool built on the belief that AI should be
            transparent, explainable, and genuinely useful — not a black box.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 gap-5 mb-14">
          {cards.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="card p-6 card-hover"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.accent} flex items-center justify-center mb-4 shadow-md`}>
                <c.icon size={20} className="text-white" />
              </div>
              <h3 className="font-bold text-base text-blue-950 mb-2">{c.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{c.content}</p>
            </motion.div>
          ))}
        </div>

        {/* Transparency section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-blue-700 to-blue-950 rounded-3xl p-8 sm:p-10 text-center mb-8 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.06)_0%,transparent_55%)]" />
          <Heart size={36} className="text-blue-300 mx-auto mb-5 fill-blue-400/30 animate-pulse-slow" />
          <h2 className="font-serif font-bold text-2xl sm:text-3xl text-white mb-3 italic">Our Commitment to Explainability</h2>
          <p className="text-blue-200 max-w-xl mx-auto text-sm leading-relaxed mb-8">
            Every result you see is backed by mathematically grounded feature attribution.
            We believe understanding <em>why</em> is just as important as knowing <em>what</em>.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto text-left">
            {principles.map(p => (
              <div key={p} className="flex items-start gap-3 bg-white/5 rounded-xl p-3 border border-white/10">
                <CheckCircle size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <span className="text-blue-100 text-xs leading-relaxed">{p}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Disclaimer */}
        <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100">
          <p className="text-sm text-amber-800 leading-relaxed">
            <strong className="font-semibold">Medical Disclaimer:</strong>{' '}
            CardioXAI is an educational and informational tool only. It is not a substitute for professional
            medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider about
            any medical conditions or health concerns.
          </p>
        </div>
      </div>
    </div>
  )
}