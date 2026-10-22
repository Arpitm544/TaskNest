import React, { useState } from 'react';
import { Plus, CheckSquare, Clock, AlignLeft, Paperclip, MoreVertical, CheckCircle2, RefreshCw, Target, Sparkles, Upload, File } from 'lucide-react';
import api from '../api/axios';
import { useWorkspace } from '../context/WorkspaceContext';

const formatDate = (dateString) => {
  if (!dateString) return 'No Deadline';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateString));
};

export default function WorkspaceTasks({ tasks, onTaskCreated, onView, workspaceMilestones = [] }) {
  const { currentWorkspace } = useWorkspace();
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [isPredictingPriority, setIsPredictingPriority] = useState(false);
  const [isSuggestingLabels, setIsSuggestingLabels] = useState(false);
  const [isImprovingWriting, setIsImprovingWriting] = useState(false);
  
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    subject: '',
    priority: 'Medium',
    deadline: '',
    issue_type: 'Task',
    labels: '',
    milestone_id: '',
    attachment: null
  });

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

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTask.title || !newTask.subject) return;
    
    setCreateLoading(true);
    setError('');
    
    try {
      let attachmentUrl = '';
      if (newTask.attachment) {
        const formData = new FormData();
        formData.append('attachment', newTask.attachment);
        const uploadRes = await api.post('/api/upload', formData);
        attachmentUrl = uploadRes.data.url;
      }

      await api.post(`/api/workspaces/${currentWorkspace.id}/tasks`, {
        title: newTask.title,
        description: newTask.description,
        subject: newTask.subject,
        deadline: newTask.deadline ? new Date(newTask.deadline).toISOString() : null,
        max_assignees: 1, // Defaulting max assignees for team tasks to 1
        priority: newTask.priority,
        issue_type: newTask.issue_type,
        labels: newTask.labels.split(',').map(s => s.trim()).filter(s => s !== ''),
        attachment_url: attachmentUrl,
        milestone_id: newTask.milestone_id ? parseInt(newTask.milestone_id, 10) : null
      });
      
      setShowCreate(false);
      setNewTask({ title: '', description: '', subject: '', priority: 'Medium', deadline: '', issue_type: 'Task', labels: '', milestone_id: '', attachment: null });
      if (onTaskCreated) onTaskCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create task');
    } finally {
      setCreateLoading(false);
    }
  };

  if (!currentWorkspace) return null;

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold text-text-primary tracking-tight">Team Tasks</h2>
          <p className="text-text-secondary font-medium">Manage and track all tasks for your workspace.</p>
        </div>
        <button 
          onClick={() => setShowCreate(!showCreate)}
          className="px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all flex items-center gap-2 shadow-accent/20 shadow-md"
        >
          <Plus size={16} /> {showCreate ? 'Cancel' : 'Create Task'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl text-sm mb-6">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 shadow-premium mb-8 animate-fade-in">
          <h3 className="text-xl font-semibold mb-8 text-text-primary">Post a team task</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Title</label>
              <input 
                type="text" 
                required
                value={newTask.title}
                onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                className="w-full bg-bg-subtle border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary" 
                placeholder="e.g. Design System for Fintech" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Subject</label>
              <input 
                type="text" 
                required
                value={newTask.subject}
                onChange={(e) => setNewTask({...newTask, subject: e.target.value})}
                className="w-full bg-bg-subtle border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary" 
                placeholder="e.g. UI/UX Design" 
              />
            </div>

            {workspaceMilestones && workspaceMilestones.length > 0 && (
              <div className="space-y-2 col-span-1 md:col-span-2">
                 <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Milestone (Optional)</label>
                 <select 
                    value={newTask.milestone_id}
                    onChange={(e) => setNewTask({...newTask, milestone_id: e.target.value})}
                    className="w-full bg-bg-subtle border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary" 
                 >
                    <option value="">None</option>
                    {workspaceMilestones.map(m => (
                      <option key={m.id} value={m.id}>{m.title}</option>
                    ))}
                  </select>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 col-span-1 md:col-span-2">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center justify-between">
                  Priority
                  <button 
                    type="button" 
                    onClick={handleAiPredictPriority}
                    disabled={isPredictingPriority || !newTask.title || !newTask.description}
                    className="text-[9px] font-bold text-accent bg-accent-soft px-2 py-0.5 rounded hover:bg-accent/20 transition-all flex items-center gap-1 uppercase border border-accent/20"
                  >
                    {isPredictingPriority ? <RefreshCw size={10} className="animate-spin" /> : <Target size={10} />}
                    Estimate
                  </button>
                </label>
                <select 
                  value={newTask.priority}
                  onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                  className="w-full bg-bg-subtle border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary" 
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Deadline</label>
                <input 
                  type="date" 
                  value={newTask.deadline}
                  onChange={(e) => setNewTask({...newTask, deadline: e.target.value})}
                  className="w-full bg-bg-subtle border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Issue Type</label>
                <select 
                  value={newTask.issue_type}
                  onChange={(e) => setNewTask({...newTask, issue_type: e.target.value})}
                  className="w-full bg-bg-subtle border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary" 
                >
                  <option value="Task">Task</option>
                  <option value="Bug">Bug</option>
                  <option value="Story">Story</option>
                  <option value="Improvement">Improvement</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Labels (comma separated)</label>
                  <button 
                    type="button"
                    onClick={handleAiSuggestLabels}
                    disabled={isSuggestingLabels || !newTask.title || !newTask.description}
                    className="text-[10px] font-bold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isSuggestingLabels ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    AI Suggest
                  </button>
                </div>
                <input 
                  type="text" 
                  value={newTask.labels}
                  onChange={(e) => setNewTask({...newTask, labels: e.target.value})}
                  className="w-full bg-bg-subtle border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary" 
                  placeholder="e.g. frontend, bug, api"
                />
              </div>
            </div>
            
            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Attachment</label>
              <div className="relative">
                 <input 
                    type="file" 
                    accept="image/*,application/pdf"
                    onChange={(e) => setNewTask({...newTask, attachment: e.target.files[0]})}
                    className="hidden" 
                    id="file-upload"
                 />
                 <label htmlFor="file-upload" className="w-full bg-bg-subtle border-dashed border border-text-primary/10 rounded-xl p-4 text-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-text-primary/5 transition-colors text-text-primary">
                    {newTask.attachment ? (
                       <><File size={16} className="text-accent" /> {newTask.attachment.name}</>
                    ) : (
                       <><Upload size={16} className="text-text-secondary" /> Choose file...</>
                    )}
                 </label>
              </div>
            </div>
            
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Description</label>
                <button 
                  type="button"
                  onClick={handleAiImproveWriting}
                  disabled={isImprovingWriting || !newTask.title || !newTask.description}
                  className="text-[10px] font-bold text-accent hover:opacity-80 transition-all flex items-center gap-1 disabled:opacity-30"
                >
                  {isImprovingWriting ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                  ✨ Improve Writing
                </button>
              </div>
              <textarea 
                required
                value={newTask.description}
                onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                className="w-full bg-bg-subtle border border-border-subtle rounded-xl p-4 text-sm focus:border-accent/30 outline-none text-text-primary" 
                rows={4} 
                placeholder="Describe the requirements..."
              ></textarea>
            </div>
            <div className="md:col-span-2 flex justify-end gap-4 mt-4">
              <button 
                type="button" 
                onClick={() => setShowCreate(false)} 
                className="px-6 py-2.5 text-text-secondary font-semibold rounded-xl hover:text-text-primary transition-colors"
              >
                Discard
              </button>
              <button 
                type="submit" 
                disabled={createLoading} 
                className="px-8 py-2.5 bg-accent text-white font-semibold rounded-xl hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
              >
                {createLoading ? 'Posting...' : 'Post Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {(!tasks || tasks.length === 0) ? (
        <div className="bg-bg-card border border-border-subtle rounded-2xl p-12 text-center shadow-sm">
          <CheckSquare size={48} className="text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-bold text-text-primary mb-2">No Tasks Yet</h3>
          <p className="text-sm text-text-secondary mb-6">Create your first task to get your team started.</p>
          <button 
            onClick={() => setShowCreate(true)}
            className="px-5 py-2 bg-accent/10 text-accent rounded-xl text-sm font-semibold hover:bg-accent/20 transition-all inline-flex items-center gap-2"
          >
            <Plus size={16} /> Create Task
          </button>
        </div>
      ) : (
        <div className="bg-bg-card border border-border-subtle rounded-2xl shadow-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-sidebar">
                  <th className="py-4 px-6 text-xs font-bold text-text-secondary uppercase tracking-wider">Task</th>
                  <th className="py-4 px-6 text-xs font-bold text-text-secondary uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 text-xs font-bold text-text-secondary uppercase tracking-wider">Priority</th>
                  <th className="py-4 px-6 text-xs font-bold text-text-secondary uppercase tracking-wider">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {tasks.map(task => (
                  <tr key={task.id} onClick={() => onView && onView(task.id)} className="hover:bg-bg-subtle transition-colors group cursor-pointer">
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors line-clamp-1">{task.title}</span>
                        {task.description && (
                           <span className="text-xs text-text-secondary line-clamp-1 mt-1 flex items-center gap-1">
                             <AlignLeft size={12} /> {task.description}
                           </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        task.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                        task.status === 'in_progress' ? 'bg-blue-500/10 text-blue-500' :
                        task.status === 'submitted' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-zinc-500/10 text-zinc-500'
                      }`}>
                        {task.status === 'completed' && <CheckCircle2 size={12} />}
                        {task.status?.replace('_', ' ') || 'Pending'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                        task.priority === 'High' || task.priority === 'Critical' ? 'bg-red-500/10 text-red-600 border-red-200' :
                        task.priority === 'Medium' ? 'bg-orange-500/10 text-orange-600 border-orange-200' :
                        'bg-blue-500/10 text-blue-600 border-blue-200'
                      }`}>
                        {task.priority || 'Medium'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                        <Clock size={14} />
                        {formatDate(task.deadline || task.due_date)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
