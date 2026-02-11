# Renderer

React-based user interface for Cola Records.

## Overview

The renderer process provides the application UI using React 19, Zustand for state management, and Tailwind CSS for styling.

## Structure

```
renderer/
├── App.tsx               # Main application component
├── index.tsx             # React entry point
├── components/           # Reusable UI components
│   ├── ui/               # Base components (Button, Dialog, etc.)
│   ├── layout/           # Layout components (Sidebar, AppBar)
│   ├── contributions/    # Contribution management
│   ├── issues/           # Issue discovery and detail
│   ├── pull-requests/    # PR management
│   ├── tools/            # Dev tools (Terminal, Scripts)
│   ├── spotify/          # Spotify player
│   └── discord/          # Discord client
├── screens/              # Full-page screen components
├── stores/               # Zustand state stores
├── hooks/                # Custom React hooks
├── ipc/                  # IPC client for main process
├── providers/            # React context providers
└── styles/               # Global styles
```

## Screens

| Screen        | Component                    | Purpose                         |
| ------------- | ---------------------------- | ------------------------------- |
| Dashboard     | `DashboardScreen`            | Overview and stats              |
| Issues        | `IssueDiscoveryScreen`       | Search GitHub issues            |
| Contributions | `ContributionsScreen`        | Track open-source contributions |
| Projects      | `ProjectsScreen`             | Personal projects               |
| Professional  | `ProfessionalProjectsScreen` | Work projects                   |
| IDE           | `DevelopmentScreen`          | Embedded VS Code                |
| Settings      | `SettingsScreen`             | App configuration               |

## State Management

Zustand stores manage global application state. There are 9 stores total:

**Exported via `stores/index.ts`:**

- `useContributionsStore` - Contribution tracking and CRUD
- `useDevScriptsStore` - Custom dev scripts per project
- `useIssuesStore` - GitHub issue search and cache
- `useOpenProjectsStore` - Multi-project IDE state
- `useSettingsStore` - Application settings

**Require direct import:**

- `useDiscordStore` - Discord connection and messaging state
- `useProfessionalProjectsStore` - Professional/work projects
- `useProjectsStore` - Personal open-source projects
- `useSpotifyStore` - Spotify playback and authentication

## Component Library

UI components are built on Radix UI primitives with Tailwind CSS:

- Button, Input, Label, Checkbox, Switch
- Dialog, Dropdown, Popover, Tooltip
- Card, Badge, Skeleton, Progress

## Documentation

See [CLAUDE.md](CLAUDE.md) for renderer development patterns.
