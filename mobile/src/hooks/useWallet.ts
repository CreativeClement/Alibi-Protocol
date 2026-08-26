import { useState, useEffect, useCallback, useRef } from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';
import * as Linking from 'expo-linking';
import { WalletState } from '../types';
import * as StorageService from '../services/storage';
import * as SolanaService from '../services/solana';
import { PHANTOM_CONFIG, SOLANA_CONFIG } from '../constants/api';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

interface WalletConnectParams {
  onSuccess?: (pubkey: PublicKey) => void;
  onError?: (error: string) => void;
}

// Phantom deep link callback state
interface PhantomSession {
  dappKeyPair: nacl.BoxKeyPair;
  sharedSecret: Uint8Array | null;
  phantomPublicKey: Uint8Array | null;
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    publicKey: null,
    balance: 0,
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<PhantomSession | null>(null);
  const pendingSignResolve = useRef<((tx: Transaction) => void) | null>(null);
  const pendingSignReject = useRef<((err: Error) => void) | null>(null);

  // Generate dApp encryption keypair on mount
  useEffect(() => {
    sessionRef.current = {
      dappKeyPair: nacl.box.keyPair(),
      sharedSecret: null,
      phantomPublicKey: null,
    };
  }, []);

  // Listen for Phantom deep link callbacks
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      try {
        const url = new URL(event.url);
        const params = url.searchParams;

        // Handle connect callback
        if (url.pathname.includes('onConnect') || event.url.includes('onConnect')) {
          await handleConnectCallback(params);
        }

        // Handle signTransaction callback
        if (url.pathname.includes('onSignTransaction') || event.url.includes('onSignTransaction')) {
          await handleSignTransactionCallback(params);
        }

        // Handle disconnect callback
        if (url.pathname.includes('onDisconnect') || event.url.includes('onDisconnect')) {
          setWallet({ connected: false, publicKey: null, balance: 0 });
          await StorageService.saveWalletPublicKey('');
        }

        // Handle error callback
        if (params.get('errorCode')) {
          const errorMessage = decodeURIComponent(params.get('errorMessage') || 'Unknown Phantom error');
          setError(errorMessage);
          pendingSignReject.current?.(new Error(errorMessage));
          pendingSignReject.current = null;
          pendingSignResolve.current = null;
        }
      } catch (err) {
        if (__DEV__) console.warn('Deep link handling error:', err);
        setError(err instanceof Error ? err.message : 'Failed to process wallet callback');
      }
    };

    // Register deep link listener
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check for initial URL (app opened via deep link)
    Linking.getInitialURL()
      .then((url) => {
        if (url) handleDeepLink({ url });
      })
      .catch((err) => {
        if (__DEV__) console.warn('Get initial URL error:', err);
      });

    return () => {
      subscription.remove();
    };
  }, []);

  // Handle Phantom connect callback
  const handleConnectCallback = async (params: URLSearchParams) => {
    try {
      const phantomPubKeyBase58 = params.get('phantom_encryption_public_key');
      const nonceBase58 = params.get('nonce');
      const dataBase58 = params.get('data');

      if (!phantomPubKeyBase58 || !nonceBase58 || !dataBase58 || !sessionRef.current) {
        throw new Error('Invalid connect callback parameters');
      }

      const phantomPubKey = bs58.decode(phantomPubKeyBase58);
      const nonce = bs58.decode(nonceBase58);
      const encryptedData = bs58.decode(dataBase58);

      // Derive shared secret
      const sharedSecret = nacl.box.before(
        phantomPubKey,
        sessionRef.current.dappKeyPair.secretKey
      );

      // Decrypt the response data
      const decrypted = nacl.box.open.after(encryptedData, nonce, sharedSecret);
      if (!decrypted) {
        throw new Error('Failed to decrypt Phantom response');
      }

      const responseData = JSON.parse(new TextDecoder().decode(decrypted));
      if (!responseData?.public_key) {
        throw new Error('No public key in Phantom response');
      }
      const walletPublicKey = new PublicKey(responseData.public_key);

      // Store session data for future signing
      sessionRef.current.sharedSecret = sharedSecret;
      sessionRef.current.phantomPublicKey = phantomPubKey;

      // Save and update state
      await StorageService.saveWalletPublicKey(walletPublicKey.toBase58());

      const balance = await SolanaService.getWalletBalance(walletPublicKey);

      setWallet({
        connected: true,
        publicKey: walletPublicKey,
        balance,
      });

      setIsConnecting(false);
      setError(null);

      if (__DEV__) console.log('Phantom wallet connected:', walletPublicKey.toBase58());
    } catch (err) {
      if (__DEV__) console.warn('Connect callback error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnecting(false);
    }
  };

  // Handle Phantom signTransaction callback
  const handleSignTransactionCallback = async (params: URLSearchParams) => {
    try {
      const nonceBase58 = params.get('nonce');
      const dataBase58 = params.get('data');

      if (!nonceBase58 || !dataBase58 || !sessionRef.current?.sharedSecret) {
        throw new Error('Invalid sign transaction callback parameters');
      }

      const nonce = bs58.decode(nonceBase58);
      const encryptedData = bs58.decode(dataBase58);

      const decrypted = nacl.box.open.after(
        encryptedData,
        nonce,
        sessionRef.current.sharedSecret
      );

      if (!decrypted) {
        throw new Error('Failed to decrypt signed transaction');
      }

      const responseData = JSON.parse(new TextDecoder().decode(decrypted));
      const signedTx = Transaction.from(Buffer.from(responseData.transaction, 'base64'));

      // Resolve the pending sign promise
      pendingSignResolve.current?.(signedTx);
      pendingSignResolve.current = null;
      pendingSignReject.current = null;
      setIsSigning(false);

      if (__DEV__) console.log('Transaction signed by Phantom');
    } catch (err) {
      if (__DEV__) console.warn('Sign transaction callback error:', err);
      pendingSignReject.current?.(err instanceof Error ? err : new Error('Sign failed'));
      pendingSignResolve.current = null;
      pendingSignReject.current = null;
      setIsSigning(false);
    }
  };

  // Load wallet from storage on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const savedPublicKey = await StorageService.getWalletPublicKey();
        if (!isMounted) return;
        if (savedPublicKey && savedPublicKey.length > 10) {
          const pubkey = new PublicKey(savedPublicKey);
          setWallet({
            connected: true,
            publicKey: pubkey,
            balance: 0,
          });

          const balance = await SolanaService.getWalletBalance(pubkey);
          if (isMounted) {
            setWallet((prev) => ({ ...prev, balance }));
          }
        }
      } catch (err) {
        if (__DEV__) console.warn('Load wallet error:', err);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const connect = useCallback(
    async (params?: WalletConnectParams) => {
      try {
        setIsConnecting(true);
        setError(null);

        if (!sessionRef.current) {
          sessionRef.current = {
            dappKeyPair: nacl.box.keyPair(),
            sharedSecret: null,
            phantomPublicKey: null,
          };
        }

        const dappPubKeyBase58 = bs58.encode(sessionRef.current.dappKeyPair.publicKey);
        const deepLink = getPhantomDeepLink('connect', {
          dapp_encryption_public_key: dappPubKeyBase58,
        });

        const canOpen = await Linking.canOpenURL(deepLink);
        if (!canOpen) {
          // Phantom not installed — redirect to store
          const storeLink = 'https://phantom.app/download';
          await Linking.openURL(storeLink);
          setIsConnecting(false);
          setError('Phantom wallet not installed. Please install Phantom and try again.');
          params?.onError?.('Phantom wallet not installed');
          return;
        }

        await Linking.openURL(deepLink);

        // Connection result handled by deep link callback (handleConnectCallback)
        // onSuccess will be called there via state update
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to connect wallet';
        setError(message);
        setIsConnecting(false);
        params?.onError?.(message);
      }
    },
    []
  );

  const disconnect = useCallback(async () => {
    try {
      if (sessionRef.current?.sharedSecret) {
        // Send disconnect deep link to Phantom
        const deepLink = getPhantomDeepLink('disconnect');
        try {
          await Linking.openURL(deepLink);
        } catch {
          // Silently handle if Phantom can't be reached
        }
      }

      await StorageService.saveWalletPublicKey('');
      sessionRef.current = {
        dappKeyPair: nacl.box.keyPair(),
        sharedSecret: null,
        phantomPublicKey: null,
      };
      setWallet({
        connected: false,
        publicKey: null,
        balance: 0,
      });
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect';
      setError(message);
    }
  }, []);

  const signTransaction = useCallback(
    async (transaction: Transaction): Promise<Transaction> => {
      if (!wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      if (!sessionRef.current?.sharedSecret) {
        // Session expired — attempt to sign via Phantom deep link without encryption
        // This happens when user reconnects from saved pubkey without re-establishing session
        throw new Error('Wallet session expired. Please disconnect and reconnect your wallet.');
      }

      // Prevent concurrent signing — reject if already in progress
      if (pendingSignResolve.current) {
        throw new Error('A transaction is already being signed. Please wait.');
      }

      setIsSigning(true);

      // Serialize the transaction for Phantom
      const serializedTx = transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString('base64');

      // Encrypt the payload
      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      const payload = JSON.stringify({ transaction: serializedTx });
      const encrypted = nacl.box.after(
        new TextEncoder().encode(payload),
        nonce,
        sessionRef.current.sharedSecret
      );

      const deepLink = getPhantomDeepLink('signTransaction', {
        nonce: bs58.encode(nonce),
        payload: bs58.encode(encrypted),
      });

      // Create a promise that will be resolved by the deep link callback
      const signedTxPromise = new Promise<Transaction>((resolve, reject) => {
        pendingSignResolve.current = resolve;
        pendingSignReject.current = reject;

        // Timeout after configured duration
        setTimeout(() => {
          if (pendingSignResolve.current === resolve) {
            pendingSignResolve.current = null;
            pendingSignReject.current = null;
            setIsSigning(false);
            reject(new Error('Transaction signing timed out. Please try again.'));
          }
        }, PHANTOM_CONFIG.signTimeoutMs);
      });

      await Linking.openURL(deepLink);

      return signedTxPromise;
    },
    [wallet.publicKey]
  );

  const refreshBalance = useCallback(async () => {
    try {
      if (!wallet.publicKey) return;

      const balance = await SolanaService.getWalletBalance(wallet.publicKey);
      setWallet((prev) => ({ ...prev, balance }));
    } catch (err) {
      if (__DEV__) console.warn('Refresh balance error:', err);
    }
  }, [wallet.publicKey]);

  return {
    wallet,
    isConnecting,
    isSigning,
    error,
    connect,
    disconnect,
    signTransaction,
    refreshBalance,
    isConnected: wallet.connected,
    publicKey: wallet.publicKey,
  };
}

function getPhantomDeepLink(method: string, params: Record<string, any> = {}): string {
  const redirectScheme = PHANTOM_CONFIG.appScheme;
  const redirectMap: Record<string, string> = {
    connect: `${redirectScheme}://onConnect`,
    disconnect: `${redirectScheme}://onDisconnect`,
    signTransaction: `${redirectScheme}://onSignTransaction`,
    signAndSendTransaction: `${redirectScheme}://onSignAndSendTransaction`,
  };

  const redirectUrl = redirectMap[method] || `${redirectScheme}://callback`;
  const appUrl = `${redirectScheme}://`;

  const fullParams: Record<string, string> = {
    app_url: appUrl,
    redirect_link: redirectUrl,
    cluster: process.env.EXPO_PUBLIC_SOLANA_CLUSTER || SOLANA_CONFIG.cluster,
    ...params,
  };

  const queryString = Object.entries(fullParams)
    .filter(([_, value]) => value !== '' && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `https://phantom.app/ul/v1/${method}?${queryString}`;
}
