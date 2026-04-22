export interface RiskMetric {
  metricId: number;
  report: {
    reportId: number;
    period: string;
    status: string;
    template?: {
      templateId: number;
      regulationCode: string;
    };
  } | null;
  metricName: string;
  metricValue: number;
  calculationDate: string;
}
