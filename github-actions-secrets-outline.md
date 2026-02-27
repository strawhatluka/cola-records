# GitHub Actions Secrets Scanner — Feature Outline

## Overview

Extend the env scanner to detect `${{ secrets.* }}` references in GitHub Actions workflow files (`.github/workflows/*.yml`). These are surfaced as a **separate section** in the scan results — not mixed into `.env.example` — since they live in GitHub's encrypted secrets system, not in local `.env` files.

## Why

When onboarding to a project, developers need to know:

1. What env vars the **application code** needs (`.env` files) — already handled
2. What secrets the **CI/CD pipelines** need (GitHub Secrets) — this feature

Currently a developer has to manually read each workflow YAML to discover required secrets. This scanner would surface them automatically.

## Scan Targets

```
.github/workflows/*.yml
.github/workflows/*.yaml
```

## Regex Patterns

```
${{ secrets.SECRET_NAME }}     →  /\$\{\{\s*secrets\.([A-Z_][A-Z0-9_]*)\s*\}\}/g
${{ vars.VAR_NAME }}           →  /\$\{\{\s*vars\.([A-Z_][A-Z0-9_]*)\s*\}\}/g
```

Note: `secrets.*` are encrypted at rest; `vars.*` are plaintext configuration variables. Both are stored in GitHub Settings but have different security postures.

## Data Model

```typescript
interface CISecretVariable {
  name: string;
  type: 'secret' | 'var';
  sourceFile: string; // e.g. ".github/workflows/deploy.yml"
  lineNumber: number;
  service: string; // Reuse existing detectService() logic
  usedInJobs: string[]; // Which workflow jobs reference it
}

interface CIScanResult {
  secrets: CISecretVariable[];
  vars: CISecretVariable[];
  workflowsScanned: number;
}
```

## Output Format

Not written to `.env.example`. Instead surfaced as a companion report, either:

### Option A: Inline Panel in EnvPanel (Recommended)

Add a 7th button "CI Secrets" that shows results in an InfoInlinePanel-style display:

```
GitHub Actions Secrets (3 found in 2 workflows)
─────────────────────────────────────────────
  DISCORD_WEBHOOK_URL    deploy.yml:121, deploy-bot.yml:283
  VERCEL_TOKEN           deploy.yml:45
  CODECOV_TOKEN          ci.yml:38

GitHub Actions Variables (1 found)
─────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL    deploy.yml:52
```

### Option B: Section in .env.example (commented out)

Append a clearly-separated section at the bottom of `.env.example`:

```
# ====================
# CI/CD Secrets (GitHub Actions)
# These are NOT application env vars — configure in GitHub Settings > Secrets
# ====================
#
# DISCORD_WEBHOOK_URL   (deploy.yml:121, deploy-bot.yml:283)
# VERCEL_TOKEN          (deploy.yml:45)
# CODECOV_TOKEN         (ci.yml:38)
```

**Recommendation: Option A** — keeps `.env.example` clean and focused on application vars. The CI secrets panel is informational only.

## IPC Channel

```typescript
'dev-tools:scan-ci-secrets': (workingDirectory: string) => CIScanResult;
```

## Implementation Steps

1. Add `CISecretVariable` and `CIScanResult` types to `channels/types.ts`
2. Add `scanCISecrets()` method to `env-scanner.service.ts` (or new `ci-scanner.service.ts`)
3. Add IPC handler `dev-tools:scan-ci-secrets`
4. Add IPC channel type definition
5. Add "CI Secrets" button to `EnvPanel.tsx`
6. Create `CISecretsPanel.tsx` inline display component
7. Write tests for scanner, IPC handler, and component

## Edge Cases

- Workflow files using reusable workflows (`uses: ./.github/workflows/reusable.yml`) — secrets passed via `secrets: inherit` or explicit `secrets:` block
- Matrix strategies that reference secrets conditionally
- Composite actions in `.github/actions/` directories
- Organization-level secrets (can't detect from file, but can note when a secret is used but not defined at repo level)
