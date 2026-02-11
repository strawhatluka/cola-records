/**
 * useOpenProjectsStore
 *
 * Manages the state of currently open projects in the multi-project tab system.
 * Each open project has its own DevelopmentScreen instance, but shares a single
 * code-server container with dynamically mounted workspace folders.
 */

import { create } from 'zustand';
import type { Contribution } from '../../main/ipc/channels';

/** State of an individual open project */
export type OpenProjectState = 'idle' | 'starting' | 'running' | 'error';

/** Represents a project that is currently open in the tab bar */
export interface OpenProject {
  /** Unique identifier (same as contribution.id) */
  id: string;
  /** The contribution/project data */
  contribution: Contribution;
  /** Code-server URL for this project's workspace */
  codeServerUrl: string | null;
  /** Current state of the project's development environment */
  state: OpenProjectState;
  /** Error message if state is 'error' */
  error: string | null;
  /** Timestamp when the project was opened */
  openedAt: Date;
}

interface OpenProjectsState {
  /** Array of currently open projects */
  projects: OpenProject[];
  /** ID of the currently active/visible project */
  activeProjectId: string | null;
  /** Maximum number of projects that can be open simultaneously */
  maxProjects: number;

  // ── Actions ──────────────────────────────────────────────────────────

  /**
   * Open a project in a new tab.
   * If the project is already open, it becomes the active tab.
   * @returns The opened project, or null if max projects reached
   */
  openProject: (contribution: Contribution) => OpenProject | null;

  /**
   * Close a project tab.
   * If closing the active project, switches to another open project.
   */
  closeProject: (id: string) => void;

  /**
   * Switch to a different open project.
   */
  setActiveProject: (id: string) => void;

  /**
   * Update the state of an open project.
   */
  updateProjectState: (
    id: string,
    state: OpenProjectState,
    codeServerUrl?: string | null,
    error?: string | null
  ) => void;

  /**
   * Close all open projects.
   */
  closeAll: () => void;

  /**
   * Get the currently active project.
   */
  getActiveProject: () => OpenProject | null;

  /**
   * Check if a project is already open.
   */
  isProjectOpen: (contributionId: string) => boolean;
}

export const useOpenProjectsStore = create<OpenProjectsState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  maxProjects: 5,

  openProject: (contribution) => {
    const state = get();

    // Check if project is already open
    const existingProject = state.projects.find((p) => p.id === contribution.id);
    if (existingProject) {
      // Just switch to it
      set({ activeProjectId: contribution.id });
      return existingProject;
    }

    // Check max projects limit
    if (state.projects.length >= state.maxProjects) {
      return null;
    }

    // Create new open project
    const newProject: OpenProject = {
      id: contribution.id,
      contribution,
      codeServerUrl: null,
      state: 'idle',
      error: null,
      openedAt: new Date(),
    };

    set({
      projects: [...state.projects, newProject],
      activeProjectId: contribution.id,
    });

    return newProject;
  },

  closeProject: (id) => {
    const state = get();
    const projectIndex = state.projects.findIndex((p) => p.id === id);

    if (projectIndex === -1) return;

    const newProjects = state.projects.filter((p) => p.id !== id);

    // Determine new active project if we're closing the active one
    let newActiveId = state.activeProjectId;
    if (state.activeProjectId === id) {
      if (newProjects.length > 0) {
        // Switch to the project that was next to it, or the last one
        const newIndex = Math.min(projectIndex, newProjects.length - 1);
        newActiveId = newProjects[newIndex].id;
      } else {
        newActiveId = null;
      }
    }

    set({
      projects: newProjects,
      activeProjectId: newActiveId,
    });
  },

  setActiveProject: (id) => {
    const state = get();
    const project = state.projects.find((p) => p.id === id);
    if (project) {
      set({ activeProjectId: id });
    }
  },

  updateProjectState: (id, newState, codeServerUrl, error) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id
          ? {
              ...p,
              state: newState,
              codeServerUrl: codeServerUrl !== undefined ? codeServerUrl : p.codeServerUrl,
              error: error !== undefined ? error : p.error,
            }
          : p
      ),
    }));
  },

  closeAll: () => {
    set({
      projects: [],
      activeProjectId: null,
    });
  },

  getActiveProject: () => {
    const state = get();
    if (!state.activeProjectId) return null;
    return state.projects.find((p) => p.id === state.activeProjectId) || null;
  },

  isProjectOpen: (contributionId) => {
    return get().projects.some((p) => p.id === contributionId);
  },
}));
