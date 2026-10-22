import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useParams, useNavigate, Link, NavLink, useLocation } from 'react-router-dom';
import Avatar from './components/Avatar.jsx';
import Sidebar from './components/Sidebar.jsx';
import api from './api/axios.js'; // Use the configured axios instance
import Header from './components/Header.jsx';
import { useTheme } from './context/ThemeContext.jsx';
import { TaskDetailSkeleton } from './components/Skeleton.jsx';
import {
  ArrowLeft, Clock, CheckCircle2, AlertCircle,
  Briefcase, User, RefreshCw, FileText,
  UserPlus, Edit3, Check, ChevronRight,
  LayoutDashboard, Users, CheckSquare, GitMerge,
  LogOut, Menu, X, Code, ExternalLink, Link2, Lock,
  Plus, Send, Trash2, Activity, Layers, TrendingUp, Zap
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_URL_SECONDARY || '';


const STEPS = [
  { id: 'accepted',    label: 'Accepted' },
  { id: 'in_progress', label: 'Developing' },
  { id: 'submitted',   label: 'In Review' },
  { id: 'completed',   label: 'Done' },
];



const DATE_FMT = { month: 'short', day: 'numeric', year: 'numeric' };


const TimelineStep = memo(function TimelineStep({ step, isCompleted, isActive }) {
  return (
    <div className="relative flex flex-col items-center flex-1 z-10 w-full group cursor-default">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center mb-4 transition-all duration-300 border-2 shadow-sm
          ${isCompleted
            ? 'bg-accent border-accent text-white scale-110'
            : isActive
              ? 'bg-bg-main border-accent'
              : 'bg-bg-main border-border-subtle group-hover:border-text-primary/20'
          }`}
      >
        {isCompleted ? (
          <Check size={12} strokeWidth={4} />
        ) : (
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-accent' : 'bg-transparent'}`} />
        )}
      </div>
      <span
        className={`text-[10px] tracking-widest text-center whitespace-normal sm:whitespace-nowrap uppercase font-bold transition-colors duration-300
          ${isCompleted || isActive ? 'text-text-primary' : 'text-text-secondary opacity-40'}`}
      >
        {step.label}
      </span>
    </div>
  );
});


const CTAStrip = memo(function CTAStrip({ 
  status, 
  isCreator, 
  isAssignee, 
  updateLoading, 
  onAccept, 
  onAction, 
  onLeave, 
  hasMilestones, 
  slotsFilled, 
  capacity,
  isWorkspaceTask 
}) {
  if (status === 'pending') {
    return (
      <div className="bg-accent/5 border border-accent/20 rounded-2xl p-6 flex flex-col gap-5 w-full shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex flex-col gap-1">
          <div className="text-[15px] text-text-primary font-bold">Open for Proposals</div>
          <div className="text-[13px] text-text-secondary font-medium">This task is waiting to be accepted.</div>
        </div>
        {!isCreator && !isAssignee && !isWorkspaceTask && (
          <button
            onClick={onAccept}
            disabled={updateLoading}
            className="inline-flex items-center justify-center gap-2 w-full py-3 bg-accent text-white rounded-xl text-[14px] font-bold hover:opacity-90 transition-all active:scale-[0.98] shadow-lg shadow-accent/10"
          >
            {updateLoading ? <RefreshCw size={16} className="animate-spin" /> : <ChevronRight size={16} />}
            Accept Task
          </button>
        )}
      </div>
    );
  }
  
  if (isAssignee && (status === 'accepted' || status === 'in_progress' || status === 'submitted')) {
    return (
      <div className="bg-text-primary/2 border border-border-subtle rounded-xl p-5 flex flex-col gap-4 w-full">
        <div className="text-[13px] text-text-secondary font-medium">Manage your progress</div>
        {status === 'in_progress' && !hasMilestones && (
          <button
            onClick={() => onAction('submit')}
            disabled={updateLoading}
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg text-[13px] font-semibold hover:bg-amber-500/20 transition-colors"
          >
            {updateLoading ? <RefreshCw size={14} className="animate-spin" /> : <GitMerge size={14} />}
            Submit for Review
          </button>
        )}
        <button
          onClick={onLeave}
          disabled={updateLoading}
          className="inline-flex items-center justify-center gap-2 w-full py-2 bg-transparent border border-red-500/20 text-red-400/60 rounded-lg text-[12px] font-semibold hover:bg-red-500/5 hover:text-red-400 transition-all"
        >
          {updateLoading ? <RefreshCw size={12} className="animate-spin" /> : <LogOut size={12} />}
          Leave Task
        </button>
      </div>
    );
  }


  if (status === 'completed') {
    return (
      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-6 flex flex-col gap-4 w-full justify-center items-center">
        <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
          <CheckCircle2 size={20} />
        </div>
        <div className="text-[13px] text-emerald-500/80 font-medium text-center">Task completely finished.</div>
      </div>
    );
  }

  if (!isCreator && !isAssignee && !isWorkspaceTask && slotsFilled < capacity) {
    return (
      <div className="bg-accent-soft border border-accent/20 rounded-xl p-5 flex flex-col gap-4 w-full">
        <div className="text-[13px] text-accent font-medium">Slots available! Join this collaboration.</div>
        <button
          onClick={onAccept}
          disabled={updateLoading}
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 bg-accent text-white rounded-lg text-[13px] font-semibold hover:opacity-90 transition-colors active:scale-[0.98]"
        >
          {updateLoading ? <RefreshCw size={14} className="animate-spin" /> : <ChevronRight size={14} />}
          Join Task ({capacity - slotsFilled} left)
        </button>
      </div>
    );
  }

  return (
    <div className="bg-text-primary/2 border border-border-subtle rounded-xl p-5 flex flex-col justify-center w-full">
      <div className="text-[12px] text-text-secondary font-medium text-center opacity-60 uppercase tracking-widest">
        Status: <span className="text-text-primary">{status?.replace('_', ' ')}</span>
      </div>
      {slotsFilled >= capacity && !isAssignee && !isCreator && (
        <div className="mt-2 text-[10px] text-red-400 font-bold text-center uppercase tracking-tighter">Task full</div>
      )}
    </div>
  );
});

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = location.state?.from || 'dashboard';
  const [task,          setTask]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userProfile,   setUserProfile]   = useState(null);
  const [searchTerm,    setSearchTerm]    = useState('');
  const { theme, toggleTheme } = useTheme();

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [subGithub, setSubGithub] = useState('');
  const [subDocs, setSubDocs] = useState('');
  const [subDrive, setSubDrive] = useState('');
  const [subNotes, setSubNotes] = useState('');

  const [submittingMilestone, setSubmittingMilestone] = useState(null);
  const [mileLink, setMileLink] = useState('');
  const [mileNote, setMileNote] = useState('');
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [milestoneToDelete, setMilestoneToDelete] = useState(null);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [assigningMilestone, setAssigningMilestone] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    subject: '',
    deadline: '',
    max_assignees: 1,
    priority: 'Medium',
    issue_type: 'Task',
    labels: '',
    ai_optimized: false,
  });

  const [showAllActivities, setShowAllActivities] = useState(false);

  const [aiRecommendation, setAiRecommendation] = useState('');
  const [isGeneratingMilestones, setIsGeneratingMilestones] = useState(false);
  const [isRecommendingUsers, setIsRecommendingUsers] = useState(false);
  const [commentText, setCommentText] = useState('');


  const [isPredictingPriority, setIsPredictingPriority] = useState(false);
  const [isSuggestingLabels, setIsSuggestingLabels] = useState(false);
  const [isImprovingWriting, setIsImprovingWriting] = useState(false);

  const handleAiImproveWriting = async () => {
    if (!editForm.title || !editForm.description) {
      alert('Please enter title and description first');
      return;
    }
    setIsImprovingWriting(true);
    try {
      const response = await api.post('/api/tasks/ai/improve-writing', {
        title: editForm.title,
        description: editForm.description,
        subject: editForm.subject
      });
      const { title, description, subject } = response.data;
      setEditForm(prev => ({ 
        ...prev, 
        title: title || prev.title, 
        description: description || prev.description, 
        subject: subject || prev.subject 
      }));
    } catch (err) {
      console.error('AI Improvement failed:', err);
      alert('AI Writing improvement failed. Please try again.');
    } finally {
      setIsImprovingWriting(false);
    }
  };

  const handleAiPredictPriority = async () => {
    if (!editForm.title || !editForm.description) {
      alert('Please enter title and description first');
      return;
    }
    setIsPredictingPriority(true);
    try {
      const response = await api.post('/api/tasks/ai/predict-priority', {
        title: editForm.title,
        description: editForm.description
      });
      if (response.data.priority) {
        setEditForm(prev => ({ ...prev, priority: response.data.priority }));
      }
    } catch (err) {
      console.error('AI Prediction failed:', err);
      alert('AI Prediction failed. Please try again.');
    } finally {
      setIsPredictingPriority(false);
    }
  };

  const handleAiSuggestLabels = async () => {
    if (!editForm.title || !editForm.description) {
      alert('Please enter title and description first');
      return;
    }
    setIsSuggestingLabels(true);
    try {
      const response = await api.post('/api/tasks/ai/predict-labels', {
        title: editForm.title,
        description: editForm.description
      });
      const suggested = response.data.labels;
      if (suggested && suggested.length > 0) {
        const currentLabels = editForm.labels.split(',').map(s => s.trim()).filter(s => s !== '');
        const merged = Array.from(new Set([...currentLabels, ...suggested]));
        setEditForm(prev => ({ ...prev, labels: merged.join(', ') }));
      } else {
        alert('AI could not suggest any labels for this task. Try adding more detail.');
      }
    } catch (err) {
      console.error('AI Labels failed:', err);
      alert('AI suggestion failed. Please try again.');
    } finally {
      setIsSuggestingLabels(false);
    }
  };

  const fetchTask = useCallback(async () => {
    try {
      const res = await api.get(`/tasks/detail/${id}`);
      const data = res.data;
      setTask(data);
      if (data.title) {
        document.title = `${data.title} | TaskNest`;
      }
      setEditForm({
        title: data.title || '',
        description: data.description || '',
        subject: data.subject || '',
        deadline: data.deadline ? new Date(data.deadline).toISOString().slice(0, 16) : '',
        max_assignees: data.max_assignees || 1,
        priority: data.priority || 'Medium',
        issue_type: data.issue_type || 'Task',
        labels: data.labels ? data.labels.join(', ') : '',
        ai_optimized: data.ai_optimized || false,
      });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, [id]);

  const fetchWorkspaceMembers = useCallback(async (workspaceId) => {
    try {
      const res = await api.get(`/api/workspaces/${workspaceId}/members`);
      setWorkspaceMembers(res.data);
    } catch (err) {
      console.error('Failed to fetch workspace members:', err);
    }
  }, []);

  useEffect(() => {
    if (task?.workspace_id) {
      fetchWorkspaceMembers(task.workspace_id);
    }
  }, [task?.workspace_id, fetchWorkspaceMembers]);

  const loadProfile = useCallback(async () => {
    try {
      const res = await api.get('/api/user/profile');
      setUserProfile(res.data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchTask(), loadProfile()]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (id) init();
  }, [id, fetchTask, loadProfile]);


  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      navigate('/', { replace: true });
    } catch (_) {}
  }, [navigate]);

  const handleStatusUpdate = useCallback(async (newStatus) => {
    setUpdateLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Update failed');
      }
      fetchTask();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdateLoading(false);
    }
  }, [id, fetchTask]);

  const handleAcceptTask = useCallback(async () => {
    setUpdateLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/accept`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to accept task');
      }
      fetchTask();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdateLoading(false);
    }
  }, [id, fetchTask]);

  const handleAddComment = async (e) => {
    if (e) e.preventDefault();
    if (!commentText.trim() || updateLoading) return;
    
    setUpdateLoading(true);
    try {
      await api.post(`/tasks/${id}/comments`, { content: commentText });
      setCommentText('');
      await fetchTask(); // Refresh to show new activity
    } catch (err) {
      console.error('Failed to add comment:', err);
      alert('Failed to add comment. Please try again.');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleAction = useCallback(async (action) => {
    if (action === 'submit') {
      setShowSubmitModal(true);
      return;
    }
    setUpdateLoading(true);
    setError('');
    let url = `${API_BASE}/tasks/${id}`;
    if (action === 'approve') url += '/approve';
    else if (action === 'request-changes') url += '/request-changes';

    try {
      const res = await fetch(url, { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Operation failed');
      }
      fetchTask();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdateLoading(false);
    }
  }, [id, fetchTask]);

  const handleFinalSubmit = useCallback(async () => {
    setUpdateLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          github: subGithub,
          docs: subDocs,
          drive: subDrive,
          notes: subNotes
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to submit review');
      }
      setShowSubmitModal(false);
      fetchTask();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdateLoading(false);
    }
  }, [id, fetchTask, subGithub, subDocs, subDrive, subNotes]);

  const handleAddMilestone = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!newMilestoneTitle.trim()) return;
    setUpdateLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: newMilestoneTitle }),
      });
      if (res.ok) {
         setNewMilestoneTitle('');
         setIsAddingMilestone(false);
         fetchTask();
      } else {
         const errData = await res.json().catch(() => ({}));
         throw new Error(errData.error || 'Failed to add milestone');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdateLoading(false);
    }
  }, [id, fetchTask, newMilestoneTitle]);

  const handleMilestoneStatus = useCallback(async (mid, status) => {
    setUpdateLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/milestones/${mid}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (res.ok) fetchTask();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdateLoading(false);
    }
  }, [id, fetchTask]);
  
  const handleMilestoneSubmit = useCallback(async () => {
    setUpdateLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/milestones/${submittingMilestone.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ link: mileLink, note: mileNote }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to submit milestone');
      }
      setSubmittingMilestone(null);
      fetchTask();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdateLoading(false);
    }
  }, [id, fetchTask, submittingMilestone, mileLink, mileNote]);

  const handleLeaveTask = useCallback(async () => {
    if (!window.confirm('Are you sure you want to leave this task? All your progress will be reset.')) return;
    
    setUpdateLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to leave task');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdateLoading(false);
    }
  }, [id, navigate]);

  const handleUpdateTask = useCallback(async (e) => {
    if (e) e.preventDefault();
    setUpdateLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...editForm,
          labels: editForm.labels.split(',').map(s => s.trim()).filter(s => s !== '')
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Update failed');
      }
      setIsEditing(false);
      fetchTask();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdateLoading(false);
    }
  }, [id, editForm, fetchTask]);

  const handleInviteUser = useCallback(async () => {
    if (!inviteEmail) return;
    setUpdateLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: inviteEmail }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to invite user');
      }
      setInviteEmail('');
      setIsInviting(false);
      fetchTask();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdateLoading(false);
    }
  }, [id, inviteEmail, fetchTask]);

  const handleDeleteMilestone = useCallback(async () => {
    if (!milestoneToDelete) return;
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/milestones/${milestoneToDelete}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete milestone');
      setMilestoneToDelete(null);
      fetchTask();
    } catch (err) {
      setError(err.message);
    }
  }, [id, milestoneToDelete, fetchTask]);

  const handleAssignMilestone = useCallback(async (mid, userId) => {
    setUpdateLoading(true);
    setError('');
    try {
      const res = await api.post(`/tasks/${id}/milestones/${mid}/assign`, { assignee_id: String(userId) });
      if (res.status === 200) {
        setShowAssignModal(false);
        setAssigningMilestone(null);
        fetchTask();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign milestone');
    } finally {
      setUpdateLoading(false);
    }
  }, [id, fetchTask]);

  const handleReorderMilestones = useCallback(async (newMilestones) => {
    const milestoneIds = newMilestones.map(m => m.id);
    try {
      await api.post(`/tasks/${id}/milestones/reorder`, { milestone_ids: milestoneIds });
      setTask(prev => ({ ...prev, milestones: newMilestones }));
    } catch (err) {
      console.error('Failed to reorder milestones:', err);
      fetchTask();
    }
  }, [id, fetchTask]);

  const handleAiGenerateMilestones = useCallback(async () => {
    setIsGeneratingMilestones(true);
    setError('');
    try {
      const res = await api.post('/api/tasks/ai/generate-milestones', { 
        task_id: id, 
        title: task.title, 
        description: task.description,
        subject: task.subject
      });
      fetchTask();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to generate milestones.');
    } finally {
      setIsGeneratingMilestones(false);
    }
  }, [id, task?.title, task?.description, fetchTask]);

  const handleAiRecommendUsers = useCallback(async () => {
    setIsRecommendingUsers(true);
    setAiRecommendation('');
    try {
      const res = await api.post('/api/tasks/ai/recommend-users', { subject: task.subject });
      setAiRecommendation(res.data.recommendation);
    } catch (err) {
      console.error(err);
      alert('Failed to get recommendation.');
    } finally {
      setIsRecommendingUsers(false);
    }
  }, [task?.subject]);


  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  const openMobileMenu  = useCallback(() => setMobileMenuOpen(true),  []);

  // ── Pure derivations (useMemo — no side effects) ────────────────────────────

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleDateString('en-US', DATE_FMT);
  }, []);

  const formatTimeAgo = useCallback((dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

  const isPastDeadline = useMemo(
    () => task?.deadline && new Date(task.deadline) < new Date(),
    [task?.deadline]
  );

  const isCreator = useMemo(
    () => {
      if (!userProfile || !task) return false;
      return String(task.creator_id) === String(userProfile.id);
    },
    [userProfile?.id, task?.creator_id, task?.id]
  );

  const isAssignee = useMemo(
    () => !!(userProfile && task && task.assignees?.some(a => String(a.user_id) === String(userProfile.id))),
    [userProfile, task?.assignees]
  );

  const isAuthorized = useMemo(
    () => isCreator || task?.user_role === 'owner' || task?.user_role === 'admin',
    [isCreator, task?.user_role]
  );

  const currentStepIndex = useMemo(
    () => STEPS.findIndex(s => s.id === (task?.status === 'pending' ? 'accepted' : task?.status)),
    [task?.status]
  );

  const percentage = useMemo(() => {
    if (!task) return 0;
    if (task.milestones?.length > 0) {
      const completed = task.milestones.filter(m => m.status === 'done').length;
      return Math.round((completed / task.milestones.length) * 100);
    }
    if (task.progress) return task.progress;
    const map = { completed: 100, submitted: 75, in_progress: 50, accepted: 25 };
    return map[task.status] ?? 0;
  }, [task?.progress, task?.status, task?.milestones]);

  const getLabelColor = useCallback((label) => {
    const colors = [
      'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'bg-purple-500/10 text-purple-400 border-purple-500/20',
      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      'bg-amber-500/10 text-amber-400 border-amber-500/20',
      'bg-rose-500/10 text-rose-400 border-rose-500/20',
      'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    ];
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }, []);


  const progressBarStyle = useMemo(
    () => ({ width: `calc(${percentage}% - 16px)` }),
    [percentage]
  );


  if (loading) return (
    <div className="flex bg-bg-main h-screen overflow-hidden">
      <div className="w-[280px] shrink-0 bg-bg-sidebar border-r border-border-subtle hidden md:block animate-pulse" />
      <div className="flex-1 overflow-y-auto">
        <div className="h-16 border-b border-border-subtle animate-pulse bg-bg-main/70" />
        <TaskDetailSkeleton />
      </div>
    </div>
  );

  if (error && !task) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-main text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-red-400/10 flex items-center justify-center">
        <AlertCircle size={32} className="text-red-400" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">Task Not Found</h2>
        <p className="text-text-secondary text-sm max-w-sm mb-6">{error}</p>
      </div>
      <Link to={fromPath === 'dashboard' ? '/dashboard' : `/dashboard/${fromPath}`} className="px-6 py-3 bg-bg-card border border-border-subtle text-text-primary rounded-xl font-medium text-sm hover:bg-text-primary/5 transition-colors shadow-sm">
        ← Back to {fromPath === 'dashboard' ? 'Dashboard' : fromPath.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </Link>
    </div>
  );

  return (
    <div className="flex bg-bg-main h-screen overflow-hidden text-text-primary font-inter transition-colors duration-300">
      
      <Sidebar 
        mobileMenuOpen={mobileMenuOpen}
        closeMobileMenu={() => setMobileMenuOpen(false)}
        userProfile={userProfile}
        theme={theme}
        toggleTheme={toggleTheme}
        onLogout={handleLogout}
      />

      <main className="flex-1 h-screen overflow-y-auto bg-bg-main transition-colors duration-300">
        
        <Header 
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          userProfile={userProfile}
          openMobileMenu={() => setMobileMenuOpen(true)}
        />

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <Link 
            to={fromPath === 'dashboard' ? '/dashboard' : `/dashboard/${fromPath}`} 
            className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-accent transition-colors group"
          >
            <div className="p-1.5 rounded-lg bg-text-primary/3 group-hover:bg-accent/10 group-hover:text-accent transition-all">
              <ArrowLeft size={16} />
            </div>
            Back to {fromPath === 'dashboard' ? 'Dashboard' : fromPath.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-10 border-b border-border-subtle">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <span className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                task.issue_type === 'Bug' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                task.issue_type === 'Story' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                task.issue_type === 'Improvement' ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' :
                'bg-blue-500/10 text-blue-500 border border-blue-500/20'
              }`}>
                {task.issue_type === 'Bug' ? <AlertCircle size={12} /> :
                 task.issue_type === 'Story' ? <FileText size={12} /> :
                 task.issue_type === 'Improvement' ? <TrendingUp size={12} /> :
                 <CheckSquare size={12} />}
                {task.issue_type || 'Task'}
              </span>
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                task.priority === 'Critical' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                task.priority === 'High' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' :
                task.priority === 'Medium' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
              }`}>
                {task.priority || 'Medium'} Priority
              </span>
              <span className="text-text-secondary/40 text-[10px] font-bold uppercase tracking-widest">Task ID: {id?.slice(-6)}</span>
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
              <h1 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight leading-tight">
                {task.title}
              </h1>
              {task.labels && task.labels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {task.labels.filter(label => !/^global-starter-v\d+$/i.test(label)).map((label, idx) => (
                    <span key={idx} className={`px-2 py-0.5 border text-[10px] font-bold rounded uppercase tracking-widest ${getLabelColor(label)}`}>
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isCreator && (
              <button 
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-text-primary/3 border border-border-subtle text-text-primary hover:bg-text-primary/6 rounded-lg text-[13px] font-semibold transition-colors"
              >
                <Edit3 size={16} /> Edit Details
              </button>
            )}
            <div className="w-[1px] h-8 bg-border-subtle mx-1 hidden sm:block" />
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-accent tracking-widest uppercase mb-1">{percentage}% COMPLETE</span>
              <div className="w-32 h-1.5 bg-text-primary/5 rounded-full overflow-hidden">
                <div className="h-full bg-accent transition-all duration-1000" style={{ width: `${percentage}%` }} />
              </div>
            </div>
          </div>
        </div>
        <div className="mb-16 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-2 mb-8 opacity-60">
             <GitMerge size={16} className="text-accent" />
             <span className="text-[11px] font-bold uppercase tracking-widest text-text-primary">Task Lifecycle</span>
          </div>
          <div className="relative flex items-start w-full px-4 sm:px-12">
            <div className="absolute top-2.5 left-12 right-12 h-0.5 bg-border-subtle z-0" />
            <div
              className="absolute top-2.5 left-12 h-0.5 bg-accent transition-all duration-1000 z-0"
              style={progressBarStyle}
            />
            {STEPS.map((step, idx) => (
              <TimelineStep
                key={step.id}
                step={step}
                isCompleted={idx < currentStepIndex || task.status === 'completed'}
                isActive={idx === currentStepIndex && task.status !== 'completed'}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10">
          
          <div className="space-y-12">
            
            <section className="animate-fade-in">
              <div className="flex items-center gap-2 mb-6 text-text-primary">
                <FileText size={18} className="text-accent" />
                <h3 className="text-sm font-bold uppercase tracking-widest opacity-60">Description</h3>
              </div>
              <div className="bg-bg-card border border-border-subtle rounded-2xl p-8">
                <p className="text-[16px] text-text-primary/90 leading-relaxed whitespace-pre-wrap">
                  {task.description || "No description provided for this task."}
                </p>
                {task.attachment_url && (
                  <div className="mt-8 pt-8 border-t border-border-subtle">
                    <a 
                      href={task.attachment_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center gap-3 px-4 py-2.5 bg-accent/5 border border-accent/20 rounded-xl text-accent text-sm font-semibold hover:bg-accent/10 transition-all"
                    >
                      <Link2 size={16} /> View Attachment
                    </a>
                  </div>
                )}
              </div>
            </section>
            <section className="animate-fade-in" style={{ animationDelay: '100ms' }}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-text-primary">
                  <Layers size={18} className="text-accent" />
                  <h3 className="text-sm font-bold uppercase tracking-widest opacity-60">Roadmap & Milestones</h3>
                </div>
                {isAuthorized && !isAddingMilestone && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleAiGenerateMilestones}
                      disabled={isGeneratingMilestones || (task?.ai_milestone_count >= 2)}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 uppercase tracking-widest ${
                        (task?.ai_milestone_count >= 2) 
                          ? 'bg-text-primary/5 text-text-secondary/40 cursor-not-allowed' 
                          : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90'
                      }`}
                    >
                      {isGeneratingMilestones ? <RefreshCw size={12} className="animate-spin" /> : <Layers size={12} />}
                      {task?.ai_milestone_count >= 2 ? 'Roadmap Done' : 'AI Generate'}
                    </button>
                    <button 
                      onClick={() => setIsAddingMilestone(true)}
                      className="text-[10px] font-bold text-accent hover:text-white bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 uppercase tracking-widest"
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                )}
              </div>
              {isAddingMilestone && (
                 <form onSubmit={handleAddMilestone} className="mb-6 p-4 bg-bg-card border border-border-subtle rounded-xl">
                    <div className="flex items-center gap-3">
                       <input 
                          type="text" 
                          autoFocus
                          placeholder="New milestone..." 
                          value={newMilestoneTitle}
                          onChange={(e) => setNewMilestoneTitle(e.target.value)}
                          className="flex-1 bg-transparent border border-border-subtle rounded-lg px-4 py-2 text-sm outline-none text-text-primary focus:border-accent"
                       />
                       <button type="submit" disabled={updateLoading || !newMilestoneTitle.trim()} className="px-4 py-2 bg-accent text-white rounded-lg text-xs font-bold hover:opacity-90">Add</button>
                       <button type="button" onClick={() => setIsAddingMilestone(false)} className="text-text-secondary"><X size={18} /></button>
                    </div>
                 </form>
              )}

              <div className="space-y-4">
                {task.milestones?.length > 0 ? (
                  task.milestones.map((m, index) => {
                    return (
                      <div 
                        key={m.id} 
                        draggable={isAuthorized}
                        onDragStart={(e) => {
                          if (!isAuthorized) return;
                          e.dataTransfer.setData('text/plain', index);
                          e.currentTarget.classList.add('opacity-50');
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove('opacity-50');
                        }}
                        onDragOver={(e) => {
                          if (!isAuthorized) return;
                          e.preventDefault();
                          e.currentTarget.classList.add('border-accent');
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove('border-accent');
                        }}
                        onDrop={(e) => {
                          if (!isAuthorized) return;
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-accent');
                          const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                          const toIndex = index;
                          if (fromIndex === toIndex) return;
                          
                          const newMilestones = [...task.milestones];
                          const [movedItem] = newMilestones.splice(fromIndex, 1);
                          newMilestones.splice(toIndex, 0, movedItem);
                          handleReorderMilestones(newMilestones);
                        }}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-bg-card/40 border border-border-subtle rounded-2xl transition-all hover:border-accent/30 hover:shadow-lg shadow-accent/5 cursor-move active:cursor-grabbing"
                      >
                        <div className="flex items-center gap-4">
                          {isAuthorized && (
                            <div className="flex flex-col gap-0.5 opacity-20 group-hover:opacity-100 transition-opacity">
                              <div className="w-1 h-1 rounded-full bg-text-primary" />
                              <div className="w-1 h-1 rounded-full bg-text-primary" />
                              <div className="w-1 h-1 rounded-full bg-text-primary" />
                            </div>
                          )}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${m.status === 'done' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-accent/5 border-accent/20 text-accent'}`}>
                            {m.status === 'done' ? <Check size={18} strokeWidth={3} /> : <GitMerge size={18} />}
                          </div>
                          <div>
                            <h4 className={`text-sm font-bold ${m.status === 'done' ? 'text-text-secondary line-through' : 'text-text-primary'}`}>{m.title}</h4>
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-bold uppercase tracking-widest ${
                                m.status === 'done' ? 'text-emerald-500' :
                                m.status === 'in_progress' ? 'text-amber-500' :
                                'text-text-secondary/60'
                              }`}>{m.status?.replace('_', ' ')}</span>
                              {m.assignee_name && (
                                <>
                                  <span className="text-[9px] text-text-secondary opacity-40">•</span>
                                  <div className="flex items-center gap-1">
                                    <Avatar name={m.assignee_name} photoUrl={m.assignee_photo_url} size="xs" />
                                    <span className="text-[9px] font-bold text-accent uppercase tracking-widest">{m.assignee_name}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4 sm:mt-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isAuthorized && (
                            <button 
                              onClick={() => { setAssigningMilestone(m); setShowAssignModal(true); }} 
                              className="p-2 text-text-secondary hover:text-accent rounded-lg"
                              title="Assign to member"
                            >
                              <UserPlus size={16} />
                            </button>
                          )}
                          {isAuthorized && <button onClick={() => setMilestoneToDelete(m.id)} className="p-2 text-text-secondary hover:text-red-400 rounded-lg"><Trash2 size={16} /></button>}
                          {(isAssignee || (m.assignee_id && String(m.assignee_id) === String(userProfile?.id))) && m.status === 'pending' && <button onClick={() => handleMilestoneStatus(m.id, 'in_progress')} className="px-4 py-1.5 bg-accent text-white text-[11px] font-bold rounded-lg">Start</button>}
                          {(isAssignee || (m.assignee_id && String(m.assignee_id) === String(userProfile?.id))) && m.status === 'in_progress' && <button onClick={() => { setSubmittingMilestone(m); setMileLink(''); setMileNote(''); }} className="px-4 py-1.5 bg-amber-500 text-white text-[11px] font-bold rounded-lg">Submit</button>}
                          {(m.status === 'submitted' || m.status === 'done') && m.submission_link && <a href={m.submission_link} target="_blank" rel="noreferrer" className="p-2 text-accent hover:bg-accent/10 rounded-lg"><ExternalLink size={16} /></a>}
                          {isCreator && m.status === 'submitted' && (
                            <div className="flex gap-2">
                              <button onClick={() => handleMilestoneStatus(m.id, 'done')} className="px-3 py-1.5 bg-emerald-500 text-white text-[11px] font-bold rounded-lg">Approve</button>
                              <button onClick={() => handleMilestoneStatus(m.id, 'in_progress')} className="px-3 py-1.5 bg-text-primary/10 text-text-primary text-[11px] font-bold rounded-lg">Reject</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 border-2 border-dashed border-border-subtle rounded-3xl flex flex-col items-center justify-center text-text-secondary/40">
                    <Layers size={32} className="mb-4 opacity-20" />
                    <p className="text-sm font-medium italic">No milestones defined yet.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="animate-fade-in" style={{ animationDelay: '200ms' }}>
              <div className="flex items-center gap-2 mb-6 text-text-primary">
                <Activity size={18} className="text-accent" />
                <h3 className="text-sm font-bold uppercase tracking-widest opacity-60">Activity & Comments</h3>
              </div>
              <div className="bg-bg-card border border-border-subtle rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-border-subtle bg-text-primary/2 flex items-center justify-between">
                  <span className="text-[12px] font-bold text-text-secondary uppercase tracking-wider opacity-60">
                    {task.activities?.length || 0} Total Activities
                  </span>
                  {task.activities?.length > 3 && (
                    <button 
                      onClick={() => setShowAllActivities(!showAllActivities)}
                      className="text-[11px] font-bold text-accent hover:underline uppercase tracking-widest"
                    >
                      {showAllActivities ? 'Show Less' : 'View All'}
                    </button>
                  )}
                </div>
                
                <div className="divide-y divide-border-subtle max-h-[500px] overflow-y-auto custom-scrollbar">
                  {task.activities?.length > 0 ? (
                    (showAllActivities ? task.activities : task.activities.slice(0, 3)).map((activity) => (
                      <div key={activity.id} className="p-6 flex gap-4 border-b border-border-subtle last:border-b-0">
                        <Avatar name={activity.user_name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-text-primary">{activity.user_name}</span>
                            <span className="text-[10px] text-text-secondary opacity-40">{formatTimeAgo(activity.created_at)}</span>
                          </div>
                          <p className="text-sm text-text-secondary/80">
                            {activity.details}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center text-text-secondary/40 italic text-sm">
                      No activity logged for this task yet.
                    </div>
                  )}
                </div>

                <div className="p-6 bg-text-primary/2 border-t border-border-subtle">
                  <form onSubmit={handleAddComment} className="flex gap-3">
                    <Avatar name={userProfile?.name} photoUrl={userProfile?.photo_url} size="sm" />
                    <div className="flex-1 relative">
                      <input 
                        type="text" 
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a comment or update..." 
                        className="w-full bg-bg-main border border-border-subtle rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent/40 transition-all text-text-primary"
                        disabled={updateLoading}
                      />
                      <button 
                        type="submit"
                        disabled={!commentText.trim() || updateLoading}
                        className="absolute right-2 top-1.5 p-1.5 text-text-secondary hover:text-accent transition-colors disabled:opacity-30"
                      >
                        {updateLoading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </section>

          </div>

          <aside className="space-y-8 animate-fade-in" style={{ animationDelay: '200ms' }}>
            
            <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 shadow-sm">
               <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-6 opacity-60">Status & Lifecycle</h4>
               <CTAStrip
                  status={task.status}
                  isCreator={isCreator}
                  isAssignee={isAssignee}
                  updateLoading={updateLoading}
                  onAccept={handleAcceptTask}
                  onAction={handleAction}
                  onLeave={handleLeaveTask}
                  hasMilestones={task.milestones?.length > 0}
                  slotsFilled={task.slots_filled || 0}
                  capacity={task.capacity || 1}
                  isWorkspaceTask={!!task.workspace_id}
               />
            </div>

            <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-6">
              <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest opacity-60">Task Details</h4>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-text-secondary text-[13px]">
                    <Clock size={14} /> <span>Deadline</span>
                  </div>
                  <span className={`text-[13px] font-semibold ${isPastDeadline ? 'text-red-400' : 'text-text-primary'}`}>
                    {formatDate(task.deadline)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-text-secondary text-[13px]">
                    <Briefcase size={14} /> <span>Category</span>
                  </div>
                  <span className="text-[13px] font-semibold text-text-primary">{task.subject || 'General'}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-text-secondary text-[13px]">
                    <Activity size={14} /> <span>Status</span>
                  </div>
                  <span className="text-[13px] font-bold text-accent uppercase tracking-tighter">{task.status?.replace('_', ' ')}</span>
                </div>
              </div>

              <div className="pt-6 border-t border-border-subtle">
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-4 opacity-60">Stakeholders</p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={task.creator_name} photoUrl={task.creator_photo_url} size="sm" />
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold text-text-primary">{task.creator_name}</span>
                      <span className="text-[10px] text-text-secondary opacity-60">Creator</span>
                    </div>
                  </div>
                  
                  {task.assignees?.map(assignee => (
                    <div key={assignee.user_id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <Avatar name={assignee.name} photoUrl={assignee.photo_url} size="sm" />
                        <div className="flex flex-col">
                          <span className="text-[13px] font-semibold text-text-primary">{assignee.name}</span>
                          <span className="text-[10px] text-text-secondary opacity-60">Member</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-accent bg-accent/5 px-2 py-0.5 rounded-full">{assignee.progress}%</span>
                    </div>
                  ))}
                  
                  {(!task.assignees || task.assignees.length === 0) && (
                    <p className="text-[12px] text-text-secondary italic opacity-40 py-2">No members assigned yet.</p>
                  )}
                </div>
              </div>
            </div>

            {(task.status === 'submitted' || task.status === 'completed') && (
              <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 shadow-sm">
                <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-4 opacity-60">Proof of Work</h4>
                <div className="space-y-3">
                  {task.submission_github && (
                    <a href={task.submission_github} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-text-primary/3 rounded-lg hover:bg-text-primary/5 transition text-[12px] font-medium text-text-primary">
                      <Code size={14} className="text-accent" /> GitHub Repo
                    </a>
                  )}
                  {task.submission_docs && (
                    <a href={task.submission_docs} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-text-primary/3 rounded-lg hover:bg-text-primary/5 transition text-[12px] font-medium text-text-primary">
                      <FileText size={14} className="text-accent" /> Documentation
                    </a>
                  )}
                  <div className="mt-4 p-3 bg-text-primary/3 rounded-lg">
                    <p className="text-[11px] text-text-secondary italic leading-relaxed">
                      {task.submission_notes || 'No additional notes provided.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>

      {showSubmitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-card rounded-xl w-full max-w-lg shadow-2xl overflow-hidden border border-border-subtle animate-scale-up">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-semibold text-text-primary tracking-tight">Submit Work</h3>
                <button onClick={() => setShowSubmitModal(false)} className="p-2 hover:bg-text-primary/5 rounded-full transition-colors text-text-secondary"><X size={20} /></button>
              </div>
              
              <p className="text-sm text-text-secondary font-medium mb-10 leading-relaxed opacity-60">Provide links to your completed work for review. Once submitted, the creator will be notified.</p>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2 opacity-60"><Code size={12} /> GitHub Repository</label>
                  <input type="text" value={subGithub} onChange={e => setSubGithub(e.target.value)} placeholder="https://github.com/..." className="w-full bg-bg-main border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary placeholder-text-secondary/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2 opacity-60"><FileText size={12} /> Documentation</label>
                  <input type="text" value={subDocs} onChange={e => setSubDocs(e.target.value)} placeholder="Google Docs, PDF, etc." className="w-full bg-bg-main border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary placeholder-text-secondary/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2 opacity-60"><Link2 size={12} /> Other Resources</label>
                  <input type="text" value={subDrive} onChange={e => setSubDrive(e.target.value)} placeholder="Drive link, Figma, etc." className="w-full bg-bg-main border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary placeholder-text-secondary/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2 opacity-60">Additional Notes</label>
                  <textarea value={subNotes} onChange={e => setSubNotes(e.target.value)} rows={3} placeholder="Any specific details for the reviewer?" className="w-full bg-bg-main border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary placeholder-text-secondary/30" />
                </div>
              </div>
            </div>
            
            <div className="p-8 bg-bg-main/30 border-t border-border-subtle flex gap-4">
              <button onClick={() => setShowSubmitModal(false)} className="flex-1 py-3 text-text-secondary font-semibold rounded-xl hover:text-text-primary transition-all">Cancel</button>
              <button onClick={handleFinalSubmit} disabled={updateLoading} className="flex-1 py-3 bg-accent text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-accent/10">
                {updateLoading ? 'Submitting...' : 'Confirm Submission'}
              </button>
            </div>
          </div>
        </div>
      )}

      {submittingMilestone && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-card rounded-xl w-full max-w-md shadow-2xl overflow-hidden border border-border-subtle animate-scale-up">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-semibold text-text-primary tracking-tight">Submit Milestone</h3>
                <button onClick={() => setSubmittingMilestone(null)} className="p-2 hover:bg-text-primary/5 rounded-full transition-colors text-text-secondary"><X size={20} /></button>
              </div>
              <p className="text-sm text-text-secondary font-medium mb-10 leading-relaxed opacity-60">Submission for: <span className="text-accent font-semibold">{submittingMilestone.title}</span></p>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2 opacity-60">Submission Link</label>
                  <input type="text" value={mileLink} onChange={e => setMileLink(e.target.value)} placeholder="URL to your work..." className="w-full bg-bg-main border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary placeholder-text-secondary/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2 opacity-60">Notes</label>
                  <textarea value={mileNote} onChange={e => setMileNote(e.target.value)} rows={2} placeholder="Optional notes..." className="w-full bg-bg-main border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary placeholder-text-secondary/30" />
                </div>
              </div>
            </div>
            
            <div className="p-8 bg-bg-main/30 border-t border-border-subtle flex gap-4">
              <button onClick={() => setSubmittingMilestone(null)} className="flex-1 py-3 text-text-secondary font-semibold rounded-xl hover:text-text-primary transition-all">Cancel</button>
              <button onClick={handleMilestoneSubmit} disabled={updateLoading} className="flex-1 py-3 bg-accent text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50">
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-card rounded-xl w-full max-w-lg shadow-2xl overflow-hidden border border-border-subtle animate-scale-up">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-semibold text-text-primary tracking-tight">Edit Task</h3>
                <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-text-primary/5 rounded-full transition-colors text-text-secondary"><X size={20} /></button>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2 opacity-60">Title</label>
                  <input 
                    type="text" 
                    value={editForm.title} 
                    onChange={e => setEditForm({...editForm, title: e.target.value})} 
                    className="w-full bg-bg-main border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2 opacity-60">Category</label>
                  <input 
                    type="text" 
                    value={editForm.subject} 
                    onChange={e => setEditForm({...editForm, subject: e.target.value})} 
                    className="w-full bg-bg-main border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2 opacity-60">Deadline</label>
                  <input 
                    type="datetime-local" 
                    value={editForm.deadline} 
                    onChange={e => setEditForm({...editForm, deadline: e.target.value})} 
                    className="w-full bg-bg-main border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2 opacity-60">Issue Type</label>
                    <select 
                      value={editForm.issue_type} 
                      onChange={e => setEditForm({...editForm, issue_type: e.target.value})} 
                      className="w-full bg-bg-main border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary"
                    >
                      <option value="Task">Task</option>
                      <option value="Bug">Bug</option>
                      <option value="Story">Story</option>
                      <option value="Improvement">Improvement</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2 opacity-60">Priority</label>
                      <button 
                        onClick={handleAiPredictPriority}
                        disabled={isPredictingPriority || !editForm.title || !editForm.description}
                        className="text-[10px] font-bold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 disabled:opacity-30"
                      >
                        {isPredictingPriority ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                        AI Predict
                      </button>
                    </div>
                    <select 
                      value={editForm.priority} 
                      onChange={e => setEditForm({...editForm, priority: e.target.value})} 
                      className="w-full bg-bg-main border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2 opacity-60">Labels (comma separated)</label>
                    <button 
                      onClick={handleAiSuggestLabels}
                      disabled={isSuggestingLabels || !editForm.title || !editForm.description}
                      className="text-[10px] font-bold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 disabled:opacity-30"
                    >
                      {isSuggestingLabels ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      AI Suggest
                    </button>
                  </div>
                  <input 
                    type="text" 
                    value={editForm.labels} 
                    onChange={e => setEditForm({...editForm, labels: e.target.value})} 
                    className="w-full bg-bg-main border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary" 
                    placeholder="e.g. frontend, bug, api"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2 opacity-60">Description</label>
                    <button 
                      onClick={handleAiImproveWriting}
                      disabled={isImprovingWriting || !editForm.title || !editForm.description}
                      className="text-[10px] font-bold text-accent hover:opacity-80 transition-all flex items-center gap-1 disabled:opacity-30"
                    >
                      {isImprovingWriting ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      ✨ Improve Writing
                    </button>
                  </div>
                  <textarea 
                    value={editForm.description} 
                    onChange={e => setEditForm({...editForm, description: e.target.value})} 
                    rows={4} 
                    className="w-full bg-bg-main border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary" 
                  />
                </div>
              </div>
            </div>
            
            <div className="p-8 bg-bg-main/30 border-t border-border-subtle flex gap-4">
              <button onClick={() => setIsEditing(false)} className="flex-1 py-3 text-text-secondary font-semibold rounded-xl hover:text-text-primary transition-all">Cancel</button>
              <button onClick={handleUpdateTask} disabled={updateLoading} className="flex-1 py-3 bg-accent text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-accent/10">
                {updateLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      {isInviting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-card rounded-xl w-full max-w-sm shadow-2xl overflow-hidden border border-border-subtle animate-scale-up">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-semibold text-text-primary tracking-tight">Assign Member</h3>
                <button onClick={() => setIsInviting(false)} className="p-2 hover:bg-text-primary/5 rounded-full transition-colors text-text-secondary"><X size={20} /></button>
              </div>
              
              <p className="text-sm text-text-secondary mb-6">Enter the email of the person you want to invite to this task.</p>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest opacity-60">Invitee Email</label>
                  <input 
                    type="email" 
                    value={inviteEmail} 
                    onChange={e => setInviteEmail(e.target.value)} 
                    placeholder="user@example.com"
                    className="w-full bg-bg-main border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary" 
                  />
                </div>
              </div>
            </div>
            
            <div className="p-8 bg-bg-main/30 border-t border-border-subtle">
              {isCreator && (
                <div className="mb-6">
                  <button 
                    onClick={handleAiRecommendUsers}
                    disabled={isRecommendingUsers}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl text-[13px] font-bold hover:bg-purple-500/20 transition-all mb-4"
                  >
                    {isRecommendingUsers ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                    Smart Suggest Members
                  </button>
                  {aiRecommendation && (
                    <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-xl text-[12px] text-purple-300/80 leading-relaxed animate-fade-in italic mb-6">
                      {aiRecommendation}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-4">
                <button onClick={() => setIsInviting(false)} className="flex-1 py-3 text-text-secondary font-semibold rounded-xl hover:text-text-primary transition-all">Cancel</button>
                <button onClick={handleInviteUser} disabled={updateLoading || !inviteEmail} className="flex-1 py-3 bg-accent text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-accent/10">
                  {updateLoading ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-card rounded-xl w-full max-w-sm shadow-2xl overflow-hidden border border-border-subtle animate-scale-up">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-semibold text-text-primary tracking-tight">Assign Milestone</h3>
                <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-text-primary/5 rounded-full transition-colors text-text-secondary"><X size={20} /></button>
              </div>
              <p className="text-sm text-text-secondary mb-6">Assign <span className="text-accent font-bold">{assigningMilestone?.title}</span> to a workspace member.</p>
              
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                {workspaceMembers.length > 0 ? (
                  workspaceMembers.map(member => (
                    <button
                      key={member.user_id}
                      onClick={() => handleAssignMilestone(assigningMilestone.id, member.user_id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border-subtle hover:border-accent/40 hover:bg-accent/5 transition-all text-left"
                    >
                      <Avatar name={member.name} photoUrl={member.photo_url} size="sm" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-text-primary">{member.name}</div>
                        <div className="text-[10px] text-text-secondary opacity-60 uppercase tracking-widest">{member.role}</div>
                      </div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary opacity-20">
                        <ChevronRight size={18} />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-text-secondary/40 italic text-sm">
                    No other members in this workspace.
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 bg-bg-main/30 border-t border-border-subtle">
              <button 
                onClick={() => setShowAssignModal(false)} 
                className="w-full py-2.5 text-text-secondary font-semibold rounded-xl hover:text-text-primary transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {milestoneToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-card rounded-xl w-full max-w-sm shadow-2xl overflow-hidden border border-border-subtle animate-scale-up">
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-semibold text-text-primary tracking-tight mb-2">Remove Milestone?</h3>
              <p className="text-sm text-text-secondary font-medium leading-relaxed">This will remove the milestone from the project timeline.</p>
            </div>
            <div className="p-6 bg-bg-main/30 border-t border-border-subtle flex gap-4">
              <button 
                onClick={() => setMilestoneToDelete(null)} 
                className="flex-1 py-2.5 text-text-secondary font-semibold rounded-xl hover:text-text-primary transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteMilestone}
                className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
