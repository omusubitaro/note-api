import vm from "node:vm"

const NOTE_RSS_URL = "https://note.com/qboc/m/m20d018cc8d7a/rss"
const NOTE_MAGAZINE_URL = "https://note.com/qboc/m/m20d018cc8d7a"

function decodeHtml(text = "") {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function stripHtml(html = "") {
  return decodeHtml(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
}

function extractNuxt(html) {
  const match = html.match(/window\.__NUXT__=(\(function\([\s\S]*?\)\([\s\S]*?\)\);?)/)
  if (!match) return null

  try {
    return vm.runInNewContext(match[1], Object.create(null), { timeout: 100 })
  } catch {
    return null
  }
}

function collectNotes(node, out = []) {
  if (!node || typeof node !== "object") return out

  if (
    typeof node.noteUrl === "string" &&
    typeof node.name === "string" &&
    typeof node.likeCount === "number"
  ) {
    out.push(node)
  }

  for (const value of Array.isArray(node) ? node : Object.values(node)) {
    collectNotes(value, out)
  }

  return out
}

async function fetchMagazineMetaMap() {
  const res = await fetch(NOTE_MAGAZINE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  })

  if (!res.ok) return new Map()

  const html = await res.text()
  const nuxt = extractNuxt(html)
  if (!nuxt) return new Map()

  const notes = collectNotes(nuxt)
  const map = new Map()

  for (const note of notes) {
    if (!note.noteUrl || map.has(note.noteUrl)) continue

    map.set(note.noteUrl, {
      title: stripHtml(note.name || ""),
      description: stripHtml(note.body || note.description || ""),
      thumbnail: note.eyecatch || "",
      author:
        (note.user && (note.user.nickname || note.user.name)) || "",
      avatar:
        (note.user && note.user.userProfileImagePath) || "",
      likes:
        typeof note.likeCount === "number" ? note.likeCount : 0,
      pubDate: note.publishAt || "",
    })
  }

  return map
}

export default async function handler(req, res) {
  try {
    const [rssRes, metaMap] = await Promise.all([
      fetch(NOTE_RSS_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
      }),
      fetchMagazineMetaMap(),
    ])

    const rssText = await rssRes.text()

    if (!rssRes.ok) {
      return res.status(500).json({
        error: "RSS取得に失敗しました",
        status: rssRes.status,
        url: NOTE_RSS_URL,
      })
    }

    const items = [...rssText.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1])

    const enriched = items.slice(0, 9).map((item) => {
      const title =
        (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || [])[1] ||
        (item.match(/<title>(.*?)<\/title>/) || [])[1] ||
        ""

      const link = ((item.match(/<link>(.*?)<\/link>/) || [])[1] || "").trim()

      const descriptionRaw =
        (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || [])[1] ||
        (item.match(/<description>([\s\S]*?)<\/description>/) || [])[1] ||
        ""

      const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || ""
      const meta = metaMap.get(link) || {}

      return {
        title: meta.title || stripHtml(title),
        link,
        description: meta.description || stripHtml(descriptionRaw),
        pubDate: meta.pubDate || pubDate,
        thumbnail: meta.thumbnail || "",
        author: meta.author || "note",
        avatar: meta.avatar || "",
        likes: typeof meta.likes === "number" ? meta.likes : 0,
      }
    })

    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400")
    return res.status(200).json({ items: enriched })
  } catch (e) {
    return res.status(500).json({
      error: "データ取得中にエラーが発生しました",
      detail: String((e && e.message) || e),
    })
  }
}
