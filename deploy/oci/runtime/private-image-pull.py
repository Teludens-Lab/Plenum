#!/usr/bin/python3.9
"""Pull the pinned private Plenum image with a short-lived OCI Vault credential."""

import base64
import binascii
import json
import os
import re
import shutil
import subprocess
import sys


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(1)


if len(sys.argv) != 3:
    fail("Usage: plenum-private-image-pull <vault-secret-ocid> <digest-pinned-image>")

secret_id, image = sys.argv[1:]
if not secret_id.startswith("ocid1.vaultsecret."):
    fail("The registry credential must be an OCI Vault secret OCID.")
if not re.fullmatch(r"ghcr\.io/teludens-lab/plenum@sha256:[0-9a-f]{64}", image):
    fail("The image must be the digest-pinned private Plenum GHCR release.")

docker_config = os.environ.get("DOCKER_CONFIG", "")
if docker_config != "/run/plenum/docker":
    fail("DOCKER_CONFIG must be an ephemeral path below /run/plenum.")

try:
    secret_result = subprocess.run(
        [
            "/usr/bin/oci",
            "secrets",
            "secret-bundle",
            "get",
            "--auth",
            "instance_principal",
            "--secret-id",
            secret_id,
            "--stage",
            "CURRENT",
            "--query",
            'data."secret-bundle-content".content',
            "--raw-output",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if secret_result.returncode != 0:
        fail("OCI Vault did not return the private-registry credential.")

    try:
        raw = base64.b64decode(secret_result.stdout.strip(), validate=True).decode("utf-8")
        credential = json.loads(raw)
    except (binascii.Error, UnicodeDecodeError, json.JSONDecodeError):
        fail("The OCI Vault registry credential is not valid base64-encoded JSON.")

    if not isinstance(credential, dict) or set(credential) != {"username", "password"}:
        fail('The OCI Vault registry credential must contain only "username" and "password".')
    username = credential["username"]
    password = credential["password"]
    if not isinstance(username, str) or not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?", username):
        fail("The OCI Vault registry username is not a valid GitHub username.")
    if not isinstance(password, str) or not password.strip():
        fail("The OCI Vault registry password is empty.")

    os.makedirs(docker_config, mode=0o700, exist_ok=True)
    os.chmod(docker_config, 0o700)
    login = subprocess.run(
        ["/usr/bin/docker", "login", "ghcr.io", "--username", username, "--password-stdin"],
        input=password + "\n",
        text=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if login.returncode != 0:
        fail("GHCR rejected the OCI-managed registry credential.")

    pull = subprocess.run(
        ["/usr/bin/docker", "pull", image],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if pull.returncode != 0:
        fail("Docker could not pull the approved private Plenum image digest.")
    print("Pulled the approved private Plenum image using OCI Vault authentication.")
finally:
    shutil.rmtree(docker_config, ignore_errors=True)
