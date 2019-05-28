import * as config from "@src/lib/config"
import * as DOM from "@src/lib/dom"
import { browserBg, activeTabId } from "@src/lib/webext"

// The host is the shadow root of a span used to contain all highlighting
// elements. This is the least disruptive way of highlighting text in a page.
// It needs to be placed at the very top of the page.
let host
function getFindHost() {
    if (host) {
        return host
    }
    const elem = document.createElement("span")
    elem.id = "TridactylFindHost"
    elem.className = "cleanslate"
    elem.style.position = "absolute"
    elem.style.top = "0px"
    elem.style.left = "0px"
    document.body.appendChild(elem)
    host = elem.attachShadow({mode: "closed"})
    return host
}

function createHighlightingElement(rect) {
    const highlight = document.createElement("span")
    highlight.className = "TridactylSearchHighlight"
    highlight.style.position = "absolute"
    highlight.style.top = `${rect.top}px`
    highlight.style.left = `${rect.left}px`
    highlight.style.width = `${rect.right - rect.left}px`
    highlight.style.height = `${rect.bottom - rect.top}px`
    unfocusHighlight(highlight)
    return highlight
}

function unfocusHighlight(high) {
    high.style.background = `rgba(127,255,255,0.5)`
}

function focusHighlight(high) {
    if (!DOM.isVisible(high)) {
        high.scrollIntoView()
    }
    high.style.background = `rgba(255,127,255,0.5)`
}

// The previous find query
let lastSearch
// Highlights corresponding to the last search
let lastHighlights
// Which element of `lastSearch` was last selected
let selected = 0

export async function jumpToMatch(searchQuery, reverse) {
    // First, search for the query
    const findcase = config.get("findcase")
    const sensitive = findcase === "sensitive" || (findcase === "smart" && searchQuery.match("[A-Z]"))
    const results = await browserBg.find.find(searchQuery, {
        tabId: await activeTabId(),
        caseSensitive: sensitive,
        entireWord: false,
        includeRectData: true,
    })
    // results are sorted by the order they appear in the page, we need them to
    // be sorted according to position instead
    results.rectData.sort((a, b) => reverse
        ? b.rectsAndTexts.rectList[0].top - a.rectsAndTexts.rectList[0].top
        : a.rectsAndTexts.rectList[0].top - b.rectsAndTexts.rectList[0].top)
    lastSearch = results
    if (results.count < 1)
        return

    // Then, highlight it
    removeHighlighting()
    const host = getFindHost()
    lastHighlights = []
    let focused = false
    for (let i = 0; i < results.rectData.length; ++i) {
        const data = results.rectData[i]
        const highlights = []
        lastHighlights.push(highlights)
        for (const rect of data.rectsAndTexts.rectList) {
            const highlight = createHighlightingElement(rect)
            highlights.push(highlight)
            host.appendChild(highlight)
        }
        if (!focused && DOM.isVisible(highlights[0])) {
            focused = true
            focusHighlight(highlights[0])
            selected = i
        }
    }
    if (!focused) {
        focusHighlight(lastHighlights[0][0])
    }
}

export function jumpToNextMatch(n: number) {
    unfocusHighlight(lastHighlights[selected][0])
    if (!lastSearch) {
        return
    }
    selected = (selected + n + lastSearch.count) % lastSearch.count
    focusHighlight(lastHighlights[selected][0])
}

export function removeHighlighting() {
    const host = getFindHost();
    while (host.firstChild) host.removeChild(host.firstChild)
}
