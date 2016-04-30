require('dotenv').config();

const express = require('express');
const app = express();
const _ = require('lodash');

const bodyParser = require('body-parser');
const ProtocolConstants = require('./utils/protocol-constants');
const GifSerializer = require('./serializers/gif');

const PROTOCOL_VERSION = ProtocolConstants.PROTOCOL_VERSION;
const FRAME_TYPES = ProtocolConstants.FRAME_TYPES;
const EVENTS = ProtocolConstants.EVENTS;

const setupGiphyIntegration = require('./initializers/setup-giphy-integration');

setupGiphyIntegration.then(function() {
  app.set('port', (process.env.PORT || 5000));
  app.use(bodyParser.json());
  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

  app.post('/api/v1/notify-upgrade', function(req, res) {
    const token = req.body.token;

    if (token !== process.env.UPGRADE_NOTIFY_TOKEN) {
      res.sendStatus(401);
    } else {
      broadcastFrameToClients(FRAME_TYPES.EVENT, EVENTS.CLIENT_UPGRADE);
      res.sendStatus(201);
    }
  });

  const server = app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
  });

  var WebSocketServer = require('ws').Server,
      wss = new WebSocketServer({
        server,
        handleProtocols: function(protocol, cb) {
          var supportedProtocol = protocol[protocol.indexOf(PROTOCOL_VERSION)];
          if(supportedProtocol) { cb(true, supportedProtocol); return; }
          cb(false);
        },
      });

  wss.on('connection', function(ws) {
    sendInitialGifs(ws);

    ws.on('message', function(rawData) {
      const data = JSON.parse(rawData);

      if (data.frameType === FRAME_TYPES.EVENT) {
        switch (data.payload.eventType) {
          case EVENTS.SHARE_GIF:
            const previouslyShared = _.findIndex(global.gifDb, 'shared');
            if (previouslyShared >= 0) {
              global.gifDb[previouslyShared].shared = false;
            }

            const newShare = _.findIndex(global.gifDb, { id: data.payload.eventInfo });
            global.gifDb[newShare].shared = true;

            const dataForUpdate = _.compact([global.gifDb[previouslyShared], global.gifDb[newShare]]);

            broadcastFrameToClients(FRAME_TYPES.DATA, GifSerializer.serialize(dataForUpdate));

            break;
        }
      }
    });
  });

  wss.broadcast = function broadcast(data) {
    wss.clients.forEach((client) => {
      client.send(data);
    });
  };

  function sendInitialGifs(ws) {
    const gifs = global.gifDb;
    const shared = _.find(gifs, 'shared');
    const random = _.sampleSize(gifs, 25);
    const payload = random.concat(shared);

    sendFrameToClient(FRAME_TYPES.DATA, GifSerializer.serialize(payload), ws);
  }

  function createFrame(type, payload) {
    return {
      frameType: type,
      payload,
    };
  }

  function sendFrameToClient(type, payload, ws) {
    const framePayload = createFrame(type, payload);
    ws.send(JSON.stringify(framePayload));
  }

  function broadcastFrameToClients(type, payload) {
    const framePayload = createFrame(type, payload);
    wss.broadcast(JSON.stringify(framePayload));
  }
});
