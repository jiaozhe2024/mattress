const TOKEN_KEY = "token";

export function getToken(): string {
  const token = uni.getStorageSync(TOKEN_KEY);
  return typeof token === "string" ? token : "";
}

export function setToken(token: string): void {
  uni.setStorageSync(TOKEN_KEY, token);
}

export function clearToken(): void {
  uni.removeStorageSync(TOKEN_KEY);
}