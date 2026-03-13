import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, role } = useAuth();

  // Redirect if already logged in
  if (user) {
    if (role === 'SUPER_ADMIN') return <Navigate to="/super-admin" />;
    if (role === 'CLIENT_ADMIN' || role === 'client_admin') return <Navigate to="/client-admin" />;
    if (role === 'client_agent') return <Navigate to="/agent-dashboard" />;
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.');
      } else {
        setError(err.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-50 font-sans overflow-hidden px-4 sm:px-6 lg:px-8">
      
      {/* ✨ UI UPGRADE: Pinterest-style background mesh gradient blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-emerald-200/40 to-teal-100/40 blur-3xl opacity-70 mix-blend-multiply animate-pulse-slow" />
        <div className="absolute top-[10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-200/40 to-indigo-100/40 blur-3xl opacity-70 mix-blend-multiply animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute -bottom-[20%] left-[20%] w-[70%] h-[70%] rounded-full bg-gradient-to-tr from-purple-200/30 to-pink-100/30 blur-3xl opacity-70 mix-blend-multiply animate-pulse-slow" style={{ animationDelay: '4s' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        
        {/* ✨ UI UPGRADE: Increased Logo Size and hover effect */}
        <div className="flex justify-center mb-8">
          <img 
            src="/mintage-logo.png" 
            alt="Mintage CRM" 
            className="h-20 w-auto drop-shadow-md transition-transform hover:scale-105 duration-500" 
          />
        </div>

        {/* ✨ UI UPGRADE: Frosted Glass Login Card */}
        <div className="bg-white/70 backdrop-blur-2xl py-10 px-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white/80 rounded-3xl sm:px-10">
          
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-2">
              Welcome Back
            </h2>
            <p className="text-sm font-medium text-slate-500">
              Enter your credentials to access your workspace.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleAuth}>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">
                Email address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/60 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium text-slate-800 outline-none shadow-sm placeholder:font-normal placeholder:text-slate-400"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/60 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium text-slate-800 outline-none shadow-sm placeholder:font-normal placeholder:text-slate-400"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50/80 backdrop-blur-sm border border-red-100 flex items-start gap-3 text-red-800 text-sm shadow-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            <div className="pt-2">
              {/* ✨ UI UPGRADE: Gradient Button with hover lift and colored shadow */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-emerald-400/50 rounded-xl shadow-lg shadow-emerald-500/25 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Sign in
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Subtle Footer Note */}
        <div className="text-center mt-8">
          <p className="text-xs font-medium text-slate-400">
            Powered by <span className="font-bold text-slate-500">Mintage CRM</span>
          </p>
        </div>

      </div>

      {/* Internal CSS for the slow pulse animation on the background orbs */}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.05); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}