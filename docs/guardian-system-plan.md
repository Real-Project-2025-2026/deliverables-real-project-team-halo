# 🛡️ Guardian System - Feature Plan

## Überblick
Das Guardian-System ermöglicht es Nutzern, sich gegenseitig als "Guardians" (Beschützer) hinzuzufügen. Guardians sind vertrauenswürdige Kontakte, mit denen man sich während eines Trips verbinden kann.

---

## 1. Datenbank-Schema

### 1.1 Profile-Erweiterung
**Tabelle: `profiles`**
- ✅ Existiert bereits
- ➕ **NEU**: `username` (VARCHAR, UNIQUE, NOT NULL) - Eindeutiger Username

### 1.2 Guardian-Beziehungen
**NEUE Tabelle: `guardians`**

```sql
CREATE TABLE guardians (
  id BIGSERIAL PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status guardian_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(requester_id, recipient_id),
  CHECK(requester_id != recipient_id)
);

CREATE TYPE guardian_status AS ENUM ('pending', 'accepted', 'blocked');
```

**Felder:**
- `requester_id`: User, der die Anfrage gesendet hat
- `recipient_id`: User, der die Anfrage erhalten hat
- `status`: `pending` | `accepted` | `blocked`
- `accepted_at`: Zeitpunkt der Akzeptierung

**Indexes:**
- Index auf `requester_id` und `recipient_id` für schnelle Abfragen
- Index auf `status` für Pending-Requests-Abfragen

---

## 2. Feature-Breakdown

### 2.1 Onboarding-Erweiterung
**Datei:** `app/onboarding.tsx`

**Änderungen:**
- Nach Name-Eingabe: Username Input
- Username Validation:
  - Min 3 Zeichen
  - Max 20 Zeichen
  - Nur alphanumerische Zeichen + Unterstriche
  - Eindeutigkeit prüfen (Database Query)
- Avatar Upload bleibt bestehen

**Flow:**
1. Name eingeben → Weiter
2. Username eingeben → Validierung → Weiter
3. Avatar Upload (optional) → Weiter
4. Onboarding Slides

### 2.2 Safe Together Tab Screen
**Datei:** `app/(tabs)/explore.tsx` (neu bauen)

**UI-Komponenten:**

#### Header
- Titel: "My Guardians"
- Badge für eingehende Anfragen (wenn `pendingRequests.length > 0`)
- Search Button

#### Hauptbereich (Tabs/Segments)
1. **My Guardians** (Standard)
   - Liste aller akzeptierten Guardians
   - Jeder Guardian zeigt:
     - Avatar
     - Username
     - Name (falls vorhanden)
     - Online-Status (optional, später)
   - Empty State: "No guardians yet. Search for friends!"

2. **Search** (Tab/Segment)
   - Search Bar
   - Ergebnisse: Liste gefundener User
   - Jeder Result zeigt:
     - Avatar
     - Username
     - Name
     - Button: "Send Request" oder "Pending..." oder "Guardian ✓"

3. **Requests** (Tab/Segment mit Badge)
   - Eingehende Anfragen (ich bin `recipient_id`)
   - Jede Request zeigt:
     - Avatar
     - Username
     - Name
     - "Accept" / "Decline" Buttons
   - Leer: "No pending requests"

#### Design
- Halo Blau Hintergrund (`#5170FF`)
- Weiße Schrift/Icons
- Transparente Cards (`rgba(255, 255, 255, 0.15)`)

### 2.3 Guardian Service
**Datei:** `services/guardian-service.ts` (NEU)

**Funktionen:**

```typescript
// User suchen (nach Username)
searchUsers(query: string): Promise<User[]>

// Guardian-Anfrage senden
sendGuardianRequest(recipientId: string): Promise<{ success: boolean; error?: string }>

// Anfrage akzeptieren
acceptGuardianRequest(requestId: number): Promise<{ success: boolean; error?: string }>

// Anfrage ablehnen
declineGuardianRequest(requestId: number): Promise<{ success: boolean; error?: string }>

// Meine Guardians abrufen
getMyGuardians(): Promise<Guardian[]>

// Pending Requests abrufen (eingehend)
getPendingRequests(): Promise<GuardianRequest[]>

// Gesendete Anfragen abrufen (ausgehend)
getSentRequests(): Promise<GuardianRequest[]>

// Guardian entfernen
removeGuardian(guardianId: string): Promise<{ success: boolean; error?: string }>
```

### 2.4 Trip Start Integration
**Datei:** `app/trip/start.tsx`

**Änderungen:**

Aktuell:
- "SafeTogether" Toggle: "Connect with nearby users"

Neu:
- **Hauptoption**: "Connect with my Guardians"
  - Dropdown/Select: Wähle Guardians aus (Mehrfachauswahl)
  - Zeigt Liste aller Guardians
  - Optional: "All Guardians"
- **Zusätzlich**: "Connect with nearby users" (Toggle bleibt, aber sekundär)

**UI:**
```
[ ] Connect with my Guardians
    [ ] All Guardians
    [ ] @username1
    [ ] @username2
    ...

[ ] Connect with nearby users (optional)
```

### 2.5 Notifications
**Datei:** `services/notification-service.ts` (erweitern)

**Neue Notifications:**
- "Guardian Request" - Jemand möchte dein Guardian werden
- "Guardian Accepted" - Jemand hat deine Anfrage akzeptiert

---

## 3. Implementierungs-Reihenfolge

### Phase 1: Datenbank & Profil
1. ✅ Migration: `username` zu `profiles` hinzufügen
2. ✅ Migration: `guardians` Tabelle erstellen
3. ✅ Onboarding: Username Input
4. ✅ Profile Service: Username validieren/aktualisieren

### Phase 2: Guardian Service & Basis-Funktionalität
5. ✅ Guardian Service implementieren
6. ✅ User Search Service
7. ✅ RLS Policies für Guardians

### Phase 3: Safe Together UI
8. ✅ Safe Together Tab Screen neu bauen
9. ✅ Guardian List View
10. ✅ Search Function UI
11. ✅ Requests View (eingehend/ausgehend)

### Phase 4: Trip Integration
12. ✅ Trip Start: Guardians Selection
13. ✅ Trip Service: Guardian IDs speichern (neues Feld: `guardian_ids` oder eigene Tabelle)

### Phase 5: Notifications & Polish
14. ✅ Guardian Request Notifications
15. ✅ Badge für Pending Requests
16. ✅ Testing & Bug Fixes

---

## 4. Technische Details

### 4.1 RLS Policies (Row Level Security)

**Guardians Tabelle:**
- User kann eigene Anfragen sehen (als requester oder recipient)
- User kann Anfrage senden (INSERT nur für eigene requester_id)
- User kann eigene Anfragen akzeptieren/ablehnen (UPDATE nur für eigene recipient_id)

**Profile Tabelle (für Search):**
- Username ist öffentlich sichtbar (für Search)
- Weitere Profil-Daten nur für Guardians sichtbar

### 4.2 Username Validierung

**Client-Side:**
- Min 3, Max 20 Zeichen
- Regex: `^[a-zA-Z0-9_]+$`

**Server-Side:**
- Eindeutigkeit prüfen
- Case-insensitive Vergleich

### 4.3 Guardian-Status-Flow

```
pending → accepted (wenn Recipient akzeptiert)
pending → blocked (wenn Recipient ablehnt oder User blockiert)
```

---

## 5. UI/UX Considerations

### 5.1 Empty States
- "No guardians yet" - Motivierender Text mit Search-Button
- "No pending requests" - Freundlicher Hinweis

### 5.2 Loading States
- Skeleton Loaders für Guardian List
- Loading Spinner für Search

### 5.3 Error Handling
- Username bereits vergeben → Freundliche Fehlermeldung
- User existiert nicht → "User not found"
- Anfrage bereits gesendet → "Request already sent"

### 5.4 Success Feedback
- Haptic Feedback bei Actions
- Toast/Alert: "Guardian request sent!"
- Toast/Alert: "Guardian accepted!"

---

## 6. Zukünftige Erweiterungen (Post-MVP)

- Online Status für Guardians
- Last Seen Timestamp
- Guardian Groups/Kategorien
- Block/Unblock Funktionalität
- Guardian Activity Feed
- In-App Messaging (optional)

---

## 7. Testing Checklist

- [ ] Username-Eindeutigkeit prüfen
- [ ] Guardian Request senden/empfangen
- [ ] Request akzeptieren/ablehnen
- [ ] Search Function (mit verschiedenen Queries)
- [ ] Guardian List anzeigen
- [ ] Guardian aus Trip Start auswählen
- [ ] Notifications für Requests
- [ ] RLS Policies funktionieren
- [ ] Edge Cases: User blockiert sich selbst, doppelte Requests, etc.

