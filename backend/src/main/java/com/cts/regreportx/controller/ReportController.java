package com.cts.regreportx.controller;

import com.cts.regreportx.dto.FilingWorkflowDTO;
import com.cts.regreportx.dto.RegReportDTO;
import com.cts.regreportx.model.RegReport;
import com.cts.regreportx.service.AuditService;
import com.cts.regreportx.service.NotificationService;
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
    private final NotificationService notificationService;

    @Autowired
    public ReportController(ReportingService reportingService, ModelMapper modelMapper, AuditService auditService, NotificationService notificationService) {
        this.reportingService = reportingService;
        this.modelMapper = modelMapper;
        this.auditService = auditService;
        this.notificationService = notificationService;
    }

    @PostMapping("/generate")
    @PreAuthorize("hasAnyRole('REPORTING_OFFICER','REGTECH_ADMIN')")
    public ResponseEntity<RegReportDTO> generateReport(
            @RequestParam(required = false, defaultValue = "1") Integer templateId,
            @RequestParam(required = false, defaultValue = "2026-Q1") String period) {
        RegReport report = reportingService.generateReport(templateId, period);
        auditService.logAction("GENERATED_REPORT", "Reports",
                "Template #" + templateId + " | Period: " + period + " | Report #" + report.getReportId());
        notificationService.notifyRole("COMPLIANCE_ANALYST", "Draft report #" + report.getReportId() + " ready for review", "Report");
        notificationService.notifyRole("RISK_ANALYST", "Draft report #" + report.getReportId() + " generated — metrics can now be calculated", "Report");
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

    @GetMapping("/{id}/workflow")
    @PreAuthorize("hasAnyRole('REPORTING_OFFICER', 'COMPLIANCE_ANALYST', 'REGTECH_ADMIN', 'RISK_ANALYST')")
    public ResponseEntity<List<FilingWorkflowDTO>> getWorkflow(@PathVariable Integer id) {
        List<FilingWorkflowDTO> steps = reportingService.getWorkflowByReportId(id).stream()
                .map(w -> modelMapper.map(w, FilingWorkflowDTO.class))
                .collect(Collectors.toList());
        return ResponseEntity.ok(steps);
    }

    @PutMapping("/{id}/submit")
    @PreAuthorize("hasAnyRole('COMPLIANCE_ANALYST')")
    public ResponseEntity<?> submitReport(@PathVariable Integer id) {
        try {
            RegReport report = reportingService.submitReportForReview(id);
            auditService.logAction("SUBMITTED_REPORT", "Reports", "Report #" + id + " submitted for approval");
            notificationService.notifyRole("REGTECH_ADMIN", "Report #" + id + " submitted for approval", "Report");
            return ResponseEntity.ok(modelMapper.map(report, RegReportDTO.class));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{id}/approve")
    @PreAuthorize("hasRole('REGTECH_ADMIN')")
    public ResponseEntity<?> approveReport(@PathVariable Integer id,
            @RequestParam(required = false) String comments) {
        try {
            RegReport report = reportingService.approveReport(id, comments);
            auditService.logAction("APPROVED_REPORT", "Reports",
                    "Report #" + id + " approved" + (comments != null ? " | Comments: " + comments : ""));
            notificationService.notifyRole("REPORTING_OFFICER", "Report #" + id + " approved — ready for filing", "Report");
            notificationService.notifyRole("COMPLIANCE_ANALYST", "Report #" + id + " approved — ready for filing", "Report");
            return ResponseEntity.ok(modelMapper.map(report, RegReportDTO.class));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{id}/file")
    @PreAuthorize("hasAnyRole('REPORTING_OFFICER')")
    public ResponseEntity<?> fileReport(@PathVariable Integer id) {
        try {
            RegReport report = reportingService.fileReport(id);
            auditService.logAction("FILED_REPORT", "Reports", "Report #" + id + " filed with regulator");
            notificationService.notifyRole("REGTECH_ADMIN", "Report #" + id + " filed with regulator", "Report");
            notificationService.notifyRole("COMPLIANCE_ANALYST", "Report #" + id + " filed with regulator", "Report");
            return ResponseEntity.ok(modelMapper.map(report, RegReportDTO.class));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
