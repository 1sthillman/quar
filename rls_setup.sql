-- RLS Ayarları ve Tablo Yapılandırmaları
-- Bu SQL dosyası, Supabase projesinde gerekli tablo yapılandırmalarını ve güvenlik politikalarını içerir

-- 1. Tabloları oluştur (eğer yoksa)
CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    table_id INTEGER NOT NULL,
    number INTEGER NOT NULL,
    status TEXT DEFAULT 'idle',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES public.tables(id),
    status TEXT DEFAULT 'requested',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. RLS'yi etkinleştir
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- 3. Varsayılan politikaları kaldır (eğer varsa)
DROP POLICY IF EXISTS "tables_select_policy" ON public.tables;
DROP POLICY IF EXISTS "tables_insert_policy" ON public.tables;
DROP POLICY IF EXISTS "tables_update_policy" ON public.tables;
DROP POLICY IF EXISTS "calls_select_policy" ON public.calls;
DROP POLICY IF EXISTS "calls_insert_policy" ON public.calls;
DROP POLICY IF EXISTS "calls_update_policy" ON public.calls;

-- 4. Yeni politikaları oluştur

-- Tables tablosu için politikalar
-- Herkes tabloları görebilir
CREATE POLICY "tables_select_policy" ON public.tables
    FOR SELECT USING (true);

-- Herkes yeni masa ekleyebilir
CREATE POLICY "tables_insert_policy" ON public.tables
    FOR INSERT WITH CHECK (true);

-- Herkes masa durumunu güncelleyebilir
CREATE POLICY "tables_update_policy" ON public.tables
    FOR UPDATE USING (true)
    WITH CHECK (true);

-- Calls tablosu için politikalar
-- Herkes çağrıları görebilir
CREATE POLICY "calls_select_policy" ON public.calls
    FOR SELECT USING (true);

-- Herkes çağrı ekleyebilir
CREATE POLICY "calls_insert_policy" ON public.calls
    FOR INSERT WITH CHECK (true);

-- Herkes çağrı durumunu güncelleyebilir
CREATE POLICY "calls_update_policy" ON public.calls
    FOR UPDATE USING (true)
    WITH CHECK (true);

-- 5. Anonim kullanıcılara izin ver
GRANT SELECT, INSERT, UPDATE ON public.tables TO anon;
GRANT SELECT, INSERT, UPDATE ON public.calls TO anon;

-- 6. Realtime özelliklerini etkinleştir
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

-- 7. İndeksler ekle (performans için)
CREATE INDEX IF NOT EXISTS tables_restaurant_table_idx ON public.tables (restaurant_id, table_id);
CREATE INDEX IF NOT EXISTS calls_table_id_idx ON public.calls (table_id);
CREATE INDEX IF NOT EXISTS calls_status_idx ON public.calls (status); 