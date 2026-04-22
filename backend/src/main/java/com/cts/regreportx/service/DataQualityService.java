package com.cts.regreportx.service;

import com.cts.regreportx.dto.DataQualityResolveRequest;
import com.cts.regreportx.model.CorrectionLog;
import com.cts.regreportx.model.DataQualityIssue;
import com.cts.regreportx.model.RawRecord;
import com.cts.regreportx.model.ValidationRule;
import com.cts.regreportx.model.User;
import com.cts.regreportx.repository.CorrectionLogRepository;
import com.cts.regreportx.repository.DataQualityIssueRepository;
import com.cts.regreportx.repository.RawRecordRepository;
import com.cts.regreportx.repository.ValidationRuleRepository;
import com.cts.regreportx.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import com.cts.regreportx.exception.ResourceNotFoundException;
import com.cts.regreportx.exception.ValidationException;

@Service
public class DataQualityService {

    private final DataQualityIssueRepository dataQualityIssueRepository;
    private final CorrectionLogRepository correctionLogRepository;
    private final RawRecordRepository rawRecordRepository;
    private final ValidationRuleRepository validationRuleRepository;
    private final AuditService auditService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Autowired
    public DataQualityService(DataQualityIssueRepository dataQualityIssueRepository,
                              CorrectionLogRepository correctionLogRepository,
                              RawRecordRepository rawRecordRepository,
                              ValidationRuleRepository validationRuleRepository,
                              AuditService auditService,
                              UserRepository userRepository) {
        this.dataQualityIssueRepository = dataQualityIssueRepository;
        this.correctionLogRepository = correctionLogRepository;
        this.rawRecordRepository = rawRecordRepository;
        this.validationRuleRepository = validationRuleRepository;
        this.auditService = auditService;
        this.userRepository = userRepository;
        this.objectMapper = new ObjectMapper();
    }

    public List<DataQualityIssue> getOpenIssues() {
        return dataQualityIssueRepository.findByStatus("Open");
    }

    @org.springframework.transaction.annotation.Transactional
    public java.util.Map<String, Object> resolveIssue(Integer issueId, DataQualityResolveRequest request) {
        DataQualityIssue issue = dataQualityIssueRepository.findById(issueId)
                .orElseThrow(() -> new ResourceNotFoundException("Data Quality Issue not found"));

        if ("Resolved".equalsIgnoreCase(issue.getStatus())) {
            throw new ValidationException("Issue is already resolved");
        }

        String finalPayloadJson = null;

        try {
            Integer rawRecordId = Integer.parseInt(issue.getRecordId());
            Optional<RawRecord> rawRecordOpt = rawRecordRepository.findById(rawRecordId);
            
            if (rawRecordOpt.isPresent()) {
                RawRecord rawRecord = rawRecordOpt.get();
                ValidationRule rule = issue.getRule();
                
                if (rule != null) {
                    String fieldName = rule.getRuleExpression().split(" ")[0];
                    String camelAttr = fieldName.substring(0, 1).toLowerCase() + fieldName.substring(1);

                    ObjectNode jsonNode = (ObjectNode) objectMapper.readTree(rawRecord.getPayloadJson());
                    
                    String cleanValue = request.getCorrectedValue() != null ? request.getCorrectedValue().trim() : "";
                    try {
                        java.math.BigDecimal numVal = new java.math.BigDecimal(cleanValue);
                        if (jsonNode.has(camelAttr)) {
                            jsonNode.put(camelAttr, numVal);
                        } else {
                            jsonNode.put(fieldName, numVal);
                        }
                    } catch (NumberFormatException nfe) {
                        if (jsonNode.has(camelAttr)) {
                            jsonNode.put(camelAttr, cleanValue);
                        } else {
                            jsonNode.put(fieldName, cleanValue);
                        }
                    }
                    
                    finalPayloadJson = jsonNode.toString();
                    rawRecord.setPayloadJson(finalPayloadJson);
                    rawRecordRepository.save(rawRecord);
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to patch RawRecord: " + e.getMessage());
        }

        issue.setStatus("Resolved");
        DataQualityIssue savedIssue = dataQualityIssueRepository.save(issue);

        CorrectionLog log = new CorrectionLog();
        log.setDataQualityIssue(issue);
        log.setOldValue(issue.getMessage());
        log.setNewValue("Corrected to " + request.getCorrectedValue() + " | Reason: " + request.getJustification());
        log.setCorrectedDate(LocalDateTime.now());
        
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !auth.getPrincipal().equals("anonymousUser")) {
                Optional<User> userOpt = userRepository.findByUsername(auth.getName());
                userOpt.ifPresent(user -> log.setCorrectedByUser(user));
            }
        } catch (Exception e) {}
        
        correctionLogRepository.save(log);

        auditService.logAction("RESOLVED_DATA_QUALITY_ISSUE", "DataQualityIssue ID: " + issueId);

        java.util.Map<String, Object> responseMap = new java.util.HashMap<>();
        responseMap.put("issue", savedIssue);
        responseMap.put("patchedRecordPayload", finalPayloadJson != null ? finalPayloadJson : "Failed to patch RawRecord JSON");

        return responseMap;
    }
}
