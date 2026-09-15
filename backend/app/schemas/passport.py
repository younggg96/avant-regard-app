"""
数字护照相关的请求 / 响应模型。

目前只覆盖「AI 三视图生成」,后续归因、编号、公开验证页的模型也放这里。
"""

from typing import List, Optional

from pydantic import BaseModel, Field


class ThreeViewRequest(BaseModel):
    # 必须是已经上传到自家 Storage 的公开 URL(走 /api/files/upload-image),
    # 服务层再按白名单校验一次。
    imageUrl: str = Field(..., description="源图 URL,需为自家 Storage 的公开地址")


class ThreeViewItem(BaseModel):
    slug: str                        # front / side / back
    label: str                       # 正视图 / 侧视图 / 背视图
    url: Optional[str] = None        # 生成成功时的 Storage 公开 URL
    error: Optional[str] = None      # 该视图单独失败的原因


class ThreeViewResponse(BaseModel):
    sourceUrl: str
    views: List[ThreeViewItem]
    model: str
    tokensUsed: int
    quotaUsed: int
    quotaLimit: int


class ThreeViewQuotaResponse(BaseModel):
    used: int
    limit: int


# =====================================================
# 5.2 / 5.3 · AI 识别、用户确认与入库
# =====================================================


class AttributeRequest(BaseModel):
    photos: List[str] = Field(..., min_length=1, max_length=9)
    # 用户自己填的名称/备注，作为线索给模型；模型被要求「与图矛盾时以图为准」。
    userHint: Optional[str] = None


class ValidityInfo(BaseModel):
    isFashionItem: bool
    rejectReason: Optional[str] = None
    category: Optional[str] = None
    categoryZh: Optional[str] = None
    confidence: float = 0.0


class AttributionCandidateItem(BaseModel):
    brandId: int
    brandName: str
    showId: Optional[str] = None
    season: Optional[str] = None
    year: Optional[int] = None
    title: Optional[str] = None
    # 匹配证据。有参照图时是比对结论，否则是模型对可见特征的推理。
    evidence: str = ""
    # 仅在有参照图比对时非空，前端据此决定是否显示「N 张中 M 张一致」。
    matchedRefs: Optional[int] = None
    totalRefs: Optional[int] = None
    confidence: float = 0.0
    matchSource: str = "show_metadata"


class AttributeResponse(BaseModel):
    attributionId: int
    validity: ValidityInfo
    # 可能为空数组：认不出来是正常结果，前端此时直接展示可编辑表单。
    candidates: List[AttributionCandidateItem] = Field(default_factory=list)
    visualSummary: Optional[str] = None
    yearRange: Optional[List[int]] = None
    quotaUsed: int = 0
    quotaLimit: int = 0


class ConfirmRequest(BaseModel):
    attributionId: int
    title: str = Field(..., min_length=1, max_length=200)
    # 二选一：brandId 来自品牌列表；pendingBrandName 表示新品牌已提交待审核。
    brandId: Optional[int] = None
    pendingBrandName: Optional[str] = None
    showId: Optional[str] = None
    releaseYear: Optional[int] = None
    # accepted 直接采纳候选 / edited 采纳但改了字段 / none_of_above 都不对
    userAction: str = Field("accepted", pattern="^(accepted|edited|none_of_above)$")

    size: Optional[str] = None
    color: Optional[str] = None
    condition: Optional[str] = None
    acquiredAt: Optional[str] = None
    acquiredPriceCents: Optional[int] = None
    note: Optional[str] = None
    storageLocation: Optional[str] = None
    # 不传则沿用归因时上传的那组图。
    photos: Optional[List[str]] = None
