import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, timeout, catchError } from 'rxjs';
import { Loan, Deposit, TreasuryTrade, GeneralLedger, RawRecord, UploadResponse } from '../models/operations.model';
import { RawDataBatch } from '../models/ingestion.model';
import { AuditLog } from '../models/audit-log.model';

@Injectable({
  providedIn: 'root'
})
export class OperationsService {
  private apiUrl = 'http://localhost:9090/api';
  private readonly TIMEOUT = 15000;

  constructor(private http: HttpClient) {}

  // Source Data Getters
  getLoans(): Observable<Loan[]> {
    return this.http.get<Loan[]>(`${this.apiUrl}/loans`).pipe(
      timeout(this.TIMEOUT),
      catchError(err => { console.error('getLoans failed:', err); return of([]); })
    );
  }

  getDeposits(): Observable<Deposit[]> {
    return this.http.get<Deposit[]>(`${this.apiUrl}/deposits`).pipe(
      timeout(this.TIMEOUT),
      catchError(err => { console.error('getDeposits failed:', err); return of([]); })
    );
  }

  getTreasury(): Observable<TreasuryTrade[]> {
    return this.http.get<TreasuryTrade[]>(`${this.apiUrl}/treasury`).pipe(
      timeout(this.TIMEOUT),
      catchError(err => { console.error('getTreasury failed:', err); return of([]); })
    );
  }

  getGl(): Observable<GeneralLedger[]> {
    return this.http.get<GeneralLedger[]>(`${this.apiUrl}/gl`).pipe(
      timeout(this.TIMEOUT),
      catchError(err => { console.error('getGl failed:', err); return of([]); })
    );
  }

  // CSV Uploads
  uploadCsv(type: 'loans' | 'deposits' | 'treasury' | 'general-ledger', file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadResponse>(`${this.apiUrl}/ingestion/csv/${type}/upload`, formData).pipe(
      timeout(30000)
    );
  }

  // Ingestion
  runIngestion(): Observable<RawDataBatch[]> {
    return this.http.post<RawDataBatch[]>(`${this.apiUrl}/ingestion/run`, {}).pipe(
      timeout(60000)
    );
  }

  getIngestionBatches(): Observable<RawDataBatch[]> {
    return this.http.get<RawDataBatch[]>(`${this.apiUrl}/ingestion/batches`).pipe(
      timeout(this.TIMEOUT),
      catchError(err => { console.error('getIngestionBatches failed:', err); return of([]); })
    );
  }

  // Raw Records
  loadRawRecords(batchId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/raw-records/load/${batchId}`, {}).pipe(
      timeout(30000)
    );
  }

  getRawRecordsByBatch(batchId: number): Observable<RawRecord[]> {
    return this.http.get<RawRecord[]>(`${this.apiUrl}/raw-records/batch/${batchId}`).pipe(
      timeout(this.TIMEOUT),
      catchError(err => { console.error('getRawRecordsByBatch failed:', err); return of([]); })
    );
  }

  // Audit Logs
  getAllAuditLogs(): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${this.apiUrl}/audit`).pipe(
      timeout(this.TIMEOUT),
      catchError(err => { console.error('getAllAuditLogs failed:', err); return of([]); })
    );
  }
}
