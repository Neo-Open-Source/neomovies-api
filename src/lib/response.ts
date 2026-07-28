export function success<T>(data: T) {
  return { success: true as const, data }
}

export function errorResponse(error: string, status: number = 400) {
  return { success: false as const, error, status }
}

export function notFound(entity: string = "Resource") {
  return errorResponse(`${entity} not found`, 404)
}

export function unauthorized(msg: string = "Unauthorized") {
  return errorResponse(msg, 401)
}

export function forbidden(msg: string = "Forbidden") {
  return errorResponse(msg, 403)
}

export function badRequest(msg: string) {
  return errorResponse(msg, 400)
}
