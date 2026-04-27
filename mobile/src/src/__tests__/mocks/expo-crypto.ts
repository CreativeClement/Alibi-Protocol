export const digestStringAsync = jest.fn().mockResolvedValue(
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
);

export const getRandomValues = jest.fn((arr: Uint8Array) => {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
});

export const CryptoDigestAlgorithm = {
  SHA256: 'SHA-256',
};

export const CryptoEncoding = {
  HEX: 'hex',
  BASE64: 'base64',
};

export default {
  digestStringAsync,
  getRandomValues,
  CryptoDigestAlgorithm,
  CryptoEncoding,
};
