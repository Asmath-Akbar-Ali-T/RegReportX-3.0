import { RegTemplate } from './template.model';

export interface RegReport {
  reportId?: number;
  template?: RegTemplate;
  period: string;
  generatedDate?: string;
  status: string;
}

export interface FilingWorkflowStep {
  workflowId: number;
  stepName: string;
  stepDate: string;
  status: string;
  comments?: string;
  actor?: {
    id: number;
    name: string;
    role: string;
    username?: string;
  };
}
