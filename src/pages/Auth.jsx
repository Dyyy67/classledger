import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, TrendingUp, Shield, Share2, Eye, EyeOff } from 'lucide-react';

const FEATURES = [
  { icon: TrendingUp, text: 'Track class dues, field trips, and all fund collections in one place.' },
  { icon: Shield,     text: 'Your data is secure – only you can see your classroom records.' },
  { icon: Share2,     text: 'Send instant WhatsApp receipts to parents after each payment.' },
];

export default function Auth() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'register' && fullName.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await signup(email.trim(), password, fullName.trim());
      }
      navigate('/dashboard');
    } catch (err) {
      const msg = err.code;
      if (msg === 'auth/user-not-found' || msg === 'auth/wrong-password' || msg === 'auth/invalid-credential')
        setError('Invalid email or password.');
      else if (msg === 'auth/email-already-in-use')
        setError('This email is already registered. Please log in.');
      else if (msg === 'auth/invalid-email')
        setError('Please enter a valid email address.');
      else
        setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Left Panel (desktop) ────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-center px-12 py-16 bg-[#1E3A5F] w-[45%] relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-blue-500/30 rounded-xl p-3">
              <BookOpen size={24} className="text-blue-200" />
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold">ClassLedger</h1>
              <p className="text-blue-300 text-xs tracking-widest font-medium">CLASSROOM FINANCE</p>
            </div>
          </div>

          <h2 className="text-white text-3xl font-bold leading-tight mb-3">
            Classroom finances,<br />
            <span className="text-blue-300">simplified.</span>
          </h2>
          <p className="text-white/60 text-sm mb-10 leading-relaxed max-w-sm">
            The all-in-one ledger for teachers to track class funds, log student payments,
            and share instant receipts with parents — 100% free.
          </p>

          <div className="space-y-5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="mt-0.5 bg-blue-500/20 rounded-lg p-1.5 flex-shrink-0">
                  <Icon size={15} className="text-blue-300" />
                </div>
                <p className="text-white/70 text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel: Form ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center px-5 py-10 bg-slate-50">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-8 lg:hidden">
          <div className="bg-[#1E3A5F] rounded-xl p-2">
            <BookOpen size={20} className="text-blue-300" />
          </div>
          <span className="text-[#1E3A5F] text-xl font-bold">ClassLedger</span>
        </div>

        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-1">
            {mode === 'login' ? 'Welcome back!' : 'Create your account'}
          </h2>
          <p className="text-slate-500 text-sm mb-7">
            {mode === 'login'
              ? 'Sign in to access your classroom ledger.'
              : 'Join thousands of teachers managing class funds.'}
          </p>

          {/* Tabs */}
          <div className="flex bg-slate-200 rounded-xl p-1 mb-6">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                  mode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rhandy Mendoza"
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 bg-white
                    focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 focus:border-[#1E3A5F] text-sm transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 bg-white
                  focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 focus:border-[#1E3A5F] text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
                  required
                  className="w-full px-4 py-3 pr-11 border border-slate-200 rounded-xl text-slate-800 bg-white
                    focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 focus:border-[#1E3A5F] text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#1E3A5F] hover:bg-[#264d7e] text-white rounded-xl font-semibold text-sm
                transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg mt-1"
            >
              {loading
                ? 'Please wait…'
                : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-xs mt-6">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-[#1E3A5F] font-semibold hover:underline"
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
