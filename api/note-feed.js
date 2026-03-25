export default async function handler(req, res) {
  try {
    const rssUrl = "https://note.com/qboc/m/m20d018cc8d7a/rss"

    const rssRes = await fetch(rssUrl)
    const rssText = await rssRes.text()

    const items = [...rssText.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .slice(0, 4)
      .map((match) => {
        const xml = match[1]

        const title =
          xml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
          xml.match(/<title>(.*?)<\/title>/)?.[1] ||
          ""

        const link = xml.match(/<link>(.*?)<\/link>/)?.[1] || ""

        const pubDate = xml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ""

        const image =
          xml.match(/media:thumbnail[^>]*url="([^"]+)"/)?.[1] ||
          xml.match(/media:content[^>]*url="([^"]+)"/)?.[1] ||
          xml.match(/<img[^>]+src="([^"]+)"/)?.[1] ||
          ""

        return { title, link, pubDate, image }
      })

    res.setHeader("Access-Control-Allow-Origin", "*")
    res.status(200).json({ items })
  } catch (e) {
    res.status(500).json({ error: "error" })
  }
}
