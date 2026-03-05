import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Shield, Activity, Heart, FileText, CheckCircle, Github, Linkedin, Mail, Users, ExternalLink, Sparkles } from 'lucide-react'
import { useState } from 'react'

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

// ✅ Team Members — all github/linkedin fields are full URLs
const teamMembers = [
  {
    name: 'Vikrant Kadam',
    role: 'Lead Developer • Lead DevOps • Lead Full Stack',
    email: 'vikrant.1252010030@vit.edu',
    github: 'https://github.com/VikrantKadam028',
    linkedin: 'https://www.linkedin.com/in/vikrantkadam028',
    image: 'https://media.licdn.com/dms/image/v2/D4D03AQHpHv_qLw8YRA/profile-displayphoto-scale_400_400/B4DZvMEFsRG8Ag-/0/1768655185486?e=1774483200&v=beta&t=1vhWR4q-Ykaok5ZJ0atCb8e1Tbe6kqrnyNu1uMiqjkA',
    avatar: 'VK',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    name: 'Kartik Pagariya',
    role: 'Lead Developer • AI/ML Engineer',
    email: 'kartik.pagariya25@vit.edu',
    github: 'https://github.com/kartikpagariya25',
    linkedin: 'https://linkedin.com/in/kartikpagariya1911',
    image: 'https://media.licdn.com/dms/image/v2/D4E03AQHfIoFibBhVIA/profile-displayphoto-scale_400_400/B4EZqwcW3eKUAg-/0/1763896816362?e=1774483200&v=beta&t=YnNS5W0gCU8alDq7uufwd8Rgi0C3UYg0MPAY2lqvljA',
    avatar: 'KP',
    color: 'from-indigo-500 to-purple-500'
  },
  {
    name: 'Aditya Dengale',
    role: 'Lead Backend Engineer • DevOps Engineer',
    email: 'aditya.1252010025@vit.edu',
    github: 'https://github.com/DevXDividends',
    linkedin: 'https://linkedin.com/in/adityadengale',
    image: 'https://media.licdn.com/dms/image/v2/D4D03AQEn0yj5zoQwHg/profile-displayphoto-scale_400_400/B4DZjHJmYJH0Ak-/0/1755687840955?e=1774483200&v=beta&t=KTzdCk0W9ZF9B-lQsciuM3RfmpnyDO0jS5E0AuJknWg',
    avatar: 'AD',
    color: 'from-emerald-500 to-teal-500'
  },
  {
    name: 'Janhavi Pagare',
    role: 'Frontend Developer • UX Designer',
    email: 'janhavi-2403@github.com',           // ✅ fixed (was swapped with github)
    github: 'https://github.com/janhvi-2403',   // ✅ fixed (was in email field)
    linkedin: 'https://www.linkedin.com/in/janhvi-pagare-1196b62b8',
    image: 'https://media.licdn.com/dms/image/v2/D5603AQGXR4XlGf5_VA/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1727168370273?e=1774483200&v=beta&t=bKga19UZNECRalIb0Klmy0yJ3vIKMiuLEzqMQ_rFD0M',
    avatar: 'JP',
    color: 'from-pink-500 to-rose-500'
  },
  {
    name: 'Pranali Yelavikar',
    role: 'Data Analyst • Researcher',
    email: 'pranali.yelavikar25@vit.edu',
    github: 'https://github.com/pranaliyelavikar14',
    linkedin: '',
    image: 'https://avatars.githubusercontent.com/u/235873957?v=4',
    avatar: 'PY',
    color: 'from-amber-500 to-orange-500'
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1]
    }
  }
}

// Image Component with Fallback
const ProfileImage = ({ member }) => {
  const [imageError, setImageError] = useState(false)

  if (!member.image || imageError) {
    return (
      <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${member.color} flex items-center justify-center`}>
        <span className="text-white font-bold text-3xl">{member.avatar}</span>
      </div>
    )
  }

  return (
    <>
      <motion.img
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        src={member.image}
        alt={member.name}
        className="w-full h-full object-cover rounded-2xl"
        onError={() => setImageError(true)}
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 border-2 border-white rounded-full shadow-lg"
      />
    </>
  )
}

// ✅ SocialButton — accepts a ready-to-use href, no more URL construction
const SocialButton = ({ href, icon: Icon, label, colorClass, hoverColorClass }) => {
  if (!href) return null

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.15, y: -2 }}
      whileTap={{ scale: 0.95 }}
      className={`p-2.5 rounded-xl ${colorClass} ${hoverColorClass} transition-all duration-300 shadow-md hover:shadow-lg`}
      title={label}
    >
      <Icon size={18} className="stroke-[2.5]" />
    </motion.a>
  )
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 pt-16 pb-20 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">

        {/* Hero Section with Animated Background */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8 }}
          className="text-center pt-12 mb-16 relative"
        >
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-10 right-1/4 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl animate-pulse delay-1000" />
          
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full text-sm font-semibold mb-6 shadow-lg"
          >
            <Sparkles size={16} />
            About CardioXAI
          </motion.div>
          
          <h1 className="font-serif font-bold text-4xl sm:text-5xl lg:text-6xl text-blue-950 mb-6 leading-tight italic">
            Transparency at the Core
          </h1>
          <p className="text-slate-600 text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed">
            CardioXAI is a cardiovascular risk assessment tool built on the belief that AI should be
            transparent, explainable, and genuinely useful — not a black box.
          </p>
        </motion.div>

        {/* Feature Cards */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid sm:grid-cols-2 gap-6 mb-16"
        >
          {cards.map((c, i) => (
            <motion.div
              key={c.title}
              variants={itemVariants}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="group relative bg-white/90 backdrop-blur-xl rounded-3xl p-7 shadow-lg hover:shadow-2xl border border-blue-100/50 transition-all duration-300"
            >
              <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${c.accent} opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none`} />
              
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${c.accent} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <c.icon size={24} className="text-white" />
              </div>
              
              <h3 className="font-bold text-xl text-blue-950 mb-3">{c.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{c.content}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Commitment Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.6, duration: 0.7 }}
          className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 rounded-3xl p-10 sm:p-12 text-center mb-16 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08)_0%,transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(59,130,246,0.15)_0%,transparent_50%)]" />
          
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              repeatDelay: 2
            }}
            className="relative mb-6"
          >
            <Heart size={48} className="text-blue-300 mx-auto fill-blue-400/20" />
          </motion.div>
          
          <h2 className="font-serif font-bold text-3xl sm:text-4xl text-white mb-4 italic relative">
            Our Commitment to Explainability
          </h2>
          <p className="text-blue-200 max-w-2xl mx-auto text-base leading-relaxed mb-10 relative">
            Every result you see is backed by mathematically grounded feature attribution.
            We believe understanding <em>why</em> is just as important as knowing <em>what</em>.
          </p>
          
          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto text-left relative">
            {principles.map((p, i) => (
              <motion.div 
                key={p}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * 0.1 }}
                className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 hover:bg-white/15 transition-colors"
              >
                <CheckCircle size={18} className="text-blue-300 flex-shrink-0 mt-0.5" />
                <span className="text-blue-100 text-sm leading-relaxed">{p}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Team Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.7 }}
          className="mb-16"
        >
          <div className="text-center mb-12">
            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.6, type: "spring" }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 mb-5 shadow-2xl"
            >
              <Users size={32} className="text-white" />
            </motion.div>
            <h2 className="font-serif font-bold text-4xl sm:text-5xl text-blue-950 mb-4 italic">
              Meet the Team
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              Built with passion by a dedicated team of developers, researchers, and healthcare enthusiasts
            </p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-10"
          >
            {teamMembers.map((member) => (
              <motion.div
                key={member.name}
                variants={itemVariants}
                whileHover={{ y: -8 }}
                className="group relative bg-white rounded-3xl p-7 shadow-xl hover:shadow-2xl border border-slate-100 transition-all duration-300 overflow-hidden"
              >
                <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${member.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none`} />
                
                {/* Profile Image */}
                <div className="relative mb-6">
                  <div className="w-32 h-32 mx-auto rounded-3xl overflow-hidden shadow-2xl ring-4 ring-slate-100 group-hover:ring-blue-200 transition-all duration-300 group-hover:scale-105">
                    <ProfileImage member={member} />
                  </div>
                  <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br ${member.color} flex items-center justify-center shadow-lg`}>
                    <Sparkles size={14} className="text-white" />
                  </div>
                </div>

                {/* Member Info */}
                <div className="text-center mb-6">
                  <h3 className="font-bold text-xl text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">
                    {member.name}
                  </h3>
                  <p className="text-slate-600 text-sm font-medium">{member.role}</p>
                  <p className="text-slate-400 text-xs mt-2 flex items-center justify-center gap-1">
                    <Mail size={12} />
                    {member.email}
                  </p>
                </div>

                {/* ✅ Social Links — all hrefs are already full URLs, passed directly */}
                <div className="flex justify-center gap-3">
                  <SocialButton
                    href={member.github || null}
                    icon={Github}
                    label={`GitHub: ${member.name}`}
                    colorClass="bg-slate-100 text-slate-700"
                    hoverColorClass="hover:bg-slate-800 hover:text-white"
                  />
                  <SocialButton
                    href={member.linkedin || null}
                    icon={Linkedin}
                    label={`LinkedIn: ${member.name}`}
                    colorClass="bg-slate-100 text-slate-700"
                    hoverColorClass="hover:bg-[#0A66C2] hover:text-white"
                  />
                  <SocialButton
                    href={member.email ? `mailto:${member.email}` : null}
                    icon={Mail}
                    label="Send Email"
                    colorClass="bg-slate-100 text-slate-700"
                    hoverColorClass="hover:bg-blue-500 hover:text-white"
                  />
                </div>

                <div className={`absolute -bottom-20 -right-20 w-40 h-40 bg-gradient-to-br ${member.color} opacity-0 group-hover:opacity-20 rounded-full blur-3xl transition-opacity duration-500 pointer-events-none`} />
              </motion.div>
            ))}
          </motion.div>

          {/* Institution Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.2 }}
            className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />
            <div className="relative">
              <p className="text-blue-100 text-sm mb-2 font-medium">Proudly developed at</p>
              <h3 className="text-white font-bold text-2xl mb-1">Vishwakarma Institute of Technology, Pune</h3>
              <div className="flex items-center justify-center gap-2 mt-3">
                <span className="px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-semibold">
                  SY-AIDS Branch
                </span>
                <span className="px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-semibold">
                  2024-2025
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Disclaimer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
          className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-200 shadow-lg"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Shield size={20} className="text-amber-700" />
            </div>
            <div>
              <p className="text-sm text-amber-900 leading-relaxed">
                <strong className="font-semibold block mb-1">Medical Disclaimer:</strong>
                CardioXAI is an educational and informational tool only. It is not a substitute for professional
                medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider about
                any medical conditions or health concerns.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Footer CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
          className="text-center mt-12 pt-10 border-t border-slate-200"
        >
          <p className="text-slate-500 text-sm mb-4">Interested in contributing or learning more?</p>
          <motion.a
            href="https://github.com/VikrantKadam028/CardioXAI"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold shadow-xl hover:shadow-2xl transition-all duration-300"
          >
            <Github size={22} />
            View on GitHub
            <ExternalLink size={18} />
          </motion.a>
        </motion.div>

      </div>
    </div>
  )
}
