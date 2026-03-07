/**
 * Gitignore Templates
 *
 * Per-ecosystem .gitignore content for new projects
 */
import type { Ecosystem } from '../../ipc/channels/types';

const TEMPLATES: Record<string, string> = {
  node: `# Dependencies
node_modules/
.pnp
.pnp.js

# Build
dist/
build/
.next/
out/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/

# Misc
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
`,
  python: `# Byte-compiled
__pycache__/
*.py[cod]
*$py.class

# Virtual environments
.venv/
venv/
ENV/

# Distribution
dist/
build/
*.egg-info/
*.egg

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Testing
.coverage
htmlcov/
.pytest_cache/
.mypy_cache/
`,
  rust: `# Build
/target/

# Environment
.env

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db
`,
  go: `# Binary
/bin/
*.exe
*.exe~
*.dll
*.so
*.dylib

# Test binary
*.test

# Coverage
*.out
coverage.txt

# Vendor
vendor/

# Environment
.env

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db
`,
  ruby: `# Bundler
/.bundle/
/vendor/bundle/

# Gems
*.gem
.gem/

# Environment
.env

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Testing
/coverage/
/spec/reports/

# Logs
/log/
/tmp/
`,
  php: `# Dependencies
/vendor/

# Environment
.env

# IDE
.vscode/
.idea/
*.swp
.phpunit.result.cache

# OS
.DS_Store
Thumbs.db

# Cache
/bootstrap/cache/
/storage/

# Build
/public/hot
/public/storage
`,
  java: `# Build
/target/
/build/
*.class
*.jar
*.war
*.ear

# IDE
.vscode/
.idea/
*.iml
.classpath
.project
.settings/

# Environment
.env

# OS
.DS_Store
Thumbs.db

# Gradle
.gradle/
/build/

# Maven
pom.xml.tag
pom.xml.releaseBackup
pom.xml.versionsBackup
`,
};

const DEFAULT_TEMPLATE = `# Environment
.env

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db
`;

export function getGitignoreTemplate(ecosystem: Ecosystem): string {
  return TEMPLATES[ecosystem] || DEFAULT_TEMPLATE;
}
