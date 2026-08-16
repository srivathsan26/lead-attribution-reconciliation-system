import { SEOKeywordRow } from '../types.js';

export function processSEOKeywords(rawRows: any[]): SEOKeywordRow[] {
  const result: SEOKeywordRow[] = [];

  for (const raw of rawRows) {
    const keyword = String(raw.keyword || raw.Keyword || '').trim();
    if (!keyword) continue;

    const campaign = String(raw.campaign || raw.Campaign || '').trim();
    const impressions = Number(raw.impressions || raw.Impressions || 0);
    const clicks = Number(raw.clicks || raw.Clicks || 0);
    const leads = Number(raw.leads || raw.Leads || 0);
    const conversions = Number(raw.conversions || raw.Conversions || 0);

    const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0.0;
    const conversion_rate = leads > 0 ? Number(((conversions / leads) * 100).toFixed(2)) : 0.0;

    result.push({
      keyword,
      campaign,
      impressions,
      clicks,
      leads,
      conversions,
      ctr,
      conversion_rate,
    });
  }

  // Sort by conversions DESC, CTR DESC
  result.sort((a, b) => b.conversions - a.conversions || b.ctr - a.ctr);
  return result;
}

export function exportSEOReportCSV(rows: SEOKeywordRow[]): string {
  const header = '"Keyword","Campaign","Impressions","Clicks","Leads","Conversions","CTR (%)","Conversion Rate (%)"\n';
  const lines = rows.map(r =>
    `"${r.keyword.replace(/"/g, '""')}","${r.campaign.replace(/"/g, '""')}",${r.impressions},${r.clicks},${r.leads},${r.conversions},${r.ctr},${r.conversion_rate}`
  );
  return header + lines.join('\n');
}
