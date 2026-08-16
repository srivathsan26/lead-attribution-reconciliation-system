import React from 'react';
import { Menu, Play, RefreshCw, Download, Sparkles, CheckCircle2 } from 'lucide-react';
import { NavTab } from './Sidebar.js';

interface HeaderProps {
  currentTab: NavTab;
  onOpenMobileSidebar: () => void;
  onRunReconcile: () => void;
  onQuickReplay: () => void;
  onExportReport: (type: 'leads' | 'campaigns' | 'audit') => void;
  isProcessing: boolean;
  lastProcessedTime?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileSidebar,
  onRunReconcile,
  onQuickReplay,
  onExportReport,
  isProcessing,
  lastProcessedTime,
}) => {
  const titles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Executive Marketing Overview',
      subtitle: 'Deterministic lead reconciliation, lifecycle conversions & campaign performance metrics',
    },
    leads: {
      title: 'Canonical Leads Directory',
      subtitle: 'Reconstructed lead profiles with deduplicated interaction timelines and conflict flags',
    },
    campaigns: {
      title: 'Campaign Attribution Report',
      subtitle: 'Comparative campaign ROI, qualified conversions, and source attribution ranking',
    },
    seo: {
      title: 'SEO & Keyword Performance',
      subtitle: 'Organic keyword analytics, click-through rates, and downstream conversion attribution',
    },
    audit: {
      title: 'Audit Trail Explorer',
      subtitle: 'Complete explainability log detailing attribution choices, deduplication merges, and conflict detections',
    },
    replay: {
      title: 'Replay & Determinism Verification Lab',
      subtitle: 'Validate idempotency, arrival-order independence, and 10,000-event benchmark performance',
    },
    import: {
      title: 'Data Ingestion & Validation',
      subtitle: 'Import CSV/JSON touchpoint records with real-time schema validation and error isolation',
    },
    config: {
      title: 'Attribution & Reconciliation Rules',
      subtitle: 'Inspect and configure source precedence, attribution hierarchy, and lifecycle state rules',
    },
  };

  const currentInfo = titles[currentTab] || titles.dashboard;

  return (
    <header className="bg-[#050714]/70 backdrop-blur-2xl border-b border-white/10 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          aria-label="Open Navigation"
          className="lg:hidden p-2 rounded-xl text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            {currentInfo.title}
          </h1>
          <p className="text-xs text-white/50 hidden sm:block mt-0.5 max-w-2xl truncate">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2.5">
        {/* Quick Reconcile / Reload Default */}
        <button
          id="btn-reconcile-top"
          onClick={onRunReconcile}
          disabled={isProcessing}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 text-white hover:bg-white/20 active:bg-white/25 border border-white/15 disabled:opacity-50 transition-all backdrop-blur-md shadow-xs"
          title="Re-run reconciliation pipeline with sample or active records"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin text-cyan-400' : 'text-white/70'}`} />
          <span>{isProcessing ? 'Processing...' : 'Reconcile'}</span>
        </button>

        {/* Quick Replay Lab Test */}
        <button
          id="btn-quick-replay-top"
          onClick={onQuickReplay}
          disabled={isProcessing}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all shadow-[0_0_15px_rgba(74,222,128,0.15)] backdrop-blur-md"
          title="Verify determinism across shuffled arrival order permutations"
        >
          <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
          <span>Verify Determinism</span>
        </button>

        {/* Export Dropdown / Buttons */}
        <div className="relative group">
          <button
            id="btn-export-dropdown"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] backdrop-blur-md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Reports</span>
          </button>
          <div className="absolute right-0 mt-1.5 w-48 bg-[#0a0d24]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl py-1.5 hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-1 duration-150">
            <button
              onClick={() => onExportReport('campaigns')}
              className="w-full text-left px-4 py-2 text-xs text-white/80 hover:bg-white/10 font-medium flex items-center justify-between transition-colors"
            >
              <span>Campaign Report</span>
              <span className="text-[10px] text-cyan-400 font-mono">.csv</span>
            </button>
            <button
              onClick={() => onExportReport('leads')}
              className="w-full text-left px-4 py-2 text-xs text-white/80 hover:bg-white/10 font-medium flex items-center justify-between transition-colors"
            >
              <span>Reconciled Leads</span>
              <span className="text-[10px] text-cyan-400 font-mono">.csv</span>
            </button>
            <button
              onClick={() => onExportReport('audit')}
              className="w-full text-left px-4 py-2 text-xs text-white/80 hover:bg-white/10 font-medium flex items-center justify-between transition-colors"
            >
              <span>Audit Trail Logs</span>
              <span className="text-[10px] text-cyan-400 font-mono">.json</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
