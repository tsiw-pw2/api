import type { NextFunction, Request, Response } from "express"

export function requerAutenticacao(_req: Request, _res: Response, next: NextFunction) {
  next()
}

