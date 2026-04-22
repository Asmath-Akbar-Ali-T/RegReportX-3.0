package com.cts.regreportx.service;

import com.cts.regreportx.dto.UploadResponse;
import com.cts.regreportx.model.Deposit;
import com.cts.regreportx.model.GeneralLedger;
import com.cts.regreportx.model.Loan;
import com.cts.regreportx.model.TreasuryTrade;
import com.cts.regreportx.exception.InvalidFileException;
import com.cts.regreportx.repository.DepositRepository;
import com.cts.regreportx.repository.GeneralLedgerRepository;
import com.cts.regreportx.repository.LoanRepository;
import com.cts.regreportx.repository.TreasuryTradeRepository;
import com.opencsv.CSVReader;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class CsvUploadService {
    
    private final DepositRepository depositRepository;
    private final LoanRepository loanRepository;
    private final GeneralLedgerRepository generalLedgerRepository;
    private final TreasuryTradeRepository treasuryTradeRepository;

    public CsvUploadService(DepositRepository depositRepository, LoanRepository loanRepository,
                            GeneralLedgerRepository generalLedgerRepository, TreasuryTradeRepository treasuryTradeRepository) {
        this.depositRepository = depositRepository;
        this.loanRepository = loanRepository;
        this.generalLedgerRepository = generalLedgerRepository;
        this.treasuryTradeRepository = treasuryTradeRepository;
    }

    public UploadResponse uploadDeposits(MultipartFile file) {
        validateFile(file);
        List<Deposit> deposits = new ArrayList<>();
        try (CSVReader csvReader = new CSVReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String[] row;
            boolean isHeader = true;
            while ((row = csvReader.readNext()) != null) {
                if (isHeader) { isHeader = false; continue; }
                if (row.length < 9) continue;
                Deposit deposit = new Deposit();
                deposit.setDepositId(row[0].trim());
                deposit.setCustomerId(Integer.parseInt(row[1].trim()));
                deposit.setBranchId(row[2].trim());
                deposit.setDepositType(row[3].trim());
                deposit.setAmount(new BigDecimal(row[4].trim()));
                deposit.setInterestRate(new BigDecimal(row[5].trim()));
                deposit.setCurrency(row[6].trim());
                deposit.setOpenDate(LocalDate.parse(row[7].trim()));
                deposit.setMaturityDate(LocalDate.parse(row[8].trim()));
                deposits.add(deposit);
            }
            depositRepository.saveAll(deposits);
            return new UploadResponse("Deposits CSV uploaded successfully", file.getOriginalFilename(), "deposits", deposits.size());
        } catch (Exception e) {
            throw new RuntimeException("Failed to process deposits CSV: " + e.getMessage());
        }
    }

    public UploadResponse uploadLoans(MultipartFile file) {
        validateFile(file);
        List<Loan> loans = new ArrayList<>();
        try (CSVReader csvReader = new CSVReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String[] row;
            boolean isHeader = true;
            while ((row = csvReader.readNext()) != null) {
                if (isHeader) { isHeader = false; continue; }
                if (row.length < 10) continue;
                Loan loan = new Loan();
                loan.setLoanId(row[0].trim());
                loan.setCustomerId(Integer.parseInt(row[1].trim()));
                loan.setBranchId(row[2].trim());
                loan.setLoanType(row[3].trim());
                loan.setLoanAmount(new BigDecimal(row[4].trim()));
                loan.setInterestRate(new BigDecimal(row[5].trim()));
                loan.setCurrency(row[6].trim());
                loan.setStartDate(LocalDate.parse(row[7].trim()));
                loan.setMaturityDate(LocalDate.parse(row[8].trim()));
                loan.setStatus(row[9].trim());
                loans.add(loan);
            }
            loanRepository.saveAll(loans);
            return new UploadResponse("Loans CSV uploaded successfully", file.getOriginalFilename(), "loans", loans.size());
        } catch (Exception e) {
            throw new RuntimeException("Failed to process loans CSV: " + e.getMessage());
        }
    }

    public UploadResponse uploadGeneralLedger(MultipartFile file) {
        validateFile(file);
        List<GeneralLedger> generalLedgers = new ArrayList<>();
        try (CSVReader csvReader = new CSVReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String[] row;
            boolean isHeader = true;
            while ((row = csvReader.readNext()) != null) {
                if (isHeader) { isHeader = false; continue; }
                if (row.length < 8) continue;
                GeneralLedger gl = new GeneralLedger();
                gl.setGlId(row[0].trim());
                gl.setAccountNumber(Long.parseLong(row[1].trim()));
                gl.setBranchId(row[2].trim());
                gl.setAccountType(row[3].trim());
                gl.setDebit(new BigDecimal(row[4].trim()));
                gl.setCredit(new BigDecimal(row[5].trim()));
                gl.setCurrency(row[6].trim());
                gl.setTransactionDate(LocalDate.parse(row[7].trim()));
                generalLedgers.add(gl);
            }
            generalLedgerRepository.saveAll(generalLedgers);
            return new UploadResponse("General Ledger CSV uploaded successfully", file.getOriginalFilename(), "general_ledger", generalLedgers.size());
        } catch (Exception e) {
            throw new RuntimeException("Failed to process general ledger CSV: " + e.getMessage());
        }
    }

    public UploadResponse uploadTreasury(MultipartFile file) {
        validateFile(file);
        List<TreasuryTrade> treasuries = new ArrayList<>();
        try (CSVReader csvReader = new CSVReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String[] row;
            boolean isHeader = true;
            while ((row = csvReader.readNext()) != null) {
                if (isHeader) { isHeader = false; continue; }
                if (row.length < 7) continue;
                TreasuryTrade tt = new TreasuryTrade();
                tt.setTradeId(row[0].trim());
                tt.setInstrument(row[1].trim());
                tt.setCounterparty(row[2].trim());
                tt.setNotional(new BigDecimal(row[3].trim()));
                tt.setCurrency(row[4].trim());
                tt.setTradeDate(LocalDate.parse(row[5].trim()));
                tt.setMaturityDate(LocalDate.parse(row[6].trim()));
                treasuries.add(tt);
            }
            treasuryTradeRepository.saveAll(treasuries);
            return new UploadResponse("Treasury CSV uploaded successfully", file.getOriginalFilename(), "treasury", treasuries.size());
        } catch (Exception e) {
            throw new RuntimeException("Failed to process treasury CSV: " + e.getMessage());
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new InvalidFileException("Please upload a non-empty CSV file");
        }
        String fileName = file.getOriginalFilename();
        if (fileName == null || !fileName.toLowerCase().endsWith(".csv")) {
            throw new InvalidFileException("Only CSV files are allowed");
        }
    }
}
