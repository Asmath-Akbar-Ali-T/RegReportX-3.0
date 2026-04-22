package com.cts.regreportx.model;


import lombok.Data;
import lombok.NoArgsConstructor;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "RiskMetric")
@Data
@NoArgsConstructor
public class RiskMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "MetricID")
    private Integer metricId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ReportID")
    private RegReport report;

    @Column(name = "MetricName")
    private String metricName;

    @Column(name = "MetricValue")
    private BigDecimal metricValue;

    @Column(name = "CalculationDate")
    private LocalDateTime calculationDate;
}
