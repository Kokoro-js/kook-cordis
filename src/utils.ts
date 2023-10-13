import { Permissions } from "./types";

export function hasPermission(permissions: number, permission: Permissions) {
  return (permissions & (1 << permission)) === 1 << permission;
}