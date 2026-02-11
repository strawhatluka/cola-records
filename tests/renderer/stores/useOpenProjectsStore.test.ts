/**
 * useOpenProjectsStore Tests
 *
 * Tests for the multi-project state management store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useOpenProjectsStore } from '../../../src/renderer/stores/useOpenProjectsStore';
import type { Contribution } from '../../../src/main/ipc/channels';

// ── Test Fixtures ──────────────────────────────────────────────────────────

function createMockContribution(overrides: Partial<Contribution> = {}): Contribution {
  return {
    id: `contribution_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    repositoryUrl: 'https://github.com/test/repo.git',
    localPath: '/test/project',
    branchName: 'main',
    status: 'in_progress',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('useOpenProjectsStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useOpenProjectsStore.setState({
      projects: [],
      activeProjectId: null,
      maxProjects: 5,
    });
  });

  // ── Initial State ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('should have empty projects array', () => {
      const state = useOpenProjectsStore.getState();
      expect(state.projects).toEqual([]);
    });

    it('should have null activeProjectId', () => {
      const state = useOpenProjectsStore.getState();
      expect(state.activeProjectId).toBeNull();
    });

    it('should have maxProjects set to 5', () => {
      const state = useOpenProjectsStore.getState();
      expect(state.maxProjects).toBe(5);
    });
  });

  // ── openProject Action ──────────────────────────────────────────────────────

  describe('openProject', () => {
    it('should add a new project to the list', () => {
      const contribution = createMockContribution({ id: 'proj_1' });
      const { openProject } = useOpenProjectsStore.getState();

      const result = openProject(contribution);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('proj_1');
      expect(useOpenProjectsStore.getState().projects).toHaveLength(1);
    });

    it('should set the new project as active', () => {
      const contribution = createMockContribution({ id: 'proj_1' });
      const { openProject } = useOpenProjectsStore.getState();

      openProject(contribution);

      expect(useOpenProjectsStore.getState().activeProjectId).toBe('proj_1');
    });

    it('should initialize project with correct default values', () => {
      const contribution = createMockContribution({ id: 'proj_1' });
      const { openProject } = useOpenProjectsStore.getState();

      const result = openProject(contribution);

      expect(result?.state).toBe('idle');
      expect(result?.codeServerUrl).toBeNull();
      expect(result?.error).toBeNull();
      expect(result?.openedAt).toBeInstanceOf(Date);
    });

    it('should not add duplicate project if already open', () => {
      const contribution = createMockContribution({ id: 'proj_1' });
      const { openProject } = useOpenProjectsStore.getState();

      openProject(contribution);
      openProject(contribution); // Try to open again

      expect(useOpenProjectsStore.getState().projects).toHaveLength(1);
    });

    it('should switch to existing project if already open', () => {
      const contrib1 = createMockContribution({ id: 'proj_1' });
      const contrib2 = createMockContribution({ id: 'proj_2' });
      const { openProject } = useOpenProjectsStore.getState();

      openProject(contrib1);
      openProject(contrib2);
      expect(useOpenProjectsStore.getState().activeProjectId).toBe('proj_2');

      // Open first project again
      openProject(contrib1);
      expect(useOpenProjectsStore.getState().activeProjectId).toBe('proj_1');
    });

    it('should respect maxProjects limit', () => {
      const { openProject } = useOpenProjectsStore.getState();

      // Open 5 projects (the max)
      for (let i = 0; i < 5; i++) {
        const result = openProject(createMockContribution({ id: `proj_${i}` }));
        expect(result).not.toBeNull();
      }

      expect(useOpenProjectsStore.getState().projects).toHaveLength(5);

      // Try to open a 6th project
      const result = openProject(createMockContribution({ id: 'proj_6' }));
      expect(result).toBeNull();
      expect(useOpenProjectsStore.getState().projects).toHaveLength(5);
    });

    it('should store the contribution data correctly', () => {
      const contribution = createMockContribution({
        id: 'proj_1',
        localPath: '/custom/path',
        branchName: 'feature-branch',
      });
      const { openProject } = useOpenProjectsStore.getState();

      const result = openProject(contribution);

      expect(result?.contribution.localPath).toBe('/custom/path');
      expect(result?.contribution.branchName).toBe('feature-branch');
    });
  });

  // ── closeProject Action ──────────────────────────────────────────────────────

  describe('closeProject', () => {
    it('should remove the project from the list', () => {
      const contribution = createMockContribution({ id: 'proj_1' });
      const { openProject, closeProject } = useOpenProjectsStore.getState();

      openProject(contribution);
      expect(useOpenProjectsStore.getState().projects).toHaveLength(1);

      closeProject('proj_1');
      expect(useOpenProjectsStore.getState().projects).toHaveLength(0);
    });

    it('should set activeProjectId to null when closing the last project', () => {
      const contribution = createMockContribution({ id: 'proj_1' });
      const { openProject, closeProject } = useOpenProjectsStore.getState();

      openProject(contribution);
      closeProject('proj_1');

      expect(useOpenProjectsStore.getState().activeProjectId).toBeNull();
    });

    it('should switch to next project when closing active project', () => {
      const contrib1 = createMockContribution({ id: 'proj_1' });
      const contrib2 = createMockContribution({ id: 'proj_2' });
      const contrib3 = createMockContribution({ id: 'proj_3' });
      const { openProject, closeProject } = useOpenProjectsStore.getState();

      openProject(contrib1);
      openProject(contrib2);
      openProject(contrib3);

      // Active is proj_3, close it
      closeProject('proj_3');

      // Should switch to proj_2 (the one before it)
      expect(useOpenProjectsStore.getState().activeProjectId).toBe('proj_2');
    });

    it('should switch to previous project when closing last in list', () => {
      const contrib1 = createMockContribution({ id: 'proj_1' });
      const contrib2 = createMockContribution({ id: 'proj_2' });
      const { openProject, setActiveProject, closeProject } = useOpenProjectsStore.getState();

      openProject(contrib1);
      openProject(contrib2);
      setActiveProject('proj_2');

      closeProject('proj_2');

      expect(useOpenProjectsStore.getState().activeProjectId).toBe('proj_1');
    });

    it('should not change activeProjectId when closing non-active project', () => {
      const contrib1 = createMockContribution({ id: 'proj_1' });
      const contrib2 = createMockContribution({ id: 'proj_2' });
      const { openProject, setActiveProject, closeProject } = useOpenProjectsStore.getState();

      openProject(contrib1);
      openProject(contrib2);
      setActiveProject('proj_1');

      closeProject('proj_2');

      expect(useOpenProjectsStore.getState().activeProjectId).toBe('proj_1');
    });

    it('should do nothing when closing non-existent project', () => {
      const contribution = createMockContribution({ id: 'proj_1' });
      const { openProject, closeProject } = useOpenProjectsStore.getState();

      openProject(contribution);
      closeProject('non_existent');

      expect(useOpenProjectsStore.getState().projects).toHaveLength(1);
      expect(useOpenProjectsStore.getState().activeProjectId).toBe('proj_1');
    });
  });

  // ── setActiveProject Action ──────────────────────────────────────────────────

  describe('setActiveProject', () => {
    it('should change the active project', () => {
      const contrib1 = createMockContribution({ id: 'proj_1' });
      const contrib2 = createMockContribution({ id: 'proj_2' });
      const { openProject, setActiveProject } = useOpenProjectsStore.getState();

      openProject(contrib1);
      openProject(contrib2);
      expect(useOpenProjectsStore.getState().activeProjectId).toBe('proj_2');

      setActiveProject('proj_1');
      expect(useOpenProjectsStore.getState().activeProjectId).toBe('proj_1');
    });

    it('should do nothing when setting non-existent project as active', () => {
      const contribution = createMockContribution({ id: 'proj_1' });
      const { openProject, setActiveProject } = useOpenProjectsStore.getState();

      openProject(contribution);
      setActiveProject('non_existent');

      expect(useOpenProjectsStore.getState().activeProjectId).toBe('proj_1');
    });
  });

  // ── updateProjectState Action ────────────────────────────────────────────────

  describe('updateProjectState', () => {
    it('should update project state', () => {
      const contribution = createMockContribution({ id: 'proj_1' });
      const { openProject, updateProjectState } = useOpenProjectsStore.getState();

      openProject(contribution);
      updateProjectState('proj_1', 'starting');

      const project = useOpenProjectsStore.getState().projects[0];
      expect(project.state).toBe('starting');
    });

    it('should update codeServerUrl when provided', () => {
      const contribution = createMockContribution({ id: 'proj_1' });
      const { openProject, updateProjectState } = useOpenProjectsStore.getState();

      openProject(contribution);
      updateProjectState('proj_1', 'running', 'http://localhost:8080');

      const project = useOpenProjectsStore.getState().projects[0];
      expect(project.state).toBe('running');
      expect(project.codeServerUrl).toBe('http://localhost:8080');
    });

    it('should update error when provided', () => {
      const contribution = createMockContribution({ id: 'proj_1' });
      const { openProject, updateProjectState } = useOpenProjectsStore.getState();

      openProject(contribution);
      updateProjectState('proj_1', 'error', null, 'Container failed to start');

      const project = useOpenProjectsStore.getState().projects[0];
      expect(project.state).toBe('error');
      expect(project.error).toBe('Container failed to start');
    });

    it('should not affect other projects', () => {
      const contrib1 = createMockContribution({ id: 'proj_1' });
      const contrib2 = createMockContribution({ id: 'proj_2' });
      const { openProject, updateProjectState } = useOpenProjectsStore.getState();

      openProject(contrib1);
      openProject(contrib2);
      updateProjectState('proj_1', 'running', 'http://localhost:8080');

      const projects = useOpenProjectsStore.getState().projects;
      expect(projects.find((p) => p.id === 'proj_1')?.state).toBe('running');
      expect(projects.find((p) => p.id === 'proj_2')?.state).toBe('idle');
    });
  });

  // ── closeAll Action ──────────────────────────────────────────────────────────

  describe('closeAll', () => {
    it('should remove all projects', () => {
      const contrib1 = createMockContribution({ id: 'proj_1' });
      const contrib2 = createMockContribution({ id: 'proj_2' });
      const { openProject, closeAll } = useOpenProjectsStore.getState();

      openProject(contrib1);
      openProject(contrib2);
      expect(useOpenProjectsStore.getState().projects).toHaveLength(2);

      closeAll();

      expect(useOpenProjectsStore.getState().projects).toHaveLength(0);
    });

    it('should set activeProjectId to null', () => {
      const contribution = createMockContribution({ id: 'proj_1' });
      const { openProject, closeAll } = useOpenProjectsStore.getState();

      openProject(contribution);
      closeAll();

      expect(useOpenProjectsStore.getState().activeProjectId).toBeNull();
    });
  });

  // ── getActiveProject Helper ──────────────────────────────────────────────────

  describe('getActiveProject', () => {
    it('should return the active project', () => {
      const contribution = createMockContribution({ id: 'proj_1' });
      const { openProject, getActiveProject } = useOpenProjectsStore.getState();

      openProject(contribution);

      const activeProject = getActiveProject();
      expect(activeProject?.id).toBe('proj_1');
    });

    it('should return null when no projects are open', () => {
      const { getActiveProject } = useOpenProjectsStore.getState();

      expect(getActiveProject()).toBeNull();
    });

    it('should return null when activeProjectId is invalid', () => {
      // Manually set an invalid activeProjectId
      useOpenProjectsStore.setState({ activeProjectId: 'invalid' });

      const { getActiveProject } = useOpenProjectsStore.getState();
      expect(getActiveProject()).toBeNull();
    });
  });

  // ── isProjectOpen Helper ─────────────────────────────────────────────────────

  describe('isProjectOpen', () => {
    it('should return true for open project', () => {
      const contribution = createMockContribution({ id: 'proj_1' });
      const { openProject, isProjectOpen } = useOpenProjectsStore.getState();

      openProject(contribution);

      expect(isProjectOpen('proj_1')).toBe(true);
    });

    it('should return false for non-open project', () => {
      const { isProjectOpen } = useOpenProjectsStore.getState();

      expect(isProjectOpen('proj_1')).toBe(false);
    });
  });

  // ── Edge Cases ───────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle rapid open/close operations', () => {
      const { openProject, closeProject } = useOpenProjectsStore.getState();

      for (let i = 0; i < 10; i++) {
        const contrib = createMockContribution({ id: `proj_${i}` });
        openProject(contrib);
        if (i > 0) {
          closeProject(`proj_${i - 1}`);
        }
      }

      // Should have 2 projects: proj_4 (max limit hit) and proj_9
      const state = useOpenProjectsStore.getState();
      expect(state.projects.length).toBeLessThanOrEqual(5);
    });

    it('should preserve project order', () => {
      const { openProject } = useOpenProjectsStore.getState();

      openProject(createMockContribution({ id: 'proj_a' }));
      openProject(createMockContribution({ id: 'proj_b' }));
      openProject(createMockContribution({ id: 'proj_c' }));

      const projects = useOpenProjectsStore.getState().projects;
      expect(projects[0].id).toBe('proj_a');
      expect(projects[1].id).toBe('proj_b');
      expect(projects[2].id).toBe('proj_c');
    });

    it('should handle closing middle project correctly', () => {
      const { openProject, setActiveProject, closeProject } = useOpenProjectsStore.getState();

      openProject(createMockContribution({ id: 'proj_1' }));
      openProject(createMockContribution({ id: 'proj_2' }));
      openProject(createMockContribution({ id: 'proj_3' }));

      setActiveProject('proj_2');
      closeProject('proj_2');

      // Should switch to proj_2's position, which is now proj_3
      expect(useOpenProjectsStore.getState().activeProjectId).toBe('proj_3');
    });
  });
});
