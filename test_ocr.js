const fs = require('fs');
fetch("http://localhost:8000/api/health").then(r => r.json()).then(console.log);
