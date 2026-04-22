package com.cts.regreportx.component;

import com.cts.regreportx.model.RegTemplate;
import com.cts.regreportx.model.TemplateField;
import com.cts.regreportx.repository.RegTemplateRepository;
import com.cts.regreportx.repository.TemplateFieldRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class TemplateInitializer implements CommandLineRunner {

    private final RegTemplateRepository templateRepository;
    private final TemplateFieldRepository fieldRepository;

    @Autowired
    public TemplateInitializer(RegTemplateRepository templateRepository, TemplateFieldRepository fieldRepository) {
        this.templateRepository = templateRepository;
        this.fieldRepository = fieldRepository;
    }

    @Override
    public void run(String... args) {
        RegTemplate rca3 = insertTemplateIfNotExists("RCA3", "Capital Adequacy Return (Calculates Basel III Capital Constraints)", "Quarterly", "Active");
        if (rca3 != null) {
            insertFieldIfNotExists(rca3.getTemplateId(), "Total_Loans", "DECIMAL", "SUM(loanAmount) FROM Loan", true);
            insertFieldIfNotExists(rca3.getTemplateId(), "Total_Deposits", "DECIMAL", "SUM(amount) FROM Deposit", true);
            insertFieldIfNotExists(rca3.getTemplateId(), "Net_GL_Balance", "DECIMAL", "SUM(credit) - SUM(debit) FROM GeneralLedger", true);
            insertFieldIfNotExists(rca3.getTemplateId(), "RWA", "DECIMAL", "SUM(loanAmount * RiskWeight) FROM Loan", true);
            insertFieldIfNotExists(rca3.getTemplateId(), "CRAR", "DECIMAL", "(|Net_GL_Balance| / RWA) * 100", true);
        }

        RegTemplate irs = insertTemplateIfNotExists("IRS", "Interest Rate Sensitivity", "Quarterly", "Active");
        if (irs != null) {
            insertFieldIfNotExists(irs.getTemplateId(), "NetAssets", "DECIMAL", "SUM(loanAmount) + SUM(treasuryTradeNotional)", true);
            insertFieldIfNotExists(irs.getTemplateId(), "NetLiabilities", "DECIMAL", "SUM(depositAmount)", true);
        }

        RegTemplate rls = insertTemplateIfNotExists("RLS", "Return on Liquidity Support", "Monthly", "Active");
        if (rls != null) {
            insertFieldIfNotExists(rls.getTemplateId(), "Treasury_Exposure", "DECIMAL", "SUM(notional) FROM TreasuryTrade", true);
            insertFieldIfNotExists(rls.getTemplateId(), "Expected_Withdrawal", "DECIMAL", "Total_Deposits * 0.10", true);
            insertFieldIfNotExists(rls.getTemplateId(), "LCR", "DECIMAL", "(Treasury_Exposure / Expected_Withdrawal) * 100", true);
            insertFieldIfNotExists(rls.getTemplateId(), "Liquidity_Buffer", "DECIMAL", "Treasury_Exposure - Expected_Withdrawal", false);
        }

        RegTemplate ale1 = insertTemplateIfNotExists("ALE1", "Large Exposures Return", "Quarterly", "Active");
        if (ale1 != null) {
            insertFieldIfNotExists(ale1.getTemplateId(), "Exposure_Concentration", "DECIMAL", "MAX(Customer_Total_Load) / |Net_GL_Balance| * 100", true);
            insertFieldIfNotExists(ale1.getTemplateId(), "Loan_to_Deposit_Ratio", "DECIMAL", "(Total_Loans / Total_Deposits) * 100", true);
        }
    }

    private RegTemplate insertTemplateIfNotExists(String regulationCode, String description, String frequency, String status) {
        List<RegTemplate> allTemplates = templateRepository.findAll();
        for (RegTemplate template : allTemplates) {
            if (regulationCode.equals(template.getRegulationCode())) {
                return template;
            }
        }
        RegTemplate newTemplate = new RegTemplate();
        newTemplate.setRegulationCode(regulationCode);
        newTemplate.setDescription(description);
        newTemplate.setFrequency(frequency);
        newTemplate.setStatus(status);
        return templateRepository.save(newTemplate);
    }

    private void insertFieldIfNotExists(Integer templateId, String fieldName, String dataType, String mappingExpr, Boolean required) {
        List<TemplateField> existingFields = fieldRepository.findByTemplate_TemplateId(templateId);
        for (TemplateField field : existingFields) {
            if (fieldName.equals(field.getFieldName())) {
                return; // already exists
            }
        }
        TemplateField newField = new TemplateField();
        newField.setTemplate(templateRepository.getReferenceById(templateId));
        newField.setFieldName(fieldName);
        newField.setDataType(dataType);
        newField.setMappingExpression(mappingExpr);
        newField.setRequiredFlag(required);
        fieldRepository.save(newField);
    }
}
