import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SENSITIVITIES,
  COMMUTES,
  HEATINGS,
  INDOOR_SETUPS,
  generateProfileRecommendations,
} from '../server/profileTaskCatalog.ts';

describe('Household Profile Task Catalog (144 combinations)', () => {
  it('defines 4 sensitivities x 4 commutes x 3 heatings x 3 indoor setups = 144 combinations', () => {
    const total =
      SENSITIVITIES.length * COMMUTES.length * HEATINGS.length * INDOOR_SETUPS.length;
    assert.equal(SENSITIVITIES.length, 4);
    assert.equal(COMMUTES.length, 4);
    assert.equal(HEATINGS.length, 3);
    assert.equal(INDOOR_SETUPS.length, 3);
    assert.equal(total, 144);
  });

  it('generates 9 valid, non-empty, quantified recommendations for all 144 combinations', () => {
    let combinationsChecked = 0;

    for (const sensitivity of SENSITIVITIES) {
      for (const commute of COMMUTES) {
        for (const heatingCooking of HEATINGS) {
          for (const indoorSetup of INDOOR_SETUPS) {
            combinationsChecked++;
            const recs = generateProfileRecommendations(
              { sensitivity, commute, heatingCooking, indoorSetup },
              'New Delhi',
              '13:00–15:00'
            );

            assert.equal(recs.length, 9);

            const categories = new Set(recs.map((r) => r.category));
            assert.ok(categories.has('routine'));
            assert.ok(categories.has('indoor_hack'));
            assert.ok(categories.has('sustainable_alternative'));

            const ids = new Set(recs.map((r) => r.id));
            assert.equal(ids.size, 9, 'Recommendation IDs must be unique within a profile');

            for (const rec of recs) {
              assert.ok(rec.title.trim().length > 5);
              assert.ok(rec.steps.length >= 2);
              assert.ok(rec.directHealthImpact.trim().length > 5);
              assert.ok(rec.directEmissionImpact.trim().length > 5);
              assert.ok(rec.scientificMechanism.trim().length > 5);
              assert.ok(rec.estimatedCo2KgSaved > 0);
              assert.ok(rec.estimatedExposureDropPct > 0 && rec.estimatedExposureDropPct <= 100);
            }
          }
        }
      }
    }

    assert.equal(combinationsChecked, 144);
  });

  it('interpolates city name and ventilation window into recommendations', () => {
    const recs = generateProfileRecommendations(
      {
        sensitivity: 'respiratory',
        commute: 'transit',
        heatingCooking: 'electric',
        indoorSetup: 'natural_ventilation',
      },
      'Kolkata',
      '14:00–16:00'
    );

    const combinedText = recs.map((r) => `${r.title} ${r.timeframe} ${r.steps.join(' ')}`).join(' ');
    assert.ok(combinedText.includes('Kolkata'));
    assert.ok(combinedText.includes('14:00–16:00'));
  });
});
