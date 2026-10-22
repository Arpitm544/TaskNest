import React, { useState } from 'react';
import { 
  X, User, Shield, Palette, 
  Camera, LogOut, Trash2, Moon, Sun, Key, AlertTriangle, CheckCircle2
} from 'lucide-react';
import Avatar from './Avatar.jsx';
import api from '../api/axios.js';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase.js';

const SettingsModal = ({ 
  isOpen, 
  onClose, 
  userProfile, 
  profileFormData, 
  setProfileFormData, 
  handleUpdateProfile, 
  profileLoading,
  theme,
  toggleTheme,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: ''
  });
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [securitySuccess, setSecuritySuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const isGoogleAccount = userProfile?.provider === 'google';

  if (!isOpen) return null;

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User size={16} /> },
    { id: 'preferences', label: 'Appearance', icon: <Palette size={16} /> },
    { id: 'security', label: 'Account', icon: <Shield size={16} /> },
  ];

  const renderProfileTab = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-lg bg-bg-main overflow-hidden border border-border-subtle">
            <img 
              src={profileFormData.photoPreview || `https://ui-avatars.com/api/?name=${profileFormData.name}&background=random`} 
              alt="Avatar Preview" 
              className="w-full h-full object-cover"
            />
          </div>
          <div>
             <h4 className="text-base font-semibold text-text-primary">{userProfile?.name}</h4>
             <p className="text-xs text-text-secondary">{userProfile?.email}</p>
          </div>
        </div>
        {!isEditingProfile && (
          <button 
            onClick={() => setIsEditingProfile(true)}
            className="px-4 py-1.5 text-xs font-medium bg-bg-main border border-border-subtle rounded-lg hover:bg-bg-card transition-colors"
          >
            Edit Profile
          </button>
        )}
      </div>

      {!isEditingProfile ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12 py-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Full Name</p>
            <p className="text-sm font-medium text-text-primary">{userProfile?.name || 'Not set'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">College / Institution</p>
            <p className="text-sm font-medium text-text-primary">{userProfile?.college_name || 'Not set'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Graduation Year</p>
            <p className="text-sm font-medium text-text-primary">{userProfile?.year || 'Not set'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Major / Field</p>
            <p className="text-sm font-medium text-text-primary">{userProfile?.field || 'Not set'}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          <div className="relative inline-block">
             <label htmlFor="profile-photo-settings" className="absolute -bottom-1 -right-1 w-6 h-6 bg-text-primary text-bg-main rounded-md flex items-center justify-center cursor-pointer shadow-lg z-10">
               <Camera size={12} />
               <input 
                 type="file" 
                 id="profile-photo-settings" 
                 className="hidden" 
                 accept="image/*"
                 onChange={(e) => {
                   const file = e.target.files[0];
                   if (file) {
                     setProfileFormData({
                       ...profileFormData,
                       photo: file,
                       photoPreview: URL.createObjectURL(file)
                     });
                   }
                 }}
               />
             </label>
             <p className="text-[10px] text-text-secondary mt-2">Change photo</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-text-secondary">Full Name</label>
              <input 
                type="text" 
                value={profileFormData.name}
                onChange={(e) => setProfileFormData({...profileFormData, name: e.target.value})}
                className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm focus:border-accent outline-none text-text-primary transition-all" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">College / Institution</label>
              <input 
                type="text" 
                value={profileFormData.college_name}
                onChange={(e) => setProfileFormData({...profileFormData, college_name: e.target.value})}
                className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm focus:border-accent outline-none text-text-primary transition-all" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Graduation Year</label>
              <input 
                type="text" 
                value={profileFormData.year}
                onChange={(e) => setProfileFormData({...profileFormData, year: e.target.value})}
                className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm focus:border-accent outline-none text-text-primary transition-all" 
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-text-secondary">Major / Field of Study</label>
              <input 
                type="text" 
                value={profileFormData.field}
                onChange={(e) => setProfileFormData({...profileFormData, field: e.target.value})}
                className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm focus:border-accent outline-none text-text-primary transition-all" 
              />
            </div>
          </div>
          
          <div className="pt-4 flex justify-end gap-3">
             <button 
               onClick={() => setIsEditingProfile(false)}
               className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
             >
               Cancel
             </button>
             <button 
               onClick={() => {
                 handleUpdateProfile();
                 setIsEditingProfile(false);
               }}
               disabled={profileLoading}
               className="px-6 py-2 bg-text-primary text-bg-main text-sm font-medium rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
             >
               Save Changes
             </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderPreferencesTab = () => (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h4 className="text-sm font-medium text-text-primary mb-4">Appearance</h4>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'light', label: 'Light', icon: <Sun size={16} /> },
            { id: 'dark', label: 'Dark', icon: <Moon size={16} /> },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={toggleTheme}
              className={`p-3 rounded-lg border flex items-center justify-center gap-3 transition-all ${
                (mode.id === 'dark' && theme === 'dark') || (mode.id === 'light' && theme !== 'dark')
                  ? 'bg-bg-main border-accent text-accent'
                  : 'bg-bg-card border-border-subtle text-text-secondary hover:border-text-primary/20'
              }`}
            >
              {mode.icon}
              <span className="text-xs font-medium">{mode.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const handleChangePassword = async () => {
    if (!securityData.currentPassword || securityData.newPassword.length < 6) {
      setSecurityError('Enter your current password and a new password of at least 6 characters');
      return;
    }
    setSecurityLoading(true);
    setSecurityError('');
    try {
      await api.post('/api/user/change-password', {
        current_password: securityData.currentPassword,
        new_password: securityData.newPassword
      });
      setSecuritySuccess('Password changed successfully!');
      setSecurityData({ currentPassword: '', newPassword: '' });
    } catch (err) {
      setSecurityError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!isGoogleAccount && !deletePassword) {
      setSecurityError('Enter your current password to confirm deletion');
      return;
    }
    setSecurityLoading(true);
    setSecurityError('');
    try {
      let confirmation = { current_password: deletePassword };
      if (isGoogleAccount) {
        if (!auth) throw new Error('Google sign-in is not configured');
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(auth, provider);
        confirmation = { google_token: await result.user.getIdToken(true) };
      }
      await api.post('/api/user/delete-account', confirmation);
      setDeletePassword('');
      onLogout();
    } catch (err) {
      setSecurityError(err.response?.data?.error || err.message || 'Failed to delete account');
    } finally {
      setSecurityLoading(false);
    }
  };

  const renderSecurityTab = () => (
    <div className="space-y-6 animate-fade-in">
      {securityError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500 text-xs font-medium">
          <AlertTriangle size={14} /> {securityError}
        </div>
      )}
      {securitySuccess && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-500 text-xs font-medium">
          <CheckCircle2 size={14} /> {securitySuccess}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Key size={16} className="text-text-secondary" />
          <h4 className="text-sm font-medium text-text-primary">Change Password</h4>
        </div>
        
        {!isGoogleAccount ? (
          <div className="grid gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Current Password</label>
              <input 
                type="password" 
                value={securityData.currentPassword}
                onChange={(e) => setSecurityData({...securityData, currentPassword: e.target.value})}
                placeholder="••••••••" 
                className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent transition-all" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">New Password</label>
              <input 
                type="password" 
                value={securityData.newPassword}
                onChange={(e) => setSecurityData({...securityData, newPassword: e.target.value})}
                placeholder="Minimum 6 characters" 
                className="w-full bg-bg-card border border-border-subtle rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent transition-all" 
              />
            </div>
            <button 
              onClick={handleChangePassword}
              disabled={securityLoading}
              className="w-full py-2.5 bg-text-primary text-bg-main text-sm font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
            >
              {securityLoading ? 'Updating...' : 'Change Password'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-text-secondary">Manage your password through your Google account.</p>
        )}
      </div>

      <div className="pt-6 border-t border-border-subtle">
        <div className="flex items-center gap-2 mb-2 text-red-500">
          <Trash2 size={16} />
          <h4 className="text-sm font-medium">Danger Zone</h4>
        </div>
        
        {!confirmDelete ? (
          <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/5">
            <p className="text-xs text-text-secondary mb-4 leading-relaxed">
              Once you delete your account, there is no going back. All your tasks, contributions, and profile data will be permanently wiped.
            </p>
            <button 
              onClick={() => { setConfirmDelete(true); setSecurityError(''); setSecuritySuccess(''); }}
              disabled={securityLoading}
              className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
            >
              Delete Account
            </button>
          </div>
        ) : (
          <div className="p-4 bg-red-500/5 rounded-xl border border-dashed border-red-500/30 space-y-4">
            <p className="text-xs text-red-500 font-medium text-center">Confirm Deletion</p>
            {isGoogleAccount ? (
              <p className="text-xs text-text-secondary">Confirm with the Google account used for this profile.</p>
            ) : (
              <input
                type="password"
                autoComplete="current-password"
                aria-label="Current password to confirm account deletion"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Current password"
                className="w-full bg-bg-card border border-red-500/30 rounded-lg px-3 py-3 text-sm outline-none"
              />
            )}
            <div className="flex gap-2">
              <button 
                onClick={() => { setConfirmDelete(false); setDeletePassword(''); }}
                className="flex-1 py-2 text-text-secondary text-xs font-medium hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAccount}
                disabled={securityLoading}
                className="flex-[2] py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-all disabled:opacity-50"
              >
                {securityLoading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-bg-card md:rounded-2xl w-full h-full md:h-[600px] md:max-w-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden md:border border-border-subtle">
        
        <div className="w-full md:w-64 bg-bg-sidebar border-b md:border-b-0 md:border-r border-border-subtle flex flex-col shrink-0">
          <div className="p-4 md:p-6 pb-2 md:pb-6">
            <div className="flex items-center justify-between mb-2 md:mb-6">
              <h3 className="text-lg font-bold text-text-primary tracking-tight">Settings</h3>
              <button onClick={onClose} className="p-2 hover:bg-bg-main rounded-full text-text-secondary transition-colors">
                <X size={20} />
              </button>
            </div>

            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible no-scrollbar pb-2 md:pb-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-text-primary text-bg-sidebar shadow-lg shadow-text-primary/10'
                      : 'text-text-secondary hover:bg-text-primary/5 hover:text-text-primary'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="hidden md:flex mt-auto p-6 border-t border-border-subtle flex-col gap-4">
             <div className="flex items-center gap-2">
                <Avatar name={userProfile?.name} photoUrl={userProfile?.photo_url} size="xs" />
                <p className="text-xs font-medium text-text-primary truncate">{userProfile?.name}</p>
             </div>
             <button 
               onClick={onLogout}
               className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 text-xs font-bold rounded-lg hover:bg-red-500 hover:text-white transition-all"
             >
               <LogOut size={14} />
               Sign Out
             </button>
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0 bg-bg-card">
           <div className="hidden md:flex justify-end p-4">
              <button onClick={onClose} className="p-1 hover:bg-bg-main rounded text-text-secondary transition-colors">
                 <X size={20} />
              </button>
           </div>

           <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-10 pt-2 md:pt-0">
              <div className="md:hidden flex items-center gap-2 mb-6 pb-2 border-b border-border-subtle/50">
                <span className="p-1.5 bg-accent/10 rounded-lg text-accent">
                  {tabs.find(t => t.id === activeTab)?.icon}
                </span>
                <h4 className="font-bold text-text-primary">{tabs.find(t => t.id === activeTab)?.label}</h4>
              </div>

              {activeTab === 'profile' && renderProfileTab()}
              {activeTab === 'preferences' && renderPreferencesTab()}
              {activeTab === 'security' && renderSecurityTab()}
              
              <div className="md:hidden mt-12 pt-8 border-t border-border-subtle">
                <button 
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-500 text-sm font-bold rounded-xl hover:bg-red-500 hover:text-white transition-all"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
