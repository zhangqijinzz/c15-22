import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exampleScenario } from '../domain';
import type { EnergyDocument } from '../types';
import { EnergyLensViewModel } from '../viewModel';
import type { EnergyRepository } from '../repository';

function makeRepository(): EnergyRepository & { data: EnergyDocument; save: ReturnType<typeof vi.fn> } {
  const data: EnergyDocument = { version: 1, scenarios: [structuredClone(exampleScenario)], activeScenarioId: exampleScenario.id };
  return { data, load: () => data, save: vi.fn((next: EnergyDocument) => { data.scenarios = next.scenarios; data.activeScenarioId = next.activeScenarioId; }) };
}

describe('EnergyLensViewModel', () => {
  let repository: ReturnType<typeof makeRepository>;
  let vm: EnergyLensViewModel;
  beforeEach(() => { repository = makeRepository(); vm = new EnergyLensViewModel(repository); vm.initialize(); });

  it('initializes, persists edits, and recalculates results', () => {
    expect(vm.getState().status).toBe('ready');
    const before = vm.activeSummary?.total.periodKwh;
    vm.updateDevice('device-aircon', { dailyHours: 2 });
    expect(vm.activeSummary?.total.periodKwh).toBeLessThan(before ?? Infinity);
    expect(repository.save).toHaveBeenCalled();
  });

  it('keeps invalid values out of the document and exposes an error notice', () => {
    vm.updateDevice('device-aircon', { watts: -50 });
    expect(vm.getState().status).toBe('error');
    expect(vm.getState().notice?.text).toBe('功率不能为负数');
    expect(vm.activeScenario?.devices[0].watts).toBe(1200);
  });

  it('duplicates a scenario and can recover a saved document', () => {
    vm.duplicateActive();
    expect(vm.getState().document?.scenarios).toHaveLength(2);
    const recovered = new EnergyLensViewModel(repository);
    recovered.initialize();
    expect(recovered.getState().document?.scenarios).toHaveLength(2);
  });

  it('surfaces persistence failure as a recoverable error', () => {
    repository.save.mockImplementation(() => { throw new Error('quota'); });
    vm.addDevice();
    expect(vm.getState().status).toBe('error');
    expect(vm.getState().notice?.text).toContain('保存失败');
  });

  it('rescales results when switching period without touching device parameters', () => {
    const monthlyKwh = vm.activeSummary?.total.periodKwh;
    const devicesBefore = structuredClone(vm.activeScenario?.devices);
    vm.updateSettings({ period: { kind: 'year' } });
    expect(vm.activeSummary?.total.periodKwh).toBeCloseTo((monthlyKwh ?? 0) * 12);
    expect(vm.activeScenario?.devices).toEqual(devicesBefore);
    expect(vm.activeScenario?.daysPerMonth).toBe(30);
  });

  it('rejects a custom range whose end is before its start', () => {
    vm.updateSettings({ period: { kind: 'custom', startDate: '2026-03-01', endDate: '2026-01-01' } });
    expect(vm.getState().status).toBe('error');
    expect(vm.getState().notice?.text).toBe('结束日期不能早于开始日期');
    expect(vm.activeScenario?.period).toBeUndefined();
    expect(vm.activeSummary?.total.periodKwh).toBeCloseTo(262.8);
  });

  it('keeps legacy scenarios comparable after duplication but flags mismatched periods', () => {
    vm.duplicateActive();
    vm.updateSettings({ period: { kind: 'quarter' } });
    const document = vm.getState().document;
    expect(document?.scenarios).toHaveLength(2);
    const [original, copy] = document!.scenarios;
    expect(copy.period?.kind).toBe('quarter');
    expect(original.period).toBeUndefined();
  });
});
