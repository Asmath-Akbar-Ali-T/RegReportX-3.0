package com.cts.regreportx.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ValidationRuleDTO {
    private Integer ruleId;
    private String name;
    private String ruleExpression;
    private String severity;
    private String status;
}
