# ResQLink App Icons and Splash Screens - Design Requirements

## Status
⚠️ **REQUIRES MANUAL DESIGN WORK** - This task cannot be completed programmatically

## What's Needed

### 1. App Icon Design
- **Master Image**: 1024x1024px PNG with transparency
- **Style Guidelines**:
  - Simple, recognizable design
  - Works at small sizes (16x16px)
  - Represents emergency communication/mesh networking theme
  - Suggested elements: Signal waves, rescue symbol, mesh network visualization
  - Color palette: Should complement #1976d2 (primary blue)

### 2. Splash Screen Design
- **Master Image**: 2732x2732px PNG
- **Safe Area**: Keep important content in center 1200x1200px
- **Background**: Already configured as #1976d2 in capacitor.config.ts
- **Logo**: Should be centered, works on colored background

## Implementation Steps (Once Designs Are Ready)

### Step 1: Generate Icon Assets
```bash
# Install Capacitor Asset Generator
npm install -g @capacitor/assets

# Place your 1024x1024 icon as:
# resources/icon.png

# Generate all sizes
npx @capacitor/assets generate --iconBackgroundColor '#1976d2' --splashBackgroundColor '#1976d2'
```

This will automatically generate:
- Android: All mipmap densities (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
- iOS: All icon sizes in Assets.xcassets/AppIcon.appiconset/

### Step 2: Generate Splash Screen Assets
```bash
# Place your 2732x2732 splash screen as:
# resources/splash.png

# The generate command above handles both icons and splash screens
```

### Step 3: Verify and Sync
```bash
# Sync with native projects
npx cap sync

# Open native projects to verify
npx cap open android
npx cap open ios
```

## Current State
- ✅ Background colors configured (#1976d2)
- ✅ Splash screen settings configured in capacitor.config.ts
- ✅ Native project directories ready
- ⚠️ Using default Capacitor placeholder icons
- ⚠️ Using default Capacitor placeholder splash screens

## Design Tools Suggestions
- **Figma**: Free design tool with app icon templates
- **Adobe Illustrator**: Professional vector graphics
- **Canva**: User-friendly with templates
- **Sketch**: Mac-only design tool

## Icon Design Best Practices
1. **Simplicity**: One clear concept, not too detailed
2. **Contrast**: Works on both light and dark backgrounds
3. **Scalability**: Recognizable at all sizes
4. **Brand Consistency**: Matches app purpose and theme
5. **Platform Guidelines**:
   - iOS: Rounded corners automatically added by system
   - Android: Use adaptive icons with foreground/background layers

## Testing Checklist (After Implementation)
- [ ] Icon displays correctly in app drawer (Android)
- [ ] Icon displays correctly on home screen (iOS)
- [ ] Splash screen centered and scales properly
- [ ] Splash screen transitions smoothly to app
- [ ] Test on multiple device sizes
- [ ] Test on different OS versions
- [ ] Verify in both light and dark system modes

## Resources
- [Capacitor Assets Documentation](https://capacitorjs.com/docs/guides/splash-screens-and-icons)
- [iOS Human Interface Guidelines - App Icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Android Material Design - Icons](https://material.io/design/iconography/product-icons.html)
