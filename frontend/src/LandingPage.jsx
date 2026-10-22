import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  ChevronRight, 
  FileText, 
  LayoutDashboard, 
  Menu, 
  X, 
  Layers, 
  Shield, 
  Rocket, 
  Users, 
  Star,
  PlayCircle,
  Moon,
  Sun,
  Zap,
  Check,
  Grid
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { useTheme } from './context/ThemeContext.jsx';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  useEffect(() => {
    document.title = "TaskNest – Master Your Productivity";
  }, []);

  const handleWaitlistSubmit = async (e) => {
    e.preventDefault();
    if (!waitlistEmail) return;
    setWaitlistLoading(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail })
      });
      if (res.ok) {
        setWaitlistSuccess(true);
        setWaitlistEmail('');
        setTimeout(() => {
          setShowWaitlistModal(false);
          setWaitlistSuccess(false);
        }, 2500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWaitlistLoading(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 selection:bg-zinc-200 dark:selection:bg-zinc-800 font-sans transition-colors duration-300">
      
      {/* 1. NAVBAR */}
      <nav className={`fixed w-full top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="bg-zinc-900 dark:bg-white p-1.5 rounded-lg flex items-center justify-center transition-colors">
              <Layers size={18} className="text-white dark:text-zinc-950" />
            </div>
            <span className="text-lg font-bold tracking-tight dark:text-white group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">TaskNest</span>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">How it Works</a>
            <a href="#pricing" className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">Pricing</a>
          </div>

          {/* Auth Links */}
          <div className="hidden md:flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="w-[1px] h-4 bg-zinc-200 dark:bg-zinc-800 mx-2"></div>
            {user ? (
              <Link to="/dashboard" className="text-sm font-medium px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-lg hover:opacity-90 transition-all shadow-sm">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Log in
                </Link>
                <Link to="/signup" className="text-sm font-medium px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-lg hover:opacity-90 transition-all shadow-sm flex items-center gap-2">
                  Sign up <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden p-2 text-zinc-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-white dark:bg-zinc-950 pt-20 px-6 animate-fade-in">
          <div className="flex flex-col gap-6 text-lg">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="font-medium border-b border-zinc-100 dark:border-zinc-800 pb-4 dark:text-white">Features</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="font-medium border-b border-zinc-100 dark:border-zinc-800 pb-4 dark:text-white">How it Works</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="font-medium border-b border-zinc-100 dark:border-zinc-800 pb-4 dark:text-white">Pricing</a>
            <div className="flex items-center justify-between pt-2">
               <span className="font-medium dark:text-white">Theme</span>
               <button onClick={toggleTheme} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                 {theme === 'dark' ? <Sun size={20} className="text-white" /> : <Moon size={20} className="text-zinc-900" />}
               </button>
            </div>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="font-medium text-zinc-600 dark:text-zinc-400 pb-2">Log in</Link>
            <Link to="/signup" onClick={() => setMobileMenuOpen(false)} className="font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 py-3 rounded-xl text-center">Sign up</Link>
          </div>
        </div>
      )}

      <main className="pt-24 md:pt-32 pb-20">
        {/* 2. HERO SECTION */}
        <section className="px-6 max-w-6xl mx-auto text-center mb-24">
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-zinc-900 dark:text-white mb-6 leading-[1.05] transition-colors">
            TaskNest – Smart <br className="hidden md:block" />
            <span className="text-zinc-400 dark:text-zinc-600">Task Management.</span>
          </h1>
          
          <h2 className="text-lg md:text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Organize tasks and collaborate efficiently with absolute clarity. TaskNest is the sophisticated workspace where ideas turn into achievements.
          </h2>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-20">
            {user ? (
               <Link to="/dashboard" className="w-full sm:w-auto px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium rounded-xl hover:opacity-90 transition-all shadow-lg shadow-zinc-200 dark:shadow-none flex items-center justify-center gap-2">
                 Go to Dashboard <ArrowRight size={18} />
               </Link>
            ) : (
              <Link to="/signup" className="w-full sm:w-auto px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium rounded-xl hover:opacity-90 transition-all shadow-lg shadow-zinc-200 dark:shadow-none flex items-center justify-center gap-2">
                Get Started <ArrowRight size={18} />
              </Link>
            )}
          </div>

        </section>

        <section id="features" className="max-w-6xl mx-auto px-6 mb-32">
          <div className="mb-16 md:text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4 transition-colors">
              Everything you need. Nothing you don't.
            </h2>
            <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto transition-colors">
              A carefully curated set of tools designed around modern productivity workflows.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <FileText size={20} />,
                title: 'Clean Tasks',
                desc: 'Create detailed task requests with rich text, strict deadlines, and clear requirements without the clutter.'
              },
              {
                icon: <Users size={20} />,
                title: 'Seamless Collaboration',
                desc: 'Find peers instantly. Accept workflows, share context, and update progress in real-time.'
              },
              {
                icon: <LayoutDashboard size={20} />,
                title: 'Centralized Dashboard',
                desc: 'Track every task from a single, unified view. Know exactly what needs attention and when.'
              }
            ].map((feat, i) => (
              <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 hover:shadow-lg dark:hover:shadow-none hover:-translate-y-1 transition-all duration-300 group">
                <div className="h-12 w-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-400 mb-6 group-hover:bg-zinc-900 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-zinc-950 transition-colors">
                  {feat.icon}
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2 transition-colors">{feat.title}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed text-sm transition-colors">{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>



        <section id="how-it-works" className="max-w-5xl mx-auto px-6 mb-32">
          <div className="bg-zinc-900 dark:bg-zinc-900/50 dark:border dark:border-zinc-800 rounded-[32px] text-zinc-50 p-10 md:p-16 relative overflow-hidden transition-colors">

            
            <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
                  Simple, linear <br /> workflow.
                </h2>
                <p className="text-zinc-400 text-lg mb-8 max-w-md">
                  Stop juggling emails and messy group chats. Move from task creation to completion in three clear steps.
                </p>
              </div>
              
              <div className="space-y-8">
                {[
                  { step: '01', title: 'Create a Request', desc: 'Detail what you need done and set a deadline.' },
                  { step: '02', title: 'Find a Match', desc: 'Collaborators review and accept your tasks seamlessly.' },
                  { step: '03', title: 'Track to Done', desc: 'Monitor progress visually on your dashboard.' }
                ].map((item, i) => (
                  <div key={i} className="flex gap-5">
                    <div className="font-mono text-sm font-semibold text-zinc-500 mt-1">{item.step}</div>
                    <div>
                      <h4 className="text-lg font-bold text-white mb-1">{item.title}</h4>
                      <p className="text-zinc-400 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 mb-32 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-12 transition-colors">Built for high-performing teams.</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {[
              {
                quote: "Finally, a platform that doesn't feel like a clunky enterprise tool from 2005. It's fast, minimal, and gets out of my way.",
                author: "Alex Rivera",
                role: "Senior Product Designer"
              },
              {
                quote: "I use this to manage all collaborative engineering tasks. The interface just makes sense. Very Stripe-esque.",
                author: "Sarah Chen",
                role: "Software Engineer"
              },
              {
                quote: "Instead of chasing 5 different people for updates and deliverables, I just track it here. The unified view is a lifesaver.",
                author: "Michael T.",
                role: "Task Manager"
              }
            ].map((t, i) => (
               <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm transition-colors">
                 <div className="flex gap-1 text-zinc-900 dark:text-white mb-4">
                   {[1,2,3,4,5].map(s => <Star key={s} size={16} fill="currentColor" />)}
                 </div>
                 <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm leading-relaxed transition-colors">"{t.quote}"</p>
                 <div>
                   <div className="font-semibold text-zinc-900 dark:text-white text-sm transition-colors">{t.author}</div>
                   <div className="text-zinc-500 dark:text-zinc-500 text-xs transition-colors">{t.role}</div>
                 </div>
               </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="max-w-4xl mx-auto px-6 py-24 mb-16">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4 transition-colors">
              Scale from personal tasks <br className="hidden md:block" /> to team workflows
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto transition-colors">Start for free. Upgrade when you need more power.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 items-start">
             <div className="bg-white dark:bg-zinc-900 border text-center md:text-left border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 hover:shadow-lg transition-all duration-300">
               <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 transition-colors">Basic</h3>
               <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 transition-colors">Perfect for individuals.</p>
               <div className="mb-6 transition-colors">
                 <span className="text-4xl font-bold text-zinc-900 dark:text-white">$0</span>
                 <span className="text-zinc-500 dark:text-zinc-400">/ forever</span>
               </div>
               <Link to="/signup" className="block w-full py-3 px-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-center font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 dark:text-white transition-all duration-300 shadow-sm mb-8">
                 Get Started
               </Link>
               <ul className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400 text-left transition-colors">
                 <li className="flex items-center gap-3"><CheckCircle2 size={14} className="text-zinc-400 dark:text-zinc-600" /> Up to 5 active tasks</li>
                 <li className="flex items-center gap-3"><CheckCircle2 size={14} className="text-zinc-400 dark:text-zinc-600" /> Basic workflow tracking</li>
                 <li className="flex items-center gap-3"><CheckCircle2 size={14} className="text-zinc-400 dark:text-zinc-600" /> Community support</li>
               </ul>
             </div>

             <div className="bg-zinc-50/50 dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 text-center md:text-left rounded-3xl p-8 relative shadow-2xl shadow-zinc-200/60 dark:shadow-none transform md:-translate-y-4 hover:scale-[1.02] transition-all duration-300">
               <div className="absolute -top-3 right-8 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-[9px] font-black px-3 py-1 rounded-full tracking-widest uppercase">
                 COMING SOON
               </div>
               <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 transition-colors">Pro</h3>
               <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 transition-colors">For teams and advanced workflows</p>
               <div className="mb-6 transition-colors">
                 <span className="text-4xl font-bold text-zinc-900 dark:text-white">$12</span>
                 <span className="text-zinc-500 dark:text-zinc-400">/ month</span>
               </div>
               <div className="space-y-3 mb-8">
                 <button onClick={() => setShowWaitlistModal(true)} className="block w-full py-3 px-4 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-xl text-center font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all duration-300 shadow-sm cursor-pointer">
                   Join Waitlist
                 </button>
                 <p className="text-[10px] text-center text-zinc-400 font-medium tracking-tight">
                   Launching soon
                 </p>
               </div>
               <ul className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400 text-left transition-colors">
                 <li className="flex items-center gap-3"><CheckCircle2 size={14} className="text-zinc-900 dark:text-white" /> Unlimited tasks</li>
                 <li className="flex items-center gap-3"><CheckCircle2 size={14} className="text-zinc-900 dark:text-white" /> AI prioritization</li>
                 <li className="flex items-center gap-3"><CheckCircle2 size={14} className="text-zinc-900 dark:text-white" /> GitHub sync</li>
                 <li className="flex items-center gap-3"><CheckCircle2 size={14} className="text-zinc-900 dark:text-white" /> Sprint analytics</li>
                 <li className="flex items-center gap-3"><CheckCircle2 size={14} className="text-zinc-900 dark:text-white" /> Team collaboration</li>
                 <li className="flex items-center gap-3"><CheckCircle2 size={14} className="text-zinc-900 dark:text-white" /> Workload balancing</li>
               </ul>
             </div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 mt-24 mb-10">
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-12 md:p-20 text-center relative overflow-hidden transition-colors">
             <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white mb-6 relative z-10 transition-colors">
               Start managing your tasks <span className="text-zinc-400 dark:text-zinc-600">smarter.</span>
             </h2>
             <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto mb-10 relative z-10 transition-colors">
               Join thousands of users who have already upgraded their productivity workflow. Get started in less than 30 seconds.
             </p>
             <Link to="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium rounded-xl hover:bg-black/90 dark:hover:opacity-90 transition-all shadow-lg hover:-translate-y-1 relative z-10">
                Create Free Account <ArrowRight size={18} />
             </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 pt-16 pb-8 transition-colors">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-12 border-b border-zinc-200 dark:border-zinc-800 pb-12 transition-colors">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                 <Layers size={18} className="text-zinc-900 dark:text-white" />
                 <span className="font-bold tracking-tight dark:text-white">TaskNest</span>
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-sm transition-colors">
                A modern platform to streamline collaboration, task tracking, and productivity.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-zinc-900 dark:text-white mb-4 text-sm transition-colors">Product</h4>
              <ul className="space-y-3 text-sm text-zinc-500 dark:text-zinc-400 transition-colors">
                <li><a href="#features" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-zinc-900 dark:text-white mb-4 text-sm transition-colors">Company</h4>
              <ul className="space-y-3 text-sm text-zinc-500 dark:text-zinc-400 transition-colors">
                <li><a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center text-xs text-zinc-400 dark:text-zinc-500 transition-colors">
            <p>© 2026 TaskNest Inc. All rights reserved.</p>
            <div className="flex gap-4 mt-4 md:mt-0">
               <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Twitter</a>
               <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">GitHub</a>
               <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">LinkedIn</a>
            </div>
          </div>
        </div>
      </footer>

      {showWaitlistModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-950/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 md:p-12 max-w-md w-full shadow-2xl relative animate-scale-in">
            <button 
              onClick={() => setShowWaitlistModal(false)}
              className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            
            {waitlistSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">You're on the list!</h3>
                <p className="text-zinc-500 dark:text-zinc-400">We'll notify you as soon as Pro is ready for launch.</p>
              </div>
            ) : (
              <>
                <div className="mb-8 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-4">
                    Pro Access
                  </div>
                  <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Join the Waitlist</h3>
                  <p className="text-zinc-500 dark:text-zinc-400">Get early access and launch-day discounts for TaskNest Pro.</p>
                </div>
                
                <form onSubmit={handleWaitlistSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Email Address</label>
                    <input 
                      type="email"
                      required
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-sm focus:border-zinc-900 dark:focus:border-white outline-none transition-all dark:text-white"
                    />
                  </div>
                  <button 
                    disabled={waitlistLoading}
                    className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-zinc-200 dark:shadow-none"
                  >
                    {waitlistLoading ? "Joining..." : "Reserve My Spot"}
                    {!waitlistLoading && <ArrowRight size={18} />}
                  </button>
                  <p className="text-[10px] text-center text-zinc-400">No spam. Just product updates and launch info.</p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
