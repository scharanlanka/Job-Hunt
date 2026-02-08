import os
from typing import Optional
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, UploadFile, status

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
