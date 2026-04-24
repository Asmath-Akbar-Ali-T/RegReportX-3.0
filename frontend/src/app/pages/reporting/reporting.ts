import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { ReportService } from '../../services/report.service';
import { AuditService } from '../../services/audit.service';
import { TemplateService } from '../../services/template.service';
import { PdfReportService } from '../../services/pdf-report.service';
import { RegReport } from '../../models/report.model';
import { RegTemplate } from '../../models/template.model';
import { AuditLog } from '../../models/audit-log.model';

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

  // Templates for dropdown
  templates: RegTemplate[] = [];
  loadingTemplates = false;

  // Generate form
  generateTemplateId = 0;
  generatePeriod = '2026-Q1';
  generating = false;
  lastGenerated: RegReport | null = null;

  // File report
  filingReportId: number | null = null;
  filing = false;
  filingMap: Record<number, boolean> = {};
  generatingPdf: Record<number, boolean> = {};

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

  readonly STATUS_OPTIONS = ['ALL', 'DRAFT', 'UNDER REVIEW', 'APPROVED', 'FILED'];
  readonly PERIODS = [
    '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4',
    '2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4',
  ];

  constructor(
    public authService: AuthService,
    private router: Router,
    private reportService: ReportService,
    private auditService: AuditService,
    private templateService: TemplateService,
    private pdfReportService: PdfReportService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.username = this.authService.getUsername() || 'Officer';
  }

  /**
   * Runs a function inside Angular's zone and immediately triggers
   * change detection. This fixes the 'must click multiple times to see results'
   * glitch caused by HTTP callbacks running outside Angular's zone.
   */
  private run(fn: () => void): void {
    this.ngZone.run(() => {
      fn();
      this.cdr.detectChanges();
    });
  }

  ngOnInit(): void {
    this.loadReports();
    this.loadTemplates();
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
    if (view === 'generate' && this.templates.length === 0) {
      this.loadTemplates();
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // Load templates from API for dropdown
  loadTemplates(): void {
    this.loadingTemplates = true;
    this.templateService.getAllTemplates().pipe(
      finalize(() => this.run(() => this.loadingTemplates = false))
    ).subscribe({
      next: (templates) => this.run(() => {
        this.templates = templates;
        if (templates.length > 0 && templates[0].templateId) {
          this.generateTemplateId = templates[0].templateId;
        }
      }),
      error: () => this.run(() => this.toast('error', 'Failed to load templates'))
    });
  }

  // Load reports
  loadReports(): void {
    this.loadingReports = true;
    this.reportService.getReports().subscribe({
      next: (reports) => {
        this.run(() => {
          this.reports = reports;
          this.computeStats(reports);
          this.applyFilters();
          this.loadingReports = false;
        });
      },
      error: (err) => {
        this.run(() => {
          this.toast('error', 'Failed to load reports: ' + (err.error || err.message));
          this.loadingReports = false;
        });
      }
    });
  }

  computeStats(reports: RegReport[]): void {
    this.stats.total = reports.length;
    this.stats.generated = reports.filter(r => r.status === 'GENERATED').length;
    this.stats.approved = reports.filter(r => r.status === 'APPROVED').length;
    this.stats.filed = reports.filter(r => r.status === 'FILED').length;
  }

  // Maps the friendly filter chip label to the actual backend status values
  private readonly FILTER_STATUS_MAP: Record<string, string[]> = {
    'DRAFT':        ['GENERATED', 'DRAFT'],
    'UNDER REVIEW': ['SUBMITTED', 'UNDER_REVIEW'],
    'APPROVED':     ['APPROVED'],
    'FILED':        ['FILED']
  };

  applyFilters(): void {
    let filtered = [...this.reports];
    if (this.statusFilter !== 'ALL') {
      const statuses = this.FILTER_STATUS_MAP[this.statusFilter] ?? [this.statusFilter];
      filtered = filtered.filter(r => statuses.includes(r.status));
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
        this.run(() => {
          this.lastGenerated = report;
          this.generating = false;
          this.toast('success', `Report generated successfully for period ${report.period}`);
          this.loadReports();
        });
      },
      error: (err) => {
        this.run(() => {
          this.generating = false;
          this.toast('error', 'Failed to generate report: ' + (err.error || err.message));
        });
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
      next: () => {
        this.run(() => {
          this.filingMap[report.reportId!] = false;
          this.toast('success', `Report #${report.reportId} filed successfully!`);
          this.loadReports();
          this.generateFiledReportPDF({ ...report, status: 'FILED' });
        });
      },
      error: (err) => {
        this.run(() => {
          this.filingMap[report.reportId!] = false;
          this.toast('error', 'Failed to file report: ' + (err.error || err.message));
        });
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
      finalize(() => this.run(() => this.isLoadingAudit = false))
    ).subscribe({
      next: data => {
        this.run(() => {
          this.auditLogs = data;
          this.auditPage = 1;
        });
      },
      error: () => this.run(() => this.toast('error', 'Failed to load audit logs'))
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

  // Status section getters for All Reports kanban view
  get draftReports(): RegReport[] {
    return this.reports.filter(r => r.status === 'GENERATED' || r.status === 'DRAFT');
  }

  get underReviewReports(): RegReport[] {
    return this.reports.filter(r => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW');
  }

  get approvedReports(): RegReport[] {
    return this.reports.filter(r => r.status === 'APPROVED');
  }

  get filedReports(): RegReport[] {
    return this.reports.filter(r => r.status === 'FILED');
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

  // ── PDF GENERATION — delegated to PdfReportService ────────────────────────

  generateFiledReportPDF(report: RegReport): void {
    if (!report.reportId) return;
    this.generatingPdf[report.reportId] = true;
    this.cdr.detectChanges();

    this.pdfReportService.generate(report, this.username).subscribe({
      next: (filename) => {
        this.run(() => {
          this.toast('info', `PDF downloaded: ${filename}`);
          this.generatingPdf[report.reportId!] = false;
        });
      },
      error: (err: any) => {
        console.error('[PDF] Generation failed:', err);
        this.run(() => {
          this.toast('error', 'Failed to generate PDF. Please try again.');
          this.generatingPdf[report.reportId!] = false;
        });
      },
    });
  }
}