export const documentDirectory = '/mock/documents/';

export const makeDirectoryAsync = jest.fn();
export const moveAsync = jest.fn();
export const copyAsync = jest.fn();
export const deleteAsync = jest.fn();
export const getInfoAsync = jest.fn().mockResolvedValue({ exists: true, size: 1024 });
export const readAsStringAsync = jest.fn().mockResolvedValue('bW9ja19iYXNlNjRfY29udGVudA==');

export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
};

export default {
  documentDirectory,
  makeDirectoryAsync,
  moveAsync,
  copyAsync,
  deleteAsync,
  getInfoAsync,
  readAsStringAsync,
  EncodingType,
};
