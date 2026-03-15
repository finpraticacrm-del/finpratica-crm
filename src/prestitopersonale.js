// ============================================================
//  Comparatore Prestito Personale — Agos · Compass · Findomestic
//  Dati indicativi 2026 — verificare con i fogli informativi ufficiali
//  Agos: spese istruttoria €150, spese incasso €3.50/rata
//  Compass: spese istruttoria €100, spese incasso €2.50/rata — coobligato senza reddito
//  Findomestic: zero spese di apertura e gestione
// ============================================================

export const ISTITUTI_PP = {
  AGOS: {
    label: "Agos",
    nota: "Agos Ducato S.p.A. — Gruppo Crédit Agricole",
    colore: "#B91C1C",
    bg: "#FFF1F2",
    border: "#FECACA",
    badge: null,
    spese_istruttoria: 150.00,
    spese_rata: 3.50,
  },
  COMPASS: {
    label: "Compass",
    nota: "Compass S.p.A. — Gruppo Mediobanca",
    colore: "#7C3AED",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    badge: "Coobligato senza reddito ✓",
    badgeColor: "#7C3AED",
    badgeBg: "#F5F3FF",
    badgeBorder: "#DDD6FE",
    spese_istruttoria: 100.00,
    spese_rata: 2.50,
    coobligato_note: "Compass accetta un coobligato anche senza reddito dimostrabile (familiare, coniuge, convivente). Ideale quando il richiedente principale ha un reddito basso o instabile.",
  },
  FINDOMESTIC: {
    label: "Findomestic",
    nota: "Findomestic Banca S.p.A. — Gruppo BNP Paribas",
    colore: "#15803D",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    badge: "Zero spese",
    badgeColor: "#15803D",
    badgeBg: "#F0FDF4",
    badgeBorder: "#BBF7D0",
    spese_istruttoria: 0.00,
    spese_rata: 0.00,
  },
};

// ── Tabelle TAN/TAEG per durata e fascia importo ──────────────
// Fasce: 0_5 (fino a €5.000) · 5_10 (5.001–10.000) ·
//        10_20 (10.001–20.000) · 20_30 (20.001–30.000) · oltre30 (>30.000)
// TAEG: include effetto spese istruttoria + rata. Findomestic = TAN (zero spese).

export const TABELLE_PP = {

  AGOS: [
    { durata: 12, tan_0_5: 8.90, tan_5_10: 7.90, tan_10_20: 6.90, tan_20_30: 6.40, tan_oltre30: 5.99,  taeg_0_5: 11.50, taeg_5_10: 10.10, taeg_10_20: 8.20, taeg_20_30: 7.20, taeg_oltre30: 6.30 },
    { durata: 18, tan_0_5: 9.10, tan_5_10: 8.10, tan_10_20: 7.10, tan_20_30: 6.60, tan_oltre30: 6.19,  taeg_0_5: 11.20, taeg_5_10:  9.80, taeg_10_20: 8.10, taeg_20_30: 7.20, taeg_oltre30: 6.50 },
    { durata: 24, tan_0_5: 9.30, tan_5_10: 8.30, tan_10_20: 7.30, tan_20_30: 6.80, tan_oltre30: 6.39,  taeg_0_5: 11.00, taeg_5_10:  9.60, taeg_10_20: 8.00, taeg_20_30: 7.20, taeg_oltre30: 6.65 },
    { durata: 36, tan_0_5: 9.90, tan_5_10: 8.90, tan_10_20: 7.90, tan_20_30: 7.40, tan_oltre30: 6.99,  taeg_0_5: 10.80, taeg_5_10:  9.50, taeg_10_20: 8.10, taeg_20_30: 7.50, taeg_oltre30: 7.10 },
    { durata: 48, tan_0_5:10.40, tan_5_10: 9.40, tan_10_20: 8.40, tan_20_30: 7.90, tan_oltre30: 7.49,  taeg_0_5: 11.00, taeg_5_10:  9.80, taeg_10_20: 8.40, taeg_20_30: 7.80, taeg_oltre30: 7.40 },
    { durata: 60, tan_0_5:10.90, tan_5_10: 9.90, tan_10_20: 8.90, tan_20_30: 8.40, tan_oltre30: 7.99,  taeg_0_5: 11.20, taeg_5_10: 10.10, taeg_10_20: 8.70, taeg_20_30: 8.10, taeg_oltre30: 7.70 },
    { durata: 72, tan_0_5:11.40, tan_5_10:10.40, tan_10_20: 9.40, tan_20_30: 8.90, tan_oltre30: 8.49,  taeg_0_5: 11.60, taeg_5_10: 10.50, taeg_10_20: 9.10, taeg_20_30: 8.50, taeg_oltre30: 8.10 },
    { durata: 84, tan_0_5:11.90, tan_5_10:10.90, tan_10_20: 9.90, tan_20_30: 9.40, tan_oltre30: 8.99,  taeg_0_5: 12.10, taeg_5_10: 11.00, taeg_10_20: 9.60, taeg_20_30: 8.90, taeg_oltre30: 8.50 },
  ],

  COMPASS: [
    { durata: 12, tan_0_5:10.20, tan_5_10: 9.20, tan_10_20: 8.20, tan_20_30: 7.70, tan_oltre30: 7.20,  taeg_0_5: 12.50, taeg_5_10: 11.00, taeg_10_20: 9.20, taeg_20_30: 8.20, taeg_oltre30: 7.50 },
    { durata: 18, tan_0_5:10.40, tan_5_10: 9.40, tan_10_20: 8.40, tan_20_30: 7.90, tan_oltre30: 7.40,  taeg_0_5: 12.20, taeg_5_10: 10.80, taeg_10_20: 9.10, taeg_20_30: 8.20, taeg_oltre30: 7.60 },
    { durata: 24, tan_0_5:10.60, tan_5_10: 9.60, tan_10_20: 8.60, tan_20_30: 8.10, tan_oltre30: 7.60,  taeg_0_5: 12.00, taeg_5_10: 10.60, taeg_10_20: 9.00, taeg_20_30: 8.30, taeg_oltre30: 7.80 },
    { durata: 36, tan_0_5:11.20, tan_5_10:10.20, tan_10_20: 9.20, tan_20_30: 8.70, tan_oltre30: 8.20,  taeg_0_5: 11.80, taeg_5_10: 10.50, taeg_10_20: 9.20, taeg_20_30: 8.60, taeg_oltre30: 8.10 },
    { durata: 48, tan_0_5:11.70, tan_5_10:10.70, tan_10_20: 9.70, tan_20_30: 9.20, tan_oltre30: 8.70,  taeg_0_5: 12.00, taeg_5_10: 10.80, taeg_10_20: 9.50, taeg_20_30: 8.90, taeg_oltre30: 8.40 },
    { durata: 60, tan_0_5:12.20, tan_5_10:11.20, tan_10_20:10.20, tan_20_30: 9.70, tan_oltre30: 9.20,  taeg_0_5: 12.40, taeg_5_10: 11.20, taeg_10_20: 9.90, taeg_20_30: 9.30, taeg_oltre30: 8.80 },
    { durata: 72, tan_0_5:12.70, tan_5_10:11.70, tan_10_20:10.70, tan_20_30:10.20, tan_oltre30: 9.70,  taeg_0_5: 12.90, taeg_5_10: 11.70, taeg_10_20:10.40, taeg_20_30: 9.80, taeg_oltre30: 9.30 },
    { durata: 84, tan_0_5:13.20, tan_5_10:12.20, tan_10_20:11.20, tan_20_30:10.70, tan_oltre30:10.20,  taeg_0_5: 13.40, taeg_5_10: 12.20, taeg_10_20:10.90, taeg_20_30:10.30, taeg_oltre30: 9.80 },
  ],

  FINDOMESTIC: [
    { durata: 12, tan_0_5: 9.50, tan_5_10: 8.50, tan_10_20: 7.50, tan_20_30: 7.00, tan_oltre30: 6.50,  taeg_0_5:  9.51, taeg_5_10:  8.51, taeg_10_20: 7.51, taeg_20_30: 7.01, taeg_oltre30: 6.51 },
    { durata: 18, tan_0_5: 9.70, tan_5_10: 8.70, tan_10_20: 7.70, tan_20_30: 7.20, tan_oltre30: 6.70,  taeg_0_5:  9.71, taeg_5_10:  8.71, taeg_10_20: 7.71, taeg_20_30: 7.21, taeg_oltre30: 6.71 },
    { durata: 24, tan_0_5: 9.90, tan_5_10: 8.90, tan_10_20: 7.90, tan_20_30: 7.40, tan_oltre30: 6.90,  taeg_0_5:  9.91, taeg_5_10:  8.91, taeg_10_20: 7.91, taeg_20_30: 7.41, taeg_oltre30: 6.91 },
    { durata: 36, tan_0_5:10.50, tan_5_10: 9.50, tan_10_20: 8.50, tan_20_30: 8.00, tan_oltre30: 7.50,  taeg_0_5: 10.51, taeg_5_10:  9.51, taeg_10_20: 8.51, taeg_20_30: 8.01, taeg_oltre30: 7.51 },
    { durata: 48, tan_0_5:11.00, tan_5_10:10.00, tan_10_20: 9.00, tan_20_30: 8.50, tan_oltre30: 8.00,  taeg_0_5: 11.01, taeg_5_10: 10.01, taeg_10_20: 9.01, taeg_20_30: 8.51, taeg_oltre30: 8.01 },
    { durata: 60, tan_0_5:11.50, tan_5_10:10.50, tan_10_20: 9.50, tan_20_30: 9.00, tan_oltre30: 8.50,  taeg_0_5: 11.51, taeg_5_10: 10.51, taeg_10_20: 9.51, taeg_20_30: 9.01, taeg_oltre30: 8.51 },
    { durata: 72, tan_0_5:12.00, tan_5_10:11.00, tan_10_20:10.00, tan_20_30: 9.50, tan_oltre30: 9.00,  taeg_0_5: 12.01, taeg_5_10: 11.01, taeg_10_20:10.01, taeg_20_30: 9.51, taeg_oltre30: 9.01 },
    { durata: 84, tan_0_5:12.50, tan_5_10:11.50, tan_10_20:10.50, tan_20_30:10.00, tan_oltre30: 9.50,  taeg_0_5: 12.51, taeg_5_10: 11.51, taeg_10_20:10.51, taeg_20_30:10.01, taeg_oltre30: 9.51 },
  ],
};

export const DURATE_PRESTITO = [12, 18, 24, 36, 48, 60, 72, 84];

// ── Seleziona TAN/TAEG per fascia importo ────────────────────
function getFasciaRata(riga, importo) {
  if (importo <= 5000)  return { tan: riga.tan_0_5,     taeg: riga.taeg_0_5 };
  if (importo <= 10000) return { tan: riga.tan_5_10,    taeg: riga.taeg_5_10 };
  if (importo <= 20000) return { tan: riga.tan_10_20,   taeg: riga.taeg_10_20 };
  if (importo <= 30000) return { tan: riga.tan_20_30,   taeg: riga.taeg_20_30 };
  return                       { tan: riga.tan_oltre30, taeg: riga.taeg_oltre30 };
}

// ── Calcola rata mensile (ammortamento francese) ─────────────
export function calcolaRataPP(importo, tan, durata) {
  if (!importo || !tan || !durata) return 0;
  const r = tan / 100 / 12;
  return importo * r * Math.pow(1 + r, durata) / (Math.pow(1 + r, durata) - 1);
}

// ── Confronto istituti — restituisce array ordinato per rata ──
export function confrontaPrestitoPersonale(importo, durata) {
  const risultati = [];
  for (const [codice, info] of Object.entries(ISTITUTI_PP)) {
    const tabella = TABELLE_PP[codice];
    if (!tabella) continue;
    const riga = tabella.find(r => r.durata === durata);
    if (!riga) continue;
    const { tan, taeg } = getFasciaRata(riga, importo);
    if (!tan) continue;
    const rata        = calcolaRataPP(importo, tan, durata);
    const costoTotale = rata * durata;
    const interessiTotali = costoTotale - importo;
    risultati.push({
      codice,
      label:            info.label,
      nota:             info.nota,
      colore:           info.colore,
      bg:               info.bg,
      border:           info.border,
      badge:            info.badge || null,
      badgeColor:       info.badgeColor || null,
      badgeBg:          info.badgeBg || null,
      badgeBorder:      info.badgeBorder || null,
      coobligato_note:  info.coobligato_note || null,
      spese_istruttoria: info.spese_istruttoria,
      spese_rata:       info.spese_rata,
      tan,
      taeg,
      rata,
      costoTotale,
      interessiTotali,
    });
  }
  return risultati.sort((a, b) => a.rata - b.rata);
}
