import { RegTemplate } from './template.model';

export interface RegReport {
  reportId?: number;
  template?: RegTemplate;
  period: string;
  generatedDate?: string;
  status: string;
}
