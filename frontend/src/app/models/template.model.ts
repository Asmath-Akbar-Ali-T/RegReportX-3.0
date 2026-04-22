export interface RegTemplate {
  templateId?: number;
  regulationCode: string;
  description: string;
  frequency: string;
  status: string;
}

export interface TemplateField {
  fieldId?: number;
  template?: RegTemplate;
  fieldName: string;
  dataType: string;
  mappingExpression: string;
  requiredFlag: boolean;
}
