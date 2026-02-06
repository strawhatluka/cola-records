# WO-051: Plugins System

**Status:** PLANNED
**Complexity:** 9/10
**Priority:** MEDIUM
**Phase:** 2 - Advanced Systems
**Dependencies:** WO-044 (Custom Commands), WO-046 (Full Hooks System), WO-049 (MCP Runtime), WO-050 (Subagents)
**Category:** Audit Section 14 - Plugins System
**Estimated Time:** 16-22 hours
**Created:** 2026-02-01

---

## Objective

Implement a complete plugins system with a `/plugins` tabbed UI (Installed/Available/Marketplaces), install/uninstall lifecycle with three scopes (user/project/local), enable/disable toggles, plugin components (commands, agents, MCP servers, hooks, skills, LSP servers), marketplace management, and managed plugin support.

---

## Background

The current codebase has no plugin infrastructure. The systems that plugins build upon are being implemented in Phase 1 and early Phase 2: custom commands (WO-044), hooks (WO-046), MCP (WO-049), and subagents (WO-050). The plugins system is the integration layer that bundles these components into distributable packages. It is the highest-complexity work order because it orchestrates all other subsystems.

### Current State
- No plugin manifest format
- No plugin installer or lifecycle manager
- No marketplace client
- No `/plugins` command
- No plugin component loader
- Prerequisites being built: commands (WO-044), hooks (WO-046), MCP (WO-049), agents (WO-050)

### Target State
- Plugin manifest format (`plugin.json`) with metadata and component declarations
- Install/uninstall with three scopes: user (`~/.claude/plugins/`), project (`.claude/plugins/`), local
- Enable/disable toggles per plugin
- `/plugins` command opening tabbed UI: Installed, Available, Marketplaces
- Marketplace support: add/remove/refresh sources (GitHub repos)
- Plugin components loaded into their respective systems (commands, agents, MCP, hooks, skills)
- Managed plugins (admin-installed, unmodifiable) from managed settings
- Restart banner after plugin changes

---

## Acceptance Criteria

1. Users can install plugins from a marketplace or local path with scope selection
2. Installed plugins appear in the Installed tab with enable/disable toggles
3. Available plugins from configured marketplaces appear in the Available tab
4. Users can add/remove/refresh marketplace sources in the Marketplaces tab
5. Plugin components (commands, agents, MCP, hooks, skills) are loaded into their respective systems on enable
6. Plugin components are unloaded on disable or uninstall
7. Managed plugins from admin settings appear as read-only entries
8. `/plugins` command opens the plugin management interface
9. A restart banner appears after plugin install/uninstall/toggle
10. Plugin manifest validation catches malformed or missing fields
11. Unit tests cover manifest parsing, lifecycle, component loading, marketplace client
12. Test coverage meets or exceeds 80% lines and branches

---

## Technical Design

### Architecture

```
PluginsService (Main Process)
  |
  +-- PluginManifestParser
  |     +-- parse(plugin.json) -> PluginManifest
  |     +-- validate(manifest) -> ValidationResult
  |
  +-- PluginInstaller
  |     +-- install(source, scope) -> PluginInstallResult
  |     +-- uninstall(pluginId, scope)
  |     +-- getInstallPath(scope) -> string
  |
  +-- PluginComponentLoader
  |     +-- loadCommands(plugin) -> registers with CustomCommandsService
  |     +-- loadAgents(plugin) -> registers with SubagentService
  |     +-- loadMCPServers(plugin) -> registers with MCPRuntimeService
  |     +-- loadHooks(plugin) -> registers with HooksEngine
  |     +-- loadSkills(plugin) -> registers with SkillsService
  |     +-- unloadAll(plugin)
  |
  +-- MarketplaceClient
  |     +-- fetchIndex(marketplaceUrl) -> PluginListing[]
  |     +-- download(pluginUrl) -> PluginArchive
  |     +-- addMarketplace(url)
  |     +-- removeMarketplace(url)
  |     +-- refreshMarketplace(url)
  |
  +-- PluginLifecycleManager
        +-- enable(pluginId) -> loads components
        +-- disable(pluginId) -> unloads components
        +-- getInstalled() -> InstalledPlugin[]
        +-- getManaged() -> ManagedPlugin[]

Renderer:
  PluginsManager.tsx (tabbed UI: Installed/Available/Marketplaces)
  useClaudeStore.ts (plugins state)
```

### New Files

| File | Purpose |
|------|---------|
| `src/main/services/plugins.service.ts` | Core plugin orchestration service |
| `src/main/services/plugins/manifest-parser.ts` | Plugin manifest (plugin.json) parser and validator |
| `src/main/services/plugins/installer.ts` | Plugin download, extraction, and installation |
| `src/main/services/plugins/component-loader.ts` | Loads plugin components into respective subsystems |
| `src/main/services/plugins/marketplace-client.ts` | Fetches plugin listings from marketplace repos |
| `src/main/services/plugins/types.ts` | Plugin type definitions |
| `src/renderer/components/claude/PluginsManager.tsx` | Tabbed plugin management UI |
| `tests/unit/services/plugins.service.test.ts` | Plugin service tests |
| `tests/unit/services/plugins/manifest-parser.test.ts` | Manifest parsing tests |
| `tests/unit/services/plugins/installer.test.ts` | Installer tests |
| `tests/unit/services/plugins/component-loader.test.ts` | Component loader tests |
| `tests/unit/services/plugins/marketplace-client.test.ts` | Marketplace client tests |

### Files to Modify

| File | Changes |
|------|---------|
| `src/main/ipc/channels.ts` | Add plugin IPC channels, plugin types |
| `src/main/ipc/handlers.ts` | Register plugin IPC handlers |
| `src/renderer/stores/useClaudeStore.ts` | Add plugins state (installed, available, marketplaces) |
| `src/renderer/components/claude/ClaudeSlashCommands.tsx` | Register `/plugins` command |

### Interfaces

```typescript
// src/main/services/plugins/types.ts

export type PluginScope = 'user' | 'project' | 'local';
export type PluginStatus = 'enabled' | 'disabled' | 'error';

export interface PluginManifest {
  /** Unique plugin identifier (e.g., "anthropic/code-review") */
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  /** Minimum Claude Code version required */
  minVersion?: string;
  /** Plugin components */
  components: PluginComponents;
  /** Plugin configuration schema */
  configSchema?: Record<string, unknown>;
}

export interface PluginComponents {
  /** Slash commands: relative paths to .md files */
  commands?: string[];
  /** Agent definitions: relative paths to .md agent files */
  agents?: string[];
  /** MCP server configurations */
  mcpServers?: PluginMCPConfig[];
  /** Hook definitions file: relative path to hooks/hooks.json */
  hooks?: string;
  /** Skill definitions: relative paths to SKILL.md files */
  skills?: string[];
  /** LSP server configurations */
  lspServers?: PluginLSPConfig[];
}

export interface PluginMCPConfig {
  name: string;
  transport: 'http' | 'sse' | 'stdio';
  endpoint: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface PluginLSPConfig {
  language: string;
  command: string;
  args?: string[];
}

export interface InstalledPlugin {
  manifest: PluginManifest;
  scope: PluginScope;
  status: PluginStatus;
  installPath: string;
  installedAt: number;
  /** True for admin-managed plugins */
  managed: boolean;
  error?: string;
}

export interface PluginListing {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  downloadUrl: string;
  /** Whether already installed */
  installed: boolean;
}

export interface MarketplaceSource {
  /** GitHub repo (owner/repo), URL, or local path */
  source: string;
  /** Display name */
  name: string;
  /** Last refresh timestamp */
  lastRefreshed?: number;
}

export interface PluginInstallResult {
  success: boolean;
  plugin?: InstalledPlugin;
  error?: string;
}

export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

---

## Implementation Tasks

### Task 1: Plugin Type Definitions and IPC Channels
- **Type:** FEATURE
- **Files:** `src/main/services/plugins/types.ts`, `src/main/ipc/channels.ts`
- **Details:** Create all plugin types (PluginManifest, InstalledPlugin, PluginListing, MarketplaceSource, etc.). Add IPC channels: `plugins:installed:list`, `plugins:installed:enable`, `plugins:installed:disable`, `plugins:installed:uninstall`, `plugins:available:list`, `plugins:available:install`, `plugins:marketplace:list`, `plugins:marketplace:add`, `plugins:marketplace:remove`, `plugins:marketplace:refresh`.
- **Test:** Type compilation validation

### Task 2: Plugin Manifest Parser
- **Type:** FEATURE
- **Files:** `src/main/services/plugins/manifest-parser.ts`
- **Details:** Parse `plugin.json` files. Validate required fields (id, name, version, description, author). Validate component paths exist in the plugin directory. Return `PluginValidationResult` with errors for missing required fields and warnings for optional best practices (e.g., missing minVersion). Support schema validation for configSchema field.
- **Test:** `tests/unit/services/plugins/manifest-parser.test.ts` - Valid manifest, missing fields, invalid component paths, empty components, version format validation

### Task 3: Plugin Installer
- **Type:** FEATURE
- **Files:** `src/main/services/plugins/installer.ts`
- **Details:** Install plugins from three sources: marketplace download URL, local directory path, or GitHub repo URL. Determine install path by scope: user=`~/.claude/plugins/<id>`, project=`.claude/plugins/<id>`, local=`.claude/plugins.local/<id>`. For URL sources: download archive, extract to install path. For local sources: copy directory. Validate manifest after extraction. Uninstall: remove directory and deregister components. Prevent uninstall of managed plugins.
- **Test:** `tests/unit/services/plugins/installer.test.ts` - Mock download, extraction, directory operations, scope path resolution, managed plugin protection

### Task 4: Plugin Component Loader
- **Type:** FEATURE
- **Files:** `src/main/services/plugins/component-loader.ts`
- **Details:** Load each component type into its respective service. Commands: read `.md` files from plugin and register with CustomCommandsService (WO-044). Agents: read `.md` agent files and register with SubagentService (WO-050). MCP: create server configs and register with MCPRuntimeService (WO-049). Hooks: read `hooks/hooks.json` and register with HooksEngine (WO-046). Skills: read SKILL.md files and register with SkillsService (WO-048). Track loaded components per plugin for clean unloading. `${CLAUDE_PLUGIN_ROOT}` environment variable set to plugin install path for hooks.
- **Test:** `tests/unit/services/plugins/component-loader.test.ts` - Mock each subsystem service, test loading and unloading each component type, test CLAUDE_PLUGIN_ROOT resolution

### Task 5: Marketplace Client
- **Type:** FEATURE
- **Files:** `src/main/services/plugins/marketplace-client.ts`
- **Details:** Fetch plugin index from marketplace sources. Support GitHub repo format: fetch `plugins.json` from repo root via GitHub API or raw URL. Parse plugin listings with name, version, description, download URL. Cache marketplace index for 1 hour. Support multiple marketplace sources. Default marketplaces: `anthropics/claude-plugins-official` (official). Add/remove/refresh operations. Handle network errors gracefully with cached fallback.
- **Test:** `tests/unit/services/plugins/marketplace-client.test.ts` - Mock HTTP responses, test index parsing, caching, multiple sources, error handling

### Task 6: Plugin Lifecycle Manager (Core Service)
- **Type:** FEATURE
- **Files:** `src/main/services/plugins.service.ts`
- **Details:** Orchestrate the full plugin lifecycle. On startup: scan install directories for all scopes, load manifests, load components for enabled plugins. `enable(pluginId)`: load components, update status. `disable(pluginId)`: unload components, update status. `install(source, scope)`: download via installer, validate, optionally enable. `uninstall(pluginId)`: disable first, then remove files. Load managed plugins from managed settings (read-only, always enabled). Persist plugin enabled/disabled state in settings. Emit `plugins:changed` event to trigger restart banner.
- **Test:** `tests/unit/services/plugins.service.test.ts` - Test startup loading, enable/disable, install/uninstall, managed plugins, state persistence

### Task 7: IPC Handler Registration
- **Type:** INTEGRATION
- **Files:** `src/main/ipc/handlers.ts`
- **Details:** Register all plugin IPC handlers connecting renderer requests to PluginsService methods. Handle errors with descriptive messages. Include `plugins:changed` event for restart banner trigger.
- **Test:** IPC round-trip mocks

### Task 8: Store Updates
- **Type:** FEATURE
- **Files:** `src/renderer/stores/useClaudeStore.ts`
- **Details:** Add state: `installedPlugins: InstalledPlugin[]`, `availablePlugins: PluginListing[]`, `marketplaceSources: MarketplaceSource[]`, `pluginsNeedRestart: boolean`. Add actions: `loadInstalledPlugins()`, `loadAvailablePlugins()`, `installPlugin(id, scope)`, `uninstallPlugin(id)`, `enablePlugin(id)`, `disablePlugin(id)`, `addMarketplace(source)`, `removeMarketplace(source)`, `refreshMarketplace(source)`. Listen for `plugins:changed` event to set `pluginsNeedRestart = true`.
- **Test:** Store action tests with mocked IPC

### Task 9: PluginsManager UI Component - Installed Tab
- **Type:** UI
- **Files:** `src/renderer/components/claude/PluginsManager.tsx`
- **Details:** Tabbed panel with three tabs: Installed, Available, Marketplaces. **Installed tab:** List of installed plugins showing name, version, author, scope badge, status toggle (enable/disable), uninstall button (hidden for managed). Managed plugins show a lock icon and "(managed)" label. Search/filter input at top. Plugin details expandable: description, components summary, install path.
- **Test:** Render tests for installed list, toggle, managed lock, search

### Task 10: PluginsManager UI Component - Available Tab
- **Type:** UI
- **Files:** `src/renderer/components/claude/PluginsManager.tsx`
- **Details:** **Available tab:** List of plugins from all configured marketplaces. Each entry shows name, version, author, description, Install button with scope dropdown (user/project/local). Already-installed plugins show "Installed" badge instead of Install button. Refresh button to reload marketplace index. Loading spinner while fetching.
- **Test:** Render tests for available list, install button, scope selection, installed badge

### Task 11: PluginsManager UI Component - Marketplaces Tab
- **Type:** UI
- **Files:** `src/renderer/components/claude/PluginsManager.tsx`
- **Details:** **Marketplaces tab:** List of configured marketplace sources with name, source URL/path, last refreshed timestamp. Add Marketplace form: text input for GitHub repo, URL, or local path. Refresh icon per marketplace. Trash icon to remove. Default `anthropics/claude-plugins-official` marketplace cannot be removed (only disabled).
- **Test:** Render tests for marketplace list, add form, refresh, remove

### Task 12: /plugins Slash Command and Restart Banner
- **Type:** UI
- **Files:** `src/renderer/components/claude/ClaudeSlashCommands.tsx`, `src/renderer/components/claude/ClaudePanel.tsx` (or equivalent)
- **Details:** Register `/plugins` in slash command registry. When invoked, open PluginsManager panel. Add restart banner component that appears when `pluginsNeedRestart` is true. Banner shows "Plugin changes detected. Restart to apply." with a Restart button that triggers container restart.
- **Test:** Slash command registration, restart banner display logic

---

## Testing Requirements

- **Unit Tests:** Manifest parser, installer, component loader, marketplace client, lifecycle manager, store actions
- **Integration Tests:** Full install-enable-load cycle, uninstall-disable-unload cycle, managed plugin enforcement
- **Coverage Target:** >= 80% lines and branches
- **Mock Strategy:** Mock filesystem for install/uninstall, mock HTTP for marketplace, mock subsystem services for component loading
- **Edge Cases:** Corrupt plugin archives, missing manifest, duplicate plugin IDs across scopes, marketplace network failure, component loader failures (partial load), plugin referencing missing subsystem (e.g., MCP before WO-049 is ready)

---

## BAS Quality Gates

| Phase | Gate | Criteria |
|-------|------|----------|
| 1 | Linting | ESLint + Prettier auto-fix, 0 errors |
| 2 | Structure | All imports resolve, types valid, no circular deps |
| 3 | Build | TypeScript compilation passes with 0 errors |
| 4 | Testing | All unit and integration tests pass |
| 5 | Coverage | >= 80% lines and branches |
| 6 | Review | DRA review for plugin security, component isolation, managed enforcement |

---

## Audit Items Addressed

From CLAUDE-CODE-EXTENSION-AUDIT.md Section 14 (Plugins System):

- [ ] /plugins command with tabbed UI
- [ ] Installed plugins list with enable/disable
- [ ] Available plugins list with Install button
- [ ] Search plugins
- [ ] Plugin install scopes (user/project/local)
- [ ] Managed plugins (admin-installed, unmodifiable)
- [ ] Marketplaces tab (add/remove/refresh)
- [ ] Add marketplace (GitHub repo, URL, local path)
- [ ] Refresh marketplace
- [ ] Remove marketplace
- [ ] Official Anthropic marketplace
- [ ] Restart banner after plugin changes
- [ ] Plugin slash commands
- [ ] Plugin agents
- [ ] Plugin MCP servers
- [ ] Plugin hooks
- [ ] Plugin skills
- [ ] Plugin LSP servers

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Plugin security (malicious code in plugins) | CRITICAL | MEDIUM | Display clear warnings, show plugin source, managed plugins for trusted orgs |
| Component loader circular dependency | HIGH | LOW | Lazy-load subsystem services, interface-based injection |
| Marketplace unavailable (network issues) | MEDIUM | MEDIUM | Cache marketplace index, graceful fallback to cached data |
| Plugin version conflicts | MEDIUM | LOW | Validate minVersion, warn on incompatible versions |
| Partial component load failure | HIGH | MEDIUM | Transaction-like loading: if any component fails, roll back all and report error |
| Large plugin archives consuming disk | LOW | LOW | Set max plugin size (50MB), show size before install |

---

## Notes

- This is the most complex work order (9/10) because it orchestrates all other subsystems (commands, hooks, MCP, agents, skills).
- All four dependencies (WO-044, WO-046, WO-049, WO-050) must be complete before this work order can start.
- Plugin LSP server loading is a stub that prepares for WO-065 (LSP Integration). The actual LSP client is not part of this WO.
- The marketplace format follows the Claude Code plugin ecosystem for compatibility.
- Managed plugins are loaded from the managed settings file path (platform-specific): Windows `C:\ProgramData\ClaudeCode\managed-settings.json`, Mac `/Library/Application Support/ClaudeCode/managed-settings.json`.
- Security note: Anthropic does not verify third-party plugin contents. The UI must clearly communicate this to users before installation.
