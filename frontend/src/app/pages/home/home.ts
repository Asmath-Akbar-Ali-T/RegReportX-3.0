import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent {
  constructor(public authService: AuthService, private router: Router) {}

  goToDashboard(): void {
    const role = this.authService.getRole();
    switch (role) {
      case 'REGTECH_ADMIN': this.router.navigate(['/admin']); break;
      case 'COMPLIANCE_ANALYST': this.router.navigate(['/compliance']); break;
      case 'RISK_ANALYST': this.router.navigate(['/risk']); break;
      case 'REPORTING_OFFICER': this.router.navigate(['/reporting']); break;
      case 'OPERATIONS_OFFICER': this.router.navigate(['/operations']); break;
      default: this.router.navigate(['/']); break;
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
