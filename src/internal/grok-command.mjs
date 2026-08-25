const MODE = "(official-cli|managed-device)"
const GRAMMAR = Object.freeze([
  { pattern: /^\s+status$/u, build: () => ({ verb: "status" }) },
  { pattern: new RegExp(`^\\s+use\\s+${MODE}$`, "u"), build: (match) => ({ verb: "use", mode: match[1] }) },
  { pattern: /^\s+login$/u, build: () => ({ verb: "login" }) },
  { pattern: new RegExp(`^\\s+login\\s+${MODE}$`, "u"), build: (match) => ({ verb: "login", mode: match[1] }) },
  { pattern: /^\s+cancel$/u, build: () => ({ verb: "cancel" }) },
  { pattern: new RegExp(`^\\s+logout\\s+${MODE}$`, "u"), build: (match) => ({ verb: "logout", mode: match[1] }) },
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
