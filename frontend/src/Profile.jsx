import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Users, LayoutDashboard, CheckSquare, FileText, GitMerge,
  User, Trash2, LogOut, AlertCircle,
  Menu, X, Search, MoreVertical, Briefcase,
  TrendingUp, ArrowUpRight, Plus, Clock, Upload,
  File, Camera, RefreshCw, ChevronRight, CheckCircle2, Target, Layers, Sparkles
} from 'lucide-react';
import { Routes, Route, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from './context/ThemeContext.jsx';
import { useWorkspace } from './context/WorkspaceContext.jsx';
import Avatar from './components/Avatar.jsx';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import TaskRow from './components/TaskRow.jsx';
import TaskMarketplace from './components/TaskMarketplace.jsx';
import KanbanBoard from './components/KanbanBoard.jsx';
import DashboardOverview from './components/DashboardOverview.jsx';
import PostTaskForm from './components/PostTaskForm.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import WorkspaceSettingsModal from './components/WorkspaceSettingsModal.jsx';
import CreateWorkspace from './components/CreateWorkspace.jsx';
import WorkspaceActivityFeed from './components/WorkspaceActivityFeed.jsx';
import TeamDashboard from './components/TeamDashboard.jsx';
import WorkspaceMembers from './components/WorkspaceMembers.jsx';
import WorkspaceTasks from './components/WorkspaceTasks.jsx';
import api from './api/axios.js';
import { StatCardSkeleton, TaskRowSkeleton, TaskMarketCardSkeleton } from './components/Skeleton.jsx';


const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_URL_SECONDARY || '';

export default function Profile({ onLogout }) {
  const { currentWorkspace } = useWorkspace();
  const [tasks, setTasks] = useState([]);
  const [workspaceMilestones, setWorkspaceMilestones] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [newTask, setNewTask] = useState({ 
    title: '', description: '', subject: '', deadline: '', max_assignees: 1, 
    attachment: null, priority: 'Medium', issue_type: 'Task', labels: '', milestone_id: ''
  });
  const [isPredictingPriority, setIsPredictingPriority] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [invitations, setInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    name: '',
    field: '',
    college_name: '',
    year: '',
    photo: null,
    photoPreview: ''
  });
  const [profileLoading, setProfileLoading] = useState(false);

  const [isWorkspaceSettingsModalOpen, setIsWorkspaceSettingsModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenWorkspaceSettings = () => setIsWorkspaceSettingsModalOpen(true);
    window.addEventListener('openWorkspaceSettings', handleOpenWorkspaceSettings);
    return () => window.removeEventListener('openWorkspaceSettings', handleOpenWorkspaceSettings);
  }, []);

  const { theme, toggleTheme } = useTheme();

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPath = location.pathname.split('/').pop() || 'dashboard';

  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    if (searchParams.get('settings') === 'true') {
      setIsSettingsModalOpen(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('settings');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const fetchTasks = useCallback(async (search = '') => {
    let endpoint = '/tasks/dashboard';
    
    if (currentWorkspace) {
      endpoint = `/api/workspaces/${currentWorkspace.id}/tasks${search ? `?search=${encodeURIComponent(search)}` : ''}`;
      if (currentPath === 'invitations') endpoint = ''; // Ignore for team workspaces
    } else {
      if (currentPath === 'my-tasks') endpoint = `/tasks/mine${search ? `?search=${encodeURIComponent(search)}` : ''}`;
      if (currentPath === 'posted-requests') endpoint = `/tasks/posted${search ? `?search=${encodeURIComponent(search)}` : ''}`;
      if (currentPath === 'invitations') endpoint = '/tasks/invitations';
      if (currentPath === 'market') endpoint = `/tasks${search ? `?search=${encodeURIComponent(search)}` : ''}`;
      if (currentPath === 'active-tasks') endpoint = `/tasks/active${search ? `?search=${encodeURIComponent(search)}` : ''}`;
    }

    if (!endpoint) {
      setTasks([]);
      setTasksLoading(false);
      return;
    }

    setTasksLoading(true);
    setTasks([]); // Clear old tasks to prevent stale view when switching workspaces
    try {
      const res = await api.get(endpoint);
      setTasks(res.data || []);
      if (currentPath === 'invitations' && !currentWorkspace) {
        setInvitations(res.data || []);
      }
    } catch (err) {
      console.error('Fetch tasks error:', err);
      setTasks([]); 
      if (currentPath === 'invitations') setInvitations([]);
      setError(err.message || 'Could not fetch tasks');
    } finally {
      setTasksLoading(false);
    }
  }, [currentPath, currentWorkspace]);

  const fetchInvitations = useCallback(async () => {
    setInvitationsLoading(true);
    try {
      const res = await api.get('/tasks/invitations');
      setInvitations(res.data);
    } catch (err) {
      console.error(err);
      setInvitations([]);
    } finally {
      setInvitationsLoading(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await api.get('/api/user/profile');
      setUserProfile(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userProfile) loadProfile();
  }, [userProfile, loadProfile]);

  useEffect(() => {
    if (currentWorkspace) {
      api.get(`/api/workspaces/${currentWorkspace.id}/milestones`)
        .then(res => setWorkspaceMilestones(res.data || []))
        .catch(err => console.error('Failed to load milestones', err));
    } else {
      setWorkspaceMilestones([]);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    const pageTitles = {
      'dashboard': 'Dashboard | TaskNest',
      'board': 'Kanban Board | TaskNest',
      'market': 'Task Market | TaskNest',
      'my-tasks': 'My Tasks | TaskNest',
      'invitations': 'Task Requests | TaskNest',
      'posted-requests': 'Post Task | TaskNest',
      'profile': 'Profile | TaskNest'
    };
    document.title = pageTitles[currentPath] || 'Dashboard | TaskNest';
  }, [currentPath]);

  useEffect(() => {
    if (userProfile) {
      setProfileFormData({
        name: userProfile.name || '',
        field: userProfile.field || '',
        college_name: userProfile.college_name || '',
        year: userProfile.year || '',
        photo: null,
        photoPreview: userProfile.photo_url || ''
      });
    }
  }, [userProfile]);

  useEffect(() => {
    if (currentPath !== 'profile') {
      const handler = setTimeout(() => {
        fetchTasks(searchTerm);
      }, currentPath === 'dashboard' ? 0 : 300);
      return () => clearTimeout(handler);
    }
    if (currentPath === 'invitations') fetchInvitations();
    
    if (currentPath === 'posted-requests' && location.state?.openForm) {
      setShowPostForm(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [currentPath, searchTerm, location.state?.openForm, fetchTasks, fetchInvitations, navigate, location.pathname]);

  const filteredTasks = useMemo(() => {
    const priorityMap = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
    
    return tasks
      .filter(t => {
        const matchesSearch = !searchTerm || 
          t.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
          t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.creator_name?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
        
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const pA = priorityMap[a.priority] || 2;
        const pB = priorityMap[b.priority] || 2;
        if (pA !== pB) return pB - pA;
        
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [tasks, searchTerm, statusFilter]);



  const handleAccept = useCallback(async (id) => {
    try {
      await api.post(`/tasks/${id}/accept`);
      navigate(`/dashboard/task/${id}`);
    } catch (err) {
      const errData = err.response?.data || {};
      setError(errData.error || 'Failed to accept task');
    }
  }, [navigate]);

  const handleView = useCallback((id) => {
    if (id === 'explore') {
      navigate('/dashboard/market');
    } else {
      navigate(`/dashboard/task/${id}`, { state: { from: currentPath } });
    }
  }, [navigate, currentPath]);

  const handleStatusChange = useCallback(async (id, status, progress = null) => {
    try {
      const body = { status };
      if (progress !== null) body.progress = parseInt(progress, 10);
      await api.post(`/tasks/${id}/status`, body);
      fetchTasks();
    } catch (err) {
      const errData = err.response?.data || {};
      setError(errData.error || 'Status update failed');
    }
  }, [fetchTasks]);

  const handleRespondInvitation = async (id, action) => {
    try {
      await api.post(`/tasks/invitations/${id}/respond`, { action });
      fetchInvitations();
      fetchTasks();
    } catch (err) {
      const data = err.response?.data || {};
      setError(data.error || 'Response failed');
    }
  };

  const handleAiPredictPriority = async () => {
    if (!newTask.title || !newTask.description) {
      alert('Please enter a title and description first');
      return;
    }
    setIsPredictingPriority(true);
    try {
      const res = await api.post('/api/tasks/ai/predict-priority', { 
        title: newTask.title, 
        description: newTask.description 
      });
      setNewTask(prev => ({ ...prev, priority: res.data.priority }));
    } catch (err) {
      console.error(err);
      alert('AI Priority prediction failed. Please try again.');
    } finally {
      setIsPredictingPriority(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('name', profileFormData.name);
      formData.append('field', profileFormData.field);
      formData.append('college_name', profileFormData.college_name);
      formData.append('year', profileFormData.year);
      if (profileFormData.photo) {
        formData.append('photo', profileFormData.photo);
      }

      await api.put('/api/user/profile', formData);

      await fetchTasks();
      const profileRes = await api.get('/api/user/profile');
      setUserProfile(profileRes.data);
      
      setIsSettingsModalOpen(false);
    } catch (err) {
      const data = err.response?.data || {};
      setError(data.error || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const [isSuggestingLabels, setIsSuggestingLabels] = useState(false);
  const [isImprovingWriting, setIsImprovingWriting] = useState(false);

  const handleAiImproveWriting = async () => {
    if (!newTask.title || !newTask.description) {
      alert('Please enter a title and description first');
      return;
    }
    setIsImprovingWriting(true);
    try {
      const response = await api.post('/api/tasks/ai/improve-writing', {
        title: newTask.title,
        description: newTask.description,
        subject: newTask.subject
      });
      const { title, description, subject } = response.data;
      setNewTask(prev => ({ 
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

  const handleAiSuggestLabels = async () => {
    if (!newTask.title || !newTask.description) {
      alert('Please enter title and description first');
      return;
    }
    setIsSuggestingLabels(true);
    try {
      const response = await api.post('/api/tasks/ai/predict-labels', {
        title: newTask.title,
        description: newTask.description
      });
      const suggested = response.data.labels;
      if (suggested && suggested.length > 0) {
        const currentLabels = newTask.labels.split(',').map(s => s.trim()).filter(s => s !== '');
        const merged = Array.from(new Set([...currentLabels, ...suggested]));
        setNewTask(prev => ({ ...prev, labels: merged.join(', ') }));
      } else {
        alert('AI could not suggest any labels. Try a more descriptive title.');
      }
    } catch (err) {
      console.error('AI Labels failed:', err);
      alert('AI Label suggestion failed. Please try again.');
    } finally {
      setIsSuggestingLabels(false);
    }
  };

  const handlePostTask = async (e) => {
    e.preventDefault();
    if (!newTask.title || !newTask.subject) return;
    setPostLoading(true);
    try {
      let attachmentUrl = '';
      if (newTask.attachment) {
        const formData = new FormData();
        formData.append('attachment', newTask.attachment);
        const uploadRes = await api.post('/api/upload', formData);
        attachmentUrl = uploadRes.data.url;
      }

      let endpoint = '/tasks';
      if (currentWorkspace) {
        endpoint = `/api/workspaces/${currentWorkspace.id}/tasks`;
      }

      await api.post(endpoint, {
        title: newTask.title,
        description: newTask.description,
        subject: newTask.subject,
        deadline: newTask.deadline ? new Date(newTask.deadline).toISOString() : null,
        max_assignees: parseInt(newTask.max_assignees, 10),
        priority: newTask.priority,
        issue_type: newTask.issue_type,
        labels: newTask.labels.split(',').map(s => s.trim()).filter(s => s !== ''),
        attachment_url: attachmentUrl,
        milestone_id: newTask.milestone_id ? parseInt(newTask.milestone_id, 10) : null
      });
      
      setNewTask({ title: '', description: '', subject: '', deadline: '', max_assignees: 1, attachment: null, priority: 'Medium', issue_type: 'Task', labels: '', milestone_id: '' });
      setShowPostForm(false);
      fetchTasks();
    } catch (err) {
      const errData = err.response?.data || {};
      setError(errData.error || 'Failed to post task');
    } finally {
      setPostLoading(false);
    }
  };

  const [taskToDelete, setTaskToDelete] = useState(null);

  const handleDeleteTask = useCallback((id) => {
    setTaskToDelete(id);
  }, []);

  const confirmDelete = async () => {
    if (!taskToDelete) return;
    setPostLoading(true);
    try {
      await api.delete(`/tasks/${taskToDelete}`);
      setTaskToDelete(null);
      fetchTasks();
    } catch (err) {
      const errData = err.response?.data || {};
      setError(errData.error || 'Delete failed');
    } finally {
      setPostLoading(false);
    }
  };

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return 'No Deadline';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  const openMobileMenu = useCallback(() => setMobileMenuOpen(true), []);
  const togglePostForm = useCallback(() => setShowPostForm(v => !v), []);

  return (
    <div className="flex bg-bg-main h-screen overflow-hidden text-text-primary font-inter">
      <WorkspaceSettingsModal isOpen={isWorkspaceSettingsModalOpen} onClose={() => setIsWorkspaceSettingsModalOpen(false)} />
      <Sidebar 
        mobileMenuOpen={mobileMenuOpen}
        closeMobileMenu={closeMobileMenu}
        userProfile={userProfile}
        theme={theme}
        toggleTheme={toggleTheme}
        onLogout={onLogout}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
        tasks={tasks}
      />

      <main className="flex-1 min-w-0 h-screen overflow-y-auto bg-bg-main transition-colors duration-300">
        
        <Header 
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          userProfile={userProfile}
          setShowPostForm={setShowPostForm}
          openMobileMenu={openMobileMenu}
          setIsSettingsModalOpen={setIsSettingsModalOpen}
        />

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          
          {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-start justify-between gap-4 text-sm text-red-700 dark:text-red-300"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}
          <Routes key={currentWorkspace?.id || 'global'}>
            <Route path="workspaces/new" element={<CreateWorkspace />} />
            <Route path="members" element={<WorkspaceMembers />} />
            <Route path="files" element={<div className="flex flex-col items-center justify-center h-64 text-center text-text-secondary"><FileText size={48} className="mb-4 text-text-muted" /><h2 className="text-xl font-bold text-text-primary">Files & Resources</h2><p>Coming soon to Team Workspaces</p></div>} />

            <Route path="team-tasks" element={<WorkspaceTasks tasks={tasks} onTaskCreated={() => fetchTasks(searchTerm)} onView={handleView} workspaceMilestones={workspaceMilestones} />} />
            <Route path="activity" element={<WorkspaceActivityFeed />} />
            <Route path="/" element={
              currentWorkspace ? (
                <TeamDashboard tasks={tasks} />
              ) : (
                <DashboardOverview tasks={tasks} loading={tasksLoading} name={userProfile?.name} onView={handleView} onPost={() => navigate('/dashboard/posted-requests', { state: { openForm: true } })} formatDate={formatDate} />
              )
            } />

            <Route path="invitations" element={
              <div className="space-y-8 animate-fade-up">
                 <div className="flex items-center justify-between mb-8">
                     <div>
                        <h2 className="text-3xl font-semibold text-text-primary tracking-tight">Task Requests</h2>
                        <p className="text-text-secondary font-medium">Pending invitations to collaborate on tasks.</p>
                     </div>
                  </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                      {invitationsLoading ? (
                        [...Array(3)].map((_, i) => <TaskMarketCardSkeleton key={i} />)
                      ) : invitations.length === 0 ? (
                        <div className="col-span-full premium-card py-20 text-center border-dashed border-2">
                          <GitMerge size={32} className="mx-auto text-text-secondary/30 mb-4" />
                          <h4 className="text-lg font-semibold text-text-primary">No pending requests</h4>
                          <p className="text-text-secondary font-medium">When someone invites you to their project, it will appear here.</p>
                        </div>
                      ) : (
                        invitations.map((invite) => (
                          <div key={invite.id} className="premium-card flex flex-col h-full bg-accent/5 border-accent/20">
                            <div className="flex-1">
                              <span className="px-2 py-0.5 bg-accent-soft text-accent text-[10px] font-bold uppercase tracking-wider rounded mb-4 inline-block">Invitation</span>
                              <h3 className="text-lg font-semibold text-text-primary mb-2 line-clamp-1">{invite.task_title}</h3>
                              <p className="text-text-secondary text-sm mb-4 opacity-80">
                                <strong>{invite.creator_name}</strong> has invited you to work on this task.
                              </p>
                              
                              <div className="space-y-3 mb-6">
                                <div className="flex items-center gap-2 text-xs text-text-secondary">
                                  <FileText size={14} className="text-accent" />
                                  <span className="font-medium">{invite.task_subject}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-text-secondary">
                                  <Clock size={14} className="text-accent" />
                                  <span className="font-medium">{invite.task_deadline ? formatDate(invite.task_deadline) : 'No Deadline'}</span>
                                </div>
                              </div>
                              
                              <p className="text-xs text-text-secondary line-clamp-3 bg-bg-card/50 p-3 rounded-lg border border-border-subtle/50 mb-4">
                                {invite.task_description || 'No description provided.'}
                              </p>

                              <button 
                                onClick={() => handleView(invite.task_id)}
                                className="w-full py-2 px-3 mb-2 bg-text-primary/5 text-text-secondary hover:text-text-primary text-[10px] font-bold uppercase tracking-widest rounded-lg border border-border-subtle hover:border-text-primary/20 transition-all flex items-center justify-center gap-2"
                              >
                                <ChevronRight size={14} /> View Task Details
                              </button>
                            </div>
                            <div className="flex gap-3 pt-6 border-t border-border-subtle mt-auto">
                               <button 
                                 onClick={() => handleRespondInvitation(invite.id, 'reject')}
                                 className="flex-1 py-2 px-4 border border-border-subtle text-text-secondary text-xs font-semibold rounded-lg hover:text-text-primary hover:bg-text-primary/5 transition-all"
                               >
                                 Decline
                               </button>
                               <button 
                                 onClick={() => handleRespondInvitation(invite.id, 'accept')}
                                 className="flex-1 py-2 px-4 bg-accent text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-all active:scale-95"
                               >
                                 Accept Request
                               </button>
                            </div>
                          </div>
                        ))
                      )}
                   </div>
              </div>
            } />

            <Route path="board" element={
              <div className="space-y-8 animate-fade-up">
                 <div className="flex items-center justify-between mb-8">
                     <div>
                        <h2 className="text-3xl font-semibold text-text-primary tracking-tight">Project Board</h2>
                        <p className="text-text-secondary font-medium">Visualize your workflow and manage task stages.</p>
                     </div>
                  </div>
                  <KanbanBoard 
                    tasks={tasks} 
                    onStatusChange={handleStatusChange} 
                    onView={handleView}
                    formatDate={formatDate}
                  />
              </div>
            } />

            <Route path="market" element={<TaskMarketplace tasks={tasks} loading={tasksLoading} onAccept={handleAccept} onView={handleView} formatDate={formatDate} />} />

            <Route path="*" element={
              <div className="animate-fade-up">
                <div className="flex justify-between items-center mb-10">
                  <div>
                    <h1 className="text-3xl font-semibold text-text-primary">
                      {currentPath === 'posted-requests' ? (showPostForm ? 'Post a task' : 'Your posted tasks') :
                       currentPath === 'invitations' ? 'Task Requests' : 
                       currentPath.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </h1>
                    <p className="text-text-secondary font-medium mt-1">
                      {currentPath === 'posted-requests' ? 'Share a clear brief and find people to build with.' : 'Your task records and details.'}
                    </p>
                  </div>
                  
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    
                    {currentPath !== 'posted-requests' && currentPath !== 'invitations' && (
                      <div className="hidden md:flex bg-bg-card p-1 rounded-xl border border-border-subtle">
                        {[
                          { id: 'all', label: 'All' },
                          { id: 'accepted', label: 'Accepted' },
                          { id: 'in_progress', label: 'In Progress' },
                          { id: 'completed', label: 'Completed' }
                        ].map((filter) => (
                          <button
                            key={filter.id}
                            onClick={() => setStatusFilter(filter.id)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              statusFilter === filter.id 
                                ? 'bg-accent text-white shadow-sm' 
                                : 'text-text-secondary hover:text-text-primary'
                            }`}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {currentPath !== 'posted-requests' && currentPath !== 'invitations' && (
                      <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="md:hidden bg-bg-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-accent/30"
                      >
                        <option value="all">All Status</option>
                        <option value="accepted">Accepted</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    )}

                    {currentPath === 'posted-requests' && (
                      <button
                        className={showPostForm ? "ui-button-secondary" : "ui-button-primary"}
                        onClick={togglePostForm}
                      >
                        {showPostForm ? 'Cancel' : '+ Create Task'}
                      </button>
                    )}
                  </div>
                </div>

                {showPostForm && <PostTaskForm task={newTask} setTask={setNewTask} onSubmit={handlePostTask} onCancel={() => setShowPostForm(false)} loading={postLoading} milestones={currentWorkspace ? workspaceMilestones : []} onEstimate={handleAiPredictPriority} onSuggestLabels={handleAiSuggestLabels} onImprove={handleAiImproveWriting} estimating={isPredictingPriority} suggesting={isSuggestingLabels} improving={isImprovingWriting} />}

                {!showPostForm && (
                <div className="premium-card">
                   <div className="space-y-4">
                     {tasksLoading ? (
                       [...Array(5)].map((_, i) => <TaskRowSkeleton key={i} />)
                     ) : filteredTasks.length === 0 ? (
                        <div className="py-20 text-center">
                           <AlertCircle size={32} className="mx-auto text-text-secondary/20 mb-4" />
                           <p className="text-text-secondary font-medium">No tasks match your current view or search.</p>
                        </div>
                     ) : (
                       filteredTasks.map((task) => (
                         <TaskRow
                           key={task.id}
                           task={task}
                           currentPath={currentPath}
                           userProfile={userProfile}
                           onAccept={handleAccept}
                           onStatusChange={handleStatusChange}
                           onDelete={handleDeleteTask}
                           onView={handleView}
                           formatDate={formatDate}
                         />
                       ))
                     )}
                   </div>
                 </div>
                )}
              </div>
            } />
          </Routes>
        </div>
      </main>
      {!mobileMenuOpen && (
        <button 
          onClick={() => setMobileMenuOpen(true)}
          className="fixed bottom-6 right-6 md:hidden w-12 h-12 bg-accent text-white rounded-full flex items-center justify-center shadow-lg z-50 transition-all active:scale-90"
        >
          <Menu size={20} />
        </button>
      )}
      {mobileMenuOpen && (
         <button 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed bottom-6 right-6 md:hidden w-12 h-12 bg-bg-card text-text-primary border border-border-subtle rounded-full flex items-center justify-center shadow-lg z-[60]"
        >
          <X size={20} />
        </button>
      )}
      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        userProfile={userProfile}
        profileFormData={profileFormData}
        setProfileFormData={setProfileFormData}
        handleUpdateProfile={handleUpdateProfile}
        profileLoading={profileLoading}
        theme={theme}
        toggleTheme={toggleTheme}
        onLogout={onLogout}
      />
      {taskToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-card rounded-xl w-full max-w-sm shadow-2xl overflow-hidden border border-border-subtle animate-scale-up">
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-semibold text-text-primary tracking-tight mb-2">Delete Task?</h3>
              <p className="text-sm text-text-secondary font-medium leading-relaxed">This action cannot be undone. All progress and data associated with this task will be lost.</p>
            </div>
            <div className="p-6 bg-bg-main/30 border-t border-border-subtle flex gap-4">
              <button 
                onClick={() => setTaskToDelete(null)} 
                className="flex-1 py-2.5 text-text-secondary font-semibold rounded-xl hover:text-text-primary transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                disabled={postLoading}
                className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {postLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}