from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


class FileEntry(BaseModel):
    name: str
    path: str  # posix relative to workspace root
    type: Literal["file", "dir"]
    size: int | None = None
    modified_at: str | None = None


class ListResponse(BaseModel):
    path: str
    entries: list[FileEntry]


class ReadResponse(BaseModel):
    path: str
    content: str
    size: int
    encoding: str = "utf-8"


class WriteRequest(BaseModel):
    path: str = Field(min_length=1, max_length=1024)
    content: str = Field(default="")
    encoding: str = Field(default="utf-8")
    create_dirs: bool = True


class WriteResponse(BaseModel):
    path: str
    size: int


class RenameRequest(BaseModel):
    from_path: str = Field(min_length=1, max_length=1024)
    to_path: str = Field(min_length=1, max_length=1024)


class RenameResponse(BaseModel):
    from_path: str
    to_path: str


class DeleteRequest(BaseModel):
    path: str = Field(min_length=1, max_length=1024)
    recursive: bool = False


class SearchResponse(BaseModel):
    query: str
    matches: list[FileEntry]
