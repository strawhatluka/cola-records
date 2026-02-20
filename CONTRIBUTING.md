# Contributing to Cola Records

Thank you for your interest in contributing to Cola Records! This guide will help you get set up and familiarize you with our development workflow.

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm 9+
- Git
- GitHub account with personal access token

### Getting Started

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/cola-records.git
cd cola-records

# Add upstream remote
git remote add upstream https://github.com/lukadfagundes/cola-records.git

# Install dependencies
npm install

# Start development mode
npm start
```

### Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run tests and linting
4. Submit a pull request to `main`

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/my-new-feature

# Make changes...

# Commit with descriptive message
git commit -m "feat: add new feature description"

# Push to your fork
git push origin feature/my-new-feature
```

## Code Quality

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Watch mode (run tests on file changes)
npm run test:watch
```

### Linting & Formatting

```bash
# Lint code (check for issues)
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting without changes
npm run format:check

# Type check TypeScript
npm run typecheck
```

### Pre-Commit Checklist

Before committing, ensure:

```bash
# Run all checks
npm run lint
npm run typecheck
npm test
npm run format:check
```

Or use the pre-commit hook if configured.

## Code Style

### TypeScript

- Use TypeScript for all new code
- Define explicit types for function parameters and return values
- Avoid `any` type - use `unknown` if type is truly unknown
- Use interfaces for object shapes, types for unions/primitives

```typescript
// Good
interface ContributionData {
  repositoryUrl: string;
  issueNumber: number;
  status: 'in_progress' | 'ready' | 'submitted' | 'merged';
}

async function createContribution(data: ContributionData): Promise<Contribution> {
  // Implementation
}

// Avoid
async function createContribution(data: any): Promise<any> {
  // Implementation
}
```

### React Components

- Use functional components with hooks
- Keep components focused on a single responsibility
- Extract reusable logic into custom hooks
- Use TypeScript for props definitions

```typescript
// Component with typed props
interface ContributionCardProps {
  contribution: Contribution;
  onSelect: (id: string) => void;
  isSelected?: boolean;
}

export function ContributionCard({
  contribution,
  onSelect,
  isSelected = false
}: ContributionCardProps) {
  return (
    <Card
      className={cn('cursor-pointer', isSelected && 'ring-2 ring-primary')}
      onClick={() => onSelect(contribution.id)}
    >
      {/* Card content */}
    </Card>
  );
}
```

### State Management

- Use Zustand for global state
- Keep stores focused on specific domains
- Use React state for local component state

```typescript
// Zustand store example
import { create } from 'zustand';

interface ContributionsState {
  contributions: Contribution[];
  isLoading: boolean;
  fetchContributions: () => Promise<void>;
}

export const useContributionsStore = create<ContributionsState>((set) => ({
  contributions: [],
  isLoading: false,

  fetchContributions: async () => {
    set({ isLoading: true });
    try {
      const contributions = await ipc.invoke('contribution:get-all');
      set({ contributions, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
}));
```

### Styling

- Use Tailwind CSS for styling
- Follow the existing design system (colors, spacing, etc.)
- Use `cn()` utility for conditional classes

```typescript
import { cn } from '@/lib/utils';

<Button
  className={cn(
    'px-4 py-2',
    isActive && 'bg-primary text-white',
    isDisabled && 'opacity-50 cursor-not-allowed'
  )}
>
  Click me
</Button>
```

## Architecture Guidelines

### Main Process (src/main/)

- Services handle all business logic
- No UI-related code in main process
- Use dependency injection patterns
- Handle errors gracefully and return meaningful messages

### Renderer Process (src/renderer/)

- React components for UI
- Zustand stores for state management
- Keep IPC calls in stores, not components
- Use error boundaries for graceful error handling

### IPC Communication

- Follow `domain:action` naming convention
- Always validate input parameters in handlers
- Return typed responses
- Handle errors and provide meaningful error messages

```typescript
// Main process handler
ipcMain.handle('contribution:create', async (event, data) => {
  // Validate input
  if (!data.repositoryUrl) {
    throw new Error('repositoryUrl is required');
  }

  // Process and return
  return await contributionService.create(data);
});
```

## Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(contributions): add status filter to contribution list

fix(github): handle rate limit errors gracefully

docs(readme): update installation instructions

refactor(stores): extract common fetch logic to utility
```

## Pull Request Process

### Before Submitting

1. Ensure all tests pass: `npm test`
2. Ensure linting passes: `npm run lint`
3. Ensure types check: `npm run typecheck`
4. Update documentation if needed
5. Add tests for new functionality

### PR Guidelines

1. **Title**: Use conventional commit format
2. **Description**: Explain what and why
3. **Screenshots**: Include for UI changes
4. **Breaking changes**: Document in description
5. **Related issues**: Reference with `Fixes #123`

### Review Process

1. Automated checks must pass
2. At least one maintainer approval required
3. Address review feedback promptly
4. Squash commits if requested

## Testing

### Unit Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContributionCard } from './ContributionCard';

describe('ContributionCard', () => {
  const mockContribution = {
    id: '1',
    repositoryUrl: 'https://github.com/owner/repo',
    issueNumber: 123,
    status: 'in_progress' as const,
  };

  it('renders contribution details', () => {
    render(
      <ContributionCard
        contribution={mockContribution}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('#123')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', async () => {
    const onSelect = vi.fn();
    render(
      <ContributionCard
        contribution={mockContribution}
        onSelect={onSelect}
      />
    );

    await userEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('1');
  });
});
```

### Test File Location

Tests live in the `tests/` directory, mirroring the `src/` structure:

```
tests/
  setup.ts
  main/                    # Main process tests
  renderer/
    components/            # Component tests
    stores/                # Store tests
```

## Documentation

### Code Documentation

- Add JSDoc comments for public functions
- Document complex algorithms with inline comments
- Keep README files updated

```typescript
/**
 * Creates a new contribution record in the database.
 *
 * @param data - The contribution data
 * @returns The created contribution with generated ID
 * @throws Error if repositoryUrl is invalid
 */
export async function createContribution(data: ContributionInput): Promise<Contribution> {
  // Implementation
}
```

### README Updates

When adding new features, update relevant documentation:

- Main README.md for user-facing features
- API documentation for new IPC channels
- Architecture docs for structural changes

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue
- **Security**: Email maintainers directly

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Cola Records!
