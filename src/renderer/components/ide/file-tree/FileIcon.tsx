import {
  FileIcon as DefaultFileIcon,
  Folder,
  FolderOpen,
  FileJson,
  FileText,
  FileCode2,
  FileImage,
  Database,
  Settings,
  Package,
} from 'lucide-react';

interface FileIconProps {
  filename: string;
  type: 'file' | 'directory';
  isExpanded?: boolean;
  className?: string;
}

const extensionIconMap: Record<string, { icon: typeof FileCode2; color: string }> = {
  // JavaScript/TypeScript
  js: { icon: FileCode2, color: 'text-yellow-500' },
  jsx: { icon: FileCode2, color: 'text-yellow-500' },
  ts: { icon: FileCode2, color: 'text-blue-500' },
  tsx: { icon: FileCode2, color: 'text-blue-500' },
  mjs: { icon: FileCode2, color: 'text-yellow-500' },
  cjs: { icon: FileCode2, color: 'text-yellow-500' },

  // Python
  py: { icon: FileCode2, color: 'text-blue-400' },
  pyw: { icon: FileCode2, color: 'text-blue-400' },
  pyi: { icon: FileCode2, color: 'text-blue-400' },

  // Dart/Flutter
  dart: { icon: FileCode2, color: 'text-cyan-500' },

  // Web
  html: { icon: FileCode2, color: 'text-orange-600' },
  htm: { icon: FileCode2, color: 'text-orange-600' },
  css: { icon: FileCode2, color: 'text-blue-600' },
  scss: { icon: FileCode2, color: 'text-pink-500' },
  sass: { icon: FileCode2, color: 'text-pink-500' },
  less: { icon: FileCode2, color: 'text-blue-400' },

  // Configuration/Data
  json: { icon: FileJson, color: 'text-yellow-600' },
  yaml: { icon: FileText, color: 'text-purple-500' },
  yml: { icon: FileText, color: 'text-purple-500' },
  toml: { icon: FileText, color: 'text-gray-500' },
  xml: { icon: FileCode2, color: 'text-orange-500' },
  ini: { icon: FileText, color: 'text-gray-500' },
  cfg: { icon: FileText, color: 'text-gray-500' },
  conf: { icon: FileText, color: 'text-gray-500' },
  config: { icon: FileText, color: 'text-gray-500' },
  env: { icon: Settings, color: 'text-yellow-700' },

  // Markdown/Documentation
  md: { icon: FileText, color: 'text-blue-500' },
  markdown: { icon: FileText, color: 'text-blue-500' },
  mdx: { icon: FileText, color: 'text-blue-500' },
  txt: { icon: FileText, color: 'text-gray-400' },
  rst: { icon: FileText, color: 'text-blue-400' },

  // Images
  png: { icon: FileImage, color: 'text-purple-500' },
  jpg: { icon: FileImage, color: 'text-purple-500' },
  jpeg: { icon: FileImage, color: 'text-purple-500' },
  gif: { icon: FileImage, color: 'text-purple-500' },
  svg: { icon: FileImage, color: 'text-orange-500' },
  webp: { icon: FileImage, color: 'text-purple-500' },
  ico: { icon: FileImage, color: 'text-gray-500' },
  bmp: { icon: FileImage, color: 'text-purple-500' },

  // Database
  sql: { icon: Database, color: 'text-orange-500' },
  db: { icon: Database, color: 'text-gray-500' },
  sqlite: { icon: Database, color: 'text-gray-500' },
  sqlite3: { icon: Database, color: 'text-gray-500' },

  // Java/Kotlin
  java: { icon: FileCode2, color: 'text-red-600' },
  kt: { icon: FileCode2, color: 'text-purple-600' },
  kts: { icon: FileCode2, color: 'text-purple-600' },

  // C/C++/C#
  c: { icon: FileCode2, color: 'text-blue-700' },
  cpp: { icon: FileCode2, color: 'text-blue-700' },
  cc: { icon: FileCode2, color: 'text-blue-700' },
  h: { icon: FileCode2, color: 'text-purple-600' },
  hpp: { icon: FileCode2, color: 'text-purple-600' },
  cs: { icon: FileCode2, color: 'text-green-600' },

  // Go/Rust
  go: { icon: FileCode2, color: 'text-cyan-600' },
  rs: { icon: FileCode2, color: 'text-orange-700' },

  // Ruby/PHP
  rb: { icon: FileCode2, color: 'text-red-500' },
  php: { icon: FileCode2, color: 'text-purple-700' },

  // Shell scripts
  sh: { icon: FileCode2, color: 'text-green-600' },
  bash: { icon: FileCode2, color: 'text-green-600' },
  zsh: { icon: FileCode2, color: 'text-green-600' },
  fish: { icon: FileCode2, color: 'text-green-600' },
  ps1: { icon: FileCode2, color: 'text-blue-600' },
  bat: { icon: FileCode2, color: 'text-gray-600' },
  cmd: { icon: FileCode2, color: 'text-gray-600' },

  // Package managers
  'package.json': { icon: Package, color: 'text-red-600' },
  'package-lock.json': { icon: Package, color: 'text-red-700' },
  'yarn.lock': { icon: Package, color: 'text-blue-500' },
  'pnpm-lock.yaml': { icon: Package, color: 'text-orange-500' },
  'pubspec.yaml': { icon: Package, color: 'text-blue-500' },
  'Cargo.toml': { icon: Package, color: 'text-orange-700' },
  'Gemfile': { icon: Package, color: 'text-red-500' },

  // Build/Config files
  'tsconfig.json': { icon: Settings, color: 'text-blue-500' },
  'vite.config.ts': { icon: Settings, color: 'text-purple-500' },
  'vite.config.js': { icon: Settings, color: 'text-purple-500' },
  'webpack.config.js': { icon: Settings, color: 'text-blue-400' },
  'rollup.config.js': { icon: Settings, color: 'text-red-500' },
  '.gitignore': { icon: Settings, color: 'text-orange-600' },
  '.npmignore': { icon: Settings, color: 'text-red-600' },
  '.dockerignore': { icon: Settings, color: 'text-blue-500' },
  'Dockerfile': { icon: Settings, color: 'text-blue-500' },
  'docker-compose.yml': { icon: Settings, color: 'text-blue-500' },
  '.eslintrc.js': { icon: Settings, color: 'text-purple-600' },
  '.prettierrc': { icon: Settings, color: 'text-pink-500' },
  'README.md': { icon: FileText, color: 'text-blue-600' },
  'LICENSE': { icon: FileText, color: 'text-gray-500' },
};

export function FileIcon({ filename, type, isExpanded = false, className = '' }: FileIconProps) {
  // Handle directories
  if (type === 'directory') {
    const Icon = isExpanded ? FolderOpen : Folder;
    return <Icon className={`h-4 w-4 text-blue-500 ${className}`} />;
  }

  // Check for exact filename matches first (for special files like package.json)
  if (extensionIconMap[filename]) {
    const { icon: Icon, color } = extensionIconMap[filename];
    return <Icon className={`h-4 w-4 ${color} ${className}`} />;
  }

  // Extract extension and look up in map
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  if (extensionIconMap[extension]) {
    const { icon: Icon, color } = extensionIconMap[extension];
    return <Icon className={`h-4 w-4 ${color} ${className}`} />;
  }

  // Default file icon
  return <DefaultFileIcon className={`h-4 w-4 text-gray-400 ${className}`} />;
}
