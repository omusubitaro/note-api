import vm from "node:vm"

const MAGAZINE_URL = "https://note.com/qboc/m/m20d018cc8d7a"

function extractNuxt(html) {
  const match = html.match(/window\.__NUXT__=(\(function\([\s\S]*?\)\([\s\S]*?\)\);?)/)
  if (!match) throw new Error("NUXT data not found")
  return vm.runInNewContext(match[1], Object.create(null), { timeout: 100 })
}

function stripHtml(input = "") {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function collectNotes(node, out = []) {
  if (!node || typeof node !== "object") return out

  if (
    typeof node.noteUrl === "string" &&
    typeof node.name === "string"
  ) {
    out.push(node)
  }

  for (const value of Array.isArray(node) ? node : Object.values(node)) {
    collectNotes(value, out)
  }

  return out
}

export default async function handler(req, res) {
  try {
    const html = await fetch(MAGAZINE_URL, {
      headers: { "user-agent": "Mozilla/5.0" },
    }).then((r) => r.text())

    const nuxt = extractNuxt(html)
    const seen = new Set()

    const items = collectNotes(nuxt)
      .filter((note) => {
        if (!note.noteUrl) return false
        if (seen.has(note.noteUrl)) return false
        seen.add(note.noteUrl)
        return true
      })
      .map((note) => ({
        title: note.name || "",
        link: note.noteUrl || "",
        description: stripHtml(note.body || note.description || ""),
        pubDate: note.publishAt || "",
        image: note.eyecatch || "",
        thumbnail: note.eyecatch || "",
        author: (note.user && (note.user.nickname || note.user.name)) || "",
        avatar: (note.user && note.user.userProfileImagePath) || "",
        likes: typeof note.likeCount === "number" ? note.likeCount : 0,
      }))

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
