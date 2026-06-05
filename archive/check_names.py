import ast
import os, sys

# Add current path to sys.path
sys.path.insert(0, os.path.abspath('.'))

with open('lib/upload_loop.py', 'r', encoding='utf-8') as f:
    source = f.read()

tree = ast.parse(source)

import lib.file_utils
import lib.ledger
import lib.media_tools
import lib.music
import lib.youtube_upload
import lib.ai_metadata
import lib.meta_api
import lib.video_conversion
import lib.text_utils
import lib.schedule

allowed = set()
for mod in [lib.file_utils, lib.ledger, lib.media_tools, lib.music, lib.youtube_upload, lib.ai_metadata, lib.meta_api, lib.video_conversion, lib.text_utils, lib.schedule]:
    allowed.update(dir(mod))

allowed.update(dir(__builtins__))
allowed.update(['OpenAI', 'meta_requests', 'argparse', 'time', 'sys', 'os', 're', 'subprocess', 'random', 'Path', 'datetime', 'timezone', 'Any', 'Dict', 'List', 'Optional', 'Tuple', 'build_youtube_client', 'crosspost_meta_reel', 'ensure_meta_state_shape', 'meta_platform_enabled'])

# Additional known names in upload_loop
allowed.update(['main', 'prepare_trending_music', 'hashlib', 'try_mix_background_music'])

class NameChecker(ast.NodeVisitor):
    def __init__(self):
        self.used = set()
        self.defined = set()

    def visit_FunctionDef(self, node):
        self.defined.add(node.name)
        for arg in node.args.args:
            self.defined.add(arg.arg)
        if getattr(node.args, 'kwarg', None):
            self.defined.add(node.args.kwarg.arg)
        if getattr(node.args, 'vararg', None):
            self.defined.add(node.args.vararg.arg)
        self.generic_visit(node)
        
    def visit_Assign(self, node):
        for target in node.targets:
            if isinstance(target, ast.Name):
                self.defined.add(target.id)
            elif isinstance(target, ast.Tuple):
                for elt in target.elts:
                    if isinstance(elt, ast.Name):
                        self.defined.add(elt.id)
        self.generic_visit(node)

    def visit_Name(self, node):
        if isinstance(node.ctx, ast.Load):
            self.used.add(node.id)
        elif isinstance(node.ctx, ast.Store):
            self.defined.add(node.id)
        self.generic_visit(node)
        
    def visit_arg(self, node):
        self.defined.add(node.arg)
        self.generic_visit(node)
        
    def visit_Global(self, node):
        for name in node.names:
            self.defined.add(name)
        self.generic_visit(node)
        
    def visit_Nonlocal(self, node):
        for name in node.names:
            self.defined.add(name)
        self.generic_visit(node)
        
    def visit_comprehension(self, node):
        if isinstance(node.target, ast.Name):
            self.defined.add(node.target.id)
        elif isinstance(node.target, ast.Tuple):
            for elt in node.target.elts:
                if isinstance(elt, ast.Name):
                    self.defined.add(elt.id)
        self.generic_visit(node)

    def visit_For(self, node):
        if isinstance(node.target, ast.Name):
            self.defined.add(node.target.id)
        elif isinstance(node.target, ast.Tuple):
            for elt in node.target.elts:
                if isinstance(elt, ast.Name):
                    self.defined.add(elt.id)
        self.generic_visit(node)

checker = NameChecker()
checker.visit(tree)

undefined = checker.used - checker.defined - allowed
print("Undefined names:", sorted(list(undefined)))
