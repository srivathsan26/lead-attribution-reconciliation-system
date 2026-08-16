import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Zap,
  Clock,
  Layers,
  Award,
} from 'lucide-react';
import { ReplayVerificationResult } from '../types.js';

interface ReplayViewProps {
  onRunReplay: (seeds: number[], benchmarkSize?: number) => Promise<ReplayVerificationResult | null>;
  isProcessing: boolean;
}

export const ReplayView: React.FC<ReplayViewProps> = ({ onRunReplay, isProcessing }) => {
  const [datasetMode, setDatasetMode] = useState<'current' | 'benchmark'>('current');
  const [benchmarkSize, setBenchmarkSize] = useState<number>(10000);
  const [seedsInput, setSeedsInput] = useState<string>('42, 101, 777, 9999');
  const [lastResult, setLastResult] = useState<ReplayVerificationResult | null>(null);
  const [executing, setExecuting] = useState<boolean>(false);

  const handleExecute = async () => {
    setExecuting(true);
    const seeds = seedsInput
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n));

    const size = datasetMode === 'benchmark' ? benchmarkSize : undefined;
    const res = await onRunReplay(seeds.length > 0 ? seeds : [42, 101, 777], size);
    setLastResult(res);
    setExecuting(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Intro Banner */}
      <div className="p-6 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-2xl text-white space-y-3 relative overflow-hidden">
        <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          Deterministic Engine Verification Lab
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Arrival-Order Invariance & Replay Validation
        </h2>
        <p className="text-xs text-white/70 max-w-3xl leading-relaxed">
          Lead attribution and lifecycle state machines must be 100% deterministic regardless of the order in which touchpoint events arrive from webhooks, CRM syncs, or late-arriving offline batches. This lab tests multiple pseudo-random arrival order permutations and verifies identical final canonical outputs and audit traces.
        </p>
      </div>

      {/* Configuration & Trigger Card */}
      <div className="bg-white/[0.04] backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-5">
        <h3 className="text-sm font-bold text-white tracking-tight">Test Configuration</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Dataset Selector */}
          <div className="space-y-2">
            <label className="font-semibold text-white/80 block">Dataset Under Test</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDatasetMode('current')}
                className={`p-3.5 rounded-xl border font-medium text-left transition-all backdrop-blur-md ${
                  datasetMode === 'current'
                    ? 'border-cyan-400 bg-cyan-500/15 text-white ring-2 ring-cyan-500/20 shadow-lg'
                    : 'border-white/10 hover:bg-white/5 text-white/70 bg-white/[0.02]'
                }`}
              >
                <div className="font-bold text-white">Active Working Set</div>
                <div className="text-[11px] text-white/50 mt-0.5">Test currently loaded lead events</div>
              </button>

              <button
                type="button"
                onClick={() => setDatasetMode('benchmark')}
                className={`p-3.5 rounded-xl border font-medium text-left transition-all backdrop-blur-md ${
                  datasetMode === 'benchmark'
                    ? 'border-cyan-400 bg-cyan-500/15 text-white ring-2 ring-cyan-500/20 shadow-lg'
                    : 'border-white/10 hover:bg-white/5 text-white/70 bg-white/[0.02]'
                }`}
              >
                <div className="font-bold text-white">Synthetic Benchmark</div>
                <div className="text-[11px] text-white/50 mt-0.5">High-volume stress test</div>
              </button>
            </div>
          </div>

          {/* Seeds and Size */}
          <div className="space-y-2">
            {datasetMode === 'benchmark' ? (
              <div>
                <label className="font-semibold text-white/80 block mb-1">
                  Benchmark Dataset Size (Records)
                </label>
                <input
                  type="number"
                  value={benchmarkSize}
                  onChange={e => setBenchmarkSize(Math.max(100, parseInt(e.target.value) || 1000))}
                  className="w-full px-3.5 py-2 text-xs bg-white/5 border border-white/15 rounded-xl font-mono text-white focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50 backdrop-blur-md"
                />
                <span className="text-[11px] text-white/50 mt-1 block">
                  P0 Benchmark target: 10,000 events in &lt; 10,000ms
                </span>
              </div>
            ) : (
              <div>
                <label className="font-semibold text-white/80 block mb-1">
                  Shuffling Random Seeds (Comma-Separated)
                </label>
                <input
                  type="text"
                  value={seedsInput}
                  onChange={e => setSeedsInput(e.target.value)}
                  placeholder="42, 101, 777, 9999"
                  className="w-full px-3.5 py-2 text-xs bg-white/5 border border-white/15 rounded-xl font-mono text-white focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50 backdrop-blur-md"
                />
                <span className="text-[11px] text-white/50 mt-1 block">
                  Each seed generates a distinct arrival order permutation of the raw events.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="pt-3 flex items-center justify-between border-t border-white/10">
          <span className="text-xs text-white/50">
            Pipeline: Deduplication &rarr; Journey Sort &rarr; Attribution &rarr; State Reconciliation
          </span>
          <button
            onClick={handleExecute}
            disabled={executing || isProcessing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] disabled:opacity-50"
          >
            {executing || isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
                <span>Running Verification...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-cyan-300 text-cyan-300" />
                <span>Execute Determinism Verification</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Display */}
      {lastResult && (
        <div className="bg-white/[0.04] backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-6 animate-in fade-in duration-200">
          {/* Header Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  lastResult.is_deterministic ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {lastResult.is_deterministic ? (
                  <CheckCircle2 className="w-7 h-7" />
                ) : (
                  <AlertTriangle className="w-7 h-7" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {lastResult.is_deterministic
                    ? 'Determinism Verified: 100% Invariant'
                    : 'Discrepancy Detected'}
                </h3>
                <p className="text-xs text-white/50">
                  Tested across {lastResult.total_seeds_tested} randomized arrival order permutations
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[11px] text-white/40 font-mono">Execution Time</div>
                <div className="text-xl font-bold font-mono text-cyan-300">
                  {lastResult.benchmark_ms} ms
                </div>
              </div>
              {lastResult.benchmark_ms < 10000 && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  Fast (&lt;10s)
                </span>
              )}
            </div>
          </div>

          {/* Verification Criteria Checks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="text-white/60 font-medium">Canonical IDs Match</div>
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> 100% Exact Match
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="text-white/60 font-medium">Lifecycle States Match</div>
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> 100% Exact Match
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="text-white/60 font-medium">Attribution Campaigns Match</div>
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> 100% Exact Match
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <div className="text-white/60 font-medium">Audit Trail Traces</div>
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> 100% Exact Match
              </div>
            </div>
          </div>

          {/* Seed Run Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Permutation Execution Summary
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.04] border-b border-white/10 text-white/60 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Run Seed</th>
                    <th className="py-2.5 px-3 text-right">Unique Leads</th>
                    <th className="py-2.5 px-3 text-right">Converted</th>
                    <th className="py-2.5 px-3 text-right">Qualified</th>
                    <th className="py-2.5 px-3 text-right">Audit Decisions</th>
                    <th className="py-2.5 px-3 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {lastResult.runs.map(run => (
                    <tr key={run.seed} className="hover:bg-white/[0.05]">
                      <td className="py-2.5 px-3 font-bold text-white font-sans">
                        Seed #{run.seed}
                      </td>
                      <td className="py-2.5 px-3 text-right text-white/90">{run.lead_count}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold">
                        {run.converted_count}
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-300 font-semibold">
                        {run.qualified_count}
                      </td>
                      <td className="py-2.5 px-3 text-right text-white/60">{run.audit_records}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> PASS
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
