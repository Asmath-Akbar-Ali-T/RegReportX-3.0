import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DataQualityIssue, DataQualityResolveRequest } from '../models/data-quality.model';

@Injectable({
  providedIn: 'root'
})
export class DataQualityService {
  private readonly API_URL = 'http://localhost:9090/api/data-quality';

  constructor(private http: HttpClient) {}

  getOpenIssues(): Observable<DataQualityIssue[]> {
    return this.http.get<DataQualityIssue[]>(`${this.API_URL}/issues`);
  }

  resolveIssue(id: number, request: DataQualityResolveRequest): Observable<any> {
    return this.http.put(`${this.API_URL}/issues/${id}/resolve`, request);
  }
}
