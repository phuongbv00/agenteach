import { appConfig } from '../config/AppConfig';

export type PermissionAction = 'read' | 'write';
export type PermissionScope = 'once' | 'session' | 'always';
export type PermissionStatus = 'granted' | 'denied' | 'pending';

// Session-level grants: cleared on app restart
const sessionGrants = new Set<string>();

function key(action: PermissionAction, workspaceId: string): string {
  return `${action}:${workspaceId}`;
}

export const PermissionManager = {
  check(action: PermissionAction, workspaceId: string): PermissionStatus {
    if (appConfig.hasAlwaysPermission(action, workspaceId)) return 'granted';
    if (sessionGrants.has(key(action, workspaceId))) return 'granted';
    return 'pending';
  },

  grant(action: PermissionAction, workspaceId: string, scope: PermissionScope): void {
    if (scope === 'session') {
      sessionGrants.add(key(action, workspaceId));
    } else if (scope === 'always') {
      appConfig.addAlwaysPermission(action, workspaceId);
      sessionGrants.add(key(action, workspaceId));
    }
    // 'once' — no persistent grant, just allow this single call via the await mechanism
  },
};
