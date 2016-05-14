const {
  FRAME_TYPES,
} = require('./protocol-constants');

function createFrame(type, payload) {
  return {
    frameType: type,
    payload,
  };
}

function sendFrameToClient(ws, type, payload) {
  const framePayload = createFrame(type, payload);
  ws.send(JSON.stringify(framePayload));
}

function broadcastFrameToClients(wss, type, payload) {
  const framePayload = createFrame(type, payload);
  const rawPayload = JSON.stringify(framePayload);
  wss.clients.forEach((client) => {
    client.send(rawPayload);
  });
}

function sendDataToClient(ws, dataPayload) {
  sendFrameToClient(
    ws,
    FRAME_TYPES.DATA,
    dataPayload
  );
}

function broadcastData(wss, dataPayload) {
  wss.clients.forEach((ws) => {
    sendDataToClient(ws, dataPayload);
  });
}

module.exports = {
  sendFrameToClient,
  broadcastFrameToClients,
  sendDataToClient,
  broadcastData,
};
