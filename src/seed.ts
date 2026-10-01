import type { Container } from './container';
import type { CreateStaffInput } from './modules/staff/staff.types';

export const SEED_PASSWORD = 'Password123!';

const SEED_STAFF: CreateStaffInput[] = [
  { email: 'regional@storeops.local', firstName: 'Rhea', lastName: 'Gonzalez', role: 'REGIONAL_MANAGER', storeId: 'store-001', regionId: 'region-north', password: SEED_PASSWORD },
  { email: 'manager@storeops.local', firstName: 'Sam', lastName: 'Okafor', role: 'STORE_MANAGER', storeId: 'store-001', regionId: 'region-north', password: SEED_PASSWORD },
  { email: 'lead@storeops.local', firstName: 'Dana', lastName: 'Lee', role: 'DEPARTMENT_LEAD', storeId: 'store-001', regionId: 'region-north', password: SEED_PASSWORD },
  { email: 'associate@storeops.local', firstName: 'Alex', lastName: 'Nowak', role: 'ASSOCIATE', storeId: 'store-001', regionId: 'region-north', password: SEED_PASSWORD },
];

/** Seeds development staff accounts so the in-memory API is usable straight after start-up. */
export const seed = async (container: Container): Promise<string[]> => {
  for (const input of SEED_STAFF) await container.staffService.createStaff(input);
  return SEED_STAFF.map((s) => s.email);
};
