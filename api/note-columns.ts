type NoteItem = {
  title: string
  link: string
  description: string
  pubDate: string
  thumbnail: string
  author: string
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function extractFirstImage(html: string) {
  const match = html.match(/<img[^>]+src="([^"]+)"/i)
  return match?.[1] ?? ""
}

export default async function handler(req: any, res: any) {
  try {
    const NOTE_RSS_URL = "https://note.com/que_qbo/rss"

    const rssRes = await fetch(NOTE_RSS_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    })

    if (!rssRes.ok) {
      return res.status(500).json({ error: "RSS取得に失敗しました" })
    }

    const rssText = await rssRes.text()
    const items = [...rssText.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1])

    const data: NoteItem[] = items.slice(0, 4).map((item) => {
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

      const creator =
        item.match(/<dc:creator><!\[CDATA\[(.*?)\]\]><\/dc:creator>/)?.[1] ||
        item.match(/<dc:creator>(.*?)<\/dc:creator>/)?.[1] ||
        "note"

      return {
        title: stripHtml(title),
        link: link.trim(),
        description: stripHtml(descriptionRaw).slice(0, 110),
        pubDate,
        thumbnail: extractFirstImage(descriptionRaw),
        author: stripHtml(creator),
      }
    })

    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400")
    return res.status(200).json({ items: data })
  } catch (e) {
    return res.status(500).json({
      error: "データ取得中にエラーが発生しました",
      detail: String(e),
    })
  }
}
