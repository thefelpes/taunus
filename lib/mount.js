'use strict';

var util = require('util');
var path = require('path');
var state = require('./state');
var resolvers = require('./resolvers');
var shared = require('./resolvers.shared');
var defaults = require('./resolvers.server');
var optionalRequire = require('./optionalRequire');
var versioning = require ('../versioning');
var pkg = require('../package.json');
var resolve = require('./resolve');

function noop () {}

function mount (addRoute, options) {
  resolvers.use(shared);
  resolvers.use(defaults);

  var o = options || {};
  if (o.resolvers) {
    resolvers.use(o.resolvers);
  }
  if (!Array.isArray(o.routes)) {
    console.warn('You need to add some view routes to Taunus!\n\ntaunus.mount(addRoute, {\n  routes: routes\n});');
    o.routes = [];
  }

  state.version = versioning.get(o.version || '1');
  state.plaintext = o.plaintext;
  state.deferMinified = o.deferMinified;
  state.getPartial = o.getPartial;
  state.beforeRender = o.beforeRender;
  state.layout = o.layout;

  resolve.set(o.routes);
  o.routes.forEach(register);

  mount.rebuildDefaultViewModel = rebuild;
  mount.rebuildDefaultViewModel();

  function rebuild (done) {
    if (o.getDefaultViewModel) {
      o.getDefaultViewModel(next);
    } else {
      next(null, {});
    }

    function next (err, model) {
      saveDefaultModel(err, model);
      (done || noop)(err, model);
    }
  }

  function parseRouteMiddleware (middleware) {
    if (Array.isArray(middleware)) {
      return middleware;
    }
    if (typeof middleware === 'function') {
      return [middleware];
    }
    return [];
  }

  function register (route) {
    if (route.ignore) {
      return;
    }
    if (typeof route.action !== 'string') {
      console.warn('Ignoring route because action string property is missing\n%s', JSON.stringify(route, null, 2));
      return;
    }
    var middleware = parseRouteMiddleware(route.middleware);
    var location = resolvers.getServerController(route.action);
    var relative = path.relative(__dirname, location);
    var action = optionalRequire(relative, module);
    if (action === null) {
      console.warn('Missing server-side controller for "%s" action. Searched location: "%s"', route.action, location);
    }

    route.actionFn = action;
    route.middleware = middleware;

    addRoute(route);
  }

  function saveDefaultModel (err, data) {
    if (err) {
      throw err;
    }
    state.defaults = data;
    state.emit('defaults');
  }
}

module.exports = mount;
