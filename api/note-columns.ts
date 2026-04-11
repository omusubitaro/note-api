export default async function handler(req, res) {
  try {
    const feedRes = await fetch("https://note-api-5ekj.vercel.app/api/note-feed", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    })

    const text = await feedRes.text()

    if (!feedRes.ok) {
      return res.status(500).json({
        error: "note-feed取得に失敗しました",
        status: feedRes.status,
        detail: text,
      })
    }

    const data = JSON.parse(text)

    const items = Array.isArray(data.items)
      ? data.items.map((item) => ({
          title: item.title || "",
          link: item.link || "",
          description: item.description || "",
          pubDate: item.pubDate || "",
          thumbnail: item.thumbnail || item.image || "",
          author: item.author || "",
          avatar: item.avatar || "",
          likes: typeof item.likes === "number" ? item.likes : 0,
        }))
      : []

    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400")
    return res.status(200).json({ items })
  } catch (e) {
    return res.status(500).json({
      error: "データ取得中にエラーが発生しました",
      detail: String((e && e.message) || e),
    })
  }
}
