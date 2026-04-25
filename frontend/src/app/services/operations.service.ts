import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, OperatorFunction, of, timeout, catchError } from 'rxjs';
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

  private withFallback<T>(context: string, fallback: T): OperatorFunction<T, T> {
    return catchError((err: any): Observable<T> => { console.error(`${context} failed:`, err); return of(fallback); });
  }

  // Source Data Getters
  getLoans(): Observable<Loan[]> {
    return this.http.get<Loan[]>(`${this.apiUrl}/loans`).pipe(
      timeout(this.TIMEOUT), this.withFallback('getLoans', [] as Loan[])
    );
  }

  getDeposits(): Observable<Deposit[]> {
    return this.http.get<Deposit[]>(`${this.apiUrl}/deposits`).pipe(
      timeout(this.TIMEOUT), this.withFallback('getDeposits', [] as Deposit[])
    );
  }

  getTreasury(): Observable<TreasuryTrade[]> {
    return this.http.get<TreasuryTrade[]>(`${this.apiUrl}/treasury`).pipe(
      timeout(this.TIMEOUT), this.withFallback('getTreasury', [] as TreasuryTrade[])
    );
  }

  getGl(): Observable<GeneralLedger[]> {
    return this.http.get<GeneralLedger[]>(`${this.apiUrl}/gl`).pipe(
      timeout(this.TIMEOUT), this.withFallback('getGl', [] as GeneralLedger[])
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
      timeout(this.TIMEOUT), this.withFallback('getIngestionBatches', [] as RawDataBatch[])
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
      timeout(this.TIMEOUT), this.withFallback('getRawRecordsByBatch', [] as RawRecord[])
    );
  }

  // Audit Logs
  getAllAuditLogs(): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${this.apiUrl}/audit`).pipe(
      timeout(this.TIMEOUT), this.withFallback('getAllAuditLogs', [] as AuditLog[])
    );
  }
}
