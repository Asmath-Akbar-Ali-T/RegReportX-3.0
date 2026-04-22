package com.cts.regreportx.controller;

import com.cts.regreportx.dto.DataQualityIssueDTO;
import com.cts.regreportx.dto.DataQualityResolveRequest;
import com.cts.regreportx.model.DataQualityIssue;
import com.cts.regreportx.service.AuditService;
import com.cts.regreportx.service.DataQualityService;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/data-quality")
@PreAuthorize("hasAnyRole('COMPLIANCE_ANALYST', 'REGTECH_ADMIN')")
public class DataQualityController {

    private final DataQualityService dataQualityService;
    private final ModelMapper modelMapper;
    private final AuditService auditService;

    @Autowired
    public DataQualityController(DataQualityService dataQualityService, ModelMapper modelMapper, AuditService auditService) {
        this.dataQualityService = dataQualityService;
        this.modelMapper = modelMapper;
        this.auditService = auditService;
    }

    @GetMapping("/issues")
    public ResponseEntity<List<DataQualityIssueDTO>> getOpenIssues() {
        List<DataQualityIssue> issues = dataQualityService.getOpenIssues();
        auditService.logAction("VIEWED_OPEN_QUALITY_ISSUES", "DataQuality", "Open issues: " + issues.size());
        List<DataQualityIssueDTO> dtos = issues.stream()
                .map(issue -> modelMapper.map(issue, DataQualityIssueDTO.class))
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PutMapping("/issues/{id}/resolve")
    public ResponseEntity<?> resolveIssue(@PathVariable Integer id, @RequestBody DataQualityResolveRequest request) {
        try {
            java.util.Map<String, Object> resolvedData = dataQualityService.resolveIssue(id, request);
            auditService.logAction("RESOLVED_QUALITY_ISSUE", "DataQuality",
                    "Issue #" + id + " | Justification: " + request.getJustification());
            return ResponseEntity.ok(Map.of(
                    "message", "Issue resolved successfully and CorrectionLog generated.",
                    "issue", resolvedData.get("issue"),
                    "patchedRecordPayload", resolvedData.get("patchedRecordPayload")
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
