import { EventBus } from '../../src/shared/events/event-bus';
import type { Logger } from '../../src/shared/logger';

const payload = { programmeId: 'p1', storeId: 's1', closedBy: 'u1' };

const silentLogger = (): Logger & { error: jest.Mock } => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('EventBus', () => {
  it('delivers payloads to every subscriber of an event', async () => {
    const bus = new EventBus(silentLogger());
    const a = jest.fn();
    const b = jest.fn();
    bus.on('programme.closed', a);
    bus.on('programme.closed', b);

    await bus.emit('programme.closed', payload);

    expect(a).toHaveBeenCalledWith(payload);
    expect(b).toHaveBeenCalledWith(payload);
    expect(bus.listenerCount('programme.closed')).toBe(2);
  });

  it('does nothing when an event has no subscribers', async () => {
    const bus = new EventBus(silentLogger());
    await expect(bus.emit('programme.closed', payload)).resolves.toBeUndefined();
    expect(bus.listenerCount('programme.closed')).toBe(0);
  });

  it('supports unsubscribing', async () => {
    const bus = new EventBus(silentLogger());
    const handler = jest.fn();
    const off = bus.on('programme.closed', handler);
    off();
    await bus.emit('programme.closed', payload);
    expect(handler).not.toHaveBeenCalled();
  });

  it('isolates failing handlers and logs them', async () => {
    const logger = silentLogger();
    const bus = new EventBus(logger);
    const healthy = jest.fn();
    bus.on('programme.closed', () => Promise.reject(new Error('boom')));
    bus.on('programme.closed', healthy);

    await expect(bus.emit('programme.closed', payload)).resolves.toBeUndefined();
    expect(healthy).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('Event handler failed', expect.objectContaining({ event: 'programme.closed' }));
  });
});
