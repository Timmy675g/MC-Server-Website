const fs = require('fs');

let css = fs.readFileSync('src/style.css', 'utf-8');

// The CSS might feature .home-features-bento twice?
// Replace all 3-column references with 2-column ones.
css = css.replace(/@media \(min-width: 980px\) \{\s*\.home-features-bento \{\s*grid-template-columns: repeat\(3, 1fr\);\s*\}\s*\.home-features-card--wide \{\s*grid-column: span 2;\s*\}\s*\}/g, 
`@media (min-width: 980px) {
    .home-features-bento {
        grid-template-columns: repeat(2, 1fr);
    }
}`);

fs.writeFileSync('src/style.css', css);
