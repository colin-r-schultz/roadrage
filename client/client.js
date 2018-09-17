var socket = io();

var inputMap = {
    'up': 0,
    'down': 0,
    'left': 0,
    'right': 0,
    'shoot': 0
};

var keyMap = {
    87: 'up',
    65: 'left',
    83: 'down',
    68: 'right',
    32: 'shoot',
    13: 'respawn',
    70: 'flag'
};

window.addEventListener('keydown', (e) => {
    let key = keyMap[e.keyCode];
    if (key in inputMap) {
        if (!inputMap[key]) {
            socket.emit('input', [key, 1]);
            inputMap[key] = 1;
        }
    }
    if (key == 'respawn' && !alive) {
        spawn();
    }
    if (key == 'flag') {
        socket.emit('flag');
    }

});

window.addEventListener('keyup', (e) => {
    let key = keyMap[e.keyCode];
    if (key in inputMap) {
        if (inputMap[key]) {
            socket.emit('input', [key, 0]);
            inputMap[key] = 0;
        }
    }
});

var objId = 0;
var alive = false;
var game;

socket.on('join', (data) => {
    objId = data.id;
    game = new Game();
    game.requestPlayerInput = applyPlayerInput;
    game.endStep = afterStep;
    game.updateFromData(data.update);
    game.start();
});

socket.on('rip', () => {
    alive = false;
});

function spawn() {
    for (let i in inputMap) {
        inputMap[i] = 0;
        socket.emit('spawn');
        alive = true;
    }
}

function applyPlayerInput() {
    if (alive)
        game.applyPlayerInput(objId, inputMap);
}

function afterStep() {
    draw();
}

socket.on('update', (data) => {
    game.updateFromData(data);
});