import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

bookmarks_logic = """
        // Bookmarks / Outlines Generation
        if (bookmarks && bookmarks.length > 0) {
           const buildTree = (flatList) => {
              const root = { children: [] };
              const path = [root];
              
              for (const bm of flatList) {
                 const node = { ...bm, children: [] };
                 const depth = Math.min(bm.depth || 0, path.length - 1);
                 
                 const parent = path[depth];
                 parent.children.push(node);
                 
                 path[depth + 1] = node;
                 path.length = depth + 2;
              }
              return root.children;
           };
           
           const tree = buildTree(bookmarks);
           
           const outlinesDict = pdfLibDoc.context.obj({ Type: 'Outlines' });
           const outlinesRef = pdfLibDoc.context.register(outlinesDict);
           
           const buildOutlineNodes = (nodes, parentRef) => {
              const refs = nodes.map(n => pdfLibDoc.context.nextRef());
              
              for (let i = 0; i < nodes.length; i++) {
                  const node = nodes[i];
                  const ref = refs[i];
                  
                  let destArray = null;
                  if (node.targetPageId) {
                     const pIdx = pageOrder.findIndex(p => p.id === node.targetPageId);
                     if (pIdx !== -1) {
                        const targetPage = pages[pIdx];
                        destArray = pdfLibDoc.context.obj([targetPage.ref, PDFName.of('XYZ'), null, null, null]);
                     }
                  }
                  
                  const dict = {
                     Title: PDFString.of(node.title || 'Untitled'),
                     Parent: parentRef
                  };
                  if (destArray) dict.Dest = destArray;
                  if (i > 0) dict.Prev = refs[i - 1];
                  if (i < nodes.length - 1) dict.Next = refs[i + 1];
                  
                  if (node.children && node.children.length > 0) {
                     const childRefs = buildOutlineNodes(node.children, ref);
                     dict.First = childRefs[0];
                     dict.Last = childRefs[childRefs.length - 1];
                     dict.Count = node.children.length; 
                  }
                  
                  pdfLibDoc.context.assign(ref, pdfLibDoc.context.obj(dict));
              }
              return refs;
           };
           
           const topLevelRefs = buildOutlineNodes(tree, outlinesRef);
           if (topLevelRefs.length > 0) {
              outlinesDict.set(PDFName.of('First'), topLevelRefs[0]);
              outlinesDict.set(PDFName.of('Last'), topLevelRefs[topLevelRefs.length - 1]);
              pdfLibDoc.catalog.set(PDFName.of('Outlines'), outlinesRef);
           }
        }
"""

content = content.replace("// Bates Numbering", bookmarks_logic + "\n        // Bates Numbering")

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
