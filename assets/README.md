# Cola Records Assets

This directory contains application assets for packaging and distribution.

## Required Icons

Before building for release, you need to create the following icon files:

### icons/icon.png (Master Icon)

- **Size:** 512x512 pixels
- **Format:** PNG with transparency
- **Purpose:** Master icon used to generate platform-specific formats
- **Design:** Cola Records branded (record/vinyl theme)

### icons/icon.ico (Windows)

- **Format:** ICO with multiple sizes embedded
- **Sizes:** 16x16, 32x32, 48x48, 64x64, 128x128, 256x256
- **Generate from:** icon.png using electron-icon-builder or similar

### icons/icon.icns (macOS)

- **Format:** ICNS (Apple Icon Image)
- **Sizes:** Multiple resolutions as required by macOS
- **Generate from:** icon.png using electron-icon-builder or similar

### installer/background.png (Optional)

- **Size:** 150x150 pixels
- **Purpose:** Loading/splash image for Windows installer
- **Format:** PNG

### logo.png (Optional)

- **Size:** Variable (recommended 200x200)
- **Purpose:** Application logo for About dialog

## Generating Icons

You can use electron-icon-builder to generate platform-specific icons:

```bash
npm install -D electron-icon-builder
npx electron-icon-builder --input=./assets/icons/icon.png --output=./assets/icons
```

Or use online tools like:

- https://www.electron.build/icons
- https://iconverticons.com/online/
