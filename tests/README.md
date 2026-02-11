# Tests

Test suites for Cola Records using Vitest and React Testing Library.

## Overview

This directory contains unit tests, integration tests, and test configuration for the application.

## Structure

```
tests/
├── build/          # Build-related tests
├── config/         # Test configuration
├── integration/    # Integration tests
├── main/           # Main process tests
├── mocks/          # Test mocks and fixtures
├── renderer/       # Renderer/React component tests
└── setup.ts        # Global test setup
```

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Categories

### Main Process Tests (`main/`)

Tests for Electron main process services:

- Database operations
- IPC handlers
- Service unit tests

### Renderer Tests (`renderer/`)

Tests for React components:

- Component rendering
- User interactions
- Store behavior

### Integration Tests (`integration/`)

End-to-end tests for:

- IPC communication
- Full workflows

## Test Configuration

- **Framework:** Vitest
- **Component Testing:** React Testing Library
- **Coverage:** @vitest/coverage-v8
- **Accessibility:** vitest-axe

## Writing Tests

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## Documentation

See [CLAUDE.md](CLAUDE.md) for testing standards and patterns.
