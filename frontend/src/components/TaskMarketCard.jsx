import { Clock, Users } from 'lucide-react';
import Avatar from './Avatar.jsx';

function objectivePreview(description = '') {
  const objective = description.match(/(?:^|\n)Objective\s*\n([\s\S]*?)(?:\n\s*\n|$)/i);
  return (objective?.[1] || description.replace(/^Sample collaboration task[^\n]*\n*/i, '')).replace(/\s+/g, ' ').trim() || 'Open this task to see the requirements and deliverables.';
}

const priorityStyle = {
  Critical: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  High: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
  Medium: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  Low: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300',
};

export default function TaskMarketCard({ task, onAccept, onView, formatDate }) {
  const available = Math.max(0, (task.capacity || 1) - (task.slots_filled || 0));
  const labels = (task.labels || []).filter(label => !/^(sample|global-starter-v\d+|seed[:_-].*)$/i.test(label) && label.toLowerCase().replaceAll('-', ' ') !== task.subject?.toLowerCase()).slice(0, 2);
  return (
    <article className="market-task-card flex flex-col rounded-xl border border-border-subtle bg-bg-card p-5 transition-shadow hover:shadow-md min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4"><span className="text-xs font-medium text-text-secondary">{task.subject || 'General'}</span>{task.priority && <span className={`px-2 py-1 rounded-md text-xs font-medium ${priorityStyle[task.priority] || priorityStyle.Medium}`}>{task.priority}</span>}</div>
      <h2 className="text-base font-semibold leading-6 min-h-12 line-clamp-2"><button onClick={() => onView(task.id)} className="text-left hover:text-accent transition-colors">{task.title}</button></h2>
      <p className="text-sm text-text-secondary leading-6 line-clamp-3 mt-3 mb-4 min-h-[72px]">{objectivePreview(task.description)}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-secondary"><span className="inline-flex items-center gap-1.5"><Clock size={14} />{task.deadline ? `Due ${formatDate(task.deadline)}` : 'Flexible deadline'}</span><span className="inline-flex items-center gap-1.5"><Users size={14} />{available} {available === 1 ? 'spot' : 'spots'} open</span></div>
      {labels.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{labels.map(label => <span key={label} className="text-xs text-text-secondary bg-bg-main rounded px-2 py-1">{label.replaceAll('-', ' ')}</span>)}</div>}
      <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border-subtle"><Avatar name={task.creator_name} photoUrl={task.creator_photo_url} size="xs" /><span className="text-xs text-text-secondary truncate">{task.creator_name || 'Community member'}</span></div>
      <div className="grid grid-cols-2 gap-2 mt-4"><button onClick={() => onView(task.id)} className="ui-button-secondary text-xs">View details</button><button onClick={() => onAccept(task.id)} disabled={available === 0} className="ui-button-primary text-xs">{available ? 'Accept task' : 'Full'}</button></div>
    </article>
  );
}
