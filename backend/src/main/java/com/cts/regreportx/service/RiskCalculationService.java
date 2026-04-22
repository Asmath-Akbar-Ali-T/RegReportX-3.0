package com.cts.regreportx.service;

import com.cts.regreportx.component.DynamicRiskEvaluator;
import com.cts.regreportx.model.*;
import com.cts.regreportx.repository.NotificationRepository;
import com.cts.regreportx.repository.RegReportRepository;
import com.cts.regreportx.repository.RiskMetricRepository;
import com.cts.regreportx.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class RiskCalculationService {

    private final SourceDataService sourceDataService;
    private final RiskMetricRepository riskMetricRepository;
    private final NotificationRepository notificationRepository;
    private final AuditService auditService;
    private final DynamicRiskEvaluator riskEvaluator;
    private final TemplateService templateService;
    private final RegReportRepository reportRepository;
    private final UserRepository userRepository;

    @Autowired
    public RiskCalculationService(SourceDataService sourceDataService,
            RiskMetricRepository riskMetricRepository,
            NotificationRepository notificationRepository,
            AuditService auditService,
            DynamicRiskEvaluator riskEvaluator,
            TemplateService templateService,
            RegReportRepository reportRepository,
            UserRepository userRepository) {
        this.sourceDataService = sourceDataService;
        this.riskMetricRepository = riskMetricRepository;
        this.notificationRepository = notificationRepository;
        this.auditService = auditService;
        this.riskEvaluator = riskEvaluator;
        this.templateService = templateService;
        this.reportRepository = reportRepository;
        this.userRepository = userRepository;
    }

    public List<RiskMetric> calculateMetrics(Integer reportId) {
        List<RiskMetric> metrics = new ArrayList<>();
        riskMetricRepository.deleteByReport_ReportId(reportId);

        RegReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new RuntimeException("Report Not Found"));

        if (!"DRAFT".equalsIgnoreCase(report.getStatus())) {
            throw new RuntimeException("Risk metrics can only be calculated for reports in DRAFT status.");
        }

        List<TemplateField> fields = templateService.getFieldsByTemplateId(report.getTemplate().getTemplateId());

        if (fields.isEmpty()) {
            auditService.logAction("CALCULATE_RISK_METRICS_SKIPPED", "ReportID: " + reportId,
                    "No template fields found to calculate.");
            return metrics;
        }

        List<Loan> loans = sourceDataService.getAllLoans();
        List<Deposit> deposits = sourceDataService.getAllDeposits();
        List<TreasuryTrade> treasuryTrades = sourceDataService.getAllTreasuryTrades();
        List<GeneralLedger> generalLedgers = sourceDataService.getAllGeneralLedgers();

        Map<String, BigDecimal> context = new HashMap<>();

        BigDecimal totalLoans = BigDecimal.ZERO;
        for (Loan l : loans) {
            if (l.getLoanAmount() != null) {
                totalLoans = totalLoans.add(l.getLoanAmount());
            }
        }
        context.put("Total_Loans", totalLoans);

        BigDecimal totalDeposits = BigDecimal.ZERO;
        for (Deposit d : deposits) {
            if (d.getAmount() != null) {
                totalDeposits = totalDeposits.add(d.getAmount());
            }
        }
        context.put("Total_Deposits", totalDeposits);

        BigDecimal cdRatio = BigDecimal.ZERO;
        if (totalDeposits.compareTo(BigDecimal.ZERO) > 0) {
            cdRatio = totalLoans.divide(totalDeposits, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"));
        }
        context.put("Loan_to_Deposit_Ratio", cdRatio);

        BigDecimal totalTreasury = BigDecimal.ZERO;
        for (TreasuryTrade t : treasuryTrades) {
            if (t.getNotional() != null) {
                totalTreasury = totalTreasury.add(t.getNotional());
            }
        }
        context.put("Treasury_Exposure", totalTreasury);

        BigDecimal netGlBalance = BigDecimal.ZERO;
        for (GeneralLedger gl : generalLedgers) {
            BigDecimal credit = gl.getCredit() != null ? gl.getCredit() : BigDecimal.ZERO;
            BigDecimal debit = gl.getDebit() != null ? gl.getDebit() : BigDecimal.ZERO;
            netGlBalance = netGlBalance.add(credit.subtract(debit));
        }
        context.put("Net_GL_Balance", netGlBalance);

        BigDecimal rwa = BigDecimal.ZERO;
        for (Loan loan : loans) {
            BigDecimal amt = loan.getLoanAmount() != null ? loan.getLoanAmount() : BigDecimal.ZERO;
            rwa = rwa.add(amt.multiply(getRiskWeight(loan.getLoanType())));
        }
        context.put("RWA", rwa);

        BigDecimal maxExposure = BigDecimal.ZERO;
        if (netGlBalance.abs().compareTo(BigDecimal.ZERO) > 0) {
            Map<Integer, BigDecimal> exposureByCustomer = new HashMap<>();

            for (Loan l : loans) {
                if (l.getCustomerId() != null) {
                    BigDecimal amount = l.getLoanAmount() != null ? l.getLoanAmount() : BigDecimal.ZERO;
                    Integer customerId = l.getCustomerId();

                    if (exposureByCustomer.containsKey(customerId)) {
                        exposureByCustomer.put(customerId, exposureByCustomer.get(customerId).add(amount));
                    } else {
                        exposureByCustomer.put(customerId, amount);
                    }
                }
            }
            for (BigDecimal exp : exposureByCustomer.values()) {
                if (exp.compareTo(maxExposure) > 0)
                    maxExposure = exp;
            }
        }
        context.put("MAX(Customer_Total_Load)", maxExposure);

        for (TemplateField field : fields) {
            String formula = field.getMappingExpression();
            if (formula == null || formula.isEmpty())
                continue;

            BigDecimal calculatedValue = riskEvaluator.evaluateFormula(formula, context);

            context.put(field.getFieldName(), calculatedValue);

            metrics.add(createMetric(report, field.getFieldName(), calculatedValue));
        }

        if (context.containsKey("CRAR") && context.get("CRAR").compareTo(new BigDecimal("9")) < 0) {
            generateRiskAlert("Capital breach: CRAR is below 9% threshold (" + context.get("CRAR") + "%) for Report ID "
                    + reportId);
        }
        if (context.containsKey("LCR") && context.get("LCR").compareTo(new BigDecimal("100")) < 0) {
            generateRiskAlert("Liquidity breach: LCR is below 100% threshold (" + context.get("LCR")
                    + "%) for Report ID " + reportId);
        }
        if (context.containsKey("Loan_to_Deposit_Ratio")
                && context.get("Loan_to_Deposit_Ratio").compareTo(new BigDecimal("90")) > 0) {
            generateRiskAlert("High lending risk: Loan-to-Deposit Ratio exceeds safe limit ("
                    + context.get("Loan_to_Deposit_Ratio") + "%) for Report ID " + reportId);
        }

        auditService.logAction("CALCULATE_RISK_METRICS", "ReportID: " + reportId,
                "Dynamically calculated " + metrics.size() + " metrics.");
        return metrics;
    }

    private BigDecimal getRiskWeight(String loanType) {
        if (loanType == null)
            return new BigDecimal("1.00");
        switch (loanType.toLowerCase()) {
            case "home loan":
                return new BigDecimal("0.50");
            case "personal loan":
            case "auto loan":
                return new BigDecimal("0.75");
            case "corporate loan":
            default:
                return new BigDecimal("1.00");
        }
    }

    private void generateRiskAlert(String message) {
        Notification notification = new Notification();
        notification.setUser(userRepository.getReferenceById(1L));
        notification.setMessage(message);
        notification.setCategory("Risk");
        notification.setStatus("UNREAD");
        notification.setCreatedDate(LocalDateTime.now());
        notificationRepository.save(notification);
    }

    private RiskMetric createMetric(RegReport report, String name, BigDecimal value) {
        RiskMetric metric = new RiskMetric();
        metric.setReport(report);
        metric.setMetricName(name);
        metric.setMetricValue(value);
        metric.setCalculationDate(LocalDateTime.now());
        return riskMetricRepository.save(metric);
    }

    public List<RiskMetric> getAllMetrics() {
        return riskMetricRepository.findAll();
    }
}
