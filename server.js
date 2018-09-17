const game = require('./client/game.js');

var Server = function () {

    this.game = new game.Game();
    this.game.requestPlayerInput = () => {this.applyPlayerInput()};
    this.game.playerDied = (id) => {this.playerDied(id)};
    this.game.endStep = () => {this.afterStep()};
    this.game.start();
    this.alive = true;
    this.numPlayers = 0;
    this.players = {};
}

Server.prototype.playerJoined = function(socket) {
    this.numPlayers++;
    let id = this.game.getNextID();
    let myPlayer = createPlayer(socket);
    this.players[id] = myPlayer;
    socket.on('spawn', () => {
        if (!myPlayer.alive) {
            for (let i in myPlayer.inputMap) {
                myPlayer.inputMap[i] = 0;
            }
            this.game.addPlayer(id);
            myPlayer.alive = true;
        }
    });
    socket.on('disconnect', () => {
        this.numPlayers--;
        delete this.players[id];
        this.game.killObject(id);
        if (this.numPlayers === 0) this.kill();
    });
    socket.on('input', (data) => {
        myPlayer.inputMap[data[0]] = data[1];
    });
    socket.on('flag', () => {
        console.log(id + ': ---------FLAG--------');
    });
    socket.emit('join', { id: id, update: this.game.getSendable() });
}

Server.prototype.playerDied = function(id) {
    this.players[id].socket.emit('rip');
    this.players[id].alive = false;
}

Server.prototype.applyPlayerInput = function() {
    for (let i in this.players) {
        let player = this.players[i];
        if (player.alive)
            this.game.applyPlayerInput(i, player.inputMap);
    }
}

Server.prototype.afterStep = function() {
    let data = this.game.getSendable();
    this.sendToAll('update', data);
}

Server.prototype.kill = function() {
    this.alive = false;
    this.game.kill();
}

Server.prototype.sendToAll = function(message, data) {
    for (let i in this.players) {
        let player = this.players[i];
        player.socket.emit(message, data);
    }
}

function createPlayer(socket) {
    let player = {};
    player.socket = socket;
    player.alive = false;
    player.inputMap = { 'up': 0, 'down': 0, 'left': 0, 'right': 0, 'shoot': 0 };
    return player;
}

exports.Server = Server;