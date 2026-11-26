import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext();

export function WorkspaceProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get('/api/workspaces');
      setWorkspaces(res.data || []);
    } catch (err) {
      console.error('Failed to fetch workspaces', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;

    if (user) {
      fetchWorkspaces();
    } else {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      localStorage.removeItem('selectedWorkspaceId');
    }
  }, [authLoading, user, fetchWorkspaces]);

  // Load from localStorage once workspaces are available
  useEffect(() => {
    if (workspaces.length > 0 && !currentWorkspace) {
      const savedId = localStorage.getItem('selectedWorkspaceId');
      if (savedId) {
        const ws = workspaces.find((w) => String(w.id) === savedId);
        if (ws) setCurrentWorkspace(ws);
      }
    }
  }, [workspaces, currentWorkspace]);

  const selectWorkspace = (workspaceId) => {
    if (!workspaceId) {
      setCurrentWorkspace(null);
      localStorage.removeItem('selectedWorkspaceId');
    } else {
      const ws = workspaces.find((w) => String(w.id) === String(workspaceId));
      if (ws) {
        setCurrentWorkspace(ws);
        localStorage.setItem('selectedWorkspaceId', String(ws.id));
      }
    }
  };

  const createWorkspace = async (data) => {
    const res = await api.post('/api/workspaces', data);
    await fetchWorkspaces();
    return res.data;
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        selectWorkspace,
        createWorkspace,
        refreshWorkspaces: fetchWorkspaces,
        loading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
