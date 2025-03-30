import { z, ZodTypeAny } from "zod";
import { RequestHandler, Request, Response, NextFunction } from "express";

type ZodRequestSchema = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

export function validateRequest<T extends ZodRequestSchema>(
  schema: T
): RequestHandler<
  T["params"] extends ZodTypeAny ? z.infer<T["params"]> : {},
  unknown,
  T["body"] extends ZodTypeAny ? z.infer<T["body"]> : {},
  T["query"] extends ZodTypeAny ? z.infer<T["query"]> : {}
> {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        const result = schema.body.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ location: "body", errors: result.error.format() });
        }
        req.body = result.data;
      }

      if (schema.query) {
        const result = schema.query.safeParse(req.query);
        if (!result.success) {
          return res.status(400).json({ location: "query", errors: result.error.format() });
        }
        req.query = result.data;
      }

      if (schema.params) {
        const result = schema.params.safeParse(req.params);
        if (!result.success) {
          return res.status(400).json({ location: "params", errors: result.error.format() });
        }
        req.params = result.data;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
