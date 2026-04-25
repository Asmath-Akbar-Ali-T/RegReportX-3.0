package com.cts.regreportx.service;

import com.cts.regreportx.model.DataSource;
import com.cts.regreportx.model.RawDataBatch;
import com.cts.regreportx.repository.DataSourceRepository;
import com.cts.regreportx.repository.RawDataBatchRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class DataIngestionService {

    private final DataSourceRepository dataSourceRepository;
    private final RawDataBatchRepository rawDataBatchRepository;
    private final SourceDataService sourceDataService;
    private final AuditService auditService;
    private final NotificationService notificationService;

    @Autowired
    public DataIngestionService(DataSourceRepository dataSourceRepository,
            RawDataBatchRepository rawDataBatchRepository,
            SourceDataService sourceDataService,
            AuditService auditService,
            NotificationService notificationService) {
        this.dataSourceRepository = dataSourceRepository;
        this.rawDataBatchRepository = rawDataBatchRepository;
        this.sourceDataService = sourceDataService;
        this.auditService = auditService;
        this.notificationService = notificationService;
    }

    @PostConstruct
    public void initDataSources() {
        if (dataSourceRepository.count() == 0) {
            String[] systemNames = { "Loan System", "Deposit System", "Treasury System", "GL System" };
            for (String name : systemNames) {
                DataSource source = new DataSource();
                source.setName(name);
                source.setSourceType("DATABASE");
                source.setStatus("ACTIVE");
                dataSourceRepository.save(source);
            }
        }
    }

    public List<RawDataBatch> runIngestion() {
        List<RawDataBatch> batches = new ArrayList<>();

        List<DataSource> sources = dataSourceRepository.findAll();

        for (DataSource source : sources) {
            int rowCount = 0;
            String resourceName = source.getName().toLowerCase();

            if (resourceName.contains("loan")) {
                rowCount = sourceDataService.getAllLoans().size();
            } else if (resourceName.contains("deposit")) {
                rowCount = sourceDataService.getAllDeposits().size();
            } else if (resourceName.contains("treasury")) {
                rowCount = sourceDataService.getAllTreasuryTrades().size();
            } else if (resourceName.contains("gl")) {
                rowCount = sourceDataService.getAllGeneralLedgers().size();
            }

            RawDataBatch batch = new RawDataBatch();
            batch.setSource(source);
            batch.setIngestedDate(LocalDateTime.now());
            batch.setRowCount(rowCount);
            batch.setStatus("Ingested");
            batches.add(rawDataBatchRepository.save(batch));

            auditService.logAction("RUN_INGESTION", resourceName);
        }

        notificationService.notifyRole("COMPLIANCE_ANALYST", "Data ingestion completed — ready for validation", "Ingestion");

        return batches;
    }

    public List<RawDataBatch> getAllBatches() {
        return rawDataBatchRepository.findAll();
    }
}
