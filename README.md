# Magari Car Rental

A full-stack car rental web application built as part of my coursework. The idea was to go beyond a basic CRUD app and build something that actually feels modern — users can browse a fleet of cars, preview vehicles in 3D, pick rental dates, and make bookings.

**Magari** means "car" in Swahili, which felt like a fitting name for a rental platform.

---

## What This Project Does

- Browse available cars on a fleet catalog page (`/cars`)
- Filter by category, price range, and availability dates (filters are saved in the URL so you can share a link)
- View individual car details with an interactive **3D showroom** — rotate the model and change the paint color
- Sign up / log in and book a car for a date range
- View and cancel your bookings from a personal dashboard

The backend is handled by **Supabase** (PostgreSQL database, authentication, and file storage for 3D models).

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Next.js 14 (App Router), React, TypeScript |
| Styling | Tailwind CSS, Framer Motion, Shadcn UI |
| 3D Graphics | React Three Fiber, `@react-three/drei`, Three.js |
| Backend | Supabase (Postgres, Auth, Storage, Row Level Security) |

---

## Project Structure

```
magari-car-rental/
├── supabase/
│   └── migrations/          # Database schema + RLS policies
├── src/
│   ├── app/                 # Pages (App Router)
│   ├── components/          # UI, 3D showroom, booking forms
│   ├── lib/                 # Supabase clients, data helpers
│   └── types/               # TypeScript database types
├── .env.local.example       # Environment variable template
└── package.json
```

---

## Getting Started

You will need **Node.js 18+** and a free **Supabase** account.

### 1. Clone and install

```bash
git clone https://github.com/MullahStanley/magari-car-rental.git
cd magari-car-rental
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Copy `.env.local.example` to `.env.local`
3. Add your project URL and anon key from **Settings → API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Run the database migration

Open the **SQL Editor** in Supabase and run the full script in:

```
supabase/migrations/001_initial_schema.sql
```

This creates the `profiles`, `vehicles`, and `bookings` tables, enables Row Level Security, sets up the `vehicle-assets` storage bucket, and inserts sample car data.

### 4. Upload 3D models (optional)

Upload `.glb` files to the `vehicle-assets` bucket in Supabase Storage. Paths should match the seed data, e.g. `models/tesla-model-s.glb`.

The homepage uses a public demo model so the 3D viewer works even before you upload your own files.

### 5. Run the app

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## Database Overview

| Table | Purpose |
|-------|---------|
| `profiles` | User info linked to Supabase Auth |
| `vehicles` | Car fleet (name, brand, category, daily rate, 3D model path) |
| `bookings` | Rental records with start/end dates and total price |

**Security:** All tables use Row Level Security (RLS). Users can only see and manage their own bookings. Vehicle data is publicly readable; only admins can add or edit cars. A database trigger also prevents double-booking the same car on overlapping dates.

To make yourself an admin (for uploading vehicles):

```sql
update public.profiles set role = 'admin' where id = 'your-user-uuid';
```

---

## Main Features Explained

### 3D Showroom (`VehicleShowroom`)

A client-side React Three Fiber component that loads `.glb` models from Supabase Storage. It includes lighting, orbit controls (zoom disabled so users don't clip inside the model), a loading spinner, and a color picker that updates the car body material.

### Fleet Catalog (`/cars`)

Server-rendered page that fetches vehicles from Supabase. Client-side filters update URL query parameters (`category`, `minPrice`, `maxPrice`, `startDate`, `endDate`) so the page state is shareable.

### Booking Flow

Users pick a date range using a calendar component. Past dates and invalid ranges are blocked in the UI. When they confirm, a Server Action validates the dates, checks the price, and inserts the booking. If the car is already booked for those dates, the database rejects it.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint |

---

## Challenges & What I Learned

- **Server vs Client Components** — Keeping data fetching on the server and only marking interactive parts (3D canvas, filters, forms) as `"use client"` took some planning.
- **React Three Fiber** — Loading GLB models asynchronously and applying material changes without breaking the scene was tricky at first.
- **Row Level Security** — Writing policies so users can only access their own data while keeping the vehicle catalog public required careful SQL.
- **Date validation** — Handling date ranges correctly (timezone issues, overlap checks) needed validation both in the UI and on the server/database.

---

## Future Improvements

- Payment integration (e.g. Stripe or M-Pesa)
- Admin dashboard to manage the fleet without using the Supabase dashboard
- Email notifications when a booking is confirmed
- Real car images alongside 3D models

---

## Author

**Mullah Kimani**  
Bsc Software development, KCAU 
kimanimullah@gmail.com

---

## License

This project was created for educational purposes as part of a university assignment.
