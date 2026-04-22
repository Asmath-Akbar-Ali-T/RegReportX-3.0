import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ReportService } from '../../services/report.service';
import { AuditService } from '../../services/audit.service';
import { RegReport } from '../../models/report.model';
import { AuditLog } from '../../models/audit-log.model';
import { finalize } from 'rxjs/operators';

type ActiveView = 'dashboard' | 'generate' | 'list' | 'file' | 'audit';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

@Component({
  selector: 'app-reporting',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './reporting.html',
  styleUrl: './reporting.css'
})
export class ReportingComponent implements OnInit {
  username = '';
  activeView: ActiveView = 'dashboard';

  // Reports
  reports: RegReport[] = [];
  filteredReports: RegReport[] = [];
  loadingReports = false;
  searchQuery = '';
  statusFilter = 'ALL';

  // Generate form
  generateTemplateId = 1;
  generatePeriod = '2026-Q1';
  generating = false;
  lastGenerated: RegReport | null = null;

  // File report
  filingReportId: number | null = null;
  filing = false;
  filingMap: Record<number, boolean> = {};

  // Confirm modal
  confirmModal: { show: boolean; title: string; message: string; onConfirm: () => void } = {
    show: false, title: '', message: '', onConfirm: () => {}
  };

  // Toast
  toasts: Toast[] = [];
  private toastCounter = 0;

  // Stats
  stats = { total: 0, generated: 0, approved: 0, filed: 0 };

  // Audit
  auditLogs: AuditLog[] = [];
  auditSearchTerm = '';
  auditPage = 1;
  auditPageSize = 10;
  isLoadingAudit = false;

  readonly STATUS_OPTIONS = ['ALL', 'GENERATED', 'SUBMITTED', 'APPROVED', 'FILED', 'REJECTED'];
  readonly PERIODS = [
    '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4',
    '2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4',
  ];

  constructor(
    public authService: AuthService,
    private router: Router,
    private reportService: ReportService,
    private auditService: AuditService
  ) {
    this.username = this.authService.getUsername() || 'Officer';
  }

  ngOnInit(): void {
    this.loadReports();
  }

  // Navigation
  navigate(view: ActiveView): void {
    this.activeView = view;
    if (view === 'list' || view === 'file') {
      this.loadReports();
    }
    if (view === 'audit') {
      this.loadAuditLogs();
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // Load reports
  loadReports(): void {
    this.loadingReports = true;
    this.reportService.getReports().subscribe({
      next: (reports) => {
        this.reports = reports;
        this.computeStats(reports);
        this.applyFilters();
        this.loadingReports = false;
      },
      error: (err) => {
        this.toast('error', 'Failed to load reports: ' + (err.error || err.message));
        this.loadingReports = false;
      }
    });
  }

  computeStats(reports: RegReport[]): void {
    this.stats.total = reports.length;
    this.stats.generated = reports.filter(r => r.status === 'GENERATED').length;
    this.stats.approved = reports.filter(r => r.status === 'APPROVED').length;
    this.stats.filed = reports.filter(r => r.status === 'FILED').length;
  }

  applyFilters(): void {
    let filtered = [...this.reports];
    if (this.statusFilter !== 'ALL') {
      filtered = filtered.filter(r => r.status === this.statusFilter);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.period.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        (r.template?.regulationCode || '').toLowerCase().includes(q)
      );
    }
    this.filteredReports = filtered;
  }

  onSearchChange(): void { this.applyFilters(); }
  onStatusChange(): void { this.applyFilters(); }

  // Generate report
  generateReport(): void {
    this.generating = true;
    this.lastGenerated = null;
    this.reportService.generateReport(this.generateTemplateId, this.generatePeriod).subscribe({
      next: (report) => {
        this.lastGenerated = report;
        this.generating = false;
        this.toast('success', `Report generated successfully for period ${report.period}`);
        this.loadReports();
      },
      error: (err) => {
        this.generating = false;
        this.toast('error', 'Failed to generate report: ' + (err.error || err.message));
      }
    });
  }

  // File a report
  confirmFileReport(report: RegReport): void {
    this.confirmModal = {
      show: true,
      title: 'File Report',
      message: `Are you sure you want to officially file Report #${report.reportId} (${report.period})? This marks it as submitted to regulators.`,
      onConfirm: () => {
        this.closeModal();
        this.doFileReport(report);
      }
    };
  }

  doFileReport(report: RegReport): void {
    if (!report.reportId) return;
    this.filingMap[report.reportId] = true;
    this.reportService.fileReport(report.reportId).subscribe({
      next: (updated) => {
        this.filingMap[report.reportId!] = false;
        this.toast('success', `Report #${report.reportId} filed successfully!`);
        this.loadReports();
      },
      error: (err) => {
        this.filingMap[report.reportId!] = false;
        this.toast('error', 'Failed to file report: ' + (err.error || err.message));
      }
    });
  }

  closeModal(): void {
    this.confirmModal.show = false;
  }

  // Audit
  loadAuditLogs(): void {
    this.isLoadingAudit = true;
    this.auditService.getAuditLogs().pipe(
      finalize(() => this.isLoadingAudit = false)
    ).subscribe({
      next: data => {
        this.auditLogs = data;
        this.auditPage = 1;
      },
      error: () => this.toast('error', 'Failed to load audit logs')
    });
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
  auditPrev(): void { if (this.auditPage > 1) this.auditPage--; }
  auditNext(): void { if (this.auditPage < this.auditTotalPages) this.auditPage++; }

  getAuditActionLabel(action: string): string {
    const map: Record<string, string> = {
      'GENERATE_REPORT': 'Generated Report',
      'WORKFLOW_ADVANCE': 'Workflow Advanced',
      'APPROVE_REPORT_WITH_COMMENTS': 'Approved Report',
      'SUBMITTED_REPORT': 'Submitted Report',
      'FILED_REPORT': 'Filed Report',
      'GENERATE_REPORT_EXCEPTIONS': 'Generated Exceptions',
      'CALCULATE_RISK_METRICS': 'Calculated Metrics',
      'RESOLVED_QUALITY_ISSUE': 'Resolved Quality Issue',
      'RESOLVED_EXCEPTION': 'Resolved Exception',
      'RESOLVED_REPORT_EXCEPTION': 'Resolved Exception'
    };
    return map[action] || action.replace(/_/g, ' ');
  }

  getAuditActionClass(action: string): string {
    if (action.includes('RESOLVED')) return 'ro-audit-resolve';
    if (action.includes('SUBMITTED') || action.includes('FILED')) return 'ro-audit-submit';
    if (action.includes('GENERATE')) return 'ro-audit-generate';
    if (action.includes('CALCULATE') || action.includes('RAN')) return 'ro-audit-run';
    if (action.includes('VIEWED')) return 'ro-audit-view';
    if (action.includes('APPROVED') || action.includes('WORKFLOW')) return 'ro-audit-approve';
    return 'ro-audit-default';
  }

  getAuditActionIcon(action: string): string {
    if (action.includes('GENERATE')) return 'auto_awesome';
    if (action.includes('CALCULATE')) return 'calculate';
    if (action.includes('RESOLVED')) return 'check_circle';
    if (action.includes('SUBMITTED')) return 'send';
    if (action.includes('APPROVED') || action.includes('WORKFLOW')) return 'verified';
    if (action.includes('FILED')) return 'publish';
    if (action.includes('VIEWED')) return 'visibility';
    return 'info';
  }

  // Helpers
  isFileable(report: RegReport): boolean {
    return report.status === 'APPROVED';
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      GENERATED: 'status-generated',
      DRAFT: 'status-generated',
      SUBMITTED: 'status-submitted',
      UNDER_REVIEW: 'status-submitted',
      APPROVED: 'status-approved',
      FILED: 'status-filed',
      REJECTED: 'status-rejected'
    };
    return map[status] || 'status-default';
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      GENERATED: 'note_add',
      DRAFT: 'note_add',
      SUBMITTED: 'send',
      UNDER_REVIEW: 'send',
      APPROVED: 'check_circle',
      FILED: 'publish',
      REJECTED: 'cancel'
    };
    return map[status] || 'help';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  get approvedReports(): RegReport[] {
    return this.reports.filter(r => r.status === 'APPROVED');
  }

  // Toast
  toast(type: 'success' | 'error' | 'info', message: string): void {
    const id = ++this.toastCounter;
    this.toasts.push({ id, type, message });
    setTimeout(() => this.removeToast(id), 4500);
  }

  removeToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }
}
