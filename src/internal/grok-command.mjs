const GRAMMAR = Object.freeze([
  { pattern: /^\s+status$/u, build: () => ({ verb: "status" }) },
  { pattern: /^\s+login$/u, build: () => ({ verb: "login" }) },
  { pattern: /^\s+cancel$/u, build: () => ({ verb: "cancel" }) },
  { pattern: /^\s+logout$/u, build: () => ({ verb: "logout" }) },
])

export function parseGrokCommandInput(rawInput) {
  if (typeof rawInput !== "string" || rawInput.length > 256 || /[\r\n\0]/u.test(rawInput)) {
    return undefined
  }
  for (const rule of GRAMMAR) {
    const match = rule.pattern.exec(rawInput)
    if (match !== null) return Object.freeze(rule.build(match))
  }
  return undefined
}
