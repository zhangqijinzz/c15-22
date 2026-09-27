export interface EnergyDevice {
  id: string;
  name: string;
  watts: number;
  dailyHours: number;
}

export type BillingCycle = 'month' | 'quarter' | 'year' | 'custom';

export interface CustomRange {
  start: string;
  end: string;
}

export interface EnergyScenario {
  id: string;
  name: string;
  pricePerKwh: number;
  daysPerMonth: number;
  cycle?: BillingCycle;
  customRange?: CustomRange;
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
  cycle: BillingCycle;
  periodDays: number;
  total: EnergyEstimate;
  devices: Array<EnergyDevice & EnergyEstimate & { share: number }>;
}
