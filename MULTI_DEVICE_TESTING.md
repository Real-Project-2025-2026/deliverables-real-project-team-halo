# 📱 Multi-Device Testing - Build auf mehrere Geräte installieren

## ✅ Ja, Preview Build kann auf mehrere Geräte!

### iOS (iPhone/iPad)

#### Methode 1: TestFlight (Empfohlen)

**Vorteile:**
- ✅ Einfach zu verteilen
- ✅ Automatische Updates
- ✅ Bis zu 10.000 Tester
- ✅ Funktioniert überall (nicht nur im gleichen Netzwerk)

**Setup:**

1. **Build erstellen:**
```bash
npm run build:preview:ios
```

2. **Zu TestFlight hochladen:**
```bash
eas submit --platform ios --profile preview
```

3. **Tester hinzufügen:**
   - Gehe zu [App Store Connect](https://appstoreconnect.apple.com)
   - Wähle deine App
   - TestFlight → Internal Testing
   - Füge Tester hinzu (Email-Adressen)
   - Tester erhalten Email mit Einladung

4. **Tester installieren:**
   - Tester öffnen TestFlight App
   - Akzeptieren Einladung
   - App installieren

**Wichtig:**
- Benötigt Apple Developer Account ($99/Jahr)
- Tester müssen TestFlight App installiert haben
- Build muss zuerst von Apple genehmigt werden (kann 1-2 Stunden dauern)

---

#### Methode 2: Ad-Hoc Distribution (Schneller, aber limitiert)

**Vorteile:**
- ✅ Keine Apple Genehmigung nötig
- ✅ Funktioniert sofort
- ✅ Direkte Installation

**Nachteile:**
- ❌ Maximal 100 Geräte (pro Jahr)
- ❌ Manuelles Gerät-Registrieren nötig
- ❌ Komplizierter

**Setup:**

1. **Geräte-UDIDs sammeln:**
   - Jedes iPhone hat eine UDID
   - Sammle UDIDs aller Test-Geräte
   - Füge sie zu Apple Developer Account hinzu

2. **Build mit Ad-Hoc erstellen:**

Erstelle `eas.json` Profil:
```json
{
  "build": {
    "preview-adhoc": {
      "distribution": "internal",
      "ios": {
        "simulator": false,
        "buildConfiguration": "Release"
      }
    }
  }
}
```

3. **Build erstellen:**
```bash
eas build --profile preview-adhoc --platform ios
```

4. **Installieren:**
   - Lade IPA herunter
   - Installiere über iTunes/Finder (macOS) oder 3uTools
   - Oder: Nutze TestFlight für einfachere Verteilung

---

### Android

**Viel einfacher!** 🎉

#### Methode 1: APK direkt teilen

**Vorteile:**
- ✅ Sehr einfach
- ✅ Keine Limits
- ✅ Funktioniert sofort

**Setup:**

1. **Build erstellen:**
```bash
npm run build:preview:android
```

2. **APK herunterladen:**
   - Nach Build: EAS zeigt Download-Link
   - Oder: Gehe zu [expo.dev](https://expo.dev) → Builds → Download APK

3. **APK teilen:**
   - Per Email senden
   - Per Cloud (Google Drive, Dropbox, etc.)
   - Per QR Code
   - Per USB-Kabel

4. **Installieren:**
   - Auf Android-Gerät: Einstellungen → Unbekannte Quellen erlauben
   - APK öffnen → Installieren

**Wichtig:**
- Android erlaubt Installation von unbekannten Quellen
- Jeder kann APK installieren (keine Registrierung nötig)

---

#### Methode 2: Google Play Internal Testing

**Vorteile:**
- ✅ Automatische Updates
- ✅ Einfache Verteilung
- ✅ Bis zu 100 Tester

**Setup:**

1. **Build erstellen:**
```bash
npm run build:preview:android
```

2. **Zu Play Store hochladen:**
```bash
eas submit --platform android --profile preview
```

3. **Internal Testing aktivieren:**
   - Google Play Console → Internal Testing
   - Tester hinzufügen (Email-Liste oder Google Groups)
   - Tester erhalten Link zum Installieren

---

## 🎯 Empfohlener Workflow für Multi-Device Testing

### Für iOS (2+ iPhones):

**Option A: TestFlight (Beste Erfahrung)**
1. Build erstellen: `npm run build:preview:ios`
2. Zu TestFlight hochladen: `eas submit --platform ios`
3. Tester hinzufügen (Email-Adressen)
4. Tester installieren über TestFlight App

**Option B: Ad-Hoc (Schneller, aber limitiert)**
1. UDIDs sammeln
2. Build mit Ad-Hoc erstellen
3. IPA teilen (Email, AirDrop, etc.)

### Für Android (2+ Geräte):

**Einfachste Methode:**
1. Build erstellen: `npm run build:preview:android`
2. APK herunterladen
3. APK per Email/Cloud/USB teilen
4. Auf jedem Gerät installieren

---

## 📋 Quick Start: Preview Build auf 2 iPhones

### Schritt 1: Build erstellen

```bash
npm run build:preview:ios
```

Warte auf Build (10-20 Minuten)

### Schritt 2: Zu TestFlight hochladen

```bash
eas submit --platform ios --profile preview
```

### Schritt 3: Tester hinzufügen

1. Gehe zu [App Store Connect](https://appstoreconnect.apple.com)
2. Wähle deine App → TestFlight
3. Internal Testing → + Tester
4. Füge Email-Adressen hinzu:
   - `test1@example.com`
   - `test2@example.com`

### Schritt 4: Tester installieren

- Tester erhalten Email
- Öffnen TestFlight App
- App installieren

**Fertig!** Beide iPhones haben jetzt die App installiert.

---

## 🔄 Updates verteilen

### TestFlight (iOS):

- Neuen Build erstellen
- Zu TestFlight hochladen
- Tester erhalten automatisch Update-Benachrichtigung
- Update über TestFlight App

### APK (Android):

- Neuen Build erstellen
- APK teilen
- Tester installieren manuell (überschreibt alte Version)

---

## ⚠️ Wichtige Hinweise

### iOS:

1. **Apple Developer Account:**
   - Benötigt für TestFlight ($99/Jahr)
   - Oder: Ad-Hoc (kostenlos, aber limitiert)

2. **Geräte-Limits:**
   - TestFlight: Bis zu 10.000 Tester
   - Ad-Hoc: 100 Geräte pro Jahr

3. **Build-Genehmigung:**
   - TestFlight: Apple prüft Build (1-2 Stunden)
   - Ad-Hoc: Keine Prüfung

### Android:

1. **Keine Limits:**
   - APK kann unbegrenzt geteilt werden
   - Keine Registrierung nötig

2. **Sicherheit:**
   - Android warnt vor Installation von unbekannten Quellen
   - Tester müssen "Unbekannte Quellen" erlauben

---

## 🎯 Beispiel: Testing mit 2 iPhones

### Setup:

1. **Build erstellen:**
   ```bash
   npm run build:preview:ios
   ```

2. **Zu TestFlight hochladen:**
   ```bash
   eas submit --platform ios --profile preview
   ```

3. **Beide iPhones als Tester hinzufügen:**
   - iPhone 1: `test1@example.com`
   - iPhone 2: `test2@example.com`

4. **Auf beiden installieren:**
   - Beide öffnen TestFlight App
   - App installieren

### Testen:

1. **iPhone 1:**
   - Account A erstellen
   - Guardian Request an Account B senden

2. **iPhone 2:**
   - Account B erstellen
   - Guardian Request akzeptieren

3. **Beide:**
   - Trip starten
   - Rausgehen
   - Guardians auf Karte sehen

**Fertig!** Beide Geräte funktionieren komplett unabhängig.

---

## 💡 Tipp

**Für schnelles Testing:**

- **iOS:** Nutze Ad-Hoc für schnelle Tests (keine Apple-Prüfung)
- **Android:** APK direkt teilen (sehr einfach)
- **Beide:** TestFlight/Play Store für professionelle Verteilung

---

## 🔗 Nützliche Links

- [EAS Submit Docs](https://docs.expo.dev/submit/introduction/)
- [TestFlight Guide](https://developer.apple.com/testflight/)
- [Ad-Hoc Distribution](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)

