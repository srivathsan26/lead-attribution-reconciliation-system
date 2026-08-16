import React from 'react';
import {
  Users,
  Target,
  CheckCircle2,
  Copy,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  TrendingUp,
  Layers,
  Sparkles,
  FileCheck2,
} from 'lucide-react';
import { PipelineSummary, CampaignReportRow, SourceReportRow, AuditRecord } from '../types.js';
import { SourceBarChart, StateFunnelChart } from './Charts.js';

interface DashboardViewProps {
  summary: PipelineSummary;
  topCampaign: CampaignReportRow | null;
  topSource: SourceReportRow | null;
  stateDistribution: Record<string, number>;
  campaignPerformance: CampaignReportRow[];
  sourcePerformance: SourceReportRow[];
  recentActivity: AuditRecord[];
  onNavigateToTab: (tab: any) => void;
  onSelectLead: (leadId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  topCampaign,
  topSource,
  stateDistribution,
  campaignPerformance,
  sourcePerformance,
  recentActivity,
  onNavigateToTab,
  onSelectLead,
}) => {
  const kpis = [
    {
      id: 'kpi-unique-leads',
      label: 'Unique Canonical Leads',
      value: summary.unique_leads,
      sublabel: `${summary.total_raw_events} total raw events`,
      icon: Users,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
    },
    {
      id: 'kpi-converted-leads',
      label: 'Converted Leads',
      value: summary.converted_leads,
      sublabel: `${summary.overall_conversion_rate}% conversion rate`,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      id: 'kpi-qualified-leads',
      label: 'Qualified Leads',
      value: summary.qualified_leads,
      sublabel: `${summary.unique_leads > 0 ? ((summary.qualified_leads / summary.unique_leads) * 100).toFixed(1) : 0}% of unique leads`,
      icon: Target,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
    },
    {
      id: 'kpi-duplicate-records',
      label: 'Duplicates Merged',
      value: summary.duplicate_records,
      sublabel: 'Identity graph resolved',
      icon: Copy,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
    {
      id: 'kpi-conflicts-flagged',
      label: 'Lifecycle Conflicts',
      value: summary.reconciliation_conflicts,
      sublabel: summary.reconciliation_conflicts > 0 ? 'State regressions prevented' : '0 anomalies',
      icon: AlertTriangle,
      color: summary.reconciliation_conflicts > 0 ? 'text-amber-400' : 'text-white/40',
      bg: summary.reconciliation_conflicts > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/[0.03] border-white/10',
    },
    {
      id: 'kpi-rejected-records',
      label: 'Schema Validation',
      value: summary.rejected_records,
      sublabel: summary.rejected_records > 0 ? 'Isolated without crashing' : '100% valid',
      icon: FileCheck2,
      color: summary.rejected_records > 0 ? 'text-rose-400' : 'text-emerald-400',
      bg: summary.rejected_records > 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-white/[0.03] border-white/10',
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Highlights Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Campaign Card */}
        <div className="p-6 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl relative overflow-hidden transition-all hover:bg-white/[0.07] hover:border-white/20">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Flame className="w-32 h-32 text-cyan-400" />
          </div>
          <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold uppercase tracking-wider">
            <Flame className="w-4 h-4 text-amber-400" />
            Top Converting Campaign
          </div>
          <h3 className="text-xl font-bold mt-2 text-white font-mono truncate">
            {topCampaign ? topCampaign.campaign : 'No campaigns active'}
          </h3>
          <div className="mt-4 flex items-center gap-6 text-sm">
            <div>
              <div className="text-xs text-white/50">Conversions</div>
              <div className="text-xl font-bold text-white font-mono mt-0.5">
                {topCampaign ? topCampaign.converted_leads : 0}
              </div>
            </div>
            <div className="border-l border-white/10 pl-6">
              <div className="text-xs text-white/50">Conversion Rate</div>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
                {topCampaign ? `${topCampaign.conversion_rate}%` : '0%'}
              </div>
            </div>
            <div className="border-l border-white/10 pl-6">
              <div className="text-xs text-white/50">Primary Source</div>
              <div className="text-sm font-semibold text-white mt-1 capitalize">
                {topCampaign ? topCampaign.source.replace('_', ' ') : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Replay / Determinism Status Card */}
        <div className="p-6 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col justify-between transition-all hover:bg-white/[0.07] hover:border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-white/60 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Engine Verification
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              100% Deterministic
            </span>
          </div>
          <div className="my-2">
            <h4 className="text-base font-bold text-white">
              Order-Independent Attribution & Lifecycle Replay
            </h4>
            <p className="text-xs text-white/60 mt-1 leading-relaxed">
              Every lead journey is chronologically reconstructed and reconciled using immutable rules (Conversion &rarr; Pre-Qualification &rarr; Source Precedence &rarr; Lexicographic Tie-Break).
            </p>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
            <span className="text-white/50">
              Benchmark: <strong className="text-cyan-300 font-mono">10,000 events in &lt;200ms</strong>
            </span>
            <button
              onClick={() => onNavigateToTab('replay')}
              className="text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1 transition-colors"
            >
              Open Replay Lab <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.id}
              id={kpi.id}
              className={`p-4 rounded-2xl border ${kpi.bg} backdrop-blur-xl shadow-2xl space-y-1.5 flex flex-col justify-between transition-all hover:border-white/20`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-white/70 leading-tight">
                  {kpi.label}
                </span>
                <Icon className={`w-4 h-4 ${kpi.color} flex-shrink-0`} />
              </div>
              <div>
                <div className="text-2xl font-black text-white font-mono tracking-tight">
                  {kpi.value}
                </div>
                <div className="text-[10px] text-white/45 font-medium truncate mt-0.5">
                  {kpi.sublabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Middle Grid: Lead State Funnel & Source Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* State Progression Funnel */}
        <div className="lg:col-span-7 bg-white/[0.04] backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Lifecycle State Funnel
              </h3>
              <p className="text-xs text-white/50">
                Reconciled current lifecycle stage distribution across unique leads
              </p>
            </div>
            <button
              onClick={() => onNavigateToTab('leads')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1 transition-colors"
            >
              View Leads <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <StateFunnelChart stateDistribution={stateDistribution} />
        </div>

        {/* Source Breakdown */}
        <div className="lg:col-span-5 bg-white/[0.04] backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Attribution by Channel
              </h3>
              <p className="text-xs text-white/50">
                Unique leads & conversion rate by touchpoint source
              </p>
            </div>
            <button
              onClick={() => onNavigateToTab('campaigns')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1 transition-colors"
            >
              All Sources <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <SourceBarChart data={sourcePerformance} />
        </div>
      </div>

      {/* Bottom Grid: Top Campaigns Table & Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Campaign Performance Table */}
        <div className="lg:col-span-7 bg-white/[0.04] backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Campaign Performance Ranking
              </h3>
              <p className="text-xs text-white/50">
                Attributed leads and verified conversion rates
              </p>
            </div>
            <button
              onClick={() => onNavigateToTab('campaigns')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1 transition-colors"
            >
              Full Report <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.04] border-b border-white/10 text-white/60 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Campaign ID</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3 text-right">Unique Leads</th>
                  <th className="py-2.5 px-3 text-right">Converted</th>
                  <th className="py-2.5 px-3 text-right">Conv. Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {campaignPerformance.map(row => (
                  <tr key={`${row.campaign}-${row.source}`} className="hover:bg-white/[0.05] transition-colors">
                    <td className="py-2.5 px-3 font-medium text-white truncate max-w-[160px]">
                      {row.campaign}
                    </td>
                    <td className="py-2.5 px-3 capitalize text-white/70">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/10 text-white/80">
                        {row.source.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-white/90 font-medium">
                      {row.unique_leads}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-400">
                      {row.converted_leads}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-cyan-300">
                      {row.conversion_rate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Audit Activity */}
        <div className="lg:col-span-5 bg-white/[0.04] backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Explainable Audit Activity
              </h3>
              <p className="text-xs text-white/50">
                Live trail of deterministic engine decisions
              </p>
            </div>
            <button
              onClick={() => onNavigateToTab('audit')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1 transition-colors"
            >
              Explore Audit <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {recentActivity.map(act => {
              const badgeStyles: Record<string, string> = {
                DUPLICATE_MERGE: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                ATTRIBUTION_SELECTION: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
                STATE_CHANGE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                STATE_CONFLICT: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                TIE_BREAK: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
                LATE_EVENT_REORDER: 'bg-white/10 text-white/80 border-white/15',
              };

              return (
                <div
                  key={act.id}
                  onClick={() => onSelectLead(act.lead_id)}
                  className="p-3.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.06] transition-all cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider border ${
                        badgeStyles[act.decision_type] || 'bg-white/10 text-white/70'
                      }`}
                    >
                      {act.decision_type.replace('_', ' ')}
                    </span>
                    <span className="font-mono text-white/40 text-[10px]">
                      {act.timestamp.split('T')[1]?.slice(0, 8) || act.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-white/80 font-medium leading-relaxed line-clamp-2">
                    {act.reason}
                  </p>
                  <div className="text-[10px] text-white/40 font-mono flex items-center justify-between pt-1">
                    <span>Lead: {act.lead_id}</span>
                    <span className="text-cyan-400 font-semibold hover:underline">
                      Inspect Timeline &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
