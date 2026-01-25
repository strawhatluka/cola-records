# Testing Guide for Cola Records

## Test Infrastructure

The project uses Vitest for testing with the following setup:

### Configuration Files
- `vitest.config.ts` - Vitest configuration
- `src/__tests__/setup.ts` - Test setup and mocks

### Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run benchmarks
npm run bench
```

## Test Structure

```
src/__tests__/
├── setup.ts                    # Global test setup
├── stores/                     # Zustand store tests
│   └── useContributionsStore.test.ts
├── ipc/                        # IPC client tests
│   └── client.test.ts
└── benchmarks/                 # Performance benchmarks
    └── performance.bench.ts
```

## Manual Testing Checklist

### Phase 1: Foundation (✅ Complete)
- [x] Electron app launches
- [x] TypeScript compilation passes
- [x] IPC echo test works
- [x] Database initializes
- [x] Zustand stores are accessible

### Phase 2: Core Services (✅ Complete)
- [ ] FileSystem: Read directory
- [ ] FileSystem: Read/write file
- [ ] FileWatcher: Watch directory for changes
- [ ] Git: Get status
- [ ] Git: Stage, commit, push operations
- [ ] GitIgnore: Check if file is ignored

### Phase 3: GitHub API (✅ Complete)
- [ ] Search issues with labels
- [ ] Get repository information
- [ ] Validate GitHub token
- [ ] Cache works correctly

## Integration Test Scenarios

### Contribution Workflow
1. Search for "good first issue" on GitHub
2. Clone repository to local machine
3. Create feature branch
4. Make changes
5. Commit and push
6. Create pull request

### IDE Workflow
1. Open project directory
2. Browse file tree
3. Open file in editor
4. Edit and save
5. See git status update
6. Stage changes

## Performance Targets

- File tree scan: ≤3.5 seconds for 10,000 files
- Git status: ≤500ms
- IPC latency: <50ms
- GitHub API (cached): <100ms
- GitHub API (fresh): <2 seconds

## Known Issues

- Tests are configured but need proper Electron environment mocking
- Consider using @electron/test for proper Electron testing

## Future Testing Improvements

1. Add E2E tests with Playwright
2. Add main process unit tests
3. Add renderer process component tests
4. Set up CI/CD pipeline with automated testing
5. Add visual regression testing
