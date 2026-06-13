#!/usr/bin/env python3
"""
manage_keys.py — Secure API key storage and retrieval for Build Day agents.

Keys are encrypted with Fernet symmetric encryption. The encryption key is
derived from a passphrase you provide at runtime using PBKDF2-HMAC-SHA256.
Encrypted keys are stored in ~/.buildday_keys (never in the repo).

Usage:
  Store a key:   python manage_keys.py store ANTHROPIC_API_KEY
  Load all keys: python manage_keys.py load
  List stored:   python manage_keys.py list

Agents call load() at startup to populate os.environ with decrypted values.
The passphrase is never stored anywhere — it must be provided at runtime.
"""

import os
import sys
import json
import base64
import getpass
import argparse
from pathlib import Path

try:
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes
except ImportError:
    print("ERROR: cryptography package not installed.")
    print("Run: pip install cryptography")
    sys.exit(1)

# Storage location — outside the repo, never committed
KEY_STORE_PATH = Path.home() / ".buildday_keys"

# Salt is fixed per installation (not secret, just prevents rainbow tables).
# Generated once and stored alongside encrypted keys.
SALT_FILE = KEY_STORE_PATH / ".salt"
KEYS_FILE = KEY_STORE_PATH / "keys.enc"


def _get_or_create_salt() -> bytes:
    """Load existing salt or generate a new one."""
    KEY_STORE_PATH.mkdir(mode=0o700, exist_ok=True)
    if SALT_FILE.exists():
        return SALT_FILE.read_bytes()
    salt = os.urandom(16)
    SALT_FILE.write_bytes(salt)
    SALT_FILE.chmod(0o600)
    return salt


def _derive_fernet(passphrase: str) -> Fernet:
    """Derive a Fernet key from a passphrase using PBKDF2."""
    salt = _get_or_create_salt()
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=480_000,  # OWASP 2023 recommendation
    )
    key = base64.urlsafe_b64encode(kdf.derive(passphrase.encode()))
    return Fernet(key)


def _load_store(fernet: Fernet) -> dict:
    """Load and decrypt the key store. Returns empty dict if store is new."""
    if not KEYS_FILE.exists():
        return {}
    try:
        encrypted = KEYS_FILE.read_bytes()
        decrypted = fernet.decrypt(encrypted)
        return json.loads(decrypted.decode())
    except Exception:
        print("ERROR: Could not decrypt key store. Wrong passphrase?")
        sys.exit(1)


def _save_store(fernet: Fernet, store: dict) -> None:
    """Encrypt and save the key store."""
    KEY_STORE_PATH.mkdir(mode=0o700, exist_ok=True)
    plaintext = json.dumps(store).encode()
    encrypted = fernet.encrypt(plaintext)
    KEYS_FILE.write_bytes(encrypted)
    KEYS_FILE.chmod(0o600)


def cmd_store(key_name: str) -> None:
    """Encrypt and store a single API key."""
    print(f"Storing key: {key_name}")
    passphrase = getpass.getpass("Enter passphrase (used to encrypt/decrypt): ")
    confirm = getpass.getpass("Confirm passphrase: ")
    if passphrase != confirm:
        print("ERROR: Passphrases do not match.")
        sys.exit(1)

    key_value = getpass.getpass(f"Enter value for {key_name}: ")
    if not key_value.strip():
        print("ERROR: Key value cannot be empty.")
        sys.exit(1)

    fernet = _derive_fernet(passphrase)
    store = _load_store(fernet)
    store[key_name] = key_value.strip()
    _save_store(fernet, store)
    print(f"✓ {key_name} stored encrypted at {KEYS_FILE}")
    print(f"  Never prints key value. Passphrase not stored anywhere.")


def cmd_load(passphrase: str | None = None) -> dict:
    """
    Decrypt all stored keys and inject into os.environ.
    Returns the dict of key names (not values) that were loaded.

    Agents call this at startup:
        from manage_keys import cmd_load
        cmd_load(passphrase=os.environ.get("BUILD_PASSPHRASE"))
    """
    if passphrase is None:
        passphrase = getpass.getpass("Enter passphrase to load keys: ")

    fernet = _derive_fernet(passphrase)
    store = _load_store(fernet)

    if not store:
        print("No keys stored yet. Run: python manage_keys.py store <KEY_NAME>")
        return {}

    for name, value in store.items():
        os.environ[name] = value

    loaded = list(store.keys())
    print(f"✓ Loaded {len(loaded)} key(s) into environment: {', '.join(loaded)}")
    print("  Key values not printed.")
    return {name: True for name in loaded}


def cmd_list() -> None:
    """List stored key names without revealing values."""
    passphrase = getpass.getpass("Enter passphrase to list keys: ")
    fernet = _derive_fernet(passphrase)
    store = _load_store(fernet)

    if not store:
        print("No keys stored.")
        return

    print(f"\nStored keys in {KEYS_FILE}:")
    for name in store:
        print(f"  • {name}")
    print(f"\nTotal: {len(store)} key(s). Values not shown.")


def cmd_delete(key_name: str) -> None:
    """Remove a single key from the store."""
    passphrase = getpass.getpass("Enter passphrase: ")
    fernet = _derive_fernet(passphrase)
    store = _load_store(fernet)

    if key_name not in store:
        print(f"Key '{key_name}' not found in store.")
        return

    del store[key_name]
    _save_store(fernet, store)
    print(f"✓ {key_name} removed from store.")


def main():
    parser = argparse.ArgumentParser(
        description="Secure API key storage for Build Day agents."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # store
    p_store = subparsers.add_parser("store", help="Encrypt and store a key")
    p_store.add_argument("key_name", help="e.g. ANTHROPIC_API_KEY")

    # load
    subparsers.add_parser("load", help="Decrypt and load all keys into environment")

    # list
    subparsers.add_parser("list", help="List stored key names (no values)")

    # delete
    p_del = subparsers.add_parser("delete", help="Remove a stored key")
    p_del.add_argument("key_name", help="Key name to remove")

    args = parser.parse_args()

    if args.command == "store":
        cmd_store(args.key_name)
    elif args.command == "load":
        cmd_load()
    elif args.command == "list":
        cmd_list()
    elif args.command == "delete":
        cmd_delete(args.key_name)


# ── Agent integration ──────────────────────────────────────────────────────────
# Agents import this module and call load_keys_for_agent() at startup.
# The passphrase is passed via BUILD_PASSPHRASE env var, set once in the
# terminal session that launches Claude Code:
#
#   export BUILD_PASSPHRASE="your passphrase here"
#   claude  # or however you invoke Claude Code
#
# This way the passphrase is in the shell environment for the session only,
# never written to disk, and Claude Code inherits it without you retyping it
# for each agent invocation.

def load_keys_for_agent() -> bool:
    """
    Called by agents at startup. Reads passphrase from BUILD_PASSPHRASE
    env var (set once in the shell session) and decrypts all keys into
    os.environ. Returns True if successful, False if passphrase not set.
    """
    passphrase = os.environ.get("BUILD_PASSPHRASE")
    if not passphrase:
        print(
            "WARNING: BUILD_PASSPHRASE not set in environment. "
            "Keys not loaded. Set it with: export BUILD_PASSPHRASE='...'"
        )
        return False
    result = cmd_load(passphrase=passphrase)
    return bool(result)


if __name__ == "__main__":
    main()
