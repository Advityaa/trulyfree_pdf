import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

# Add icons
content = re.sub(r"(import {.*?)(, Hash)(.*?from 'lucide-react';)", r"\1\2, Bookmark, BookmarkPlus, ChevronRight as IconChevronRight, ChevronDown\3", content)

# State
state_vars = """
  const [activeSidebarTab, setActiveSidebarTab] = useState('thumbnails'); // 'thumbnails' | 'bookmarks'
  const [bookmarks, setBookmarks] = useState([]);
"""
content = content.replace("  const [pageOrder, setPageOrder] = useState([]);", "  const [pageOrder, setPageOrder] = useState([]);\n" + state_vars)

# Extraction Logic in loadPdf
extraction_logic = """
        const outline = await pdfDoc.getOutline();
        const flattenOutline = async (items, depth = 0, flattened = []) => {
          if (!items) return flattened;
          for (const item of items) {
             let destPageId = null;
             try {
                let dest = item.dest;
                if (typeof dest === 'string') {
                   dest = await pdfDoc.getDestination(dest);
                }
                if (dest && dest[0]) {
                   const pageIndex = await pdfDoc.getPageIndex(dest[0]);
                   destPageId = initialOrder[pageIndex]?.id || null;
                }
             } catch (e) {
                console.warn("Could not resolve outline destination", e);
             }
             
             flattened.push({
                id: `bm-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
                title: item.title,
                targetPageId: destPageId,
                depth: depth
             });
             
             if (item.items && item.items.length > 0) {
                await flattenOutline(item.items, depth + 1, flattened);
             }
          }
          return flattened;
        };
        const initialBookmarks = await flattenOutline(outline);
        setBookmarks(initialBookmarks);
"""
content = content.replace("setPageOrder(initialOrder);", "setPageOrder(initialOrder);\n" + extraction_logic)

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
