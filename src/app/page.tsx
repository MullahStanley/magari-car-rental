import Link from "next/link";
import { ArrowRight, Car, Shield, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroShowroom } from "@/components/showroom/hero-showroom";

const features = [
  {
    icon: Sparkles,
    title: "3D Showroom",
    description:
      "Explore every vehicle in stunning 3D. Rotate, zoom, and customize paint colors before you book.",
  },
  {
    icon: Zap,
    title: "Instant Booking",
    description:
      "Select your dates, see real-time pricing, and confirm your rental in seconds.",
  },
  {
    icon: Shield,
    title: "Secure & Reliable",
    description:
      "Enterprise-grade security with encrypted payments and verified vehicle availability.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="container relative mx-auto px-4 py-16 md:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-1.5 text-sm backdrop-blur-sm">
                <Car className="h-4 w-4 text-primary" />
                Premium car rental reimagined
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Drive the{" "}
                <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                  extraordinary
                </span>
              </h1>
              <p className="max-w-lg text-lg text-muted-foreground">
                Browse our curated fleet of luxury and performance vehicles.
                Preview each car in interactive 3D, pick your dates, and hit
                the road.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" asChild>
                  <Link href="/cars">
                    Browse Fleet
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/cars?category=Sports">Sports Cars</Link>
                </Button>
              </div>
            </div>
            <HeroShowroom />
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold">Why Magari?</h2>
            <p className="mt-2 text-muted-foreground">
              A rental experience built for the modern driver
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Ready to hit the road?</h2>
          <p className="mt-2 text-muted-foreground">
            Choose from SUVs, sedans, and sports cars from as low as Ksh.2000/day
          </p>
          <Button size="lg" className="mt-8" asChild>
            <Link href="/cars">
              Explore Our Fleet
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
