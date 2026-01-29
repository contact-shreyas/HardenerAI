# IEEE Paper - AI-Driven Configuration Hardening

This directory contains the IEEE conference paper documenting the AI-driven configuration hardening system.

## Quick Start

### Build PDF

```powershell
# Windows PowerShell
.\scripts\build.ps1

# With page count check
.\scripts\build.ps1 -CheckPages

# Clean build
.\scripts\build.ps1 -Clean

# Generate DOCX as well
.\scripts\build.ps1 -GenerateDOCX
```

### Prerequisites

1. **LaTeX Distribution** (required):
   - Windows: [MiKTeX](https://miktex.org/download) or [TeX Live](https://www.tug.org/texlive/)
   - macOS: `brew install --cask mactex`
   - Linux: `sudo apt-get install texlive-full`

2. **Pandoc** (optional, for DOCX generation):
   - Windows: `winget install --id=JohnMacFarlane.Pandoc -e`
   - macOS: `brew install pandoc`
   - Linux: `sudo apt-get install pandoc`

### Check References

```powershell
.\scripts\count-refs.ps1
```

This will:
- Count total references in `refs.bib` (target: >= 50)
- Detect orphan references (in bib but not cited)
- Find missing references (cited but no bib entry)

## File Structure

```
paper/
├── main.tex              # Main IEEE conference paper (IEEEtran class)
├── refs.bib              # Bibliography (50+ verified references)
├── figures/              # Figures and diagrams
│   └── architecture_diagram.tex  # TikZ architecture diagram
├── scripts/              # Build and utility scripts
│   ├── build.ps1         # Main build script
│   └── count-refs.ps1    # Reference auditing script
└── README.md             # This file
```

## Output

Compiled artifacts are placed in `../dist/`:
- `dist/paper_IEEE_9pages.pdf` - Final IEEE conference PDF (target: exactly 9 pages)
- `dist/paper_IEEE_9pages.docx` - Word version (generated via pandoc)

## Paper Sections

1. **Abstract** - Problem, approach, results (84% noise reduction, CVSS-inspired scoring)
2. **Introduction** - Motivation, research questions, contributions
3. **Related Work** - Config security, CVSS scoring, automated patching
4. **Methodology** - 7-stage pipeline, deduplication algorithm, risk scoring model
5. **Implementation** - TypeScript stack, modules, dashboard, testing
6. **Evaluation** - Fixture-based experiments, deduplication results, risk scores, patch validation
7. **Discussion** - Strengths, limitations, threat model, reproducibility
8. **Future Work** - ML-based scoring, context-aware patching, benchmarks
9. **Conclusion** - Summary of contributions and impact
10. **References** - 50+ verified citations with DOI/arXiv

## Page Count Target

**Exactly 9 pages including references** (IEEE conference requirement).

To check page count:
```powershell
.\scripts\build.ps1 -CheckPages
```

If over 9 pages:
- Tighten Related Work section
- Reduce whitespace in tables
- Shorten Future Work

If under 9 pages:
- Expand Discussion/Limitations
- Add more evaluation details
- Include additional figures (e.g., risk score distribution histogram)

**No formatting hacks allowed** (font size, margins, line spacing must remain IEEE standard).

## Word Count

To compute word count (requires `texcount`):
```powershell
.\scripts\build.ps1 -WordCount
```

Install texcount:
```bash
tlmgr install texcount
```

## Reference Verification

All 50+ references have been verified with:
- Real titles, authors, venues
- DOI or arXiv links where available
- Publication year
- IEEE, ACM, Springer, Elsevier, or arXiv sources

See `CITATION_AUDIT.md` in `../dist/` for full verification log (generated after build).

## DOCX Generation

The Word version is generated from LaTeX using pandoc:

```powershell
.\scripts\build.ps1 -GenerateDOCX
```

The DOCX includes:
- All sections and subsections
- Tables with captions
- Equations (converted to Office Math)
- Citations and bibliography
- Figures (requires manual check for rendering)

**Manual review required**: Check that equations, tables, and citations render correctly in Word.

## Reproducibility

Everything needed to rebuild the paper:
- `main.tex` - Full paper source
- `refs.bib` - All references with metadata
- `scripts/build.ps1` - Automated build pipeline
- `figures/` - All diagrams and plots

Commands:
```powershell
# Full build with checks
.\scripts\build.ps1 -Clean -CheckPages -WordCount

# Generate both PDF and DOCX
.\scripts\build.ps1 -GenerateDOCX

# Verify references
.\scripts\count-refs.ps1
```

## Troubleshooting

### LaTeX Errors

Check `main.log` in the `paper/` directory for detailed error messages.

Common issues:
- Missing package: Install via `tlmgr install <package>`
- Undefined citation: Run `bibtex main` then recompile
- Overfull/underfull hbox: Adjust text or table widths

### Page Count Issues

If page count is incorrect:
1. Ensure using IEEEtran conference class
2. Check for large figures or tables
3. Verify all text is in correct sections (not in comments)

### Reference Errors

If citations show as `[?]`:
1. Run bibtex: `bibtex main`
2. Recompile twice: `pdflatex main.tex` (×2)

## Citation Style

IEEE style (numeric, sorted by appearance):
```latex
\cite{key1}              % Single citation: [1]
\cite{key1, key2, key3}  % Multiple: [1]-[3] or [1], [2], [3]
```

Bibliography managed via BibTeX with `IEEEtran.bst` style.

## Contributions

The paper documents four main contributions (C1-C4):
1. **C1**: Intelligent deduplication (84% noise reduction)
2. **C2**: CVSS-inspired risk scoring model
3. **C3**: Automated patch generation with validation
4. **C4**: Production-ready system with tests and dashboard

Each contribution is supported by real implementation and evaluation results from the codebase.

## License

This paper and associated materials are part of the HardenerAI project.
See `../LICENSE` for details.
