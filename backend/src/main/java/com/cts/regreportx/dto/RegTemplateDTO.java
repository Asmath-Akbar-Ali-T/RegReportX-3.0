package com.cts.regreportx.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegTemplateDTO {
    private Integer templateId;
    private String regulationCode;
    private String description;
    private String frequency;
    private String status;
}
