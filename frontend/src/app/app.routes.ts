import { Routes } from '@angular/router';
import { authGuard, adminGuard, complianceGuard, riskGuard, reportingGuard, operationsGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then(m => m.HomeComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'unauthorized',
    loadComponent: () => import('./pages/unauthorized/unauthorized').then(m => m.UnauthorizedComponent)
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then(m => m.AdminComponent), canActivate: [adminGuard]
  },
  {
    path: 'compliance',
    loadComponent: () => import('./pages/compliance/compliance').then(m => m.ComplianceComponent), canActivate: [complianceGuard]
  },
  {
    path: 'risk',
    loadComponent: () => import('./pages/risk/risk').then(m => m.RiskComponent), canActivate: [riskGuard]
  },
  {
    path: 'reporting',
    loadComponent: () => import('./pages/reporting/reporting').then(m => m.ReportingComponent), canActivate: [reportingGuard]
  },
  {
    path: 'operations',
    loadComponent: () => import('./pages/operations/operations').then(m => m.OperationsComponent), canActivate: [operationsGuard]
  },
  { path: '**', redirectTo: '' }
];
