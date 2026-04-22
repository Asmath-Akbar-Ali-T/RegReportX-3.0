package com.cts.regreportx.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DepositDTO {
    private String depositId;
    private Integer customerId;
    private String branchId;
    private String depositType;
    private BigDecimal amount;
    private BigDecimal interestRate;
    private String currency;
    private LocalDate openDate;
    private LocalDate maturityDate;
    private RawDataBatchDTO rawDataBatch;
}
