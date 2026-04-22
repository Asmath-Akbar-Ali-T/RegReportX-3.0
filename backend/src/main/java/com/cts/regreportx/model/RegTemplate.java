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
@Table(name = "RegTemplate")
@Data
@NoArgsConstructor
public class RegTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "TemplateID")
    private Integer templateId;

    @Column(name = "RegulationCode")
    private String regulationCode;

    @Column(name = "Description")
    private String description;

    @Column(name = "Frequency")
    private String frequency;

    @Column(name = "Status")
    private String status;
}
