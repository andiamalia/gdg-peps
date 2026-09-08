/**
 * Light smoke checks for local PEPS setup (no live Firebase required for parse).
 * With env configured, run against a deployed project for deeper checks.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const required = [
  'package.json',
  'firebase.json',
  'firestore.rules',
  'src/App.tsx',
  'src/lib/ai.ts',
  'functions/src/index.ts',
  'functions/src/embeddings.ts',
  'functions/src/prompts.ts',
]

let failed = false
for (const rel of required) {
  const path = resolve(root, rel)
  if (!existsSync(path)) {
    console.error(`Missing: ${rel}`)
    failed = true
  }
}

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
if (pkg.name !== 'gdg-peps') {
  console.error('package.json name should be gdg-peps')
  failed = true
}

const fnSrc = readFileSync(resolve(root, 'functions/src/index.ts'), 'utf8')
for (const name of ['interviewTurn', 'finalizeProfile', 'findCircle', 'searchCircle']) {
  if (!fnSrc.includes(`export const ${name}`)) {
    console.error(`Missing callable export: ${name}`)
    failed = true
  }
}

if (failed) {
  console.error('Smoke failed')
  process.exit(1)
}

console.log('PEPS smoke OK — scaffold and callable exports present.')
if (!existsSync(resolve(root, '.env'))) {
  console.log('Note: .env not found yet — copy .env.example before running the app.')
}
