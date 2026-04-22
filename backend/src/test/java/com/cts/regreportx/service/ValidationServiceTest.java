package com.cts.regreportx.service;

import com.cts.regreportx.model.*;
import com.cts.regreportx.repository.DataQualityIssueRepository;
import com.cts.regreportx.repository.RawDataBatchRepository;
import com.cts.regreportx.repository.ValidationRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ValidationServiceTest {

    @Mock private RawRecordService rawRecordService;
    @Mock private RawDataBatchRepository batchRepository;
    @Mock private DataQualityIssueRepository issueRepository;
    @Mock private AuditService auditService;
    @Mock private ValidationRuleRepository validationRuleRepository;

    @InjectMocks
    private ValidationService validationService;

    private RawDataBatch batch;
    private ValidationRule rule;
    private DataSource source;

    @BeforeEach
    void setUp() {
        source = new DataSource();
        source.setSourceId(1); // Loans

        batch = new RawDataBatch();
        batch.setBatchId(10);
        batch.setSource(source);

        rule = new ValidationRule();
        rule.setRuleId(5);
        rule.setName("Loan Amount Check");
        rule.setRuleExpression("loanAmount > 1000"); // Valid condition
        rule.setStatus("Active");
    }

    @Test
    void testRunValidation_CreatesIssueOnFailure() {
        RawRecord validRecord = new RawRecord();
        validRecord.setRawRecordId(1);
        validRecord.setPayloadJson("{\"loanAmount\": 1500}");

        RawRecord invalidRecord = new RawRecord();
        invalidRecord.setRawRecordId(2);
        invalidRecord.setPayloadJson("{\"loanAmount\": 500}");

        when(batchRepository.findAll()).thenReturn(Collections.singletonList(batch));
        when(validationRuleRepository.findByStatus("Active")).thenReturn(Collections.singletonList(rule));
        when(rawRecordService.getRecordsByBatch(10)).thenReturn(Arrays.asList(validRecord, invalidRecord));
        
        DataQualityIssue mockIssue = new DataQualityIssue();
        when(batchRepository.getReferenceById(10)).thenReturn(batch);
        when(validationRuleRepository.getReferenceById(5)).thenReturn(rule);
        when(issueRepository.save(any(DataQualityIssue.class))).thenReturn(mockIssue);

        List<DataQualityIssue> issues = validationService.runValidation();

        // One issue should be created for the invalid record (loanAmount = 500 which is NOT > 1000)
        assertEquals(1, issues.size());
        verify(issueRepository, times(1)).save(any(DataQualityIssue.class));
        verify(auditService, times(1)).logAction(eq("RUN_VALIDATION_ON_RAW"), anyString());
    }

    @Test
    void testRunValidation_NoIssuesIfAllValid() {
        RawRecord validRecord = new RawRecord();
        validRecord.setRawRecordId(1);
        validRecord.setPayloadJson("{\"loanAmount\": 2000}");

        when(batchRepository.findAll()).thenReturn(Collections.singletonList(batch));
        when(validationRuleRepository.findByStatus("Active")).thenReturn(Collections.singletonList(rule));
        when(rawRecordService.getRecordsByBatch(10)).thenReturn(Collections.singletonList(validRecord));

        List<DataQualityIssue> issues = validationService.runValidation();

        assertTrue(issues.isEmpty());
        verify(issueRepository, never()).save(any(DataQualityIssue.class));
    }
}
