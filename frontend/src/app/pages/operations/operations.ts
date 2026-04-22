import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { OperationsService } from '../../services/operations.service';
import { Loan, Deposit, TreasuryTrade, GeneralLedger, RawRecord } from '../../models/operations.model';
import { AuditLog } from '../../models/audit-log.model';
import { RawDataBatch } from '../../models/ingestion.model';
import { Chart, registerables } from 'chart.js';
import { forkJoin, finalize } from 'rxjs';

Chart.register(...registerables);

// Define a type for our upload keys to prevent indexing errors
type UploadType = 'loans' | 'deposits' | 'treasury' | 'gl';

@Component({
  selector: 'app-operations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './operations.html',
  styleUrl: './operations.css'
})
export class OperationsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('statsChart') statsChartRef?: ElementRef<HTMLCanvasElement>;

  activeTab: 'dashboard' | 'upload' | 'ingestion' | 'view_data' | 'audit' | 'raw_records' = 'dashboard';
  username = '';

  // Source record counts
  totalLoans = 0;
  totalDeposits = 0;
  totalTreasury = 0;
  totalGl = 0;

  // Dashboard Metrics
  totalBatches = 0;
  completedBatches = 0;
  totalRecords = 0;

  // View Data
  activeDataTab: 'loans' | 'deposits' | 'treasury' | 'gl' | 'raw' = 'loans';
  loans: Loan[] = [];
  deposits: Deposit[] = [];
  treasury: TreasuryTrade[] = [];
  gl: GeneralLedger[] = [];
  rawRecords: RawRecord[] = [];
  selectedBatchIdForRaw: number | null = null;

  // Raw Records Conversion
  convertingBatchId: number | null = null;
  isConvertingRawRecords = false;
  convertedBatchIds: Set<number> = new Set();

  private readonly STORAGE_KEY = 'rrx_converted_batch_ids';

  private loadConvertedIds(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const ids: number[] = JSON.parse(stored);
        this.convertedBatchIds = new Set(ids);
      }
    } catch { this.convertedBatchIds = new Set(); }
  }

  private saveConvertedIds(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify([...this.convertedBatchIds]));
    } catch { /* storage unavailable */ }
  }

  // Ingestion & Uploads - Fully initialized to prevent undefined errors
  ingestionBatches: RawDataBatch[] = [];

  uploadFiles: Record<UploadType, File | null> = {
    loans: null, deposits: null, treasury: null, gl: null
  };

  uploading: Record<UploadType, boolean> = {
    loans: false, deposits: false, treasury: false, gl: false
  };

  // Upload/Ingestion result tracking
  ingestionResult: { success: boolean; message: string; recordsCount?: number } | null = null;
  showIngestionResult = false;

  // Upload result modal
  uploadModal: { visible: boolean; success: boolean; message: string; type: string } = {
    visible: false, success: false, message: '', type: ''
  };

  auditLogs: AuditLog[] = [];
  auditSearchTerm = '';
  auditPage = 1;
  auditPageSize = 10;
  notification: { message: string; type: 'success' | 'error' } | null = null;

  // Loading flags
  isIngesting = false;
  isLoadingData = false;
  isLoadingAudit = false;
  isLoadingBatches = false;
  isRefreshingStats = false;

  // For template iteration with proper typing
  uploadTypes: UploadType[] = ['loans', 'deposits', 'treasury', 'gl'];

  currentPage = 1;
  readonly pageSize = 10;
  private chartInstance: Chart | null = null;
  private sourceDistChart: Chart | null = null;
  private batchStatusChart: Chart | null = null;

  constructor(
    public authService: AuthService,
    private operationsService: OperationsService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  /**
   * Runs a function inside Angular's zone and immediately triggers
   * change detection. This fixes the 'must navigate away to see results'
   * glitch caused by HTTP callbacks running outside Angular's zone.
   */
  private run(fn: () => void): void {
    this.ngZone.run(() => {
      fn();
      this.cdr.detectChanges();
    });
  }

  ngOnInit(): void {
    this.username = this.authService.getUsername() || 'Officer';
    this.loadConvertedIds();
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initChart(), 100);
  }

  ngOnDestroy(): void {
    this.chartInstance?.destroy();
    this.sourceDistChart?.destroy();
    this.batchStatusChart?.destroy();
  }

  // --- Dashboard Logic ---
  loadDashboardData(): void {
    this.loadSourceCounts();
    this.loadIngestionBatches();
  }

  loadSourceCounts(): void {
    this.isRefreshingStats = true;
    forkJoin({
      loans: this.operationsService.getLoans(),
      deposits: this.operationsService.getDeposits(),
      treasury: this.operationsService.getTreasury(),
      gl: this.operationsService.getGl()
    }).pipe(
      finalize(() => {
        this.run(() => {
          this.isRefreshingStats = false;
          this.updateChart();
          setTimeout(() => {
            this.renderSourceDistChart();
            this.renderBatchStatusChart();
          });
        });
      })
    ).subscribe({
      next: (res) => {
        this.run(() => {
          this.totalLoans = res.loans.length;
          this.totalDeposits = res.deposits.length;
          this.totalTreasury = res.treasury.length;
          this.totalGl = res.gl.length;
        });
      },
      error: () => this.run(() => this.showNotification('Error loading counts.', 'error'))
    });
  }

  loadIngestionBatches(): void {
    this.isLoadingBatches = true;
    this.operationsService.getIngestionBatches().pipe(
      finalize(() => this.run(() => this.isLoadingBatches = false))
    ).subscribe({
      next: data => {
        this.run(() => {
          this.ingestionBatches = data;
          this.totalBatches = data.length;
          this.totalRecords = data.reduce((sum, b) => sum + (b.rowCount || 0), 0);
          data.filter(b => b.status === 'COMPLETED').forEach(b => this.convertedBatchIds.add(b.batchId));
          this.saveConvertedIds();
          // Count as completed: batches marked COMPLETED by backend OR locally converted this session
          this.completedBatches = data.filter(b =>
            b.status === 'COMPLETED' || this.convertedBatchIds.has(b.batchId)
          ).length;
          setTimeout(() => this.renderBatchStatusChart());
        });
      },
      error: () => {
        this.run(() => {
          this.ingestionBatches = [];
          this.totalBatches = 0;
          this.completedBatches = 0;
          this.totalRecords = 0;
        });
      }
    });
  }

  // --- Data View Logic ---
  switchTab(tab: any): void {
    this.activeTab = tab;
    if (tab === 'view_data') this.switchDataTab('loans');
    if (tab === 'dashboard') {
      this.loadDashboardData();
      setTimeout(() => this.initChart(), 50);
    }
    if (tab === 'audit') this.loadAuditLogs();
    this.cdr.detectChanges();
  }

  switchDataTab(tab: any): void {
    this.activeDataTab = tab;
    this.currentPage = 1;
    this.isLoadingData = true;
    this.cdr.detectChanges();

    if (tab === 'raw') {
      if (this.selectedBatchIdForRaw) {
        this.fetchRawRecordsByBatch();
      } else {
        this.isLoadingData = false;
        this.cdr.detectChanges();
      }
      return;
    }

    let req: any;
    if (tab === 'loans') {
      req = this.operationsService.getLoans();
    } else if (tab === 'deposits') {
      req = this.operationsService.getDeposits();
    } else if (tab === 'treasury') {
      req = this.operationsService.getTreasury();
    } else {
      req = this.operationsService.getGl();
    }

    req.pipe(
      finalize(() => this.run(() => this.isLoadingData = false))
    ).subscribe({
      next: (data: any) => {
        this.run(() => {
          if (tab === 'loans') this.loans = data;
          else if (tab === 'deposits') this.deposits = data;
          else if (tab === 'treasury') this.treasury = data;
          else if (tab === 'gl') this.gl = data;
        });
      },
      error: () => this.run(() => this.showNotification('Error loading data.', 'error'))
    });
  }

  fetchRawRecordsByBatch(): void {
    if (!this.selectedBatchIdForRaw) return;
    this.isLoadingData = true;
    this.cdr.detectChanges();
    this.operationsService.getRawRecordsByBatch(this.selectedBatchIdForRaw).pipe(
      finalize(() => this.run(() => this.isLoadingData = false))
    ).subscribe({
      next: data => this.run(() => this.rawRecords = data),
      error: () => this.run(() => this.showNotification('Records not found.', 'error'))
    });
  }

  loadRawRecordsAction(batchId: number): void {
    this.activeTab = 'view_data';
    this.activeDataTab = 'raw';
    this.selectedBatchIdForRaw = batchId;
    this.cdr.detectChanges();
    this.fetchRawRecordsByBatch();
  }

  loadRawRecordsForConversion(batchId: number): void {
    if (this.isConvertingRawRecords) return; // guard double-click
    this.convertingBatchId = batchId;
    this.isConvertingRawRecords = true;
    this.cdr.detectChanges();

    this.operationsService.loadRawRecords(batchId).pipe(
      finalize(() => {
        this.run(() => {
          this.isConvertingRawRecords = false;
          this.convertingBatchId = null;
        });
      })
    ).subscribe({
      next: () => {
        this.run(() => {
          this.convertedBatchIds.add(batchId);
          this.saveConvertedIds();
          this.completedBatches++;
          this.uploadModal = {
            visible: true,
            success: true,
            message: `Batch #${batchId} has been converted to raw records successfully.`,
            type: 'Conversion'
          };
          setTimeout(() => this.loadIngestionBatches(), 300);
        });
      },
      error: () => {
        this.run(() => {
          this.uploadModal = {
            visible: true,
            success: false,
            message: `Conversion failed for Batch #${batchId}. Please try again.`,
            type: 'Conversion'
          };
        });
      }
    });
  }

  // --- Upload Logic ---
  uploadCsv(type: string): void {
    const key = type as UploadType;
    const file = this.uploadFiles[key];
    if (!file || this.uploading[key]) return;  // guard double-click

    this.uploading[key] = true;
    this.cdr.detectChanges();

    const label = type === 'gl' ? 'GL' : type.charAt(0).toUpperCase() + type.slice(1);
    const apiEndpoint: 'loans' | 'deposits' | 'treasury' | 'general-ledger' =
      type === 'gl' ? 'general-ledger' : (type as 'loans' | 'deposits' | 'treasury');

    this.operationsService.uploadCsv(apiEndpoint, file).pipe(
      finalize(() => this.run(() => this.uploading[key] = false))
    ).subscribe({
      next: (response) => {
        this.run(() => {
          this.uploadModal = {
            visible: true,
            success: true,
            message: `${response.recordsInserted} record(s) inserted successfully.`,
            type: label
          };
          this.clearFile(key);
          this.loadSourceCounts();
        });
      },
      error: () => {
        this.run(() => {
          this.uploadModal = {
            visible: true,
            success: false,
            message: `Upload failed for ${label} CSV. Please check the file and try again.`,
            type: label
          };
        });
      }
    });
  }

  closeUploadModal(): void {
    this.uploadModal = { visible: false, success: false, message: '', type: '' };
    this.cdr.detectChanges();
  }

  onFileSelected(event: any, type: string): void {
    const file = event.target.files[0];
    if (file) {
      this.uploadFiles[type as UploadType] = file;
      this.cdr.detectChanges();
    }
  }

  clearFile(type: UploadType): void {
    this.uploadFiles[type] = null;
    const input = document.getElementById(`file-${type}`) as HTMLInputElement;
    if (input) input.value = '';
    this.cdr.detectChanges();
  }

  // --- Audit Logic ---
  loadAuditLogs(): void {
    this.isLoadingAudit = true;
    this.cdr.detectChanges();
    this.operationsService.getAllAuditLogs().pipe(
      finalize(() => this.run(() => this.isLoadingAudit = false))
    ).subscribe({
      next: data => {
        this.run(() => {
          this.auditLogs = data;
          this.auditPage = 1;
        });
      },
      error: () => this.run(() => this.showNotification('Error loading audit logs.', 'error'))
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

  onAuditSearch(): void { this.auditPage = 1; this.cdr.detectChanges(); }
  auditPrev(): void {
    if (this.auditPage > 1) { this.auditPage--; this.cdr.detectChanges(); }
  }
  auditNext(): void {
    if (this.auditPage < this.auditTotalPages) { this.auditPage++; this.cdr.detectChanges(); }
  }

  getActionLabel(action: string): string {
    const map: Record<string, string> = {
      'RUN_INGESTION': 'Ran Ingestion',
      'RUN_VALIDATION_ON_RAW': 'Validated Raw Data',
      'CALCULATE_RISK_METRICS': 'Calculated Metrics',
      'GENERATE_REPORT': 'Generated Report',
      'SUBMITTED_REPORT': 'Submitted Report',
      'APPROVED_REPORT': 'Approved Report',
      'FILED_REPORT': 'Filed Report',
      'RESOLVED_QUALITY_ISSUE': 'Resolved Quality Issue',
      'RESOLVED_EXCEPTION': 'Resolved Exception',
      'RESOLVED_DATA_QUALITY_ISSUE': 'Resolved Quality Issue',
      'RESOLVED_REPORT_EXCEPTION': 'Resolved Exception',
      'WORKFLOW_ADVANCE': 'Workflow Advanced'
    };
    return map[action] || action.replace(/_/g, ' ');
  }

  getActionClass(action: string): string {
    if (action.includes('RESOLVED')) return 'action-resolve';
    if (action.includes('SUBMITTED') || action.includes('FILED')) return 'action-submit';
    if (action.includes('GENERATE') || action.includes('INGESTION')) return 'action-generate';
    if (action.includes('CALCULATE') || action.includes('RAN') || action.includes('RUN')) return 'action-run';
    if (action.includes('VIEWED')) return 'action-view';
    if (action.includes('APPROVED')) return 'action-approve';
    return 'action-default';
  }

  getActionIcon(action: string): string {
    if (action.includes('INGESTION') || action.includes('RUN')) return 'sync';
    if (action.includes('CALCULATE')) return 'calculate';
    if (action.includes('RESOLVED')) return 'check_circle';
    if (action.includes('SUBMITTED')) return 'send';
    if (action.includes('GENERATE')) return 'auto_awesome';
    if (action.includes('VIEWED')) return 'visibility';
    if (action.includes('APPROVED')) return 'verified';
    if (action.includes('FILED')) return 'upload_file';
    if (action.includes('WORKFLOW')) return 'swap_horiz';
    return 'info';
  }

  // --- Computed Dashboard Stats ---
  get totalSourceRecords(): number {
    return this.totalLoans + this.totalDeposits + this.totalTreasury + this.totalGl;
  }

  get pendingBatches(): number {
    return this.totalBatches - this.completedBatches;
  }

  isBatchConverted(batch: { batchId: number; status: string }): boolean {
    return batch.status === 'COMPLETED' || this.convertedBatchIds.has(batch.batchId);
  }

  // --- Helper Methods ---
  private get activeArray(): any[] {
    if (this.activeDataTab === 'loans') return this.loans;
    if (this.activeDataTab === 'deposits') return this.deposits;
    if (this.activeDataTab === 'treasury') return this.treasury;
    if (this.activeDataTab === 'gl') return this.gl;
    return this.rawRecords;
  }

  get paginatedData(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.activeArray.slice(start, start + this.pageSize);
  }

  get totalPages(): number { return Math.ceil(this.activeArray.length / this.pageSize) || 1; }
  get totalItemCount(): number { return this.activeArray.length; }

  prevPage(): void {
    if (this.currentPage > 1) { this.currentPage--; this.cdr.detectChanges(); }
  }
  nextPage(): void {
    if (this.currentPage < this.totalPages) { this.currentPage++; this.cdr.detectChanges(); }
  }

  showNotification(message: string, type: 'success' | 'error'): void {
    this.notification = { message, type };
    setTimeout(() => {
      this.notification = null;
      this.cdr.detectChanges();
    }, 3000);
  }

  // --- Charts ---
  initChart(): void {
    const canvas = this.statsChartRef?.nativeElement;
    if (!canvas) return;
    this.chartInstance?.destroy();
    this.chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Loans', 'Deposits', 'Treasury', 'GL'],
        datasets: [{
          label: 'Records',
          data: [this.totalLoans, this.totalDeposits, this.totalTreasury, this.totalGl],
          backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } }
      }
    });
  }

  updateChart(): void {
    if (this.chartInstance) {
      this.chartInstance.data.datasets[0].data = [this.totalLoans, this.totalDeposits, this.totalTreasury, this.totalGl];
      this.chartInstance.update();
    }
  }

  renderSourceDistChart(): void {
    const ctx = document.getElementById('sourceDistChart') as HTMLCanvasElement;
    if (!ctx) return;
    this.sourceDistChart?.destroy();
    this.sourceDistChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Loans', 'Deposits', 'Treasury', 'GL'],
        datasets: [{
          data: [this.totalLoans, this.totalDeposits, this.totalTreasury, this.totalGl],
          backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6'],
          borderWidth: 3, borderColor: '#fff', hoverOffset: 6
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

  renderBatchStatusChart(): void {
    const ctx = document.getElementById('batchStatusChart') as HTMLCanvasElement;
    if (!ctx) return;
    this.batchStatusChart?.destroy();
    const statusCounts: Record<string, number> = {};
    this.ingestionBatches.forEach(b => {
      statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
    });
    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);
    const colorMap: Record<string, string> = {
      'COMPLETED': '#10b981', 'PENDING': '#f59e0b', 'FAILED': '#ef4444', 'IN_PROGRESS': '#3b82f6'
    };
    const colors = labels.map(l => colorMap[l.toUpperCase()] || '#94a3b8');
    this.batchStatusChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16 } }
        }
      }
    });
  }

  runIngestion(): void {
    this.isIngesting = true;
    this.showIngestionResult = false;
    this.ingestionResult = null;
    this.cdr.detectChanges();

    this.operationsService.runIngestion().pipe(
      finalize(() => this.run(() => this.isIngesting = false))
    ).subscribe({
      next: (batches) => {
        this.run(() => {
          const totalRecords = batches.reduce((sum, b) => sum + (b.rowCount || 0), 0);
          this.ingestionResult = {
            success: true,
            message: `Ingestion completed successfully!`,
            recordsCount: totalRecords
          };
          this.showIngestionResult = true;
          this.showNotification('Ingestion successful!', 'success');
          this.loadIngestionBatches();
        });
      },
      error: () => {
        this.run(() => {
          this.ingestionResult = {
            success: false,
            message: 'Ingestion failed. Please check the logs and try again.'
          };
          this.showIngestionResult = true;
          this.showNotification('Ingestion failed.', 'error');
        });
      }
    });
  }

  getStatusClass(status: string): string {
    const s = status?.toUpperCase();
    if (s === 'COMPLETED' || s === 'SUCCESS') return 'status-success';
    if (s === 'PENDING') return 'status-warning';
    return 'status-danger';
  }

  logout(): void { this.authService.logout(); this.router.navigate(['/login']); }
}
