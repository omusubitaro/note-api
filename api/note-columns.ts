import vm from "node:vm"

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
  return decodeHtml(
    html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  )
}

function pickMeta(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["']`, "i"),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match && match[1]) return decodeHtml(match[1])
  }

  return ""
}

function extractFirstImage(html) {
  const og = pickMeta(html, "og:image")
  if (og) return og

  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return match ? match[1] : ""
}

function extractNuxt(html) {
  const match = html.match(
    /window\.__NUXT__=(\(function\([\s\S]*?\)\([\s\S]*?\)\);?)/
  )

  if (!match) return null

  try {
    return vm.runInNewContext(match[1], Object.create(null), { timeout: 100 })
  } catch {
    return null
  }
}

function findNoteData(node) {
  if (!node || typeof node !== "object") return null

  if (
    typeof node.noteUrl === "string" &&
    typeof node.name === "string" &&
    typeof node.likeCount === "number"
  ) {
    return node
  }

  const values = Array.isArray(node) ? node : Object.values(node)

  for (const value of values) {
    const found = findNoteData(value)
    if (found) return found
  }

  return null
}

async function fetchArticleMeta(link) {
  try {
    const res = await fetch(link, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    })

    if (!res.ok) {
      return {
        thumbnail: "",
        author: "",
        avatar: "",
        likes: 0,
      }
    }

    const html = await res.text()
    const nuxt = extractNuxt(html)
    const note = nuxt ? findNoteData(nuxt) : null

    const title =
      (note && note.name) ||
      pickMeta(html, "og:title") ||
      (html.match(/<title>(.*?)<\/title>/i) || [])[1] ||
      ""

    const description =
      (note && (note.body || note.description)) ||
      pickMeta(html, "og:description") ||
      pickMeta(html, "description") ||
      ""

    const thumbnail =
      (note && note.eyecatch) ||
      extractFirstImage(html)

    const author =
      (note &&
        note.user &&
        (note.user.nickname || note.user.name || "")) ||
      (html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i) || [])[1] ||
      ""

    const avatar =
      (note &&
        note.user &&
        note.user.userProfileImagePath) ||
      ""

    const likes =
      note && typeof note.likeCount === "number"
        ? note.likeCount
        : 0

    return {
      title: stripHtml(title),
      description: stripHtml(description),
      thumbnail,
      author: stripHtml(author),
      avatar,
      likes,
    }
  } catch {
    return {
      thumbnail: "",
      author: "",
      avatar: "",
      likes: 0,
    }
  }
}

export default async function handler(req, res) {
  try {
    const NOTE_RSS_URL = "https://note.com/qboc/m/m20d018cc8d7a/rss"

    const rssRes = await fetch(NOTE_RSS_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
    })

    const rssText = await rssRes.text()

    if (!rssRes.ok) {
      return res.status(500).json({
        error: "RSS取得に失敗しました",
        status: rssRes.status,
        url: NOTE_RSS_URL,
      })
    }

    const items = [...rssText.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1])

    const baseItems = items.slice(0, 9).map((item) => {
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

      return {
        title: stripHtml(title),
        link,
        description: stripHtml(descriptionRaw),
        pubDate,
      }
    })

    const enriched = await Promise.all(
      baseItems.map(async (item) => {
        const meta = await fetchArticleMeta(item.link)

        return {
          title: meta.title || item.title,
          link: item.link,
          description: meta.description || item.description,
          pubDate: item.pubDate,
          thumbnail: meta.thumbnail || "",
          author: meta.author || "note",
          avatar: meta.avatar || "",
          likes: meta.likes || 0,
        }
      })
    )

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
