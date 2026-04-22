import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ValidationService } from '../../services/validation.service';
import { finalize } from 'rxjs/operators';
import { DataQualityService } from '../../services/data-quality.service';
import { ReportService } from '../../services/report.service';
import { ExceptionService } from '../../services/exception.service';
import { AuditService } from '../../services/audit.service';
import { DataQualityIssue } from '../../models/data-quality.model';
import { RegReport } from '../../models/report.model';
import { ExceptionRecord } from '../../models/exception.model';
import { AuditLog } from '../../models/audit-log.model';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-compliance',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './compliance.html',
  styleUrl: './compliance.css'
})
export class ComplianceComponent implements OnInit {
  username = '';
  activeTab: 'validation' | 'quality' | 'exceptions' | 'submit' | 'audit' = 'validation';
  Math = Math;


  // Data
  issues: DataQualityIssue[] = [];
  draftReports: RegReport[] = [];
  openIssues: DataQualityIssue[] = [];
  openExceptions: ExceptionRecord[] = [];
  auditLogs: AuditLog[] = [];

  // Pagination - Validation
  valPage = 1;
  valPageSize = 5;

  // Pagination - Quality
  qualPage = 1;
  qualPageSize = 5;

  // Pagination - Exceptions
  excPage = 1;
  excPageSize = 5;

  // Pagination - Submit
  repPage = 1;
  repPageSize = 5;

  // Pagination - Audit
  auditPage = 1;
  auditPageSize = 10;
  auditSearchTerm = '';

  chart: any;
  messageChart: any;
  statusChart: any;

  qualityRuleChart: any;
  qualityBatchChart: any;
  qualitySeverityChart: any;
  
  exceptionSeverityChart: any;
  exceptionReportChart: any;

  // UI State
  loadingCount = 0;
  get isLoading(): boolean { return this.loadingCount > 0; }
  showResolveModal = false;
  showExceptionModal = false;
  selectedIssue: DataQualityIssue | null = null;
  selectedException: ExceptionRecord | null = null;
  resolutionForm = { correctedValue: '', justification: '' };
  exceptionForm = { justification: '' };
  notification: { message: string, type: 'success' | 'error' } | null = null;

  constructor(
    public authService: AuthService,
    private validationService: ValidationService,
    private dataQualityService: DataQualityService,
    private reportService: ReportService,
    private exceptionService: ExceptionService,
    private auditService: AuditService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.username = this.authService.getUsername() || 'Analyst';
  }

  ngOnInit(): void {
    this.switchTab('validation');
    
    // Safety net: Auto-hide spinner after 5 seconds if still stuck
    setTimeout(() => {
      if (this.isLoading) {
        this.loadingCount = 0;
        this.cdr.detectChanges();
        console.warn('Loading safety net triggered: forced counter reset');
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

  get paginatedIssues(): DataQualityIssue[] {
    const start = (this.valPage - 1) * this.valPageSize;
    return this.issues.slice(start, start + this.valPageSize);
  }

  get valTotalPages(): number {
    return Math.ceil(this.issues.length / this.valPageSize) || 1;
  }

  get paginatedOpenIssues(): DataQualityIssue[] {
    const start = (this.qualPage - 1) * this.qualPageSize;
    return this.openIssues.slice(start, start + this.qualPageSize);
  }

  get qualTotalPages(): number {
    return Math.ceil(this.openIssues.length / this.qualPageSize) || 1;
  }

  get paginatedExceptions(): ExceptionRecord[] {
    const start = (this.excPage - 1) * this.excPageSize;
    return this.openExceptions.slice(start, start + this.excPageSize);
  }

  get excTotalPages(): number {
    return Math.ceil(this.openExceptions.length / this.excPageSize) || 1;
  }

  get paginatedReports(): RegReport[] {
    const start = (this.repPage - 1) * this.repPageSize;
    return this.draftReports.slice(start, start + this.repPageSize);
  }

  get repTotalPages(): number {
    return Math.ceil(this.draftReports.length / this.repPageSize) || 1;
  }

  // Audit Log filtered + paginated
  get filteredAuditLogs(): AuditLog[] {
    if (!this.auditSearchTerm.trim()) return this.auditLogs;
    const term = this.auditSearchTerm.toLowerCase();
    return this.auditLogs.filter(log =>
      (log.action || '').toLowerCase().includes(term) ||
      (log.resource || '').toLowerCase().includes(term) ||
      (log.metadata || '').toLowerCase().includes(term) ||
      (log.user?.name || '').toLowerCase().includes(term) ||
      (log.user?.username || '').toLowerCase().includes(term)
    );
  }

  get paginatedAuditLogs(): AuditLog[] {
    const start = (this.auditPage - 1) * this.auditPageSize;
    return this.filteredAuditLogs.slice(start, start + this.auditPageSize);
  }

  get auditTotalPages(): number {
    return Math.ceil(this.filteredAuditLogs.length / this.auditPageSize) || 1;
  }

  onAuditSearch(): void {
    this.auditPage = 1;
  }

  getActionLabel(action: string): string {
    const map: Record<string, string> = {
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
      'FILED_REPORT': 'Filed Report'
    };
    return map[action] || action;
  }

  getActionClass(action: string): string {
    if (action.startsWith('RESOLVED')) return 'action-resolve';
    if (action.startsWith('SUBMITTED') || action.startsWith('FILED')) return 'action-submit';
    if (action.startsWith('GENERATED')) return 'action-generate';
    if (action.startsWith('RAN')) return 'action-run';
    if (action.startsWith('VIEWED')) return 'action-view';
    if (action.startsWith('APPROVED')) return 'action-approve';
    return 'action-default';
  }

  getActionIcon(action: string): string {
    if (action.startsWith('RESOLVED')) return 'check_circle';
    if (action.startsWith('SUBMITTED')) return 'send';
    if (action.startsWith('GENERATED')) return 'auto_awesome';
    if (action.startsWith('RAN')) return 'play_circle';
    if (action.startsWith('VIEWED')) return 'visibility';
    if (action.startsWith('APPROVED')) return 'verified';
    if (action.startsWith('FILED')) return 'upload_file';
    return 'info';
  }

  nextPage(type: 'val' | 'qual' | 'exc' | 'rep' | 'audit'): void {
    if (type === 'val' && this.valPage < this.valTotalPages) this.valPage++;
    if (type === 'qual' && this.qualPage < this.qualTotalPages) this.qualPage++;
    if (type === 'exc' && this.excPage < this.excTotalPages) this.excPage++;
    if (type === 'rep' && this.repPage < this.repTotalPages) this.repPage++;
    if (type === 'audit' && this.auditPage < this.auditTotalPages) this.auditPage++;
  }

  prevPage(type: 'val' | 'qual' | 'exc' | 'rep' | 'audit'): void {
    if (type === 'val' && this.valPage > 1) this.valPage--;
    if (type === 'qual' && this.qualPage > 1) this.qualPage--;
    if (type === 'exc' && this.excPage > 1) this.excPage--;
    if (type === 'rep' && this.repPage > 1) this.repPage--;
    if (type === 'audit' && this.auditPage > 1) this.auditPage--;
  }

  updateChart(): void {
    const ctx = document.getElementById('severityChart') as HTMLCanvasElement;
    if (!ctx) return;
    
    if (this.chart) {
      this.chart.destroy();
    }

    // Dynamically count severities from actual data
    const countMap: Record<string, number> = {};
    this.issues.forEach(issue => {
      const sev = issue.severity || 'UNKNOWN';
      countMap[sev] = (countMap[sev] || 0) + 1;
    });

    const colorMap: Record<string, string> = {
      'CRITICAL': '#dc3545',
      'HIGH': '#fd7e14',
      'WARNING': '#ffc107',
      'MEDIUM': '#ffc107',
      'LOW': '#0dcaf0',
      'INFO': '#6c757d'
    };

    const labels = Object.keys(countMap);
    const data = Object.values(countMap);
    const colors = labels.map(l => colorMap[l.toUpperCase()] || '#6c757d');

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Issues by Severity',
          data: data,
          backgroundColor: colors,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }

  updateAllCharts(): void {
    this.updateChart();
    this.updateMessageChart();
    this.updateStatusChart();
  }

  updateMessageChart(): void {
    const ctx = document.getElementById('messageChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.messageChart) {
      this.messageChart.destroy();
    }

    const countMap: Record<string, number> = {};
    this.issues.forEach(issue => {
      const rule = issue.rule?.name || 'Unknown';
      countMap[rule] = (countMap[rule] || 0) + 1;
    });

    const labels = Object.keys(countMap);
    const data = Object.values(countMap);
    const palette = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
    const colors = labels.map((_, i) => palette[i % palette.length]);

    this.messageChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' }
          }
        }
      }
    });
  }

  updateStatusChart(): void {
    const ctx = document.getElementById('statusChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.statusChart) {
      this.statusChart.destroy();
    }

    const countMap: Record<string, number> = {};
    this.issues.forEach(issue => {
      const status = issue.status || 'UNKNOWN';
      countMap[status] = (countMap[status] || 0) + 1;
    });

    const statusColorMap: Record<string, string> = {
      'OPEN': '#dc3545',
      'Open': '#dc3545',
      'RESOLVED': '#1a8a4a',
      'Resolved': '#1a8a4a',
      'WAIVED': '#6c757d',
      'Waived': '#6c757d'
    };

    const labels = Object.keys(countMap);
    const data = Object.values(countMap);
    const colors = labels.map(l => statusColorMap[l] || '#adb5bd');

    this.statusChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' }
          }
        }
      }
    });
  }

  updateQualityCharts(): void {
    const ruleCtx = document.getElementById('qualityRuleChart') as HTMLCanvasElement;
    if (ruleCtx) {
      if (this.qualityRuleChart) this.qualityRuleChart.destroy();
      const ruleCounts: Record<string, number> = {};
      this.openIssues.forEach(i => {
        const rName = i.message ? (i.message.length > 30 ? i.message.substring(0, 30) + '...' : i.message) : 'Unknown Issue';
        ruleCounts[rName] = (ruleCounts[rName] || 0) + 1;
      });
      const sortedRules = Object.entries(ruleCounts).sort((a,b) => b[1] - a[1]).slice(0, 5); // display top 5
      const labels = sortedRules.map(x => x[0]);
      const data = sortedRules.map(x => x[1]);

      this.qualityRuleChart = new Chart(ruleCtx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Issue Volume',
            data: data,
            backgroundColor: ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6'],
            borderRadius: 4
          }]
        },
        options: { 
          indexAxis: 'y', 
          responsive: true, 
          plugins: { legend: { display: false } }, 
          scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } }, y: { grid: { display: false } } } 
        }
      });
    }

    const sevCtx = document.getElementById('qualitySeverityChart') as HTMLCanvasElement;
    if (sevCtx) {
      if (this.qualitySeverityChart) this.qualitySeverityChart.destroy();
      const sevCounts: Record<string, number> = {};
      this.openIssues.forEach(i => {
        let sev = (i.severity || 'UNKNOWN').toUpperCase();
        sevCounts[sev] = (sevCounts[sev] || 0) + 1;
      });
      const labels = Object.keys(sevCounts);
      const data = Object.values(sevCounts);
      const palette: Record<string, string> = { 
        'CRITICAL': 'rgba(239, 68, 68, 0.85)', 
        'ERROR': 'rgba(239, 68, 68, 0.85)', 
        'HIGH': 'rgba(249, 115, 22, 0.85)', 
        'WARNING': 'rgba(245, 158, 11, 0.85)', 
        'MEDIUM': 'rgba(234, 179, 8, 0.85)', 
        'LOW': 'rgba(59, 130, 246, 0.85)', 
        'UNKNOWN': 'rgba(156, 163, 175, 0.85)' 
      };
      const colors = labels.map(l => palette[l] || 'rgba(156, 163, 175, 0.85)');
      this.qualitySeverityChart = new Chart(sevCtx, {
        type: 'polarArea',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 1, borderColor: '#fff' }] },
        options: { responsive: true, plugins: { legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle' } } } }
      });
    }

    const batchCtx = document.getElementById('qualityBatchChart') as HTMLCanvasElement;
    if (batchCtx) {
      if (this.qualityBatchChart) this.qualityBatchChart.destroy();
      const batchCounts: Record<string, number> = {};
      this.openIssues.forEach(i => {
        const batch = i.batch?.batchId ? `Batch ${i.batch.batchId}` : 'Unknown';
        batchCounts[batch] = (batchCounts[batch] || 0) + 1;
      });
      this.qualityBatchChart = new Chart(batchCtx, {
        type: 'line',
        data: {
          labels: Object.keys(batchCounts),
          datasets: [{
            label: 'Issues Count',
            data: Object.values(batchCounts),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#2563eb',
            pointRadius: 5
          }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
      });
    }
  }

  updateExceptionCharts(): void {
    const fieldCtx = document.getElementById('exceptionFieldChart') as HTMLCanvasElement;
    if (fieldCtx) {
      if (this.exceptionSeverityChart) this.exceptionSeverityChart.destroy();
      const fieldCounts: Record<string, number> = {};
      this.openExceptions.forEach(e => {
        const field = e.templateField?.fieldName || 'System Constraint';
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
      });
      const labels = Object.keys(fieldCounts);
      const data = Object.values(fieldCounts);
      const dynamicColors = labels.map((_, i) => ['#0ea5e9', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6'][i % 6]);
      this.exceptionSeverityChart = new Chart(fieldCtx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: dynamicColors,
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 4
          }]
        },
        options: { 
          responsive: true, 
          cutout: '70%', 
          plugins: { legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle' } } } 
        }
      });
    }

    const repCtx = document.getElementById('exceptionReportChart') as HTMLCanvasElement;
    if (repCtx) {
      if (this.exceptionReportChart) this.exceptionReportChart.destroy();
      const repCounts: Record<string, number> = {};
      this.openExceptions.forEach(e => {
        const rep = e.report?.reportId ? `Rep #${e.report.reportId}` : 'Unknown';
        repCounts[rep] = (repCounts[rep] || 0) + 1;
      });
      const labels = Object.keys(repCounts);
      const data = Object.values(repCounts);
      const dynamicColors = labels.map((_, i) => ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#3b82f6'][i % 6]);
      this.exceptionReportChart = new Chart(repCtx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Exceptions Found',
            data: data,
            backgroundColor: dynamicColors,
            borderRadius: 6
          }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } } }
      });
    }
  }

  switchTab(tab: 'validation' | 'quality' | 'exceptions' | 'submit' | 'audit'): void {
    this.activeTab = tab;
    if (tab === 'validation') this.loadValidationIssues();
    if (tab === 'quality') this.loadOpenIssues();
    if (tab === 'exceptions') this.loadOpenExceptions();
    if (tab === 'submit') {
      this.loadDraftReports();
      this.loadOpenExceptions();
    }
    if (tab === 'audit') this.loadAuditLogs();
  }

  loadValidationIssues(): void {
    this.startLoading();
    this.validationService.getIssues().pipe(
      finalize(() => this.stopLoading())
    ).subscribe({
      next: (data) => {
        this.issues = data;
        this.valPage = 1;
        setTimeout(() => this.updateAllCharts());
      },
      error: () => {
        this.showNotification('Failed to load validation issues', 'error');
      }
    });
  }

  runValidationCheck(): void {
    this.startLoading();
    this.validationService.runValidation().pipe(
      finalize(() => this.stopLoading())
    ).subscribe({
      next: (data) => {
        this.issues = data;
        this.valPage = 1;
        setTimeout(() => this.updateAllCharts());
        this.showNotification('Validation run complete!', 'success');
      },
      error: () => {
        this.showNotification('Validation run failed', 'error');
      }
    });
  }

  loadOpenIssues(): void {
    this.startLoading();
    this.dataQualityService.getOpenIssues().pipe(
      finalize(() => this.stopLoading())
    ).subscribe({
      next: (data) => {
        this.openIssues = data;
        this.qualPage = 1;
        setTimeout(() => this.updateQualityCharts());
      },
      error: () => {
        this.showNotification('Failed to load open issues', 'error');
      }
    });
  }

  loadDraftReports(): void {
    this.startLoading();
    this.reportService.getReports().pipe(
      finalize(() => this.stopLoading())
    ).subscribe({
      next: (data) => {
        this.draftReports = data.filter(r => r.status === 'DRAFT');
        this.repPage = 1;
      },
      error: () => {
        this.showNotification('Failed to load draft reports', 'error');
      }
    });
  }

  loadOpenExceptions(): void {
    this.startLoading();
    this.exceptionService.getOpenExceptions().pipe(
      finalize(() => this.stopLoading())
    ).subscribe({
      next: (data) => {
        this.openExceptions = data;
        this.excPage = 1;
        setTimeout(() => this.updateExceptionCharts());
      },
      error: () => {
        this.showNotification('Failed to load open report exceptions', 'error');
      }
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
      error: () => {
        this.showNotification('Failed to load audit logs', 'error');
      }
    });
  }

  openResolveModal(issue: DataQualityIssue): void {
    this.selectedIssue = issue;
    this.resolutionForm = { correctedValue: '', justification: '' };
    this.showResolveModal = true;
  }

  submitResolution(): void {
    if (!this.selectedIssue) return;
    this.startLoading();
    this.dataQualityService.resolveIssue(this.selectedIssue.issueId, this.resolutionForm).pipe(
      finalize(() => this.stopLoading())
    ).subscribe({
      next: () => {
        this.showNotification('Issue resolved successfully', 'success');
        this.showResolveModal = false;
        this.loadOpenIssues();
      },
      error: () => {
        this.showNotification('Failed to resolve issue', 'error');
      }
    });
  }

  openResolveExceptionModal(exception: ExceptionRecord): void {
    this.selectedException = exception;
    this.exceptionForm = { justification: '' };
    this.showExceptionModal = true;
  }

  submitExceptionResolution(): void {
    if (!this.selectedException) return;
    this.startLoading();
    this.exceptionService.resolveException(this.selectedException.exceptionId, this.exceptionForm).pipe(
      finalize(() => this.stopLoading())
    ).subscribe({
      next: () => {
        this.showNotification('Exception resolved successfully', 'success');
        this.showExceptionModal = false;
        this.loadOpenExceptions();
      },
      error: () => {
        this.showNotification('Failed to resolve exception', 'error');
      }
    });
  }

  submitForApproval(reportId: number): void {
    this.startLoading();
    this.reportService.submitReport(reportId).pipe(
      finalize(() => this.stopLoading())
    ).subscribe({
      next: () => {
        this.showNotification('Report submitted for approval', 'success');
        this.loadDraftReports();
      },
      error: () => {
        this.showNotification('Failed to submit report', 'error');
      }
    });
  }

  generateReportExceptions(reportId: number): void {
    this.startLoading();
    this.exceptionService.generateExceptions(reportId).pipe(
      finalize(() => this.stopLoading())
    ).subscribe({
      next: (res) => {
        this.showNotification(`Generated ${res.count} exceptions for report`, 'success');
        this.loadOpenExceptions();
      },
      error: () => {
        this.showNotification('Failed to generate exceptions', 'error');
      }
    });
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
