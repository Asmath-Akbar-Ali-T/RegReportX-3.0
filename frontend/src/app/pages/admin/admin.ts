import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TemplateService } from '../../services/template.service';
import { ReportService } from '../../services/report.service';
import { UserService } from '../../services/user.service';
import { RegTemplate, TemplateField } from '../../models/template.model';
import { RegReport } from '../../models/report.model';
import { User } from '../../models/user.model';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class AdminComponent implements OnInit, AfterViewInit {
  @ViewChild('templateChart') templateChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fieldsChart') fieldsChartRef!: ElementRef<HTMLCanvasElement>;

  activeTab: 'templates' | 'fields' | 'reports' | 'users' | 'charts' = 'templates';
  username: string | null = '';

  // Templates
  templates: RegTemplate[] = [];
  showTemplateModal = false;
  editingTemplate: RegTemplate | null = null;
  templateForm: RegTemplate = { regulationCode: '', description: '', frequency: '', status: 'ACTIVE' };

  // Fields
  selectedTemplateId: number | null = null;
  fields: TemplateField[] = [];
  showFieldModal = false;
  editingField: TemplateField | null = null;
  fieldForm: TemplateField = { fieldName: '', dataType: '', mappingExpression: '', requiredFlag: false };

  // Reports
  reportIdInput = '';
  reports: RegReport[] = [];

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

  constructor(
    public authService: AuthService,
    private templateService: TemplateService,
    private reportService: ReportService,
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.username = this.authService.getUsername();
    this.loadTemplates();
  }

  ngAfterViewInit(): void {
    if (this.activeTab === 'charts') {
      setTimeout(() => this.initCharts(), 300);
    }
  }

  // --- Tab Management ---
  switchTab(tab: 'templates' | 'fields' | 'reports' | 'users' | 'charts'): void {
    this.activeTab = tab;
    if (tab === 'users' && this.users.length === 0) {
      this.loadUsers();
    }
    if (tab === 'charts' && !this.chartsInitialized) {
      setTimeout(() => this.initCharts(), 300);
    }
  }

  // --- Notifications ---
  showNotification(message: string, type: 'success' | 'error'): void {
    this.notification = { message, type };
    setTimeout(() => this.notification = null, 4000);
  }

  // --- Template Management ---
  loadTemplates(): void {
    this.templateService.getAllTemplates().subscribe({
      next: (data) => this.templates = data,
      error: () => this.showNotification('Failed to load templates', 'error')
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
  }

  saveTemplate(): void {
    if (this.editingTemplate && this.editingTemplate.templateId) {
      this.templateService.updateTemplate(this.editingTemplate.templateId, this.templateForm).subscribe({
        next: () => {
          this.loadTemplates();
          this.closeTemplateModal();
          this.showNotification('Template updated successfully', 'success');
        },
        error: () => this.showNotification('Failed to update template', 'error')
      });
    } else {
      this.templateService.createTemplate(this.templateForm).subscribe({
        next: () => {
          this.loadTemplates();
          this.closeTemplateModal();
          this.showNotification('Template created successfully', 'success');
        },
        error: () => this.showNotification('Failed to create template', 'error')
      });
    }
  }

  deleteTemplate(id: number): void {
    if (confirm('Are you sure you want to delete this template?')) {
      this.templateService.deleteTemplate(id).subscribe({
        next: () => {
          this.loadTemplates();
          this.showNotification('Template deleted successfully', 'success');
        },
        error: () => this.showNotification('Failed to delete template', 'error')
      });
    }
  }

  // --- Field Management ---
  selectTemplateForFields(templateId: number): void {
    this.selectedTemplateId = templateId;
    this.loadFields();
  }

  loadFields(): void {
    if (!this.selectedTemplateId) return;
    this.templateService.getFieldsByTemplateId(this.selectedTemplateId).subscribe({
      next: (data) => this.fields = data,
      error: () => this.showNotification('Failed to load fields', 'error')
    });
  }

  openAddField(): void {
    this.editingField = null;
    this.fieldForm = { fieldName: '', dataType: '', mappingExpression: '', requiredFlag: false };
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
  }

  saveField(): void {
    if (!this.selectedTemplateId) return;
    if (this.editingField && this.editingField.fieldId) {
      this.templateService.updateField(this.editingField.fieldId, this.fieldForm).subscribe({
        next: () => {
          this.loadFields();
          this.closeFieldModal();
          this.showNotification('Field updated successfully', 'success');
        },
        error: () => this.showNotification('Failed to update field', 'error')
      });
    } else {
      this.templateService.addFieldToTemplate(this.selectedTemplateId, this.fieldForm).subscribe({
        next: () => {
          this.loadFields();
          this.closeFieldModal();
          this.showNotification('Field added successfully', 'success');
        },
        error: () => this.showNotification('Failed to add field', 'error')
      });
    }
  }

  deleteField(fieldId: number): void {
    if (confirm('Are you sure you want to delete this field?')) {
      this.templateService.deleteField(fieldId).subscribe({
        next: () => {
          this.loadFields();
          this.showNotification('Field deleted successfully', 'success');
        },
        error: () => this.showNotification('Failed to delete field', 'error')
      });
    }
  }

  // --- Report Approval ---
  fetchReport(): void {
    const id = parseInt(this.reportIdInput, 10);
    if (isNaN(id)) {
      this.showNotification('Please enter a valid report ID', 'error');
      return;
    }
    this.reportService.getReport(id).subscribe({
      next: (report) => {
        const exists = this.reports.find(r => r.reportId === report.reportId);
        if (!exists) {
          this.reports.push(report);
        } else {
          const idx = this.reports.findIndex(r => r.reportId === report.reportId);
          this.reports[idx] = report;
        }
        this.reportIdInput = '';
      },
      error: () => this.showNotification('Report not found', 'error')
    });
  }

  approveReport(id: number): void {
    this.reportService.approveReport(id, 1).subscribe({
      next: (updated) => {
        const idx = this.reports.findIndex(r => r.reportId === id);
        if (idx !== -1) this.reports[idx] = updated;
        this.showNotification('Report approved successfully', 'success');
      },
      error: (err) => {
        const msg = err.error?.message || err.error || 'Failed to approve report';
        this.showNotification(typeof msg === 'string' ? msg : 'Failed to approve report', 'error');
      }
    });
  }

  // --- User Management ---
  loadUsers(): void {
    this.userService.getAllUsers().subscribe({
      next: (data) => this.users = data,
      error: () => this.showNotification('Failed to load users', 'error')
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
  }

  saveUser(): void {
    if (this.editingUser && this.editingUser.id) {
      this.userService.updateUser(this.editingUser.id, this.userForm).subscribe({
        next: () => {
          this.loadUsers();
          this.closeUserModal();
          this.showNotification('User updated successfully', 'success');
        },
        error: (err) => this.showNotification(err.error?.message || err.error || 'Failed to update user', 'error')
      });
    } else {
      this.userService.createUser(this.userForm).subscribe({
        next: () => {
          this.loadUsers();
          this.closeUserModal();
          this.showNotification('User created successfully', 'success');
        },
        error: (err) => this.showNotification(err.error?.message || err.error || 'Failed to create user', 'error')
      });
    }
  }

  deleteUser(id: number): void {
    if (confirm('Are you sure you want to delete this user?')) {
      this.userService.deleteUser(id).subscribe({
        next: () => {
          this.loadUsers();
          this.showNotification('User deleted successfully', 'success');
        },
        error: () => this.showNotification('Failed to delete user', 'error')
      });
    }
  }

  toggleUserStatus(id: number): void {
    this.userService.toggleUserStatus(id).subscribe({
      next: () => {
        this.loadUsers();
        this.showNotification('User status toggled', 'success');
      },
      error: () => this.showNotification('Failed to update user status', 'error')
    });
  }

  // --- Charts ---
  initCharts(): void {
    this.templateService.getAllTemplates().subscribe({
      next: (templates) => {
        this.buildTemplateChart(templates);
        this.loadFieldsForCharts(templates);
        this.chartsInitialized = true;
      }
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
        next: (fields) => {
          chartData.push({ label: t.regulationCode || `Template ${t.templateId}`, count: fields.length });
          loaded++;
          if (loaded === templates.length) this.buildFieldsChart(chartData);
        },
        error: () => {
          chartData.push({ label: t.regulationCode || `Template ${t.templateId}`, count: 0 });
          loaded++;
          if (loaded === templates.length) this.buildFieldsChart(chartData);
        }
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
      default: return 'status-default';
    }
  }
}
