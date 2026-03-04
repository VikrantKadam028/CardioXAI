import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import {
  Heart, Activity, FileText, User, LogOut, Plus,
  TrendingUp, Download, Eye, Calendar, ChevronRight,
  AlertTriangle, CheckCircle, BarChart3, Edit3, Save, X,
  Phone, Droplets, Loader
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function RiskBadge({ level }) {
  return <span className={`badge badge-${level}`}>{level}</span>
}

function StatCard({ icon: Icon, label, value, color }) {
  const gradients = {
    blue:  'from-blue-500 to-blue-700',
    red:   'from-red-400 to-rose-600',
    green: 'from-emerald-400 to-green-600',
    amber: 'from-amber-400 to-orange-500',
  }
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradients[color]} flex items-center justify-center shadow-sm`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="font-bold text-xl text-blue-950">{value}</p>
        <p className="text-sm text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [tab,          setTab]          = useState('overview')
  const [reports,      setReports]      = useState([])
  const [stats,        setStats]        = useState(null)
  const [reportsLoading, setReportsLoading] = useState(true)
  const [editMode,     setEditMode]     = useState(false)
  const [profileForm,  setProfileForm]  = useState({})
  const [saving,       setSaving]       = useState(false)
  const [pdfLoading,   setPdfLoading]   = useState(null) // report _id
  const { user, logout, updateUser }    = useAuth()
  const navigate                        = useNavigate()

  useEffect(() => {
    if (user) setProfileForm({
      firstName: user.firstName || '', lastName: user.lastName || '',
      phone: user.phone || '', bloodGroup: user.bloodGroup || '',
      gender: user.gender || '', dateOfBirth: user.dateOfBirth || '',
      medicalHistory: user.medicalHistory || '',
    })
  }, [user])

  useEffect(() => { fetchReports(); fetchStats() }, [])

  const fetchReports = async () => {
    setReportsLoading(true)
    try { const r = await axios.get(`${API}/api/user/reports`); setReports(r.data.reports) } catch {}
    setReportsLoading(false)
  }

  const fetchStats = async () => {
    try { const r = await axios.get(`${API}/api/user/stats`); setStats(r.data) } catch {}
  }

  const handleDownloadPdf = async (report) => {
    setPdfLoading(report._id)
    try {
      const res = await axios.post(`${API}/api/report/pdf`, {
        ...report.inputData,
        patientInfo: { name: `${user.firstName} ${user.lastName}` }
      }, { timeout: 30000 })
      const raw = atob(res.data.pdf)
      const bytes = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a'); a.href = url; a.download = res.data.filename || 'report.pdf'
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch {}
    setPdfLoading(null)
  }

  const saveProfile = async () => {
    setSaving(true)
    try { await axios.put(`${API}/api/auth/update`, profileForm); updateUser(profileForm); setEditMode(false) } catch {}
    setSaving(false)
  }

  const navItems = [
    { id: 'overview', label: 'Overview',   icon: BarChart3 },
    { id: 'reports',  label: 'My Reports', icon: FileText },
    { id: 'profile',  label: 'Profile',    icon: User },
  ]

  const trendData = stats?.trend?.map(t => ({ date: t.date, risk: Math.round(t.probability * 100) })) || []

  return (
    <div className="min-h-screen bg-slate-50 flex pt-0">

      {/* ── Sidebar (desktop only) ── */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-slate-100 fixed top-0 bottom-0 left-0 z-30">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-md shadow-blue-100">
              <Heart size={15} className="text-white fill-white" />
            </div>
            <span className="font-bold text-blue-950 text-sm tracking-tight">CardioXAI</span>
          </Link>
        </div>

        {/* User chip */}
        <div className="px-4 pt-4">
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="overflow-hidden">
              <p className="font-semibold text-xs text-blue-950 truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-[11px] text-blue-400 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === item.id ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <item.icon size={16} /> {item.label}
            </button>
          ))}
          <div className="pt-3 border-t border-slate-100 mt-2">
            <Link to="/assess" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
              <Plus size={16} /> New Assessment
            </Link>
          </div>
        </nav>

        <div className="px-4 py-4 border-t border-slate-100">
          <button onClick={() => { logout(); navigate('/') }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 lg:ml-60 flex flex-col min-h-screen">

        {/* Mobile top bar */}
        <div className="lg:hidden bg-white border-b border-slate-100 px-4 h-14 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
              <Heart size={13} className="text-white fill-white" />
            </div>
            <span className="font-bold text-sm text-blue-950">Dashboard</span>
          </div>
          <div className="flex items-center gap-1">
            {navItems.map(item => (
              <button key={item.id} onClick={() => setTab(item.id)}
                className={`p-2 rounded-lg transition-colors ${tab === item.id ? 'bg-blue-100 text-blue-700' : 'text-slate-400 hover:text-slate-700'}`}>
                <item.icon size={16} />
              </button>
            ))}
            <button onClick={() => { logout(); navigate('/') }} className="p-2 rounded-lg text-red-400 hover:bg-red-50">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl w-full">
          <AnimatePresence mode="wait">

            {/* ── OVERVIEW ── */}
            {tab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                <div className="mb-6">
                  <h1 className="font-bold text-xl sm:text-2xl text-blue-950">Good day, {user?.firstName}! 👋</h1>
                  <p className="text-slate-500 text-sm mt-1">Here's your cardiovascular health overview.</p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                  <StatCard icon={FileText}      label="Total Assessments" value={stats?.total    || 0}                        color="blue"  />
                  <StatCard icon={Activity}      label="Avg Risk Score"    value={stats?.avgRisk  ? `${stats.avgRisk}%` : '—'} color="blue"  />
                  <StatCard icon={AlertTriangle} label="High Risk"         value={stats?.highRisk || 0}                        color="red"   />
                  <StatCard icon={CheckCircle}   label="Low Risk"          value={stats?.lowRisk  || 0}                        color="green" />
                </div>

                {trendData.length > 1 && (
                  <div className="card p-5 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-bold text-blue-950">Risk Score Trend</h2>
                      <span className="text-xs text-slate-400">Last {trendData.length} assessments</span>
                    </div>
                    <ResponsiveContainer width="100%" height={170}>
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Poppins' }} />
                        <YAxis domain={[0,100]} tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Poppins' }} tickFormatter={v => `${v}%`} />
                        <Tooltip formatter={v => [`${v}%`, 'Risk']} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontFamily: 'Poppins', fontSize: 12 }} />
                        <Area type="monotone" dataKey="risk" stroke="#2563eb" strokeWidth={2.5} fill="url(#rg)" dot={{ fill: '#2563eb', r: 4 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Recent reports */}
                <div className="card overflow-hidden mb-6">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-bold text-blue-950">Recent Assessments</h2>
                    <button onClick={() => setTab('reports')} className="text-xs text-blue-600 font-semibold hover:text-blue-800 flex items-center gap-1">
                      View All <ChevronRight size={13} />
                    </button>
                  </div>
                  {reportsLoading ? (
                    <div className="flex justify-center py-10"><div className="spinner" /></div>
                  ) : reports.length === 0 ? (
                    <div className="text-center py-12">
                      <Heart size={32} className="text-blue-200 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm mb-4">No assessments yet.</p>
                      <Link to="/assess" className="btn btn-primary btn-sm"><Plus size={14} /> Start Assessment</Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {reports.slice(0, 5).map(r => (
                        <div key={r._id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 hover:bg-slate-50 transition-colors">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            r.riskLevel === 'high' ? 'bg-red-100' : r.riskLevel === 'moderate' ? 'bg-amber-100' : 'bg-green-100'
                          }`}>
                            <Heart size={16} className={r.riskLevel === 'high' ? 'text-red-500' : r.riskLevel === 'moderate' ? 'text-amber-500' : 'text-green-500'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-blue-950">{Math.round(r.probability * 100)}% Risk</span>
                              <RiskBadge level={r.riskLevel} />
                            </div>
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Calendar size={10} />
                              {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Link to={`/dashboard/reports/${r._id}`} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View">
                              <Eye size={15} />
                            </Link>
                            <button onClick={() => handleDownloadPdf(r)} disabled={pdfLoading === r._id}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Download PDF">
                              {pdfLoading === r._id ? <Loader size={15} className="animate-spin" /> : <Download size={15} />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* CTA */}
                <div className="p-5 bg-gradient-to-r from-blue-700 to-blue-900 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-white">Ready for a new assessment?</p>
                    <p className="text-blue-200 text-sm mt-0.5">Get your latest risk score with full AI explanations</p>
                  </div>
                  <Link to="/assess" className="btn bg-white text-blue-700 hover:bg-blue-50 flex-shrink-0">
                    Assess Now <ChevronRight size={15} />
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ── REPORTS ── */}
            {tab === 'reports' && (
              <motion.div key="reports" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="font-bold text-xl sm:text-2xl text-blue-950">My Reports</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Complete history of all your assessments</p>
                  </div>
                  <Link to="/assess" className="btn btn-primary btn-sm"><Plus size={14} /> New</Link>
                </div>

                <div className="card overflow-hidden">
                  {reportsLoading ? (
                    <div className="flex justify-center py-16"><div className="spinner" /></div>
                  ) : reports.length === 0 ? (
                    <div className="text-center py-16">
                      <FileText size={36} className="text-blue-200 mx-auto mb-4" />
                      <p className="font-semibold text-blue-900 mb-1">No reports yet</p>
                      <p className="text-slate-400 text-sm mb-5">Complete your first assessment to see reports here</p>
                      <Link to="/assess" className="btn btn-primary btn-sm"><Plus size={14} /> Start Assessment</Link>
                    </div>
                  ) : (
                    <>
                      <div className="hidden md:grid grid-cols-[1fr_110px_90px_80px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <span>Assessment</span><span>Score</span><span>Level</span><span className="text-right">Actions</span>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {reports.map((r, i) => (
                          <motion.div key={r._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                            className="grid md:grid-cols-[1fr_110px_90px_80px] gap-3 items-center px-4 sm:px-5 py-4 hover:bg-slate-50 transition-colors">
                            <div>
                              <p className="font-semibold text-sm text-blue-950">Assessment #{reports.length - i}</p>
                              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <Calendar size={10} />
                                {new Date(r.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                              {r.patientNote && <p className="text-xs text-slate-400 italic mt-1">"{r.patientNote}"</p>}
                            </div>
                            <p className="font-bold text-lg text-blue-950">{Math.round(r.probability * 100)}%</p>
                            <div><RiskBadge level={r.riskLevel} /></div>
                            <div className="flex items-center gap-1 md:justify-end">
                              <Link to={`/dashboard/reports/${r._id}`} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Eye size={15} /></Link>
                              <button onClick={() => handleDownloadPdf(r)} disabled={pdfLoading === r._id}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                {pdfLoading === r._id ? <Loader size={15} className="animate-spin" /> : <Download size={15} />}
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── PROFILE ── */}
            {tab === 'profile' && (
              <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="font-bold text-xl sm:text-2xl text-blue-950">Profile</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Manage your personal information</p>
                  </div>
                  {!editMode
                    ? <button onClick={() => setEditMode(true)} className="btn btn-outline btn-sm"><Edit3 size={14} /> Edit</button>
                    : <div className="flex gap-2">
                        <button onClick={() => setEditMode(false)} className="btn btn-ghost btn-sm"><X size={14} /> Cancel</button>
                        <button onClick={saveProfile} disabled={saving} className="btn btn-primary btn-sm">
                          {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} Save
                        </button>
                      </div>
                  }
                </div>

                {/* Avatar banner */}
                <div className="p-6 bg-gradient-to-r from-blue-700 to-blue-900 rounded-2xl flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-lg text-white truncate">{user?.firstName} {user?.lastName}</p>
                    <p className="text-blue-200 text-sm truncate">{user?.email}</p>
                    <div className="flex gap-3 mt-1.5">
                      {user?.bloodGroup && <span className="flex items-center gap-1 text-xs text-blue-200"><Droplets size={11} /> {user.bloodGroup}</span>}
                      {user?.phone      && <span className="flex items-center gap-1 text-xs text-blue-200"><Phone size={11} /> {user.phone}</span>}
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  {/* Personal */}
                  <div className="card p-5">
                    <h3 className="font-semibold text-xs text-slate-500 uppercase tracking-wider mb-4">Personal Information</h3>
                    <div className="space-y-4">
                      {[
                        { label: 'First Name', key: 'firstName', type: 'text' },
                        { label: 'Last Name',  key: 'lastName',  type: 'text' },
                        { label: 'Phone',      key: 'phone',     type: 'tel'  },
                        { label: 'Date of Birth', key: 'dateOfBirth', type: 'date' },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="block text-xs font-semibold text-blue-700 mb-1.5">{f.label}</label>
                          {editMode
                            ? <input type={f.type} value={profileForm[f.key] || ''} onChange={e => setProfileForm(p => ({ ...p, [f.key]: e.target.value }))} className="field" />
                            : <p className="text-sm text-slate-700 py-1.5">{user?.[f.key] || <span className="text-slate-300">Not set</span>}</p>
                          }
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Medical */}
                  <div className="card p-5">
                    <h3 className="font-semibold text-xs text-slate-500 uppercase tracking-wider mb-4">Medical Information</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-blue-700 mb-1.5">Gender</label>
                        {editMode
                          ? <select value={profileForm.gender || ''} onChange={e => setProfileForm(p => ({ ...p, gender: e.target.value }))} className="field">
                              <option value="">Not specified</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="other">Other</option>
                            </select>
                          : <p className="text-sm text-slate-700 py-1.5 capitalize">{user?.gender || <span className="text-slate-300">Not set</span>}</p>
                        }
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-blue-700 mb-1.5">Blood Group</label>
                        {editMode
                          ? <select value={profileForm.bloodGroup || ''} onChange={e => setProfileForm(p => ({ ...p, bloodGroup: e.target.value }))} className="field">
                              <option value="">Unknown</option>
                              {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          : <p className="text-sm text-slate-700 py-1.5">{user?.bloodGroup || <span className="text-slate-300">Not set</span>}</p>
                        }
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-blue-700 mb-1.5">Medical History</label>
                        {editMode
                          ? <textarea value={profileForm.medicalHistory || ''} onChange={e => setProfileForm(p => ({ ...p, medicalHistory: e.target.value }))} rows={4} className="field resize-none" />
                          : <p className="text-sm text-slate-700 py-1.5 leading-relaxed">{user?.medicalHistory || <span className="text-slate-300">None recorded</span>}</p>
                        }
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card p-5 mt-5">
                  <h3 className="font-semibold text-xs text-slate-500 uppercase tracking-wider mb-4">Account Summary</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { v: user?.reportCount || 0,                         l: 'Total Reports' },
                      { v: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—', l: 'Member Since' },
                      { v: reports.filter(r => r.riskLevel === 'low').length, l: 'Low Risk Reports' },
                    ].map(item => (
                      <div key={item.l} className="text-center p-3 bg-blue-50 rounded-xl">
                        <p className="font-bold text-xl text-blue-700">{item.v}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}