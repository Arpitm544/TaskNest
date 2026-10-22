import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Briefcase, 
  PieChart, FileText, X, UserCircle, 
  Sun, Moon, LogOut, CheckSquare, GitMerge, Users, Kanban, Layers, Settings, ChevronDown, Plus, Globe, Target
} from 'lucide-react';
import Avatar from './Avatar.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';

const globalNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, end: true },
  { to: '/dashboard/board', label: 'Kanban Board', icon: <Kanban size={18} /> },
  { to: '/dashboard/market', label: 'Marketplace', icon: <Briefcase size={18} /> },
  { to: '/dashboard/my-tasks', label: 'My Tasks', icon: <CheckSquare size={18} /> },
  { to: '/dashboard/invitations', label: 'Task Requests', icon: <Users size={18} /> },
  { to: '/dashboard/posted-requests', label: 'Post Task', icon: <FileText size={18} /> },
];

const teamNavItems = [
  { to: '/dashboard', label: 'Team Dashboard', icon: <LayoutDashboard size={18} />, end: true },

  { to: '/dashboard/team-tasks', label: 'Tasks', icon: <CheckSquare size={18} /> },
  { to: '/dashboard/board', label: 'Sprint Board', icon: <Kanban size={18} /> },
  { to: '/dashboard/members', label: 'Members', icon: <Users size={18} /> },
  { to: '/dashboard/activity', label: 'Activity Feed', icon: <PieChart size={18} /> },
  { to: '/dashboard/files', label: 'Files & Resources', icon: <FileText size={18} /> },
];

const Sidebar = React.memo(({ 
  mobileMenuOpen, 
  closeMobileMenu, 
  userProfile, 
  theme, 
  toggleTheme, 
  onLogout, 
  setIsSettingsModalOpen
}) => {
  const navigate = useNavigate();
  const { workspaces, currentWorkspace, selectWorkspace } = useWorkspace();
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);

  return (
    <aside className={`w-[240px] bg-bg-sidebar text-text-secondary flex flex-col shrink-0 z-50 py-8 h-screen border-r border-border-subtle transition-transform duration-300 ease-out ${mobileMenuOpen ? 'translate-x-0 fixed inset-y-0 left-0 shadow-2xl' : '-translate-x-full fixed inset-y-0 left-0 md:relative md:translate-x-0 md:left-auto'}`}>
      <div className="px-6 mb-6 relative">
        <button 
          onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-text-primary/5 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-white ${currentWorkspace ? 'bg-indigo-500' : 'bg-accent'}`}>
              {currentWorkspace ? <Briefcase size={16} /> : <Globe size={16} />}
            </div>
            <div className="text-left flex-1 min-w-0">
              <h1 className="text-sm font-semibold text-text-primary truncate">
                {currentWorkspace ? currentWorkspace.name : 'Global Workspace'}
              </h1>
              <p className="text-[10px] text-text-secondary">
                {currentWorkspace ? 'Team Workspace' : 'Community'}
              </p>
            </div>
          </div>
          <ChevronDown size={14} className="text-text-secondary shrink-0" />
        </button>

        {showWorkspaceMenu && (
          <div className="absolute top-full left-6 right-6 mt-1 bg-bg-card border border-border-subtle rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in">
            <div className="p-1">
              <button
                onClick={() => { 
                  selectWorkspace(null); 
                  setShowWorkspaceMenu(false); 
                  navigate('/dashboard');
                }}
                className={`w-full flex items-center gap-2 p-2 rounded-lg text-sm transition-colors ${!currentWorkspace ? 'bg-accent/10 text-accent font-semibold' : 'hover:bg-bg-subtle text-text-secondary hover:text-text-primary'}`}
              >
                <Globe size={14} /> Global Workspace
              </button>
              
              {workspaces.length > 0 && <div className="h-px bg-border-subtle my-1 mx-2" />}
              
              {workspaces.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => { 
                    selectWorkspace(ws.id); 
                    setShowWorkspaceMenu(false); 
                    navigate('/dashboard');
                  }}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-sm transition-colors truncate ${currentWorkspace?.id === ws.id ? 'bg-accent/10 text-accent font-semibold' : 'hover:bg-bg-subtle text-text-secondary hover:text-text-primary'}`}
                >
                  <Briefcase size={14} /> <span className="truncate">{ws.name}</span>
                </button>
              ))}
              
              {currentWorkspace?.user_role && (currentWorkspace.user_role === 'owner' || currentWorkspace.user_role === 'admin') && (
                <button
                  onClick={() => { 
                    setShowWorkspaceMenu(false);
                    if (window.dispatchEvent) {
                      window.dispatchEvent(new CustomEvent('openWorkspaceSettings'));
                    }
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-sm hover:bg-bg-subtle text-text-secondary hover:text-text-primary transition-colors"
                >
                  <Settings size={14} /> Manage Team
                </button>
              )}
              
              <div className="h-px bg-border-subtle my-1 mx-2" />
              
              <button
                onClick={() => { 
                  setShowWorkspaceMenu(false);
                  navigate('/dashboard/workspaces/new');
                }}
                className="w-full flex items-center gap-2 p-2 rounded-lg text-sm hover:bg-bg-subtle text-text-secondary hover:text-text-primary transition-colors"
              >
                <Plus size={14} /> Create Team
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 flex items-center justify-between mb-2 md:hidden">
        <button className="p-2 text-text-secondary hover:text-text-primary" onClick={closeMobileMenu}>
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {(currentWorkspace ? teamNavItems : globalNavItems).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive 
                  ? 'bg-accent/10 text-accent font-semibold shadow-sm' 
                  : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary'
              }`
            }
          >
            <div className="transition-transform duration-200 group-hover:scale-110">
              {item.icon}
            </div>
            {item.label}
          </NavLink>
        ))}
      </nav>
        


      <div className="px-4 mt-auto space-y-1">
         {toggleTheme && (
           <button 
             onClick={toggleTheme}
             className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm hover:bg-text-primary/5 hover:text-text-primary transition-colors"
           >
             {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} 
             {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
           </button>
         )}
         <button 
           onClick={() => {
             if (setIsSettingsModalOpen) {
               setIsSettingsModalOpen(true);
             } else {
               navigate('/dashboard?settings=true');
             }
             closeMobileMenu();
           }}
           className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm hover:bg-text-primary/5 hover:text-text-primary transition-colors"
         >
           <Settings size={18} /> Settings
         </button>
         {userProfile && (
           <div 
             onClick={() => {
               if (setIsSettingsModalOpen) {
                 setIsSettingsModalOpen(true);
               } else {
                 navigate('/dashboard?settings=true');
               }
               closeMobileMenu();
             }}
             className="mt-4 flex items-center gap-3 px-4 py-4 bg-text-primary/5 rounded-2xl border border-border-subtle cursor-pointer hover:bg-text-primary/10 transition-all group"
           >
             <Avatar name={userProfile?.name} photoUrl={userProfile?.photo_url} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-semibold text-text-primary truncate leading-none group-hover:text-accent transition-colors">{userProfile?.name || 'Loading...'}</p>
                </div>
                <p className="text-[10px] text-text-secondary truncate">{userProfile?.email}</p>
              </div>
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 onLogout();
               }} 
               className="text-text-secondary hover:text-red-400 transition-colors p-1"
             >
                <LogOut size={14} />
             </button>
           </div>
         )}
      </div>
    </aside>
  );
});

export default Sidebar;
