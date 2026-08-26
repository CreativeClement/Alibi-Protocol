export const requestForegroundPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
export const getCurrentPositionAsync = jest.fn();
export const watchPositionAsync = jest.fn();
export const reverseGeocodeAsync = jest.fn();

export const Accuracy = {
  High: 6,
  Balanced: 3,
  Low: 1,
};

export default {
  requestForegroundPermissionsAsync,
  getCurrentPositionAsync,
  watchPositionAsync,
  reverseGeocodeAsync,
  Accuracy,
};
