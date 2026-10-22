import { useState } from 'react';
import { Briefcase, Search, ArrowLeft, ArrowRight, X } from 'lucide-react';
import TaskMarketCard from './TaskMarketCard.jsx';
import { TaskMarketCardSkeleton } from './Skeleton.jsx';

export default function TaskMarketplace({ tasks, loading, onAccept, onView, formatDate }) {
  const [category, setCategory] = useState('all');
  const [priority, setPriority] = useState('all');
  const [sort, setSort] = useState('newest');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const categories = [...new Set(tasks.map(task => task.subject).filter(Boolean))].sort();
  const ranks = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  const filtered = tasks.filter(task => (category === 'all' || task.subject === category) && (priority === 'all' || task.priority === priority) && `${task.title} ${task.description} ${task.subject} ${task.creator_name}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => {
    if (sort === 'priority') return (ranks[b.priority] || 0) - (ranks[a.priority] || 0) || String(a.id).localeCompare(String(b.id));
    if (sort === 'deadline') return (a.deadline ? new Date(a.deadline).getTime() : Infinity) - (b.deadline ? new Date(b.deadline).getTime() : Infinity) || String(a.id).localeCompare(String(b.id));
    return new Date(b.created_at) - new Date(a.created_at) || String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
  });
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * 12;
  const reset = () => { setCategory('all'); setPriority('all'); setQuery(''); setPage(1); };
  const filtering = category !== 'all' || priority !== 'all' || query.trim() !== '';
  const selectClass = 'bg-bg-card border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary min-w-0';
  return (
    <div className="space-y-6 animate-fade-up">
      <div><p className="text-xs font-medium text-accent mb-2">COMMUNITY PROJECTS</p><h1 className="text-2xl sm:text-3xl font-semibold">Task marketplace</h1><p className="text-sm text-text-secondary mt-2">Find a project that fits your skills. Read the details, then join in.</p></div>
      <section aria-label="Filter tasks" className="rounded-xl bg-bg-card border border-border-subtle p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,.8fr)_minmax(0,1fr)]">
          <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-text-secondary" /><input aria-label="Search marketplace" placeholder="Search tasks or skills…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} className={`${selectClass} w-full pl-9`} /></div>
          <select aria-label="Category" value={category} onChange={event => { setCategory(event.target.value); setPage(1); }} className={selectClass}><option value="all">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select>
          <select aria-label="Priority" value={priority} onChange={event => { setPriority(event.target.value); setPage(1); }} className={selectClass}><option value="all">All priorities</option>{['Critical', 'High', 'Medium', 'Low'].map(value => <option key={value}>{value}</option>)}</select>
          <select aria-label="Sort tasks" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }} className={selectClass}><option value="newest">Newest first</option><option value="deadline">Deadline: soonest</option><option value="priority">Priority: highest</option></select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-xs text-text-secondary">{loading ? 'Loading tasks…' : `${filtered.length} ${filtered.length === 1 ? 'task' : 'tasks'} available${filtered.length ? ` · Showing ${start + 1}–${Math.min(start + 12, filtered.length)}` : ''}`}</p>{filtering && <button onClick={reset} className="text-xs text-accent inline-flex items-center gap-1"><X size={13} /> Clear filters</button>}</div>
      </section>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{loading ? Array.from({ length: 6 }, (_, index) => <TaskMarketCardSkeleton key={index} />) : filtered.length === 0 ? <div className="col-span-full premium-card text-center py-14"><Briefcase size={28} className="mx-auto text-accent mb-4" /><h2 className="font-semibold">{filtering ? 'No tasks match your filters' : 'New projects will appear here'}</h2><p className="text-sm text-text-secondary mt-2">{filtering ? 'Try another category, priority, or search term.' : 'Check back soon for opportunities from the community.'}</p>{filtering && <button onClick={reset} className="ui-button-secondary mt-5">Clear filters</button>}</div> : filtered.slice(start, start + 12).map(task => <TaskMarketCard key={task.id} task={task} onAccept={onAccept} onView={onView} formatDate={formatDate} />)}</div>
      {!loading && pages > 1 && <nav aria-label="Task pages" className="flex items-center justify-between gap-3 border-t border-border-subtle pt-5"><button className="ui-button-secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ArrowLeft size={15} /> Previous</button><span className="text-xs sm:text-sm text-text-secondary">Page {currentPage} of {pages}</span><button className="ui-button-secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next <ArrowRight size={15} /></button></nav>}
    </div>
  );
}
