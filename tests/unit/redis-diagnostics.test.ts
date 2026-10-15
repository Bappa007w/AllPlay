import { expect, it } from "vitest";
import { redisFailureCategory } from "../../backend/src/services/redis.js";

it.each([
  ["WRONGPASS secret", "AUTH_FAILED"],
  ["getaddrinfo ENOTFOUND private-host", "DNS_FAILED"],
  ["TLS certificate rejected", "TLS_FAILED"],
  ["quota limit exceeded", "QUOTA_EXCEEDED"],
  ["NOPERM EVAL not allowed", "COMMAND_REJECTED"],
  ["Command timed out", "TIMEOUT"],
  ["ECONNRESET", "CONNECTION_FAILED"],
  ["rediss://private:password@private-host", "UNAVAILABLE"],
])("redacts provider error %s", (message, category) => {
  expect(redisFailureCategory(new Error(message))).toBe(category);
});
