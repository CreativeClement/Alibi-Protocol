const store: Record<string, string> = {};

export const getItemAsync = jest.fn((key: string) => Promise.resolve(store[key] || null));
export const setItemAsync = jest.fn((key: string, value: string, _options?: any) => {
  store[key] = value;
  return Promise.resolve();
});
export const deleteItemAsync = jest.fn((key: string) => {
  delete store[key];
  return Promise.resolve();
});

export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;

/** Reset the internal mock store — call in beforeEach */
export function __resetStore() {
  Object.keys(store).forEach((k) => delete store[k]);
}

export default {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  __resetStore,
};
