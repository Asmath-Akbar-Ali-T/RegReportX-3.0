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
@Table(name = "TemplateField")
@Data
@NoArgsConstructor
public class TemplateField {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "FieldID")
    private Integer fieldId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "TemplateID")
    private RegTemplate template;

    @Column(name = "FieldName")
    private String fieldName;

    @Column(name = "DataType")
    private String dataType;

    @Column(name = "MappingExpression")
    private String mappingExpression;

    @Column(name = "RequiredFlag")
    private Boolean requiredFlag;
}
