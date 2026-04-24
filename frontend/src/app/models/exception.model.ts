import { RegReport } from './report.model';
import { User } from './user.model';
import { TemplateField } from './template.model';

export interface ExceptionRecord {
  exceptionId: number;
  report: RegReport;
  templateField: TemplateField;
  issue: string;
  severity: string;
  assignedUser: User;
  status: string;
  justification?: string;
}

export interface ExceptionResolveRequest {
  justification: string;
}
