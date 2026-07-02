// ============================================
// firebase-config.js
// Firebase-Konfiguration für JULA 2026 Zelteinteilung
// WICHTIG: Diese Datei enthält öffentliche Firebase-Config.
// Sicherheit wird durch Firestore Security Rules gewährleistet!
// ============================================

// ⚠️ ERSETZE DIESE WERTE mit deinen eigenen Firebase-Projektdaten!
// Du findest sie in der Firebase Console unter: Projekteinstellungen → Allgemein → Deine Apps
const firebaseConfig = {
  apiKey:            "DEINE_API_KEY",
  authDomain:        "DEIN_PROJEKT.firebaseapp.com",
  projectId:         "DEIN_PROJEKT_ID",
  storageBucket:     "DEIN_PROJEKT.appspot.com",
  messagingSenderId: "DEINE_SENDER_ID",
  appId:             "DEINE_APP_ID"
};

// Firebase initialisieren
firebase.initializeApp(firebaseConfig);

// Firestore & Auth Instanzen
const db   = firebase.firestore();
const auth = firebase.auth();

// Export für andere Module
window.db   = db;
window.auth = auth;
