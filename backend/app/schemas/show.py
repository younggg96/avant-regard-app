"""
秀场相关的数据模型
"""

from pydantic import BaseModel, field_validator
from typing import Optional, List, Union


class Show(BaseModel):
    """秀场响应"""
    id: Union[int, str]                 # 支持整数或字符串类型的 ID
    brand: str                          # 品牌名称
    season: str                         # 季度
    title: Optional[str] = None         # 标题
    coverImage: Optional[str] = None    # 封面图片
    showUrl: Optional[str] = None       # 秀场链接
    year: Optional[int] = None          # 年份
    category: Optional[str] = None      # 类别：Ready-to-Wear, Couture, Menswear 等
    description: Optional[str] = None   # 秀场介绍
    designer: Optional[str] = None      # 主设计师
    createdBy: Optional[int] = None         # 创建者用户 ID
    contributorName: Optional[str] = None  # 贡献者用户名
    status: Optional[str] = "APPROVED"     # PENDING / APPROVED / REJECTED
    rejectReason: Optional[str] = None     # 拒绝原因
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    @field_validator('id', mode='before')
    @classmethod
    def convert_id(cls, v):
        """将 ID 转换为整数（如果可能），否则保留为字符串"""
        if isinstance(v, int):
            return v
        if isinstance(v, str):
            # 尝试转换为整数
            try:
                return int(v)
            except ValueError:
                # 如果是 MongoDB ObjectId 等非数字字符串，保留原值
                return v
        return v


class ShowListResponse(BaseModel):
    """秀场列表响应"""
    shows: List[Show]
    total: int
    page: int
    pageSize: int


class CreateShowRequest(BaseModel):
    """创建秀场请求"""
    brand: str                          # 品牌名称（必填）
    title: str                          # 秀场标题（必填）
    year: int                           # 年份（必填）
    season: str                         # 季度（必填）
    category: Optional[str] = None      # 类别
    designer: Optional[str] = None      # 主设计师
    description: Optional[str] = None   # 秀场介绍
    coverImage: Optional[str] = None    # 封面图片 URL


class ShowSearchParams(BaseModel):
    """秀场搜索参数"""
    keyword: Optional[str] = None       # 搜索关键词（品牌、季度、类别）
    brand: Optional[str] = None         # 按品牌筛选
    year: Optional[int] = None          # 按年份筛选
    category: Optional[str] = None      # 按类别筛选
    page: int = 1
    pageSize: int = 50
