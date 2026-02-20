/**
 * IPC Channel Definitions — Barrel Export
 *
 * Composes IpcChannels from domain-specific partial interfaces and
 * re-exports all shared types and events.
 */
import type { GitHubChannels } from './github.channels';
import type { IntegrationChannels } from './integrations.channels';
import type { CoreChannels } from './core.channels';

export interface IpcChannels extends GitHubChannels, IntegrationChannels, CoreChannels {}

export * from './types';
export * from './events';
