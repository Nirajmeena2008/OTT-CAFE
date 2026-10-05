import { describe, it, expect } from 'vitest';
import { orderLikeCuratedMenu } from '../mysqlService';
import { OTT_MENU_ITEMS } from '../../src/data/ottPdfMenu';
import type { MenuItem } from '../../src/types';

describe('orderLikeCuratedMenu', () => {
  it('restores the curated menu order from a name-sorted database result', () => {
    const alphabetical = [...OTT_MENU_ITEMS].sort((a, b) => a.name.localeCompare(b.name));
    expect(orderLikeCuratedMenu(alphabetical).map((m) => m.id)).toEqual(OTT_MENU_ITEMS.map((m) => m.id));
  });

  it('puts admin-added dishes (not in the seed) first, keeping their relative order', () => {
    const added1 = { ...OTT_MENU_ITEMS[0], id: 'admin-added-1', name: 'Zz Special' } as MenuItem;
    const added2 = { ...OTT_MENU_ITEMS[0], id: 'admin-added-2', name: 'Aa Special' } as MenuItem;
    const result = orderLikeCuratedMenu([OTT_MENU_ITEMS[2], added1, OTT_MENU_ITEMS[0], added2]);
    expect(result.map((m) => m.id)).toEqual(['admin-added-1', 'admin-added-2', OTT_MENU_ITEMS[0].id, OTT_MENU_ITEMS[2].id]);
  });

  it('keeps every item — nothing dropped or duplicated', () => {
    const shuffled = [...OTT_MENU_ITEMS].reverse();
    const result = orderLikeCuratedMenu(shuffled);
    expect(result).toHaveLength(OTT_MENU_ITEMS.length);
    expect(new Set(result.map((m) => m.id)).size).toBe(OTT_MENU_ITEMS.length);
  });
});
