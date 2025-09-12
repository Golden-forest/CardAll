"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
exports.__esModule = true;
exports.sync = void 0;
var glossary_1 = require("../glossary");
var Database_1 = require("../db/Database");
var inheritInternalProperties_1 = require("../utils/inheritInternalProperties");
function removeListeners(event, db) {
    var listeners = db.events.listeners(event);
    listeners.forEach(function (listener) {
        db.events.removeListener(event, listener);
    });
    return function () {
        listeners.forEach(function (listener) {
            db.events.addListener(event, listener);
        });
    };
}
/**
 * Sets the serialized internal properties as symbols
 * on the given entity.
 * @note `Symbol` properties are stripped off when sending
 * an object over an event emitter.
 */
function deserializeEntity(entity) {
    var _a;
    var _b = entity, _c = Database_1.SERIALIZED_INTERNAL_PROPERTIES_KEY, internalProperties = _b[_c], publicProperties = __rest(_b, [typeof _c === "symbol" ? _c : _c + ""]);
    inheritInternalProperties_1.inheritInternalProperties(publicProperties, (_a = {},
        _a[glossary_1.ENTITY_TYPE] = internalProperties.entityType,
        _a[glossary_1.PRIMARY_KEY] = internalProperties.primaryKey,
        _a));
    return publicProperties;
}
/**
 * Synchronizes database operations across multiple clients.
 */
function sync(db) {
    var IS_BROWSER = typeof window !== 'undefined';
    var SUPPORTS_BROADCAST_CHANNEL = typeof BroadcastChannel !== 'undefined';
    if (!IS_BROWSER || !SUPPORTS_BROADCAST_CHANNEL) {
        return;
    }
    var channel = new BroadcastChannel('mswjs/data/sync');
    channel.addEventListener('message', function (event) {
        var _a = __read(event.data.payload, 1), sourceId = _a[0];
        // Ignore messages originating from unrelated databases.
        // Useful in case of multiple databases on the same page.
        if (db.id !== sourceId) {
            return;
        }
        // Remove database event listener for the signaled operation
        // to prevent an infinite loop when applying this operation.
        var restoreListeners = removeListeners(event.data.operationType, db);
        // Apply the database operation signaled from another client
        // to the current database instance.
        switch (event.data.operationType) {
            case 'create': {
                var _b = __read(event.data.payload, 4), _1 = _b[0], modelName = _b[1], entity = _b[2], customPrimaryKey = _b[3];
                db.create(modelName, deserializeEntity(entity), customPrimaryKey);
                break;
            }
            case 'update': {
                var _c = __read(event.data.payload, 4), _2 = _c[0], modelName = _c[1], prevEntity = _c[2], nextEntity = _c[3];
                db.update(modelName, deserializeEntity(prevEntity), deserializeEntity(nextEntity));
                break;
            }
            case 'delete': {
                var _d = __read(event.data.payload, 3), _3 = _d[0], modelName = _d[1], primaryKey = _d[2];
                db["delete"](modelName, primaryKey);
                break;
            }
        }
        // Re-attach database event listeners.
        restoreListeners();
    });
    // Broadcast the emitted event from this client
    // to all the other connected clients.
    function broadcastDatabaseEvent(operationType) {
        return function () {
            var payload = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                payload[_i] = arguments[_i];
            }
            channel.postMessage({
                operationType: operationType,
                payload: payload
            });
        };
    }
    db.events.on('create', broadcastDatabaseEvent('create'));
    db.events.on('update', broadcastDatabaseEvent('update'));
    db.events.on('delete', broadcastDatabaseEvent('delete'));
}
exports.sync = sync;
