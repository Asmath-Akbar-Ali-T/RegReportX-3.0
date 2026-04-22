package com.cts.regreportx.dto;


import lombok.Data;
import lombok.NoArgsConstructor;
@Data
@NoArgsConstructor
public class UploadResponse {
    
    private String message;
    private String fileName;
    private String datasetType;
    private int recordsInserted;

    public UploadResponse(String message, String fileName, String datasetType, int recordsInserted) {
        this.message = message;
        this.fileName = fileName;
        this.datasetType = datasetType;
        this.recordsInserted = recordsInserted;
    }
}
