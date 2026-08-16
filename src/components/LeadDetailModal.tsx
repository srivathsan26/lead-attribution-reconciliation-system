import React from 'react';
import {
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Copy,
  ArrowRight,
  TrendingUp,
  Tag,
  ShieldCheck,
  Clock,
  Send,
  Eye,
  MousePointerClick,
  UserCheck,
} from 'lucide-react';
import { CanonicalLead, AuditRecord, JourneyStep } from '../types.js';

interface LeadDetailModalProps {
  lead: CanonicalLead | null;
  auditTrail: AuditRecord[];
  onClose: () => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  lead,
  auditTrail,
  onClose,
}) => {
  if (!lead) return null;

  const statusStyles: Record<string, string> = {
    Converted: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    Qualified: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Contacted: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    New: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    Lost: 'bg-white/10 text-white/70 border-white/15',
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'converted':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'qualified':
        return <UserCheck className="w-4 h-4 text-amber-400" />;
      case 'contacted':
        return <Send className="w-4 h-4 text-cyan-400" />;
      case 'form_submission':
        return <TrendingUp className="w-4 h-4 text-cyan-300" />;
      case 'email_click':
      case 'campaign_click':
        return <MousePointerClick className="w-4 h-4 text-purple-400" />;
      case 'email_open':
        return <Eye className="w-4 h-4 text-blue-400" />;
      default:
        return <Layers className="w-4 h-4 text-white/50" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-[#0b0e24]/95 backdrop-blur-2xl w-full max-w-4xl rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/15 overflow-hidden flex flex-col max-h-[92vh] text-white">
        {/* Header */}
        <div className="p-6 bg-white/[0.04] border-b border-white/10 text-white flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-white">{lead.name}</h2>
              <span
                className={`text-xs font-semibold px-3 py-0.5 rounded-full border ${
                  statusStyles[lead.current_state] || 'bg-white/10 text-white/80'
                }`}
              >
                {lead.current_state.toUpperCase()}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-white/70 font-mono">
              <span>{lead.canonical_email || 'No email provided'}</span>
              {lead.phone && <span>&bull; {lead.phone}</span>}
              <span className="text-white/40">&bull; ID: {lead.lead_id}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-white/60 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-white/90 text-xs">
          {/* Top 2 Columns: Attribution Box & Quality Score */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Attribution Box */}
            <div className="md:col-span-8 p-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Deterministic Attribution
                </span>
                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 font-mono">
                  {lead.attribution_explanation.rule_applied}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-[11px] text-white/50 font-medium">Attributed Campaign</div>
                  <div className="text-sm font-bold text-white font-mono mt-0.5 truncate">
                    {lead.attributed_campaign}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-white/50 font-medium">Attributed Source</div>
                  <div className="text-sm font-bold text-cyan-300 capitalize mt-0.5">
                    {lead.attributed_source.replace('_', ' ')}
                  </div>
                </div>
              </div>

              {/* Explainability Callout */}
              <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-md space-y-1.5">
                <div className="text-[11px] font-bold text-cyan-300 uppercase tracking-tight">
                  Why This Campaign?
                </div>
                <p className="text-xs text-white/80 leading-relaxed font-sans">
                  {lead.attribution_explanation.reason}
                </p>
                {lead.attribution_explanation.candidate_campaigns.length > 1 && (
                  <div className="text-[11px] text-white/50 font-mono pt-1">
                    Evaluated candidate campaigns:{' '}
                    <strong className="text-cyan-300">{lead.attribution_explanation.candidate_campaigns.join(', ')}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Quality Score Breakdown */}
            <div className="md:col-span-4 p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">
                    Quality Rating
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-white/90 border border-white/10">
                    {lead.score.tier} Tier
                  </span>
                </div>
                <div className="text-3xl font-black text-white font-mono mt-2">
                  {lead.score.score}
                  <span className="text-sm font-normal text-white/40">/100</span>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px] text-white/60 border-t border-white/10 pt-2 font-mono">
                <div className="flex justify-between">
                  <span>Form Submission:</span>
                  <span className="text-cyan-300">+{lead.score.breakdown.form_submission} pts</span>
                </div>
                <div className="flex justify-between">
                  <span>Email Engagements:</span>
                  <span className="text-cyan-300">+{lead.score.breakdown.email_clicks + lead.score.breakdown.email_opens} pts</span>
                </div>
                <div className="flex justify-between">
                  <span>Lifecycle Progression:</span>
                  <span className="text-cyan-300">+{lead.score.breakdown.qualified + lead.score.breakdown.converted} pts</span>
                </div>
              </div>
            </div>
          </div>

          {/* Conflicts Alert if any */}
          {lead.has_conflict && (
            <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 space-y-2 backdrop-blur-md">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Reconciliation Conflict Warning Flagged</span>
              </div>
              <div className="space-y-1.5 text-xs text-amber-200/90">
                {lead.conflicts.map((c, idx) => (
                  <div key={idx} className="bg-black/20 p-2.5 rounded-lg border border-amber-500/20 font-sans leading-relaxed">
                    <strong>{c.attempted_transition}:</strong> {c.reason}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chronological Journey Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                Chronological Journey Timeline ({lead.timeline.length} Events)
              </h3>
              <span className="text-[11px] text-white/50 font-mono">
                First seen: {lead.first_seen.split('T')[0]} &bull; Last seen: {lead.last_seen.split('T')[0]}
              </span>
            </div>

            <div className="relative pl-6 space-y-4 border-l-2 border-white/10 ml-3">
              {lead.timeline.map((step, idx) => {
                return (
                  <div key={step.event_id} className="relative group">
                    {/* Bullet marker */}
                    <div className="absolute -left-[31px] top-1 w-6 h-6 rounded-full bg-[#0d112d] border-2 border-white/20 group-hover:border-cyan-400 flex items-center justify-center shadow-lg transition-colors">
                      {getStepIcon(step.event_type)}
                    </div>

                    <div className="bg-white/[0.04] hover:bg-white/[0.07] p-3.5 rounded-xl border border-white/10 transition-all space-y-1.5 backdrop-blur-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white capitalize text-xs">
                            {step.event_type.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] font-mono text-cyan-300 px-1.5 py-0.2 rounded bg-cyan-500/20 border border-cyan-500/30">
                            {step.event_id}
                          </span>
                          {step.is_late_arrival && (
                            <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Late Arrival Reordered
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-white/40 text-[11px]">
                          {step.timestamp.replace('T', ' ').replace('Z', ' UTC')}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/70">
                        {step.campaign && (
                          <span className="font-mono font-medium text-cyan-300 bg-cyan-500/15 border border-cyan-500/20 px-2 py-0.5 rounded">
                            Campaign: {step.campaign}
                          </span>
                        )}
                        <span className="capitalize bg-white/10 px-2 py-0.5 rounded text-white/80">
                          Source: {step.source.replace('_', ' ')}
                        </span>
                        {step.status && (
                          <span className="text-white/50">Status: {step.status}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Audit Logs for this Lead */}
          {auditTrail.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/10">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Audit Trail Decisions ({auditTrail.length})
              </h3>
              <div className="space-y-2">
                {auditTrail.map(a => (
                  <div key={a.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs space-y-1 backdrop-blur-md">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-cyan-300 font-mono">{a.decision_type}</span>
                      <span className="text-white/40 font-mono">{a.timestamp}</span>
                    </div>
                    <p className="text-white/80 leading-relaxed">{a.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white/[0.04] border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-white/50 font-mono">Canonical ID: {lead.lead_id}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-xl font-semibold hover:bg-cyan-500/30 transition-all shadow-lg"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};
