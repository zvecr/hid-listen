/* eslint-env mocha */
const chai = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const EventEmitter = require('events');

const mockFs = {
  existsSync: sinon.stub(),
  readFileSync: sinon.stub(),
};

mockery.registerMock('fs', mockFs);

class DummyHID extends EventEmitter {
}
DummyHID.prototype.close = sinon.spy();
DummyHID.prototype.readTimeout = sinon.stub();

const mockNodeHID = {
  devices: sinon.stub(),
  HID: DummyHID,
};
mockery.registerMock('node-hid', mockNodeHID);

mockery.enable({
  warnOnUnregistered: false,
});

sinon.stub(process, 'platform').returns('linux');

const HIDListen = require('../lib/index');

const should = chai.should();

describe('HIDListen EventEmitter', () => {
  beforeEach(() => {
    this.mod = new HIDListen({ tick: 50, delay: 10 });

    mockFs.existsSync.returns(true);
    mockFs.readFileSync.returns(Buffer.of());

    mockNodeHID.devices.returns([{ usagePage: 0xFF31, usage: 0x0074, path: '/tmp/hidraw1' }]);

    this.originalPlatform = process.platform;
  });

  afterEach(() => {
    this.mod.removeAllListeners();
    sinon.restore();
    DummyHID.prototype.readTimeout.reset();

    Object.defineProperty(process, 'platform', {
      value: this.originalPlatform,
    });
  });

  it('should not connect when no devices', (done) => {
    mockNodeHID.devices.returns([]);

    this.mod.on('connect', () => done(new Error('Connect should never be called')));
    this.mod.on('tick', () => done());
  });

  it('should emit connection events', (done) => {
    this.mod.on('connect', (device) => {
      mockNodeHID.devices.returns([]);
      device.emit('error');
    });
    this.mod.on('disconnect', () => done());
  });

  it('should emit multiple lines on node-hid data', (done) => {
    const lines = [];

    this.mod.on('connect', (device) => {
      device.emit('data', Buffer.from('line1\nline2\n'));
    });
    this.mod.on('data', (data) => {
      lines.push(data);
      if (lines.length === 2) {
        lines.should.be.eql(['line1', 'line2']);
        done();
      }
    });
  });

  it('should patch in "missing device usage" on linux', (done) => {
    Object.defineProperty(process, 'platform', {
      value: 'linux',
    });
    mockNodeHID.devices.returns([{ path: '/tmp/hidraw1' }]);

    mockFs.existsSync.returns(true);
    mockFs.readFileSync.returns(Buffer.of(0x00, 0x31, 0xFF, 0x00, 0x74, 0x00));

    this.mod.on('connect', () => {
      done();
    });
  });

  it('should not patch in "missing device usage" on other platforms', (done) => {
    Object.defineProperty(process, 'platform', {
      value: 'other',
    });
    mockNodeHID.devices.returns([{ path: '/tmp/hidraw1' }]);

    mockFs.existsSync.throws();
    mockFs.readFileSync.throws();

    this.mod.on('connect', () => done(new Error('Connect should never be called')));
    this.mod.on('tick', () => done());
  });

  it('should patch in support for reads with timeout - success', (done) => {
    this.mod.on('connect', (device) => {
      device.readTimeout.returns([]);

      device.read((err, data) => {
        sinon.assert.calledOnce(device.readTimeout);
        should.not.exist(err);
        should.exist(data);
        done();
      });
    });
  });

  it('should patch in support for reads with timeout - error', (done) => {
    this.mod.on('connect', (device) => {
      device.readTimeout.throws([]);

      device.read((err, data) => {
        sinon.assert.calledOnce(device.readTimeout);
        should.exist(err);
        should.not.exist(data);
        done();
      });
    });
  });
});
