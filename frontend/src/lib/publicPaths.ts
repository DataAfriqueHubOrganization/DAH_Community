export const PUBLIC_PATHS = ["/", "/events", "/about", "/blog", "/portfolio", "/members", "/join", "/newsletter"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
