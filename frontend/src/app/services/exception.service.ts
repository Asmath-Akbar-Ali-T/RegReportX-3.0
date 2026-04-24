import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExceptionRecord, ExceptionResolveRequest } from '../models/exception.model';

@Injectable({
  providedIn: 'root'
})
export class ExceptionService {
  private readonly API_URL = 'http://localhost:9090/api/exceptions';

  constructor(private http: HttpClient) {}

  getAllExceptions(): Observable<ExceptionRecord[]> {
    return this.http.get<ExceptionRecord[]>(`${this.API_URL}/all`);
  }

  getOpenExceptions(): Observable<ExceptionRecord[]> {
    return this.http.get<ExceptionRecord[]>(`${this.API_URL}/open`);
  }

  resolveException(id: number, request: ExceptionResolveRequest): Observable<any> {
    return this.http.put(`${this.API_URL}/${id}/resolve`, request);
  }

  generateExceptions(reportId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/generate/${reportId}`, {});
  }
}
