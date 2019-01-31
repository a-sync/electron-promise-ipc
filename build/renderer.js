'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PromiseIpc = exports.PromiseIpcRenderer = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); // eslint-disable-line


var _electron = require('electron');

var _v = require('uuid/v4');

var _v2 = _interopRequireDefault(_v);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _serializeError = require('serialize-error');

var _serializeError2 = _interopRequireDefault(_serializeError);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var PromiseIpcRenderer = exports.PromiseIpcRenderer = function () {
  function PromiseIpcRenderer(opts) {
    _classCallCheck(this, PromiseIpcRenderer);

    if (opts) {
      this.maxTimeoutMs = opts.maxTimeoutMs;
    }
  }

  _createClass(PromiseIpcRenderer, [{
    key: 'send',
    value: function send(route) {
      var _this = this;

      for (var _len = arguments.length, dataArgs = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        dataArgs[_key - 1] = arguments[_key];
      }

      return new _bluebird2.default(function (resolve, reject) {
        var replyChannel = route + '#' + (0, _v2.default)();
        var timeout = void 0;
        var didTimeOut = false;

        // ipcMain will send a message back to replyChannel when it finishes calculating
        _electron.ipcRenderer.once(replyChannel, function (event, status, returnData) {
          clearTimeout(timeout);
          if (didTimeOut) {
            return null;
          }
          switch (status) {
            case 'success':
              return resolve(returnData);
            case 'failure':
              return reject(returnData);
            default:
              return reject(new Error('Unexpected IPC call status "' + status + '" in ' + route));
          }
        });
        _electron.ipcRenderer.send.apply(_electron.ipcRenderer, [route, replyChannel].concat(dataArgs));

        if (_this.maxTimeoutMs) {
          timeout = setTimeout(function () {
            didTimeOut = true;
            reject(new Error(route + ' timed out.'));
          }, _this.maxTimeoutMs);
        }
      });
    }

    // If I ever implement `off`, then this method will actually use `this`.
    // eslint-disable-next-line class-methods-use-this

  }, {
    key: 'on',
    value: function on(route, listener) {
      _electron.ipcRenderer.on(route, function (event, replyChannel) {
        for (var _len2 = arguments.length, dataArgs = Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {
          dataArgs[_key2 - 2] = arguments[_key2];
        }

        // Chaining off of Promise.resolve() means that listener can return a promise, or return
        // synchronously -- it can even throw. The end result will still be handled promise-like.
        _bluebird2.default.resolve().then(function () {
          return listener.apply(undefined, dataArgs);
        }).then(function (results) {
          _electron.ipcRenderer.send(replyChannel, 'success', results);
        }).catch(function (e) {
          _electron.ipcRenderer.send(replyChannel, 'failure', (0, _serializeError2.default)(e));
        });
      });
    }
  }, {
    key: 'off',
    value: function off(route) {
      return _electron.ipcRenderer.removeAllListeners(route);
    }
  }]);

  return PromiseIpcRenderer;
}();

var PromiseIpc = exports.PromiseIpc = PromiseIpcRenderer;

var mainExport = new PromiseIpcRenderer();
mainExport.PromiseIpc = PromiseIpcRenderer;
mainExport.PromiseIpcRenderer = PromiseIpcRenderer;

exports.default = mainExport;

module.exports = mainExport;
//# sourceMappingURL=renderer.js.map