import { logger as defaultLogger, type Logger } from '../logger';
import type { DomainEventMap, DomainEventName } from './domain-events';

export type EventHandler<K extends DomainEventName> = (payload: DomainEventMap[K]) => void | Promise<void>;

type HandlerRegistry = { [K in DomainEventName]?: EventHandler<K>[] };

/**
 * In-process, typed event bus — the only sanctioned channel for cross-module side effects.
 *
 * `emit` awaits all handlers (so callers and tests get deterministic ordering) but isolates
 * failures: a failing subscriber is logged and never propagates back into the producer.
 */
export class EventBus {
  private readonly handlers: HandlerRegistry = {};

  constructor(private readonly logger: Logger = defaultLogger) {}

  on<K extends DomainEventName>(event: K, handler: EventHandler<K>): () => void {
    const list: EventHandler<K>[] = this.handlers[event] ?? [];
    list.push(handler);
    this.handlers[event] = list as HandlerRegistry[K];
    return () => {
      const current: EventHandler<K>[] = this.handlers[event] ?? [];
      this.handlers[event] = current.filter((h) => h !== handler) as HandlerRegistry[K];
    };
  }

  async emit<K extends DomainEventName>(event: K, payload: DomainEventMap[K]): Promise<void> {
    const list: EventHandler<K>[] = this.handlers[event] ?? [];
    const results = await Promise.allSettled(list.map(async (handler) => handler(payload)));
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error('Event handler failed', { event, reason: String(result.reason) });
      }
    }
  }

  listenerCount(event: DomainEventName): number {
    return this.handlers[event]?.length ?? 0;
  }
}
