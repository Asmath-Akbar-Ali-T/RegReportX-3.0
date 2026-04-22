package com.cts.regreportx.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogDTO {
    private Integer auditId;
    private UserDTO user;
    private String action;
    private String resource;
    private LocalDateTime timestamp;
    private String metadata;
}
