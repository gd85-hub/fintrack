// Jest manual mock for AsyncStorage. The native module is absent under jest,
// so re-export the official in-memory mock shipped with the package. Applied
// automatically for this node_modules package (root __mocks__ convention).
module.exports = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
