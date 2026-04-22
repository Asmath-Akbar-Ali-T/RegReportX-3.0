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
@Table(name = "CorrectionLog")
@Data
@NoArgsConstructor
public class CorrectionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "CorrectionID")
    private Integer correctionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ExceptionID")
    private ExceptionRecord exceptionRecord;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "DataQualityIssueID")
    private DataQualityIssue dataQualityIssue;

    @Column(name = "OldValue")
    private String oldValue;

    @Column(name = "NewValue")
    private String newValue;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "CorrectedBy")
    private User correctedByUser;

    @Column(name = "CorrectedDate")
    private LocalDateTime correctedDate;
}
