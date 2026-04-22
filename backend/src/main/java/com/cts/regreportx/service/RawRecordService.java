package com.cts.regreportx.service;

import com.cts.regreportx.model.*;
import com.cts.regreportx.repository.RawDataBatchRepository;
import com.cts.regreportx.repository.RawRecordRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class RawRecordService {

    private final RawRecordRepository rawRecordRepository;
    private final RawDataBatchRepository batchRepository;
    private final SourceDataService sourceDataService;
    private final ObjectMapper objectMapper;

    @Autowired
    public RawRecordService(RawRecordRepository rawRecordRepository,
            RawDataBatchRepository batchRepository,
            SourceDataService sourceDataService) {
        this.rawRecordRepository = rawRecordRepository;
        this.batchRepository = batchRepository;
        this.sourceDataService = sourceDataService;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
    }

    public int loadRawRecords(Integer batchId) {
        Optional<RawDataBatch> batchOpt = batchRepository.findById(batchId);
        if (!batchOpt.isPresent()) {
            return 0;
        }

        RawDataBatch batch = batchOpt.get();
        Integer sourceId = batch.getSource() != null ? batch.getSource().getSourceId() : null;
        int recordsInserted = 0;

        try {
            if (sourceId == 1) {
                List<Loan> loans = sourceDataService.getAllLoans();
                for (Loan loan : loans) {
                    insertRawRecord(batchId, loan);
                    recordsInserted++;
                }
            } else if (sourceId == 2) {
                List<Deposit> deposits = sourceDataService.getAllDeposits();
                for (Deposit deposit : deposits) {
                    insertRawRecord(batchId, deposit);
                    recordsInserted++;
                }
            } else if (sourceId == 3) {
                List<TreasuryTrade> trades = sourceDataService.getAllTreasuryTrades();
                for (TreasuryTrade trade : trades) {
                    insertRawRecord(batchId, trade);
                    recordsInserted++;
                }
            } else if (sourceId == 4) {
                List<GeneralLedger> gls = sourceDataService.getAllGeneralLedgers();
                for (GeneralLedger gl : gls) {
                    insertRawRecord(batchId, gl);
                    recordsInserted++;
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        return recordsInserted;
    }

    private void insertRawRecord(Integer batchId, Object sourceEntity) throws Exception {
        RawRecord record = new RawRecord();
        record.setBatch(batchRepository.getReferenceById(batchId));
        record.setRecordDate(LocalDateTime.now());
        record.setPayloadJson(objectMapper.writeValueAsString(sourceEntity));
        rawRecordRepository.save(record);
    }

    public List<RawRecord> getRecordsByBatch(Integer batchId) {
        return rawRecordRepository.findByBatch_BatchId(batchId);
    }
}
