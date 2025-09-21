// Socket.io removed for serverless compatibility. Provide no-op stubs.
module.exports = {
  initialize: () => {},
  getConnectionInfo: () => ({ enabled: false, connections: [] })
};