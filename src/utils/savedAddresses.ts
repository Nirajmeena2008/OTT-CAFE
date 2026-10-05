export interface SavedAddress {
  id: string;
  label: 'Home' | 'Work' | 'Campus' | 'Other' | string;
  recipientName: string;
  recipientPhone: string;
  addressLine: string;
  landmark?: string;
  pincode?: string;
  isDefault?: boolean;
  createdAt: string;
}

const STORAGE_KEY = 'ott_saved_addresses';

export function getSavedAddresses(): SavedAddress[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fallback
  }

  return [];
}

export function saveAddress(addr: Omit<SavedAddress, 'id' | 'createdAt'> & { id?: string }): SavedAddress[] {
  const current = getSavedAddresses();
  const id = addr.id || `addr-${Date.now()}`;
  const isDefault = Boolean(addr.isDefault) || current.length === 0;

  let updatedList: SavedAddress[];

  if (addr.id) {
    updatedList = current.map((existing) => {
      if (existing.id === addr.id) {
        return {
          ...existing,
          ...addr,
          id: existing.id,
          createdAt: existing.createdAt,
          isDefault,
        };
      }
      return isDefault ? { ...existing, isDefault: false } : existing;
    });
  } else {
    const newEntry: SavedAddress = {
      ...addr,
      id,
      isDefault,
      createdAt: new Date().toISOString(),
    };
    updatedList = [
      newEntry,
      ...current.map((item) => (isDefault ? { ...item, isDefault: false } : item)),
    ];
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  } catch {
    // ignore
  }

  return updatedList;
}

export function deleteAddress(id: string): SavedAddress[] {
  const current = getSavedAddresses();
  const filtered = current.filter((a) => a.id !== id);

  // If the deleted address was default, set the first one as default
  if (filtered.length > 0 && !filtered.some((a) => a.isDefault)) {
    filtered[0].isDefault = true;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // ignore
  }

  return filtered;
}

export function setDefaultAddress(id: string): SavedAddress[] {
  const current = getSavedAddresses();
  const updated = current.map((a) => ({
    ...a,
    isDefault: a.id === id,
  }));

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }

  return updated;
}
