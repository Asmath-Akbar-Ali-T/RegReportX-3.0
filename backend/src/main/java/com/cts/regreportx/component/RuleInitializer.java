package com.cts.regreportx.component;

import com.cts.regreportx.model.ValidationRule;
import com.cts.regreportx.repository.ValidationRuleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class RuleInitializer implements CommandLineRunner {

    private final ValidationRuleRepository validationRuleRepository;

    @Autowired
    public RuleInitializer(ValidationRuleRepository validationRuleRepository) {
        this.validationRuleRepository = validationRuleRepository;
    }

    @Override
    public void run(String... args) {
        upsertRule("LoanAmountPositive", "LoanAmount > 0", "CRITICAL", "Active");
        upsertRule("InterestRateRange", "InterestRate BETWEEN 0 AND 20", "WARNING", "Active");
        upsertRule("DepositAmountPositive", "Amount > 0", "CRITICAL", "Active");
        upsertRule("DebitPositive", "Debit >= 0", "ERROR", "Active");
        upsertRule("CreditPositive", "Credit >= 0", "ERROR", "Active");
    }

    private void upsertRule(String name, String expression, String severity, String status) {
        ValidationRule rule = validationRuleRepository.findByName(name);
        if (rule == null) {
            rule = new ValidationRule();
            rule.setName(name);
        }
        rule.setRuleExpression(expression);
        rule.setSeverity(severity);
        rule.setStatus(status);
        validationRuleRepository.save(rule);
    }
}
