import { ArrowRight, Briefcase, CheckCircle2, Clock, LayoutDashboard, Plus, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const stages = [
  { title: 'To do', statuses: ['pending', 'todo', 'to do'], dot: 'bg-slate-400' },
  { title: 'In progress', statuses: ['accepted', 'in_progress', 'in progress', 'in-progress'], dot: 'bg-blue-500' },
  { title: 'In review', statuses: ['submitted', 'in_review', 'in review'], dot: 'bg-amber-500' },
  { title: 'Completed', statuses: ['completed', 'done'], dot: 'bg-emerald-500' },
];

export default function DashboardOverview({ tasks, loading, name, onView, onPost, formatDate }) {
  const [now] = useState(() => Date.now());
  const completed = tasks.filter(task => ['completed', 'done'].includes(task.status)).length;
  const dueSoon = tasks.filter(task => task.deadline && !['completed', 'done'].includes(task.status) && new Date(task.deadline) <= new Date(now + 7 * 86400000));
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const recent = [...tasks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-medium text-accent mb-2">YOUR PERSONAL OVERVIEW</p><h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Welcome back{name ? `, ${name.split(' ')[0]}` : ''}</h1><p className="text-sm text-text-secondary mt-2">{loading ? 'Getting your workspace ready…' : tasks.length ? 'A clear view of your tasks and what comes next.' : 'Find something worth working on. Build it with your community.'}</p></div>
        <button onClick={onPost} className="ui-button-primary"><Plus size={16} /> Post a task</button>
      </div>
      {loading ? <div className="grid gap-4 sm:grid-cols-3" aria-label="Loading dashboard" aria-busy="true">{[0, 1, 2].map(key => <div key={key} className="premium-card h-28 animate-pulse" />)}</div> : tasks.length === 0 ? (
        <>
          <section className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/10 via-bg-card to-bg-card p-6 sm:p-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-card border border-accent/15 text-accent mb-6"><Sparkles size={24} /></div>
            <p className="text-xs font-semibold text-accent mb-3">A FRESH START</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight max-w-lg">Your next project starts with one task.</h2>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-xl mt-3">Explore community projects, choose a task that fits your skills, or post an idea and invite others to help.</p>
            <div className="flex flex-wrap gap-3 mt-7"><Link to="/dashboard/market" className="ui-button-primary"><Briefcase size={16} /> Browse marketplace <ArrowRight size={16} /></Link><button onClick={onPost} className="ui-button-secondary"><Plus size={16} /> Post your own task</button></div>
          </section>
          <div className="grid gap-4 sm:grid-cols-3">{[
            ['01', 'Find your fit', 'Browse by category and priority to find a project you can contribute to.'],
            ['02', 'Make it yours', 'Read the task details and accept an available spot when you’re ready.'],
            ['03', 'Keep moving', 'Track your milestones and move your work forward on the board.'],
          ].map(([number, title, text]) => <div key={number} className="premium-card"><span className="text-xs font-semibold text-accent">{number}</span><h3 className="text-sm font-semibold mt-3">{title}</h3><p className="text-sm text-text-secondary leading-relaxed mt-2">{text}</p></div>)}</div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">{[
            ['Open tasks', tasks.length - completed, <LayoutDashboard size={18} />],
            ['Due soon or overdue', dueSoon.length, <Clock size={18} />],
            ['Completed', completed, <CheckCircle2 size={18} />],
          ].map(([label, value, icon]) => <div key={label} className="premium-card flex items-start justify-between"><div><p className="text-sm text-text-secondary">{label}</p><p className="text-3xl font-semibold mt-3">{value}</p></div><span className="rounded-lg p-2 bg-accent-soft text-accent">{icon}</span></div>)}</div>
          <section className="premium-card min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6"><div><h2 className="text-lg font-semibold">Workflow overview</h2><p className="text-sm text-text-secondary mt-1">A quick look at each stage. Open a task to keep it moving.</p></div><Link to="/dashboard/board" className="text-sm font-medium text-accent inline-flex items-center gap-2">Full board <ArrowRight size={16} /></Link></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stages.map(stage => {
              const items = tasks.filter(task => stage.statuses.includes(task.status));
              return <div key={stage.title} className="min-w-0 rounded-xl bg-bg-main border border-border-subtle p-3"><div className="flex items-center gap-2 mb-3"><span className={`h-2 w-2 rounded-full ${stage.dot}`} /><h3 className="text-xs font-semibold">{stage.title}</h3><span className="ml-auto text-xs text-text-secondary">{items.length}</span></div><div className="space-y-2">{items.slice(0, 2).map(task => <button key={task.id} onClick={() => onView(task.id)} className="w-full text-left rounded-lg bg-bg-card border border-border-subtle p-3 hover:border-accent/40 transition-colors"><p className="text-sm font-medium line-clamp-2">{task.title}</p><p className="text-xs text-text-secondary mt-3">{task.deadline ? `Due ${formatDate(task.deadline)}` : 'No deadline'}</p></button>)}{items.length === 0 && <p className="py-5 text-center text-xs text-text-secondary">No tasks at this stage</p>}{items.length > 2 && <Link to="/dashboard/board" className="block pt-1 text-xs text-accent">+{items.length - 2} more on the board</Link>}</div></div>;
            })}</div>
          </section>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><section className="premium-card"><div className="flex items-center justify-between mb-3"><h2 className="text-lg font-semibold">Recent tasks</h2><Link to="/dashboard/my-tasks" className="text-sm text-accent">View all</Link></div>{recent.map(task => <button key={task.id} onClick={() => onView(task.id)} className="w-full flex items-center justify-between gap-4 py-3 border-b border-border-subtle last:border-0 text-left"><span className="text-sm font-medium truncate">{task.title}</span><ArrowRight size={16} className="shrink-0 text-text-secondary" /></button>)}</section><section className="premium-card"><h2 className="text-lg font-semibold">Your progress</h2><p className="text-3xl font-semibold mt-5">{progress}%</p><div role="progressbar" aria-label="Completed tasks" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-2 rounded-full bg-bg-main mt-4 overflow-hidden"><div className="h-full bg-accent rounded-full" style={{ width: `${progress}%` }} /></div><p className="text-sm text-text-secondary mt-3">{completed} of {tasks.length} tasks completed</p></section></div>
        </>
      )}
    </div>
  );
}
