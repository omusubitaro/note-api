export const MAGAZINE_RSS_URL = "https://note.com/qboc/m/m20d018cc8d7a/rss"

function decodeHtmlEntities(input = "") {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim()
}

function stripHtml(input = "") {
  return decodeHtmlEntities(input)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*続きをみる\s*$/, "")
    .trim()
}

function extractTag(block, tagName) {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = block.match(new RegExp(`<${escapedTag}>([\\s\\S]*?)</${escapedTag}>`, "i"))
  return match ? decodeHtmlEntities(match[1]) : ""
}

function extractItems(xml) {
  return xml.match(/<item\b[\s\S]*?<\/item>/gi) || []
}

function parseItem(block) {
  const title = extractTag(block, "title")
  const link = extractTag(block, "link")
  const description = stripHtml(extractTag(block, "description"))
  const pubDate = extractTag(block, "pubDate")
  const thumbnail = extractTag(block, "media:thumbnail")
  const author = extractTag(block, "note:creatorName")
  const avatar = extractTag(block, "note:creatorImage")

  return {
    title,
    link,
    description,
    pubDate,
    image: thumbnail,
    thumbnail,
    author,
    avatar,
  }
}

export async function fetchMagazineItems() {
  const response = await fetch(MAGAZINE_RSS_URL, {
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8",
    },
  })

  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status}`)
  }

  const xml = await response.text()
  const items = extractItems(xml).map(parseItem).filter((item) => item.link && item.title)

  if (!items.length) {
    throw new Error("No RSS items found")
  }

  return items
}
