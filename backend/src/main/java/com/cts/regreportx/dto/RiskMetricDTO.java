package com.cts.regreportx.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RiskMetricDTO {
    private Integer metricId;
    private RegReportDTO report;
    private String metricName;
    private BigDecimal metricValue;
    private LocalDateTime calculationDate;
}
