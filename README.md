# Cola Records

A Flutter desktop application for discovering GitHub good first issues and analyzing repository documentation quality.

## Features

- 🔍 **Issue Discovery**: Search for good first issues across GitHub repositories
  - Filter by programming language
  - Filter by minimum star count
  - Direct links to issues

- 📊 **Documentation Analysis**: Analyze repository documentation quality
  - Multi-factor scoring (0-100 scale)
  - Detailed breakdown by category
  - Missing documentation suggestions

## Setup

### Prerequisites

- Flutter SDK 3.9.2 or higher
- Windows, macOS, or Linux
- GitHub Personal Access Token

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd cola-records
```

### 2. Install Dependencies

```bash
flutter pub get
```

### 3. Configure GitHub Token

#### Option A: Using .env.local (Recommended for Development)

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your GitHub Personal Access Token:
   ```
   GITHUB_TOKEN=ghp_your_token_here
   ```

3. Get a token from [GitHub Settings → Developer Settings → Personal Access Tokens](https://github.com/settings/tokens)
   - Required scopes: `public_repo`, `read:user`

#### Option B: Manual Configuration

If you don't use `.env.local`, you'll need to manually configure authentication through the app's settings (future feature).

### 4. Run the Application

```bash
flutter run -d windows  # or macos, linux
```

## Project Structure

```
lib/
├── core/                      # Core utilities
│   ├── error/                 # Custom exceptions
│   ├── network/               # HTTP client
│   ├── result/                # Result type
│   ├── storage/               # Cache & token storage
│   └── constants/             # API constants
├── features/
│   ├── issue_discovery/       # Issue search feature
│   │   ├── data/              # API clients & models
│   │   ├── domain/            # Business logic
│   │   └── presentation/      # UI & BLoC
│   ├── repo_analysis/         # Documentation analysis
│   │   ├── data/
│   │   ├── domain/
│   │   └── presentation/
│   └── shared/                # Shared components
└── main.dart                  # App entry point
```

## Architecture

- **Clean Architecture**: Separation of concerns with 3 layers (domain, data, presentation)
- **BLoC Pattern**: State management using flutter_bloc
- **Repository Pattern**: Abstraction over data sources
- **Value Objects**: Parameters wrapped in objects (≤2 parameters per function)

## Usage

### Finding Good First Issues

1. Navigate to the "Find Issues" tab
2. Select a programming language (optional)
3. Set minimum star count (optional)
4. Click "Search"
5. Click any issue to open it in GitHub

### Analyzing Repository Documentation

1. Navigate to the "Analyze Repo" tab
2. Enter a GitHub repository URL (e.g., `https://github.com/flutter/flutter`)
3. Click "Analyze"
4. View the documentation score and recommendations

## Development

### Running Tests

```bash
flutter test
```

### Running Lint

```bash
flutter analyze
```

### Building for Production

```bash
# Windows
flutter build windows --release

# macOS
flutter build macos --release

# Linux
flutter build linux --release
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | Yes | - |
| `GITHUB_API_TIMEOUT` | API request timeout (seconds) | No | 30 |
| `CACHE_TTL_HOURS` | Cache expiration time | No | 24 |
| `MAX_RETRIES` | Max retry attempts for failed requests | No | 3 |

## Troubleshooting

### "Authentication failed" error

- Make sure your `.env.local` file exists and contains a valid `GITHUB_TOKEN`
- Verify the token has the required scopes: `public_repo`, `read:user`
- Check that the token hasn't expired

### "Rate limit exceeded" error

- GitHub API has a limit of 5,000 requests per hour (authenticated)
- Wait until the rate limit resets (shown in error message)
- Consider caching results to reduce API calls

### Build errors on Windows

- Ensure you have Visual Studio with C++ build tools installed
- The `flutter_secure_storage` package requires native Windows components

## Contributing

This project follows the Trinity Method development workflow. See the [Trinity documentation](trinity/CLAUDE.md) for details.

## License

[Add your license here]

## Acknowledgments

- Built with Flutter
- Powered by GitHub GraphQL & REST APIs
- Documentation scoring inspired by open source best practices
