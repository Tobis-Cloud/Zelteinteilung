// ============================================
// firebase-config.js
// Firebase-Konfiguration für JULA 2026 Zelteinteilung
// WICHTIG: Diese Datei enthält öffentliche Firebase-Config.
// Sicherheit wird durch Firestore Security Rules gewährleistet!
// ============================================

// Firebase-Konfiguration für das Projekt "Zelteinteilung"
const firebaseConfig = {
  apiKey:            "AIzaSyChRqdkq8IKQs5dqkXV2xbSDBk1ukierks",
  authDomain:        "zelteinteilung.firebaseapp.com",
  projectId:         "zelteinteilung",
  storageBucket:     "zelteinteilung.firebasestorage.app",
  messagingSenderId: "904083835202",
  appId:             "1:904083835202:web:670cd4efdd8428377be0db"
};

// Firebase initialisieren
firebase.initializeApp(firebaseConfig);

// Firestore & Auth Instanzen
const db   = firebase.firestore();
const auth = firebase.auth();

// Export für andere Module
window.db   = db;
window.auth = auth;
