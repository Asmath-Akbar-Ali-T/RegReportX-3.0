package com.cts.regreportx.service;

import com.cts.regreportx.component.DynamicRiskEvaluator;
import com.cts.regreportx.model.*;
import com.cts.regreportx.repository.NotificationRepository;
import com.cts.regreportx.repository.RegReportRepository;
import com.cts.regreportx.repository.RiskMetricRepository;
import com.cts.regreportx.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class RiskCalculationServiceTest {

    @Mock private SourceDataService sourceDataService;
    @Mock private RiskMetricRepository riskMetricRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private AuditService auditService;
    @Mock private DynamicRiskEvaluator riskEvaluator;
    @Mock private TemplateService templateService;
    @Mock private RegReportRepository reportRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks
    private RiskCalculationService riskCalculationService;

    private RegReport draftReport;
    private RegTemplate template;

    @BeforeEach
    void setUp() {
        template = new RegTemplate();
        template.setTemplateId(1);

        draftReport = new RegReport();
        draftReport.setReportId(200);
        draftReport.setStatus("DRAFT");
        draftReport.setTemplate(template);
    }

    @Test
    void testCalculateMetrics_ThrowsExceptionIfNotDraft() {
        draftReport.setStatus("FILED");
        when(reportRepository.findById(200)).thenReturn(Optional.of(draftReport));

        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            riskCalculationService.calculateMetrics(200);
        });

        assertTrue(exception.getMessage().contains("DRAFT status"));
        verify(riskMetricRepository, times(1)).deleteByReport_ReportId(200);
    }

    @Test
    void testCalculateMetrics_Success() {
        when(reportRepository.findById(200)).thenReturn(Optional.of(draftReport));

        TemplateField field = new TemplateField();
        field.setFieldName("CRAR");
        field.setMappingExpression("Total_Loans / Total_Deposits"); // Simplified
        when(templateService.getFieldsByTemplateId(1)).thenReturn(Collections.singletonList(field));

        Loan loan = new Loan();
        loan.setLoanAmount(new BigDecimal("1000"));
        loan.setLoanType("corporate loan");
        when(sourceDataService.getAllLoans()).thenReturn(Collections.singletonList(loan));

        Deposit deposit = new Deposit();
        deposit.setAmount(new BigDecimal("2000"));
        when(sourceDataService.getAllDeposits()).thenReturn(Collections.singletonList(deposit));

        when(sourceDataService.getAllTreasuryTrades()).thenReturn(Collections.emptyList());
        when(sourceDataService.getAllGeneralLedgers()).thenReturn(Collections.emptyList());

        when(riskEvaluator.evaluateFormula(anyString(), anyMap())).thenReturn(new BigDecimal("0.5"));
        when(riskMetricRepository.save(any(RiskMetric.class))).thenReturn(new RiskMetric());

        List<RiskMetric> metrics = riskCalculationService.calculateMetrics(200);

        assertEquals(1, metrics.size());
        verify(riskEvaluator, times(1)).evaluateFormula(eq("Total_Loans / Total_Deposits"), anyMap());
        verify(riskMetricRepository, times(1)).save(any(RiskMetric.class));
    }
}
