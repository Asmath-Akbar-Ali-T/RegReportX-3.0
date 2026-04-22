import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { RiskService } from '../../services/risk.service';
import { ReportService } from '../../services/report.service';
import { AuditService } from '../../services/audit.service';
import { RiskMetric } from '../../models/risk-metric.model';
import { RegReport } from '../../models/report.model';
import { AuditLog } from '../../models/audit-log.model';
import { finalize } from 'rxjs/operators';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-risk',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './risk.html',
  styleUrl: './risk.css'
})
export class RiskComponent implements OnInit {
  username = '';
  activeTab: 'overview' | 'metrics' | 'calculate' | 'reports' | 'audit' = 'overview';
  Math = Math;

  // Data
  metrics: RiskMetric[] = [];
  reports: RegReport[] = [];
  draftReports: RegReport[] = [];
  auditLogs: AuditLog[] = [];

  // Calculate
  selectedReportId: number | null = null;
  calculationResult: any = null;

  // Pagination - Metrics
  metPage = 1;
  metPageSize = 8;

  // Pagination - Reports
  repPage = 1;
  repPageSize = 8;

  // Pagination - Audit
  auditPage = 1;
  auditPageSize = 10;
  auditSearchTerm = '';

  // Charts
  metricValuesChart: any;
  breachRatioChart: any;
  metricsByReportChart: any;
  riskProfileChart: any;
  metricDistChart: any;
  thresholdChart: any;

  // UI State
  loadingCount = 0;
  get isLoading(): boolean { return this.loadingCount > 0; }
  notification: { message: string, type: 'success' | 'error' } | null = null;

  // Thresholds
  thresholds: Record<string, { min?: number, max?: number }> = {
    'CRAR': { min: 9 },
    'LCR': { min: 100 },
    'Loan_to_Deposit_Ratio': { max: 90 },
    'Net_GL_Balance': { min: 0 }
  };

  constructor(
    public authService: AuthService,
    private riskService: RiskService,
    private reportService: ReportService,
    private auditService: AuditService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.username = this.authService.getUsername() || 'Analyst';
  }

  ngOnInit(): void {
    this.switchTab('overview');
    setTimeout(() => {
      if (this.isLoading) {
        this.loadingCount = 0;
        this.cdr.detectChanges();
      }
    }, 5000);
  }

  private startLoading(): void {
    this.loadingCount++;
    this.cdr.detectChanges();
  }

  private stopLoading(): void {
    if (this.loadingCount > 0) {
      this.loadingCount--;
      this.cdr.detectChanges();
    }
  }

  // ========== Pagination Getters ==========

  get paginatedMetrics(): RiskMetric[] {
    const start = (this.metPage - 1) * this.metPageSize;
    return this.metrics.slice(start, start + this.metPageSize);
  }
  get metTotalPages(): number {
    return Math.ceil(this.metrics.length / this.metPageSize) || 1;
  }

  get paginatedReports(): RegReport[] {
    const start = (this.repPage - 1) * this.repPageSize;
    return this.reports.slice(start, start + this.repPageSize);
  }
  get repTotalPages(): number {
    return Math.ceil(this.reports.length / this.repPageSize) || 1;
  }

  get filteredAuditLogs(): AuditLog[] {
    if (!this.auditSearchTerm.trim()) return this.auditLogs;
    const term = this.auditSearchTerm.toLowerCase();
    return this.auditLogs.filter(log =>
      (log.action || '').toLowerCase().includes(term) ||
      (log.resource || '').toLowerCase().includes(term) ||
      (log.metadata || '').toLowerCase().includes(term) ||
      (log.user?.name || '').toLowerCase().includes(term)
    );
  }
  get paginatedAuditLogs(): AuditLog[] {
    const start = (this.auditPage - 1) * this.auditPageSize;
    return this.filteredAuditLogs.slice(start, start + this.auditPageSize);
  }
  get auditTotalPages(): number {
    return Math.ceil(this.filteredAuditLogs.length / this.auditPageSize) || 1;
  }
  onAuditSearch(): void { this.auditPage = 1; }

  nextPage(type: 'met' | 'rep' | 'audit'): void {
    if (type === 'met' && this.metPage < this.metTotalPages) this.metPage++;
    if (type === 'rep' && this.repPage < this.repTotalPages) this.repPage++;
    if (type === 'audit' && this.auditPage < this.auditTotalPages) this.auditPage++;
  }
  prevPage(type: 'met' | 'rep' | 'audit'): void {
    if (type === 'met' && this.metPage > 1) this.metPage--;
    if (type === 'rep' && this.repPage > 1) this.repPage--;
    if (type === 'audit' && this.auditPage > 1) this.auditPage--;
  }

  // ========== Computed Stats ==========

  get totalMetrics(): number { return this.metrics.length; }

  get breachCount(): number {
    return this.metrics.filter(m => this.isBreached(m)).length;
  }

  get safeCount(): number {
    return this.metrics.filter(m => !this.isBreached(m)).length;
  }

  get reportsAnalyzed(): number {
    const ids = new Set(this.metrics.map(m => m.report?.reportId).filter(Boolean));
    return ids.size;
  }

  get latestCalcDate(): string {
    if (this.metrics.length === 0) return '—';
    const sorted = [...this.metrics].sort((a, b) =>
      new Date(b.calculationDate).getTime() - new Date(a.calculationDate).getTime()
    );
    return sorted[0].calculationDate;
  }

  isBreached(metric: RiskMetric): boolean {
    const th = this.thresholds[metric.metricName];
    if (!th) return false;
    if (th.min !== undefined && metric.metricValue < th.min) return true;
    if (th.max !== undefined && metric.metricValue > th.max) return true;
    return false;
  }

  getThresholdLabel(metric: RiskMetric): string {
    const th = this.thresholds[metric.metricName];
    if (!th) return 'N/A';
    if (th.min !== undefined) return '≥ ' + th.min;
    if (th.max !== undefined) return '≤ ' + th.max;
    return 'N/A';
  }

  getThresholdClass(metric: RiskMetric): string {
    if (!this.thresholds[metric.metricName]) return 'threshold-na';
    return this.isBreached(metric) ? 'threshold-breach' : 'threshold-safe';
  }

  // ========== Tab Navigation ==========

  switchTab(tab: 'overview' | 'metrics' | 'calculate' | 'reports' | 'audit'): void {
    this.activeTab = tab;
    if (tab === 'overview') {
      this.loadMetrics();
    }
    if (tab === 'metrics') {
      this.loadMetrics();
    }
    if (tab === 'calculate') {
      this.loadReports();
      this.calculationResult = null;
    }
    if (tab === 'reports') {
      this.loadReports();
    }
    if (tab === 'audit') {
      this.loadAuditLogs();
    }
  }

  // ========== Data Loading ==========

  loadMetrics(): void {
    this.startLoading();
    this.riskService.getMetrics().pipe(
      finalize(() => this.stopLoading())
    ).subscribe({
      next: (data) => {
        this.metrics = data;
        this.metPage = 1;
        if (this.activeTab === 'overview') {
          setTimeout(() => this.renderOverviewCharts());
        }
        if (this.activeTab === 'metrics') {
          setTimeout(() => this.renderMetricsCharts());
        }
      },
      error: () => this.showNotification('Failed to load risk metrics', 'error')
    });
  }

  loadReports(): void {
    this.startLoading();
    this.reportService.getReports().pipe(
      finalize(() => this.stopLoading())
    ).subscribe({
      next: (data) => {
        this.reports = data;
        this.draftReports = data.filter(r => r.status === 'DRAFT');
        this.repPage = 1;
      },
      error: () => this.showNotification('Failed to load reports', 'error')
    });
  }

  loadAuditLogs(): void {
    this.startLoading();
    this.auditService.getAuditLogs().pipe(
      finalize(() => this.stopLoading())
    ).subscribe({
      next: (data) => {
        this.auditLogs = data;
        this.auditPage = 1;
      },
      error: () => this.showNotification('Failed to load audit logs', 'error')
    });
  }

  calculateMetrics(): void {
    if (!this.selectedReportId) return;
    this.startLoading();
    this.calculationResult = null;
    this.riskService.calculateMetrics(this.selectedReportId).pipe(
      finalize(() => this.stopLoading())
    ).subscribe({
      next: (res) => {
        this.calculationResult = res;
        this.showNotification(`Calculated ${res.metricsCalculated?.length || 0} metrics for Report #${this.selectedReportId}`, 'success');
        this.loadMetrics();
      },
      error: (err) => {
        const msg = err?.error?.message || err?.error || 'Calculation failed';
        this.showNotification(typeof msg === 'string' ? msg : 'Calculation failed', 'error');
      }
    });
  }

  // ========== Overview Charts ==========

  renderOverviewCharts(): void {
    this.renderMetricValuesChart();
    this.renderBreachRatioChart();
    this.renderMetricsByReportChart();
  }

  renderMetricValuesChart(): void {
    const ctx = document.getElementById('metricValuesChart') as HTMLCanvasElement;
    if (!ctx) return;
    if (this.metricValuesChart) this.metricValuesChart.destroy();

    const grouped: Record<string, number[]> = {};
    this.metrics.forEach(m => {
      if (!grouped[m.metricName]) grouped[m.metricName] = [];
      grouped[m.metricName].push(m.metricValue);
    });
    const labels = Object.keys(grouped);
    const data = labels.map(l => {
      const vals = grouped[l];
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    const colors = labels.map((_, i) => ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'][i % 8]);

    this.metricValuesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Avg Value', data, backgroundColor: colors, borderRadius: 6 }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }
      }
    });
  }

  renderBreachRatioChart(): void {
    const ctx = document.getElementById('breachRatioChart') as HTMLCanvasElement;
    if (!ctx) return;
    if (this.breachRatioChart) this.breachRatioChart.destroy();

    this.breachRatioChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Breached', 'Safe'],
        datasets: [{
          data: [this.breachCount, this.safeCount],
          backgroundColor: ['#ef4444', '#10b981'],
          borderWidth: 3,
          borderColor: '#fff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        cutout: '68%',
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16 } }
        }
      }
    });
  }

  renderMetricsByReportChart(): void {
    const ctx = document.getElementById('metricsByReportChart') as HTMLCanvasElement;
    if (!ctx) return;
    if (this.metricsByReportChart) this.metricsByReportChart.destroy();

    const reportCounts: Record<string, number> = {};
    this.metrics.forEach(m => {
      const key = m.report ? `Report #${m.report.reportId}` : 'Unknown';
      reportCounts[key] = (reportCounts[key] || 0) + 1;
    });
    const labels = Object.keys(reportCounts);
    const data = Object.values(reportCounts);

    this.metricsByReportChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Metrics Count',
          data,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#4f46e5',
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  // ========== Metrics Tab Charts ==========

  renderMetricsCharts(): void {
    this.renderRiskProfileChart();
    this.renderMetricDistChart();
    this.renderThresholdChart();
  }

  renderRiskProfileChart(): void {
    const ctx = document.getElementById('riskProfileChart') as HTMLCanvasElement;
    if (!ctx) return;
    if (this.riskProfileChart) this.riskProfileChart.destroy();

    const grouped: Record<string, number[]> = {};
    this.metrics.forEach(m => {
      if (!grouped[m.metricName]) grouped[m.metricName] = [];
      grouped[m.metricName].push(m.metricValue);
    });
    const labels = Object.keys(grouped);
    const avgValues = labels.map(l => {
      const vals = grouped[l];
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    // Normalize to 0-100 scale for radar
    const maxVal = Math.max(...avgValues, 1);
    const normalizedData = avgValues.map(v => Math.min((Math.abs(v) / maxVal) * 100, 100));

    this.riskProfileChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          label: 'Risk Profile',
          data: normalizedData,
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          borderColor: '#6366f1',
          borderWidth: 2,
          pointBackgroundColor: '#6366f1',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        scales: {
          r: { beginAtZero: true, max: 100, ticks: { stepSize: 25 } }
        },
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle' } } }
      }
    });
  }

  renderMetricDistChart(): void {
    const ctx = document.getElementById('metricDistChart') as HTMLCanvasElement;
    if (!ctx) return;
    if (this.metricDistChart) this.metricDistChart.destroy();

    const countMap: Record<string, number> = {};
    this.metrics.forEach(m => {
      countMap[m.metricName] = (countMap[m.metricName] || 0) + 1;
    });
    const labels = Object.keys(countMap);
    const data = Object.values(countMap);
    const colors = labels.map((_, i) => ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#3b82f6'][i % 6]);

    this.metricDistChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Count', data, backgroundColor: colors, borderRadius: 4 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } }, y: { grid: { display: false } } }
      }
    });
  }

  renderThresholdChart(): void {
    const ctx = document.getElementById('thresholdChart') as HTMLCanvasElement;
    if (!ctx) return;
    if (this.thresholdChart) this.thresholdChart.destroy();

    // Only show metrics that have thresholds
    const thresholdMetrics = this.metrics.filter(m => this.thresholds[m.metricName]);
    const labels = thresholdMetrics.map(m => `${m.metricName} (R#${m.report?.reportId || '?'})`);
    const values = thresholdMetrics.map(m => m.metricValue);
    const thresholdValues = thresholdMetrics.map(m => {
      const th = this.thresholds[m.metricName];
      return th?.min ?? th?.max ?? 0;
    });
    const barColors = thresholdMetrics.map(m => this.isBreached(m) ? 'rgba(239, 68, 68, 0.8)' : 'rgba(16, 185, 129, 0.8)');

    this.thresholdChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Actual Value', data: values, backgroundColor: barColors, borderRadius: 4 },
          {
            label: 'Threshold', data: thresholdValues,
            type: 'line' as any,
            borderColor: '#f59e0b',
            borderWidth: 2,
            borderDash: [6, 4],
            pointBackgroundColor: '#f59e0b',
            pointRadius: 4,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle' } } },
        scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }
      }
    });
  }

  // ========== Audit Helpers ==========

  getActionLabel(action: string): string {
    const map: Record<string, string> = {
      'CALCULATE_RISK_METRICS': 'Calculated Metrics',
      'CALCULATE_RISK_METRICS_SKIPPED': 'Calculation Skipped',
      'GENERATE_REPORT_EXCEPTIONS': 'Generated Exceptions',
      'RAN_VALIDATION': 'Ran Validation',
      'VIEWED_VALIDATION_ISSUES': 'Viewed Validation Issues',
      'VIEWED_OPEN_QUALITY_ISSUES': 'Viewed Quality Issues',
      'RESOLVED_QUALITY_ISSUE': 'Resolved Quality Issue',
      'VIEWED_OPEN_EXCEPTIONS': 'Viewed Exceptions',
      'RESOLVED_EXCEPTION': 'Resolved Exception',
      'GENERATED_EXCEPTIONS': 'Generated Exceptions',
      'SUBMITTED_REPORT': 'Submitted Report',
      'APPROVED_REPORT': 'Approved Report',
      'GENERATED_REPORT': 'Generated Report',
      'FILED_REPORT': 'Filed Report',
      'WORKFLOW_ADVANCE': 'Workflow Advanced'
    };
    return map[action] || action;
  }
  getActionClass(action: string): string {
    if (action.includes('RESOLVED')) return 'action-resolve';
    if (action.includes('SUBMITTED') || action.includes('FILED')) return 'action-submit';
    if (action.includes('GENERATED') || action.includes('GENERATE')) return 'action-generate';
    if (action.includes('CALCULATE')) return 'action-run';
    if (action.includes('VIEWED')) return 'action-view';
    if (action.includes('APPROVED')) return 'action-approve';
    if (action.includes('RAN')) return 'action-run';
    if (action.includes('WORKFLOW')) return 'action-generate';
    return 'action-default';
  }
  getActionIcon(action: string): string {
    if (action.includes('CALCULATE')) return 'calculate';
    if (action.includes('RESOLVED')) return 'check_circle';
    if (action.includes('SUBMITTED')) return 'send';
    if (action.includes('GENERATE')) return 'auto_awesome';
    if (action.includes('RAN')) return 'play_circle';
    if (action.includes('VIEWED')) return 'visibility';
    if (action.includes('APPROVED')) return 'verified';
    if (action.includes('FILED')) return 'upload_file';
    if (action.includes('WORKFLOW')) return 'swap_horiz';
    return 'info';
  }

  // ========== Utility ==========

  getStatusClass(status: string): string {
    switch (status) {
      case 'DRAFT': return 'status-warning';
      case 'UNDER_REVIEW': return 'status-info';
      case 'APPROVED': return 'status-success';
      case 'FILED': return 'status-success';
      default: return 'status-default';
    }
  }

  showNotification(message: string, type: 'success' | 'error'): void {
    this.notification = { message, type };
    setTimeout(() => this.notification = null, 4000);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
