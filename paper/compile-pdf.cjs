const fs = require('fs');
const path = require('path');
const https = require('https');

// Read the main.tex file
const texContent = fs.readFileSync(path.join(__dirname, 'main.tex'), 'utf8');
const bibContent = fs.readFileSync(path.join(__dirname, 'refs.bib'), 'utf8');

// Prepare the compilation request
const request = {
  compiler: 'pdflatex',
  mainFile: 'main',
  resources: [
    {
      path: 'main.tex',
      content: texContent
    },
    {
      path: 'refs.bib',
      content: bibContent
    }
  ]
};

console.log('Compiling LaTeX to PDF...');
console.log('This may take a moment...\n');

// Use latexonline.cc API
const options = {
  hostname: 'latexonline.cc',
  port: 443,
  path: '/compile',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = [];

  res.on('data', (chunk) => {
    data.push(chunk);
  });

  res.on('end', () => {
    const buffer = Buffer.concat(data);
    
    if (res.statusCode === 200) {
      // Save the PDF
      const outputPath = path.join(__dirname, '..', 'dist', 'AI_Driven_Config_Hardening_IEEE.pdf');
      
      // Ensure dist directory exists
      const distDir = path.dirname(outputPath);
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, buffer);
      console.log('✓ PDF compiled successfully!');
      console.log(`✓ Saved to: ${outputPath}`);
    } else {
      console.error('✗ Compilation failed');
      console.error('Status:', res.statusCode);
      console.error('Response:', buffer.toString());
    }
  });
});

req.on('error', (error) => {
  console.error('✗ Error:', error.message);
});

// Send the request
req.write(JSON.stringify(request));
req.end();
