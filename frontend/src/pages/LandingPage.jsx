import { useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import {
  Heart, Brain, Shield, Activity, Zap, FileText,
  ArrowRight, CheckCircle, ChevronRight, Sparkles, BarChart3
} from 'lucide-react'

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }
  })
}

function InView({ children, className = '', delay = 0 }) {
  const ref   = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={fadeUp}
      custom={delay}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const features = [
  {
    icon: Brain,
    title: 'Explainable AI',
    desc: 'Every prediction comes with real SHAP-based feature attribution — you see exactly which factors influence your risk and why.',
    accent: 'from-blue-500 to-blue-700'
  },
  {
    icon: Activity,
    title: 'Clinically Validated',
    desc: 'Our model is trained on real patient data from a major cardiology research dataset, ensuring medically meaningful results.',
    accent: 'from-blue-600 to-indigo-700'
  },
  {
    icon: FileText,
    title: 'Professional Reports',
    desc: 'Download detailed PDF reports with risk analysis, factor breakdowns, and personalized clinical insights.',
    accent: 'from-sky-500 to-blue-600'
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    desc: 'JWT authentication, encrypted storage, and zero data sharing. Your health information stays yours.',
    accent: 'from-blue-700 to-slate-700'
  },
  {
    icon: BarChart3,
    title: 'Health Dashboard',
    desc: 'Track risk trends over time, compare assessments, and visualize how lifestyle changes affect your score.',
    accent: 'from-blue-400 to-blue-600'
  },
  {
    icon: Zap,
    title: 'Instant Analysis',
    desc: 'Get your cardiovascular risk prediction and detailed AI explanation within seconds of submitting your data.',
    accent: 'from-indigo-500 to-blue-700'
  },
]

const steps = [
  { n: '01', title: 'Enter Your Data',     desc: 'Input your clinical biomarkers from recent lab results or a medical checkup.' },
  { n: '02', title: 'AI Processes',        desc: 'Our model computes your cardiovascular risk probability across multiple risk dimensions.' },
  { n: '03', title: 'Get Explanations',    desc: 'See exactly which factors contribute to your risk, powered by real SHAP attribution.' },
  { n: '04', title: 'Download & Track',    desc: 'Save your report and monitor trends over time via your personal health dashboard.' },
]

export default function LandingPage() {
  const { scrollY }  = useScroll()
  const heroY        = useTransform(scrollY, [0, 500], [0, -60])
  const heroOpacity  = useTransform(scrollY, [0, 400], [1, 0.4])

  return (
    <div className="overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center justify-center hero-mesh pt-16">
        {/* Decorative orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div animate={{ y: [0,-18,0], x: [0,10,0] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/4 left-[15%] w-80 h-80 bg-blue-100/50 rounded-full blur-3xl" />
          <motion.div animate={{ y: [0,16,0], x: [0,-12,0] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            className="absolute bottom-1/3 right-[10%] w-96 h-96 bg-blue-200/30 rounded-full blur-3xl" />
          {/* ECG line */}
          <svg className="absolute bottom-20 left-0 w-full opacity-[0.06]" viewBox="0 0 1200 80" fill="none">
            <motion.path
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 3.5, ease: 'easeOut', delay: 0.8 }}
              d="M0,40 L200,40 L230,40 L242,12 L256,70 L268,8 L282,72 L296,40 L500,40 L600,40 L700,40 L730,40 L742,12 L756,70 L768,8 L782,72 L796,40 L1000,40 L1200,40"
              stroke="#2563eb" strokeWidth="2.5" fill="none"
            />
          </svg>
        </div>

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-8 shadow-sm"
          >
            <Sparkles size={13} className="text-blue-500" />
            Explainable AI · Cardiovascular Risk
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
            className="font-serif font-bold text-blue-950 leading-[1.1] tracking-tight mb-6 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl"
          >
            Understand Your Heart
            <br />
            <span className="gradient-text italic">Before It Speaks</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
            className="text-slate-500 leading-relaxed max-w-2xl mx-auto mb-10 text-base sm:text-lg"
          >
            AI-powered cardiovascular risk assessment that tells you not just your risk —
            but <em>exactly what's driving it</em>, explained in plain language.

          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 justify-center items-center"
          >
            <Link to="/register" className="btn btn-primary btn-lg w-full sm:w-auto">
              Start Free Assessment <ArrowRight size={18} />
            </Link>
            <Link to="/assess" className="btn btn-outline btn-lg w-full sm:w-auto">
              <Activity size={18} /> Try Without Account
            </Link>
          </motion.div>

          {/* Trust chips */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-10 text-xs text-slate-400"
          >
            {['No credit card required', 'HIPAA-conscious design', 'Real AI explainability'].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle size={13} className="text-green-500" /> {t}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div animate={{ y: [0,8,0] }} transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="w-5 h-8 rounded-full border-2 border-blue-200 flex justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-blue-400 animate-bounce" />
          </div>
        </motion.div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 section-muted">
        <div className="max-w-6xl mx-auto">
          <InView className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-4">
              Everything Included
            </span>
            <h2 className="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl text-blue-950 mb-4">
              Built for Real Clinical Insight
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto leading-relaxed">
              Not just a risk score — CardioXAI explains <em>why</em> using real SHAP values
              computed from your actual clinical data.
            </p>
          </InView>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <InView key={f.title} delay={i * 0.06}>
                <div className="card card-hover p-6 h-full">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.accent} flex items-center justify-center mb-4 shadow-md`}>
                    <f.icon size={20} className="text-white" />
                  </div>
                  <h3 className="font-bold text-base text-blue-950 mb-2">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </InView>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <InView className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-4">
              Simple Process
            </span>
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-blue-950 mb-4">
              Your Assessment in 4 Steps
            </h2>
            <p className="text-slate-500 max-w-md mx-auto">From data entry to a full risk report with AI explanations — under 2 minutes.</p>
          </InView>

          <div className="relative">
            <div className="hidden lg:block absolute top-10 left-[12%] right-[12%] h-px bg-gradient-to-r from-blue-100 via-blue-300 to-blue-100" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {steps.map((s, i) => (
                <InView key={s.n} delay={i * 0.08} className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-200">
                    <span className="font-bold text-2xl text-white">{s.n}</span>
                  </div>
                  <h3 className="font-bold text-base text-blue-950 mb-2">{s.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
                </InView>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── XAI SECTION ── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 section-dark overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-14 items-center">

            <InView>
              <span className="inline-block px-4 py-1.5 bg-white/10 text-blue-300 rounded-full text-xs font-semibold mb-6 border border-white/10">
                Transparent AI
              </span>
              <h2 className="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl text-white leading-tight mb-6 italic">
                Not a Black Box.
                <br />
                <span className="text-blue-300">Every Prediction</span>
                <br />
                <span className="text-blue-300">Explained.</span>
              </h2>
              <p className="text-blue-200 leading-relaxed mb-8">
                Our XAI engine computes real feature attributions using SHAP decomposition —
                showing you in plain language how each clinical factor contributes to your personal risk score.
              </p>
              <div className="space-y-3">
                {[
                  'Per-patient feature attribution, not generic averages',
                  'Clinical factors ranked by actual impact magnitude',
                  'Protective and risk-elevating factors clearly separated',
                  'No placeholder values — computed from real model weights',
                ].map(item => (
                  <div key={item} className="flex items-start gap-3 text-blue-100 text-sm">
                    <CheckCircle size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                    {item}
                  </div>
                ))}
              </div>
            </InView>

            {/* Mock SHAP visual */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="rounded-2xl p-6 bg-white/5 border border-white/10 backdrop-blur"
            >
              <p className="text-blue-300 text-xs font-semibold mb-4 uppercase tracking-wider">SHAP Feature Impact</p>
              {[
                { label: 'Thalassemia Type',    val: 0.82, pos: true  },
                { label: 'Major Vessels',       val: 0.70, pos: true  },
                { label: 'ST Segment Slope',    val: 0.62, pos: true  },
                { label: 'ST Depression',       val: 0.47, pos: true  },
                { label: 'Max Heart Rate',      val: -0.53, pos: false },
                { label: 'Exercise Angina',     val: -0.35, pos: false },
                { label: 'Age',                 val: -0.18, pos: false },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: item.pos ? -16 : 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 + 0.2 }}
                  className="flex items-center gap-3 mb-3"
                >
                  <span className="text-xs text-blue-300 w-32 text-right flex-shrink-0 truncate">{item.label}</span>
                  <div className="flex-1 flex items-center">
                    {item.pos
                      ? <div className="h-5 rounded-r bg-gradient-to-r from-red-400 to-red-500 flex items-center pl-2" style={{ width: `${Math.abs(item.val) * 100}%` }}>
                          <span className="text-[9px] text-white font-mono">+{item.val.toFixed(2)}</span>
                        </div>
                      : <div className="h-5 rounded-l bg-gradient-to-l from-green-400 to-green-500 flex items-center pr-2 ml-auto" style={{ width: `${Math.abs(item.val) * 100}%` }}>
                          <span className="text-[9px] text-white font-mono ml-auto">{item.val.toFixed(2)}</span>
                        </div>
                    }
                  </div>
                </motion.div>
              ))}
              <div className="mt-4 pt-4 border-t border-white/10 flex justify-center gap-6 text-[11px] text-blue-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Increases Risk</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" /> Protective</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 section-muted">
        <InView className="max-w-3xl mx-auto">
          <div className="card p-10 sm:p-14 text-center bg-gradient-to-br from-blue-700 to-blue-950 border-0 shadow-2xl shadow-blue-200 rounded-3xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.07)_0%,transparent_55%)]" />
            <Heart size={40} className="text-blue-300 mx-auto mb-6 fill-blue-400/30 animate-pulse-slow" />
            <h2 className="font-serif font-bold text-3xl sm:text-4xl mb-4 text-blue-950 relative z-10">
              Take Control of<br />Your Heart Health
            </h2>
            <p className="text-blue-200 leading-relaxed mb-8 max-w-md mx-auto relative z-10">
              Free. Secure. Powered by real AI. Get your first cardiovascular risk assessment in minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center relative z-10">
              <Link to="/register" className="btn btn-lg bg-white text-blue-700 hover:bg-blue-50 w-full sm:w-auto shadow-xl">
                Create Free Account <ArrowRight size={18} />
              </Link>
              <Link to="/assess" className="btn btn-lg bg-white/10 text-white border border-white/20 hover:bg-white/20 w-full sm:w-auto">
                Try Demo
              </Link>
            </div>
          </div>
        </InView>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-950 py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-700 flex items-center justify-center">
                <Heart size={15} className="text-white fill-white" />
              </div>
              <span className="font-bold text-white">CardioXAI</span>
            </Link>
            <p className="text-slate-500 text-xs text-center">
              "Dil se, Dil tak"
            </p>
            <div className="flex gap-5 text-sm text-slate-500">
              {[['/', 'Home'], ['/assess', 'Assess'], ['/about', 'About']].map(([to, label]) => (
                <Link key={to} to={to} className="hover:text-slate-300 transition-colors">{label}</Link>
              ))}
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-800 text-center text-slate-600 text-xs">
            © {new Date().getFullYear()} CardioXAI — Explainable Cardiovascular Risk Assessment
          </div>
        </div>
      </footer>
    </div>
  )
}