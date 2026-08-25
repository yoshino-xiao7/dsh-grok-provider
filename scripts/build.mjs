import { copyFile, mkdir, readdir, readFile, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
const output = path.join(root, "dist")

await rm(output, { recursive: true, force: true })
await copyTree(path.join(root, "src", "host"), path.join(output, "host"))
await copyTree(path.join(root, "src", "internal"), path.join(output, "internal"))
await mkdir(path.join(output, "client"), { recursive: true })
await copyFile(path.join(root, "client.js"), path.join(output, "client", "client.js"))

const client = await readFile(path.join(output, "client", "client.js"), "utf8")
if (/node:fs|node:path|refreshToken|accessToken|auth\.json/u.test(client)) {
  throw new Error("The browser artifact crossed the Host credential boundary")
}

async function copyTree(source, target) {
  await mkdir(target, { recursive: true })
  const entries = await readdir(source, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"))
  for (const entry of entries) {
    const from = path.join(source, entry.name)
    const to = path.join(target, entry.name)
    if (entry.isDirectory()) await copyTree(from, to)
    else if (entry.isFile()) await copyFile(from, to)
    else throw new Error(`Unsupported build input: ${entry.name}`)
  }
}
