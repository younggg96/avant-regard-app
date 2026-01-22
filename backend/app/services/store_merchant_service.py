"""
商家入驻服务
处理商家认证、公告、活动、折扣、Banner 的业务逻辑
"""

from typing import Optional, List, Tuple
from datetime import datetime
from app.db.supabase import get_supabase, get_supabase_admin
from app.schemas.store_merchant import (
    StoreMerchant,
    StoreMerchantCreate,
    StoreMerchantUpdate,
    StoreMerchantReview,
    StoreMerchantAdminUpdate,
    StoreAnnouncement,
    StoreAnnouncementCreate,
    StoreAnnouncementUpdate,
    StoreBanner,
    StoreBannerCreate,
    StoreBannerUpdate,
    StoreActivity,
    StoreActivityCreate,
    StoreActivityUpdate,
    StoreDiscount,
    StoreDiscountCreate,
    StoreDiscountUpdate,
    ActivityRegistration,
    ActivityRegistrationCreate,
    StoreMerchantContent,
)


class StoreMerchantService:
    """商家入驻服务类"""

    def __init__(self):
        self.db = get_supabase()
        self.db_admin = get_supabase_admin()

    # ==================== 商家认证相关 ====================

    def _format_merchant(self, data: dict) -> StoreMerchant:
        """格式化商家数据"""
        return StoreMerchant(
            id=data["id"],
            storeId=data["store_id"],
            userId=data["user_id"],
            contactName=data.get("contact_name"),
            contactPhone=data.get("contact_phone"),
            contactEmail=data.get("contact_email"),
            businessLicense=data.get("business_license"),
            status=data.get("status", "PENDING"),
            rejectReason=data.get("reject_reason"),
            reviewedBy=data.get("reviewed_by"),
            reviewedAt=data.get("reviewed_at"),
            merchantLevel=data.get("merchant_level", "BASIC"),
            canPostBanner=data.get("can_post_banner", True),
            canPostAnnouncement=data.get("can_post_announcement", True),
            canPostActivity=data.get("can_post_activity", True),
            canPostDiscount=data.get("can_post_discount", True),
            createdAt=data.get("created_at"),
            updatedAt=data.get("updated_at"),
        )

    def apply_merchant(self, user_id: int, data: StoreMerchantCreate) -> StoreMerchant:
        """申请成为商家"""
        # 检查是否已经申请过
        existing = (
            self.db.table("store_merchants")
            .select("*")
            .eq("store_id", data.storeId)
            .execute()
        )
        if existing.data:
            raise ValueError("该店铺已有商家认证申请")

        # 创建申请
        insert_data = {
            "store_id": data.storeId,
            "user_id": user_id,
            "contact_name": data.contactName,
            "contact_phone": data.contactPhone,
            "contact_email": data.contactEmail,
            "business_license": data.businessLicense,
            "status": "PENDING",
        }

        result = self.db_admin.table("store_merchants").insert(insert_data).execute()
        return self._format_merchant(result.data[0])

    def get_merchant_by_store(self, store_id: str) -> Optional[StoreMerchant]:
        """通过店铺ID获取商家信息"""
        result = (
            self.db.table("store_merchants")
            .select("*")
            .eq("store_id", store_id)
            .eq("status", "APPROVED")
            .execute()
        )
        if not result.data:
            return None
        return self._format_merchant(result.data[0])

    def get_merchant_by_user(self, user_id: int) -> Optional[StoreMerchant]:
        """通过用户ID获取商家信息"""
        result = (
            self.db.table("store_merchants")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            return None
        return self._format_merchant(result.data[0])

    def get_merchant_by_id(self, merchant_id: int) -> Optional[StoreMerchant]:
        """通过商家ID获取商家信息"""
        result = (
            self.db.table("store_merchants")
            .select("*")
            .eq("id", merchant_id)
            .execute()
        )
        if not result.data:
            return None
        return self._format_merchant(result.data[0])

    def update_merchant(
        self, merchant_id: int, user_id: int, data: StoreMerchantUpdate
    ) -> StoreMerchant:
        """更新商家信息"""
        # 验证权限
        merchant = self.get_merchant_by_id(merchant_id)
        if not merchant or merchant.userId != user_id:
            raise ValueError("无权限修改此商家信息")

        update_data = {}
        if data.contactName is not None:
            update_data["contact_name"] = data.contactName
        if data.contactPhone is not None:
            update_data["contact_phone"] = data.contactPhone
        if data.contactEmail is not None:
            update_data["contact_email"] = data.contactEmail
        if data.businessLicense is not None:
            update_data["business_license"] = data.businessLicense

        if not update_data:
            return merchant

        result = (
            self.db_admin.table("store_merchants")
            .update(update_data)
            .eq("id", merchant_id)
            .execute()
        )
        return self._format_merchant(result.data[0])

    def review_merchant(
        self, merchant_id: int, admin_id: int, data: StoreMerchantReview
    ) -> StoreMerchant:
        """审核商家申请（管理员）"""
        update_data = {
            "status": data.status.value,
            "reviewed_by": admin_id,
            "reviewed_at": datetime.now().isoformat(),
        }
        if data.rejectReason:
            update_data["reject_reason"] = data.rejectReason

        result = (
            self.db_admin.table("store_merchants")
            .update(update_data)
            .eq("id", merchant_id)
            .execute()
        )
        if not result.data:
            raise ValueError("商家申请不存在")
        return self._format_merchant(result.data[0])

    def get_pending_merchants(
        self, page: int = 1, page_size: int = 20
    ) -> Tuple[List[dict], int]:
        """获取待审核的商家列表（管理员）- 包含店铺和用户信息"""
        offset = (page - 1) * page_size
        result = (
            self.db.table("store_merchants")
            .select("*", count="exact")
            .eq("status", "PENDING")
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        
        # 增强商家信息，添加店铺和用户信息
        enriched_merchants = []
        for m in result.data:
            merchant_data = self._format_merchant(m).model_dump()
            
            # 获取店铺信息
            store_id = m.get("store_id")
            if store_id:
                store_result = (
                    self.db.table("buyer_stores")
                    .select("name, address, city")
                    .eq("id", store_id)
                    .execute()
                )
                if store_result.data:
                    store = store_result.data[0]
                    merchant_data["storeName"] = store.get("name")
                    merchant_data["storeAddress"] = store.get("address")
                    merchant_data["storeCity"] = store.get("city")
            
            # 获取用户信息
            user_id = m.get("user_id")
            if user_id:
                user_result = (
                    self.db.table("users")
                    .select("username")
                    .eq("id", user_id)
                    .execute()
                )
                if user_result.data:
                    user = user_result.data[0]
                    merchant_data["username"] = user.get("username")
                
                # 从 user_info 表获取头像
                user_info_result = (
                    self.db.table("user_info")
                    .select("avatar_url")
                    .eq("user_id", user_id)
                    .execute()
                )
                if user_info_result.data:
                    merchant_data["userAvatar"] = user_info_result.data[0].get("avatar_url")
            
            enriched_merchants.append(merchant_data)
        
        return enriched_merchants, result.count or 0

    def get_user_merchants(
        self, user_id: int, page: int = 1, page_size: int = 20
    ) -> Tuple[List[StoreMerchant], int]:
        """获取用户的商家列表"""
        offset = (page - 1) * page_size
        result = (
            self.db.table("store_merchants")
            .select("*", count="exact")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        merchants = [self._format_merchant(m) for m in result.data]
        return merchants, result.count or 0

    def get_all_merchants(
        self, status: Optional[str] = None, page: int = 1, page_size: int = 20
    ) -> Tuple[List[dict], int]:
        """获取所有商家列表（管理员）- 包含店铺和用户信息"""
        offset = (page - 1) * page_size
        query = (
            self.db.table("store_merchants")
            .select("*", count="exact")
        )
        
        # 状态筛选
        if status:
            query = query.eq("status", status)
        
        result = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
        
        # 增强商家信息
        enriched_merchants = []
        for m in result.data:
            merchant_data = self._format_merchant(m).model_dump()
            
            # 获取店铺信息
            store_id = m.get("store_id")
            if store_id:
                store_result = (
                    self.db.table("buyer_stores")
                    .select("name, address, city")
                    .eq("id", store_id)
                    .execute()
                )
                if store_result.data:
                    store = store_result.data[0]
                    merchant_data["storeName"] = store.get("name")
                    merchant_data["storeAddress"] = store.get("address")
                    merchant_data["storeCity"] = store.get("city")
            
            # 获取用户信息
            user_id = m.get("user_id")
            if user_id:
                user_result = (
                    self.db.table("users")
                    .select("username")
                    .eq("id", user_id)
                    .execute()
                )
                if user_result.data:
                    merchant_data["username"] = user_result.data[0].get("username")
                
                user_info_result = (
                    self.db.table("user_info")
                    .select("avatar_url")
                    .eq("user_id", user_id)
                    .execute()
                )
                if user_info_result.data:
                    merchant_data["userAvatar"] = user_info_result.data[0].get("avatar_url")
            
            enriched_merchants.append(merchant_data)
        
        return enriched_merchants, result.count or 0

    def admin_update_merchant(
        self, merchant_id: int, admin_id: int, data: StoreMerchantAdminUpdate
    ) -> StoreMerchant:
        """管理员更新商家信息"""
        update_data = {}
        
        if data.status is not None:
            update_data["status"] = data.status.value
        if data.merchantLevel is not None:
            update_data["merchant_level"] = data.merchantLevel.value
        if data.canPostBanner is not None:
            update_data["can_post_banner"] = data.canPostBanner
        if data.canPostAnnouncement is not None:
            update_data["can_post_announcement"] = data.canPostAnnouncement
        if data.canPostActivity is not None:
            update_data["can_post_activity"] = data.canPostActivity
        if data.canPostDiscount is not None:
            update_data["can_post_discount"] = data.canPostDiscount
        
        if not update_data:
            merchant = self.get_merchant_by_id(merchant_id)
            if not merchant:
                raise ValueError("商家不存在")
            return merchant
        
        result = (
            self.db_admin.table("store_merchants")
            .update(update_data)
            .eq("id", merchant_id)
            .execute()
        )
        if not result.data:
            raise ValueError("商家不存在")
        return self._format_merchant(result.data[0])

    # ==================== 公告相关 ====================

    def _format_announcement(self, data: dict) -> StoreAnnouncement:
        """格式化公告数据"""
        return StoreAnnouncement(
            id=data["id"],
            storeId=data["store_id"],
            merchantId=data["merchant_id"],
            title=data["title"],
            content=data["content"],
            isPinned=data.get("is_pinned", False),
            status=data.get("status", "PUBLISHED"),
            startTime=data.get("start_time"),
            endTime=data.get("end_time"),
            createdAt=data.get("created_at"),
            updatedAt=data.get("updated_at"),
        )

    def create_announcement(
        self, merchant_id: int, store_id: str, data: StoreAnnouncementCreate
    ) -> StoreAnnouncement:
        """创建公告"""
        insert_data = {
            "store_id": store_id,
            "merchant_id": merchant_id,
            "title": data.title,
            "content": data.content,
            "is_pinned": data.isPinned,
            "status": data.status.value,
            "start_time": data.startTime,
            "end_time": data.endTime,
        }

        result = self.db_admin.table("store_announcements").insert(insert_data).execute()
        return self._format_announcement(result.data[0])

    def update_announcement(
        self, announcement_id: int, merchant_id: int, data: StoreAnnouncementUpdate
    ) -> StoreAnnouncement:
        """更新公告"""
        update_data = {}
        if data.title is not None:
            update_data["title"] = data.title
        if data.content is not None:
            update_data["content"] = data.content
        if data.isPinned is not None:
            update_data["is_pinned"] = data.isPinned
        if data.status is not None:
            update_data["status"] = data.status.value
        if data.startTime is not None:
            update_data["start_time"] = data.startTime
        if data.endTime is not None:
            update_data["end_time"] = data.endTime

        result = (
            self.db_admin.table("store_announcements")
            .update(update_data)
            .eq("id", announcement_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
        if not result.data:
            raise ValueError("公告不存在或无权限修改")
        return self._format_announcement(result.data[0])

    def delete_announcement(self, announcement_id: int, merchant_id: int) -> bool:
        """删除公告"""
        result = (
            self.db_admin.table("store_announcements")
            .delete()
            .eq("id", announcement_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
        return len(result.data) > 0

    def get_store_announcements(
        self, store_id: str, include_hidden: bool = False
    ) -> List[StoreAnnouncement]:
        """获取店铺公告列表"""
        query = (
            self.db.table("store_announcements")
            .select("*")
            .eq("store_id", store_id)
        )

        if not include_hidden:
            query = query.eq("status", "PUBLISHED")

        result = query.order("is_pinned", desc=True).order("created_at", desc=True).execute()
        return [self._format_announcement(a) for a in result.data]

    def get_merchant_announcements(
        self, merchant_id: int, page: int = 1, page_size: int = 20
    ) -> Tuple[List[StoreAnnouncement], int]:
        """获取商家的公告列表"""
        offset = (page - 1) * page_size
        result = (
            self.db.table("store_announcements")
            .select("*", count="exact")
            .eq("merchant_id", merchant_id)
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        announcements = [self._format_announcement(a) for a in result.data]
        return announcements, result.count or 0

    # ==================== Banner 相关 ====================

    def _format_banner(self, data: dict) -> StoreBanner:
        """格式化 Banner 数据"""
        return StoreBanner(
            id=data["id"],
            storeId=data["store_id"],
            merchantId=data["merchant_id"],
            title=data.get("title"),
            imageUrl=data["image_url"],
            linkUrl=data.get("link_url"),
            linkType=data.get("link_type", "NONE"),
            sortOrder=data.get("sort_order", 0),
            status=data.get("status", "PUBLISHED"),
            startTime=data.get("start_time"),
            endTime=data.get("end_time"),
            clickCount=data.get("click_count", 0),
            viewCount=data.get("view_count", 0),
            createdAt=data.get("created_at"),
            updatedAt=data.get("updated_at"),
        )

    def create_banner(
        self, merchant_id: int, store_id: str, data: StoreBannerCreate
    ) -> StoreBanner:
        """创建 Banner"""
        insert_data = {
            "store_id": store_id,
            "merchant_id": merchant_id,
            "title": data.title,
            "image_url": data.imageUrl,
            "link_url": data.linkUrl,
            "link_type": data.linkType.value,
            "sort_order": data.sortOrder,
            "status": data.status.value,
            "start_time": data.startTime,
            "end_time": data.endTime,
        }

        result = self.db_admin.table("store_banners").insert(insert_data).execute()
        return self._format_banner(result.data[0])

    def update_banner(
        self, banner_id: int, merchant_id: int, data: StoreBannerUpdate
    ) -> StoreBanner:
        """更新 Banner"""
        update_data = {}
        if data.title is not None:
            update_data["title"] = data.title
        if data.imageUrl is not None:
            update_data["image_url"] = data.imageUrl
        if data.linkUrl is not None:
            update_data["link_url"] = data.linkUrl
        if data.linkType is not None:
            update_data["link_type"] = data.linkType.value
        if data.sortOrder is not None:
            update_data["sort_order"] = data.sortOrder
        if data.status is not None:
            update_data["status"] = data.status.value
        if data.startTime is not None:
            update_data["start_time"] = data.startTime
        if data.endTime is not None:
            update_data["end_time"] = data.endTime

        result = (
            self.db_admin.table("store_banners")
            .update(update_data)
            .eq("id", banner_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
        if not result.data:
            raise ValueError("Banner 不存在或无权限修改")
        return self._format_banner(result.data[0])

    def delete_banner(self, banner_id: int, merchant_id: int) -> bool:
        """删除 Banner"""
        result = (
            self.db_admin.table("store_banners")
            .delete()
            .eq("id", banner_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
        return len(result.data) > 0

    def get_store_banners(
        self, store_id: str, include_hidden: bool = False
    ) -> List[StoreBanner]:
        """获取店铺 Banner 列表"""
        query = (
            self.db.table("store_banners")
            .select("*")
            .eq("store_id", store_id)
        )

        if not include_hidden:
            query = query.eq("status", "PUBLISHED")

        result = query.order("sort_order").order("created_at", desc=True).execute()
        return [self._format_banner(b) for b in result.data]

    def get_merchant_banners(
        self, merchant_id: int, page: int = 1, page_size: int = 20
    ) -> Tuple[List[StoreBanner], int]:
        """获取商家的 Banner 列表"""
        offset = (page - 1) * page_size
        result = (
            self.db.table("store_banners")
            .select("*", count="exact")
            .eq("merchant_id", merchant_id)
            .order("sort_order")
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        banners = [self._format_banner(b) for b in result.data]
        return banners, result.count or 0

    def increment_banner_click(self, banner_id: int):
        """增加 Banner 点击数"""
        self.db_admin.rpc("increment_banner_click", {"banner_id": banner_id}).execute()

    # ==================== 活动相关 ====================

    def _format_activity(self, data: dict) -> StoreActivity:
        """格式化活动数据"""
        return StoreActivity(
            id=data["id"],
            storeId=data["store_id"],
            merchantId=data["merchant_id"],
            title=data["title"],
            description=data.get("description"),
            coverImage=data.get("cover_image"),
            images=data.get("images") or [],
            activityStartTime=data["activity_start_time"],
            activityEndTime=data["activity_end_time"],
            location=data.get("location"),
            activityType=data.get("activity_type", "EVENT"),
            status=data.get("status", "PUBLISHED"),
            needRegistration=data.get("need_registration", False),
            registrationLimit=data.get("registration_limit"),
            registrationCount=data.get("registration_count", 0),
            createdAt=data.get("created_at"),
            updatedAt=data.get("updated_at"),
        )

    def create_activity(
        self, merchant_id: int, store_id: str, data: StoreActivityCreate
    ) -> StoreActivity:
        """创建活动"""
        insert_data = {
            "store_id": store_id,
            "merchant_id": merchant_id,
            "title": data.title,
            "description": data.description,
            "cover_image": data.coverImage,
            "images": data.images,
            "activity_start_time": data.activityStartTime,
            "activity_end_time": data.activityEndTime,
            "location": data.location,
            "activity_type": data.activityType.value,
            "status": data.status.value,
            "need_registration": data.needRegistration,
            "registration_limit": data.registrationLimit,
        }

        result = self.db_admin.table("store_activities").insert(insert_data).execute()
        return self._format_activity(result.data[0])

    def update_activity(
        self, activity_id: int, merchant_id: int, data: StoreActivityUpdate
    ) -> StoreActivity:
        """更新活动"""
        update_data = {}
        if data.title is not None:
            update_data["title"] = data.title
        if data.description is not None:
            update_data["description"] = data.description
        if data.coverImage is not None:
            update_data["cover_image"] = data.coverImage
        if data.images is not None:
            update_data["images"] = data.images
        if data.activityStartTime is not None:
            update_data["activity_start_time"] = data.activityStartTime
        if data.activityEndTime is not None:
            update_data["activity_end_time"] = data.activityEndTime
        if data.location is not None:
            update_data["location"] = data.location
        if data.activityType is not None:
            update_data["activity_type"] = data.activityType.value
        if data.status is not None:
            update_data["status"] = data.status.value
        if data.needRegistration is not None:
            update_data["need_registration"] = data.needRegistration
        if data.registrationLimit is not None:
            update_data["registration_limit"] = data.registrationLimit

        result = (
            self.db_admin.table("store_activities")
            .update(update_data)
            .eq("id", activity_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
        if not result.data:
            raise ValueError("活动不存在或无权限修改")
        return self._format_activity(result.data[0])

    def delete_activity(self, activity_id: int, merchant_id: int) -> bool:
        """删除活动"""
        result = (
            self.db_admin.table("store_activities")
            .delete()
            .eq("id", activity_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
        return len(result.data) > 0

    def get_store_activities(
        self, store_id: str, include_ended: bool = False
    ) -> List[StoreActivity]:
        """获取店铺活动列表"""
        query = (
            self.db.table("store_activities")
            .select("*")
            .eq("store_id", store_id)
            .eq("status", "PUBLISHED")
        )

        if not include_ended:
            now = datetime.now().isoformat()
            query = query.gte("activity_end_time", now)

        result = query.order("activity_start_time").execute()
        return [self._format_activity(a) for a in result.data]

    def get_merchant_activities(
        self, merchant_id: int, page: int = 1, page_size: int = 20
    ) -> Tuple[List[StoreActivity], int]:
        """获取商家的活动列表"""
        offset = (page - 1) * page_size
        result = (
            self.db.table("store_activities")
            .select("*", count="exact")
            .eq("merchant_id", merchant_id)
            .order("activity_start_time", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        activities = [self._format_activity(a) for a in result.data]
        return activities, result.count or 0

    def get_activity_by_id(self, activity_id: int) -> Optional[StoreActivity]:
        """通过ID获取活动"""
        result = (
            self.db.table("store_activities")
            .select("*")
            .eq("id", activity_id)
            .execute()
        )
        if not result.data:
            return None
        return self._format_activity(result.data[0])

    # ==================== 折扣相关 ====================

    def _format_discount(self, data: dict) -> StoreDiscount:
        """格式化折扣数据"""
        return StoreDiscount(
            id=data["id"],
            storeId=data["store_id"],
            merchantId=data["merchant_id"],
            title=data["title"],
            description=data.get("description"),
            coverImage=data.get("cover_image"),
            discountType=data["discount_type"],
            discountValue=data.get("discount_value"),
            applicableBrands=data.get("applicable_brands") or [],
            applicableCategories=data.get("applicable_categories") or [],
            discountStartTime=data["discount_start_time"],
            discountEndTime=data["discount_end_time"],
            minPurchaseAmount=float(data["min_purchase_amount"]) if data.get("min_purchase_amount") else None,
            termsAndConditions=data.get("terms_and_conditions"),
            status=data.get("status", "PUBLISHED"),
            needCode=data.get("need_code", False),
            discountCode=data.get("discount_code"),
            createdAt=data.get("created_at"),
            updatedAt=data.get("updated_at"),
        )

    def create_discount(
        self, merchant_id: int, store_id: str, data: StoreDiscountCreate
    ) -> StoreDiscount:
        """创建折扣"""
        insert_data = {
            "store_id": store_id,
            "merchant_id": merchant_id,
            "title": data.title,
            "description": data.description,
            "cover_image": data.coverImage,
            "discount_type": data.discountType.value,
            "discount_value": data.discountValue,
            "applicable_brands": data.applicableBrands,
            "applicable_categories": data.applicableCategories,
            "discount_start_time": data.discountStartTime,
            "discount_end_time": data.discountEndTime,
            "min_purchase_amount": data.minPurchaseAmount,
            "terms_and_conditions": data.termsAndConditions,
            "status": data.status.value,
            "need_code": data.needCode,
            "discount_code": data.discountCode,
        }

        result = self.db_admin.table("store_discounts").insert(insert_data).execute()
        return self._format_discount(result.data[0])

    def update_discount(
        self, discount_id: int, merchant_id: int, data: StoreDiscountUpdate
    ) -> StoreDiscount:
        """更新折扣"""
        update_data = {}
        if data.title is not None:
            update_data["title"] = data.title
        if data.description is not None:
            update_data["description"] = data.description
        if data.coverImage is not None:
            update_data["cover_image"] = data.coverImage
        if data.discountType is not None:
            update_data["discount_type"] = data.discountType.value
        if data.discountValue is not None:
            update_data["discount_value"] = data.discountValue
        if data.applicableBrands is not None:
            update_data["applicable_brands"] = data.applicableBrands
        if data.applicableCategories is not None:
            update_data["applicable_categories"] = data.applicableCategories
        if data.discountStartTime is not None:
            update_data["discount_start_time"] = data.discountStartTime
        if data.discountEndTime is not None:
            update_data["discount_end_time"] = data.discountEndTime
        if data.minPurchaseAmount is not None:
            update_data["min_purchase_amount"] = data.minPurchaseAmount
        if data.termsAndConditions is not None:
            update_data["terms_and_conditions"] = data.termsAndConditions
        if data.status is not None:
            update_data["status"] = data.status.value
        if data.needCode is not None:
            update_data["need_code"] = data.needCode
        if data.discountCode is not None:
            update_data["discount_code"] = data.discountCode

        result = (
            self.db_admin.table("store_discounts")
            .update(update_data)
            .eq("id", discount_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
        if not result.data:
            raise ValueError("折扣不存在或无权限修改")
        return self._format_discount(result.data[0])

    def delete_discount(self, discount_id: int, merchant_id: int) -> bool:
        """删除折扣"""
        result = (
            self.db_admin.table("store_discounts")
            .delete()
            .eq("id", discount_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
        return len(result.data) > 0

    def get_store_discounts(
        self, store_id: str, include_ended: bool = False
    ) -> List[StoreDiscount]:
        """获取店铺折扣列表"""
        query = (
            self.db.table("store_discounts")
            .select("*")
            .eq("store_id", store_id)
            .eq("status", "PUBLISHED")
        )

        if not include_ended:
            now = datetime.now().isoformat()
            query = query.gte("discount_end_time", now)

        result = query.order("discount_start_time").execute()
        return [self._format_discount(d) for d in result.data]

    def get_merchant_discounts(
        self, merchant_id: int, page: int = 1, page_size: int = 20
    ) -> Tuple[List[StoreDiscount], int]:
        """获取商家的折扣列表"""
        offset = (page - 1) * page_size
        result = (
            self.db.table("store_discounts")
            .select("*", count="exact")
            .eq("merchant_id", merchant_id)
            .order("discount_start_time", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        discounts = [self._format_discount(d) for d in result.data]
        return discounts, result.count or 0

    # ==================== 活动报名相关 ====================

    def _format_registration(self, data: dict) -> ActivityRegistration:
        """格式化报名数据"""
        return ActivityRegistration(
            id=data["id"],
            activityId=data["activity_id"],
            userId=data["user_id"],
            username=data.get("username"),
            userAvatar=data.get("user_avatar"),
            contactName=data.get("contact_name"),
            contactPhone=data.get("contact_phone"),
            note=data.get("note"),
            status=data.get("status", "REGISTERED"),
            createdAt=data.get("created_at"),
            updatedAt=data.get("updated_at"),
        )

    def register_activity(
        self, activity_id: int, user_id: int, data: ActivityRegistrationCreate
    ) -> ActivityRegistration:
        """报名活动"""
        # 检查活动是否存在
        activity = self.get_activity_by_id(activity_id)
        if not activity:
            raise ValueError("活动不存在")

        # 检查是否需要报名
        if not activity.needRegistration:
            raise ValueError("该活动无需报名")

        # 检查是否已满
        if activity.registrationLimit and activity.registrationCount >= activity.registrationLimit:
            raise ValueError("报名人数已满")

        # 检查是否已报名
        existing = (
            self.db.table("store_activity_registrations")
            .select("*")
            .eq("activity_id", activity_id)
            .eq("user_id", user_id)
            .execute()
        )
        if existing.data:
            raise ValueError("您已报名该活动")

        insert_data = {
            "activity_id": activity_id,
            "user_id": user_id,
            "contact_name": data.contactName,
            "contact_phone": data.contactPhone,
            "note": data.note,
            "status": "REGISTERED",
        }

        result = (
            self.db_admin.table("store_activity_registrations")
            .insert(insert_data)
            .execute()
        )
        return self._format_registration(result.data[0])

    def cancel_registration(self, activity_id: int, user_id: int) -> bool:
        """取消报名"""
        result = (
            self.db_admin.table("store_activity_registrations")
            .delete()
            .eq("activity_id", activity_id)
            .eq("user_id", user_id)
            .execute()
        )
        return len(result.data) > 0

    def get_activity_registrations(
        self, activity_id: int, page: int = 1, page_size: int = 20
    ) -> Tuple[List[ActivityRegistration], int]:
        """获取活动报名列表"""
        offset = (page - 1) * page_size
        result = (
            self.db.table("store_activity_registrations")
            .select("*", count="exact")
            .eq("activity_id", activity_id)
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        registrations = [self._format_registration(r) for r in result.data]
        return registrations, result.count or 0

    def check_user_registration(self, activity_id: int, user_id: int) -> bool:
        """检查用户是否已报名活动"""
        result = (
            self.db.table("store_activity_registrations")
            .select("id")
            .eq("activity_id", activity_id)
            .eq("user_id", user_id)
            .execute()
        )
        return len(result.data) > 0

    # ==================== 综合查询 ====================

    def get_store_merchant_content(self, store_id: str) -> StoreMerchantContent:
        """获取店铺的所有商家发布内容"""
        merchant = self.get_merchant_by_store(store_id)

        return StoreMerchantContent(
            isMerchant=merchant is not None,
            merchantInfo=merchant,
            banners=self.get_store_banners(store_id) if merchant else [],
            announcements=self.get_store_announcements(store_id) if merchant else [],
            activities=self.get_store_activities(store_id) if merchant else [],
            discounts=self.get_store_discounts(store_id) if merchant else [],
        )


# 创建单例
store_merchant_service = StoreMerchantService()
