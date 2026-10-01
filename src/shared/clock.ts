/** Injectable time source so time-dependent business rules (e.g. SLA breaches) are testable. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();
