# 🛡️ Halo — Digital Guardian App
Version: MVP v1.0  
Owner: Yannik Fuchs & Team  
Generated for: Cursor Agent  

---

## 1. Vision & Purpose
Halo is a mobile companion that provides peace of mind while walking home or moving alone. It combines smart, configurable safety features with a calming and privacy-first experience.  
The goal is not surveillance, but empowerment — giving users control, connection, and security without losing privacy.

---

## 2. Core Use Case
"I want to feel safe when walking home alone. If something happens or I don't respond, I want my trusted contacts to know."

---

## 3. MVP Scope Overview

| Feature | Description |
|----------|--------------|
| **Trip Start / Stop** | User starts a "trip" manually when beginning a walk. Ends manually when they reach safety. |
| **Check-in System** | App sends periodic "Are you okay?" notifications. User responds "Yes" or "Need help". |
| **Escalation Logic** | If the user misses multiple check-ins, the app vibrates, notifies emergency contacts, and optionally shares last location. |
| **Safety Modes** | User chooses between Silent, Interval, and Continuous tracking (location policy differs). |
| **SafeTogether** | Option to connect with verified nearby Halo users walking similar routes. Users can walk home together. |
| **Trusted Notifications** | Notifies friends/family when user starts a trip, pairs with someone, or arrives safely. |
| **Quick Emergency Action** | Triple press of Action Button (iOS/Android) instantly triggers alert + contact notification. |
| **Privacy Controls** | Users can fully control when and how their location is shared. Data auto-deletes after defined period. |
| **Simple UI/UX** | Calm blue (#5170FF) minimalist theme, non-threatening visuals, trust-oriented language. |

---

## 4. User Flows

### 4.1 Start a Trip
1. User opens app → taps "Start Trip".  
2. Chooses destination (optional), mode (Silent / Interval / Continuous), check-in interval (3–10 minutes), and whether to enable "SafeTogether".  
3. Tap **Start** → app logs trip and starts timers.  
4. Sends optional "Halo activated" message to contacts.  

### 4.2 During Trip
- Every X minutes → "Are you okay?" ✅ Yes / ⚠️ Need Help  
- No response → vibration  
- 2+ missed → contact notification  

### 4.3 SafeTogether
- Users nearby see each other (~300–500m radius).  
- On mutual consent → paired.  
- Contacts notified automatically.  

### 4.4 Trip End
- User taps "I'm home safe."  
- Stops all timers and background tracking.  
- Sends arrival message to contacts.  
- Data auto-deletes after 30 days.  

---

## 5. Data Model (Conceptual)

**Entities:**  
- User  
- EmergencyContact  
- Trip  
- Checkin  
- NearbyPresence  
- Event  

---

## 6. Backend / Infrastructure

| Component | Tool | Purpose |
|------------|------|----------|
| Database | Supabase (Postgres) | Store users, trips, check-ins, contacts |
| Auth | Supabase Auth | Email/Magic Link login |
| Notifications | Expo Push API / Twilio SMS stub | Check-ins + alerts |
| Location | Expo Location | Background location |
| Background Tasks | Expo TaskManager + BackgroundFetch | Timed check-ins |
| Realtime | Supabase Realtime | Nearby users and pairing |
| UI | React Native (Expo) | Cross-platform app |
| Design | Tailwind (NativeWind) | Consistent UI |

---

## 7. Privacy & Security
- Location access only during active trips.  
- Auto-deletion after 30 days.  
- Encrypted connections and JWT-based auth.  
- Approximate location shared with contacts.  
- Full data deletion control.

---

## 8. Design & Tone
- **Primary color:** #

0FF  
- **Accent:** white, light gray  
- **Typography:** rounded sans-serif  
- **Tone:** calm, trustworthy, empathetic  
- **Voice:** short and friendly ("You're safe", "Trip started", "All okay?")

---

## 9. MVP Deliverables
- React Native app (Expo)  
- Supabase integration  
- Push notifications  
- Trip start/stop and check-in system  
- SafeTogether prototype  
- Emergency contact alerts  
- Privacy mode options  
- Basic onboarding + settings  

---

## 10. Post-MVP Ideas
- Voice check-ins  
- Motion detection  
- Verified ID for SafeTogether  
- Group Safety Mode  
- AI anomaly detection  
- In-app voice assistant  

---

## 11. Success Metrics
- Trip completion %  
- Check-in response time  
- User retention  
- SafeTogether usage rate  
- User trust/feedback  

---

## 12. Acceptance Criteria
- Start and end trips  
- Regular check-ins work  
- Missed check-ins trigger alerts  
- Location behaves per mode  
- SafeTogether finds nearby users  
- Push notifications functional  
- Data deletable or auto-purged  

