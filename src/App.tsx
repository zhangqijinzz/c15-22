import { DeviceEditor } from './components/DeviceEditor';
import { ScenarioCard } from './components/ScenarioCard';
import { compareScenarios, formatNumber, PERIOD_KINDS, resolvePeriod, summarizeScenario } from './domain';
import { useEnergyLens } from './hooks';
import type { BillingPeriod, BillingPeriodKind, EnergyScenario } from './types';

/** 切换周期时生成新的 period；进入自定义区间时带上一个默认的 30 天区间，避免中间态非法 */
function buildPeriod(kind: BillingPeriodKind, scenario: EnergyScenario): BillingPeriod {
  if (kind !== 'custom') return { kind };
  if (scenario.period?.kind === 'custom' && scenario.period.startDate && scenario.period.endDate) {
    return { kind, startDate: scenario.period.startDate, endDate: scenario.period.endDate };
  }
  const start = new Date();
  const end = new Date(start.getTime() + 29 * 24 * 60 * 60 * 1000);
  return { kind, startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

function App() {
  const { vm, state } = useEnergyLens();
  const active = vm.activeScenario;
  const summary = vm.activeSummary;
  if (state.status === 'loading' || !active || !summary) return <main className="loading-screen"><div className="pulse" /><p>正在恢复你的能耗方案…</p></main>;
  const period = resolvePeriod(active);
  const maxKwh = Math.max(...summary.devices.map((device) => device.periodKwh), 1);
  const baseline = state.document?.scenarios.find((item) => item.id !== active.id);
  const comparison = baseline ? compareScenarios(active, baseline) : null;
  const topDevice = summary.devices.slice().sort((a, b) => b.periodKwh - a.periodKwh)[0];

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">⌁</span><span>Energy<span>Lens</span></span></div>
      <div className="topbar-right"><span className="save-state"><i /> {state.status === 'error' ? '需要注意' : '已自动保存'}</span><button className="help-button" aria-label="帮助">?</button></div>
    </header>

    <main className="page-wrap">
      <section className="hero">
        <div><p className="eyebrow">家庭能耗推演器 <span>·</span> 轻量决策工具</p><h1>让每一度电<br /><span>都看得见。</span></h1><p className="hero-copy">把设备、使用习惯和电价放进来，马上看见<br className="desktop-only" />它们如何影响你的账单。</p></div>
        <div className="hero-spark"><span>{period.label}预计用电</span><strong>{formatNumber(summary.total.periodKwh)} <small>kWh</small></strong><div className="sparkline"><i /><i /><i /><i /><i /><i /><i /></div></div>
      </section>

      {state.notice && <div className={`notice ${state.notice.kind}`} role="status"><span>{state.notice.kind === 'error' ? '!' : '✓'}</span>{state.notice.text}</div>}

      <div className="workspace-grid">
        <section className="panel setup-panel">
          <div className="panel-heading"><div><span className="step">01</span><h2>设备配置</h2><p>输入设备的额定功率与每天使用时长</p></div><span className="count-pill">{active.devices.length} 台设备</span></div>
          <div className="device-list">{active.devices.map((device) => <DeviceEditor key={device.id} device={device} onChange={(patch) => vm.updateDevice(device.id, patch)} onRemove={() => vm.removeDevice(device.id)} />)}</div>
          <button className="add-device" onClick={() => vm.addDevice()}><span>＋</span> 添加一台设备</button>
          <div className="tip"><span>✦</span><p><strong>小提示</strong> 功率可以在设备铭牌或说明书上找到，1,000 W = 1 kW。</p></div>
        </section>

        <section className="panel settings-panel">
          <div className="panel-heading"><div><span className="step">02</span><h2>时间与价格</h2><p>调整计费周期，让估算更贴近你的账单</p></div></div>
          <div className="period-picker">
            <span>计费周期</span>
            <div className="period-options" role="group" aria-label="计费周期">
              {PERIOD_KINDS.map((item) => <button key={item.kind} type="button" className={period.kind === item.kind ? 'active' : ''} onClick={() => vm.updateSettings({ period: buildPeriod(item.kind, active) })}>{item.label}</button>)}
            </div>
          </div>
          {period.kind === 'custom' ? (
            <div className="date-range">
              <label className="big-field"><span>开始日期</span><input type="date" value={active.period?.startDate ?? ''} onChange={(event) => vm.updateSettings({ period: { kind: 'custom', startDate: event.target.value, endDate: active.period?.endDate ?? '' } })} /></label>
              <label className="big-field"><span>结束日期</span><input type="date" value={active.period?.endDate ?? ''} onChange={(event) => vm.updateSettings({ period: { kind: 'custom', startDate: active.period?.startDate ?? '', endDate: event.target.value } })} /></label>
            </div>
          ) : (
            <label className="big-field"><span>每月计费天数 <em>天</em></span><input type="number" min="1" max="31" value={active.daysPerMonth} onChange={(event) => vm.updateSettings({ daysPerMonth: Number(event.target.value) })} /></label>
          )}
          <p className="period-summary">本周期共 {period.days} 天，设备用电与费用均按此折算</p>
          <label className="big-field"><span>居民电价 <em>元 / kWh</em></span><div className="input-prefix"><b>¥</b><input type="number" min="0" step="0.01" value={active.pricePerKwh} onChange={(event) => vm.updateSettings({ pricePerKwh: Number(event.target.value) })} /></div></label>
          <div className="formula"><span>计算方式</span><code>功率(W) × 时长(h) ÷ 1,000 × 周期天数({period.days} 天)</code><small>结果为估算值，实际账单可能受阶梯电价影响。</small></div>
        </section>
      </div>

      <section className="results-section"><div className="section-title"><div><span className="step">03</span><h2>结果分析</h2><p>你的用电结构，一眼看清</p></div><div className="result-actions"><span className="updated">实时更新 · {state.status === 'completed' ? '已完成' : '编辑中'}</span><button className="primary-button" onClick={() => vm.complete()}>完成本次推演 <span>→</span></button></div></div>
        <div className="metrics"><div className="metric-card featured"><span>{period.label}预计用电</span><strong>{formatNumber(summary.total.periodKwh)} <small>kWh</small></strong><em>约 ¥{formatNumber(summary.total.periodCost)} / {period.unit}</em></div><div className="metric-card"><span>日均用电</span><strong>{formatNumber(summary.total.dailyKwh)} <small>kWh</small></strong><em>平均每天</em></div><div className="metric-card"><span>设备数量</span><strong>{active.devices.length} <small>台</small></strong><em>已纳入估算</em></div></div>
        <div className="analysis-grid"><div className="chart-card"><div className="card-heading"><div><h3>设备消耗占比</h3><p>按{period.label}用电量排序</p></div><span className="legend"><i /> {period.label} kWh</span></div><div className="bar-chart">{summary.devices.slice().sort((a, b) => b.periodKwh - a.periodKwh).map((device) => <div className="bar-row" key={device.id}><div className="bar-label"><span>{device.name}</span><b>{formatNumber(device.periodKwh)} kWh</b></div><div className="bar-track"><i style={{ width: `${(device.periodKwh / maxKwh) * 100}%` }} /><span>{Math.round(device.share * 100)}%</span></div></div>)}</div></div><div className="insight-card"><span className="insight-icon">◒</span><h3>你的最大用电来源</h3><strong>{topDevice?.name}</strong><p>占总用电的 <b>{Math.round((topDevice?.share ?? 0) * 100)}%</b>。每天减少 1 小时使用，预计本{period.unit}可节省 <b>¥{formatNumber((topDevice?.watts ?? 0) / 1000 * active.pricePerKwh * period.days)}</b>。</p></div></div>
      </section>

      <section className="scenario-section"><div className="section-title"><div><span className="step">04</span><h2>方案对比</h2><p>复制当前方案，试试另一种生活方式</p></div><button className="secondary-button" onClick={() => vm.duplicateActive()}>＋ 复制当前方案</button></div><div className="scenario-grid">{state.document?.scenarios.map((scenario) => { const scenarioPeriod = resolvePeriod(scenario); return <ScenarioCard key={scenario.id} scenario={scenario} totalKwh={summarizeScenario(scenario).total.periodKwh} periodUnit={scenarioPeriod.unit} active={scenario.id === active.id} onSelect={() => vm.selectScenario(scenario.id)} />; })}</div>{comparison && (comparison.aligned ? <div className="comparison-note"><span>↕</span><p>当前方案相较于“{baseline?.name}”每{comparison.periodUnit} <b>{comparison.deltaKwh <= 0 ? '少' : '多'} {formatNumber(Math.abs(comparison.deltaKwh))} kWh</b>，电费约 <b>¥{formatNumber(Math.abs(comparison.deltaKwh) * active.pricePerKwh)}</b>。</p></div> : <div className="comparison-note mismatch"><span>≠</span><p>{comparison.reason}</p></div>)}</section>
    </main>
    <footer><span>EnergyLens · 用数据做出更好的能源选择</span><span>本地保存 · 数据只属于你</span></footer>
  </div>;
}

export default App;
