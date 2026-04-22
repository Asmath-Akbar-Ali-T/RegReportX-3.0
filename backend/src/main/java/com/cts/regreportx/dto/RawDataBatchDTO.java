package com.cts.regreportx.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RawDataBatchDTO {
    private Integer batchId;
    private DataSourceDTO source;
    private LocalDateTime ingestedDate;
    private Integer rowCount;
    private String status;
}
