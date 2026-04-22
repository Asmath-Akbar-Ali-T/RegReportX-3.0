package com.cts.regreportx.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TreasuryTradeDTO {
    private String tradeId;
    private String instrument;
    private String counterparty;
    private BigDecimal notional;
    private String currency;
    private LocalDate tradeDate;
    private LocalDate maturityDate;
    private RawDataBatchDTO rawDataBatch;
}
