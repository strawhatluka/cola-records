# Changelog

All notable changes to Cola Records will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Dev Tools — Set Up category with 6 ecosystem-aware action buttons: Install, Env File, Git Init, Hooks, Editor Config, TypeCheck
  - **Project Detection Service** (`project-detection.service.ts`): scans working directory to detect ecosystem (Node, Python, Rust, Go, Ruby, PHP, Java), package manager, available scripts, and tooling
  - 7 new IPC channels (`dev-tools:detect-project`, `dev-tools:get-install-command`, `dev-tools:get-typecheck-command`, `dev-tools:get-git-init-command`, `dev-tools:get-hooks-command`, `dev-tools:setup-env-file`, `dev-tools:setup-editor-config`)
  - Buttons auto-detect correct commands per ecosystem (e.g., `npm install` vs `pip install -e .` vs `cargo build`)
  - Git Init disabled when `.git/` exists, Editor Config disabled when `.editorconfig` exists, TypeCheck disabled when no type checker detected
  - Terminal auto-expands and receives commands on button click via `TerminalTool` imperative handle
  - Env File creates `.env` from `.env.example` or creates empty `.env`; Editor Config writes standard template
- `TerminalTool` imperative handle (`sendCommand`) for external command injection via `forwardRef`/`useImperativeHandle`
- Dev Tools — Workflows category with 5 command buttons and New Branch dialog
  - **WorkflowButtons** (`WorkflowButtons.tsx`): Lint, Format, Test, Coverage, Build buttons driven by `ProjectCommands` from the detection service
  - Buttons auto-detect correct commands per ecosystem (e.g., `npm run lint` vs `cargo clippy` vs `ruff check .`)
  - Buttons disabled when no command is detected for that action (e.g., no `format` script in `package.json`)
  - **NewBranchDialog** (`NewBranchDialog.tsx`): branch creation dialog with 7 conventional prefixes (`feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `test/`, `hotfix/`), auto-slugified name input, live preview, and Enter key support
  - New Branch calls existing `git:create-branch` IPC to create and checkout in one step
- Dev Tools — Update category with 5 action buttons for keeping projects current
  - **UpdateSection** (`UpdateSection.tsx`): Update Deps, Audit, Pull Latest, Sync Fork, Clean buttons
  - `ProjectCommands` extended with `outdated`, `audit`, `clean` fields; commands resolved per ecosystem (e.g., `npm outdated` vs `cargo outdated` vs `pip list --outdated`)
  - New `CleanTarget` type and `dev-tools:get-clean-targets` IPC channel for scanning build artifacts with sizes
  - **Pull Latest** always enabled — runs `git pull`
  - **Sync Fork** auto-detects `upstream` remote via existing `git:get-remotes` IPC; disabled with explanatory tooltip when no upstream found
  - **Clean** opens inline confirmation dialog showing target paths, individual sizes, total size, and warning text before executing `rm -rf` (or ecosystem-specific clean command like `cargo clean`)
  - Update Deps and Audit disabled when their command is unavailable for the detected ecosystem
- Dev Tools — Info category with 6 read-only buttons for project insight
  - **InfoSection** (`InfoSection.tsx`): Status, Log, Branches, Remotes (git terminal commands) + Disk Usage, Project Info (inline data panels)
  - **DiskUsageService** (`disk-usage.service.ts`): scans 13 well-known artifact directories (`node_modules`, `.git`, `dist`, `build`, `coverage`, `target`, etc.) with recursive size calculation and depth limit
  - **InfoInlinePanel** (`InfoInlinePanel.tsx`): two display modes — Disk Usage (proportional progress bars with formatted sizes, total, scan duration) and Project Info (key-value metadata, scripts list)
  - **info-formatters** (`info-formatters.ts`): pure utility functions for `formatBytes`, `calculatePercentage`, `formatDuration`
  - 2 new IPC channels (`dev-tools:disk-usage`, `dev-tools:project-info`) with `DiskUsageEntry` and `DiskUsageResult` types
  - Only one inline panel visible at a time; toggle on re-click; close button dismisses
  - All 4 git buttons always enabled — no detection dependency
- Dev Tools — Env File button expanded into full-featured env file management tool ([#56](https://github.com/lukadfagundes/cola-records/issues/56))
  - **Env File button** always enabled (no longer disabled when `.env` exists); click toggles an inline management panel
  - **EnvPanel** (`EnvPanel.tsx`): 6 action buttons — Create `.env.example` (scans codebase), Create `.env`, Create `.env.local`, Create `.env.CUSTOM` (inline suffix input), Edit Example, ENV Sync
  - **EnvEditor** (`EnvEditor.tsx`): full-size multi-tab text editor replacing Tool Box view; file tabs for all discovered `.env` files, Save button, Ctrl+S, per-tab dirty tracking, unsaved changes prompt
  - **EnvScannerService** (`env-scanner.service.ts`): recursive codebase scanner detecting env variable references across 7 ecosystems (Node, Python, Rust, Go, Ruby, PHP, Java) with ecosystem-specific regex patterns; heuristic categorization (credential, url, network, config, general) and auto-generated comments
  - **Service provider detection**: variables auto-grouped by service (Discord, GitHub, NextAuth, Stripe, AWS, PostgreSQL, Redis, Sentry, Rollbar, etc.) — 35+ service prefixes recognized; `.env.example` sections organized by service instead of generic category
  - **Multi-file occurrence tracking**: all source file locations recorded per variable and shown in `.env.example` comments (e.g. `found in auth.ts:17, middleware.ts:42`) instead of only the first occurrence
  - **Platform-injected variable filtering**: auto-set variables (`VERCEL`, `VERCEL_ENV`, `NODE_ENV`, `CI`, `VERCEL_GIT_COMMIT_SHA`, etc.) automatically excluded from `.env.example` since users don't configure them
  - **Docker Compose/Dockerfile scanning**: detects `${VAR}` and `${VAR:-default}` references in `docker-compose.yml`, `docker-compose.*.yml`, `Dockerfile`, and `Dockerfile.*` — infrastructure variables (e.g. `POSTGRES_USER`, `POSTGRES_PASSWORD`) now surfaced alongside source code variables
  - **EnvFileService** (`env-file.service.ts`): discover, create, read, write, and sync `.env` files including nested subdirectories; sync operation rescans codebase → appends new vars to `.env.example` → propagates missing keys to sibling `.env*` files
  - 7 new IPC channels (`dev-tools:scan-env-variables`, `dev-tools:discover-env-files`, `dev-tools:create-env-example`, `dev-tools:create-env-file`, `dev-tools:read-env-file`, `dev-tools:write-env-file`, `dev-tools:sync-env-files`)
  - 5 new types (`EnvSourceLocation`, `EnvVariable`, `EnvScanResult`, `EnvFileInfo`, `EnvSyncResult`)
- Dev Tools — Hooks button expanded into full-featured Git hooks management tool ([#57](https://github.com/lukadfagundes/cola-records/issues/57))
  - **Hooks button** always enabled (no longer disabled when no hook tool detected); click toggles an inline management panel
  - **HooksPanel** (`HooksPanel.tsx`): setup wizard when no hooks detected (tool selection cards with recommendations, lint-staged checkbox, "Set Up" button), action buttons when hooks detected (Install, Edit Config, Add Presets, Lint-Staged, Info)
  - **HooksEditor** (`HooksEditor.tsx`): full-view tabbed config editor replacing Tool Box view; tabs per git hook stage (pre-commit, commit-msg, pre-push, post-merge, post-checkout), toggleable action rows with enable/disable switches, add custom actions or select from presets, lint-staged sub-panel with glob pattern rules, Save (Ctrl+S), dirty tracking, unsaved changes prompt
  - **HooksService** (`hooks.service.ts`): detect, read, write, and manage Git hooks for all 4 hook systems — Husky (shell scripts in `.husky/`), pre-commit (`.pre-commit-config.yaml` via line-based templating), Lefthook (`lefthook.yml` via line-based templating), simple-git-hooks (`.simple-git-hooks.json` or `package.json` key)
  - **Ecosystem-aware presets**: Node.js (lint-staged, npm test, tsc --noEmit, commitlint), Python (ruff check/format), Rust (cargo fmt/clippy/test), Go (go vet/test) with npm script support for pre-commit actions
  - **lint-staged integration**: read/write `lint-staged` config in `package.json`, preset rules per ecosystem (e.g. `*.{ts,tsx}` → eslint --fix + prettier --write), shown only for Husky/simple-git-hooks
  - **simple-git-hooks support** added to project detection (`.simple-git-hooks.json` or `package.json` key), extending detection from 3 to 4 hook systems
  - 8 new IPC channels (`dev-tools:detect-hooks`, `dev-tools:setup-hook-tool`, `dev-tools:get-hook-install-cmd`, `dev-tools:read-hooks-config`, `dev-tools:write-hooks-config`, `dev-tools:setup-lint-staged`, `dev-tools:get-hook-presets`, `dev-tools:get-lint-staged-presets`)
  - 9 new types (`HookTool`, `GitHookName`, `HookAction`, `LintStagedRule`, `LintStagedConfig`, `HookConfig`, `HookToolRecommendation`, `HooksDetectionResult`, `HooksSetupResult`)
- Dev Tools — Editor Config button expanded into full-featured `.editorconfig` management GUI ([#58](https://github.com/lukadfagundes/cola-records/issues/58))
  - **Editor Config button** always enabled (no longer disabled when `.editorconfig` exists); click toggles an inline management panel
  - **EditorConfigPanel** (`EditorConfigPanel.tsx`): setup mode with ecosystem preset dropdown, live preview, and "Create" button when no config exists; actions mode with Edit Config, Reset to Default (with confirmation), and Delete (with confirmation) when config exists
  - **EditorConfigEditor** (`EditorConfigEditor.tsx`): full-view section-based property editor replacing Tool Box view; `root = true` toggle, section cards with glob input and 2-column property grid (dropdowns for indent_style/end_of_line/charset, number inputs for indent_size/tab_width, toggles for trim_trailing_whitespace/insert_final_newline, max_line_length with "off" option), add/remove sections, Add Preset button, Save (Ctrl+S), dirty tracking, unsaved changes prompt
  - **EditorConfigService** (`editorconfig.service.ts`): INI-style parser and serializer for `.editorconfig` format with comment and section handling; read, write, create with ecosystem presets, and delete operations
  - **Ecosystem-aware presets**: Node.js (space/2 + `*.md` trim_ws override), Python (space/4), Go (tab/4), Rust (space/4), Ruby (space/2), PHP (space/4), Java (space/4) — all with lf, utf-8, trim trailing whitespace, insert final newline
  - Replaced single `dev-tools:setup-editor-config` channel with 5 new channels (`dev-tools:read-editorconfig`, `dev-tools:write-editorconfig`, `dev-tools:create-editorconfig`, `dev-tools:delete-editorconfig`, `dev-tools:get-editorconfig-presets`)
  - 3 new types (`EditorConfigProperties`, `EditorConfigSection`, `EditorConfigFile`)
- Dev Tools — Format button expanded into full-featured formatter configuration GUI ([#59](https://github.com/lukadfagundes/cola-records/issues/59))
  - **Format button** in Workflows section now opens an inline panel instead of running a terminal command directly; always enabled (even when no format command detected via `onFormatClick` callback intercept)
  - **FormatPanel** (`FormatPanel.tsx`): detects project formatter on mount (6 supported: Prettier, Ruff, Black, rustfmt, gofmt, RuboCop); no-config mode with "Create Config" button using ecosystem-aware presets; config-exists mode with 5 action buttons — Run Format (sends command to terminal), Format Check (dry-run with `--check` flag), Edit Config (opens FormatEditor), Create Ignore / Edit Ignore (smart toggle — creates `.prettierignore` or `.ruff_ignore` when absent, opens full-view editor when present)
  - **FormatEditor** (`FormatEditor.tsx`): full-view config editor replacing Tool Box view; **Prettier mode**: 2-column rich GUI with 12 property controls — 5 toggles (semi, singleQuote, useTabs, bracketSpacing, jsxSingleQuote), 2 number inputs (printWidth 40–300, tabWidth 1–16), 5 dropdowns (trailingComma, arrowParens, endOfLine, quoteProps, proseWrap); **Generic mode**: textarea editor for TOML/YAML configs (Ruff, rustfmt, etc.); Save (Ctrl+S), dirty tracking, unsaved changes prompt with "Save and close" / "Close without saving"
  - **FormatConfigService** (`format-config.service.ts`): detect formatters across 7 ecosystems with cross-ecosystem fallback, read/write JSON configs (Prettier) and simple line-based TOML (Ruff/rustfmt), ecosystem-aware presets, ignore file generation
  - **Formatter detection**: Node → Prettier (`.prettierrc.json`, `.prettierrc`, `package.json` key, 8 more config files); Python → Ruff (`ruff.toml`, `pyproject.toml [tool.ruff]`) or Black (`pyproject.toml [tool.black]`); Rust → rustfmt (`rustfmt.toml`); Go → gofmt (no config); Ruby → RuboCop (`.rubocop.yml`)
  - **IgnoreFileEditor** (`IgnoreFileEditor.tsx`): full-view textarea editor for formatter ignore files (`.prettierignore`, `.ruff_ignore`); Save (Ctrl+S), dirty tracking, unsaved changes prompt, hint text for pattern syntax
  - 7 new IPC channels (`dev-tools:detect-formatter`, `dev-tools:read-format-config`, `dev-tools:write-format-config`, `dev-tools:get-format-presets`, `dev-tools:create-format-ignore`, `dev-tools:read-format-ignore`, `dev-tools:write-format-ignore`)
  - 4 new types (`FormatterType`, `FormatterInfo`, `PrettierConfig`, `FormatterConfig`)
- Dev Tools — Test button expanded into full-featured test framework configuration GUI
  - **Test button** in Set Up section now opens an inline panel instead of running a terminal command directly; always enabled (even when no test command detected via `onTestClick` callback intercept)
  - **TestPanel** (`TestPanel.tsx`): detects test framework on mount (9 supported: Vitest, Jest, Mocha, pytest, go test, RSpec, PHPUnit, cargo test, JUnit); no-framework mode with "Create Config" button (Node only, creates `vitest.config.json` with ecosystem presets); framework-detected mode with up to 4 action buttons — Run Tests (sends command to terminal), Coverage (shown only when coverage command detected), Watch (shown only when watch command detected), Edit Config (opens TestEditor)
  - **TestEditor** (`TestEditor.tsx`): full-view config editor replacing Tool Box view; **Vitest mode**: 2-column rich GUI with 8 property controls — 2 dropdowns (environment: jsdom/happy-dom/node/edge-runtime, coverageProvider: v8/istanbul), 1 toggle (globals), 1 number input (testTimeout), 4 coverage threshold sliders (statements/branches/functions/lines 0–100%); **Jest mode**: 3 property controls — 1 dropdown (testEnvironment: jsdom/node), 1 toggle (collectCoverage), 1 dropdown (coverageProvider: v8/babel); **Generic mode**: textarea editor for TS/JS configs; Save (Ctrl+S), dirty tracking, unsaved changes prompt with "Save and close" / "Close without saving"
  - **TestConfigService** (`test-config.service.ts`): detect test frameworks across 7 ecosystems with config file priority, read/write JSON configs (Vitest nested `test.coverage.thresholds` structure, Jest flat), ecosystem-aware presets with sensible defaults (80% coverage thresholds, 5000ms timeout)
  - **Framework detection**: Node → Vitest (`vitest.config.*`), Jest (`jest.config.*`, `package.json` key), Mocha (`.mocharc.*`); Python → pytest (`pytest.ini`, `pyproject.toml [tool.pytest]`, `setup.cfg`); Rust → cargo test (built-in); Go → go test (built-in); Ruby → RSpec (`.rspec`, `Gemfile`); PHP → PHPUnit (`phpunit.xml`); Java → JUnit (built-in)
  - 4 new IPC channels (`dev-tools:detect-test-framework`, `dev-tools:read-test-config`, `dev-tools:write-test-config`, `dev-tools:get-test-presets`)
  - 4 new types (`TestFrameworkType`, `TestFrameworkInfo`, `VitestConfig`, `JestConfig`, `TestFrameworkConfig`)
- Dev Tools — Coverage button expanded into full-featured coverage configuration GUI
  - **Coverage button** in Workflows section now opens an inline panel instead of running a terminal command directly; always enabled (even when no coverage command detected via `onCoverageClick` callback intercept)
  - **CoveragePanel** (`CoveragePanel.tsx`): detects coverage provider on mount (9 supported: v8, istanbul, nyc, coverage-py, go-cover, simplecov, phpunit, tarpaulin, jacoco); no-provider mode with "Create Config" button (Node only, creates config with ecosystem presets); provider-detected mode with up to 4 action buttons — Run Coverage (sends command to terminal), Open Report (opens HTML coverage report in system browser via `shell.openPath()`, shown only when report exists), Edit Config (opens CoverageEditor), Create Config (when no config file exists)
  - **CoverageEditor** (`CoverageEditor.tsx`): full-view config editor replacing Tool Box view; **v8/istanbul rich mode**: 2-column GUI with 11 property controls — 1 dropdown (provider: v8/istanbul), 2 toggles (all, cleanOnRerun), 1 text input (reportsDirectory), 4 threshold number inputs (statements/branches/functions/lines 0–100%), 3 StringListEditor arrays (reporters with datalist suggestions, include, exclude); **Generic mode**: textarea editor for TS/JS configs; Save (Ctrl+S), dirty tracking, unsaved changes prompt with "Save and close" / "Close without saving"
  - **CoverageConfigService** (`coverage-config.service.ts`): detect coverage providers across 7 ecosystems with config file priority and cross-ecosystem fallback, read/write JSON configs (Vitest nested `test.coverage.thresholds` structure, Jest `coverageThreshold.global`), ecosystem-aware presets with 80% thresholds, coverage report scanning (5 common paths)
  - **Provider detection**: Node → v8/Vitest (`vitest.config.*`, `package.json` devDep), istanbul/Jest (`jest.config.*`, `package.json` devDep), nyc (`.nycrc*`, `nyc.config.js`); Python → coverage-py (`.coveragerc`, `pyproject.toml [tool.coverage]`); Rust → tarpaulin (built-in); Go → go-cover (built-in); Ruby → simplecov (`Gemfile`); PHP → PHPUnit (`phpunit.xml`); Java → jacoco (built-in)
  - **Open Report**: scans for HTML coverage reports at 5 common paths (`coverage/index.html`, `coverage/lcov-report/index.html`, `htmlcov/index.html`, `coverage-report/index.html`, `cover/index.html`) and opens in system default browser via Electron `shell.openPath()`
  - 5 new IPC channels (`dev-tools:detect-coverage`, `dev-tools:read-coverage-config`, `dev-tools:write-coverage-config`, `dev-tools:get-coverage-presets`, `dev-tools:open-coverage-report`)
  - 4 new types (`CoverageProviderType`, `CoverageProviderInfo`, `VitestCoverageConfig`, `CoverageConfig`)
- Dev Tools — Build button expanded into full-featured build tool configuration GUI
  - **Build button** in Workflows section now opens an inline panel instead of running a terminal command directly; always enabled (even when no build command detected via `onBuildClick` callback intercept)
  - **BuildPanel** (`BuildPanel.tsx`): detects build tool on mount (14 supported: Vite, Webpack, Rollup, esbuild, tsc, Parcel, setuptools, Poetry Build, go build, cargo build, Gradle, Maven, Bundler, Composer); no-tool mode with "Create Config" button (Node only, creates `vite.config.json` with ecosystem presets); tool-detected mode with up to 4 action buttons — Run Build (sends command to terminal), Dev Build (shown only for Vite/Webpack/Parcel — starts dev server), Clean Build (deletes output directories then rebuilds), Edit Config (opens BuildEditor)
  - **BuildEditor** (`BuildEditor.tsx`): full-view config editor replacing Tool Box view; **Vite mode**: 2-column rich GUI with 9 property controls — 1 text input (outDir), 1 dropdown (target: 8 ES versions), 1 dropdown (sourcemap: true/false/inline/hidden), 1 dropdown (minify: true/false/terser/esbuild), 3 toggles (cssMinify, manifest, emptyOutDir), 2 number inputs (assetsInlineLimit, chunkSizeWarningLimit); **Generic mode**: textarea editor for TS/JS configs; Save (Ctrl+S), dirty tracking, unsaved changes prompt with "Save and close" / "Close without saving"
  - **BuildConfigService** (`build-config.service.ts`): detect build tools across 7 ecosystems with config file priority and cross-ecosystem fallback, read/write JSON configs (Vite nested `build` block), ecosystem-aware presets with sensible defaults (es2020 target, esbuild minifier)
  - **Build tool detection**: Node → Vite (`vite.config.*`), Webpack (`webpack.config.*`), Rollup (`rollup.config.*`), esbuild (`esbuild.config.*`), tsc (`tsconfig.json` with `outDir`), Parcel (`.parcelrc`); Python → setuptools (`setup.py`), Poetry Build (`pyproject.toml [tool.poetry]`); Rust → cargo build (built-in); Go → go build (built-in); Ruby → Bundler (`Gemfile`); PHP → Composer (`composer.json`); Java → Gradle (`build.gradle`), Maven (`pom.xml`)
  - **Dev Build**: per-tool dev server commands — Vite (`npx vite`), Webpack (`npx webpack serve`), Parcel (`npx parcel`); button only shown when dev command is available
  - **Clean Build**: per-tool output directory targets — Vite (`dist`), Webpack (`dist`, `build`), Rollup (`dist`), tsc (`dist`, `build`), cargo build (`target`), Gradle (`build`), Maven (`target`); combines `rm -rf <targets>` with build command in a single terminal execution
  - 4 new IPC channels (`dev-tools:detect-build-tool`, `dev-tools:read-build-config`, `dev-tools:write-build-config`, `dev-tools:get-build-presets`)
  - 4 new types (`BuildToolType`, `BuildToolInfo`, `ViteBuildConfig`, `BuildConfig`)

### Removed

- Remotes dropdown button from Development screen header — redundant now that Dev Tools Info section has a Remotes button running `git remote -v` in the terminal (remotes data fetching preserved for fork-aware PR creation)

### Fixed

- Clean button failing on Windows — trailing slashes in `CLEAN_TARGETS` patterns caused backslash-escaped quotes in `rm -rf` commands, and Windows `path.join` produced backslash paths incompatible with Git Bash; paths now normalized to POSIX forward slashes
- MaintenanceTool crash when project detection returns `undefined` — strengthened null check to handle both `null` and `undefined` states
- Removed non-null assertion in `DocsViewer.tsx` link click handler (ESLint warning cleanup)

## [1.0.10] - 2026-02-24

### Added

- Sub-issue branch inheritance with three-tier badge hierarchy in Issues tool ([#49](https://github.com/lukadfagundes/cola-records/issues/49))
  - **Primary** (purple): branched issues that have sub-issues
  - **Secondary** (yellow): sub-issues of Primary issues, shown in list view and detail view sub-issue rows
  - **branched** (blue): standalone branched issues without sub-issues (unchanged)
  - Fetches sub-issues for each branched issue via `github:list-sub-issues` to build inherited + primary sets
  - Inherited sub-issues sorted alongside directly-branched issues in the list
  - Detail modal receives `branches` prop to show branched/Secondary badges on sub-issue row items
  - Graceful degradation: API errors per-call caught with empty fallback, zero additional calls when no issues are branched
- "Project" documentation category showing root-level files (README, CHANGELOG, CONTRIBUTING, LICENSE) in the Documentation screen ([#48](https://github.com/lukadfagundes/cola-records/issues/48))

### Fixed

- Documentation screen showing "No documentation found" in packaged builds — `docs/` directory was not included in `extraResource` and path resolution used incorrect APIs ([#48](https://github.com/lukadfagundes/cola-records/issues/48))
- Clicking relative `.md` links in documentation now navigates to the linked document within the docs viewer instead of doing nothing ([#48](https://github.com/lukadfagundes/cola-records/issues/48))

### Tests

- Sub-issue branch inheritance tests ([#49](https://github.com/lukadfagundes/cola-records/issues/49))
  - `IssuesTool.test.tsx`: 5 new tests for Secondary badge display, Primary badge display, sorting with branched parents, no badge without branched parent, and `isBranched` prop passing to detail modal
  - `DevelopmentIssueDetailModal.test.tsx`: 2 new tests for sub-issue row badge rendering with/without branched parent

## [1.0.9] - 2026-02-24

### Fixed

- Removed `credential.helper` override from GIT_ASKPASS env injection — blanking the system credential helper caused "Invalid username or token" errors when the app token differed from the system credential ([#37](https://github.com/lukadfagundes/cola-records/issues/37))
- Fixed Windows batch askpass script using delayed expansion (`!TOKEN!`) so the token is actually read at execution time instead of parse time ([#37](https://github.com/lukadfagundes/cola-records/issues/37))
- Moved git-credentials file from host `~/.git-credentials` to app-private `userData/git-credentials` — prevents Cola Records from overriding the system Git credential helper in VS Code, Git Bash, and other terminals ([#37](https://github.com/lukadfagundes/cola-records/issues/37))
- Added one-time migration to remove `x-access-token` entries Cola Records previously wrote to host `~/.git-credentials` ([#37](https://github.com/lukadfagundes/cola-records/issues/37))

## [1.0.8] - 2026-02-23

### Added

- GIT_ASKPASS credential helper for Tool Box Terminal — Git operations (`push`, `pull`, `fetch`) now authenticate automatically using the app's stored GitHub token ([#37](https://github.com/lukadfagundes/cola-records/issues/37))
  - Platform-specific askpass script (`.sh` on Unix, `.bat` on Windows) using the `x-access-token` pattern
  - Token stored in separate file with 0o600 permissions — script contains no secrets
  - Token file updates immediately when GitHub token changes in Settings
  - Automatic cleanup of askpass files on app quit

### Fixed

- Sub-issues are now clickable — clicking a sub-issue navigates to its detail view with a parent issue breadcrumb for easy back-navigation ([#41](https://github.com/lukadfagundes/cola-records/issues/41))
  - Sub-issues opened from the issues list auto-detect their parent via the GitHub parent issue API
- Actions tool now displays the workflow name for each run in the list view and run detail summary ([#36](https://github.com/lukadfagundes/cola-records/issues/36))
- Fixed terminal cursor/focus loss when switching branches — branch polling triggered unnecessary re-renders that destroyed and recreated the xterm.js terminal every 5 seconds ([#39](https://github.com/lukadfagundes/cola-records/issues/39))
  - Stabilized `XTermTerminal` init effect by using refs for callbacks (empty dependency array — runs once on mount)
  - Guarded `setCurrentBranch` polling to skip no-op state updates when the branch hasn't changed
- Dev Scripts panel now uses `styled-scroll` for consistent scrollbar styling
- Multi-terminal dev scripts now retain full output across tab switches ([#42](https://github.com/lukadfagundes/cola-records/issues/42))
  - Added server-side output buffer (512 KB cap) per PTY session — `XTermTerminal` replays the buffer on mount
  - `ScriptExecutionModal` now renders all terminal instances simultaneously (CSS `visibility:hidden` for inactive tabs) so every terminal receives live data and initializes with proper dimensions
- Project names with spaces now display correctly in open project tabs and contribution cards — URL-encoded `%20` characters are properly decoded ([#43](https://github.com/lukadfagundes/cola-records/issues/43))
- Added `Workflows: Read/Write` to the required GitHub token scopes listed in Settings API tab

### Tests

- GIT_ASKPASS service tests covering initialization, platform script generation, token file management, env var injection, and cleanup ([#37](https://github.com/lukadfagundes/cola-records/issues/37))
- Terminal service tests for GIT_ASKPASS env var injection into PTY spawn ([#37](https://github.com/lukadfagundes/cola-records/issues/37))
- Added tests for workflow name visibility in Actions tool list view and run detail view ([#36](https://github.com/lukadfagundes/cola-records/issues/36))
- XTermTerminal init stability tests — verifies terminal is not re-initialized when callback references change, and latest callback is used via ref ([#39](https://github.com/lukadfagundes/cola-records/issues/39))
- Sub-issue navigation tests for clickable rows, parent breadcrumb rendering, parent/child navigation, and auto-detection via getParentIssue API in DevelopmentIssueDetailModal and IssuesTool ([#41](https://github.com/lukadfagundes/cola-records/issues/41))
- `getParentIssue` service tests for parent lookup, 404/403 handling, and error propagation ([#41](https://github.com/lukadfagundes/cola-records/issues/41))
- Terminal output buffer tests covering accumulation, size cap, and cleanup on kill ([#42](https://github.com/lukadfagundes/cola-records/issues/42))
- `XTermTerminal` buffer replay tests for mount-time fetch, `initialOutput` skip, and null handling ([#42](https://github.com/lukadfagundes/cola-records/issues/42))
- `ScriptExecutionModal` multi-terminal rendering tests verifying all tabs mount simultaneously with CSS visibility toggling ([#42](https://github.com/lukadfagundes/cola-records/issues/42))

## [1.0.7] - 2026-02-20

### Added

- Toggle mode for dev scripts — alternating start/stop commands with visual state feedback ([#34](https://github.com/lukadfagundes/cola-records/issues/34))
  - New `DevScriptToggle` interface with first/second press name and command pairs
  - SQLite schema v7 migration adding `toggle` column to `dev_scripts` table
  - 3-way mode selector in script form (Single / Multi / Toggle)
  - Toggle scripts execute directly via PTY (spawn/write/kill) without modal
  - Ephemeral toggle state tracked in Zustand store (resets on app restart)
  - Power icon and "Toggle" badge distinguish toggle scripts visually

### Tests

- Toggle dev script tests covering database, store, ScriptButton, DevScriptsTool form, and DevelopmentScreen integration ([#34](https://github.com/lukadfagundes/cola-records/issues/34))

## [1.0.6] - 2026-02-20

### Security

- Sanitized git error messages to prevent token leakage to renderer (MED-005)
  - Created `src/main/utils/sanitize-error.ts` with `sanitizeGitError()` stripping `x-access-token` URLs
  - Applied to all 19 throw statements in `git.service.ts` that interpolate error messages
- Fixed innerHTML XSS vector in MermaidBlock component (CRIT-001)
  - Added DOMPurify sanitization of Mermaid SVG output before DOM insertion
  - DOMPurify config allows SVG profiles and `foreignObject` for Mermaid compatibility
  - Blocks `<script>` tags, event handler attributes, and other XSS vectors
  - Added `dompurify` as direct dependency (previously transitive only)
- Reduced npm vulnerabilities from 75 to 52, eliminating all critical CVEs (HIGH-002)
  - Removed `electron-icon-builder` (unused — pulled in `phantomjs-prebuilt` chain with 2 critical `form-data` CVEs)
  - Ran `npm audit fix` for safe transitive dependency patches
  - Remaining 52 vulnerabilities are dev-only toolchain deps (Electron Forge, ESLint) with zero runtime impact

### Added

- Centralized logging infrastructure with `electron-log` (MED-001)
  - Created `src/main/utils/logger.ts` (main process) and `src/renderer/utils/logger.ts` (renderer) with tagged `createLogger(tag)` factory
  - Replaced all 44 `console.log/error/warn` statements across 11 source files with structured, file-rotating logger
  - Log levels: `debug` for dev-mode guards and config detection, `info` for operational events, `warn` for non-critical guards, `error` for failures
  - File transport: 10 MB rotation, `info` level; console transport: `debug` level
- Test coverage baseline and regression thresholds (MED-003)
  - Configured `vitest.config.ts` coverage thresholds: statements 64%, branches 56%, functions 61%, lines 65%
  - Baseline measured at: statements 69.59%, branches 61.27%, functions 66.85%, lines 70.48%
- Contribution workflow rollback logic (MED-006)
  - Implemented `rollback()` in `useContributionWorkflow` with `clonedPath` and `savedContributionId` state tracking
  - On failure: deletes partially cloned directory via `fs:delete-directory` and removes DB record via `deleteContribution`
  - Rollback errors are caught and logged without masking the original error

### Documentation

- Updated all 4 docs/ files to match codebase reality after v1.0.4–v1.0.5 feature additions
  - `component-hierarchy.md`: 87 → 108 components; added Dashboard (7), Documentation (3), Updates (1) sections with mermaid diagrams; updated Screens 7→8, Tools 7→11, Settings 4→5
  - `mvc-flow.md`: added GitHub Actions, Releases, Dashboard, and Documentation data flow diagrams; updated IPC channel counts (108→163 invoke + 9 events); added useUpdaterStore to state table; documented domain-split service architecture
  - `api-development.md`: added 27 new GitHub channels (Actions, Releases, Search, PR operations); added Event Channels and Domain-Split Service Architecture sections; fixed IPC client examples (`window.electron` → `ipc`)
  - `getting-started.md`: updated component/store/screen counts; added Dashboard and Documentation feature descriptions; fixed contributing guide link
- Fixed inaccuracies in `CONTRIBUTING.md`
  - Corrected IPC usage example (`window.electron.invoke` → `ipc.invoke`)
  - Fixed test file location (co-located → `tests/` directory mirroring `src/`)

### Changed

- Split `channels.ts` (1,241 LOC) into domain-based type modules with barrel re-export (HIGH-003)
  - `channels/types.ts` — 46 shared interfaces and type aliases
  - `channels/github.channels.ts` — `GitHubChannels` partial interface (git, github, gitignore channels)
  - `channels/integrations.channels.ts` — `IntegrationChannels` partial interface (spotify, discord channels)
  - `channels/core.channels.ts` — `CoreChannels` partial interface (fs, contribution, settings, terminal, etc.)
  - `channels/events.ts` — `IpcEvents` interface (9 events)
  - `channels/index.ts` — barrel composing `IpcChannels` via `extends`; original `channels.ts` reduced to 1-line re-export
  - Zero import changes needed in consuming files (backward-compatible barrel)
- Extracted `PullRequestDetailModal` types and utilities into `pr-detail/` module (HIGH-003)
  - `pr-detail/types.ts` — 11 interfaces + `TimelineItem` union type
  - `pr-detail/utils.tsx` — 6 pure utility functions (`reviewStateBadge`, `statusBadge`, `formatDate`, `formatRelativeTime`, `parseDiffHunkHeader`, `getReviewActionText`)
  - `pr-detail/index.ts` — barrel re-export
  - `PullRequestDetailModal.tsx` reduced by ~200 lines
- Split `github-rest.service.ts` (1,615 LOC, 50 methods) into domain modules with facade pattern (HIGH-003)
  - `github/github-rest-base.service.ts` — base class with Octokit client init and token resolution
  - `github/github-issues.service.ts` — 10 standalone functions for issue CRUD, comments, assignees, reactions
  - `github/github-pull-requests.service.ts` — 16 standalone functions for PR CRUD, reviews, merge, timeline, check status
  - `github/github-extras.service.ts` — 24 standalone functions for comment reactions, repos, actions, releases, search, events, sub-issues
  - `github/index.ts` — facade class extending base, delegating all 50 methods to standalone functions
  - Original `github-rest.service.ts` reduced to 1-line barrel re-export
- Split `code-server.service.ts` (1,597 LOC) into domain modules with orchestration pattern (HIGH-003)
  - `code-server/types.ts` — interfaces, defaults, constants (`CodeServerStatus`, `CodeServerStartResult`, `WorkspaceBasePaths`, `CodeServerStats`)
  - `code-server/path-mapper.ts` — port allocation, Docker path conversion, workspace path mapping, memory string parsing
  - `code-server/config-sync.ts` — VS Code settings, git config, bashrc, SSH config sync, mount helpers
  - `code-server/docker-ops.ts` — Docker CLI execution, image management, container lifecycle, health checks, stats
  - `code-server/index.ts` — orchestration class managing container state and delegating to modules
  - Original `code-server.service.ts` reduced to 2-line barrel re-export
- Split `setupIpcHandlers()` (164 handlers, ~1,202 LOC) from `index.ts` into 6 domain handler modules (HIGH-003)
  - `handlers/github.handlers.ts` — 53 handlers for GitHub REST, GraphQL, reactions, reviews, releases, actions, sub-issues
  - `handlers/core.handlers.ts` — 33 handlers for echo, fs, git, gitignore, dialog, shell, docs
  - `handlers/contribution.handlers.ts` — 8 handlers for contribution and project scanning
  - `handlers/settings.handlers.ts` — 4 handlers for settings CRUD and SSH remotes
  - `handlers/integrations.handlers.ts` — 47 handlers for Spotify and Discord
  - `handlers/dev-tools.handlers.ts` — 19 handlers for code-server, terminal, dev-scripts, updater
  - `handlers/index.ts` — composer calling all 6 domain setup functions
  - `index.ts` reduced from 1,361 to 153 lines (lifecycle only)
- Eliminated all 86 unsafe `any` type annotations across 5 API service files (HIGH-001)
  - Created `src/types/spotify-api.types.ts` — 7 interfaces for Spotify REST API response shapes
  - Created `src/types/github-graphql.types.ts` — 7 interfaces for GitHub GraphQL response shapes
  - Created `src/types/discord-api.types.ts` — 22 interfaces for Discord REST API response shapes
  - `discord.service.ts`: 35 `any` → proper Discord API types
  - `github-rest.service.ts`: 28 `any` → Octokit inferred types + inline type assertions
  - `github-graphql.service.ts`: 11 `any` → GraphQL generic response types
  - `spotify.service.ts`: 7 `any` → Spotify API response types
  - `github.service.ts`: 1 `any[]` → `unknown[]`
  - Fixed 3 catch blocks: `catch (error: any)` → `catch (error: unknown)` with proper type narrowing

### Fixed

- Fixed `removeAllIpcHandlers()` missing 22 channels from cleanup list (HIGH-003)
  - Added all missing channels: code-server workspace management, terminal, dev-scripts, git branch ops, GitHub review comments/threads, releases, actions, PR check status, SSH remotes
  - Channel list now covers all 164 registered IPC handlers

### Tests

- Git error sanitization tests (MED-005)
  - `sanitize-error.test.ts`: 9 tests covering token stripping, multiple occurrences, non-token preservation, Error/string/undefined inputs
- Contribution workflow rollback tests (MED-006)
  - 4 new tests: directory cleanup on post-clone failure, no cleanup when clone never reached, no DB delete when contribution unsaved, graceful rollback error handling
- Global `electron-log` test mocks added to `tests/setup.ts` for `electron-log/renderer` and `electron-log/main`
- MermaidBlock sanitization tests (CRIT-001)
  - 3 new tests: DOMPurify called with correct config, script tag stripping, event handler stripping
  - Existing tests updated with DOMPurify mock (passthrough — no behavior change for valid SVG)

## [1.0.5] - 2026-02-19

### Added

- Dashboard screen with 6 live widgets in a responsive 2-column grid ([#18](https://github.com/lukadfagundes/cola-records/issues/18))
  - **Contribution Status** widget: 4 metric cards (Open PRs, Merged PRs 30d, Open Issues, Closed Issues 30d) via `github:search-issues-and-prs` with `Promise.allSettled` error isolation
  - **GitHub Profile** widget: real avatar image (with initial fallback), bio, "Member since" date, 4-stat row (Repos/Stars/Followers/Following), and top-3 language usage bar via expanded `github:get-authenticated-user` GraphQL query and `github:list-user-repos` IPC channel
  - **PRs Needing Attention** widget: up to 10 open PRs the user is involved in (`involves:` query — authored, assigned, review-requested, mentioned) with aggregated review state and CI status, plus "Open in Cola Records" button per entry via `github:search-issues-and-prs`, `github:list-pr-reviews`, `github:get-pr-check-status`
  - **Open Issues** widget: issues assigned to user AND issues authored by user across all of GitHub via dual `github:search-issues-and-prs` queries with `Promise.allSettled`, merged and deduplicated, sorted by newest first, limited to 10, with label badges and "Open in Cola Records" button per entry
  - **Recent Activity** widget: last 10 GitHub events (push, PR, issue, create, delete, fork, star, comment, review, release) via `github:list-user-events` with type-specific icons
  - **CI/CD Status** widget: latest workflow run per repo (all repos, no limit) with color-coded status dots (green/red/yellow/gray), sorted by most recent, limited to 10 displayed, via `github:list-user-repos`, `github:list-workflow-runs` and `Promise.allSettled` error isolation
  - Reusable `DashboardWidget` wrapper component with loading spinner, error + retry, empty state, and no-token fallback rendering
  - Shared dashboard utilities: `formatRelativeTime`, CI status color constants
  - New `github:search-issues-and-prs` IPC channel wrapping GitHub Search API with normalized results
  - New `github:list-user-events` IPC channel wrapping GitHub Events API with normalized event data
  - Barrel export for all dashboard components and utilities (`components/dashboard/index.ts`)
  - All widgets fetch data directly from GitHub API — no dependency on local contributions store
  - Graceful degradation: widgets detect missing GitHub token and show "Connect GitHub in Settings" prompt
  - "Open in Cola Records" navigation: PRs, Issues, and CI/CD widgets include a per-entry button that matches `repoFullName` to a local Contribution record and opens the project in the IDE via `DashboardScreen` → `App.tsx` `handleOpenIDE` callback plumbing
- Auto-assign issue to authenticated user when clicking "Fix Issue" in the Issues tool ([#18](https://github.com/lukadfagundes/cola-records/issues/18))
  - New `github:add-assignees` IPC channel wrapping `client.issues.addAssignees`
  - New `addAssignees()` method in `GitHubRestService`
  - Best-effort assignment after branch creation — failure does not block the Fix Issue flow

### Fixed

- Fixed Create Pull Request form not scrolling in Tool Box inline mode ([#25](https://github.com/lukadfagundes/cola-records/issues/25))
  - Removed `overflow-hidden` from `formContent` wrapper in `CreatePullRequestModal` which was blocking the outer scroll container
  - Title, Description, and Submit button are now reachable when the comparison preview is tall
- Fixed terminal output overflow breaking Tool Box layout ([#26](https://github.com/lukadfagundes/cola-records/issues/26))
  - Replaced `calc(100% - terminalHeight)` with flex-based layout in ToolsPanel to prevent ~44px overflow when header and drag handle were unaccounted for
  - Added `overflow-hidden` to ToolsPanel wrapper in DevelopmentScreen for containment
  - Header now has explicit `shrink-0` to prevent compression when terminal is large
- Fixed dev scripts from wrong project appearing in header and Tool Box when multiple projects open ([#24](https://github.com/lukadfagundes/cola-records/issues/24))
  - Changed `useDevScriptsStore` to merge scripts from multiple projects instead of replacing the global array
  - Added `selectScriptsForProject()` utility for consumer-side filtering by `projectPath`
  - `DevelopmentScreen` header buttons now filter by `contribution.localPath`
  - `DevScriptsTool` script list now filters by `workingDirectory`
- Fixed links in code-server opening in Electron window instead of user's default browser ([#28](https://github.com/lukadfagundes/cola-records/issues/28))
  - Added global `app.on('web-contents-created')` handler with `setWindowOpenHandler` to redirect external URLs via `shell.openExternal`
  - Only `http://` and `https://` protocols are opened externally (security hardening)

### Tests

- Dashboard feature tests
  - `utils.test.tsx`: tests covering `formatRelativeTime`, CI status color constants
  - `DashboardWidget.test.tsx`: 10 tests covering loading, error, empty, noToken, children, retry, and state priority
  - `ContributionStatusWidget.test.tsx`: 5 tests covering 4 metric cards with counts, no-token fallback, partial/total failure handling
  - `GitHubProfileWidget.test.tsx`: 14 tests covering loading, error, data, noToken, avatar image/fallback, bio, followers/following, "Member since" date, language bar, repo count, stars
  - `PRsNeedingAttentionWidget.test.tsx`: 9 tests covering PR list, review/CI icons, empty state, 10-item limit, `involves:` query, Open button callback, no Open button without prop, error handling
  - `OpenIssuesWidget.test.tsx`: 11 tests covering issue list, labels, 10-item limit, noToken, dual-query merge/dedup, assigned + authored results, Open button callback, no Open button without prop, error handling
  - `RecentActivityWidget.test.tsx`: 9 tests covering event descriptions (push/PR/issue/create), 10-item limit, noToken, error handling
  - `CICDStatusWidget.test.tsx`: 13 tests covering pipeline list, status dots (green/red/yellow), empty repos, all-rejected error surfacing, noToken, all repos processed (no 5-repo limit), 10-pipeline display limit, Open button callback, no Open button without prop
  - `DashboardScreen.test.tsx`: 8 tests covering header, widget composition, grid layout, scrollable area, `onOpenIDE` prop plumbing to PRs, Issues, and CI/CD widgets
  - `github-rest.service.test.ts`: 9 new tests for `searchIssuesAndPullRequests` and `listUserEvents` (field mapping, query pass-through, empty results, API errors)
  - `github-rest.service.test.ts`: 2 new tests for `addAssignees` (correct params, API error)
  - `DevelopmentIssueDetailModal.test.tsx`: 2 new tests for Fix Issue auto-assign (assigns user after branch creation, completes when assignment fails)
  - `CreatePullRequestModal.test.tsx`: 1 new test for inline mode scrollable container regression check
  - `ToolsPanel.test.tsx`: 1 new test for flex-based tool content layout regression guard ([#26](https://github.com/lukadfagundes/cola-records/issues/26))
- Dev script overrun fix tests ([#24](https://github.com/lukadfagundes/cola-records/issues/24))
  - `useDevScriptsStore.test.ts`: 6 new tests for multi-project merge behavior and `selectScriptsForProject`
  - `DevScriptsTool.test.tsx`: 2 new tests for cross-project script isolation
  - Updated existing "different project paths" test for merge semantics
  - Updated store mocks in 4 DevelopmentScreen test files and ToolsPanel test to export `selectScriptsForProject`
- Webview external link redirect tests ([#28](https://github.com/lukadfagundes/cola-records/issues/28))
  - `webview-external-links.test.ts`: 5 tests covering handler registration, http/https redirect, deny action, and non-http protocol blocking

## [1.0.4] - 2026-02-17

### Added

- Persistent webview sessions for multi-project support ([#6](https://github.com/lukadfagundes/cola-records/issues/6))
  - All open DevelopmentScreens now render persistently using CSS visibility toggling (`display: none`/`display: contents`) instead of conditional mounting
  - Background processes (Claude Code, terminals, builds) survive tab switches — webview WebSocket connections stay alive
  - Previously, switching project tabs unmounted the `<webview>`, severing the code-server connection and killing the Extension Host Process ~5 min later
- In-app documentation reader with category navigation and Mermaid diagram support ([#8](https://github.com/lukadfagundes/cola-records/issues/8))
  - New "Documentation" screen accessible from sidebar navigation
  - Category-based browsing of `docs/` directory (subdirectories as categories)
  - Full GitHub Flavored Markdown rendering with Mermaid diagram support
  - New `docs:get-structure` IPC channel for documentation tree retrieval
- Code Server settings tab for Docker container resource configuration ([#3](https://github.com/lukadfagundes/cola-records/issues/3))
  - Resource allocation with presets (Light, Standard, Performance, Unlimited) and manual CPU/memory/shared memory controls
  - Live container usage display polling `docker stats` every 5 seconds with CPU and memory progress bars
  - Startup behavior settings: auto-start Docker Desktop toggle and configurable health check timeout
  - VS Code settings: auto-sync host settings toggle, GPU acceleration select, terminal scrollback lines
  - Extension management: add/remove VS Code extension IDs for auto-install on container start
  - Environment configuration: timezone setting and custom environment variables with reserved name validation
  - Advanced: configurable container name
  - New `code-server:get-stats` IPC channel for real-time container resource monitoring
  - New `CodeServerConfig` and `EnvVar` type definitions with full IPC round-trip persistence
- Automatic container recreation when resource config changes ([#3](https://github.com/lukadfagundes/cola-records/issues/3))
  - `hasResourceConfigChanged()` compares saved CPU/memory/SHM settings against running container via `docker inspect`
  - `parseMemoryString()` converts Docker memory notation (e.g. `4g`, `512m`) to bytes for comparison
  - `start()` now detects config drift on stopped or running containers and recreates with updated settings
- `checkDockerAvailable()` respects `autoStartDocker` config setting — throws immediately when disabled instead of polling
- Tool Box expansion: Issues and Pull Requests moved from header dropdowns into Tool Box panel ([#16](https://github.com/lukadfagundes/cola-records/issues/16))
  - New `IssuesTool` component with inline list, detail, and create views inside Tool Box
  - New `PullRequestsTool` component with inline list, detail, and create views inside Tool Box
  - Tool Box now opens by default when entering Development screen with 60/40 IDE/Tool Box split
  - Tool Box panel is resizable by dragging the border (min 300px, max 70% of viewport)
  - Invisible overlay during resize prevents Electron `<webview>` from capturing mouse events (fixes drag lock and choppy movement)
  - First-click resize reads actual DOM width to avoid snap when pixel state is uninitialized
  - Tool navigation order: Issues → Pull Requests → Actions → Dev Scripts → Terminal → Maintenance
  - Header Issues/PR buttons now act as Tool Box navigation shortcuts (color indicators preserved)
  - Added `inline` rendering mode to `DevelopmentIssueDetailModal`, `CreateIssueModal`, `PullRequestDetailModal`, and `CreatePullRequestModal`
  - Removed standalone Issues/PR dropdown panels and modal popups from header toolbar
- GitHub Actions tool in Tool Box with workflow run monitoring ([#16](https://github.com/lukadfagundes/cola-records/issues/16))
  - New `ActionsTool` component with list → run detail → job logs navigation
  - Workflow runs list with color-coded status badges (green/red/yellow/gray), branch, event, actor, and relative timestamps
  - Run detail view showing summary metadata, jobs with duration, and step-by-step status dots
  - Job logs viewer with truncation (last 500 lines) and "Open in GitHub" link
  - 3 new IPC channels: `github:list-workflow-runs`, `github:list-workflow-run-jobs`, `github:get-job-logs`
  - 3 new `GitHubRestService` methods: `listWorkflowRuns`, `listWorkflowRunJobs`, `getJobLogs`
- GitHub Releases tool in Tool Box with full release lifecycle management ([#16](https://github.com/lukadfagundes/cola-records/issues/16))
  - New `ReleasesTool` component with list → detail → draft-edit → create views
  - Releases list sorted newest-to-oldest with Latest, Draft, and Pre-release badges
  - Detail view with full Markdown rendering (ReactMarkdown + remark-gfm + rehype-raw) and delete confirmation
  - Draft edit view with tag, title, body (MarkdownEditor with write/preview tabs), pre-release and latest checkboxes, save/publish/delete actions
  - Create view for new draft releases with tag name, title, target branch, body, and pre-release/latest options
  - 6 new IPC channels: `github:list-releases`, `github:get-release`, `github:create-release`, `github:update-release`, `github:delete-release`, `github:publish-release`
  - 5 new `GitHubRestService` methods: `listReleases`, `getRelease`, `createRelease`, `updateRelease`, `deleteRelease`
  - Tool navigation order updated: Issues → Pull Requests → Actions → Releases → Dev Scripts → Terminal → Maintenance
- Persistent terminal bar at bottom of Tool Box panel ([#16](https://github.com/lukadfagundes/cola-records/issues/16))
  - Terminal removed from hamburger menu navigation (6 tools remain: Issues, Pull Requests, Actions, Releases, Dev Scripts, Maintenance)
  - Minimized terminal bar always visible at bottom of Tool Box regardless of active tool, with Terminal icon, label, and expand chevron
  - Click to expand terminal to 50% of Tool Box height; tool content on top, terminal on bottom
  - Vertical drag-to-resize handle between tool content and terminal when expanded (min 100px, max 80% of container)
  - Invisible overlay during resize prevents content from capturing mouse events (same pattern as horizontal IDE/Tool Box resize)
  - `adoptSessions` auto-expands terminal bar instead of switching active tool
  - Tool navigation order updated: Issues → Pull Requests → Actions → Releases → Dev Scripts → Maintenance (Terminal is always-present fixture)

### Tests

- 7 new tests for persistent webview sessions (1759 total, 109 test files, all passing)
  - `App.persistent-webviews.test.tsx`: 7 tests covering simultaneous rendering, display state toggling, tab switch DOM preservation, non-IDE screen hiding, project close cleanup, and empty state
- 67 new tests for Code Server settings feature (1752 total, 108 test files, all passing)
  - `CodeServerTab.test.tsx`: 37 tests covering rendering, presets, save/reset/validation, extensions, env vars, stats polling
  - `code-server.service.test.ts`: 24 tests covering resource config in `createContainer`, env/startup config, `getContainerStats`, `hasResourceConfigChanged`, container recreation on config change
  - `useSettingsStore.test.ts`: 4 tests covering `codeServerConfig` state lifecycle
  - `SettingsScreen.test.tsx`: 2 tests covering Code Server tab navigation
  - `factories.ts`: New `createMockCodeServerConfig()` and `createMockEnvVar()` test factories
- 31 new tests for Tool Box expansion (all passing)
  - `IssuesTool.test.tsx`: 15 tests covering list/detail/create views, sorting, badges, callbacks, error/empty states
  - `PullRequestsTool.test.tsx`: 16 tests covering list/detail/create views, sorting, badges, callbacks, error/empty states
  - Updated `ToolsPanel.test.tsx` for new default tool (Issues) and 6-tool menu
  - Updated `DevelopmentScreen.toolbar.test.tsx` for Tool Box navigation pattern (removed dropdown/modal tests)
- Tests for GitHub Actions tool
  - `ActionsTool.test.tsx`: 18 tests covering list/detail/logs views, status badges, navigation, refresh, error/empty states
  - `github-rest.service.test.ts`: 9 new tests for `listWorkflowRuns`, `listWorkflowRunJobs`, `getJobLogs` (field mapping, empty results, API errors)
  - Updated `DevelopmentScreen.tools.test.tsx` to remove stale modal mocks
- Tests for GitHub Releases tool
  - `ReleasesTool.test.tsx`: 22 tests covering list/detail/draft-edit/create views, badges, navigation, delete confirmation, publish, MarkdownEditor integration
  - `github-rest.service.test.ts`: 15 new tests for `listReleases`, `getRelease`, `createRelease`, `updateRelease`, `deleteRelease` (field mapping, isLatest inference, empty results, API errors)
  - Updated `ToolsPanel.test.tsx` for 7-tool menu
- Tests for persistent terminal bar
  - Updated `ToolsPanel.test.tsx`: 6-tool menu assertions (Terminal removed), new `persistent terminal bar` describe block with 5 tests (minimized bar rendering, expand on click, collapse on click, drag handle presence, bar visible across tool switches), updated adoption tests for auto-expand behavior

## [1.0.3] - 2026-02-15

### Added

- Branch naming now follows `<type>/<number>-<description>` convention ([#7](https://github.com/lukadfagundes/cola-records/issues/7))
  - Added `generateBranchName()` utility that maps GitHub labels to type prefixes (bug→fix, enhancement→feat, documentation→docs, etc.)
  - Updated both Development screen and Issues screen branch creation to use new naming

## [1.0.2] - 2026-02-15

### Fixed

- Fixed terminal double-paste bug where Ctrl+V pasted clipboard content twice ([#1](https://github.com/lukadfagundes/cola-records/issues/1))
  - Switched from `onData` to `terminal.paste()` so paste flows through xterm's data handler exactly once
  - Added `e.preventDefault()` to block the browser's native paste event
- Fixed issue close/reopen failing silently with no user feedback ([#10](https://github.com/lukadfagundes/cola-records/issues/10))
  - Added error alerts to `handleCloseIssue` and `handleReopenIssue` so users see why the operation failed
  - Added `Issues: Read/Write` to required GitHub token permissions in `.env.example`
- Fixed Issues button color and "branched" badge not updating after Fix Issue creates a branch
  - Extracted branch fetching into reusable `fetchBranches` callback and added it to the issue modal's `onClose` handler
  - Fix required permissions in 'settings/api' screen
- Fixed "Stop & Back" button closing all open projects instead of only the active one ([#4](https://github.com/lukadfagundes/cola-records/issues/4))
  - Changed `stopAndGoBack` to use `code-server:remove-workspace` instead of `code-server:stop` so only the current project's workspace is removed
  - Changed `handleNavigateBack` to use `closeProject` instead of `closeAll` so other open projects are preserved

### Added

- Auto-start Docker Desktop when navigating to the Development screen ([#5](https://github.com/lukadfagundes/cola-records/issues/5))
  - Added `launchDockerDesktop()` with platform-specific launch commands (macOS, Windows, Linux)
  - Modified `checkDockerAvailable()` to automatically launch Docker Desktop and poll for up to 60 seconds

## [1.0.1] - 2026-02-12

### Fixed

- Moved `app-update.yml` generation to `postPackage` hook so file is placed in correct location (resources folder next to app.asar)
- Fixed `postPackage` hook to handle macOS app bundle structure (`Cola Records.app/Contents/Resources/`) for `app-update.yml` generation

## [1.0.0] - 2026-02-12

### Changed

- Replaced dark mode toggle in AppBar with dynamic version indicator

### Added

#### Core Application

- Electron 40.x desktop application with React 19 and TypeScript
- Main process (Node.js) + Renderer process (React) architecture with IPC bridge
- SQLite database with better-sqlite3 (schema version 6, 5 tables)
- Auto-update functionality via electron-updater with GitHub Releases integration
- Secure storage service for credential management

#### User Interface

- 7 application screens: Dashboard, Issues, Contributions, Projects, Professional, IDE, Settings
- 87 React components built with Radix UI primitives and Tailwind CSS
- 9 Zustand stores for state management (5 exported via index, 4 direct import)
- Monaco Editor integration for code editing
- React resizable panels for flexible layouts
- Toast notifications via Sonner
- Virtualized lists with react-window for performance

#### Issue Discovery

- GitHub "good first issues" search across repositories
- Issue filtering by language, labels, and repository
- Issue detail view with full markdown rendering
- Issue caching with local database storage

#### Contribution Tracking

- Fork and clone repositories directly from the app
- Track contribution progress through workflow stages
- Contribution status management (In Progress, Completed, Abandoned)
- Contribution scanner service for project directory analysis

#### Git Integration

- Built-in Git operations: clone, commit, push, pull, fetch
- Branch management: create, switch, delete, checkout
- Remote management: add, remove, configure remotes
- Git status and diff viewing
- Simple-git library integration with 17 IPC channels
- Gitignore service for managing ignore patterns

#### GitHub Integration

- GitHub REST API client (@octokit/rest) with 45 IPC channels
- GitHub GraphQL API client (@octokit/graphql)
- Pull request creation and management
- Issue viewing and interaction
- Repository search and discovery
- User profile and authentication

#### Embedded IDE (Development Screen)

- Code-server (VS Code) running in Docker container
- Full editor capabilities with extension support
- 6 IPC channels for container management
- Container status monitoring and health checks

#### Terminal Integration

- Multi-tab terminal with node-pty backend
- Shell support: Git Bash, PowerShell, CMD
- xterm.js frontend with addon-fit and web-links
- 4 IPC channels for PTY terminal management
- Working directory synchronization with projects

#### Spotify Integration

- Spotify Web API integration with OAuth authentication
- Music playback during development sessions
- Now playing display with track information
- Playback controls (play, pause, skip, volume)
- 18 IPC channels for Spotify operations
- Dedicated Spotify store for playback state

#### Discord Integration

- Discord REST API integration for messaging
- Server and channel listing
- Message sending and receiving
- 29 IPC channels for Discord operations
- Dedicated Discord store for connection state

#### Multi-Project Workspace

- Open Projects store for managing multiple projects
- Project switching and context preservation
- Project-specific dev scripts support
- 3 IPC channels for dev-scripts management

#### SSH Remotes

- SSH host configuration for remote access
- Terminal-based remote connections
- 3 IPC channels for shell operations

#### File System Operations

- File and directory operations service
- 8 IPC channels for file system access
- Native dialog integration for file/folder selection

#### Settings Management

- Application settings persistence
- GitHub token configuration
- Spotify OAuth configuration
- Discord token configuration
- 4 IPC channels for settings operations

#### Developer Tooling

- Custom dev scripts per project
- Tools panel with terminal and editor access
- Environment detection service

#### CI/CD Pipeline

- GitHub Actions CI workflow (.github/workflows/ci.yml)
- Automated linting (ESLint) and formatting checks (Prettier)
- TypeScript type checking on push/PR
- Vitest test suite with coverage reporting
- Multi-platform builds (Windows, macOS, Linux) via matrix strategy
- npm dependency caching for faster builds
- Build artifacts uploaded with 7-day retention
- Concurrency control to cancel outdated runs

#### Release Workflow

- GitHub Actions release workflow (.github/workflows/release.yml)
- Triggered on version tags (v*.*.\*)
- Multi-platform builds: Windows (Squirrel), macOS (DMG/ZIP), Linux (DEB/RPM)
- Automatic release notes extraction from CHANGELOG.md
- Draft GitHub Releases with all platform artifacts
- Integration with electron-updater for auto-updates
- No code signing (users may see OS warnings on first install)

#### Pre-commit Hooks

- Pre-commit configuration with auto-formatting
- Trailing whitespace and end-of-file fixes
- YAML and JSON validation
- Large file detection (500KB limit)
- Merge conflict detection
- Private key detection
- ESLint with auto-fix
- Prettier with auto-format

#### Database Layer

- SQLite database with better-sqlite3
- 5 database tables for data persistence
- Contribution CRUD operations (7 IPC channels)
- Updater operations (5 IPC channels)

### Changed

### Deprecated

### Removed

### Fixed

### Security

- Secure storage service for credential management
- GitHub token stored securely
- OAuth tokens protected

## [0.0.8] - 2026-02-12

### Fixed

- Release workflow now only includes changelog notes in release body (removed Downloads table)
- Release workflow now requires matching version section in CHANGELOG.md before releasing
- Update notification dialog enlarged (50% wider, 30% taller) for better readability

## [0.0.6] - 2026-02-12

### Fixed

- Update notification release notes now render as Markdown instead of raw HTML
- Update notification dialog widened and uses styled scrollbars

## [0.0.5] - 2026-02-12

### Fixed

- Auto-updater now programmatically sets GitHub feed URL instead of relying on `app-update.yml` file
- Release workflow now generates `latest.yml` and `latest-mac.yml` manifests required by electron-updater

## [0.0.4] - 2026-02-12

### Added

- Update notification UI with user action options:
  - **Install Now**: Download and install updates immediately
  - **Remind Me Later**: Dismiss notification for current session
  - **Skip This Version**: Permanently skip specific version (persisted to localStorage)
- Update notification dialog states: available, downloading (with progress), downloaded, error
- `useUpdaterStore` Zustand store for update state management
- IPC event listeners for real-time update progress from main process
- Comprehensive test coverage for update notification (70 new tests)

## [0.0.3] - 2026-02-12

### Added

- CI/CD pipeline with GitHub Actions
- Multi-platform builds (Windows, macOS, Linux)
- Release workflow with automatic changelog extraction

### Fixed

- ESLint flat config compatibility (removed `--ext` flag)
- Native module compilation for better-sqlite3 and node-pty in CI
- macOS pip install with `--break-system-packages` flag
- Windows build environment setup
- Cross-platform path handling for SSH config

[Unreleased]: https://github.com/lukadfagundes/cola-records/compare/v0.0.8...HEAD
[0.0.8]: https://github.com/lukadfagundes/cola-records/compare/v0.0.6...v0.0.8
[0.0.6]: https://github.com/lukadfagundes/cola-records/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/lukadfagundes/cola-records/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/lukadfagundes/cola-records/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/lukadfagundes/cola-records/releases/tag/v0.0.3
