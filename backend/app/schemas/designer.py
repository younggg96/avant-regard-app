"""
设计师相关的数据模型
"""
from pydantic import BaseModel
from typing import Optional, List


class DesignerDetailDto(BaseModel):
    """设计师简要信息"""
    id: int
    name: str
    slug: str
    designerUrl: str = ""
    showCount: int = 0
    totalImages: int = 0
    latestSeason: str = ""
    followerCount: int = 0
    following: bool = False


class DesignerShowSummary(BaseModel):
    """Show 摘要"""
    id: int
    category: str = ""
    season: str
    imageCount: int = 0
    reviewAuthor: Optional[str] = None
    reviewText: Optional[str] = None


class DesignerImageSummary(BaseModel):
    """图片摘要"""
    id: int
    imageUrl: str
    likeCount: int = 0
    likedByMe: bool = False


class DesignerShowAndImageDetailDto(BaseModel):
    """设计师详情 + Shows + Images"""
    id: int
    name: str
    slug: str
    designerUrl: str = ""
    showCount: int = 0
    totalImages: int = 0
    followerCount: int = 0
    following: bool = False
    shows: List[DesignerShowSummary] = []
    images: List[DesignerImageSummary] = []


class SingleShowImage(BaseModel):
    """单场 Show 的图片"""
    id: int
    imageUrl: str
    imageType: str = "LOOK"
    sortOrder: int = 0


class SingleShowDto(BaseModel):
    """单场 Show 详情"""
    id: int
    showUrl: str = ""
    season: str
    category: str = ""
    city: Optional[str] = None
    collectionTs: str = ""
    originalOffset: Optional[str] = None
    reviewTitle: Optional[str] = None
    reviewAuthor: Optional[str] = None
    reviewText: Optional[str] = None
    images: List[SingleShowImage] = []


class DesignerOption(BaseModel):
    """设计师选项（用于用户补全资料）"""
    id: int
    name: str
    slug: str
    designerUrl: str = ""
