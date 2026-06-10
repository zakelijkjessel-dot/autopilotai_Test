/**
 * Dienstencatalogus — duur in minuten, prijs excl. BTW in euro's
 * Wordt gebruikt door Claude als leidraad voor schattingen + upselling.
 */
const SERVICES = {
  apk: {
    name: 'APK Keuring',
    durationMin: 45,
    durationMax: 60,
    priceMin: 45,
    priceMax: 55,
    upsell: 'kleine_beurt',
    upsellMessage:
      'Zolang de auto toch op de brug staat, kunnen we gelijk de olie en filters verversen. ' +
      'Scheelt een aparte rit en je rijdt met een gerust hart weg.',
  },
  kleine_beurt: {
    name: 'Kleine Beurt',
    durationMin: 60,
    durationMax: 90,
    priceMin: 75,
    priceMax: 120,
    upsell: null,
    upsellMessage: null,
  },
  grote_beurt: {
    name: 'Grote Beurt',
    durationMin: 120,
    durationMax: 180,
    priceMin: 150,
    priceMax: 250,
    upsell: null,
    upsellMessage: null,
  },
  remmen: {
    name: 'Remmen',
    durationMin: 60,
    durationMax: 90,
    priceMin: 80,
    priceMax: 150,
    upsell: null,
    upsellMessage: null,
  },
  banden: {
    name: 'Banden Wisselen',
    durationMin: 30,
    durationMax: 45,
    priceMin: 40,
    priceMax: 60,
    upsell: 'uitlijnen',
    upsellMessage:
      'Wil je ze ook gelijk laten uitlijnen en balanceren? ' +
      'Dat spaart bandenslijtage en je auto trekt dan niet naar één kant.',
  },
  airco: {
    name: 'Airco Service',
    durationMin: 45,
    durationMax: 60,
    priceMin: 65,
    priceMax: 85,
    upsell: null,
    upsellMessage: null,
  },
  diagnose: {
    name: 'Diagnose / Storing',
    durationMin: 30,
    durationMax: 60,
    priceMin: 45,
    priceMax: 65,
    upsell: null,
    upsellMessage: null,
  },
  schade: {
    name: 'Schadeherstel',
    durationMin: 60,
    durationMax: 240,
    priceMin: 100,
    priceMax: 500,
    upsell: null,
    upsellMessage: null,
  },
  uitlijnen: {
    name: 'Uitlijnen & Balanceren',
    durationMin: 30,
    durationMax: 45,
    priceMin: 40,
    priceMax: 70,
    upsell: null,
    upsellMessage: null,
  },
  overig: {
    name: 'Overig / Nader te bepalen',
    durationMin: 30,
    durationMax: 120,
    priceMin: 45,
    priceMax: 200,
    upsell: null,
    upsellMessage: null,
  },
};

module.exports = { SERVICES };
