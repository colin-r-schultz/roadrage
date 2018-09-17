const http = require('http');
const app = require('express')();
const httpserver = http.createServer(app);
const io = require('socket.io')(httpserver);
const server = require('./server.js');

const hostname = '192.168.1.69'; //'127.0.0.1';
const port = 3000;

var currentServer = null;

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/planck.js', (req, res) => {
    res.sendFile(__dirname + '/node_modules/planck-js/dist/planck.min.js');
});

app.get('/client/*', (req, res) => {
    res.sendFile(__dirname + '/client/' + req.params[0]);
});

httpserver.listen(port, hostname, () => {
    console.log('Server listening on '+hostname+':'+port);
});

io.on('connection', (socket) => {
    if (!(currentServer && currentServer.alive)) {
        currentServer = new server.Server();
    }
    currentServer.playerJoined(socket);
});

