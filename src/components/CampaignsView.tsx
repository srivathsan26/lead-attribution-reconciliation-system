import React, { useState } from 'react';
import { Download, ArrowUpDown, TrendingUp, Users, Target, Layers } from 'lucide-react';
import { CampaignReportRow, SourceReportRow } from '../types.js';

interface CampaignsViewProps {
  campaigns: CampaignReportRow[];
  sources: SourceReportRow[];
  onExportCSV: () => void;
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaigns,
  sources,
  onExportCSV,
}) => {
  const [sortField, setSortField] = useState<keyof CampaignReportRow>('converted_leads');
  const [sortAsc, setSortAsc] = useState(false);

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (typeof valA === 'string') {
      return sortAsc ? (valA as string).localeCompare(valB as string) : (valB as string).localeCompare(valA as string);
    }
    return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
  });

  const handleSort = (field: keyof CampaignReportRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const totalConverted = campaigns.reduce((sum, c) => sum + c.converted_leads, 0);
  const totalUniqueLeads = campaigns.reduce((sum, c) => sum + c.unique_leads, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Source Summary Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white tracking-tight">Channel Attribution Breakdown</h3>
          <span className="text-xs text-white/50">{sources.length} active channels</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {sources.map(src => (
            <div key={src.source} className="p-4 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl space-y-1 hover:border-white/20 transition-all">
              <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider capitalize truncate">
                {src.source.replace('_', ' ')}
              </div>
              <div className="text-xl font-bold text-white font-mono">{src.unique_leads} leads</div>
              <div className="text-[11px] text-emerald-400 font-semibold font-mono">
                {src.converted_leads} conv. ({src.conversion_rate}%)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Comparative Campaign Table */}
      <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden space-y-3 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Campaign Performance Ranking</h3>
            <p className="text-xs text-white/50">
              Deterministic campaign attribution, conversion metrics, and duplicate load
            </p>
          </div>
          <button
            onClick={onExportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all shadow-lg"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Campaign Report (.csv)</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.04] border-b border-white/10 text-white/60 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('campaign')}>
                  <div className="flex items-center gap-1.5">
                    <span>Campaign</span>
                    <ArrowUpDown className="w-3 h-3 text-white/40" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('source')}>
                  <div className="flex items-center gap-1.5">
                    <span>Primary Source</span>
                    <ArrowUpDown className="w-3 h-3 text-white/40" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('unique_leads')}>
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Unique Leads</span>
                    <ArrowUpDown className="w-3 h-3 text-white/40" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('qualified_leads')}>
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Qualified</span>
                    <ArrowUpDown className="w-3 h-3 text-white/40" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('converted_leads')}>
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Converted</span>
                    <ArrowUpDown className="w-3 h-3 text-white/40" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('duplicate_leads')}>
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Duplicates Merged</span>
                    <ArrowUpDown className="w-3 h-3 text-white/40" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('total_events')}>
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Total Events</span>
                    <ArrowUpDown className="w-3 h-3 text-white/40" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('conversion_rate')}>
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Conversion Rate</span>
                    <ArrowUpDown className="w-3 h-3 text-white/40" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {sortedCampaigns.map(c => (
                <tr key={`${c.campaign}-${c.source}`} className="hover:bg-white/[0.05] transition-colors">
                  <td className="py-3 px-4 font-bold text-white font-sans">{c.campaign}</td>
                  <td className="py-3 px-4 font-sans capitalize text-white/70">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-white/10 text-white/80">
                      {c.source.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-white/90 font-medium">{c.unique_leads}</td>
                  <td className="py-3 px-4 text-right text-amber-300 font-semibold">{c.qualified_leads}</td>
                  <td className="py-3 px-4 text-right text-emerald-400 font-bold">{c.converted_leads}</td>
                  <td className="py-3 px-4 text-right text-white/50 font-medium">{c.duplicate_leads}</td>
                  <td className="py-3 px-4 text-right text-white/50 font-medium">{c.total_events}</td>
                  <td className="py-3 px-4 text-right font-black text-cyan-300 font-mono">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                      {c.conversion_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
