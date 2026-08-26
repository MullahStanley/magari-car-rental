-- ============================================================
-- 9. Seed vehicle specifications
-- ============================================================
-- Populate spec data for existing sample vehicles.

UPDATE public.vehicles SET
    engine_type = 'Dual Motor',
    engine_capacity = '75 kWh',
    horsepower = 670,
    drivetrain = 'AWD',
    transmission = 'Single-Speed',
    fuel_type = 'Electric',
    seats = 5,
    year = 2020,
    color = 'Pearl White'
WHERE name = 'Model X 2020' AND brand = 'Tesla';

UPDATE public.vehicles SET
    engine_type = 'Twin-Turbo Inline-6',
    engine_capacity = '3.0L',
    horsepower = 510,
    drivetrain = 'AWD',
    transmission = '8-Speed Automatic',
    fuel_type = 'Petrol',
    seats = 5,
    year = 2023,
    color = 'Isle of Man Green'
WHERE name = 'M3 Touring 2023' AND brand = 'BMW';

UPDATE public.vehicles SET
    engine_type = 'Turbocharged Inline-4',
    engine_capacity = '2.0L',
    horsepower = 381,
    drivetrain = 'AWD',
    transmission = '7-Speed Dual Clutch',
    fuel_type = 'Petrol',
    seats = 5,
    year = 2018,
    color = 'Mountain Grey'
WHERE name = 'A-45 AMG 2018' AND brand = 'Mercedes-Benz';

UPDATE public.vehicles SET
    engine_type = 'Twin-Turbo V8',
    engine_capacity = '4.0L',
    horsepower = 542,
    drivetrain = 'AWD',
    transmission = '9-Speed Automatic',
    fuel_type = 'Petrol',
    seats = 5,
    year = 2022,
    color = 'Obsidian Black'
WHERE name = 'Maybach 2022' AND brand = 'Mercedes-Maybach';

UPDATE public.vehicles SET
    engine_type = 'Hybrid Inline-4',
    engine_capacity = '1.5L',
    horsepower = 129,
    drivetrain = 'FWD',
    transmission = 'CVT',
    fuel_type = 'Hybrid',
    seats = 5,
    year = 2024,
    color = 'Champion Yellow'
WHERE name = 'Swift 2024' AND brand = 'Suzuki';

UPDATE public.vehicles SET
    engine_type = 'Hybrid Inline-4',
    engine_capacity = '1.5L',
    horsepower = 115,
    drivetrain = 'FWD',
    transmission = '6-Speed Automatic',
    fuel_type = 'Hybrid',
    seats = 5,
    year = 2024,
    color = 'Savanna Ivory'
WHERE name = 'S-Cross 4x2 GLX 2024' AND brand = 'Suzuki';

UPDATE public.vehicles SET
    engine_type = 'Supercharged V8',
    engine_capacity = '4.2L',
    horsepower = 400,
    drivetrain = '4WD',
    transmission = '6-Speed Automatic',
    fuel_type = 'Petrol',
    seats = 5,
    year = 2006,
    color = 'Chairol Beige'
WHERE name = 'Range Rover Supercharged 2006' AND brand = 'Land Rover';

UPDATE public.vehicles SET
    engine_type = 'Turbocharged Inline-4',
    engine_capacity = '2.8L',
    horsepower = 204,
    drivetrain = '4WD',
    transmission = '6-Speed Automatic',
    fuel_type = 'Diesel',
    seats = 5,
    year = 2022,
    color = 'Charcoal Grey'
WHERE name = 'Toyota Hilux 2022' AND brand = 'Toyota';

UPDATE public.vehicles SET
    engine_type = 'Naturally Aspirated Inline-4',
    engine_capacity = '1.8L',
    horsepower = 212,
    drivetrain = 'FWD',
    transmission = '6-Speed Manual',
    fuel_type = 'Petrol',
    seats = 5,
    year = 2007,
    color = 'Championship White'
WHERE name = 'Integra DB8 Type-R 2007' AND brand = 'Honda';
