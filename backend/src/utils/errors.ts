import { FastifyError } from 'fastify';

export class AppError extends Error {
  statusCode: number;
  error: string;

  constructor(statusCode: number, error: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.error = error;
    this.name = 'AppError';
  }
}

export const errors = {
  notFound: (resource = 'Resource') => new AppError(404, 'Not Found', `${resource} not found`),
  unauthorized: (msg = 'Unauthorized') => new AppError(401, 'Unauthorized', msg),
  forbidden: (msg = 'Forbidden') => new AppError(403, 'Forbidden', msg),
  badRequest: (msg: string) => new AppError(400, 'Bad Request', msg),
  conflict: (msg: string) => new AppError(409, 'Conflict', msg),
  internal: (msg = 'Internal server error') => new AppError(500, 'Internal Server Error', msg),
};
