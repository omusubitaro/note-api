import { fetchMagazineItems } from "./_note-rss.js"

export default async function handler(req, res) {
  try {
    const items = await fetchMagazineItems()

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
