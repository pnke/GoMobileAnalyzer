# Detox E2E Testing

## Prerequisites

1. **Android Studio** with an AVD named `Pixel_6_API_34`
   - Or modify `.detoxrc.js` to use your AVD name

2. **Java 17** (required for Android builds)
   ```powershell
   java -version
   ```

3. **Android SDK** with `ANDROID_HOME` set

## Setup

```bash
# Install dependencies
npm install

# Generate native Android project (Expo)
npx expo prebuild --platform android
```

## Running Tests

### 1. Build the App
```powershell
# Debug build
npm run e2e:build

# Or release build
npm run e2e:build:release
```

### 2. Run Tests
```powershell
# Make sure emulator is running first!
# Then run tests
npm run e2e:test
```

## Configuration

Edit `.detoxrc.js` to change:
- AVD name in `devices.emulator.device.avdName`
- Build paths if using different flavors

## Test Structure

```
e2e/
├── jest.config.js   # Jest config for Detox
└── app.test.ts      # Main E2E test file
```

## Writing Tests

```typescript
import { by, device, element, expect } from 'detox';

describe('My Test', () => {
  it('should tap button', async () => {
    await element(by.id('my-button')).tap();
    await expect(element(by.id('result'))).toBeVisible();
  });
});
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "No emulator found" | Start emulator first: `emulator -avd Pixel_6_API_34` |
| "Build failed" | Run `npx expo prebuild --clean` |
| "Element not found" | Check testID props on components |
