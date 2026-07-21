-- 1. Drop existing unique constraints
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE public.families DROP CONSTRAINT IF EXISTS families_code_key;

-- 2. Clean up any existing _DELETED_ suffixes (so we start fresh)
UPDATE public.products
SET sku = substring(sku from 1 for position('_DELETED_' in sku) - 1)
WHERE sku LIKE '%_DELETED_%';

UPDATE public.families
SET code = substring(code from 1 for position('_DELETED_' in code) - 1)
WHERE code LIKE '%_DELETED_%';

-- 3. Create Partial Unique Indexes (only active items must be unique)
CREATE UNIQUE INDEX IF NOT EXISTS products_active_sku_key ON public.products (sku) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS families_active_code_key ON public.families (code) WHERE is_active = true;
