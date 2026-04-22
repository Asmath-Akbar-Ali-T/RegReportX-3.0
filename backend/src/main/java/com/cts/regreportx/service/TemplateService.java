package com.cts.regreportx.service;

import com.cts.regreportx.model.RegTemplate;
import com.cts.regreportx.model.TemplateField;
import com.cts.regreportx.repository.RegTemplateRepository;
import com.cts.regreportx.repository.TemplateFieldRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class TemplateService {

    private final RegTemplateRepository templateRepository;
    private final TemplateFieldRepository fieldRepository;

    @Autowired
    public TemplateService(RegTemplateRepository templateRepository, TemplateFieldRepository fieldRepository) {
        this.templateRepository = templateRepository;
        this.fieldRepository = fieldRepository;
    }


    public RegTemplate createTemplate(RegTemplate template) {
        return templateRepository.save(template);
    }

    public List<RegTemplate> getAllTemplates() {
        return templateRepository.findAll();
    }

    public Optional<RegTemplate> getTemplateById(Integer id) {
        return templateRepository.findById(id);
    }

    public RegTemplate updateTemplate(Integer id, RegTemplate templateDetails) {
        return templateRepository.findById(id).map(temp -> {
            temp.setRegulationCode(templateDetails.getRegulationCode());
            temp.setDescription(templateDetails.getDescription());
            temp.setFrequency(templateDetails.getFrequency());
            temp.setStatus(templateDetails.getStatus());
            return templateRepository.save(temp);
        }).orElseThrow(() -> new RuntimeException("Template not found with id " + id));
    }

    public void deleteTemplate(Integer id) {
        templateRepository.deleteById(id);
    }


    public TemplateField addFieldToTemplate(Integer templateId, TemplateField field) {
        field.setTemplate(templateRepository.getReferenceById(templateId));
        return fieldRepository.save(field);
    }

    public List<TemplateField> getFieldsByTemplateId(Integer templateId) {
        return fieldRepository.findByTemplate_TemplateId(templateId);
    }

    public TemplateField updateField(Integer fieldId, TemplateField fieldDetails) {
        return fieldRepository.findById(fieldId).map(field -> {
            field.setFieldName(fieldDetails.getFieldName());
            field.setDataType(fieldDetails.getDataType());
            field.setMappingExpression(fieldDetails.getMappingExpression());
            field.setRequiredFlag(fieldDetails.getRequiredFlag());
            return fieldRepository.save(field);
        }).orElseThrow(() -> new RuntimeException("Field not found with id " + fieldId));
    }

    public void deleteField(Integer fieldId) {
        fieldRepository.deleteById(fieldId);
    }
}
