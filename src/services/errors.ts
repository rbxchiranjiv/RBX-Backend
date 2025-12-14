export class DomainError extends Error {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, identifier: string) {
    super(`${resource} with identifier ${identifier} was not found.`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'ConflictError';
  }
}

export class AuthenticationError extends DomainError {
  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends DomainError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class DisputeWindowError extends DomainError {
  constructor(message = 'Dispute window has closed.') {
    super(message);
    this.name = 'DisputeWindowError';
  }
}

export class ConcurrencyLockError extends DomainError {
  constructor(message = 'Match is currently locked. Please retry.') {
    super(message);
    this.name = 'ConcurrencyLockError';
  }
}
