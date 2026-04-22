package com.cts.regreportx.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegReportDTO {
    private Integer reportId;
    private RegTemplateDTO template;
    private String period;
    private LocalDateTime generatedDate;
    private String status;
}
