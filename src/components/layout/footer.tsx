import Link from "next/link";
import { Car } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <Car className="h-5 w-5 text-primary" />
              Magari
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Premium car rentals with interactive 3D previews. Drive your dream
              car today.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Explore</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/cars" className="hover:text-foreground">
                  Browse Fleet
                </Link>
              </li>
              <li>
                <Link href="/bookings" className="hover:text-foreground">
                  My Bookings
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold">Contact</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              support@magari.com
              <br />
              +1 (555) 123-4567
            </p>
          </div>
        </div>
        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Magari Car Rental. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
