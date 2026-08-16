import React, { useState } from 'react';
import {
  Sliders,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Sparkles,
  ShieldAlert,
  Save,
  RotateCcw,
} from 'lucide-react';

interface ConfigViewProps {
  sourcePrecedence: string[];
  onUpdatePrecedence: (precedence: string[]) => Promise<void>;
  isProcessing: boolean;
}

export const ConfigView: React.FC<ConfigViewProps> = ({
  sourcePrecedence,
  onUpdatePrecedence,
  isProcessing,
}) => {
  const [currentOrder, setCurrentOrder] = useState<string[]>([...sourcePrecedence]);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...currentOrder];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;

    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;
    setCurrentOrder(newOrder);
  };

  const handleSave = async () => {
    await onUpdatePrecedence(currentOrder);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleReset = () => {
    const defaultOrder = ['organic_search', 'paid_search', 'email', 'social', 'website', 'manual'];
    setCurrentOrder(defaultOrder);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 4-Tier Attribution Rules Architecture */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            4-Tier Deterministic Attribution Hierarchy
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Every lead journey is evaluated top-to-bottom. The first satisfied rule unequivocally assigns primary attribution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-950">Rule 1: Conversion Event Campaign</span>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-200/60 text-indigo-900">
                Priority 1
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              If the lead has a conversion event (<code>converted</code>) containing an explicit campaign parameter, that campaign receives 100% primary attribution.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sky-950">Rule 2: Pre-Qualification Touchpoint</span>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-sky-200/60 text-sky-900">
                Priority 2
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              If the conversion event lacks a campaign, the latest valid campaign interaction occurring before or at lead qualification (<code>qualified</code>) is selected.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-950">Rule 3: Source Precedence Hierarchy</span>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200/60 text-amber-900">
                Priority 3
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              If multiple campaign touchpoints share the exact same timestamp or eligibility, the channel precedence order below determines the winning touchpoint.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">Rule 4: Lexicographical Campaign Tie-Break</span>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                Priority 4
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              If timestamp and source channel are identical, candidate campaign identifiers are sorted alphabetically (e.g., <code>alpha-ad</code> beats <code>beta-ad</code>).
            </p>
          </div>
        </div>
      </div>

      {/* Source Precedence Configurator */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Channel Source Precedence Ordering (Rule 3)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Re-order channels to prioritize touchpoints when timestamps collide.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Default
            </button>
            <button
              onClick={handleSave}
              disabled={isProcessing}
              className="text-xs font-bold px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  Saved & Reconciled!
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save & Apply Precedence
                </>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-2 max-w-xl">
          {currentOrder.map((src, idx) => (
            <div
              key={src}
              className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-mono text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="text-xs font-bold text-slate-900 capitalize">
                  {src.replace('_', ' ')}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveItem(idx, 'up')}
                  disabled={idx === 0}
                  aria-label={`Move ${src} up`}
                  className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 transition-colors"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveItem(idx, 'down')}
                  disabled={idx === currentOrder.length - 1}
                  aria-label={`Move ${src} down`}
                  className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 transition-colors"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lifecycle Progression Rules */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            Lifecycle State Machine & Anomaly Rejection
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict directional state graph: New &rarr; Contacted &rarr; Qualified &rarr; Converted / Lost.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="font-bold text-slate-900">Valid Transitions</div>
            <p className="text-slate-600 leading-relaxed">
              Leads progress unidirectionally forward through qualified touchpoints without loss of earned state.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
            <div className="font-bold text-amber-950">Invalid Transition Guard</div>
            <p className="text-amber-900 leading-relaxed">
              If an invalid transition occurs (e.g. Converted &rarr; New, or Lost &rarr; Converted), the engine flags a reconciliation conflict and retains the last valid state.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
            <div className="font-bold text-emerald-950">Audit Traceability</div>
            <p className="text-emerald-900 leading-relaxed">
              Every transition and prevented regression is permanently recorded in the audit log for complete explainability.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
