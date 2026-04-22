import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RegTemplate, TemplateField } from '../models/template.model';

@Injectable({
  providedIn: 'root'
})
export class TemplateService {
  private readonly API_URL = 'http://localhost:9090/api/templates';

  constructor(private http: HttpClient) {}

  getAllTemplates(): Observable<RegTemplate[]> {
    return this.http.get<RegTemplate[]>(this.API_URL);
  }

  getTemplateById(id: number): Observable<RegTemplate> {
    return this.http.get<RegTemplate>(`${this.API_URL}/${id}`);
  }

  createTemplate(template: RegTemplate): Observable<RegTemplate> {
    return this.http.post<RegTemplate>(this.API_URL, template);
  }

  updateTemplate(id: number, template: RegTemplate): Observable<RegTemplate> {
    return this.http.put<RegTemplate>(`${this.API_URL}/${id}`, template);
  }

  deleteTemplate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  getFieldsByTemplateId(templateId: number): Observable<TemplateField[]> {
    return this.http.get<TemplateField[]>(`${this.API_URL}/${templateId}/fields`);
  }

  addFieldToTemplate(templateId: number, field: TemplateField): Observable<TemplateField> {
    return this.http.post<TemplateField>(`${this.API_URL}/${templateId}/fields`, field);
  }

  updateField(fieldId: number, field: TemplateField): Observable<TemplateField> {
    return this.http.put<TemplateField>(`${this.API_URL}/fields/${fieldId}`, field);
  }

  deleteField(fieldId: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/fields/${fieldId}`);
  }
}
