import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="unauth-page">
      <div class="unauth-card">
        <span class="material-icons icon">block</span>
        <h2>Access Denied</h2>
        <p>You do not have permission to access this page.</p>
        <a routerLink="/" class="back-btn">
          <span class="material-icons">home</span>
          Back to Home
        </a>
      </div>
    </div>
  `,
  styles: [`
    .unauth-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: var(--bg); }
    .unauth-card { text-align: center; background: var(--white); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 3rem 2.5rem; box-shadow: var(--shadow-md); }
    .icon { font-size: 56px; color: var(--danger); margin-bottom: 1rem; }
    h2 { font-size: 1.4rem; font-weight: 700; color: var(--text); margin-bottom: 0.4rem; }
    p { font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem; }
    .back-btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 1.25rem; background: var(--primary); color: #fff; border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 600; }
    .back-btn:hover { background: var(--primary-dark); }
    .back-btn .material-icons { font-size: 18px; }
  `]
})
export class UnauthorizedComponent {}
