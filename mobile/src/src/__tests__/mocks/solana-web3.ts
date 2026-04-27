/**
 * Configurable mock overrides — set these before creating a Connection
 * to control per-test behavior. Reset in afterEach/beforeEach.
 */
export const __mockOverrides = {
  getLatestBlockhash: null as (() => Promise<any>) | null,
  sendRawTransaction: null as (() => Promise<any>) | null,
  confirmTransaction: null as (() => Promise<any>) | null,
  getSignatureStatus: null as (() => Promise<any>) | null,
  getBalance: null as (() => Promise<any>) | null,
};

export class Connection {
  constructor(_rpcUrl: string, _commitment?: string) {}
  getLatestBlockhash = jest.fn().mockImplementation(() =>
    __mockOverrides.getLatestBlockhash
      ? __mockOverrides.getLatestBlockhash()
      : Promise.resolve({ blockhash: 'mock-blockhash' })
  );
  sendRawTransaction = jest.fn().mockImplementation(() =>
    __mockOverrides.sendRawTransaction
      ? __mockOverrides.sendRawTransaction()
      : Promise.resolve('mock-signature')
  );
  confirmTransaction = jest.fn().mockImplementation(() =>
    __mockOverrides.confirmTransaction
      ? __mockOverrides.confirmTransaction()
      : Promise.resolve({ value: { err: null } })
  );
  getSignatureStatus = jest.fn().mockImplementation(() =>
    __mockOverrides.getSignatureStatus
      ? __mockOverrides.getSignatureStatus()
      : Promise.resolve({ value: { confirmationStatus: 'confirmed' } })
  );
  getBalance = jest.fn().mockImplementation(() =>
    __mockOverrides.getBalance
      ? __mockOverrides.getBalance()
      : Promise.resolve(1_500_000_000)
  );
}

export class PublicKey {
  _key: string;
  constructor(key: string) {
    this._key = key;
  }
  toBase58() {
    return this._key;
  }
  toString() {
    return this._key;
  }
  toBuffer() {
    return Buffer.from(this._key);
  }
  equals(other: PublicKey) {
    return this._key === other._key;
  }
  toJSON() {
    return this._key;
  }
  static isOnCurve() {
    return true;
  }
  static default = new PublicKey('11111111111111111111111111111111');
}

export class Transaction {
  recentBlockhash: string | null = null;
  feePayer: PublicKey | null = null;
  add() {
    return this;
  }
  serialize() {
    return Buffer.from('mock-tx');
  }
}

export class TransactionInstruction {
  constructor(_opts: any) {}
}

export const SystemProgram = {
  transfer: jest.fn(),
};
