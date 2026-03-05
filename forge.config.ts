import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { MakerSquirrelConfig } from '@electron-forge/maker-squirrel';
import type { MakerDMGConfig } from '@electron-forge/maker-dmg';
import type { MakerDebConfig } from '@electron-forge/maker-deb';
import type { MakerRpmConfig } from '@electron-forge/maker-rpm';

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '**/node_modules/{better-sqlite3,node-pty}/**/*',
    },
    icon: './assets/icons/icons/win/icon',
    name: 'Cola Records',
    executableName: 'cola-records',
    appCopyright: 'Copyright 2026 Luka Fagundes',
    appCategoryType: 'public.app-category.developer-tools',
    appBundleId: 'com.sunnystack.colarecords',
    extraResource: [
      './docker',
      './docs',
      './README.md',
      './CHANGELOG.md',
      './CONTRIBUTING.md',
      './LICENSE',
    ],
    win32metadata: {
      CompanyName: 'Sunny Stack',
      FileDescription: 'Cola Records - Developer Workspace Engine',
      ProductName: 'Cola Records',
      InternalName: 'cola-records',
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        authors: 'Luka Fagundes',
        description: 'Cola Records - Developer Workspace Engine',
        setupIcon: './assets/icons/icons/win/icon.ico',
        iconUrl:
          'https://raw.githubusercontent.com/lukadfagundes/cola-records/main/assets/icons/icons/win/icon.ico',
        setupExe: 'ColaRecordsSetup.exe',
        noMsi: true,
      } as MakerSquirrelConfig,
    },
    {
      name: '@electron-forge/maker-zip',
      config: {},
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
        icon: './assets/icons/icons/mac/icon.icns',
        name: 'Cola Records',
      } as MakerDMGConfig,
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'Luka Fagundes',
          homepage: 'https://github.com/lukadfagundes/cola-records',
          icon: './assets/icons/icon.png',
          categories: ['Development'],
        },
      } as MakerDebConfig,
      platforms: ['linux'],
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          homepage: 'https://github.com/lukadfagundes/cola-records',
          icon: './assets/icons/icon.png',
          categories: ['Development'],
        },
      } as MakerRpmConfig,
      platforms: ['linux'],
    },
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/main/preload.ts',
          config: 'vite.preload.config.ts',
        },
        {
          entry: 'src/main/workers/contribution-scanner.worker.ts',
          config: 'vite.worker.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.config.ts',
        },
      ],
    }),
  ],
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { execSync } = await import('child_process');

      // Copy production dependencies using npm
      const packageJsonSrc = path.join(process.cwd(), 'package.json');
      const packageJsonDest = path.join(buildPath, 'package.json');

      // Copy package.json to build path
      await fs.copyFile(packageJsonSrc, packageJsonDest);

      // Install production dependencies only
      console.log('Installing production dependencies...');
      execSync('npm install --omit=dev --ignore-scripts', {
        cwd: buildPath,
        stdio: 'inherit',
      });

      // Get Electron version from package.json
      const packageJson = JSON.parse(await fs.readFile(packageJsonSrc, 'utf-8'));
      const electronVersion = packageJson.devDependencies.electron.replace('^', '');

      // Rebuild native modules for electron using @electron/rebuild
      console.log(`Rebuilding native modules for Electron ${electronVersion}...`);
      execSync(`npx @electron/rebuild --version ${electronVersion}`, {
        cwd: buildPath,
        stdio: 'inherit',
      });

      console.log('Dependencies installed successfully');

      // Copy renderer files to .vite/renderer/main_window/
      const rendererSrc = path.join(process.cwd(), 'dist', 'renderer');
      const rendererDest = path.join(buildPath, '.vite', 'renderer', 'main_window');

      try {
        await fs.mkdir(path.dirname(rendererDest), { recursive: true });
        await fs.cp(rendererSrc, rendererDest, { recursive: true });
        console.log('Copied renderer files to .vite/renderer/main_window/');
      } catch (err) {
        console.error('Failed to copy renderer files:', err);
      }
    },
    postPackage: async (_config, options) => {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Generate app-update.yml for electron-updater in the final packaged output
      // This file must be in the resources folder next to app.asar
      const appUpdateYml = `provider: github
owner: lukadfagundes
repo: cola-records
`;

      // Handle different platform structures
      // macOS: Cola Records.app/Contents/Resources/
      // Windows/Linux: resources/
      for (const outputPath of options.outputPaths) {
        let resourcesPath: string;

        if (options.platform === 'darwin') {
          // macOS app bundle structure
          resourcesPath = path.join(outputPath, 'Cola Records.app', 'Contents', 'Resources');
        } else {
          // Windows and Linux structure
          resourcesPath = path.join(outputPath, 'resources');
        }

        // Ensure resources directory exists
        await fs.mkdir(resourcesPath, { recursive: true });

        const appUpdatePath = path.join(resourcesPath, 'app-update.yml');
        await fs.writeFile(appUpdatePath, appUpdateYml, 'utf-8');
        console.log(`Generated app-update.yml at ${appUpdatePath}`);
      }
    },
  },
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'lukadfagundes',
          name: 'cola-records',
        },
        prerelease: false,
        draft: true,
      },
    },
  ],
};

export default config;
