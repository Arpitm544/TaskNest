import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Menu } from 'lucide-react';

const Header = React.memo(({ 
  userProfile, 
  searchTerm, 
  setSearchTerm,
  openMobileMenu,
  setIsSettingsModalOpen
}) => {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 bg-bg-main/70 backdrop-blur-md border-b border-border-subtle px-4 md:px-8 h-16 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <button 
          onClick={openMobileMenu}
          className="md:hidden p-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="relative flex-1 group">
          <Search 
            size={18} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50 group-focus-within:text-accent transition-colors" 
          />
          <input
            aria-label="Search tasks"
            type="text"
            placeholder="Search tasks and categories…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-background-secondary border border-border-subtle rounded-xl py-2.5 pl-10 pr-12 text-sm font-medium text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent/30 focus:ring-4 focus:ring-accent/5 transition-all"
          />
          <div className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-1 px-1.5 py-1 bg-bg-main border border-border-subtle rounded-md pointer-events-none group-focus-within:opacity-0 transition-opacity">
            <span className="text-[10px] font-bold text-text-secondary opacity-60">⌘</span>
            <span className="text-[10px] font-bold text-text-secondary opacity-60">K</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 ml-4">
        <button 
          onClick={() => setIsSettingsModalOpen ? setIsSettingsModalOpen(true) : navigate('/dashboard/profile?settings=true')}
          aria-label="Open account settings"
          className="w-8 h-8 rounded-full overflow-hidden border border-text-primary/10 shadow-sm hover:border-accent/50 transition-all active:scale-95"
        >
          <img src={userProfile?.photo_url || `https://ui-avatars.com/api/?name=${userProfile?.name}`} alt="Profile" className="w-full h-full object-cover" />
        </button>
      </div>
    </header>
  );
});

export default Header;
