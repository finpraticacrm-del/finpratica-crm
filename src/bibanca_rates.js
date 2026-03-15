// ============================================================
//  BIBANCA — Catalogo CQ Completo
//  Canali: OPEN (OPN/CR1/CR2) · CAPTIVE (CPT/CTT/CBC) · DIGITAL · FACILE.IT
//  Categorie: STATALI/PUBBLICI · PARAPUBBLICI · PRIVATI · PENSIONATI
// ============================================================

export const BIBANCA_CATALOGO = {

  // ══════════════════════════════════════════════════════════
  // CANALE OPEN — STANDARD (OPN)
  // ══════════════════════════════════════════════════════════
  OPN: {
    label: "Open Standard",
    codice: "OPN",
    colore: "#1C3F6E",
    tabelle: {
      STATALI_PUBBLICI: [
        { durata: 120, provMax: 16.00, tan_0_15: 4.30, tan_15_30: 4.10, tan_oltre30: 3.95, tan_deleghe: 4.40 },
        { durata: 108, provMax: 16.00, tan_0_15: 4.50, tan_15_30: 4.40, tan_oltre30: 4.15, tan_deleghe: 4.60 },
        { durata:  96, provMax: 16.00, tan_0_15: 4.50, tan_15_30: 4.40, tan_oltre30: 4.15, tan_deleghe: 4.60 },
        { durata:  84, provMax: 16.00, tan_0_15: 4.50, tan_15_30: 4.40, tan_oltre30: 4.15, tan_deleghe: 4.60 },
        { durata:  72, provMax: 16.00, tan_0_15: 4.50, tan_15_30: 4.40, tan_oltre30: 4.15, tan_deleghe: 4.60 },
        { durata:  60, provMax:  1.60, etaMax: 54, tan_0_15: 5.20, tan_15_30: 5.10, tan_oltre30: 4.85, tan_deleghe: 5.30 },
        { durata:  48, provMax:  1.60, etaMax: 54, tan_0_15: 5.20, tan_15_30: 5.10, tan_oltre30: 4.85, tan_deleghe: 5.30 },
        { durata:  60, provMax:  8.00, etaMin: 55, tan_0_15: 5.20, tan_15_30: 5.10, tan_oltre30: 4.85, tan_deleghe: 5.30 },
        { durata:  48, provMax:  8.00, etaMin: 55, tan_0_15: 5.20, tan_15_30: 5.10, tan_oltre30: 4.85, tan_deleghe: 5.30 },
      ],
      PRIVATI: [
        { durata: 120, provMax: 16.00, tan_0_15: 6.10, tan_15_30: 5.80, tan_oltre30: 5.50, tan_deleghe: 6.40 },
        { durata: 108, provMax: 16.00, tan_0_15: 6.30, tan_15_30: 6.00, tan_oltre30: 5.70, tan_deleghe: 6.60 },
        { durata:  96, provMax: 16.00, tan_0_15: 6.30, tan_15_30: 6.00, tan_oltre30: 5.70, tan_deleghe: 6.60 },
        { durata:  84, provMax: 16.00, tan_0_15: 6.30, tan_15_30: 6.00, tan_oltre30: 5.70, tan_deleghe: 6.60 },
        { durata:  72, provMax: 16.00, tan_0_15: 6.30, tan_15_30: 6.00, tan_oltre30: 5.70, tan_deleghe: 6.60 },
        { durata:  60, provMax:  1.60, etaMax: 54, tan_0_15: 7.00, tan_15_30: 6.70, tan_oltre30: 6.40, tan_deleghe: 7.30 },
        { durata:  48, provMax:  1.60, etaMax: 54, tan_0_15: 7.00, tan_15_30: 6.70, tan_oltre30: 6.40, tan_deleghe: 7.30 },
        { durata:  60, provMax:  8.00, etaMin: 55, tan_0_15: 7.00, tan_15_30: 6.70, tan_oltre30: 6.40, tan_deleghe: 7.30 },
        { durata:  48, provMax:  8.00, etaMin: 55, tan_0_15: 7.00, tan_15_30: 6.70, tan_oltre30: 6.40, tan_deleghe: 7.30 },
      ],
      PARAPUBBLICI: [
        { durata: 120, provMax: 16.00, tan_0_15: 4.80, tan_15_30: 4.60, tan_oltre30: 4.45, tan_deleghe: 4.90 },
        { durata: 108, provMax: 16.00, tan_0_15: 5.00, tan_15_30: 4.90, tan_oltre30: 4.65, tan_deleghe: 5.10 },
        { durata:  96, provMax: 16.00, tan_0_15: 5.00, tan_15_30: 4.90, tan_oltre30: 4.65, tan_deleghe: 5.10 },
        { durata:  84, provMax: 16.00, tan_0_15: 5.00, tan_15_30: 4.90, tan_oltre30: 4.65, tan_deleghe: 5.10 },
        { durata:  72, provMax: 16.00, tan_0_15: 5.00, tan_15_30: 4.90, tan_oltre30: 4.65, tan_deleghe: 5.10 },
        { durata:  60, provMax:  1.60, etaMax: 54, tan_0_15: 5.70, tan_15_30: 5.60, tan_oltre30: 5.35, tan_deleghe: 5.80 },
        { durata:  48, provMax:  1.60, etaMax: 54, tan_0_15: 5.70, tan_15_30: 5.60, tan_oltre30: 5.35, tan_deleghe: 5.80 },
        { durata:  60, provMax:  8.00, etaMin: 55, tan_0_15: 5.70, tan_15_30: 5.60, tan_oltre30: 5.35, tan_deleghe: 5.80 },
        { durata:  48, provMax:  8.00, etaMin: 55, tan_0_15: 5.70, tan_15_30: 5.60, tan_oltre30: 5.35, tan_deleghe: 5.80 },
      ],
      PENSIONATI: [
        { durata: 120, provMax: 11.20, etaMax: 79, scadenza: true,  tan_0_15: 5.80, tan_15_30: 5.50, tan_oltre30: 5.20 },
        { durata: 108, provMax: 11.20, etaMax: 79, scadenza: true,  tan_0_15: 6.00, tan_15_30: 5.70, tan_oltre30: 5.40 },
        { durata:  96, provMax: 11.20, etaMax: 79, scadenza: true,  tan_0_15: 6.00, tan_15_30: 5.70, tan_oltre30: 5.40 },
        { durata:  84, provMax: 11.20, etaMax: 79, scadenza: true,  tan_0_15: 6.00, tan_15_30: 5.70, tan_oltre30: 5.40 },
        { durata:  72, provMax: 11.20, etaMax: 79, scadenza: true,  tan_0_15: 6.00, tan_15_30: 5.70, tan_oltre30: 5.40 },
        { durata:  60, provMax:  1.60, etaMax: 79, scadenza: true,  tan_0_15: 6.65, tan_15_30: 6.35, tan_oltre30: 6.05 },
        { durata:  48, provMax:  1.60, etaMax: 79, scadenza: true,  tan_0_15: 6.65, tan_15_30: 6.35, tan_oltre30: 6.05 },
        { durata: 120, provMax: 11.20, etaDa: 80, etaA: 84, scadenza: true, tan_0_15: 6.10, tan_15_30: 5.80, tan_oltre30: 5.50 },
        { durata: 108, provMax: 11.20, etaDa: 80, etaA: 84, scadenza: true, tan_0_15: 6.60, tan_15_30: 6.30, tan_oltre30: 6.00 },
        { durata:  96, provMax: 11.20, etaDa: 80, etaA: 84, scadenza: true, tan_0_15: 6.60, tan_15_30: 6.30, tan_oltre30: 6.00 },
        { durata:  84, provMax: 11.20, etaDa: 80, etaA: 84, scadenza: true, tan_0_15: 6.60, tan_15_30: 6.30, tan_oltre30: 6.00 },
        { durata:  72, provMax: 11.20, etaDa: 80, etaA: 84, scadenza: true, tan_0_15: 6.60, tan_15_30: 6.30, tan_oltre30: 6.00 },
        { durata:  60, provMax:  1.60, etaDa: 80, etaA: 84, scadenza: false, tan_0_15: 7.25, tan_15_30: 6.95, tan_oltre30: 6.65 },
        { durata:  48, provMax:  1.60, etaDa: 80, etaA: 84, scadenza: false, tan_0_15: 7.25, tan_15_30: 6.95, tan_oltre30: 6.65 },
        { durata:  60, provMax: 11.20, etaMin: 85, tan_0_15: 6.60, tan_15_30: 6.30, tan_oltre30: 6.00 },
        { durata:  48, provMax: 11.20, etaMin: 85, tan_0_15: 6.60, tan_15_30: 6.30, tan_oltre30: 6.00 },
      ],
    }
  },

  // ══════════════════════════════════════════════════════════
  // CANALE OPEN — PROMO (OPM)
  // ══════════════════════════════════════════════════════════
  OPM: {
    label: "Open Promo",
    codice: "OPM",
    colore: "#2563EB",
    tabelle: {
      STATALI_PUBBLICI: [
        { durata: 120, provMax: 5.00, tan_0_15: 4.00, tan_15_30: 3.80, tan_oltre30: 3.65, tan_deleghe: 4.10 },
        { durata: 108, provMax: 5.00, tan_0_15: 4.20, tan_15_30: 4.00, tan_oltre30: 3.85, tan_deleghe: 4.30 },
        { durata:  96, provMax: 5.00, tan_0_15: 4.20, tan_15_30: 4.00, tan_oltre30: 3.85, tan_deleghe: 4.30 },
        { durata:  84, provMax: 5.00, tan_0_15: 4.20, tan_15_30: 4.00, tan_oltre30: 3.85, tan_deleghe: 4.30 },
        { durata:  72, provMax: 5.00, tan_0_15: 4.20, tan_15_30: 4.00, tan_oltre30: 3.85, tan_deleghe: 4.30 },
        { durata:  60, provMax: 1.60, etaMax: 54, tan_0_15: 4.90, tan_15_30: 4.70, tan_oltre30: 4.55, tan_deleghe: 5.00 },
        { durata:  48, provMax: 1.60, etaMax: 54, tan_0_15: 4.90, tan_15_30: 4.70, tan_oltre30: 4.55, tan_deleghe: 5.00 },
        { durata:  60, provMax: 5.00, etaMin: 55, tan_0_15: 4.90, tan_15_30: 4.70, tan_oltre30: 4.55, tan_deleghe: 5.00 },
        { durata:  48, provMax: 5.00, etaMin: 55, tan_0_15: 4.90, tan_15_30: 4.70, tan_oltre30: 4.55, tan_deleghe: 5.00 },
      ],
      PARAPUBBLICI: [
        { durata: 120, provMax: 5.00, tan_0_15: 4.50, tan_15_30: 4.30, tan_oltre30: 4.15, tan_deleghe: 4.60 },
        { durata: 108, provMax: 5.00, tan_0_15: 4.70, tan_15_30: 4.50, tan_oltre30: 4.35, tan_deleghe: 4.80 },
        { durata:  96, provMax: 5.00, tan_0_15: 4.70, tan_15_30: 4.50, tan_oltre30: 4.35, tan_deleghe: 4.80 },
        { durata:  84, provMax: 5.00, tan_0_15: 4.70, tan_15_30: 4.50, tan_oltre30: 4.35, tan_deleghe: 4.80 },
        { durata:  72, provMax: 5.00, tan_0_15: 4.70, tan_15_30: 4.50, tan_oltre30: 4.35, tan_deleghe: 4.80 },
        { durata:  60, provMax: 1.60, etaMax: 54, tan_0_15: 5.40, tan_15_30: 5.20, tan_oltre30: 5.05, tan_deleghe: 5.50 },
        { durata:  48, provMax: 1.60, etaMax: 54, tan_0_15: 5.40, tan_15_30: 5.20, tan_oltre30: 5.05, tan_deleghe: 5.50 },
        { durata:  60, provMax: 5.00, etaMin: 55, tan_0_15: 5.40, tan_15_30: 5.20, tan_oltre30: 5.05, tan_deleghe: 5.50 },
        { durata:  48, provMax: 5.00, etaMin: 55, tan_0_15: 5.40, tan_15_30: 5.20, tan_oltre30: 5.05, tan_deleghe: 5.50 },
      ],
      PRIVATI: [
        { durata: 120, provMax: 5.00, tan_0_15: 5.30, tan_15_30: 5.00, tan_oltre30: 4.70, tan_deleghe: 5.60 },
        { durata: 108, provMax: 5.00, tan_0_15: 5.50, tan_15_30: 5.20, tan_oltre30: 4.90, tan_deleghe: 5.80 },
        { durata:  96, provMax: 5.00, tan_0_15: 5.50, tan_15_30: 5.20, tan_oltre30: 4.90, tan_deleghe: 5.80 },
        { durata:  84, provMax: 5.00, tan_0_15: 5.50, tan_15_30: 5.20, tan_oltre30: 4.90, tan_deleghe: 5.80 },
        { durata:  72, provMax: 5.00, tan_0_15: 5.50, tan_15_30: 5.20, tan_oltre30: 4.90, tan_deleghe: 5.80 },
        { durata:  60, provMax: 1.60, etaMax: 54, tan_0_15: 6.20, tan_15_30: 5.90, tan_oltre30: 5.60, tan_deleghe: 6.50 },
        { durata:  48, provMax: 1.60, etaMax: 54, tan_0_15: 6.20, tan_15_30: 5.90, tan_oltre30: 5.60, tan_deleghe: 6.50 },
        { durata:  60, provMax: 5.00, etaMin: 55, tan_0_15: 6.20, tan_15_30: 5.90, tan_oltre30: 5.60, tan_deleghe: 6.50 },
        { durata:  48, provMax: 5.00, etaMin: 55, tan_0_15: 6.20, tan_15_30: 5.90, tan_oltre30: 5.60, tan_deleghe: 6.50 },
      ],
      PENSIONATI: [
        { durata: 120, provMax: 5.00, etaMax: 79, scadenza: true,  tan_0_15: 5.50, tan_15_30: 5.20, tan_oltre30: 4.90 },
        { durata: 108, provMax: 5.00, etaMax: 79, scadenza: true,  tan_0_15: 5.70, tan_15_30: 5.40, tan_oltre30: 5.10 },
        { durata:  96, provMax: 5.00, etaMax: 79, scadenza: true,  tan_0_15: 5.70, tan_15_30: 5.40, tan_oltre30: 5.10 },
        { durata:  84, provMax: 5.00, etaMax: 79, scadenza: true,  tan_0_15: 5.70, tan_15_30: 5.40, tan_oltre30: 5.10 },
        { durata:  72, provMax: 5.00, etaMax: 79, scadenza: true,  tan_0_15: 5.70, tan_15_30: 5.40, tan_oltre30: 5.10 },
        { durata:  60, provMax: 1.60, etaMax: 79, scadenza: true,  tan_0_15: 6.35, tan_15_30: 6.05, tan_oltre30: 5.75 },
        { durata:  48, provMax: 1.60, etaMax: 79, scadenza: true,  tan_0_15: 6.35, tan_15_30: 6.05, tan_oltre30: 5.75 },
        { durata: 120, provMax: 5.00, etaDa: 80, scadenza: true,  tan_0_15: 5.80, tan_15_30: 5.50, tan_oltre30: 5.20 },
        { durata: 108, provMax: 5.00, etaDa: 80, scadenza: true,  tan_0_15: 6.00, tan_15_30: 5.70, tan_oltre30: 5.40 },
        { durata:  96, provMax: 5.00, etaDa: 80, scadenza: true,  tan_0_15: 6.00, tan_15_30: 5.70, tan_oltre30: 5.40 },
        { durata:  60, provMax: 1.60, etaDa: 80, etaA: 84, scadenza: false, tan_0_15: 6.65, tan_15_30: 6.35, tan_oltre30: 6.05 },
        { durata:  48, provMax: 1.60, etaDa: 80, etaA: 84, scadenza: false, tan_0_15: 6.65, tan_15_30: 6.35, tan_oltre30: 6.05 },
        { durata:  60, provMax: 5.00, etaMin: 85, tan_0_15: 6.00, tan_15_30: 5.70, tan_oltre30: 5.40 },
        { durata:  48, provMax: 5.00, etaMin: 85, tan_0_15: 6.00, tan_15_30: 5.70, tan_oltre30: 5.40 },
      ],
    }
  },

  // ══════════════════════════════════════════════════════════
  // CANALE CAPTIVE — STANDARD (CPT)
  // ══════════════════════════════════════════════════════════
  CPT: {
    label: "Captive Standard",
    codice: "CPT",
    colore: "#7C3AED",
    tabelle: {
      STATALI_PUBBLICI: [
        { durata: 120, provMax: 14.28, tan_0_15: 4.30, tan_15_30: 4.10, tan_oltre30: 3.95, tan_deleghe: 4.40 },
        { durata: 108, provMax: 14.28, tan_0_15: 4.50, tan_15_30: 4.40, tan_oltre30: 4.15, tan_deleghe: 4.60 },
        { durata:  96, provMax: 14.28, tan_0_15: 4.50, tan_15_30: 4.40, tan_oltre30: 4.15, tan_deleghe: 4.60 },
        { durata:  84, provMax: 14.28, tan_0_15: 4.50, tan_15_30: 4.40, tan_oltre30: 4.15, tan_deleghe: 4.60 },
        { durata:  72, provMax: 14.28, tan_0_15: 4.50, tan_15_30: 4.40, tan_oltre30: 4.15, tan_deleghe: 4.60 },
        { durata:  60, provMax:  2.86, etaMax: 54, tan_0_15: 5.20, tan_15_30: 5.10, tan_oltre30: 4.85, tan_deleghe: 5.30 },
        { durata:  48, provMax:  2.86, etaMax: 54, tan_0_15: 5.20, tan_15_30: 5.10, tan_oltre30: 4.85, tan_deleghe: 5.30 },
        { durata:  60, provMax: 10.00, etaMin: 55, tan_0_15: 5.20, tan_15_30: 5.10, tan_oltre30: 4.85, tan_deleghe: 5.30 },
        { durata:  48, provMax: 10.00, etaMin: 55, tan_0_15: 5.20, tan_15_30: 5.10, tan_oltre30: 4.85, tan_deleghe: 5.30 },
      ],
      PRIVATI: [
        { durata: 120, provMax: 14.28, tan_0_15: 6.10, tan_15_30: 5.80, tan_oltre30: 5.50, tan_deleghe: 6.40 },
        { durata: 108, provMax: 14.28, tan_0_15: 6.30, tan_15_30: 6.00, tan_oltre30: 5.70, tan_deleghe: 6.60 },
        { durata:  96, provMax: 14.28, tan_0_15: 6.30, tan_15_30: 6.00, tan_oltre30: 5.70, tan_deleghe: 6.60 },
        { durata:  84, provMax: 14.28, tan_0_15: 6.30, tan_15_30: 6.00, tan_oltre30: 5.70, tan_deleghe: 6.60 },
        { durata:  72, provMax: 14.28, tan_0_15: 6.30, tan_15_30: 6.00, tan_oltre30: 5.70, tan_deleghe: 6.60 },
        { durata:  60, provMax:  2.86, etaMax: 54, tan_0_15: 7.00, tan_15_30: 6.70, tan_oltre30: 6.40, tan_deleghe: 7.30 },
        { durata:  48, provMax:  2.86, etaMax: 54, tan_0_15: 7.00, tan_15_30: 6.70, tan_oltre30: 6.40, tan_deleghe: 7.30 },
        { durata:  60, provMax: 10.00, etaMin: 55, tan_0_15: 7.00, tan_15_30: 6.70, tan_oltre30: 6.40, tan_deleghe: 7.30 },
        { durata:  48, provMax: 10.00, etaMin: 55, tan_0_15: 7.00, tan_15_30: 6.70, tan_oltre30: 6.40, tan_deleghe: 7.30 },
      ],
      PARAPUBBLICI: [
        { durata: 120, provMax: 14.28, tan_0_15: 4.80, tan_15_30: 4.60, tan_oltre30: 4.45, tan_deleghe: 4.90 },
        { durata: 108, provMax: 14.28, tan_0_15: 5.00, tan_15_30: 4.90, tan_oltre30: 4.65, tan_deleghe: 5.10 },
        { durata:  96, provMax: 14.28, tan_0_15: 5.00, tan_15_30: 4.90, tan_oltre30: 4.65, tan_deleghe: 5.10 },
        { durata:  84, provMax: 14.28, tan_0_15: 5.00, tan_15_30: 4.90, tan_oltre30: 4.65, tan_deleghe: 5.10 },
        { durata:  72, provMax: 14.28, tan_0_15: 5.00, tan_15_30: 4.90, tan_oltre30: 4.65, tan_deleghe: 5.10 },
        { durata:  60, provMax:  2.86, etaMax: 54, tan_0_15: 5.70, tan_15_30: 5.60, tan_oltre30: 5.35, tan_deleghe: 5.80 },
        { durata:  48, provMax:  2.86, etaMax: 54, tan_0_15: 5.70, tan_15_30: 5.60, tan_oltre30: 5.35, tan_deleghe: 5.80 },
        { durata:  60, provMax: 10.00, etaMin: 55, tan_0_15: 5.70, tan_15_30: 5.60, tan_oltre30: 5.35, tan_deleghe: 5.80 },
        { durata:  48, provMax: 10.00, etaMin: 55, tan_0_15: 5.70, tan_15_30: 5.60, tan_oltre30: 5.35, tan_deleghe: 5.80 },
      ],
    }
  },

  // ══════════════════════════════════════════════════════════
  // CANALE CAPTIVE — TOP (CTT)
  // ══════════════════════════════════════════════════════════
  CTT: {
    label: "Captive Top",
    codice: "CTT",
    colore: "#059669",
    tabelle: {
      STATALI_PUBBLICI: [
        { durata: 120, provMax: 14.28, tan_0_15: 4.60, tan_15_30: 4.40, tan_oltre30: 4.25, tan_deleghe: 4.70 },
        { durata: 108, provMax: 14.28, tan_0_15: 4.80, tan_15_30: 4.70, tan_oltre30: 4.45, tan_deleghe: 4.90 },
        { durata:  96, provMax: 14.28, tan_0_15: 4.80, tan_15_30: 4.70, tan_oltre30: 4.45, tan_deleghe: 4.90 },
        { durata:  84, provMax: 14.28, tan_0_15: 4.80, tan_15_30: 4.70, tan_oltre30: 4.45, tan_deleghe: 4.90 },
        { durata:  72, provMax: 14.28, tan_0_15: 4.80, tan_15_30: 4.70, tan_oltre30: 4.45, tan_deleghe: 4.90 },
        { durata:  60, provMax:  2.86, etaMax: 54, tan_0_15: 5.50, tan_15_30: 5.40, tan_oltre30: 5.15, tan_deleghe: 5.60 },
        { durata:  48, provMax:  2.86, etaMax: 54, tan_0_15: 5.50, tan_15_30: 5.40, tan_oltre30: 5.15, tan_deleghe: 5.60 },
        { durata:  60, provMax: 10.00, etaMin: 55, tan_0_15: 5.50, tan_15_30: 5.40, tan_oltre30: 5.15, tan_deleghe: 5.60 },
        { durata:  48, provMax: 10.00, etaMin: 55, tan_0_15: 5.50, tan_15_30: 5.40, tan_oltre30: 5.15, tan_deleghe: 5.60 },
      ],
      PRIVATI: [
        { durata: 120, provMax: 14.28, tan_0_15: 6.40, tan_15_30: 6.10, tan_oltre30: 5.80, tan_deleghe: 6.70 },
        { durata: 108, provMax: 14.28, tan_0_15: 6.60, tan_15_30: 6.30, tan_oltre30: 6.00, tan_deleghe: 6.90 },
        { durata:  96, provMax: 14.28, tan_0_15: 6.60, tan_15_30: 6.30, tan_oltre30: 6.00, tan_deleghe: 6.90 },
        { durata:  84, provMax: 14.28, tan_0_15: 6.60, tan_15_30: 6.30, tan_oltre30: 6.00, tan_deleghe: 6.90 },
        { durata:  72, provMax: 14.28, tan_0_15: 6.60, tan_15_30: 6.30, tan_oltre30: 6.00, tan_deleghe: 6.90 },
        { durata:  60, provMax:  2.86, etaMax: 54, tan_0_15: 7.30, tan_15_30: 7.00, tan_oltre30: 6.70, tan_deleghe: 7.60 },
        { durata:  48, provMax:  2.86, etaMax: 54, tan_0_15: 7.30, tan_15_30: 7.00, tan_oltre30: 6.70, tan_deleghe: 7.60 },
        { durata:  60, provMax: 10.00, etaMin: 55, tan_0_15: 7.30, tan_15_30: 7.00, tan_oltre30: 6.70, tan_deleghe: 7.60 },
        { durata:  48, provMax: 10.00, etaMin: 55, tan_0_15: 7.30, tan_15_30: 7.00, tan_oltre30: 6.70, tan_deleghe: 7.60 },
      ],
      PARAPUBBLICI: [
        { durata: 120, provMax: 14.28, tan_0_15: 5.10, tan_15_30: 4.90, tan_oltre30: 4.75, tan_deleghe: 5.20 },
        { durata: 108, provMax: 14.28, tan_0_15: 5.30, tan_15_30: 5.20, tan_oltre30: 4.95, tan_deleghe: 5.40 },
        { durata:  96, provMax: 14.28, tan_0_15: 5.30, tan_15_30: 5.20, tan_oltre30: 4.95, tan_deleghe: 5.40 },
        { durata:  84, provMax: 14.28, tan_0_15: 5.30, tan_15_30: 5.20, tan_oltre30: 4.95, tan_deleghe: 5.40 },
        { durata:  72, provMax: 14.28, tan_0_15: 5.30, tan_15_30: 5.20, tan_oltre30: 4.95, tan_deleghe: 5.40 },
        { durata:  60, provMax:  2.86, etaMax: 54, tan_0_15: 6.00, tan_15_30: 5.90, tan_oltre30: 5.65, tan_deleghe: 6.10 },
        { durata:  48, provMax:  2.86, etaMax: 54, tan_0_15: 6.00, tan_15_30: 5.90, tan_oltre30: 5.65, tan_deleghe: 6.10 },
        { durata:  60, provMax: 10.00, etaMin: 55, tan_0_15: 6.00, tan_15_30: 5.90, tan_oltre30: 5.65, tan_deleghe: 6.10 },
        { durata:  48, provMax: 10.00, etaMin: 55, tan_0_15: 6.00, tan_15_30: 5.90, tan_oltre30: 5.65, tan_deleghe: 6.10 },
      ],
    }
  },

  // ══════════════════════════════════════════════════════════
  // CANALE CAPTIVE — BENE COMUNE (CBC)
  // ══════════════════════════════════════════════════════════
  CBC: {
    label: "Captive Bene Comune",
    codice: "CBC",
    colore: "#D97706",
    tabelle: {
      STATALI_PUBBLICI: [
        { durata: 120, provMax: 14.28, tan_0_15: 4.00, tan_15_30: 3.80, tan_oltre30: 3.65, tan_deleghe: 4.10 },
        { durata: 108, provMax: 14.28, tan_0_15: 4.20, tan_15_30: 4.10, tan_oltre30: 3.85, tan_deleghe: 4.30 },
        { durata:  96, provMax: 14.28, tan_0_15: 4.20, tan_15_30: 4.10, tan_oltre30: 3.85, tan_deleghe: 4.30 },
        { durata:  84, provMax: 14.28, tan_0_15: 4.20, tan_15_30: 4.10, tan_oltre30: 3.85, tan_deleghe: 4.30 },
        { durata:  72, provMax: 14.28, tan_0_15: 4.20, tan_15_30: 4.10, tan_oltre30: 3.85, tan_deleghe: 4.30 },
        { durata:  60, provMax:  2.86, etaMax: 54, tan_0_15: 4.90, tan_15_30: 4.80, tan_oltre30: 4.55, tan_deleghe: 5.00 },
        { durata:  48, provMax:  2.86, etaMax: 54, tan_0_15: 4.90, tan_15_30: 4.80, tan_oltre30: 4.55, tan_deleghe: 5.00 },
        { durata:  60, provMax: 10.00, etaMin: 55, tan_0_15: 4.90, tan_15_30: 4.80, tan_oltre30: 4.55, tan_deleghe: 5.00 },
        { durata:  48, provMax: 10.00, etaMin: 55, tan_0_15: 4.90, tan_15_30: 4.80, tan_oltre30: 4.55, tan_deleghe: 5.00 },
      ],
      PRIVATI: [
        { durata: 120, provMax: 14.28, tan_0_15: 5.80, tan_15_30: 5.50, tan_oltre30: 5.20, tan_deleghe: 6.10 },
        { durata: 108, provMax: 14.28, tan_0_15: 6.00, tan_15_30: 5.70, tan_oltre30: 5.40, tan_deleghe: 6.30 },
        { durata:  96, provMax: 14.28, tan_0_15: 6.00, tan_15_30: 5.70, tan_oltre30: 5.40, tan_deleghe: 6.30 },
        { durata:  84, provMax: 14.28, tan_0_15: 6.00, tan_15_30: 5.70, tan_oltre30: 5.40, tan_deleghe: 6.30 },
        { durata:  72, provMax: 14.28, tan_0_15: 6.00, tan_15_30: 5.70, tan_oltre30: 5.40, tan_deleghe: 6.30 },
        { durata:  60, provMax:  2.86, etaMax: 54, tan_0_15: 6.70, tan_15_30: 6.40, tan_oltre30: 6.10, tan_deleghe: 7.00 },
        { durata:  48, provMax:  2.86, etaMax: 54, tan_0_15: 6.70, tan_15_30: 6.40, tan_oltre30: 6.10, tan_deleghe: 7.00 },
        { durata:  60, provMax: 10.00, etaMin: 55, tan_0_15: 6.70, tan_15_30: 6.40, tan_oltre30: 6.10, tan_deleghe: 7.00 },
        { durata:  48, provMax: 10.00, etaMin: 55, tan_0_15: 6.70, tan_15_30: 6.40, tan_oltre30: 6.10, tan_deleghe: 7.00 },
      ],
      PARAPUBBLICI: [
        { durata: 120, provMax: 14.28, tan_0_15: 4.50, tan_15_30: 4.30, tan_oltre30: 4.15, tan_deleghe: 4.60 },
        { durata: 108, provMax: 14.28, tan_0_15: 4.70, tan_15_30: 4.60, tan_oltre30: 4.35, tan_deleghe: 4.80 },
        { durata:  96, provMax: 14.28, tan_0_15: 4.70, tan_15_30: 4.60, tan_oltre30: 4.35, tan_deleghe: 4.80 },
        { durata:  84, provMax: 14.28, tan_0_15: 4.70, tan_15_30: 4.60, tan_oltre30: 4.35, tan_deleghe: 4.80 },
        { durata:  72, provMax: 14.28, tan_0_15: 4.70, tan_15_30: 4.60, tan_oltre30: 4.35, tan_deleghe: 4.80 },
        { durata:  60, provMax:  2.86, etaMax: 54, tan_0_15: 5.40, tan_15_30: 5.30, tan_oltre30: 5.05, tan_deleghe: 5.50 },
        { durata:  48, provMax:  2.86, etaMax: 54, tan_0_15: 5.40, tan_15_30: 5.30, tan_oltre30: 5.05, tan_deleghe: 5.50 },
        { durata:  60, provMax: 10.00, etaMin: 55, tan_0_15: 5.40, tan_15_30: 5.30, tan_oltre30: 5.05, tan_deleghe: 5.50 },
        { durata:  48, provMax: 10.00, etaMin: 55, tan_0_15: 5.40, tan_15_30: 5.30, tan_oltre30: 5.05, tan_deleghe: 5.50 },
      ],
    }
  },

  // ══════════════════════════════════════════════════════════
  // DIGITAL CQ OPEN
  // ══════════════════════════════════════════════════════════
  DIGITAL: {
    label: "Digital CQ Open",
    codice: "DIGITAL",
    colore: "#0891B2",
    nota: "Massima offerta per Tabelle Digital",
    tabelle: {
      STATALI_PUBBLICI: [
        { durata: 120, tan_max: 6.50, spread_max: 1.50 },
        { durata: 108, tan_max: 6.55, spread_max: 1.50 },
        { durata:  96, tan_max: 6.60, spread_max: 1.50 },
        { durata:  84, tan_max: 6.70, spread_max: 1.50 },
        { durata:  72, tan_max: 6.80, spread_max: 1.50 },
        { durata:  60, tan_max: 7.40, spread_max: 1.50 },
        { durata:  48, tan_max: 7.40, spread_max: 1.50 },
      ],
      PRIVATI: [
        { durata: 120, tan_max: 6.65, spread_max: 1.50 },
        { durata: 108, tan_max: 6.70, spread_max: 1.50 },
        { durata:  96, tan_max: 6.75, spread_max: 1.50 },
        { durata:  84, tan_max: 6.85, spread_max: 1.50 },
        { durata:  72, tan_max: 6.95, spread_max: 1.50 },
        { durata:  60, tan_max: 7.55, spread_max: 1.50 },
        { durata:  48, tan_max: 7.55, spread_max: 1.50 },
      ],
      PARAPUBBLICI: [
        { durata: 120, tan_max: 6.90, spread_max: 1.50 },
        { durata: 108, tan_max: 6.95, spread_max: 1.50 },
        { durata:  96, tan_max: 7.00, spread_max: 1.50 },
        { durata:  84, tan_max: 7.10, spread_max: 1.50 },
        { durata:  72, tan_max: 7.20, spread_max: 1.50 },
        { durata:  60, tan_max: 7.80, spread_max: 1.50 },
        { durata:  48, tan_max: 7.80, spread_max: 1.50 },
      ],
      PENSIONATI: [
        { durata: 120, tan_max: 6.95, spread_max: 1.50 },
        { durata: 108, tan_max: 7.00, spread_max: 1.50 },
        { durata:  96, tan_max: 7.05, spread_max: 1.50 },
        { durata:  84, tan_max: 7.00, spread_max: 1.50 },
        { durata:  72, tan_max: 7.15, spread_max: 1.50 },
        { durata:  60, tan_max: 7.85, spread_max: 1.50 },
        { durata:  48, tan_max: 7.85, spread_max: 1.50 },
      ],
    }
  },

  // ══════════════════════════════════════════════════════════
  // FACILE.IT CQ OPEN (DFL)
  // ══════════════════════════════════════════════════════════
  FACILE_IT: {
    label: "Facile.it CQ Open",
    codice: "FACILE_IT",
    colore: "#DC2626",
    nota: "Massima base provvigionale applicabile 16%",
    tabelle: {
      STATALI_PUBBLICI: [
        { durata: 120, provMax: 16.00, tan_base: 4.90 },
        { durata: 108, provMax: 16.00, tan_base: 4.95 },
        { durata:  96, provMax: 16.00, tan_base: 5.00 },
        { durata:  84, provMax: 16.00, tan_base: 5.10 },
        { durata:  72, provMax: 16.00, tan_base: 5.20 },
        { durata:  60, provMax: 16.00, tan_base: 5.80 },
        { durata:  48, provMax: 16.00, tan_base: 5.80 },
      ],
      PRIVATI: [
        { durata: 120, provMax: 16.00, tan_base: 4.70 },
        { durata: 108, provMax: 16.00, tan_base: 4.75 },
        { durata:  96, provMax: 16.00, tan_base: 4.80 },
        { durata:  84, provMax: 16.00, tan_base: 4.90 },
        { durata:  72, provMax: 16.00, tan_base: 5.00 },
        { durata:  60, provMax: 16.00, tan_base: 5.60 },
        { durata:  48, provMax: 16.00, tan_base: 5.60 },
      ],
      PARAPUBBLICI: [
        { durata: 120, provMax: 16.00, tan_base: 4.90 },
        { durata: 108, provMax: 16.00, tan_base: 4.95 },
        { durata:  96, provMax: 16.00, tan_base: 5.00 },
        { durata:  84, provMax: 16.00, tan_base: 5.10 },
        { durata:  72, provMax: 16.00, tan_base: 5.20 },
        { durata:  60, provMax: 16.00, tan_base: 5.80 },
        { durata:  48, provMax: 16.00, tan_base: 5.80 },
      ],
      PENSIONATI: [
        { durata: 120, provMax: 11.20, tan_base: 7.95 },
        { durata: 108, provMax: 11.20, tan_base: 8.00 },
        { durata:  96, provMax: 11.20, tan_base: 8.05 },
        { durata:  84, provMax: 11.20, tan_base: 8.15 },
        { durata:  72, provMax: 11.20, tan_base: 8.25 },
        { durata:  60, provMax: 11.20, tan_base: 8.85 },
        { durata:  48, provMax: 11.20, tan_base: 8.85 },
      ],
    }
  },

};

// ══════════════════════════════════════════════════════════
// HELPER — Trova la riga tariffaria corretta
// ══════════════════════════════════════════════════════════
export function getTariffaBibanca(canale, categoria, durata, eta, importo) {
  const cat = BIBANCA_CATALOGO[canale];
  if (!cat) return null;
  const tabella = cat.tabelle[categoria];
  if (!tabella) return null;

  // Filtra per durata
  let righe = tabella.filter(r => r.durata === durata);

  // Filtra per età se prevista
  righe = righe.filter(r => {
    if (r.etaMax && eta > r.etaMax) return false;
    if (r.etaMin && eta < r.etaMin) return false;
    if (r.etaDa && eta < r.etaDa) return false;
    if (r.etaA && eta > r.etaA) return false;
    return true;
  });

  if (!righe.length) return null;
  const riga = righe[0];

  // Seleziona TAN in base all'importo
  let tan = riga.tan_base || riga.tan_0_15;
  if (importo > 15000 && importo <= 30000) tan = riga.tan_15_30 || tan;
  if (importo > 30000) tan = riga.tan_oltre30 || tan;

  return { ...riga, tan_applicato: tan, canale: cat.label, codice: cat.codice, colore: cat.colore };
}

// ══════════════════════════════════════════════════════════
// HELPER — Confronto tutti i canali per trovare il migliore
// ══════════════════════════════════════════════════════════
export function confrontaCanali(categoria, durata, eta, importo) {
  const canali = Object.keys(BIBANCA_CATALOGO);
  const risultati = [];
  for (const canale of canali) {
    const tariffa = getTariffaBibanca(canale, categoria, durata, eta, importo);
    if (tariffa) risultati.push(tariffa);
  }
  // Ordina per TAN crescente (migliore per il cliente = TAN più basso)
  return risultati.sort((a, b) => a.tan_applicato - b.tan_applicato);
}

// ══════════════════════════════════════════════════════════
// HELPER — Calcolo rata mensile (formula ammortamento francese)
// ══════════════════════════════════════════════════════════
export function calcolaRata(importo, tanAnnuo, durataRateAll) {
  if (!importo || !tanAnnuo || !durataRateAll) return 0;
  const r = tanAnnuo / 100 / 12;
  if (r === 0) return importo / durataRateAll;
  return importo * r * Math.pow(1 + r, durataRateAll) / (Math.pow(1 + r, durataRateAll) - 1);
}

// ══════════════════════════════════════════════════════════
// MAPPING categorie CRM → categorie Bibanca
// ══════════════════════════════════════════════════════════
export const CATEGORIA_MAP = {
  "dipendente_pubblico":   "STATALI_PUBBLICI",
  "statale":               "STATALI_PUBBLICI",
  "forze_ordine":          "STATALI_PUBBLICI",
  "pensionato_inps":       "PENSIONATI",
  "pensionato":            "PENSIONATI",
  "dipendente_privato":    "PRIVATI",
  "privato":               "PRIVATI",
  "parapubblico":          "PARAPUBBLICI",
  "ente_locale":           "PARAPUBBLICI",
};

export const DURATE_DISPONIBILI = [48, 60, 72, 84, 96, 108, 120];
