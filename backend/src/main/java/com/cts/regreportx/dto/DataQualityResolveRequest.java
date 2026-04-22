package com.cts.regreportx.dto;


import lombok.Data;
import lombok.NoArgsConstructor;
@Data
@NoArgsConstructor
public class DataQualityResolveRequest {
    private String correctedValue;
    private String justification;
}
