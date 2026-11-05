/** 后端统一响应信封（backend/src/schemas/base.py: Success/Fail） */
export interface ApiEnvelope<T> {
  code: number
  msg: string | null
  data: T
}

/** 分页信封（SuccessExtra） */
export interface ApiEnvelopeExtra<T> extends ApiEnvelope<T> {
  total: number
  page: number
  page_size: number
}

/** POST /base/access_token 的 data（backend/src/schemas/login.py: JWTOut） */
export interface LoginResult {
  access_token: string
  refresh_token: string
  username: string
  token_type: string
  expires_in: number
}

/** GET /base/userinfo 的 data（User.to_dict(m2m=True)，角色为浅序列化） */
export interface UserInfo {
  id: number
  username: string
  alias: string | null
  email: string
  phone: string | null
  is_active: boolean
  is_superuser: boolean
  last_login: string | null
  dept_id: number | null
  created_at: string
  updated_at: string
  roles: RoleBrief[]
}

export interface RoleBrief {
  id: number
  name: string
  desc: string | null
  created_at: string
  updated_at: string
}

/** GET /role/authorized?id= 的 data（Role.to_dict(m2m=True)，含菜单与 API） */
export interface RoleAuthorized extends RoleBrief {
  menus: BackendMenu[]
  apis: BackendApi[]
}

/** 后端菜单表（backend/src/models/admin.py: Menu） */
export interface BackendMenu {
  id: number
  name: string
  menu_type: string | null
  icon: string | null
  path: string
  order: number
  parent_id: number
  is_hidden: boolean
  component: string
  keepalive: boolean
  redirect: string | null
  remark: Record<string, unknown> | null
}

export interface BackendApi {
  id: number
  path: string
  method: string
  summary: string
  tags: string
}
