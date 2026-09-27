export interface EnergyDevice {
  id: string;
  name: string;
  watts: number;
  dailyHours: number;
}

export type BillingPeriodKind = 'month' | 'quarter' | 'year' | 'custom';

export interface BillingPeriod {
  kind: BillingPeriodKind;
  /** 自定义区间的起始日期，格式 YYYY-MM-DD，仅 kind 为 custom 时使用 */
  startDate?: string;
  /** 自定义区间的结束日期，格式 YYYY-MM-DD，仅 kind 为 custom 时使用 */
  endDate?: string;
}

export interface EnergyScenario {
  id: string;
  name: string;
  pricePerKwh: number;
  daysPerMonth: number;
  /** 计费周期；缺省视为按月（兼容只带 daysPerMonth 的旧方案） */
  period?: BillingPeriod;
  devices: EnergyDevice[];
  createdAt: string;
}

export interface EnergyDocument {
  version: 1;
  scenarios: EnergyScenario[];
  activeScenarioId: string;
}

export type ViewStatus = 'loading' | 'ready' | 'editing' | 'error' | 'completed';

export interface Notice {
  kind: 'success' | 'error' | 'info';
  text: string;
}

export interface EnergyEstimate {
  dailyKwh: number;
  periodKwh: number;
  periodCost: number;
}

export interface ScenarioSummary {
  total: EnergyEstimate;
  devices: Array<EnergyDevice & EnergyEstimate & { share: number }>;
}
