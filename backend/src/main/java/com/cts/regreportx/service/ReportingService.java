package com.cts.regreportx.service;

import com.cts.regreportx.model.ExceptionRecord;
import com.cts.regreportx.model.FilingWorkflow;
import com.cts.regreportx.model.RegReport;
import com.cts.regreportx.repository.ExceptionRecordRepository;
import com.cts.regreportx.repository.FilingWorkflowRepository;
import com.cts.regreportx.repository.RegReportRepository;
import com.cts.regreportx.repository.CorrectionLogRepository;
import com.cts.regreportx.repository.UserRepository;
import com.cts.regreportx.repository.TemplateFieldRepository;
import com.cts.regreportx.repository.RiskMetricRepository;
import com.cts.regreportx.repository.RegTemplateRepository;
import com.cts.regreportx.model.CorrectionLog;
import com.cts.regreportx.model.User;
import com.cts.regreportx.model.TemplateField;
import com.cts.regreportx.model.RiskMetric;
import com.cts.regreportx.exception.ResourceNotFoundException;
import com.cts.regreportx.exception.ValidationException;
import com.cts.regreportx.dto.ExceptionResolveRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class ReportingService {

    private static final Logger logger = LoggerFactory.getLogger(ReportingService.class);

    private final RegReportRepository reportRepository;
    private final FilingWorkflowRepository workflowRepository;
    private final ExceptionRecordRepository exceptionRecordRepository;
    private final RiskCalculationService riskCalculationService;
    private final AuditService auditService;
    private final CorrectionLogRepository correctionLogRepository;
    private final UserRepository userRepository;
    private final TemplateFieldRepository templateFieldRepository;
    private final RiskMetricRepository riskMetricRepository;
    private final RegTemplateRepository regTemplateRepository;

    @Autowired
    public ReportingService(RegReportRepository reportRepository,
            FilingWorkflowRepository workflowRepository,
            ExceptionRecordRepository exceptionRecordRepository,
            RiskCalculationService riskCalculationService,
            AuditService auditService,
            CorrectionLogRepository correctionLogRepository,
            UserRepository userRepository,
            TemplateFieldRepository templateFieldRepository,
            RiskMetricRepository riskMetricRepository,
            RegTemplateRepository regTemplateRepository) {
        this.reportRepository = reportRepository;
        this.workflowRepository = workflowRepository;
        this.exceptionRecordRepository = exceptionRecordRepository;
        this.riskCalculationService = riskCalculationService;
        this.auditService = auditService;
        this.correctionLogRepository = correctionLogRepository;
        this.userRepository = userRepository;
        this.templateFieldRepository = templateFieldRepository;
        this.riskMetricRepository = riskMetricRepository;
        this.regTemplateRepository = regTemplateRepository;
    }

    public RegReport generateReport(Integer templateId, String period) {
        RegReport report = new RegReport();
        report.setTemplate(regTemplateRepository.getReferenceById(templateId));
        report.setPeriod(period);
        report.setGeneratedDate(LocalDateTime.now());
        report.setStatus("DRAFT");
        report = reportRepository.save(report);

        FilingWorkflow workflow = new FilingWorkflow();
        workflow.setReport(report);
        workflow.setStepName("DRAFT");
        workflow.setActor(getCurrentUser());
        workflow.setStepDate(LocalDateTime.now());
        workflow.setStatus("COMPLETED");
        workflowRepository.save(workflow);

        return report;
    }

    @Transactional
    public RegReport submitReportForReview(Integer reportId) {
        return advanceWorkflow(reportId, "DRAFT", "UNDER_REVIEW", null);
    }

    @Transactional
    public RegReport approveReport(Integer reportId, String comments) {
        return advanceWorkflow(reportId, "UNDER_REVIEW", "APPROVED", comments);
    }

    @Transactional
    public RegReport fileReport(Integer reportId) {
        return advanceWorkflow(reportId, "APPROVED", "FILED", null);
    }

    private RegReport advanceWorkflow(Integer reportId, String expectedCurrentStatus, String nextStatus, String comments) {
        RegReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Report not found: " + reportId));

        if (!expectedCurrentStatus.equals(report.getStatus())) {
            throw new ValidationException("Cannot advance report to " + nextStatus + ". Current status is "
                    + report.getStatus() + ", expected " + expectedCurrentStatus);
        }

        report.setStatus(nextStatus);
        report = reportRepository.save(report);

        FilingWorkflow workflow = new FilingWorkflow();
        workflow.setReport(report);
        workflow.setStepName(nextStatus);
        workflow.setActor(getCurrentUser());
        workflow.setStepDate(LocalDateTime.now());
        workflow.setStatus("COMPLETED");
        if (comments != null && !comments.trim().isEmpty()) {
            workflow.setComments(comments);
        }
        workflowRepository.save(workflow);

        auditService.logAction("WORKFLOW_ADVANCE", "ReportID: " + reportId,
                "Status changed from " + expectedCurrentStatus + " to " + nextStatus);

        return report;
    }

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            return userRepository.findByUsername(auth.getName()).orElse(null);
        }
        return null;
    }

    public List<FilingWorkflow> getWorkflowByReportId(Integer reportId) {
        return workflowRepository.findByReport_ReportIdOrderByStepDateAsc(reportId);
    }

    public Optional<RegReport> getReport(Integer reportId) {
        return reportRepository.findById(reportId);
    }

    public List<RegReport> getAllReports() {
        return reportRepository.findAll();
    }

    public List<ExceptionRecord> getAllExceptions() {
        return exceptionRecordRepository.findAll();
    }

    public java.util.Map<Integer, String> getExceptionJustifications() {
        java.util.Map<Integer, String> map = new java.util.HashMap<>();
        correctionLogRepository.findAll().forEach(log -> {
            if (log.getExceptionRecord() != null && log.getNewValue() != null) {
                map.put(log.getExceptionRecord().getExceptionId(), log.getNewValue());
            }
        });
        return map;
    }

    public List<ExceptionRecord> getOpenExceptions() {
        return exceptionRecordRepository.findByStatus("Open");
    }

    @Transactional
    public ExceptionRecord resolveException(Integer exceptionId, ExceptionResolveRequest request) {
        ExceptionRecord exception = exceptionRecordRepository.findById(exceptionId)
                .orElseThrow(() -> new ResourceNotFoundException("Exception Record not found: " + exceptionId));

        if ("Resolved".equalsIgnoreCase(exception.getStatus())) {
            throw new ValidationException("Exception is already resolved");
        }

        exception.setStatus("Resolved");
        ExceptionRecord savedException = exceptionRecordRepository.save(exception);

        String metricValue = exception.getIssue();
        if (exception.getTemplateField() != null && exception.getReport() != null) {
            TemplateField field = exception.getTemplateField();
            Optional<RiskMetric> metricOpt = riskMetricRepository
                    .findByReport_ReportIdAndMetricName(exception.getReport().getReportId(), field.getFieldName());
            if (metricOpt.isPresent() && metricOpt.get().getMetricValue() != null) {
                metricValue = metricOpt.get().getMetricValue().toString();
            }
        }

        CorrectionLog log = new CorrectionLog();
        log.setExceptionRecord(exception);
        log.setOldValue(metricValue);
        log.setNewValue("Accepted Risk | Reason: " + request.getJustification());
        log.setCorrectedDate(LocalDateTime.now());

        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !auth.getPrincipal().equals("anonymousUser")) {
                Optional<User> userOpt = userRepository.findByUsername(auth.getName());
                userOpt.ifPresent(user -> log.setCorrectedByUser(user));
            }
        } catch (Exception e) {
            logger.warn("Could not resolve current user for correction log on exception {}: {}", exceptionId, e.getMessage());
        }

        correctionLogRepository.save(log);

        auditService.logAction("RESOLVED_REPORT_EXCEPTION", "ExceptionRecord ID: " + exceptionId);

        return savedException;
    }

    @Transactional
    public List<ExceptionRecord> generateExceptionsForReport(Integer reportId) {
        List<ExceptionRecord> generated = new java.util.ArrayList<>();
        List<RiskMetric> metrics = riskMetricRepository.findByReport_ReportId(reportId);
        if (metrics == null || metrics.isEmpty())
            return generated;

        for (RiskMetric metric : metrics) {
            String name = metric.getMetricName();
            java.math.BigDecimal value = metric.getMetricValue();
            if (value == null)
                continue;

            boolean breached = false;
            String issueMsg = "";
            String severity = "High";

            if ("CRAR".equalsIgnoreCase(name) && value.compareTo(new java.math.BigDecimal("9")) < 0) {
                breached = true;
                issueMsg = "Capital breach: CRAR is below 9% threshold (" + value + "%)";
            } else if ("LCR".equalsIgnoreCase(name) && value.compareTo(new java.math.BigDecimal("100")) < 0) {
                breached = true;
                issueMsg = "Liquidity deficit: LCR is below 100% threshold (" + value + "%)";
            } else if ("Loan_to_Deposit_Ratio".equalsIgnoreCase(name)
                    && value.compareTo(new java.math.BigDecimal("90")) > 0) {
                breached = true;
                issueMsg = "High lending risk: Loan-to-Deposit Ratio exceeds 90% (" + value + "%)";
                severity = "Medium";
            } else if ("Net_GL_Balance".equalsIgnoreCase(name) && value.compareTo(java.math.BigDecimal.ZERO) < 0) {
                breached = true;
                issueMsg = "Solvency breach: Net GL Balance evaluates to negative (" + value + ")";
                severity = "Critical";
            }

            if (breached) {
                Integer fieldId = null;
                List<TemplateField> fields = templateFieldRepository.findByFieldName(name);
                if (fields != null && !fields.isEmpty()) {
                    fieldId = fields.get(0).getFieldId();
                }

                ExceptionRecord ex = new ExceptionRecord();
                ex.setReport(reportRepository.getReferenceById(reportId));
                if (fieldId != null) {
                    ex.setTemplateField(templateFieldRepository.getReferenceById(fieldId));
                }
                ex.setIssue(issueMsg);
                ex.setSeverity(severity);
                ex.setStatus("Open");
                generated.add(exceptionRecordRepository.save(ex));
            }
        }
        auditService.logAction("GENERATE_REPORT_EXCEPTIONS", "ReportID: " + reportId,
                "Generated " + generated.size() + " exceptions");
        return generated;
    }
}
