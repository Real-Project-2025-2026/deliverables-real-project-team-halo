# 🛡️ Halo — Digital Guardian App

A mobile safety companion app built with React Native and Expo that provides peace of mind while walking home or moving alone. Halo combines smart, configurable safety features with a calming and privacy-first experience.

## 📱 About

Halo is designed to empower users with control, connection, and security without losing privacy. The app helps users feel safe when walking alone by providing:

- **Trip Tracking**: Start and monitor trips with configurable safety modes
- **Check-in System**: Periodic safety check-ins with automatic escalation
- **Guardian Network**: Connect with trusted contacts who can monitor your trips
- **Emergency SOS**: Quick access panic button for immediate help
- **Real-time Location Sharing**: Share your location with guardians during active trips
- **Background Monitoring**: Continuous safety monitoring even when the app is in the background

## ✨ Features

### Core Features
- **Trip Management**: Start, monitor, and end trips with custom destinations
- **Safety Modes**: Choose between Silent, Interval, and Continuous tracking
- **Check-in System**: Configurable check-in intervals (3-10 minutes) with escalation logic
- **Guardian System**: Request and manage guardians who can watch over your trips
- **Panic Button**: Instant SOS activation with emergency contact notification
- **Route Planning**: Plan trips with origin and destination on an interactive map
- **Real-time Updates**: Live location sharing with guardians during active trips

### Safety Features
- Automatic check-in reminders
- Missed check-in escalation (vibration → notification → emergency contact)
- Background location tracking
- Emergency contact notifications
- Trip status visibility for guardians
- Auto-deletion of trip data after 30 days

## 🛠️ Tech Stack

- **Framework**: [Expo](https://expo.dev) (~54.0.22)
- **Runtime**: React Native (0.81.5) with React (19.1.0)
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction/) (file-based routing)
- **Backend**: [Supabase](https://supabase.com) (PostgreSQL, Auth, Realtime)
- **Maps**: [react-native-maps](https://github.com/react-native-maps/react-native-maps)
- **UI Components**: Custom design system with design tokens
- **State Management**: React Hooks
- **Notifications**: Expo Notifications
- **Location**: Expo Location with background tracking
- **Language**: TypeScript

## 📋 Prerequisites

- Node.js (v18 or higher recommended)
- npm or pnpm (project uses pnpm)
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for iOS development) or Android Emulator (for Android development)
- Supabase account and project (for backend services)

## 🚀 Getting Started

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd halo-app
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory with your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server**
   ```bash
   pnpm start
   ```

   Or for development builds:
   ```bash
   pnpm start:dev
   ```

### Running on Devices

**iOS Simulator:**
```bash
pnpm ios
```

**Android Emulator:**
```bash
pnpm android
```

**Web:**
```bash
pnpm web
```

## 📁 Project Structure

```
halo-app/
├── app/                    # Expo Router pages (file-based routing)
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main tab navigation
│   ├── (protected)/       # Protected routes
│   ├── trip/              # Trip-related screens
│   └── guardian-trip/     # Guardian trip monitoring
├── components/            # Reusable React components
│   ├── ui/                # Base UI primitives
│   └── trip-planner/      # Trip planning components
├── hooks/                 # Custom React hooks
├── services/              # Business logic services
├── lib/                   # Utility libraries
├── constants/             # Design tokens and theme
├── types/                 # TypeScript type definitions
├── supabase/              # Database migrations
└── assets/                # Images, fonts, etc.
```

## 🔧 Development

### Available Scripts

- `pnpm start` - Start Expo development server
- `pnpm start:dev` - Start with development client
- `pnpm ios` - Open in iOS simulator
- `pnpm android` - Open in Android emulator
- `pnpm web` - Open in web browser
- `pnpm lint` - Run ESLint

### Building

**Development Builds:**
```bash
# iOS
pnpm build:dev:ios

# Android
pnpm build:dev:android
```

**Preview Builds:**
```bash
# iOS
pnpm build:preview:ios

# Android
pnpm build:preview:android
```

### Testing

See the testing guides:
- `QUICK_START_TESTING.md` - Quick start testing guide
- `TESTING_GUIDE.md` - Comprehensive testing documentation
- `MULTI_DEVICE_TESTING.md` - Multi-device testing setup

## 🔐 Environment Variables

Required environment variables:

- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

These should be set in your `.env` file or in your deployment platform (e.g., Vercel, EAS).

## 📱 Permissions

The app requires the following permissions:

- **Location** (Always): For background trip tracking
- **Notifications**: For check-in reminders and alerts
- **Background App Refresh**: For continuous monitoring

## 🎨 Design System

The app uses a centralized design system defined in `constants/design-tokens.ts`:

- **Primary Color**: `#5170FF` (Halo Blue)
- **Typography**: Custom font system with consistent sizing
- **Spacing**: Standardized spacing scale
- **Components**: Reusable UI components in `components/ui/`

## 📚 Documentation

Additional documentation:

- `prd.md` - Product Requirements Document
- `docs/guardian-system-plan.md` - Guardian system architecture
- `docs/action-button-setup.md` - Action button configuration
- `docs/action-button-troubleshooting.md` - Troubleshooting guide

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Ensure code passes linting (`pnpm lint`)
4. Submit a pull request

## 📄 License

This project is private and proprietary.

## 🔗 Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [Supabase Documentation](https://supabase.com/docs)
- [React Native Documentation](https://reactnative.dev/)

---

**Built with ❤️ for safety and peace of mind**
