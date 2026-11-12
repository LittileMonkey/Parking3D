"""Use the packaged DOCX rasterizer with a PDF exported by native Word.
The bundle has no LibreOffice on this Windows host; Word preserves its layout.
"""
from pathlib import Path
import importlib.util,sys,os
root=Path(__file__).resolve().parents[2]
skill=Path('C:/Users/Admin/.codex/plugins/cache/openai-primary-runtime/documents/26.905.11957/skills/documents')
spec=importlib.util.spec_from_file_location('docx_renderer',skill/'render_docx.py')
renderer=importlib.util.module_from_spec(spec);spec.loader.exec_module(renderer)
pdf=Path(sys.argv[2]).resolve()
renderer.convert_to_pdf=lambda *args,**kwargs:(str(pdf),'PDF exported by native Word')
os.environ['PATH']='C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/bin'+os.pathsep+os.environ['PATH']
sys.argv=[str(skill/'render_docx.py'),sys.argv[1],'--output_dir',sys.argv[3]]
renderer.main()
