# Action Button Troubleshooting

## Problem: App Intents erscheinen nicht in Shortcuts App

Wenn du "Halo" in der Shortcuts App suchst und nichts findest, gibt es mehrere mögliche Lösungen:

### Lösung 1: App neu installieren (Wichtig!)

App Intents werden von iOS beim ersten Start der App indexiert. Wenn die App bereits installiert war, bevor die App Intents hinzugefügt wurden:

1. **App komplett löschen** vom iPhone
2. **Neuen Build installieren** (der mit App Intents)
3. **App einmal öffnen** und kurz warten
4. **Shortcuts App öffnen** und nach "Halo" suchen

### Lösung 2: iOS neu indexieren

Manchmal muss iOS die App Intents neu indexieren:

1. **iPhone neu starten**
2. **App öffnen** und kurz warten (30 Sekunden)
3. **Shortcuts App öffnen** und warten (manchmal dauert es ein paar Sekunden)
4. Nach "Halo" suchen

### Lösung 3: In "App Shortcuts" Tab suchen

Die App Intents erscheinen im Tab **"App Shortcuts"** (nicht in "Alle Kurzbefehle"):

1. Öffne **Shortcuts App**
2. Gehe zum Tab **"App Shortcuts"** (unten in der Navigation)
3. Suche nach "Halo" oder scrolle durch die Apps
4. Du solltest "I'm OK" und "Need Help" sehen

### Lösung 4: Prüfe iOS Version

App Intents benötigen **iOS 16.0 oder höher**:

1. Einstellungen → Allgemein → Info
2. Prüfe die iOS Version
3. Falls < 16.0: Update erforderlich

### Lösung 5: Prüfe Build-Logs

Falls die Swift-Dateien nicht kompiliert wurden:

1. Prüfe die EAS Build Logs
2. Suche nach "ConfirmCheckinIntent.swift"
3. Falls Fehler: Die Dateien wurden möglicherweise nicht gefunden

### Lösung 6: Manuell in Shortcuts App prüfen

Manchmal erscheinen App Intents unter einem anderen Namen:

1. Öffne **Shortcuts App**
2. Gehe zu **"App Shortcuts"** Tab
3. Scrolle durch alle Apps (nicht nur suchen)
4. Suche nach deiner App (Bundle ID: `com.kelbidani.haloapp`)

## Was sollte erscheinen?

Nach erfolgreicher Installation solltest du sehen:

- **"I'm OK"** - Shortcut zum Bestätigen eines Check-ins
- **"Need Help"** - Shortcut zum Anfordern von Notfallhilfe

## Debugging

Falls nichts funktioniert, prüfe:

1. **Console Logs** in der App:
   ```typescript
   [Action Button] App Intents not available
   ```
   Falls diese Meldung erscheint, ist das native Module nicht geladen.

2. **Build erfolgreich?**
   - Prüfe, ob der Build ohne Fehler abgeschlossen wurde
   - Prüfe, ob die Swift-Dateien im Build enthalten sind

3. **App Bundle ID korrekt?**
   - Prüfe `app.json` → `ios.bundleIdentifier`
   - Sollte sein: `com.kelbidani.haloapp`

## Alternative: Notification Actions verwenden

Falls App Intents nicht funktionieren, kannst du weiterhin **Notification Actions** verwenden:
- Diese funktionieren auf allen iOS Versionen
- Sie erscheinen direkt in den Push Notifications
- Keine zusätzliche Konfiguration nötig

## Nächste Schritte

1. **App löschen und neu installieren** (wichtig!)
2. **App öffnen** und kurz warten
3. **Shortcuts App öffnen** → Tab "App Shortcuts"
4. Nach "Halo" suchen oder durch Apps scrollen

Falls es immer noch nicht funktioniert, könnte es sein, dass:
- Die Swift-Dateien nicht korrekt kompiliert wurden
- Die App Intents nicht korrekt registriert sind
- Ein Problem mit dem EAS Build vorliegt

In diesem Fall: Prüfe die Build-Logs und stelle sicher, dass die Swift-Dateien im Build enthalten sind.











