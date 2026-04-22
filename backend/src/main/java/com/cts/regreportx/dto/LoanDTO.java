package com.cts.regreportx.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoanDTO {
    private String loanId;
    private Integer customerId;
    private String branchId;
    private String loanType;
    private BigDecimal loanAmount;
    private BigDecimal interestRate;
    private String currency;
    private LocalDate startDate;
    private LocalDate maturityDate;
    private String status;
    private RawDataBatchDTO rawDataBatch;
}
