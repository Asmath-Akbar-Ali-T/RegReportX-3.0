package com.cts.regreportx.controller;

import com.cts.regreportx.dto.UploadResponse;
import com.cts.regreportx.service.CsvUploadService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/ingestion/csv")
@PreAuthorize("hasAnyRole('OPERATIONS_OFFICER', 'REGTECH_ADMIN')")
public class CsvUploadController {

    private final CsvUploadService csvUploadService;

    public CsvUploadController(CsvUploadService csvUploadService) {
        this.csvUploadService = csvUploadService;
    }

    @PostMapping("/deposits/upload")
    public ResponseEntity<UploadResponse> uploadDeposits(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(csvUploadService.uploadDeposits(file));
    }

    @PostMapping("/loans/upload")
    public ResponseEntity<UploadResponse> uploadLoans(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(csvUploadService.uploadLoans(file));
    }

    @PostMapping("/general-ledger/upload")
    public ResponseEntity<UploadResponse> uploadGeneralLedger(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(csvUploadService.uploadGeneralLedger(file));
    }

    @PostMapping("/treasury/upload")
    public ResponseEntity<UploadResponse> uploadTreasury(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(csvUploadService.uploadTreasury(file));
    }
}
