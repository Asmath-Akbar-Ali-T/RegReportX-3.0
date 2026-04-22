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

@Entity
@Table(name = "ExceptionRecord")
@Data
@NoArgsConstructor
public class ExceptionRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ExceptionID")
    private Integer exceptionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ReportID")
    private RegReport report;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "FieldID")
    private TemplateField templateField;

    @Column(name = "Issue")
    private String issue;

    @Column(name = "Severity")
    private String severity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "AssignedTo")
    private User assignedUser;

    @Column(name = "Status")
    private String status;
}
