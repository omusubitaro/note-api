export default async function handler(req, res) {
  try {
    const rssUrl = "https://note.com/qboc/m/m20d018cc8d7a/rss"

    const rssRes = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
    })
    const rssText = await rssRes.text()

    const rawItems = [...rssText.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 4)

    const items = await Promise.all(
      rawItems.map(async (match) => {
        const xml = match[1]

        const title =
          xml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
          xml.match(/<title>(.*?)<\/title>/)?.[1] ||
          ""

        const link =
          xml.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ||
          ""

        const pubDate =
          xml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ||
          ""

        let image =
          xml.match(/media:thumbnail[^>]*url="([^"]+)"/i)?.[1] ||
          xml.match(/media:content[^>]*url="([^"]+)"/i)?.[1] ||
          xml.match(/<img[^>]+src="([^"]+)"/i)?.[1] ||
          ""

        if (!image && link) {
          try {
            const articleRes = await fetch(link, {
              headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              },
            })
            const articleHtml = await articleRes.text()

            image =
              articleHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
              articleHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
              articleHtml.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
              articleHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)?.[1] ||
              ""
          } catch (e) {
            // 記事HTML取得失敗時は空のまま
          }
        }

        return { title, link, pubDate, image }
      })
    )

    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400")
    res.status(200).json({ items })
  } catch (e) {
    res.status(500).json({ error: "error" })
  }
}
