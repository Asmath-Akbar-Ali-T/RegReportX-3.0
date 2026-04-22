package com.cts.regreportx;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.cts.regreportx.model.RawRecord;
import com.cts.regreportx.repository.RawRecordRepository;

import java.util.List;

@SpringBootTest
public class RawRecordTest {

    @Autowired
    private RawRecordRepository rawRecordRepository;

    @Test
    public void dumpRecords() {
        System.out.println("====== RECORD DUMP ======");
        List<RawRecord> records = rawRecordRepository.findAll();
        for (RawRecord r : records) {
            System.out.println("ID: " + r.getRawRecordId() + " -> " + r.getPayloadJson());
        }
        System.out.println("=========================");
    }
}
