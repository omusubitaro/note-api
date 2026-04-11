import vm from "node:vm"

const MAGAZINE_URL = "https://note.com/qboc/m/m20d018cc8d7a"

function extractNuxt(html: string) {
    const match = html.match(
        /window\.__NUXT__=(\(function\([\s\S]*?\)\([\s\S]*?\)\);?)<\/script>/
    )
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

function collectNotes(node: any, out: any[] = []) {
    if (!node || typeof node !== "object") return out

    if (
        typeof node.noteUrl === "string" &&
        typeof node.name === "string" &&
        typeof node.likeCount === "number"
    ) {
        out.push(node)
    }

    for (const value of Array.isArray(node) ? node : Object.values(node)) {
        collectNotes(value, out)
    }

    return out
}

export default async function handler(req: any, res: any) {
    const html = await fetch(MAGAZINE_URL, {
        headers: { "user-agent": "Mozilla/5.0" },
    }).then((r) => r.text())

    const nuxt = extractNuxt(html)
    const seen = new Set<string>()

    const items = collectNotes(nuxt)
        .filter((note) => {
            if (seen.has(note.noteUrl)) return false
            seen.add(note.noteUrl)
            return true
        })
        .map((note) => ({
            title: note.name,
            link: note.noteUrl,
            description: stripHtml(note.body || note.description || ""),
            pubDate: note.publishAt,
            thumbnail: note.eyecatch || "",
            author: note.user?.nickname || note.user?.name || "",
            avatar: note.user?.userProfileImagePath || "",
            likes: note.likeCount,
        }))

    res.status(200).json({ items })
}
