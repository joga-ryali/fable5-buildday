#!/usr/bin/env python3
"""Launch the Next.js server locally with API keys loaded into the process env.

Keys are decrypted from the encrypted store into os.environ (presence logged,
never values) and inherited by the Node child. Nothing is written to disk.

Usage:
  BUILD_PASSPHRASE=... python scripts/run_web.py [start|dev]   (default: start)
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from manage_keys import load_keys_for_agent

load_keys_for_agent()
print("ANTHROPIC_API_KEY:", "set ✓" if os.environ.get("ANTHROPIC_API_KEY") else "NOT set")

mode = sys.argv[1] if len(sys.argv) > 1 else "start"
os.chdir(ROOT)
os.execvp("npm", ["npm", "run", mode])
