require('dotenv').config();

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const ProtocolConstants = require('./utils/protocol-constants');

const {
  PROTOCOL_VERSION,
  FRAME_TYPES,
  EVENTS,
} = ProtocolConstants;

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
    sendFrameToClients(FRAME_TYPES.EVENT, EVENTS.CLIENT_UPGRADE);
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

wss.broadcast = function broadcast(data) {
  wss.clients.forEach((client) => {
    client.send(data);
  });
};

function sendFrameToClients(type, payload) {
  const framePayload = {
    frameType: type,
    payload,
  };

  wss.broadcast(JSON.stringify(framePayload));
}
