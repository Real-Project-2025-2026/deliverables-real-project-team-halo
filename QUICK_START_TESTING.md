# 🚀 Quick Start: App auf echtem Gerät testen

## Schnellste Methode (5 Minuten)

### 1. EAS CLI installieren & einloggen

```bash
npm install -g eas-cli
eas login
```

### 2. Development Build erstellen

**Für iPhone:**
```bash
npm run build:dev:ios
```

**Für Android:**
```bash
npm run build:dev:android
```

### 3. Build installieren

- **iOS:** Warte auf Email von TestFlight → Installiere über TestFlight App
- **Android:** Lade APK herunter → Installiere auf Gerät

### 4. App starten

```bash
npm run start:dev
```

Scanne den QR-Code mit deinem iPhone/Android oder verbinde manuell.

---

## ⚡ Testing mit zwei Geräten

### Setup (einmalig):

1. **Zwei Accounts erstellen:**
   - Account A: `test1@example.com`
   - Account B: `test2@example.com`

2. **Guardians verbinden:**
   - Account A: SafeTogether Tab → Search → Suche nach `test2@example.com`
   - Sende Guardian Request
   - Account B: Requests Tab → Akzeptiere Request

### Test-Workflow:

1. **Account A (Gerät 1):**
   - Starte Trip
   - Wähle Guardians aus
   - Rausgehen und laufen

2. **Account B (Gerät 2):**
   - Home Screen öffnen
   - Account A sollte als Marker auf Karte erscheinen
   - Avatar sollte sichtbar sein

3. **Route testen:**
   - Account A: Ein paar Minuten laufen
   - Account B: Route sollte auf Karte erscheinen (wenn Account A Route teilt)

---

## 🔧 Wichtige Einstellungen

### Standort-Berechtigung:

**iOS:**
- Einstellungen → Halo → Standort → "Immer erlauben"

**Android:**
- Einstellungen → Apps → Halo → Berechtigungen → Standort → "Immer erlauben"

### Background App Refresh:

**iOS:**
- Einstellungen → Allgemein → Hintergrundaktualisierung → Halo aktivieren

**Android:**
- Automatisch aktiviert, wenn Background Location erlaubt ist

---

## 🌐 Wichtig: Netzwerk & Internet-Verbindung

### Development Build + Dev Server

**Standard (nur im gleichen Netzwerk):**
```bash
npm run start:dev
```
- Funktioniert nur, wenn Laptop und Handy im **gleichen WiFi** sind
- Schnell, aber eingeschränkt

**Mit Tunnel (funktioniert überall):**
```bash
npx expo start --dev-client --tunnel
```
- Funktioniert über **Internet** (auch verschiedene Netzwerke)
- Nutzt ngrok (kann etwas langsamer sein)
- **Empfohlen für echte Tests!**

### Production Build (BESTE Option für echte Tests)

**Vorteile:**
- ✅ Funktioniert **komplett offline** nach Installation
- ✅ Wie die finale App
- ✅ Keine Netzwerk-Abhängigkeit
- ✅ Background Location funktioniert perfekt

**Nachteile:**
- ❌ Kein Hot Reload (muss neu builden für Änderungen)

**Erstellen:**
```bash
# Preview Build (für Tests)
npm run build:preview:ios
# oder
npm run build:preview:android
```

Nach Installation funktioniert die App **komplett unabhängig** - keine Verbindung zum Laptop nötig!

## 🐛 Häufige Probleme

### Problem: "Cannot connect to Expo Dev Server"

**Lösung 1 (gleiches Netzwerk):**
- Prüfe, ob Laptop und Handy im gleichen WiFi sind
- Prüfe Firewall-Einstellungen

**Lösung 2 (verschiedene Netzwerke):**
- Nutze Tunnel:
  ```bash
  npx expo start --dev-client --tunnel
  ```

**Lösung 3 (beste Option):**
- Erstelle Preview/Production Build:
  ```bash
  npm run build:preview:ios
  ```
  - Funktioniert dann **komplett offline**!

### Problem: Guardians erscheinen nicht

**Lösung:**
- Prüfe, ob Guardian einen **aktiven Trip** hat
- Prüfe Supabase Logs für Fehler
- Warte 30 Sekunden (Auto-Refresh Intervall)

### Problem: Route wird nicht aufgezeichnet

**Lösung:**
- Prüfe Background Location Berechtigung
- App darf nicht geschlossen werden (nur minimieren)
- Prüfe Internet-Verbindung

---

## 📱 Alternative: Expo Go (nur für einfache Tests)

**Wichtig:** Expo Go unterstützt **KEINE** Background Location und viele native Features!

```bash
# Nur für UI-Tests, nicht für Location-Testing!
npx expo start
# Scanne QR Code mit Expo Go App
```

---

## 🎯 Nächste Schritte

Für detaillierte Informationen siehe: [TESTING_GUIDE.md](./TESTING_GUIDE.md)

