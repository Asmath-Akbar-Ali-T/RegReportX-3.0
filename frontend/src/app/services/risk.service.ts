import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RiskMetric } from '../models/risk-metric.model';

@Injectable({
  providedIn: 'root'
})
export class RiskService {
  private readonly API_URL = 'http://localhost:9090/api/risk';

  constructor(private http: HttpClient) {}

  getMetrics(): Observable<RiskMetric[]> {
    return this.http.get<RiskMetric[]>(`${this.API_URL}/metrics`);
  }

  calculateMetrics(reportId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/calculate/${reportId}`, {});
  }
}
