package com.cts.regreportx.service;

import com.cts.regreportx.model.ExceptionRecord;
import com.cts.regreportx.model.FilingWorkflow;
import com.cts.regreportx.model.RegReport;
import com.cts.regreportx.model.RegTemplate;
import com.cts.regreportx.model.User;
import com.cts.regreportx.repository.*;
import com.cts.regreportx.exception.ValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ReportingServiceTest {

    @Mock private RegReportRepository reportRepository;
    @Mock private FilingWorkflowRepository workflowRepository;
    @Mock private ExceptionRecordRepository exceptionRecordRepository;
    @Mock private RiskCalculationService riskCalculationService;
    @Mock private AuditService auditService;
    @Mock private CorrectionLogRepository correctionLogRepository;
    @Mock private UserRepository userRepository;
    @Mock private TemplateFieldRepository templateFieldRepository;
    @Mock private RiskMetricRepository riskMetricRepository;
    @Mock private RegTemplateRepository regTemplateRepository;

    @InjectMocks
    private ReportingService reportingService;

    private RegTemplate template;
    private User systemUser;
    private RegReport draftReport;

    @BeforeEach
    void setUp() {
        template = new RegTemplate();
        template.setTemplateId(1);

        systemUser = new User();
        systemUser.setId(1L);
        systemUser.setUsername("system");

        draftReport = new RegReport();
        draftReport.setReportId(100);
        draftReport.setStatus("DRAFT");
    }

    @Test
    void testGenerateReport_Success() {
        when(regTemplateRepository.getReferenceById(1)).thenReturn(template);
        when(userRepository.getReferenceById(1L)).thenReturn(systemUser);
        
        RegReport savedReport = new RegReport();
        savedReport.setReportId(100);
        savedReport.setStatus("DRAFT");
        when(reportRepository.save(any(RegReport.class))).thenReturn(savedReport);

        RegReport result = reportingService.generateReport(1, "2023-Q1");

        assertNotNull(result);
        assertEquals("DRAFT", result.getStatus());
        
        verify(reportRepository, times(1)).save(any(RegReport.class));
        verify(workflowRepository, times(1)).save(any(FilingWorkflow.class));
        verify(auditService, times(1)).logAction(eq(1), eq("GENERATE_REPORT"), anyString(), anyString());
    }

    @Test
    void testSubmitReportForReview_Success() {
        when(reportRepository.findById(100)).thenReturn(Optional.of(draftReport));
        when(userRepository.getReferenceById(2L)).thenReturn(new User());
        
        RegReport updatedReport = new RegReport();
        updatedReport.setReportId(100);
        updatedReport.setStatus("UNDER_REVIEW");
        when(reportRepository.save(any(RegReport.class))).thenReturn(updatedReport);

        RegReport result = reportingService.submitReportForReview(100, 2);

        assertNotNull(result);
        assertEquals("UNDER_REVIEW", result.getStatus());

        ArgumentCaptor<FilingWorkflow> workflowCaptor = ArgumentCaptor.forClass(FilingWorkflow.class);
        verify(workflowRepository, times(1)).save(workflowCaptor.capture());
        assertEquals("UNDER_REVIEW", workflowCaptor.getValue().getStepName());
    }

    @Test
    void testSubmitReportForReview_WrongStatusThrowsException() {
        draftReport.setStatus("FILED");
        when(reportRepository.findById(100)).thenReturn(Optional.of(draftReport));

        assertThrows(ValidationException.class, () -> {
            reportingService.submitReportForReview(100, 2);
        });

        verify(reportRepository, never()).save(any(RegReport.class));
    }
}
