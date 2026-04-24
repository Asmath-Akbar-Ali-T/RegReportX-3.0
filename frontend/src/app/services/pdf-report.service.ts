/**
 * PdfReportService
 *
 * Generates a comprehensive Regulatory Filing Certificate PDF.
 * Structure (4 pages):
 *   Page 1 — Administrative header, period params, metadata, compliance score gauge
 *   Page 2 — Risk metrics bar chart + details table
 *   Page 3 — Exception records donut chart + table with justification + data quality
 *   Page 4 — Filing audit trail + declaration & signatures
 *
 * Template colours (body): teal #0f766e / dark #111827 / gray #94a3b8
 * Charts (all colours): vibrant multi-colour palette
 */

import { Injectable } from '@angular/core';
import { Observable, forkJoin, of, from } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Chart from 'chart.js/auto';

import { RiskService }          from './risk.service';
import { ExceptionService }     from './exception.service';
import { AuditService }         from './audit.service';
import { DataQualityService }   from './data-quality.service';
import { RegReport }            from '../models/report.model';
import { RiskMetric }           from '../models/risk-metric.model';
import { ExceptionRecord }      from '../models/exception.model';
import { AuditLog }             from '../models/audit-log.model';
import { DataQualityIssue }     from '../models/data-quality.model';

interface ScoreDetails {
  label: string;
  rgb:   [number, number, number];
  bg:    [number, number, number];
}

// ── Template colour constants ──────────────────────────────────────────────────
const TEAL:       [number, number, number] = [15,  118, 110];
const TEAL_DARK:  [number, number, number] = [13,   94,  88];
const TEAL_MID:   [number, number, number] = [20,  184, 166];
const DARK:       [number, number, number] = [17,   24,  39];
const GRAY:       [number, number, number] = [148, 163, 184];
const LIGHT_BG:   [number, number, number] = [249, 250, 251];
const BORDER:     [number, number, number] = [226, 232, 240];
const WHITE:      [number, number, number] = [255, 255, 255];

@Injectable({ providedIn: 'root' })
export class PdfReportService {

  constructor(
    private riskService:        RiskService,
    private exceptionService:   ExceptionService,
    private auditService:       AuditService,
    private dataQualityService: DataQualityService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  //  Public API
  // ─────────────────────────────────────────────────────────────────────────────

  generate(report: RegReport, username: string): Observable<string> {
    const rid = Number(report.reportId);

    return forkJoin({
      metrics:       this.riskService.getMetrics()
                         .pipe(catchError(() => of([] as RiskMetric[]))),
      allExceptions: this.exceptionService.getAllExceptions()
                         .pipe(catchError(() => of([] as ExceptionRecord[]))),
      qualityIssues: this.dataQualityService.getOpenIssues()
                         .pipe(catchError(() => of([] as DataQualityIssue[]))),
      auditLogs:     this.auditService.getAuditLogs()
                         .pipe(catchError(() => of([] as AuditLog[]))),
    }).pipe(
      switchMap(({ metrics, allExceptions, qualityIssues, auditLogs }) => {
        const rptMetrics    = metrics.filter(m => m.report != null && Number(m.report.reportId) === rid);
        const rptExceptions = allExceptions.filter(e => Number((e.report as any)?.reportId) === rid);
        const rptAuditLogs  = this.filterAuditLogs(auditLogs, rid);
        return from(this.buildPDF(report, rptMetrics, rptExceptions, qualityIssues, rptAuditLogs, username));
      })
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  Audit log helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private filterAuditLogs(logs: AuditLog[], rid: number): AuditLog[] {
    const lifecycleActions = new Set([
      'GENERATE_REPORT', 'WORKFLOW_ADVANCE', 'APPROVE_REPORT_WITH_COMMENTS',
      'SUBMITTED_REPORT', 'FILED_REPORT', 'GENERATE_REPORT_EXCEPTIONS',
      'CALCULATE_RISK_METRICS', 'RESOLVED_EXCEPTION', 'RESOLVED_REPORT_EXCEPTION',
    ]);
    const direct = logs.filter(l =>
      l.metadata?.includes(String(rid)) || l.resource?.includes(String(rid))
    );
    return direct.length > 0 ? direct : logs.filter(l => lifecycleActions.has(l.action));
  }

  private auditActionLabel(action: string): string {
    const map: Record<string, string> = {
      'GENERATE_REPORT':              'Generated Report',
      'WORKFLOW_ADVANCE':             'Workflow Advanced',
      'APPROVE_REPORT_WITH_COMMENTS': 'Approved Report',
      'SUBMITTED_REPORT':             'Submitted Report',
      'FILED_REPORT':                 'Filed Report',
      'GENERATE_REPORT_EXCEPTIONS':   'Generated Exceptions',
      'CALCULATE_RISK_METRICS':       'Calculated Metrics',
      'RESOLVED_QUALITY_ISSUE':       'Resolved Quality Issue',
      'RESOLVED_EXCEPTION':           'Resolved Exception',
      'RESOLVED_REPORT_EXCEPTION':    'Resolved Exception',
    };
    return map[action] ?? action.replace(/_/g, ' ');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  Score helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private calculateScore(metrics: RiskMetric[], exceptions: ExceptionRecord[]): number {
    let score = 30; // Workflow complete (FILED state)

    if (metrics.length > 0) {
      score += 25;
      if (metrics.every(m => m.metricValue != null)) score += 10;
    }

    const open = exceptions.filter(e => e.status !== 'Resolved');
    if (open.length === 0) {
      score += 35;
    } else {
      const pen =
        open.filter(e => e.severity === 'HIGH').length   * 10 +
        open.filter(e => e.severity === 'MEDIUM').length *  5 +
        open.filter(e => e.severity === 'LOW').length    *  2;
      score += Math.max(0, 35 - pen);
    }

    return Math.min(100, score);
  }

  private getScoreDetails(score: number): ScoreDetails {
    if (score >= 85) return { label: 'EXCELLENT',    rgb: [22,  163,  74], bg: [240, 253, 250] };
    if (score >= 70) return { label: 'GOOD',         rgb: [37,   99, 235], bg: [239, 246, 255] };
    if (score >= 50) return { label: 'SATISFACTORY', rgb: [217, 119,   6], bg: [255, 251, 235] };
    return                  { label: 'NEEDS REVIEW', rgb: [220,  38,  38], bg: [254, 242, 242] };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  Date / period helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  private formatDateShort(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  private parsePeriod(period: string): { start: string; end: string; deadline: string } {
    const parts = period.split('-');
    if (parts.length !== 2 || !parts[1].startsWith('Q')) {
      return { start: period, end: period, deadline: '—' };
    }
    const year   = parseInt(parts[0], 10);
    const qNum   = parseInt(parts[1].replace('Q', ''), 10);
    const smIdx  = (qNum - 1) * 3; // 0-based start month
    const emIdx  = smIdx + 2;      // 0-based end month
    const start  = new Date(year, smIdx, 1);
    const end    = new Date(year, emIdx + 1, 0); // last day of end month
    const dl     = new Date(year, emIdx + 1, 30);
    const fmt    = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    return { start: fmt(start), end: fmt(end), deadline: fmt(dl) };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  Chart generators (off-screen canvas → data URL)
  // ─────────────────────────────────────────────────────────────────────────────

  private createGaugeChart(score: number, rgb: [number, number, number]): Promise<string> {
    return new Promise(resolve => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320; canvas.height = 185;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(''); return; }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx = 160, cy = 150, r = 115, lw = 22;

        // Background track
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI, 0, false);
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = lw; ctx.lineCap = 'round';
        ctx.stroke();

        // Score arc
        const endAngle = Math.PI + (Math.PI * score / 100);
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI, endAngle, false);
        ctx.strokeStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        ctx.lineWidth = lw; ctx.lineCap = 'round';
        ctx.stroke();

        // Tick marks at 25 / 50 / 75 %
        [0.25, 0.5, 0.75].forEach(pct => {
          const a  = Math.PI + Math.PI * pct;
          const x1 = cx + (r - 14) * Math.cos(a), y1 = cy + (r - 14) * Math.sin(a);
          const x2 = cx + (r + 6)  * Math.cos(a), y2 = cy + (r + 6)  * Math.sin(a);
          ctx.beginPath();
          ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
          ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.lineCap = 'butt';
          ctx.stroke();
        });

        // Score text
        ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        ctx.font = 'bold 56px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(String(score), cx, cy - 12);
        ctx.fillStyle = '#94a3b8'; ctx.font = '20px Arial';
        ctx.fillText('/ 100', cx, cy + 18);

        // End labels
        ctx.fillStyle = '#94a3b8'; ctx.font = '14px Arial'; ctx.textAlign = 'left';
        ctx.fillText('0', cx - r - lw, cy + 6);
        ctx.textAlign = 'right';
        ctx.fillText('100', cx + r + lw, cy + 6);

        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        console.error('[PDF] Gauge chart error:', e);
        resolve('');
      }
    });
  }

  private createRiskBarChart(metrics: RiskMetric[]): Promise<string> {
    if (metrics.length === 0) return Promise.resolve('');

    return new Promise(resolve => {
      const canvas = document.createElement('canvas');
      const barH   = 40;
      canvas.width  = 800;
      canvas.height = Math.max(220, metrics.length * barH + 80);
      canvas.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden';
      document.body.appendChild(canvas);

      const palette = ['#6366f1','#f43f5e','#10b981','#f59e0b','#3b82f6','#8b5cf6','#ec4899','#06b6d4'];

      try {
        const chart = new Chart(canvas, {
          type: 'bar',
          data: {
            labels: metrics.map(m => m.metricName ?? 'Unknown'),
            datasets: [{
              label: 'Metric Value',
              data:  metrics.map(m => Number(m.metricValue) || 0),
              backgroundColor: metrics.map((_, i) => palette[i % palette.length] + 'cc'),
              borderColor:     metrics.map((_, i) => palette[i % palette.length]),
              borderWidth: 2,
              borderRadius: 6,
            }],
          },
          options: {
            indexAxis: 'y',
            animation: { duration: 0 } as any,
            responsive: false,
            plugins: {
              legend:  { display: false },
              tooltip: { enabled: false },
            },
            scales: {
              x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#475569' } },
              y: { grid: { display: false },                       ticks: { color: '#334155' } },
            },
            layout: { padding: { left: 10, right: 20, top: 10, bottom: 10 } },
          } as any,
        });

        // Capture immediately — Chart.js renders synchronously with duration: 0
        const imgData = canvas.toDataURL('image/png');
        chart.destroy();
        if (document.body.contains(canvas)) document.body.removeChild(canvas);
        resolve(imgData);
      } catch (e) {
        console.error('[PDF] Bar chart error:', e);
        if (document.body.contains(canvas)) document.body.removeChild(canvas);
        resolve('');
      }
    });
  }

  private createExceptionDonutChart(exceptions: ExceptionRecord[]): Promise<string> {
    return new Promise(resolve => {
      const canvas = document.createElement('canvas');
      canvas.width  = 320;
      canvas.height = 320;
      canvas.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden';
      document.body.appendChild(canvas);

      const hi  = exceptions.filter(e => e.severity === 'HIGH').length;
      const md  = exceptions.filter(e => e.severity === 'MEDIUM').length;
      const lo  = exceptions.filter(e => e.severity === 'LOW').length;
      const res = exceptions.filter(e => e.status   === 'Resolved').length;
      const hasData = exceptions.length > 0;

      try {
        const chart = new Chart(canvas, {
          type: 'doughnut',
          data: {
            labels: hasData ? ['HIGH', 'MEDIUM', 'LOW', 'Resolved'] : ['All Clear'],
            datasets: [{
              data:            hasData ? [hi, md, lo, res] : [1],
              backgroundColor: hasData
                ? ['#ef4444', '#f97316', '#10b981', '#6366f1']
                : ['#6ee7b7'],
              borderWidth: 3,
              borderColor: '#ffffff',
              hoverOffset: 6,
            }],
          },
          options: {
            animation: { duration: 0 } as any,
            responsive: false,
            cutout: '62%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: { font: { size: 14 }, padding: 14, color: '#334155' },
              },
              tooltip: { enabled: false },
            },
          } as any,
        });

        const imgData = canvas.toDataURL('image/png');
        chart.destroy();
        if (document.body.contains(canvas)) document.body.removeChild(canvas);
        resolve(imgData);
      } catch (e) {
        console.error('[PDF] Donut chart error:', e);
        if (document.body.contains(canvas)) document.body.removeChild(canvas);
        resolve('');
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  PDF builder
  // ─────────────────────────────────────────────────────────────────────────────

  private async buildPDF(
    report:       RegReport,
    metrics:      RiskMetric[],
    exceptions:   ExceptionRecord[],
    qualityIssues: DataQualityIssue[],
    auditLogs:    AuditLog[],
    username:     string,
  ): Promise<string> {

    try {
    // Pre-generate all charts concurrently
    const score    = this.calculateScore(metrics, exceptions);
    const scoreDet = this.getScoreDetails(score);
    const [gaugeImg, barImg, donutImg] = await Promise.all([
      this.createGaugeChart(score, scoreDet.rgb),
      this.createRiskBarChart(metrics),
      this.createExceptionDonutChart(exceptions),
    ]);

    // ── jsPDF init ────────────────────────────────────────────────────────────
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = 210, ph = 297, ml = 15, mr = 15, cw = 180;

    const [sr, sg, sb] = scoreDet.rgb;
    const [br, bgc, bb] = scoreDet.bg;

    const now          = this.formatDate(new Date().toISOString());
    const nowShort     = this.formatDateShort(new Date().toISOString());
    const periodDates  = this.parsePeriod(report.period);
    const filingRef    = `RFC-${(report.period ?? '').replace('-', '')}-${report.reportId}-${new Date().getFullYear()}`;
    const reportType   = `${report.template?.frequency ?? ''} ${report.template?.regulationCode ?? ''} Report`.trim();
    const institution  = 'RegReportX Financial Institution';

    // ─────────────────────────────────── PAGE 1 ───────────────────────────────
    let y = 0;

    // ── [1] Header banner ─────────────────────────────────────────────────────
    doc.setFillColor(...TEAL_DARK);
    doc.rect(0, 0, pw, 38, 'F');
    doc.setFillColor(...TEAL_MID);
    doc.rect(0, 36, pw, 2, 'F');

    doc.setTextColor(...WHITE);
    doc.setFontSize(19); doc.setFont('helvetica', 'bold');
    doc.text('REGULATORY FILING CERTIFICATE', pw / 2, 14, { align: 'center' });

    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.setTextColor(153, 246, 228);
    doc.text('RegReportX v2.0  ·  Official Regulatory Filing Document  ·  CONFIDENTIAL', pw / 2, 22, { align: 'center' });

    doc.setFontSize(7.5); doc.setTextColor(134, 239, 172);
    doc.text('RegReportX — Regulatory Reporting Platform', ml, 30);
    doc.text(`Report #${report.reportId}  ·  ${report.period}  ·  ${reportType}`, pw - mr, 30, { align: 'right' });

    y = 40;

    // ── [2] Administrative info 4-column grid ─────────────────────────────────
    doc.setFillColor(...LIGHT_BG);
    doc.rect(ml, y, cw, 30, 'F');
    doc.setFillColor(...TEAL);
    doc.rect(ml, y, 3, 30, 'F');
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.rect(ml, y, cw, 30, 'S');

    const adminFields: [string, string][] = [
      ['Institution Name',   institution],
      ['Branch Code / IFSC', 'HQ-001 / CTSTIBXXX'],
      ['Report Type',        reportType || '—'],
      ['Filing Reference',   filingRef],
      ['Date of Generation', this.formatDateShort(report.generatedDate)],
      ['Filing Status',      'OFFICIALLY FILED'],
      ['Regulation Code',    report.template?.regulationCode || '—'],
      ['Frequency',          report.template?.frequency || '—'],
    ];
    const colW = cw / 4;
    adminFields.forEach(([label, val], i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const cx2 = ml + 5 + col * colW;
      const iy  = y + 7 + row * 13;
      doc.setTextColor(...GRAY);      doc.setFontSize(6); doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), cx2, iy);
      doc.setTextColor(...DARK);      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
      const truncated = val.length > 22 ? val.substring(0, 22) + '…' : val;
      doc.text(truncated, cx2, iy + 5);
    });
    y += 34;

    // ── [3] Reporting period strip ────────────────────────────────────────────
    doc.setFillColor(...TEAL);
    doc.rect(ml, y, cw, 8, 'F');
    doc.setTextColor(...WHITE); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text('REPORTING PERIOD PARAMETERS', ml + 5, y + 5.5);
    y += 10;

    doc.setFillColor(241, 245, 249);
    doc.rect(ml, y, cw, 18, 'F');
    doc.setDrawColor(...BORDER); doc.rect(ml, y, cw, 18, 'S');

    const periodFields: [string, string][] = [
      ['Period Start Date', periodDates.start],
      ['Period End Date',   periodDates.end],
      ['Currency Unit',     'INR — Indian Rupee'],
      ['Submission Deadline', periodDates.deadline],
    ];
    periodFields.forEach(([label, val], i) => {
      const px = ml + 5 + i * (cw / 4);
      doc.setTextColor(...GRAY); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), px, y + 6);
      doc.setTextColor(...TEAL); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(val, px, y + 13);
    });
    // Vertical dividers
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
    [1, 2, 3].forEach(i => {
      const dx = ml + i * (cw / 4);
      doc.line(dx, y + 2, dx, y + 16);
    });
    y += 22;

    // ── [4] Metadata (left 60%) + Compliance Score (right 40%) ───────────────
    const metaW  = Math.floor(cw * 0.59);
    const scoreW = cw - metaW - 3;
    const scoX   = ml + metaW + 3;

    // Metadata box
    doc.setFillColor(...LIGHT_BG);
    doc.rect(ml, y, metaW, 64, 'F');
    doc.setFillColor(...TEAL);
    doc.rect(ml, y, 3, 64, 'F');
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
    doc.rect(ml, y, metaW, 64, 'S');

    const metaFields: [string, string][] = [
      ['Report ID',        `#${report.reportId}`],
      ['Regulation Code',  report.template?.regulationCode || '—'],
      ['Reporting Period', report.period],
      ['Generated Date',   this.formatDate(report.generatedDate)],
      ['Filing Date',      now],
      ['Template Desc.',   (report.template?.description || '—').substring(0, 28)],
    ];
    const mColW = metaW / 2;
    metaFields.forEach(([label, val], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const mx  = ml + 7 + col * mColW;
      const my  = y + 10 + row * 17;
      doc.setTextColor(...GRAY);  doc.setFontSize(6);   doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), mx, my);
      doc.setTextColor(...DARK);  doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
      doc.text(val.length > 24 ? val.substring(0, 24) + '…' : val, mx, my + 5.5);
    });

    // Score card
    doc.setFillColor(br, bgc, bb);
    doc.rect(scoX, y, scoreW, 64, 'F');
    doc.setFillColor(sr, sg, sb);
    doc.rect(scoX, y, 3, 64, 'F');
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
    doc.rect(scoX, y, scoreW, 64, 'S');

    doc.setTextColor(...GRAY); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('COMPLIANCE SCORE', scoX + 6, y + 7);

    // Gauge chart image
    if (gaugeImg) {
      doc.addImage(gaugeImg, 'PNG', scoX + 5, y + 9, scoreW - 10, 35);
    }

    // Score label
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(sr, sg, sb);
    doc.text(scoreDet.label, scoX + 6, y + 51);

    // Progress bar
    const barX = scoX + 6, barW2 = scoreW - 12;
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(barX, y + 54, barW2, 4, 1.5, 1.5, 'F');
    doc.setFillColor(sr, sg, sb);
    doc.roundedRect(barX, y + 54, Math.max(3, barW2 * score / 100), 4, 1.5, 1.5, 'F');

    // Filed by
    doc.setTextColor(...GRAY); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.text('FILED BY', scoX + 6, y + 62);
    doc.setTextColor(...DARK); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text((username || 'Reporting Officer').substring(0, 20), scoX + 28, y + 62);

    y += 68;

    // ── [5] Status indicator strip ────────────────────────────────────────────
    doc.setFillColor(244, 245, 247);
    doc.rect(ml, y, cw, 13, 'F');
    doc.setFillColor(sr, sg, sb);
    doc.rect(ml, y, cw, 1.5, 'F');

    const openExc = exceptions.filter(e => e.status !== 'Resolved').length;
    const indicators: { ok: boolean; text: string }[] = [
      { ok: true,               text: 'Workflow Complete (FILED)' },
      { ok: metrics.length > 0, text: metrics.length > 0 ? `${metrics.length} Risk Metric${metrics.length !== 1 ? 's' : ''} Assessed` : 'Risk Metrics Pending' },
      { ok: openExc === 0,      text: openExc === 0 ? 'All Exceptions Resolved' : `${openExc} Open Exception${openExc !== 1 ? 's' : ''}` },
      { ok: qualityIssues.filter(i => i.status === 'OPEN').length === 0,
        text: qualityIssues.filter(i => i.status === 'OPEN').length === 0 ? 'Data Quality Verified' : `${qualityIssues.filter(i => i.status === 'OPEN').length} Quality Issues` },
    ];

    let indX = ml + 6;
    indicators.forEach(ind => {
      const [dr, dg, db] = ind.ok ? [22, 163, 74] : [220, 38, 38];
      doc.setFillColor(dr, dg, db);
      doc.circle(indX, y + 7, 1.6, 'F');
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
      doc.setTextColor(dr, dg, db);
      doc.text(ind.text, indX + 4, y + 8);
      indX += 4 + doc.getTextWidth(ind.text) + 9;
    });
    y += 17;

    // ── [6] 3-column quick-stats tiles ────────────────────────────────────────
    const tileW = (cw - 4) / 3;
    const tiles: { label: string; value: string; sub: string }[] = [
      {
        label: 'Risk Metrics',
        value: String(metrics.length),
        sub:   metrics.length > 0 ? 'Metrics calculated' : 'None calculated',
      },
      {
        label: 'Exception Records',
        value: String(exceptions.length),
        sub:   exceptions.filter(e => e.status === 'Resolved').length + ' resolved',
      },
      {
        label: 'Audit Events',
        value: String(auditLogs.length),
        sub:   'Lifecycle events tracked',
      },
    ];

    tiles.forEach((tile, i) => {
      const tx = ml + i * (tileW + 2);
      doc.setFillColor(...WHITE);
      doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
      doc.roundedRect(tx, y, tileW, 22, 2, 2, 'FD');
      doc.setFillColor(...TEAL);
      doc.roundedRect(tx, y, tileW, 4, 2, 2, 'F');
      doc.rect(tx, y + 2, tileW, 2, 'F');

      doc.setTextColor(...GRAY); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
      doc.text(tile.label.toUpperCase(), tx + 4, y + 9);
      doc.setTextColor(...DARK); doc.setFontSize(15); doc.setFont('helvetica', 'bold');
      doc.text(tile.value, tx + 4, y + 17);
      doc.setTextColor(...GRAY); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
      doc.text(tile.sub, tx + tileW - 4, y + 17, { align: 'right' });
    });
    y += 26;

    // ── [7] Validation & Accuracy Metrics (on page 1 if space allows) ─────────
    const openQuality   = qualityIssues.filter(i => i.status === 'OPEN').length;
    const totalQuality  = qualityIssues.length;
    const validStatus   = openQuality === 0 ? 'PASS' : 'REVIEW REQUIRED';
    const validColor: [number, number, number] = openQuality === 0 ? [22, 163, 74] : [220, 38, 38];

    // Section header
    doc.setFillColor(...TEAL);
    doc.rect(ml, y, cw, 9, 'F');
    doc.setTextColor(...WHITE); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('VALIDATION & ACCURACY METRICS', ml + 5, y + 6.2);
    y += 11;

    doc.setFillColor(...LIGHT_BG);
    doc.rect(ml, y, cw, 20, 'F');
    doc.setDrawColor(...BORDER); doc.rect(ml, y, cw, 20, 'S');
    doc.setFillColor(...TEAL);
    doc.rect(ml, y, 3, 20, 'F');

    const validFields: [string, string, boolean][] = [
      ['System Validation Status', validStatus, true],
      ['Total Quality Issues',     String(totalQuality), false],
      ['Open Issues',              String(openQuality),  false],
      ['Data Source',              'RegReportX v2.0 Ingestion Engine', false],
    ];
    const vColW = cw / 4;
    validFields.forEach(([label, val, highlight], i) => {
      const vx = ml + 6 + i * vColW;
      doc.setTextColor(...GRAY); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), vx, y + 7);
      if (highlight) {
        doc.setTextColor(...validColor);
      } else {
        doc.setTextColor(...DARK);
      }
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(val, vx, y + 14);
    });
    y += 24;

    // ── Page footers will be added after all pages are built ──────────────────

    // ─────────────────────────────────── PAGE 2 : Risk Metrics ───────────────
    doc.addPage();
    y = 15;

    this.drawSectionHeader(doc, ml, y, cw, 'RISK METRICS ASSESSMENT', TEAL_DARK);
    y += 11;

    // Risk summary stats row
    doc.setFillColor(240, 253, 250);
    doc.rect(ml, y, cw, 14, 'F');
    doc.setDrawColor(167, 243, 208); doc.rect(ml, y, cw, 14, 'S');
    const riskStats: [string, string][] = [
      ['Metrics Calculated', String(metrics.length)],
      ['Complete Values',    String(metrics.filter(m => m.metricValue != null).length)],
      ['Score Contribution', metrics.length > 0 ? '35 / 35 pts' : '0 / 35 pts'],
      ['Calculation Date',   metrics[0] ? this.formatDateShort(metrics[0].calculationDate) : '—'],
    ];
    riskStats.forEach(([label, val], i) => {
      const rx = ml + 5 + i * (cw / 4);
      doc.setTextColor(...GRAY); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), rx, y + 5);
      doc.setTextColor(...TEAL); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(val, rx, y + 11.5);
    });
    y += 18;

    // Bar chart
    if (barImg && metrics.length > 0) {
      const chartH = Math.min(70, Math.max(30, metrics.length * 10 + 20));
      doc.setFillColor(...WHITE);
      doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
      doc.rect(ml, y, cw, chartH + 6, 'FD');
      doc.setTextColor(...GRAY); doc.setFontSize(6.5); doc.setFont('helvetica', 'italic');
      doc.text('Risk Metric Values (Horizontal Bar Chart)', ml + 4, y + 4.5);
      doc.addImage(barImg, 'PNG', ml + 2, y + 6, cw - 4, chartH);
      y += chartH + 12;
    }

    // Risk metrics table
    if (metrics.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['#', 'Metric Name', 'Measured Value', 'Calculated On', 'Status']],
        body: metrics.map((m, i) => [
          String(i + 1),
          m.metricName,
          typeof m.metricValue === 'number' ? m.metricValue.toFixed(4) : String(m.metricValue ?? '—'),
          m.calculationDate ? this.formatDate(m.calculationDate) : '—',
          m.metricValue != null ? 'Recorded' : 'Pending',
        ]),
        margin:             { left: ml, right: mr },
        headStyles:         { fillColor: [20, 83, 45], textColor: WHITE, fontStyle: 'bold', fontSize: 8.5, cellPadding: 3 },
        bodyStyles:         { fontSize: 8.5, cellPadding: 2.8 },
        alternateRowStyles: { fillColor: [240, 253, 250] },
        tableLineColor:     [167, 243, 208],
        tableLineWidth:     0.2,
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          2: { cellWidth: 40, halign: 'right' },
          3: { cellWidth: 52 },
          4: { cellWidth: 28, halign: 'center' },
        },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 4) {
            data.cell.styles.textColor = [22, 163, 74];
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
    } else {
      doc.setFillColor(240, 253, 250);
      doc.rect(ml, y, cw, 14, 'F');
      doc.setTextColor(...GRAY); doc.setFontSize(8.5); doc.setFont('helvetica', 'italic');
      doc.text('No risk metrics have been calculated for this report.', ml + 5, y + 9);
      y += 20;
    }

    // ── Core Compliance Metrics Summary table (from risk metrics, formatted as financial table)
    if (metrics.length > 0) {
      if (y > ph - 50) { doc.addPage(); y = 15; }
      this.drawSectionHeader(doc, ml, y, cw, 'CORE COMPLIANCE METRICS SUMMARY', TEAL);
      y += 11;

      autoTable(doc, {
        startY: y,
        head: [['S.No', 'Category', 'Metric Particulars', 'Measured Value', 'Reference Baseline', 'Variance', 'Status']],
        body: metrics.map((m, i) => {
          const category = m.metricName.includes('Ratio') ? 'Ratio Metric'
                         : m.metricName.includes('Capital') ? 'Capital'
                         : m.metricName.includes('Liquidity') ? 'Liquidity'
                         : m.metricName.includes('Risk') ? 'Risk'
                         : 'Compliance';
          const baseline = 100.0;
          const variance = m.metricValue != null ? (m.metricValue - baseline).toFixed(4) : '—';
          return [
            String(i + 1),
            category,
            m.metricName,
            m.metricValue != null ? m.metricValue.toFixed(4) : '—',
            baseline.toFixed(4),
            variance,
            m.metricValue != null ? 'Verified' : 'Pending',
          ];
        }),
        margin:             { left: ml, right: mr },
        headStyles:         { fillColor: TEAL, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5, cellPadding: 2.5 },
        bodyStyles:         { fontSize: 7.5, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: [240, 253, 250] },
        tableLineColor:     [167, 243, 208],
        tableLineWidth:     0.2,
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          3: { cellWidth: 32, halign: 'right' },
          4: { cellWidth: 32, halign: 'right' },
          5: { cellWidth: 28, halign: 'right' },
          6: { cellWidth: 24, halign: 'center' },
        },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
    }

    // ─────────────────────────────── PAGE 3 : Exceptions + Data Quality ───────
    doc.addPage();
    y = 15;

    this.drawSectionHeader(doc, ml, y, cw, 'EXCEPTION RECORDS', [154, 52, 18]);
    y += 11;

    // Exception summary + donut side-by-side
    const hi = exceptions.filter(e => e.severity === 'HIGH').length;
    const md = exceptions.filter(e => e.severity === 'MEDIUM').length;
    const lo = exceptions.filter(e => e.severity === 'LOW').length;
    const resolved = exceptions.filter(e => e.status === 'Resolved').length;

    const donutW = 60, donutH = 60;
    const summaryX = ml + donutW + 5;
    const summaryW = cw - donutW - 5;

    // Donut chart
    if (donutImg) {
      doc.setFillColor(...WHITE);
      doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
      doc.rect(ml, y, donutW, donutH, 'FD');
      doc.addImage(donutImg, 'PNG', ml + 1, y + 1, donutW - 2, donutH - 2);
    }

    // Summary grid next to donut
    doc.setFillColor(255, 247, 237);
    doc.rect(summaryX, y, summaryW, donutH, 'F');
    doc.setFillColor(154, 52, 18);
    doc.rect(summaryX, y, 3, donutH, 'F');
    doc.setDrawColor(254, 215, 170);
    doc.rect(summaryX, y, summaryW, donutH, 'S');

    const excSummary: [string, string, [number,number,number]][] = [
      ['Total Exceptions',  String(exceptions.length), DARK],
      ['HIGH Severity',     String(hi),                [220, 38, 38]],
      ['MEDIUM Severity',   String(md),                [234, 88, 12]],
      ['LOW Severity',      String(lo),                [22, 163, 74]],
      ['Resolved',          String(resolved),           [22, 163, 74]],
      ['Open / Unresolved', String(exceptions.length - resolved), [220, 38, 38]],
    ];
    const halfCol = summaryW / 2;
    excSummary.forEach(([label, val, color], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const ex = summaryX + 6 + col * halfCol;
      const ey = y + 10 + row * 16;
      doc.setTextColor(...GRAY); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), ex, ey);
      doc.setTextColor(...color); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text(val, ex, ey + 6.5);
    });
    y += donutH + 6;

    // Exceptions table (includes Justification / Resolution column)
    if (exceptions.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['#', 'Field', 'Issue Description', 'Severity', 'Status', 'Resolution / Justification']],
        body: exceptions.map((e, i) => {
          // Extract readable justification from "Accepted Risk | Reason: {text}" format
          const rawJust = e.justification ?? '';
          const justMatch = rawJust.includes('Reason:') ? rawJust.split('Reason:')[1]?.trim() : rawJust;
          return [
            String(i + 1),
            e.templateField?.fieldName || '—',
            e.issue || '—',
            e.severity || '—',
            e.status || '—',
            justMatch || (e.status === 'Resolved' ? 'Resolved — no notes' : 'Pending resolution'),
          ];
        }),
        margin:             { left: ml, right: mr },
        headStyles:         { fillColor: [120, 53, 15], textColor: WHITE, fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
        bodyStyles:         { fontSize: 7.5, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: [255, 247, 237] },
        tableLineColor:     [254, 215, 170],
        tableLineWidth:     0.2,
        columnStyles: {
          0: { cellWidth: 8,  halign: 'center' },
          1: { cellWidth: 28 },
          3: { cellWidth: 22, halign: 'center' },
          4: { cellWidth: 24, halign: 'center' },
          5: { cellWidth: 'auto' },
        },
        didParseCell: (data: any) => {
          if (data.section === 'body') {
            if (data.column.index === 3) {
              const sev = String(data.cell.raw);
              if (sev === 'HIGH')   { data.cell.styles.textColor = [220, 38,  38]; data.cell.styles.fontStyle = 'bold'; }
              if (sev === 'MEDIUM') { data.cell.styles.textColor = [234, 88,  12]; data.cell.styles.fontStyle = 'bold'; }
              if (sev === 'LOW')    { data.cell.styles.textColor = [22,  163, 74]; data.cell.styles.fontStyle = 'bold'; }
            }
            if (data.column.index === 4) {
              const st = String(data.cell.raw);
              if (st === 'Resolved') { data.cell.styles.textColor = [22, 163, 74]; data.cell.styles.fontStyle = 'bold'; }
              if (st === 'Open')     { data.cell.styles.textColor = [220, 38, 38]; }
            }
          }
        },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
    } else {
      doc.setFillColor(255, 247, 237);
      doc.rect(ml, y, cw, 14, 'F');
      doc.setTextColor(...GRAY); doc.setFontSize(8.5); doc.setFont('helvetica', 'italic');
      doc.text('No exception records at the time of filing.', ml + 5, y + 9);
      y += 20;
    }

    // ── Data Quality section ──────────────────────────────────────────────────
    if (y > ph - 60) { doc.addPage(); y = 15; }
    this.drawSectionHeader(doc, ml, y, cw, 'DATA VALIDATION & QUALITY METRICS', [67, 56, 202]);
    y += 11;

    // Quality summary strip
    const openQ     = qualityIssues.filter(i => i.status === 'OPEN').length;
    const resolvedQ = qualityIssues.filter(i => i.status === 'RESOLVED').length;
    const waivedQ   = qualityIssues.filter(i => i.status === 'WAIVED').length;

    doc.setFillColor(238, 242, 255);
    doc.rect(ml, y, cw, 14, 'F');
    doc.setDrawColor(199, 210, 254); doc.rect(ml, y, cw, 14, 'S');
    const qStats: [string, string][] = [
      ['Total Issues',    String(qualityIssues.length)],
      ['Open',            String(openQ)],
      ['Resolved',        String(resolvedQ)],
      ['Waived',          String(waivedQ)],
    ];
    qStats.forEach(([label, val], i) => {
      const qx = ml + 5 + i * (cw / 4);
      doc.setTextColor(...GRAY); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), qx, y + 5);
      doc.setTextColor(67, 56, 202); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text(val, qx, y + 11.5);
    });
    y += 18;

    if (qualityIssues.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['#', 'Validation Rule', 'Issue Message', 'Severity', 'Status', 'Logged Date']],
        body: qualityIssues.map((q, i) => [
          String(i + 1),
          (q.rule as any)?.ruleName || '—',
          q.message || '—',
          q.severity || '—',
          q.status || '—',
          q.loggedDate ? this.formatDate(q.loggedDate) : '—',
        ]),
        margin:             { left: ml, right: mr },
        headStyles:         { fillColor: [49, 46, 129], textColor: WHITE, fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
        bodyStyles:         { fontSize: 7.5, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: [238, 242, 255] },
        tableLineColor:     [199, 210, 254],
        tableLineWidth:     0.2,
        columnStyles: {
          0: { cellWidth: 8,  halign: 'center' },
          3: { cellWidth: 22, halign: 'center' },
          4: { cellWidth: 24, halign: 'center' },
          5: { cellWidth: 42 },
        },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 3) {
            const sev = String(data.cell.raw);
            if (sev === 'HIGH')   data.cell.styles.textColor = [220, 38,  38];
            if (sev === 'MEDIUM') data.cell.styles.textColor = [234, 88,  12];
            if (sev === 'LOW')    data.cell.styles.textColor = [22,  163, 74];
          }
        },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
    } else {
      doc.setFillColor(238, 242, 255);
      doc.rect(ml, y, cw, 14, 'F');
      doc.setTextColor(...GRAY); doc.setFontSize(8.5); doc.setFont('helvetica', 'italic');
      doc.text('No data quality issues recorded for this reporting period.', ml + 5, y + 9);
      y += 20;
    }

    // ─────────────────────────── PAGE 4 : Audit Trail + Declaration ──────────
    doc.addPage();
    y = 15;

    // ── Audit trail ───────────────────────────────────────────────────────────
    this.drawSectionHeader(doc, ml, y, cw, 'FILING AUDIT TRAIL', [49, 46, 129]);
    y += 11;

    if (auditLogs.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Timestamp', 'User', 'Role', 'Action', 'Details / Metadata']],
        body: auditLogs.map(log => [
          log.timestamp ? this.formatDate(log.timestamp) : '—',
          log.user?.name || 'System',
          log.user?.role || '—',
          this.auditActionLabel(log.action),
          log.metadata || '—',
        ]),
        margin:             { left: ml, right: mr },
        headStyles:         { fillColor: [49, 46, 129], textColor: WHITE, fontStyle: 'bold', fontSize: 8.5, cellPadding: 3 },
        bodyStyles:         { fontSize: 8, cellPadding: 2.8 },
        alternateRowStyles: { fillColor: [238, 242, 255] },
        tableLineColor:     [199, 210, 254],
        tableLineWidth:     0.2,
        columnStyles: {
          0: { cellWidth: 38 },
          1: { cellWidth: 28 },
          2: { cellWidth: 30 },
          3: { cellWidth: 38 },
          4: { cellWidth: 'auto' },
        },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
    } else {
      doc.setFillColor(238, 242, 255);
      doc.rect(ml, y, cw, 14, 'F');
      doc.setTextColor(...GRAY); doc.setFontSize(8.5); doc.setFont('helvetica', 'italic');
      doc.text('No audit trail records available for this report.', ml + 5, y + 9);
      y += 20;
    }

    // ── Signature & Footer block ───────────────────────────────────────────────
    if (y > ph - 72) { doc.addPage(); y = 15; }

    // Find approval authority from audit logs
    const approverLog = auditLogs.find(l =>
      l.action === 'APPROVE_REPORT_WITH_COMMENTS' || l.action === 'WORKFLOW_ADVANCE'
    );
    const approver = approverLog?.user?.name || 'Compliance Officer';

    doc.setFillColor(br, bgc, bb);
    doc.rect(ml, y, cw, 58, 'F');
    doc.setFillColor(sr, sg, sb);
    doc.rect(ml, y, 3, 58, 'F');
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
    doc.rect(ml, y, cw, 58, 'S');

    doc.setTextColor(sr, sg, sb); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('FILING DECLARATION', ml + 8, y + 9);

    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(55, 65, 81);
    const decLines = [
      `This certifies that Report #${report.reportId} for period ${report.period} under`,
      `regulation ${report.template?.regulationCode || '—'} has been officially filed with`,
      `the regulatory authority via RegReportX v2.0 on ${nowShort}.`,
      `Compliance Score: ${score}/100 (${scoreDet.label})  |  Confidentiality: CONFIDENTIAL`,
    ];
    decLines.forEach((line, i) => doc.text(line, ml + 8, y + 19 + i * 6.5));

    // Signature columns
    const sigCols = [
      { label: 'Generated By',       name: username || 'Reporting Officer',   role: 'Reporting Officer' },
      { label: 'Approval Authority',  name: approver,                          role: 'Compliance/Risk Officer' },
      { label: 'Confidentiality',     name: 'CONFIDENTIAL',                    role: 'For Regulatory Use Only' },
    ];
    const sigW = cw / 3;
    sigCols.forEach((sig, i) => {
      const sx = ml + 8 + i * sigW;
      doc.setDrawColor(209, 213, 219); doc.setLineWidth(0.3);
      doc.line(sx, y + 46, sx + sigW - 10, y + 46);
      doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY);
      doc.text(sig.label.toUpperCase(), sx, y + 50);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(sr, sg, sb);
      doc.text((sig.name).substring(0, 22), sx, y + 55);
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(107, 114, 128);
      doc.text(sig.role, sx, y + 59.5);
    });
    y += 64;

    // ─────────────────────────────────── FOOTERS ─────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(...DARK);
      doc.rect(0, ph - 10, pw, 10, 'F');
      doc.setFillColor(...TEAL);
      doc.rect(0, ph - 10, pw, 1.5, 'F');
      doc.setTextColor(156, 163, 175); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.text(
        `RegReportX v2.0  |  CONFIDENTIAL — Regulatory Use Only  |  ${filingRef}  |  ${nowShort}`,
        ml, ph - 3.5
      );
      doc.text(`Page ${p} of ${totalPages}`, pw - mr, ph - 3.5, { align: 'right' });

      // Page label
      const pageLabels: Record<number, string> = {
        1: 'ADMINISTRATIVE SUMMARY',
        2: 'RISK METRICS',
        3: 'EXCEPTIONS & DATA QUALITY',
        4: 'AUDIT TRAIL & DECLARATION',
      };
      const lbl = pageLabels[p] ?? `SECTION ${p}`;
      doc.setTextColor(...TEAL); doc.setFontSize(6); doc.setFont('helvetica', 'bold');
      doc.text(lbl, pw / 2, ph - 3.5, { align: 'center' });
    }

    // ── Save & return filename ─────────────────────────────────────────────────
    const filename = `RegReport_${report.reportId}_${report.period}_FILED.pdf`;
    doc.save(filename);
    return filename;

    } catch (e) {
      console.error('[PDF] buildPDF error:', e);
      throw e;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  Drawing utilities
  // ─────────────────────────────────────────────────────────────────────────────

  private drawSectionHeader(
    doc: jsPDF,
    x: number, y: number, w: number,
    title: string,
    color: [number, number, number],
  ): void {
    doc.setFillColor(...color);
    doc.rect(x, y, w, 9, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(title, x + 5, y + 6.2);
  }
}
