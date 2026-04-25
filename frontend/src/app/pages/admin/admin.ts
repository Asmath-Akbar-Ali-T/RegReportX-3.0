import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TemplateService } from '../../services/template.service';
import { ReportService } from '../../services/report.service';
import { UserService } from '../../services/user.service';
import { AuditService } from '../../services/audit.service';
import { NotificationService } from '../../services/notification.service';
import { RegTemplate, TemplateField } from '../../models/template.model';
import { RegReport } from '../../models/report.model';
import { User } from '../../models/user.model';
import { AuditLog } from '../../models/audit-log.model';
import { AppNotification } from '../../models/notification.model';
import { Chart, registerables } from 'chart.js';
import { finalize } from 'rxjs';

Chart.register(...registerables);

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class AdminComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('templateChart') templateChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fieldsChart') fieldsChartRef!: ElementRef<HTMLCanvasElement>;

  // Loading / submitting flags (double-click prevention)
  isSubmitting = false;
  isLoadingReports = false;
  approvingReportId: number | null = null;

  activeTab: 'templates' | 'fields' | 'reports' | 'users' | 'charts' | 'audit' = 'templates';
  username: string | null = '';

  // Templates
  templates: RegTemplate[] = [];
  showTemplateModal = false;
  editingTemplate: RegTemplate | null = null;
  templateForm: RegTemplate = { regulationCode: '', description: '', frequency: '', status: 'ACTIVE' };

  // Fields
  selectedTemplateId: number | null = null;
  isAllFieldsMode = false;
  fields: TemplateField[] = [];
  showFieldModal = false;
  editingField: TemplateField | null = null;
  fieldForm: TemplateField = { fieldName: '', dataType: '', mappingExpression: '', requiredFlag: false };
  fieldTargetTemplateId: number | null = null;   // used when adding a field while in ALL mode

  // Reports
  filterTemplate = '';
  filterStatus = '';
  filterWorkflow = '';   // '' | 'PENDING' | 'COMPLETED'
  reports: RegReport[] = [];

  // Report pagination
  reportPage = 1;
  readonly reportPageSize = 10;

  get filteredReports(): RegReport[] {
    let result = this.reports;
    if (this.filterTemplate) result = result.filter(r => r.template?.regulationCode === this.filterTemplate);
    if (this.filterStatus) result = result.filter(r => r.status === this.filterStatus);
    if (this.filterWorkflow === 'PENDING')
      result = result.filter(r => r.status !== 'APPROVED' && r.status !== 'FILED');
    if (this.filterWorkflow === 'COMPLETED')
      result = result.filter(r => r.status === 'APPROVED' || r.status === 'FILED');
    return result;
  }

  get paginatedReports(): RegReport[] {
    const start = (this.reportPage - 1) * this.reportPageSize;
    return this.filteredReports.slice(start, start + this.reportPageSize);
  }

  get reportTotalPages(): number {
    return Math.ceil(this.filteredReports.length / this.reportPageSize) || 1;
  }

  reportPrevPage(): void {
    if (this.reportPage > 1) { this.reportPage--; this.cdr.detectChanges(); }
  }

  reportNextPage(): void {
    if (this.reportPage < this.reportTotalPages) { this.reportPage++; this.cdr.detectChanges(); }
  }

  // Users
  users: User[] = [];
  showUserModal = false;
  editingUser: User | null = null;
  userForm: User = { name: '', username: '', email: '', password: '', role: '', status: 'ACTIVE' };

  // Charts
  private templateChart: Chart | null = null;
  private fieldsChart: Chart | null = null;
  private chartsInitialized = false;

  // Notification
  notification: { message: string; type: 'success' | 'error' } | null = null;

  // Audit Log
  auditLogs: AuditLog[] = [];
  isLoadingAudit = false;
  auditSearchTerm = '';
  auditPage = 1;
  readonly auditPageSize = 10;

  // Notifications
  notifications: AppNotification[] = [];
  unreadCount = 0;
  showNotifPanel = false;
  private notifInterval: any;

  constructor(
    public authService: AuthService,
    private templateService: TemplateService,
    private reportService: ReportService,
    private userService: UserService,
    private auditService: AuditService,
    private notifService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  /**
   * Runs a callback inside Angular's zone and triggers change detection.
   * Prevents the double-click / stale-view glitch from HTTP callbacks
   * running outside Angular's zone (same pattern as OperationsComponent).
   */
  private run(fn: () => void): void {
    this.ngZone.run(() => {
      fn();
      this.cdr.detectChanges();
    });
  }

  ngOnInit(): void {
    this.username = this.authService.getUsername();
    this.loadTemplates();
    this.pollNotifications();
    this.notifInterval = setInterval(() => this.pollNotifications(), 30000);
  }

  ngOnDestroy(): void {
    if (this.notifInterval) clearInterval(this.notifInterval);
  }

  ngAfterViewInit(): void {
    if (this.activeTab === 'charts') {
      setTimeout(() => this.initCharts(), 300);
    }
  }

  // --- Tab Management ---
  switchTab(tab: 'templates' | 'fields' | 'reports' | 'users' | 'charts' | 'audit'): void {
    this.activeTab = tab;
    if (tab === 'fields') {
      this.selectAllFields();
    }
    if (tab === 'reports') {
      this.loadAllReports();
    }
    if (tab === 'users' && this.users.length === 0) {
      this.loadUsers();
    }
    if (tab === 'charts' && !this.chartsInitialized) {
      setTimeout(() => this.initCharts(), 300);
    }
    if (tab === 'audit') {
      this.loadAuditLogs();
    }
  }

  // --- Notifications ---
  showNotification(message: string, type: 'success' | 'error'): void {
    this.notification = { message, type };
    setTimeout(() => this.notification = null, 4000);
  }

  // --- Notification Bell ---
  pollNotifications(): void {
    this.notifService.getUnreadCount().subscribe({
      next: (res) => this.run(() => this.unreadCount = res.count),
      error: () => {}
    });
  }

  toggleNotifPanel(): void {
    this.showNotifPanel = !this.showNotifPanel;
    if (this.showNotifPanel) {
      this.notifService.getNotifications().subscribe({
        next: (data) => this.run(() => this.notifications = data),
        error: () => {}
      });
    }
  }

  markNotifRead(id: number): void {
    this.notifService.markAsRead(id).subscribe({
      next: () => this.run(() => {
        const n = this.notifications.find(x => x.notificationId === id);
        if (n) n.status = 'READ';
        this.unreadCount = Math.max(0, this.unreadCount - 1);
      }),
      error: () => {}
    });
  }

  markAllNotifRead(): void {
    this.notifService.markAllAsRead().subscribe({
      next: () => this.run(() => {
        this.notifications.forEach(n => n.status = 'READ');
        this.unreadCount = 0;
      }),
      error: () => {}
    });
  }

  getNotifIcon(category: string): string {
    const map: Record<string, string> = {
      'Report': 'description', 'Risk': 'trending_up', 'Validation': 'rule',
      'Data Upload': 'upload_file', 'Ingestion': 'input', 'Exception': 'warning',
      'Data Quality': 'verified', 'Template': 'view_column', 'Account': 'person',
      'Raw Records': 'storage'
    };
    return map[category] || 'notifications';
  }

  // --- Template Management ---
  loadTemplates(): void {
    this.templateService.getAllTemplates().subscribe({
      next: (data) => this.run(() => this.templates = data),
      error: () => this.run(() => this.showNotification('Failed to load templates', 'error'))
    });
  }

  openAddTemplate(): void {
    this.editingTemplate = null;
    this.templateForm = { regulationCode: '', description: '', frequency: '', status: 'ACTIVE' };
    this.showTemplateModal = true;
  }

  openEditTemplate(template: RegTemplate): void {
    this.editingTemplate = template;
    this.templateForm = { ...template };
    this.showTemplateModal = true;
  }

  closeTemplateModal(): void {
    this.showTemplateModal = false;
    this.editingTemplate = null;
    this.isSubmitting = false;
  }

  saveTemplate(): void {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    if (this.editingTemplate && this.editingTemplate.templateId) {
      this.templateService.updateTemplate(this.editingTemplate.templateId, this.templateForm).pipe(
        finalize(() => this.run(() => this.isSubmitting = false))
      ).subscribe({
        next: () => this.run(() => {
          this.loadTemplates();
          this.closeTemplateModal();
          this.showNotification('Template updated successfully', 'success');
        }),
        error: () => this.run(() => this.showNotification('Failed to update template', 'error'))
      });
    } else {
      this.templateService.createTemplate(this.templateForm).pipe(
        finalize(() => this.run(() => this.isSubmitting = false))
      ).subscribe({
        next: () => this.run(() => {
          this.loadTemplates();
          this.closeTemplateModal();
          this.showNotification('Template created successfully', 'success');
        }),
        error: () => this.run(() => this.showNotification('Failed to create template', 'error'))
      });
    }
  }

  deleteTemplate(id: number): void {
    if (confirm('Are you sure you want to delete this template?')) {
      this.templateService.deleteTemplate(id).subscribe({
        next: () => this.run(() => {
          this.loadTemplates();
          this.showNotification('Template deleted successfully', 'success');
        }),
        error: () => this.run(() => this.showNotification('Failed to delete template', 'error'))
      });
    }
  }

  // --- Field Management ---
  selectAllFields(): void {
    this.isAllFieldsMode = true;
    this.selectedTemplateId = null;
    const validTemplates = this.templates.filter(t => !!t.templateId);
    if (validTemplates.length === 0) { this.run(() => this.fields = []); return; }
    const combined: TemplateField[] = [];
    let remaining = validTemplates.length;
    validTemplates.forEach(t => {
      this.templateService.getFieldsByTemplateId(t.templateId!).subscribe({
        next: (data) => this.run(() => {
          data.forEach(f => combined.push({ ...f, template: f.template ?? t }));
          remaining--;
          if (remaining === 0) this.fields = [...combined].sort((a, b) => (a.fieldId ?? 0) - (b.fieldId ?? 0));
        }),
        error: () => this.run(() => {
          remaining--;
          if (remaining === 0) this.fields = [...combined].sort((a, b) => (a.fieldId ?? 0) - (b.fieldId ?? 0));
        })
      });
    });
  }

  selectTemplateForFields(templateId: number): void {
    this.isAllFieldsMode = false;
    this.selectedTemplateId = templateId;
    this.loadFields();
  }

  loadFields(): void {
    if (!this.selectedTemplateId) return;
    this.templateService.getFieldsByTemplateId(this.selectedTemplateId).subscribe({
      next: (data) => this.run(() => this.fields = data),
      error: () => this.run(() => this.showNotification('Failed to load fields', 'error'))
    });
  }

  openAddField(): void {
    this.editingField = null;
    this.fieldForm = { fieldName: '', dataType: '', mappingExpression: '', requiredFlag: false };
    this.fieldTargetTemplateId = null;
    this.showFieldModal = true;
  }

  openEditField(field: TemplateField): void {
    this.editingField = field;
    this.fieldForm = { ...field };
    this.showFieldModal = true;
  }

  closeFieldModal(): void {
    this.showFieldModal = false;
    this.editingField = null;
    this.isSubmitting = false;
  }

  saveField(): void {
    // In ALL mode use the template chosen inside the modal; otherwise use the active chip
    const targetId = this.selectedTemplateId ?? this.fieldTargetTemplateId;
    if (!targetId || this.isSubmitting) return;
    this.isSubmitting = true;
    if (this.editingField && this.editingField.fieldId) {
      this.templateService.updateField(this.editingField.fieldId, this.fieldForm).pipe(
        finalize(() => this.run(() => this.isSubmitting = false))
      ).subscribe({
        next: () => this.run(() => {
          this.isAllFieldsMode ? this.selectAllFields() : this.loadFields();
          this.closeFieldModal();
          this.showNotification('Field updated successfully', 'success');
        }),
        error: () => this.run(() => this.showNotification('Failed to update field', 'error'))
      });
    } else {
      this.templateService.addFieldToTemplate(targetId, this.fieldForm).pipe(
        finalize(() => this.run(() => this.isSubmitting = false))
      ).subscribe({
        next: () => this.run(() => {
          this.isAllFieldsMode ? this.selectAllFields() : this.loadFields();
          this.closeFieldModal();
          this.showNotification('Field added successfully', 'success');
        }),
        error: () => this.run(() => this.showNotification('Failed to add field', 'error'))
      });
    }
  }

  deleteField(fieldId: number): void {
    if (confirm('Are you sure you want to delete this field?')) {
      this.templateService.deleteField(fieldId).subscribe({
        next: () => this.run(() => {
          this.loadFields();
          this.showNotification('Field deleted successfully', 'success');
        }),
        error: () => this.run(() => this.showNotification('Failed to delete field', 'error'))
      });
    }
  }

  // --- Report Approval ---
  loadAllReports(): void {
    if (this.isLoadingReports) return;
    this.isLoadingReports = true;
    this.reportPage = 1;
    this.filterWorkflow = '';
    this.reportService.getReports().pipe(
      finalize(() => this.run(() => this.isLoadingReports = false))
    ).subscribe({
      next: (data) => this.run(() => this.reports = data),
      error: () => this.run(() => this.showNotification('Failed to load reports', 'error'))
    });
  }

  // --- Report Approval Modal ---
  showApproveModal = false;
  approveReportId: number | null = null;
  approveComments = '';

  openApproveModal(id: number): void {
    this.approveReportId = id;
    this.approveComments = '';
    this.showApproveModal = true;
  }

  closeApproveModal(): void {
    this.showApproveModal = false;
    this.approveReportId = null;
    this.approveComments = '';
  }

  confirmApproveReport(): void {
    if (!this.approveReportId || this.approvingReportId !== null) return;
    const id = this.approveReportId;
    const comments = this.approveComments;
    
    this.approvingReportId = id;
    this.showApproveModal = false;
    
    this.reportService.approveReport(id, comments).pipe(
      finalize(() => this.run(() => {
        this.approvingReportId = null;
        this.approveReportId = null;
        this.approveComments = '';
      }))
    ).subscribe({
      next: (updated) => this.run(() => {
        const idx = this.reports.findIndex(r => r.reportId === id);
        if (idx !== -1) this.reports[idx] = updated;
        this.showNotification('Report approved successfully', 'success');
      }),
      error: (err) => this.run(() => {
        const msg = err.error?.message || err.error || 'Failed to approve report';
        this.showNotification(typeof msg === 'string' ? msg : 'Failed to approve report', 'error');
      })
    });
  }

  // --- User Management ---
  loadUsers(): void {
    this.userService.getAllUsers().subscribe({
      next: (data) => this.run(() => this.users = data),
      error: () => this.run(() => this.showNotification('Failed to load users', 'error'))
    });
  }

  openAddUser(): void {
    this.editingUser = null;
    this.userForm = { name: '', username: '', email: '', password: '', role: '', status: 'ACTIVE' };
    this.showUserModal = true;
  }

  openEditUser(user: User): void {
    this.editingUser = user;
    this.userForm = { ...user, password: '' };
    this.showUserModal = true;
  }

  closeUserModal(): void {
    this.showUserModal = false;
    this.editingUser = null;
    this.isSubmitting = false;
  }

  saveUser(): void {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    if (this.editingUser && this.editingUser.id) {
      this.userService.updateUser(this.editingUser.id, this.userForm).pipe(
        finalize(() => this.run(() => this.isSubmitting = false))
      ).subscribe({
        next: () => this.run(() => {
          this.loadUsers();
          this.closeUserModal();
          this.showNotification('User updated successfully', 'success');
        }),
        error: (err) => this.run(() => this.showNotification(err.error?.message || err.error || 'Failed to update user', 'error'))
      });
    } else {
      this.userService.createUser(this.userForm).pipe(
        finalize(() => this.run(() => this.isSubmitting = false))
      ).subscribe({
        next: () => this.run(() => {
          this.loadUsers();
          this.closeUserModal();
          this.showNotification('User created successfully', 'success');
        }),
        error: (err) => this.run(() => this.showNotification(err.error?.message || err.error || 'Failed to create user', 'error'))
      });
    }
  }

  deleteUser(id: number): void {
    if (confirm('Are you sure you want to delete this user?')) {
      this.userService.deleteUser(id).subscribe({
        next: () => this.run(() => {
          this.loadUsers();
          this.showNotification('User deleted successfully', 'success');
        }),
        error: () => this.run(() => this.showNotification('Failed to delete user', 'error'))
      });
    }
  }

  toggleUserStatus(id: number): void {
    const user = this.users.find(u => u.id === id);
    if (user?.role === 'REGTECH_ADMIN') {
      this.showNotification("Can't disable the Admin", 'error');
      return;
    }
    this.userService.toggleUserStatus(id).subscribe({
      next: () => this.run(() => {
        this.loadUsers();
        this.showNotification('User status toggled', 'success');
      }),
      error: () => this.run(() => this.showNotification('Failed to update user status', 'error'))
    });
  }

  // --- Charts ---
  initCharts(): void {
    this.templateService.getAllTemplates().subscribe({
      next: (templates) => this.run(() => {
        this.buildTemplateChart(templates);
        this.loadFieldsForCharts(templates);
        this.chartsInitialized = true;
      }),
      error: () => this.run(() => this.showNotification('Failed to load chart data', 'error'))
    });
  }

  private buildTemplateChart(templates: RegTemplate[]): void {
    const canvas = this.templateChartRef?.nativeElement;
    if (!canvas) return;
    if (this.templateChart) this.templateChart.destroy();

    const statusCounts: Record<string, number> = {};
    templates.forEach(t => {
      const s = t.status || 'UNKNOWN';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);
    const colors = ['#004b8d', '#0066b3', '#28a745', '#f0ad4e', '#dc3545', '#6f42c1'];

    this.templateChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#6c757d',
              padding: 20,
              font: { family: 'Inter', size: 12 },
              usePointStyle: true,
              pointStyleWidth: 10
            }
          },
          title: {
            display: true,
            text: `Total Templates: ${templates.length}`,
            color: '#2c3e50',
            font: { family: 'Inter', size: 14, weight: 'bold' as const },
            padding: { bottom: 20 }
          }
        }
      }
    });
  }

  private loadFieldsForCharts(templates: RegTemplate[]): void {
    const chartData: { label: string; count: number }[] = [];
    let loaded = 0;

    if (templates.length === 0) {
      this.buildFieldsChart([]);
      return;
    }

    templates.forEach(t => {
      if (!t.templateId) { loaded++; return; }
      this.templateService.getFieldsByTemplateId(t.templateId).subscribe({
        next: (fields) => this.run(() => {
          chartData.push({ label: t.regulationCode || `Template ${t.templateId}`, count: fields.length });
          loaded++;
          if (loaded === templates.length) this.buildFieldsChart(chartData);
        }),
        error: () => this.run(() => {
          chartData.push({ label: t.regulationCode || `Template ${t.templateId}`, count: 0 });
          loaded++;
          if (loaded === templates.length) this.buildFieldsChart(chartData);
        })
      });
    });
  }

  private buildFieldsChart(data: { label: string; count: number }[]): void {
    const canvas = this.fieldsChartRef?.nativeElement;
    if (!canvas) return;
    if (this.fieldsChart) this.fieldsChart.destroy();

    this.fieldsChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          label: 'Number of Fields',
          data: data.map(d => d.count),
          backgroundColor: 'rgba(0, 75, 141, 0.7)',
          borderColor: '#004b8d',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { color: '#6c757d', font: { family: 'Inter', size: 11 } },
            grid: { color: '#e9ecef' }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: '#6c757d',
              font: { family: 'Inter', size: 11 },
              stepSize: 1
            },
            grid: { color: '#e9ecef' }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Fields per Template',
            color: '#2c3e50',
            font: { family: 'Inter', size: 14, weight: 'bold' as const },
            padding: { bottom: 20 }
          }
        }
      }
    });
  }

  // --- Audit Log ---
  loadAuditLogs(): void {
    this.isLoadingAudit = true;
    this.auditService.getAuditLogs().pipe(
      finalize(() => this.run(() => this.isLoadingAudit = false))
    ).subscribe({
      next: (data) => this.run(() => {
        this.auditLogs = data;
        this.auditPage = 1;
      }),
      error: () => this.run(() => this.showNotification('Failed to load audit logs', 'error'))
    });
  }

  get filteredAuditLogs(): AuditLog[] {
    if (!this.auditSearchTerm.trim()) return this.auditLogs;
    const term = this.auditSearchTerm.toLowerCase();
    return this.auditLogs.filter(log =>
      (log.action || '').toLowerCase().includes(term) ||
      (log.resource || '').toLowerCase().includes(term) ||
      (log.metadata || '').toLowerCase().includes(term) ||
      (log.user?.name || '').toLowerCase().includes(term) ||
      (log.user?.role || '').toLowerCase().includes(term)
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
  auditPrevPage(): void { if (this.auditPage > 1) { this.auditPage--; this.cdr.detectChanges(); } }
  auditNextPage(): void { if (this.auditPage < this.auditTotalPages) { this.auditPage++; this.cdr.detectChanges(); } }

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
      'RESOLVED_REPORT_EXCEPTION': 'Resolved Exception',
      'RUN_INGESTION': 'Ran Ingestion',
      'RUN_VALIDATION_ON_RAW': 'Validated Raw Data'
    };
    return map[action] || action.replace(/_/g, ' ');
  }

  getAuditActionClass(action: string): string {
    if (action.includes('RESOLVED')) return 'action-resolve';
    if (action.includes('SUBMITTED') || action.includes('FILED')) return 'action-submit';
    if (action.includes('GENERATE') || action.includes('INGESTION')) return 'action-generate';
    if (action.includes('CALCULATE') || action.includes('RAN') || action.includes('RUN')) return 'action-run';
    if (action.includes('VIEWED')) return 'action-view';
    if (action.includes('APPROVED') || action.includes('WORKFLOW')) return 'action-approve';
    return 'action-default';
  }

  getAuditActionIcon(action: string): string {
    if (action.includes('GENERATE') || action.includes('INGESTION')) return 'auto_awesome';
    if (action.includes('CALCULATE') || action.includes('RUN')) return 'calculate';
    if (action.includes('RESOLVED')) return 'check_circle';
    if (action.includes('SUBMITTED')) return 'send';
    if (action.includes('APPROVED') || action.includes('WORKFLOW')) return 'verified';
    if (action.includes('FILED')) return 'publish';
    if (action.includes('VIEWED')) return 'visibility';
    return 'info';
  }

  // --- Logout ---
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  getStatusClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': case 'APPROVED': case 'FILED': return 'status-success';
      case 'DRAFT': case 'GENERATED': return 'status-info';
      case 'PENDING': case 'SUBMITTED': return 'status-warning';
      case 'INACTIVE': case 'REJECTED': return 'status-danger';
      case 'UNDER_REVIEW': return 'status-review';
      default: return 'status-default';
    }
  }
}
