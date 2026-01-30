#!/usr/bin/env python3
import json
import urllib.request
import urllib.error
import os
import sys
import base64
from pathlib import Path

def compile_latex_via_api():
    """Compile LaTeX using online API services"""
    
    paper_dir = Path(__file__).parent
    main_tex = paper_dir / "main.tex"
    refs_bib = paper_dir / "refs.bib"
    output_dir = paper_dir.parent / "dist"
    
    # Ensure output directory exists
    output_dir.mkdir(exist_ok=True)
    
    if not main_tex.exists():
        print("❌ Error: main.tex not found")
        return False
    
    print("📄 Compiling LaTeX to PDF...\n")
    print("Reading files...")
    
    with open(main_tex, 'r', encoding='utf-8') as f:
        tex_content = f.read()
    
    with open(refs_bib, 'r', encoding='utf-8') as f:
        bib_content = f.read()
    
    print("✅ Files read successfully")
    print("⏳ Attempting compilation via API...\n")
    
    # Method 1: Try latexcgi.online
    try:
        print("Trying latexcgi.online...")
        url = "https://latexcgi.online/request"
        
        data = {
            "latexml": True,
            "source": tex_content,
            "options": []
        }
        
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode('utf-8'))
            if 'status' in result and result['status'] == 'success':
                print("✅ Compilation successful!")
                # Save the result (usually base64 encoded)
                if 'pdf' in result:
                    pdf_path = output_dir / "AI_Driven_Config_Hardening_IEEE.pdf"
                    with open(pdf_path, 'wb') as f:
                        f.write(base64.b64decode(result['pdf']))
                    print(f"✅ PDF saved to: {pdf_path}")
                    return True
    except Exception as e:
        print(f"⚠️  latexcgi.online failed: {e}\n")
    
    # Method 2: Try verbosus online compiler
    try:
        print("Trying verbosus.com API...")
        url = "https://www.verbosus.com/api/v1/latex"
        
        # Create multipart form data
        boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
        body = []
        
        body.append(f'--{boundary}'.encode())
        body.append(b'Content-Disposition: form-data; name="file_contents"')
        body.append(b'')
        body.append(tex_content.encode('utf-8'))
        
        body.append(f'--{boundary}'.encode())
        body.append(b'Content-Disposition: form-data; name="compiler"')
        body.append(b'')
        body.append(b'pdflatex')
        
        body.append(f'--{boundary}--'.encode())
        body.append(b'')
        
        body_bytes = b'\r\n'.join(body)
        
        req = urllib.request.Request(
            url,
            data=body_bytes,
            headers={
                'Content-Type': f'multipart/form-data; boundary={boundary}'
            }
        )
        
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode('utf-8'))
            if 'status' in result and result['status'] == 'success':
                print("✅ Compilation successful!")
                if 'pdf' in result:
                    pdf_path = output_dir / "AI_Driven_Config_Hardening_IEEE.pdf"
                    with open(pdf_path, 'wb') as f:
                        f.write(base64.b64decode(result['pdf']))
                    print(f"✅ PDF saved to: {pdf_path}")
                    return True
    except Exception as e:
        print(f"⚠️  verbosus.com API failed: {e}\n")
    
    return False

def show_alternatives():
    """Show alternative methods to compile PDF"""
    print("\n" + "="*70)
    print("ALTERNATIVE METHODS TO COMPILE THE PDF")
    print("="*70 + "\n")
    
    print("🌟 RECOMMENDED: Use Overleaf (No installation needed)\n")
    print("   1. Visit: https://overleaf.com")
    print("   2. Sign up (free)")
    print("   3. Click 'New Project' → 'Upload Project'")
    print("   4. Select the 'paper' folder from your computer")
    print("   5. Wait for compilation")
    print("   6. Download the PDF\n")
    
    print("💻 OPTION 2: Install MiKTeX (Windows)\n")
    print("   1. Download: https://miktex.org/download")
    print("   2. Run the installer with administrator privileges")
    print("   3. Choose 'Install MiKTeX for all users' (if admin)")
    print("   4. Once installed, open PowerShell and run:")
    print("      cd 'c:\\transfer\\AI-Driven Cybersecurity Config Hardening for SMEs\\paper'")
    print("      .\\scripts\\build.ps1\n")
    
    print("🐧 OPTION 3: Use TeX Live on Linux/Mac\n")
    print("   cd paper")
    print("   pdflatex -interaction=nonstopmode main.tex")
    print("   bibtex main")
    print("   pdflatex -interaction=nonstopmode main.tex")
    print("   pdflatex -interaction=nonstopmode main.tex\n")
    
    print("📦 OPTION 4: Use Docker\n")
    print("   Start Docker Desktop, then run:")
    print("   cd 'c:\\transfer\\AI-Driven Cybersecurity Config Hardening for SMEs\\paper'")
    print("   docker run --rm -v ${PWD}:/workspace -w /workspace texlive/texlive:latest \\")
    print("     bash -c \"pdflatex -interaction=nonstopmode main.tex && bibtex main && \\")
    print("     pdflatex -interaction=nonstopmode main.tex && pdflatex -interaction=nonstopmode main.tex\"\n")
    
    print("✅ Your main.tex has been successfully updated with:")
    print("   • Shreyas Gupta")
    print("   • Anurag Tomar")
    print("   • Sowmya Jagadeesan")
    print("\n   Once compiled, PDF will be saved to: dist/AI_Driven_Config_Hardening_IEEE.pdf\n")

if __name__ == "__main__":
    success = compile_latex_via_api()
    
    if not success:
        show_alternatives()
        sys.exit(1)
