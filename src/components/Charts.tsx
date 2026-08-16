import React from 'react';
import { CampaignReportRow, SourceReportRow } from '../types.js';

interface SourceBarChartProps {
  data: SourceReportRow[];
}

export const SourceBarChart: React.FC<SourceBarChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="text-xs text-white/40 py-6 text-center">No source data available</div>;
  }

  const maxLeads = Math.max(...data.map(d => d.unique_leads), 1);

  const sourceColors: Record<string, { bar: string; glow: string }> = {
    organic_search: { bar: 'bg-emerald-400', glow: 'shadow-[0_0_12px_rgba(52,211,153,0.4)]' },
    paid_search: { bar: 'bg-cyan-400', glow: 'shadow-[0_0_12px_rgba(34,211,238,0.4)]' },
    email: { bar: 'bg-amber-400', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.4)]' },
    social: { bar: 'bg-purple-400', glow: 'shadow-[0_0_12px_rgba(192,132,252,0.4)]' },
    website: { bar: 'bg-indigo-400', glow: 'shadow-[0_0_12px_rgba(129,140,248,0.4)]' },
    manual: { bar: 'bg-slate-400', glow: 'shadow-[0_0_12px_rgba(148,163,184,0.4)]' },
  };

  return (
    <div className="space-y-3.5 pt-1">
      {data.map(row => {
        const pct = Math.round((row.unique_leads / maxLeads) * 100);
        const style = sourceColors[row.source.toLowerCase()] || { bar: 'bg-cyan-400', glow: '' };
        return (
          <div key={row.source} className="space-y-1">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="capitalize text-white/80 font-medium">
                {row.source.replace('_', ' ')}
              </span>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-white font-semibold">{row.unique_leads} leads</span>
                <span className="text-white/40">({row.conversion_rate}%)</span>
              </div>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex backdrop-blur-xs">
              <div
                className={`h-full ${style.bar} ${style.glow} rounded-full transition-all duration-500 ease-out`}
                style={{ width: `${Math.max(6, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface StateFunnelProps {
  stateDistribution: Record<string, number>;
}

export const StateFunnelChart: React.FC<StateFunnelProps> = ({ stateDistribution }) => {
  const states = [
    { label: 'New', count: stateDistribution['New'] || 0, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
    { label: 'Contacted', count: stateDistribution['Contacted'] || 0, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
    { label: 'Qualified', count: stateDistribution['Qualified'] || 0, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    { label: 'Converted', count: stateDistribution['Converted'] || 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  ];

  const total: number =
    (Object.values(stateDistribution) as number[]).reduce((a: number, b: number) => a + (Number(b) || 0), 0) || 1;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {states.map((st, idx) => {
        const pct = Math.round((st.count / total) * 100);
        return (
          <div
            key={st.label}
            className={`p-4 rounded-2xl border backdrop-blur-md ${st.bg} space-y-2 transition-all hover:border-white/30`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold tracking-wide ${st.color}`}>{st.label}</span>
              <span className="text-[10px] font-mono text-white/40">Step 0{idx + 1}</span>
            </div>
            <div className="text-2xl font-extrabold text-white tracking-tight font-mono">{st.count}</div>
            <div className="text-[11px] text-white/50 font-medium">{pct}% of leads</div>
          </div>
        );
      })}
    </div>
  );
};

