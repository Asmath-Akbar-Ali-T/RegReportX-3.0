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
@Table(name = "DataSource")
@Data
@NoArgsConstructor
public class DataSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "SourceID")
    private Integer sourceId;

    @Column(name = "Name")
    private String name;

    @Column(name = "SourceType")
    private String sourceType;

    @Column(name = "Schedule")
    private String schedule;

    @Column(name = "Status")
    private String status;
}
