import { RawDataBatch } from './ingestion.model';
import { User } from './user.model';

export interface UploadResponse {
  message: string;
  recordsInserted: number;
}

export interface Loan {
  loanId: string;
  customerId: number;
  branchId: string;
  loanType: string;
  loanAmount: number;
  interestRate: number;
  currency: string;
  startDate: string;
  maturityDate: string;
  status: string;
  rawDataBatch?: RawDataBatch;
}

export interface Deposit {
  depositId: string;
  customerId: number;
  branchId: string;
  depositType: string;
  amount: number;
  interestRate: number;
  currency: string;
  openDate: string;
  maturityDate: string;
  rawDataBatch?: RawDataBatch;
}

export interface TreasuryTrade {
  tradeId: string;
  instrument: string;
  counterparty: string;
  notional: number;
  currency: string;
  tradeDate: string;
  maturityDate: string;
  rawDataBatch?: RawDataBatch;
}

export interface GeneralLedger {
  glId: string;
  accountNumber: number;
  branchId: string;
  accountType: string;
  debit: number;
  credit: number;
  currency: string;
  transactionDate: string;
  rawDataBatch?: RawDataBatch;
}

export interface RawRecord {
  rawRecordId: number;
  batch: RawDataBatch;
  payloadJson: string;
  recordDate: string;
}
