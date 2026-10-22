import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Building2, Users, Rocket, Target, ChevronLeft, Loader, Plus } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';

const CATEGORIES = [
  { id: 'startup', label: 'Startup', icon: <Rocket size={20} />, desc: 'For early-stage companies and founders' },
  { id: 'hackathon', label: 'Hackathon', icon: <Target size={20} />, desc: 'Fast-paced project development' },
  { id: 'college_project', label: 'College Project', icon: <Users size={20} />, desc: 'Academic group projects' },
  { id: 'organization', label: 'Organization', icon: <Building2 size={20} />, desc: 'Established clubs or companies' },
  { id: 'team', label: 'General Team', icon: <Briefcase size={20} />, desc: 'Any other collaborative group' },
];

export default function CreateWorkspace() {
  const navigate = useNavigate();
  const { createWorkspace, selectWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'team'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      setError('Workspace name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await createWorkspace(formData);
      selectWorkspace(parseInt(res.id, 10));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 animate-fade-in">
      <button 
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-8 transition-colors text-sm font-semibold"
      >
        <ChevronLeft size={16} /> Back to Dashboard
      </button>

      <div className="bg-bg-card border border-border-subtle rounded-2xl p-8 shadow-premium relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-accent to-purple-500" />
        
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight mb-2">Create Team Workspace</h1>
          <p className="text-text-secondary">Set up a dedicated space for your team to collaborate on projects.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-text-primary block">Workspace Name</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Acme Corp, HackNY Team"
              className="w-full bg-bg-subtle border border-border-subtle rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-text-primary block">Description (Optional)</label>
            <textarea 
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="What is this workspace for?"
              className="w-full bg-bg-subtle border border-border-subtle rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all min-h-[100px] resize-none"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-text-primary block">Workspace Type</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CATEGORIES.map(cat => (
                <div 
                  key={cat.id}
                  onClick={() => setFormData({...formData, category: cat.id})}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    formData.category === cat.id 
                      ? 'bg-accent/10 border-accent text-accent' 
                      : 'bg-bg-subtle border-border-subtle text-text-secondary hover:border-text-secondary/30 hover:bg-bg-sidebar'
                  }`}
                >
                  <div className={`mt-0.5 ${formData.category === cat.id ? 'text-accent' : 'text-text-muted'}`}>
                    {cat.icon}
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${formData.category === cat.id ? 'text-text-primary' : ''}`}>{cat.label}</h3>
                    <p className="text-xs opacity-80 mt-0.5">{cat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-border-subtle flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-text-secondary hover:bg-bg-subtle border border-transparent transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading || !formData.name}
              className="px-6 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
              Create Workspace
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
