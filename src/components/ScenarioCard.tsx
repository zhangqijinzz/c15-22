import { formatNumber } from '../domain';
import type { EnergyScenario } from '../types';

interface ScenarioCardProps { scenario: EnergyScenario; totalKwh: number; periodUnit: string; active: boolean; onSelect: () => void; }

export function ScenarioCard({ scenario, totalKwh, periodUnit, active, onSelect }: ScenarioCardProps) {
  return <button className={`scenario-card ${active ? 'active' : ''}`} onClick={onSelect}>
    <span className="scenario-dot" />
    <span className="scenario-copy"><strong>{scenario.name}</strong><small>{scenario.devices.length} 台设备 · {formatNumber(totalKwh)} kWh / {periodUnit}</small></span>
    <span className="arrow">→</span>
  </button>;
}
