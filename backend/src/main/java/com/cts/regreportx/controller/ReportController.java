package com.cts.regreportx.controller;

import com.cts.regreportx.dto.RegReportDTO;
import com.cts.regreportx.model.RegReport;
import com.cts.regreportx.service.AuditService;
import com.cts.regreportx.service.ReportingService;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/report")
public class ReportController {

    private final ReportingService reportingService;
    private final ModelMapper modelMapper;
    private final AuditService auditService;

    @Autowired
    public ReportController(ReportingService reportingService, ModelMapper modelMapper, AuditService auditService) {
        this.reportingService = reportingService;
        this.modelMapper = modelMapper;
        this.auditService = auditService;
    }

    @PostMapping("/generate")
    @PreAuthorize("hasAnyRole('REPORTING_OFFICER','REGTECH_ADMIN')")
    public ResponseEntity<RegReportDTO> generateReport(
            @RequestParam(required = false, defaultValue = "1") Integer templateId,
            @RequestParam(required = false, defaultValue = "2026-Q1") String period) {
        RegReport report = reportingService.generateReport(templateId, period);
        auditService.logAction("GENERATED_REPORT", "Reports",
                "Template #" + templateId + " | Period: " + period + " | Report #" + report.getReportId());
        return ResponseEntity.ok(modelMapper.map(report, RegReportDTO.class));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('REPORTING_OFFICER', 'COMPLIANCE_ANALYST', 'REGTECH_ADMIN', 'RISK_ANALYST')")
    public ResponseEntity<List<RegReportDTO>> getAllReports() {
        return ResponseEntity.ok(reportingService.getAllReports().stream()
                .map(r -> modelMapper.map(r, RegReportDTO.class))
                .collect(Collectors.toList()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('REPORTING_OFFICER', 'COMPLIANCE_ANALYST', 'REGTECH_ADMIN', 'RISK_ANALYST')")
    public ResponseEntity<RegReportDTO> getReport(@PathVariable Integer id) {
        return reportingService.getReport(id)
                .map(r -> ResponseEntity.ok(modelMapper.map(r, RegReportDTO.class)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/submit")
    @PreAuthorize("hasAnyRole('COMPLIANCE_ANALYST')")
    public ResponseEntity<?> submitReport(@PathVariable Integer id, @RequestParam(defaultValue = "1") Integer actorId) {
        try {
            RegReport report = reportingService.submitReportForReview(id, actorId);
            auditService.logAction("SUBMITTED_REPORT", "Reports", "Report #" + id + " submitted for approval");
            return ResponseEntity.ok(modelMapper.map(report, RegReportDTO.class));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{id}/approve")
    @PreAuthorize("hasRole('REGTECH_ADMIN')")
    public ResponseEntity<?> approveReport(@PathVariable Integer id,
            @RequestParam(defaultValue = "1") Integer actorId,
            @RequestParam(required = false) String comments) {
        try {
            RegReport report = reportingService.approveReport(id, actorId, comments);
            auditService.logAction("APPROVED_REPORT", "Reports",
                    "Report #" + id + " approved" + (comments != null ? " | Comments: " + comments : ""));
            return ResponseEntity.ok(modelMapper.map(report, RegReportDTO.class));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{id}/file")
    @PreAuthorize("hasAnyRole('REPORTING_OFFICER')")
    public ResponseEntity<?> fileReport(@PathVariable Integer id, @RequestParam(defaultValue = "1") Integer actorId) {
        try {
            RegReport report = reportingService.fileReport(id, actorId);
            auditService.logAction("FILED_REPORT", "Reports", "Report #" + id + " filed with regulator");
            return ResponseEntity.ok(modelMapper.map(report, RegReportDTO.class));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
