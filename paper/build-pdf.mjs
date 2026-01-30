import fs from 'fs';
import path from 'path';
import https from 'https';

const paperDir = process.cwd();
const texFile = path.join(paperDir, 'main.tex');
const bibFile = path.join(paperDir, 'refs.bib');
const outDir = path.join(paperDir, '..', 'dist');

// Ensure output directory
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const texContent = fs.readFileSync(texFile, 'utf8');
const bibContent = fs.readFileSync(bibFile, 'utf8');

console.log('📄 Compiling LaTeX to PDF...\n');

// Use quicklatex.com API
const payload = {
  formula: texContent,
  fsize: 16,
  preamble: bibContent,
  colors: ['000000', 'ffffff']
};

// Try with Papeeria API (alternative service)
const options = {
  hostname: 'api.papeeria.com',
  path: '/api/v1/documents/compile',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      if (res.statusCode === 200) {
        // If successful, write PDF
        fs.writeFileSync(
          path.join(outDir, 'AI_Driven_Config_Hardening_IEEE.pdf'),
          data
        );
        console.log('✅ PDF compiled successfully!');
        console.log(`📁 Saved to: ${path.join(outDir, 'AI_Driven_Config_Hardening_IEEE.pdf')}`);
      } else {
        throw new Error(`API returned ${res.statusCode}`);
      }
    } catch (e) {
      console.error('❌ Could not compile via API:', e.message);
      showAlternatives();
    }
  });
});

req.on('error', () => {
  console.error('⚠️  Could not connect to online LaTeX service');
  showAlternatives();
});

req.write(JSON.stringify(payload));
req.end();

function showAlternatives() {
  console.log('\n' + '='.repeat(60));
  console.log('ALTERNATE METHODS TO COMPILE THE PDF');
  console.log('='.repeat(60) + '\n');
  
  console.log('✨ RECOMMENDED: Use Overleaf (No installation needed)\n');
  console.log('  1. Visit: https://overleaf.com');
  console.log('  2. Click "New Project" → "Upload Project"');
  console.log('  3. Drag & drop the "paper" folder');
  console.log('  4. Click the "Recompile" button');
  console.log('  5. Download the PDF\n');
  
  console.log('💻 METHOD 2: Install MiKTeX (Windows)\n');
  console.log('  1. Download: https://miktex.org/download');
  console.log('  2. Run installer with admin privileges');
  console.log('  3. In PowerShell (as admin), run:\n');
  console.log('     cd "c:\\transfer\\AI-Driven Cybersecurity Config Hardening for SMEs\\paper"');
  console.log('     .\\scripts\\build.ps1\n');
  
  console.log('🐧 METHOD 3: Use Linux/Mac with TeX Live\n');
  console.log('  On Linux/Mac with texlive installed:');
  console.log('  cd paper');
  console.log('  pdflatex -interaction=nonstopmode main.tex');
  console.log('  bibtex main');
  console.log('  pdflatex -interaction=nonstopmode main.tex');
  console.log('  pdflatex -interaction=nonstopmode main.tex\n');
  
  console.log('📦 METHOD 4: Docker (requires Docker to be running)\n');
  console.log('  docker run --rm -v "$(pwd):/workspace" -w /workspace texlive/texlive bash -c');
  console.log('  "pdflatex -interaction=nonstopmode main.tex && bibtex main && pdflatex -interaction=nonstopmode main.tex && pdflatex -interaction=nonstopmode main.tex"\n');
  
  console.log('✅ Your main.tex has been updated with new author info!');
  console.log('   Once compiled, PDF will be saved to: dist/AI_Driven_Config_Hardening_IEEE.pdf\n');
}
