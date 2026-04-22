import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }
  router.navigate(['/login']);
  return false;
};

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasRole('REGTECH_ADMIN')) {
    return true;
  }
  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
  } else {
    router.navigate(['/unauthorized']);
  }
  return false;
};

export const complianceGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasAnyRole('COMPLIANCE_ANALYST', 'REGTECH_ADMIN')) {
    return true;
  }
  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
  } else {
    router.navigate(['/unauthorized']);
  }
  return false;
};

export const riskGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasAnyRole('RISK_ANALYST', 'REGTECH_ADMIN')) {
    return true;
  }
  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
  } else {
    router.navigate(['/unauthorized']);
  }
  return false;
};

export const reportingGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasAnyRole('REPORTING_OFFICER', 'REGTECH_ADMIN')) {
    return true;
  }
  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
  } else {
    router.navigate(['/unauthorized']);
  }
  return false;
};

export const operationsGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasAnyRole('OPERATIONS_OFFICER', 'REGTECH_ADMIN')) {
    return true;
  }
  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
  } else {
    router.navigate(['/unauthorized']);
  }
  return false;
};
