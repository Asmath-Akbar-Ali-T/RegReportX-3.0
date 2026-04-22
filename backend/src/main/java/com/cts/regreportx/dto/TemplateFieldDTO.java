package com.cts.regreportx.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TemplateFieldDTO {
    private Integer fieldId;
    private RegTemplateDTO template;
    private String fieldName;
    private String dataType;
    private String mappingExpression;
    private Boolean requiredFlag;
}
