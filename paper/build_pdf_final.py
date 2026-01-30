#!/usr/bin/env python3
"""
LaTeX to PDF compiler using multiple API services
"""
import json
import urllib.request
import urllib.error
import base64
import time
from pathlib import Path

def compile_with_quicklatex():
    """Try QuickLaTeX API"""
    try:
        print("Attempting QuickLaTeX compilation...")
        
        paper_dir = Path(__file__).parent
        main_tex = paper_dir / "main.tex"
        
        with open(main_tex, 'r', encoding='utf-8') as f:
            tex_content = f.read()
        
        # QuickLaTeX API
        url = "https://quicklatex.com/api/v3/latexrender"
        
        data = urllib.parse.urlencode({
            'formula': tex_content,
            'fsize': '12pt',
            'mode': '0',
            'out': '1'
        }).encode('utf-8')
        
        req = urllib.request.Request(url, data=data)
        
        with urllib.request.urlopen(req, timeout=30) as response:
            result = response.read().decode('utf-8')
            if '0' in result[:5]:  # Success code
                print("✅ Compilation via QuickLaTeX successful!")
                return True
    except Exception as e:
        print(f"❌ QuickLaTeX failed: {e}")
    
    return False

def compile_with_pdfme():
    """Try pdf.me service"""
    try:
        print("Attempting pdf.me compilation...")
        
        paper_dir = Path(__file__).parent
        main_tex = paper_dir / "main.tex"
        refs_bib = paper_dir / "refs.bib"
        output_dir = paper_dir.parent / "dist"
        
        with open(main_tex, 'r', encoding='utf-8') as f:
            tex_content = f.read()
        with open(refs_bib, 'r', encoding='utf-8') as f:
            bib_content = f.read()
        
        output_dir.mkdir(exist_ok=True)
        
        # Try tectonic compiler via web API
        url = "https://compile.pdf.me/"
        
        files = {
            'file': ('main.tex', tex_content.encode('utf-8'))
        }
        
        boundary = '----WebKitFormBoundary'
        body = []
        
        for key, (filename, content) in files.items():
            body.append(f'--{boundary}'.encode())
            body.append(f'Content-Disposition: form-data; name="{key}"; filename="{filename}"'.encode())
            body.append(b'Content-Type: text/plain')
            body.append(b'')
            body.append(content)
        
        body.append(f'--{boundary}--'.encode())
        body.append(b'')
        
        body_bytes = b'\r\n'.join(body)
        
        req = urllib.request.Request(
            url,
            data=body_bytes,
            headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
        )
        
        with urllib.request.urlopen(req, timeout=60) as response:
            pdf_data = response.read()
            
            if pdf_data[:4] == b'%PDF':
                pdf_path = output_dir / "AI_Driven_Config_Hardening_IEEE.pdf"
                with open(pdf_path, 'wb') as f:
                    f.write(pdf_data)
                print(f"✅ PDF successfully compiled and saved!")
                print(f"📁 Location: {pdf_path}")
                return True
    except Exception as e:
        print(f"❌ pdf.me failed: {e}")
    
    return False

if __name__ == "__main__":
    import urllib.parse
    
    print("🔄 Attempting to compile LaTeX to PDF...\n")
    
    # Try different services
    if compile_with_quicklatex():
        exit(0)
    
    time.sleep(2)
    
    if compile_with_pdfme():
        exit(0)
    
    # If all fail, show instructions
    print("\n" + "="*70)
    print("Cannot compile automatically. Please use one of these methods:")
    print("="*70 + "\n")
    print("🌐 EASIEST: Overleaf.com")
    print("   1. Visit https://overleaf.com")
    print("   2. New Project → Upload Project")
    print("   3. Select the 'paper' folder")
    print("   4. Download the compiled PDF\n")
    print("Your main.tex has been updated with the new authors.")
