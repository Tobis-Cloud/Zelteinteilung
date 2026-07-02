// ============================================
// form.js
// Eltern-Formular: Validierung, Duplikatcheck, Absenden
// ============================================

(function () {
  'use strict';

  // --- DOM-Elemente ---
  const form         = document.getElementById('wunsch-form');
  const emailInput   = document.getElementById('email');
  const vornameInput = document.getElementById('vorname');
  const nachnameInput= document.getElementById('nachname');
  const submitBtn    = document.getElementById('submit-btn');
  const alertBox     = document.getElementById('alert-box');
  const privacyConsent = document.getElementById('privacy-consent');

  // Wunschpartner-Felder
  const partnerFields = [
    {
      vorname:  document.getElementById('wunsch1-vorname'),
      nachname: document.getElementById('wunsch1-nachname'),
    },
    {
      vorname:  document.getElementById('wunsch2-vorname'),
      nachname: document.getElementById('wunsch2-nachname'),
    },
    {
      vorname:  document.getElementById('wunsch3-vorname'),
      nachname: document.getElementById('wunsch3-nachname'),
    },
  ];

  if (!form) return; // Nur auf index.html ausführen

  // --- Hilfsfunktionen ---

  /**
   * Normalisiert einen Namen zu einem Firestore-Document-Key.
   * Beispiel: "Max Mustermann" → "max_mustermann"
   */
  function normalizeKey(vorname, nachname) {
    const normalize = (s) =>
      s.normalize('NFC')
        .trim()
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    return `${normalize(vorname)}_${normalize(nachname)}`;
  }

  /**
   * Zeigt eine Fehlermeldung an.
   */
  function showAlert(type, message) {
    const icons = {
      error:   '❌',
      success: '✅',
      warning: '⚠️',
      info:    'ℹ️',
    };
    alertBox.className = `alert alert--${type}`;
    alertBox.innerHTML = `<span class="alert__icon">${icons[type] || 'ℹ️'}</span><div>${message}</div>`;
    alertBox.classList.remove('hidden');
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideAlert() {
    alertBox.classList.add('hidden');
  }

  /**
   * Setzt den Submit-Button in den Lade-Zustand.
   */
  function setLoading(loading) {
    if (loading) {
      submitBtn.classList.add('loading');
      submitBtn.disabled = true;
    } else {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  }

  /**
   * Liest alle Formulardaten aus.
   */
  function getFormData() {
    const partners = partnerFields
      .map(f => ({
        vorname:  f.vorname.value.trim(),
        nachname: f.nachname.value.trim(),
      }))
      .filter(p => p.vorname !== '' || p.nachname !== '');

    return {
      email:    emailInput.value.trim(),
      vorname:  vornameInput.value.trim(),
      nachname: nachnameInput.value.trim(),
      partners,
      consent:  privacyConsent ? privacyConsent.checked : false,
    };
  }

  /**
   * Validiert die Formulardaten.
   * Gibt null zurück wenn alles ok, sonst Fehlermeldung.
   */
  function validate(data) {
    if (!data.email) return 'Bitte gib deine E-Mail-Adresse ein.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
      return 'Die E-Mail-Adresse scheint ungültig zu sein.';
    if (!data.vorname) return 'Bitte gib den Vornamen deines Kindes ein.';
    if (!data.nachname) return 'Bitte gib den Nachnamen deines Kindes ein.';
    if (!data.consent) return 'Bitte willige in die Verarbeitung der personenbezogenen Daten deines Kindes ein.';

    // Wunschpartner-Validierung: wenn einer der beiden Felder ausgefüllt, muss der andere auch gefüllt sein
    for (let i = 0; i < partnerFields.length; i++) {
      const p = data.partners.find((_, idx) => {
        const f = partnerFields[i];
        return (f.vorname.value.trim() !== '' || f.nachname.value.trim() !== '');
      });
    }

    for (let i = 0; i < partnerFields.length; i++) {
      const f = partnerFields[i];
      const v = f.vorname.value.trim();
      const n = f.nachname.value.trim();
      if ((v && !n) || (!v && n)) {
        return `Bitte fülle bei Wunschzeltpartner ${i + 1} beide Felder aus (Vor- und Nachname).`;
      }
    }

    return null;
  }

  // --- Form Submit Handler ---
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    hideAlert();

    const data = getFormData();
    const error = validate(data);
    if (error) {
      showAlert('error', error);
      return;
    }

    setLoading(true);

    try {
      const kindId = normalizeKey(data.vorname, data.nachname);
      const collectionRef = db.collection('wuensche');

      // Dokument vorbereiten
      const docData = {
        email:    data.email,
        vorname:  data.vorname,
        nachname: data.nachname,
        wunsch1_vorname:  data.partners[0]?.vorname  || null,
        wunsch1_nachname: data.partners[0]?.nachname || null,
        wunsch2_vorname:  data.partners[1]?.vorname  || null,
        wunsch2_nachname: data.partners[1]?.nachname || null,
        wunsch3_vorname:  data.partners[2]?.vorname  || null,
        wunsch3_nachname: data.partners[2]?.nachname || null,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        _kindId:   kindId,
      };

      // In Firestore mit zufälliger ID speichern (Schutz vor Enumeration-Angriffen)
      await collectionRef.add(docData);

      // Auf Erfolgsseite weiterleiten (Übertragung via sessionStorage statt URL-Parameter für DSGVO-Konformität)
      const summaryData = {
        vorname:  data.vorname,
        nachname: data.nachname,
        email:    data.email,
        partners: data.partners,
      };
      try {
        sessionStorage.setItem('jula2026_summary', JSON.stringify(summaryData));
      } catch (e) {
        console.warn('sessionStorage nicht verfügbar:', e);
      }
      window.location.href = 'success.html';

    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      if (err.code === 'permission-denied') {
        showAlert(
          'warning',
          `<strong>Eintrag bereits vorhanden!</strong><br>
          Für dieses Kind wurde bereits ein Wunsch eingetragen.
          Aus Datenschutzgründen können bestehende Einträge nicht überschrieben oder eingesehen werden.
          Bei Fragen oder Änderungswünschen wende dich bitte direkt an die Lagerleitung.`
        );
      } else {
        showAlert(
          'error',
          'Ein Fehler ist aufgetreten. Bitte versuche es erneut oder kontaktiere die Lagerleitung.'
        );
      }
    } finally {
      setLoading(false);
    }
  });

})();
