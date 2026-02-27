/**
 * Shared lucide-react mock
 *
 * Provides stub icon components for every icon used in the codebase.
 * Each stub renders a <span> with a data-testid of the icon name.
 *
 * Usage in test files:
 *   vi.mock('lucide-react', async () => import('../../../tests/mocks/lucide-react'));
 *   (adjust relative path as needed)
 */
import React from 'react';

function createIcon(name: string) {
  const Icon = (props: any) =>
    React.createElement('span', { 'data-testid': `icon-${name.toLowerCase()}`, ...props });
  Icon.displayName = name;
  return Icon;
}

// All icons used across the codebase
export const AlertTriangle = createIcon('AlertTriangle');
export const ArrowDown = createIcon('ArrowDown');
export const ArrowLeft = createIcon('ArrowLeft');
export const ArrowRight = createIcon('ArrowRight');
export const ArrowUp = createIcon('ArrowUp');
export const AtSign = createIcon('AtSign');
export const Ban = createIcon('Ban');
export const Bold = createIcon('Bold');
export const BookMarked = createIcon('BookMarked');
export const BookOpen = createIcon('BookOpen');
export const Briefcase = createIcon('Briefcase');
export const Calendar = createIcon('Calendar');
export const Check = createIcon('Check');
export const Clock = createIcon('Clock');
export const CheckCircle = createIcon('CheckCircle');
export const CheckCircle2 = createIcon('CheckCircle2');
export const CircleDot = createIcon('CircleDot');
export const Checkbox = createIcon('Checkbox');
export const ChevronDown = createIcon('ChevronDown');
export const ChevronLeft = createIcon('ChevronLeft');
export const ChevronRight = createIcon('ChevronRight');
export const ChevronUp = createIcon('ChevronUp');
export const Circle = createIcon('Circle');
export const Code = createIcon('Code');
export const Copy = createIcon('Copy');
export const ExternalLink = createIcon('ExternalLink');
export const File = createIcon('File');
export const FileCode = createIcon('FileCode');
export const FileText = createIcon('FileText');
export const Folder = createIcon('Folder');
export const FolderGit2 = createIcon('FolderGit2');
export const FolderOpen = createIcon('FolderOpen');
export const GitBranch = createIcon('GitBranch');
export const GitCommit = createIcon('GitCommit');
export const GitFork = createIcon('GitFork');
export const GitMerge = createIcon('GitMerge');
export const GitPullRequest = createIcon('GitPullRequest');
export const Hash = createIcon('Hash');
export const Heading = createIcon('Heading');
export const Home = createIcon('Home');
export const Italic = createIcon('Italic');
export const Link = createIcon('Link');
export const Link2 = createIcon('Link2');
export const List = createIcon('List');
export const ListChecks = createIcon('ListChecks');
export const ListOrdered = createIcon('ListOrdered');
export const Loader2 = createIcon('Loader2');
export const MessageSquare = createIcon('MessageSquare');
export const Monitor = createIcon('Monitor');
export const Moon = createIcon('Moon');
export const MoreHorizontal = createIcon('MoreHorizontal');
export const Paperclip = createIcon('Paperclip');
export const Pencil = createIcon('Pencil');
export const Plus = createIcon('Plus');
export const Quote = createIcon('Quote');
export const RefreshCw = createIcon('RefreshCw');
export const Save = createIcon('Save');
export const Search = createIcon('Search');
export const Send = createIcon('Send');
export const Settings = createIcon('Settings');
export const Star = createIcon('Star');
export const Strikethrough = createIcon('Strikethrough');
export const Sun = createIcon('Sun');
export const Tag = createIcon('Tag');
export const Trash2 = createIcon('Trash2');
export const User = createIcon('User');
export const UserPlus = createIcon('UserPlus');
export const Users = createIcon('Users');
export const X = createIcon('X');
export const XCircle = createIcon('XCircle');

// Spotify icons
export const LogOut = createIcon('LogOut');
export const Shuffle = createIcon('Shuffle');
export const SkipBack = createIcon('SkipBack');
export const Play = createIcon('Play');
export const Pause = createIcon('Pause');
export const SkipForward = createIcon('SkipForward');
export const Volume2 = createIcon('Volume2');
export const VolumeX = createIcon('VolumeX');
export const Heart = createIcon('Heart');
export const ListPlus = createIcon('ListPlus');

// Terminal/Tools icons
export const Terminal = createIcon('Terminal');
export const Wrench = createIcon('Wrench');
export const Menu = createIcon('Menu');
export const GripVertical = createIcon('GripVertical');
export const Layers = createIcon('Layers');
export const Power = createIcon('Power');

// Dev Tools icons
export const Package = createIcon('Package');
export const FileKey = createIcon('FileKey');
export const Anchor = createIcon('Anchor');
export const ShieldCheck = createIcon('ShieldCheck');
export const Info = createIcon('Info');

// Workflow icons
export const GitBranchPlus = createIcon('GitBranchPlus');
export const SearchCheck = createIcon('SearchCheck');
export const AlignLeft = createIcon('AlignLeft');
export const FlaskConical = createIcon('FlaskConical');
export const PieChart = createIcon('PieChart');
export const Hammer = createIcon('Hammer');

// Update section icons
export const ArrowUpCircle = createIcon('ArrowUpCircle');
export const ShieldAlert = createIcon('ShieldAlert');
export const ArrowDownToLine = createIcon('ArrowDownToLine');

// Info section icons
export const Activity = createIcon('Activity');
export const Globe = createIcon('Globe');
export const HardDrive = createIcon('HardDrive');
export const FolderSearch = createIcon('FolderSearch');
