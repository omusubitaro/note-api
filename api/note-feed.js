import { fetchMagazineItems } from "./_note-rss.js"

export default async function handler(req, res) {
  try {
    const items = await fetchMagazineItems()

    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400")
    return res.status(200).json({ items })
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch note feed",
      details: error instanceof Error ? error.message : String(error),
    })
  }
}
