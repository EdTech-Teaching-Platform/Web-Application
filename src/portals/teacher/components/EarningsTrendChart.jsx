// EarningsTrendChart — the Revenue Dashboard's gross/net earnings chart.
// Same visual language as TrendChart.jsx (area + line, gridlines, month
// labels) but reads {label, gross, net} points and switches which series
// it plots instead of always reading d.count, since the Dashboard needs a
// toggle between gross and net and TrendChart's enrollment usage must stay
// untouched.
import { formatCompactAmount, formatAmount, currencySymbolFor } from "../../../utils/formatMoney";

const WIDTH = 640;
const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 26, left: 46 };

export default function EarningsTrendChart({ data, metric = "net", currency = "INR", currencySymbol, className = "" }) {
  const symbol = currencySymbol ?? currencySymbolFor(currency);
  if (!data || data.length === 0) {
    return (
      <div className={`flex h-40 items-center justify-center rounded-2xl bg-bg text-xs text-muted ${className}`}>
        Not enough data yet
      </div>
    );
  }

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const values = data.map((d) => d[metric]);
  const max = Math.max(...values, 1) * 1.15;
  const min = 0;
  const n = data.length;
  const slot = plotW / Math.max(n - 1, 1);

  const xAt = (i) => PAD.left + slot * i;
  const yAt = (v) => PAD.top + plotH - ((v - min) / (max - min || 1)) * plotH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(d[metric])}`).join(" ");
  const areaPath = `${linePath} L ${xAt(n - 1)} ${PAD.top + plotH} L ${xAt(0)} ${PAD.top + plotH} Z`;

  const peakIdx = values.indexOf(Math.max(...values));
  const yTicks = [0, 0.5, 1].map((f) => Math.round(min + (max - min) * f));

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`${metric === "gross" ? "Gross" : "Net"} earnings trend`}>
        <defs>
          <linearGradient id="earningsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-5)" stopOpacity="0.38" />
            <stop offset="100%" stopColor="var(--color-chart-6)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="currentColor" className="text-text/[0.06]" />
            <text x={PAD.left - 8} y={yAt(t) + 3} textAnchor="end" className="fill-muted text-[9px]">
              {symbol}{formatCompactAmount(t, currency)}
            </text>
          </g>
        ))}

        <path d={areaPath} className="fill-primary" style={{ color: "var(--color-primary)" }} fill="url(#earningsFill)" />
        <path d={linePath} fill="none" className="stroke-primary" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={d.label} cx={xAt(i)} cy={yAt(d[metric])} r={i === peakIdx ? 3.5 : 2.5} className="fill-primary" />
        ))}

        {peakIdx >= 0 && (
          <text x={xAt(peakIdx)} y={yAt(data[peakIdx][metric]) - 10} textAnchor="middle" className="fill-primary text-[10px] font-semibold">
            {symbol}{formatAmount(data[peakIdx][metric], currency)}
          </text>
        )}

        {data.map((d, i) => (
          <text key={d.label} x={xAt(i)} y={HEIGHT - 6} textAnchor="middle" className="fill-muted text-[10px]">
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
