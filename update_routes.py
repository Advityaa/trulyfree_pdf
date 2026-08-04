import re

with open("src/App.jsx", "r") as f:
    content = f.read()

# Add import
content = content.replace("import CompareWorkspace from './pages/CompareWorkspace';", "import CompareWorkspace from './pages/CompareWorkspace';\nimport BatchWorkspace from './pages/BatchWorkspace';")

# Add route
content = content.replace("<Route path=\"/tool/compare\" element={<CompareWorkspace />} />", "<Route path=\"/tool/compare\" element={<CompareWorkspace />} />\n        <Route path=\"/tool/batch\" element={<BatchWorkspace />} />")

with open("src/App.jsx", "w") as f:
    f.write(content)

with open("src/pages/Home.jsx", "r") as f:
    home_content = f.read()

# Add to Home tools array
batch_tool = "      { id: 'batch', name: 'Batch Process', icon: FileEdit, path: '/tool/batch' },"
home_content = home_content.replace("{ id: 'compare', name: 'Compare PDFs', icon: GitCompare, path: '/tool/compare' }", "{ id: 'compare', name: 'Compare PDFs', icon: GitCompare, path: '/tool/compare' },\n" + batch_tool)

with open("src/pages/Home.jsx", "w") as f:
    f.write(home_content)
