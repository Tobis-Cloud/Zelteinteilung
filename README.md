# JULA 2026 – Zelteinteilung Jungs
### CVJM Mössingen | Jungscharlager 2026

Eine Web-App für Eltern, um Wunschzeltpartner für das Jungscharlager 2026 einzutragen.

---

## 🚀 Einrichtung – Schritt für Schritt

### Schritt 1: Firebase-Projekt anlegen

1. Gehe zu [console.firebase.google.com](https://console.firebase.google.com)
2. Klicke auf **„Projekt hinzufügen"**
3. Projektname: z. B. `jula2026-zelteinteilung`
4. Google Analytics: **deaktivieren** (nicht nötig)
5. Klicke auf **„Projekt erstellen"**

---

### Schritt 2: Firestore-Datenbank aktivieren

1. Im Firebase-Dashboard links auf **„Firestore Database"** klicken
2. Auf **„Datenbank erstellen"** klicken
3. Modus: **„Im Produktionsmodus starten"** wählen
4. Standort: **`europe-west3`** (Frankfurt) – am nächsten zu Deutschland
5. Klicke auf **„Weiter"** und dann **„Aktivieren"**

---

### Schritt 3: Security Rules einspielen

1. In Firestore auf den Tab **„Regeln"** klicken
2. Den kompletten Inhalt der Datei `firestore.rules` aus diesem Projekt kopieren
3. In das Regeln-Feld einfügen und auf **„Veröffentlichen"** klicken

---

### Schritt 4: Firebase Authentication aktivieren

1. Im Dashboard links auf **„Authentication"** klicken
2. Auf **„Erste Schritte"** klicken
3. Tab **„Sign-in-Methode"** öffnen
4. **„E-Mail/Passwort"** aktivieren → **„Aktivieren"** → Speichern

---

### Schritt 5: Admin-Account erstellen

1. In Authentication auf den Tab **„Nutzer"** klicken
2. Auf **„Nutzer hinzufügen"** klicken
3. E-Mail und Passwort für den Admin-Zugang eingeben
4. **⚠️ WICHTIG:** Dieses Passwort sicher aufbewahren – es gibt keinen Passwort-Reset ohne Zugang zum Firebase-Konto!

---

### Schritt 6: Firebase-Config in den Code eintragen

1. Im Firebase-Dashboard oben auf **⚙ → „Projekteinstellungen"** klicken
2. Runterscrollen zu **„Deine Apps"**
3. Klicke auf **„</> Web-App hinzufügen"**
4. App-Nickname: `jula2026-web`
5. Firebase Hosting: **NICHT** aktivieren (wir nutzen GitHub Pages)
6. Kopiere die `firebaseConfig`-Werte

7. Öffne die Datei `js/firebase-config.js` und ersetze die Platzhalter:

```javascript
const firebaseConfig = {
  apiKey:            "HIER_DEIN_API_KEY",
  authDomain:        "jula2026-zelteinteilung.firebaseapp.com",
  projectId:         "jula2026-zelteinteilung",
  storageBucket:     "jula2026-zelteinteilung.appspot.com",
  messagingSenderId: "DEINE_SENDER_ID",
  appId:             "DEINE_APP_ID"
};
```

---

### Schritt 7: GitHub-Repository erstellen

1. Gehe zu [github.com](https://github.com) und melde dich an
2. Klicke auf **„New repository"** (+ oben rechts)
3. Repository-Name: z. B. `zelteinteilung`
4. Sichtbarkeit: **Public** (für GitHub Pages kostenlos notwendig)
   > 💡 Hinweis: Die Daten sind trotzdem sicher, da nur Admins über Firebase Auth auf die Daten zugreifen können. Der Code selbst ist öffentlich, aber harmlos.
5. Klicke auf **„Create repository"**

---

### Schritt 8: Code auf GitHub hochladen

Öffne das Terminal und navigiere in den Projektordner:

```bash
# Falls noch kein Git-Repository:
git init
git add .
git commit -m "Initial commit: JULA 2026 Zelteinteilung"

# Mit GitHub verbinden (URL aus dem neuen Repository kopieren):
git remote add origin https://github.com/DEIN_NAME/zelteinteilung.git
git branch -M main
git push -u origin main
```

---

### Schritt 9: GitHub Pages aktivieren

1. Im GitHub-Repository oben auf **„Settings"** klicken
2. Links auf **„Pages"** klicken
3. Unter **„Source"** → **„GitHub Actions"** auswählen
4. Fertig! Nach dem nächsten Push wird die Seite automatisch gebaut.

Die URL der Website ist dann:
```
https://DEIN_NAME.github.io/zelteinteilung/
```

---

### Schritt 10: Website testen

1. Öffne die Website-URL
2. Fülle das Formular aus und teste das Absenden
3. Prüfe in Firestore, ob der Eintrag erschienen ist
4. Öffne `admin.html` und melde dich mit deinen Admin-Zugangsdaten an
5. Überprüfe ob die Einträge erscheinen

---

## 🔒 Sicherheit

| Maßnahme | Details |
|---|---|
| **Firebase Security Rules** | Nur neue Einträge erlaubt (kein Überschreiben), Lesen nur für Admins |
| **Firebase Auth** | Admin-Login mit E-Mail + Passwort |
| **Duplikatschutz** | Serverseitig durch `!exists()` in den Rules |
| **Input-Validierung** | Pflichtfelder + Längenbeschränkung in den Rules |
| **HTTPS** | GitHub Pages erzwingt HTTPS automatisch |

---

## 📁 Dateistruktur

```
zelteinteilung/
├── index.html              # Eltern-Formular
├── success.html            # Erfolgsseite
├── admin.html              # Admin-Bereich
├── impressum.html          # Impressum
├── firestore.rules         # Firebase Security Rules (hier nur zur Referenz)
├── css/
│   └── style.css           # Globales Stylesheet
├── js/
│   ├── firebase-config.js  # ⚠️ Firebase-Config hier eintragen!
│   ├── form.js             # Formular-Logik
│   ├── admin.js            # Admin-Logik
│   ├── graph.js            # D3.js Graph
│   ├── algorithm.js        # Greedy-Algorithmus
│   └── export.js           # XLSX + PNG Export
├── assets/
│   └── CVJM.png            # CVJM-Logo
└── .gitignore
```

---

## 🛠 Änderungen vornehmen

Nach jeder Änderung einfach:
```bash
git add .
git commit -m "Beschreibung der Änderung"
git push
```
→ GitHub Actions baut und deployed die Seite automatisch (~2 Minuten).

---

## ❓ Häufige Fragen

**„Der Admin-Login funktioniert nicht"**
→ Überprüfe ob du den Admin-Account in Firebase Authentication erstellt hast (Schritt 5).

**„Das Formular zeigt einen Fehler 'permission-denied'"**
→ Überprüfe ob die Security Rules korrekt eingespielt wurden (Schritt 3).

**„Der Graph zeigt keine Knoten"**
→ Es sind noch keine Einträge in der Datenbank. Fülle erst das Formular aus.

---

*Lagerleitung JULA 2026: Hannah Hoch, Felix Jauch, Lea Hägele, Tobias Ayen*
*Soli Deo Gloria ✝*

 
