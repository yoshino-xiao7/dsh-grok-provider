import assert from "node:assert/strict"
import test from "node:test"

import { createOfficialCliAuth } from "../../../src/internal/official-cli-auth.mjs"

test("official browser login uses one verified default executable and fixed argv without a shell", async () => {
  const resolved = []
  const spawned = []
  const verified = []
  const waited = []
  const outputs = ["grok 1.0.5 (5115b46bc909)\n", "Login completed\n"]
  const subprocess = {
    async resolveExecutable(command, env, signal) {
      resolved.push({ command, env, signal })
      return "/Users/fixture/.grok/downloads/grok-macos-aarch64"
    },
    spawn(spec) {
      const index = spawned.length
      spawned.push(spec)
      return {
        done: Promise.resolve({ exitCode: 0, signal: null }),
        collected: {
          stdout: { readFrom: () => ({ text: outputs[index], nextOffset: outputs[index].length, lossy: false }) },
          stderr: { readFrom: () => ({ text: "", nextOffset: 0, lossy: false }) },
        },
        async waitForExit() { waited.push(index); return true },
        terminate() {},
      }
    },
  }
  const auth = createOfficialCliAuth({
    subprocess,
    platform: "darwin",
    homeDir: "/Users/fixture",
    verifyExecutable: async (facts) => { verified.push(facts) },
  })

  const outcome = await auth.login()

  assert.deepEqual(outcome, { kind: "succeeded" })
  assert.equal(resolved[0].command, "/Users/fixture/.grok/bin/grok")
  assert.deepEqual(verified, [{
    candidate: "/Users/fixture/.grok/bin/grok",
    resolved: "/Users/fixture/.grok/downloads/grok-macos-aarch64",
    grokHome: "/Users/fixture/.grok",
    platform: "darwin",
  }])
  assert.deepEqual(spawned.map((spec) => spec.argv), [
    ["/Users/fixture/.grok/downloads/grok-macos-aarch64", "--version"],
    ["/Users/fixture/.grok/downloads/grok-macos-aarch64", "login", "--oauth"],
  ])
  assert.equal(spawned.every((spec) => spec.cwd === "/Users/fixture/.grok"), true)
  assert.equal(spawned.every((spec) => spec.stdio.stdin === "ignore"), true)
  assert.equal(spawned.every((spec) => spec.env.HOME === "/Users/fixture"), true)
  assert.equal(spawned.every((spec) => spec.env.PATH === "/usr/bin:/bin:/usr/sbin:/sbin"), true)
  for (const name of ["BROWSER", "GROK_HOME", "GROK_AUTH_PROVIDER_COMMAND", "NODE_OPTIONS", "SSLKEYLOGFILE", "XAI_API_KEY"]) {
    assert.equal(spawned.every((spec) => Object.hasOwn(spec.env, name) && spec.env[name] === undefined), true)
  }
  assert.deepEqual(waited, [0, 1])
})

test("official browser login owns a deadline and terminates a stalled process tree", async () => {
  let spawned = 0
  let actionSignal
  const subprocess = {
    async resolveExecutable() { return "/Users/fixture/.grok/downloads/grok-macos-aarch64" },
    spawn(spec) {
      spawned += 1
      if (spawned === 1) {
        return {
          done: Promise.resolve({ exitCode: 0, signal: null }),
          collected: {
            stdout: { readFrom: () => ({ text: "grok 1.0.5 (5115b46bc909)\n", lossy: false }) },
            stderr: { readFrom: () => ({ text: "", lossy: false }) },
          },
          async waitForExit() { return true },
          terminate() {},
        }
      }
      actionSignal = spec.signal
      return {
        done: new Promise((resolve) => spec.signal.addEventListener("abort", () => {
          resolve({ exitCode: null, signal: "SIGTERM" })
        }, { once: true })),
        collected: {
          stdout: { readFrom: () => ({ text: "", lossy: false }) },
          stderr: { readFrom: () => ({ text: "", lossy: false }) },
        },
        async waitForExit() { return true },
        terminate() {},
      }
    },
  }
  const auth = createOfficialCliAuth({
    subprocess,
    platform: "darwin",
    homeDir: "/Users/fixture",
    verifyExecutable: async () => {
      await new Promise((resolve) => setTimeout(resolve, 75))
    },
    loginTimeoutMs: 5,
  })

  await assert.rejects(Promise.race([
    auth.login(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("deadline missing")), 500)),
  ]), { name: "OfficialCliAuthError" })
  assert.equal(actionSignal.aborted, true)
})
