# GoRemoteAnalyse App

React Native (Expo) mobile application for analyzing Go (Baduk/Weiqi) games using KataGo AI.

## Features

- Load SGF files from device
- AI-powered game analysis via KataGo
- Winrate and score visualization
-Navigate game moves and variations
- Error detection with configurable thresholds
- Dark mode support
- Internationalization (i18n)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Project Structure

```
App/
├── app/                 # Expo Router screens
│   ├── (tabs)/         # Tab navigation
│   └── _layout.tsx     # Root layout
├── features/           # Feature modules
│   ├── analysis/       # Analysis components & hooks
│   ├── game/           # Game context, reducers, hooks
│   ├── board-recognition/  # Camera/board recognition
│   └── settings/       # Settings feature
├── components/         # Shared UI components
├── hooks/             # Shared custom hooks
├── lib/               # Utilities (SGF parser, API client)
├── constants/         # App constants
└── i18n/              # Translations
```

## Configuration

The app connects to a KataGo analysis backend. Configure in Settings:

- **Domain Server**: Local FastAPI server
- **RunPod**: Cloud-based serverless

## Development

```bash
# Type check
npx tsc --noEmit

# Lint
npx eslint . --max-warnings 0

# Test
npm test -- --coverage
```

## Backend

See `../ServerGo/` for the KataGo analysis backend.
