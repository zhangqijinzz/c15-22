import { cycleLabel, formatNumber } from '../domain';
import type { BillingCycle, EnergyScenario } from '../types';

interface ScenarioCardProps { scenario: EnergyScenario; totalKwh: number; cycle: BillingCycle; active: boolean; onSelect: () => void; }

export function ScenarioCard({ scenario, totalKwh, cycle, active, onSelect }: ScenarioCardProps) {
  return <button className={`scenario-card ${active ? 'active' : ''}`} onClick={onSelect}>
    <span className="scenario-dot" />
    <span className="scenario-copy"><strong>{scenario.name}</strong><small>{scenario.devices.length} 台设备 · {formatNumber(totalKwh)} kWh / {cycleLabel(cycle)}</small></span>
    <span className="arrow">→</span>
  </button>;
}
