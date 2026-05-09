import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, ArrowRight, Zap, TrendingUp, AlertCircle, LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, role } = useAuth();

  // ✨ RESTORED: Core Routing Logic based on User Roles ✨
  if (user) {
    if (role === 'SUPER_ADMIN') return <Navigate to="/super-admin" />;
    if (role === 'CLIENT_ADMIN' || role === 'client_admin') return <Navigate to="/client-admin" />;
    if (role === 'client_agent') return <Navigate to="/agent-dashboard" />;
  }

  // ✨ RESTORED: Original Firebase Auth Logic ✨
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Note: We don't need a navigate() call here because the 'if (user)' block above 
      // will instantly catch the successful login and route them perfectly!
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
    <div className="min-h-screen w-full flex bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* ✨ LEFT PANE: ENTERPRISE VALUE PROP (Midnight & Copper Theme) ✨ */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative flex-col justify-between p-16 overflow-hidden border-r border-slate-800">
        {/* Animated Background Glowing Orbs using Brand Colors */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-slate-700 rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-amber-600 rounded-full mix-blend-screen filter blur-[120px] opacity-15 animate-pulse" style={{ animationDuration: '6s' }}></div>
        <div className="absolute top-[40%] left-[30%] w-64 h-64 bg-amber-500 rounded-full mix-blend-screen filter blur-[100px] opacity-10"></div>

        {/* Logo */}
        <div className="relative z-10">
          <img src="/leadspot.png" alt="Leadspot CRM" className="h-14 brightness-0 invert opacity-90" />
        </div>

        {/* Real-time Product Copy */}
        <div className="relative z-10 space-y-8 -mt-12">
          <h1 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-[1.1]">
            The Intelligent <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">Real Estate Engine.</span>
          </h1>
          <p className="text-slate-400 text-lg font-medium max-w-md leading-relaxed">
            Automate lead capture, receive instant alerts, and close deals faster with Level 4 enterprise architecture.
          </p>

          <div className="space-y-5 pt-8">
            <div className="flex items-center gap-4 text-slate-300 font-bold text-sm tracking-wide">
              <div className="p-2 bg-white/5 rounded-xl shadow-inner border border-white/10"><Zap className="w-5 h-5 text-amber-500" /></div>
              Omnichannel Lead Capture
            </div>
            <div className="flex items-center gap-4 text-slate-300 font-bold text-sm tracking-wide">
              <div className="p-2 bg-white/5 rounded-xl shadow-inner border border-white/10"><Mail className="w-5 h-5 text-amber-500" /></div>
              Instant Lead Email Alerts
            </div>
            <div className="flex items-center gap-4 text-slate-300 font-bold text-sm tracking-wide">
              <div className="p-2 bg-white/5 rounded-xl shadow-inner border border-white/10"><TrendingUp className="w-5 h-5 text-amber-500" /></div>
              Dual-Pipeline Automated Routing
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-slate-500 text-xs font-bold tracking-widest uppercase">
          © {new Date().getFullYear()} LeadSpot Solutions
        </div>
      </div>

      {/* ✨ RIGHT PANE: LOGIN FORM ✨ */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative bg-white">
        
        {/* Subtle background element for the light side */}
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-30"></div>

        <div className="w-full max-w-md space-y-8 relative z-10">
          
          <div className="text-center lg:text-left">
            <img src="/leadspot.png" alt="Leadspot CRM" className="h-16 mx-auto lg:hidden mb-8 drop-shadow-sm" />
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Access Workspace</h2>
            <p className="text-slate-500 font-medium mt-2">Sign in to your secure CRM dashboard.</p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm font-bold text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-6 mt-8">
            
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="block w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition-all shadow-sm" 
                  placeholder="admin@example.com" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest ml-1">Password</label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input 
                  type="password" 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="block w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition-all shadow-sm" 
                  placeholder="••••••••" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-2xl shadow-lg shadow-slate-900/10 text-sm font-extrabold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-slate-900/20 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none mt-4"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-500 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign In <ArrowRight className="ml-2 w-4 h-4 text-amber-500" /></>
              )}
            </button>
          </form>
          
        </div>
      </div>
    </div>
  );
}