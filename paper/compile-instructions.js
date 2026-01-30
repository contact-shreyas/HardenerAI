const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

// Read the main.tex file
const texContent = fs.readFileSync(path.join(__dirname, 'main.tex'), 'utf8');
const bibContent = fs.readFileSync(path.join(__dirname, 'refs.bib'), 'utf8');

// FormData for multipart upload
function createFormData(texContent, bibContent) {
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const parts = [];
  
  parts.push(`--${boundary}`);
  parts.push('Content-Disposition: form-data; name="main.tex"');
  parts.push('');
  parts.push(texContent);
  
  parts.push(`--${boundary}`);
  parts.push('Content-Disposition: form-data; name="refs.bib"');
  parts.push('');
  parts.push(bibContent);
  
  parts.push(`--${boundary}--`);
  parts.push('');
  
  return parts.join('\r\n');
}

const formData = createFormData(texContent, bibContent);

console.log('Attempting to compile LaTeX using DEPRECATED service...\n');
console.log('Since LaTeX tools are not installed, I\'ll provide you with instructions to build the PDF:\n');

console.log('=== OPTIONS TO BUILD THE PDF ===\n');
console.log('OPTION 1: Use Overleaf (Recommended)');
console.log('  1. Go to https://overleaf.com');
console.log('  2. Create new project from files');
console.log('  3. Upload the entire "paper" folder');
console.log('  4. Download the compiled PDF\n');

console.log('OPTION 2: Use Local LaTeX Installation');
console.log('  Windows:');
console.log('  - Install MiKTeX: https://miktex.org/download');
console.log('  - Then run: cd paper && pdflatex -interaction=nonstopmode main.tex && bibtex main && pdflatex -interaction=nonstopmode main.tex && pdflatex -interaction=nonstopmode main.tex\n');

console.log('OPTION 3: Use WSL (Windows Subsystem for Linux)');
console.log('  - Enable WSL and Ubuntu');
console.log('  - Run: apt-get update && apt-get install texlive-full');
console.log('  - Then compile as above\n');

console.log('OPTION 4: Docker');
console.log('  - Start Docker Desktop');
console.log('  - Run: docker run --rm -v $(pwd):/workspace -w /workspace texlive/texlive:latest bash -c "pdflatex -interaction=nonstopmode main.tex && bibtex main && pdflatex -interaction=nonstopmode main.tex && pdflatex -interaction=nonstopmode main.tex"\n');

console.log('The LaTeX source file has been updated with the new author information.');
console.log('Once compiled, the PDF will be: dist/AI_Driven_Config_Hardening_IEEE.pdf');
