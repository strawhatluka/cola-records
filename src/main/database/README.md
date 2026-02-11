# Database

SQLite database layer for Cola Records using better-sqlite3.

## Overview

The database provides persistent storage for contributions, settings, dev scripts, and GitHub API cache.

## Structure

```
database/
├── database.service.ts   # Database service with CRUD methods
├── schema.ts             # Schema definitions and migrations
└── index.ts              # Export barrel
```

## Schema

### Tables

| Table            | Purpose                                |
| ---------------- | -------------------------------------- |
| `contributions`  | Track contribution and project records |
| `settings`       | Key-value application settings         |
| `dev_scripts`    | Custom command buttons per project     |
| `github_cache`   | API response cache with TTL            |
| `schema_version` | Migration tracking                     |

### Current Version

**Schema Version:** 6

### Migrations

Migrations are defined in `schema.ts` and run automatically on database initialization:

- v2: PR tracking columns
- v3: Type column (contribution/project)
- v4: Dev scripts table
- v5: Multi-command scripts
- v6: Multi-terminal scripts

## Usage

```typescript
import { database } from './database';

// Initialize (runs migrations)
await database.initialize();

// CRUD operations
const contribution = database.createContribution(data);
const all = database.getAllContributions();
database.updateContribution(id, updates);
database.deleteContribution(id);

// Settings
database.setSetting('key', 'value');
const value = database.getSetting('key');
```

## Documentation

See [CLAUDE.md](CLAUDE.md) for database development patterns.
