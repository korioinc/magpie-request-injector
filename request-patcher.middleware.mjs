function isGpt(model) {
  if (typeof model !== "string") return false;
  const name = model.trim();
  const start = name.indexOf("/") + 1;
  return name.slice(start, start + 4).toLowerCase() === "gpt-";
}

export function onProvider(body, ctx) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return;
  if (Object.hasOwn(body, "service_tier")) return;
  if (!ctx || (ctx.protocol !== "chat" && ctx.protocol !== "responses")) return;

  const options = ctx.options == null ? {} : ctx.options;
  if (typeof options !== "object" || Array.isArray(options)) return;
  const enabled = Object.hasOwn(options, "enabled") ? options.enabled : true;
  const tier = Object.hasOwn(options, "tier") ? options.tier : "priority";
  if (enabled !== true || (tier !== "priority" && tier !== "ultrafast")) return;
  if (!isGpt(ctx.model) && !isGpt(ctx.provider && ctx.provider.model)) return;

  body.service_tier = tier;
  return body;
}
