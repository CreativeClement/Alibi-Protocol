// Type stubs for packages missing type declarations

declare class Buffer extends Uint8Array {
  static from(data: string | ArrayBuffer | Uint8Array, encoding?: string): Buffer;
  toString(encoding?: string): string;
}

declare module '*.png' {
  const value: number;
  export default value;
}

declare module 'react-native-get-random-values' {}

declare module 'expo-secure-store' {
  export function getItemAsync(key: string, options?: Record<string, unknown>): Promise<string | null>;
  export function setItemAsync(key: string, value: string, options?: Record<string, unknown>): Promise<void>;
  export function deleteItemAsync(key: string, options?: Record<string, unknown>): Promise<void>;
  export const WHEN_UNLOCKED_THIS_DEVICE_ONLY: number;
  // Test-only export from mock — resolves moduleNameMapper in Jest
  export function __resetStore(): void;
}

declare module '@solana/web3.js' {
  export class PublicKey {
    constructor(value: string | Uint8Array | number[]);
    toBase58(): string;
    toBuffer(): Buffer;
    toString(): string;
    equals(publicKey: PublicKey): boolean;
    toJSON(): string;
    static isOnCurve(pubkeyData: PublicKey | Uint8Array): boolean;
    static default: PublicKey;
  }

  export class Transaction {
    constructor(opts?: { feePayer?: PublicKey; recentBlockhash?: string });
    add(...items: TransactionInstruction[]): Transaction;
    serialize(config?: { requireAllSignatures?: boolean; verifySignatures?: boolean }): Buffer;
    recentBlockhash: string;
    feePayer: PublicKey;
    static from(buffer: Buffer | Uint8Array | number[]): Transaction;
  }

  export class TransactionInstruction {
    constructor(opts: {
      keys: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>;
      programId: PublicKey;
      data?: Buffer;
    });
    keys: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>;
    programId: PublicKey;
    data: Buffer;
  }

  export class Connection {
    constructor(endpoint: string, commitmentOrConfig?: string | object);
    getLatestBlockhash(commitment?: string): Promise<{ blockhash: string; lastValidBlockHeight: number }>;
    sendRawTransaction(rawTransaction: Buffer | Uint8Array, options?: object): Promise<string>;
    confirmTransaction(signature: string, commitment?: string): Promise<object>;
    getSignatureStatus(signature: string, config?: object): Promise<{ value: { err: object | null; confirmationStatus: string | null } | null }>;
    getBalance(publicKey: PublicKey, commitment?: string): Promise<number>;
  }

  export class SystemProgram {
    static transfer(params: { fromPubkey: PublicKey; toPubkey: PublicKey; lamports: number }): TransactionInstruction;
  }
}

declare module 'expo-av' {
  export namespace Audio {
    function requestPermissionsAsync(): Promise<{ status: string }>;
    function setAudioModeAsync(config: {
      allowsRecordingIOS?: boolean;
      playsInSilentModeIOS?: boolean;
    }): Promise<void>;

    class Recording {
      prepareToRecordAsync(options: object): Promise<void>;
      startAsync(): Promise<void>;
      stopAndUnloadAsync(): Promise<void>;
      getURI(): string | null;
    }

    class Sound {
      loadAsync(source: { uri: string }): Promise<void>;
      getStatusAsync(): Promise<{ isLoaded: boolean; durationMillis?: number }>;
      unloadAsync(): Promise<void>;
    }

    const RecordingOptionsPresets: {
      HIGH_QUALITY: object;
      LOW_QUALITY: object;
    };
  }
}

declare module 'tweetnacl' {
  interface BoxKeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  }

  namespace box {
    function keyPair(): BoxKeyPair;
    function before(publicKey: Uint8Array, secretKey: Uint8Array): Uint8Array;
    function after(message: Uint8Array, nonce: Uint8Array, sharedKey: Uint8Array): Uint8Array;
    const nonceLength: number;

    namespace open {
      function after(box: Uint8Array, nonce: Uint8Array, sharedKey: Uint8Array): Uint8Array | null;
    }
  }

  function secretbox(message: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
  namespace secretbox {
    function open(box: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null;
    const keyLength: number;
    const nonceLength: number;
    const overheadLength: number;
  }

  function randomBytes(length: number): Uint8Array;

  const _default: {
    box: typeof box;
    secretbox: typeof secretbox;
    randomBytes: typeof randomBytes;
  };
  export default _default;
  export { BoxKeyPair };
}

declare module 'bs58' {
  function encode(source: Uint8Array | Buffer): string;
  function decode(string: string): Uint8Array;
  export default { encode, decode };
}
