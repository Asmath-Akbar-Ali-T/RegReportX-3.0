package com.cts.regreportx.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RawRecordDTO {
    private Integer rawRecordId;
    private RawDataBatchDTO batch;
    private String payloadJson;
    private LocalDateTime recordDate;
}
