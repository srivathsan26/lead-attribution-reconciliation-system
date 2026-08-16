import React, { useState } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  RefreshCw,
  Sparkles,
  Download,
  Info,
} from 'lucide-react';
import { ValidationError } from '../types.js';

interface ImportViewProps {
  validationErrors: ValidationError[];
  onImportData: (payload: { raw_text?: string; events?: any[] }) => Promise<boolean>;
  onResetSampleData: () => void;
  isProcessing: boolean;
}

export const ImportView: React.FC<ImportViewProps> = ({
  validationErrors,
  onImportData,
  onResetSampleData,
  isProcessing,
}) => {
  const [rawText, setRawText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileUpload = (file: File) => {
    setFileName(`${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    const reader = new FileReader();
    reader.onload = e => {
      const content = e.target?.result as string;
      setRawText(content || '');
    };
    reader.onerror = () => {
      setFileName('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!rawText.trim() || isProcessing || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onImportData({ raw_text: rawText });
    } catch {
      // Handled in parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeLoading = isProcessing || isSubmitting;

  return (
    <div className="space-y-6 pb-12">
      {/* Upload Box & Manual Input */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Drag and Drop & Controls */}
        <div className="lg:col-span-6 bg-white/[0.04] backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Import Touchpoint Dataset
              </h3>
              <button
                type="button"
                onClick={onResetSampleData}
                disabled={isProcessing}
                className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 flex items-center gap-1 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Reload Sample Fixture
              </button>
            </div>

            {/* Drag & drop area */}
            <div
              onDragOver={e => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`p-8 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer backdrop-blur-md ${
                dragOver
                  ? 'border-cyan-400 bg-cyan-500/15'
                  : 'border-white/15 hover:border-white/30 bg-white/[0.02]'
              }`}
              onClick={() => document.getElementById('file-upload-input')?.click()}
            >
              <input
                id="file-upload-input"
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <UploadCloud className="w-10 h-10 text-cyan-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-white">
                {fileName ? fileName : 'Click to select or drag and drop a CSV or JSON file'}
              </div>
              <p className="text-[11px] text-white/50 mt-1">
                Supports standard touchpoint format with event_id, email, phone, timestamp, source, and campaign.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-white/50">
              Format: <code className="text-cyan-300 font-mono">.csv</code> or{' '}
              <code className="text-cyan-300 font-mono">.json</code>
            </span>
            <button
              onClick={handleSubmit}
              disabled={!rawText.trim() || activeLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] disabled:opacity-50"
            >
              {activeLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
                  <span>Validating & Ingesting...</span>
                </>
              ) : (
                <>
                  <FileCheck2 className="w-4 h-4 text-cyan-300" />
                  <span>Ingest & Reconcile Data</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Raw Text / JSON Preview */}
        <div className="lg:col-span-6 bg-white/[0.04] backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-3 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white tracking-tight">Raw Payload Editor</h3>
            {rawText && (
              <button
                onClick={() => {
                  setRawText('');
                  setFileName(null);
                }}
                className="text-xs text-white/40 hover:text-white/80 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <textarea
            id="textarea-raw-import"
            rows={10}
            placeholder='Paste CSV or JSON payload here... e.g.:
[
  {
    "event_id": "evt-101",
    "email": "user@domain.com",
    "source": "organic_search",
    "campaign": "seo-launch",
    "event_type": "page_visit",
    "timestamp": "2026-08-15T10:00:00Z"
  }
]'
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            className="w-full flex-1 p-3 text-xs font-mono bg-black/40 border border-white/10 text-emerald-400 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50 resize-none backdrop-blur-sm"
          />
        </div>
      </div>

      {/* Validation Errors & Schema Isolation Explorer */}
      <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-cyan-400" />
              Isolated Schema & Validation Errors ({validationErrors.length})
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              The engine automatically isolates malformed records to prevent pipeline crashes while continuing execution for valid touchpoints.
            </p>
          </div>
          {validationErrors.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              100% Clean Dataset
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <AlertTriangle className="w-3.5 h-3.5" />
              {validationErrors.length} Rejected Records
            </span>
          )}
        </div>

        {validationErrors.length === 0 ? (
          <div className="p-8 text-center bg-white/[0.02] rounded-xl border border-white/10 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <div className="text-xs font-bold text-white">No Validation Errors</div>
            <p className="text-xs text-white/50 max-w-md mx-auto">
              All touchpoint records passed schema type checks, required identifier validation, ISO timestamp formatting, and allowed event types.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.04] border-b border-white/10 text-white/60 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3">Event ID</th>
                  <th className="py-3 px-3">Field</th>
                  <th className="py-3 px-3">Error Type</th>
                  <th className="py-3 px-3">Diagnostic Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {validationErrors.map((err, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.05]">
                    <td className="py-2.5 px-3 font-bold text-white">{err.event_id}</td>
                    <td className="py-2.5 px-3 text-cyan-300">{err.field}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 font-sans">
                        {err.error_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-white/80 font-sans">{err.message}</td>
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
