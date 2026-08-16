import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  Copy,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Download,
} from 'lucide-react';
import { CanonicalLead } from '../types.js';

interface LeadsViewProps {
  leads: CanonicalLead[];
  onSelectLead: (leadId: string) => void;
  onExportLeadsCSV: () => void;
}

export const LeadsView: React.FC<LeadsViewProps> = ({
  leads,
  onSelectLead,
  onExportLeadsCSV,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [conflictOnly, setConflictOnly] = useState(false);
  const [duplicateOnly, setDuplicateOnly] = useState(false);
  const [sortField, setSortField] = useState<string>('score');
  const [sortAsc, setSortAsc] = useState(false);

  // Distinct sources and campaigns for filters
  const availableSources = useMemo(() => {
    const s = new Set<string>();
    leads.forEach(l => {
      if (l.attributed_source) s.add(l.attributed_source);
    });
    return Array.from(s).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads
      .filter(lead => {
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const matches =
            lead.lead_id.toLowerCase().includes(q) ||
            lead.name.toLowerCase().includes(q) ||
            lead.canonical_email.toLowerCase().includes(q) ||
            lead.phone.toLowerCase().includes(q) ||
            lead.attributed_campaign.toLowerCase().includes(q);
          if (!matches) return false;
        }

        if (statusFilter !== 'all' && lead.current_state.toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }

        if (sourceFilter !== 'all' && lead.attributed_source.toLowerCase() !== sourceFilter.toLowerCase()) {
          return false;
        }

        if (conflictOnly && !lead.has_conflict) {
          return false;
        }

        if (duplicateOnly && lead.duplicate_count === 0) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortField as keyof CanonicalLead];
        let valB: any = b[sortField as keyof CanonicalLead];

        if (sortField === 'score') {
          valA = a.score.score;
          valB = b.score.score;
        }

        if (typeof valA === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? (valA > valB ? 1 : -1) : valB > valA ? 1 : -1;
      });
  }, [leads, searchTerm, statusFilter, sourceFilter, conflictOnly, duplicateOnly, sortField, sortAsc]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const statusBadge = (state: string) => {
    const styles: Record<string, string> = {
      Converted: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      Qualified: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      Contacted: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      New: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
      Lost: 'bg-white/10 text-white/60 border-white/10',
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
          styles[state] || 'bg-white/10 text-white/70 border-white/10'
        }`}
      >
        {state}
      </span>
    );
  };

  const qualityBadge = (score: number, tier: string) => {
    const tierStyles: Record<string, string> = {
      High: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-bold',
      Medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-semibold',
      Low: 'bg-white/5 text-white/60 border-white/10 font-medium',
    };
    return (
      <div className="flex items-center gap-1.5 font-mono">
        <span
          className={`px-2 py-0.5 rounded-md text-[11px] border ${
            tierStyles[tier] || 'bg-white/5 text-white/70'
          }`}
        >
          {score}/100 ({tier})
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Search & Filters Controls */}
      <div className="bg-white/[0.04] backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-leads"
              type="text"
              placeholder="Search leads by name, email, phone, campaign, or lead ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-white/5 border border-white/15 rounded-xl text-white placeholder:text-white/40 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400 transition-all backdrop-blur-md"
            />
          </div>

          {/* Filter dropdowns */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Status */}
            <select
              id="filter-status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-xs bg-[#0a0d24] border border-white/15 rounded-xl px-3 py-2 text-white/90 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50 font-medium backdrop-blur-md"
            >
              <option value="all">All States</option>
              <option value="Converted">Converted</option>
              <option value="Qualified">Qualified</option>
              <option value="Contacted">Contacted</option>
              <option value="New">New</option>
              <option value="Lost">Lost</option>
            </select>

            {/* Source */}
            <select
              id="filter-source"
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="text-xs bg-[#0a0d24] border border-white/15 rounded-xl px-3 py-2 text-white/90 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50 font-medium capitalize backdrop-blur-md"
            >
              <option value="all">All Sources</option>
              {availableSources.map(s => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>

            {/* Conflicts Toggle */}
            <button
              onClick={() => setConflictOnly(!conflictOnly)}
              className={`text-xs px-3 py-2 rounded-xl font-medium border flex items-center gap-1.5 transition-all backdrop-blur-md ${
                conflictOnly
                  ? 'bg-amber-500/25 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : 'bg-white/5 text-white/70 border-white/15 hover:bg-white/10'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Conflicts Only</span>
            </button>

            {/* Duplicates Toggle */}
            <button
              onClick={() => setDuplicateOnly(!duplicateOnly)}
              className={`text-xs px-3 py-2 rounded-xl font-medium border flex items-center gap-1.5 transition-all backdrop-blur-md ${
                duplicateOnly
                  ? 'bg-purple-500/25 text-purple-300 border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                  : 'bg-white/5 text-white/70 border-white/15 hover:bg-white/10'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicates Merged</span>
            </button>

            {/* CSV Export */}
            <button
              onClick={onExportLeadsCSV}
              className="text-xs px-3.5 py-2 rounded-xl font-medium bg-white/10 text-white border border-white/15 hover:bg-white/20 flex items-center gap-1.5 transition-all backdrop-blur-md ml-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Counter subtitle */}
        <div className="flex items-center justify-between text-xs text-white/50 pt-1 border-t border-white/10">
          <span>
            Showing <strong className="text-white font-mono">{filteredLeads.length}</strong> of{' '}
            <strong className="text-white font-mono">{leads.length}</strong> unique canonical leads
          </span>
          {(searchTerm || statusFilter !== 'all' || sourceFilter !== 'all' || conflictOnly || duplicateOnly) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setSourceFilter('all');
                setConflictOnly(false);
                setDuplicateOnly(false);
              }}
              className="text-cyan-400 hover:underline font-medium text-xs"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {filteredLeads.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/40">
              <Search className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">No matching leads found</h4>
            <p className="text-xs text-white/50 max-w-sm mx-auto">
              Try adjusting your search keywords or filter criteria to find the records you're looking for.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.04] border-b border-white/10 text-white/60 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1.5">
                      <span>Lead Profile</span>
                      <ArrowUpDown className="w-3 h-3 text-white/40" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('current_state')}>
                    <div className="flex items-center gap-1.5">
                      <span>Lifecycle State</span>
                      <ArrowUpDown className="w-3 h-3 text-white/40" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('attributed_campaign')}>
                    <div className="flex items-center gap-1.5">
                      <span>Attributed Campaign</span>
                      <ArrowUpDown className="w-3 h-3 text-white/40" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('attributed_source')}>
                    <div className="flex items-center gap-1.5">
                      <span>Source</span>
                      <ArrowUpDown className="w-3 h-3 text-white/40" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-center cursor-pointer hover:text-white" onClick={() => handleSort('interaction_count')}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Journey Steps</span>
                      <ArrowUpDown className="w-3 h-3 text-white/40" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('score')}>
                    <div className="flex items-center gap-1.5">
                      <span>Quality Score</span>
                      <ArrowUpDown className="w-3 h-3 text-white/40" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-center">Status / Anomaly</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLeads.map(lead => (
                  <tr
                    key={lead.lead_id}
                    id={`lead-row-${lead.lead_id}`}
                    onClick={() => onSelectLead(lead.lead_id)}
                    className="hover:bg-white/[0.06] transition-colors cursor-pointer group"
                  >
                    {/* Profile */}
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                          <span>{lead.name}</span>
                          {lead.duplicate_count > 0 && (
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              title={`${lead.duplicate_count} duplicate touchpoints merged into this profile`}
                            >
                              +{lead.duplicate_count} dups
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-white/50 font-mono flex items-center gap-2 mt-0.5">
                          <span>{lead.canonical_email || lead.phone || lead.lead_id}</span>
                        </div>
                      </div>
                    </td>

                    {/* State */}
                    <td className="py-3 px-4">{statusBadge(lead.current_state)}</td>

                    {/* Attributed Campaign */}
                    <td className="py-3 px-4 font-mono font-medium text-white/90 max-w-[170px] truncate" title={lead.attributed_campaign}>
                      {lead.attributed_campaign}
                    </td>

                    {/* Source */}
                    <td className="py-3 px-4 capitalize text-white/70">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-white/10 text-white/80">
                        {lead.attributed_source.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Interactions */}
                    <td className="py-3 px-4 text-center font-mono font-semibold text-white">
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/80 text-[11px]">
                        {lead.interaction_count} events
                      </span>
                    </td>

                    {/* Quality */}
                    <td className="py-3 px-4">{qualityBadge(lead.score.score, lead.score.tier)}</td>

                    {/* Conflict Indicator */}
                    <td className="py-3 px-4 text-center">
                      {lead.has_conflict ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          title="State conflict flagged (e.g. invalid transition rejected)"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          Conflict
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Reconciled
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onSelectLead(lead.lead_id);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold text-cyan-300 hover:bg-white/10 transition-colors"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
