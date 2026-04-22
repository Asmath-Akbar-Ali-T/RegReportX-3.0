package com.cts.regreportx.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CorrectionLogDTO {
    private Integer correctionId;
    private ExceptionRecordDTO exceptionRecord;
    private DataQualityIssueDTO dataQualityIssue;
    private String oldValue;
    private String newValue;
    private UserDTO correctedByUser;
    private LocalDateTime correctedDate;
}
