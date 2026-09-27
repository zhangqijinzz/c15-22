// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { exampleScenario, summarizeScenario } from '../domain';
import { LocalEnergyRepository } from '../repository';

describe('local persistence recovery', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to a valid example when saved JSON is damaged', () => {
    localStorage.setItem('energy-lens.document.v1', JSON.stringify({ version: 1, scenarios: [null], activeScenarioId: 'missing' }));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.activeScenarioId).toBe(exampleScenario.id);
    expect(recovered.scenarios[0].devices.length).toBeGreaterThan(0);
  });

  it('loads a legacy scenario without cycle and keeps the original monthly result', () => {
    const legacy = { ...exampleScenario, id: 'legacy', name: '老方案' };
    delete (legacy as Record<string, unknown>).cycle;
    localStorage.setItem('energy-lens.document.v1', JSON.stringify({ version: 1, scenarios: [legacy], activeScenarioId: 'legacy' }));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.scenarios[0].cycle).toBeUndefined();
    const summary = summarizeScenario(recovered.scenarios[0]);
    expect(summary.cycle).toBe('month');
    expect(summary.total.periodKwh).toBe(summarizeScenario(exampleScenario).total.periodKwh);
  });

  it('round-trips scenarios with a billing cycle and custom range', () => {
    const modern = { ...exampleScenario, id: 'modern', cycle: 'custom' as const, customRange: { start: '2026-01-01', end: '2026-03-31' } };
    localStorage.setItem('energy-lens.document.v1', JSON.stringify({ version: 1, scenarios: [modern], activeScenarioId: 'modern' }));
    const recovered = new LocalEnergyRepository().load();
    expect(recovered.scenarios[0].cycle).toBe('custom');
    expect(summarizeScenario(recovered.scenarios[0]).periodDays).toBe(90);
  });
});
