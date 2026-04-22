package com.cts.regreportx.model;


import lombok.Data;
import lombok.NoArgsConstructor;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "ValidationRule")
@Data
@NoArgsConstructor
public class ValidationRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "RuleID")
    private Integer ruleId;

    @Column(name = "Name")
    private String name;

    @Column(name = "RuleExpression")
    private String ruleExpression;

    @Column(name = "Severity")
    private String severity;

    @Column(name = "Status")
    private String status;
}
