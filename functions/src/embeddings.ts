import { VertexAI } from '@google-cloud/vertexai'

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'gen-lang-client-0137104290'
const VERTEX_LOCATION = 'global'
const VERTEX_API_ENDPOINT = 'aiplatform.googleapis.com'
const EMBEDDING_MODEL = 'text-embedding-005'

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    dot += x * y
    na += x * x
    nb += y * y
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export async function embedText(text: string): Promise<number[]> {
  const input = text.trim().slice(0, 8000)
  if (!input) return []

  const vertex = new VertexAI({
    project: PROJECT_ID,
    location: VERTEX_LOCATION,
    apiEndpoint: VERTEX_API_ENDPOINT,
  })

  // Prefer dedicated embedding model when available; fall back to generative path.
  try {
    const model = vertex.getGenerativeModel({ model: EMBEDDING_MODEL })
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: input }] }],
    })
    const values = extractEmbedding(result)
    if (values.length) return values
  } catch {
    // continue to REST fallback
  }

  const url = `https://${VERTEX_API_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/${VERTEX_LOCATION}/publishers/google/models/${EMBEDDING_MODEL}:predict`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await getAccessToken()}`,
    },
    body: JSON.stringify({
      instances: [{ content: input, task_type: 'SEMANTIC_SIMILARITY' }],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Embedding failed: ${res.status} ${body.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    predictions?: Array<{ embeddings?: { values?: number[] }; values?: number[] }>
  }
  const first = json.predictions?.[0]
  const values = first?.embeddings?.values ?? first?.values ?? []
  if (!values.length) throw new Error('Empty embedding response')
  return values
}

function extractEmbedding(result: unknown): number[] {
  const r = result as {
    response?: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  }
  const text = r.response?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text) return []
  try {
    const parsed = JSON.parse(text) as { embedding?: number[]; values?: number[] }
    return parsed.embedding ?? parsed.values ?? []
  } catch {
    return []
  }
}

async function getAccessToken(): Promise<string> {
  // On Cloud Functions, use metadata server.
  const res = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' } },
  )
  if (!res.ok) throw new Error('Unable to obtain access token for embeddings')
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error('Missing access_token')
  return json.access_token
}

/** Deterministic bag-of-words fallback when Vertex embeddings are unavailable. */
export function fallbackEmbed(text: string, dims = 64): number[] {
  const vec = new Array<number>(dims).fill(0)
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  for (const token of tokens) {
    let hash = 0
    for (let i = 0; i < token.length; i += 1) hash = (hash * 31 + token.charCodeAt(i)) >>> 0
    const idx = hash % dims
    vec[idx] = (vec[idx] ?? 0) + 1
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}

export async function embedTextSafe(text: string): Promise<number[]> {
  try {
    const values = await embedText(text)
    if (values.length) return values
  } catch (err) {
    console.warn('Vertex embedding failed, using fallback', err)
  }
  return fallbackEmbed(text)
}
