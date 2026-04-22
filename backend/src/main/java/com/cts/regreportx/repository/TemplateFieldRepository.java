package com.cts.regreportx.repository;

import com.cts.regreportx.model.TemplateField;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TemplateFieldRepository extends JpaRepository<TemplateField, Integer> {
    List<TemplateField> findByTemplate_TemplateId(Integer templateId);
    List<TemplateField> findByFieldName(String fieldName);
}
