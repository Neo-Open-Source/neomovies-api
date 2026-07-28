export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message)
    this.name = "AppError"
  }
}

export class UnauthorizedError extends AppError {
  constructor(msg = "Unauthorized") {
    super(401, msg)
  }
}

export class NotFoundError extends AppError {
  constructor(entity = "Resource") {
    super(404, `${entity} not found`)
  }
}

export class BadRequestError extends AppError {
  constructor(msg: string) {
    super(400, msg)
  }
}

export class ForbiddenError extends AppError {
  constructor(msg = "Forbidden") {
    super(403, msg)
  }
}
