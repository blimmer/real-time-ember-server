require('dotenv').config();

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const ProtocolConstants = require('./utils/protocol-constants');
const GifSerializer = require('./serializers/gif');

const PROTOCOL_VERSION = ProtocolConstants.PROTOCOL_VERSION;
const FRAME_TYPES = ProtocolConstants.FRAME_TYPES;
const EVENTS = ProtocolConstants.EVENTS;

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

const giphy = require('giphy-api')(),
      memoize = require('memoizee');

function _getGifs() {
  const opts = {
    limit: 25,
    rating: 'pg-13',
  };

  return giphy.trending(opts).then(function(gifs) {
    const flattenedGifs = [];
    gifs.data.forEach(function(gif) {
      flattenedGifs.push({
        id: gif.id,
        url: gif.images.original.url,
      });
    });

    return GifSerializer.serialize(flattenedGifs);
  }, function() {
    // ¯\_(ツ)_/¯ - API Limit
    return [];
  });
}
const getGifs = memoize(_getGifs, { maxAge: 20000, async: true }); // 2 minutes

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
  getGifs().then(function(gifPayload) {
    sendFrameToClient(FRAME_TYPES.DATA, gifPayload, ws);
  });
});

wss.broadcast = function broadcast(data) {
  wss.clients.forEach((client) => {
    client.send(data);
  });
};

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
