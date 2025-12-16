# 🧪 Halo App - Testing Guide

## Übersicht

Diese Anleitung erklärt, wie du die Halo App auf echten Geräten testen kannst, um Features wie Standort-Tracking, Background-Location, Notifications und Guardian-Funktionalität zu testen.

---

## 🎯 Optionen zum Testen

### Option 1: Development Build (Empfohlen für aktive Entwicklung)

**Vorteile:**
- Schnelle Iteration
- Hot Reload funktioniert
- Kann überall getestet werden (nicht nur im gleichen Netzwerk)
- Alle nativen Features funktionieren

**Nachteile:**
- Muss Build erstellen (einmalig)
- Benötigt EAS Account

#### Setup:

1. **EAS CLI installieren:**
```bash
npm install -g eas-cli
```

2. **Bei EAS anmelden:**
```bash
eas login
```

3. **Development Build erstellen:**

**Für iOS (TestFlight):**
```bash
eas build --profile development --platform ios
```

**Für Android (APK):**
```bash
eas build --profile development --platform android
```

4. **Build auf Gerät installieren:**
- iOS: Build wird automatisch zu TestFlight hochgeladen (benötigt Apple Developer Account)
- Android: APK wird heruntergeladen und kann direkt installiert werden

5. **App starten:**
```bash
npx expo start --dev-client
```

Die App verbindet sich automatisch mit deinem Expo Dev Server (auch über Internet, nicht nur localhost).

---

### Option 2: Production Build (Für echte Tests)

**Vorteile:**
- Wie die finale App
- Kann an Test-User verteilt werden
- Funktioniert komplett offline (nach Installation)

**Nachteile:**
- Kein Hot Reload
- Muss neu builden für Änderungen

#### Setup:

1. **Production Build erstellen:**
```bash
eas build --profile production --platform ios
# oder
eas build --profile production --platform android
```

2. **Build verteilen:**
- iOS: Über TestFlight (Internal Testing)
- Android: APK direkt teilen oder über Google Play Internal Testing

---

## 🔧 EAS Build Konfiguration

Erstelle/aktualisiere `eas.json`:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

## 🌍 Environment Variables Setup

### Für Development Build:

1. **Erstelle `.env` Datei** (nicht in Git committen!):
```bash
EXPO_PUBLIC_SUPABASE_URL=https://dein-projekt.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=dein-anon-key
```

2. **Für EAS Builds - Environment Variables setzen:**

```bash
# Setze Environment Variables für EAS
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://dein-projekt.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_KEY --value "dein-anon-key"
```

3. **In `eas.json` Environment Variables referenzieren:**

```json
{
  "build": {
    "development": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://dein-projekt.supabase.co",
        "EXPO_PUBLIC_SUPABASE_KEY": "dein-anon-key"
      }
    }
  }
}
```

---

## 📱 Testing Workflow

### 1. **Standort-Tracking testen:**

**Setup:**
- Zwei Geräte (oder ein Gerät + Simulator)
- Beide mit Development Build installiert
- Beide mit echten Standort-Berechtigungen

**Test:**
1. Auf Gerät 1: Trip starten
2. Rausgehen und ein paar Meter laufen
3. Auf Gerät 2: Home Screen öffnen → Guardians sollten auf der Karte erscheinen
4. Prüfe, ob Route aufgezeichnet wird

**Wichtig:**
- Background Location funktioniert nur auf echten Geräten, nicht im Simulator
- App muss im Hintergrund laufen (nicht killen!)
- Standort-Berechtigung muss "Immer erlauben" sein

### 2. **Guardians sehen:**

**Setup:**
- Zwei Accounts erstellen
- Als Guardians hinzufügen
- Beide einen aktiven Trip starten

**Test:**
1. User A: Trip starten
2. User B: Home Screen öffnen
3. User A sollte als Marker auf der Karte erscheinen
4. Marker sollte Avatar zeigen

### 3. **Check-ins testen:**

**Setup:**
- Trip mit kurzem Check-in Intervall starten (z.B. 1 Minute für Tests)

**Test:**
1. Trip starten
2. Warten auf Check-in Notification
3. Auf "Yes" oder "Need Help" antworten
4. Prüfe, ob nächster Check-in kommt

### 4. **Notifications testen:**

**Setup:**
- Push Notifications müssen aktiviert sein
- Expo Push Token muss registriert sein

**Test:**
1. Guardian Request senden → Notification sollte ankommen
2. Trip starten → Guardian sollte Notification bekommen
3. Check-in verpassen → Escalation Notification sollte kommen

---

## 🚀 Schnellstart für Testing

### Schritt 1: Development Build erstellen

```bash
# iOS
eas build --profile development --platform ios

# Android
eas build --profile development --platform android
```

### Schritt 2: Build installieren

- **iOS:** Warte auf TestFlight Email, installiere über TestFlight App
- **Android:** Lade APK herunter und installiere

### Schritt 3: App starten

```bash
# Starte Expo Dev Server
npx expo start --dev-client

# Scanne QR Code mit der installierten App
# Oder verbinde manuell über Expo Go (nur für Development Build)
```

### Schritt 4: Testen

1. **Zwei Accounts erstellen:**
   - Account A: test@example.com
   - Account B: test2@example.com

2. **Guardians hinzufügen:**
   - Account A: Suche nach Account B Email
   - Sende Guardian Request
   - Account B: Akzeptiere Request

3. **Trip starten:**
   - Account A: Starte Trip
   - Account B: Öffne Home Screen
   - Account A sollte auf Karte erscheinen

4. **Rausgehen und laufen:**
   - Account A: Rausgehen, ein paar Meter laufen
   - Route sollte aufgezeichnet werden
   - Account B: Sollte Bewegung auf Karte sehen

---

## 🔍 Debugging

### Standort-Tracking prüfen:

```bash
# Logs auf iOS
npx expo start --dev-client
# Dann in Xcode: Window → Devices → Select Device → View Device Logs

# Logs auf Android
adb logcat | grep -i "location\|halo"
```

### Supabase Logs prüfen:

1. Gehe zu Supabase Dashboard
2. Logs → Postgres Logs
3. Prüfe, ob Route Points gespeichert werden

### Push Notifications testen:

```bash
# Test Notification senden
npx expo-notifications send-push-notification --token "ExponentPushToken[...]"
```

---

## ⚠️ Wichtige Hinweise

1. **Background Location:**
   - Funktioniert nur auf echten Geräten
   - Benötigt "Immer erlauben" Berechtigung
   - App darf nicht vom System gekillt werden

2. **Standort-Genauigkeit:**
   - Draußen: Sehr genau (GPS)
   - Drinnen: Weniger genau (WiFi/Bluetooth)
   - Erste Position kann 30-60 Sekunden dauern

3. **Battery:**
   - Background Location verbraucht viel Battery
   - Für Tests: Power Bank mitnehmen

4. **Netzwerk:**
   - App benötigt Internet für Supabase
   - Route Points werden nur gespeichert, wenn Internet verfügbar

---

## 📝 Testing Checklist

- [ ] Development Build installiert
- [ ] Zwei Accounts erstellt
- [ ] Guardians hinzugefügt
- [ ] Standort-Berechtigung "Immer erlauben"
- [ ] Trip gestartet
- [ ] Route wird aufgezeichnet
- [ ] Guardians erscheinen auf Karte
- [ ] Check-ins funktionieren
- [ ] Notifications kommen an
- [ ] Background Location funktioniert (App im Hintergrund)

---

## 🆘 Troubleshooting

### Problem: Guardians erscheinen nicht auf Karte

**Lösung:**
- Prüfe, ob Guardian einen aktiven Trip hat
- Prüfe, ob `last_known_latitude/longitude` gesetzt ist
- Prüfe Supabase Logs für Fehler

### Problem: Route wird nicht aufgezeichnet

**Lösung:**
- Prüfe Background Location Berechtigung
- Prüfe, ob App im Hintergrund läuft
- Prüfe Internet-Verbindung
- Prüfe Supabase `route_points` Tabelle

### Problem: Notifications kommen nicht an

**Lösung:**
- Prüfe, ob Push Token registriert ist
- Prüfe Notification Berechtigung
- Prüfe Expo Push Service Status

---

## 🔗 Nützliche Links

- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [Expo Development Build](https://docs.expo.dev/development/introduction/)
- [Expo Location Docs](https://docs.expo.dev/versions/latest/sdk/location/)
- [Expo Notifications Docs](https://docs.expo.dev/versions/latest/sdk/notifications/)

