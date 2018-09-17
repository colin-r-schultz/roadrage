var server = false;
if (typeof planck == 'undefined') {
    var planck = require('planck-js');
    server = true;
} else {
    var exports = {};
}

var Vec2 = planck.Vec2;

var stepTime = 1 / 60;
var stepTimeMS = stepTime * 1000;

var Game = function() {
    this.running = false;
    this.objectId = 1;
    this.objects = {};
    this.killList = new Set();
    this.requestPlayerInput = function(){};
    this.playerDied = function(id){};
    this.endStep = function(){};
    this.world = new planck.World();
}

Game.prototype.start = function() {
    this.running = true;
    this.setupWorld();
    setTimeout(() => {this.step()}, 0);
}

Game.prototype.setupWorld = function() {
    if (server) {
        this.world.on('pre-solve', (a, b) => {this.onCollision(a, b)});
    }
    let def = {
        type: planck.Body.STATIC,
        userData: -1
    };
    let body = this.world.createBody(def, 0);
    let shape = new planck.Chain([Vec2(), Vec2(100, 0), Vec2(100, 50), Vec2(0, 50)], true);
    body.createFixture(shape, {restitution: 0});
}

Game.prototype.step = function() {
    let start = Date.now();
    this.requestPlayerInput();
    this.physicsStep();
    this.killStuff();
    this.endStep();
    if (this.running) {
        setTimeout(() => {this.step()}, stepTimeMS + start - Date.now());
    }
}

Game.prototype.physicsStep = function() {
    this.world.step(stepTime);
}

Game.prototype.killStuff = function() {
    for (let i of this.killList) {
        let object = this.objects[i];
        if (object.player) {
            this.playerDied(i);
        }
        this.killObject(i);
    }
    this.killList.clear();
}

Game.prototype.onCollision = function(contact, oldManifold) {
    let manifold = contact.getWorldManifold();
    let bodyA = contact.getFixtureA().getBody();
    let bodyB = contact.getFixtureB().getBody();
    let max = 0;
    let index = -1;
    for (let i = 0; i < manifold.points.length; i++) {
        let p = manifold.points[i];
        let momentumA = bodyA.getLinearVelocityFromWorldPoint(p).mul(bodyA.getMass());
        let momentumB = bodyB.getLinearVelocityFromWorldPoint(p).mul(bodyB.getMass());
        let collide = Vec2.dot(Vec2.sub(momentumA, momentumB), manifold.normal);
        if (collide > max) {
            max = collide;
            index = i;
        }
    }
    if (index === -1) return;
    let maxP = manifold.points[index];
    let sep = manifold.separations[index];
    let normal = Vec2.clone(manifold.normal).mul(-sep / 2);
    let aImmune = this.isImmune(bodyA, maxP, normal);
    let bImmune = this.isImmune(bodyB, maxP, normal.mul(-1));
    if (aImmune === bImmune) {
        this.dealDamage(bodyA.getUserData(), max);
        this.dealDamage(bodyB.getUserData(), max);
    } else {
        if (aImmune) {
            this.dealDamage(bodyB.getUserData(), max);
        } else if (bImmune) {
            this.dealDamage(bodyA.getUserData(), max);
        }
    }
}

Game.prototype.isImmune = function(body, point, normal) {
    let id = body.getUserData();
    if (id === -1) return true;
    let object = this.objects[id];
    if (object.type == 'car') {
        let localX = body.getLocalPoint(point).x + body.getLocalVector(normal).x;
        if (localX > modelMap[object.model].physics.frontThreshold)
            return true;
    }
    return false;
}

Game.prototype.dealDamage = function(id, damage) {
    if (id === -1) return;
    let object = this.objects[id];
    if (!object.health) return;
    if (object.damageThreshold && damage < object.damageThreshold) return;
    object.health -= damage;
    if (object.health <= 0) {
        this.killList.add(id);
    }
}

Game.prototype.addPlayer = function(id) {
    let object = this.createObject(id, 'car/basic', 50, 25);
    object.player = true;
}

Game.prototype.killObject = function(id) {
    let object = this.objects[id];
    if (!object) return;
    if (object.physics) {
        this.world.destroyBody(object.physics);
    }
    delete this.objects[id];
}

Game.prototype.applyPlayerInput = function(id, input) {
    if (this.objects[id])
        this.driveCar(id, input);
}

Game.prototype.driveCar = function(id, input) {
    let object = this.objects[id];
    let model = modelMap[object.model];
    if (model.driving.tank) {
        this.driveTank(id, input);
    } else {
        this.driveNormal(id, input);
    }
}

//TODO
Game.prototype.driveTank = function(id, input) {
}

Game.prototype.driveNormal = function(id, input) {
    let object = this.objects[id];
    let driving = modelMap[object.model].driving;
    let body = object.physics;
    let p = body.getWorldCenter();
    let v = body.getWorldVector(Vec2(1, 0));
    let velocity = body.getLinearVelocity();
    let speed = velocity.length();
    let forward = Math.sign(body.getLocalVector(velocity).x);
    if (input.up) {
        body.applyForce(v.mul(driving.force), p, true);
    }
    if (input.down) {
        body.applyForce(v.mul(-1 * driving.force), p, true);
    }
    v = body.getWorldVector(Vec2(1, 0));
    body.applyForce(v.mul(-1 * forward * speed * driving.friction), p, true);
    let targetAngvel = 0;
    if (input.right && !input.left) {
        targetAngvel = driving.turn * speed * forward;
    } else if (input.left && !input.right) {
        targetAngvel = -1 * driving.turn * speed * forward;
    }
    let dif = targetAngvel - body.getAngularVelocity();
    if (Math.abs(dif) < driving.maxDriftTorque * body.m_invI * stepTime) {
        body.setAngularVelocity(targetAngvel);
    } else {
        body.applyTorque(Math.sign(dif) * driving.maxDriftTorque);
    }
    let right = body.getWorldVector(Vec2(0, 1));
    let rightSpeed = Vec2.dot(right, velocity);
    if (Math.abs(rightSpeed) < driving.maxDriftForce * body.m_invMass * stepTime) {
        body.getLinearVelocity().sub(right.mul(rightSpeed));
    } else {
        body.applyForce(right.mul(-1 * driving.maxDriftForce * Math.sign(rightSpeed)), p, true);
    }
}

Game.prototype.kill = function() {
    this.running = false;
}

Game.prototype.getSendable = function() {
    let send = {};
    for (let i in this.objects) {
        let object = this.objects[i];
        if (object.physics || object.sendable) {
            send[i] = {};
            let o = send[i];
            o.type = object.type;
            if (object.physics) {
                o.physics = getSendableFromBody(object.physics);
            }
            def = defMap[object.type];
            for (let prop in object) {
                if (def.sendable.includes(prop)) {
                    o[prop] = object[prop];
                }
            }
        }
    }
    return send;
}

Game.prototype.updateFromData = function(data) {
    let set = new Set(Object.keys(this.objects));
    for (let i in data) {
        set.delete(i);
        let o = data[i];
        if (!(i in this.objects)) {
            let x = 0;
            let y = 0;
            if (o.physics) {
                x = o.physics.x;
                y = o.physics.y;
            } else if (o.position) {
                x = o.position.x;
                y = o.position.y;
            }
            let type = o.type;
            if (o.model) {
                type = o.type + '/' + o.model;
            }
            this.createObject(i, type, x, y);
        }
        let object = this.objects[i];
        for (let prop in o) {
            if (prop != 'physics')
                object[prop] = o[prop];
        }
        if (object.physics) {
            updateBodyFromData(object.physics, o.physics);
        }
    }
    for (let i of set) {
        this.killObject(i);
    }
}

Game.prototype.getNextID = function() {
    let id = this.objectId;
    this.objectId++;
    return id;
}

Game.prototype.createObject = function(id, type, x, y) {
    let object = {};
    let model = null;
    if (type.startsWith('car')) {
        model = type.substring(4);
        type = 'car';
    }
    object.type = type;
    let def = defMap[type];
    if (def.physics) {
        let physDef = def.physics;
        if (model) {
            physDef = modelMap[model].physics;
        }
        let body = this.createBodyFromDef(physDef, x, y, 0);
        body.setUserData(id);
        object.physics = body;
    }
    for (let prop in def.other) {
        if (server || def.sendable.includes(prop)) {
            object[prop] = def.other[prop];
        }
    }
    if (model) {
        object.model = model;
        if (modelMap[model].gun) {
            object.gun = Object.assign({}, modelMap[model].gun);
        }
        object.health  = modelMap[model].health;
    }
    this.objects[id] = object;
    return object;
}

Game.prototype.updateCarModel = function(id, model) {
    let object = this.objects[id];
    let body = object.physics;
    let data = getSendableFromBody(body);
    this.world.destroyBody(body);
    let def = modelMap[model];
    body = this.createBodyFromDef(def.physics, data.x, data.y, data.angle);
    body.setUserData(id);
    object.physics = body;
    updateBodyFromData(body, data);
    if (def.gun) {
        object.gun = Object.assign({}, def.gun);
    }
    object.health = def.health;
    object.model = model;
}

Game.prototype.createBodyFromDef = function(def, x, y, angle) {
    let bodyDef = def.bodyDef;
    bodyDef.position = Vec2(x, y);
    let body = this.world.createBody(bodyDef, angle);
    body.createFixture(def.fixture.shape, def.fixture.fixtureDef);
    return body;
}

function getSendableFromBody(body) {
    let o = {};
    pos = body.getPosition();
    o.x = pos.x;
    o.y = pos.y;
    rot = body.getAngle();
    o.angle = rot;
    vel = body.getLinearVelocity();
    o.xVel = vel.x;
    o.yVel = vel.y;
    angVel = body.getAngularVelocity();
    o.angVel = angVel;
    return o;
}

function updateBodyFromData(body, o) {
    body.setPosition(Vec2(o.x, o.y));
    body.setAngle(o.angle);
    body.setLinearVelocity(Vec2(o.xVel, o.yVel));
    body.setAngularVelocity(o.angVel);
}

var defMap = {
    'car': {
        physics: true,
        model: 'basic',
        other: {
            player: false,
            gun: null,
            health: 100,
            damageThreshold: 20
        },
        sendable: ['model', 'gun']
    }
};

var modelMap = {
    basic: {
        physics: {
            bodyDef: {
                type: planck.Body.DYNAMIC,
                linearDamping: 0,
                angularDamping: 0
            },
            fixture: {
                fixtureDef: {
                    density: 1,
                    restitution: 0.0
                },
                shape: new planck.Polygon([Vec2(-1.6, -0.8), Vec2(1.2, -0.8), Vec2(1.6, -0.4), Vec2(1.6, 0.4), Vec2(1.2, 0.8), Vec2(-1.6, 0.8)])
            },
            frontThreshold: 1.2
        },
        driving: {
            force: 300,
            turn:  0.2,
            maxDriftForce: 200,
            maxDriftTorque: 200,
            friction: 10.0
        },
        health: 200
    }
};

exports.Game = Game;
