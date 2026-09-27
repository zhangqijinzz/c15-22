import type { BillingCycle, CustomRange, EnergyDevice, EnergyEstimate, EnergyScenario, ScenarioSummary } from './types';

export const MAX_DAILY_HOURS = 24;

export const exampleScenario: EnergyScenario = {
  id: 'scenario-home',
  name: '夏日居家方案',
  pricePerKwh: 0.62,
  daysPerMonth: 30,
  createdAt: '2026-01-01T00:00:00.000Z',
  devices: [
    { id: 'device-aircon', name: '客厅空调', watts: 1200, dailyHours: 6 },
    { id: 'device-fridge', name: '冰箱', watts: 150, dailyHours: 10 },
    { id: 'device-lamp', name: '书桌台灯', watts: 12, dailyHours: 5 },
  ],
};

export function getCycle(scenario: Pick<EnergyScenario, 'cycle'>): BillingCycle {
  return scenario.cycle ?? 'month';
}

export function customRangeDays(range: CustomRange): number {
  const start = Date.parse(`${range.start}T00:00:00Z`);
  const end = Date.parse(`${range.end}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return NaN;
  return Math.round((end - start) / 86_400_000) + 1;
}

export function periodDays(scenario: Pick<EnergyScenario, 'daysPerMonth' | 'cycle' | 'customRange'>): number {
  switch (getCycle(scenario)) {
    case 'quarter': return scenario.daysPerMonth * 3;
    case 'year': return scenario.daysPerMonth * 12;
    case 'custom': {
      const days = scenario.customRange ? customRangeDays(scenario.customRange) : NaN;
      return Number.isFinite(days) ? days : scenario.daysPerMonth;
    }
    default: return scenario.daysPerMonth;
  }
}

export function cycleLabel(cycle: BillingCycle): string {
  switch (cycle) {
    case 'quarter': return '季度';
    case 'year': return '年';
    case 'custom': return '自定义区间';
    default: return '月';
  }
}

export function cyclePossessive(cycle: BillingCycle): string {
  switch (cycle) {
    case 'quarter': return '本季度';
    case 'year': return '今年';
    case 'custom': return '区间内';
    default: return '本月';
  }
}

export function sameBillingBasis(a: EnergyScenario, b: EnergyScenario): boolean {
  const cycleA = getCycle(a);
  const cycleB = getCycle(b);
  if (cycleA !== cycleB) return false;
  if (cycleA !== 'custom') return true;
  return a.customRange?.start === b.customRange?.start && a.customRange?.end === b.customRange?.end;
}

export function defaultCustomRange(): CustomRange {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function estimateDevice(device: EnergyDevice, days: number, pricePerKwh: number): EnergyEstimate {
  const dailyKwh = (device.watts * device.dailyHours) / 1000;
  const periodKwh = dailyKwh * days;
  return { dailyKwh, periodKwh, periodCost: periodKwh * pricePerKwh };
}

export function summarizeScenario(scenario: EnergyScenario): ScenarioSummary {
  const days = periodDays(scenario);
  const devices = scenario.devices.map((device) => ({
    ...device,
    ...estimateDevice(device, days, scenario.pricePerKwh),
    share: 0,
  }));
  const total = devices.reduce(
    (sum, device) => ({
      dailyKwh: sum.dailyKwh + device.dailyKwh,
      periodKwh: sum.periodKwh + device.periodKwh,
      periodCost: sum.periodCost + device.periodCost,
    }),
    { dailyKwh: 0, periodKwh: 0, periodCost: 0 },
  );
  return {
    cycle: getCycle(scenario),
    periodDays: days,
    total,
    devices: devices.map((device) => ({ ...device, share: total.periodKwh ? device.periodKwh / total.periodKwh : 0 })),
  };
}

export function validateDevice(device: Pick<EnergyDevice, 'name' | 'watts' | 'dailyHours'>): string | null {
  if (!device.name.trim()) return '请填写设备名称';
  if (!Number.isFinite(device.watts) || device.watts < 0) return '功率不能为负数';
  if (!Number.isFinite(device.dailyHours) || device.dailyHours < 0) return '使用时间不能为负数';
  if (device.dailyHours > MAX_DAILY_HOURS) return '每日使用时间不能超过 24 小时';
  return null;
}

export function validateScenarioSettings(scenario: Pick<EnergyScenario, 'pricePerKwh' | 'daysPerMonth' | 'cycle' | 'customRange'>): string | null {
  if (!Number.isFinite(scenario.pricePerKwh) || scenario.pricePerKwh < 0) return '电价不能为负数';
  if (!Number.isFinite(scenario.daysPerMonth) || scenario.daysPerMonth < 1 || scenario.daysPerMonth > 31) return '计费天数需在 1–31 天之间';
  if (getCycle(scenario) === 'custom') {
    if (!scenario.customRange) return '请选择自定义区间的起止日期';
    if (!Number.isFinite(customRangeDays(scenario.customRange))) return '自定义区间的结束日期不能早于开始日期';
  }
  return null;
}

export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function cloneScenario(source: EnergyScenario, id: string, name: string): EnergyScenario {
  return { ...source, id, name, createdAt: new Date().toISOString(), devices: source.devices.map((device) => ({ ...device, id: `${id}-${device.id}` })) };
}
