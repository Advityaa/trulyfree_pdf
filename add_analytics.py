with open("src/App.jsx", "r") as f:
    content = f.read()

# Add import
content = content.replace("import './App.css';", "import './App.css';\nimport { Analytics } from '@vercel/analytics/react';")

# Add component
content = content.replace("      </Routes>\n    </Router>\n  );\n}", "      </Routes>\n      <Analytics />\n    </Router>\n  );\n}")

with open("src/App.jsx", "w") as f:
    f.write(content)
