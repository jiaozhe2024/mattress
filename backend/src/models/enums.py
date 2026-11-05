from enum import Enum, IntEnum, StrEnum


class EnumBase(Enum):
    @classmethod
    def get_member_values(cls):
        return [item.value for item in cls._member_map_.values()]

    @classmethod
    def get_member_names(cls):
        return list(cls._member_names_)


class MethodType(StrEnum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"
    PATCH = "PATCH"


# ---------------- 业务枚举（BE-02：gin_/wx_ 业务表） ----------------
class CommonStatus(IntEnum):
    """通用启用/上架状态：0 禁用/下架，1 启用/上架。"""

    DISABLED = 0
    ENABLED = 1


class BannerJumpType(IntEnum):
    """轮播图跳转类型（aaa.md §5.2.6）：1 无 2 分类 3 产品 4 外链。"""

    NONE = 1
    CATEGORY = 2
    PRODUCT = 3
    EXTERNAL = 4


class ArticleCategory(StrEnum):
    """资讯与服务分类（PRD §7 gin_article.category）。"""

    NEWS = "news"  # 宝顿资讯
    SERVICE = "service"  # 服务板块（首页品牌服务卡片）
