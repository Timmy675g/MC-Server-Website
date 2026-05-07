const fs = require('fs');
let css = fs.readFileSync('src/style.css', 'utf-8');
css = css.replace(/}}$/, '}\n}\n');
fs.writeFileSync('src/style.css', css);
