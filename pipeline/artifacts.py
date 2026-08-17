from __future__ import annotations

import hashlib
import json
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from typing import BinaryIO

from pipeline.config import ArtifactConfig
from pipeline.core import write_json


CHUNK_SIZE = 1024 * 1024


def file_digest(path: Path, algorithm: str) -> str:
    digest = hashlib.new(algorithm)
    with path.open("rb") as source:
        while chunk := source.read(CHUNK_SIZE):
            digest.update(chunk)
    return digest.hexdigest()


def copy_with_progress(
    source: BinaryIO,
    output: BinaryIO,
    *,
    label: str,
    total: int,
    initial: int = 0,
) -> None:
    copied = initial
    next_report = max(total // 20, CHUNK_SIZE)
    report_at = ((copied // next_report) + 1) * next_report
    while chunk := source.read(CHUNK_SIZE):
        output.write(chunk)
        copied += len(chunk)
        if copied >= report_at or copied == total:
            print(f"{label}: {min(100, 100 * copied // total)}%", flush=True)
            report_at += next_report


def download_with_resume(artifact: ArtifactConfig, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_suffix(f"{destination.suffix}.part")
    offset = partial.stat().st_size if partial.exists() else 0
    if offset > artifact.archive_size:
        partial.unlink()
        offset = 0

    request = urllib.request.Request(artifact.url)
    if offset:
        request.add_header("Range", f"bytes={offset}-")

    try:
        response = urllib.request.urlopen(request)
    except urllib.error.HTTPError as error:
        if error.code != 416 or offset != artifact.archive_size:
            raise
    else:
        status = getattr(response, "status", response.getcode())
        append = bool(offset and status == 206)
        mode = "ab" if append else "wb"
        with response, partial.open(mode) as output:
            copy_with_progress(
                response,
                output,
                label="Downloading",
                total=artifact.archive_size,
                initial=offset if append else 0,
            )

    actual_size = partial.stat().st_size
    if actual_size != artifact.archive_size:
        raise ValueError(
            f"Incomplete artifact download: {actual_size} bytes; "
            f"expected {artifact.archive_size}. Re-run the fetch command to resume."
        )
    actual_md5 = file_digest(partial, "md5")
    if actual_md5 != artifact.archive_md5:
        partial.unlink()
        raise ValueError(
            f"Artifact MD5 mismatch: {actual_md5}; expected {artifact.archive_md5}."
        )
    actual_sha256 = file_digest(partial, "sha256")
    if actual_sha256 != artifact.archive_sha256:
        partial.unlink()
        raise ValueError(
            f"Artifact SHA-256 mismatch: {actual_sha256}; "
            f"expected {artifact.archive_sha256}."
        )
    partial.replace(destination)
    return destination


def fetch_artifact(
    artifact: ArtifactConfig,
    source_directory: Path,
) -> tuple[Path, dict[str, object]]:
    archive = source_directory / artifact.archive_name
    model = source_directory / artifact.member_name
    receipt_path = source_directory / "artifact.json"

    if model.exists() and receipt_path.exists():
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        if (
            receipt.get("archiveSize") == artifact.archive_size
            and receipt.get("archiveMd5") == artifact.archive_md5
            and receipt.get("archiveSha256") == artifact.archive_sha256
            and receipt.get("modelSha256") == artifact.model_sha256
            and receipt.get("modelSha256") == file_digest(model, "sha256")
        ):
            return model, receipt

    if not archive.exists():
        download_with_resume(artifact, archive)
    elif (
        archive.stat().st_size != artifact.archive_size
        or file_digest(archive, "md5") != artifact.archive_md5
        or file_digest(archive, "sha256") != artifact.archive_sha256
    ):
        archive.unlink()
        download_with_resume(artifact, archive)

    source_directory.mkdir(parents=True, exist_ok=True)
    temporary_model = model.with_suffix(f"{model.suffix}.part")
    with zipfile.ZipFile(archive) as bundle:
        names = bundle.namelist()
        if names != [artifact.member_name]:
            raise ValueError(
                f"Unexpected archive contents: {names!r}; "
                f"expected only {artifact.member_name!r}."
            )
        info = bundle.getinfo(artifact.member_name)
        with bundle.open(artifact.member_name) as source, temporary_model.open("wb") as output:
            copy_with_progress(
                source, output, label="Extracting", total=info.file_size
            )
    model_sha256 = file_digest(temporary_model, "sha256")
    if model_sha256 != artifact.model_sha256:
        raise ValueError(
            f"Extracted model SHA-256 mismatch: {model_sha256}; "
            f"expected {artifact.model_sha256}."
        )
    temporary_model.replace(model)

    receipt = {
        "schemaVersion": 1,
        "url": artifact.url,
        "release": artifact.release,
        "archive": artifact.archive_name,
        "archiveSize": artifact.archive_size,
        "archiveMd5": artifact.archive_md5,
        "archiveSha256": artifact.archive_sha256,
        "member": artifact.member_name,
        "modelSize": model.stat().st_size,
        "modelSha256": model_sha256,
    }
    write_json(receipt_path, receipt)
    return model, receipt
