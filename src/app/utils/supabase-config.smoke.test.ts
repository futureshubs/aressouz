import { describe, expect, it } from 'vitest';
import {
  API_BASE_URL,
  DEV_API_BASE_URL,
  edgeFunctionSlug,
} from '../../../utils/supabase/info';

describe('supabase edge config (smoke)', () => {
  it('exports slug and URLs consistent with Edge deploy', () => {
    expect(edgeFunctionSlug).toMatch(/^[a-z0-9-]+$/);
    expect(API_BASE_URL).toContain(`/functions/v1/${edgeFunctionSlug}`);
    expect(DEV_API_BASE_URL).toContain(edgeFunctionSlug);
  });
});
