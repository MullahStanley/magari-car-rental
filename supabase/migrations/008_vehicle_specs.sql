-- ============================================================
-- 8. Vehicle specifications
-- ============================================================
-- Adds car spec columns so the detail page can show things like
-- engine type, drivetrain, transmission, fuel, etc.

alter table public.vehicles
    add column if not exists engine_type text,
    add column if not exists engine_capacity text,
    add column if not exists horsepower integer,
    add column if not exists drivetrain text,
    add column if not exists transmission text,
    add column if not exists fuel_type text,
    add column if not exists seats integer,
    add column if not exists year integer,
    add column if not exists color text;
