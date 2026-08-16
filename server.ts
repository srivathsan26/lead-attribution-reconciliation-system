import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { executeReconciliationPipeline } from './src/engine/pipeline.js';
import { runDeterminismReplayTest, generateBenchmarkDataset } from './src/engine/replay.js';
import {
  exportCampaignReportCSV,
  exportLeadsCSV,
  exportAuditCSV,
} from './src/engine/reporting.js';
import { exportSEOReportCSV } from './src/engine/seo.js';
import { DEFAULT_RAW_EVENTS, DEFAULT_SEO_DATA } from './src/data/defaultData.js';
import { RawEvent, PipelineResult, SEOKeywordRow } from './src/types.js';

const app = express();
const PORT = 3000;

// Middleware for parsing JSON and URL-encoded data with a generous body limit
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// In-memory state store (initialized with default fixture dataset)
let activeRawEvents: RawEvent[] = [...DEFAULT_RAW_EVENTS];
let activeSEOData: SEOKeywordRow[] = [...DEFAULT_SEO_DATA];
let activeCustomPrecedence: string[] = [
  'organic_search',
  'paid_search',
  'email',
  'social',
  'website',
  'manual',
];

// Helper to write output files to disk on the server
function saveOutputsToDisk(result: PipelineResult, outputDir = path.join(process.cwd(), 'output')) {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(outputDir, 'reconciled_leads.json'),
      JSON.stringify(result.leads, null, 2),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(outputDir, 'campaign_report.csv'),
      exportCampaignReportCSV(result.campaign_report),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(outputDir, 'audit_log.json'),
      JSON.stringify(result.audit_trail, null, 2),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(outputDir, 'validation_errors.json'),
      JSON.stringify(result.validation_errors, null, 2),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(outputDir, 'source_report.csv'),
      exportLeadsCSV(result.leads),
      'utf-8'
    );
    if (result.seo_report) {
      fs.writeFileSync(
        path.join(outputDir, 'seo_report.csv'),
        exportSEOReportCSV(result.seo_report),
        'utf-8'
      );
    }
  } catch (err) {
    console.error('Error writing pipeline output to disk:', err);
  }
}

// Initial pipeline execution
let activePipelineResult: PipelineResult = executeReconciliationPipeline(activeRawEvents, {
  customSourcePrecedence: activeCustomPrecedence,
  seoData: activeSEOData,
});
saveOutputsToDisk(activePipelineResult);

// ==========================================
// API ROUTES
// ==========================================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 1. Dashboard Overview
app.get('/api/dashboard', (req, res) => {
  try {
    const summary = activePipelineResult.summary;
    const leads = activePipelineResult.leads;
    const campaignReport = activePipelineResult.campaign_report;
    const sourceReport = activePipelineResult.source_report;
    const validationErrors = activePipelineResult.validation_errors;

    // Top performing campaign
    const topCampaign = campaignReport.length > 0 ? campaignReport[0] : null;
    const topSource = sourceReport.length > 0 ? sourceReport[0] : null;

    // State distribution
    const stateCounts: Record<string, number> = {
      New: 0,
      Contacted: 0,
      Qualified: 0,
      Converted: 0,
      Lost: 0,
    };
    leads.forEach(l => {
      stateCounts[l.current_state] = (stateCounts[l.current_state] || 0) + 1;
    });

    // Recent activity (latest 8 audit logs)
    const recentActivity = activePipelineResult.audit_trail.slice(-8).reverse();

    // Conflict leads
    const conflictLeads = leads.filter(l => l.has_conflict);

    res.json({
      success: true,
      data: {
        summary,
        top_campaign: topCampaign,
        top_source: topSource,
        state_distribution: stateCounts,
        campaign_performance: campaignReport.slice(0, 6),
        source_performance: sourceReport,
        recent_activity: recentActivity,
        conflict_count: conflictLeads.length,
        validation_error_count: validationErrors.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// 2. Leads List with search, filtering, and sorting
app.get('/api/leads', (req, res) => {
  try {
    let list = [...activePipelineResult.leads];
    const { search, status, source, campaign, conflict, duplicate, sort_by, sort_dir } = req.query;

    if (search && typeof search === 'string') {
      const q = search.toLowerCase().trim();
      list = list.filter(
        l =>
          l.lead_id.toLowerCase().includes(q) ||
          l.name.toLowerCase().includes(q) ||
          l.canonical_email.toLowerCase().includes(q) ||
          l.phone.toLowerCase().includes(q) ||
          l.attributed_campaign.toLowerCase().includes(q)
      );
    }

    if (status && typeof status === 'string' && status !== 'all') {
      list = list.filter(l => l.current_state.toLowerCase() === status.toLowerCase());
    }

    if (source && typeof source === 'string' && source !== 'all') {
      list = list.filter(l => l.attributed_source.toLowerCase() === source.toLowerCase());
    }

    if (campaign && typeof campaign === 'string' && campaign !== 'all') {
      list = list.filter(l => l.attributed_campaign.toLowerCase() === campaign.toLowerCase());
    }

    if (conflict === 'true') {
      list = list.filter(l => l.has_conflict);
    }

    if (duplicate === 'true') {
      list = list.filter(l => l.duplicate_count > 0);
    }

    // Sorting
    const sortKey = typeof sort_by === 'string' ? sort_by : 'lead_id';
    const isAsc = sort_dir === 'asc';

    list.sort((a: any, b: any) => {
      let valA = a[sortKey];
      let valB = b[sortKey];
      if (sortKey === 'score') {
        valA = a.score.score;
        valB = b.score.score;
      }
      if (typeof valA === 'string') {
        return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return isAsc ? (valA > valB ? 1 : -1) : valB > valA ? 1 : -1;
    });

    res.json({
      success: true,
      data: {
        total: list.length,
        leads: list,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// 3. Single Lead Detail
app.get('/api/leads/:leadId', (req, res) => {
  try {
    const leadId = decodeURIComponent(req.params.leadId);
    const lead = activePipelineResult.leads.find(l => l.lead_id === leadId);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: { code: 'LEAD_NOT_FOUND', message: `Lead with ID "${leadId}" was not found.` },
      });
    }

    // Lead-specific audit records
    const leadAudit = activePipelineResult.audit_trail.filter(a => a.lead_id === leadId);

    res.json({
      success: true,
      data: {
        lead,
        audit_trail: leadAudit,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// 4. Campaign Performance Report
app.get('/api/campaigns', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        campaigns: activePipelineResult.campaign_report,
        sources: activePipelineResult.source_report,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// 5. Audit Trail
app.get('/api/audit', (req, res) => {
  try {
    let logs = [...activePipelineResult.audit_trail];
    const { lead_id, decision_type, campaign, conflict_only } = req.query;

    if (lead_id && typeof lead_id === 'string') {
      const q = lead_id.toLowerCase();
      logs = logs.filter(a => a.lead_id.toLowerCase().includes(q));
    }

    if (decision_type && typeof decision_type === 'string' && decision_type !== 'all') {
      logs = logs.filter(a => a.decision_type === decision_type);
    }

    if (campaign && typeof campaign === 'string' && campaign !== 'all') {
      logs = logs.filter(
        a => a.selected_campaign && a.selected_campaign.toLowerCase() === campaign.toLowerCase()
      );
    }

    if (conflict_only === 'true') {
      logs = logs.filter(a => a.decision_type === 'STATE_CONFLICT');
    }

    res.json({
      success: true,
      data: {
        total: logs.length,
        audit_trail: logs,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// 6. SEO Keywords
app.get('/api/seo', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        keywords: activePipelineResult.seo_report || [],
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// 7. Config Management
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    data: {
      source_precedence: activeCustomPrecedence,
      supported_sources: ['organic_search', 'paid_search', 'email', 'social', 'website', 'manual'],
      supported_states: ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'],
      attribution_rules: [
        { id: '1', name: 'Conversion Campaign', description: 'Conversion event with campaign' },
        { id: '2', name: 'Pre-Qualification Touchpoint', description: 'Latest campaign before qualification' },
        { id: '3', name: 'Source Precedence', description: 'Precedence ordering on tied timestamp' },
        { id: '4', name: 'Lexicographic Tie-Break', description: 'Alphabetical campaign ID sorting' },
      ],
    },
  });
});

app.post('/api/config', (req, res) => {
  try {
    const { source_precedence } = req.body;
    if (Array.isArray(source_precedence) && source_precedence.length > 0) {
      activeCustomPrecedence = source_precedence;
      activePipelineResult = executeReconciliationPipeline(activeRawEvents, {
        customSourcePrecedence: activeCustomPrecedence,
        seoData: activeSEOData,
      });
      saveOutputsToDisk(activePipelineResult);
    }
    res.json({
      success: true,
      data: {
        source_precedence: activeCustomPrecedence,
        summary: activePipelineResult.summary,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// 8. Validation Errors endpoint
app.get('/api/validation-errors', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        errors: activePipelineResult.validation_errors,
        count: activePipelineResult.validation_errors.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// 9. Import / Ingestion endpoint
app.post('/api/import', (req, res) => {
  try {
    const { events, seo_data, raw_text } = req.body;

    let parsedEvents: RawEvent[] = [];

    if (Array.isArray(events)) {
      parsedEvents = events;
    } else if (raw_text && typeof raw_text === 'string') {
      const trimmed = raw_text.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          parsedEvents = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.events)) {
            parsedEvents = parsed.events;
          } else if (Array.isArray(parsed.raw_events)) {
            parsedEvents = parsed.raw_events;
          } else if (Array.isArray(parsed.data)) {
            parsedEvents = parsed.data;
          } else if (Array.isArray(parsed.records)) {
            parsedEvents = parsed.records;
          } else {
            parsedEvents = [parsed];
          }
        }
      } else {
        // Parse CSV text
        const lines = trimmed.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            const obj: Record<string, any> = {};
            headers.forEach((h, idx) => {
              obj[h] = cols[idx] !== undefined ? cols[idx] : '';
            });
            parsedEvents.push(obj);
          }
        }
      }
    }

    if (parsedEvents.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMPTY_PAYLOAD', message: 'No valid events found in import payload.' },
      });
    }

    activeRawEvents = parsedEvents;
    if (Array.isArray(seo_data)) {
      activeSEOData = seo_data;
    }

    activePipelineResult = executeReconciliationPipeline(activeRawEvents, {
      customSourcePrecedence: activeCustomPrecedence,
      seoData: activeSEOData,
    });
    saveOutputsToDisk(activePipelineResult);

    res.json({
      success: true,
      data: {
        summary: activePipelineResult.summary,
        leads_count: activePipelineResult.leads.length,
        validation_error_count: activePipelineResult.validation_errors.length,
        conflict_count: activePipelineResult.summary.reconciliation_conflicts,
      },
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'IMPORT_FAILED', message: `Import failed: ${err.message}` },
    });
  }
});

// 9. Reconcile Trigger
app.post('/api/reconcile', (req, res) => {
  try {
    const { load_sample, reset } = req.body;

    if (load_sample || reset) {
      activeRawEvents = [...DEFAULT_RAW_EVENTS];
      activeSEOData = [...DEFAULT_SEO_DATA];
    }

    activePipelineResult = executeReconciliationPipeline(activeRawEvents, {
      customSourcePrecedence: activeCustomPrecedence,
      seoData: activeSEOData,
    });
    saveOutputsToDisk(activePipelineResult);

    res.json({
      success: true,
      data: {
        summary: activePipelineResult.summary,
        leads: activePipelineResult.leads,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// 10. Replay Verification Endpoint
app.post('/api/replay', (req, res) => {
  try {
    const { seeds, benchmark_size } = req.body;

    let targetEvents = activeRawEvents;
    if (benchmark_size && typeof benchmark_size === 'number' && benchmark_size > 0) {
      targetEvents = generateBenchmarkDataset(benchmark_size);
    }

    const testSeeds = Array.isArray(seeds) && seeds.length > 0 ? seeds : [42, 101, 777, 9999];
    const result = runDeterminismReplayTest(targetEvents, testSeeds);

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// 11. Exports
app.get('/api/export/campaigns', (req, res) => {
  const csv = exportCampaignReportCSV(activePipelineResult.campaign_report);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="campaign_report.csv"');
  res.send(csv);
});

app.get('/api/export/leads', (req, res) => {
  const { format } = req.query;
  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="reconciled_leads.json"');
    return res.send(JSON.stringify(activePipelineResult.leads, null, 2));
  }
  const csv = exportLeadsCSV(activePipelineResult.leads);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="reconciled_leads.csv"');
  res.send(csv);
});

app.get('/api/export/audit', (req, res) => {
  const { format } = req.query;
  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_log.json"');
    return res.send(JSON.stringify(activePipelineResult.audit_trail, null, 2));
  }
  const csv = exportAuditCSV(activePipelineResult.audit_trail);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="audit_log.csv"');
  res.send(csv);
});

app.get('/api/export/seo', (req, res) => {
  const csv = exportSEOReportCSV(activePipelineResult.seo_report || []);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="seo_keywords.csv"');
  res.send(csv);
});

app.get('/api/export/validation_errors', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="validation_errors.json"');
  res.send(JSON.stringify(activePipelineResult.validation_errors, null, 2));
});

// ==========================================
// VITE MIDDLEWARE & SERVER BOOTSTRAP
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LeadSync Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
