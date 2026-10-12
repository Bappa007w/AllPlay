import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ROOM_STORE: z.enum(["memory", "redis"]).default("memory"),
  REDIS_URL: z.string().optional(),
  REDIS_KEY_PREFIX: z
    .string()
    .regex(/^[a-zA-Z0-9:_-]{3,80}$/)
    .default("allplay:local"),
  VERCEL: z.enum(["1"]).optional(),
  SERVER_HOST: z.string().trim().min(1).default("127.0.0.1"),
  SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN: z
    .url()
    .refine((value) => {
      if (!URL.canParse(value)) return false;
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && url.origin === value;
    }, "Must be an HTTP(S) origin without credentials, path or trailing slash")
    .default("http://localhost:3000"),
});

export type ServerEnvironment = z.infer<typeof environmentSchema>;

export function parseEnvironment(input: Record<string, string | undefined>): ServerEnvironment {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid server environment: ${fields.join(", ")}`);
  }
  if (result.data.NODE_ENV === "production" && !result.data.WEB_ORIGIN.startsWith("https://")) {
    throw new Error("Invalid server environment: WEB_ORIGIN must use HTTPS in production");
  }
  if (result.data.ROOM_STORE === "redis") {
    let valid = false;
    try {
      const url = new URL(result.data.REDIS_URL ?? "");
      valid =
        url.protocol === "rediss:" ||
        (result.data.NODE_ENV !== "production" && url.protocol === "redis:");
    } catch {
      /* fail closed */
    }
    if (!valid) throw new Error("Invalid server environment: REDIS_URL must use TLS in production");
  }
  if (
    result.data.VERCEL === "1" &&
    (result.data.ROOM_STORE !== "redis" || result.data.REDIS_KEY_PREFIX === "allplay:local")
  ) {
    throw new Error(
      "Invalid Vercel environment: use Redis and a deployment-specific REDIS_KEY_PREFIX",
    );
  }
  return result.data;
}
