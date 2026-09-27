import { describe, expect, it } from 'vitest';
import { customRangeDays, estimateDevice, periodDays, sameBillingBasis, summarizeScenario, validateDevice, validateScenarioSettings } from '../domain';
import type { EnergyScenario } from '../types';

const baseScenario: EnergyScenario = { id: 's', name: 'test', pricePerKwh: 1, daysPerMonth: 30, createdAt: '', devices: [
  { id: 'a', name: 'a', watts: 100, dailyHours: 1 }, { id: 'b', name: 'b', watts: 300, dailyHours: 1 },
] };

describe('energy domain', () => {
  it('calculates kWh and cost from watts, hours, days and price', () => {
    const result = estimateDevice({ id: 'a', name: '空调', watts: 1000, dailyHours: 2 }, 30, 0.5);
    expect(result).toEqual({ dailyKwh: 2, periodKwh: 60, periodCost: 30 });
  });

  it('keeps device shares explainable and sums to 100%', () => {
    const summary = summarizeScenario(baseScenario);
    expect(summary.total.periodKwh).toBe(12);
    expect(summary.devices.map((device) => device.share)).toEqual([0.25, 0.75]);
  });

  it('rejects negative power and more than 24 hours', () => {
    expect(validateDevice({ name: 'x', watts: -1, dailyHours: 1 })).toBe('功率不能为负数');
    expect(validateDevice({ name: 'x', watts: 1, dailyHours: 24.1 })).toBe('每日使用时间不能超过 24 小时');
  });
});

describe('billing cycle', () => {
  it('treats a scenario without cycle as monthly, preserving legacy results', () => {
    const summary = summarizeScenario(baseScenario);
    expect(summary.cycle).toBe('month');
    expect(summary.periodDays).toBe(30);
    expect(summary.total.periodKwh).toBe(12);
  });

  it('scales quarter and year from the monthly billing days', () => {
    expect(periodDays({ ...baseScenario, cycle: 'quarter' })).toBe(90);
    expect(periodDays({ ...baseScenario, cycle: 'year' })).toBe(360);
    const yearly = summarizeScenario({ ...baseScenario, cycle: 'year' });
    expect(yearly.total.periodKwh).toBe(144);
    expect(yearly.total.periodCost).toBe(144);
  });

  it('counts custom range days inclusively and validates order', () => {
    expect(customRangeDays({ start: '2026-01-01', end: '2026-01-31' })).toBe(31);
    expect(customRangeDays({ start: '2026-03-01', end: '2026-03-01' })).toBe(1);
    expect(customRangeDays({ start: '2026-02-01', end: '2026-01-01' })).toBeNaN();
    const custom = { ...baseScenario, cycle: 'custom' as const, customRange: { start: '2026-01-01', end: '2026-01-10' } };
    expect(summarizeScenario(custom).total.periodKwh).toBe(4);
    expect(validateScenarioSettings({ ...custom, customRange: { start: '2026-02-01', end: '2026-01-01' } })).toBe('自定义区间的结束日期不能早于开始日期');
  });

  it('only compares scenarios on the same billing basis', () => {
    const monthly = { ...baseScenario };
    const quarterly = { ...baseScenario, cycle: 'quarter' as const };
    expect(sameBillingBasis(monthly, { ...baseScenario, id: 'other', daysPerMonth: 31 })).toBe(true);
    expect(sameBillingBasis(monthly, quarterly)).toBe(false);
    const rangeA = { ...baseScenario, cycle: 'custom' as const, customRange: { start: '2026-01-01', end: '2026-01-31' } };
    const rangeB = { ...rangeA, id: 'other', customRange: { start: '2026-02-01', end: '2026-02-28' } };
    expect(sameBillingBasis(rangeA, { ...rangeA, id: 'other' })).toBe(true);
    expect(sameBillingBasis(rangeA, rangeB)).toBe(false);
  });
});
