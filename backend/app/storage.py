import os
import re
import unicodedata
from typing import Optional
from urllib.parse import quote, urlparse
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, UploadFile, status


def _build_content_disposition(filename: str) -> str:
    raw = (filename or "").strip() or "resume"
    ascii_name = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode()
    ascii_name = re.sub(r"[^\w.\- ]", "_", ascii_name).strip() or "resume"
    ascii_name = ascii_name.replace("\\", "_").replace('"', "_")
    utf8_name = quote(raw, safe="!#$&+-.^_`|~")
    return f'inline; filename="{ascii_name}"; filename*=UTF-8\'\'{utf8_name}'


def _get_s3_client():
    s3_bucket = (os.getenv("S3_BUCKET") or "").strip() or None
    aws_region = (os.getenv("AWS_REGION") or "").strip() or None
    s3_endpoint_url = (os.getenv("S3_ENDPOINT_URL") or "").strip() or None

    if not s3_bucket:
        raise RuntimeError("S3_BUCKET is not set")
    if not aws_region:
        raise RuntimeError("AWS_REGION is not set")
    client = boto3.client("s3", region_name=aws_region, endpoint_url=s3_endpoint_url)
    return client, s3_bucket, aws_region, s3_endpoint_url


def _build_object_url(bucket: str, key: str, region: str, endpoint_url: Optional[str]):
    if endpoint_url:
        return f"{endpoint_url.rstrip('/')}/{bucket}/{key}"
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def _resolve_object_key(object_ref: str, bucket: str):
    raw = (object_ref or "").strip()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing resume URL or key",
        )

    # Allow direct key usage for future compatibility.
    if "://" not in raw:
        if raw.startswith(f"{bucket}/"):
            return raw[len(bucket) + 1 :]
        return raw

    parsed = urlparse(raw)
    path = parsed.path.lstrip("/")
    if path.startswith(f"{bucket}/"):
        return path[len(bucket) + 1 :]

    if parsed.netloc.startswith(f"{bucket}."):
        return path

    return path


def upload_resume(file: UploadFile) -> dict:
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Missing filename"
        )

    try:
        client, s3_bucket, aws_region, s3_endpoint_url = _get_s3_client()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    key = f"resumes/{uuid4().hex}-{file.filename}"

    try:
        client.upload_fileobj(
            file.file,
            s3_bucket,
            key,
            ExtraArgs={"ContentType": file.content_type or "application/octet-stream"},
        )
    except ClientError as exc:
        error = exc.response.get("Error", {})
        code = error.get("Code", "Unknown")
        message = error.get("Message", "S3 client error")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upload failed: {code} - {message}",
        ) from exc
    except BotoCoreError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upload failed: {str(exc)}",
        ) from exc

    return {
        "name": file.filename,
        "url": _build_object_url(s3_bucket, key, aws_region, s3_endpoint_url),
        "key": key,
    }


def get_resume_stream(object_ref: str):
    try:
        client, s3_bucket, _aws_region, _s3_endpoint_url = _get_s3_client()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    key = _resolve_object_key(object_ref, s3_bucket)
    if not key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid resume URL or key",
        )

    try:
        s3_object = client.get_object(Bucket=s3_bucket, Key=key)
    except ClientError as exc:
        error = exc.response.get("Error", {})
        code = error.get("Code", "Unknown")
        message = error.get("Message", "S3 client error")
        if code in {"NoSuchKey", "404", "NotFound"}:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Resume fetch failed: {code} - {message}",
        ) from exc
    except BotoCoreError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Resume fetch failed: {str(exc)}",
        ) from exc

    content_type = s3_object.get("ContentType") or "application/octet-stream"
    filename = key.rsplit("/", 1)[-1] or "resume"
    content_disposition = _build_content_disposition(filename)

    return s3_object["Body"], content_type, content_disposition
