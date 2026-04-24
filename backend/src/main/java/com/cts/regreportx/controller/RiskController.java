package com.cts.regreportx.controller;

import com.cts.regreportx.dto.RiskMetricDTO;
import com.cts.regreportx.model.RiskMetric;
import com.cts.regreportx.service.NotificationService;
import com.cts.regreportx.service.RiskCalculationService;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/risk")
@PreAuthorize("hasAnyRole('RISK_ANALYST', 'REGTECH_ADMIN')")
public class RiskController {

    private final RiskCalculationService riskCalculationService;
    private final ModelMapper modelMapper;
    private final NotificationService notificationService;

    @Autowired
    public RiskController(RiskCalculationService riskCalculationService, ModelMapper modelMapper, NotificationService notificationService) {
        this.riskCalculationService = riskCalculationService;
        this.modelMapper = modelMapper;
        this.notificationService = notificationService;
    }

    @GetMapping("/metrics")
    @PreAuthorize("hasAnyRole('RISK_ANALYST', 'REGTECH_ADMIN', 'REPORTING_OFFICER')")
    public ResponseEntity<List<RiskMetricDTO>> getMetrics() {
        List<RiskMetric> metrics = riskCalculationService.getAllMetrics();
        List<RiskMetricDTO> dtos = metrics.stream()
                .map(m -> modelMapper.map(m, RiskMetricDTO.class))
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/calculate/{reportId}")
    public ResponseEntity<Map<String, Object>> calculateMetrics(@PathVariable Integer reportId) {
        List<RiskMetric> metrics = riskCalculationService.calculateMetrics(reportId);

        List<String> metricNames = new java.util.ArrayList<>();
        for (RiskMetric metric : metrics) {
            metricNames.add(metric.getMetricName());
        }

        Map<String, Object> response = new HashMap<>();
        response.put("reportId", reportId);
        response.put("metricsCalculated", metricNames);

        notificationService.notifyRole("COMPLIANCE_ANALYST", "Risk metrics ready for Report #" + reportId + " — proceed with exception generation", "Risk");
        notificationService.notifyRole("REPORTING_OFFICER", "Risk metrics completed for draft Report #" + reportId, "Risk");

        return ResponseEntity.ok(response);
    }
}
