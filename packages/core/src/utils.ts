import { List, Pagination, Permissions } from './types';

/**
 *
 * @param permissions 代表权限值
 * @param permission 对应枚举
 */
export function hasPermission(permissions: number, permission: Permissions) {
  return (permissions & (1 << permission)) === 1 << permission;
}

export function generatePermission(bitValues: Permissions[]) {
  let permissions = 0;
  for (const bitValue of bitValues) {
    permissions |= 1 << bitValue;
  }
  return permissions;
}

export async function allPagesRequest<DataType, Request extends Pagination>(
  botFunction: (param: Request) => Promise<List<DataType>>,
  params: Omit<Request, 'page'>,
): Promise<DataType[]> {
  const firstPage = await botFunction({
    ...params,
    page: 1,
  } as Request);

  let {
    items,
    meta: { page_total },
  } = firstPage;

  if (page_total <= 1) return items;

  const pagePromises: Promise<List<DataType>>[] = [];
  for (let i = 2; i <= page_total; i++) {
    pagePromises.push(
      botFunction({
        ...params,
        page: i,
      } as Request),
    );
  }

  const pageResults = await Promise.all(pagePromises);
  for (const result of pageResults) {
    items = items.concat(result.items);
  }

  return items;
}

const kmarkdownChars = /([*~\[\]()>\-\\:`])/g;
export function escapeKmdText(text: string = ''): string {
  return text?.replace(kmarkdownChars, '\\$1');
}
