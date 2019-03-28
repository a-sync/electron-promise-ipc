import proxyquire from 'proxyquire';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import lolex from 'lolex';

const { ipcRenderer, ipcMain } = require('electron-ipc-mock')();

chai.use(chaiAsPromised);
const uuid = 'totally_random_uuid';

const generateRoute = (function generateRoute() {
  let i = 1;
  return () => i++; // eslint-disable-line no-plusplus
}());

const renderer = proxyquire('../src/renderer', {
  electron: { ipcRenderer },
  'uuid/v4': () => uuid,
});
const { PromiseIpc } = renderer;

describe('renderer', () => {
  it('exports a default that’s an instance of PromiseIpc', () => {
    expect(renderer).to.be.an.instanceOf(PromiseIpc);
  });

  describe('send', () => {
    it('resolves to sent data on success', () => {
      const replyChannel = `route#${uuid}`;
      ipcMain.once('route', (event) => {
        event.sender.send(replyChannel, 'success', 'result');
      });
      const promise = renderer.send('route', 'dataArg1', 'dataArg2');
      return expect(promise).to.eventually.eql('result');
    });

    it('sends the reply channel and any additional arguments', () => {
      const replyChannel = `route#${uuid}`;
      let argumentsAfterEvent;
      ipcMain.once('route', (event, ...rest) => {
        argumentsAfterEvent = rest;
        event.sender.send(replyChannel, 'success', 'result');
      });
      const promise = renderer.send('route', 'dataArg1', 'dataArg2');
      return promise.then(() => {
        expect(argumentsAfterEvent).to.eql([replyChannel, 'dataArg1', 'dataArg2']);
      });
    });

    it('rejects with the IPC-passed message on failure', () => {
      const replyChannel = `route#${uuid}`;
      ipcMain.once('route', (event) => {
        event.sender.send(replyChannel, 'failure', new Error('an error message'));
      });
      const promise = renderer.send('route', 'dataArg1', 'dataArg2');
      return expect(promise).to.be.rejectedWith(Error, 'an error message');
    });

    it('rejects if the IPC passes an unrecognized lifecycle event', () => {
      const replyChannel = `route#${uuid}`;
      ipcMain.once('route', (event) => {
        event.sender.send(replyChannel, 'unrecognized', 'an error message');
      });
      const promise = renderer.send('route', 'dataArg1', 'dataArg2');
      return expect(promise).to.be.rejectedWith(Error, 'Unexpected IPC call status "unrecognized" in route');
    });
    describe('timeouts', () => {
      let clock;

      beforeEach(() => {
        clock = lolex.install();
      });

      afterEach(() => {
        clock.uninstall();
      });

      it('fails if it times out', () => {
        const timeoutRenderer = new PromiseIpc({ maxTimeoutMs: 5000 });
        const makePromise = () => timeoutRenderer.send('route', 'dataArg1', 'dataArg2');
        const p = expect(makePromise()).to.be.rejectedWith(Error, 'route timed out.');
        clock.tick(5001);
        return p;
      });

      it('swallows a subsequent resolve if it timed out', () => {
        const replyChannel = `route#${uuid}`;
        ipcMain.once('route', (event) => {
          setTimeout(() => {
            event.sender.send(replyChannel, 'success', 'a message');
          }, 6000);
        });
        const timeoutRenderer = new PromiseIpc({ maxTimeoutMs: 5000 });
        const makePromise = () => timeoutRenderer.send('route', 'dataArg1', 'dataArg2');
        const p = expect(makePromise()).to.be.rejectedWith(Error, 'route timed out.');
        clock.tick(5001);
        clock.tick(1000);
        return p;
      });
    });
  });

  describe('on', () => {
    let mockWebContents;
    before((done) => {
      ipcMain.once('saveMockWebContentsSend', (event) => {
        mockWebContents = event.sender;
        done();
      });
      ipcRenderer.send('saveMockWebContentsSend');
    });
    let route = generateRoute();

    afterEach(() => {
      // why not remove all listeners? a bug in the library of course...
      // https://github.com/jsantell/electron-ipc-mock/pull/4
      // ipcMain.removeAllListeners();
      // instead we'll generate new routes for now, until the PR goes through.
      route = generateRoute();
    });

    it('when listener returns resolved promise, sends success + value to the main process', (done) => {
      renderer.on(route, () => Promise.resolve('foober'));
      ipcMain.once('replyChannel', (event, status, result) => {
        expect([status, result]).to.eql(['success', 'foober']);
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });

    it('when listener synchronously returns, sends success + value to the main process', (done) => {
      renderer.on(route, () => Promise.resolve('foober'));
      ipcMain.once('replyChannel', (event, status, result) => {
        expect([status, result]).to.eql(['success', 'foober']);
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });

    it('when listener returns rejected promise, sends failure + error to the main process', (done) => {
      renderer.on(route, () => Promise.reject(new Error('foober')));
      ipcMain.once('replyChannel', (event, status, result) => {
        expect(status).to.eql('failure');
        expect(result.name).to.eql('Error');
        expect(result.message).to.eql('foober');
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });

    it('lets a listener reject with a simple string', (done) => {
      // eslint-disable-next-line prefer-promise-reject-errors
      renderer.on(route, () => Promise.reject('goober'));
      ipcMain.once('replyChannel', (event, status, result) => {
        expect([status, result]).to.eql(['failure', 'goober']);
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });

    it('lets a listener reject with a function', (done) => {
      // eslint-disable-next-line prefer-promise-reject-errors
      renderer.on(route, () => Promise.reject(() => 'yay!'));
      ipcMain.once('replyChannel', (event, status, result) => {
        expect([status, result]).to.eql(['failure', '[Function: anonymous]']);
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });

    it('lets a listener reject with a custom error', (done) => {
      renderer.on(route, () => {
        const custom = new Error('message');
        custom.obj = { foo: 'bar' };
        custom.array = ['one', 'two'];
        custom.func = () => 'yay!';
        custom.self = custom;
        return Promise.reject(custom);
      });
      ipcMain.once('replyChannel', (event, status, result) => {
        expect(status).to.eql('failure');
        expect(result.message).to.eql('message');
        expect(result.obj).to.eql({ foo: 'bar' });
        expect(result.array).to.eql(['one', 'two']);
        expect(result.func).to.eql(undefined);
        expect(result.self).to.eql('[Circular]');
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });

    it('when listener throws, sends failure + error to the main process', (done) => {
      renderer.on(route, () => {
        throw new Error('oh no');
      });
      ipcMain.once('replyChannel', (event, status, result) => {
        expect(status).to.eql('failure');
        expect(result.name).to.eql('Error');
        expect(result.message).to.eql('oh no');
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'dataArg1');
    });

    it('passes the received data args to the listener', (done) => {
      renderer.on(route, (...args) => args.join(','));
      ipcMain.once('replyChannel', (event, status, result) => {
        expect([status, result]).to.eql(['success', 'foo,bar,baz']);
        done();
      });
      mockWebContents.send(route, 'replyChannel', 'foo', 'bar', 'baz');
    });
  });
});
