"""
秀场相关的数据模型
"""

from pydantic import BaseModel
from typing import Optional, List


class Show(BaseModel):
    """秀场响应"""
    id: int
    brand: str                          # 品牌名称
    season: str                         # 季度
    title: Optional[str] = None         # 标题
    coverImage: Optional[str] = None    # 封面图片
    showUrl: Optional[str] = None       # 秀场链接
    year: Optional[int] = None          # 年份
    category: Optional[str] = None      # 类别：Ready-to-Wear, Couture, Menswear 等
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class ShowListResponse(BaseModel):
    """秀场列表响应"""
    shows: List[Show]
    total: int
    page: int
    pageSize: int


class ShowSearchParams(BaseModel):
    """秀场搜索参数"""
    keyword: Optional[str] = None       # 搜索关键词（品牌、季度、类别）
    brand: Optional[str] = None         # 按品牌筛选
    year: Optional[int] = None          # 按年份筛选
    category: Optional[str] = None      # 按类别筛选
    page: int = 1
    pageSize: int = 50
