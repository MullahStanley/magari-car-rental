export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type UserRole = "user" | "admin";
export type VehicleCategory = "SUV" | "Sedan" | "Sports" | string;

export interface AdminBookingRow {
  id: string;
  user_id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  status: BookingStatus;
  created_at: string;
  vehicle_name: string;
  vehicle_brand: string;
  vehicle_category: string;
  vehicle_image_url: string | null;
  user_full_name: string | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          role: UserRole;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          updated_at?: string;
        };
      };
      vehicles: {
        Row: {
          id: string;
          name: string;
          brand: string;
          category: string;
          daily_rate: number;
          model_3d_url: string;
          image_url: string | null;
          description: string | null;
          is_available: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          brand: string;
          category: string;
          daily_rate: number;
          model_3d_url: string;
          image_url?: string | null;
          description?: string | null;
          is_available?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          brand?: string;
          category?: string;
          daily_rate?: number;
          model_3d_url?: string;
          image_url?: string | null;
          description?: string | null;
          is_available?: boolean;
          created_at?: string;
        };
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          vehicle_id: string;
          start_date: string;
          end_date: string;
          total_price: number;
          status: BookingStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vehicle_id: string;
          start_date: string;
          end_date: string;
          total_price: number;
          status?: BookingStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          vehicle_id?: string;
          start_date?: string;
          end_date?: string;
          total_price?: number;
          status?: BookingStatus;
          created_at?: string;
        };
      };
    };
    Functions: {
      admin_get_bookings: {
        Args: Record<string, never>;
        Returns: AdminBookingRow[];
      };
      admin_update_booking_status: {
        Args: {
          p_booking_id: string;
          p_status: BookingStatus;
        };
        Returns: undefined;
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type Booking = Database["public"]["Tables"]["bookings"]["Row"];

export interface BookingWithVehicle extends Booking {
  vehicles: Pick<
    Vehicle,
    "name" | "brand" | "category" | "daily_rate" | "image_url"
  >;
}
