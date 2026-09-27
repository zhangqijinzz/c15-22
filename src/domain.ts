import type { BillingPeriod, BillingPeriodKind, EnergyDevice, EnergyEstimate, EnergyScenario, ScenarioSummary } from './types';

export const MAX_DAILY_HOURS = 24;

const MONTHS_PER_QUARTER = 3;
const MONTHS_PER_YEAR = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

export const PERIOD_KINDS: Array<{ kind: BillingPeriodKind; label: string; unit: string }> = [
  { kind: 'month', label: '月度', unit: '月' },
  { kind: 'quarter', label: '季度', unit: '季' },
  { kind: 'year', label: '年度', unit: '年' },
  { kind: 'custom', label: '自定义区间', unit: '期' },
];

export interface ResolvedPeriod {
  kind: BillingPeriodKind;
  /** 折算后的计费天数，所有用电与费用都按它缩放 */
  days: number;
  /** 展示用名称，如「月度」「季度」 */
  label: string;
  /** 展示用单位，如「月」「季」，用于「/ 月」「每月」等文案 */
  unit: string;
}

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

/** 自定义区间的实际天数（起止日均计入），日期无法解析时返回 NaN */
export function customPeriodDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return NaN;
  return Math.round((end - start) / DAY_MS) + 1;
}

/** 把方案的计费周期折算成计费天数；没有 period 的旧方案按原来的每月天数处理 */
export function resolvePeriod(scenario: Pick<EnergyScenario, 'daysPerMonth' | 'period'>): ResolvedPeriod {
  const kind = scenario.period?.kind ?? 'month';
  const meta = PERIOD_KINDS.find((item) => item.kind === kind) ?? PERIOD_KINDS[0];
  let days: number;
  switch (kind) {
    case 'quarter':
      days = scenario.daysPerMonth * MONTHS_PER_QUARTER;
      break;
    case 'year':
      days = scenario.daysPerMonth * MONTHS_PER_YEAR;
      break;
    case 'custom': {
      const { startDate, endDate } = scenario.period ?? {};
      const custom = startDate && endDate ? customPeriodDays(startDate, endDate) : NaN;
      days = Number.isFinite(custom) && custom >= 1 ? custom : scenario.daysPerMonth;
      break;
    }
    default:
      days = scenario.daysPerMonth;
  }
  return { kind, days, label: meta.label, unit: meta.unit };
}

export function estimateDevice(device: EnergyDevice, billingDays: number, pricePerKwh: number): EnergyEstimate {
  const dailyKwh = (device.watts * device.dailyHours) / 1000;
  const periodKwh = dailyKwh * billingDays;
  return { dailyKwh, periodKwh, periodCost: periodKwh * pricePerKwh };
}

export function summarizeScenario(scenario: EnergyScenario): ScenarioSummary {
  const period = resolvePeriod(scenario);
  const devices = scenario.devices.map((device) => ({
    ...device,
    ...estimateDevice(device, period.days, scenario.pricePerKwh),
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
    total,
    devices: devices.map((device) => ({ ...device, share: total.periodKwh ? device.periodKwh / total.periodKwh : 0 })),
  };
}

export type ScenarioComparison =
  | { aligned: true; deltaKwh: number; periodLabel: string; periodUnit: string }
  | { aligned: false; reason: string };

/** 只有两个方案计费口径一致（同类型且折算天数相同）时才给出差值，否则返回说明 */
export function compareScenarios(current: EnergyScenario, baseline: EnergyScenario): ScenarioComparison {
  const currentPeriod = resolvePeriod(current);
  const baselinePeriod = resolvePeriod(baseline);
  if (currentPeriod.kind !== baselinePeriod.kind || currentPeriod.days !== baselinePeriod.days) {
    return {
      aligned: false,
      reason: `“${current.name}”按${currentPeriod.label}（${currentPeriod.days} 天）计费，“${baseline.name}”按${baselinePeriod.label}（${baselinePeriod.days} 天）计费，口径不一致，直接相减没有意义。请把两个方案调整到相同的计费周期后再对比。`,
    };
  }
  return {
    aligned: true,
    deltaKwh: summarizeScenario(current).total.periodKwh - summarizeScenario(baseline).total.periodKwh,
    periodLabel: currentPeriod.label,
    periodUnit: currentPeriod.unit,
  };
}

export function validateDevice(device: Pick<EnergyDevice, 'name' | 'watts' | 'dailyHours'>): string | null {
  if (!device.name.trim()) return '请填写设备名称';
  if (!Number.isFinite(device.watts) || device.watts < 0) return '功率不能为负数';
  if (!Number.isFinite(device.dailyHours) || device.dailyHours < 0) return '使用时间不能为负数';
  if (device.dailyHours > MAX_DAILY_HOURS) return '每日使用时间不能超过 24 小时';
  return null;
}

export function validatePeriod(period: BillingPeriod | undefined): string | null {
  if (!period) return null;
  if (period.kind === 'custom') {
    if (!period.startDate || !period.endDate) return '请选择自定义区间的起止日期';
    const days = customPeriodDays(period.startDate, period.endDate);
    if (!Number.isFinite(days)) return '自定义区间的日期格式不正确';
    if (days < 1) return '结束日期不能早于开始日期';
  }
  return null;
}

export function validateScenarioSettings(pricePerKwh: number, daysPerMonth: number, period?: BillingPeriod): string | null {
  if (!Number.isFinite(pricePerKwh) || pricePerKwh < 0) return '电价不能为负数';
  if (!Number.isFinite(daysPerMonth) || daysPerMonth < 1 || daysPerMonth > 31) return '计费天数需在 1–31 天之间';
  return validatePeriod(period);
}

export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function cloneScenario(source: EnergyScenario, id: string, name: string): EnergyScenario {
  return {
    ...source,
    id,
    name,
    createdAt: new Date().toISOString(),
    period: source.period ? { ...source.period } : undefined,
    devices: source.devices.map((device) => ({ ...device, id: `${id}-${device.id}` })),
  };
}
