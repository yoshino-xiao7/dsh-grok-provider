import assert from "node:assert/strict"
import test from "node:test"

import { createOfficialCliAuth } from "../../../src/internal/official-cli-auth.mjs"

test("CLI inspection reports one verified safe display version", async () => {
  const executable = "C:\\Users\\fixture\\.grok\\bin\\grok.exe"
  const spawned = []
  const outputs = [
    "grok 1.0.5 (5115b46bc909)\n",
    "Usage: grok login [OPTIONS]\n\nOptions:\n      --oauth  Use browser OAuth\n",
  ]
  const auth = createOfficialCliAuth({
    subprocess: {
      async resolveExecutable() { return executable },
      spawn(spec) {
        const output = outputs[spawned.length]
        spawned.push(spec)
        return {
          done: Promise.resolve({ exitCode: 0, signal: null }),
          collected: {
            stdout: { readFrom: () => ({ text: output, lossy: false }) },
            stderr: { readFrom: () => ({ text: "", lossy: false }) },
          },
          async waitForExit() { return true },
          terminate() {},
        }
      },
    },
    platform: "win32",
    homeDir: "C:\\Users\\fixture",
    verifyExecutable: async () => {},
  })

  assert.deepEqual(await auth.inspect(), {
    state: "ready",
    version: "1.0.5",
  })
  assert.deepEqual(spawned.map((spec) => spec.argv), [
    [executable, "--version"],
    [executable, "login", "--help"],
  ])
})

test("CLI inspection reports a missing default executable without starting a process", async () => {
  let spawned = 0
  let verified = 0
  const auth = createOfficialCliAuth({
    subprocess: {
      async resolveExecutable() { throw new Error("fixture executable missing") },
      spawn() { spawned += 1; throw new Error("missing CLI must not spawn") },
    },
    platform: "win32",
    homeDir: "C:\\Users\\fixture",
    verifyExecutable: async () => { verified += 1 },
  })

  assert.deepEqual(await auth.inspect(), { state: "missing" })
  assert.equal(verified, 0)
  assert.equal(spawned, 0)
})

test("CLI inspection reports an invalid executable when version output is not Grok", async () => {
  const executable = "C:\\Users\\fixture\\.grok\\bin\\grok.exe"
  const auth = createOfficialCliAuth({
    subprocess: {
      async resolveExecutable() { return executable },
      spawn() {
        return {
          done: Promise.resolve({ exitCode: 0, signal: null }),
          collected: {
            stdout: { readFrom: () => ({ text: "not-grok 1.0.5\n", lossy: false }) },
            stderr: { readFrom: () => ({ text: "", lossy: false }) },
          },
          async waitForExit() { return true },
          terminate() {},
        }
      },
    },
    platform: "win32",
    homeDir: "C:\\Users\\fixture",
    verifyExecutable: async () => {},
  })

  assert.deepEqual(await auth.inspect(), { state: "invalid" })
})

test("CLI inspection reports invalid when browser OAuth capability is absent", async () => {
  const executable = "C:\\Users\\fixture\\.grok\\bin\\grok.exe"
  const outputs = [
    "grok 1.0.5 (5115b46bc909)\n",
    "Usage: grok login [OPTIONS]\n\nOptions:\n      --device-auth  Use device authentication\n",
  ]
  let spawned = 0
  const auth = createOfficialCliAuth({
    subprocess: {
      async resolveExecutable() { return executable },
      spawn() {
        const output = outputs[spawned]
        spawned += 1
        return {
          done: Promise.resolve({ exitCode: 0, signal: null }),
          collected: {
            stdout: { readFrom: () => ({ text: output, lossy: false }) },
            stderr: { readFrom: () => ({ text: "", lossy: false }) },
          },
          async waitForExit() { return true },
          terminate() {},
        }
      },
    },
    platform: "win32",
    homeDir: "C:\\Users\\fixture",
    verifyExecutable: async () => {},
  })

  assert.deepEqual(await auth.inspect(), { state: "invalid" })
})

test("CLI inspection cleanup failure isolates and permanently latches that CLI instance", async () => {
  const executable = "C:\\Users\\fixture\\.grok\\bin\\grok.exe"
  let spawned = 0
  let isolated = 0
  const auth = createOfficialCliAuth({
    subprocess: {
      async resolveExecutable() { return executable },
      spawn() {
        spawned += 1
        return {
          done: Promise.resolve({ exitCode: 0, signal: null }),
          collected: {
            stdout: { readFrom: () => ({ text: "grok 1.0.5 (5115b46bc909)\n", lossy: false }) },
            stderr: { readFrom: () => ({ text: "", lossy: false }) },
          },
          async waitForExit() { return false },
          terminate() {},
        }
      },
    },
    platform: "win32",
    homeDir: "C:\\Users\\fixture",
    verifyExecutable: async () => {},
    onCleanupFailure: () => { isolated += 1 },
  })

  assert.deepEqual(await auth.inspect(), { state: "unavailable" })
  assert.equal(spawned, 1)
  assert.equal(isolated, 1)
  assert.deepEqual(await auth.inspect(), { state: "unavailable" })
  await assert.rejects(auth.login(), { name: "OfficialCliCleanupError" })
  assert.equal(spawned, 1)
  assert.equal(isolated, 1)
})

test("CLI inspection cleanup failure aborts an authentication action already in flight", async () => {
  const executable = "C:\\Users\\fixture\\.grok\\bin\\grok.exe"
  const outputs = [
    "grok 1.0.5 (5115b46bc909)\n",
    "Usage: grok login [OPTIONS]\n\nOptions:\n      --oauth  Use browser OAuth\n",
    "",
    "grok 1.0.5 (5115b46bc909)\n",
  ]
  let spawned = 0
  let actionSignal
  let actionStarted
  const actionReady = new Promise((resolve) => { actionStarted = resolve })
  let isolated = 0
  const auth = createOfficialCliAuth({
    subprocess: {
      async resolveExecutable() { return executable },
      spawn(spec) {
        const index = spawned
        spawned += 1
        if (index === 2) {
          actionSignal = spec.signal
          actionStarted()
          return {
            done: new Promise((resolve) => spec.signal.addEventListener("abort", () => {
              resolve({ exitCode: null, signal: "SIGTERM" })
            }, { once: true })),
            collected: {
              stdout: { readFrom: () => ({ text: outputs[index], lossy: false }) },
              stderr: { readFrom: () => ({ text: "", lossy: false }) },
            },
            async waitForExit() { return true },
            terminate() {},
          }
        }
        return {
          done: Promise.resolve({ exitCode: 0, signal: null }),
          collected: {
            stdout: { readFrom: () => ({ text: outputs[index], lossy: false }) },
            stderr: { readFrom: () => ({ text: "", lossy: false }) },
          },
          async waitForExit() { return index !== 3 },
          terminate() {},
        }
      },
    },
    platform: "win32",
    homeDir: "C:\\Users\\fixture",
    verifyExecutable: async () => {},
    onCleanupFailure: () => { isolated += 1 },
  })

  const login = auth.login()
  await actionReady
  assert.equal(actionSignal.aborted, false)
  assert.deepEqual(await auth.inspect(), { state: "unavailable" })
  assert.equal(actionSignal.aborted, true)
  await assert.rejects(login, { name: "OfficialCliCleanupError" })
  assert.equal(spawned, 4)
  assert.equal(isolated, 1)
})

test("Windows Grok CLI 0.2.82 reaches fixed OAuth login after capability discovery", async () => {
  const spawned = []
  const executable = "C:\\Users\\fixture\\.grok\\bin\\grok.exe"
  const outputs = [
    "grok 0.2.82 (6d0b07d2de) [stable]\n",
    "Usage: grok login [OPTIONS]\n\nOptions:\n      --oauth  Use browser OAuth\n",
    "Login completed\n",
  ]
  const subprocess = {
    async resolveExecutable() { return executable },
    spawn(spec) {
      const index = spawned.length
      spawned.push(spec)
      return {
        done: Promise.resolve({ exitCode: 0, signal: null }),
        collected: {
          stdout: { readFrom: () => ({ text: outputs[index], lossy: false }) },
          stderr: { readFrom: () => ({ text: "", lossy: false }) },
        },
        async waitForExit() { return true },
        terminate() {},
      }
    },
  }
  const auth = createOfficialCliAuth({
    subprocess,
    platform: "win32",
    homeDir: "C:\\Users\\fixture",
    verifyExecutable: async () => {},
  })

  assert.deepEqual(await auth.login(), { kind: "succeeded" })
  assert.deepEqual(spawned.map((spec) => spec.argv), [
    [executable, "--version"],
    [executable, "login", "--help"],
    [executable, "login", "--oauth"],
  ])
})

test("Windows CLI cold-start preflight stages receive independent deadline budgets", async () => {
  const spawned = []
  let resolveSignal
  let verifySignal
  const executable = "C:\\Users\\fixture\\.grok\\bin\\grok.exe"
  const outputs = [
    "grok 0.2.82 (6d0b07d2de) [stable]\n",
    "Usage: grok login [OPTIONS]\n\nOptions:\n      --oauth  Use browser OAuth\n",
    "Login completed\n",
  ]
  const delays = [60, 60, 0]
  const subprocess = {
    async resolveExecutable(_candidate, _options, signal) {
      resolveSignal = signal
      await new Promise((resolve) => setTimeout(resolve, 60))
      return executable
    },
    spawn(spec) {
      const index = spawned.length
      spawned.push(spec)
      const done = new Promise((resolve) => {
        let timer
        const settle = (outcome) => {
          clearTimeout(timer)
          spec.signal.removeEventListener("abort", onAbort)
          resolve(outcome)
        }
        const onAbort = () => settle({ exitCode: null, signal: "SIGTERM" })
        if (spec.signal.aborted) onAbort()
        else {
          spec.signal.addEventListener("abort", onAbort, { once: true })
          timer = setTimeout(() => settle({ exitCode: 0, signal: null }), delays[index])
        }
      })
      return {
        done,
        collected: {
          stdout: { readFrom: () => ({ text: outputs[index], lossy: false }) },
          stderr: { readFrom: () => ({ text: "", lossy: false }) },
        },
        async waitForExit() { return true },
        terminate() {},
      }
    },
  }
  const auth = createOfficialCliAuth({
    subprocess,
    platform: "win32",
    homeDir: "C:\\Users\\fixture",
    verifyExecutable: async (_facts, signal) => {
      verifySignal = signal
      await new Promise((resolve) => setTimeout(resolve, 60))
    },
    versionTimeoutMs: 100,
  })

  assert.deepEqual(await auth.login(), { kind: "succeeded" })
  const stageSignals = [resolveSignal, verifySignal, ...spawned.map((spec) => spec.signal)]
  assert.equal(new Set(stageSignals).size, stageSignals.length)
  assert.notEqual(resolveSignal, spawned[0].signal)
  assert.notEqual(resolveSignal, verifySignal)
  assert.notEqual(verifySignal, spawned[0].signal)
  assert.notEqual(spawned[0].signal, spawned[1].signal)
  assert.notEqual(spawned[1].signal, spawned[2].signal)
  await new Promise((resolve) => setTimeout(resolve, 120))
  assert.equal(stageSignals.every((signal) => signal.aborted === false), true)
})

test("executable verification observes its own deadline before any CLI process starts", async () => {
  let spawned = 0
  let verifySignal
  const auth = createOfficialCliAuth({
    subprocess: {
      async resolveExecutable() {
        return "C:\\Users\\fixture\\.grok\\bin\\grok.exe"
      },
      spawn() {
        spawned += 1
        throw new Error("verification timeout must fail before spawn")
      },
    },
    platform: "win32",
    homeDir: "C:\\Users\\fixture",
    verifyExecutable: async (_facts, signal) => {
      verifySignal = signal
      await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }))
      signal.throwIfAborted()
    },
    versionTimeoutMs: 5,
  })

  await assert.rejects(Promise.race([
    auth.login(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("deadline missing")), 500)),
  ]), { name: "OfficialCliAuthError" })
  assert.equal(verifySignal.aborted, true)
  assert.equal(spawned, 0)
})

test("browser login fails closed before the action when OAuth capability is absent", async () => {
  const spawned = []
  const outputs = [
    "grok 9.9.9 (future-build) [stable]\n",
    "Usage: grok login [OPTIONS]\n\nOptions:\n      --device-auth  Use device-code authentication\n",
  ]
  const subprocess = {
    async resolveExecutable() { return "/Users/fixture/.grok/bin/grok" },
    spawn(spec) {
      const index = spawned.length
      spawned.push(spec)
      return {
        done: Promise.resolve({ exitCode: 0, signal: null }),
        collected: {
          stdout: { readFrom: () => ({ text: outputs[index], lossy: false }) },
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
    verifyExecutable: async () => {},
  })

  await assert.rejects(auth.login(), { name: "OfficialCliAuthError" })
  assert.deepEqual(spawned.map((spec) => spec.argv), [
    ["/Users/fixture/.grok/bin/grok", "--version"],
    ["/Users/fixture/.grok/bin/grok", "login", "--help"],
  ])
})

test("malformed version output fails closed before capability discovery", async () => {
  const spawned = []
  const subprocess = {
    async resolveExecutable() { return "/Users/fixture/.grok/bin/grok" },
    spawn(spec) {
      spawned.push(spec)
      return {
        done: Promise.resolve({ exitCode: 0, signal: null }),
        collected: {
          stdout: { readFrom: () => ({ text: "not-grok 0.2.82\n", lossy: false }) },
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
    verifyExecutable: async () => {},
  })

  await assert.rejects(auth.login(), { name: "OfficialCliAuthError" })
  assert.deepEqual(spawned.map((spec) => spec.argv), [
    ["/Users/fixture/.grok/bin/grok", "--version"],
  ])
})

test("official browser login uses one verified default executable and fixed argv without a shell", async () => {
  const resolved = []
  const spawned = []
  const verified = []
  const waited = []
  const outputs = [
    "grok 1.0.5 (5115b46bc909)\n",
    "Usage: grok login [OPTIONS]\n\nOptions:\n      --oauth  Use browser OAuth\n",
    "Login completed\n",
  ]
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
    ["/Users/fixture/.grok/downloads/grok-macos-aarch64", "login", "--help"],
    ["/Users/fixture/.grok/downloads/grok-macos-aarch64", "login", "--oauth"],
  ])
  assert.equal(spawned.every((spec) => spec.cwd === "/Users/fixture/.grok"), true)
  assert.equal(spawned.every((spec) => spec.stdio.stdin === "ignore"), true)
  assert.equal(spawned.every((spec) => spec.env.HOME === "/Users/fixture"), true)
  assert.equal(spawned.every((spec) => spec.env.PATH === "/usr/bin:/bin:/usr/sbin:/sbin"), true)
  for (const name of ["BROWSER", "GROK_HOME", "GROK_AUTH_PROVIDER_COMMAND", "NODE_OPTIONS", "SSLKEYLOGFILE", "XAI_API_KEY"]) {
    assert.equal(spawned.every((spec) => Object.hasOwn(spec.env, name) && spec.env[name] === undefined), true)
  }
  assert.deepEqual(waited, [0, 1, 2])
})

test("OIDC discovery timeout becomes one closed login failure without exposing CLI output", async () => {
  const executable = "C:\\Users\\fixture\\.grok\\bin\\grok.exe"
  const spawned = []
  const outputs = [
    { stdout: "grok 1.0.5 (5115b46bc9)\n", stderr: "", exitCode: 0 },
    { stdout: "Usage: grok login [OPTIONS]\n\nOptions:\n      --oauth  Use browser OAuth\n", stderr: "", exitCode: 0 },
    {
      stdout: "",
      stderr: "Error: error sending request for url (https://auth.x.ai/.well-known/openid-configuration): operation timed out\n",
      exitCode: 1,
    },
  ]
  const auth = createOfficialCliAuth({
    subprocess: {
      async resolveExecutable() { return executable },
      spawn(spec) {
        const output = outputs[spawned.length]
        spawned.push(spec)
        return {
          done: Promise.resolve({ exitCode: output.exitCode, signal: null }),
          collected: {
            stdout: { readFrom: () => ({ text: output.stdout, lossy: false }) },
            stderr: { readFrom: () => ({ text: output.stderr, lossy: false }) },
          },
          async waitForExit() { return true },
          terminate() {},
        }
      },
    },
    platform: "win32",
    homeDir: "C:\\Users\\fixture",
    verifyExecutable: async () => {},
  })

  const outcome = await auth.login()
  assert.deepEqual(outcome, { kind: "failed", reason: "auth-network-timeout" })
  assert.deepEqual(Object.keys(outcome), ["kind", "reason"])
  assert.doesNotMatch(JSON.stringify(outcome), /auth\.x\.ai|openid-configuration|operation timed out/iu)
  assert.deepEqual(spawned.map((spec) => spec.argv), [
    [executable, "--version"],
    [executable, "login", "--help"],
    [executable, "login", "--oauth"],
  ])
})

test("an unknown nonzero login exit becomes a generic closed failure", async () => {
  const executable = "/Users/fixture/.grok/bin/grok"
  const outputs = [
    { stdout: "grok 1.0.5 (5115b46bc909)\n", stderr: "", exitCode: 0 },
    { stdout: "Usage: grok login [OPTIONS]\n\nOptions:\n      --oauth  Use browser OAuth\n", stderr: "", exitCode: 0 },
    { stdout: "", stderr: "fixture upstream detail that must remain private\n", exitCode: 1 },
  ]
  let spawned = 0
  const auth = createOfficialCliAuth({
    subprocess: {
      async resolveExecutable() { return executable },
      spawn() {
        const output = outputs[spawned]
        spawned += 1
        return {
          done: Promise.resolve({ exitCode: output.exitCode, signal: null }),
          collected: {
            stdout: { readFrom: () => ({ text: output.stdout, lossy: false }) },
            stderr: { readFrom: () => ({ text: output.stderr, lossy: false }) },
          },
          async waitForExit() { return true },
          terminate() {},
        }
      },
    },
    platform: "darwin",
    homeDir: "/Users/fixture",
    verifyExecutable: async () => {},
  })

  const outcome = await auth.login()
  assert.deepEqual(outcome, { kind: "failed", reason: "cli-failed" })
  assert.doesNotMatch(JSON.stringify(outcome), /fixture upstream detail/iu)
})

test("official browser login maps its action deadline and terminates a stalled process tree", async () => {
  let spawned = 0
  let actionSignal
  const subprocess = {
    async resolveExecutable() { return "/Users/fixture/.grok/downloads/grok-macos-aarch64" },
    spawn(spec) {
      spawned += 1
      if (spawned <= 2) {
        const output = spawned === 1
          ? "grok 1.0.5 (5115b46bc909)\n"
          : "Usage: grok login [OPTIONS]\n\nOptions:\n      --oauth  Use browser OAuth\n"
        return {
          done: Promise.resolve({ exitCode: 0, signal: null }),
          collected: {
            stdout: { readFrom: () => ({ text: output, lossy: false }) },
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

  assert.deepEqual(await Promise.race([
    auth.login(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("deadline missing")), 500)),
  ]), { kind: "failed", reason: "login-timeout" })
  assert.equal(actionSignal.aborted, true)
})

test("a stage deadline also bounds process-tree teardown", async () => {
  let stageSignal
  let teardownSignal
  let terminations = 0
  const auth = createOfficialCliAuth({
    subprocess: {
      async resolveExecutable() {
        return "/Users/fixture/.grok/downloads/grok-macos-aarch64"
      },
      spawn(spec) {
        stageSignal = spec.signal
        return {
          done: new Promise((resolve) => spec.signal.addEventListener("abort", () => {
            resolve({ exitCode: null, signal: "SIGTERM" })
          }, { once: true })),
          collected: {
            stdout: { readFrom: () => ({ text: "", lossy: false }) },
            stderr: { readFrom: () => ({ text: "", lossy: false }) },
          },
          waitForExit(signal) {
            teardownSignal = signal
            if (signal === undefined) return new Promise(() => {})
            return new Promise((resolve) => {
              if (signal.aborted) resolve(false)
              else signal.addEventListener("abort", () => resolve(false), { once: true })
            })
          },
          terminate() { terminations += 1 },
        }
      },
    },
    platform: "darwin",
    homeDir: "/Users/fixture",
    verifyExecutable: async () => {},
    versionTimeoutMs: 5,
  })

  await assert.rejects(settlesWithin(auth.refresh(), 100), { name: "OfficialCliCleanupError" })
  assert.equal(stageSignal.aborted, true)
  assert.equal(teardownSignal?.aborted, true)
  assert.equal(terminations >= 1, true)
})

test("a stage deadline does not depend on the direct process done promise settling", async () => {
  let stageSignal
  let waits = 0
  const auth = createOfficialCliAuth({
    subprocess: {
      async resolveExecutable() {
        return "/Users/fixture/.grok/downloads/grok-macos-aarch64"
      },
      spawn(spec) {
        stageSignal = spec.signal
        return {
          done: new Promise(() => {}),
          collected: {
            stdout: { readFrom: () => ({ text: "", lossy: false }) },
            stderr: { readFrom: () => ({ text: "", lossy: false }) },
          },
          async waitForExit() {
            waits += 1
            return true
          },
          terminate() {},
        }
      },
    },
    platform: "darwin",
    homeDir: "/Users/fixture",
    verifyExecutable: async () => {},
    versionTimeoutMs: 5,
  })

  await assert.rejects(settlesWithin(auth.refresh(), 100), { name: "OfficialCliAuthError" })
  assert.equal(stageSignal.aborted, true)
  assert.equal(waits, 1)
})

test("caller abort during process-tree wait cannot be reported as success", async () => {
  const caller = new AbortController()
  let spawned = 0
  let releaseActionWait
  let actionWaitStarted
  const actionWait = new Promise((resolve) => { actionWaitStarted = resolve })
  const outputs = [
    "grok 1.0.5 (5115b46bc909)\n",
    "Usage: grok login [OPTIONS]\n\nOptions:\n      --oauth  Use browser OAuth\n",
    "Login completed\n",
  ]
  const auth = createOfficialCliAuth({
    subprocess: {
      async resolveExecutable() {
        return "/Users/fixture/.grok/downloads/grok-macos-aarch64"
      },
      spawn(spec) {
        const index = spawned
        spawned += 1
        return {
          done: Promise.resolve({ exitCode: 0, signal: null }),
          collected: {
            stdout: { readFrom: () => ({ text: outputs[index], lossy: false }) },
            stderr: { readFrom: () => ({ text: "", lossy: false }) },
          },
          async waitForExit() {
            if (index < 2) return true
            actionWaitStarted()
            return new Promise((resolve) => { releaseActionWait = () => resolve(true) })
          },
          terminate() {},
        }
      },
    },
    platform: "darwin",
    homeDir: "/Users/fixture",
    verifyExecutable: async () => {},
  })

  const login = auth.login({ signal: caller.signal })
  await settlesWithin(actionWait, 100)
  caller.abort(new DOMException("Cancelled", "AbortError"))
  releaseActionWait()

  assert.deepEqual(await settlesWithin(login, 100), { kind: "cancelled" })
})

test("official credential refresh uses the verified CLI models command", async () => {
  const spawned = []
  const outputs = ["grok 1.0.5 (5115b46bc909)\n", "Available models:\n  * grok-4.6\n"]
  const subprocess = {
    async resolveExecutable() { return "/Users/fixture/.grok/downloads/grok-macos-aarch64" },
    spawn(spec) {
      const index = spawned.length
      spawned.push(spec)
      return {
        done: Promise.resolve({ exitCode: 0, signal: null }),
        collected: {
          stdout: { readFrom: () => ({ text: outputs[index], lossy: false }) },
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
    verifyExecutable: async () => {},
  })

  assert.deepEqual(await auth.refresh(), { kind: "succeeded" })
  assert.deepEqual(spawned.map((spec) => spec.argv), [
    ["/Users/fixture/.grok/downloads/grok-macos-aarch64", "--version"],
    ["/Users/fixture/.grok/downloads/grok-macos-aarch64", "models"],
  ])
})

async function settlesWithin(promise, timeoutMs) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("operation did not settle in time")), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
