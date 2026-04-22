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
@Table(name = "DataQualityIssue")
@Data
@NoArgsConstructor
public class DataQualityIssue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "IssueID")
    private Integer issueId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "BatchID")
    private RawDataBatch batch;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "RuleID")
    private ValidationRule rule;

    @Column(name = "RecordID")
    private String recordId;

    @Column(name = "Message")
    private String message;

    @Column(name = "Severity")
    private String severity;

    @Column(name = "LoggedDate")
    private LocalDateTime loggedDate;

    @Column(name = "Status")
    private String status;
}
