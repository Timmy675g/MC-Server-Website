const fs = require('fs');
let css = fs.readFileSync('src/style.css', 'utf-8');
css = css.replace(
  /\/\* Navbar Controls & Mobile Menu Fix \*\/[\s\S]*$/,
`/* Navbar Controls & Mobile Menu Fix */
.nav-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-left: auto;
}

@media (min-width: 981px) {
    .nav-controls {
        order: 3;
        margin-left: 1rem;
    }
    .nav-links {
        order: 2;
        margin-left: auto;
    }
}

@media (max-width: 980px) {
    .nav-links.open {
        overflow-y: auto !important;
        max-height: calc(55svh - 2rem) !important;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
    }
}`
);
fs.writeFileSync('src/style.css', css);
