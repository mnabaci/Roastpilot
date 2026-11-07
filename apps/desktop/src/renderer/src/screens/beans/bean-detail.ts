import type { Bean } from '@roastpilot/shared';
import { formatGrams } from './batch-format';

/** What helps you pick a bean: its green stock, origin and process ("300 g · Ethiopia · washed"). */
export const beanDetail = (bean: Bean): string =>
  `${formatGrams(bean.greenG)} · ${bean.origin} · ${bean.process}`;
