// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { exampleScenario } from '../domain';
import { LocalEnergyRepository } from '../repository';

describe('local persistence recovery', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to a valid example when saved JSON is damaged', () => {
    localStorage.setItem('energy-lens.document.v1', JSON.stringify({ version: 1, scenarios: [null], activeScenarioId: 'missing' }));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.activeScenarioId).toBe(exampleScenario.id);
    expect(recovered.scenarios[0].devices.length).toBeGreaterThan(0);
  });

  it('loads legacy scenarios without a period unchanged', () => {
    const legacy = { ...structuredClone(exampleScenario), name: '旧方案' };
    localStorage.setItem('energy-lens.document.v1', JSON.stringify({ version: 1, scenarios: [legacy], activeScenarioId: legacy.id }));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.scenarios[0].period).toBeUndefined();
    expect(recovered.scenarios[0].daysPerMonth).toBe(30);
  });

  it('keeps a valid billing period and rejects a malformed one', () => {
    const withPeriod = { ...structuredClone(exampleScenario), period: { kind: 'custom', startDate: '2026-01-01', endDate: '2026-03-31' } };
    localStorage.setItem('energy-lens.document.v1', JSON.stringify({ version: 1, scenarios: [withPeriod], activeScenarioId: withPeriod.id }));
    expect(new LocalEnergyRepository().load().scenarios[0].period).toEqual(withPeriod.period);

    const broken = { ...structuredClone(exampleScenario), period: { kind: 'custom' } };
    localStorage.setItem('energy-lens.document.v1', JSON.stringify({ version: 1, scenarios: [broken], activeScenarioId: broken.id }));
    expect(new LocalEnergyRepository().load().scenarios[0].id).toBe(exampleScenario.id);
  });
});
