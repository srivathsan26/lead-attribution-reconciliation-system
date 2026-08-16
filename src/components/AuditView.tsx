import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Copy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AuditRecord } from '../types.js';

interface AuditViewProps {
  auditTrail: AuditRecord[];
  onSelectLead: (leadId: string) => void;
  onExportAuditJSON: () => void;
  onExportAuditCSV: () => void;
}

export const AuditView: React.FC<AuditViewProps> = ({
  auditTrail,
  onSelectLead,
  onExportAuditJSON,
  onExportAuditCSV,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [conflictOnly, setConflictOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return auditTrail.filter(record => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches =
          record.lead_id.toLowerCase().includes(q) ||
          record.decision_type.toLowerCase().includes(q) ||
          record.reason.toLowerCase().includes(q) ||
          (record.selected_campaign && record.selected_campaign.toLowerCase().includes(q));
        if (!matches) return false;
      }

      if (decisionFilter !== 'all' && record.decision_type !== decisionFilter) {
        return false;
      }

      if (conflictOnly && record.decision_type !== 'STATE_CONFLICT') {
        return false;
      }

      return true;
    });
  }, [auditTrail, searchTerm, decisionFilter, conflictOnly]);

  const badgeStyles: Record<string, string> = {
    DUPLICATE_MERGE: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    ATTRIBUTION_SELECTION: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    STATE_CHANGE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    STATE_CONFLICT: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    TIE_BREAK: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    LATE_EVENT_REORDER: 'bg-white/10 text-white/80 border-white/15',
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header & Filter Controls */}
      <div className="bg-white/[0.04] backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit decisions by Lead ID, campaign, or explanation..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-white/5 border border-white/15 rounded-xl text-white placeholder:text-white/40 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50 transition-all backdrop-blur-md"
            />
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <select
              value={decisionFilter}
              onChange={e => setDecisionFilter(e.target.value)}
              className="text-xs bg-[#0a0d24] border border-white/15 rounded-xl px-3 py-2 text-white/90 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50 font-medium backdrop-blur-md"
            >
              <option value="all">All Decision Types</option>
              <option value="ATTRIBUTION_SELECTION">Attribution Selection</option>
              <option value="DUPLICATE_MERGE">Duplicate Merge</option>
              <option value="STATE_CHANGE">State Change</option>
              <option value="STATE_CONFLICT">State Conflict</option>
              <option value="TIE_BREAK">Tie-Break</option>
              <option value="LATE_EVENT_REORDER">Late Event Reorder</option>
            </select>

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

            <button
              onClick={onExportAuditCSV}
              className="text-xs px-3.5 py-2 rounded-xl font-medium bg-white/10 text-white border border-white/15 hover:bg-white/20 flex items-center gap-1.5 transition-all backdrop-blur-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              onClick={onExportAuditJSON}
              className="text-xs px-3.5 py-2 rounded-xl font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 flex items-center gap-1.5 transition-all backdrop-blur-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-white/50 pt-1 border-t border-white/10">
          <span>
            Showing <strong className="text-white font-mono">{filteredLogs.length}</strong> of{' '}
            <strong className="text-white font-mono">{auditTrail.length}</strong> decision events
          </span>
          {(searchTerm || decisionFilter !== 'all' || conflictOnly) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setDecisionFilter('all');
                setConflictOnly(false);
              }}
              className="text-cyan-400 hover:underline font-medium text-xs"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Decision Log List */}
      <div className="space-y-2.5">
        {filteredLogs.map(record => {
          const isExpanded = expandedId === record.id;
          return (
            <div
              key={record.id}
              className={`rounded-2xl border transition-all backdrop-blur-xl ${
                record.decision_type === 'STATE_CONFLICT'
                  ? 'border-amber-500/30 bg-amber-500/10'
                  : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]'
              }`}
            >
              <div
                className="p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                onClick={() => setExpandedId(isExpanded ? null : record.id)}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                        badgeStyles[record.decision_type] || 'bg-white/10 text-white/70'
                      }`}
                    >
                      {record.decision_type.replace('_', ' ')}
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onSelectLead(record.lead_id);
                      }}
                      className="text-xs font-mono font-bold text-cyan-300 hover:underline flex items-center gap-1"
                    >
                      <span>Lead: {record.lead_id}</span>
                    </button>
                    {record.selected_campaign && (
                      <span className="text-[11px] font-mono text-white/70 bg-white/10 px-2 py-0.5 rounded">
                        Campaign: {record.selected_campaign}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-white/90 leading-relaxed">
                    {record.reason}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono text-white/40 self-end sm:self-center">
                  <span>{record.timestamp.replace('T', ' ').slice(0, 19)}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {/* Expandable JSON / Details inspector */}
              {isExpanded && (
                <div className="p-4 pt-0 border-t border-white/10 mt-2 bg-white/[0.02] text-xs font-mono text-white/80 space-y-2 rounded-b-2xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                    <div>
                      <span className="text-white/40">Trigger Event ID:</span>{' '}
                      <span className="text-white font-semibold">{record.event_id}</span>
                    </div>
                    <div>
                      <span className="text-white/40">Previous State:</span>{' '}
                      <span className="text-white">{record.previous_state || 'N/A'}</span> &rarr;{' '}
                      <span className="text-white/40">New State:</span>{' '}
                      <span className="text-white">{record.new_state || 'N/A'}</span>
                    </div>
                  </div>
                  {record.candidate_campaigns && record.candidate_campaigns.length > 0 && (
                    <div>
                      <span className="text-white/40">Candidate Campaigns:</span>{' '}
                      <span className="text-cyan-300">
                        {JSON.stringify(record.candidate_campaigns)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
