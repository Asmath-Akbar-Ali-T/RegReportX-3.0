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
@Table(name = "RawRecord")
@Data
@NoArgsConstructor
public class RawRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "RawRecordID")
    private Integer rawRecordId;

    @ManyToOne(fetch = jakarta.persistence.FetchType.LAZY)
    @JoinColumn(name = "BatchID")
    private RawDataBatch batch;

    @Column(name = "PayloadJSON", columnDefinition = "TEXT")
    private String payloadJson;

    @Column(name = "RecordDate")
    private LocalDateTime recordDate;
}
