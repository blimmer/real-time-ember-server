const _ = require('lodash');

const {
  PROTOCOL_VERSION,
  FRAME_TYPES,
  EVENTS,
} = require('./utils/protocol-constants');

const SocketUtils = require('./utils/rt-ember-socket');
const setupGiphyIntegration = require('./initializers/setup-giphy-integration');
const serializeGifs = require('./serializers/gif');

setupGiphyIntegration.then(function(gifDb) {
  var WebSocketServer = require('ws').Server,
      wss = new WebSocketServer({
        port: process.env.PORT || 5000,
        handleProtocols: function(protocol, cb) {
          var supportedProtocol = protocol[protocol.indexOf(PROTOCOL_VERSION)];
          if(supportedProtocol) { cb(true, supportedProtocol); return; }
          cb(false);
        },
      });

  function sendInitialGifs(ws) {
    const gifs = gifDb;
    const shared = _.find(gifs, 'shared');
    const random = _.sampleSize(gifs, 25);
    const payload = random.concat(shared);

    SocketUtils.sendDataToClient(ws, serializeGifs(payload));
  }

  wss.on('connection', function(ws) {
    sendInitialGifs(ws);

    ws.on('message', function(rawData) {
      try {
        const data = JSON.parse(rawData);

        if (data.frameType === FRAME_TYPES.EVENT) {
          switch (data.payload.eventType) {
            case EVENTS.SHARE_GIF:
              const newShare = _.find(gifDb, { id: data.payload.eventInfo });
              if (!newShare) { throw Error('tried to share unknown gif'); }

              const previouslyShared = _.find(gifDb, 'shared');
              if (newShare === previouslyShared) { return; }

              newShare.shared = true;
              previouslyShared.shared = false;

              SocketUtils.broadcastData(wss, serializeGifs([previouslyShared, newShare]));
              break;
          }
        }
      } catch(e) {
        console.log(`Didn't understand message from socket. ${rawData}`);
        ws.close(1003); // unsupported data
      }
    });
  });
});
