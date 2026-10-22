import { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, getRedirectResult } from 'firebase/auth';
import { auth } from './firebase.js';
import { Layers, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_URL_SECONDARY || '';

export default function Auth({ onLoginSuccess, initialIsLogin = true }) {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(initialIsLogin);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    if (!auth) return;
    const handleRedirectResult = async () => {
      try {
        console.log('🔄 Checking Google Redirect Result...');
        const cred = await getRedirectResult(auth);
        
        if (cred) {
          console.log('✅ Google Auth Success:', cred.user.email);
          setGoogleLoading(true);
          const firebaseUser = cred.user;
          const idToken = await firebaseUser.getIdToken();

          const res = await fetch(`${API_BASE}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token: idToken }),
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Google login failed');

          console.log('🎉 Backend Auth Success');
          await onLoginSuccess();
          const joinCode = sessionStorage.getItem('joinWorkspaceCode');
          if (joinCode) {
            sessionStorage.removeItem('joinWorkspaceCode');
            navigate(`/join/${joinCode}`);
          } else {
            navigate('/dashboard');
          }
        } else {
          console.log('ℹ️ No redirect result found (Normal on fresh load)');
        }
      } catch (err) {
        console.error('❌ Google Redirect Error:', err.code, err.message);
        if (err.code === 'auth/unauthorized-domain') {
          setError('This domain is not authorized in Firebase Console. Please add your Amplify URL to Authorized Domains.');
        } else {
          setError(err?.message || 'Google login failed');
        }
      } finally {
        setGoogleLoading(false);
      }
    };
    handleRedirectResult();
  }, [onLoginSuccess, navigate]);

  useEffect(() => {
    document.title = isLogin ? "Login | TaskNest" : "Sign Up | TaskNest";
  }, [isLogin]);

  const handleGoogleSignIn = async () => {
    setError('');
    if (!auth) { setError('Google sign-in is not configured. Use email and password.'); return; }
    setGoogleLoading(true);
    try {
      console.log('🚀 Starting Google Popup Auth...');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      
      if (cred) {
        console.log('✅ Google Auth Success:', cred.user.email);
        const firebaseUser = cred.user;
        const idToken = await firebaseUser.getIdToken();

        const res = await fetch(`${API_BASE}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token: idToken }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Google login failed');

        console.log('🎉 Backend Auth Success');
        await onLoginSuccess();
        const joinCode = sessionStorage.getItem('joinWorkspaceCode');
        if (joinCode) {
          sessionStorage.removeItem('joinWorkspaceCode');
          navigate(`/join/${joinCode}`);
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      console.error('❌ Google Popup Error:', err.code, err.message);
      if (err.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized in Firebase Console.');
      } else {
        setError(err?.message || 'Google login failed');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (isLogin) {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: formData.email, password: formData.password }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Something went wrong');
        }
        await onLoginSuccess();
        const joinCode = sessionStorage.getItem('joinWorkspaceCode');
        if (joinCode) {
          sessionStorage.removeItem('joinWorkspaceCode');
          navigate(`/join/${joinCode}`);
        } else {
          navigate('/dashboard');
        }
      } else {
        const response = await fetch(`${API_BASE}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(formData),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Something went wrong');
        }

        setInfo(data.message || 'Account created. You can now sign in.');
        setIsLogin(true);
        navigate('/login', { replace: true });
        setFormData((previous) => ({ ...previous, password: '' }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

const DEMO_EMAIL    = 'tasknestsupport@gmail.com';
const DEMO_PASSWORD = 'task@123';

  return (
    <div className="min-h-screen w-full flex justify-center items-center bg-bg-main p-4 text-text-primary font-inter transition-colors duration-300">
      <Link to="/" className="absolute top-8 left-8 text-text-secondary hover:text-accent flex items-center gap-2 transition-all text-xs font-bold uppercase tracking-widest">
        <ArrowLeft size={14} strokeWidth={2.5} /> Home
      </Link>
      
      <div className="w-full max-w-[420px] bg-bg-card rounded-xl border border-border-subtle p-10 shadow-2xl animate-fade-up">
        <div className="mb-10 text-center">
          <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-accent/10">
            <Layers size={20} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary mb-3">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="text-text-secondary text-sm opacity-60">
            {isLogin
              ? 'Enter your details below to access your dashboard'
              : 'Join the most collaborative student community'}
          </p>
        </div>

        {error && (
          <div className="bg-red-400/5 text-red-400 px-4 py-3 rounded-xl mb-8 text-[13px] border border-red-400/10 flex items-start gap-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1 leading-relaxed">{error}</span>
          </div>
        )}

        {info && (
          <div className="bg-emerald-400/5 text-emerald-400 px-4 py-3 rounded-xl mb-8 text-[13px] border border-emerald-400/10 flex items-start gap-3">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1 leading-relaxed">{info}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading || googleLoading}
          className="w-full py-3 bg-text-primary/3 text-text-primary border border-border-subtle hover:bg-text-primary/5 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-3 mb-8 disabled:opacity-50"
        >
          {googleLoading ? (
            <RefreshCw size={16} className="animate-spin text-text-secondary" />
          ) : (
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
             </svg>
          )}
          <span>Continue with Google</span>
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="h-px bg-border-subtle flex-1" />
          <span className="text-[10px] text-text-secondary font-bold uppercase tracking-[0.2em] opacity-40">or email</span>
          <div className="h-px bg-border-subtle flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {isLogin && (
            <button
              type="button"
              id="demo-login-btn"
              onClick={() => {
                setFormData(prev => ({ ...prev, email: DEMO_EMAIL, password: DEMO_PASSWORD }));
                setError('');
              }}
              className="w-full py-2.5 border border-dashed border-accent/40 bg-accent/5 hover:bg-accent/10 text-accent rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-2 group"
            >
              <span className="text-base leading-none"></span>
              Try Demo Account
              <span className="text-[10px] font-bold bg-accent/10 px-2 py-0.5 rounded-full tracking-widest uppercase opacity-70 group-hover:opacity-100 transition-opacity">auto-fill</span>
            </button>
          )}

          {!isLogin && (
            <div>
              <label className="block mb-2 font-bold text-[10px] text-text-secondary uppercase tracking-widest opacity-60">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                required={!isLogin}
                className="w-full py-3 px-4 border border-border-subtle rounded-xl bg-bg-main text-sm text-text-primary outline-none transition-all placeholder:text-text-secondary/30 focus:border-accent/30"
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label className="block mb-2 font-bold text-[10px] text-text-secondary uppercase tracking-widest opacity-60">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full py-3 px-4 border border-border-subtle rounded-xl bg-bg-main text-sm text-text-primary outline-none transition-all placeholder:text-text-secondary/30 focus:border-accent/30"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block mb-2 font-bold text-[10px] text-text-secondary uppercase tracking-widest opacity-60">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              className="w-full py-3 px-4 border border-border-subtle rounded-xl bg-bg-main text-sm text-text-primary outline-none transition-all placeholder:text-text-secondary/30 focus:border-accent/30"
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent text-white rounded-xl text-[13px] font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-accent/10 active:scale-[0.98]"
          >
            {loading ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : isLogin ? (
               <>Sign In <ArrowRight size={16} /></>
            ) : (
               <>Create Account <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <div className="mt-10 text-center text-[13px] text-text-secondary">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-accent font-semibold ml-2 hover:text-text-primary transition-colors"
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}
