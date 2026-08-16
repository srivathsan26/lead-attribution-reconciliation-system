import React, { useState } from 'react';
import { Search, Download, ArrowUpDown, TrendingUp, Sparkles, Target } from 'lucide-react';
import { SEOKeywordRow } from '../types.js';

interface SEOViewProps {
  keywords: SEOKeywordRow[];
  onExportCSV: () => void;
}

export const SEOView: React.FC<SEOViewProps> = ({ keywords, onExportCSV }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof SEOKeywordRow>('conversions');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = keywords
    .filter(k => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return k.keyword.toLowerCase().includes(q) || k.campaign.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? (valA as string).localeCompare(valB as string) : (valB as string).localeCompare(valA as string);
      }
      return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });

  const handleSort = (field: keyof SEOKeywordRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const totalImpressions = keywords.reduce((sum, k) => sum + k.impressions, 0);
  const totalClicks = keywords.reduce((sum, k) => sum + k.clicks, 0);
  const totalConversions = keywords.reduce((sum, k) => sum + k.conversions, 0);
  const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0';

  return (
    <div className="space-y-6 pb-12">
      {/* Top SEO Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl space-y-1 hover:border-white/20 transition-all">
          <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Total Clicks</div>
          <div className="text-2xl font-bold text-white font-mono">{totalClicks.toLocaleString()}</div>
          <div className="text-[11px] text-white/45 font-mono">{totalImpressions.toLocaleString()} impressions</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl space-y-1 hover:border-white/20 transition-all">
          <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Avg. Click-Through Rate</div>
          <div className="text-2xl font-bold text-cyan-300 font-mono">{avgCTR}%</div>
          <div className="text-[11px] text-white/45">across tracked keywords</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl space-y-1 hover:border-white/20 transition-all">
          <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Organic Leads Generated</div>
          <div className="text-2xl font-bold text-cyan-400 font-mono">
            {keywords.reduce((sum, k) => sum + k.leads_generated, 0)}
          </div>
          <div className="text-[11px] text-white/45">touchpoint conversions</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl space-y-1 hover:border-white/20 transition-all">
          <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Total SEO Conversions</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{totalConversions}</div>
          <div className="text-[11px] text-emerald-300 font-semibold">High purchase intent</div>
        </div>
      </div>

      {/* Keywords Table */}
      <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden space-y-3 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search organic keywords or campaigns..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-white/5 border border-white/15 rounded-xl text-white placeholder:text-white/40 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50 transition-all backdrop-blur-md"
            />
          </div>
          <button
            onClick={onExportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all shadow-lg"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export SEO Report (.csv)</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.04] border-b border-white/10 text-white/60 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('keyword')}>
                  <div className="flex items-center gap-1.5">
                    <span>Keyword Query</span>
                    <ArrowUpDown className="w-3 h-3 text-white/40" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('campaign')}>
                  <div className="flex items-center gap-1.5">
                    <span>Target Campaign</span>
                    <ArrowUpDown className="w-3 h-3 text-white/40" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('impressions')}>
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Impressions</span>
                    <ArrowUpDown className="w-3 h-3 text-white/40" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('clicks')}>
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Clicks</span>
                    <ArrowUpDown className="w-3 h-3 text-white/40" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('ctr')}>
                  <div className="flex items-center justify-end gap-1.5">
                    <span>CTR</span>
                    <ArrowUpDown className="w-3 h-3 text-white/40" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('avg_position')}>
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Avg Rank</span>
                    <ArrowUpDown className="w-3 h-3 text-white/40" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('conversions')}>
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Conversions</span>
                    <ArrowUpDown className="w-3 h-3 text-white/40" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filtered.map(k => (
                <tr key={k.keyword} className="hover:bg-white/[0.05] transition-colors">
                  <td className="py-3 px-4 font-bold text-white font-sans">{k.keyword}</td>
                  <td className="py-3 px-4 font-sans text-cyan-300 font-medium">{k.campaign}</td>
                  <td className="py-3 px-4 text-right text-white/70">{k.impressions.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-white/90 font-semibold">{k.clicks.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-cyan-400 font-semibold">{k.ctr}%</td>
                  <td className="py-3 px-4 text-right text-white/70">#{k.avg_position}</td>
                  <td className="py-3 px-4 text-right text-emerald-400 font-bold">{k.conversions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
