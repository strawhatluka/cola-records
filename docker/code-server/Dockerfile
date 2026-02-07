# Cola Records - Custom Code-Server Image
#
# Extends LinuxServer.io's code-server with pre-installed development tools.
# This eliminates runtime bootstrapping and ensures npm/node are always in PATH.
#
# Build: docker build -t cola-code-server .
# Test:  docker run --rm cola-code-server which npm
#        Expected output: /usr/bin/npm

FROM lscr.io/linuxserver/code-server:latest

# Install Node.js 22.x from NodeSource
# This installs to /usr/bin which is always in PATH for all shell types
RUN apt-get update && \
    apt-get install -y curl ca-certificates gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y nodejs && \
    npm install -g npm@latest && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Python 3 with pip (for projects that need Python)
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install global npm packages
# - @anthropic-ai/claude-code: Claude Code CLI for AI-assisted development
# - trinity-method-sdk: Trinity Method development toolkit
RUN npm install -g @anthropic-ai/claude-code trinity-method-sdk

# Verify installations are accessible
RUN echo "=== Verification ===" && \
    echo "Node.js: $(node --version)" && \
    echo "npm: $(npm --version)" && \
    echo "npm path: $(which npm)" && \
    echo "Python: $(python3 --version)" && \
    echo "Claude Code: $(claude --version 2>/dev/null || echo 'installed')" && \
    echo "===================="

# Labels for identification
LABEL org.opencontainers.image.title="Cola Code-Server"
LABEL org.opencontainers.image.description="Code-server with Node.js, npm, Python, Claude Code CLI pre-installed"
LABEL org.opencontainers.image.version="1.0.0"
