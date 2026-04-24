package com.cts.regreportx.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExceptionRecordDTO {
    private Integer exceptionId;
    private RegReportDTO report;
    private TemplateFieldDTO templateField;
    private String issue;
    private String severity;
    private UserDTO assignedUser;
    private String status;
    private String justification;
}
