import { RawDataBatch } from './ingestion.model';
import { ValidationRule } from './validation.model';

export interface DataQualityIssue {
  issueId: number;
  batch?: RawDataBatch;
  rule?: ValidationRule;
  recordId: string;
  message: string;
  severity: string;
  loggedDate: string;
  status: 'OPEN' | 'RESOLVED' | 'WAIVED';
}

export interface DataQualityResolveRequest {
  correctedValue: string;
  justification: string;
}
