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

const mockNodeHID = {
  devices: sinon.stub(),
  HID: DummyHID,
};
mockery.registerMock('node-hid', mockNodeHID);

mockery.enable({
  warnOnUnregistered: false,
});

const HIDListen = require('../lib/index');

chai.should();

describe('HIDListen EventEmitter', () => {
  let mod;
  beforeEach(() => {
    mod = new HIDListen({ tick: 250 });

    mockFs.existsSync.returns(true);
    mockFs.readFileSync.returns(Buffer.of());

    mockNodeHID.devices.returns([{ usagePage: 0xFF31, usage: 0x0074, path: '/tmp/hidraw1' }]);
  });

  afterEach(() => {
    mod.removeAllListeners();
    sinon.restore();
  });

  it('should not connect when no devices', (done) => {
    mockNodeHID.devices.returns([]);

    mod.on('connect', () => done(new Error('Connect should never be called')));
    mod.on('tick', () => done());
  });

  it('should emit connection events', (done) => {
    mod.on('connect', (device) => {
      mockNodeHID.devices.returns([]);
      device.emit('error');
    });
    mod.on('disconnect', () => done());
  });

  it('should emit multiple lines on node-hid data', (done) => {
    const lines = [];

    mod.on('connect', (device) => {
      device.emit('data', Buffer.from('line1\nline2\n'));
    });
    mod.on('data', (data) => {
      lines.push(data);
      if (lines.length === 2) {
        lines.should.be.eql(['line1', 'line2']);
        done();
      }
    });
  });
});
