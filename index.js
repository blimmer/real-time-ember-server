require('dotenv').config();

const express = require('express'),
      app = express(),
      _ = require('lodash'),
      bodyParser = require('body-parser');

const {
  PROTOCOL_VERSION,
  FRAME_TYPES,
  EVENTS,
} = require('./utils/protocol-constants');

const SocketUtils = require('./utils/rt-ember-socket');
const setupGiphyIntegration = require('./initializers/setup-giphy-integration');
const serializeGifs = require('./serializers/gif');

setupGiphyIntegration.then(function(gifDb) {
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
      SocketUtils.broadcastEvent(wss, EVENTS.CLIENT_UPGRADE);
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
      try {
        const data = JSON.parse(rawData);

        if (data.frameType === FRAME_TYPES.EVENT) {
          switch (data.payload.eventType) {
            case EVENTS.SHARE_GIF:
              const newShare = _.find(gifDb, { id: data.payload.eventInfo });
              if (!newShare) { throw Error('tried to share unknown gif'); }

              const previouslyShared = _.find(gifDb, 'shared');

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

  function sendInitialGifs(ws) {
    const gifs = gifDb;
    const shared = _.find(gifs, 'shared');
    const random = _.sampleSize(gifs, 25);
    const payload = random.concat(shared);

    SocketUtils.sendDataToClient(ws, serializeGifs(payload));
  }
});
