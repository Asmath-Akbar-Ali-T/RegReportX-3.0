package com.cts.regreportx.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FilingWorkflowDTO {
    private Integer workflowId;
    private RegReportDTO report;
    private String stepName;
    private UserDTO actor;
    private LocalDateTime stepDate;
    private String status;
    private String comments;
}
