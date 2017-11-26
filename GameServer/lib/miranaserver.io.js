var MiranaServerGame = require('./miranaservergame');

/*
options = {
    stateInterval: 45,
    logging: true,
    clientSidePrediction: true,
    interpolation: true,
    interpolationDelay: 100,
    smoothingFactor: 0.3,
    pingInterval: 2000,
    maxUpdateBuffer: 120,
    maxHistorySecondBuffer: 1000,
    worldState: {},
    onPlayerConnect(callback(socket)),
    onPlayerInput(callback(socket, input)),
    onPlayerDisconnect(callback(socket)),
    onPing(callback(socket, data)),
    onEvent(callback(data))
}
api methods
    createGarageServer(io, options)
    start()
    stop()
    getPlayers() : [,{ id, state, [,inputs], [,{ states, executionTimes }] }]
    getEntities() :[,{ id, state, [,{ state, executionTime }] }]
    updatePlayerState(id, state)
    updateEntityState(id, state)
    addEntity(id)
    removeEntity(id)
    sendPlayerEvent(id, data)
    sendPlayersEvent(data)
*/
function MiranaServer(socketio, options) {
    var namespace = '/miranaserver.io';

    this.socketPath = namespace;
    this.io = socketio;
    this.clientSidePrediction = options.clientSidePrediction;
    this.registerSocketEvents(options);
    this.game = new MiranaGameServer(options, function (state, region) {
        if (!region) {
            socketio.of(namespace).emit('u', state);
        } else {
            socketio.of(namespace).in(region).emit('u', state);
        }
    });
}

MiranaServer.prototype.registerSocketEvents = function (options) {
    var self = this;

    self.io.of(self.socketPath).on('connection', function (socket) {
        if (options.logging) {
            console.log('miranaserver.io:: socket ' + socket.client.id + ' connection');
        }
        socket.emit('s', {
            physicsDelta: (options.physicsInterval ? options.physicsInterval : 15) / 1000,
            smoothingFactor: options.smoothingFactor ? options.smoothingFactor : 0.3,
            interpolation: options.interpolation ? options.interpolation : false,
            interpolationDelay: options.interpolationDelay ? options.interpolationDelay : 100,
            pingInterval: options.pingInterval ? options.pingInterval : 2000,
            clientSidePrediction: options.clientSidePrediction ? options.clientSidePrediction : false,
            maxUpdateBuffer: options.maxUpdateBuffer ? options.maxUpdateBuffer : 120,
            worldState: options.worldState ? options.worldState : {}
        });
        self.onPlayerConnect(socket, options);

        socket.on('disconnect', function () {
            if (options.logging) {
                console.log('miranaserver.io:: socket ' + socket.client.id + ' disconnect');
            }
            self.onPlayerDisconnect(socket, options);
        });

        socket.on('i', function (data) {
            if (options.logging) {
                console.log('miranaserver.io:: socket input ' + socket.client.id + ' ' + data[0] + ' ' + data[1]);
            }
            self.onPlayerInput(socket, data, options);
        });

        socket.on('p', function (data) {
            if (options.logging) {
                console.log('miranaserver.io:: socket ping ' + data);
            }
            self.onPing(socket, data, options);
        });

        socket.on('e', function (data) {
            if (options.logging) {
                console.log('miranaserver.io:: event ' + data);
            }
            if (options.onEvent) {
                options.onEvent(data);
            }
        });
    });
};

MiranaServer.prototype.onPlayerConnect = function (socket, options) {
    this.game.addPlayer(socket);
    if (options.onPlayerConnect) {
        options.onPlayerConnect(socket);
    }
};

MiranaServer.prototype.onPlayerDisconnect = function (socket, options) {
    this.game.removePlayer(socket.client.id);
    socket.broadcast.emit('rp', socket.client.id);
    if (options.onPlayerDisconnect) {
        options.onPlayerDisconnect(socket);
    }
};

MiranaServer.prototype.onPlayerInput = function (socket, input, options) {
    this.game.addPlayerInput(socket.client.id, input[0], input[1], input[2]);
    if (options.onPlayerInput) {
        options.onPlayerInput(socket, input);
    }
};

MiranaServer.prototype.onPing = function (socket, data, options) {
    socket.emit('p', data);
    if (options.onPing) {
        options.onPing(socket, data);
    }
};

MiranaServer.prototype.start = function () {
    this.game.start();
};

MiranaServer.prototype.stop = function () {
    this.game.stop();
};

MiranaServer.prototype.getPlayers = function () {
    return this.game.getPlayers();
};

MiranaServer.prototype.getEntities = function () {
    return this.game.getEntities();
};

MiranaServer.prototype.updatePlayerState = function (id, state) {
    this.game.updatePlayerState(id, state);
};

MiranaServer.prototype.updateEntityState = function (id, state) {
    this.game.updateEntityState(id, state);
};

MiranaServer.prototype.addEntity = function (id, referrerId) {
    this.game.addEntity(id, referrerId);
};

MiranaServer.prototype.removeEntity = function (id) {
    if (this.clientSidePrediction) {
        var entity = this.game.getEntity(id);
        this.io.of(this.socketPath).emit('re', { id: entity.referrerId, seq: entity.referrerSeq });
    }
    else {
        this.io.of(this.socketPath).emit('re', { id: id });
    }
    this.game.removeEntity(id);
};

MiranaServer.prototype.sendPlayerEvent = function (id, data) {
    this.game.sendPlayerEvent(id, data);
};

MiranaServer.prototype.sendPlayersEvent = function (data) {
    this.io.of(this.socketPath).emit('e', data);
};

MiranaServer.prototype.setPlayerRegion = function (id, region) {
    this.game.setPlayerRegion(id, region);
};

MiranaServer.prototype.setEntityRegion = function (id, region) {
    this.game.setEntityRegion(id, region);
};

MiranaServer.prototype.clearRegions = function () {
    this.game.clearRegions();
};

exports.createMiranaServer = function (io, options) {
    return new MiranaServer(io, options);
};