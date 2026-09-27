import { describe, expect, it } from 'vitest';
import { compareScenarios, customPeriodDays, estimateDevice, resolvePeriod, summarizeScenario, validateDevice, validatePeriod } from '../domain';
import type { EnergyScenario } from '../types';

const baseScenario: EnergyScenario = {
  id: 's', name: 'test', pricePerKwh: 1, daysPerMonth: 30, createdAt: '',
  devices: [
    { id: 'a', name: 'a', watts: 100, dailyHours: 1 },
    { id: 'b', name: 'b', watts: 300, dailyHours: 1 },
  ],
};

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

describe('billing period resolution', () => {
  it('treats a scenario without period as the legacy monthly mode', () => {
    const period = resolvePeriod({ daysPerMonth: 30 });
    expect(period).toMatchObject({ kind: 'month', days: 30, unit: '月' });
    expect(summarizeScenario(baseScenario).total.periodKwh).toBe(12);
  });

  it('scales quarter and year from the monthly billing days', () => {
    expect(resolvePeriod({ daysPerMonth: 30, period: { kind: 'quarter' } }).days).toBe(90);
    expect(resolvePeriod({ daysPerMonth: 30, period: { kind: 'year' } }).days).toBe(360);
    const yearly = summarizeScenario({ ...baseScenario, period: { kind: 'year' } });
    expect(yearly.total.periodKwh).toBe(144);
    expect(yearly.total.periodCost).toBe(144);
  });

  it('counts custom range days inclusively and falls back when dates are broken', () => {
    expect(customPeriodDays('2026-01-01', '2026-01-31')).toBe(31);
    expect(customPeriodDays('2026-03-01', '2026-03-01')).toBe(1);
    expect(Number.isFinite(customPeriodDays('not-a-date', '2026-01-01'))).toBe(false);
    const period = resolvePeriod({ daysPerMonth: 30, period: { kind: 'custom', startDate: '2026-01-01', endDate: '2026-03-31' } });
    expect(period.days).toBe(90);
    const fallback = resolvePeriod({ daysPerMonth: 30, period: { kind: 'custom', startDate: 'bad', endDate: '2026-01-01' } });
    expect(fallback.days).toBe(30);
  });

  it('validates custom ranges', () => {
    expect(validatePeriod(undefined)).toBeNull();
    expect(validatePeriod({ kind: 'year' })).toBeNull();
    expect(validatePeriod({ kind: 'custom', startDate: '', endDate: '' })).toBe('请选择自定义区间的起止日期');
    expect(validatePeriod({ kind: 'custom', startDate: '2026-02-01', endDate: '2026-01-01' })).toBe('结束日期不能早于开始日期');
  });
});

describe('scenario comparison', () => {
  it('compares two legacy monthly scenarios exactly as before', () => {
    const other: EnergyScenario = { ...baseScenario, id: 't', name: 'other', devices: [{ id: 'c', name: 'c', watts: 100, dailyHours: 1 }] };
    const comparison = compareScenarios(baseScenario, other);
    expect(comparison).toMatchObject({ aligned: true, deltaKwh: 9, periodUnit: '月' });
  });

  it('treats a legacy scenario and an explicit monthly scenario with same days as aligned', () => {
    const explicit: EnergyScenario = { ...baseScenario, id: 't', period: { kind: 'month' } };
    expect(compareScenarios(baseScenario, explicit).aligned).toBe(true);
  });

  it('refuses to subtract scenarios with mismatched periods and explains why', () => {
    const yearly: EnergyScenario = { ...baseScenario, id: 't', name: '全年方案', period: { kind: 'year' } };
    const comparison = compareScenarios(baseScenario, yearly);
    expect(comparison.aligned).toBe(false);
    if (!comparison.aligned) {
      expect(comparison.reason).toContain('口径不一致');
      expect(comparison.reason).toContain('30 天');
      expect(comparison.reason).toContain('360 天');
    }
  });
});
