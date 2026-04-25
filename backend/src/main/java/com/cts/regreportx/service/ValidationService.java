package com.cts.regreportx.service;

import com.cts.regreportx.model.*;
import com.cts.regreportx.repository.DataQualityIssueRepository;
import com.cts.regreportx.repository.RawDataBatchRepository;
import com.cts.regreportx.repository.ValidationRuleRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class ValidationService {

    private static final Logger logger = LoggerFactory.getLogger(ValidationService.class);

    private final RawRecordService rawRecordService;
    private final RawDataBatchRepository batchRepository;
    private final DataQualityIssueRepository issueRepository;
    private final AuditService auditService;
    private final ValidationRuleRepository validationRuleRepository;
    private final ObjectMapper objectMapper;

    @Autowired
    public ValidationService(RawRecordService rawRecordService,
            RawDataBatchRepository batchRepository,
            DataQualityIssueRepository issueRepository,
            AuditService auditService,
            ValidationRuleRepository validationRuleRepository) {
        this.rawRecordService = rawRecordService;
        this.batchRepository = batchRepository;
        this.issueRepository = issueRepository;
        this.auditService = auditService;
        this.validationRuleRepository = validationRuleRepository;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
    }

    public List<DataQualityIssue> runValidation() {
        List<DataQualityIssue> issues = new ArrayList<>();
        List<RawDataBatch> batches = batchRepository.findAll();
        List<ValidationRule> activeRules = validationRuleRepository.findByStatus("Active");

        for (RawDataBatch batch : batches) {
            List<RawRecord> records = rawRecordService.getRecordsByBatch(batch.getBatchId());
            int sourceId = (batch.getSource() != null && batch.getSource().getSourceId() != null)
                    ? batch.getSource().getSourceId() : -1;

            try {
                for (RawRecord record : records) {
                    Object entity = null;
                    if (sourceId == 1) {
                        entity = objectMapper.readValue(record.getPayloadJson(), Loan.class);
                    } else if (sourceId == 2) {
                        entity = objectMapper.readValue(record.getPayloadJson(), Deposit.class);
                    } else if (sourceId == 4) {
                        entity = objectMapper.readValue(record.getPayloadJson(), GeneralLedger.class);
                    } else if (sourceId == 3) {
                        entity = objectMapper.readValue(record.getPayloadJson(), TreasuryTrade.class);
                    }

                    if (entity == null) continue;

                    JsonNode node = objectMapper.valueToTree(entity);

                    for (ValidationRule rule : activeRules) {
                        String expr = rule.getRuleExpression();
                        if (expr == null || expr.trim().isEmpty()) continue;

                        String[] tokens = expr.split(" ");
                        if (tokens.length >= 3) {
                            String fieldName = tokens[0];
                            String camelAttr = fieldName.substring(0, 1).toLowerCase() + fieldName.substring(1);

                            if (node.has(camelAttr) || node.has(fieldName)) {
                                String actualKey = node.has(camelAttr) ? camelAttr : fieldName;
                                JsonNode valNode = node.get(actualKey);

                                boolean isValid = true;
                                if (valNode == null || valNode.isNull()) {
                                    isValid = false; 
                                } else {
                                    isValid = evaluateCondition(valNode.asText(), tokens);
                                }

                                if (!isValid) {
                                    issues.add(createIssue(batch.getBatchId(), rule.getRuleId(), record.getRawRecordId().toString(),
                                            rule.getName() + " failed: " + rule.getRuleExpression(), rule.getSeverity()));
                                }
                            }
                        }
                    }
                }
                
                String sourceName = "unknown";
                if(sourceId == 1) sourceName = "loans";
                if(sourceId == 2) sourceName = "deposits";
                if(sourceId == 4) sourceName = "general_ledger";
                if(sourceId == 3) sourceName = "treasury";
                auditService.logAction("RUN_VALIDATION_ON_RAW", sourceName + " (Batch: " + batch.getBatchId() + ")");
                
            } catch (Exception e) {
                logger.error("Validation failed for batch {}: {}", batch.getBatchId(), e.getMessage(), e);
            }
        }

        return issues;
    }

    private boolean evaluateCondition(String valueStr, String[] tokens) {
        try {
            BigDecimal value = new BigDecimal(valueStr);
            String operator = tokens[1].toUpperCase();

            if (operator.equals(">")) {
                return value.compareTo(new BigDecimal(tokens[2])) > 0;
            } else if (operator.equals(">=")) {
                return value.compareTo(new BigDecimal(tokens[2])) >= 0;
            } else if (operator.equals("<")) {
                return value.compareTo(new BigDecimal(tokens[2])) < 0;
            } else if (operator.equals("<=")) {
                return value.compareTo(new BigDecimal(tokens[2])) <= 0;
            } else if (operator.equals("==") || operator.equals("=")) {
                return value.compareTo(new BigDecimal(tokens[2])) == 0;
            } else if (operator.equals("BETWEEN") && tokens.length >= 5) {
                BigDecimal lower = new BigDecimal(tokens[2]);
                BigDecimal upper = new BigDecimal(tokens[4]);
                return value.compareTo(lower) >= 0 && value.compareTo(upper) <= 0;
            }
        } catch (Exception e) {
            return false;
        }
        return true;
    }

    private DataQualityIssue createIssue(Integer batchId, Integer ruleId, String recordId, String message,
            String severity) {
        DataQualityIssue issue = new DataQualityIssue();
        issue.setBatch(batchRepository.getReferenceById(batchId));
        issue.setRule(validationRuleRepository.getReferenceById(ruleId));
        issue.setRecordId(recordId);
        issue.setMessage(message);
        issue.setSeverity(severity);
        issue.setLoggedDate(LocalDateTime.now());
        issue.setStatus("Open");
        return issueRepository.save(issue);
    }

    public List<DataQualityIssue> getAllIssues() {
        return issueRepository.findAll();
    }
}
