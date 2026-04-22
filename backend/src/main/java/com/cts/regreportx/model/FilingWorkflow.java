package com.cts.regreportx.model;


import lombok.Data;
import lombok.NoArgsConstructor;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "FilingWorkflow")
@Data
@NoArgsConstructor
public class FilingWorkflow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "WorkflowID")
    private Integer workflowId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ReportID")
    private RegReport report;

    @Column(name = "StepName")
    private String stepName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ActorID")
    private User actor;

    @Column(name = "StepDate")
    private LocalDateTime stepDate;

    @Column(name = "Status")
    private String status;
}
