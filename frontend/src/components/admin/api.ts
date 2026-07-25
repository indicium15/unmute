export { API_BASE_URL, authHeaders } from "@/lib/api"

export const PAGE_SIZE = 25

export async function throwIfNotOk(res: Response): Promise<void> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { detail?: string }).detail ?? `HTTP ${res.status}`)
  }
}
