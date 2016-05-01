const {
  PROTOCOL_VERSION,
  FRAME_TYPES,
  EVENTS,
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

function sendEventToClient(ws, eventType, eventInfo) {
  sendFrameToClient(
    ws,
    FRAME_TYPES.EVENT,
    {
      eventType,
      eventInfo,
    }
  );
}

function broadcastEvent(wss, eventType, eventInfo) {
  wss.clients.forEach((ws) => {
    sendEventToClient(ws, eventType, eventInfo);
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
  sendEventToClient,
  broadcastEvent,
  sendDataToClient,
  broadcastData,
};
