package com.cts.regreportx.model;


import lombok.Data;
import lombok.NoArgsConstructor;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "RawDataBatch")
@Data
@NoArgsConstructor
public class RawDataBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "BatchID")
    private Integer batchId;

    @ManyToOne(fetch = jakarta.persistence.FetchType.LAZY)
    @JoinColumn(name = "SourceID")
    private DataSource source;

    @Column(name = "IngestedDate")
    private LocalDateTime ingestedDate;

    @Column(name = "RowCount")
    private Integer rowCount;

    @Column(name = "Status")
    private String status;
}
