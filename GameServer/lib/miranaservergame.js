var playerController = require('./controllers/playercontroller'),
    entityController = require('./controllers/entitycontroller');

exports = module.exports = MiranaServerGame;

function MiranaServerGame(options, broadcastCallback) {
    this.options = options;
    this.startTime = 0;
    this.stateInterval = options.stateInterval ? options.stateInterval : 45;
    this.stateIntervalId = 0;
    this.playerController = new playerController(this.options.maxHistorySecondBuffer ? this.options.maxHistorySecondBuffer : 1000);
    this.entityController = new entityController(this.options.maxHistorySecondBuffer ? this.options.maxHistorySecondBuffer : 1000);
    this.broadcastCallback = broadcastCallback;
    this.regions = [];
}

MiranaServerGame.prototype.start = function () {
    var self = this;

    this.startTime = new Date().getTime();
    this.stateIntervalId = setInterval(function () { self.broadcastState(); }, this.stateInterval);
};

MiranaServerGame.prototype.stop = function () {
    clearInterval(this.stateIntervalId);
};

MiranaServerGame.prototype.broadcastState = function () {
    var i = 0, currentTime = new Date().getTime() - this.startTime,
        state = { t: currentTime, ps: [], es: [] };

    if (this.regions.length > 0) {
        for (i = 0; i < this.regions.length; i++) {
            state.ps = this.getStateByRegion(this.playerController, this.regions[i]);
            state.es = this.getStateByRegion(this.entityController, this.regions[i]);
            this.broadcastCallback(state, this.regions[i]);
        }
    } else {
        state.ps = this.getState(this.playerController);
        state.es = this.getState(this.entityController);
        this.broadcastCallback(state);
    }
};

MiranaServerGame.prototype.getState = function (controller) {
    var states = [],
        clientSidePrediction = this.options.clientSidePrediction;

    controller.entities.forEach(function (entity) {
        if (clientSidePrediction && entity.referrerId != null) {
            states.push([entity.id, entity.state, entity.sequence, entity.referrerId, entity.referrerSeq]);
        }
        else {
            states.push([entity.id, entity.state, entity.sequence]);
        }
    });
    return states;
};

MiranaServerGame.prototype.getStateByRegion = function (controller, region) {
    var states = [],
        clientSidePrediction = this.options.clientSidePrediction;

    controller.entities.forEach(function (entity) {
        if (entity.region === region) {
            if (clientSidePrediction && entity.referrerId != null) {
                states.push([entity.id, entity.state, entity.sequence, entity.referrerId, entity.referrerSeq]);
            }
            else {
                states.push([entity.id, entity.state, entity.sequence]);
            }
        }
    });
    return states;
};

MiranaServerGame.prototype.getPlayers = function () {
    var list = [];
    this.playerController.entities.forEach(function (player) {
        list.push({ id: player.id, state: player.state, inputs: player.inputs, stateHistory: player.stateHistory });
    });
    return list;
};

MiranaServerGame.prototype.getEntities = function () {
    var list = [];
    this.entityController.entities.forEach(function (entity) {
        list.push({ id: entity.id, state: entity.state, stateHistory: entity.stateHistory });
    });
    return list;
};

MiranaServerGame.prototype.updatePlayerState = function (id, state) {
    this.updateState(this.playerController, id, state);
};

MiranaServerGame.prototype.updateEntityState = function (id, state) {
    this.updateState(this.entityController, id, state);
};

MiranaServerGame.prototype.updateState = function (controller, id, state) {
    var currentTime = new Date().getTime() - this.startTime;

    controller.entities.some(function (entity) {
        if (entity.id === id) {
            entity.addState(state, currentTime);
            return true;
        }
    });
};

MiranaServerGame.prototype.addPlayer = function (socket) {
    this.playerController.add(socket);
};

MiranaServerGame.prototype.removePlayer = function (id) {
    this.playerController.remove(id);
};

MiranaServerGame.prototype.addEntity = function (id, referrerId) {
    this.entityController.add(id, referrerId);
};

MiranaServerGame.prototype.getEntity = function (id) {
    for (var idx = 0; idx < this.entityController.entities.length; idx++) {
        if (this.entityController.entities[idx].id === id) {
            return this.entityController.entities[idx];
        }
    }
};


MiranaServerGame.prototype.removeEntity = function (id) {
    this.entityController.remove(id);
};

MiranaServerGame.prototype.addPlayerInput = function (id, input, sequence, time) {
    this.playerController.addInput(id, input, sequence, time);
};

MiranaServerGame.prototype.sendPlayerEvent = function (id, data) {
    this.playerController.entities.some(function (player) {
        if (player.id === id) {
            player.socket.emit('e', data);
            return true;
        }
    });
};

MiranaServerGame.prototype.setPlayerRegion = function (id, region) {
    this.setRegion(this.playerController, id, region);
};

MiranaServerGame.prototype.setEntityRegion = function (id, region) {
    this.setRegion(this.entityController, id, region);
};

MiranaServerGame.prototype.setRegion = function (controller, id, region) {
    var self = this;
    controller.entities.some(function (entity) {
        if (entity.id === id) {
            entity.setRegion(region);
            self.updateRegions(region);
            return true;
        }
    });
};

MiranaServerGame.prototype.updateRegions = function (region) {
    var regionFound = false;

    this.regions.forEach(function (item) {
        if (item === region) {
            regionFound = true;
        }
    });
    if (!regionFound) {
        this.regions.push(region);
    }
};

MiranaServerGame.prototype.clearRegions = function () {
    this.regions = [];
    this.entityController.clearRegions();
    this.playerController.clearRegions();
};