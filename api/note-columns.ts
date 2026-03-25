type NoteItem = {
  title: string
  link: string
  description: string
  pubDate: string
  thumbnail: string
  author: string
  avatar: string
  likes: number
}

function decodeHtml(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function stripHtml(html: string) {
  return decodeHtml(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
}

function pickMeta(html: string, key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["']`, "i"),
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]) return decodeHtml(m[1])
  }
  return ""
}

function extractFirstImage(html: string) {
  const og = pickMeta(html, "og:image")
  if (og) return og

  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return m?.[1] ?? ""
}

function extractAvatar(html: string, author: string) {
  const escapedAuthor = author.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  const patterns = [
    new RegExp(`<img[^>]+src=["']([^"']+)["'][^>]*alt=["']${escapedAuthor}["']`, "i"),
    new RegExp(`<img[^>]+alt=["']${escapedAuthor}["'][^>]*src=["']([^"']+)["']`, "i"),
    /"profileImageUrl":"([^"]+)"/i,
    /"userProfileImagePath":"([^"]+)"/i,
  ]

  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]) {
      return decodeHtml(m[1].replace(/\\u002F/g, "/").replace(/\\/g, ""))
    }
  }

  return ""
}

function extractLikes(html: string) {
  const patterns = [
    /"likeCount":\s*(\d+)/i,
    /"favoriteCount":\s*(\d+)/i,
    /"clapCount":\s*(\d+)/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["'][^"']*?(\d+)[^"']*["']/i,
  ]

  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]) return Number(m[1])
  }

  const plain = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, "\n")
    .replace(/\s+/g, " ")

  const m = plain.match(/いいなと思ったら応援しよう！[\s\S]{0,80}?(\d{1,5})/)
  if (m?.[1]) return Number(m[1])

  return 0
}

async function fetchArticleMeta(link: string) {
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

    const title =
      pickMeta(html, "og:title") ||
      html.match(/<title>(.*?)<\/title>/i)?.[1] ||
      ""

    const description =
      pickMeta(html, "og:description") ||
      pickMeta(html, "description") ||
      ""

    const thumbnail = extractFirstImage(html)

    const author =
      html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/"author":\s*\{"@type":"Person","name":"([^"]+)"/i)?.[1] ||
      html.match(/<img[^>]+alt=["']([^"']+)["'][^>]*>/i)?.[1] ||
      ""

    const avatar = extractAvatar(html, author || "")
    const likes = extractLikes(html)

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

export default async function handler(req: any, res: any) {
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

    const baseItems = items.slice(0, 4).map((item) => {
      const title =
        item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
        item.match(/<title>(.*?)<\/title>/)?.[1] ||
        ""

      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ""

      const descriptionRaw =
        item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ||
        item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ||
        ""

      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ""

      return {
        title: stripHtml(title),
        link: link.trim(),
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
        } satisfies NoteItem
      })
    )

    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400")
    return res.status(200).json({ items: enriched })
  } catch (e: any) {
    return res.status(500).json({
      error: "データ取得中にエラーが発生しました",
      detail: String(e?.message || e),
    })
  }
}
