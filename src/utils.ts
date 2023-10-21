import { Permissions, List, Pagination } from './types';
import { AbstactBot } from './api/api';

export function hasPermission(permissions: number, permission: Permissions) {
  return (permissions & (1 << permission)) === 1 << permission;
}

export async function allPagesRequest<DataType, Input extends Omit<Pagination, 'page'>>(
  botFunction: (param: Input) => Promise<List<DataType>>,
  params: Input,
): Promise<DataType[]> {
  let {
    items,
    meta: { page_total },
  } = await botFunction(params);

  if (page_total <= 1) return items;

  // 并发请求其他页的数据
  const pagePromises: Promise<List<DataType>>[] = [];
  for (let i = 2; i <= page_total; i++) {
    const updatedParams = { ...params, page: i } as Input;
    pagePromises.push(botFunction(updatedParams));
  }

  const pageResults = await Promise.all(pagePromises);
  for (const result of pageResults) {
    items = items.concat(result.items);
  }

  return items;
}
