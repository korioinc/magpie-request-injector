import assert from "node:assert/strict";
import test from "node:test";
import { onProvider } from "../request-patcher.middleware.mjs";

test("Disabled or malformed settings cannot modify a request", () => {
  const body = Object.freeze({ model: "gpt-5-codex", input: "hello" });
  for (const options of [[], "enabled", { enabled: false }, { enabled: false, tier: "ultrafast" },
    { enabled: "true", tier: "priority" }, { enabled: undefined }, { enabled: true, tier: "invalid" }]) {
    assert.doesNotThrow(() => onProvider(body, { protocol: "responses", model: body.model, options }));
  }
});

test("Existing client tiers are preserved regardless of the configured tier", () => {
  for (const protocol of ["chat", "responses"]) {
    for (const serviceTier of ["auto", "priority", "ultrafast", null, "", false, 0, undefined]) {
      const body = Object.freeze({ model: "gpt-5-codex", service_tier: serviceTier });
      const result = onProvider(body, {
        protocol, model: body.model, options: { enabled: true, tier: "priority" },
      }) ?? body;
      assert.equal(result.service_tier, serviceTier);
    }
  }
});

test("Patching fills a missing tier without changing prompt or generation settings", () => {
  for (const tier of ["priority", "ultrafast"]) {
    const body = {};
    for (const [key, value] of Object.entries({
      input: Object.freeze([Object.freeze({ role: "user", content: "hello" })]),
      model: "gpt-5-codex", stream: true, temperature: 0.4,
    })) {
      Object.defineProperty(body, key, { value, enumerable: true });
    }
    const result = onProvider(body, {
      protocol: "responses", model: body.model, options: { enabled: true, tier },
    }) ?? body;
    assert.equal(result.service_tier, tier);
  }
});
