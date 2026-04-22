package com.cts.regreportx.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DataSourceDTO {
    private Integer sourceId;
    private String name;
    private String sourceType;
    private String schedule;
    private String status;
}
