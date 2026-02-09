import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { MakerSquirrelConfig } from '@electron-forge/maker-squirrel';
import type { MakerDMGConfig } from '@electron-forge/maker-dmg';
import type { MakerDebConfig } from '@electron-forge/maker-deb';
import type { MakerRpmConfig } from '@electron-forge/maker-rpm';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './assets/icons/icon',
    name: 'Cola Records',
    executableName: 'cola-records',
    appCopyright: 'Copyright 2026 Luka Fagundes',
    appCategoryType: 'public.app-category.developer-tools',
    appBundleId: 'com.sunnystack.colarecords',
    win32metadata: {
      CompanyName: 'Sunny Stack',
      FileDescription: 'Cola Records - GitHub Contribution Tracker',
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
        description: 'Cola Records - GitHub contribution tracker with integrated IDE',
        setupIcon: './assets/icons/icon.ico',
        iconUrl:
          'https://raw.githubusercontent.com/lukadfagundes/cola-records/main/assets/icons/icon.ico',
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
        icon: './assets/icons/icon.icns',
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
