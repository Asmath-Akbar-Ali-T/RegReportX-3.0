package com.cts.regreportx.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DataQualityIssueDTO {
    private Integer issueId;
    private RawDataBatchDTO batch;
    private ValidationRuleDTO rule;
    private String recordId;
    private String message;
    private String severity;
    private LocalDateTime loggedDate;
    private String status;
}
