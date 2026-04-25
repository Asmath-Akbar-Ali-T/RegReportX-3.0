/**
 * PdfReportService
 *
 * Generates a clean 3-page Regulatory Filing Report PDF.
 *
 * Page 1 — Header  ·  Summary Stats  ·  Risk Metrics (bar chart + table)
 * Page 2 — Exception Records  ·  Data Quality & Validation (sorted by severity)
 * Page 3 — Filing Workflow (step boxes)  ·  Filing Declaration
 *
 * Colour palette matches the app design system (styles.css):
 *   NAVY     #003366  — headers, section bars
 *   BLUE     #004b8d  — accents, active states
 *   BLUE_BG  #e6f0fa  — card backgrounds
 *   RED      #dc3545  — breach / high severity
 *   AMBER    #d97706  — medium severity
 *   GREEN    #28a745  — ok / low severity
 *   DARK     #2c3e50  — body text
 *   GRAY     #6c757d  — secondary text / labels
 *   BORDER   #dde2e8  — table & box borders
 *   LIGHT_BG #f4f6f9  — alternating rows / stat cards
 */

import { Injectable } from '@angular/core';
import { Observable, forkJoin, of, from } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { RiskService }        from './risk.service';
import { ExceptionService }   from './exception.service';
import { ReportService }      from './report.service';
import { DataQualityService } from './data-quality.service';
import { RegReport, FilingWorkflowStep } from '../models/report.model';
import { RiskMetric }         from '../models/risk-metric.model';
import { ExceptionRecord }    from '../models/exception.model';
import { DataQualityIssue }   from '../models/data-quality.model';

// ── Colour constants (matches app design system) ──────────────────────────────
const NAVY:     [number, number, number] = [  0,  51, 102];
const BLUE:     [number, number, number] = [  0,  75, 141];
const BLUE_BG:  [number, number, number] = [230, 240, 250];
const RED:      [number, number, number] = [220,  53,  69];
const GREEN:    [number, number, number] = [ 40, 167,  69];
const AMBER:    [number, number, number] = [217, 119,   6];
const DARK:     [number, number, number] = [ 44,  62,  80];
const GRAY:     [number, number, number] = [108, 117, 125];
const BORDER:   [number, number, number] = [221, 226, 232];
const LIGHT_BG: [number, number, number] = [244, 246, 249];
const WHITE:    [number, number, number] = [255, 255, 255];

@Injectable({ providedIn: 'root' })
export class PdfReportService {

  constructor(
    private riskService:        RiskService,
    private exceptionService:   ExceptionService,
    private reportService:      ReportService,
    private dataQualityService: DataQualityService,
  ) {}

  // ── Public API ───────────────────────────────────────────────────────────────

  generate(report: RegReport, username: string): Observable<string> {
    const rid = Number(report.reportId);

    return forkJoin({
      metrics:       this.riskService.getMetrics()
                         .pipe(catchError(() => of([] as RiskMetric[]))),
      allExceptions: this.exceptionService.getAllExceptions()
                         .pipe(catchError(() => of([] as ExceptionRecord[]))),
      qualityIssues: this.dataQualityService.getOpenIssues()
                         .pipe(catchError(() => of([] as DataQualityIssue[]))),
      workflowSteps: this.reportService.getWorkflow(rid)
                         .pipe(catchError(() => of([] as FilingWorkflowStep[]))),
    }).pipe(
      switchMap(({ metrics, allExceptions, qualityIssues, workflowSteps }) => {
        const rptMetrics    = metrics.filter(m => m.report != null && Number(m.report.reportId) === rid);
        const rptExceptions = allExceptions.filter(e => Number((e.report as any)?.reportId) === rid);
        return from(this.buildPDF(report, rptMetrics, rptExceptions, qualityIssues, workflowSteps, username));
      })
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private isMetricBreached(metric: RiskMetric): boolean {
    const name = (metric.metricName ?? '').toLowerCase();
    const val  = Number(metric.metricValue);
    if (isNaN(val)) return false;
    if (name.includes('crar') && val < 9)                          return true;
    if (name.includes('lcr')  && val < 100)                        return true;
    if ((name.includes('loan') && name.includes('deposit')) && val > 90) return true;
    if ((name.includes('net') && name.includes('gl')) && val < 0)  return true;
    return false;
  }

  private severityColor(severity: string): [number, number, number] {
    const s = (severity ?? '').toUpperCase();
    if (s === 'CRITICAL' || s === 'HIGH') return RED;
    if (s === 'MEDIUM')                   return AMBER;
    return GREEN;
  }

  private severityOrder(severity: string): number {
    const map: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return map[(severity ?? '').toUpperCase()] ?? 99;
  }

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

  private drawSectionHeader(
    doc: jsPDF, x: number, y: number, w: number, title: string,
  ): void {
    doc.setFillColor(...NAVY);
    doc.rect(x, y, w, 9, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(title, x + 5, y + 6.2);
  }

  /**
   * Draws one sector of a pie/donut chart using jsPDF line primitives.
   * Angles are in radians; 0 = 3 o'clock, -π/2 = 12 o'clock.
   */
  private drawPieSlice(
    doc: jsPDF,
    cx: number, cy: number, r: number,
    startAngle: number, endAngle: number,
    color: [number, number, number],
  ): void {
    const sweep = endAngle - startAngle;
    if (sweep < 0.005) return;
    if (sweep >= 2 * Math.PI - 0.005) {
      // Full circle — use the built-in method
      doc.setFillColor(...color);
      doc.circle(cx, cy, r, 'F');
      return;
    }
    const steps = Math.max(8, Math.ceil(sweep / (Math.PI / 18)));
    const segs: [number, number][] = [];
    // Center → first arc point
    segs.push([r * Math.cos(startAngle), r * Math.sin(startAngle)]);
    let px = cx + r * Math.cos(startAngle);
    let py = cy + r * Math.sin(startAngle);
    for (let i = 1; i <= steps; i++) {
      const a  = startAngle + sweep * (i / steps);
      const nx = cx + r * Math.cos(a);
      const ny = cy + r * Math.sin(a);
      segs.push([nx - px, ny - py]);
      px = nx; py = ny;
    }
    // Last arc point → center
    segs.push([cx - px, cy - py]);
    doc.setFillColor(...color);
    doc.lines(segs, cx, cy, [1, 1], 'F', true);
  }

  // ── PDF Builder ──────────────────────────────────────────────────────────────

  private async buildPDF(
    report:        RegReport,
    metrics:       RiskMetric[],
    exceptions:    ExceptionRecord[],
    qualityIssues: DataQualityIssue[],
    workflowSteps: FilingWorkflowStep[],
    username:      string,
  ): Promise<string> {
    try {
      const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw   = 210, ph = 297, ml = 15, mr = 15, cw = 180;
      const now  = this.formatDateShort(new Date().toISOString());
      const filingRef = `RFC-${(report.period ?? '').replace('-', '')}-${report.reportId}`;

      // ─────────────────────────────── PAGE 1 ──────────────────────────────────
      let y = 0;

      // ── [1] Header ───────────────────────────────────────────────────────────
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pw, 46, 'F');
      doc.setFillColor(...BLUE);
      doc.rect(0, 44, pw, 2, 'F');

      doc.setTextColor(...WHITE);
      doc.setFontSize(17);
      doc.setFont('helvetica', 'bold');
      doc.text('REGULATORY FILING REPORT', pw / 2, 14, { align: 'center' });

      const reportTitle = [
        report.template?.regulationCode,
        report.template?.description,
      ].filter(Boolean).join('  —  ') || 'Regulatory Report';
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(204, 224, 245);
      doc.text(reportTitle, pw / 2, 23, { align: 'center' });

      doc.setFontSize(7.5);
      doc.setTextColor(179, 210, 240);
      const headerLine = [
        `Report #${report.reportId}`,
        `Period: ${report.period}`,
        `Status: ${report.status}`,
        `Generated: ${this.formatDateShort(report.generatedDate)}`,
        `Frequency: ${report.template?.frequency ?? '—'}`,
      ].join('   |   ');
      doc.text(headerLine, pw / 2, 34, { align: 'center' });

      y = 50;

      // ── [2] Summary stat cards ────────────────────────────────────────────────
      const openExc  = exceptions.filter(e => e.status !== 'Resolved').length;
      const openQ    = qualityIssues.filter(i => i.status === 'OPEN').length;
      const cards: { label: string; value: string; sub: string }[] = [
        {
          label: 'RISK METRICS',
          value: String(metrics.length),
          sub:   metrics.length > 0 ? 'Calculated' : 'None yet',
        },
        {
          label: 'EXCEPTION RECORDS',
          value: String(exceptions.length),
          sub:   `${openExc} open`,
        },
        {
          label: 'DATA QUALITY ISSUES',
          value: String(qualityIssues.length),
          sub:   `${openQ} open`,
        },
      ];

      const cardW = (cw - 8) / 3;
      cards.forEach((card, i) => {
        const cx = ml + i * (cardW + 4);
        doc.setFillColor(...LIGHT_BG);
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.35);
        doc.roundedRect(cx, y, cardW, 22, 2, 2, 'FD');
        doc.setFillColor(...BLUE);
        doc.roundedRect(cx, y, cardW, 4, 2, 2, 'F');
        doc.rect(cx, y + 2, cardW, 2, 'F');

        doc.setTextColor(...GRAY);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text(card.label, cx + 5, y + 9);

        doc.setTextColor(...DARK);
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.text(card.value, cx + 5, y + 18);

        doc.setTextColor(...GRAY);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.text(card.sub, cx + cardW - 4, y + 18, { align: 'right' });
      });

      y += 27;

      // ── [3] Risk Metrics section ──────────────────────────────────────────────
      this.drawSectionHeader(doc, ml, y, cw, 'RISK METRICS');
      y += 11;

      if (metrics.length === 0) {
        doc.setFillColor(...LIGHT_BG);
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.3);
        doc.rect(ml, y, cw, 12, 'FD');
        doc.setTextColor(...GRAY);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('No risk metrics have been calculated for this report.', ml + 5, y + 8);
        y += 16;
      } else {
        autoTable(doc, {
          startY: y,
          head:   [['#', 'Metric Name', 'Value', 'Result']],
          body:   metrics.map((m, i) => {
            const breached = this.isMetricBreached(m);
            const rawVal   = m.metricValue != null ? Number(m.metricValue).toFixed(4) : '—';
            return [
              String(i + 1),
              (m.metricName ?? '—').replace(/_/g, ' '),
              rawVal,
              breached ? 'BREACH' : 'OK',
            ];
          }),
          margin:             { left: ml, right: mr },
          headStyles:         { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8, cellPadding: 2.5 },
          bodyStyles:         { fontSize: 8, cellPadding: 2.5 },
          alternateRowStyles: { fillColor: LIGHT_BG },
          tableLineColor:     BORDER,
          tableLineWidth:     0.3,
          columnStyles: {
            0: { cellWidth: 12, halign: 'center' },
            2: { cellWidth: 40, halign: 'right' },
            3: { cellWidth: 26, halign: 'center' },
          },
          didParseCell: (data: any) => {
            if (data.section === 'body') {
              const m = metrics[data.row.index];
              if (m && this.isMetricBreached(m)) {
                if (data.column.index === 2 || data.column.index === 3) {
                  data.cell.styles.textColor = RED;
                  data.cell.styles.fontStyle = 'bold';
                }
              }
              if (data.column.index === 3 && data.cell.raw === 'OK') {
                data.cell.styles.textColor = GREEN;
              }
            }
          },
        });
        y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
      }

      // ── [4] Two-column donut charts (fills remaining Page 1 space) ─────────────
      if (y <= ph - 122) {
        const colW   = (cw - 8) / 2;   // ~86 mm each
        const col1x  = ml;
        const col2x  = ml + colW + 8;
        const sColY  = y;
        const pieR   = 17;             // outer donut radius
        const holeR  = 8;              // inner cutout radius
        const pieCX1 = col1x + 22;
        const pieCX2 = col2x + 22;
        const pieCY  = sColY + 36;     // vertical centre shared by both
        const legX1  = col1x + 45;
        const legX2  = col2x + 45;
        const contentH = 51;           // chart area height

        // helper: draw a full donut column ────────────────────────────────────────
        const drawDonut = (
          colX: number, legX: number, pieCX: number,
          title: string,
          slices: { label: string; count: number; color: [number,number,number] }[],
          stripOpen: number, stripTotal: number, stripLabel: string,
        ) => {
          this.drawSectionHeader(doc, colX, sColY, colW, title);

          // Background rect
          doc.setFillColor(...LIGHT_BG); doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
          doc.rect(colX, sColY + 11, colW, contentH, 'FD');

          const total = slices.reduce((s, sl) => s + sl.count, 0);

          if (total === 0) {
            // Grey placeholder circle
            doc.setFillColor(221, 226, 232); doc.circle(pieCX, pieCY, pieR, 'F');
            doc.setTextColor(...GRAY); doc.setFontSize(6.5); doc.setFont('helvetica', 'italic');
            doc.text('No data', pieCX, pieCY + 2.5, { align: 'center' });
          } else {
            // Draw sectors
            let angle = -Math.PI / 2;
            slices.forEach(sl => {
              const sweep = (sl.count / total) * 2 * Math.PI;
              this.drawPieSlice(doc, pieCX, pieCY, pieR, angle, angle + sweep, sl.color);
              angle += sweep;
            });
            // White outer ring for clean edge
            doc.setDrawColor(...WHITE); doc.setLineWidth(0.8);
            doc.circle(pieCX, pieCY, pieR, 'S');
          }

          // Donut hole
          doc.setFillColor(...LIGHT_BG); doc.circle(pieCX, pieCY, holeR, 'F');
          // Total in centre
          doc.setTextColor(...DARK); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
          doc.text(String(total), pieCX, pieCY + 3, { align: 'center' });
          doc.setTextColor(...GRAY); doc.setFontSize(5); doc.setFont('helvetica', 'normal');
          doc.text('total', pieCX, pieCY + 7.5, { align: 'center' });

          // Legend
          slices.forEach((sl, i) => {
            const ly = sColY + 22 + i * 13;
            doc.setFillColor(...sl.color);
            doc.circle(legX + 2.5, ly + 1.5, 2.5, 'F');
            doc.setTextColor(...DARK); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
            doc.text(sl.label, legX + 7, ly + 2.5);
            doc.setTextColor(...sl.color); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
            doc.text(String(sl.count), colX + colW - 4, ly + 2.5, { align: 'right' });
          });

          // Open / Resolved strip
          const stripY = sColY + 11 + contentH + 2;
          doc.setFillColor(...BLUE_BG); doc.setDrawColor(...BLUE); doc.setLineWidth(0.4);
          doc.rect(colX, stripY, colW, 13, 'FD');
          doc.setFillColor(...BLUE); doc.rect(colX, stripY, 2.5, 13, 'F');
          doc.setTextColor(...GRAY); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
          doc.text('Open:', colX + 6, stripY + 5);
          doc.setTextColor(...RED); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
          doc.text(String(stripOpen), colX + 24, stripY + 5);
          doc.setTextColor(...GRAY); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
          doc.text('Resolved:', colX + 36, stripY + 5);
          doc.setTextColor(...GREEN); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
          doc.text(String(stripTotal - stripOpen), colX + 60, stripY + 5);
          doc.setTextColor(...GRAY); doc.setFontSize(5.5); doc.setFont('helvetica', 'normal');
          doc.text(stripLabel, colX + 6, stripY + 10.5);
        };

        // ─ Left: Exception Breakdown ─────────────────────────────────────────────
        drawDonut(col1x, legX1, pieCX1, 'EXCEPTION BREAKDOWN', [
          { label: 'CRITICAL / HIGH', count: exceptions.filter(e => ['CRITICAL','HIGH'].includes((e.severity ?? '').toUpperCase())).length, color: RED   },
          { label: 'MEDIUM',          count: exceptions.filter(e => (e.severity ?? '').toUpperCase() === 'MEDIUM').length,                  color: AMBER },
          { label: 'LOW',             count: exceptions.filter(e => (e.severity ?? '').toUpperCase() === 'LOW').length,                     color: GREEN },
        ], openExc, exceptions.length, `Total: ${exceptions.length} exception records`);

        // ─ Right: Data Quality Breakdown ─────────────────────────────────────────
        drawDonut(col2x, legX2, pieCX2, 'DATA QUALITY BREAKDOWN', [
          { label: 'ERROR / HIGH',     count: qualityIssues.filter(q => ['CRITICAL','ERROR','HIGH'].includes((q.severity ?? '').toUpperCase())).length, color: RED   },
          { label: 'WARNING / MEDIUM', count: qualityIssues.filter(q => ['WARNING','MEDIUM'].includes((q.severity ?? '').toUpperCase())).length,         color: AMBER },
          { label: 'LOW / INFO',       count: qualityIssues.filter(q => ['LOW','INFO'].includes((q.severity ?? '').toUpperCase())).length,               color: GREEN },
        ], openQ, qualityIssues.length, `Total: ${qualityIssues.length} quality issues`);

        y = sColY + 11 + contentH + 2 + 13 + 10;

        // ── [5] Compliance Risk Snapshot (full-width 4-tile strip) ───────────────
        if (y <= ph - 50) {
          this.drawSectionHeader(doc, ml, y, cw, 'COMPLIANCE RISK SNAPSHOT');
          y += 11;

          const breachedCount = metrics.filter(m => this.isMetricBreached(m)).length;
          const snapCards: { label: string; value: string; sub: string; accent: [number,number,number] }[] = [
            { label: 'METRICS BREACHED',   value: `${breachedCount} / ${metrics.length}`, sub: breachedCount > 0 ? 'Action Required'    : 'All Compliant',      accent: breachedCount > 0 ? RED   : GREEN },
            { label: 'OPEN EXCEPTIONS',    value: String(openExc),                        sub: openExc > 0      ? 'Pending Resolution'  : 'All Clear',          accent: openExc > 0      ? RED   : GREEN },
            { label: 'OPEN QUALITY ISSUES',value: String(openQ),                          sub: openQ > 0        ? 'Under Review'        : 'All Resolved',       accent: openQ > 0        ? AMBER : GREEN },
            { label: 'REPORT STATUS',      value: report.status ?? '—',                   sub: report.status === 'FILED' ? 'Filed with Regulator' : 'In Progress', accent: report.status === 'FILED' ? GREEN : BLUE  },
          ];

          const snapW = (cw - 12) / 4;
          snapCards.forEach((card, i) => {
            const sx = ml + i * (snapW + 4);
            doc.setFillColor(...LIGHT_BG); doc.setDrawColor(...card.accent); doc.setLineWidth(0.5);
            doc.roundedRect(sx, y, snapW, 22, 2, 2, 'FD');
            doc.setFillColor(...card.accent); doc.roundedRect(sx, y, snapW, 4, 2, 2, 'F');
            doc.rect(sx, y + 2, snapW, 2, 'F');
            doc.setTextColor(...GRAY);    doc.setFontSize(5.5); doc.setFont('helvetica', 'normal');
            doc.text(card.label, sx + snapW / 2, y + 10,   { align: 'center' });
            doc.setTextColor(...card.accent); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
            doc.text(card.value, sx + snapW / 2, y + 17,   { align: 'center' });
            doc.setTextColor(...GRAY);    doc.setFontSize(5.5); doc.setFont('helvetica', 'normal');
            doc.text(card.sub,  sx + snapW / 2, y + 21.5,  { align: 'center' });
          });

          y += 26;
        }
      }

      // ─────────────────────────────── PAGE 2 ──────────────────────────────────
      doc.addPage();
      y = 15;

      // ── [4] Exception Records ─────────────────────────────────────────────────
      this.drawSectionHeader(doc, ml, y, cw, 'EXCEPTION RECORDS');
      y += 11;

      // Severity summary strip
      const sevCounts = [
        { label: 'CRITICAL / HIGH', count: exceptions.filter(e => ['CRITICAL','HIGH'].includes((e.severity ?? '').toUpperCase())).length, color: RED },
        { label: 'MEDIUM',          count: exceptions.filter(e => (e.severity ?? '').toUpperCase() === 'MEDIUM').length,                  color: AMBER },
        { label: 'LOW',             count: exceptions.filter(e => (e.severity ?? '').toUpperCase() === 'LOW').length,                     color: GREEN },
        { label: 'TOTAL',           count: exceptions.length,                                                                             color: BLUE },
      ];

      doc.setFillColor(...BLUE_BG);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.rect(ml, y, cw, 16, 'FD');

      sevCounts.forEach((item, i) => {
        const sx = ml + 6 + i * (cw / 4);
        doc.setFillColor(...item.color);
        doc.circle(sx + 2.5, y + 7.5, 2.5, 'F');
        doc.setTextColor(...item.color);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(String(item.count), sx + 8, y + 9);
        doc.setTextColor(...GRAY);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text(item.label, sx + 8, y + 14);
      });

      y += 20;

      if (exceptions.length > 0) {
        autoTable(doc, {
          startY: y,
          head:   [['#', 'Field', 'Issue Description', 'Severity', 'Reason Flagged']],
          body:   exceptions.map((e, i) => {
            const rawJust = (e as any).justification ?? '';
            const reason  = rawJust.includes('Reason:')
              ? rawJust.split('Reason:')[1]?.trim()
              : (rawJust || '—');
            return [
              String(i + 1),
              e.templateField?.fieldName ?? '—',
              e.issue ?? '—',
              (e.severity ?? '—').toUpperCase(),
              reason,
            ];
          }),
          margin:             { left: ml, right: mr },
          headStyles:         { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8, cellPadding: 2.5 },
          bodyStyles:         { fontSize: 7.5, cellPadding: 2.5 },
          alternateRowStyles: { fillColor: LIGHT_BG },
          tableLineColor:     BORDER,
          tableLineWidth:     0.3,
          columnStyles: {
            0: { cellWidth: 8,  halign: 'center' },
            1: { cellWidth: 30 },
            3: { cellWidth: 22, halign: 'center' },
          },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 3) {
              const sev = String(data.cell.raw).toUpperCase();
              data.cell.styles.fontStyle = 'bold';
              if (sev === 'CRITICAL' || sev === 'HIGH')   data.cell.styles.textColor = RED;
              else if (sev === 'MEDIUM')                  data.cell.styles.textColor = AMBER;
              else if (sev === 'LOW')                     data.cell.styles.textColor = GREEN;
            }
          },
        });
        y = ((doc as any).lastAutoTable?.finalY ?? y) + 14;
      } else {
        doc.setFillColor(...LIGHT_BG);
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.3);
        doc.rect(ml, y, cw, 12, 'FD');
        doc.setTextColor(...GRAY);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('No exception records for this report.', ml + 5, y + 8);
        y += 16;
      }

      // ── [5] Data Validation & Quality (sorted by severity) ───────────────────
      if (y > ph - 75) { doc.addPage(); y = 15; }

      this.drawSectionHeader(doc, ml, y, cw, 'DATA VALIDATION & QUALITY');
      y += 11;

      const sortedQuality = [...qualityIssues].sort(
        (a, b) => this.severityOrder(a.severity ?? '') - this.severityOrder(b.severity ?? '')
      );

      if (sortedQuality.length > 0) {
        autoTable(doc, {
          startY: y,
          head:   [['#', 'Issue Description', 'Record ID', 'Batch ID', 'Rule', 'Severity', 'Status', 'Date']],
          body:   sortedQuality.map((q, i) => {
            const ruleName = q.rule?.name ?? '—';
            return [
              String(i + 1),
              q.message ?? '—',
              q.recordId ?? '—',
              q.batch?.batchId != null ? String(q.batch.batchId) : '—',
              ruleName.length > 18 ? ruleName.substring(0, 16) + '..' : ruleName,
              (q.severity ?? '—').toUpperCase(),
              q.status ?? '—',
              q.loggedDate ? this.formatDateShort(q.loggedDate) : '—',
            ];
          }),
          margin:             { left: ml, right: mr },
          headStyles:         { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5, cellPadding: 2 },
          bodyStyles:         { fontSize: 7, cellPadding: 2 },
          alternateRowStyles: { fillColor: LIGHT_BG },
          tableLineColor:     BORDER,
          tableLineWidth:     0.3,
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            2: { cellWidth: 22, halign: 'center' },
            3: { cellWidth: 18, halign: 'center' },
            4: { cellWidth: 28 },
            5: { cellWidth: 22, halign: 'center' },
            6: { cellWidth: 20, halign: 'center' },
            7: { cellWidth: 24 },
          },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 5) {
              const sev = String(data.cell.raw).toUpperCase();
              data.cell.styles.fontStyle = 'bold';
              if (sev === 'CRITICAL' || sev === 'HIGH')   data.cell.styles.textColor = RED;
              else if (sev === 'MEDIUM')                  data.cell.styles.textColor = AMBER;
              else if (sev === 'LOW')                     data.cell.styles.textColor = GREEN;
            }
          },
        });
        y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
      } else {
        doc.setFillColor(...LIGHT_BG);
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.3);
        doc.rect(ml, y, cw, 12, 'FD');
        doc.setTextColor(...GRAY);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('No data quality issues recorded for this reporting period.', ml + 5, y + 8);
        y += 16;
      }

      // ─────────────────────────────── PAGE 3 ──────────────────────────────────
      doc.addPage();
      y = 15;

      // ── [6] Filing Workflow — step boxes with arrows ──────────────────────────
      this.drawSectionHeader(doc, ml, y, cw, 'FILING WORKFLOW');
      y += 14;

      const wfSteps = ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'FILED'];
      const wfLabels: Record<string, string> = {
        DRAFT: 'DRAFT', UNDER_REVIEW: 'UNDER REVIEW', APPROVED: 'APPROVED', FILED: 'FILED',
      };
      const boxW = (cw - 15) / 4;   // 4 boxes + 3 arrow gaps of 5mm
      const boxH = 44;               // taller to fit optional comments line

      wfSteps.forEach((step, i) => {
        const bx    = ml + i * (boxW + 5);
        const entry = workflowSteps.find(w => w.stepName === step);
        const done  = !!entry;

        // Box background
        doc.setFillColor(...(done ? BLUE_BG : LIGHT_BG));
        doc.setDrawColor(...(done ? BLUE    : BORDER));
        doc.setLineWidth(done ? 0.6 : 0.3);
        doc.roundedRect(bx, y, boxW, boxH, 2, 2, 'FD');

        // Top colour bar
        doc.setFillColor(...(done ? BLUE : BORDER));
        doc.roundedRect(bx, y, boxW, 5, 2, 2, 'F');
        doc.rect(bx, y + 3, boxW, 2, 'F');

        // Step label
        doc.setTextColor(...(done ? BLUE : GRAY));
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text(wfLabels[step], bx + boxW / 2, y + 13, { align: 'center' });

        // Actor name
        const actor = entry?.actor?.name ?? (done ? 'System' : '—');
        doc.setTextColor(...DARK);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text(actor.substring(0, 15), bx + boxW / 2, y + 21, { align: 'center' });

        // Role
        const role = (entry?.actor?.role ?? '').replace(/_/g, ' ');
        doc.setTextColor(...GRAY);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text(role.substring(0, 16), bx + boxW / 2, y + 27, { align: 'center' });

        // Date
        const stepDate = entry ? this.formatDateShort(entry.stepDate) : '—';
        doc.setFontSize(6);
        doc.text(stepDate, bx + boxW / 2, y + 33, { align: 'center' });

        // Approval comments (APPROVED step only)
        if (step === 'APPROVED' && entry?.comments) {
          doc.setDrawColor(...BORDER);
          doc.setLineWidth(0.3);
          doc.line(bx + 4, y + 36, bx + boxW - 4, y + 36);
          doc.setTextColor(...NAVY);
          doc.setFontSize(5.5);
          doc.setFont('helvetica', 'italic');
          const commentText = `"${entry.comments}"`;
          const wrapped = doc.splitTextToSize(commentText, boxW - 8);
          doc.text(wrapped[0].substring(0, 28), bx + boxW / 2, y + 41, { align: 'center' });
        }

        // Arrow to next step
        if (i < 3) {
          const arrowX = bx + boxW + 1;
          const midY   = y + boxH / 2;
          doc.setDrawColor(...(done ? BLUE : BORDER));
          doc.setLineWidth(0.6);
          doc.line(arrowX, midY, arrowX + 3, midY);
          doc.line(arrowX + 1.5, midY - 1.8, arrowX + 3, midY);
          doc.line(arrowX + 1.5, midY + 1.8, arrowX + 3, midY);
        }
      });

      y += boxH + 14;

      // ── [7] Filing Declaration ────────────────────────────────────────────────
      this.drawSectionHeader(doc, ml, y, cw, 'FILING DECLARATION');
      y += 11;

      const approvedStep = workflowSteps.find(s => s.stepName === 'APPROVED');
      const filedStep    = workflowSteps.find(s => s.stepName === 'FILED');
      const approver     = approvedStep?.actor?.name ?? 'Compliance Authority';
      const filer        = filedStep?.actor?.name   ?? username;

      // ── Declaration box — 56 mm so signatures sit fully inside ─────────────────
      doc.setFillColor(...BLUE_BG);
      doc.setDrawColor(...BLUE);
      doc.setLineWidth(0.4);
      doc.rect(ml, y, cw, 56, 'FD');
      doc.setFillColor(...BLUE);
      doc.rect(ml, y, 3, 56, 'F');

      // Declaration text
      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const decText = [
        `This document certifies that Report #${report.reportId} for the period ${report.period}`,
        `under regulation ${report.template?.regulationCode ?? '—'} has been duly processed and officially filed.`,
        `Filing Reference: ${filingRef}   |   Filed On: ${now}`,
      ];
      decText.forEach((line, i) => doc.text(line, ml + 8, y + 10 + i * 7));

      // Divider
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.line(ml + 8, y + 33, ml + cw - 5, y + 33);

      // Signature columns
      const decCol1 = ml + 10;
      const decCol2 = ml + cw / 2 + 5;

      doc.setTextColor(...GRAY); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
      doc.text('FILED BY',    decCol1, y + 40);
      doc.setTextColor(...DARK); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(filer,         decCol1, y + 47);
      doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.text('Reporting Officer', decCol1, y + 53);

      doc.setTextColor(...GRAY); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
      doc.text('APPROVED BY', decCol2, y + 40);
      doc.setTextColor(...DARK); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(approver,      decCol2, y + 47);
      doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.text('REGTECH ADMIN', decCol2, y + 53);

      // Column divider
      doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
      doc.line(ml + cw / 2, y + 35, ml + cw / 2, y + 55);

      y += 64;   // 56 mm box + 8 mm gap

      // ── [8] Report Compliance Summary ────────────────────────────────────────
      this.drawSectionHeader(doc, ml, y, cw, 'REPORT COMPLIANCE SUMMARY');
      y += 11;

      const summaryBreached = metrics.filter(m => this.isMetricBreached(m)).length;
      autoTable(doc, {
        startY: y,
        head:   [['Category', 'Total Records', 'Issues / Breaches', 'Resolved / OK']],
        body: [
          [
            'Risk Metrics',
            String(metrics.length),
            summaryBreached > 0 ? `${summaryBreached} BREACH` : 'None',
            `${metrics.length - summaryBreached} OK`,
          ],
          [
            'Exception Records',
            String(exceptions.length),
            openExc > 0 ? `${openExc} Open` : 'None',
            `${exceptions.length - openExc} Resolved`,
          ],
          [
            'Data Quality Issues',
            String(qualityIssues.length),
            openQ > 0 ? `${openQ} Open` : 'None',
            `${qualityIssues.length - openQ} Resolved`,
          ],
        ],
        margin:             { left: ml, right: mr },
        headStyles:         { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
        bodyStyles:         { fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: LIGHT_BG },
        tableLineColor:     BORDER,
        tableLineWidth:     0.3,
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 35, halign: 'center' },
          2: { cellWidth: 45, halign: 'center' },
          3: { cellWidth: 45, halign: 'center' },
        },
        didParseCell: (data: any) => {
          if (data.section === 'body') {
            const raw = String(data.cell.raw);
            if (data.column.index === 2) {
              data.cell.styles.fontStyle = 'bold';
              if (raw.includes('BREACH') || raw.includes('Open')) data.cell.styles.textColor = RED;
              else                                                 data.cell.styles.textColor = GREEN;
            }
            if (data.column.index === 3) {
              data.cell.styles.textColor = GREEN;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;

      // ── [9] Workflow Audit Trail ──────────────────────────────────────────────
      this.drawSectionHeader(doc, ml, y, cw, 'WORKFLOW AUDIT TRAIL');
      y += 11;

      const trailSteps  = ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'FILED'];
      const trailLabels: Record<string, string> = {
        DRAFT:        'Draft Created',
        UNDER_REVIEW: 'Submitted for Review',
        APPROVED:     'Approved',
        FILED:        'Filed with Regulator',
      };

      autoTable(doc, {
        startY: y,
        head:   [['#', 'Action', 'Actor', 'Role', 'Date', 'Comments']],
        body:   trailSteps.map((step, i) => {
          const entry = workflowSteps.find(w => w.stepName === step);
          return [
            String(i + 1),
            trailLabels[step] ?? step,
            entry?.actor?.name ?? '—',
            (entry?.actor?.role ?? '—').replace(/_/g, ' '),
            entry ? this.formatDateShort(entry.stepDate) : 'Pending',
            entry?.comments ?? '—',
          ];
        }),
        margin:             { left: ml, right: mr },
        headStyles:         { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8, cellPadding: 2.5 },
        bodyStyles:         { fontSize: 7.5, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: LIGHT_BG },
        tableLineColor:     BORDER,
        tableLineWidth:     0.3,
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 44 },
          2: { cellWidth: 28 },
          3: { cellWidth: 36 },
          4: { cellWidth: 28 },
        },
        didParseCell: (data: any) => {
          if (data.section === 'body') {
            const step  = trailSteps[data.row.index];
            const done  = !!workflowSteps.find(w => w.stepName === step);
            if (data.column.index === 1) {
              data.cell.styles.fontStyle = done ? 'bold'   : 'normal';
              data.cell.styles.textColor = done ? BLUE     : GRAY;
            }
            if (data.column.index === 4 && !done) {
              data.cell.styles.textColor = AMBER;
              data.cell.styles.fontStyle = 'italic';
            }
            if (data.column.index === 5 && String(data.cell.raw) !== '—') {
              data.cell.styles.textColor = NAVY;
              data.cell.styles.fontStyle = 'italic';
            }
          }
        },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? y) + 8;

      // ── Page footers ──────────────────────────────────────────────────────────
      const totalPages = doc.getNumberOfPages();
      const pageLabels: Record<number, string> = {
        1: 'RISK METRICS',
        2: 'EXCEPTIONS & DATA QUALITY',
        3: 'WORKFLOW & DECLARATION',
      };

      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(...NAVY);
        doc.rect(0, ph - 9, pw, 9, 'F');

        doc.setTextColor(179, 210, 240);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.text(`RegReportX v2.0  |  ${filingRef}  |  CONFIDENTIAL`, ml, ph - 3.5);
        doc.text(`Page ${p} of ${totalPages}`, pw - mr, ph - 3.5, { align: 'right' });

        doc.setTextColor(204, 224, 245);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text(pageLabels[p] ?? `SECTION ${p}`, pw / 2, ph - 3.5, { align: 'center' });
      }

      // ── Save ──────────────────────────────────────────────────────────────────
      const filename = `RegReport_${report.reportId}_${report.period}_FILED.pdf`;
      doc.save(filename);
      return filename;

    } catch (e) {
      console.error('[PDF] Generation failed:', e);
      throw e;
    }
  }
}
