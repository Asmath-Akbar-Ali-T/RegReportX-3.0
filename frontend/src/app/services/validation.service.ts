import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DataQualityIssue } from '../models/data-quality.model';

@Injectable({
  providedIn: 'root'
})
export class ValidationService {
  private readonly API_URL = 'http://localhost:9090/api/validation';

  constructor(private http: HttpClient) {}

  runValidation(): Observable<DataQualityIssue[]> {
    return this.http.get<DataQualityIssue[]>(`${this.API_URL}/run`);
  }

  getIssues(): Observable<DataQualityIssue[]> {
    return this.http.get<DataQualityIssue[]>(`${this.API_URL}/issues`);
  }
}
