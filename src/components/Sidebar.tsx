import React from 'react';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Search,
  History,
  RefreshCw,
  UploadCloud,
  Sliders,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'leads'
  | 'campaigns'
  | 'seo'
  | 'audit'
  | 'replay'
  | 'import'
  | 'config';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  conflictCount: number;
  validationErrorCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  conflictCount,
  validationErrorCount,
  isOpenMobile,
  onCloseMobile,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'leads',
      label: 'Leads Directory',
      icon: Users,
      badge: conflictCount > 0 ? `${conflictCount} Conflicts` : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    },
    { id: 'campaigns', label: 'Campaign Attribution', icon: BarChart3 },
    { id: 'seo', label: 'SEO Keyword Analysis', icon: Search },
    { id: 'audit', label: 'Audit Trail Explorer', icon: History },
    {
      id: 'replay',
      label: 'Replay & Determinism',
      icon: RefreshCw,
      badge: 'P0 Lab',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
    },
    {
      id: 'import',
      label: 'Import & Validation',
      icon: UploadCloud,
      badge: validationErrorCount > 0 ? `${validationErrorCount} Issues` : undefined,
      badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
    },
    { id: 'config', label: 'Attribution Rules', icon: Sliders },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-md transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#050714]/85 backdrop-blur-2xl text-slate-200 flex flex-col border-r border-white/10 shadow-2xl transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-white/10 gap-3">
          <img 
            src="/assets/images/logo.svg" 
            alt="LeadSync Logo" 
            className="w-9 h-9 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.35)]"
          />
          <div>
            <div className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
              LeadSync
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Core
              </span>
            </div>
            <p className="text-[11px] text-white/40 font-normal truncate max-w-[140px]">
              Attribution & State Engine
            </p>
          </div>
        </div>

        {/* Engine status indicator */}
        <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse" />
              Engine Status:
            </span>
            <span className="font-mono text-[11px] text-emerald-400 font-semibold">Deterministic</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto" aria-label="Main Navigation">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => {
                  onSelectTab(item.id as NavTab);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-white/10 text-cyan-300 border border-white/15 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                    : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-white/50'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40' : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* System Specs Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02] text-xs text-white/40 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/40">Processing Mode:</span>
            <span className="text-cyan-300 font-mono font-medium">P0 Deterministic</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/40">Attribution Rules:</span>
            <span className="text-indigo-300 font-mono font-medium">4-Tier Hierarchy</span>
          </div>
        </div>
      </aside>
    </>
  );
};
