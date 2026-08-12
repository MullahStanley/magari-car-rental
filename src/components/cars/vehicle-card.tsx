"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ArrowRight, Car } from "lucide-react";
import type { Vehicle } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency, getImageUrl } from "@/lib/utils";

interface VehicleCardProps {
  vehicle: Vehicle;
  index?: number;
}

export function VehicleCard({ vehicle, index = 0 }: VehicleCardProps) {
  const imageUrl = getImageUrl(vehicle.image_url);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <Card className="group overflow-hidden transition-shadow hover:shadow-lg">
        <div className="relative flex h-48 items-center justify-center overflow-hidden bg-gradient-to-br from-primary/10 via-muted to-muted/40">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={`${vehicle.brand} ${vehicle.name}`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <Car className="h-20 w-20 text-muted-foreground/30 transition-transform group-hover:scale-110" />
          )}
          <Badge className="absolute right-3 top-3 z-10" variant="secondary">
            {vehicle.category}
          </Badge>
        </div>
        <CardHeader>
          <CardDescription className="text-xs uppercase tracking-wider">
            {vehicle.brand}
          </CardDescription>
          <CardTitle className="text-xl">{vehicle.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {vehicle.description}
          </p>
          <p className="mt-3 text-2xl font-bold">
            {formatCurrency(vehicle.daily_rate)}
            <span className="text-sm font-normal text-muted-foreground">
              /day
            </span>
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full group-hover:bg-primary/90">
            <Link href={`/cars/${vehicle.id}`}>
              View & Book
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
