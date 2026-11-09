export function formatDate(value: string | null | undefined): string;
export function displayStatus(value: string | null | undefined): string;
export function plural(count: number, singular: string, multiple?: string): string;
export function statusClass(value: string | null | undefined): string;
export function authorityLabel(roles: readonly string[], platformRoles?: readonly string[]): string;
export function reportFileLabel(filename: string): string;
