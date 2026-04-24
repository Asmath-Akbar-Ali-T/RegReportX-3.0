package com.cts.regreportx.controller;

import com.cts.regreportx.dto.ExceptionRecordDTO;
import com.cts.regreportx.dto.ExceptionResolveRequest;
import com.cts.regreportx.model.ExceptionRecord;
import com.cts.regreportx.service.AuditService;
import com.cts.regreportx.service.NotificationService;
import com.cts.regreportx.service.ReportingService;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/exceptions")
@PreAuthorize("hasAnyRole('COMPLIANCE_ANALYST', 'REGTECH_ADMIN')")
public class ExceptionController {

    private final ReportingService reportingService;
    private final ModelMapper modelMapper;
    private final AuditService auditService;
    private final NotificationService notificationService;

    @Autowired
    public ExceptionController(ReportingService reportingService, ModelMapper modelMapper, AuditService auditService, NotificationService notificationService) {
        this.reportingService = reportingService;
        this.modelMapper = modelMapper;
        this.auditService = auditService;
        this.notificationService = notificationService;
    }

    @GetMapping("/all")
    @PreAuthorize("hasAnyRole('COMPLIANCE_ANALYST', 'REGTECH_ADMIN', 'REPORTING_OFFICER')")
    public ResponseEntity<List<ExceptionRecordDTO>> getAllExceptions() {
        List<ExceptionRecord> records = reportingService.getAllExceptions();
        Map<Integer, String> justifications = reportingService.getExceptionJustifications();
        auditService.logAction("VIEWED_ALL_EXCEPTIONS", "Exceptions", "All exceptions: " + records.size());
        List<ExceptionRecordDTO> dtos = records.stream().map(r -> {
            ExceptionRecordDTO dto = modelMapper.map(r, ExceptionRecordDTO.class);
            dto.setJustification(justifications.get(r.getExceptionId()));
            return dto;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/open")
    @PreAuthorize("hasAnyRole('COMPLIANCE_ANALYST', 'REGTECH_ADMIN', 'REPORTING_OFFICER')")
    public ResponseEntity<List<ExceptionRecordDTO>> getOpenExceptions() {
        List<ExceptionRecord> records = reportingService.getOpenExceptions();
        auditService.logAction("VIEWED_OPEN_EXCEPTIONS", "Exceptions", "Open exceptions: " + records.size());
        List<ExceptionRecordDTO> dtos = records.stream()
                .map(r -> modelMapper.map(r, ExceptionRecordDTO.class))
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PutMapping("/{id}/resolve")
    public ResponseEntity<?> resolveException(@PathVariable Integer id, @RequestBody ExceptionResolveRequest request) {
        try {
            ExceptionRecord resolved = reportingService.resolveException(id, request);
            auditService.logAction("RESOLVED_EXCEPTION", "Exceptions",
                    "Exception #" + id + " | Justification: " + request.getJustification());
            notificationService.notifyRole("REPORTING_OFFICER", "Exception #" + id + " resolved — report can proceed", "Exception");
            return ResponseEntity.ok(Map.of(
                    "message", "Exception resolved successfully and CorrectionLog generated.",
                    "exception", modelMapper.map(resolved, ExceptionRecordDTO.class)
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/generate/{reportId}")
    public ResponseEntity<Map<String, Object>> generateExceptions(@PathVariable Integer reportId) {
        try {
            List<ExceptionRecord> generated = reportingService.generateExceptionsForReport(reportId);
            List<ExceptionRecordDTO> dtos = generated.stream()
                    .map(r -> modelMapper.map(r, ExceptionRecordDTO.class))
                    .collect(Collectors.toList());
            auditService.logAction("GENERATED_EXCEPTIONS", "Exceptions",
                    "Report #" + reportId + " | Generated " + dtos.size() + " exceptions");
            notificationService.notifyRole("OPERATIONS_OFFICER", "Exceptions generated for Report #" + reportId + " — investigation needed", "Exception");
            notificationService.notifyRole("RISK_ANALYST", "Exceptions generated for Report #" + reportId + " — investigation needed", "Exception");
            return ResponseEntity.ok(Map.of(
                    "message", "Exceptions generated successfully for report ID " + reportId,
                    "count", dtos.size(),
                    "exceptions", dtos
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
