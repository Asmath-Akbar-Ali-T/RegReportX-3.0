import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RegReport } from '../models/report.model';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private readonly API_URL = 'http://localhost:9090/api/report';

  constructor(private http: HttpClient) {}

  getReport(id: number): Observable<RegReport> {
    return this.http.get<RegReport>(`${this.API_URL}/${id}`);
  }

  getReports(): Observable<RegReport[]> {
    return this.http.get<RegReport[]>(this.API_URL);
  }

  generateReport(templateId: number, period: string): Observable<RegReport> {
    const params = new HttpParams()
      .set('templateId', templateId.toString())
      .set('period', period);
    return this.http.post<RegReport>(`${this.API_URL}/generate`, null, { params });
  }

  approveReport(id: number, actorId: number = 1, comments?: string): Observable<RegReport> {
    let params = new HttpParams().set('actorId', actorId.toString());
    if (comments) {
      params = params.set('comments', comments);
    }
    return this.http.put<RegReport>(`${this.API_URL}/${id}/approve`, null, { params });
  }

  submitReport(id: number, actorId: number = 1): Observable<RegReport> {
    const params = new HttpParams().set('actorId', actorId.toString());
    return this.http.put<RegReport>(`${this.API_URL}/${id}/submit`, null, { params });
  }

  fileReport(id: number, actorId: number = 1): Observable<RegReport> {
    const params = new HttpParams().set('actorId', actorId.toString());
    return this.http.put<RegReport>(`${this.API_URL}/${id}/file`, null, { params });
  }
}
