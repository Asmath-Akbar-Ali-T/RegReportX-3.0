import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthRequest, AuthResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://localhost:9090/api/auth';
  private readonly TOKEN_KEY = 'jwt_token';

  constructor(private http: HttpClient) {}

  login(credentials: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials).pipe(
      tap(response => {
        if (response.token) {
          localStorage.setItem(this.TOKEN_KEY, response.token);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /** Decode JWT payload safely */
  private decodeToken(): any {
    const token = this.getToken();
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    const payload = this.decodeToken();
    if (!payload) return false;
    return payload.exp * 1000 > Date.now();
  }

  /** Read username from JWT 'sub' claim */
  getUsername(): string | null {
    return this.decodeToken()?.sub || null;
  }

  /** Read role from JWT 'role' claim (server-signed, tamper-proof) */
  getRole(): string | null {
    return this.decodeToken()?.role || null;
  }

  hasRole(role: string): boolean {
    return this.isAuthenticated() && this.getRole() === role;
  }

  hasAnyRole(...roles: string[]): boolean {
    return this.isAuthenticated() && roles.includes(this.getRole() || '');
  }
}
